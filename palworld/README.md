# Palworld Reference

Static Palworld reference site published as a sibling of the Yankees site.

## Data status

The page reads update information from `data/passive-skills.json`.

Set `metadata.updateStatus` to `"update-required"` and add an
`metadata.updateMessage` when the stored data needs to be refreshed. Set it
back to `"current"` after the dataset is reviewed and updated.

The passive-skills collection is intentionally empty until the data source and
import process are approved.

## Paldeck assets

Pal portraits, element icons, and work suitability icons can be refreshed from
Paldeck with:

```sh
node tools/import-paldeck-assets.mjs
```

The importer writes Pal data to `data/pals.json`, writes an asset source list to
`data/paldeck-assets.json`, and stores downloaded images under
`assets/paldeck/`.
