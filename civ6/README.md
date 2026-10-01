# Civilization VI Companion

Static, data-driven Civilization VI reference site for `https://kryp12.com/civ6/`.

## Current scope

The site contains 897 normalized records imported from the installed game,
English localization, and 641 icons extracted from the official Civilization VI
Development Assets. It provides:

- global search with partial matching;
- global ruleset filtering;
- reusable collection browsers and detail views;
- practical strategy panels kept separate from factual game data;
- normalized ID relationships and internal cross-links;
- responsive desktop, tablet, and mobile layouts.

No existing kryp12 site or shared root file is required by this project.

## Stack

- semantic static HTML route entry points;
- one shared responsive CSS design system;
- vanilla JavaScript ES modules;
- normalized JSON datasets loaded with `fetch()`;
- no package install, build step, or third-party UI framework.

Serve the repository over HTTP when developing. ES modules and JSON loading do not work reliably by opening an HTML file directly.

## Routes

- `/civ6/`
- `/civ6/civilizations/`
- `/civ6/tech/`
- `/civ6/civics/`
- `/civ6/policies/`
- `/civ6/resources/`
- `/civ6/districts/`
- `/civ6/buildings/`
- `/civ6/wonders/`

Detail views use stable query-string IDs, for example:

`/civ6/resources/?id=resource_uranium`

## Data model

`data/catalog.json` is the collection manifest. Each collection file contains:

```json
{
  "schemaVersion": 1,
  "sampleData": false,
  "records": []
}
```

Every record uses a stable, type-prefixed ID. Relationships store IDs rather than duplicated objects.

`data/search-index.json` is a compact projection used for immediate global search. Collection pages load only their relevant full dataset, avoiding a request for every JSON file on every page. Keep the index synchronized with source records; the validation script checks its IDs.

```json
{
  "id": "resource_uranium",
  "name": "Uranium",
  "rulesets": ["gathering-storm"],
  "gameData": {
    "improvement": "improvement_mine",
    "technologyRequired": "tech_combined_arms"
  },
  "strategy": {
    "summary": "Editorial decision support belongs here."
  }
}
```

`gameData` is reserved for factual imported or verified game information. `strategy` is editorial content. Do not combine them.

## Adding a record

1. Choose the correct collection in `data/catalog.json`.
2. Add a unique, stable, type-prefixed ID.
3. Add supported rulesets: `base-game`, `rise-and-fall`, and/or `gathering-storm`.
4. Put factual fields under `gameData`.
5. Put concise practical explanation under `strategy`.
6. Reference related records by ID.
7. Run `node civ6/tests/validate-data.mjs` from the repository root.
8. Test search, filters, detail navigation, and mobile layout over a local HTTP server.

## Ruleset and DLC architecture

Records carry a `rulesets` array rather than being duplicated per expansion. Future imported differences should use an override structure keyed by ruleset or DLC package when a field actually changes. Leader packs and other content packs can add a `contentPacks` array without splitting the base record.

## Tile/yield architecture

Resources and improvements already use normalized `yieldChanges` objects and ID relationships. Future terrain, feature, policy, technology, civilization, leader, government, and improvement modifiers should remain atomic. A tile calculator can then explain a total by composing modifiers instead of storing precomputed combinations.

## Game-data import

The primary source is the user's installed Civilization VI XML data. The importer:

1. reads the installed game's XML tables locally;
2. maps game keys to stable site IDs;
3. normalizes Gathering Storm and installed DLC content;
4. emits deterministic JSON collections into `data/`;
5. validates references and reports unresolved keys;
6. preserves hand-written `strategy` content during re-imports;
7. extracts DDS icon atlases from the official SDK Assets into WebP files.

`tools/import/README.md` documents both import commands. No third-party wiki
scraping is part of the pipeline.

## Deployment note

The root `.cpanel.yml` currently copies an explicit list of site folders and does not include `civ6`. Deployment configuration was not changed. Add the Civ 6 copy step only when deployment is explicitly authorized.
