#!/usr/bin/env python3
"""Read-only Civ VI CIVBLP ForgeUI texture decoder used by the asset importer."""

from __future__ import annotations

import math
import struct
from pathlib import Path

from PIL import Image

ENTRY_MAP_MARKER = b"BLP::Package::EntryMap"


class Civ6UIBlp:
    """
    Minimal read-only Civ VI CIVBLP parser for ForgeUI UI textures.

    This supports the retail Civilization VI UI Icons.blp packages used by the
    game's IconTextureAtlases. It reconstructs lossless RGBA texture atlases
    from Firaxis's serialized block-deduplicated representation.

    The parser never writes to the BLP file.
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

        candidate = marker_pos + len(ENTRY_MAP_MARKER) + 1
        if candidate + 40 > self.big_data_offset:
            raise ValueError("allocation table candidate lies outside package data")

        first = self._decode_alloc(self.data[candidate:candidate + 40])
        if not self._plausible_alloc(first):
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
            raise ValueError(
                f"implausibly small PackageAllocation table ({len(result)} entries)"
            )
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
                        candidates.append(
                            (self._score_package_base(base), base, alloc["index"])
                        )

        if not candidates:
            raise ValueError(f"could not derive PackageBlock base from {anchor_name!r}")

        candidates.sort(reverse=True)
        score, base, _ = candidates[0]
        if score < 2:
            raise ValueError(
                f"PackageBlock base for {anchor_name!r} failed validation "
                f"(string score={score})"
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
