#!/usr/bin/env python3
r"""
Stage genuine Civilization VI leader portrait candidates from retail CIVBLP UI archives.

This script is intentionally non-destructive:
- Reads the local Civilization VI installation and SDK assets read-only.
- Reads the civ6 repository's icon XML-derived data/manifest read-only.
- Writes ONLY under:
    tools/import/output/leader-portrait-staging/
- Does NOT overwrite assets/icons/leader, manifest.json, leaders.json, or search-index.json.

It reconstructs Civ VI UI textures from the serialized data in retail
Platforms/Windows/BLPs/UI/Icons.blp packages, then crops the official icon tile
using the game's own atlas definition (atlas, index, icon size, IconsPerRow).

Run:
    python civ6/tools/import/extract_civ6_leader_portraits_stage.py

Optional:
    python civ6/tools/import/extract_civ6_leader_portraits_stage.py --repo "C:\Users\cxav1\Desktop\cxav12.github.io\civ6"
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import shutil
import struct
import zipfile
from collections import defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image, ImageDraw, ImageFont

DEFAULT_REPO = Path(__file__).resolve().parents[2]
DEFAULT_GAME = Path(r"C:\Program Files (x86)\Steam\steamapps\common\Sid Meier's Civilization VI")
DEFAULT_SDK = Path(r"C:\Program Files (x86)\Steam\steamapps\common\Sid Meier's Civilization VI SDK Assets")

TARGET_LEADERS = [
    "leader_abraham_lincoln",
    "leader_alexander",
    "leader_amanitore",
    "leader_ambiorix",
    "leader_basil",
    "leader_lady_trieu",
    "leader_catherine_de_medici_alt",
    "leader_cleopatra_alt",
    "leader_cyrus",
    "leader_elizabeth",
    "leader_gitarja",
    "leader_hammurabi",
    "leader_harald_alt",
    "leader_jadwiga",
    "leader_jayavarman",
    "leader_john_curtin",
    "leader_joao_iii",
    "leader_julius_caesar",
    "leader_kublai_khan_china",
    "leader_kublai_khan_mongolia",
    "leader_lady_six_sky",
    "leader_ludwig",
    "leader_menelik",
    "leader_nader_shah",
    "leader_nzinga_mbande",
    "leader_qin_alt",
    "leader_ramses",
    "leader_saladin_alt",
    "leader_sejong",
    "leader_simon_bolivar",
    "leader_suleiman_alt",
    "leader_sundiata_keita",
    "leader_t_roosevelt_roughrider",
    "leader_theodora",
    "leader_tokugawa",
    "leader_victoria_alt",
    "leader_wu_zetian",
    "leader_yongle",
]

TYPE_BUFFER_ENTRY = "BLP::TBufferEntry"
TYPE_BC_TEXTURE_ENTRY = "ForgeUI::BCTexturePackageEntry"
ENTRY_MAP_MARKER = b"BLP::Package::EntryMap"


def icon_xml_files(game: Path):
    base = game / "Base" / "Assets" / "UI" / "Icons"
    if base.is_dir():
        yield from base.glob("*.xml")
    dlc = game / "DLC"
    if dlc.is_dir():
        for p in dlc.rglob("*.xml"):
            if "icon" in p.name.casefold():
                yield p


def parse_icon_database(game: Path):
    atlases = defaultdict(list)
    definitions = defaultdict(list)
    aliases = []
    parsed = 0

    for path in icon_xml_files(game):
        try:
            root = ET.parse(path).getroot()
        except (OSError, ET.ParseError):
            continue
        parsed += 1

        for row in root.findall(".//IconTextureAtlases/Row"):
            d = row.attrib
            if d.get("Name") and d.get("Filename") and d.get("IconSize"):
                atlases[d["Name"]].append({
                    "size": int(d["IconSize"]),
                    "columns": int(d.get("IconsPerRow", "1")),
                    "filename": d["Filename"],
                    "xml": str(path),
                })

        for row in root.findall(".//IconDefinitions/Row"):
            d = row.attrib
            if d.get("Name") and d.get("Atlas") and d.get("Index"):
                definitions[d["Name"]].append({
                    "atlas": d["Atlas"],
                    "index": int(d["Index"]),
                    "xml": str(path),
                })

        for row in root.findall(".//IconAliases/Row"):
            d = row.attrib
            if d.get("Name") and d.get("OtherName"):
                aliases.append((d["Name"], d["OtherName"]))

    for _ in range(6):
        changed = False
        for name, other in aliases:
            if not definitions.get(name) and definitions.get(other):
                definitions[name].extend(definitions[other])
                changed = True
        if not changed:
            break

    return atlases, definitions, parsed


def icon_name_for_leader(leader_id: str) -> str:
    return "ICON_LEADER_" + leader_id.removeprefix("leader_").upper()


def pack_from_xml(xml_path: Path, game: Path):
    try:
        rel = xml_path.relative_to(game)
    except ValueError:
        return None
    parts = rel.parts
    if not parts:
        return None
    if parts[0].casefold() == "base":
        return ("Base", None)
    if len(parts) >= 2 and parts[0].casefold() == "dlc":
        return ("DLC", parts[1])
    return None


def icons_blp_for_xml(xml_path: Path, game: Path):
    pack = pack_from_xml(xml_path, game)
    if not pack:
        return None
    kind, name = pack
    if kind == "Base":
        return game / "Base" / "Platforms" / "Windows" / "BLPs" / "UI" / "Icons.blp"
    return game / "DLC" / name / "Platforms" / "Windows" / "BLPs" / "UI" / "Icons.blp"


def contains_ascii(path: Path, text: str) -> bool:
    needle = text.encode("utf-8")
    if not path.is_file():
        return False
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


def choose_official_source(leader_id: str, atlases, definitions, game: Path):
    requested = icon_name_for_leader(leader_id)
    candidates = []

    for definition_order, definition in enumerate(definitions.get(requested, [])):
        atlas_name = definition["atlas"]
        for option_order, option in enumerate(
            sorted(atlases.get(atlas_name, []), key=lambda x: x["size"], reverse=True)
        ):
            xml_path = Path(option["xml"])
            archive = icons_blp_for_xml(xml_path, game)
            if not archive or not archive.is_file():
                continue

            asset_name = Path(option["filename"]).stem
            found = contains_ascii(archive, asset_name)
            scenario_penalty = int("scenario" in str(xml_path).casefold())
            size_penalty = -option["size"]

            candidates.append({
                "requestedIcon": requested,
                "atlas": atlas_name,
                "index": definition["index"],
                "definitionXml": definition["xml"],
                "atlasXml": option["xml"],
                "size": option["size"],
                "columns": option["columns"],
                "filename": option["filename"],
                "assetName": asset_name,
                "archive": str(archive),
                "archiveContainsAssetName": found,
                "_rank": (
                    0 if found else 1,
                    scenario_penalty,
                    size_penalty,
                    definition_order,
                    option_order,
                ),
            })

    if not candidates:
        return None, []

    candidates.sort(key=lambda x: x["_rank"])
    selected = candidates[0]

    # Require the largest available official icon and require the corresponding
    # asset name to actually occur in the expected retail UI archive.
    if not selected["archiveContainsAssetName"]:
        return None, candidates
    if selected["size"] < 256:
        # Still return it so the report can explain the limitation, but the
        # caller will not mark it as a 256 portrait candidate.
        pass

    for c in candidates:
        c.pop("_rank", None)
    return selected, candidates


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


class Civ6UIBlp:
    """
    Minimal read-only Civ VI CIVBLP parser for ForgeUI UI textures.

    Civ VI PackageAllocation records in these UI packages are 40 bytes. The
    fields needed here are:
      uint32 stripe       @ 0
      uint32 offset       @ 8
      uint32 size         @ 12
      uint32 count        @ 16

    Serialized allocation pointers used by package objects are 1-based
    allocation indexes (0 = null).

    The extractor deliberately avoids guessing absolute package offsets:
    PackageBlock's absolute base is derived and validated from the selected
    texture-name String::BasicT allocation.
    """

    def __init__(self, path: Path, anchor_asset_name: str):
        self.path = Path(path)
        self.data = self.path.read_bytes()
        self._parse_header()
        self.alloc_table_offset = self._locate_allocation_table()
        self.allocations = self._parse_allocations(self.alloc_table_offset)
        self.package_base = self._derive_package_base(anchor_asset_name)

    def _parse_header(self):
        if len(self.data) < 28:
            raise ValueError("BLP is too small")
        if self.data[:6] != b"CIVBLP":
            raise ValueError(f"not a CIVBLP package: magic={self.data[:6]!r}")

        self.version = struct.unpack_from("<H", self.data, 6)[0]
        (
            self.package_data_offset,
            self.package_data_size,
            self.big_data_offset,
            self.big_data_count,
            self.declared_file_size,
        ) = struct.unpack_from("<IIIII", self.data, 8)

        if self.declared_file_size and self.declared_file_size != len(self.data):
            raise ValueError(
                f"CIVBLP declared size {self.declared_file_size} != actual {len(self.data)}"
            )
        if not (0 <= self.package_data_offset < self.big_data_offset <= len(self.data)):
            raise ValueError("invalid CIVBLP package/big-data offsets")

    @staticmethod
    def _decode_alloc(raw: bytes):
        if len(raw) != 40:
            return None
        fields = struct.unpack("<10I", raw)
        return {
            "stripe": fields[0],
            "offset": fields[2],
            "size": fields[3],
            "count": fields[4],
            "field6": fields[6],
            "typeIndex": fields[8],
        }

    def _locate_allocation_table(self):
        marker_pos = self.data.rfind(
            ENTRY_MAP_MARKER,
            self.package_data_offset,
            self.big_data_offset,
        )
        if marker_pos < 0:
            raise ValueError("could not locate BLP::Package::EntryMap marker")

        # The marker is itself the String::BasicT char buffer. In the Civ VI UI
        # packages inspected here, the allocation table starts immediately after
        # its terminating NUL. Validate rather than assume blindly.
        candidate = marker_pos + len(ENTRY_MAP_MARKER) + 1
        if candidate + 40 > self.big_data_offset:
            raise ValueError("allocation table candidate lies outside package data")

        first = self._decode_alloc(self.data[candidate:candidate + 40])
        if not self._plausible_alloc(first):
            # Defensive fallback: search a short window after the marker.
            for delta in range(1, 65):
                pos = candidate + delta
                if pos + 40 > self.big_data_offset:
                    break
                alloc = self._decode_alloc(self.data[pos:pos + 40])
                if self._plausible_alloc(alloc):
                    return pos
            raise ValueError("could not locate a plausible PackageAllocation table")
        return candidate

    def _plausible_alloc(self, alloc):
        if not alloc:
            return False
        if alloc["stripe"] not in (0, 1):
            return False
        if alloc["size"] <= 0 or alloc["count"] <= 0:
            return False
        if alloc["count"] > alloc["size"]:
            return False
        if alloc["offset"] > self.package_data_size * 4:
            return False
        if alloc["size"] > self.package_data_size * 4:
            return False
        return True

    def _parse_allocations(self, pos):
        result = []
        while pos + 40 <= self.big_data_offset:
            alloc = self._decode_alloc(self.data[pos:pos + 40])
            if not self._plausible_alloc(alloc):
                break
            alloc["index"] = len(result)
            result.append(alloc)
            pos += 40

        if len(result) < 5:
            raise ValueError(f"implausibly small PackageAllocation table ({len(result)} entries)")
        return result

    @staticmethod
    def _string_storage_info(blob: bytes):
        if len(blob) < 9:
            return None
        cap, length = struct.unpack_from("<II", blob, 0)
        if cap <= 0 or length < 0 or length >= cap:
            return None
        if 8 + cap > len(blob):
            return None
        raw = blob[8:8 + length]
        if blob[8 + length:8 + length + 1] != b"\0":
            return None
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            return None
        if not text:
            return None
        return {"capacity": cap, "length": length, "text": text}

    def _score_package_base(self, base: int):
        score = 0
        for alloc in self.allocations:
            # String::BasicT backing allocations are byte arrays where size=count.
            if alloc["stripe"] != 0 or alloc["size"] != alloc["count"]:
                continue
            if alloc["size"] < 9 or alloc["size"] > 512:
                continue
            pos = base + alloc["offset"]
            end = pos + alloc["size"]
            if pos < self.package_data_offset or end > self.big_data_offset:
                continue
            info = self._string_storage_info(self.data[pos:end])
            if info:
                score += 1
        return score

    def _derive_package_base(self, anchor_name: str):
        needle = anchor_name.encode("utf-8") + b"\0"
        cursor = self.package_data_offset
        candidates = []

        while True:
            pos = self.data.find(needle, cursor, self.big_data_offset)
            if pos < 0:
                break
            cursor = pos + 1
            if pos < 8:
                continue

            storage_abs = pos - 8
            cap, length = struct.unpack_from("<II", self.data, storage_abs)
            if length != len(anchor_name) or cap < length + 1:
                continue

            storage_size = 8 + cap
            for alloc in self.allocations:
                if (
                    alloc["stripe"] == 0
                    and alloc["size"] == storage_size
                    and alloc["count"] == storage_size
                ):
                    base = storage_abs - alloc["offset"]
                    mapped = base + alloc["offset"]
                    if mapped < self.package_data_offset:
                        continue
                    blob = self.data[mapped:mapped + alloc["size"]]
                    info = self._string_storage_info(blob)
                    if info and info["text"] == anchor_name:
                        candidates.append((self._score_package_base(base), base, alloc["index"]))

        if not candidates:
            raise ValueError(f"could not derive PackageBlock base from {anchor_name!r}")

        candidates.sort(reverse=True)
        score, base, alloc_index = candidates[0]
        if score < 2:
            raise ValueError(
                f"PackageBlock base for {anchor_name!r} failed validation (string score={score})"
            )
        return base

    def _allocation_abs(self, alloc):
        if alloc["stripe"] != 0:
            raise ValueError("this extractor only dereferences PackageBlock allocations")
        pos = self.package_base + alloc["offset"]
        end = pos + alloc["size"]
        if not (self.package_data_offset <= pos <= end <= self.big_data_offset):
            raise ValueError(
                f"allocation {alloc['index']} resolves outside PackageBlock "
                f"(0x{pos:x}..0x{end:x})"
            )
        return pos

    def _find_name_allocation(self, name: str):
        for alloc in self.allocations:
            if alloc["stripe"] != 0 or alloc["size"] != alloc["count"]:
                continue
            if alloc["size"] < 9 or alloc["size"] > 512:
                continue
            try:
                pos = self._allocation_abs(alloc)
            except ValueError:
                continue
            info = self._string_storage_info(self.data[pos:pos + alloc["size"]])
            if info and info["text"] == name:
                return alloc
        return None

    def find_tbuffer(self, name: str):
        name_alloc = self._find_name_allocation(name)
        if not name_alloc:
            return None
        name_ptr = name_alloc["index"] + 1

        # BLP::TBufferEntry serializes as 72 bytes per element.
        for alloc in self.allocations:
            if alloc["stripe"] != 0 or alloc["count"] <= 0:
                continue
            if alloc["size"] % alloc["count"]:
                continue
            if alloc["size"] // alloc["count"] != 72:
                continue

            start = self._allocation_abs(alloc)
            for i in range(alloc["count"]):
                p = start + i * 72
                if struct.unpack_from("<Q", self.data, p + 8)[0] != name_ptr:
                    continue
                return {
                    "name": name,
                    "nameAllocationIndex": name_alloc["index"],
                    "offset": struct.unpack_from("<Q", self.data, p + 32)[0],
                    "size": struct.unpack_from("<Q", self.data, p + 40)[0],
                    "hash": struct.unpack_from("<Q", self.data, p + 48)[0],
                    "elementCount": struct.unpack_from("<I", self.data, p + 64)[0],
                    "format": struct.unpack_from("<I", self.data, p + 68)[0],
                }
        return None

    def find_bc_texture_entry(self, name: str):
        name_alloc = self._find_name_allocation(name)
        if not name_alloc:
            return None
        name_ptr = name_alloc["index"] + 1

        # ForgeUI::BCTexturePackageEntry serializes as 112 bytes per element.
        for alloc in self.allocations:
            if alloc["stripe"] != 0 or alloc["count"] <= 0:
                continue
            if alloc["size"] % alloc["count"]:
                continue
            if alloc["size"] // alloc["count"] != 112:
                continue

            start = self._allocation_abs(alloc)
            for i in range(alloc["count"]):
                p = start + i * 112
                if struct.unpack_from("<Q", self.data, p + 56)[0] != name_ptr:
                    continue
                return {
                    "name": name,
                    "nameAllocationIndex": name_alloc["index"],
                    "flags": struct.unpack_from("<I", self.data, p + 72)[0],
                    "pageIndex": struct.unpack_from("<I", self.data, p + 76)[0],
                    "x": struct.unpack_from("<H", self.data, p + 80)[0],
                    "y": struct.unpack_from("<H", self.data, p + 82)[0],
                    "width": struct.unpack_from("<H", self.data, p + 84)[0],
                    "height": struct.unpack_from("<H", self.data, p + 86)[0],
                    "lookupHash": struct.unpack_from("<Q", self.data, p + 88)[0],
                    "blockOffset": struct.unpack_from("<I", self.data, p + 96)[0],
                    "indexOffset": struct.unpack_from("<I", self.data, p + 100)[0],
                    "blockSize": struct.unpack_from("<H", self.data, p + 104)[0],
                    "bytesPerIndex": struct.unpack_from("<H", self.data, p + 106)[0],
                }
        return None

    def decode_rgba_texture(self, name: str):
        tbuf = self.find_tbuffer(name)
        bc = self.find_bc_texture_entry(name)
        if not tbuf:
            raise ValueError(f"{name}: BLP::TBufferEntry not found")
        if not bc:
            raise ValueError(f"{name}: ForgeUI::BCTexturePackageEntry not found")

        start = self.big_data_offset + tbuf["offset"]
        end = start + tbuf["size"]
        if not (self.big_data_offset <= start <= end <= len(self.data)):
            raise ValueError(f"{name}: TBuffer range outside BLP")
        payload = self.data[start:end]

        width = bc["width"]
        height = bc["height"]
        block_size = bc["blockSize"]
        bpi = bc["bytesPerIndex"]

        if width <= 0 or height <= 0 or block_size <= 0:
            raise ValueError(f"{name}: invalid texture dimensions/block size")
        if bpi not in (1, 2, 4):
            raise ValueError(f"{name}: unsupported bytesPerIndex={bpi}")

        # Civ VI ForgeUI stores these offsets in uint32 RGBA elements.
        dict_start = bc["blockOffset"] * 4
        index_start = bc["indexOffset"] * 4
        if not (0 <= dict_start <= index_start <= len(payload)):
            raise ValueError(f"{name}: invalid block/index offsets")

        block_bytes = block_size * block_size * 4
        dictionary = payload[dict_start:index_start]
        if len(dictionary) % block_bytes:
            raise ValueError(
                f"{name}: block dictionary length {len(dictionary)} "
                f"is not divisible by {block_bytes}"
            )
        unique_blocks = len(dictionary) // block_bytes
        if unique_blocks <= 0:
            raise ValueError(f"{name}: empty block dictionary")

        grid_w = math.ceil(width / block_size)
        grid_h = math.ceil(height / block_size)
        index_count = grid_w * grid_h
        index_bytes_needed = index_count * bpi
        if index_start + index_bytes_needed > len(payload):
            raise ValueError(
                f"{name}: index table needs {index_bytes_needed} bytes, only "
                f"{len(payload) - index_start} remain"
            )

        index_blob = payload[index_start:index_start + index_bytes_needed]
        if bpi == 1:
            indices = list(index_blob)
        elif bpi == 2:
            indices = list(struct.unpack("<" + "H" * index_count, index_blob))
        else:
            indices = list(struct.unpack("<" + "I" * index_count, index_blob))

        if not indices:
            raise ValueError(f"{name}: empty block index table")
        if max(indices) >= unique_blocks:
            raise ValueError(
                f"{name}: block index {max(indices)} >= dictionary size {unique_blocks}"
            )

        out = bytearray(width * height * 4)
        for gy in range(grid_h):
            for gx in range(grid_w):
                block_index = indices[gy * grid_w + gx]
                bstart = block_index * block_bytes
                block = dictionary[bstart:bstart + block_bytes]

                copy_w = min(block_size, width - gx * block_size)
                copy_h = min(block_size, height - gy * block_size)

                for by in range(copy_h):
                    src = by * block_size * 4
                    dst_x = gx * block_size
                    dst_y = gy * block_size + by
                    dst = (dst_y * width + dst_x) * 4
                    span = copy_w * 4
                    out[dst:dst + span] = block[src:src + span]

        image = Image.frombytes("RGBA", (width, height), bytes(out))
        diagnostics = {
            "civblpVersion": self.version,
            "packageDataOffset": self.package_data_offset,
            "bigDataOffset": self.big_data_offset,
            "allocationTableOffset": self.alloc_table_offset,
            "allocationCount": len(self.allocations),
            "packageBase": self.package_base,
            "tbuffer": tbuf,
            "textureEntry": bc,
            "uniqueBlocks": unique_blocks,
            "blockGrid": [grid_w, grid_h],
            "maxBlockIndex": max(indices),
        }
        return image, diagnostics

def alpha_metadata(image: Image.Image):
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    amin, amax = alpha.getextrema()
    return {
        "hasAlphaChannel": True,
        "alphaMin": int(amin),
        "alphaMax": int(amax),
        "hasTransparency": amin < 255,
        "hasPartialTransparency": amin < 255 and len(alpha.getcolors(maxcolors=1_000_000) or []) > 2,
    }


def rgba_hash(image: Image.Image):
    rgba = image.convert("RGBA")
    header = struct.pack("<II", rgba.width, rgba.height)
    return sha256_bytes(header + rgba.tobytes())


def pretty_name(leader_id: str):
    name = leader_id.removeprefix("leader_")
    replacements = {
        "t_roosevelt_roughrider": "T. Roosevelt — Rough Rider",
        "catherine_de_medici_alt": "Catherine de Medici — Alt",
        "cleopatra_alt": "Cleopatra — Alt",
        "harald_alt": "Harald — Alt",
        "qin_alt": "Qin — Alt",
        "saladin_alt": "Saladin — Alt",
        "suleiman_alt": "Suleiman — Alt",
        "victoria_alt": "Victoria — Alt",
        "kublai_khan_china": "Kublai Khan — China",
        "kublai_khan_mongolia": "Kublai Khan — Mongolia",
    }
    if name in replacements:
        return replacements[name]
    return name.replace("_", " ").title()


def get_font(size=14, bold=False):
    candidates = (
        ["arialbd.ttf", "DejaVuSans-Bold.ttf"] if bold
        else ["arial.ttf", "DejaVuSans.ttf"]
    )
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            pass
    return ImageFont.load_default()


def checkerboard(size, cell=12):
    w, h = size
    img = Image.new("RGB", size, (232, 232, 232))
    d = ImageDraw.Draw(img)
    for y in range(0, h, cell):
        for x in range(0, w, cell):
            if ((x // cell) + (y // cell)) % 2:
                d.rectangle(
                    [x, y, min(w - 1, x + cell - 1), min(h - 1, y + cell - 1)],
                    fill=(200, 200, 200),
                )
    return img


def build_contact_sheet(results, out_path: Path):
    cols = 5
    thumb = 220
    label_h = 62
    pad = 14
    cell_w = thumb + pad * 2
    cell_h = thumb + label_h + pad * 2
    rows = math.ceil(len(results) / cols)

    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), "white")
    draw = ImageDraw.Draw(sheet)
    name_font = get_font(15, bold=True)
    id_font = get_font(11, bold=False)

    for i, result in enumerate(results):
        row, col = divmod(i, cols)
        x0 = col * cell_w + pad
        y0 = row * cell_h + pad

        bg = checkerboard((thumb, thumb), cell=11)
        if result.get("status") == "candidate-extracted":
            with Image.open(result["stagedPath"]) as src:
                img = src.convert("RGBA")
            img.thumbnail((thumb, thumb), Image.Resampling.LANCZOS)
            px = (thumb - img.width) // 2
            py = (thumb - img.height) // 2
            bg.paste(img, (px, py), img)
        else:
            ImageDraw.Draw(bg).rectangle([0, 0, thumb - 1, thumb - 1], outline="red", width=4)
            ImageDraw.Draw(bg).text((10, 10), "EXTRACTION FAILED", fill="red", font=name_font)

        sheet.paste(bg, (x0, y0))
        draw.rectangle([x0, y0, x0 + thumb - 1, y0 + thumb - 1], outline=(80, 80, 80), width=1)

        label_y = y0 + thumb + 5
        draw.text((x0, label_y), pretty_name(result["id"]), fill="black", font=name_font)
        draw.text((x0, label_y + 22), result["id"], fill=(70, 70, 70), font=id_font)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path, "PNG")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=DEFAULT_REPO)
    parser.add_argument("--game", type=Path, default=DEFAULT_GAME)
    parser.add_argument("--sdk-assets", type=Path, default=DEFAULT_SDK)
    parser.add_argument(
        "--output",
        type=Path,
        help="staging directory; defaults to tools/import/output/leader-portrait-staging",
    )
    args = parser.parse_args()

    for label, p in (("repository", args.repo), ("game", args.game), ("SDK Assets", args.sdk_assets)):
        if not p.is_dir():
            parser.error(f"{label} directory not found: {p}")

    output = args.output or (args.repo / "tools" / "import" / "output" / "leader-portrait-staging")
    leader_dir = output / "leader"
    atlas_dir = output / "decoded-atlases"

    # Never remove anything outside the exact staging directory.
    output.mkdir(parents=True, exist_ok=True)
    leader_dir.mkdir(parents=True, exist_ok=True)
    atlas_dir.mkdir(parents=True, exist_ok=True)

    atlases, definitions, xml_count = parse_icon_database(args.game)

    results = []
    parser_cache = {}

    for number, leader_id in enumerate(TARGET_LEADERS, 1):
        print(f"[{number:02d}/{len(TARGET_LEADERS):02d}] {leader_id}")
        selected, all_sources = choose_official_source(
            leader_id, atlases, definitions, args.game
        )
        record = {
            "id": leader_id,
            "officialIcon": icon_name_for_leader(leader_id),
            "status": "source-not-found",
            "sourceCandidates": all_sources,
        }

        if not selected:
            record["error"] = "No matching official atlas texture was found in the expected retail UI Icons.blp"
            results.append(record)
            print("  ! official source not found")
            continue

        record.update({
            "atlas": selected["atlas"],
            "atlasIndex": selected["index"],
            "iconSize": selected["size"],
            "iconsPerRow": selected["columns"],
            "atlasTexture": selected["filename"],
            "sourceTexture": selected["assetName"],
            "sourceType": "retail-civblp-ui-icons",
            "sourcePath": selected["archive"],
            "definitionXml": selected["definitionXml"],
            "atlasXml": selected["atlasXml"],
        })

        if selected["size"] < 256:
            record["status"] = "largest-official-size-below-256"
            record["error"] = f"Largest located official icon size is {selected['size']}"
            results.append(record)
            print(f"  ! only {selected['size']}px located")
            continue

        archive = Path(selected["archive"])
        cache_key = (str(archive), selected["assetName"])
        try:
            # The package base is derived from the selected asset name. Cache by
            # archive after the first successful parser because the base is archive-wide.
            archive_key = str(archive)
            if archive_key in parser_cache:
                blp = parser_cache[archive_key]
            else:
                blp = Civ6UIBlp(archive, selected["assetName"])
                parser_cache[archive_key] = blp

            atlas_image, diagnostics = blp.decode_rgba_texture(selected["assetName"])
            record["decodedAtlasWidth"] = atlas_image.width
            record["decodedAtlasHeight"] = atlas_image.height
            record["blpDiagnostics"] = diagnostics

            size = selected["size"]
            index = selected["index"]
            columns = selected["columns"]
            left = (index % columns) * size
            top = (index // columns) * size
            right = left + size
            bottom = top + size

            if right > atlas_image.width or bottom > atlas_image.height:
                raise ValueError(
                    f"official crop ({left},{top},{right},{bottom}) exceeds decoded "
                    f"atlas {atlas_image.width}x{atlas_image.height}"
                )

            crop = atlas_image.crop((left, top, right, bottom)).convert("RGBA")
            record["crop"] = {
                "left": left,
                "top": top,
                "right": right,
                "bottom": bottom,
                "width": crop.width,
                "height": crop.height,
            }
            record.update(alpha_metadata(crop))
            record["rgbaSha256"] = rgba_hash(crop)

            staged = leader_dir / f"{leader_id}.webp"
            crop.save(staged, "WEBP", lossless=True, method=6)
            record["stagedPath"] = str(staged)
            record["stagedRelativePath"] = staged.relative_to(args.repo).as_posix()
            record["webpSha256"] = sha256_file(staged)
            record["status"] = "candidate-extracted"

            # Keep the decoded full atlas as PNG in staging for audit/debug.
            atlas_out = atlas_dir / f"{leader_id}__{selected['assetName']}.png"
            atlas_image.save(atlas_out, "PNG")
            record["decodedAtlasPath"] = str(atlas_out)
            record["decodedAtlasRelativePath"] = atlas_out.relative_to(args.repo).as_posix()

            print(
                f"  OK {selected['assetName']} | atlas={selected['atlas']} "
                f"index={index} crop={size}x{size}"
            )
        except Exception as exc:
            record["status"] = "extraction-error"
            record["error"] = f"{type(exc).__name__}: {exc}"
            print(f"  ! {record['error']}")

        results.append(record)

    # Duplicate analysis using decoded RGBA hashes, not just encoded file bytes.
    hash_groups = defaultdict(list)
    for r in results:
        if r.get("status") == "candidate-extracted":
            hash_groups[r["rgbaSha256"]].append(r["id"])

    duplicate_groups = [
        {"rgbaSha256": h, "leaders": ids}
        for h, ids in hash_groups.items()
        if len(ids) > 1
    ]

    metadata = {
        "purpose": "staged genuine Civ VI ruler portrait candidates; corrected CIVBLP parser; not yet visually approved",
        "readOnlyGameAndSdk": True,
        "websiteImagesOverwritten": False,
        "iconXmlFilesParsed": xml_count,
        "targetCount": len(TARGET_LEADERS),
        "extractedCandidateCount": sum(r.get("status") == "candidate-extracted" for r in results),
        "failedCount": sum(r.get("status") != "candidate-extracted" for r in results),
        "duplicateGroups": duplicate_groups,
        "leaders": results,
    }

    metadata_path = output / "leader-portrait-staging.json"
    metadata_path.write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    contact_sheet = output / "leader-portraits-contact-sheet.png"
    build_contact_sheet(results, contact_sheet)

    # Compact summary for upload/review.
    summary = {
        "extractedCandidateCount": metadata["extractedCandidateCount"],
        "failedCount": metadata["failedCount"],
        "duplicateGroups": duplicate_groups,
        "contactSheet": str(contact_sheet),
        "metadata": str(metadata_path),
    }
    (output / "summary.json").write_text(
        json.dumps(summary, indent=2) + "\n",
        encoding="utf-8",
    )

    evidence_zip = output / "leader-portrait-staging-evidence.zip"
    with zipfile.ZipFile(evidence_zip, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(metadata_path, arcname="leader-portrait-staging.json")
        zf.write(contact_sheet, arcname="leader-portraits-contact-sheet.png")
        zf.write(output / "summary.json", arcname="summary.json")
        for r in results:
            if r.get("status") == "candidate-extracted":
                p = Path(r["stagedPath"])
                zf.write(p, arcname=f"leader/{p.name}")

    print()
    print(json.dumps(summary, indent=2))
    print()
    print("Staging only: no website leader image was overwritten.")
    print(f"Upload this file for visual review: {evidence_zip}")

    return 0 if metadata["failedCount"] == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
