# Gear image sources

Local copies of Diablo IV inventory artwork used by this private reference site.

The former bulk equipment catalog was removed after centralized migration and
its full audit remains in `data/legacy-asset-inventory.json`. New assets are
imported through `tools/assets/import-assets.mjs` from DiabloTools/D4Analyzer
from D4Guides.gg. Build records normally need only the canonical item name;
`build-guide.js` resolves the matching local asset automatically. Use an
explicit `asset` slug only when two catalog entries share the same display name.

The former bulk charm and seal catalog was also removed after required files
were copied into `assets/game/talismans/` and registered centrally.

- `tuskhelm-of-joritz-the-mighty.webp` — Diablo IV inventory art surfaced by Icy Veins: `2DInventory_Items_Helms_187.webp`
- `gohrs-devastating-grips.webp` — Diablo IV inventory art surfaced by Icy Veins: `2DInventory_Items_Gloves_211.webp`
- `ring-of-starless-skies.webp` — Diablo IV inventory art surfaced by Icy Veins: `2DInventory_Rings_41.webp`
- `ramaladnis-magnum-opus.webp` — Diablo IV inventory art surfaced by Icy Veins: `2DInventory_Swords_36.webp`

Retrieved 2026-09-16 from `https://static.icy-veins.com/wp/static/d4/latest/images/icons/`.
Diablo IV and its artwork are property of Blizzard Entertainment.

Representative artwork for imprinted Legendary bases:

- `legendary-chest.webp` — Rage of Harrogath inventory artwork
- `legendary-pants.webp` — Tibault's Will inventory artwork
- `legendary-boots.webp` — Yen's Blessing inventory artwork
- `legendary-amulet.webp` — Banished Lord's Talisman inventory artwork
- `legendary-ring.webp` — Ring of Red Furor inventory artwork
- `two-handed-mace.webp` — Overkill inventory artwork
- `two-handed-sword.webp` — The Grandfather inventory artwork
- `one-handed-sword.webp` — Doombringer inventory artwork

These images represent the matching equipment type. They are not intended to
imply that an imprinted Legendary Aspect has a unique, fixed appearance.

Talisman artwork retrieved 2026-09-17 from the D4Guides.gg Diablo IV database:

- `legendary-horadric-seal.webp` — Legendary Horadric Seal
- `sescherons-fury.webp` — Berú of Sescheron's Fury, representing the five-piece set
- `emblem-of-staalbreak.webp` — Emblem of Staalbreak unique charm

Source paths: `https://d4guides.gg/assets/img/talismans/`.
