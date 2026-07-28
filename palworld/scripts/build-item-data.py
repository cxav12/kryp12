#!/usr/bin/env python3
"""Build the compact item-source index used by the Items page."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def categorize(name: str) -> str:
    lower = name.lower()

    if "staff" in lower:
        return "Weapons"
    if lower == "arrow":
        return "Ammo"
    if "key" in lower or lower in {
        "ancient civilization core",
        "thermal core",
    }:
        return "Key Items"
    if "manual" in lower or "pal soul" in lower:
        return "Enhancement Items"
    if any(term in lower for term in ("medicine", "meds", "supplies", "juice")):
        return "Other Consumables"
    if any(term in lower for term in ("ingot", "plasteel", "hexolite")):
        return "Ingots"
    if any(
        term in lower
        for term in (
            "ore",
            "quartz",
            "chromite",
            "coal",
            "sulfur",
            "soralite",
        )
    ):
        return "Ores"
    if any(
        term in lower
        for term in (
            "meat",
            "poultry",
            "venison",
            "pork",
            "mutton",
            "flesh",
            "sashimi",
            "cake",
            "cotton candy",
        )
    ):
        return "Food"
    if any(
        term in lower
        for term in (
            "seed",
            "egg",
            "milk",
            "honey",
            "berries",
            "carrot",
            "mushroom",
        )
    ):
        return "Ingredients"
    if lower == "hardwood":
        return "Wood"
    if any(
        term in lower
        for term in (
            "organ",
            "pal fluid",
            "pal oil",
            "paldium",
            "fragment",
            "bone",
            "horn",
            "leather",
            "hair",
            "feather",
            "plume",
            "tentacle",
            "leaf",
            "cloud",
            "gland",
            "ribbon",
        )
    ):
        return "Pal Materials"
    if any(
        term in lower
        for term in (
            "cloth",
            "fiber",
            "gunpowder",
            "carbon",
        )
    ):
        return "Production Goods"
    return "Other Materials"


def main() -> None:
    pal_data = json.loads((ROOT / "data" / "pals.json").read_text(encoding="utf-8"))
    ranch_data = json.loads(
        (ROOT / "data" / "ranch-products.json").read_text(encoding="utf-8")
    )
    items: dict[str, dict] = {}

    for pal in pal_data["pals"]:
        for drop in pal.get("drops", []):
            item = items.setdefault(
                drop["name"],
                {
                    "name": drop["name"],
                    "category": categorize(drop["name"]),
                    "wildSources": [],
                    "ranchSources": [],
                },
            )
            item["wildSources"].append(
                {
                    "pal": pal["name"],
                    "dexKey": pal["dexKey"],
                    "rate": drop.get("dropRate"),
                    "minimum": drop.get("min"),
                    "maximum": drop.get("max"),
                }
            )

    for ranch_pal in ranch_data["pals"]:
        pal = next(
            (entry for entry in pal_data["pals"] if entry["name"] == ranch_pal["name"]),
            None,
        )
        for product in ranch_pal["products"]:
            item = items.setdefault(
                product["name"],
                {
                    "name": product["name"],
                    "category": categorize(product["name"]),
                    "wildSources": [],
                    "ranchSources": [],
                },
            )
            item["ranchSources"].append(
                {
                    "pal": ranch_pal["name"],
                    "dexKey": pal["dexKey"] if pal else "",
                    "minimumLevel": product.get("minimumLevel"),
                    "quantity": product.get("quantity"),
                }
            )

    output = {
        "metadata": {
            "source": "Local Paldeck Pal drops and verified Ranch products",
            "generatedAt": "2026-07-27",
            "itemCount": len(items),
        },
        "items": sorted(items.values(), key=lambda item: item["name"].lower()),
    }
    (ROOT / "data" / "items.json").write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
