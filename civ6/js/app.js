import { createDataStore } from "./data-store.js?v=20260926-rulers1";
import { RULESETS, badge, entityLink, escapeHtml, imageSource, mountSearch, recordCard, renderFooter, renderHeader, searchMarkup, titleCase } from "./components.js?v=20260926-guides1";

const page = document.body.dataset.page || "home";
let ruleset = localStorage.getItem("civ6-ruleset") || "gathering-storm";
const main = document.querySelector("#main-content");

function list(value) { return Array.isArray(value) ? value : value === null || value === undefined ? [] : [value]; }

function relationList(store, values) {
  const items = list(values);
  return items.length ? `<div class="link-list">${items.map((id) => entityLink(store, id)).join("")}</div>` : "—";
}

function simpleValue(value, store) {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return relationList(store, value);
  if (typeof value === "object") return `<div class="yield-list">${Object.entries(value).map(([key, amount]) => `<span>${escapeHtml(titleCase(key))} <strong>+${escapeHtml(amount)}</strong></span>`).join("")}</div>`;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && /^(civilization|leader|tech|civic|policy|resource|district|building|wonder|improvement|unit|government)_/.test(value)) return entityLink(store, value);
  return escapeHtml(value);
}

function infoRows(data, store) {
  return Object.entries(data || {}).filter(([, value]) => value !== null && value !== undefined && (!Array.isArray(value) || value.length)).map(([key, value]) => `<div class="stat-row"><dt>${escapeHtml(titleCase(key))}</dt><dd>${simpleValue(value, store)}</dd></div>`).join("");
}

function strategyPanel(strategy = {}) {
  const prose = [["Overview", strategy.summary], ["Why it matters", strategy.whyItMatters], ["Playstyle", strategy.playstyle], ["Why build it?", strategy.whyBuild], ["When is it useful?", strategy.whenUseful], ["When should I skip it?", strategy.whenToSkip]].filter(([, text]) => text);
  const lists = [["Strengths", strategy.strengths, "strength"], ["Weaknesses", strategy.weaknesses, "weakness"], ["Early priorities", strategy.priorities, ""], ["Placement tips", strategy.placementTips, ""], ["Practical notes", strategy.tips, ""], ["Common mistakes", strategy.commonMistakes, "warning"]].filter(([, items]) => items?.length);
  if (!prose.length && !lists.length) return "";
  return `<section class="detail-section strategy-panel"><p class="eyebrow">Decision help</p><h2>Practical strategy</h2><div class="strategy-grid">
    ${prose.map(([title, text]) => `<div><h3>${title}</h3><p>${escapeHtml(text)}</p></div>`).join("")}
    ${lists.map(([title, items, tone]) => `<div class="strategy-list${tone ? ` ${tone}` : ""}"><h3>${title}</h3><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`).join("")}
  </div></section>`;
}

function relatedRecords(record, store) {
  const ids = new Set();
  const visit = (value) => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (typeof value === "string" && store.get(value)) ids.add(value);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(record.leaders);
  visit(record.gameData);
  visit(record.strategy);
  const records = [...ids].map((id) => store.get(id)).filter(Boolean).slice(0, 8);
  return records.length ? `<section class="detail-section"><p class="eyebrow">Connected reference</p><h2>Related items</h2><div class="related-grid">${records.map((item) => recordCard(item, store)).join("")}</div></section>` : "";
}

