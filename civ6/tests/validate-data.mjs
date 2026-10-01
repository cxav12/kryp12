import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataRoot = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "data");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const catalog = await readJson(path.join(dataRoot, "catalog.json"));
const ids = new Set();
const records = [];
const errors = [];

for (const collection of catalog.collections || []) {
  const payload = await readJson(path.join(dataRoot, collection.file));
  if (payload.sampleData !== catalog.sampleData) errors.push(`${collection.file}: sampleData must match catalog.json`);
  for (const record of payload.records || []) {
    if (!record.id || !record.name) errors.push(`${collection.file}: every record requires id and name`);
    if (ids.has(record.id)) errors.push(`Duplicate ID: ${record.id}`);
    ids.add(record.id);
    records.push({ ...record, collection });
    if (!Array.isArray(record.rulesets) || !record.rulesets.length) errors.push(`${record.id}: rulesets must be a non-empty array`);
    if (!record.gameData || !record.strategy) errors.push(`${record.id}: gameData and strategy must remain separate objects`);
  }
  await access(path.join(root, collection.route, "index.html"));
}

const knownRulesets = new Set(["base-game", "rise-and-fall", "gathering-storm"]);
for (const record of records) {
  for (const ruleset of record.rulesets) if (!knownRulesets.has(ruleset)) errors.push(`${record.id}: unknown ruleset ${ruleset}`);
}

const recordsById = new Map(records.map((record) => [record.id, record]));
for (const civilization of records.filter((record) => record.collection.type === "civilization")) {
  if (!civilization.leaders?.length) errors.push(`${civilization.id}: civilization requires at least one leader`);
  for (const leaderId of civilization.leaders || []) {
    const leader = recordsById.get(leaderId);
    if (!leader || leader.collection.type !== "leader") errors.push(`${civilization.id}: unknown leader ${leaderId}`);
    else if (!leader.image) errors.push(`${leaderId}: leader shown on civilization cards requires an image`);
  }
}
const linkedLeaderIds = new Set(records.filter((record) => record.collection.type === "civilization").flatMap((record) => record.leaders || []));
for (const leader of records.filter((record) => record.collection.type === "leader" && record.id !== "leader_free_cities")) {
  if (!linkedLeaderIds.has(leader.id)) errors.push(`${leader.id}: playable leader is not linked to a civilization`);
}

const searchIndex = await readJson(path.join(dataRoot, "search-index.json"));
const searchIds = new Set((searchIndex.records || []).map((record) => record.id));
for (const id of ids) if (!searchIds.has(id)) errors.push(`Search index is missing ${id}`);
for (const id of searchIds) if (!ids.has(id)) errors.push(`Search index contains unknown ID ${id}`);

const guides = await readJson(path.join(dataRoot, "decision-guides.json"));
const guideIds = new Set();
for (const guide of guides.records || []) {
  if (!guide.id || !guide.title || !guide.summary || !guide.answer) errors.push("Every decision guide requires id, title, summary, and answer");
  if (guideIds.has(guide.id)) errors.push(`Duplicate guide ID: ${guide.id}`);
  guideIds.add(guide.id);
  if (!guide.steps?.length || !guide.quickChecks?.length || !guide.tips?.length || !guide.mistakes?.length) errors.push(`${guide.id}: guide sections must not be empty`);
  for (const relatedId of guide.relatedIds || []) if (!ids.has(relatedId)) errors.push(`${guide.id}: unknown related record ${relatedId}`);
}
if (guideIds.size !== 9) errors.push(`Expected 9 decision guides, found ${guideIds.size}`);

await Promise.all(["index.html", "guides/index.html", "css/styles.css", "js/app.js", "js/components.js", "js/data-store.js", "README.md"].map((file) => access(path.join(root, file))));

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Validated ${records.length} ${catalog.sampleData ? "sample" : "imported"} records across ${catalog.collections.length} collections.`);
}
