#!/usr/bin/env python3
"""Validate Civ VI leader image provenance and published paths."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

SITE = Path(__file__).resolve().parents[2]


def classify(entry, target: Path):
    if not entry or not target.is_file():
        return "missing-image"
    source = entry.get("source")
    status = entry.get("portraitStatus")
    if status == "genuine-portrait" and source in {"sdk-dds", "retail-civblp-ui-icons"}:
        return "genuine-portrait"
    if status == "emblem-fallback" or source == "retail-arx":
        return "emblem-fallback"
    return "missing-or-unverified"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site", type=Path, default=SITE)
    parser.add_argument(
        "--require-all-genuine",
        action="store_true",
        help="return nonzero unless every leader has a verified genuine portrait",
    )
    args = parser.parse_args()

    manifest_path = args.site / "assets/icons/manifest.json"
    leaders_path = args.site / "data/leaders.json"
    search_path = args.site / "data/search-index.json"

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    leaders = json.loads(leaders_path.read_text(encoding="utf-8"))["records"]
    search_records = {
        item["id"]: item
        for item in json.loads(search_path.read_text(encoding="utf-8"))["records"]
        if item.get("type") == "leader"
    }

    groups = {
        "genuine-portrait": [],
        "emblem-fallback": [],
        "missing-image": [],
        "missing-or-unverified": [],
    }
    publish_errors = []

    for leader in leaders:
        item_id = leader["id"]
        entry = manifest.get(item_id)
        target = args.site / "assets/icons/leader" / f"{item_id}.webp"
        status = classify(entry, target)
        groups[status].append(item_id)

        expected = entry.get("image") if entry else None
        if expected:
            if leader.get("image") != expected:
                publish_errors.append(
                    f"{item_id}: leaders.json image {leader.get('image')!r} != {expected!r}"
                )
            search = search_records.get(item_id)
            if not search:
                publish_errors.append(f"{item_id}: missing from search-index.json")
            elif search.get("image") != expected:
                publish_errors.append(
                    f"{item_id}: search-index.json image {search.get('image')!r} != {expected!r}"
                )

    result = {
        "leaderCount": len(leaders),
        "genuinePortraits": len(groups["genuine-portrait"]),
        "genuinePortraitIds": groups["genuine-portrait"],
        "emblemFallbacks": len(groups["emblem-fallback"]),
        "emblemFallbackIds": groups["emblem-fallback"],
        "missingImages": len(groups["missing-image"]) + len(groups["missing-or-unverified"]),
        "missingImageIds": groups["missing-image"] + groups["missing-or-unverified"],
        "publishErrors": publish_errors,
    }
    print(json.dumps(result, indent=2))

    if publish_errors:
        return 2
    if args.require_all_genuine and (
        result["emblemFallbacks"] or result["missingImages"]
    ):
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
