# Diablo IV Game Assets

Master library:

`C:\Gaming\Diablo IV Exports\Organized Assets`

Do not copy the entire library into this repository.

Use:

`tools\Import-DiabloAsset.ps1`

to search and import only the assets actually needed by the Diablo site.

Rules:

1. Search the master asset manifest first.
2. Prefer exact Diablo IV assets over generic replacements.
3. Import only assets actually used by the site.
4. Use human-readable filenames inside the website.
5. Preserve PNG transparency.
6. Do not modify the master asset library.
7. Keep imported game assets under `assets/game/`.
8. Do not modify anything outside `/diablo/`.
9. If multiple matches are found, inspect them instead of guessing.
