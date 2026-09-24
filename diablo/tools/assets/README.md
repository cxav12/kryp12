# Diablo asset tools

The site resolves every game image through `data/assets.json`. Build data stores stable IDs such as `skill:whirlwind`; components must not add their own image paths.

## Import a local master library

Use a local checkout of [DiabloTools/d4data](https://github.com/DiabloTools/d4data) or an asset export created by [D4Analyzer](https://github.com/DiabloTools/Diablo4Tools-Releases):

```powershell
node diablo/tools/assets/import-assets.mjs --source "C:\path\to\d4data-or-export"
```

The importer recursively indexes supported images, accepts only exact normalized entity-name matches, hashes candidates, copies only requested assets, and updates the manifest and reports. It will not overwrite different content unless `--force` is explicitly supplied after review. Use `--dry-run` for discovery without writes.

Run `node diablo/tools/assets/audit-legacy-assets.mjs` to refresh the legacy inventory and duplicate report. Run `node diablo/tools/assets/normalize-build-assets.mjs` only when importing old build data that still contains image paths.

## Source policy

DiabloTools is the primary data/export toolchain; it is not the copyright owner of Diablo artwork. Diablo IV game assets remain property of Blizzard Entertainment or their respective owners. Maxroll, Mobalytics, D4Guides, Wowhead, and other build sites are not image CDNs for this project. Approved legacy assets remain explicitly marked as provisional until a verified game-source replacement is available.
