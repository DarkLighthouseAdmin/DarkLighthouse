/* Famstamp (My Lifetime Travel Log app): the app's logic with no browser parts, so it can be tested in Node
   (node scripts/test_travel_log.js). Everything here works on plain objects; storage lives in app.js. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./trips-core.js"), require("./passport-core.js"));
  else root.MLTL = factory(root.WK_TRIPS, root.WK_PASSPORT);
})(typeof self !== "undefined" ? self : this, function (T, P) {
  "use strict";

  var APP_ID = "my-lifetime-travel-log";   // stays the same after the Wanderkin and Famstamp renames so every old backup still restores
  // v2 added roles (kid / adult / grandparent); v3 adds trip From / stops and the family's home town; v4 (Famstamp 1.4) adds trip routes with
  // miles, stays, favorites, moments and stories, plus hand-added passport stamps on each person. v1-v3 files still restore.
  var BACKUP_VERSION = 4;
  var MAX_STOPS = 5;

  // All 64 US national parks as of October 2026 (Chiricahua became #64 on Oct 20, 2026). Same list as the book.
  var PARK_LIST = [["Acadia", "ME"], ["American Samoa", "AS"], ["Arches", "UT"], ["Badlands", "SD"], ["Big Bend", "TX"], ["Biscayne", "FL"],
    ["Black Canyon of the Gunnison", "CO"], ["Bryce Canyon", "UT"], ["Canyonlands", "UT"], ["Capitol Reef", "UT"], ["Carlsbad Caverns", "NM"],
    ["Channel Islands", "CA"], ["Chiricahua", "AZ"], ["Congaree", "SC"], ["Crater Lake", "OR"], ["Cuyahoga Valley", "OH"], ["Death Valley", "CA, NV"],
    ["Denali", "AK"], ["Dry Tortugas", "FL"], ["Everglades", "FL"], ["Gates of the Arctic", "AK"], ["Gateway Arch", "MO"], ["Glacier", "MT"],
    ["Glacier Bay", "AK"], ["Grand Canyon", "AZ"], ["Grand Teton", "WY"], ["Great Basin", "NV"], ["Great Sand Dunes", "CO"],
    ["Great Smoky Mountains", "NC, TN"], ["Guadalupe Mountains", "TX"], ["Haleakalā", "HI"], ["Hawaiʻi Volcanoes", "HI"], ["Hot Springs", "AR"],
    ["Indiana Dunes", "IN"], ["Isle Royale", "MI"], ["Joshua Tree", "CA"], ["Katmai", "AK"], ["Kenai Fjords", "AK"], ["Kings Canyon", "CA"],
    ["Kobuk Valley", "AK"], ["Lake Clark", "AK"], ["Lassen Volcanic", "CA"], ["Mammoth Cave", "KY"], ["Mesa Verde", "CO"], ["Mount Rainier", "WA"],
    ["New River Gorge", "WV"], ["North Cascades", "WA"], ["Olympic", "WA"], ["Petrified Forest", "AZ"], ["Pinnacles", "CA"], ["Redwood", "CA"],
    ["Rocky Mountain", "CO"], ["Saguaro", "AZ"], ["Sequoia", "CA"], ["Shenandoah", "VA"], ["Theodore Roosevelt", "ND"], ["Virgin Islands", "VI"],
    ["Voyageurs", "MN"], ["White Sands", "NM"], ["Wind Cave", "SD"], ["Wrangell-St. Elias", "AK"], ["Yellowstone", "WY, MT, ID"],
    ["Yosemite", "CA"], ["Zion", "UT"]];

  function slug(s) {
    return String(s).normalize("NFD").replace(/[\u0300-\u036f\u02bb]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }
  // Where each park is (Wikidata, CC0; same as data/places.json), for the dots on the Parks map.
  var PARK_LL = {"acadia":[44.35,-68.217],"american-samoa":[-14.258,-170.686],"arches":[38.728,-109.54],"badlands":[43.75,-102.5],"big-bend":[29.25,-103.25],"biscayne":[25.502,-80.181],"black-canyon-of-the-gunnison":[38.58,-107.728],"bryce-canyon":[37.64,-112.17],"canyonlands":[38.167,-109.76],"capitol-reef":[38.2,-111.167],"carlsbad-caverns":[32.175,-104.444],"channel-islands":[33.66,-119.64],"chiricahua":[32.006,-109.357],"congaree":[33.783,-80.783],"crater-lake":[42.912,-122.148],"cuyahoga-valley":[41.242,-81.55],"death-valley":[36.45,-116.85],"denali":[63.2,-150.3],"dry-tortugas":[24.629,-82.873],"everglades":[25.312,-80.688],"gates-of-the-arctic":[67.783,-153.3],"gateway-arch":[38.625,-90.185],"glacier":[48.755,-113.8],"glacier-bay":[58.7,-137.0],"grand-canyon":[36.055,-112.122],"grand-teton":[43.833,-110.701],"great-basin":[39.006,-114.22],"great-sand-dunes":[37.733,-105.512],"great-smoky-mountains":[35.611,-83.425],"guadalupe-mountains":[31.917,-104.867],"haleakala":[20.72,-156.155],"hawaii-volcanoes":[19.401,-155.124],"hot-springs":[34.514,-93.054],"indiana-dunes":[41.648,-87.108],"isle-royale":[47.996,-88.909],"joshua-tree":[33.748,-115.819],"katmai":[58.5,-155.0],"kenai-fjords":[59.918,-149.988],"kings-canyon":[36.789,-118.673],"kobuk-valley":[67.353,-159.199],"lake-clark":[60.97,-153.42],"lassen-volcanic":[40.498,-121.427],"mammoth-cave":[37.187,-86.101],"mesa-verde":[37.26,-108.494],"mount-rainier":[46.85,-121.75],"new-river-gorge":[37.931,-81.075],"north-cascades":[48.483,-120.911],"olympic":[47.7,-123.75],"petrified-forest":[35.088,-109.806],"pinnacles":[36.487,-121.167],"redwood":[41.529,-124.058],"rocky-mountain":[40.35,-105.683],"saguaro":[32.202,-110.611],"sequoia":[36.565,-118.773],"shenandoah":[38.533,-78.35],"theodore-roosevelt":[46.967,-103.45],"virgin-islands":[18.328,-64.933],"voyageurs":[48.5,-92.883],"white-sands":[32.78,-106.172],"wind-cave":[43.556,-103.479],"wrangell-st-elias":[61.435,-142.954],"yellowstone":[44.6,-110.5],"yosemite":[37.742,-119.537],"zion":[37.203,-112.988]};
  // set: which collection a park belongs to. PARKS stays the 64 national parks (counts, badges and quests are about those);
  // ALL_PARKS adds state parks ("sp-" ids) and NPS national monuments ("nm-") and national memorials ("mem-").
  var PARK_SETS = [{ id: "np", name: "National parks", short: "National" }, { id: "sp", name: "State parks", short: "State" }, { id: "nm", name: "Monuments & memorials", short: "Monuments" }];
  var PARKS = PARK_LIST.map(function (p) { var id = slug(p[0]), l = PARK_LL[id] || []; return { id: id, name: p[0], full: p[0] + " National Park", states: p[1], set: "np", label: "NATIONAL PARK", lat: l[0], lon: l[1] }; });
  // [set, short name, official name, states, lat, lon]. State parks: famous ones across the country. Monuments & memorials: National Park
  // Service units with those official designations only (checked one by one against the NPS list); no logos or seals anywhere.
  var MORE_PARKS = [
    ["sp", "Custer", "Custer State Park", "SD", 43.614, -103.689],
    ["sp", "Niagara Falls", "Niagara Falls State Park", "NY", 43.08, -79.07],
    ["sp", "Letchworth", "Letchworth State Park", "NY", 42.635, -77.983],
    ["sp", "Watkins Glen", "Watkins Glen State Park", "NY", 42.377, -76.872],
    ["sp", "Valley of Fire", "Valley of Fire State Park", "NV", 36.472, -114.537],
    ["sp", "Anza-Borrego Desert", "Anza-Borrego Desert State Park", "CA", 33.259, -116.399],
    ["sp", "Julia Pfeiffer Burns", "Julia Pfeiffer Burns State Park", "CA", 36.171, -121.673],
    ["sp", "Humboldt Redwoods", "Humboldt Redwoods State Park", "CA", 40.312, -123.972],
    ["sp", "Emerald Bay", "Emerald Bay State Park", "CA", 38.954, -120.094],
    ["sp", "Starved Rock", "Starved Rock State Park", "IL", 41.321, -88.99],
    ["sp", "Dead Horse Point", "Dead Horse Point State Park", "UT", 38.508, -109.742],
    ["sp", "Goblin Valley", "Goblin Valley State Park", "UT", 38.567, -110.71],
    ["sp", "Palo Duro Canyon", "Palo Duro Canyon State Park", "TX", 34.985, -101.702],
    ["sp", "Hocking Hills", "Hocking Hills State Park", "OH", 39.431, -82.539],
    ["sp", "Ichetucknee Springs", "Ichetucknee Springs State Park", "FL", 29.967, -82.776],
    ["sp", "Bahia Honda", "Bahia Honda State Park", "FL", 24.66, -81.262],
    ["sp", "John Pennekamp Coral Reef", "John Pennekamp Coral Reef State Park", "FL", 25.12, -80.405],
    ["sp", "Blue Spring", "Blue Spring State Park", "FL", 28.948, -81.34],
    ["sp", "Hunting Island", "Hunting Island State Park", "SC", 32.366, -80.444],
    ["sp", "Kartchner Caverns", "Kartchner Caverns State Park", "AZ", 31.836, -110.344],
    ["sp", "Slide Rock", "Slide Rock State Park", "AZ", 34.944, -111.753],
    ["sp", "Silver Falls", "Silver Falls State Park", "OR", 44.856, -122.609],
    ["sp", "Smith Rock", "Smith Rock State Park", "OR", 44.369, -121.138],
    ["sp", "Ecola", "Ecola State Park", "OR", 45.918, -123.98],
    ["sp", "Deception Pass", "Deception Pass State Park", "WA", 48.407, -122.645],
    ["sp", "Palouse Falls", "Palouse Falls State Park", "WA", 46.664, -118.224],
    ["sp", "Eldorado Canyon", "Eldorado Canyon State Park", "CO", 39.931, -105.292],
    ["sp", "Petit Jean", "Petit Jean State Park", "AR", 35.118, -92.938],
    ["sp", "Tallulah Gorge", "Tallulah Gorge State Park", "GA", 34.725, -83.37],
    ["sp", "Providence Canyon", "Providence Canyon State Park", "GA", 32.063, -84.92],
    ["sp", "Fall Creek Falls", "Fall Creek Falls State Park", "TN", 35.662, -85.35],
    ["sp", "Cumberland Falls", "Cumberland Falls State Resort Park", "KY", 36.841, -84.333],
    ["sp", "Blackwater Falls", "Blackwater Falls State Park", "WV", 39.109, -79.496],
    ["sp", "Ricketts Glen", "Ricketts Glen State Park", "PA", 41.335, -76.302],
    ["sp", "Ohiopyle", "Ohiopyle State Park", "PA", 39.868, -79.494],
    ["sp", "Baxter", "Baxter State Park", "ME", 46.033, -68.933],
    ["sp", "Franconia Notch", "Franconia Notch State Park", "NH", 44.149, -71.687],
    ["sp", "Cape Henlopen", "Cape Henlopen State Park", "DE", 38.803, -75.095],
    ["sp", "Assateague", "Assateague State Park", "MD", 38.253, -75.128],
    ["sp", "Jockey's Ridge", "Jockey's Ridge State Park", "NC", 35.964, -75.633],
    ["sp", "Hanging Rock", "Hanging Rock State Park", "NC", 36.412, -80.254],
    ["sp", "Chimney Rock", "Chimney Rock State Park", "NC", 35.433, -82.251],
    ["sp", "Gulf", "Gulf State Park", "AL", 30.26, -87.663],
    ["sp", "Itasca", "Itasca State Park", "MN", 47.24, -95.207],
    ["sp", "Gooseberry Falls", "Gooseberry Falls State Park", "MN", 47.147, -91.463],
    ["sp", "Devil's Lake", "Devil's Lake State Park", "WI", 43.415, -89.713],
    ["sp", "Mackinac Island", "Mackinac Island State Park", "MI", 45.867, -84.617],
    ["sp", "Tahquamenon Falls", "Tahquamenon Falls State Park", "MI", 46.604, -85.207],
    ["sp", "Indiana Dunes", "Indiana Dunes State Park", "IN", 41.66, -87.04],
    ["sp", "Turkey Run", "Turkey Run State Park", "IN", 39.885, -87.203],
    ["sp", "Ha Ha Tonka", "Ha Ha Tonka State Park", "MO", 37.974, -92.763],
    ["sp", "Waimea Canyon", "Waimea Canyon State Park", "HI", 22.056, -159.665],
    ["sp", "Chugach", "Chugach State Park", "AK", 61.052, -149.797],
    ["sp", "Natural Bridge", "Natural Bridge State Park", "VA", 37.627, -79.545],
    ["sp", "Gillette Castle", "Gillette Castle State Park", "CT", 41.422, -72.429],
    ["sp", "Liberty", "Liberty State Park", "NJ", 40.704, -74.049],
    ["sp", "Robbers Cave", "Robbers Cave State Park", "OK", 35.003, -95.341],
    ["sp", "Bruneau Dunes", "Bruneau Dunes State Park", "ID", 42.91, -115.71],
    ["nm", "Statue of Liberty", "Statue of Liberty National Monument", "NY", 40.694, -74.043],
    ["nm", "Devils Tower", "Devils Tower National Monument", "WY", 44.591, -104.715],
    ["nm", "Muir Woods", "Muir Woods National Monument", "CA", 37.892, -122.571],
    ["nm", "Canyon de Chelly", "Canyon de Chelly National Monument", "AZ", 36.155, -109.509],
    ["nm", "Natural Bridges", "Natural Bridges National Monument", "UT", 37.601, -110.014],
    ["nm", "Dinosaur", "Dinosaur National Monument", "CO, UT", 40.5, -108.95],
    ["nm", "Craters of the Moon", "Craters of the Moon National Monument and Preserve", "ID", 43.462, -113.563],
    ["nm", "Sunset Crater Volcano", "Sunset Crater Volcano National Monument", "AZ", 35.364, -111.504],
    ["nm", "Montezuma Castle", "Montezuma Castle National Monument", "AZ", 34.611, -111.837],
    ["nm", "Walnut Canyon", "Walnut Canyon National Monument", "AZ", 35.166, -111.502],
    ["nm", "Organ Pipe Cactus", "Organ Pipe Cactus National Monument", "AZ", 31.954, -112.801],
    ["nm", "Bandelier", "Bandelier National Monument", "NM", 35.779, -106.321],
    ["nm", "El Morro", "El Morro National Monument", "NM", 35.038, -108.353],
    ["nm", "Capulin Volcano", "Capulin Volcano National Monument", "NM", 36.782, -103.97],
    ["nm", "Colorado", "Colorado National Monument", "CO", 39.042, -108.686],
    ["nm", "Florissant Fossil Beds", "Florissant Fossil Beds National Monument", "CO", 38.914, -105.287],
    ["nm", "Cedar Breaks", "Cedar Breaks National Monument", "UT", 37.642, -112.849],
    ["nm", "Timpanogos Cave", "Timpanogos Cave National Monument", "UT", 40.441, -111.709],
    ["nm", "Rainbow Bridge", "Rainbow Bridge National Monument", "UT", 37.077, -110.964],
    ["nm", "Jewel Cave", "Jewel Cave National Monument", "SD", 43.729, -103.829],
    ["nm", "Lava Beds", "Lava Beds National Monument", "CA", 41.714, -121.508],
    ["nm", "Cabrillo", "Cabrillo National Monument", "CA", 32.673, -117.239],
    ["nm", "Devils Postpile", "Devils Postpile National Monument", "CA", 37.624, -119.084],
    ["nm", "Oregon Caves", "Oregon Caves National Monument and Preserve", "OR", 42.096, -123.406],
    ["nm", "Little Bighorn Battlefield", "Little Bighorn Battlefield National Monument", "MT", 45.57, -107.427],
    ["nm", "Effigy Mounds", "Effigy Mounds National Monument", "IA", 43.089, -91.186],
    ["nm", "Castillo de San Marcos", "Castillo de San Marcos National Monument", "FL", 29.898, -81.311],
    ["nm", "Fort Pulaski", "Fort Pulaski National Monument", "GA", 32.027, -80.89],
    ["nm", "Fort McHenry", "Fort McHenry National Monument and Historic Shrine", "MD", 39.263, -76.58],
    ["nm", "Scotts Bluff", "Scotts Bluff National Monument", "NE", 41.835, -103.707],
    ["nm", "Stonewall", "Stonewall National Monument", "NY", 40.734, -74.002],
    ["nm", "Katahdin Woods and Waters", "Katahdin Woods and Waters National Monument", "ME", 45.97, -68.619],
    ["mem", "Mount Rushmore", "Mount Rushmore National Memorial", "SD", 43.879, -103.459],
    ["mem", "Lincoln Memorial", "Lincoln Memorial", "DC", 38.889, -77.05],
    ["mem", "Jefferson Memorial", "Thomas Jefferson Memorial", "DC", 38.881, -77.037],
    ["mem", "Washington Monument", "Washington Monument", "DC", 38.889, -77.035],
    ["mem", "Vietnam Veterans Memorial", "Vietnam Veterans Memorial", "DC", 38.891, -77.048],
    ["mem", "Korean War Veterans Memorial", "Korean War Veterans Memorial", "DC", 38.888, -77.047],
    ["mem", "World War II Memorial", "World War II Memorial", "DC", 38.889, -77.041],
    ["mem", "MLK Jr. Memorial", "Martin Luther King, Jr. Memorial", "DC", 38.886, -77.044],
    ["mem", "FDR Memorial", "Franklin Delano Roosevelt Memorial", "DC", 38.884, -77.044],
    ["mem", "Flight 93", "Flight 93 National Memorial", "PA", 40.057, -78.906],
    ["mem", "Pearl Harbor", "Pearl Harbor National Memorial", "HI", 21.367, -157.939],
    ["mem", "Wright Brothers", "Wright Brothers National Memorial", "NC", 36.014, -75.668],
    ["mem", "De Soto", "De Soto National Memorial", "FL", 27.524, -82.644],
    ["mem", "Fort Caroline", "Fort Caroline National Memorial", "FL", 30.387, -81.501],
    ["mem", "Chamizal", "Chamizal National Memorial", "TX", 31.768, -106.454],
    ["mem", "Coronado", "Coronado National Memorial", "AZ", 31.348, -110.272],
    ["mem", "Perry's Victory", "Perry's Victory and International Peace Memorial", "OH", 41.654, -82.811],
    ["mem", "Federal Hall", "Federal Hall National Memorial", "NY", 40.707, -74.01],
    ["mem", "General Grant", "General Grant National Memorial", "NY", 40.813, -73.963],
    ["mem", "Johnstown Flood", "Johnstown Flood National Memorial", "PA", 40.346, -78.779],
    ["mem", "Lincoln Boyhood", "Lincoln Boyhood National Memorial", "IN", 38.118, -86.997],
    ["mem", "Arkansas Post", "Arkansas Post National Memorial", "AR", 34.017, -91.345]];
  var LABELS = { sp: "STATE PARK", nm: "NATIONAL MONUMENT", mem: "NATIONAL MEMORIAL" };
  var ALL_PARKS = PARKS.concat(MORE_PARKS.map(function (r) { return { id: r[0] + "-" + slug(r[1]), name: r[1], full: r[2], states: r[3], set: r[0] === "sp" ? "sp" : "nm", label: LABELS[r[0]], lat: r[4], lon: r[5] }; }));
  var PARK_BY_ID = {}; ALL_PARKS.forEach(function (p) { PARK_BY_ID[p.id] = p; });
  function parkById(id) { return PARK_BY_ID[id] || null; }
  function parksIn(set) { return ALL_PARKS.filter(function (p) { return p.set === set; }); }
  /** "UT · NATIONAL PARK", the line under the name on a stamp */
  function parkSub(p) { return p ? p.states.replace(/,\s*/g, " · ") + " · " + p.label : "NATIONAL PARK"; }

  var US_STATE_TOTAL = 50;      // DC can be colored too, but it's a bonus, not one of the 50
  var COUNTRY_TOTAL = 195;      // 193 UN members + Vatican City + Palestine, as in the book
  var UK_NATIONS = ["ENG", "SCT", "WLS", "NIR"];
  // Everyone in the family gets a profile. Kids come first, but grown-ups get the same maps, parks, stats and badges.
  var ROLES = [{ id: "kid", label: "Kid" }, { id: "adult", label: "Parent/Adult" }, { id: "grand", label: "Grandparent/Other" }];
  function validRole(r) { return r === "adult" || r === "grand" ? r : "kid"; }
  function isKid(p) { return validRole(p && p.role) === "kid"; }
  // Relationship and nickname are per profile in this family log (not per login): a parent's dad can be "Grandparent" in
  // one family log and "Parent" in his own. Both ride in people.data, so they sync with no schema change; old profiles have neither.
  var RELATIONS = [{ id: "parent", label: "Parent" }, { id: "kid", label: "Kid" }, { id: "grandparent", label: "Grandparent" }, { id: "auntuncle", label: "Aunt/Uncle" },
                   { id: "cousin", label: "Cousin" }, { id: "sibling", label: "Sibling" }, { id: "friend", label: "Friend" }, { id: "other", label: "Other" }];
  var NICK_MAX = 20;
  function defaultRel(role) { role = validRole(role); return role === "kid" ? "kid" : role === "grand" ? "grandparent" : "parent"; }
  function validRel(r, role) { return RELATIONS.some(function (x) { return x.id === r; }) ? r : defaultRel(role); }
  function relOf(p) { return validRel(p && p.relationship, p && p.role); }
  function relLabel(p) { var r = relOf(p); return RELATIONS.filter(function (x) { return x.id === r; })[0].label; }
  /** The name to show: nickname if set, else the name. Always escape it before putting it in HTML. */
  function who(p) { return p ? (clean(p.nickname, NICK_MAX) || p.name || "") : ""; }
  /** Real name to show as secondary text, only when a nickname is shown instead. */
  function realName(p) { return p && clean(p.nickname, NICK_MAX) && clean(p.nickname, NICK_MAX) !== p.name ? p.name : ""; }
  // FOR THE GRANDPARENT UPDATES PAGE (features worker): "followers" are the people who get the family's travel updates
  // instead of (or as well as) traveling. Use M.followers(state.kids) / M.isFollower(p) to decide who sees updates.
  var FOLLOWER_RELS = { grandparent: 1, auntuncle: 1, friend: 1, other: 1 };
  function isFollower(p) { return !!FOLLOWER_RELS[relOf(p)]; }
  function followers(people) { return (people || []).filter(isFollower); }
  var COLORS = ["#e8a54b", "#3f8f9f", "#c0607a", "#6f8f7a", "#7b6bb0", "#d0703c"];

  function uid(prefix) {
    var r = "";
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      var a = new Uint8Array(8); crypto.getRandomValues(a);
      for (var i = 0; i < a.length; i++) r += a[i].toString(16).padStart(2, "0");
    } else { r = Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2); }
    return (prefix || "id") + "_" + r.slice(0, 16);
  }

  function clean(s, max) { return String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max || 200); }
  function validYear(y) { y = parseInt(y, 10); var now = new Date().getFullYear(); return y >= 1900 && y <= now ? y : null; }
  function validDate(d) { return typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d + "T12:00:00").getTime()) ? d : ""; }

  /** A person in the family. Stored in the "kids" store and backup key for v1 compatibility. */
  function newPerson(opts) {
    opts = opts || {};
    var name = clean(opts.name, 40);
    if (!name) throw new Error("Add a name or nickname.");
    var now = opts.now || new Date().toISOString();
    var p = { id: opts.id || uid("person"), name: name, role: validRole(opts.role), birthYear: validYear(opts.birthYear),
             color: COLORS.indexOf(opts.color) >= 0 ? opts.color : COLORS[0], states: {}, places: {}, parks: {}, createdAt: now, updatedAt: now };
    p.relationship = validRel(opts.relationship, p.role);
    var nick = clean(opts.nickname, NICK_MAX); if (nick) p.nickname = nick;
    return p;
  }
  var newKid = newPerson;

  /** Toggle a state / world place on a kid's map. Returns true if it's now colored. */
  function toggleArea(kid, kind, id, on, when) {
    var bag = kind === "state" ? kid.states : kid.places;
    var want = on == null ? !bag[id] : !!on;
    if (want) { if (!bag[id]) bag[id] = { at: validDate(when) || today() }; }
    else delete bag[id];
    kid.updatedAt = new Date().toISOString();
    return want;
  }
  function togglePark(kid, parkId, field, on) {
    var p = kid.parks[parkId] || null;
    if (field === "jr") {
      var jr = on == null ? !(p && p.jr) : !!on;
      if (jr) { p = p || { at: today() }; p.jr = true; kid.parks[parkId] = p; }
      else if (p) { p.jr = false; }
      kid.updatedAt = new Date().toISOString(); return jr;
    }
    var want = on == null ? !p : !!on;
    if (want) { if (!p) kid.parks[parkId] = { at: today(), jr: false }; }
    else delete kid.parks[parkId];
    kid.updatedAt = new Date().toISOString();
    return want;
  }
  function todayStr() { return today(); }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  function newTrip(opts) {
    opts = opts || {};
    var place = clean(opts.place, 80);
    if (!place) throw new Error("Where did you go? Add a place.");
    var kidIds = (opts.kidIds || []).filter(function (x) { return typeof x === "string" && x; });
    if (!kidIds.length) throw new Error("Pick at least one person for this trip.");
    var stops = (Array.isArray(opts.stops) ? opts.stops : []).map(function (x) { return clean(x, 80); }).filter(Boolean).slice(0, MAX_STOPS);
    var mark = null;
    if (opts.mark && /^(state|place|park)$/.test(opts.mark.kind) && opts.mark.id) mark = { kind: opts.mark.kind, id: clean(opts.mark.id, 40) };
    var now = opts.now || new Date().toISOString();
    var t = { id: opts.id || uid("trip"), kidIds: kidIds, place: place, from: clean(opts.from, 80), stops: stops, date: validDate(opts.date), who: clean(opts.who, 120),
             memory: clean(opts.memory, 1000), photoId: opts.photoId || null, mark: mark, createdAt: opts.createdAt || now, updatedAt: now };
    // v1.4: route, stays, favorites, moments, story (all optional). No route given = build one from From / stops / To.
    var x = T.cleanExtras(opts, kidIds);
    Object.keys(x).forEach(function (k) { t[k] = x[k]; });
    if (t.endDate && t.date && t.endDate < t.date) t.endDate = "";
    if (t.route.length) T.syncLegacy(t); else t.route = T.routeFromLegacy(t);
    return T.fitSize(t);
  }
  /** Older trips (v1/v2) have no From or stops; a trip with no travelers belongs to the person it was saved under. */
  function migrateTrip(t, ownerId) {
    if (!t || typeof t !== "object") return t;
    var ids = Array.isArray(t.kidIds) ? t.kidIds.filter(function (x) { return typeof x === "string" && x; }) : [];
    if (!ids.length && typeof t.kidId === "string" && t.kidId) ids = [t.kidId];
    if (!ids.length && ownerId) ids = [ownerId];
    t.kidIds = ids.filter(function (x, i) { return ids.indexOf(x) === i; });
    if (typeof t.from !== "string") t.from = "";
    if (!Array.isArray(t.stops)) t.stops = [];
    delete t.kidId;
    // v1.4: older trips get a route built from their words (no locations yet, so their miles show as "?")
    if (!Array.isArray(t.route) || !t.route.length) t.route = T.routeFromLegacy(t);
    if (!Array.isArray(t.stays)) t.stays = [];
    if (!Array.isArray(t.favs)) t.favs = [];
    if (!t.moments || typeof t.moments !== "object") t.moments = {};
    return t;
  }
  /** "Orlando to Edinburgh", "Orlando to London to Edinburgh", or just "Edinburgh". Plain words, no arrows. */
  function routeText(t) {
    if (Array.isArray(t.route) && t.route.length > 1 && t.route.some(function (p) { return p.lat != null; })) return t.route.map(function (p) { return p.name; }).join(" to ");
    var parts = [t.from].concat(t.stops || []).concat([t.place]).map(function (x) { return String(x || "").trim(); }).filter(Boolean);
    return parts.filter(function (x, i) { return i === parts.length - 1 || x.toLowerCase() !== parts[i + 1].toLowerCase(); }).join(" to ");
  }
  /** "Lily", "Lily & Mom", "Lily, Mom & Dad". */
  function joinNames(list) {
    list = list.filter(Boolean);
    return list.length < 2 ? (list[0] || "") : list.slice(0, -1).join(", ") + " & " + list[list.length - 1];
  }
  /** Trips every one of these people went on (others may have come too), newest first. */
  function tripsTogether(trips, ids) {
    if (!ids || ids.length < 2) return [];
    return trips.filter(function (t) { return ids.every(function (id) { return t.kidIds.indexOf(id) >= 0; }); })
      .sort(function (a, b) { return (b.date || b.createdAt || "") < (a.date || a.createdAt || "") ? -1 : 1; });
  }
  /** Every pair in the family with how many trips they shared, most first. Pairs with none are left out. */
  function pairCounts(people, trips) {
    var out = [];
    for (var i = 0; i < people.length; i++) for (var j = i + 1; j < people.length; j++) {
      var n = tripsTogether(trips, [people[i].id, people[j].id]).length;
      if (n) out.push({ ids: [people[i].id, people[j].id], count: n });
    }
    return out.sort(function (a, b) { return b.count - a.count; });
  }
  /** Should we show the backup banner? Never backed up: after 3+ trips. Backed up: something changed since, and it's been 14+ days.
      Dismissing hides it for 7 days. Dates are ISO strings. */
  var BACKUP_DAYS = 14, SNOOZE_DAYS = 7, DAY = 864e5;
  function backupDue(o) {
    var now = o.now ? new Date(o.now).getTime() : Date.now(), last = o.lastBackupAt, trips = o.trips || [], people = o.people || [];
    if (o.dismissedAt && now - new Date(o.dismissedAt).getTime() < SNOOZE_DAYS * DAY) return false;
    if (!last) return trips.length >= 3;
    var changed = trips.some(function (t) { return (t.updatedAt || "") > last; }) || people.some(function (p) { return (p.updatedAt || "") > last; });
    return changed && now - new Date(last).getTime() >= BACKUP_DAYS * DAY;
  }
  /** Color in whatever the trip points at, plus every state, country, UK nation and park on its route, for everyone on it.
      Returns the ids of people whose maps changed. */
  var PARK_STATES = {}; ALL_PARKS.forEach(function (p) { PARK_STATES[p.id] = p.states.split(/,\s*/); });
  function applyTripMark(trip, kids) {
    var list = T.areas(trip, PARK_STATES).slice(), changed = [];
    if (trip.mark) list.push(trip.mark);
    kids.forEach(function (k) {
      if (trip.kidIds.indexOf(k.id) < 0) return;
      list.forEach(function (a) {
        if (a.kind === "park") { if (PARK_STATES[a.id] && !k.parks[a.id]) { k.parks[a.id] = { at: trip.date || today(), jr: false }; changed.push(k.id); } }
        else if (a.kind === "state" ? !k.states[a.id] : !k.places[a.id]) { toggleArea(k, a.kind, a.id, true, trip.date); changed.push(k.id); }
      });
    });
    return changed.filter(function (x, i) { return changed.indexOf(x) === i; });
  }

  function ageOn(birthYear, dateStr) {
    if (!birthYear || !dateStr) return null;
    var y = parseInt(dateStr.slice(0, 4), 10) - birthYear;
    return y >= 0 && y < 120 ? y : null;
  }

  /** world: { countries: [{id,name,cont}] } from maps.js. */
  function stats(kid, trips, world) {
    var countryById = {}; (world.countries || []).forEach(function (c) { countryById[c.id] = c; });
    var states = Object.keys(kid.states).filter(function (k) { return k !== "DC"; }).length;
    var seen = {}, uk = 0, other = 0;
    Object.keys(kid.places).forEach(function (id) {
      if (UK_NATIONS.indexOf(id) >= 0) { uk++; seen.GBR = 1; }
      else if (countryById[id]) seen[id] = 1;
      else other++;
    });
    if (Object.keys(kid.states).length) seen.USA = 1;   // any US state means the US counts
    var countries = Object.keys(seen).filter(function (id) { return countryById[id]; });
    var conts = {}; countries.forEach(function (id) { conts[countryById[id].cont] = 1; });
    var parkIds = Object.keys(kid.parks).filter(function (id) { return PARKS.some(function (p) { return p.id === id; }); });
    var jr = parkIds.filter(function (id) { return kid.parks[id].jr; }).length;
    var mine = trips.filter(function (t) { return t.kidIds.indexOf(kid.id) >= 0; });
    var dates = mine.map(function (t) { return t.date; }).filter(Boolean).sort();
    var years = {}; dates.forEach(function (d) { years[d.slice(0, 4)] = 1; });
    var abroad = countries.filter(function (id) { return id !== "USA"; }).length;
    var life = T.lifetime(kid.id, trips);
    return { miles: life.miles, flights: life.flights, flightMiles: life.flightMiles, airMin: life.airMin, bigRoad: life.bigRoad,
      role: validRole(kid.role), kid: isKid(kid), together: mine.filter(function (t) { return t.kidIds.length > 1; }).length + (kid.stamps || []).filter(function (x) { return Array.isArray(x.with) && x.with.length > 1; }).length,
      states: states, statesTotal: US_STATE_TOTAL, dc: !!kid.states.DC,
      countries: countries.length, countriesTotal: COUNTRY_TOTAL, abroad: abroad,
      ukNations: uk, ukTotal: UK_NATIONS.length, scotland: !!kid.places.SCT, otherPlaces: other,
      continents: Object.keys(conts).length, continentNames: Object.keys(conts).sort(),
      parks: parkIds.length, parksTotal: PARKS.length, juniorRanger: jr,
      trips: mine.length, photos: mine.filter(function (t) { return t.photoId; }).length,
      years: Object.keys(years).length, firstTrip: dates[0] || "", firstTripAge: isKid(kid) ? ageOn(kid.birthYear, dates[0] || "") : null
    };
  }

  var BADGES = [
    { id: "first-trip", name: "First trip", desc: "Add your first trip", need: 1, key: "trips" },
    { id: "storyteller", name: "Storyteller", desc: "Add 10 trips", need: 10, key: "trips" },
    { id: "photo", name: "Snapshot", desc: "Add a trip with a photo", need: 1, key: "photos" },
    { id: "states-5", name: "Road tripper", desc: "Color 5 states", need: 5, key: "states" },
    { id: "states-10", name: "State hopper", desc: "Color 10 states", need: 10, key: "states" },
    { id: "states-25", name: "Halfway there", desc: "Color 25 states", need: 25, key: "states" },
    { id: "states-50", name: "All 50!", desc: "Color every state", need: 50, key: "states" },
    { id: "abroad", name: "Passport power", desc: "Visit a country outside the US", need: 1, key: "abroad" },
    { id: "countries-5", name: "World explorer", desc: "Visit 5 countries", need: 5, key: "countries" },
    { id: "continents-3", name: "Three continents", desc: "Visit 3 continents", need: 3, key: "continents" },
    { id: "scotland", name: "Wee explorer", adultName: "Scotland calling", desc: "Visit Scotland", need: 1, key: "scotlandN" },
    { id: "uk-4", name: "All four nations", desc: "England, Scotland, Wales and Northern Ireland", need: 4, key: "ukNations" },
    { id: "park-1", name: "Park ranger", desc: "Visit a national park", need: 1, key: "parks" },
    { id: "parks-10", name: "Trail blazer", desc: "Visit 10 national parks", need: 10, key: "parks" },
    { id: "together", name: "Better together", desc: "Take 3 trips (or shared visits) with family", need: 3, key: "together" },
    { id: "junior-ranger", name: "Junior Ranger", desc: "Earn a Junior Ranger badge", need: 1, key: "juniorRanger", kidsOnly: true },
    // v1.4: these come from trip routes
    { id: "first-flight", name: "First flight", desc: "Take a trip with a flight", need: 1, key: "flights" },
    { id: "frequent-flyer", name: "Frequent flyer", desc: "Take 5 flights", need: 5, key: "flights" },
    { id: "sky-miles", name: "Sky high", desc: "Fly 10,000 miles", need: 10000, key: "flightMiles" },
    { id: "road-trip", name: "Big road trip", desc: "Drive 500 miles on one trip", need: 500, key: "bigRoad" },
    { id: "miles-1000", name: "1,000 miles", desc: "Travel 1,000 miles", need: 1000, key: "miles" },
    { id: "miles-10000", name: "10,000 miles", desc: "Travel 10,000 miles", need: 10000, key: "miles" },
    { id: "around-world", name: "Around the world", desc: "Travel 24,901 miles, once around the Earth", need: 24901, key: "miles" }
  ];
  function badges(s) {
    var v = Object.assign({ scotlandN: s.scotland ? 1 : 0 }, s);
    var kid = s.kid !== false;   // older callers (no role) are kids
    return BADGES.filter(function (b) { return kid || !b.kidsOnly; }).map(function (b) {
      var have = Math.min(v[b.key] || 0, b.need);
      return { id: b.id, name: kid ? b.name : (b.adultName || b.name), desc: b.desc, earned: have >= b.need, have: Math.round(have), need: b.need };
    });
  }

  // ---------- family ----------
  /** The 195-list countries one person has been to (a UK nation counts as GBR, any state as USA). */
  function countrySet(p, world) {
    var byId = {}; (world.countries || []).forEach(function (c) { byId[c.id] = 1; });
    var out = {};
    Object.keys(p.places).forEach(function (id) { if (UK_NATIONS.indexOf(id) >= 0) out.GBR = 1; else if (byId[id]) out[id] = 1; });
    if (Object.keys(p.states).length) out.USA = 1;
    return out;
  }
  /** Who has been where: { id: [personId, ...] } for "state", "place" (map areas), "park" or "country". */
  function whoBeen(people, kind, world) {
    var out = {};
    people.forEach(function (p) {
      var bag = kind === "state" ? p.states : kind === "park" ? p.parks : kind === "country" ? countrySet(p, world) : p.places;
      Object.keys(bag).forEach(function (id) { (out[id] = out[id] || []).push(p.id); });
    });
    return out;
  }
  /** Family totals for the chosen people. "Together" = places every chosen person has been, and trips they all went on. */
  function familyStats(people, trips, world) {
    var n = people.length, ids = people.map(function (p) { return p.id; });
    function count(kind, skip) {
      var w = whoBeen(people, kind, world), any = 0, all = 0;
      Object.keys(w).forEach(function (id) { if (skip && skip(id)) return; any++; if (n > 1 && w[id].length === n) all++; });
      return [any, all];
    }
    var st = count("state", function (id) { return id === "DC"; }), co = count("country"), pk = count("park", function (id) { return !PARKS.some(function (p) { return p.id === id; }); });
    var together = n > 1 ? trips.filter(function (t) { return ids.every(function (id) { return t.kidIds.indexOf(id) >= 0; }); }).length : 0;
    var anyTrips = trips.filter(function (t) { return t.kidIds.some(function (id) { return ids.indexOf(id) >= 0; }); }).length;
    return { people: n, states: st[0], countries: co[0], parks: pk[0], togetherStates: st[1], togetherCountries: co[1], togetherParks: pk[1],
             togetherTrips: together, trips: anyTrips };
  }

  // ---------- backup ----------
  function makeBackup(kids, trips, photos, now, settings) {
    var st = { home: clean(settings && settings.home, 80) };
    var hp = settings && settings.homePoint ? T.cleanPoint(settings.homePoint, true) : null; if (hp) st.homePoint = hp;
    if (settings && settings.units === "km") st.units = "km";
    return { app: APP_ID, version: BACKUP_VERSION, exportedAt: now || new Date().toISOString(),
             note: "Famstamp backup. Keep this file somewhere safe (email it to yourself, or save it to your cloud drive).",
             kids: kids, trips: trips, photos: photos, settings: st };
  }
  function cleanArea(bag, idRe) {
    var out = {};
    if (bag && typeof bag === "object") Object.keys(bag).slice(0, 400).forEach(function (k) {
      if (!idRe.test(k)) return; var v = bag[k] || {}; out[k] = { at: validDate(v.at) };
      if (v.jr) out[k].jr = true; else if ("jr" in v) out[k].jr = false;
    });
    return out;
  }
  /** Checks a parsed backup file and returns clean copies, or throws a friendly error. */
  function readBackup(obj) {
    if (!obj || typeof obj !== "object" || obj.app !== APP_ID) throw new Error("That file isn't a Famstamp backup.");
    if (typeof obj.version !== "number" || obj.version < 1 || obj.version > BACKUP_VERSION) throw new Error("This backup was made by a newer version of the app. Reload the app and try again.");
    if (!Array.isArray(obj.kids) || !Array.isArray(obj.trips) || !Array.isArray(obj.photos || [])) throw new Error("The backup file looks damaged.");
    var idOk = /^[a-z]+_[A-Za-z0-9]{4,40}$/;
    var present = { kids: {}, trips: {}, photos: {} };
    var kids = obj.kids.filter(function (k) { return k && idOk.test(k.id) && clean(k.name, 40); }).map(function (k) {
      // v1 files have no role: everyone in them was a kid
      var kid = newPerson({ id: k.id, name: k.name, role: obj.version >= 2 ? k.role : "kid", birthYear: k.birthYear, color: k.color, now: k.createdAt, relationship: k.relationship, nickname: k.nickname });
      kid.states = cleanArea(k.states, /^[A-Z]{2}$/); kid.places = cleanArea(k.places, /^[A-Z0-9]{3}$/); kid.parks = cleanArea(k.parks, /^[a-z0-9-]{2,40}$/);
      if (obj.version >= 4 && Array.isArray(k.stamps) && k.stamps.length) kid.stamps = P.cleanStamps(k.stamps);
      // kid quests and firsts: plain JSON, checked again by quests.js / firsts.js when shown
      ["quests", "firsts"].forEach(function (f) { var v = k[f]; if (v && typeof v === "object" && !Array.isArray(v)) { var j = JSON.stringify(v); if (j.length < 60000) kid[f] = JSON.parse(j); } });
      // cities / food / pub stamps and the food & drink list (spots.js)
      if (k.spots && typeof k.spots === "object" && !Array.isArray(k.spots)) { var js = JSON.stringify(k.spots); if (js.length < 60000) kid.spots = JSON.parse(js); }
      if (Array.isArray(k.eats)) { var je = JSON.stringify(k.eats.slice(0, 500)); if (je.length < 200000) kid.eats = JSON.parse(je); }
      kid.createdAt = typeof k.createdAt === "string" ? k.createdAt.slice(0, 30) : kid.createdAt;
      kid.updatedAt = typeof k.updatedAt === "string" ? k.updatedAt.slice(0, 30) : kid.updatedAt;
      // v49: a file with no relationship stays that way (relOf() still shows the default); a set one is kept as is
      if (k.relationship == null) delete kid.relationship;
      // v49: fields this version doesn't rebuild (wish lists, newer features, Family Sync extras) come back too, not dropped
      kid = keepUnknown(k, kid, BIG);
      present.kids[kid.id] = presentKeys(k, kid);
      return kid;
    });
    var kidIds = kids.map(function (k) { return k.id; });
    var photos = (obj.photos || []).filter(function (p) {
      return p && idOk.test(p.id) && typeof p.dataUrl === "string" && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.dataUrl) && p.dataUrl.length < 4e6;
    }).map(function (p) { var o = keepUnknown(p, { id: p.id, dataUrl: p.dataUrl }, BIG); present.photos[o.id] = presentKeys(p, o); return o; });
    var photoIds = photos.map(function (p) { return p.id; });
    var trips = obj.trips.filter(function (t) { return t && idOk.test(t.id) && (Array.isArray(t.kidIds) || typeof t.kidId === "string"); }).map(function (t) {
      var src0 = t, v4 = obj.version >= 4; if (!v4) { t = JSON.parse(JSON.stringify(t)); delete t.route; }
      t = migrateTrip(JSON.parse(JSON.stringify(t)));
      var ids = t.kidIds.filter(function (id) { return kidIds.indexOf(id) >= 0; });
      if (!ids.length || !clean(t.place, 80)) return null;
      return withKeys(src0, keepUnknown(t, newTrip({ id: t.id, kidIds: ids, place: t.place, from: obj.version >= 3 ? t.from : "", stops: obj.version >= 3 ? t.stops : [], date: t.date, who: t.who, memory: t.memory, mark: t.mark,
                       photoId: photoIds.indexOf(t.photoId) >= 0 ? t.photoId : null, createdAt: t.createdAt, now: t.updatedAt,
                       route: v4 ? t.route : [], title: v4 ? t.title : "", endDate: v4 ? t.endDate : "", nights: v4 ? t.nights : null, roundTrip: v4 && t.roundTrip, done: v4 && t.done, fly: v4 ? t.fly : "", back: v4 ? t.back : null,
                       stays: v4 ? t.stays : [], favs: v4 ? t.favs : [], moments: v4 ? t.moments : {}, story: v4 ? t.story : null, memories: v4 ? t.memories : {} }), BIG), present.trips);
    }).filter(Boolean);
    var home = obj.version >= 3 && obj.settings && typeof obj.settings === "object" ? clean(obj.settings.home, 80) : "";
    var settings = { home: home };
    if (obj.version >= 4 && obj.settings && typeof obj.settings === "object") { var hp = T.cleanPoint(obj.settings.homePoint, true); if (hp) settings.homePoint = hp; if (obj.settings.units === "km") settings.units = "km"; }
    return { kids: kids, trips: trips, photos: photos, settings: settings, present: present, exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : "" };
  }

  /** Fields a newer app version (or Family Sync, e.g. copiedFrom) added that this version doesn't know: keep them as plain JSON.
      max = longest field kept (default 2000; restore passes BIG so wish lists and the like survive). */
  var BIG = 500000;
  function keepUnknown(src, built, max) {
    var out = {};
    Object.keys(src || {}).forEach(function (k) {
      if (k in built || k === "kidId" || !/^[A-Za-z][A-Za-z0-9]{0,29}$/.test(k)) return;
      var j; try { j = JSON.stringify(src[k]); } catch (e) { return; }
      if (j && j.length <= (max || 2000)) out[k] = JSON.parse(j);
    });
    return Object.assign(out, built);
  }
  /** The fields of a cleaned record that were really in the file (so a restore only overwrites those). */
  function presentKeys(src, built) { return Object.keys(built).filter(function (k) { return k === "id" || (src && Object.prototype.hasOwnProperty.call(src, k)); }); }
  function withKeys(src, built, bag) { bag[built.id] = presentKeys(src, built); return built; }
  /** Restore everything, one record: a record that isn't on this phone comes in whole; one that is keeps every field it has
      and takes only the fields the file really has (people on a trip are added, never removed). */
  function mergeRestore(existing, incoming, keys) {
    if (!existing) return incoming;
    // v50: a trip edited on this phone after the file was saved (e.g. a draft marked reviewed) stays as it is; the file can only add people
    if (Array.isArray(existing.kidIds) && Array.isArray(incoming.kidIds) && existing.updatedAt && incoming.updatedAt && String(existing.updatedAt) > String(incoming.updatedAt)) {
      var keep = JSON.parse(JSON.stringify(existing));
      keep.kidIds = existing.kidIds.concat(incoming.kidIds.filter(function (id) { return existing.kidIds.indexOf(id) < 0; }));
      return keep;
    }
    var out = JSON.parse(JSON.stringify(existing));
    (keys || Object.keys(incoming)).forEach(function (k) { if (k in incoming) out[k] = incoming[k]; });
    if (Array.isArray(existing.kidIds) && Array.isArray(incoming.kidIds))
      out.kidIds = existing.kidIds.concat(incoming.kidIds.filter(function (id) { return existing.kidIds.indexOf(id) < 0; }));
    // v58: a person's food & drink list and spot stamps join up (by id / by spot), so restoring never loses one made on this phone.
    // On the same entry, the side with the newer person wins.
    var mineNewer = !!(existing.updatedAt && incoming.updatedAt && String(existing.updatedAt) > String(incoming.updatedAt));
    if (Array.isArray(existing.eats) || Array.isArray(incoming.eats)) {
      var ex = Array.isArray(existing.eats) ? existing.eats : [], inc = Array.isArray(incoming.eats) ? incoming.eats : [], byId = {}, order = [];
      (mineNewer ? inc.concat(ex) : ex.concat(inc)).forEach(function (e) { if (!e || !e.id) return; if (!(e.id in byId)) order.push(e.id); byId[e.id] = e; });
      out.eats = JSON.parse(JSON.stringify(order.map(function (id) { return byId[id]; })));
    }
    if ((existing.spots && typeof existing.spots === "object") || (incoming.spots && typeof incoming.spots === "object")) {
      var a1 = existing.spots && typeof existing.spots === "object" ? existing.spots : {}, b1 = incoming.spots && typeof incoming.spots === "object" ? incoming.spots : {};
      out.spots = JSON.parse(JSON.stringify(Object.assign({}, mineNewer ? b1 : a1, mineNewer ? a1 : b1)));
    }
    return out;
  }

  /** Long edge capped at max px, keeping the shape. */
  function fitDims(w, h, max) {
    max = max || 1280; if (!(w > 0 && h > 0)) return { w: 0, h: 0 };
    var s = Math.min(1, max / Math.max(w, h)); return { w: Math.round(w * s), h: Math.round(h * s) };
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function prettyDate(d) {
    if (!validDate(d)) return "";
    var m = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return m[parseInt(d.slice(5, 7), 10) - 1] + " " + parseInt(d.slice(8, 10), 10) + ", " + d.slice(0, 4);
  }
  function backupNudge(lastBackupAt, trips) {
    var since = trips.filter(function (t) { return !lastBackupAt || t.updatedAt > lastBackupAt; }).length;
    return since >= 3 ? since : 0;
  }

  // ---------- Drafts (trips made from photos, waiting for a "Looks good") ----------
  var DRAFT_RE = /^\s*draft:\s*/i;
  function isDraft(t) { return !!t && !t.deletedAt && (t.draft === true || DRAFT_RE.test(String(t.title || ""))); }
  function draftTrips(trips) { return (trips || []).filter(isDraft); }
  /** Mark a draft reviewed: draft off, "Draft:" taken off the name, and a fresh updatedAt so it syncs and wins over the file it came from. */
  function reviewTrip(t, now) {
    now = now || new Date().toISOString(); var c = JSON.parse(JSON.stringify(t));
    c.draft = false;
    ["title", "place"].forEach(function (f) { if (typeof c[f] === "string" && DRAFT_RE.test(c[f])) c[f] = c[f].replace(DRAFT_RE, "").trim(); });
    if (!c.place) c.place = c.title || "Trip";
    c.reviewedAt = now; c.updatedAt = now; return c;
  }

  // ---------- On this day (v51): trips that were happening on today's date in an earlier year ----------
  /** today = "YYYY-MM-DD". Returns [{ trip, years, label }], most recent year first. A trip counts on every day from its start to its end
      (or start + nights). Feb 29 trips also show on Feb 28 in other years. */
  function onThisDay(trips, today) {
    today = today || todayStr(); var y = +today.slice(0, 4), md = today.slice(5);
    var leapFix = md === "02-28" && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0));
    var out = [];
    (trips || []).forEach(function (t) {
      if (!t || t.deletedAt || !/^\d{4}-\d{2}-\d{2}$/.test(t.date || "")) return;
      var ty = +t.date.slice(0, 4); if (ty >= y) return;
      var end = /^\d{4}-\d{2}-\d{2}$/.test(t.endDate || "") && t.endDate >= t.date ? t.endDate : t.nights > 0 ? addDays(t.date, t.nights) : t.date;
      var hit = false;
      for (var yy = ty; yy <= +end.slice(0, 4) && !hit; yy++) {
        var d = yy + "-" + md, d2 = leapFix ? yy + "-02-29" : "";
        if ((d >= t.date && d <= end) || (d2 && d2 >= t.date && d2 <= end)) { hit = yy < y ? yy : 0; }
      }
      if (!hit) return;
      out.push({ trip: t, years: y - hit, label: dayLabel(t) });
    });
    return out.sort(function (a, b) { return a.years - b.years || (a.trip.date < b.trip.date ? 1 : -1); });
  }
  function addDays(iso, n) { var d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
  function dayLabel(t) {
    var title = String(t.title || "").replace(DRAFT_RE, "").trim();
    var main = T && T.mainDest && Array.isArray(t.route) && t.route.length ? T.mainDest(t.route) : "";
    return title || main || String(t.place || "").replace(DRAFT_RE, "").trim() || "a trip";
  }
  // v57: when nothing happened on this exact date, trips from this calendar month in earlier years (drafts count: they're real trips).
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  /** [{ trip, year, label, month }] for trips with any day in today's month of an earlier year, newest year first (then latest start). */
  function onThisMonth(trips, today) {
    today = today || todayStr(); var y = +today.slice(0, 4), mm = today.slice(5, 7), out = [];
    (trips || []).forEach(function (t) {
      if (!t || t.deletedAt || !/^\d{4}-\d{2}-\d{2}$/.test(t.date || "")) return;
      var start = t.date.slice(0, 7), end = tripEnd(t).slice(0, 7), hit = 0;
      for (var yy = Math.min(+end.slice(0, 4), y - 1); yy >= +t.date.slice(0, 4) && !hit; yy--) { var m = yy + "-" + mm; if (m >= start && m <= end) hit = yy; }
      if (hit) out.push({ trip: t, year: hit, month: MONTHS[+mm - 1], label: dayLabel(t) });
    });
    return out.sort(function (a, b) { return b.year - a.year || (a.trip.date < b.trip.date ? 1 : -1); });
  }
  function onThisMonthLine(x) { return x.month + " " + x.year + ": " + x.label; }
  function onThisDayLine(x) { return (x.years === 1 ? "1 year ago" : x.years + " years ago") + " today you were in " + x.label; }

  // ---------- Coming up / on a trip now (v53) ----------
  function dayDiff(a, b) { return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5); }
  function tripEnd(t) { return /^\d{4}-\d{2}-\d{2}$/.test(t.endDate || "") && t.endDate >= t.date ? t.endDate : t.nights > 0 ? addDays(t.date, t.nights) : t.date; }
  /** Trips that haven't started yet (not drafts, not deleted), soonest first: [{ trip, days }] */
  function upcoming(trips, today) {
    today = today || todayStr();
    return (trips || []).filter(function (t) { return t && !t.deletedAt && !isDraft(t) && /^\d{4}-\d{2}-\d{2}$/.test(t.date || "") && t.date > today; })
      .map(function (t) { return { trip: t, days: dayDiff(today, t.date) }; }).sort(function (a, b) { return a.days - b.days; });
  }
  /** Trips happening today: [{ trip, day, of }] ("day 3 of 7"). */
  function onTripNow(trips, today) {
    today = today || todayStr();
    return (trips || []).filter(function (t) {
      if (!t || t.deletedAt || isDraft(t) || !/^\d{4}-\d{2}-\d{2}$/.test(t.date || "")) return false;
      var end = tripEnd(t); return t.date <= today && today <= end;
    }).map(function (t) { return { trip: t, day: dayDiff(t.date, today) + 1, of: dayDiff(t.date, tripEnd(t)) + 1 }; });
  }
  function countdownLine(x) {
    var n = dayLabel(x.trip);
    return x.days === 1 ? n + " is tomorrow!" : n + " in " + x.days + " days";
  }

  // ---------- Family cup (v56): a friendly, on-device ranking inside one family log. Nothing leaves the phone. ----------
  /** Categories with competition ranks (ties share a rank), plus one cheer per person so everyone gets something.
      people = the people to compare (usually the kids); year = "2026". */
  function familyCup(people, trips, world, year) {
    year = String(year || today().slice(0, 4));
    function newThisYear(p) { var n = 0; ["states", "places", "parks"].forEach(function (bag) { Object.keys(p[bag] || {}).forEach(function (id) { var at = p[bag][id] && p[bag][id].at; if (typeof at === "string" && at.slice(0, 4) === year) n++; }); }); return n; }
    function tripsThisYear(p) { return trips.filter(function (t) { return !t.deletedAt && !isDraft(t) && t.kidIds.indexOf(p.id) >= 0 && String(t.date || "").slice(0, 4) === year; }).length; }
    var st = {}; people.forEach(function (p) { st[p.id] = stats(p, trips, world); });
    var CATS = [
      { id: "year", icon: "✨", label: "New stamps in " + year, short: "new stamps this year", val: newThisYear },
      { id: "trips", icon: "🧳", label: "Trips in " + year, short: "trips this year", val: tripsThisYear },
      { id: "states", icon: "🇺🇸", label: "States", short: "states", val: function (p) { return st[p.id].states; } },
      { id: "countries", icon: "🌍", label: "Countries", short: "countries", val: function (p) { return st[p.id].countries; } },
      { id: "parks", icon: "🏞️", label: "National parks", short: "national parks", val: function (p) { return st[p.id].parks; } },
      { id: "miles", icon: "🛣️", label: "Miles traveled", short: "miles", val: function (p) { return Math.round(st[p.id].miles || 0); } }];
    var cats = CATS.map(function (c) {
      var rows = people.map(function (p) { return { id: p.id, val: c.val(p) || 0 }; }).sort(function (a, b) { return b.val - a.val; });
      rows.forEach(function (r, i) { r.rank = i && rows[i - 1].val === r.val ? rows[i - 1].rank : i + 1; });
      return { id: c.id, icon: c.icon, label: c.label, short: c.short, rows: rows };
    }).filter(function (c) { return c.rows.some(function (r) { return r.val > 0; }); });
    var cheers = {};
    people.forEach(function (p) {
      var mine = cats.map(function (c) { var r = c.rows.filter(function (x) { return x.id === p.id; })[0]; return { c: c, r: r }; }).filter(function (x) { return x.r.val > 0; });
      var top = mine.filter(function (x) { return x.r.rank === 1; });
      var sole = top.filter(function (x) { return x.c.rows.filter(function (r) { return r.rank === 1; }).length === 1; });
      function list(xs) { return xs.slice(0, 2).map(function (x) { return x.c.short; }).join(" and "); }
      if (sole.length) cheers[p.id] = "Leads in " + list(sole);
      else if (top.length) cheers[p.id] = "Tied for the lead in " + list(top);
      else if (mine.length) { mine.sort(function (a, b) { return a.r.rank - b.r.rank; }); var b = mine[0], ahead = b.c.rows.filter(function (r) { return r.rank === b.r.rank - 1 || r.rank < b.r.rank; }); var gap = ahead.length ? ahead[ahead.length - 1].val - b.r.val + 1 : 0;
        cheers[p.id] = gap > 0 && gap <= 3 && b.c.id !== "miles" ? gap + " more " + b.c.short + " to move up" : "#" + b.r.rank + " in " + b.c.short; }
      else cheers[p.id] = "Ready for a first stamp";
    });
    return { year: year, cats: cats, cheers: cheers };
  }

  // ---------- Near a stamp (v55): what can be stamped around a point. The point is only used here, never saved. ----------
  var NEAR_MILES = 30;
  /** pt = { lat, lon }; d = the places list ({ rows, countries, admin }) or null; people = everyone in the log.
      stateAt (optional) = function (pt) -> US state id the point is inside. Returns { here: { name, region, country, countryName, miles } | null, items: [{ kind, id, name, miles, who: [ids that have it] }] } */
  function nearby(pt, d, people, radius, stateAt) {
    radius = radius || NEAR_MILES; people = people || [];
    if (!pt || typeof pt.lat !== "number" || typeof pt.lon !== "number" || !T || !T.gcMiles) return { here: null, items: [] };
    function who(bag, id) { return people.filter(function (p) { return p[bag] && p[bag][id]; }).map(function (p) { return p.id; }); }
    var here = null, best = Infinity;
    ((d && d.rows) || []).forEach(function (r) { if (typeof r.lat !== "number") return; if (Math.abs(r.lat - pt.lat) > 1 || Math.abs(r.lon - pt.lon) > 1.5) return;
      var m = T.gcMiles(pt, r); if (m < best && m <= radius) { best = m; here = r; } });
    var items = [];
    if (here) {
      var cn = (d.countries && d.countries[here.country]) || here.country;
      // stateAt(pt) = the state the point is really inside (map shapes, in the browser); the nearest town can be over a state line
      var inState = stateAt ? stateAt(pt) : "";
      if (inState && here.country === "USA") here = Object.assign({}, here, { admin1: inState });
      if (here.country === "USA" && /^[A-Z]{2}$/.test(here.admin1 || "")) items.push({ kind: "state", id: here.admin1, name: (d.admin && d.admin["USA." + here.admin1]) || here.admin1, miles: 0, who: who("states", here.admin1) });
      else if (here.country === "GBR" && /^(ENG|SCT|WLS|NIR)$/.test(here.admin1 || "")) items.push({ kind: "place", id: here.admin1, name: (d.admin && d.admin["GBR." + here.admin1]) || here.admin1, miles: 0, who: who("places", here.admin1) });
      if (here.country && here.country !== "USA" && here.country !== "GBR") items.push({ kind: "place", id: here.country, name: cn, miles: 0, who: who("places", here.country) });
      here = { name: here.name, region: here.admin1 || "", country: here.country, countryName: cn, miles: Math.round(best) };
    }
    ALL_PARKS.forEach(function (p) { if (typeof p.lat !== "number") return; var m = T.gcMiles(pt, p); if (m <= radius) items.push({ kind: "park", id: p.id, name: p.full || p.name, miles: Math.round(m), who: who("parks", p.id) }); });
    items.sort(function (a, b) { return (a.kind === "park") - (b.kind === "park") || a.miles - b.miles; });
    return { here: here, items: items };
  }

  // ---------- Recently deleted (soft delete, kept in the trip itself so no cloud change is needed) ----------
  var BIN_DAYS = 30;
  function tripLabel(t) { return String((t && (t.title || t.place)) || "this trip").trim(); }
  /** Move a trip to Recently deleted: same trip, plus deletedAt. updatedAt moves on so the change syncs like any edit. */
  function binTrip(t, now) { now = now || new Date().toISOString(); var c = JSON.parse(JSON.stringify(t)); c.deletedAt = now; c.updatedAt = now; return c; }
  /** Bring a trip back. A fresh updatedAt means the cloud takes it, even over an older delete. */
  function unbinTrip(t, now) { now = now || new Date().toISOString(); var c = JSON.parse(JSON.stringify(t)); delete c.deletedAt; c.updatedAt = now; return c; }
  /** live = shown everywhere, bin = Recently deleted (newest first), purge = in the bin longer than 30 days. */
  function splitTrips(trips, now) {
    var cut = new Date(now || Date.now()).getTime() - BIN_DAYS * 864e5, out = { live: [], bin: [], purge: [] };
    (trips || []).forEach(function (t) {
      if (!t.deletedAt) out.live.push(t);
      else if (new Date(t.deletedAt).getTime() < cut) out.purge.push(t);
      else out.bin.push(t);
    });
    out.bin.sort(function (a, b) { return a.deletedAt < b.deletedAt ? 1 : -1; });
    return out;
  }
  function binDaysLeft(t, now) { return Math.max(0, Math.ceil((new Date(t.deletedAt).getTime() + BIN_DAYS * 864e5 - new Date(now || Date.now()).getTime()) / 864e5)); }
  /** Take one trip out of a backup (already read with readBackup) for this log: only its travelers who are here, fresh updatedAt,
      never touches people. Returns { trip, photo } or throws a plain-words error. */
  function tripFromBackup(data, tripId, peopleIds, now) {
    var t = (data.trips || []).filter(function (x) { return x.id === tripId; })[0];
    if (!t) throw new Error("That trip isn't in this backup.");
    var ids = (t.kidIds || []).filter(function (id) { return peopleIds.indexOf(id) >= 0; });
    if (!ids.length) throw new Error("No one on " + tripLabel(t) + " is in this log any more, so there's no one to give it back to.");
    var c = unbinTrip(t, now); c.kidIds = ids;
    var ph = c.photoId ? (data.photos || []).filter(function (p) { return p.id === c.photoId; })[0] || null : null;
    if (c.photoId && !ph) c.photoId = null;
    return { trip: c, photo: ph };
  }

  return { onThisMonth: onThisMonth, onThisMonthLine: onThisMonthLine, MONTHS: MONTHS, familyCup: familyCup, nearby: nearby, NEAR_MILES: NEAR_MILES, upcoming: upcoming, onTripNow: onTripNow, countdownLine: countdownLine, tripEnd: tripEnd, dayDiff: dayDiff, onThisDay: onThisDay, onThisDayLine: onThisDayLine, addDays: addDays, isDraft: isDraft, draftTrips: draftTrips, reviewTrip: reviewTrip, BIN_DAYS: BIN_DAYS, tripLabel: tripLabel, binTrip: binTrip, unbinTrip: unbinTrip, splitTrips: splitTrips, binDaysLeft: binDaysLeft, tripFromBackup: tripFromBackup,
           APP_ID: APP_ID, BACKUP_VERSION: BACKUP_VERSION, PARKS: PARKS, ALL_PARKS: ALL_PARKS, parkById: parkById, parksIn: parksIn, parkSub: parkSub, PARK_SETS: PARK_SETS, COLORS: COLORS, UK_NATIONS: UK_NATIONS, ROLES: ROLES, validRole: validRole, isKid: isKid, RELATIONS: RELATIONS, NICK_MAX: NICK_MAX, defaultRel: defaultRel, validRel: validRel, relOf: relOf, relLabel: relLabel, who: who, realName: realName, isFollower: isFollower, followers: followers,
           newPerson: newPerson, countrySet: countrySet, whoBeen: whoBeen, familyStats: familyStats,
           US_STATE_TOTAL: US_STATE_TOTAL, COUNTRY_TOTAL: COUNTRY_TOTAL,
           slug: slug, uid: uid, newKid: newKid, toggleArea: toggleArea, togglePark: togglePark, newTrip: newTrip, applyTripMark: applyTripMark,
           ageOn: ageOn, stats: stats, badges: badges, BADGES: BADGES, makeBackup: makeBackup, readBackup: readBackup, mergeRestore: mergeRestore, fitDims: fitDims,
           esc: esc, prettyDate: prettyDate, validDate: validDate, today: today, backupNudge: backupNudge,
           MAX_STOPS: MAX_STOPS, migrateTrip: migrateTrip, routeText: routeText, joinNames: joinNames, tripsTogether: tripsTogether, pairCounts: pairCounts,
           backupDue: backupDue, BACKUP_DAYS: BACKUP_DAYS, SNOOZE_DAYS: SNOOZE_DAYS, PARK_STATES: PARK_STATES, T: T, P: P };
});
