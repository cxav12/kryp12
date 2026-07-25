"""Build Pal portrait and UI-icon sprite sheets for pals.json."""

import json
import math
from pathlib import Path

from PIL import Image


PALWORLD_DIR = Path(__file__).resolve().parents[1]
DATA_FILE = PALWORLD_DIR / "data" / "pals.json"
SPRITE_FILE = PALWORLD_DIR / "assets" / "paldeck" / "pal-portraits.webp"
ICON_SPRITE_FILE = PALWORLD_DIR / "assets" / "paldeck" / "pal-icons.webp"
CELL_SIZE = 96
COLUMNS = 18
ICON_CELL_SIZE = 48
ICON_COLUMNS = 7


def build_sheet(paths, output_file, cell_size, columns, quality=90):
    rows = math.ceil(len(paths) / columns)
    sheet = Image.new("RGBA", (columns * cell_size, rows * cell_size))
    coordinates = {}

    for index, relative_path in enumerate(paths):
        source = PALWORLD_DIR / relative_path.removeprefix("./")
        with Image.open(source) as source_image:
            source_image = source_image.convert("RGBA")
            source_image.thumbnail(
                (cell_size, cell_size),
                Image.Resampling.LANCZOS,
            )
            x = (index % columns) * cell_size
            y = (index // columns) * cell_size
            offset_x = x + (cell_size - source_image.width) // 2
            offset_y = y + (cell_size - source_image.height) // 2
            sheet.alpha_composite(source_image, (offset_x, offset_y))
            coordinates[relative_path] = {"x": x, "y": y}

    output_file.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output_file, "WEBP", quality=quality, method=6)
    return coordinates, rows


def main():
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    image_paths = sorted(
        {
            pal["image"].removeprefix("./")
            for pal in data["pals"]
            if pal.get("image")
        }
    )
    coordinates, rows = build_sheet(
        image_paths,
        SPRITE_FILE,
        CELL_SIZE,
        COLUMNS,
    )

    for pal in data["pals"]:
        relative_path = pal.get("image", "").removeprefix("./")
        if relative_path in coordinates:
            pal["sprite"] = coordinates[relative_path]

    data["metadata"]["palSprite"] = {
        "image": "./assets/paldeck/pal-portraits.webp",
        "cellSize": CELL_SIZE,
        "columns": COLUMNS,
        "rows": rows,
    }

    icon_paths = sorted(
        {
            item["icon"]
            for pal in data["pals"]
            for item in (*pal["elements"], *pal["workSuitability"])
            if item.get("icon")
        }
    )
    icon_coordinates, icon_rows = build_sheet(
        icon_paths,
        ICON_SPRITE_FILE,
        ICON_CELL_SIZE,
        ICON_COLUMNS,
        quality=95,
    )
    data["metadata"]["palIconSprite"] = {
        "image": "./assets/paldeck/pal-icons.webp",
        "cellSize": ICON_CELL_SIZE,
        "columns": ICON_COLUMNS,
        "rows": icon_rows,
        "icons": icon_coordinates,
    }
    DATA_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(
        f"Built {SPRITE_FILE.name}: {len(image_paths)} portraits, "
        f"{COLUMNS}x{rows} cells."
    )
    print(
        f"Built {ICON_SPRITE_FILE.name}: {len(icon_paths)} icons, "
        f"{ICON_COLUMNS}x{icon_rows} cells."
    )


if __name__ == "__main__":
    main()
