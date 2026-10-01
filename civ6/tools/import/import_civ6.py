#!/usr/bin/env python3
"""Import installed Civilization VI XML data into the companion-site schema.

The game installation is always read-only. By default output is written to
``civ6/tools/import/output``; pass ``--publish`` to replace ``civ6/data`` only
after a successful import and validation.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_GAME = Path(r"C:\Program Files (x86)\Steam\steamapps\common\Sid Meier's Civilization VI")
STAGING = Path(__file__).resolve().parent / "output"

CATALOG = [
    ("civilization", "Civilizations", "civilizations.json", "civilizations"),
    ("leader", "Leaders", "leaders.json", "civilizations"),
    ("technology", "Technologies", "technologies.json", "tech"),
    ("civic", "Civics", "civics.json", "civics"),
    ("policy", "Policies", "policies.json", "policies"),
    ("resource", "Resources", "resources.json", "resources"),
    ("district", "Districts", "districts.json", "districts"),
    ("building", "Buildings", "buildings.json", "buildings"),
    ("wonder", "Wonders", "wonders.json", "wonders"),
    ("improvement", "Improvements", "improvements.json", "resources"),
    ("unit", "Units", "units.json", "civilizations"),
    ("government", "Governments", "governments.json", "civics"),
]

SINGULAR_LABELS = {
    "civilization": "Civilization", "leader": "Leader", "technology": "Technology", "civic": "Civic",
    "policy": "Policy", "resource": "Resource", "district": "District", "building": "Building",
    "wonder": "Wonder", "improvement": "Improvement", "unit": "Unit", "government": "Government",
}

TABLE_KEYS = {
    "Technologies": ("TechnologyType",), "TechnologyPrereqs": ("Technology", "PrereqTech"),
    "Boosts": ("TechnologyType",), "Civics": ("CivicType",), "CivicPrereqs": ("Civic", "PrereqCivic"),
    "Policies": ("PolicyType",), "ObsoletePolicies": ("PolicyType", "ObsoletePolicy"),
    "Resources": ("ResourceType",), "Resource_YieldChanges": ("ResourceType", "YieldType"),
    "Resource_ValidTerrains": ("ResourceType", "TerrainType"), "Resource_ValidFeatures": ("ResourceType", "FeatureType"),
    "Improvement_ValidResources": ("ImprovementType", "ResourceType"),
    "Districts": ("DistrictType",), "DistrictReplaces": ("CivUniqueDistrictType",),
    "Buildings": ("BuildingType",), "Building_YieldChanges": ("BuildingType", "YieldType"),
    "Building_GreatPersonPoints": ("BuildingType", "GreatPersonClassType"), "BuildingPrereqs": ("Building", "PrereqBuilding"),
    "Units": ("UnitType",), "UnitReplaces": ("CivUniqueUnitType",), "Improvements": ("ImprovementType",),
    "Improvement_YieldChanges": ("ImprovementType", "YieldType"), "Governments": ("GovernmentType",),
    "Government_SlotCounts": ("GovernmentType", "GovernmentSlotType"),
    "Civilizations": ("CivilizationType",), "CivilizationTraits": ("CivilizationType", "TraitType"),
    "Leaders": ("LeaderType",), "LeaderTraits": ("LeaderType", "TraitType"), "Traits": ("TraitType",),
    "Players": ("Domain", "CivilizationType", "LeaderType"),
}

PREFIXES = {
    "TECH_": "tech_", "CIVIC_": "civic_", "POLICY_": "policy_", "RESOURCE_": "resource_",
    "DISTRICT_": "district_", "BUILDING_": "building_", "IMPROVEMENT_": "improvement_",
    "UNIT_": "unit_", "GOVERNMENT_": "government_", "CIVILIZATION_": "civilization_", "LEADER_": "leader_",
}

# Expansion 1's player relationships are not all repeated in the Expansion 2
# payload. Preserve the official pairings when the merged Players table omits
# them so a future import cannot detach these rulers from their civilizations.
LEADER_RELATION_FALLBACKS = {
    "CIVILIZATION_CREE": ["LEADER_POUNDMAKER"],
    "CIVILIZATION_GEORGIA": ["LEADER_TAMAR"],
    "CIVILIZATION_INDIA": ["LEADER_CHANDRAGUPTA"],
    "CIVILIZATION_MAPUCHE": ["LEADER_LAUTARO"],
    "CIVILIZATION_MONGOLIA": ["LEADER_GENGHIS_KHAN"],
    "CIVILIZATION_NETHERLANDS": ["LEADER_WILHELMINA"],
    "CIVILIZATION_KOREA": ["LEADER_SEONDEOK"],
    "CIVILIZATION_SCOTLAND": ["LEADER_ROBERT_THE_BRUCE"],
    "CIVILIZATION_ZULU": ["LEADER_SHAKA"],
}


def strip_tag(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def values(node: ET.Element) -> dict[str, str]:
    result = dict(node.attrib)
    for child in node:
        if len(child) == 0 and child.text is not None:
            result[strip_tag(child.tag)] = child.text.strip()
    return result


def truth(value) -> bool:
    return str(value).lower() in {"1", "true", "yes"}


def number(value):
    if value is None or value == "":
        return None
    try:
        return float(value) if "." in str(value) else int(value)
    except ValueError:
        return value


def sid(source: str | None, forced: str | None = None) -> str | None:
    if not source:
        return None
    if forced:
        prefix = PREFIXES[forced]
        raw = source[len(forced):] if source.startswith(forced) else source
        return prefix + raw.lower()
    for old, new in PREFIXES.items():
        if source.startswith(old):
            return new + source[len(old):].lower()
    return source.lower()


def label(value: str | None, prefix: str = "") -> str | None:
    if not value:
        return None
    raw = value[len(prefix):] if prefix and value.startswith(prefix) else value
    return raw.replace("_", " ").title()


def clean_text(text: str | None) -> str | None:
    if not text:
        return None
    text = re.sub(r"\[NEWLINE\]", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\[ICON_([^]]+)\]", lambda m: m.group(1).replace("_", " ").title(), text, flags=re.IGNORECASE)
    text = re.sub(r"\[(?:/?COLOR[^]]*|ENDCOLOR)\]", "", text, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", text).strip()


class Database:
    def __init__(self):
        self.tables: dict[str, list[dict[str, str]]] = defaultdict(list)
        self.localizations: dict[str, str] = {}
        self.files: list[str] = []
        self.skipped_sql: list[str] = []
        self.parse_errors: list[str] = []

    def key(self, table: str, row: dict[str, str]):
        columns = TABLE_KEYS.get(table)
        if columns and all(row.get(column) is not None for column in columns):
            return tuple(row[column] for column in columns)
        return tuple(sorted(row.items()))

    def upsert(self, table: str, row: dict[str, str]):
        key = self.key(table, row)
        for index, current in enumerate(self.tables[table]):
            if self.key(table, current) == key:
                self.tables[table][index] = {**current, **row}
                return
        self.tables[table].append(row)

    def parse(self, path: Path):
        if path.suffix.lower() == ".sql":
            self.skipped_sql.append(str(path))
            return
        if not path.exists() or path.suffix.lower() != ".xml":
            return
        try:
            root = ET.parse(path).getroot()
        except (ET.ParseError, OSError) as exc:
            self.parse_errors.append(f"{path}: {exc}")
            return
        self.files.append(str(path))
        for container in root.iter():
            table = strip_tag(container.tag)
            children = list(container)
            if not children:
                continue
            if table in {"BaseGameText", "EnglishText", "LocalizedText"}:
                for child in children:
                    row = values(child)
                    tag = row.get("Tag")
                    text = row.get("Text")
                    if tag and text is not None:
                        self.localizations[tag] = text
                continue
            if table not in TABLE_KEYS:
                continue
            for child in children:
                operation = strip_tag(child.tag)
                row = values(child)
                if operation in {"Row", "Replace"}:
                    self.upsert(table, row)
                elif operation == "Delete":
                    self.tables[table] = [item for item in self.tables[table] if not all(item.get(k) == v for k, v in row.items())]
                elif operation == "Update":
                    where = values(next((x for x in child if strip_tag(x.tag) == "Where"), ET.Element("Where")))
                    change = values(next((x for x in child if strip_tag(x.tag) == "Set"), ET.Element("Set")))
                    for item in self.tables[table]:
                        if all(item.get(k) == v for k, v in where.items()):
                            item.update(change)

    def rows(self, table: str, **matches):
        return [row for row in self.tables.get(table, []) if all(row.get(k) == v for k, v in matches.items())]

    def loc(self, key: str | None) -> str | None:
        if not key:
            return None
        return clean_text(self.localizations.get(key, key if not key.startswith("LOC_") else None))


def mod_files(modinfo: Path, action_names: set[str]) -> list[Path]:
    excluded = {"scenario", "tutorial", "multiplayer", "red death", "pirates", "black death"}
    try:
        root = ET.parse(modinfo).getroot()
    except ET.ParseError:
        return []
    result = []
    for action in root.iter():
        if strip_tag(action.tag) not in action_names:
            continue
        marker = " ".join([action.attrib.get("id", ""), action.attrib.get("criteria", ""), str(modinfo.parent)]).lower()
        if any(word in marker for word in excluded):
            continue
        files = []
        for child in action:
            if strip_tag(child.tag) == "File" and child.text:
                files.append((int(child.attrib.get("Priority", "0")), child.text.strip()))
        for _, relative in sorted(files, key=lambda item: -item[0]):
            candidate = modinfo.parent / Path(relative.replace("/", "\\"))
            if not any(word in str(candidate).lower() for word in excluded):
                result.append(candidate)
    return result


def discover(game: Path) -> tuple[list[Path], list[Path]]:
    gameplay = sorted((game / "Base/Assets/Gameplay/Data").glob("*.xml"))
    gameplay += sorted((game / "Base/Assets/Configuration/Data").glob("*.xml"))
    text = sorted((game / "Base/Assets/Text/en_US").glob("*.xml"))
    modinfos = sorted((game / "DLC").rglob("*.modinfo"))
    # Gathering Storm embeds the Rise & Fall core. Loading Expansion1 again
    # would apply obsolete XP1 values after XP2 values.
    for modinfo in modinfos:
        if modinfo.name.lower() == "expansion1.modinfo":
            # XP2 carries XP1 gameplay forward, but not every XP1 English
            # localization file or XP1 civilization payload. Keep its Major
            # content and text without reapplying the obsolete XP1 core.
            gameplay.extend(sorted((modinfo.parent / "Data").glob("Expansion1_*_Major.xml")))
            text.extend(path for path in mod_files(modinfo, {"UpdateText"}) if "en_us" in str(path).lower())
            continue
        gameplay.extend(mod_files(modinfo, {"UpdateDatabase"}))
        # Manifests commonly list English and China-specific translation
        # payloads in the same action. Loading every file lets a later
        # translation overwrite the requested English localization key.
        text.extend(path for path in mod_files(modinfo, {"UpdateText"}) if "en_us" in str(path).lower())
    return list(dict.fromkeys(gameplay)), list(dict.fromkeys(text))


def existing_strategy() -> dict[str, dict]:
    result = {}
    for _, _, filename, _ in CATALOG:
        path = ROOT / "data" / filename
        if not path.exists():
            continue
        for record in json.loads(path.read_text(encoding="utf-8")).get("records", []):
            if record.get("strategy"):
                result[record["id"]] = record["strategy"]
    return result


def normalizer(db: Database):
    strategy = existing_strategy()
    rulesets = ["gathering-storm"]
    result: dict[str, list[dict]] = {item[0]: [] for item in CATALOG}
    wonder_sources = {row.get("BuildingType") for row in db.rows("Buildings") if truth(row.get("IsWonder")) or row.get("MaxWorldInstances") == "1"}

    def entity_id(source):
        if source in wonder_sources:
            return sid("WONDER_" + source[len("BUILDING_"):])
        return sid(source)

    def record(kind, source_id, name, game_data, **extra):
        item_id = sid(source_id)
        resolved_name = db.loc(name)
        if not item_id or not resolved_name:
            return
        item = {"id": item_id, "name": resolved_name, **extra, "rulesets": rulesets, "gameData": game_data, "strategy": strategy.get(item_id, {})}
        result[kind].append({k: v for k, v in item.items() if v is not None})

    tech_prereqs = defaultdict(list)
    for row in db.rows("TechnologyPrereqs"):
        tech_prereqs[row.get("Technology")].append(sid(row.get("PrereqTech")))
    civic_prereqs = defaultdict(list)
    for row in db.rows("CivicPrereqs"):
        civic_prereqs[row.get("Civic")].append(sid(row.get("PrereqCivic")))
    boosts = {row.get("TechnologyType"): row for row in db.rows("Boosts")}
    civic_boosts = {row.get("CivicType"): row for row in db.rows("Boosts") if row.get("CivicType")}

    unlock_tables = [("Districts", "DistrictType"), ("Buildings", "BuildingType"), ("Units", "UnitType"), ("Improvements", "ImprovementType")]
    for row in db.rows("Technologies"):
        source = row.get("TechnologyType")
        unlocks = [entity_id(x[id_col]) for table, id_col in unlock_tables for x in db.rows(table, PrereqTech=source) if x.get(id_col)]
        revealed = [sid(x["ResourceType"]) for x in db.rows("Resources", PrereqTech=source)]
        leads = [sid(key) for key, values_ in tech_prereqs.items() if sid(source) in values_]
        boost = boosts.get(source, {})
        record("technology", source, row.get("Name"), {"scienceCost": number(row.get("Cost")), "description": db.loc(row.get("Description")), "eureka": db.loc(boost.get("TriggerDescription")), "prerequisites": sorted(tech_prereqs[source]), "leadsTo": sorted(leads), "unlocks": sorted(set(unlocks)), "resourcesRevealed": sorted(set(revealed))}, era=label(row.get("EraType"), "ERA_"))

    for row in db.rows("Civics"):
        source = row.get("CivicType")
        policies = [sid(x["PolicyType"]) for x in db.rows("Policies", PrereqCivic=source)]
        governments = [sid(x["GovernmentType"]) for x in db.rows("Governments", PrereqCivic=source)]
        unlocks = [entity_id(x[id_col]) for table, id_col in unlock_tables for x in db.rows(table, PrereqCivic=source) if x.get(id_col)]
        leads = [sid(key) for key, values_ in civic_prereqs.items() if sid(source) in values_]
        boost = civic_boosts.get(source, {})
        record("civic", source, row.get("Name"), {"cultureCost": number(row.get("Cost")), "description": db.loc(row.get("Description")), "inspiration": db.loc(boost.get("TriggerDescription")), "prerequisites": sorted(civic_prereqs[source]), "leadsTo": sorted(leads), "policiesUnlocked": sorted(policies), "governmentsUnlocked": sorted(governments), "otherUnlocks": sorted(set(unlocks))}, era=label(row.get("EraType"), "ERA_"))

    obsolete = {x.get("PolicyType"): sid(x.get("ObsoletePolicy")) for x in db.rows("ObsoletePolicies")}
    for row in db.rows("Policies"):
        record("policy", row.get("PolicyType"), row.get("Name"), {"effect": db.loc(row.get("Description")), "unlockedBy": sid(row.get("PrereqCivic")), "obsoleteBy": obsolete.get(row.get("PolicyType"))}, type=label(row.get("GovernmentSlotType"), "SLOT_"))

    resource_yields = defaultdict(dict)
    for x in db.rows("Resource_YieldChanges"):
        resource_yields[x.get("ResourceType")][label(x.get("YieldType"), "YIELD_").lower()] = number(x.get("YieldChange"))
    for row in db.rows("Resources"):
        source = row.get("ResourceType")
        terrain = [label(x.get("TerrainType"), "TERRAIN_") for x in db.rows("Resource_ValidTerrains", ResourceType=source)]
        terrain += [label(x.get("FeatureType"), "FEATURE_") for x in db.rows("Resource_ValidFeatures", ResourceType=source)]
        improvements = [sid(x.get("ImprovementType")) for x in db.rows("Improvement_ValidResources", ResourceType=source)]
        record("resource", source, row.get("Name"), {"yieldChanges": resource_yields[source], "validTerrain": sorted(set(filter(None, terrain))), "improvement": improvements[0] if improvements else None, "technologyRequired": sid(row.get("PrereqTech")), "amenityEffect": number(row.get("Happiness")), "strategicUse": None, "consumedBy": [sid(x.get("UnitType")) for x in db.rows("Units", StrategicResource=source)], "canHarvest": row.get("ResourceClassType") == "RESOURCECLASS_BONUS", "canRemove": row.get("ResourceClassType") == "RESOURCECLASS_BONUS"}, type=label(row.get("ResourceClassType"), "RESOURCECLASS_"))

    district_replaces = {x.get("CivUniqueDistrictType"): x.get("ReplacesDistrictType") for x in db.rows("DistrictReplaces")}
    for row in db.rows("Districts"):
        source = row.get("DistrictType")
        prereq = row.get("PrereqTech") or row.get("PrereqCivic")
        buildings = [sid(x.get("BuildingType")) for x in db.rows("Buildings", PrereqDistrict=source)]
        record("district", source, row.get("Name"), {"description": db.loc(row.get("Description")), "baseCost": number(row.get("Cost")), "prerequisite": sid(prereq), "buildings": sorted(buildings), "replaces": sid(district_replaces.get(source)), "maintenance": number(row.get("Maintenance")), "housing": number(row.get("Housing")), "amenities": number(row.get("Entertainment"))})

    building_yields = defaultdict(dict)
    for x in db.rows("Building_YieldChanges"):
        building_yields[x.get("BuildingType")][label(x.get("YieldType"), "YIELD_").lower()] = number(x.get("YieldChange"))
    gp = defaultdict(dict)
    for x in db.rows("Building_GreatPersonPoints"):
        gp[x.get("BuildingType")][label(x.get("GreatPersonClassType"), "GREAT_PERSON_CLASS_").replace(" ", "").lower()] = number(x.get("PointsPerTurn"))
    prereq_building = {x.get("Building"): sid(x.get("PrereqBuilding")) for x in db.rows("BuildingPrereqs")}
    for row in db.rows("Buildings"):
        source = row.get("BuildingType")
        kind = "wonder" if truth(row.get("IsWonder")) or row.get("MaxWorldInstances") == "1" else "building"
        item_id = ("WONDER_" + source[len("BUILDING_"):]) if kind == "wonder" and source else source
        data = {"description": db.loc(row.get("Description")), "district": sid(row.get("PrereqDistrict")), "productionCost": number(row.get("Cost")), "maintenance": number(row.get("Maintenance")), "prerequisite": sid(row.get("PrereqTech") or row.get("PrereqCivic")), "yieldChanges": building_yields[source], "greatPersonPoints": gp[source], "requiredPreviousBuilding": prereq_building.get(source)}
        record(kind, item_id, row.get("Name"), data, era=label(row.get("ObsoleteEra"), "ERA_") if kind == "wonder" else None)

    improvement_yields = defaultdict(dict)
    for x in db.rows("Improvement_YieldChanges"):
        improvement_yields[x.get("ImprovementType")][label(x.get("YieldType"), "YIELD_").lower()] = number(x.get("YieldChange"))
    for row in db.rows("Improvements"):
        source = row.get("ImprovementType")
        record("improvement", source, row.get("Name"), {"description": db.loc(row.get("Description")), "yieldChanges": improvement_yields[source], "prerequisite": sid(row.get("PrereqTech") or row.get("PrereqCivic")), "buildable": not truth(row.get("OnePerCity"))})

    for row in db.rows("Units"):
        source = row.get("UnitType")
        record("unit", source, row.get("Name"), {"description": db.loc(row.get("Description")), "productionCost": number(row.get("Cost")), "maintenance": number(row.get("Maintenance")), "movement": number(row.get("BaseMoves")), "combat": number(row.get("Combat")), "rangedCombat": number(row.get("RangedCombat")), "range": number(row.get("Range")), "prerequisite": sid(row.get("PrereqTech") or row.get("PrereqCivic")), "strategicResource": sid(row.get("StrategicResource")), "domain": label(row.get("Domain"), "DOMAIN_")})

    for row in db.rows("Governments"):
        source = row.get("GovernmentType")
        slots = {label(x.get("GovernmentSlotType"), "SLOT_").lower(): number(x.get("NumSlots")) for x in db.rows("Government_SlotCounts", GovernmentType=source)}
        record("government", source, row.get("Name"), {"description": db.loc(row.get("Description")), "unlockedBy": sid(row.get("PrereqCivic")), "inherentBonus": db.loc(row.get("InherentBonusDesc")), "accumulatedBonus": db.loc(row.get("AccumulatedBonusDesc")), "policySlots": slots})

    traits = {x.get("TraitType"): x for x in db.rows("Traits")}
    civ_traits = defaultdict(list)
    for x in db.rows("CivilizationTraits"):
        civ_traits[x.get("CivilizationType")].append(x.get("TraitType"))
    players = db.rows("Players")
    for row in db.rows("Civilizations"):
        source = row.get("CivilizationType")
        if row.get("StartingCivilizationLevelType") not in {None, "CIVILIZATION_LEVEL_FULL_CIV"}:
            continue
        ability = next((traits.get(x) for x in civ_traits[source] if traits.get(x)), None)
        leader_sources = {x.get("LeaderType") for x in players if x.get("CivilizationType") == source and x.get("LeaderType")}
        leader_sources.update(LEADER_RELATION_FALLBACKS.get(source, []))
        leaders = sorted({sid(leader) for leader in leader_sources})
        owned_traits = set(civ_traits[source])
        unique_units = [sid(x.get("UnitType")) for x in db.rows("Units") if x.get("TraitType") in owned_traits]
        unique_districts = [sid(x.get("DistrictType")) for x in db.rows("Districts") if x.get("TraitType") in owned_traits]
        record("civilization", source, row.get("Name"), {"description": db.loc(row.get("Description")), "abilityName": db.loc(ability.get("Name")) if ability else None, "ability": db.loc(ability.get("Description")) if ability else None, "uniqueUnits": sorted(unique_units), "uniqueDistricts": sorted(unique_districts), "startingBias": []}, leaders=leaders)

    leader_traits = defaultdict(list)
    for x in db.rows("LeaderTraits"):
        leader_traits[x.get("LeaderType")].append(x.get("TraitType"))
    for row in db.rows("Leaders"):
        source = row.get("LeaderType")
        if source and ("MINOR_CIV" in source or source in {"LEADER_DEFAULT", "LEADER_BARBARIAN"}):
            continue
        ability = next((traits.get(x) for x in leader_traits[source] if traits.get(x)), None)
        civilization_sources = {x.get("CivilizationType") for x in players if x.get("LeaderType") == source and x.get("CivilizationType")}
        civilization_sources.update(civ for civ, leaders in LEADER_RELATION_FALLBACKS.items() if source in leaders)
        civs = sorted({sid(civ) for civ in civilization_sources})
        record("leader", source, row.get("Name"), {"abilityName": db.loc(ability.get("Name")) if ability else None, "ability": db.loc(ability.get("Description")) if ability else None, "civilizations": civs})

    for records in result.values():
        records.sort(key=lambda item: (item["name"].casefold(), item["id"]))
    return result


def write_output(output: Path, datasets: dict[str, list[dict]], db: Database, game: Path):
    output.mkdir(parents=True, exist_ok=True)
    catalog = {"schemaVersion": 1, "defaultRuleset": "gathering-storm", "sampleData": False, "collections": [{"type": a, "label": b, "file": c, "route": d} for a, b, c, d in CATALOG]}
    (output / "catalog.json").write_text(json.dumps(catalog, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    search = []
    for kind, type_label, filename, route in CATALOG:
        records = datasets[kind]
        payload = {"schemaVersion": 1, "sampleData": False, "records": records}
        (output / filename).write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        for item in records:
            summary = item.get("strategy", {}).get("summary") or item.get("strategy", {}).get("whyItMatters") or item.get("gameData", {}).get("description") or f"{SINGULAR_LABELS[kind]} reference"
            search.append({"id": item["id"], "name": item["name"], "type": kind, "typeLabel": SINGULAR_LABELS[kind], "route": route, "rulesets": item["rulesets"], **({"era": item["era"]} if item.get("era") else {}), "summary": summary})
    search.sort(key=lambda item: (item["name"].casefold(), item["id"]))
    (output / "search-index.json").write_text(json.dumps({"schemaVersion": 1, "sampleData": False, "records": search}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    all_ids = {item["id"] for records in datasets.values() for item in records}
    unresolved = set()
    def inspect(value):
        if isinstance(value, dict):
            for nested in value.values(): inspect(nested)
        elif isinstance(value, list):
            for nested in value: inspect(nested)
        elif isinstance(value, str) and any(value.startswith(prefix) for prefix in PREFIXES.values()) and value not in all_ids:
            unresolved.add(value)
    for records in datasets.values():
        for item in records:
            inspect(item.get("gameData", {}))
            inspect(item.get("leaders", []))
    report = {"gameInstall": str(game), "parsedXmlFiles": len(db.files), "localizedStrings": len(db.localizations), "skippedSqlFiles": db.skipped_sql, "parseErrors": db.parse_errors, "recordCounts": {kind: len(rows) for kind, rows in datasets.items()}, "totalRecords": sum(map(len, datasets.values())), "unresolvedReferences": sorted(unresolved)}
    (output / "import-report.json").write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--game", type=Path, default=DEFAULT_GAME, help="Civilization VI installation directory")
    parser.add_argument("--output", type=Path, default=STAGING, help="staging output directory")
    parser.add_argument("--publish", action="store_true", help="copy successful output into civ6/data")
    args = parser.parse_args()
    if not (args.game / "Base/Assets/Gameplay/Data").is_dir():
        parser.error(f"Civilization VI data was not found under: {args.game}")
    gameplay, text = discover(args.game)
    db = Database()
    for path in gameplay + text:
        db.parse(path)
    datasets = normalizer(db)
    if db.parse_errors:
        print("Import stopped because XML files could not be parsed:", file=sys.stderr)
        print("\n".join(db.parse_errors), file=sys.stderr)
        return 1
    report = write_output(args.output, datasets, db, args.game)
    if args.publish:
        for _, _, filename, _ in CATALOG:
            shutil.copy2(args.output / filename, ROOT / "data" / filename)
        shutil.copy2(args.output / "catalog.json", ROOT / "data/catalog.json")
        shutil.copy2(args.output / "search-index.json", ROOT / "data/search-index.json")
    print(json.dumps(report, indent=2))
    print(f"Output: {args.output}")
    if args.publish:
        print(f"Published to: {ROOT / 'data'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
