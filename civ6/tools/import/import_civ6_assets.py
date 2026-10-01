#!/usr/bin/env python3
"""Extract Civ VI icons from SDK DDS atlases and retail CIVBLP UI archives."""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image

from civ6_blp_ui import Civ6UIBlp

SITE = Path(__file__).resolve().parents[2]
DEFAULT_GAME = Path(r"C:\Program Files (x86)\Steam\steamapps\common\Sid Meier's Civilization VI")
DEFAULT_SDK = Path(r"C:\Program Files (x86)\Steam\steamapps\common\Sid Meier's Civilization VI SDK Assets")

ICON_PREFIX = {
    "civilization": "ICON_CIVILIZATION_", "leader": "ICON_LEADER_", "technology": "ICON_TECH_",
    "civic": "ICON_CIVIC_", "policy": "ICON_POLICY_", "resource": "ICON_RESOURCE_",
    "district": "ICON_DISTRICT_", "building": "ICON_BUILDING_", "wonder": "ICON_BUILDING_",
    "improvement": "ICON_IMPROVEMENT_", "unit": "ICON_UNIT_", "government": "ICON_GOVERNMENT_",
}
TYPE_LABELS = {
    "civilization": "Civilization", "leader": "Leader", "technology": "Technology", "civic": "Civic",
    "policy": "Policy", "resource": "Resource", "district": "District", "building": "Building",
    "wonder": "Wonder", "improvement": "Improvement", "unit": "Unit", "government": "Government",
}
ID_PREFIX = {
    "civilization": "civilization_", "leader": "leader_", "technology": "tech_", "civic": "civic_",
    "policy": "policy_", "resource": "resource_", "district": "district_", "building": "building_",
    "wonder": "wonder_", "improvement": "improvement_", "unit": "unit_", "government": "government_",
}

# Several DLC civilization atlases are packaged inside the retail game's BLP
# archives and are not duplicated in the SDK Assets install. Firaxis ships a
# small official ARX emblem for each of those civilizations, so use it instead
# of falling back to generated initials.
CIVILIZATION_ARX_FALLBACKS = {
    "civilization_australia": "Australia/Data/ARX/Civ_LEADER_JOHN_CURTIN.png",
    "civilization_babylon_stk": "Babylon/Data/ARX/Civ_LEADER_HAMMURABI.png",
    "civilization_byzantium": "Byzantium_Gaul/Data/ARX/Civ_LEADER_BASIL.png",
    "civilization_ethiopia": "Ethiopia/Data/ARX/Civ_LEADER_MENELIK.png",
    "civilization_gaul": "Byzantium_Gaul/Data/ARX/Civ_LEADER_AMBIORIX.png",
    "civilization_gran_colombia": "GranColombia_Maya/Data/ARX/Civ_LEADER_SIMON_BOLIVAR.png",
    "civilization_indonesia": "Indonesia_Khmer/Data/ARX/Civ_LEADER_GITARJA.png",
    "civilization_khmer": "Indonesia_Khmer/Data/ARX/Civ_LEADER_JAYAVARMAN.png",
    "civilization_macedon": "Macedonia_Persia/Data/ARX/Civ_LEADER_ALEXANDER.png",
    "civilization_maya": "GranColombia_Maya/Data/ARX/Civ_LEADER_LADY_SIX_SKY.png",
    "civilization_nubia": "Nubia_Amanitore/Data/ARX/Civ_LEADER_AMANITORE.png",
    "civilization_persia": "Macedonia_Persia/Data/ARX/Civ_LEADER_CYRUS.png",
    "civilization_portugal": "Portugal/Data/ARX/Civ_LEADER_JOAO_III.png",
    "civilization_vietnam": "KublaiKhan_Vietnam/Data/ARX/Civ_LEADER_LADY_TRIEU.png",
}

