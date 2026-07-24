import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_URL = "https://api.paldeck.cc/pals";
const SOURCE_ORIGIN = "https://api.paldeck.cc";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const dataDir = path.join(projectRoot, "data");
const assetsDir = path.join(projectRoot, "assets", "paldeck");
const forceDownload = process.argv.includes("--force");

function decodePaldeckHtml(html) {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\\"/g, '"')
    .replace(/\\n/g, "\n")
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\u0026/g, "&");
}

function extractJsonArray(text, key) {
  const marker = `"${key}":`;
  const markerIndex = text.indexOf(marker);

  if (markerIndex === -1) {
    throw new Error(`Could not find ${key} in the Paldeck response.`);
  }

  const start = markerIndex + marker.length;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "[") {
      depth += 1;
    } else if (character === "]") {
      depth -= 1;

      if (depth === 0) {
        return JSON.parse(text.slice(start, index + 1));
      }
    }
  }

  throw new Error(`Could not parse ${key} from the Paldeck response.`);
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getDexSortValue(dexKey) {
  const match = String(dexKey).match(/^(\d+)([A-Z]*)$/);

  if (!match) {
    return { number: Number.MAX_SAFE_INTEGER, variant: String(dexKey) };
  }

  return {
    number: Number(match[1]),
    variant: match[2] || "",
  };
}

function compareByDex(left, right) {
  const leftDex = getDexSortValue(left.dexkey);
  const rightDex = getDexSortValue(right.dexkey);

  if (leftDex.number !== rightDex.number) {
    return leftDex.number - rightDex.number;
  }

  return leftDex.variant.localeCompare(rightDex.variant);
}

function toLocalAssetUrl(sourcePath) {
  if (!sourcePath) {
    return null;
  }

  return sourcePath.replace("/assets/palworld/", "./assets/paldeck/");
}

function toSourceUrl(sourcePath) {
  if (!sourcePath) {
    return null;
  }

  return new URL(sourcePath, SOURCE_ORIGIN).toString();
}

function toAssetFilePath(localUrl) {
  return path.join(projectRoot, localUrl.replace(/^\.\//, ""));
}

function normalizeCollection(collection = {}) {
  return Object.entries(collection).map(([name, value]) => ({
    name,
    level: value.level ?? value.rank ?? null,
    icon: toLocalAssetUrl(value.icon),
    sourceIcon: toSourceUrl(value.icon),
  }));
}

function normalizePals(pals) {
  return pals.sort(compareByDex).map((pal) => ({
    id: slugify(`${pal.dexkey}-${pal.name}`),
    dexKey: pal.dexkey,
    name: pal.name,
    assetName: pal.asset_name,
    devName: pal.type,
    description: pal.description,
    rarity: pal.rarity,
    size: pal.size,
    image: toLocalAssetUrl(pal.icon),
    sourceImage: toSourceUrl(pal.icon),
    elements: normalizeCollection(pal.elements),
    workSuitability: normalizeCollection(pal.work_suitability),
    stats: pal.stats,
    partnerSkill: pal.partner_skill,
    drops: (pal.drops ?? []).map((drop) => ({
      name: drop.item_name,
      dropRate: drop.drop_rate,
      min: drop.min,
      max: drop.max,
    })),
  }));
}

function collectAssetPaths(pals) {
  const sourcePaths = new Set();

  pals.forEach((pal) => {
    if (pal.icon) {
      sourcePaths.add(pal.icon);
    }

    Object.values(pal.elements ?? {}).forEach((element) => {
      if (element.icon) {
        sourcePaths.add(element.icon);
      }
    });

    Object.values(pal.work_suitability ?? {}).forEach((work) => {
      if (work.icon) {
        sourcePaths.add(work.icon);
      }
    });
  });

  return [...sourcePaths].sort();
}

async function downloadAsset(sourcePath) {
  const localUrl = toLocalAssetUrl(sourcePath);
  const filePath = toAssetFilePath(localUrl);

  if (!forceDownload && existsSync(filePath)) {
    return { sourcePath, status: "skipped" };
  }

  await mkdir(path.dirname(filePath), { recursive: true });

  const response = await fetch(toSourceUrl(sourcePath));

  if (!response.ok) {
    throw new Error(`Could not download ${sourcePath}: ${response.status}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(filePath, bytes);

  return { sourcePath, status: "downloaded" };
}

async function downloadAssets(sourcePaths) {
  const results = [];
  const queue = [...sourcePaths];
  const workers = Array.from({ length: 8 }, async () => {
    while (queue.length > 0) {
      const sourcePath = queue.shift();
      results.push(await downloadAsset(sourcePath));
    }
  });

  await Promise.all(workers);

  return results;
}

async function main() {
  await mkdir(dataDir, { recursive: true });
  await mkdir(assetsDir, { recursive: true });

  const response = await fetch(SOURCE_URL, {
    headers: {
      "user-agent": "MySite Palworld asset importer",
    },
  });

  if (!response.ok) {
    throw new Error(`Paldeck request failed with status ${response.status}.`);
  }

  const html = await response.text();
  const decodedHtml = decodePaldeckHtml(html);
  const rawPals = extractJsonArray(decodedHtml, "initialPals");
  const pals = normalizePals(rawPals);
  const sourcePaths = collectAssetPaths(rawPals);
  const downloadResults = await downloadAssets(sourcePaths);
  const downloadedCount = downloadResults.filter(
    (result) => result.status === "downloaded",
  ).length;

  const data = {
    metadata: {
      source: {
        name: "Paldeck",
        url: SOURCE_URL,
      },
      importedAt: new Date().toISOString(),
      palCount: pals.length,
      assetCount: sourcePaths.length,
    },
    pals,
  };

  await writeFile(
    path.join(dataDir, "pals.json"),
    `${JSON.stringify(data, null, 2)}\n`,
  );

  await writeFile(
    path.join(dataDir, "paldeck-assets.json"),
    `${JSON.stringify(
      {
        metadata: data.metadata,
        assets: sourcePaths.map((sourcePath) => ({
          source: toSourceUrl(sourcePath),
          local: toLocalAssetUrl(sourcePath),
        })),
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    `Imported ${pals.length} Pals and ${sourcePaths.length} assets from Paldeck.`,
  );
  console.log(`Downloaded ${downloadedCount} assets.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
