#!/usr/bin/env node
/* Famstamp import tests. Every file here is made up on the spot: no real places someone lives, no real photos.
   Run: node scripts/test_import.js            (add --big for the 150 MB Records.json and 100k-sidecar stress runs) */
"use strict";
const fs = require("fs"), path = require("path"), zlib = require("zlib"), os = require("os"), cp = require("child_process");
const APP = path.join(__dirname, "..", "travel-log", "app");
global.self = global;
require(path.join(APP, "import-geo.js")); require(path.join(APP, "import-towns.js"));
const I = require(path.join(APP, "import-core.js"));
const GEO = I.Geo(self.FS_IMPORT_GEO, self.FS_IMPORT_TOWNS);
const BIG = process.argv.includes("--big");
let pass = 0, fail = 0;
function ok(c, msg) { if (c) pass++; else { fail++; console.log("FAIL:", msg); } }
function eq(a, b, msg) { ok(JSON.stringify(a) === JSON.stringify(b), msg + " (got " + JSON.stringify(a) + ", want " + JSON.stringify(b) + ")"); }
function file(name, data) { return new File([data], name); }
const run = (files, o) => I.run(files, null, Object.assign({ geo: GEO }, o || {}));
const iso = (ms) => new Date(ms).toISOString();
const D = (s) => Date.parse(s);

// ---------- tiny synthetic file builders ----------
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function zip(entries, opt) {   // entries: [name, Buffer|string, store?]
  const parts = [], cd = []; let off = 0;
  for (const [name, d0, store] of entries) {
    const data = Buffer.isBuffer(d0) ? d0 : Buffer.from(d0), nm = Buffer.from(name), comp = store ? data : zlib.deflateRawSync(data), crc = opt && opt.nocrc ? 0 : crc32(data);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(store ? 0 : 8, 8); h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nm.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(store ? 0 : 8, 10); c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
    parts.push(h, nm, comp); cd.push(c, nm); off += 30 + nm.length + comp.length;
  }
  const cdb = Buffer.concat(cd), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(entries.length, 8); e.writeUInt16LE(entries.length, 10); e.writeUInt32LE(cdb.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat(parts.concat([cdb, e]));
}
function jpeg(o) {   // o: { make, model, dto "2019:07:04 10:00:00", gps: [lat, lon], pad }
  const ent = (tag, type, vals) => ({ tag, type, vals });
  const asc = (s) => Buffer.from(s + "\0", "ascii");
  const rat = (v) => { v = Math.abs(v); const d = Math.floor(v), m = Math.floor((v - d) * 60), s = Math.round(((v - d) * 60 - m) * 60 * 1000); return [[d, 1], [m, 1], [s, 1000]]; };
  function ifdBuf(list, base) {   // little-endian IFD at offset base; returns {buf}
    const n = list.length, head = 2 + n * 12 + 4; let data = Buffer.alloc(0); const b = Buffer.alloc(head); b.writeUInt16LE(n, 0);
    list.forEach((e, i) => {
      const p = 2 + i * 12; let raw, count;
      if (e.type === 2) { raw = asc(e.vals); count = raw.length; }
      else if (e.type === 4) { raw = Buffer.alloc(4); raw.writeUInt32LE(e.vals, 0); count = 1; }
      else { raw = Buffer.alloc(e.vals.length * 8); e.vals.forEach((r, k) => { raw.writeUInt32LE(r[0], k * 8); raw.writeUInt32LE(r[1], k * 8 + 4); }); count = e.vals.length; }
      b.writeUInt16LE(e.tag, p); b.writeUInt16LE(e.type, p + 2); b.writeUInt32LE(count, p + 4);
      if (raw.length <= 4) raw.copy(b, p + 8); else { b.writeUInt32LE(base + head + data.length, p + 8); data = Buffer.concat([data, raw]); }
    });
    return Buffer.concat([b, data]);
  }
  const ex = o.dto ? [ent(0x9003, 2, o.dto)] : [], gp = o.gps ? [ent(1, 2, o.gps[0] < 0 ? "S" : "N"), ent(2, 5, rat(o.gps[0])), ent(3, 2, o.gps[1] < 0 ? "W" : "E"), ent(4, 5, rat(o.gps[1]))] : [];
  // two passes: lay out IFD0 with placeholder pointers, then the sub-IFDs after it
  const mk = (exOff, gpOff) => { const l = []; if (o.make) l.push(ent(0x010f, 2, o.make)); if (o.model) l.push(ent(0x0110, 2, o.model)); if (ex.length) l.push(ent(0x8769, 4, exOff)); if (gp.length) l.push(ent(0x8825, 4, gpOff)); return l; };
  let i0 = ifdBuf(mk(0, 0), 8); const exOff = 8 + i0.length, exB = ifdBuf(ex, exOff), gpOff = exOff + exB.length, gpB = ifdBuf(gp, gpOff);
  i0 = ifdBuf(mk(ex.length ? exOff : 0, gp.length ? gpOff : 0), 8);
  const tiff = Buffer.concat([Buffer.from("II*\0"), Buffer.from([8, 0, 0, 0]), i0, ex.length ? exB : Buffer.alloc(0), gp.length ? gpB : Buffer.alloc(0)]);
  const app1 = Buffer.concat([Buffer.from("Exif\0\0"), tiff]), seg = Buffer.alloc(4); seg[0] = 0xff; seg[1] = 0xe1; seg.writeUInt16BE(app1.length + 2, 2);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), seg, app1, Buffer.alloc(o.pad || 2000, 7), Buffer.from([0xff, 0xd9])]);
}
function sidecar(o) {   // o: { title, t (ms), lat, lon, origin }
  const j = { title: o.title, photoTakenTime: { timestamp: String(Math.floor(o.t / 1000)) }, creationTime: { timestamp: String(Math.floor((o.up || o.t) / 1000)) },
    geoData: { latitude: o.lat || 0, longitude: o.lon || 0, altitude: 0 }, geoDataExif: { latitude: o.lat || 0, longitude: o.lon || 0 } };
  if (o.origin === "mobile") j.googlePhotosOrigin = { mobileUpload: { deviceFolder: { localFolderName: o.folder || "" }, deviceType: "ANDROID_PHONE" } };
  else if (o.origin === "web") j.googlePhotosOrigin = { webUpload: { computerUpload: {} } };
  else if (o.origin === "shared") j.googlePhotosOrigin = { fromSharedAlbum: {} };
  else if (o.origin === "partner") j.googlePhotosOrigin = { fromPartnerSharing: {} };
  else if (o.origin === "app") j.googlePhotosOrigin = { thirdPartyApp: {} };
  return JSON.stringify(j);
}
// Made-up home: a town with no special meaning, plus round-number trips
const HOME = { lat: 39.7392, lon: -104.9903 };   // Denver, CO
const CHI = { lat: 41.8781, lon: -87.6298 }, SF = { lat: 37.7749, lon: -122.4194 }, EDI = { lat: 55.9533, lon: -3.1883 }, GLA = { lat: 55.8642, lon: -4.2518 };
function homeRecords(fromDay, n) { const L = []; for (let d = 0; d < n; d++) for (let h = 0; h < 24; h += 3) L.push({ latitudeE7: Math.round(HOME.lat * 1e7), longitudeE7: Math.round(HOME.lon * 1e7), timestamp: iso(D(fromDay) + d * 864e5 + h * 36e5) }); return L; }
function recsAt(p, fromIso, days) { const L = []; for (let d = 0; d < days; d++) for (let h = 0; h < 24; h += 2) L.push({ latitudeE7: Math.round(p.lat * 1e7), longitudeE7: Math.round(p.lon * 1e7), timestamp: iso(D(fromIso) + d * 864e5 + h * 36e5) }); return L; }

