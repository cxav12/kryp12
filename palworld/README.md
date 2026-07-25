# Palworld Reference

Static Palworld reference site published as a sibling of the Yankees site.

## Front-end structure

- `styles.css` contains the universal design tokens and shared layout,
  navigation, filter, search, status, and typography classes.
- Each page has its own `styles.css` for page-specific components only.
- `shared.js` contains reusable display and sprite helpers.
- Each page keeps its behavior in its own `app.js`.

## Data status

The Passive Skills page reads update information from
`data/passive-skills.json`.

Set `metadata.updateStatus` to `"update-required"` and add an
`metadata.updateMessage` when the stored data needs to be refreshed. Set it
back to `"current"` after the dataset is reviewed and updated.

## Paldeck assets

Pal portraits, element icons, and work suitability icons can be refreshed from
Paldeck with:

```sh
node tools/import-paldeck-assets.mjs
```

The importer writes Pal data to `data/pals.json`, writes an asset source list to
`data/paldeck-assets.json`, and stores downloaded images under
`assets/paldeck/`.

After importing data, rebuild the local sprite sheets and compact Breeding
index:

```sh
python scripts/build-pal-sprite.py
```

The Pals page uses the generated `data/pal-cards.json` file, which only contains
the fields needed to render and filter cards. Breeding uses the even smaller
generated `data/pal-index.json` because it only needs Pal names, numbers,
rarities, and portrait coordinates. `data/pals.json` remains the complete
imported dataset.

Breeding combinations can be regenerated with:

```sh
python scripts/build-breeding-data.py
```

## Namecheap hosting

The Palworld-only `.htaccess` enables compression for HTML, CSS, JavaScript,
and JSON and adds conservative browser caching. HTML and JSON are revalidated
so data updates appear promptly; images cache for one day; versioned CSS and
JavaScript cache for one week. Hosts that do not use Apache, including GitHub
Pages, simply ignore this file.
