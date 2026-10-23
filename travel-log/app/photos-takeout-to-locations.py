#!/usr/bin/env python3
"""photos-takeout-to-locations.py: turn Google Photos Takeout zips into a tiny photo-locations.csv for Famstamp.

Usage:
    python3 photos-takeout-to-locations.py FOLDER_OR_ZIPS... [-o photo-locations.csv] [-j JOBS]

What it reads, and only this:
  * each photo's small info file (the .json "sidecar": IMG_1.jpg.supplemental-metadata.json, ...(1).json, cut-off names
    like .supp.json, or the older IMG_1.jpg.json), for photoTakenTime and geoData / geoDataExif;
  * the first 128 KB of each JPEG / HEIC inside the zip, for EXIF GPS and DateTimeOriginal. Sidecars often say 0,0 even when
    the photo itself has GPS, so EXIF wins for place and time, then the sidecar fills in.
The photos are never unpacked in full, so 50 GB of zips takes seconds to a minute or two. Years come from the photos, not
from folder or zip names. Nothing is uploaded anywhere; standard library only (Python 3.8+).

Output columns: taken_at,lat,lng,camera,trust
  * taken_at is the camera's local time when EXIF has it, else UTC with a Z.
  * lat,lng are blank for photos with no GPS (a Sony, a Camp Snap...). Famstamp places those by time: the nearest phone
    photo with GPS within 6 hours lends its place, otherwise they count toward the trip that covers that day.
  * trust is "own" or "unsure". Unsure = screenshots, saved / downloaded / stock pictures, computer uploads with no camera
    info, or nothing at all saying it came from your camera or phone. Photos shared to you from someone else's album are
    left out. Any real camera make/model counts as yours, and so do Snapchat saves.
  --not-mine "Canon EOS 5D" (repeatable) leaves out a camera that isn't yours.
"""
import argparse, csv, json, os, re, struct, sys, zipfile
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone

