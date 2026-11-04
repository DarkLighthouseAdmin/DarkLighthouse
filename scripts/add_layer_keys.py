#!/usr/bin/env python3
"""v121: list which towns/sights files exist in each layer's index.json ("keys"), so the app never asks for a file
that isn't there (typing "JFK" used to request data/towns/jf.json, a harmless 404). Additive: only the "keys" field
is added or refreshed; every other field and every data file stays as it is. Re-run after build_towns.py / build_sights.py."""
import json, os, sys
APP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "travel-log", "app", "data")
for layer in ("towns", "sights"):
    d = os.path.join(APP, layer); p = os.path.join(d, "index.json")
    idx = json.load(open(p, encoding="utf-8"))
    keys = sorted(f[:-5] for f in os.listdir(d) if f.endswith(".json") and f != "index.json" and not f.startswith("type-"))
    idx["keys"] = keys
    with open(p, "w", encoding="utf-8") as fh: json.dump(idx, fh, ensure_ascii=False, separators=(",", ":"))
    print(layer, len(keys), "files listed")