function detailView(record, store) {
  const rulesetBadges = (record.rulesets || []).map((value) => badge(RULESETS.find(([id]) => id === value)?.[1] || value, "ruleset")).join("");
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/civ6/">Home</a><span>/</span><a href="/civ6/${record._route}/">${escapeHtml(record._typeLabel)}s</a><span>/</span><span aria-current="page">${escapeHtml(record.name)}</span></nav>
    <article class="detail-layout">
      <header class="detail-hero"><div class="detail-icon" aria-hidden="true">${record.image ? `<img src="${escapeHtml(imageSource(record.image))}" alt="">` : escapeHtml(record.name.slice(0, 2).toUpperCase())}</div><div><div class="card-badges">${badge(record._typeLabel)}${record.type ? badge(record.type, record.type) : ""}${record.era ? badge(record.era, record.era) : ""}</div><h1>${escapeHtml(record.name)}</h1><p>${escapeHtml(record.strategy?.summary || record.strategy?.whyItMatters || record.gameData?.description || record.gameData?.effect || "Sample reference record")}</p><div class="ruleset-badges">${rulesetBadges}</div></div></header>
      <section class="detail-section"><p class="eyebrow">Game data</p><h2>Reference</h2><dl class="stat-list">${infoRows(record._type === "civilization" ? { leaders: record.leaders, ...record.gameData } : record.gameData, store)}</dl></section>
      ${strategyPanel(record.strategy)}
      ${relatedRecords(record, store)}
    </article>`;
}

const PAGE_CONFIG = {
  civilizations: { type: "civilization", title: "Civilizations & Leaders", eyebrow: "Choose a civilization", description: "Compare defining abilities, playstyles, priorities, strengths, and tradeoffs." },
  tech: { type: "technology", title: "Technology Reference", eyebrow: "Science tree", description: "See prerequisites, unlocks, Eurekas, and the practical reason each technology matters." },
  civics: { type: "civic", title: "Civics Reference", eyebrow: "Culture tree", description: "Trace Inspirations, policy unlocks, governments, and strategic breakpoints." },
  policies: { type: "policy", title: "Policy Cards", eyebrow: "Government loadout", description: "Find the policy that supports your immediate production, economy, military, or diplomatic goal." },
  resources: { type: "resource", title: "Resources", eyebrow: "Tile decisions", description: "Understand yields, improvements, requirements, strategic uses, and when harvesting makes sense." },
  districts: { type: "district", title: "Districts", eyebrow: "City planning", description: "Review adjacency, placement restrictions, buildings, and practical placement tips." },
  buildings: { type: "building", title: "Buildings", eyebrow: "City infrastructure", description: "Compare costs, prerequisites, yields, specialist chains, and related districts." },
  wonders: { type: "wonder", title: "Wonders", eyebrow: "Major investments", description: "Check requirements, effects, and whether a wonder fits the current game plan." },
};

function filterOptions(records) {
  const values = [...new Set(records.map((record) => record.type || record.era).filter(Boolean))].sort();
  return values.length > 1 ? `<label class="filter-select"><span>Category</span><select data-collection-filter><option value="">All categories</option>${values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}</select></label>` : "";
}

function browserView(config, store) {
  const selectedId = new URLSearchParams(location.search).get("id");
  if (selectedId) {
    const record = store.get(selectedId);
    if (record && (record._route === page || (page === "civilizations" && ["leader", "unit"].includes(record._type)) || (page === "resources" && record._type === "improvement") || (page === "civics" && record._type === "government"))) return detailView(record, store);
    return `<section class="empty-state"><h1>Reference not found</h1><p>This record is not included in the imported dataset.</p><a class="button" href="/civ6/${page}/">Return to ${escapeHtml(config.title)}</a></section>`;
  }
  const all = store.collection(config.type);
  const available = all.filter((record) => store.isAvailable(record, ruleset));
  return `<section class="page-hero"><div><p class="eyebrow">${escapeHtml(config.eyebrow)}</p><h1>${escapeHtml(config.title)}</h1><p>${escapeHtml(config.description)}</p></div>${searchMarkup({ id: `${page}-search`, placeholder: `Search ${config.title.toLowerCase()}…` })}</section>
    <section class="browser-panel" aria-labelledby="browser-heading"><div class="filter-bar"><div><h2 id="browser-heading">Browse records</h2><p data-result-count>${available.length} records for ${escapeHtml(RULESETS.find(([id]) => id === ruleset)?.[1] || ruleset)}</p></div><div class="filter-controls"><label class="filter-search"><span>Filter this list</span><input type="search" data-list-filter placeholder="Type a name or keyword"></label>${filterOptions(available)}</div></div><div class="card-grid" data-record-grid>${available.map((record) => recordCard(record, store)).join("")}</div><p class="no-results" data-no-results hidden>No records match these filters.</p></section>`;
}

const QUICK_LINKS = [
  ["Civilizations & Leaders", "Compare abilities, playstyles, and priorities.", "civilizations", "CI"],
  ["Resources", "Improve, harvest, trade, or secure them.", "resources", "RE"],
  ["Technology Tree", "Follow prerequisites and unlocks.", "tech", "TE"],
  ["Civics Tree", "Plan governments and policy unlocks.", "civics", "CV"],
  ["Policy Cards", "Find the right bonus for the moment.", "policies", "PO"],
  ["Districts", "Plan adjacency and city specialization.", "districts", "DI"],
  ["Buildings", "Understand infrastructure chains.", "buildings", "BU"],
  ["Wonders", "Evaluate major production commitments.", "wonders", "WO"],
];

const QUESTIONS = [
  ["I'm low on Amenities", "amenities"],
  ["I'm falling behind in Science", "science-recovery"],
  ["I'm falling behind in Culture", "culture-recovery"],
  ["Where should I settle?", "settle-city"],
  ["Should I harvest this resource?", "harvest-resource"],
  ["Which district should I build?", "district-choice"],
  ["Which government should I use?", "government-choice"],
  ["I found Iron or Uranium—what now?", "strategic-resource"],
  ["What should I build in a new city?", "new-city-build"],
];

function homeView(store) {
  return `<section class="home-hero"><div><p class="eyebrow">Fast decisions while you play</p><h1>What are you looking for?</h1><p>Search a resource, technology, policy, civilization, district, building, or wonder and get the useful answer quickly.</p>${searchMarkup({ id: "home-search", large: true, placeholder: "Try “uran”, “Mining”, or “Urban Planning”" })}</div><div class="hero-orbit" aria-hidden="true"><span>SCIENCE</span><span>CULTURE</span><span>PRODUCTION</span><strong>VI</strong></div></section>
    <section class="home-section"><div class="section-heading"><div><p class="eyebrow">Quick reference</p><h2>Choose a category</h2></div><p>Jump directly to the information you need.</p></div><div class="quick-grid">${QUICK_LINKS.map(([title, text, route, mark]) => `<a class="quick-card" href="/civ6/${route}/"><span>${mark}</span><div><h3>${title}</h3><p>${text}</p></div><b aria-hidden="true">→</b></a>`).join("")}</div></section>
    <section class="home-section decision-section"><div class="section-heading"><div><p class="eyebrow">Decision help</p><h2>Common questions</h2></div><p>Practical answers grounded in the site's imported game mechanics.</p></div><div class="question-grid">${QUESTIONS.map(([question, id]) => `<a class="question-card" href="/civ6/guides/?id=${encodeURIComponent(id)}"><span aria-hidden="true">?</span><div><h3>${escapeHtml(question)}</h3><p>Open guide</p></div><b aria-hidden="true">→</b></a>`).join("")}</div></section>`;
}

