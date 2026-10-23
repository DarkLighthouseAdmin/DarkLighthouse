/* Famstamp: official state bird, flower and animal for the 50 states + DC, for the US passport stamps.
   Sources (checked Oct 2026):
     https://en.wikipedia.org/wiki/List_of_U.S._state_birds
     https://en.wikipedia.org/wiki/List_of_U.S._state_and_territory_flowers
     https://en.wikipedia.org/wiki/List_of_U.S._state_mammals
     https://en.wikipedia.org/wiki/List_of_U.S._state_horses
   Row: "bird|glyph|flower|glyph|animal|glyph|note". "animal" is the state mammal (or state animal); where a state names none,
   the next official animal is used and the note says which (state horse, dog, marine mammal...). Where a state has no
   official animal at all, the animal is its bird and the note says "no official animal: shows the state bird".
   The glyphs are simple drawings of our own in stamp-art.js; shared ones get their own pose, ink and shape per state. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.WK_STATESYM = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  var RAW = {
    AL: "Yellowhammer|woodpecker|Camellia|rose|Black bear|bear|",
    AK: "Willow ptarmigan|grouse|Forget-me-not|forgetmenot|Moose|moose|state land mammal",
    AZ: "Cactus wren|wren|Saguaro blossom|saguaro|Ringtail|ringtail|",
    AR: "Mockingbird|mocker|Apple blossom|blossom|White-tailed deer|deer|",
    CA: "California quail|quail|California poppy|poppy|Grizzly bear|grizzly|",
    CO: "Lark bunting|song|Blue columbine|columbine|Bighorn sheep|bighorn|",
    CT: "American robin|robin|Mountain laurel|cluster|Sperm whale|whale|state animal",
    DE: "Blue Hen chicken|hen|Peach blossom|blossom|Gray fox|fox|state wildlife animal",
    FL: "Mockingbird|mocker|Orange blossom|blossom|Florida panther|cat|",
    GA: "Brown thrasher|mocker|Cherokee rose|wildrose|White-tailed deer|deer|",
    HI: "Nene|goose|Hawaiian hibiscus|hibiscus|Monk seal|seal|",
    ID: "Mountain bluebird|song|Syringa|blossom|Appaloosa|horse|no state mammal: state horse",
    IL: "Cardinal|crest|Violet|violet|White-tailed deer|deer|",
    IN: "Cardinal|crest|Peony|peony|Cardinal|crest|no official animal: shows the state bird",
    IA: "Eastern goldfinch|finch|Wild rose|wildrose|Eastern goldfinch|finch|no official animal: shows the state bird",
    KS: "Western meadowlark|lark|Sunflower|sunflower|American bison|bison|",
    KY: "Cardinal|crest|Goldenrod|spike|Gray squirrel|squirrel|state wild game animal",
    LA: "Brown pelican|pelican|Magnolia|magnolia|Black bear|bear|",
    ME: "Chickadee|chickadee|White pine cone|pinecone|Moose|moose|",
    MD: "Baltimore oriole|song|Black-eyed Susan|daisy|Chesapeake Bay retriever|dog|no state mammal: state dog",
    MA: "Chickadee|chickadee|Mayflower|forgetmenot|Right whale|whale|state marine mammal",
    MI: "American robin|robin|Apple blossom|blossom|White-tailed deer|deer|state game mammal",
    MN: "Common loon|loon|Lady's slipper|slipper|Common loon|loon|no official animal: shows the state bird",
    MS: "Mockingbird|mocker|Magnolia|magnolia|White-tailed deer|deer|",
    MO: "Eastern bluebird|song|Hawthorn|blossom|Missouri mule|mule|",
    MT: "Western meadowlark|lark|Bitterroot|bitterroot|Grizzly bear|grizzly|",
    NE: "Western meadowlark|lark|Goldenrod|spike|White-tailed deer|deer|",
    NV: "Mountain bluebird|song|Sagebrush|sage|Desert bighorn|bighorn|",
    NH: "Purple finch|finch|Purple lilac|spike|White-tailed deer|deer|",
    NJ: "Eastern goldfinch|finch|Violet|violet|Horse|horse|state animal",
    NM: "Roadrunner|roadrunner|Yucca flower|yucca|Black bear|bear|",
    NY: "Eastern bluebird|song|Rose|rose|Beaver|beaver|",
    NC: "Cardinal|crest|Dogwood|dogwood|Gray squirrel|squirrel|",
    ND: "Western meadowlark|lark|Wild prairie rose|wildrose|Nokota horse|horse|no state mammal: honorary state equine",
    OH: "Cardinal|crest|Scarlet carnation|carnation|White-tailed deer|deer|",
    OK: "Scissor-tailed flycatcher|flycatcher|Oklahoma rose|rose|American bison|bison|",
    OR: "Western meadowlark|lark|Oregon grape|berries|Beaver|beaver|",
    PA: "Ruffed grouse|grouse|Mountain laurel|cluster|White-tailed deer|deer|",
    RI: "Rhode Island Red|hen|Violet|violet|Harbor seal|seal|state marine mammal",
    SC: "Carolina wren|wren|Yellow jessamine|trumpet|White-tailed deer|deer|",
    SD: "Ring-necked pheasant|pheasant|Pasque flower|poppy|Coyote|coyote|",
    TN: "Mockingbird|mocker|Iris|iris|Raccoon|raccoon|",
    TX: "Mockingbird|mocker|Bluebonnet|spike|Armadillo|armadillo|state small mammal",
    UT: "California gull|gull|Sego lily|lily|Rocky Mountain elk|elk|",
    VT: "Hermit thrush|robin|Red clover|clover|Morgan horse|horse|state animal",
    VA: "Cardinal|crest|Dogwood|dogwood|Big-eared bat|bat|state bat",
    WA: "Willow goldfinch|finch|Coast rhododendron|cluster|Orca|orca|state marine mammal",
    WV: "Cardinal|crest|Rhododendron|cluster|Black bear|bear|",
    WI: "American robin|robin|Wood violet|violet|Badger|badger|",
    WY: "Western meadowlark|lark|Indian paintbrush|spike|American bison|bison|",
    DC: "Wood thrush|robin|American Beauty rose|rose|Big brown bat|bat|"
  };
  var DATA = {};
  Object.keys(RAW).forEach(function (id) {
    var f = RAW[id].split("|");
    DATA[id] = { bird: { name: f[0], glyph: f[1] }, flower: { name: f[2], glyph: f[3] }, animal: { name: f[4], glyph: f[5], fallback: /^no official animal/.test(f[6] || "") }, note: f[6] || "" };
  });
  return { DATA: DATA, KINDS: ["bird", "flower", "animal"] };
});
