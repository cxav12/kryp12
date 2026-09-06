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
const state = { events: [], selectedId: "", summary: null, comparisonTeam: RAVENS_ABBR, statView: "offense", timer: null };
const els = {
  title: document.querySelector("#page-title"), description: document.querySelector("#page-description"),
  status: document.querySelector("#data-status"), selector: document.querySelector("#game-selector-grid"),
  game: document.querySelector("#game-card"), dashboard: document.querySelector("#dashboard"),
  breaking: document.querySelector("#breaking-details"), breakingGrid: document.querySelector("#breaking-grid"),
  win: document.querySelector("#win-probability"), scoring: document.querySelector("#scoring-plays"),
  comparison: document.querySelector("#team-comparison"), comparisonToggle: document.querySelector("#comparison-toggle"),
  metrics: document.querySelector("#game-metrics"), players: document.querySelector("#player-stats"),
};

function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
function teamLogo(abbr) { return `https://a.espncdn.com/i/teamlogos/nfl/500/${String(abbr || "nfl").toLowerCase()}.png`; }
function teamColor(team) { return TEAM_COLORS[String(team?.abbreviation || "").toUpperCase()] || "#241773"; }
function eventState(event) { return event?.competitions?.[0]?.status?.type?.state || event?.status?.type?.state || "pre"; }
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

