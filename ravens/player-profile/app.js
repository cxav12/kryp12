const SEASON = 2026;
const ESPN_SITE_API = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const ESPN_WEB_API = "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl";
const state = { players: [], player: null, gameLog: null, career: null, split: "season" };
const els = {
  status: document.querySelector("#profile-status"), search: document.querySelector("#player-search"),
  options: document.querySelector("#player-options"), hero: document.querySelector("#profile-hero"),
  content: document.querySelector("#profile-content"), season: document.querySelector("#season-stats"),
  recent: document.querySelector("#recent-action"), pace: document.querySelector("#season-pace"),
  career: document.querySelector("#career-totals"), log: document.querySelector("#season-log"),
};

function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
async function getJson(url) { const response = await fetch(url); if (!response.ok) throw new Error(`Data request returned ${response.status}`); return response.json(); }
function teamLogo(abbr) { return `https://a.espncdn.com/i/teamlogos/nfl/500/${String(abbr || "nfl").toLowerCase()}.png`; }
function playerName(player) { return player?.displayName || player?.fullName || "Ravens Player"; }
function positionCode(player) { return player?.position?.abbreviation || player?.position?.name || "NFL"; }
function flattenRoster(data) { return (data.athletes || []).flatMap((group) => group.items || group.athletes || (group.id ? [group] : [])); }
function playerByInput(value) {
  const needle = String(value || "").trim().toLowerCase();
  return state.players.find((player) => playerName(player).toLowerCase() === needle)
    || state.players.find((player) => playerName(player).toLowerCase().includes(needle));
}
function preferredPlayer(players) {
  const requested = new URLSearchParams(location.search).get("player");
  return players.find((player) => String(player.id) === requested)
    || players.find((player) => /lamar jackson/i.test(playerName(player)))
    || players.find((player) => positionCode(player) === "QB")
    || players[0];
}
function headshotUrl(player) {
  return player?.headshot?.href || player?.headshot || `https://a.espncdn.com/i/headshots/nfl/players/full/${player?.id}.png`;
}
function bioValue(value, fallback = "—") { return value === undefined || value === null || value === "" ? fallback : value; }
function renderHero() {
  const player = state.player; const name = playerName(player); const image = headshotUrl(player);
  const number = player.jersey ? `#${player.jersey}` : "Ravens";
  const college = player.college?.name || player.college?.shortName || player.college || "—";
  const experience = player.experience?.years ?? player.experience?.abbreviation ?? player.experience;
  els.hero.innerHTML = `<div class="profile-identity"><div class="headshot-frame"><img class="profile-headshot" src="${escapeHtml(image)}" alt="${escapeHtml(name)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="profile-placeholder" hidden>${escapeHtml(player.jersey || positionCode(player))}</span></div><div class="player-copy"><span class="player-kicker">${escapeHtml(number)} · ${escapeHtml(positionCode(player))}</span><h2>${escapeHtml(name)}</h2><p class="player-position">Baltimore Ravens · ${escapeHtml(player.position?.name || positionCode(player))}</p><dl class="bio-grid"><div><dt>Height</dt><dd>${escapeHtml(bioValue(player.displayHeight))}</dd></div><div><dt>Weight</dt><dd>${escapeHtml(player.displayWeight || (player.weight ? `${player.weight} lbs` : "—"))}</dd></div><div><dt>Age</dt><dd>${escapeHtml(bioValue(player.age))}</dd></div><div><dt>Experience</dt><dd>${escapeHtml(experience === 0 ? "Rookie" : experience ? `${experience} years` : "—")}</dd></div><div><dt>College</dt><dd>${escapeHtml(college)}</dd></div></dl></div></div>`;
}

