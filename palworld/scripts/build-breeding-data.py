"""Convert the current breeding-combination CSV into compact site JSON."""

import csv
import json
import sys
from datetime import date
from pathlib import Path


PALWORLD_DIR = Path(__file__).resolve().parents[1]
OUTPUT_FILE = PALWORLD_DIR / "data" / "breeding.json"
GENDER_CODES = {"WILDCARD": 0, "MALE": 1, "FEMALE": 2}


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Usage: build-breeding-data.py path/to/breeding_combos.csv")

    source_file = Path(sys.argv[1])
    names = set()
    raw_rows = []

    with source_file.open(encoding="utf-8-sig", newline="") as source:
        for row in csv.DictReader(source):
            names.update(
                (
                    row["child_name"],
                    row["parent_a_name"],
                    row["parent_b_name"],
                )
            )
            raw_rows.append(row)

    pal_names = sorted(names, key=str.casefold)
    name_to_index = {name: index for index, name in enumerate(pal_names)}
    combinations = [
        [
            name_to_index[row["parent_a_name"]],
            name_to_index[row["parent_b_name"]],
            name_to_index[row["child_name"]],
            GENDER_CODES.get(row["parent_a_gender"], 0),
            GENDER_CODES.get(row["parent_b_gender"], 0),
        ]
        for row in raw_rows
    ]

    output = {
        "metadata": {
            "source": (
                "https://huggingface.co/datasets/"
                "zhugetd/Palworld_Breeding_Reference"
            ),
            "sourceExportedAt": "2026-07-16",
            "generatedAt": date.today().isoformat(),
            "palCount": len(pal_names),
            "combinationCount": len(combinations),
            "genderCodes": {
                "0": "Any",
                "1": "Male",
                "2": "Female",
            },
        },
        "pals": pal_names,
        "combinations": combinations,
    }
    OUTPUT_FILE.write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(
        f"Built {OUTPUT_FILE.name}: {len(pal_names)} Pals, "
        f"{len(combinations)} combinations."
    )


if __name__ == "__main__":
    main()
