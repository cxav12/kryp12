# Civilization VI game-data importer

This read-only importer converts the installed game's XML database and English
localization into the companion site's deterministic JSON schema. It loads the
base game, Gathering Storm (which embeds the Rise & Fall core), and installed
non-scenario content packs discovered through their `.modinfo` manifests.

Run a safe staging import from the repository root:

```powershell
python civ6/tools/import/import_civ6.py --game "C:\Program Files (x86)\Steam\steamapps\common\Sid Meier's Civilization VI"
```

Review `civ6/tools/import/output/import-report.json` and the staged JSON. To
replace the live site data only after review:

```powershell
python civ6/tools/import/import_civ6.py --game "C:\Program Files (x86)\Steam\steamapps\common\Sid Meier's Civilization VI" --publish
node civ6/tests/validate-data.mjs
```

Validate staged output without publishing it:

```powershell
node civ6/tests/validate-data.mjs civ6/tools/import/output
```

The importer:

- never writes to the game installation;
- excludes scenarios, tutorials, multiplayer modes, and SQL it cannot safely
  reproduce, reporting skipped SQL in `import-report.json`;
- uses stable site IDs derived from Firaxis source keys;
- writes extracted facts only to `gameData`;
- preserves existing hand-authored `strategy` fields by matching stable IDs;
- sorts records and formats JSON deterministically for useful Git diffs;
- stages output by default so extraction never silently replaces working data.

Run the importer unit tests with:

```powershell
python -m unittest discover civ6/tools/import -p "test_*.py"
```

## Icon assets

Install the free Steam tool **Sid Meier's Civilization VI Development Assets**
(app 597260), then generate and publish the site's WebP icons:

```powershell
python civ6/tools/import/import_civ6_assets.py --publish
```

The asset importer reads the official icon XML mappings and prefers loose DDS
atlases from the SDK Assets. When a leader portrait atlas is cooked only into
the retail game, it reads the corresponding Civilization VI
`Platforms/Windows/BLPs/UI/Icons.blp` package read-only, reconstructs the
official ForgeUI texture, crops it by the game's atlas index/size/IconsPerRow,
and writes a lossless WebP. Small `Data/ARX/Civ_LEADER_*.png` images are kept
only as explicit **emblem fallbacks** and are never counted as genuine ruler
portraits.

Before replacing leader portraits, stage and visually review the candidates:

```powershell
python civ6/tools/import/extract_civ6_leader_portraits_stage.py
```

Review:

- `civ6/tools/import/output/leader-portrait-staging/leader-portraits-contact-sheet.png`
- `civ6/tools/import/output/leader-portrait-staging/leader-portrait-staging.json`

After review, publish the normal icon set and require every leader to have a
verified genuine portrait:

```powershell
python civ6/tools/import/import_civ6_assets.py --publish --require-genuine-leader-portraits
python civ6/tools/import/validate_leader_portraits.py --require-all-genuine
node civ6/tests/validate-data.mjs
```

`assets/icons/manifest.json` records the official icon name, atlas, atlas
texture, index, source type/path, dimensions, and transparency metadata.
`assets/icons/report.json` separately reports genuine portraits, ARX emblem
fallbacks, and missing/unverified leader images.
