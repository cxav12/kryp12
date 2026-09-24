# Legacy asset migration result

## Deleted after verification

- 398 files from `assets/equipment/`: obsolete bulk catalog; no runtime references remained.
- 369 files from `assets/talismans/`: obsolete bulk catalog; 15 requested talisman images were copied to `assets/game/talismans/` before removal, while the unmatched set-level record remains explicitly missing.
- `data/equipment-assets.json` and `data/talisman-assets.json`: replaced by the canonical `data/assets.json` registry.
- The two D4Guides synchronization scripts: replaced by the source-agnostic DiabloTools/D4Analyzer importer.

The complete filenames, hashes, sizes, former references, and duplicate groups are preserved in `legacy-asset-inventory.json`.

## Retained

- The small `assets/gear/` set and its `SOURCES.md` provenance record remain for review because a verified DiabloTools/D4Analyzer texture replacement is not available locally.
- Production copies marked `legacy` in `assets.json` remain provisional so the existing site keeps useful artwork while the canonical extraction gap is visible.

## Canonical replacements

No legacy image is represented as a DiabloTools-canonical replacement without verification. The importer marks the current production copies as `legacy` and the remaining unavailable entities as `missing`.
