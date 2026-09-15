const SEASON = 2026;
const RAVENS_ID = "33";
const RAVENS_ABBR = "BAL";
const ESPN_SITE_API = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const REFRESH_MS = 30000;
const TEAM_COLORS = {
  ARI: "#97233F", ATL: "#A71930", BAL: "#241773", BUF: "#00338D", CAR: "#0085CA", CHI: "#0B162A", CIN: "#FB4F14", CLE: "#311D00",
  DAL: "#003594", DEN: "#FB4F14", DET: "#0076B6", GB: "#203731", HOU: "#03202F", IND: "#002C5F", JAX: "#101820", KC: "#E31837",
  LV: "#000000", LAC: "#0080C6", LAR: "#003594", MIA: "#008E97", MIN: "#4F2683", NE: "#002244", NO: "#D3BC8D", NYG: "#0B2265",
  NYJ: "#125740", PHI: "#004C54", PIT: "#FFB612", SF: "#AA0000", SEA: "#002244", TB: "#D50A0A", TEN: "#0C2340", WSH: "#5A1414",
};
const state = { events: [], selectedId: "", summary: null, nflReceiving: null, statView: "offense", timer: null, animatedCharts: new Set(), animatedComparisons: new Set() };
const els = {
  title: document.querySelector("#page-title"), description: document.querySelector("#page-description"),
  status: document.querySelector("#data-status"), selector: document.querySelector("#game-selector-grid"),
  game: document.querySelector("#game-card"), dashboard: document.querySelector("#dashboard"),
  breaking: document.querySelector("#breaking-details"), breakingGrid: document.querySelector("#breaking-grid"),
  winPanel: document.querySelector("#win-probability-panel"), win: document.querySelector("#win-probability"),
  winValue: document.querySelector("#win-probability-value"), scoring: document.querySelector("#scoring-plays"),
  comparison: document.querySelector("#team-comparison"),
  metrics: document.querySelector("#game-metrics"), players: document.querySelector("#player-stats"),
};

