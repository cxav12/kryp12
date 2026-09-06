const SEASON = 2026;
const ESPN_LEADERS_API = "https://site.api.espn.com/apis/site/v3/sports/football/nfl/leaders";
const state = { scope: "player", group: "offense", qualified: true, categories: [], categoryIndex: 0, cache: new Map() };
const els = {
  status: document.querySelector("#stats-status"), title: document.querySelector("#stats-view-title"),
  summary: document.querySelector("#stats-summary"), categories: document.querySelector("#category-tabs"),
  head: document.querySelector("#stats-head"), body: document.querySelector("#stats-body"),
  qualified: document.querySelector("#qualified-only"),
};
const OFFENSE_PATTERN = /pass|rush|receiv|reception|completion|attempt|touchdown|yard|quarterback|scor/i;
const DEFENSE_PATTERN = /tackl|sack|interception|forced|fumble|defen|pass def|quarterback hit|safety/i;

function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
function teamLogo(abbr) { return `https://a.espncdn.com/i/teamlogos/nfl/500/${String(abbr || "nfl").toLowerCase()}.png`; }
function headshot(id) { return id ? `https://a.espncdn.com/i/headshots/nfl/players/full/${id}.png` : ""; }
async function getJson(url) { const response = await fetch(url); if (!response.ok) throw new Error(`Statistics request returned ${response.status}`); return response.json(); }
function endpoint() {
  const params = new URLSearchParams({ region: "us", lang: "en", contentorigin: "espn", sport: "football", league: "nfl", season: SEASON, limit: "100", isqualified: String(state.qualified), type: state.scope === "team" ? "team" : "player" });
  return `${ESPN_LEADERS_API}?${params}`;
}
function findCategoryArrays(root) {
  const found = []; const visited = new Set(); const queue = [root];
  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== "object" || visited.has(value)) continue;
    visited.add(value);
    if (Array.isArray(value.categories) && value.categories.some((category) => Array.isArray(category?.leaders))) found.push(value.categories);
    Object.values(value).forEach((child) => { if (child && typeof child === "object") queue.push(child); });
  }
  return found.sort((a, b) => b.length - a.length)[0] || [];
}
function normalizeCategory(category) {
  return {
    name: category.name || category.abbreviation || category.displayName || "stat",
    label: category.displayName || category.shortDisplayName || category.label || category.name || "Statistic",
    leaders: category.leaders || [],
  };
}
function relevantCategories(categories) {
  const pattern = state.group === "offense" ? OFFENSE_PATTERN : DEFENSE_PATTERN;
  const opposite = state.group === "offense" ? DEFENSE_PATTERN : OFFENSE_PATTERN;
  const exact = categories.filter((category) => pattern.test(`${category.name} ${category.label}`) && !opposite.test(`${category.name} ${category.label}`));
  return exact.length ? exact : categories.filter((category) => pattern.test(`${category.name} ${category.label}`));
}
function leaderEntity(leader) { return leader.athlete || leader.player || leader.team || leader.competitor || {}; }
function leaderTeam(leader) {
  const entity = leaderEntity(leader);
  return leader.team || entity.team || entity.proTeam || (entity.abbreviation ? entity : {}) || {};
}
function teamAbbr(leader) { const team = leaderTeam(leader); return team.abbreviation || team.shortDisplayName || team.slug?.toUpperCase() || "NFL"; }
function leaderName(leader) {
  const entity = leaderEntity(leader);
  return entity.displayName || entity.fullName || entity.shortName || entity.name || leader.displayName || "NFL Leader";
}
function leaderValue(leader) { return leader.displayValue ?? leader.value ?? leader.statValue ?? leader.statistics?.[0]?.displayValue ?? leader.statistics?.[0]?.value ?? "—"; }
function leaderId(leader) { return leaderEntity(leader).id || ""; }
function filteredLeaders(category) {
  const leaders = category?.leaders || [];
  return state.scope === "ravens" ? leaders.filter((leader) => teamAbbr(leader) === "BAL") : leaders;
}
function renderCategoryTabs() {
  els.categories.innerHTML = state.categories.map((category, index) => `<button class="${index === state.categoryIndex ? "active" : ""}" type="button" data-category-index="${index}">${escapeHtml(category.label)}</button>`).join("");
}
function renderTable() {
  const category = state.categories[state.categoryIndex]; const leaders = filteredLeaders(category);
  const entityLabel = state.scope === "team" ? "Team" : "Player";
  els.head.innerHTML = `<tr><th>Rank</th><th>${entityLabel}</th><th>${state.scope === "team" ? "Conference" : "Team"}</th><th>${escapeHtml(category?.label || "Stat")}</th></tr>`;
  if (!category || !leaders.length) {
    const message = state.scope === "ravens" ? "No qualifying Ravens are listed for this category yet." : "No 2026 leaders are available for this category yet.";
    els.body.innerHTML = `<tr class="stats-empty"><td colspan="4">${escapeHtml(message)}</td></tr>`;
    return;
  }
  els.body.innerHTML = leaders.slice(0, 100).map((leader, index) => {
    const entity = leaderEntity(leader); const abbr = teamAbbr(leader); const id = leaderId(leader); const isTeam = state.scope === "team";
    const image = isTeam ? (entity.logos?.[0]?.href || entity.logo || teamLogo(abbr)) : (entity.headshot?.href || entity.headshot || headshot(id));
    const href = !isTeam && id && abbr === "BAL" ? `./player-profile/?player=${encodeURIComponent(id)}` : "";
    const identity = `${href ? `<a class="leader-identity" href="${href}">` : `<span class="leader-identity">`}<img src="${escapeHtml(image)}" alt="" onerror="this.style.visibility='hidden'"><span>${escapeHtml(leaderName(leader))}</span>${href ? "</a>" : "</span>"}`;
    const secondary = isTeam ? (entity.groups?.name || entity.conference || "NFL") : `<span class="team-cell"><img src="${escapeHtml(teamLogo(abbr))}" alt="">${escapeHtml(abbr)}</span>`;
    return `<tr class="${abbr === "BAL" ? "ravens-row" : ""}"><td>${escapeHtml(leader.rank || index + 1)}</td><td>${identity}</td><td>${secondary}</td><td class="stat-value">${escapeHtml(leaderValue(leader))}</td></tr>`;
  }).join("");
}
function render() {
  els.title.textContent = `${state.group === "offense" ? "Offensive" : "Defensive"} Leaders`;
  els.summary.textContent = `${state.scope === "player" ? "NFL players" : state.scope === "ravens" ? "Baltimore Ravens players" : "NFL teams"} · ${state.qualified ? "qualified leaders" : "all listed leaders"}`;
  renderCategoryTabs(); renderTable();
}
async function loadStats() {
  const key = `${state.scope === "team" ? "team" : "player"}-${state.qualified}`; els.status.textContent = "Loading 2026 statistics";
  try {
    let data = state.cache.get(key);
    if (!data) { data = await getJson(endpoint()); state.cache.set(key, data); }
    const categories = findCategoryArrays(data).map(normalizeCategory); state.categories = relevantCategories(categories); state.categoryIndex = 0;
    render(); els.status.textContent = "2026 ESPN data";
  } catch (error) {
    state.categories = []; renderCategoryTabs(); renderTable();
    const seasonNotStarted = /404/.test(error.message);
    els.status.textContent = seasonNotStarted ? "Awaiting 2026 Week 1" : "Statistics unavailable";
    els.summary.textContent = seasonNotStarted ? "2026 regular-season leaders will appear after games begin" : error.message;
  }
}
function activate(container, selected) { container.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button === selected)); }
document.querySelector("#scope-toggle").addEventListener("click", (event) => { const button = event.target.closest("[data-scope]"); if (!button) return; state.scope = button.dataset.scope; activate(event.currentTarget, button); loadStats(); });
document.querySelector("#group-toggle").addEventListener("click", (event) => { const button = event.target.closest("[data-group]"); if (!button) return; state.group = button.dataset.group; activate(event.currentTarget, button); const cached = state.cache.get(`${state.scope === "team" ? "team" : "player"}-${state.qualified}`); if (cached) { state.categories = relevantCategories(findCategoryArrays(cached).map(normalizeCategory)); state.categoryIndex = 0; render(); } else loadStats(); });
els.qualified.addEventListener("change", () => { state.qualified = els.qualified.checked; loadStats(); });
els.categories.addEventListener("click", (event) => { const button = event.target.closest("[data-category-index]"); if (!button) return; state.categoryIndex = Number(button.dataset.categoryIndex); render(); });
loadStats();