async function loadGuides() {
  const response = await fetch("/civ6/data/decision-guides.json?v=20260926-guides1");
  if (!response.ok) throw new Error("The decision guides could not be loaded.");
  return response.json();
}

function guideCard(guide) {
  return `<article class="guide-card"><a class="card-hit-area" href="/civ6/guides/?id=${encodeURIComponent(guide.id)}" aria-label="Open ${escapeHtml(guide.title)}"></a><span class="guide-mark" aria-hidden="true">?</span><div><p class="eyebrow">Decision guide</p><h2>${escapeHtml(guide.title)}</h2><p>${escapeHtml(guide.summary)}</p></div><span class="card-arrow" aria-hidden="true">→</span></article>`;
}

function guideListView(payload) {
  return `<section class="page-hero"><div><p class="eyebrow">Decision help</p><h1>Practical strategy guides</h1><p>Use game mechanics to make the next decision, then adapt the recommendation to your map, civilization, and victory plan.</p></div></section>
    <section class="browser-panel"><div class="section-heading"><div><h2>Common questions</h2><p class="guide-source-note">${escapeHtml(payload.sourceNote)}</p></div></div><div class="guide-grid">${payload.records.map(guideCard).join("")}</div></section>`;
}

function guideDetailView(guide, payload, store) {
  const related = (guide.relatedIds || []).map((id) => store.get(id)).filter(Boolean);
  return `<nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/civ6/">Home</a><span>/</span><a href="/civ6/guides/">Guides</a><span>/</span><span aria-current="page">${escapeHtml(guide.title)}</span></nav>
    <article class="guide-detail">
      <header class="guide-hero"><p class="eyebrow">Decision help</p><h1>${escapeHtml(guide.title)}</h1><p>${escapeHtml(guide.summary)}</p></header>
      <section class="guide-answer"><p class="eyebrow">Short answer</p><p>${escapeHtml(guide.answer)}</p></section>
      <section class="detail-section"><p class="eyebrow">Decision process</p><h2>Work through it</h2><ol class="decision-steps">${guide.steps.map((step) => `<li><span>${escapeHtml(step.title)}</span><p>${escapeHtml(step.text)}</p></li>`).join("")}</ol></section>
      <div class="guide-two-column">
        <section class="detail-section"><p class="eyebrow">Before committing</p><h2>Quick checks</h2><ul class="check-list">${guide.quickChecks.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
        <section class="detail-section"><p class="eyebrow">Avoid these</p><h2>Common mistakes</h2><ul class="mistake-list">${guide.mistakes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
      </div>
      <section class="detail-section"><p class="eyebrow">Practical notes</p><h2>Useful nuances</h2><ul class="guide-tip-list">${guide.tips.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section>
      ${related.length ? `<section class="detail-section"><p class="eyebrow">Connected reference</p><h2>Relevant game records</h2><div class="related-grid">${related.map((record) => recordCard(record, store)).join("")}</div></section>` : ""}
      <p class="guide-source-note">${escapeHtml(payload.sourceNote)}</p>
    </article>`;
}

