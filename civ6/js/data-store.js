const BASE_PATH = "/civ6/";
const DATA_VERSION = "20260926-rulers1";
const COLLECTIONS = [
  { type: "civilization", label: "Civilizations", file: "civilizations.json", route: "civilizations" },
  { type: "leader", label: "Leaders", file: "leaders.json", route: "civilizations" },
  { type: "technology", label: "Technologies", file: "technologies.json", route: "tech" },
  { type: "civic", label: "Civics", file: "civics.json", route: "civics" },
  { type: "policy", label: "Policies", file: "policies.json", route: "policies" },
  { type: "resource", label: "Resources", file: "resources.json", route: "resources" },
  { type: "district", label: "Districts", file: "districts.json", route: "districts" },
  { type: "building", label: "Buildings", file: "buildings.json", route: "buildings" },
  { type: "wonder", label: "Wonders", file: "wonders.json", route: "wonders" },
  { type: "improvement", label: "Improvements", file: "improvements.json", route: "resources" },
  { type: "unit", label: "Units", file: "units.json", route: "civilizations" },
  { type: "government", label: "Governments", file: "governments.json", route: "civics" },
];
const PAGE_TYPES = {
  civilizations: ["civilization", "leader", "unit"],
  tech: ["technology"],
  civics: ["civic", "government"],
  policies: ["policy"],
  resources: ["resource", "improvement"],
  districts: ["district"],
  buildings: ["building"],
  wonders: ["wonder"],
};
const singularLabel = (label) => label.replace(/ies$/, "y").replace(/s$/, "");

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function searchableText(record) {
  return normalize([
    record.name,
    record.type,
    record.era,
    ...(record.tags || []),
    record.gameData?.abilityName,
    record.gameData?.description,
    record.strategy?.summary,
    record.strategy?.whyItMatters,
  ].filter(Boolean).join(" "));
}

export async function createDataStore(page = "home") {
  const requiredTypes = new Set(PAGE_TYPES[page] || []);
  const requiredCollections = COLLECTIONS.filter((collection) => requiredTypes.has(collection.type));
  const [indexResponse, ...collectionResponses] = await Promise.all([
    fetch(`${BASE_PATH}data/search-index.json?v=${DATA_VERSION}`),
    ...requiredCollections.map((collection) => fetch(`${BASE_PATH}data/${collection.file}?v=${DATA_VERSION}`)),
  ]);
  if (!indexResponse.ok) throw new Error("The Civ VI search index could not be loaded.");
  const indexPayload = await indexResponse.json();
  const indexedRecords = (indexPayload.records || []).map((record) => ({
    id: record.id,
    name: record.name,
    type: record.typeValue,
    era: record.era,
    tags: record.tags || [],
    rulesets: record.rulesets,
    strategy: { summary: record.summary || "" },
    image: record.image,
    _type: record.type,
    _typeLabel: record.typeLabel,
    _route: record.route,
    _summaryOnly: true,
  }));
  const byId = new Map(indexedRecords.map((record) => [record.id, record]));
  const loaded = await Promise.all(collectionResponses.map(async (response, index) => {
    const collection = requiredCollections[index];
    if (!response.ok) throw new Error(`${collection.label} data could not be loaded.`);
    const payload = await response.json();
    return (payload.records || []).map((record) => ({ ...record, _type: collection.type, _typeLabel: singularLabel(collection.label), _route: collection.route }));
  }));
  loaded.flat().forEach((record) => byId.set(record.id, record));
  const records = [...byId.values()];
  const catalog = { schemaVersion: 1, defaultRuleset: "gathering-storm", sampleData: false, collections: COLLECTIONS };

  return {
    basePath: BASE_PATH,
    catalog,
    records,
    byId,
    get(id) { return byId.get(id); },
    collection(type) { return records.filter((record) => record._type === type); },
    isAvailable(record, ruleset) { return !record.rulesets?.length || record.rulesets.includes(ruleset); },
    href(recordOrId) {
      const record = typeof recordOrId === "string" ? byId.get(recordOrId) : recordOrId;
      return record ? `${BASE_PATH}${record._route}/?id=${encodeURIComponent(record.id)}` : "";
    },
    label(id) {
      const record = byId.get(id);
      return record?.name || String(id || "").replace(/^(tech|civic|policy|resource|district|building|wonder|improvement|unit|government)_/, "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
    },
    search(query, ruleset, limit = 12) {
      const needle = normalize(query).trim();
      if (!needle) return [];
      return records
        .filter((record) => this.isAvailable(record, ruleset))
        .map((record) => {
          const name = normalize(record.name);
          const text = searchableText(record);
          let score = name === needle ? 100 : name.startsWith(needle) ? 80 : name.includes(needle) ? 60 : text.includes(needle) ? 30 : 0;
          if (!score && needle.length >= 3) {
            const parts = needle.split(/\s+/).filter(Boolean);
            score = parts.every((part) => text.includes(part)) ? 15 : 0;
          }
          return { record, score };
        })
        .filter((entry) => entry.score)
        .sort((a, b) => b.score - a.score || a.record.name.localeCompare(b.record.name))
        .slice(0, limit)
        .map((entry) => entry.record);
    },
  };
}