function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
function teamLogo(abbr) { return `https://a.espncdn.com/i/teamlogos/nfl/500/${String(abbr || "nfl").toLowerCase()}.png`; }
function teamColor(team) { return TEAM_COLORS[String(team?.abbreviation || "").toUpperCase()] || "#241773"; }
function eventState(event) { return event?.competitions?.[0]?.status?.type?.state || event?.status?.type?.state || "pre"; }
function isPreseason(event) {
  const value = event?.seasonType || event?.competitions?.[0]?.seasonType || {};
  const id = Number(value.id || value.type || event?.season?.type);
  return id === 1 || /preseason/i.test(value.name || value.displayName || value.slug || event?.season?.slug || "");
}
function selectedEvent() { return state.events.find((event) => String(event.id) === String(state.selectedId)); }
function competition(event = selectedEvent()) { return event?.competitions?.[0] || {}; }
function competitors(event = selectedEvent()) { return competition(event).competitors || []; }
function ravenEntry(event = selectedEvent()) { return competitors(event).find((item) => item.team?.abbreviation === RAVENS_ABBR); }
function opponentEntry(event = selectedEvent()) { return competitors(event).find((item) => item.team?.abbreviation !== RAVENS_ABBR); }
function formatDate(value, options = {}) { return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...options }).format(new Date(value)); }
function gameTime(event) {
  if (!event?.date || event?.status?.type?.description === "TBD") return "TBD / Flex";
  return formatDate(event.date, { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}
function displayScore(score, fallback = "-") {
  if (score === null || score === undefined || score === "") return fallback;
  if (typeof score !== "object") return score;
  return score.displayValue ?? score.value ?? score.score ?? fallback;
}
function flattenRoster(data) { return (data?.athletes || []).flatMap((group) => group.items || group.athletes || (group.id ? [group] : [])); }
function playerName(player) { return player?.displayName || player?.fullName || ""; }
function playerHeadshot(player) { return player?.headshot?.href || player?.headshot || (player?.id ? `https://a.espncdn.com/i/headshots/nfl/players/full/${player.id}.png` : teamLogo(RAVENS_ABBR)); }
function playerInStory(article, roster) {
  const text = `${article.headline || ""} ${article.description || ""}`.toLowerCase();
  const rosterMatch = roster.find((player) => {
    const fullName = playerName(player).toLowerCase();
    const lastName = String(player.lastName || fullName.split(" ").at(-1) || "").toLowerCase();
    return fullName && (text.includes(fullName) || (lastName.length >= 5 && text.includes(lastName)));
  });
  if (rosterMatch) return rosterMatch;
  const athlete = (article.categories || []).find((category) => /athlete|player/i.test(category.type || "") && (category.athleteId || category.id));
  return athlete ? { id: athlete.athleteId || athlete.id, displayName: athlete.description || athlete.name || "Ravens player" } : null;
}
function recordText(entry) { return entry?.records?.find((record) => record.type === "total")?.summary || "0-0"; }
function detailText(event) {
  const status = competition(event).status?.type || event.status?.type || {};
  if (status.state === "in") return status.shortDetail || status.detail || "Live";
  if (status.state === "post") return `Final · ${displayScore(ravenEntry(event)?.score, 0)}-${displayScore(opponentEntry(event)?.score, 0)}`;
  return gameTime(event);
}
async function getJson(url) { const response = await fetch(url); if (!response.ok) throw new Error(`Data request returned ${response.status}`); return response.json(); }
async function getSchedule() {
  const requests = [1, 2, 3].map((seasonType) => getJson(`${ESPN_SITE_API}/teams/bal/schedule?season=${SEASON}&seasontype=${seasonType}`));
  const results = await Promise.allSettled(requests); const events = results.flatMap((result) => result.status === "fulfilled" ? result.value.events || [] : []);
  if (!events.length) throw new Error("No 2026 Ravens games were returned.");
  return [...new Map(events.map((event) => [String(event.id), event])).values()].sort((a, b) => new Date(a.date) - new Date(b.date));
}
async function getSummary(id) { return getJson(`${ESPN_SITE_API}/summary?event=${encodeURIComponent(id)}`); }
function nflGameSlug(event) {
  const game = competition(event); const away = (game.competitors || []).find((entry) => entry.homeAway === "away"); const home = (game.competitors || []).find((entry) => entry.homeAway === "home");
  const awaySlug = away?.team?.slug?.split("-").at(-1); const homeSlug = home?.team?.slug?.split("-").at(-1); const week = event?.week?.number || game.week?.number;
  const seasonType = Number(event?.season?.type || event?.seasonType?.id || game.seasonType?.id); const type = seasonType === 1 ? "pre" : seasonType === 3 ? "post" : "reg";
  return awaySlug && homeSlug && week ? `${awaySlug}-at-${homeSlug}-${SEASON}-${type}-${week}` : "";
}
async function getNflReceivingStats(event) {
  const slug = nflGameSlug(event); if (!slug) return null;
  try { return await getJson(`./data/nfl-stats/${encodeURIComponent(slug)}.json`); }
  catch (_) { return getJson(`./api/nfl-stats.php?slug=${encodeURIComponent(slug)}`); }
}

function chooseFeatured(events) {
  return RavensGameSelection.chooseFeatured(events);
}
function selectorEvents(events) {
  const completed = events.filter((event) => eventState(event) === "post").slice(-3);
  const currentAndUpcoming = events.filter((event) => eventState(event) !== "post").slice(0, 3);
  return [...new Map([...completed, ...currentAndUpcoming].map((event) => [String(event.id), event])).values()]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);
}
function renderSelectors() {
  const items = selectorEvents(state.events);
  els.selector.innerHTML = items.map((event) => {
    const opponent = competitors(event).find((item) => item.team?.abbreviation !== RAVENS_ABBR);
    const ravens = competitors(event).find((item) => item.team?.abbreviation === RAVENS_ABBR);
    const currentState = eventState(event);
    const ravensScore = Number(displayScore(ravens?.score, 0)); const opponentScore = Number(displayScore(opponent?.score, 0));
    const result = currentState === "post" ? (ravensScore > opponentScore ? "W" : ravensScore < opponentScore ? "L" : "T") : "";
    const resultClass = result === "W" ? "win" : result === "L" ? "loss" : result === "T" ? "tie" : "";
    const date = formatDate(event.date, { month: "numeric", day: "numeric" });
    const completedLine = `<span class="result-badge ${resultClass}">${result}</span><img src="${escapeHtml(teamLogo(RAVENS_ABBR))}" alt=""><strong>BAL ${escapeHtml(displayScore(ravens?.score, 0))}</strong><span class="score-separator">–</span><strong>${escapeHtml(displayScore(opponent?.score, 0))} ${escapeHtml(opponent?.team?.abbreviation || "TBD")}</strong><img src="${escapeHtml(teamLogo(opponent?.team?.abbreviation))}" alt="">`;
    const upcomingLine = `<strong>${ravens?.homeAway === "away" ? "@" : "vs"} ${escapeHtml(opponent?.team?.abbreviation || "TBD")}</strong><span>${escapeHtml(gameTime(event))}</span><img class="opponent-watermark" src="${escapeHtml(teamLogo(opponent?.team?.abbreviation))}" alt="">`;
    const liveLine = `<span class="result-badge live-badge">LIVE</span><img src="${escapeHtml(teamLogo(RAVENS_ABBR))}" alt=""><strong>BAL ${escapeHtml(displayScore(ravens?.score, 0))}</strong><span class="score-separator">–</span><strong>${escapeHtml(displayScore(opponent?.score, 0))} ${escapeHtml(opponent?.team?.abbreviation || "TBD")}</strong><img src="${escapeHtml(teamLogo(opponent?.team?.abbreviation))}" alt="">`;
    return `<button class="${currentState === "post" ? `completed ${resultClass}` : currentState === "in" ? "live" : "upcoming"}${String(event.id) === String(state.selectedId) ? " active" : ""}" type="button" data-event-id="${escapeHtml(event.id)}"><span class="selector-header"><span class="selector-date">${escapeHtml(date)}</span>${isPreseason(event) ? `<span class="selector-season">Preseason</span>` : ""}</span><span class="selector-matchup">${currentState === "post" ? completedLine : currentState === "in" ? liveLine : upcomingLine}</span></button>`;
  }).join("") || `<p class="empty-copy">The 2026 schedule is not available yet.</p>`;
}
function quarterScores(entry) { const scores = (entry?.linescores || []).map((item) => displayScore(item, "-")); return [0, 1, 2, 3].map((index) => scores[index] ?? "-"); }
function broadcastNames(...games) {
  const names = games.flatMap((game) => [
    ...(game?.broadcasts || []).flatMap((item) => item.names || []),
    ...(game?.geoBroadcasts || []).map((item) => item.media?.shortName || item.media?.name),
  ]).filter(Boolean);
  return [...new Set(names)].join(" / ") || "Broadcast TBD";
}
function scoreTeam(entry, side = "left") {
  const team = entry.team || {};
  const info = `<div class="score-team-info"><strong>${escapeHtml(team.displayName || "TBD")}</strong><span>${escapeHtml(recordText(entry))}</span></div>`;
  const image = `<img src="${escapeHtml(teamLogo(team.abbreviation))}" alt="${escapeHtml(team.displayName || "Team")} logo">`;
  const score = `<b class="team-score">${escapeHtml(displayScore(entry.score))}</b>`;
  return `<div class="score-team ${side}" style="--team-color:${teamColor(team)}">${side === "right" ? `${score}${image}${info}` : `${info}${image}${score}`}</div>`;
}
function quarterRow(entry, scores) { return `<tr><th>${escapeHtml(entry.team?.abbreviation || "TBD")}</th>${scores.map((score) => `<td>${escapeHtml(score)}</td>`).join("")}<td>${escapeHtml(displayScore(entry.score))}</td></tr>`; }
function renderGame() {
  const event = selectedEvent();
  const scheduleGame = competition(event);
  const summaryGame = state.summary?.header?.competitions?.find((item) => String(item.id) === String(event?.id)) || state.summary?.header?.competitions?.[0];
  const game = summaryGame || scheduleGame;
  const ravens = (game.competitors || []).find((item) => item.team?.abbreviation === RAVENS_ABBR) || {};
  const opponent = (game.competitors || []).find((item) => item.team?.abbreviation !== RAVENS_ABBR) || {};
  const status = game.status?.type || event?.status?.type || {}; const currentState = status.state || "pre";
  const venueInfo = game.venue?.fullName ? game.venue : scheduleGame.venue;
  const venue = venueInfo?.fullName || "Venue TBD";
  const broadcast = broadcastNames(game, scheduleGame);
  const indoor = game.venue?.indoor ?? scheduleGame.venue?.indoor;
  const weather = game.weather?.displayValue || scheduleGame.weather?.displayValue || (indoor ? "Indoors" : "Forecast pending");
  els.title.textContent = currentState === "in" ? "Live Game" : currentState === "post" ? "Game Recap" : "Game Preview";
  els.description.textContent = currentState === "in" ? "Live scoring, game flow, and updated team statistics." : currentState === "post" ? "Final score, scoring plays, and game statistics." : "Upcoming matchup details, notes, and scheduled kickoff.";
  els.status.textContent = currentState === "in" ? "Live · updates every 30 sec" : currentState === "post" ? "Final" : "2026 schedule";
  const kickoff = formatDate(event.date, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  els.game.innerHTML = `<div class="scoreboard" style="--left-team-color:${teamColor(ravens.team)};--right-team-color:${teamColor(opponent.team)}">${scoreTeam(ravens, "left")}<div class="game-state"><strong>${escapeHtml(status.shortDetail || status.description || "Scheduled")}</strong><span>${escapeHtml(kickoff)}</span></div>${scoreTeam(opponent, "right")}</div><div class="game-info-bar"><span><b>Kickoff:</b> ${escapeHtml(kickoff)}</span><i></i><span><b>Watch:</b> ${escapeHtml(broadcast)}</span><i></i><span><b>Venue:</b> ${escapeHtml(venue)}</span><i></i><span><b>Conditions:</b> ${escapeHtml(weather)}</span></div><div class="quarter-board"><table><thead><tr><th>Team</th><th>1</th><th>2</th><th>3</th><th>4</th><th>Total</th></tr></thead><tbody>${quarterRow(ravens, quarterScores(ravens))}${quarterRow(opponent, quarterScores(opponent))}</tbody></table></div>`;
}

function renderWinProbability() {
  const game = state.summary?.header?.competitions?.[0] || competition();
  const home = (game.competitors || []).find((item) => item.homeAway === "home") || {};
  const ravensAreHome = home.team?.abbreviation === RAVENS_ABBR;
  const playsById = new Map((state.summary?.plays || []).map((play) => [String(play.id), play]));
  const scoringIds = new Set((state.summary?.scoringPlays || []).map((play) => String(play.id)));
  const timeline = (state.summary?.winprobability || []).map((entry) => {
    const homePct = Number(entry.homeWinPercentage) * 100;
    const play = entry.play || playsById.get(String(entry.playId));
    return { probability: ravensAreHome ? homePct : 100 - homePct, play, scoring: scoringIds.has(String(entry.playId || play?.id)) };
  }).filter((point) => Number.isFinite(point.probability));
  let ravensPct = timeline.at(-1)?.probability;
  if (!Number.isFinite(ravensPct)) {
    const projectedHomePct = Number(state.summary?.predictor?.homeTeam?.gameProjection);
    ravensPct = Number.isFinite(projectedHomePct) ? (ravensAreHome ? projectedHomePct : 100 - projectedHomePct) : 50;
  }
  ravensPct = Math.max(0, Math.min(100, ravensPct));
  els.winValue.textContent = `${ravensPct.toFixed(eventState(selectedEvent()) === "in" ? 1 : 0)}%`;
  els.winPanel.hidden = false;
  if (!timeline.length) {
    const opponent = opponentEntry();
    els.win.innerHTML = `<div class="probability"><div class="probability-labels"><span>BAL ${ravensPct.toFixed(1)}%</span><span>${escapeHtml(opponent?.team?.abbreviation || "OPP")} ${(100 - ravensPct).toFixed(1)}%</span></div><div class="probability-track"><span class="probability-ravens" style="width:${ravensPct}%"></span><span class="probability-opponent"></span></div></div>`;
    return;
  }
  const width = 1400; const height = 220; const plot = { top: 18, bottom: 34 }; const plotHeight = height - plot.top - plot.bottom;
  const points = [{ probability: 50, x: 0, play: null, scoring: false }, ...timeline.map((point, index) => ({ ...point, x: ((index + 1) / timeline.length) * width }))];
  const y = (probability) => plot.top + ((100 - probability) / 100) * plotHeight;
  const linePoints = points.map((point) => `${point.x.toFixed(2)},${y(point.probability).toFixed(2)}`).join(" ");
  const periods = new Map();
  timeline.forEach((point, index) => { const period = Number(point.play?.period?.number); if (!period) return; const range = periods.get(period) || { first: index, last: index }; range.last = index; periods.set(period, range); });
  const periodMarkup = [...periods.entries()].map(([period, range], index) => { const start = (range.first / timeline.length) * width; const end = ((range.last + 1) / timeline.length) * width; return `${index ? `<line x1="${start.toFixed(2)}" y1="${plot.top}" x2="${start.toFixed(2)}" y2="${y(0)}" class="win-probability-period-line" />` : ""}<text x="${((start + end) / 2).toFixed(2)}" y="${height - 10}" class="win-probability-period-label">${period <= 4 ? `Q${period}` : "OT"}</text>`; }).join("");
  const scoringPoints = points.filter((point) => point.scoring).map((point) => { const play = point.play || {}; const period = Number(play.period?.number); const periodLabel = period > 4 ? "OT" : `Q${period || "?"}`; const clock = play.clock?.displayValue ? ` ${play.clock.displayValue}` : ""; const label = `${periodLabel}${clock}: ${play.text || play.shortText || "Scoring play"} Ravens win probability ${point.probability.toFixed(1)}%`; return `<circle cx="${point.x.toFixed(2)}" cy="${y(point.probability).toFixed(2)}" r="6" class="win-probability-scoring-point" tabindex="0" data-win-probability-tooltip="${escapeHtml(label)}" />`; }).join("");
  els.win.innerHTML = `<div class="win-probability-chart-scroll"><svg class="win-probability-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Ravens win probability by quarter">${[100, 75, 50, 25, 0].map((value) => `<line x1="0" y1="${y(value)}" x2="${width}" y2="${y(value)}" class="win-probability-grid-line${value === 50 ? " is-midline" : ""}" /><text x="0" y="${y(value) - 5}" class="win-probability-axis-label">${value}%</text>`).join("")}${periodMarkup}<polygon points="0,${y(0)} ${linePoints} ${width},${y(0)}" class="win-probability-area" /><polyline points="${linePoints}" pathLength="1000" class="win-probability-line" />${scoringPoints}</svg></div>`;
  animateWinProbability();
}
function animateWinProbability() {
  if (state.animatedCharts.has(state.selectedId) || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("animate" in Element.prototype)) return;
  state.animatedCharts.add(state.selectedId);
  els.win.querySelector(".win-probability-line")?.animate([{ strokeDasharray: "1000", strokeDashoffset: "1000" }, { strokeDasharray: "1000", strokeDashoffset: "0" }], { duration: 1000, easing: "ease-out" });
  els.win.querySelector(".win-probability-area")?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1000, easing: "ease-out" });
}
function renderScoring() {
  const plays = state.summary?.scoringPlays || [];
  els.scoring.innerHTML = plays.length ? `<ol class="scoring-list">${plays.map((play) => `<li class="scoring-play"><img src="${escapeHtml(teamLogo(play.team?.abbreviation))}" alt=""><p><strong>${escapeHtml(play.type?.text || "Scoring play")}</strong><br>${escapeHtml(play.text || play.shortText || "")}</p><span class="score-chip">${escapeHtml(displayScore(play.awayScore))}-${escapeHtml(displayScore(play.homeScore))}</span></li>`).join("")}</ol>` : `<p class="empty-copy">Scoring plays will appear once the game begins.</p>`;
}
function teamStats(abbr) { const boxTeam = (state.summary?.boxscore?.teams || []).find((item) => item.team?.abbreviation === abbr); return new Map((boxTeam?.statistics || []).map((stat) => [stat.name, stat.displayValue])); }
const COMPARISON_STATS = [["Total Yards", "totalYards"], ["Passing Yards", "netPassingYards"], ["Rushing Yards", "rushingYards"], ["First Downs", "firstDowns"], ["Third Down", "thirdDownEff"], ["Turnovers", "turnovers"], ["Sacks", "sacksYardsLost"], ["Penalties", "totalPenaltiesYards"], ["Time of Possession", "possessionTime"]];
function comparisonMagnitude(value, key) {
  const text = String(value ?? "").trim();
  if (key === "possessionTime" && /^\d+:\d+$/.test(text)) { const [minutes, seconds] = text.split(":").map(Number); return minutes * 60 + seconds; }
  if (key === "thirdDownEff" && /^\d+\s*-\s*\d+/.test(text)) { const [made, attempts] = text.split("-").map(Number); return attempts ? made / attempts * 100 : 0; }
  const number = Number.parseFloat(text.replace(/,/g, "")); return Number.isFinite(number) ? Math.max(0, number) : 0;
}
function comparisonBarRow(label, key, ravensValue, opponentValue, opponentAbbr) {
  const ravensMagnitude = comparisonMagnitude(ravensValue, key); const opponentMagnitude = comparisonMagnitude(opponentValue, key); const scale = Math.max(ravensMagnitude, opponentMagnitude);
  const ravensWidth = scale ? ravensMagnitude / scale * 100 : 0; const opponentWidth = scale ? opponentMagnitude / scale * 100 : 0;
  return `<div class="comparison-stat" role="group" aria-label="${escapeHtml(`${label}: BAL ${ravensValue || "-"}; ${opponentAbbr} ${opponentValue || "-"}`)}"><div class="comparison-bars"><div class="comparison-track ravens${ravensMagnitude ? " has-value" : ""}"><span class="comparison-fill ravens" style="width:${ravensWidth.toFixed(1)}%"></span><strong>${escapeHtml(ravensValue || "-")}</strong></div><span class="comparison-stat-label">${escapeHtml(label)}</span><div class="comparison-track opponent${opponentMagnitude ? " has-value" : ""}"><span class="comparison-fill opponent" style="width:${opponentWidth.toFixed(1)}%"></span><strong>${escapeHtml(opponentValue || "-")}</strong></div></div></div>`;
}
function renderComparison() {
  const ravensAbbr = ravenEntry()?.team?.abbreviation || RAVENS_ABBR; const opponentAbbr = opponentEntry()?.team?.abbreviation || "OPP";
  const left = teamStats(ravensAbbr); const right = teamStats(opponentAbbr);
  els.comparison.innerHTML = `<div class="comparison-content" style="--comparison-opponent-color:${teamColor(opponentEntry()?.team)}"><div class="comparison-legend"><span><i class="ravens"></i>${escapeHtml(ravensAbbr)}</span><span><i class="opponent"></i>${escapeHtml(opponentAbbr)}</span></div><div class="comparison-list">${COMPARISON_STATS.map(([label, key]) => comparisonBarRow(label, key, left.get(key), right.get(key), opponentAbbr)).join("")}</div></div>`;
  animateComparison();
}
function animateComparison() {
  if (state.animatedComparisons.has(state.selectedId) || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("animate" in Element.prototype)) return;
  state.animatedComparisons.add(state.selectedId);
  els.comparison.querySelectorAll(".comparison-stat").forEach((row, index) => row.querySelectorAll(".comparison-fill").forEach((bar) => bar.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], { duration: 700, delay: index * 45, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" })));
}
const LEADER_CARDS = [
  { title: "Quarterbacks", category: /passing/i, position: /quarterback|\bQB\b/i, stats: [["CMP/ATT", ["C/ATT", "CMP/ATT"]], ["YDS", ["YDS"]], ["TD", ["TD"]], ["INT", ["INT"]]] },
  { title: "Running Backs", category: /rushing/i, position: /running back|fullback|\b(?:RB|FB)\b/i, stats: [["CAR", ["CAR"]], ["YDS", ["YDS"]], ["AVG", ["AVG"]], ["TD", ["TD"]]] },
  { title: "Top Receivers", category: /receiving/i, stats: [["REC", ["REC"]], ["YDS", ["YDS"]], ["TD", ["TD"]], ["TGTS", ["TGTS", "TGT"]]] },
];
function leaderCategory(teamAbbr, pattern) {
  const group = (state.summary?.boxscore?.players || []).find((item) => item.team?.abbreviation === teamAbbr);
  const category = (group?.statistics || []).find((item) => pattern.test(item.name || item.type || item.text || ""));
  return category ? { team: group.team, category } : null;
}
function leaderStat(entry, aliases) {
  if (!entry) return "—";
  const index = (entry.category.labels || []).findIndex((label) => aliases.includes(String(label).toUpperCase()));
  return index >= 0 ? entry.player.stats?.[index] ?? "—" : "—";
}
function selectLeader(teamAbbr, config) {
  const entry = leaderCategory(teamAbbr, config.category);
  if (!entry) return null;
  let players = entry.category.athletes || [];
  if (config.position) {
    const positionPlayers = players.filter((item) => config.position.test(`${item.athlete?.position?.displayName || item.athlete?.position?.name || ""} ${item.athlete?.position?.abbreviation || ""}`));
    if (positionPlayers.length) players = positionPlayers;
  }
  const yardsIndex = (entry.category.labels || []).findIndex((label) => /^YDS$/i.test(label));
  const player = [...players].sort((a, b) => (Number.parseFloat(b.stats?.[yardsIndex]) || 0) - (Number.parseFloat(a.stats?.[yardsIndex]) || 0))[0];
  return player ? { ...entry, player } : null;
}
function leaderPlayer(entry, side) {
  if (!entry) return `<div class="leader-player ${side}"><div class="leader-portrait-placeholder">—</div><strong>Not available</strong></div>`;
  const player = entry.player.athlete || {};
  const portrait = player.headshot?.href || player.headshot || (player.id ? `https://a.espncdn.com/i/headshots/nfl/players/full/${player.id}.png` : teamLogo(entry.team?.abbreviation));
  return `<div class="leader-player ${side}" style="--leader-team-color:${teamColor(entry.team)}"><span>${escapeHtml(entry.team?.abbreviation || "Team")}</span><img src="${escapeHtml(portrait)}" alt="${escapeHtml(player.displayName || "Player")}"><strong>${escapeHtml(player.displayName || "Player")}</strong></div>`;
}
function renderMetrics() {
  const ravensAbbr = ravenEntry()?.team?.abbreviation || RAVENS_ABBR;
  const opponentAbbr = opponentEntry()?.team?.abbreviation || "OPP";
  els.metrics.innerHTML = LEADER_CARDS.map((config) => {
    const ravens = selectLeader(ravensAbbr, config); const opponent = selectLeader(opponentAbbr, config);
    const stats = config.stats.map(([label, aliases]) => `<div class="leader-stat"><strong>${escapeHtml(leaderStat(ravens, aliases))}</strong><span>${escapeHtml(label)}</span><strong>${escapeHtml(leaderStat(opponent, aliases))}</strong></div>`).join("");
    return `<article class="leader-card"><h3>${escapeHtml(config.title)}</h3><div class="leader-matchup">${leaderPlayer(ravens, "ravens")}${leaderPlayer(opponent, "opponent")}</div><div class="leader-stats">${stats}</div></article>`;
  }).join("");
}
function playerCategories() {
  const wanted = state.statView === "offense" ? /passing|rushing|receiving/i : /defensive|interceptions|fumbles/i;
  return (state.summary?.boxscore?.players || []).flatMap((group) => (group.statistics || []).filter((category) => wanted.test(category.name || category.type || "")).map((category) => ({ team: group.team, category })));
}
function passingTable(category) {
  const isPassing = /passing/i.test(category.name || category.type || category.text || "");
  const labels = [...(category.labels || [])];
  const completionIndex = labels.findIndex((label) => /^(?:C|CMP)\/ATT$/i.test(label));
  const yardsIndex = labels.findIndex((label) => /^YDS$/i.test(label));
  if (!isPassing) return { labels, rows: category.athletes || [] };
  if (completionIndex >= 0) labels[completionIndex] = "CMP/ATT";
  if (yardsIndex < 0) return { labels, rows: category.athletes || [] };
  labels.splice(yardsIndex + 1, 0, "CMP%");
  const rows = (category.athletes || []).map((athlete) => {
    const stats = [...(athlete.stats || [])];
    const [completions, attempts] = String(stats[completionIndex] || "").split("/").map(Number);
    const percentage = Number.isFinite(completions) && Number.isFinite(attempts) && attempts > 0 ? `${(completions / attempts * 100).toFixed(1)}%` : "—";
    stats.splice(yardsIndex + 1, 0, percentage);
    return { ...athlete, stats };
  });
  return { labels, rows };
}
function rushingTable(category, team) {
  if (!/rushing/i.test(category.name || category.type || category.text || "")) return null;
  const sourceLabels = category.labels || [];
  const valueFor = (athlete, label) => {
    const index = sourceLabels.findIndex((item) => String(item).toUpperCase() === label);
    return index >= 0 ? athlete.stats?.[index] ?? "—" : "—";
  };
  const teamGroup = (state.summary?.boxscore?.players || []).find((group) => group.team?.abbreviation === team?.abbreviation);
  const fumbles = (teamGroup?.statistics || []).find((item) => /fumbles/i.test(item.name || item.type || item.text || ""));
  const fumbleIndex = (fumbles?.labels || []).findIndex((label) => /^FUM$/i.test(label));
  const rushingPlays = (state.summary?.plays || []).filter((play) => /rush|run/i.test(play.type?.text || play.type?.abbreviation || ""));
  const playBelongsTo = (play, athlete) => {
    const athleteId = String(athlete.athlete?.id || "");
    if (athleteId && (play.participants || []).some((participant) => String(participant.athlete?.id || participant.id || "") === athleteId)) return true;
    const lastName = String(athlete.athlete?.displayName || "").split(" ").at(-1);
    const escapedName = lastName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return Boolean(escapedName && new RegExp(`\\b${escapedName}\\b`, "i").test(play.text || play.shortText || ""));
  };
  const rows = (category.athletes || []).map((athlete) => {
    const rushLengths = rushingPlays.filter((play) => playBelongsTo(play, athlete)).map((play) => Number(play.statYardage)).filter(Number.isFinite);
    const fumbleAthlete = (fumbles?.athletes || []).find((entry) => String(entry.athlete?.id) === String(athlete.athlete?.id));
    const suppliedFumbles = valueFor(athlete, "FUM"); const suppliedLong = valueFor(athlete, "LONG");
    const fumbleValue = suppliedFumbles !== "—" ? suppliedFumbles : fumbleIndex >= 0 ? fumbleAthlete?.stats?.[fumbleIndex] ?? "0" : "0";
    const longest = suppliedLong !== "—" ? suppliedLong : rushLengths.length ? Math.max(...rushLengths) : "—";
    return { ...athlete, stats: [valueFor(athlete, "CAR"), valueFor(athlete, "YDS"), valueFor(athlete, "TD"), valueFor(athlete, "AVG"), longest, fumbleValue] };
  });
  return { labels: ["CAR", "YDS", "TD", "AVG", "LONG", "FUM"], rows };
}
function receivingTable(category) {
  if (!/receiving/i.test(category.name || category.type || category.text || "")) return null;
  const sourceLabels = category.labels || [];
  const valueFor = (athlete, ...labels) => {
    const index = sourceLabels.findIndex((item) => labels.includes(String(item).toUpperCase()));
    return index >= 0 ? athlete.stats?.[index] ?? "—" : "—";
  };
  const nflYac = (athlete) => {
    const fullName = String(athlete.athlete?.displayName || "").toUpperCase().replace(/[^A-Z ]/g, "").trim();
    const parts = fullName.split(/\s+/); const firstInitial = parts[0]?.[0]; const lastName = parts.at(-1);
    const team = (state.summary?.boxscore?.players || []).find((group) => (group.statistics || []).includes(category))?.team?.abbreviation;
    const match = (state.nflReceiving?.teams?.[team] || []).find((row) => { const nflName = String(row.name || "").toUpperCase().replace(/[^A-Z ]/g, " ").trim().split(/\s+/); return nflName[0]?.[0] === firstInitial && nflName.at(-1) === lastName; });
    return match?.yac ?? "—";
  };
  const rows = (category.athletes || []).map((athlete) => {
    const espnYac = valueFor(athlete, "YAC"); const yac = espnYac !== "—" && espnYac !== "" ? espnYac : nflYac(athlete);
    return { ...athlete, stats: [valueFor(athlete, "REC"), valueFor(athlete, "YDS"), valueFor(athlete, "TD"), valueFor(athlete, "TGTS", "TGT"), valueFor(athlete, "LONG", "LNG"), yac] };
  });
  return { labels: ["REC", "YDS", "TD", "TGTS", "LONG", "YAC"], rows };
}
function playerStatTable(category, team) { return rushingTable(category, team) || receivingTable(category) || passingTable(category); }
function renderPlayers() {
  const groups = playerCategories();
  if (!groups.length) { els.players.innerHTML = `<p class="empty-copy">${eventState(selectedEvent()) === "pre" ? "Player statistics will appear when the game begins." : "These player statistics are not available for this game."}</p>`; return; }
  els.players.innerHTML = groups.map(({ team, category }) => {
    const table = playerStatTable(category, team);
    const rows = table.rows.map((athlete) => `<tr><td>${escapeHtml(athlete.athlete?.displayName || "Player")}</td>${(athlete.stats || []).map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("");
    return `<div class="player-stats-wrap"><table class="player-table"><colgroup><col class="player-name-column"><col class="first-stat-column"><col span="${Math.max(0, table.labels.length - 1)}"></colgroup><thead><tr class="team-section-row"><td colspan="${table.labels.length + 1}">${escapeHtml(team?.abbreviation || "Team")} · ${escapeHtml(category.text || category.name || "Stats")}</td></tr><tr><th>Player</th>${table.labels.map((label) => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }).join("");
}
async function renderBreakingDetails() {
  try {
    const transactionData = await getJson("./api/transactions.php?v=2");
    const rosterData = await getJson(`${ESPN_SITE_API}/teams/bal/roster?season=${SEASON}`).catch(() => ({}));
    const roster = flattenRoster(rosterData);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const items = (transactionData.transactions || []).filter((transaction) => {
      const date = new Date(`${transaction.date}T00:00:00`);
      const age = today.getTime() - date.getTime();
      return Number.isFinite(date.getTime()) && age >= 0 && age <= 7 * 24 * 60 * 60 * 1000;
    }).flatMap((transaction) => {
      const moves = String(transaction.description || "").match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];
      return moves.map((description) => ({ date: transaction.date, description: description.trim() }));
    }).filter((item) => item.description).slice(0, 3); if (!items.length) return;
    els.breakingGrid.innerHTML = items.map((item) => {
      const text = item.description;
      const player = playerInStory({ headline: text, description: "" }, roster);
      const published = item.date ? formatDate(`${item.date}T12:00:00`, { month: "short", day: "numeric" }) : "";
      const image = playerHeadshot(player);
      const type = /injur|\bIR\b|physically unable|\bPUP\b|reserve list/i.test(text) ? "Injury Update" : /\btrad(?:e|ed|es|ing)\b/i.test(text) ? "Trade" : /\b(?:sign(?:ed|ing|s)?|claim(?:ed|s)?|acquir(?:ed|es|ing))\b/i.test(text) ? "Acquisition" : /\bdemot(?:e|ed|es|ing)\b/i.test(text) ? "Demotion" : /\b(?:promot(?:e|ed|es|ing)|elevat(?:e|ed|es|ing))\b/i.test(text) ? "Promotion" : "Roster Move";
      return `<article class="breaking-item"><img src="${escapeHtml(image)}" alt="${escapeHtml(playerName(player))}"><div class="breaking-copy"><div class="breaking-meta"><span>${escapeHtml(type)}</span><time>${escapeHtml(published)}</time></div><b>${escapeHtml(playerName(player) || "Baltimore Ravens")}</b><p>${escapeHtml(text)}</p></div></article>`;
    }).join(""); els.breaking.hidden = false;
  } catch (_) { /* Supplemental feed; the game center remains available. */ }
}
function renderDashboard() { els.dashboard.hidden = false; renderWinProbability(); renderScoring(); renderComparison(); renderMetrics(); renderPlayers(); }
async function selectGame(id, { scroll = false } = {}) {
  state.selectedId = String(id); state.summary = null; state.nflReceiving = null; renderSelectors(); renderGame(); els.winPanel.hidden = true; els.dashboard.hidden = true;
  try {
    state.summary = await getSummary(id); renderGame(); renderDashboard();
    const needsYac = (state.summary?.boxscore?.players || []).some((group) => (group.statistics || []).some((category) => {
      if (!/receiving/i.test(category.name || category.type || category.text || "")) return false;
      const yacIndex = (category.labels || []).findIndex((label) => /^YAC$/i.test(label));
      return yacIndex < 0 || (category.athletes || []).every((athlete) => athlete.stats?.[yacIndex] === null || athlete.stats?.[yacIndex] === undefined || athlete.stats?.[yacIndex] === "");
    }));
    if (needsYac) { try { state.nflReceiving = await getNflReceivingStats(selectedEvent()); renderPlayers(); } catch (_) { /* ESPN statistics remain available when the NFL fallback fails. */ } }
  } catch (_) { state.summary = null; renderDashboard(); els.status.textContent = "Some game details unavailable"; }
  if (scroll) els.game.scrollIntoView({ behavior: "smooth", block: "start" }); scheduleRefresh();
}
function scheduleRefresh() {
  window.clearInterval(state.timer);
  const event = selectedEvent(); const startTime = new Date(event?.date).getTime(); const now = Date.now();
  const nearKickoff = eventState(event) === "pre" && Number.isFinite(startTime) && now >= startTime - 3 * 60 * 60 * 1000 && now <= startTime + 8 * 60 * 60 * 1000;
  if (eventState(event) !== "in" && !nearKickoff) return;
  state.timer = window.setInterval(async () => { try { state.events = await getSchedule(); await selectGame(state.selectedId); } catch (_) { els.status.textContent = "Live update paused"; } }, REFRESH_MS);
}
async function init() {
  try {
    state.events = await getSchedule();
    const requestedId = new URLSearchParams(location.search).get("game");
    const featured = state.events.find((event) => String(event.id) === requestedId) || chooseFeatured(state.events);
    if (!featured) throw new Error("No 2026 Ravens games were returned.");
    await selectGame(featured.id); renderBreakingDetails();
  }
  catch (error) { els.status.textContent = "Schedule unavailable"; els.selector.innerHTML = `<p class="empty-copy">The 2026 schedule could not be loaded. Try again shortly.</p>`; els.game.innerHTML = `<p class="empty-copy">${escapeHtml(error.message)}</p>`; }
}
els.selector.addEventListener("click", (event) => { const button = event.target.closest("[data-event-id]"); if (button) selectGame(button.dataset.eventId, { scroll: true }); });
document.querySelector(".stat-toggle").addEventListener("click", (event) => { const button = event.target.closest("[data-stat-view]"); if (!button) return; state.statView = button.dataset.statView; document.querySelectorAll("[data-stat-view]").forEach((item) => item.classList.toggle("active", item === button)); renderPlayers(); });
document.querySelector("#breaking-close").addEventListener("click", () => { els.breaking.hidden = true; });

let winProbabilityTooltip;
function showWinProbabilityTooltip(point, clientX, clientY) {
  if (!winProbabilityTooltip?.isConnected) {
    winProbabilityTooltip = document.createElement("div"); winProbabilityTooltip.className = "win-probability-tooltip";
    winProbabilityTooltip.setAttribute("role", "tooltip"); document.body.append(winProbabilityTooltip);
  }
  const rect = point.getBoundingClientRect(); const anchorX = clientX ?? rect.left + rect.width / 2; const anchorY = clientY ?? rect.top;
  winProbabilityTooltip.textContent = point.dataset.winProbabilityTooltip || ""; winProbabilityTooltip.hidden = false;
  winProbabilityTooltip.style.left = `${anchorX}px`; winProbabilityTooltip.style.top = `${anchorY - 10}px`; winProbabilityTooltip.style.transform = "translate(-50%, -100%)";
  const tooltipRect = winProbabilityTooltip.getBoundingClientRect(); const halfWidth = tooltipRect.width / 2;
  winProbabilityTooltip.style.left = `${Math.min(window.innerWidth - halfWidth - 10, Math.max(halfWidth + 10, anchorX))}px`;
  if (tooltipRect.top < 10) { winProbabilityTooltip.style.top = `${anchorY + 12}px`; winProbabilityTooltip.style.transform = "translate(-50%, 0)"; }
}
function hideWinProbabilityTooltip() { if (winProbabilityTooltip) winProbabilityTooltip.hidden = true; }
els.win.addEventListener("pointerover", (event) => { const point = event.target.closest?.("[data-win-probability-tooltip]"); if (point) showWinProbabilityTooltip(point, event.clientX, event.clientY); });
els.win.addEventListener("pointermove", (event) => { const point = event.target.closest?.("[data-win-probability-tooltip]"); if (point) showWinProbabilityTooltip(point, event.clientX, event.clientY); });
els.win.addEventListener("pointerout", (event) => { const point = event.target.closest?.("[data-win-probability-tooltip]"); if (point && !point.contains(event.relatedTarget)) hideWinProbabilityTooltip(); });
els.win.addEventListener("focusin", (event) => { const point = event.target.closest?.("[data-win-probability-tooltip]"); if (point) showWinProbabilityTooltip(point); });
els.win.addEventListener("focusout", hideWinProbabilityTooltip);
init();