HEAD = 131072
MEDIA = re.compile(r"\.(jpe?g|heic|heif|dng|tiff?)$", re.I)
DOWNLOADED = re.compile(r"^(screenshot|screen[ _-]?shot|screen[ _-]?recording|fb_img|received_|img-\d{8}-wa|images?\s*(\(\d+\))?\.|unnamed|download)|download|[0-9a-f]{24,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I)
STOCK = re.compile(r"unsplash|pexels|pixabay|shutterstock|istock|gettyimages|adobestock|depositphotos|dreamstime|wallpaper|^[a-z]+(-[a-z]+)*-\d{5,7}(_\d+)?(-[a-z0-9]+)*\.[a-z]+$", re.I)
SAVED_FOLDER = re.compile(r"screenshot|download|whatsapp|messenger|telegram|facebook|instagram|twitter|pinterest|reddit|saved|browser|chrome", re.I)
JUNK = re.compile(r"^(unknown|none|default|null)$", re.I)


def camera_name(make, model):
    make, model = (make or "").strip()[:40], (model or "").strip()[:60]
    make, model = ("" if JUNK.match(make) else make), ("" if JUNK.match(model) else model)
    if not make and not model:
        return ""
    if make and model.lower().startswith(make.lower().split(" ")[0]):
        return model
    return (make + " " + model).strip()


def origin_of(v):
    o = v.get("googlePhotosOrigin") or {}
    if not isinstance(o, dict):
        return "", ""
    if "mobileUpload" in o:
        mu = o.get("mobileUpload") or {}
        return "mobile", str(((mu.get("deviceFolder") or {}).get("localFolderName")) or "")
    for k, n in (("webUpload", "web"), ("fromPartnerSharing", "partner"), ("fromSharedAlbum", "shared")):
        if k in o:
            return n, ""
    k0 = next(iter(o), "")
    if re.search(r"third.?party|app", k0, re.I): return "app", ""
    if re.search(r"drive|desktop", k0, re.I): return "desktop", ""
    return ("other" if k0 else ""), ""


def trust(name, cam, origin, folder, not_mine=()):
    """own / unsure / no. Same rules as the app (import-core.js photoTrust)."""
    if cam and cam in not_mine: return "no"
    if origin == "shared": return "no"
    snap = name.lower().startswith("snapchat-")
    if (DOWNLOADED.search(name) or STOCK.search(name)) and not snap: return "unsure"
    if cam or snap or origin == "app": return "own"
    if origin == "mobile": return "unsure" if folder and SAVED_FOLDER.search(folder) else "own"
    if origin in ("partner", "desktop"): return "own"
    return "unsure"


EDITED = re.compile(r"-(edited|bearbeitet|modifié|editado|modificato)(?=\.[^.]+$)", re.I)


def ok_ll(lat, lon):
    try:
        lat, lon = float(lat), float(lon)
    except (TypeError, ValueError):
        return None
    if not (-90 <= lat <= 90 and -180 <= lon <= 180) or (abs(lat) < 1e-6 and abs(lon) < 1e-6):
        return None
    return (lat, lon)


def exif(buf):
    """(taken_at text or None, (lat, lon) or None) from the start of a JPEG / HEIC / TIFF."""
    t = -1
    if buf[:4] in (b"II*\x00", b"MM\x00*"):
        t = 0
    else:
        i = buf.find(b"Exif\x00\x00")
        while i >= 0 and t < 0:
            if buf[i + 6:i + 10] in (b"II*\x00", b"MM\x00*"):
                t = i + 6
            else:
                i = buf.find(b"Exif\x00\x00", i + 1)
    if t < 0:
        return None, None, ""
    le = buf[t:t + 2] == b"II"
    e = "<" if le else ">"
    n = len(buf)

    def u16(o): return struct.unpack_from(e + "H", buf, t + o)[0]
    def u32(o): return struct.unpack_from(e + "I", buf, t + o)[0]

    def ifd(off):
        out = {}
        if not off or t + off + 2 > n:
            return out
        cnt = u16(off)
        if cnt > 500:
            return out
        for k in range(cnt):
            p = off + 2 + k * 12
            if t + p + 12 > n:
                break
            tag, typ, count = u16(p), u16(p + 2), u32(p + 4)
            size = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8}.get(typ, 1) * count
            out[tag] = (typ, count, p + 8 if size <= 4 else u32(p + 8))
        return out

    def ascii_(v):
        if not v or v[0] != 2:
            return ""
        s = buf[t + v[2]:t + v[2] + v[1]]
        return s.split(b"\x00")[0].decode("ascii", "replace")

    def rats(v):
        if not v or v[0] != 5:
            return []
        out = []
        for k in range(v[1]):
            o = v[2] + k * 8
            if t + o + 8 > n:
                return []
            a, b = u32(o), u32(o + 4)
            out.append(a / b if b else float("nan"))
        return out

    try:
        i0 = ifd(u32(4))
        ex = ifd(u32(i0[0x8769][2])) if 0x8769 in i0 else {}
        gp = ifd(u32(i0[0x8825][2])) if 0x8825 in i0 else {}
        when = None
        m = re.match(r"(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})", ascii_(ex.get(0x9003)) or ascii_(i0.get(0x0132)))
        if m and m.group(1) != "0000":
            when = "%s-%s-%sT%s:%s:%s" % m.groups()
            off = ascii_(ex.get(0x9011))
            if re.match(r"^[+-]\d{2}:\d{2}$", off):
                when += off
        loc = None
        la, lo = rats(gp.get(2)), rats(gp.get(4))
        if len(la) == 3 and len(lo) == 3:
            lat, lon = la[0] + la[1] / 60 + la[2] / 3600, lo[0] + lo[1] / 60 + lo[2] / 3600
            if "S" in ascii_(gp.get(1)).upper(): lat = -lat
            if "W" in ascii_(gp.get(3)).upper(): lon = -lon
            loc = ok_ll(lat, lon)
        return when, loc, camera_name(ascii_(i0.get(0x010f)), ascii_(i0.get(0x0110)))
    except (struct.error, KeyError, IndexError, ValueError):
        return None, None, ""


def sidecar_media(path, title):
    d, _, base = path.rpartition("/")
    d = d + "/" if d else ""
    dup = re.search(r"\((\d+)\)\.json$", base, re.I)
    stem = re.sub(r"(\(\d+\))?\.json$", "", base, flags=re.I)
    dot = stem.rfind(".")
    tail = stem[dot + 1:].lower() if dot > 0 else ""
    media = stem[:dot] if tail and "supplemental-metadata".startswith(tail) else stem

    def with_n(nm):
        if not dup:
            return nm
        i = nm.rfind(".")
        return nm[:i] + "(" + dup.group(1) + ")" + nm[i:] if i > 0 else nm + "(" + dup.group(1) + ")"
    out = [d + with_n(media)]
    if title and title != media:
        out.append(d + with_n(title))
    return out


