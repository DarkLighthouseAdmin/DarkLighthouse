/* Famstamp v81: OpenStreetMap helpers for places our own lists don't have. Pure functions (tested in node); osm-ui code lives in pin.js.
   Nominatim usage policy (operations.osmfoundation.org/policies/nominatim): at most 1 request a second, only when someone taps
   (never search-as-you-type), results cached on the phone, "© OpenStreetMap contributors" shown with the results. Data: ODbL. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.FS_OSM = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var HOST = "https://nominatim.openstreetmap.org", TILES = "https://tile.openstreetmap.org", ATTR = "© OpenStreetMap contributors";
  var GAP_MS = 1100, CACHE_MAX = 150;
  function searchURL(q) {
    return HOST + "/search?" + ["format=jsonv2", "addressdetails=1", "extratags=1", "limit=8", "accept-language=en", "q=" + encodeURIComponent(String(q || "").trim().slice(0, 120))].join("&");
  }
  function reverseURL(lat, lon) { return HOST + "/reverse?format=jsonv2&addressdetails=1&zoom=10&accept-language=en&lat=" + (+lat).toFixed(5) + "&lon=" + (+lon).toFixed(5); }
  // OSM tag (category/type) -> our place type
  var TYPE = {
    "historic/castle": "castle", "historic/fort": "castle", "historic/manor": "palace", "historic/palace": "palace", "historic/ruins": "ruin", "historic/archaeological_site": "ancient",
    "historic/monument": "monument", "historic/memorial": "monument", "historic/monastery": "abbey", "historic/church": "cathedral", "historic/tower": "tower", "historic/city_gate": "historic", "historic/building": "historic",
    "tourism/museum": "museum", "tourism/gallery": "museum", "tourism/viewpoint": "viewpoint", "tourism/attraction": "landmark", "tourism/zoo": "zoo", "tourism/aquarium": "aquarium", "tourism/theme_park": "themepark",
    "leisure/water_park": "waterpark", "leisure/playground": "playground", "leisure/park": "park", "leisure/garden": "garden", "leisure/nature_reserve": "park", "leisure/stadium": "stadium", "leisure/beach_resort": "beach",
    "natural/beach": "beach", "natural/peak": "peak", "natural/volcano": "peak", "natural/cave_entrance": "cave", "natural/waterfall": "waterfall", "waterway/waterfall": "waterfall", "natural/glacier": "glacier",
    "natural/water": "lake", "water/lake": "lake", "natural/bay": "beach", "natural/cliff": "viewpoint", "natural/geyser": "geyser", "natural/valley": "canyon", "place/island": "island", "place/islet": "island",
    "boundary/national_park": "park", "boundary/protected_area": "park", "highway/path": "trail", "route/hiking": "trail",
    "craft/distillery": "distillery", "craft/brewery": "brewery", "craft/winery": "winery", "amenity/pub": "pub", "amenity/bar": "pub", "amenity/biergarten": "pub",
    "man_made/lighthouse": "lighthouse", "man_made/bridge": "bridge", "bridge/yes": "bridge", "man_made/tower": "tower", "amenity/ferry_terminal": "ferry", "railway/station": "station", "public_transport/station": "station",
    "building/cathedral": "cathedral", "amenity/place_of_worship": "cathedral", "building/castle": "castle",
    "amenity/marketplace": "market"   // v120
  };
  // v120: a Christmas market in OpenStreetMap is a marketplace (or attraction / event) named as one, or tagged christmas:* (wiki.openstreetmap.org/wiki/Key:christmas)
  var XMAS = /christmas market|xmas market|weihnachtsmarkt|christkindl|christkindel|striezelmarkt|march[eé]s? de no[eë]l|mercatin[oi] di natale|julmarknad|julemarked|joulumarkkinat|j[oõ]uluturg|kerstmarkt|v[aá]no[cč]n[ií] trh|vianočn[eé] trhy|jarmark bo[zż]onarodzeniowy|kar[aá]csonyi v[aá]s[aá]r|adventmarkt|christmas village|winter wonderland/i;
  function isXmas(r) { var n = String(r.name || (r.display_name || "").split(",")[0] || ""), x = r.extratags || {}; return XMAS.test(n) || Object.keys(x).some(function (k) { return /^christmas(:|$)/.test(k); }); }
  var TOWNISH = { city: 1, town: 1, village: 1, hamlet: 1, suburb: 1, municipality: 1, borough: 1, quarter: 1, neighbourhood: 1, locality: 1, county: 0, state: 0, country: 0 };
  function typeFor(r) {
    var k = (r.category || r["class"] || "") + "/" + (r.type || "");
    if (isXmas(r) && !/^(place|boundary|highway|railway|public_transport|natural|waterway)$/.test(r.category || r["class"] || "")) return "xmas";
    if (TYPE[k]) return TYPE[k];
    var c = r.category || r["class"];
    if (c === "historic") return "historic";
    if (c === "tourism") return "landmark";
    if (c === "natural") return "landmark";
    return "pin";
  }
  function regionOf(a, c3) {
    var l4 = a && a["ISO3166-2-lvl4"] || "";
    var m = /^([A-Z]{2})-([A-Z0-9]{1,3})$/.exec(l4);
    if (!m) return "";
    if (c3 === "USA" || c3 === "GBR" || c3 === "CAN" || c3 === "AUS") return m[2];
    return "";
  }
  /** One Nominatim result -> a trip stop. iso23: { "gb": "GBR", ... }. Towns become city stops; everything else a sight with a type. */
  function toPoint(r, iso23, label) {
    if (!r || !isFinite(+r.lat) || !isFinite(+r.lon)) return null;
    var a = r.address || {}, c3 = iso23[String(a.country_code || "").toLowerCase()] || "";
    var name = String(r.name || (r.display_name || "").split(",")[0] || "").trim().slice(0, 80); if (!name) return null;
    var town = a.city || a.town || a.village || a.hamlet || a.municipality || "";
    var where = [a.state || a.county || "", a.country || ""].filter(Boolean).join(", ");
    var townish = (r.category || r["class"]) === "place" && TOWNISH[r.type] || (r.addresstype && TOWNISH[r.addresstype] && (r.category || r["class"]) === "boundary");
    var p = { name: name, lat: Math.round(+r.lat * 1e5) / 1e5, lon: Math.round(+r.lon * 1e5) / 1e5, osm: (r.osm_type || "").charAt(0) + (r.osm_id || "") };
    if (c3) p.country = c3;
    var reg = regionOf(a, c3); if (reg) p.region = reg;
    if (townish) { p.kind = "city"; p.sub = where; }
    else {
      p.kind = "sight"; p.type = typeFor(r); if (town && town !== name) p.town = String(town).slice(0, 60);
      if (r.extratags && /^Q\d+$/.test(r.extratags.wikidata || "")) p.ref = r.extratags.wikidata;
      var lb = label ? label(p.type) : p.type; p.sub = lb + (p.town || where ? " · " + [p.town || "", where].filter(Boolean).join(", ") : "");
    }
    return p;
  }
  /** Small LRU-ish cache kept in localStorage-like storage. */
  function cacheGet(store, key) { try { var j = JSON.parse(store.getItem("fs-osm") || "{}"); var e = j[key]; return e && Date.now() - e.t < 30 * 864e5 ? e.v : null; } catch (x) { return null; } }
  function cachePut(store, key, v) {
    try { var j = JSON.parse(store.getItem("fs-osm") || "{}"); j[key] = { t: Date.now(), v: v };
      var ks = Object.keys(j); if (ks.length > CACHE_MAX) ks.sort(function (a, b) { return j[a].t - j[b].t; }).slice(0, ks.length - CACHE_MAX).forEach(function (k) { delete j[k]; });
      store.setItem("fs-osm", JSON.stringify(j)); } catch (x) {}
  }
  /** Waits so two requests are never closer than GAP_MS. now/last in ms. */
  function waitFor(last, now) { return Math.max(0, (last || 0) + GAP_MS - now); }
  // slippy-map tile math (Web Mercator)
  function tileXY(lat, lon, z) { var n = Math.pow(2, z), la = Math.max(-85.05, Math.min(85.05, lat)) * Math.PI / 180; return { x: (lon + 180) / 360 * n, y: (1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2 * n }; }
  function latLon(x, y, z) { var n = Math.pow(2, z), lon = x / n * 360 - 180, la = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))); return { lat: la * 180 / Math.PI, lon: lon }; }
  function tileURL(x, y, z) { var n = Math.pow(2, z); x = ((x % n) + n) % n; return TILES + "/" + z + "/" + x + "/" + y + ".png"; }
  return { HOST: HOST, TILES: TILES, ATTR: ATTR, GAP_MS: GAP_MS, searchURL: searchURL, reverseURL: reverseURL, typeFor: typeFor, toPoint: toPoint, cacheGet: cacheGet, cachePut: cachePut, waitFor: waitFor, tileXY: tileXY, latLon: latLon, tileURL: tileURL };
});