async function guidesView(store) {
  const payload = await loadGuides();
  const selectedId = new URLSearchParams(location.search).get("id");
  if (!selectedId) return guideListView(payload);
  const guide = payload.records.find((item) => item.id === selectedId);
  if (!guide) return `<section class="empty-state"><h1>Guide not found</h1><p>This decision guide is not available.</p><a class="button" href="/civ6/guides/">Return to guides</a></section>`;
  return guideDetailView(guide, payload, store);
}

function mountListFilters(store, config) {
  const input = document.querySelector("[data-list-filter]");
  if (!input) return;
  const select = document.querySelector("[data-collection-filter]");
  const records = store.collection(config.type).filter((record) => store.isAvailable(record, ruleset));
  const render = () => {
    const query = input.value.trim().toLowerCase();
    const category = select?.value || "";
    const filtered = records.filter((record) => (!query || JSON.stringify(record).toLowerCase().includes(query)) && (!category || record.type === category || record.era === category));
    document.querySelector("[data-record-grid]").innerHTML = filtered.map((record) => recordCard(record, store)).join("");
    document.querySelector("[data-result-count]").textContent = `${filtered.length} matching record${filtered.length === 1 ? "" : "s"}`;
    document.querySelector("[data-no-results]").hidden = Boolean(filtered.length);
  };
  input.addEventListener("input", render);
  select?.addEventListener("change", render);
}

async function init() {
  renderHeader(page, ruleset);
  renderFooter();
  try {
    const store = await createDataStore(page);
    main.innerHTML = page === "home" ? homeView(store) : page === "guides" ? await guidesView(store) : browserView(PAGE_CONFIG[page], store);
    document.querySelectorAll("[data-search-shell]").forEach((shell) => mountSearch(shell, store, () => ruleset));
    if (page !== "home" && page !== "guides") mountListFilters(store, PAGE_CONFIG[page]);
    document.querySelector("#ruleset-select").addEventListener("change", (event) => {
      ruleset = event.target.value;
      localStorage.setItem("civ6-ruleset", ruleset);
      location.reload();
    });
  } catch (error) {
    main.innerHTML = `<section class="empty-state"><h1>Companion unavailable</h1><p>${escapeHtml(error.message)}</p></section>`;
  }
}

init();
