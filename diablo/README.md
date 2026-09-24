# Diablo IV site

Static, data-driven Diablo IV section for kryp12.com. All implementation files are isolated under `/diablo/`.

## Asset architecture

All entity imagery resolves through `data/assets.json` and the shared `DiabloSite.getAsset()` / `DiabloSite.assetMarkup()` helpers in `shared.js`. Build records use asset IDs, never component-specific image paths. Missing art uses the neutral `ui:image-unavailable` asset and is written to the import report.

See `tools/assets/README.md` for importing from a local DiabloTools or D4Analyzer source library, provenance policy, and audit commands.

## Routes

- `/diablo/` — local build browser and class filters
- `/diablo/builds/whirlwind-barbarian/` — normalized guide with one global variant selector
- `/diablo/events/` — Phase 2 World Boss, Helltide, and Legion countdowns
- `/diablo/affix-categories/` — Tuning Prism affix category reference

## Data safety

Build facts live in `data/builds.json`. Skill points are manual allocations only. Event fallback data is explicitly unavailable and cannot masquerade as live. `data/event-adapter.js` defines the provider boundary and projects normalized events from the recurring schedule in `data/event-schedule.json`. These are labeled projections, not a Blizzard live feed; boss identity and location remain unavailable until announced in game or supplied by an event provider.

## Validate

Run `node diablo/tests/validate-data.mjs` from the repository root.

## Deployment note

The repository's root `.cpanel.yml` currently enumerates deployed folders manually. It was intentionally not changed because this task limits writes to `diablo/`; adding the Diablo copy step requires separate approval.