# Accurate category/replacement symbols for DLC textures that only exist in
# cooked retail BLP packages. These are all official icons shipped with Civ VI.
OFFICIAL_ICON_FALLBACKS = {
    "district_preserve": "ICON_IMPROVEMENT_CITY_PARK",
    "building_alchemical_society": "ICON_BUILDING_UNIVERSITY",
    "building_basilikoi_paides": "ICON_BUILDING_BARRACKS",
    "building_chancery": "ICON_DISTRICT_GOVERNMENT",
    "building_consulate": "ICON_DISTRICT_GOVERNMENT",
    "building_gilded_vault": "ICON_BUILDING_BANK",
    "building_grove": "ICON_IMPROVEMENT_CITY_PARK",
    "building_large_rocket": "ICON_DISTRICT_SPACEPORT",
    "building_medium_rocket": "ICON_DISTRICT_SPACEPORT",
    "building_navigation_school": "ICON_BUILDING_UNIVERSITY",
    "building_old_god_obelisk": "ICON_BUILDING_MONUMENT",
    "building_palgum": "ICON_BUILDING_WATER_MILL",
    "building_prasat": "ICON_BUILDING_TEMPLE",
    "building_sanctuary": "ICON_IMPROVEMENT_CITY_PARK",
    "building_small_rocket": "ICON_DISTRICT_SPACEPORT",
    "wonder_angkor_wat": "ICON_DISTRICT_WONDER",
    "wonder_apadana": "ICON_DISTRICT_WONDER",
    "wonder_biosphere": "ICON_DISTRICT_WONDER",
    "wonder_etemenanki": "ICON_DISTRICT_WONDER",
    "wonder_halicarnassus_mausoleum": "ICON_DISTRICT_WONDER",
    "wonder_jebel_barkal": "ICON_DISTRICT_WONDER",
    "wonder_statue_of_zeus": "ICON_DISTRICT_WONDER",
    "wonder_torre_de_belem": "ICON_DISTRICT_WONDER",
}


def icon_xml_files(game: Path):
    yield from (game / "Base/Assets/UI/Icons").glob("*.xml")
    for path in (game / "DLC").rglob("*.xml"):
        if "icon" in path.name.lower():
            yield path


def read_icon_database(game: Path):
    atlases = defaultdict(list)
    definitions = {}
    definition_candidates = defaultdict(list)
    aliases = []
    parsed = 0
    for path in icon_xml_files(game):
        try:
            root = ET.parse(path).getroot()
        except ET.ParseError:
            continue
        parsed += 1
        for row in root.findall(".//IconTextureAtlases/Row"):
            data = row.attrib
            if data.get("Name") and data.get("Filename") and data.get("IconSize"):
                atlases[data["Name"]].append({"size": int(data["IconSize"]), "columns": int(data.get("IconsPerRow", "1")), "filename": data["Filename"], "xml": str(path)})
        for row in root.findall(".//IconDefinitions/Row"):
            data = row.attrib
            if data.get("Name") and data.get("Atlas") and data.get("Index"):
                candidate = {"atlas": data["Atlas"], "index": int(data["Index"]), "xml": str(path)}
                definition_candidates[data["Name"]].append(candidate)
                # Preserve the historical primary definition, but keep every
                # duplicate so we can try an alternate when its atlas is the
                # one actually available as a loose SDK DDS.
                definitions.setdefault(data["Name"], candidate)
        for row in root.findall(".//IconAliases/Row"):
            data = row.attrib
            if data.get("Name") and data.get("OtherName"):
                aliases.append((data["Name"], data["OtherName"]))
    # Some official definitions are aliases rather than atlas/index rows.
    # Resolve them only after every source XML file has been read.
    for _ in range(3):
        for name, other_name in aliases:
            if name not in definitions and other_name in definitions:
                definitions[name] = definitions[other_name]
            if not definition_candidates.get(name) and definition_candidates.get(other_name):
                definition_candidates[name].extend(definition_candidates[other_name])
    return atlases, definitions, definition_candidates, parsed


def build_dds_index(sdk: Path):
    result = defaultdict(list)
    for path in sdk.rglob("*.dds"):
        result[path.name.casefold()].append(path)
    return result


def build_leader_arx_index(game: Path):
    """Index official retail Data/ARX Civ_LEADER_*.png files by exact filename."""
    result = defaultdict(list)
    for root in (game / "Base", game / "DLC"):
        if not root.is_dir():
            continue
        for path in root.rglob("*"):
            if not path.is_file() or path.suffix.casefold() != ".png":
                continue
            if path.parent.name.casefold() != "arx":
                continue
            if not path.name.casefold().startswith("civ_leader_"):
                continue
            result[path.name.casefold()].append(path)
    return result


