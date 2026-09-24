const SEASON = 2026;
const ESPN_SITE_API = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const ESPN_WEB_API = "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl";
const ESPN_SEARCH_API = "https://site.web.api.espn.com/apis/search/v2";
const ESPN_CORE_API = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/athletes";
const LIVE_REFRESH_MS = 30000;
const GAME_DAY_REFRESH_MS = 60000;
const IDLE_REFRESH_MS = 900000;
const state = { players: [], ravensPlayers: [], player: null, gameLog: null, career: null, liveRow: null, liveTimer: null, split: "season", searchRequest: 0 };
const els = {
  status: document.querySelector("#profile-status"), search: document.querySelector("#player-search"),
  options: document.querySelector("#player-options"), hero: document.querySelector("#profile-hero"),
  quickSelect: document.querySelector("#quick-player-select"),
  content: document.querySelector("#profile-content"), season: document.querySelector("#season-stats"), seasonGames: document.querySelector("#season-game-count"),
  recent: document.querySelector("#recent-action"), pace: document.querySelector("#season-pace"),
  career: document.querySelector("#career-totals"), careerYears: document.querySelector("#career-by-year"),
};

function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
async function getJson(url) { const response = await fetch(url); if (!response.ok) throw new Error(`Data request returned ${response.status}`); return response.json(); }
function teamLogo(abbr) { return `https://a.espncdn.com/i/teamlogos/nfl/500/${String(abbr || "nfl").toLowerCase()}.png`; }
function playerName(player) { return player?.displayName || player?.fullName || "Ravens Player"; }
function positionCode(player) { return player?.position?.abbreviation || player?.position?.name || "NFL"; }
function teamName(player) { return player?.team?.displayName || player?.team?.name || player?.teamName || "NFL"; }
function profileTeamColor(player) { const color = String(player?.team?.color || "2b025b").replace(/^#/, ""); return /^[0-9a-f]{6}$/i.test(color) ? `#${color}` : "#2b025b"; }
function profileTeamLogo(player) { return player?.team?.logos?.find((logo) => (logo.rel || []).includes("default"))?.href || player?.team?.logos?.[0]?.href || player?.team?.logo || ""; }
function flattenRoster(data) { return (data.athletes || []).flatMap((group) => group.items || group.athletes || (group.id ? [group] : [])); }
function playerByInput(value) {
  const needle = String(value || "").trim().toLowerCase();
  return state.players.find((player) => playerName(player).toLowerCase() === needle)
    || state.players.find((player) => playerName(player).toLowerCase().includes(needle));
}
function searchResultId(item) { return String(item?.uid || "").match(/~a:(\d+)/)?.[1] || String(item?.link?.web || "").match(/\/id\/(\d+)/)?.[1] || item?.id; }
function searchResultPlayer(item) { return { id: searchResultId(item), displayName: item.displayName, teamName: item.subtitle, headshot: item.image?.default }; }
function updatePlayerOptions(players) {
  state.players = players;
  els.options.innerHTML = players.map((player) => `<option value="${escapeHtml(playerName(player))}">${escapeHtml(teamName(player))}${positionCode(player) === "NFL" ? "" : ` · ${escapeHtml(positionCode(player))}`}</option>`).join("");
}
function rosterGroup(player) {
  const position = positionCode(player).toUpperCase();
  if (["K", "P", "PK", "LS", "KR", "PR"].includes(position)) return "Special Teams";
  if (["QB", "RB", "FB", "WR", "TE", "OT", "T", "OG", "G", "C", "OL"].includes(position)) return "Offense";
  return "Defense";
}
function populateQuickSelect(players) {
  const placeholder = new Option("Quick Select a Raven", "");
  els.quickSelect.replaceChildren(placeholder);
  ["Offense", "Defense", "Special Teams"].forEach((label) => {
    const entries = players.filter((player) => rosterGroup(player) === label).sort((a, b) => playerName(a).localeCompare(playerName(b)));
    if (!entries.length) return;
    const group = document.createElement("optgroup"); group.label = label;
    entries.forEach((player) => group.append(new Option(`${playerName(player)} — ${positionCode(player)}`, String(player.id))));
    els.quickSelect.append(group);
  });
  els.quickSelect.disabled = false;
}
function syncQuickSelect() {
  const value = String(state.player?.id || "");
  els.quickSelect.value = els.quickSelect.querySelector(`option[value="${CSS.escape(value)}"]`) ? value : "";
}
async function searchLeaguePlayers(query) {
  const data = await getJson(`${ESPN_SEARCH_API}?region=us&lang=en&query=${encodeURIComponent(query)}&limit=20&page=1&type=player`);
  return (data.results || []).filter((group) => group.type === "player").flatMap((group) => group.contents || [])
    .filter((item) => item.defaultLeagueSlug === "nfl" || (item.sport === "football" && /NFL/i.test(item.description || "")))
    .map(searchResultPlayer).filter((player) => player.id && player.displayName);
}
async function referencedObject(reference) {
  const url = reference?.$ref?.replace(/^http:/, "https:");
  if (!url) return reference && !reference.$ref ? reference : null;
  try { return await getJson(url); } catch (_) { return null; }
}
async function hydratePlayer(player) {
  const details = await getJson(`${ESPN_CORE_API}/${encodeURIComponent(player.id)}?lang=en&region=us`);
  const [position, team, college] = await Promise.all([referencedObject(details.position), referencedObject(details.team), referencedObject(details.college)]);
  return { ...player, ...details, position: position || details.position, team: team || details.team, college: college || details.college };
}
function headshotUrl(player) {
  return player?.headshot?.href || player?.headshot || `https://a.espncdn.com/i/headshots/nfl/players/full/${player?.id}.png`;
}
function bioValue(value, fallback = "—") { return value === undefined || value === null || value === "" ? fallback : value; }
function renderHero() {
  const player = state.player; const name = playerName(player); const image = headshotUrl(player);
  els.hero.style.setProperty("--profile-team-color", profileTeamColor(player));
  const number = player.jersey ? `#${player.jersey}` : "Ravens";
  const college = player.college?.name || player.college?.shortName || player.college || "—";
  const experience = player.experience?.years ?? player.experience?.abbreviation ?? player.experience;
  els.hero.innerHTML = `<div class="profile-identity"><div class="headshot-frame"><img class="profile-headshot" src="${escapeHtml(image)}" alt="${escapeHtml(name)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="profile-placeholder" hidden>${escapeHtml(player.jersey || positionCode(player))}</span></div><div class="player-copy"><img class="profile-team-watermark" src="${escapeHtml(profileTeamLogo(player))}" alt="" aria-hidden="true" onerror="this.hidden=true"><span class="player-kicker">${escapeHtml(number)} · ${escapeHtml(positionCode(player))}</span><h2>${escapeHtml(name)}</h2><p class="player-position">${escapeHtml(teamName(player))} · ${escapeHtml(player.position?.name || positionCode(player))}</p><dl class="bio-grid"><div><dt>Height</dt><dd>${escapeHtml(bioValue(player.displayHeight))}</dd></div><div><dt>Weight</dt><dd>${escapeHtml(player.displayWeight || (player.weight ? `${player.weight} lbs` : "—"))}</dd></div><div><dt>Age</dt><dd>${escapeHtml(bioValue(player.age))}</dd></div><div><dt>Experience</dt><dd>${escapeHtml(experience === 0 ? "Rookie" : experience ? `${experience} years` : "—")}</dd></div><div><dt>College</dt><dd>${escapeHtml(college)}</dd></div></dl></div></div>`;
}

function mainCategoryName(position) {
  if (position === "QB") return /passing/i;
  if (["RB", "FB"].includes(position)) return /rushing/i;
  if (["WR", "TE"].includes(position)) return /receiving/i;
  if (position === "K") return /kicking/i;
  if (position === "P") return /punting/i;
  return /defensive|defense/i;
}
function seasonTypeName(seasonType) {
  const name = seasonType.displayName || seasonType.name || "Season";
  return name.replace("{0}", String(SEASON));
}
function categoryRows(gameLog, includeAllSeasonTypes = false) {
  const matcher = mainCategoryName(positionCode(state.player)); const eventMap = gameLog?.events || {};
  const seasonTypes = gameLog?.seasonTypes || [];
  const relevantTypes = includeAllSeasonTypes ? seasonTypes : seasonTypes.filter((type) => /regular/i.test(type.displayName || type.name || ""));
  const fallbackTypes = relevantTypes.length ? relevantTypes : includeAllSeasonTypes ? seasonTypes : [];
  const categoryDefinitions = gameLog?.categories || [];
  const definitionIndex = categoryDefinitions.findIndex((item) => matcher.test(`${item.name} ${item.displayName} ${item.type}`));
  const definition = categoryDefinitions[definitionIndex];
  const statOffset = definitionIndex < 1 ? 0 : categoryDefinitions.slice(0, definitionIndex).reduce((sum, item) => sum + Number(item.count || 0), 0);
  const statCount = Number(definition?.count || 0);
  const sharedLabels = statCount ? (gameLog.labels || []).slice(statOffset, statOffset + statCount) : [];
  const result = [];
  fallbackTypes.forEach((seasonType) => {
    const categories = seasonType.categories || [];
    const category = categories.find((item) => matcher.test(`${item.name} ${item.displayName} ${item.type}`))
      || (definition ? categories.find((item) => Array.isArray(item.events)) : null);
    if (!category) return;
    (category.events || []).forEach((row) => {
      const eventId = String(row.eventId || row.id || row.event?.id || ""); const meta = eventMap[eventId] || row.event || {};
      const rawStats = row.stats || row.statistics || [];
      const stats = sharedLabels.length ? rawStats.slice(statOffset, statOffset + statCount) : rawStats;
      const labels = sharedLabels.length ? sharedLabels : category.labels || category.displayNames || category.names || [];
      result.push({ eventId, stats, labels, category: definition?.displayName || category.displayName || category.name || "Stats", seasonType: seasonTypeName(seasonType), meta });
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
    if (/AVG|PCT|%|QBR|RTG/i.test(label)) return (numbers.reduce((sum, value) => sum + value, 0) / numbers.length).toFixed(1);
    if (/LONG/i.test(label)) return Math.max(...numbers);
    return numbers.reduce((sum, value) => sum + value, 0);
  });
  return { labels, values };
}
function statCards(rows, { pace = false } = {}) {
  const aggregate = aggregateRows(rows); const games = rows.length; const cards = [];
  const cardIndexes = aggregate.labels.reduce((indexes, label, index) => {
    const normalizedLabel = String(label).trim();
    const additionalStat = pace ? /^(TD|INT|SACKS?)$/i.test(normalizedLabel) : /^(TD|INT|RTG|QBR)$/i.test(normalizedLabel);
    if (index < 5 || additionalStat) indexes.push(index);
    return indexes;
  }, []);
  cardIndexes.forEach((index) => {
    const label = aggregate.labels[index];
    let value = aggregate.values[index];
    if (pace && games && typeof value === "number" && !/AVG|PCT|%|QBR|RTG|LONG/i.test(label)) value = Math.round((value / games) * 17);
    cards.push([label, value]);
  });
  return cards.map(([label, value]) => `<div class="stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value ?? "—")}</strong></div>`).join("");
}
function renderSeasonStats() {
  const regularRows = categoryRows(state.gameLog);
  const rows = state.split === "home" ? regularRows.filter(isHome) : state.split === "away" ? regularRows.filter((row) => !isHome(row)) : regularRows;
  els.seasonGames.textContent = `· ${regularRows.length} ${regularRows.length === 1 ? "Game" : "Games"}`;
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
  const allRows = categoryRows(state.gameLog, true);
  const completedRows = allRows.filter((row) => row.eventId !== state.liveRow?.eventId).slice(-5).reverse();
  els.recent.innerHTML = `${state.liveRow ? `<div class="live-action"><div class="live-action-label"><span></span>Live now</div>${rowsTable([state.liveRow], "")}</div>` : ""}${rowsTable(completedRows.slice(0, state.liveRow ? 4 : 5), "Recent action will appear after the player records a statistic.")}`;
}
function eventCompetition(event) { return event?.competitions?.[0] || event?.header?.competitions?.[0] || null; }
function eventState(event) { return eventCompetition(event)?.status?.type?.state || event?.status?.type?.state || "pre"; }
function normalizedStatLabel(label) { return String(label || "").toUpperCase().replace(/[^A-Z0-9%]/g, ""); }
function normalizedLiveStats(category, entry) {
  const liveLabels = category.labels || category.displayNames || category.names || []; const liveStats = entry.stats || [];
  const values = new Map(liveLabels.map((label, index) => [normalizedStatLabel(label), liveStats[index]]));
  const historicalLabels = categoryRows(state.gameLog, true)[0]?.labels || [];
  if (!historicalLabels.length) return { labels: liveLabels, stats: liveStats };
  const attempts = String(values.get("CATT") || "").match(/^(\d+)\/(\d+)$/);
  const stats = historicalLabels.map((label) => {
    const key = normalizedStatLabel(label); if (values.has(key)) return values.get(key);
    if (key === "CMP" && attempts) return attempts[1];
    if (key === "ATT" && attempts) return attempts[2];
    if (key === "CMP%" && attempts && Number(attempts[2])) return ((Number(attempts[1]) / Number(attempts[2])) * 100).toFixed(1);
    if (key === "SACK" && values.has("SACKS")) return String(values.get("SACKS")).split("-")[0];
    return "—";
  });
  return { labels: historicalLabels, stats };
}
function livePlayerRow(summary, eventId) {
  const group = (summary?.boxscore?.players || []).find((item) => item.team?.abbreviation === "BAL");
  const matcher = mainCategoryName(positionCode(state.player));
  const category = (group?.statistics || []).find((item) => matcher.test(`${item.name} ${item.displayName} ${item.type}`));
  const entry = (category?.athletes || []).find((item) => String(item.athlete?.id) === String(state.player?.id));
  if (!entry) return null;
  const normalized = normalizedLiveStats(category, entry);
  const competition = eventCompetition(summary); const competitors = competition?.competitors || [];
  const ravens = competitors.find((item) => item.team?.abbreviation === "BAL");
  const opponent = competitors.find((item) => item !== ravens) || {};
  const home = ravens?.homeAway === "home";
  return {
    eventId: String(eventId), stats: normalized.stats, labels: normalized.labels, category: category.displayName || category.name || "Live Stats", seasonType: `${SEASON} Regular Season`,
    meta: { gameDate: competition?.date || summary?.header?.season?.year, atVs: home ? "vs" : "@", homeAway: home ? "home" : "away", opponent: opponent.team || {}, score: competition?.status?.type?.detail || competition?.status?.displayClock || "Live" }
  };
}
function queueLiveRefresh(delay, playerId) {
  clearTimeout(state.liveTimer);
  state.liveTimer = setTimeout(() => { if (String(state.player?.id) === String(playerId)) refreshLiveAction(playerId); }, delay);
}
async function refreshLiveAction(playerId) {
  try {
    const schedule = await getJson(`${ESPN_SITE_API}/teams/bal/schedule?season=${SEASON}`);
    if (String(state.player?.id) !== String(playerId)) return;
    const events = schedule.events || []; const liveEvent = events.find((event) => eventState(event) === "in");
    if (!liveEvent) {
      state.liveRow = null; renderLogs();
      const gameToday = events.some((event) => Math.abs(new Date(event.date).getTime() - Date.now()) < 8 * 60 * 60 * 1000);
      queueLiveRefresh(gameToday ? GAME_DAY_REFRESH_MS : IDLE_REFRESH_MS, playerId); return;
    }
    const summary = await getJson(`${ESPN_SITE_API}/summary?event=${encodeURIComponent(liveEvent.id)}`);
    if (String(state.player?.id) !== String(playerId)) return;
    state.liveRow = livePlayerRow(summary, liveEvent.id); renderLogs(); queueLiveRefresh(LIVE_REFRESH_MS, playerId);
  } catch (_) { queueLiveRefresh(GAME_DAY_REFRESH_MS, playerId); }
}
function careerStatistics(data) {
  const matcher = mainCategoryName(positionCode(state.player));
  const categories = data?.categories || data?.statistics?.categories || data?.splits?.categories || [];
  const category = categories.find((item) => matcher.test(`${item.name} ${item.displayName} ${item.type}`)) || categories[0];
  const stats = category?.statistics || category?.stats || [];
  let entries;
  if (Array.isArray(category?.totals) && Array.isArray(category?.labels)) {
    entries = category.labels.map((label, index) => [label, category.totals[index]]).filter(([, value]) => value !== undefined);
  } else {
    entries = stats.map((stat) => [stat.abbreviation || stat.shortDisplayName || stat.displayName || stat.name, stat.displayValue ?? stat.value]).filter(([, value]) => value !== undefined);
  }
  const displayOrder = ["CMP", "ATT", "YDS", "CMP%", "AVG", "TD", "INT", "RTG"];
  return displayOrder.map((wanted) => entries.find(([label]) => String(label).trim().toUpperCase() === wanted)).filter(Boolean);
}
function renderCareer() {
  const stats = careerStatistics(state.career);
  els.career.innerHTML = stats.length ? stats.map(([label, value]) => `<div class="stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("") : `<div class="stat-card"><span>Career Data</span><strong>—</strong></div>`;
  const matcher = mainCategoryName(positionCode(state.player)); const categories = state.career?.categories || [];
  const category = categories.find((item) => matcher.test(`${item.name} ${item.displayName} ${item.type}`)) || categories[0];
  const labels = category?.labels || []; const seasons = [...(category?.statistics || [])].sort((a,b) => Number(b.season?.year || 0) - Number(a.season?.year || 0));
  els.careerYears.innerHTML = seasons.length ? `<div class="career-season-heading"><h3>Stats by season</h3></div><div class="career-season-inner"><div class="data-table-wrap"><table class="data-table career-season-table"><thead><tr><th>Season</th>${labels.map((label) => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody>${seasons.map((season) => `<tr><td>${escapeHtml(season.season?.displayName || season.season?.year || "—")}</td>${(season.stats || []).map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>` : `<p class="empty-copy">Career statistics by season are unavailable.</p>`;
}
async function loadPlayer(player) {
  try { player = await hydratePlayer(player); } catch (_) { /* Search and roster data can still render a partial profile. */ }
  clearTimeout(state.liveTimer); state.player = player; state.gameLog = null; state.career = null; state.liveRow = null; state.split = "season";
  els.search.value = playerName(player); els.status.textContent = "Loading player data"; els.content.hidden = true; renderHero(); syncQuickSelect();
  history.replaceState(null, "", `./player-profile/?player=${encodeURIComponent(player.id)}`);
  const gameLogUrl = `${ESPN_WEB_API}/athletes/${player.id}/gamelog?region=us&lang=en&contentorigin=espn&season=${SEASON}`;
  const careerUrl = `${ESPN_WEB_API}/athletes/${player.id}/stats?region=us&lang=en&contentorigin=espn`;
  const [gameLog, career] = await Promise.allSettled([getJson(gameLogUrl), getJson(careerUrl)]);
  if (gameLog.status === "fulfilled") state.gameLog = gameLog.value;
  if (career.status === "fulfilled") state.career = career.value;
  document.querySelectorAll("[data-split]").forEach((button) => button.classList.toggle("active", button.dataset.split === "season"));
  renderSeasonStats(); renderLogs(); renderCareer(); els.content.hidden = false;
  els.status.textContent = gameLog.status === "fulfilled" ? "2026 player data" : "Profile loaded · stats pending";
  refreshLiveAction(player.id);
}
async function init() {
  try {
    const roster = await getJson(`${ESPN_SITE_API}/teams/bal/roster?season=${SEASON}`);
    state.ravensPlayers = flattenRoster(roster).sort((a, b) => playerName(a).localeCompare(playerName(b)));
    if (!state.ravensPlayers.length) throw new Error("The 2026 Ravens roster is unavailable.");
    state.players = state.ravensPlayers; els.options.replaceChildren();
    populateQuickSelect(state.ravensPlayers);
    const requested = new URLSearchParams(location.search).get("player");
    const requestedPlayer = state.ravensPlayers.find((player) => String(player.id) === requested);
    const randomPlayer = state.ravensPlayers[Math.floor(Math.random() * state.ravensPlayers.length)];
    await loadPlayer(requested ? requestedPlayer || { id: requested, displayName: "NFL Player" } : randomPlayer);
  } catch (error) { els.status.textContent = "Roster unavailable"; els.hero.innerHTML = `<p class="empty-copy">${escapeHtml(error.message)}</p>`; }
}
let searchTimer;
els.search.addEventListener("input", () => {
  clearTimeout(searchTimer); const query = els.search.value.trim();
  if (query.length < 2) { state.players = state.ravensPlayers; els.options.replaceChildren(); return; }
  const request = ++state.searchRequest;
  searchTimer = setTimeout(async () => {
    try { const players = await searchLeaguePlayers(query); if (request === state.searchRequest) updatePlayerOptions(players.length ? players : state.ravensPlayers); } catch (_) { /* Keep the current suggestions available. */ }
  }, 250);
});
els.search.addEventListener("change", () => {
  const player = playerByInput(els.search.value);
  if (player && playerName(player).toLowerCase() === els.search.value.trim().toLowerCase()) loadPlayer(player);
});
document.querySelector("#player-search-form").addEventListener("submit", async (event) => {
  event.preventDefault(); let player = playerByInput(els.search.value);
  if (!player && els.search.value.trim().length > 1) {
    try { const players = await searchLeaguePlayers(els.search.value.trim()); updatePlayerOptions(players); player = playerByInput(els.search.value) || players[0]; } catch (_) { /* Status below explains the unavailable result. */ }
  }
  if (player) loadPlayer(player); else els.status.textContent = "No NFL player found";
});
els.quickSelect.addEventListener("change", () => {
  const player = state.ravensPlayers.find((item) => String(item.id) === els.quickSelect.value);
  if (player) loadPlayer(player);
});
document.querySelector(".split-toggle").addEventListener("click", (event) => { const button = event.target.closest("[data-split]"); if (!button) return; state.split = button.dataset.split; document.querySelectorAll("[data-split]").forEach((item) => item.classList.toggle("active", item === button)); renderSeasonStats(); });
init();