function chooseFeatured(events) {
  const live = events.find((event) => eventState(event) === "in");
  const upcoming = events.find((event) => eventState(event) === "pre" && new Date(event.date) >= new Date(Date.now() - 6 * 60 * 60 * 1000));
  const finals = events.filter((event) => eventState(event) === "post");
  return live || upcoming || finals.at(-1) || events[0];
}
function selectorEvents(events) {
  const completed = events.filter((event) => eventState(event) === "post").slice(-3);
  const upcoming = events.filter((event) => eventState(event) !== "post").slice(0, 3);
  return [...upcoming, ...completed];
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
    return `<button class="${currentState === "post" ? `completed ${resultClass}` : currentState === "in" ? "live" : "upcoming"}${String(event.id) === String(state.selectedId) ? " active" : ""}" type="button" data-event-id="${escapeHtml(event.id)}"><span class="selector-date">${escapeHtml(date)}</span><span class="selector-matchup">${currentState === "post" ? completedLine : currentState === "in" ? liveLine : upcomingLine}</span></button>`;
  }).join("") || `<p class="empty-copy">The 2026 schedule is not available yet.</p>`;
}
function quarterScores(entry) { const scores = (entry?.linescores || []).map((item) => displayScore(item, "-")); return [0, 1, 2, 3].map((index) => scores[index] ?? "-"); }
function scoreTeam(entry, side = "left") {
  const team = entry.team || {};
  const info = `<div class="score-team-info"><strong>${escapeHtml(team.displayName || "TBD")}</strong><span>${escapeHtml(recordText(entry))}</span></div>`;
  const image = `<img src="${escapeHtml(teamLogo(team.abbreviation))}" alt="${escapeHtml(team.displayName || "Team")} logo">`;
  const score = `<b class="team-score">${escapeHtml(displayScore(entry.score))}</b>`;
  return `<div class="score-team ${side}" style="--team-color:${teamColor(team)}">${side === "right" ? `${score}${image}${info}` : `${info}${image}${score}`}</div>`;
}
function quarterRow(entry, scores) { return `<tr><th>${escapeHtml(entry.team?.abbreviation || "TBD")}</th>${scores.map((score) => `<td>${escapeHtml(score)}</td>`).join("")}<td>${escapeHtml(displayScore(entry.score))}</td></tr>`; }
function renderGame() {
  const event = selectedEvent(); const game = competition(event);
  const ravens = (game.competitors || []).find((item) => item.team?.abbreviation === RAVENS_ABBR) || {};
  const opponent = (game.competitors || []).find((item) => item.team?.abbreviation !== RAVENS_ABBR) || {};
  const status = game.status?.type || event?.status?.type || {}; const currentState = status.state || "pre";
  const venue = game.venue?.fullName || "Venue TBD";
  const broadcast = game.broadcasts?.flatMap((item) => item.names || []).join(" / ") || "Broadcast TBD";
  const weather = game.weather?.displayValue || "Forecast pending";
  els.title.textContent = currentState === "in" ? "Live Game" : currentState === "post" ? "Game Recap" : "Game Preview";
  els.description.textContent = currentState === "in" ? "Live scoring, game flow, and updated team statistics." : currentState === "post" ? "Final score, scoring plays, and game statistics." : "Upcoming matchup details, notes, and scheduled kickoff.";
  els.status.textContent = currentState === "in" ? "Live · updates every 30 sec" : currentState === "post" ? "Final" : "2026 schedule";
  const kickoff = formatDate(event.date, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  els.game.innerHTML = `<div class="scoreboard" style="--left-team-color:${teamColor(ravens.team)};--right-team-color:${teamColor(opponent.team)}">${scoreTeam(ravens, "left")}<div class="game-state"><strong>${escapeHtml(status.shortDetail || status.description || "Scheduled")}</strong><span>${escapeHtml(kickoff)}</span></div>${scoreTeam(opponent, "right")}</div><div class="game-info-bar"><span><b>Kickoff:</b> ${escapeHtml(kickoff)}</span><i></i><span><b>Watch:</b> ${escapeHtml(broadcast)}</span><i></i><span><b>Venue:</b> ${escapeHtml(venue)}</span><i></i><span><b>Conditions:</b> ${escapeHtml(weather)}</span></div><div class="quarter-board"><table><thead><tr><th>Team</th><th>1</th><th>2</th><th>3</th><th>4</th><th>Total</th></tr></thead><tbody>${quarterRow(ravens, quarterScores(ravens))}${quarterRow(opponent, quarterScores(opponent))}</tbody></table></div>`;
}

function renderWinProbability() {
  const game = competition(); const home = (game.competitors || []).find((item) => item.homeAway === "home") || {};
  const latest = (state.summary?.winprobability || []).at(-1); let ravensPct = 50;
  if (latest && Number.isFinite(Number(latest.homeWinPercentage))) { const homePct = Number(latest.homeWinPercentage) * 100; ravensPct = home.team?.abbreviation === RAVENS_ABBR ? homePct : 100 - homePct; }
  else {
    const projectedHomePct = Number(state.summary?.predictor?.homeTeam?.gameProjection);
    if (Number.isFinite(projectedHomePct)) ravensPct = home.team?.abbreviation === RAVENS_ABBR ? projectedHomePct : 100 - projectedHomePct;
  }
  ravensPct = Math.max(0, Math.min(100, ravensPct)); const opponent = opponentEntry();
  els.win.innerHTML = `<div class="probability"><div class="probability-labels"><span>BAL ${ravensPct.toFixed(1)}%</span><span>${escapeHtml(opponent?.team?.abbreviation || "OPP")} ${(100 - ravensPct).toFixed(1)}%</span></div><div class="probability-track"><span class="probability-ravens" style="width:${ravensPct}%"></span><span class="probability-opponent"></span></div></div>`;
}
function renderScoring() {
  const plays = state.summary?.scoringPlays || [];
  els.scoring.innerHTML = plays.length ? `<ol class="scoring-list">${plays.map((play) => `<li class="scoring-play"><img src="${escapeHtml(teamLogo(play.team?.abbreviation))}" alt=""><p><strong>${escapeHtml(play.type?.text || "Scoring play")}</strong><br>${escapeHtml(play.text || play.shortText || "")}</p><span class="score-chip">${escapeHtml(displayScore(play.awayScore))}-${escapeHtml(displayScore(play.homeScore))}</span></li>`).join("")}</ol>` : `<p class="empty-copy">Scoring plays will appear once the game begins.</p>`;
}
function teamStats(abbr) { const boxTeam = (state.summary?.boxscore?.teams || []).find((item) => item.team?.abbreviation === abbr); return new Map((boxTeam?.statistics || []).map((stat) => [stat.name, stat.displayValue])); }
const COMPARISON_STATS = [["Total Yards", "totalYards"], ["Passing Yards", "netPassingYards"], ["Rushing Yards", "rushingYards"], ["First Downs", "firstDowns"], ["Third Down", "thirdDownEff"], ["Turnovers", "turnovers"], ["Sacks", "sacksYardsLost"], ["Penalties", "totalPenaltiesYards"], ["Time of Possession", "possessionTime"]];
function renderComparison() {
  const ravensAbbr = ravenEntry()?.team?.abbreviation || RAVENS_ABBR; const opponentAbbr = opponentEntry()?.team?.abbreviation || "OPP";
  els.comparisonToggle.innerHTML = [ravensAbbr, opponentAbbr].map((abbr) => `<button class="${state.comparisonTeam === abbr ? "active" : ""}" type="button" data-comparison-team="${escapeHtml(abbr)}">${escapeHtml(abbr)}</button>`).join("");
  const left = teamStats(ravensAbbr); const right = teamStats(opponentAbbr);
  els.comparison.innerHTML = `<table class="comparison-table"><tbody>${COMPARISON_STATS.map(([label, key]) => `<tr><td class="${state.comparisonTeam === ravensAbbr ? "selected" : ""}">${escapeHtml(left.get(key) || "-")}</td><th>${escapeHtml(label)}</th><td class="${state.comparisonTeam === opponentAbbr ? "selected" : ""}">${escapeHtml(right.get(key) || "-")}</td></tr>`).join("")}</tbody></table>`;
}
function extractLongest(pattern) { let best = 0; for (const play of state.summary?.plays || []) { const match = String(play.text || "").match(pattern); if (match) best = Math.max(best, Number(match[1]) || 0); } return best ? `${best} YDS` : "—"; }
function renderMetrics() {
  const metrics = [["Longest Throw", extractLongest(/pass[^.]*for (\d+) yard/i)], ["Longest Run", extractLongest(/(?:rush|run)[^.]*for (\d+) yard/i)], ["Longest Catch", extractLongest(/complete[^.]*for (\d+) yard/i)]];
  els.metrics.innerHTML = metrics.map(([label, value]) => `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
}
function playerCategories() {
  const wanted = state.statView === "offense" ? /passing|rushing|receiving/i : /defensive|interceptions|fumbles/i;
  return (state.summary?.boxscore?.players || []).flatMap((group) => (group.statistics || []).filter((category) => wanted.test(category.name || category.type || "")).map((category) => ({ team: group.team, category })));
}
function renderPlayers() {
  const groups = playerCategories();
  if (!groups.length) { els.players.innerHTML = `<p class="empty-copy">${eventState(selectedEvent()) === "pre" ? "Player statistics will appear when the game begins." : "These player statistics are not available for this game."}</p>`; return; }
  els.players.innerHTML = groups.map(({ team, category }) => { const labels = category.labels || []; const rows = (category.athletes || []).map((athlete) => `<tr><td>${escapeHtml(athlete.athlete?.displayName || "Player")}</td>${(athlete.stats || []).map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join(""); return `<div class="player-stats-wrap"><table class="player-table"><thead><tr class="team-section-row"><td colspan="${labels.length + 1}">${escapeHtml(team?.abbreviation || "Team")} · ${escapeHtml(category.text || category.name || "Stats")}</td></tr><tr><th>Player</th>${labels.map((label) => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`; }).join("");
}
async function renderBreakingDetails() {
  try {
    const [news, rosterData] = await Promise.all([getJson(`${ESPN_SITE_API}/news?team=${RAVENS_ID}&limit=40`), getJson(`${ESPN_SITE_API}/teams/bal/roster?season=${SEASON}`)]);
    const roster = flattenRoster(rosterData); const pattern = /injur|suspend|sign|waiv|trade|release|activate|reserve|roster|return|practice squad|transaction/i;
    const items = (news.articles || []).map((article) => ({ article, player: playerInStory(article, roster) })).filter(({ article, player }) => {
      const text = `${article.headline || ""} ${article.description || ""}`;
      return player && /\b(?:Baltimore|Ravens)\b/i.test(text) && pattern.test(text);
    }).sort((a, b) => new Date(b.article.published || 0) - new Date(a.article.published || 0)).slice(0, 3); if (!items.length) return;
    els.breakingGrid.innerHTML = items.map(({ article: item, player }) => {
      const text = `${item.headline || ""} ${item.description || ""}`;
      const published = item.published ? formatDate(item.published, { month: "short", day: "numeric" }) : "";
      const image = playerHeadshot(player);
      const type = /injur|reserve|return/i.test(text) ? "Roster Update" : /sign|waiv|trade|release|activate|practice squad|transaction/i.test(text) ? "Transaction" : "Ravens News";
      const url = item.links?.web?.href || item.link || "";
      const content = `<img src="${escapeHtml(image)}" alt="${escapeHtml(playerName(player))}"><div class="breaking-copy"><div class="breaking-meta"><span>${escapeHtml(type)}</span><time>${escapeHtml(published)}</time></div><b>${escapeHtml(item.headline)}</b><p>${escapeHtml(item.description || "Baltimore Ravens team update")}</p></div>`;
      return url ? `<a class="breaking-item" href="${escapeHtml(url)}" target="_blank" rel="noopener">${content}</a>` : `<article class="breaking-item">${content}</article>`;
    }).join(""); els.breaking.hidden = false;
  } catch (_) { /* Supplemental feed; the game center remains available. */ }
}
function renderDashboard() { els.dashboard.hidden = false; renderWinProbability(); renderScoring(); renderComparison(); renderMetrics(); renderPlayers(); }
async function selectGame(id, { scroll = false } = {}) {
  state.selectedId = String(id); renderSelectors(); renderGame(); els.dashboard.hidden = true;
  try { state.summary = await getSummary(id); renderDashboard(); } catch (_) { state.summary = null; renderDashboard(); els.status.textContent = "Some game details unavailable"; }
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
els.comparisonToggle.addEventListener("click", (event) => { const button = event.target.closest("[data-comparison-team]"); if (!button) return; state.comparisonTeam = button.dataset.comparisonTeam; renderComparison(); });
document.querySelector(".stat-toggle").addEventListener("click", (event) => { const button = event.target.closest("[data-stat-view]"); if (!button) return; state.statView = button.dataset.statView; document.querySelectorAll("[data-stat-view]").forEach((item) => item.classList.toggle("active", item === button)); renderPlayers(); });
document.querySelector("#breaking-close").addEventListener("click", () => { els.breaking.hidden = true; });
init();
