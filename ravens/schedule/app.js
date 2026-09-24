const DEFAULT_SEASON = 2026;
const MIN_SEASON = 2020;
const RAVENS_ABBR = "BAL";
const ESPN_API = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const state = { season: DEFAULT_SEASON, events: [] };
const els = {
  status: document.querySelector("#schedule-status"), summary: document.querySelector("#season-summary"),
  select: document.querySelector("#season-select"), previous: document.querySelector("#previous-year"),
  next: document.querySelector("#next-year"), sections: document.querySelector("#schedule-sections"),
};
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
function teamLogo(abbr) { return `https://a.espncdn.com/i/teamlogos/nfl/500/${String(abbr || "nfl").toLowerCase()}.png`; }
async function getJson(url) { const response = await fetch(url); if (!response.ok) throw new Error(`Schedule request returned ${response.status}`); return response.json(); }
function competition(event) { return event?.competitions?.[0] || {}; }
function competitors(event) { return competition(event).competitors || []; }
function ravensEntry(event) { return competitors(event).find((entry) => entry.team?.abbreviation === RAVENS_ABBR) || {}; }
function opponentEntry(event) { return competitors(event).find((entry) => entry.team?.abbreviation !== RAVENS_ABBR) || {}; }
function scoreValue(score) {
  if (score === null || score === undefined || score === "") return null;
  const value = typeof score === "object" ? score.displayValue ?? score.value ?? score.score : score;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function eventState(event) { return competition(event).status?.type?.state || event?.status?.type?.state || "pre"; }
function seasonType(event) {
  const value = event.seasonType || competition(event).seasonType || {};
  const id = Number(value.id || value.type || event.season?.type);
  const name = String(value.name || value.displayName || value.slug || "").toLowerCase();
  if (id === 1 || /preseason/.test(name)) return "preseason";
  if (id === 3 || /postseason|playoff/.test(name)) return "postseason";
  return "regular";
}
function formatDate(value, options) { return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...options }).format(new Date(value)); }
function gameTime(event) {
  const status = competition(event).status?.type || event.status?.type || {};
  if (status.state === "in") return status.shortDetail || status.detail || "Live";
  if (status.state === "post") return "Final";
  if (!event.date || /tbd/i.test(status.description || "")) return "TBD / Flex";
  return formatDate(event.date, { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}
function weekLabel(event) {
  return event.week?.text || event.week?.number && `Week ${event.week.number}` || competition(event).notes?.[0]?.headline || (seasonType(event) === "preseason" ? "Preseason" : "Week");
}
function withByeWeek(events) {
  const numberedWeeks = new Set(events.map((event) => Number(event.week?.number)).filter((week) => week >= 1 && week <= 18));
  if (numberedWeeks.size < 17) return events;
  const byeWeek = Array.from({ length: 18 }, (_, index) => index + 1).find((week) => !numberedWeeks.has(week));
  if (!byeWeek) return events;
  const nextGame = events.find((event) => Number(event.week?.number) > byeWeek);
  const previousGame = [...events].reverse().find((event) => Number(event.week?.number) < byeWeek);
  const adjacentDate = nextGame?.date ? new Date(nextGame.date).getTime() - 7 * 24 * 60 * 60 * 1000 : new Date(previousGame.date).getTime() + 7 * 24 * 60 * 60 * 1000;
  const bye = { id: `bye-${state.season}-${byeWeek}`, date: new Date(adjacentDate).toISOString(), week: { number: byeWeek, text: `Week ${byeWeek}` }, _bye: true, status: { type: { state: nextGame && eventState(nextGame) === "post" ? "post" : "pre" } } };
  return [...events, bye].sort((a, b) => Number(a.week?.number) - Number(b.week?.number));
}
function resultInfo(event) {
  const status = competition(event).status?.type || {};
  if (status.state === "in") return { text: status.shortDetail || "Live", className: "live" };
  if (status.state !== "post") return { text: gameTime(event), className: "" };
  const ravensScore = scoreValue(ravensEntry(event).score); const opponentScore = scoreValue(opponentEntry(event).score);
  if (ravensScore === null || opponentScore === null) return { text: "Final", className: "" };
  const letter = ravensScore > opponentScore ? "W" : ravensScore < opponentScore ? "L" : "T";
  return { text: `${letter} ${ravensScore}-${opponentScore}`, className: letter === "W" ? "win" : letter === "L" ? "loss" : "" };
}
function gameRow(event) {
  if (event._bye) return `<li class="schedule-row bye-row"><div class="schedule-week"><span>Rest Week</span><strong>${escapeHtml(weekLabel(event))}</strong></div><div class="matchup"><img src="${escapeHtml(teamLogo(RAVENS_ABBR))}" alt=""><div><span>No opponent</span><strong>Baltimore Ravens Bye Week</strong></div></div><div class="result bye">BYE</div><div class="schedule-venue"><span>No game</span><strong>Team rest week</strong></div></li>`;
  const game = competition(event); const ravens = ravensEntry(event); const opponent = opponentEntry(event); const result = resultInfo(event);
  const location = ravens.homeAway === "away" ? "Away" : "Home";
  const date = formatDate(event.date, { weekday: "short", month: "short", day: "numeric" });
  const broadcast = game.broadcasts?.flatMap((item) => item.names || []).join(" / ") || "Broadcast TBD";
  const venue = game.venue?.fullName || "Venue TBD";
  return `<li class="schedule-row"><div class="schedule-week"><span>${escapeHtml(date)}</span><strong>${escapeHtml(weekLabel(event))}</strong></div><div class="matchup"><img src="${escapeHtml(teamLogo(opponent.team?.abbreviation))}" alt=""><div><span>${escapeHtml(location)} · ${ravens.homeAway === "away" ? "at" : "vs"}</span><strong>${escapeHtml(opponent.team?.displayName || "Opponent TBD")}</strong></div></div><div class="result ${escapeHtml(result.className)}">${escapeHtml(result.text)}</div><div class="schedule-venue"><span>${escapeHtml(broadcast)}</span><strong>${escapeHtml(venue)}</strong></div><a class="game-center-link" href="./?game=${encodeURIComponent(event.id)}">Game Center</a></li>`;
}
function scheduleSection(key, title, games, emptyMessage = "") {
  if (!games.length && key === "postseason") return "";
  const contents = games.length ? `<ol class="schedule-list">${games.map(gameRow).join("")}</ol>` : `<p class="section-empty">${escapeHtml(emptyMessage)}</p>`;
  const gameCount = games.filter((event) => !event._bye).length; const byeCount = games.length - gameCount;
  const count = `${gameCount} ${gameCount === 1 ? "game" : "games"}${byeCount ? ` · ${byeCount} bye` : ""}`;
  return `<section class="schedule-section" data-section="${escapeHtml(key)}"><header class="schedule-heading"><div><h2>${escapeHtml(title)}</h2></div><span class="game-count">${escapeHtml(count)}</span></header>${contents}</section>`;
}
function render() {
  const preseason = state.events.filter((event) => seasonType(event) === "preseason");
  const regularGames = state.events.filter((event) => seasonType(event) === "regular");
  const regular = withByeWeek(regularGames);
  const postseason = state.events.filter((event) => seasonType(event) === "postseason");
  const completed = regular.filter((event) => eventState(event) === "post");
  const pending = regular.filter((event) => eventState(event) !== "post");
  const upcoming = pending.slice(0, 1); const future = pending.slice(1);
  els.sections.innerHTML = [
    scheduleSection("preseason", "Preseason Games", preseason, "No preseason games are listed."),
    scheduleSection("completed", "Completed Games", completed, "No regular-season games have been completed."),
    scheduleSection("upcoming", "Upcoming Game", upcoming, "The next regular-season game has not been scheduled."),
    scheduleSection("future", "Future Games", future, "No additional regular-season games are listed."),
    scheduleSection("postseason", "Postseason Games", postseason),
  ].join("");
  els.summary.textContent = `${state.events.length} Ravens games and ${regular.some((event) => event._bye) ? "1 bye week" : "no listed bye week"} for ${state.season}`;
  els.status.textContent = `${state.season} schedule loaded`;
}
function populateYears() {
  els.select.innerHTML = Array.from({ length: DEFAULT_SEASON - MIN_SEASON + 1 }, (_, index) => DEFAULT_SEASON - index).map((year) => `<option value="${year}">${year}</option>`).join("");
  els.select.value = String(state.season); els.previous.disabled = state.season <= MIN_SEASON; els.next.disabled = state.season >= DEFAULT_SEASON;
}
async function loadSeason(year) {
  state.season = Math.max(MIN_SEASON, Math.min(DEFAULT_SEASON, Number(year) || DEFAULT_SEASON));
  populateYears(); els.status.textContent = `Loading ${state.season} schedule`; els.summary.textContent = "Connecting to ESPN";
  els.sections.innerHTML = `<p class="loading-copy">Loading ${state.season} Ravens games…</p>`;
  try {
    const data = await getJson(`${ESPN_API}/teams/bal/schedule?season=${state.season}`);
    state.events = (data.events || []).sort((a, b) => new Date(a.date) - new Date(b.date));
    render(); history.replaceState(null, "", `./schedule/?season=${state.season}`);
  } catch (error) {
    state.events = []; els.status.textContent = "Schedule unavailable"; els.summary.textContent = error.message;
    els.sections.innerHTML = `<p class="section-empty">The ${state.season} Ravens schedule could not be loaded. Try again shortly.</p>`;
  }
}
els.select.addEventListener("change", () => loadSeason(els.select.value));
els.previous.addEventListener("click", () => loadSeason(state.season - 1));
els.next.addEventListener("click", () => loadSeason(state.season + 1));
const requestedSeason = Number(new URLSearchParams(location.search).get("season"));
loadSeason(requestedSeason >= MIN_SEASON && requestedSeason <= DEFAULT_SEASON ? requestedSeason : DEFAULT_SEASON);