function mainCategoryName(position) {
  if (position === "QB") return /passing/i;
  if (["RB", "FB"].includes(position)) return /rushing/i;
  if (["WR", "TE"].includes(position)) return /receiving/i;
  if (position === "K") return /kicking/i;
  if (position === "P") return /punting/i;
  return /defensive|defense/i;
}
function categoryRows(gameLog, includeAllSeasonTypes = false) {
  const matcher = mainCategoryName(positionCode(state.player)); const eventMap = gameLog?.events || {};
  const seasonTypes = gameLog?.seasonTypes || [];
  const relevantTypes = includeAllSeasonTypes ? seasonTypes : seasonTypes.filter((type) => /regular/i.test(type.displayName || type.name || ""));
  const fallbackTypes = relevantTypes.length ? relevantTypes : includeAllSeasonTypes ? seasonTypes : [];
  const result = [];
  fallbackTypes.forEach((seasonType) => {
    const category = (seasonType.categories || []).find((item) => matcher.test(`${item.name} ${item.displayName} ${item.type}`));
    if (!category) return;
    (category.events || []).forEach((row) => {
      const eventId = String(row.eventId || row.id || row.event?.id || ""); const meta = eventMap[eventId] || row.event || {};
      result.push({ eventId, stats: row.stats || row.statistics || [], labels: category.labels || category.displayNames || category.names || [], category: category.displayName || category.name || "Stats", seasonType: seasonType.displayName || seasonType.name || "Season", meta });
    });
  });
  return result.sort((a, b) => new Date(a.meta.gameDate || a.meta.date || 0) - new Date(b.meta.gameDate || b.meta.date || 0));
}
function isHome(row) { return String(row.meta.atVs || row.meta.homeAway || "").toLowerCase() === "vs" || String(row.meta.homeAway || "").toLowerCase() === "home"; }
function parsePair(value) { const match = String(value || "").match(/^(\d+)\/(\d+)$/); return match ? [Number(match[1]), Number(match[2])] : null; }
function aggregateRows(rows) {
  const labels = rows[0]?.labels || [];
  const values = labels.map((label, index) => {
    const raw = rows.map((row) => row.stats[index]).filter((value) => value !== undefined && value !== null && value !== "-");
    const pairs = raw.map(parsePair).filter(Boolean);
    if (pairs.length === raw.length && pairs.length) return `${pairs.reduce((sum, pair) => sum + pair[0], 0)}/${pairs.reduce((sum, pair) => sum + pair[1], 0)}`;
    const numbers = raw.map((value) => Number(String(value).replace(/[^0-9.-]/g, ""))).filter(Number.isFinite);
    if (!numbers.length) return "—";
    if (/AVG|PCT|QBR|RTG/i.test(label)) return (numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(1);
    if (/LONG/i.test(label)) return Math.max(...numbers);
    return numbers.reduce((sum, value) => sum + value, 0);
  });
  return { labels, values };
}
function statCards(rows, { pace = false } = {}) {
  const aggregate = aggregateRows(rows); const games = rows.length; const cards = [["Games", games]];
  aggregate.labels.slice(0, 5).forEach((label, index) => {
    let value = aggregate.values[index];
    if (pace && games && typeof value === "number" && !/AVG|PCT|QBR|RTG|LONG/i.test(label)) value = Math.round((value / games) * 17);
    cards.push([pace ? `${label} Pace` : label, value]);
  });
  return cards.map(([label, value]) => `<div class="stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? "—")}</strong></div>`).join("");
}
function renderSeasonStats() {
  const regularRows = categoryRows(state.gameLog);
  const rows = state.split === "home" ? regularRows.filter(isHome) : state.split === "away" ? regularRows.filter((row) => !isHome(row)) : regularRows;
  els.season.innerHTML = statCards(rows);
  els.pace.innerHTML = statCards(regularRows, { pace: true });
}
function opponentFor(row) {
  const opponent = row.meta.opponent || {}; const abbr = opponent.abbreviation || opponent.shortDisplayName || row.meta.opponentAbbreviation || "OPP";
  return { abbr, name: opponent.displayName || opponent.name || abbr, logo: opponent.logo || teamLogo(abbr) };
}
function formatGameDate(row) {
  const value = row.meta.gameDate || row.meta.date; if (!value) return row.meta.week ? `Week ${row.meta.week}` : "Game";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }).format(new Date(value));
}
function rowsTable(rows, emptyMessage) {
  if (!rows.length) return `<p class="empty-copy">${escapeHtml(emptyMessage)}</p>`;
  const labels = rows[0].labels || [];
  return `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Game</th><th>Result</th>${labels.map((label) => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => { const opponent = opponentFor(row); return `<tr><td><span class="opponent-cell"><img src="${escapeHtml(opponent.logo)}" alt="">${escapeHtml(formatGameDate(row))} ${isHome(row) ? "vs" : "@"} ${escapeHtml(opponent.abbr)}</span></td><td>${escapeHtml(row.meta.score || row.meta.gameResult || "—")}</td>${row.stats.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`; }).join("")}</tbody></table></div>`;
}
function renderLogs() {
  const allRows = categoryRows(state.gameLog, true); els.recent.innerHTML = rowsTable(allRows.slice(-5).reverse(), "Recent action will appear after the player records a statistic.");
  const grouped = new Map(); allRows.forEach((row) => { if (!grouped.has(row.seasonType)) grouped.set(row.seasonType, []); grouped.get(row.seasonType).push(row); });
  els.log.innerHTML = grouped.size ? [...grouped].map(([label, rows]) => `<div class="data-table-wrap"><table class="data-table"><tbody><tr class="section-label"><td colspan="${(rows[0]?.labels?.length || 0) + 2}">${escapeHtml(label)}</td></tr></tbody></table></div>${rowsTable(rows, "")}`).join("") : `<p class="empty-copy">The 2026 season log will appear once games are played.</p>`;
}
function careerStatistics(data) {
  const matcher = mainCategoryName(positionCode(state.player));
  const categories = data?.categories || data?.statistics?.categories || data?.splits?.categories || [];
  const category = categories.find((item) => matcher.test(`${item.name} ${item.displayName} ${item.type}`)) || categories[0];
  const stats = category?.statistics || category?.stats || [];
  return stats.map((stat) => [stat.abbreviation || stat.shortDisplayName || stat.displayName || stat.name, stat.displayValue ?? stat.value]).filter(([, value]) => value !== undefined).slice(0, 6);
}
function renderCareer() {
  const stats = careerStatistics(state.career);
  els.career.innerHTML = stats.length ? stats.map(([label, value]) => `<div class="stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("") : `<div class="stat-card"><span>Career Data</span><strong>—</strong></div>`;
}
async function loadPlayer(player) {
  state.player = player; state.gameLog = null; state.career = null; state.split = "season";
  els.search.value = playerName(player); els.status.textContent = "Loading player data"; els.content.hidden = true; renderHero();
  history.replaceState(null, "", `./player-profile/?player=${encodeURIComponent(player.id)}`);
  const gameLogUrl = `${ESPN_WEB_API}/athletes/${player.id}/gamelog?region=us&lang=en&contentorigin=espn&season=${SEASON}`;
  const careerUrl = `${ESPN_WEB_API}/athletes/${player.id}/stats?region=us&lang=en&contentorigin=espn`;
  const [gameLog, career] = await Promise.allSettled([getJson(gameLogUrl), getJson(careerUrl)]);
  if (gameLog.status === "fulfilled") state.gameLog = gameLog.value;
  if (career.status === "fulfilled") state.career = career.value;
  document.querySelectorAll("[data-split]").forEach((button) => button.classList.toggle("active", button.dataset.split === "season"));
  renderSeasonStats(); renderLogs(); renderCareer(); els.content.hidden = false;
  els.status.textContent = gameLog.status === "fulfilled" ? "2026 player data" : "Profile loaded · stats pending";
}
async function init() {
  try {
    const roster = await getJson(`${ESPN_SITE_API}/teams/bal/roster?season=${SEASON}`);
    state.players = flattenRoster(roster).sort((a, b) => playerName(a).localeCompare(playerName(b)));
    if (!state.players.length) throw new Error("The 2026 Ravens roster is unavailable.");
    els.options.innerHTML = state.players.map((player) => `<option value="${escapeHtml(playerName(player))}">${escapeHtml(positionCode(player))} #${escapeHtml(player.jersey || "—")}</option>`).join("");
    await loadPlayer(preferredPlayer(state.players));
  } catch (error) { els.status.textContent = "Roster unavailable"; els.hero.innerHTML = `<p class="empty-copy">${escapeHtml(error.message)}</p>`; }
}
document.querySelector("#player-search-form").addEventListener("submit", (event) => { event.preventDefault(); const player = playerByInput(els.search.value); if (player) loadPlayer(player); else els.status.textContent = "Choose a player from the roster"; });
document.querySelector(".split-toggle").addEventListener("click", (event) => { const button = event.target.closest("[data-split]"); if (!button) return; state.split = button.dataset.split; document.querySelectorAll("[data-split]").forEach((item) => item.classList.toggle("active", item === button)); renderSeasonStats(); });
init();
