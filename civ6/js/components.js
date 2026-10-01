const NAV_ITEMS = [
  ["home", "Home", ""],
  ["civilizations", "Civilizations", "civilizations/"],
  ["tech", "Tech", "tech/"],
  ["civics", "Civics", "civics/"],
  ["policies", "Policies", "policies/"],
  ["resources", "Resources", "resources/"],
  ["districts", "Districts", "districts/"],
  ["buildings", "Buildings", "buildings/"],
  ["wonders", "Wonders", "wonders/"],
  ["guides", "Guides", "guides/"],
];

const LEADER_PORTRAIT_VERSION = "20260926-civblp1";

export const RULESETS = [
  ["base-game", "Base Game"],
  ["rise-and-fall", "Rise & Fall"],
  ["gathering-storm", "Gathering Storm"],
];

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
}

export function imageSource(image) {
  if (!image) return "";
  const separator = image.includes("?") ? "&" : "?";
  return image.includes("/assets/icons/leader/") ? `${image}${separator}v=${LEADER_PORTRAIT_VERSION}` : image;
}

export function titleCase(value) {
  return String(value || "").replaceAll("_", " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function badge(text, tone = "") {
  return `<span class="badge${tone ? ` badge-${escapeHtml(tone.toLowerCase().replaceAll(" ", "-"))}` : ""}">${escapeHtml(text)}</span>`;
}

export function entityLink(store, id) {
  if (!id) return "—";
  const href = store.href(id);
  const label = store.label(id);
  return href ? `<a class="entity-link" href="${href}">${escapeHtml(label)}</a>` : `<span>${escapeHtml(label)}</span>`;
}

export function renderHeader(activePage, ruleset) {
  const links = NAV_ITEMS.map(([key, label, path]) => `<a class="site-nav-link${key === activePage ? " active" : ""}" href="/civ6/${path}"${key === activePage ? ' aria-current="page"' : ""}>${label}</a>`).join("");
  const options = RULESETS.map(([value, label]) => `<option value="${value}"${value === ruleset ? " selected" : ""}>${label}</option>`).join("");
  document.querySelector("#site-header").innerHTML = `
    <div class="header-inner">
      <a class="brand" href="/civ6/" aria-label="Civilization VI Companion home"><span class="brand-mark" aria-hidden="true">VI</span><span><strong>Civilization VI</strong><small>Companion</small></span></a>
      <button class="mobile-nav-toggle" type="button" aria-expanded="false" aria-controls="primary-navigation">Menu</button>
      <nav class="site-nav" id="primary-navigation" aria-label="Primary navigation">${links}</nav>
      <label class="ruleset-control"><span>Ruleset</span><select id="ruleset-select">${options}</select></label>
    </div>`;
  const toggle = document.querySelector(".mobile-nav-toggle");
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!open));
    document.querySelector(".site-nav").classList.toggle("open", !open);
  });
}

export function renderFooter() {
  document.querySelector("#site-footer").innerHTML = `<div class="site-shell footer-inner"><span>Independent Civilization VI companion.</span><span>Imported game data · Gathering Storm default</span></div>`;
}

export function searchMarkup({ id = "global-search", large = false, placeholder = "Search civilizations, technologies, resources…" } = {}) {
  return `<div class="search-shell${large ? " search-shell-large" : ""}" data-search-shell>
    <label class="sr-only" for="${id}">Search the Civilization VI companion</label>
    <span class="search-icon" aria-hidden="true">⌕</span>
    <input id="${id}" type="search" autocomplete="off" placeholder="${escapeHtml(placeholder)}" aria-controls="${id}-results" aria-expanded="false">
    <div class="search-results" id="${id}-results" role="listbox" hidden></div>
  </div>`;
}

export function mountSearch(shell, store, getRuleset) {
  const input = shell.querySelector("input");
  const results = shell.querySelector(".search-results");
  const close = () => { results.hidden = true; input.setAttribute("aria-expanded", "false"); };
  const update = () => {
    const matches = store.search(input.value, getRuleset());
    if (!input.value.trim()) { close(); return; }
    results.innerHTML = matches.length
      ? matches.map((record) => `<a role="option" href="${store.href(record)}"><span class="result-mark" aria-hidden="true">${record.image ? `<img src="${escapeHtml(imageSource(record.image))}" alt="">` : escapeHtml(record.name.slice(0, 1))}</span><span><strong>${escapeHtml(record.name)}</strong><small>${escapeHtml(record._typeLabel)}</small></span></a>`).join("")
      : `<p>No records match “${escapeHtml(input.value)}”.</p>`;
    results.hidden = false;
    input.setAttribute("aria-expanded", "true");
  };
  input.addEventListener("input", update);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") { input.value = ""; close(); }
    if (event.key === "ArrowDown" && !results.hidden) { event.preventDefault(); results.querySelector("a")?.focus(); }
  });
  document.addEventListener("click", (event) => { if (!shell.contains(event.target)) close(); });
}

function civilizationRulers(record, store) {
  if (record._type !== "civilization") return "";
  const rulers = (record.leaders || []).map((id) => store.get(id)).filter(Boolean);
  if (!rulers.length) return "";
  return `<div class="card-rulers" aria-label="Rulers and variants">
    <span class="card-rulers-label">${rulers.length === 1 ? "Ruler" : "Rulers & variants"}</span>
    <div class="card-ruler-list">${rulers.map((ruler) => `<a class="card-ruler" href="${store.href(ruler)}" aria-label="Open ${escapeHtml(ruler.name)}"><span class="card-ruler-portrait" aria-hidden="true">${ruler.image ? `<img src="${escapeHtml(imageSource(ruler.image))}" alt="" loading="lazy" decoding="async">` : escapeHtml(ruler.name.slice(0, 1))}</span><span>${escapeHtml(ruler.name)}</span></a>`).join("")}</div>
  </div>`;
}

export function recordCard(record, store) {
  const summary = record.strategy?.summary || record.strategy?.whyItMatters || record.strategy?.whyBuild || record.gameData?.description || record.gameData?.effect || "Reference record";
  const meta = [record.type, record.era, record.gameData?.abilityName].filter(Boolean).slice(0, 2);
  return `<article class="info-card">
    <a class="card-hit-area" href="${store.href(record)}" aria-label="Open ${escapeHtml(record.name)}"></a>
    <div class="card-icon" aria-hidden="true">${record.image ? `<img src="${escapeHtml(imageSource(record.image))}" alt="" loading="lazy" decoding="async">` : escapeHtml(record.name.slice(0, 2).toUpperCase())}</div>
    <div class="card-copy"><div class="card-badges">${badge(record._typeLabel)}${meta.map((item) => badge(item, item)).join("")}</div><h3>${escapeHtml(record.name)}</h3><p>${escapeHtml(summary)}</p>${civilizationRulers(record, store)}</div>
    <span class="card-arrow" aria-hidden="true">→</span>
  </article>`;
}
