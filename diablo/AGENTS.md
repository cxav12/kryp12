# Diablo IV Site — Codex Instructions

This directory contains the Diablo IV website.

## Scope
Work only inside this `/diablo/` project unless explicitly instructed otherwise.
Do not modify sibling websites, the repository homepage, or unrelated projects.

## Diablo IV Game Asset Library
Master library:
`C:\Gaming\Diablo IV Exports\Organized Assets`

The library contains 6,679 indexed PNG assets from 140 source atlases.
Do not bulk-copy the library into the repository. Import only assets actually used by the site.

## Asset Manifest
Use the master library's `asset-manifest.json` or `asset-manifest.csv` to locate assets.
Useful fields: category, subcategory, class, atlas, sno, frameIndex, internalName, fileName, relativePath, width, height, sha256, searchText.
Prefer `internalName` when identifying a specific game asset.

## Asset Search / Import Tool
Use:
`tools\Import-DiabloAsset.ps1`

Search example:
`.\tools\Import-DiabloAsset.ps1 -Search "whirlwind" -Category "Skills" -Class "Barbarian"`

Import example:
`.\tools\Import-DiabloAsset.ps1 -Search "Whirlwind_Up" -Category "Skills" -Class "Barbarian" -Destination "assets\game\skills\barbarian\whirlwind.png"`

If multiple results are returned, inspect the candidates instead of guessing.

Common skill states:
- `_Up` = normal/default
- `_Over` = hover
- `_Down` = pressed
- `_Disabled` = disabled/grayed

Prefer `_Up` for ordinary website display unless another state is specifically required.

## Production Assets
Keep imported game assets under `assets/game/`.
Use human-readable production filenames.
Preserve PNG transparency.

## Rules
1. Search the extracted Diablo IV library before creating a replacement icon.
2. Prefer the real Diablo IV game asset when an appropriate one exists.
3. Do not substitute generic icons when a specific game asset exists.
4. Do not modify, rename, or delete master-library files.
5. Do not bulk-copy all extracted assets into Git.
6. Import only assets required by the current implementation.
7. Do not automatically delete duplicate-looking assets; Diablo may intentionally reuse artwork.
8. Do not modify anything outside `/diablo/`.
9. When uncertain about an asset match, report the best candidates rather than choosing arbitrarily.
10. Keep hero cards free of decorative background shapes, gradients, illustrations, and other purely ornamental designs unless the user explicitly requests one.

## Tested Asset
`assets/game/skills/barbarian/whirlwind.png`
- Internal name: `Whirlwind_Up`
- Atlas: `2DUI_Skills_Barbarian`
- SNO: `65420`
- Frame: `39`

See `DIABLO-ASSETS.md` for the local workflow.
