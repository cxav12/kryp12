# Palworld Reference

Static Palworld reference site published as a sibling of the Yankees site.

## Front-end structure

- `styles.css` contains the universal design tokens and shared layout,
  navigation, filter, search, status, and typography classes.
- Each page has its own `styles.css` for page-specific components only.
- `shared.js` contains reusable display and sprite helpers.
- Each page keeps its behavior in its own `app.js`.
- Favorite selections use device-local browser storage. They are not uploaded
  or synchronized between devices.
- Search and filter state is stored in each page URL so filtered views can be
  bookmarked or shared.
- Run `scripts/update-breeding-power.py` after refreshing Pal data to add the
  current Paldeck breeding-power values to the site datasets.

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
rarities, elements, breeding power, and portrait coordinates. Element data
supports the shared element-colored Pal-name treatment. `data/pals.json`
remains the complete imported dataset.

Breeding combinations can be regenerated with:

```sh
python scripts/build-breeding-data.py
```

The Breeding page's mutation mode uses the Palworld 1.0 mutation rank formula
with the reviewed eligible-species list in `data/mutations.json`. Update that
file when game patches change mutation eligibility or cake chances.

The Item Guide resource is generated from the verified Pal drop and Ranch
source data:

```sh
python scripts/build-item-data.py
```

Party Guides are stored as curated recommendations in
`data/party-guides.json`. Pal names in those guides resolve against
`data/pal-index.json` so the Resources page can reuse the shared Pal portrait
sprite.

The generated `data/items.json` intentionally contains only items with a known
Pal drop or Ranch source in the local datasets.

## Namecheap hosting

The Palworld-only `.htaccess` enables compression for HTML, CSS, JavaScript,
and JSON and adds conservative browser caching. HTML and JSON are revalidated
so data updates appear promptly; images cache for one day; versioned CSS and
JavaScript cache for one week. Hosts that do not use Apache, including GitHub
Pages, simply ignore this file.