module.exports = { zip, jpeg, sidecar, HOME, CHI, SF, EDI, GLA, homeRecords, recsAt };
if (require.main === module) (async function main() {
  // ---------- Records.json (old Takeout) ----------
  {
    const recs = homeRecords("2019-06-01T00:00:00Z", 20).concat(recsAt(CHI, "2019-06-21T06:00:00Z", 3), homeRecords("2019-06-25T00:00:00Z", 5));
    const R = await run([file("Records.json", JSON.stringify({ locations: recs }))]);
    ok(R.kinds.records > 0 || R.kinds["records"] === undefined && R.points > 0, "Records.json read");
    const H = I.detectHome(R); ok(H.home && I.km(H.home.lat, H.home.lon, HOME.lat, HOME.lon) < 25, "home found from Records");
    const T = I.detectTrips(R, { home: H.home });
    eq(T.length, 1, "one Records trip"); eq(T[0] && T[0].states, ["IL"], "Chicago trip state IL");
    ok(T[0] && T[0].start === "2019-06-21" && T[0].end >= "2019-06-23", "Chicago trip dates " + (T[0] && T[0].start + ".." + T[0].end));
    // re-import is safe: same keys, and an already-imported trip is recognised
    const R2 = await run([file("Records.json", JSON.stringify({ locations: recs })), file("Records (1).json", JSON.stringify({ locations: recs }))]);
    eq(R2.points, R.points * 2 >= R2.points ? R2.points : -1, "duplicate file read without blowing up");
    const T2 = I.detectTrips(R2, { home: H.home }); eq(T2.map((t) => t.key), T.map((t) => t.key), "same trip keys on re-import / duplicate file");
    const app = I.toAppTrip(T[0], { kidIds: ["k1"] });
    // the 1.4 trips model takes the imported route as is, and the trip fits a sync row
    const TC = require(path.join(APP, "trips-core.js")), x = TC.cleanExtras(app.extra, ["k1"]);
    ok(x.route.length === app.extra.route.length && x.route.every((p) => p.name), "trips-core keeps the imported route");
    ok(x.route.some((p) => p.region === "IL" && p.country === "USA" && p.lat), "route points keep place, state and country");
    ok(x.endDate === T[0].end && x.nights === T[0].nights, "end date and nights kept");
    const big = Object.assign({}, app.base, x, { importKey: app.extra.importKey, import: app.extra.import }); TC.fitSize(big); ok(Buffer.byteLength(JSON.stringify(big)) < 16000, "imported trip fits a sync row");
    const m = I.matchExisting(T2, [Object.assign({}, app.base, app.extra, { id: "t1" })]);
    eq(m[0].status, "imported", "re-import marks trip as already imported"); eq(m[0].checked, false, "already imported trip not pre-checked");
    const m2 = I.matchExisting(I.detectTrips(R, { home: H.home }), [{ id: "x", place: "Chicago", date: "2019-06-22", kidIds: [] }]);
    eq(m2[0].status, "maybe", "hand-entered trip on the same dates is flagged as a maybe");
  }
  // ---------- Android Timeline.json ----------
  {
    const seg = [];
    for (let d = 0; d < 14; d++) seg.push({ startTime: iso(D("2024-03-01T07:00:00Z") + d * 864e5), endTime: iso(D("2024-03-01T07:00:00Z") + d * 864e5 + 20 * 36e5), visit: { topCandidate: { semanticType: "HOME", placeLocation: { latLng: HOME.lat + "°, " + HOME.lon + "°" } } } });
    seg.push({ startTime: "2024-03-16T10:00:00.000-07:00", endTime: "2024-03-16T12:00:00.000-07:00", timelinePath: [{ point: "39.74°, -104.99°", time: "2024-03-16T10:00:00.000-07:00" }, { point: "37.78°, -122.42°", time: "2024-03-16T11:59:00.000-07:00" }] });
    for (let d = 0; d < 4; d++) seg.push({ startTime: iso(D("2024-03-16T20:00:00Z") + d * 864e5), endTime: iso(D("2024-03-16T20:00:00Z") + d * 864e5 + 20 * 36e5), visit: { topCandidate: { semanticType: "UNKNOWN", placeLocation: { latLng: SF.lat + "°, " + SF.lon + "°" } } } });
    seg.push({ startTime: "2024-03-20T10:00:00.000-07:00", endTime: "2024-03-20T12:00:00.000-07:00", activity: { start: { latLng: "37.78°, -122.42°" }, end: { latLng: "39.74°, -104.99°" }, topCandidate: { type: "FLYING" }, distanceMeters: 1500000 } });
    const R = await run([file("Timeline.json", JSON.stringify({ semanticSegments: seg, rawSignals: [], userLocationProfile: { frequentPlaces: [{ placeLocation: HOME.lat + "°, " + HOME.lon + "°", label: "HOME" }] } }))]);
    ok(R.kinds.timeline > 0, "Android Timeline.json read");
    const H = I.detectHome(R); ok(H.home && I.km(H.home.lat, H.home.lon, HOME.lat, HOME.lon) < 25, "home from Timeline HOME label");
    const T = I.detectTrips(R, { home: H.home }); eq(T.length, 1, "one Timeline trip");
    eq(T[0] && T[0].states, ["CA"], "SF trip state CA"); ok(T[0] && T[0].route.some((p) => /San Francisco/.test(p.name)), "SF stop named");
    ok(T[0] && T[0].route.some((p) => p.mode === "plane"), "flight leg detected as plane");
  }
  // ---------- iPhone location-history.json ----------
  {
    const arr = [];
    for (let d = 0; d < 10; d++) arr.push({ startTime: iso(D("2023-05-01T08:00:00Z") + d * 864e5), endTime: iso(D("2023-05-01T08:00:00Z") + d * 864e5 + 18 * 36e5), visit: { topCandidate: { semanticType: "Home", placeLocation: "geo:" + HOME.lat + "," + HOME.lon } } });
    for (let d = 0; d < 2; d++) arr.push({ startTime: iso(D("2023-05-12T15:00:00Z") + d * 864e5), endTime: iso(D("2023-05-12T15:00:00Z") + d * 864e5 + 15 * 36e5), visit: { topCandidate: { semanticType: "Unknown", placeLocation: "geo:" + CHI.lat + "," + CHI.lon } } });
    const R = await run([file("location-history.json", JSON.stringify(arr))]);
    ok(R.kinds["timeline-ios"] > 0, "iPhone location-history.json read");
    const T = I.detectTrips(R, { home: I.detectHome(R).home }); eq(T.map((t) => t.states), [["IL"]], "iPhone trip to IL");
  }
  // ---------- Semantic Location History ----------
  {
    const objs = [{ placeVisit: { location: { latitudeE7: 418781000, longitudeE7: -876298000, name: "Made-up Hotel", address: "1 Example St" }, duration: { startTimestamp: "2018-08-10T20:00:00Z", endTimestamp: "2018-08-12T14:00:00Z" } } },
      { activitySegment: { startLocation: { latitudeE7: 418781000, longitudeE7: -876298000 }, endLocation: { latitudeE7: 397392000, longitudeE7: -1049903000 }, duration: { startTimestamp: "2018-08-12T15:00:00Z", endTimestamp: "2018-08-12T18:00:00Z" }, activityType: "FLYING", distance: 1480000 } }];
    const R = await run([file("2018_AUGUST.json", JSON.stringify({ timelineObjects: objs }))]);
    ok(R.kinds.semantic > 0 || R.entries.length > 0, "Semantic Location History read");
    const T = I.detectTrips(R, { home: HOME }); eq(T.length, 1, "semantic trip found"); ok(T[0] && T[0].nights >= 1, "overnight visit counts nights");
    ok(R.entries.some((e) => e.day === "2018-08-11"), "multi-day visit split per local day");
  }
  // ---------- Saved places ----------
  {
    const gj = { type: "FeatureCollection", features: [
      { type: "Feature", geometry: { type: "Point", coordinates: [-122.4194, 37.7749] }, properties: { Title: "A made-up bakery", date: "2020-01-01T00:00:00Z", Location: { Address: "1 Example Way", "Geo Coordinates": { Latitude: "37.7749", Longitude: "-122.4194" } } } },
      { type: "Feature", geometry: { type: "Point", coordinates: [-110.5885, 44.428] }, properties: { Title: "Yellowstone", Location: { Address: "Wyoming" } } },
      { type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties: { Title: "No coordinates", google_maps_url: "http://maps.google.com/?cid=1" } }] };
    const R = await run([file("Saved Places.json", JSON.stringify(gj))]);
    ok(R.places.length >= 2, "saved places read (" + R.places.length + ")");
    ok(R.places.some((p) => p.park === "yellowstone"), "Yellowstone saved place maps to the park");
    const csv = "Title,Note,URL,Comment\nMade-up Diner,try the pie,https://www.google.com/maps/place/Made-up+Diner/data=!4m2!3m1!1s0x0:0x1,\nSomewhere,,\"https://www.google.com/maps/search/41.8781,-87.6298\",\n";
    const R2 = await run([file("Want to go.csv", csv)]);
    ok(R2.places.length === 2 && R2.places.every((p) => p.list === "Want to go"), "saved-list CSV read into its list");
    ok(R2.places.some((p) => p.region === "IL"), "coordinates pulled from a Maps URL");
    const R3 = await run([file("Saved Places.json", JSON.stringify(gj)), file("Saved Places.json", JSON.stringify(gj))]);
    eq(R3.places.length, R.places.length, "saved places dedupe across duplicate files");
  }
  // ---------- KML / KMZ ----------
  {
    const kml = '<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Road trip</name><Folder><name>Stops</name>' +
      '<Placemark><name>Made-up motel</name><TimeStamp><when>2021-07-03T18:00:00Z</when></TimeStamp><Point><coordinates>-110.5885,44.428,0</coordinates></Point></Placemark>' +
      '<Placemark><name>Lookout</name><Point><coordinates>-111.0,45.0</coordinates></Point></Placemark></Folder>' +
      '<Placemark><name>Drive</name><LineString><coordinates>-104.99,39.74 -106.0,41.0 -108.0,43.0 -110.5,44.4</coordinates></LineString></Placemark></Document></kml>';
    const R = await run([file("trip.kml", kml)]);
    ok(R.places.length >= 1 && R.places.some((p) => /Stops/.test(p.list)), "KML folders become lists");
    ok(R.tracks.length === 1 && R.tracks[0].km > 500, "KML LineString becomes a measured route");
    const R2 = await run([file("trip.kmz", zip([["doc.kml", kml]]))]);
    eq(R2.places.length, R.places.length, "KMZ reads the same as KML");
  }
  // ---------- GPX ----------
  {
    let pts = ""; for (let i = 0; i <= 50; i++) pts += '<trkpt lat="' + (39.74 + i * 0.03).toFixed(4) + '" lon="' + (-104.99 + i * 0.02).toFixed(4) + '"><time>' + iso(D("2022-09-10T15:00:00Z") + i * 60e3) + "</time></trkpt>";
    const gpx = '<?xml version="1.0"?><gpx version="1.1" creator="test"><trk><name>Hike</name><trkseg>' + pts + "</trkseg></trk></gpx>";
    const R = await run([file("hike.gpx", gpx)]);
    ok(R.tracks.length === 1, "GPX track read");
    const T = I.tracksToTrips(R.tracks, HOME);
    ok(T.length === 1 && T[0].trackMiles > 100 && T[0].trackMiles < 140, "GPX route miles measured (" + (T[0] && T[0].trackMiles) + ")");
    ok(T[0].route.some((p) => p.miles > 0), "GPX legs carry measured miles");
  }
  // ---------- GeoJSON + CSV ----------
  {
    const gj = { type: "FeatureCollection", features: [{ type: "Feature", geometry: { type: "Point", coordinates: [-87.6298, 41.8781] }, properties: { name: "Bean", date: "2017-04-02" } }, { type: "Feature", geometry: { type: "LineString", coordinates: [[-104.99, 39.74], [-87.63, 41.88]] }, properties: { name: "Drive" } }] };
    const R = await run([file("places.geojson", JSON.stringify(gj))]);
    ok(R.entries.some((e) => e.day === "2017-04-02" && e.region === "IL"), "dated GeoJSON point read");
    const csv = "name,lat,lng,date\nPier,41.8919,-87.6051,2017-04-03\nBad row,abc,def,2017-04-03\nOut of range,95,10,2017-04-03\n\"Quoted, name\",41.88,-87.63,2017-04-04\n";
    const R2 = await run([file("my-trips.csv", csv)]);
    ok(R2.entries.filter((e) => e.region === "IL").length === 2, "CSV rows read, quoted names ok"); ok(R2.skipped >= 2, "CSV bad rows skipped");
    const R3 = await run([file("x.csv", "name,lat,lng,date\r\nCRLF,41.88,-87.63,2017-04-05\r\n")]);
    ok(R3.entries.length === 1, "CSV with CRLF line ends");
  }
  // ---------- malformed / empty ----------
  {
    for (const [n, d] of [["empty.json", ""], ["Records.json", "{\"locations\": [ {\"latitudeE7\": 1, "], ["junk.json", "not json at all"], ["empty.csv", ""], ["x.kml", "<kml><Placemark"], ["broken.zip", Buffer.from("PK\x03\x04garbage")], ["notes.txt", "hello"], ["empty.gpx", "<gpx></gpx>"]]) {
      let R, err = null; try { R = await run([file(n, d)]); } catch (e) { err = e; }
      ok(!err && R && Array.isArray(R.entries), "malformed " + n + " doesn't throw" + (err ? ": " + err.message : ""));
      ok(!err && R && (R.entries.length === 0), "malformed " + n + " gives nothing");
    }
    const R = await run([file("Takeout.zip", zip([["Takeout/archive_browser.html", "<html></html>"]]))]);
    ok(R.warn.some((w) => /just the table of contents/.test(w)), "TOC-only zip explained");
    const R2 = await run([file("backup.json", JSON.stringify({ app: "famstamp", version: 3, kids: [], trips: [] }))]);
    ok(R2.warn.length > 0, "a Famstamp backup is pointed to the restore screen");
  }
  // ---------- time zones, midnight, dateline ----------
  {
    // Tokyo 2020-01-01 23:30 to 01:30 local: counts for both days there, even though UTC says the 1st only
    const objs = [{ placeVisit: { location: { latitudeE7: 356762000, longitudeE7: 1396503000 }, duration: { startTimestamp: "2020-01-01T14:30:00Z", endTimestamp: "2020-01-01T16:30:00Z" } } }];
    const R = await run([file("tz.json", JSON.stringify({ timelineObjects: objs }))]);
    eq(R.entries.map((e) => e.day).sort(), ["2020-01-01", "2020-01-02"], "visit across local midnight in Tokyo splits into two local days");
    // Honolulu late evening: UTC is already tomorrow
    const R2 = await run([file("x.csv", "name,lat,lng,date\nWaikiki,21.2793,-157.8292,2020-03-01T07:30:00Z\n")]);
    eq(R2.entries[0] && R2.entries[0].day, "2020-02-29", "Honolulu evening lands on the local (leap) day, not UTC");
    // Dateline: Fiji (+12/+13) and Samoa (+13) vs American Samoa (-11)
    const R3 = await run([file("x.csv", "name,lat,lng,date\nSuva,-18.1416,178.4419,2021-06-30T13:00:00Z\nPago Pago,-14.2756,-170.702,2021-06-30T13:00:00Z\n")]);
    const days = R3.entries.map((e) => e.country + ":" + e.day).sort();
    eq(days, ["ASM:2021-06-30", "FJI:2021-07-01"], "dateline: same instant is a different day either side");
    const T = I.detectTrips(R3, { home: HOME }); ok(T.length === 1 && T[0].start === "2021-06-30" && T[0].end === "2021-07-01", "dateline trip spans both local days");
    // explicit offsets are honoured
    eq(I.parseTime("2021-06-30T23:30:00-05:00").ms, D("2021-07-01T04:30:00Z"), "explicit offset parsed");
    eq(I.localDay(D("2021-07-01T04:30:00Z"), null, "America/Chicago", -87.6), "2021-06-30", "local day from tz name");
    // EXIF wall-clock: no offset means the camera's local day as written
    const R4 = await run([file("p.jpg", jpeg({ make: "TestCam", model: "TC-1", dto: "2019:12:31 23:59:30", gps: [CHI.lat, CHI.lon] }))]);
    eq(R4.entries[0] && R4.entries[0].day, "2019-12-31", "EXIF time just before midnight keeps its day");
  }
  // ---------- photos: Takeout zips, sidecar names, EXIF inside the zip ----------
  {
    const t0 = D("2016-08-01T18:00:00Z"), ents = [];
    ents.push(["Takeout/Google Photos/Photos from 2016/IMG_0001.jpg", jpeg({ make: "TestPhone", model: "TP 1", dto: "2016:08:01 12:00:00", gps: [CHI.lat, CHI.lon] })]);
    ents.push(["Takeout/Google Photos/Photos from 2016/IMG_0001.jpg.supplemental-metadata.json", sidecar({ title: "IMG_0001.jpg", t: t0, origin: "mobile" })]);   // 0,0 in sidecar, GPS in EXIF
    ents.push(["Takeout/Google Photos/Photos from 2016/IMG_0002.jpg.supplemental-metad.json", sidecar({ title: "IMG_0002.jpg", t: t0 + 36e5, lat: CHI.lat + 0.01, lon: CHI.lon, origin: "mobile" })]);
    ents.push(["Takeout/Google Photos/Photos from 2016/IMG_0003.jpg.supp.json", sidecar({ title: "IMG_0003.jpg", t: t0 + 2 * 36e5, lat: CHI.lat, lon: CHI.lon + 0.01, origin: "mobile" })]);
    ents.push(["Takeout/Google Photos/Photos from 2016/IMG_0003.jpg.supplemental-metadata(1).json", sidecar({ title: "IMG_0003.jpg", t: t0 + 3 * 36e5, lat: CHI.lat, lon: CHI.lon + 0.02, origin: "mobile" })]);
    ents.push(["Takeout/Google Photos/Photos from 2016/VID_0004.mp4.supplemental-metadata.json", sidecar({ title: "VID_0004.mp4", t: t0 + 4 * 36e5, lat: CHI.lat, lon: CHI.lon, origin: "mobile" })]);
    ents.push(["Takeout/Google Photos/Photos from 2016/clip.3gp.json", sidecar({ title: "clip.3gp", t: t0 + 5 * 36e5, lat: CHI.lat, lon: CHI.lon, origin: "mobile" })]);
    ents.push(["Takeout/Google Photos/Photos from 2016/no-place.jpg.json", sidecar({ title: "no-place.jpg", t: D("2015-02-01T12:00:00Z"), origin: "mobile" })]);
    ents.push(["Takeout/Google Photos/Photos from 2016/metadata.json", JSON.stringify({ title: "Photos from 2016" })]);
    const a = zip(ents.slice(0, 4)), b = zip([["Takeout/archive_browser.html", "<html/>"]].concat(ents.slice(4)));
    // the same photo also sits in an album folder in a second zip
    const c = zip([["Takeout/Google Photos/Summer/IMG_0002.jpg.supplemental-metadata.json", sidecar({ title: "IMG_0002.jpg", t: t0 + 36e5, lat: CHI.lat + 0.01, lon: CHI.lon, origin: "mobile" })]]);
    const R = await run([file("takeout-001.zip", a), file("takeout-002.zip", b), file("takeout-003.zip", c)]);
    eq(R.photos, 6, "photos with a place: EXIF one + suffix variants + (1) dupe + 2 videos, album copy not doubled");
    ok(R.kinds["exif-gps"] === 1, "EXIF GPS used when the sidecar says 0,0");
    ok(R.kinds["photo-dupes"] >= 1, "album copy dropped");
    ok(!R.warn.some((w) => /table of contents/.test(w)), "TOC page alongside photos doesn't warn");
    const T = I.detectTrips(R, { home: HOME }); ok(T.length === 1 && T[0].states[0] === "IL" && T[0].photos >= 6, "photo trip to IL");
    eq(T[0] && T[0].start, "2016-08-01", "EXIF local date wins");
    eq(I.sidecarMedia("a/IMG_1.jpg.supplemental-metadata(2).json", "IMG_1.jpg"), ["a/IMG_1(2).jpg"], "(2) sidecar maps to IMG_1(2).jpg");
    eq(I.sidecarMedia("a/IMG_1.jpg.supplem.json", "")[0], "a/IMG_1.jpg", "truncated .supplem.json");
    // loose sidecars (unzipped folder)
    const R2 = await run([file("IMG_0002.jpg.supplemental-metadata.json", ents[2][1]), file("IMG_0003.jpg.supp.json", ents[3][1])]);
    eq(R2.photos, 2, "loose sidecars read");
  }
  // ---------- whose photo is it? ----------
  {
    const tr = (o) => I.photoTrust(Object.assign({ name: "IMG_1.jpg", camera: "", origin: "", folder: "" }, o)).level;
    eq(tr({ origin: "mobile" }), "own", "phone upload is yours");
    eq(tr({ origin: "web" }), "unsure", "computer upload with no camera is unsure");
    eq(tr({ origin: "web", camera: "SONY DSC-RX100" }), "own", "computer upload from a real camera is yours");
    eq(tr({ origin: "shared" }), "no", "shared album photo is left out");
    eq(tr({ name: "Screenshot_20200101-101010.png", origin: "mobile" }), "unsure", "screenshot unsure");
    eq(tr({ name: "FB_IMG_1577836800000.jpg", origin: "mobile" }), "unsure", "Facebook download unsure");
    eq(tr({ name: "IMG-20200101-WA0001.jpg", origin: "mobile" }), "unsure", "WhatsApp image unsure");
    eq(tr({ name: "received_123456789.jpeg", origin: "mobile" }), "unsure", "Messenger received unsure");
    eq(tr({ name: "mountain-lake-1234567.jpg", camera: "Canon EOS 5D" }), "unsure", "stock-site name unsure even with camera EXIF");
    eq(tr({ name: "IMG_20200101_101010.jpg", origin: "mobile", folder: "Download" }), "unsure", "phone Download folder unsure");
    eq(tr({ name: "Snapchat-1234567890.jpg", origin: "app" }), "own", "Snapchat save is yours");
    eq(tr({ name: "Snapchat-1234567890.jpg" }), "own", "Snapchat name alone is yours");
    eq(tr({ origin: "app" }), "own", "thirdPartyApp origin is yours");
    eq(tr({ name: "PICT0001.JPG", camera: "Camp Snap" }), "own", "Camp Snap camera is yours");
    eq(tr({ name: "DSC00001.JPG", camera: "ILCE-7M3" }), "own", "Sony body is yours");
    eq(tr({}), "unsure", "nothing says it's yours: unsure");
    eq(I.photoTrust({ name: "DSC1.JPG", camera: "Uncle's Nikon" }, { "Uncle's Nikon": "not" }).level, "no", "camera marked not mine");
    eq(I.photoTrust({ name: "x.jpg", camera: "" , origin: "web" }, {}).level, "unsure", "prefs don't affect cameraless");
    eq(I.cameraName("SONY", "ILCE-7M3"), "SONY ILCE-7M3", "camera name joins make + model"); eq(I.cameraName("Canon", "Canon EOS R5"), "Canon EOS R5", "camera name drops repeated make");

    // a trip from your phone, plus a far-away web upload, a lone screenshot, and someone else's shared album
    const day = D("2022-04-10T17:00:00Z"), ents = [];
    for (let i = 0; i < 5; i++) ents.push(["Takeout/Google Photos/Photos from 2022/IMG_" + i + ".jpg.json", sidecar({ title: "IMG_" + i + ".jpg", t: day + i * 864e5 / 2, lat: CHI.lat, lon: CHI.lon, origin: "mobile" })]);
    ents.push(["Takeout/Google Photos/Photos from 2022/paris.jpg.json", sidecar({ title: "paris.jpg", t: D("2022-06-01T12:00:00Z"), lat: 48.8566, lon: 2.3522, origin: "web" })]);
    ents.push(["Takeout/Google Photos/Photos from 2022/Screenshot_2022.png.json", sidecar({ title: "Screenshot_20220701-120000.png", t: D("2022-07-01T12:00:00Z"), lat: 21.3069, lon: -157.8583, origin: "mobile" })]);
    ents.push(["Takeout/Google Photos/Friends trip/DSC_9.jpg.json", sidecar({ title: "DSC_9.jpg", t: D("2022-08-01T12:00:00Z"), lat: 40.4168, lon: -3.7038, origin: "shared" })]);
    ents.push(["Takeout/Google Photos/Photos from 2022/IMG_lone.jpg.json", sidecar({ title: "IMG_lone.jpg", t: D("2022-09-01T12:00:00Z"), lat: 25.7617, lon: -80.1918, origin: "mobile" })]);
    // a screenshot taken during the real Chicago trip is fine: you were there
    ents.push(["Takeout/Google Photos/Photos from 2022/Screenshot_chi.png.json", sidecar({ title: "Screenshot_20220411-090000.png", t: day + 864e5, lat: CHI.lat + 0.02, lon: CHI.lon, origin: "mobile" })]);
    const R = await run([file("takeout.zip", zip(ents))]);
    eq(R.notYours, 1, "shared-album photo left out"); ok(!R.entries.some((e) => e.country === "ESP"), "no Spain from someone else's album");
    const T = I.matchExisting(I.detectTrips(R, { home: HOME }), []);
    const sure = T.filter((t) => !t.unsure), uns = T.filter((t) => t.unsure);
    eq(sure.map((t) => t.states), [["IL"]], "only the phone trip is a confident trip");
    ok(sure[0] && sure[0].checked, "confident trip pre-checked");
    eq(uns.map((t) => t.start).sort(), ["2022-06-01", "2022-07-01", "2022-09-01"], "web upload, far screenshot and lone photo go to 'Did you actually go here?'");
    ok(uns.every((t) => !t.checked), "unsure places start unchecked");
    ok(uns.find((t) => t.start === "2022-09-01").why.indexOf("single") >= 0, "lone photo far from home flagged as single");
    ok(uns.find((t) => t.start === "2022-06-01").why.indexOf("web") >= 0, "web upload flagged");
    ok(sure[0].photos >= 6, "screenshot during the trip counts on it");
    // never auto-stamp: what would be saved is only what is checked
    const auto = T.filter((t) => t.checked).map(I.areasOf).flat().map((a) => a.id);
    ok(auto.indexOf("FRA") < 0 && auto.indexOf("HI") < 0 && auto.indexOf("FL") < 0, "no passport stamp or state sign from unsure places unless ticked");
  }
  // ---------- cameras without GPS: placed by time ----------
  {
    // Scotland: phone photos with GPS, the Sony (no GPS, local wall-clock EXIF) shot within hours of them
    const ents = [];
    const ph = [["2023-05-10T10:00:00Z", EDI], ["2023-05-11T15:00:00Z", EDI], ["2023-05-12T12:00:00Z", GLA], ["2023-05-13T09:00:00Z", GLA]];
    ph.forEach(([t, p], i) => { ents.push(["Takeout/Google Photos/Photos from 2023/PXL_" + i + ".jpg", jpeg({ make: "Google", model: "Pixel 7", dto: t.slice(0, 19).replace(/-/g, ":").replace("T", " ").replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1:$2:$3"), gps: [p.lat, p.lon] })]); });
    // EXIF wall times: BST = UTC+1 in May
    const sony = ["2023:05:10 13:30:00", "2023:05:11 17:00:00", "2023:05:12 14:10:00", "2023:05:12 15:00:00", "2023:05:13 10:30:00"];
    sony.forEach((t, i) => ents.push(["Takeout/Google Photos/Photos from 2023/DSC0000" + i + ".JPG", jpeg({ make: "SONY", model: "DSC-RX100M3", dto: t })]));
    // the Sony was also out the day after the phone died: no phone photo within 6 h, still counted on the trip
    ents.push(["Takeout/Google Photos/Photos from 2023/DSC00099.JPG", jpeg({ make: "SONY", model: "DSC-RX100M3", dto: "2023:05:14 18:00:00" })]);
    // and a Sony photo months later at home with nothing to place it by
    ents.push(["Takeout/Google Photos/Photos from 2023/DSC00100.JPG", jpeg({ make: "SONY", model: "DSC-RX100M3", dto: "2023:09:01 12:00:00" })]);
    const R = await run([file("takeout-sony.zip", zip(ents))], { towns: true });
    eq(R.placedByTime, 5, "5 Sony photos placed by phone GPS within 6 h");
    ok(R.cameras["SONY DSC-RX100M3"] && R.cameras["SONY DSC-RX100M3"].n === 7 && R.cameras["SONY DSC-RX100M3"].gps === 0, "Sony listed under My cameras");
    const T = I.detectTrips(R, { home: HOME });
    eq(T.length, 1, "one Scotland trip"); const t = T[0] || {};
    ok(t.places && t.places.indexOf("SCT") >= 0, "Scotland sign from Sony + phone (" + JSON.stringify(t.places) + ")");
    ok(t.photos === 10, "trip counts 4 phone + 5 placed + 1 day-after Sony photo (" + t.photos + ")"); eq(t.extraPhotos, 1, "day-after Sony photo attached by date");
    eq(T.unplaced, 1, "the September Sony photo has no trip and no place");
    ok(t.mark && /GB|GBR/.test(JSON.stringify(t)), "UK passport stamp");
    // Sony without any phone photos at all: no places invented
    const R2 = await run([file("sony-only.zip", zip(sony.map((s, i) => ["Photos from 2023/DSC" + i + ".JPG", jpeg({ make: "SONY", model: "ILCE-6400", dto: s })])))]);
    eq(R2.entries.length, 0, "camera photos with no GPS never invent a place"); eq(I.detectTrips(R2, { home: HOME }).unplaced, 5, "they're counted as no location");
    // Camp Snap: minimal EXIF (make only, odd model), on a trip that has phone GPS a day away
    const ents3 = [["Photos from 2023/PXL_a.jpg", jpeg({ make: "Google", model: "Pixel 7", dto: "2023:07:01 10:00:00", gps: [SF.lat, SF.lon] })], ["Photos from 2023/PXL_b.jpg", jpeg({ make: "Google", model: "Pixel 7", dto: "2023:07:03 10:00:00", gps: [SF.lat, SF.lon] })],
      ["Photos from 2023/PICT0001.JPG", jpeg({ make: "Camp Snap", dto: "2023:07:02 09:00:00" })], ["Photos from 2023/PICT0002.JPG", jpeg({ make: "Camp Snap", model: "V2", dto: "2023:07:04 23:00:00" })]];
    const R3 = await run([file("campsnap.zip", zip(ents3))]);
    const T3 = I.detectTrips(R3, { home: HOME });
    ok(T3.length === 1 && T3[0].photos === 4 && T3[0].extraPhotos === 2, "Camp Snap photos counted on the SF trip (+/- 1 day), no new places");
    ok(Object.keys(R3.cameras).some((c) => /Camp Snap/.test(c)), "Camp Snap listed as a camera");
    // Snapchat saves: EXIF stripped, a sidecar with the upload time, thirdPartyApp origin
    const snap = [["Photos from 2023/Snapchat-111111.jpg", Buffer.from([0xff, 0xd8, 0xff, 0xd9])], ["Photos from 2023/Snapchat-111111.jpg.supplemental-metadata.json", sidecar({ title: "Snapchat-111111.jpg", t: D("2023-07-01T19:00:00Z"), origin: "app" })]];
    const R4 = await run([file("campsnap.zip", zip(ents3.concat(snap)))]);
    eq(R4.placedByTime, 1, "Snapchat save placed by time next to the phone photo"); ok(R4.notYours === 0, "Snapchat not treated as someone else's");
    // a camera marked not mine is left out
    const R5 = await run([file("campsnap.zip", zip(ents3))], { cameras: { "Camp Snap": "not", "Camp Snap V2": "not" } });
    ok(R5.notYours === 2 && I.detectTrips(R5, { home: HOME })[0].photos === 2, "cameras marked not mine are skipped");
    // picked photos (no sidecar): the Sony picked from the device is placed by the picked phone photo
    const R6 = await run([file("PXL_1.jpg", ents[0][1]), file("DSC00000.JPG", ents[4][1])]);
    eq(R6.placedByTime, 1, "picked Sony photo placed by picked phone photo");
    // picked photo with no camera info and no sidecar: unsure
    const R7 = await run([file("photo.jpg", jpeg({ dto: "2023:05:10 12:00:00", gps: [EDI.lat, EDI.lon] }))]);
    ok(I.detectTrips(R7, { home: HOME }).every((t) => t.unsure), "picked photo with no camera info is unsure");
  }
  // ---------- photo-locations.csv (from the helper script) ----------
  {
    const csv = "taken_at,lat,lng,camera,trust\n2023-05-10T10:00:00Z,55.9533,-3.1883,Google Pixel 7,own\n2023-05-10T13:30:00,,,SONY DSC-RX100M3,own\n2023-06-01T12:00:00Z,48.8566,2.3522,,unsure\n";
    const R = await run([file("photo-locations.csv", csv)]);
    eq(R.placedByTime, 1, "CSV row with no lat/lng placed by time");
    const T = I.detectTrips(R, { home: HOME });
    ok(T.some((t) => !t.unsure && t.places.indexOf("SCT") >= 0) && T.some((t) => t.unsure && t.start === "2023-06-01"), "CSV trust column respected");
  }
  // ---------- helper script (stdlib Python) ----------
  {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fs-imp-"));
    const ents = [["Takeout/Google Photos/Photos from 2023/PXL_0.jpg", jpeg({ make: "Google", model: "Pixel 7", dto: "2023:05:10 11:00:00", gps: [EDI.lat, EDI.lon] })],
      ["Takeout/Google Photos/Photos from 2023/PXL_0.jpg.supplemental-metadata.json", sidecar({ title: "PXL_0.jpg", t: D("2023-05-10T10:00:00Z"), origin: "mobile" })],
      ["Takeout/Google Photos/Photos from 2023/DSC0.JPG", jpeg({ make: "SONY", model: "DSC-RX100M3", dto: "2023:05:10 13:30:00" })],
      ["Takeout/Google Photos/Photos from 2023/Screenshot_1.png.supp.json", sidecar({ title: "Screenshot_1.png", t: D("2023-06-01T12:00:00Z"), lat: 48.85, lon: 2.35, origin: "mobile" })],
      ["Takeout/Google Photos/Shared/x.jpg.json", sidecar({ title: "x.jpg", t: D("2023-06-02T12:00:00Z"), lat: 40.41, lon: -3.70, origin: "shared" })]];
    fs.writeFileSync(path.join(dir, "takeout-1.zip"), zip(ents)); fs.writeFileSync(path.join(dir, "takeout-2.zip"), zip([["Takeout/archive_browser.html", "<html/>"]]));
    const script = path.join(APP, "photos-takeout-to-locations.py");
    if (fs.existsSync(script)) {
      const out = path.join(dir, "out.csv"), r = cp.spawnSync("python3", [script, dir, "-o", out], { encoding: "utf8" });
      ok(r.status === 0, "python helper runs: " + r.stderr);
      const rows = fs.readFileSync(out, "utf8").trim().split("\n");
      eq(rows[0], "taken_at,lat,lng,camera,trust", "python helper header");
      ok(rows.some((l) => /^2023-05-10T11:00:00,55\.95/.test(l)), "python: EXIF GPS + local time"); ok(rows.some((l) => /^2023-05-10T13:30:00,,,SONY DSC-RX100M3,own$/.test(l)), "python: Sony row kept for time placement");
      ok(rows.some((l) => /,unsure$/.test(l)) && !rows.some((l) => /40\.41/.test(l)), "python: screenshot unsure, shared album left out");
      ok(/table of contents/.test(r.stderr), "python: TOC zip explained");
      const R = await run([file("photo-locations.csv", fs.readFileSync(out))]);
      eq(R.placedByTime, 1, "python CSV round-trips into the app");
    } else ok(false, "python helper missing");
    fs.rmSync(dir, { recursive: true, force: true });
  }
  // ---------- stress ----------
  if (BIG) {
    // 150 MB Records.json, streamed from disk
    const p = path.join(os.tmpdir(), "fs-records-150mb.json"), fd = fs.openSync(p, "w"); fs.writeSync(fd, '{\n  "locations": [');
    let n = 0, size = 0, t = D("2015-01-01T00:00:00Z"), chunk = [];
    while (size < 150e6) {
      const away = Math.floor(n / 20000) % 10 === 9, lat = (away ? CHI.lat : HOME.lat) + (n % 7) * 1e-4, lon = (away ? CHI.lon : HOME.lon);
      const s = (n ? "," : "") + '\n    {\n      "latitudeE7": ' + Math.round(lat * 1e7) + ',\n      "longitudeE7": ' + Math.round(lon * 1e7) + ',\n      "accuracy": 20,\n      "source": "WIFI",\n      "timestamp": "' + iso(t) + '"\n    }';
      chunk.push(s); size += s.length; n++; t += 300e3;
      if (chunk.length > 5000) { fs.writeSync(fd, chunk.join("")); chunk = []; }
    }
    fs.writeSync(fd, chunk.join("") + "\n  ]\n}\n"); fs.closeSync(fd);
    const t0 = Date.now(), m0 = process.memoryUsage().rss; let peak = m0; const iv = setInterval(() => { peak = Math.max(peak, process.memoryUsage().rss); }, 50);
    const b = await fs.openAsBlob(p); Object.defineProperty(b, "name", { value: "Records.json" });
    const R = await I.run([b], null, { geo: GEO }); clearInterval(iv);
    const ms = Date.now() - t0, T = I.detectTrips(R, { home: I.detectHome(R).home });
    console.log("150 MB Records.json: " + n + " points in " + ms + " ms, peak RSS +" + Math.round((peak - m0) / 1e6) + " MB, " + T.length + " trips");
    eq(R.points, n, "every point in the 150 MB file read"); ok(T.length >= 4 && T.every((x) => x.states[0] === "IL"), "150 MB file: trips to IL found");
    ok(ms < 120000, "150 MB under 2 minutes");
    fs.unlinkSync(p);
    // 100k sidecars across 4 zips (stored, like Takeout), with suffix variants, (N) dupes, videos and a TOC zip
    const zs = [], per = 25000, sfx = [".supplemental-metadata.json", ".supplemental-metad.json", ".supp.json", ".json"];
    for (let z = 0; z < 4; z++) {
      const e = [];
      for (let i = 0; i < per; i++) {
        const k = z * per + i, nm = (k % 10 === 0 ? "VID_" + k + ".mp4" : "IMG_" + k + ".jpg"), when = D("2010-01-01T12:00:00Z") + k * 36e5 * 2, far = (k % 500) < 30;
        const loc = k % 4 === 0 ? {} : { lat: (far ? SF.lat : HOME.lat) + (k % 13) * 1e-3, lon: far ? SF.lon : HOME.lon };
        e.push(["Takeout/Google Photos/Photos from " + new Date(when).getUTCFullYear() + "/" + nm + (k % 97 === 0 ? ".supplemental-metadata(1).json" : sfx[k % 4]), sidecar(Object.assign({ title: nm, t: when, origin: "mobile" }, loc)), true]);
      }
      zs.push(file("takeout-2010-00" + z + ".zip", zip(e)));
    }
    zs.push(file("takeout-2010-toc.zip", zip([["Takeout/archive_browser.html", "<html/>"]])));
    const t1 = Date.now(), R2 = await I.run(zs, null, { geo: GEO }), ms2 = Date.now() - t1;
    const T2 = I.detectTrips(R2, { home: I.detectHome(R2).home });
    console.log("100k sidecars in 4 zips: " + ms2 + " ms, " + R2.photos + " located, " + T2.length + " trips, " + (R2.noLoc + (T2.unplaced || 0)) + " without a place");
    ok(R2.photos === 100000 && R2.placedByTime === 25000, "100k sidecars: 75k with GPS + 25k placed by time (" + R2.photos + ", " + R2.placedByTime + ")"); ok(T2.filter((x) => !x.unsure).every((x) => x.states.indexOf("CA") >= 0), "100k sidecars: CA trips");
    ok(ms2 < 120000, "100k sidecars under 2 minutes");
  }
  console.log("test_import: " + pass + " passed, " + fail + " failed");
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