def leader_arx_filename(item_id: str):
    stem = item_id.removeprefix("leader_").upper()
    return f"Civ_LEADER_{stem}.png"


def select_leader_arx(item_id: str, arx_files):
    """Select the exact ARX image for a leader, preferring normal DLC over scenarios."""
    matches = arx_files.get(leader_arx_filename(item_id).casefold(), [])
    if not matches:
        return None

    def score(path: Path):
        parts = [part.casefold() for part in path.parts]
        scenario = any("scenario" in part for part in parts)
        # Exact-name matches are already guaranteed. Prefer non-scenario content,
        # then the shorter/canonical path when multiple official copies exist.
        return (scenario, len(parts), str(path).casefold())

    return sorted(matches, key=score)[0]



def icons_blp_for_xml(xml_path: Path, game: Path):
    """Return the retail UI/Icons.blp paired with an official icon XML file."""
    try:
        rel = xml_path.relative_to(game)
    except ValueError:
        return None
    parts = rel.parts
    if not parts:
        return None
    if parts[0].casefold() == "base":
        return game / "Base" / "Platforms" / "Windows" / "BLPs" / "UI" / "Icons.blp"
    if len(parts) >= 2 and parts[0].casefold() == "dlc":
        return game / "DLC" / parts[1] / "Platforms" / "Windows" / "BLPs" / "UI" / "Icons.blp"
    return None


def file_contains_ascii(path: Path, text: str):
    """Read-only check that a serialized texture name is present in a BLP."""
    if not path or not path.is_file():
        return False
    needle = text.encode("utf-8")
    overlap = b""
    keep = max(0, len(needle) - 1)
    with path.open("rb") as fh:
        while True:
            chunk = fh.read(4 * 1024 * 1024)
            if not chunk:
                return False
            data = overlap + chunk
            if needle in data:
                return True
            overlap = data[-keep:] if keep else b""


def select_retail_leader_portrait(requested, definition_candidates, atlases, game: Path):
    """
    Locate the largest normal-game official leader portrait texture in the
    retail DLC's UI/Icons.blp. Scenario definitions are deprioritized.
    """
    candidates = []
    for definition_order, definition in enumerate(definition_candidates.get(requested, [])):
        atlas_name = definition["atlas"]
        for option_order, option in enumerate(
            sorted(atlases.get(atlas_name, []), key=lambda item: item["size"], reverse=True)
        ):
            xml_path = Path(option.get("xml") or definition.get("xml") or "")
            archive = icons_blp_for_xml(xml_path, game) if xml_path else None
            if not archive or not archive.is_file():
                continue
            asset_name = Path(option["filename"]).stem
            if not file_contains_ascii(archive, asset_name):
                continue
            scenario = "scenario" in str(xml_path).casefold()
            candidates.append({
                "requested": requested,
                "atlas": atlas_name,
                "index": definition["index"],
                "size": option["size"],
                "columns": option["columns"],
                "filename": option["filename"],
                "assetName": asset_name,
                "archive": archive,
                "definitionXml": definition.get("xml"),
                "atlasXml": option.get("xml"),
                "_rank": (scenario, -option["size"], definition_order, option_order),
            })
    if not candidates:
        return None
    candidates.sort(key=lambda item: item["_rank"])
    result = candidates[0]
    result.pop("_rank", None)
    return result