def scan_zip(path):
    """One zip -> (sidecars, media, note). Runs in a worker process."""
    sides, media, note = [], {}, ""
    try:
        z = zipfile.ZipFile(path)
    except (zipfile.BadZipFile, OSError) as e:
        return sides, media, "%s: not a readable zip (%s)" % (os.path.basename(path), e)
    with z:
        infos = [i for i in z.infolist() if not i.is_dir() and "__MACOSX" not in i.filename]
        if infos and all(i.filename.endswith("archive_browser.html") for i in infos):
            return sides, media, "%s is just the table of contents; add the other zip(s) from the same export." % os.path.basename(path)
        for i in infos:
            name = i.filename
            try:
                if name.lower().endswith(".json") and i.file_size < 2_000_000:
                    try:
                        v = json.loads(z.read(i).decode("utf-8-sig"))
                    except (ValueError, UnicodeDecodeError):
                        continue
                    if not isinstance(v, dict) or not ("photoTakenTime" in v or "geoData" in v or "geoDataExif" in v):
                        continue
                    ts = (v.get("photoTakenTime") or {}).get("timestamp")
                    when = None
                    try:
                        if ts is not None and int(ts) > 0:
                            when = datetime.fromtimestamp(int(ts), timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
                    except (TypeError, ValueError, OverflowError, OSError):
                        pass
                    g, ge = v.get("geoData") or {}, v.get("geoDataExif") or {}
                    loc = ok_ll(g.get("latitude"), g.get("longitude")) or ok_ll(ge.get("latitude"), ge.get("longitude"))
                    origin, folder = origin_of(v)
                    sides.append((name, str(v.get("title") or ""), when, loc, origin, folder))
                elif MEDIA.search(name) and i.file_size > 64:
                    with z.open(i) as f:          # inflates only the first 128 KB
                        media[name] = exif(f.read(HEAD))
            except (zipfile.BadZipFile, OSError, EOFError, NotImplementedError, RuntimeError):
                continue
    return sides, media, note


def main(argv=None):
    ap = argparse.ArgumentParser(description="Google Photos Takeout zips -> photo-locations.csv (taken_at,lat,lng)")
    ap.add_argument("inputs", nargs="+", help="Takeout .zip files, or folders that hold them (searched recursively)")
    ap.add_argument("-o", "--out", default="photo-locations.csv")
    ap.add_argument("-j", "--jobs", type=int, default=min(8, os.cpu_count() or 2))
    ap.add_argument("--not-mine", action="append", default=[], metavar="CAMERA", help="leave out photos from this camera model")
    a = ap.parse_args(argv)
    zips = []
    for p in a.inputs:
        if os.path.isdir(p):
            for root, _, files in os.walk(p):
                zips += [os.path.join(root, f) for f in sorted(files) if f.lower().endswith(".zip")]
        elif os.path.isfile(p):
            zips.append(p)
    if not zips:
        sys.exit("No .zip files found.")
    sides, media, notes = [], {}, []
    if a.jobs > 1 and len(zips) > 1:
        with ProcessPoolExecutor(a.jobs) as ex:
            results = list(ex.map(scan_zip, zips))
    else:
        results = [scan_zip(z) for z in zips]
    for s, m, note in results:
        sides += s; media.update(m)
        if note: notes.append(note)
    by_media, used = {}, set()
    for k, s in enumerate(sides):
        for mp in sidecar_media(s[0], s[1]):
            by_media.setdefault(mp, k)
    rows, seen, no_loc, from_exif, skipped, unsure, cams = [], set(), 0, 0, 0, 0, {}

    def emit(name, when, loc, cam="", origin="", folder=""):
        nonlocal no_loc, skipped, unsure
        if not when:
            return
        key = EDITED.sub("", name) + "|" + when
        if key in seen:
            return
        seen.add(key)
        if cam:
            cams[cam] = cams.get(cam, 0) + 1
        tr = trust(name, cam, origin, folder, a.not_mine)
        if tr == "no":
            skipped += 1
            return
        if not loc:
            no_loc += 1
            if tr != "own":
                return                      # nothing to place it by
            rows.append((when, "", "", cam, tr))   # the app places it by time
            return
        if tr == "unsure":
            unsure += 1
        rows.append((when, round(loc[0], 5), round(loc[1], 5), cam, tr))
    for mp, (when, loc, cam) in media.items():
        k = by_media.get(mp)
        s = sides[k] if k is not None else None
        if k is not None:
            used.add(k)
        if loc and not (s and s[3]):
            from_exif += 1
        emit(mp.rsplit("/", 1)[-1], when or (s and s[2]), loc or (s and s[3]), cam, s[4] if s else "", s[5] if s else "")
    for k, s in enumerate(sides):
        if k not in used:
            emit(s[1] or s[0].rsplit("/", 1)[-1], s[2], s[3], "", s[4], s[5])
    rows.sort()
    with open(a.out, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["taken_at", "lat", "lng", "camera", "trust"])
        w.writerows(rows)
    for n in notes:
        print(n, file=sys.stderr)
    located = sum(1 for r in rows if r[1] != "")
    print("%d zip(s), %d photos/videos, %d info files: wrote %d locations to %s (%d from the photos' own GPS, %d unsure); "
          "%d had no location (%d of them kept so the app can place them by time); %d left out as not yours."
          % (len(zips), len(media), len(sides), located, a.out, from_exif, unsure, no_loc, len(rows) - located, skipped))
    if cams:
        print("Cameras: " + ", ".join("%s (%d)" % kv for kv in sorted(cams.items(), key=lambda kv: -kv[1])))


if __name__ == "__main__":
    main()
