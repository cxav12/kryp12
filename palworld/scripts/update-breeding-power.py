"""Add current Paldeck breeding-power values to the local Pal datasets."""

import html
import json
import re
from datetime import date
from pathlib import Path
from urllib.request import Request, urlopen


PALWORLD_DIR = Path(__file__).resolve().parents[1]
SOURCE_URL = "https://api.paldeck.cc/breedinglist"
DATA_FILES = (
    PALWORLD_DIR / "data" / "pal-index.json",
    PALWORLD_DIR / "data" / "pal-cards.json",
    PALWORLD_DIR / "data" / "pals.json",
)
ROW_PATTERN = re.compile(
    r'<img[^>]+alt="([^"]+)"[^>]*>.*?</td>'
    r'<td[^>]*>(\d+)</td>',
    re.DOTALL,
)


def download_powers():
    request = Request(
        SOURCE_URL,
        headers={"User-Agent": "PalworldReferenceDataUpdater/1.0"},
    )
    with urlopen(request, timeout=30) as response:
        page = response.read().decode("utf-8")

    powers = {
        html.unescape(match.group(1)): int(match.group(2))
        for match in ROW_PATTERN.finditer(page)
    }
    if len(powers) < 200:
        raise RuntimeError(
            f"Expected at least 200 breeding-power rows, found {len(powers)}."
        )
    return powers


def add_power(pal, power):
    updated = {}
    inserted = False

    for key, value in pal.items():
        updated[key] = value
        if key == "rarity":
            updated["breedingPower"] = power
            inserted = True

    if not inserted:
        updated["breedingPower"] = power
    return updated


def update_file(path, powers):
    data = json.loads(path.read_text(encoding="utf-8"))
    missing_numbered_pals = [
        pal["name"]
        for pal in data["pals"]
        if pal.get("dexKey") and pal["name"] not in powers
    ]
    if missing_numbered_pals:
        raise RuntimeError(
            f"{path.name} is missing breeding power for: "
            + ", ".join(missing_numbered_pals)
        )

    data["pals"] = [
        add_power(pal, powers.get(pal["name"]))
        for pal in data["pals"]
    ]
    data["metadata"]["breedingPowerSource"] = {
        "name": "Paldeck",
        "url": SOURCE_URL,
        "updatedAt": date.today().isoformat(),
    }

    if path.name == "pals.json":
        serialized = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    else:
        serialized = json.dumps(
            data,
            ensure_ascii=False,
            separators=(",", ":"),
        )
    path.write_text(serialized, encoding="utf-8")


def main():
    powers = download_powers()
    for path in DATA_FILES:
        update_file(path, powers)
    print(
        f"Added {len(powers)} Paldeck breeding-power values to "
        f"{len(DATA_FILES)} datasets."
    )


if __name__ == "__main__":
    main()