def save_retail_leader_portrait(source, target: Path, blp_cache):
    """Decode/crop one official leader portrait from a retail Civ VI UI BLP."""
    archive = Path(source["archive"])
    cache_key = str(archive)
    if cache_key not in blp_cache:
        blp_cache[cache_key] = Civ6UIBlp(archive, source["assetName"])
    atlas_image, diagnostics = blp_cache[cache_key].decode_rgba_texture(source["assetName"])

    size = source["size"]
    index = source["index"]
    columns = source["columns"]
    left = (index % columns) * size
    top = (index // columns) * size
    right = left + size
    bottom = top + size
    if right > atlas_image.width or bottom > atlas_image.height:
        raise ValueError(
            f"official crop ({left},{top},{right},{bottom}) exceeds decoded "
            f"atlas {atlas_image.width}x{atlas_image.height}"
        )

    icon = atlas_image.crop((left, top, right, bottom)).convert("RGBA")
    target.parent.mkdir(parents=True, exist_ok=True)
    alpha_min, alpha_max = icon.getchannel("A").getextrema()
    icon.save(target, "WEBP", lossless=True, method=6)
    return {
        "width": icon.width,
        "height": icon.height,
        "hasTransparency": alpha_min < 255,
        "alphaRange": [alpha_min, alpha_max],
        "decodedAtlasWidth": atlas_image.width,
        "decodedAtlasHeight": atlas_image.height,
        "blpDiagnostics": diagnostics,
    }


def save_lossless_webp(source_path: Path, target: Path):
    """Convert an official source image to lossless RGBA WebP, preserving alpha."""
    target.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(source_path) as source:
        image = source.convert("RGBA")
        width, height = image.size
        alpha_min, alpha_max = image.getchannel("A").getextrema()
        image.save(target, "WEBP", lossless=True, method=4)
    return {
        "width": width,
        "height": height,
        "hasTransparency": alpha_min < 255,
        "alphaRange": [alpha_min, alpha_max],
    }


def game_relative(path: Path, game: Path):
    try:
        return path.relative_to(game).as_posix()
    except ValueError:
        return str(path)


def verify_published_leaders(site: Path, catalog, leader_ids, manifest, output: Path):
    """Verify leader image paths were published to leaders JSON and search index."""
    errors = []
    if not leader_ids:
        return errors

    leader_collection = next((item for item in catalog["collections"] if item["type"] == "leader"), None)
    if not leader_collection:
        return ["catalog has no leader collection"]

    leader_path = site / "data" / leader_collection["file"]
    leader_payload = json.loads(leader_path.read_text(encoding="utf-8"))
    leader_records = {item["id"]: item for item in leader_payload["records"]}

    search_path = site / "data/search-index.json"
    search_payload = json.loads(search_path.read_text(encoding="utf-8"))
    search_records = {item["id"]: item for item in search_payload["records"]}

    for item_id in sorted(leader_ids):
        if item_id not in manifest:
            errors.append(f"{item_id}: missing from manifest")
            continue
        expected = manifest[item_id]["image"]
        leader_record = leader_records.get(item_id)
        search_record = search_records.get(item_id)
        target = output / "leader" / f"{item_id}.webp"

        if leader_record is None:
            errors.append(f"{item_id}: missing from {leader_path.name}")
        elif leader_record.get("image") != expected:
            errors.append(
                f"{item_id}: {leader_path.name} image is {leader_record.get('image')!r}, "
                f"expected {expected!r}"
            )

        if search_record is None:
            errors.append(f"{item_id}: missing from search-index.json")
        elif search_record.get("image") != expected:
            errors.append(
                f"{item_id}: search-index.json image is {search_record.get('image')!r}, "
                f"expected {expected!r}"
            )

        if not target.is_file():
            errors.append(f"{item_id}: output file missing: {target}")

    return errors


def classify_leader_portraits(leader_ids, manifest, output: Path):
    """
    Distinguish genuine portraits from ARX emblem fallbacks and missing images.
    retail-arx is explicitly NOT a genuine portrait source.
    """
    genuine, emblems, missing = [], [], []
    details = {}
    for item_id in sorted(leader_ids):
        entry = manifest.get(item_id)
        target = output / "leader" / f"{item_id}.webp"
        if not entry or not target.is_file():
            missing.append(item_id)
            details[item_id] = "missing-image"
            continue

        status = entry.get("portraitStatus")
        source = entry.get("source")
        if status == "genuine-portrait" and source in {"sdk-dds", "retail-civblp-ui-icons"}:
            genuine.append(item_id)
            details[item_id] = "genuine-portrait"
        elif status == "emblem-fallback" or source == "retail-arx":
            emblems.append(item_id)
            details[item_id] = "emblem-fallback"
        else:
            # Unknown leader image provenance is not silently promoted to genuine.
            missing.append(item_id)
            details[item_id] = "missing-or-unverified"

    return {
        "genuinePortraits": len(genuine),
        "genuinePortraitIds": genuine,
        "emblemFallbacks": len(emblems),
        "emblemFallbackIds": emblems,
        "missingImages": len(missing),
        "missingImageIds": missing,
        "statusByLeader": details,
    }


def icon_name(kind: str, item_id: str):
    return ICON_PREFIX[kind] + item_id.removeprefix(ID_PREFIX[kind]).upper()


def select_atlas(options, files):
    for option in sorted(options, key=lambda item: item["size"], reverse=True):
        filename = option["filename"]
        candidates = [filename, filename + ".dds"] if not Path(filename).suffix else [filename]
        matches = next((files.get(candidate.casefold(), []) for candidate in candidates if files.get(candidate.casefold())), [])
        if matches:
            return option, matches[0]
    return None, None


def select_alternate_definition(requested, current_definition, definition_candidates, atlases, files):
    """Try duplicate official icon definitions when the first definition's atlas is unavailable."""
    for candidate in definition_candidates.get(requested, []):
        if candidate == current_definition:
            continue
        option, path = select_atlas(atlases.get(candidate["atlas"], []), files)
        if option:
            return candidate, option, path
    return None, None, None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--game", type=Path, default=DEFAULT_GAME)
    parser.add_argument("--sdk-assets", type=Path, default=DEFAULT_SDK)
    parser.add_argument("--output", type=Path, default=SITE / "assets/icons")
    parser.add_argument("--publish", action="store_true", help="add generated image paths to site JSON")
    parser.add_argument("--require-genuine-leader-portraits", action="store_true", help="fail if any leader still uses an ARX emblem fallback or has no verified portrait")
    args = parser.parse_args()
    if not args.game.is_dir():
        parser.error(f"Game not found: {args.game}")
    if not args.sdk_assets.is_dir():
        parser.error(f"SDK Assets not found: {args.sdk_assets}\nInstall Steam tool 597260, then rerun this command.")

    atlases, definitions, definition_candidates, xml_count = read_icon_database(args.game)
    files = build_dds_index(args.sdk_assets)
    leader_arx_files = build_leader_arx_index(args.game)
    catalog = json.loads((SITE / "data/catalog.json").read_text(encoding="utf-8"))
    manifest, missing = {}, []
    leader_arx_used = set()
    leader_portrait_blp_used = set()
    leader_portrait_errors = []
    alternate_definition_used = set()
    blp_cache = {}
    for collection in catalog["collections"]:
        kind = collection["type"]
        payload = json.loads((SITE / "data" / collection["file"]).read_text(encoding="utf-8"))
        atlas_cache = {}
        for item in payload["records"]:
            requested = icon_name(kind, item["id"])
            definition = definitions.get(requested)
            if not definition and kind == "policy" and item.get("type"):
                requested = "ICON_POLICY_" + item["type"].upper().replace(" ", "_")
                definition = definitions.get(requested)
            if not definition and kind == "leader" and item["id"] == "leader_free_cities":
                requested = "ICON_LEADER_DEFAULT"
                definition = definitions.get(requested)
            if not definition and kind == "district" and item.get("gameData", {}).get("replaces"):
                requested = icon_name("district", item["gameData"]["replaces"])
                definition = definitions.get(requested)
            if not definition and item["id"] in OFFICIAL_ICON_FALLBACKS:
                requested = OFFICIAL_ICON_FALLBACKS[item["id"]]
                definition = definitions.get(requested)
            if not definition:
                missing.append({"id": item["id"], "reason": f"missing definition {requested}"})
                continue
            option, dds_path = select_atlas(atlases.get(definition["atlas"], []), files)
            if not option:
                alternate_definition, alternate_option, alternate_path = select_alternate_definition(
                    requested, definition, definition_candidates, atlases, files
                )
                if alternate_option:
                    definition, option, dds_path = alternate_definition, alternate_option, alternate_path
                    alternate_definition_used.add(item["id"])
            if not option and item["id"] in OFFICIAL_ICON_FALLBACKS:
                fallback_name = OFFICIAL_ICON_FALLBACKS[item["id"]]
                fallback_definition = definitions.get(fallback_name)
                if fallback_definition:
                    fallback_option, fallback_path = select_atlas(atlases.get(fallback_definition["atlas"], []), files)
                    if fallback_option:
                        requested, definition, option, dds_path = fallback_name, fallback_definition, fallback_option, fallback_path
            if not option and kind == "policy" and item.get("type"):
                fallback_name = "ICON_POLICY_" + item["type"].upper().replace(" ", "_")
                fallback_definition = definitions.get(fallback_name)
                if fallback_definition:
                    fallback_option, fallback_path = select_atlas(atlases.get(fallback_definition["atlas"], []), files)
                    if fallback_option:
                        requested, definition, option, dds_path = fallback_name, fallback_definition, fallback_option, fallback_path
            if not option and kind == "district":
                fallback_names = []
                replacement = item.get("gameData", {}).get("replaces")
                if replacement:
                    fallback_names.append(icon_name("district", replacement))
                if item["id"] == "district_diplomatic_quarter":
                    fallback_names.append("ICON_DISTRICT_GOVERNMENT")
                for fallback_name in fallback_names:
                    fallback_definition = definitions.get(fallback_name)
                    if not fallback_definition:
                        continue
                    fallback_option, fallback_path = select_atlas(atlases.get(fallback_definition["atlas"], []), files)
                    if fallback_option:
                        requested, definition, option, dds_path = fallback_name, fallback_definition, fallback_option, fallback_path
                        break
            if not option:
                # First choice for missing leader DDS atlases: decode the official
                # retail UI/Icons.blp texture using the same XML atlas/index data.
                if kind == "leader":
                    portrait_source = select_retail_leader_portrait(
                        requested, definition_candidates, atlases, args.game
                    )
                    if portrait_source:
                        relative = Path(kind) / f"{item['id']}.webp"
                        target = args.output / relative
                        try:
                            image_info = save_retail_leader_portrait(
                                portrait_source, target, blp_cache
                            )
                        except Exception as exc:
                            leader_portrait_errors.append(
                                {
                                    "id": item["id"],
                                    "atlas": portrait_source["atlas"],
                                    "texture": portrait_source["assetName"],
                                    "sourcePath": game_relative(
                                        Path(portrait_source["archive"]), args.game
                                    ),
                                    "error": f"{type(exc).__name__}: {exc}",
                                }
                            )
                        else:
                            manifest[item["id"]] = {
                                "image": "/civ6/assets/icons/" + relative.as_posix(),
                                "icon": requested,
                                "atlas": portrait_source["atlas"],
                                "atlasTexture": portrait_source["filename"],
                                "index": portrait_source["index"],
                                "source": "retail-civblp-ui-icons",
                                "sourcePath": game_relative(
                                    Path(portrait_source["archive"]), args.game
                                ),
                                "sourceTexture": portrait_source["assetName"],
                                "portraitStatus": "genuine-portrait",
                                **image_info,
                            }
                            leader_portrait_blp_used.add(item["id"])
                            continue

                arx_path = None
                source_type = None

                # Explicit LAST-RESORT fallback. These small Data/ARX images are
                # player/emblem symbols, not ruler portraits, and validation must
                # never count them as genuine portraits.
                if kind == "leader":
                    arx_path = select_leader_arx(item["id"], leader_arx_files)
                    source_type = "retail-arx" if arx_path else None

                # Preserve the existing civilization fallback behavior.
                if not arx_path:
                    arx_relative = CIVILIZATION_ARX_FALLBACKS.get(item["id"])
                    arx_path = args.game / "DLC" / arx_relative if arx_relative else None
                    if arx_path and arx_path.is_file():
                        source_type = "retail-arx-civilization"
                    else:
                        arx_path = None

                if arx_path:
                    relative = Path(kind) / f"{item['id']}.webp"
                    target = args.output / relative
                    try:
                        image_info = save_lossless_webp(arx_path, target)
                    except Exception as exc:
                        missing.append({"id": item["id"], "reason": f"{arx_path.name}: {exc}"})
                        continue
                    manifest[item["id"]] = {
                        "image": "/civ6/assets/icons/" + relative.as_posix(),
                        "icon": requested,
                        "atlas": definition["atlas"],
                        "atlasTexture": arx_path.name,
                        "index": definition["index"],
                        "source": source_type,
                        "sourcePath": game_relative(arx_path, args.game),
                        **image_info,
                        **(
                            {"portraitStatus": "emblem-fallback"}
                            if kind == "leader" and source_type == "retail-arx"
                            else {}
                        ),
                    }
                    if kind == "leader" and source_type == "retail-arx":
                        leader_arx_used.add(item["id"])
                    continue

                missing.append({"id": item["id"], "reason": f"missing DDS/BLP atlas {definition['atlas']}"})
                continue
            index, size = definition["index"], option["size"]
            left, top = (index % option["columns"]) * size, (index // option["columns"]) * size
            try:
                cache_key = str(dds_path)
                if cache_key not in atlas_cache:
                    with Image.open(dds_path) as source:
                        atlas_cache[cache_key] = source.convert("RGBA")
                icon = atlas_cache[cache_key].crop((left, top, left + size, top + size))
                relative = Path(kind) / f"{item['id']}.webp"
                target = args.output / relative
                target.parent.mkdir(parents=True, exist_ok=True)
                width, height = icon.size
                alpha_min, alpha_max = icon.getchannel("A").getextrema()
                icon.save(target, "WEBP", lossless=True, method=4)
            except Exception as exc:
                missing.append({"id": item["id"], "reason": f"{dds_path.name}: {exc}"})
                continue
            manifest[item["id"]] = {
                "image": "/civ6/assets/icons/" + relative.as_posix(),
                "icon": requested,
                "atlas": definition["atlas"],
                "atlasTexture": option["filename"],
                "index": index,
                "source": "sdk-dds",
                "sourcePath": str(dds_path),
                "width": width,
                "height": height,
                "hasTransparency": alpha_min < 255,
                "alphaRange": [alpha_min, alpha_max],
                **({"portraitStatus": "genuine-portrait"} if kind == "leader" else {}),
            }
        for atlas in atlas_cache.values():
            atlas.close()

    args.output.mkdir(parents=True, exist_ok=True)
    leader_collection = next(
        (item for item in catalog["collections"] if item["type"] == "leader"), None
    )
    leader_ids = []
    if leader_collection:
        leader_payload = json.loads(
            (SITE / "data" / leader_collection["file"]).read_text(encoding="utf-8")
        )
        leader_ids = [item["id"] for item in leader_payload["records"]]
    leader_portrait_validation = classify_leader_portraits(
        leader_ids, manifest, args.output
    )

    report = {
        "iconXmlFiles": xml_count,
        "ddsFiles": sum(map(len, files.values())),
        "leaderArxFiles": sum(map(len, leader_arx_files.values())),
        "generated": len(manifest),
        "leaderPortraitBlpExtractions": len(leader_portrait_blp_used),
        "leaderPortraitBlpIds": sorted(leader_portrait_blp_used),
        "leaderPortraitExtractionErrors": leader_portrait_errors,
        "leaderArxFallbacks": len(leader_arx_used),
        "leaderArxFallbackIds": sorted(leader_arx_used),
        "leaderPortraitValidation": leader_portrait_validation,
        "alternateDefinitionFallbacks": len(alternate_definition_used),
        "alternateDefinitionFallbackIds": sorted(alternate_definition_used),
        "missingCount": len(missing),
        "missing": missing,
    }
    (args.output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    publish_errors = []
    if args.publish:
        for collection in catalog["collections"]:
            path = SITE / "data" / collection["file"]
            payload = json.loads(path.read_text(encoding="utf-8"))
            for item in payload["records"]:
                item.pop("image", None)
                if item["id"] in manifest:
                    item["image"] = manifest[item["id"]]["image"]
            path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        path = SITE / "data/search-index.json"
        payload = json.loads(path.read_text(encoding="utf-8"))
        for item in payload["records"]:
            item["typeLabel"] = TYPE_LABELS[item["type"]]
            if item.get("summary") in {"Policie reference", "Technologie reference"}:
                item["summary"] = f'{TYPE_LABELS[item["type"]]} reference'
            item.pop("image", None)
            if item["id"] in manifest:
                item["image"] = manifest[item["id"]]["image"]
        path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

        publish_errors = verify_published_leaders(
            SITE, catalog, leader_ids, manifest, args.output
        )
        report["publishVerifiedLeaderImages"] = len(leader_ids) if not publish_errors else 0
        report["publishVerificationErrors"] = publish_errors

    (args.output / "report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "missing"}, indent=2))
    if publish_errors:
        return 3
    if args.require_genuine_leader_portraits:
        validation = report["leaderPortraitValidation"]
        if validation["emblemFallbacks"] or validation["missingImages"]:
            return 4
    return 0 if manifest else 2


if __name__ == "__main__":
    raise SystemExit(main())
