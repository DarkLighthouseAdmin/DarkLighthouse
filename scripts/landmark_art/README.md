# Landmark stamp drawings

How `travel-log/app/landmark-art.js` is made. Only CC0, public-domain and CC BY files from Wikimedia Commons are used, and each one is credited.

1. `find.py` / `series.py`: search Commons for icon-style line art of each landmark. Keep only free licenses.
2. `info.py`: get the landmark's real Wikidata id (through the English Wikipedia API) and the file's artist, license and page.
3. `pick.json`: the chosen file for each Wikidata id.
4. `prep.py`: download, flatten to black and white, and scale down.
5. `trace.js` (npm `potrace`): trace each picture into one ink path (fill-rule evenodd keeps the holes).
6. `gen.py`: write `landmark-art.js` (glyphs `lm_<Qid>` plus `FS_LANDMARKS` credits) and `travel-log/LANDMARK-CREDITS.md`.

To add a landmark, add its Commons file to `pick.json` and rerun steps 4-6. Stamps people already earned for it upgrade by themselves, because the drawing is looked up by Wikidata id when the stamp is drawn.
