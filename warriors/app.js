const espn = "https://site.api.espn.com/apis/site/v2/sports/basketball/nba";
const standingsUrl = "https://site.api.espn.com/apis/v2/sports/basketball/nba/standings";
const content = document.querySelector("#content");
const title = document.querySelector("#page-title");
const season = document.querySelector("#season");
const links = [...document.querySelectorAll(".site-nav a")];
const day = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "short", day: "numeric" });
const tipoff = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
const cache = new Map();
let renderId = 0;
let selectedGameId;

function html(value) {
  return String(value ?? "—").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

async function load(url) {
  if (cache.has(url)) return cache.get(url);
  const request = fetch(url).then(response => {
    if (!response.ok) throw new Error(`ESPN returned ${response.status}`);
    return response.json();
  });
  cache.set(url, request);
  try { return await request; }
  catch (error) { cache.delete(url); throw error; }
}

const game = event => event.competitions?.[0] || {};
const entries = event => game(event).competitors || [];
const phase = event => game(event).status?.type?.state || event.status?.type?.state;
const opponent = event => entries(event).find(entry => entry.team?.abbreviation !== "GS");
const warriors = event => entries(event).find(entry => entry.team?.abbreviation === "GS");
const score = value => value?.displayValue ?? value?.value ?? value ?? "—";
const matchup = event => `${warriors(event)?.homeAway === "away" ? "@" : "vs"} ${opponent(event)?.team?.shortDisplayName || opponent(event)?.team?.abbreviation || "TBD"}`;
const dateText = event => day.format(new Date(event.date));
const status = event => phase(event) === "pre" ? tipoff.format(new Date(event.date)) : (game(event).status || event.status)?.type?.shortDetail || "—";

function table(name, headings, rows) {
  return `<div class="table-scroll"><table aria-label="${html(name)}"><thead><tr>${headings.map(h => `<th scope="col">${html(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
}
function row(values, highlight = false) {
  return `<tr${highlight ? " data-warriors" : ""}>${values.map(value => `<td>${value}</td>`).join("")}</tr>`;
}
function panel(name, markup) {
  return `<section class="panel"><h3>${html(name)}</h3>${markup}</section>`;
}
async function schedule() {
  const data = await load(`${espn}/teams/gs/schedule`);
  return [...(data.events || [])].filter(event => event.date && entries(event).length === 2).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}
function gameScore(event) {
  return phase(event) === "pre" ? status(event) : entries(event).map(entry => `${entry.team?.abbreviation} ${score(entry.score)}`).join(" – ");
}
function teamRecord(entry) {
  const records = entry?.records || entry?.record || [];
  const items = Array.isArray(records) ? records : records.items || [];
  return (items.find(item => item.type === "total" || item.type === "overall" || item.name === "overall") || items[0])?.summary;
}
function teamColor(team, fallback) {
  return /^[a-f0-9]{6}$/i.test(team?.color || "") ? `#${team.color}` : fallback;
}
function probabilityCard(event, detail, teams) {
  const isHome = teams[0].homeAway === "home";
  const validNumber = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  let percent;
  let label;
  if (phase(event) !== "pre") {
    const latest = (detail?.winprobability || []).filter(point => validNumber(point.homeWinPercentage) && Number(point.homeWinPercentage) >= 0 && Number(point.homeWinPercentage) <= 1).at(-1);
    if (latest && ["home", "away"].includes(teams[0].homeAway)) {
      percent = (isHome ? Number(latest.homeWinPercentage) : 1 - Number(latest.homeWinPercentage)) * 100;
      label = "Play-by-play win probability";
    }
  } else {
    const projection = detail?.predictor?.[isHome ? "homeTeam" : "awayTeam"];
    if (projection && validNumber(projection.gameProjection) && ["home", "away"].includes(teams[0].homeAway)) {
      percent = Number(projection.gameProjection);
      label = "ESPN pregame prediction";
    }
  }
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    return panel("Warriors win probability", '<p class="muted">Win probability is not available for this game yet.</p>');
  }
  return `<section class="panel win-panel"><div class="probability-heading"><div><h3>Warriors win probability</h3><p class="muted">${label}</p></div><strong>${percent.toFixed(1)}%</strong></div><div class="probability-labels"><span>${html(teams[0].team?.abbreviation)} ${percent.toFixed(1)}%</span><span>${html(teams[1].team?.abbreviation)} ${(100 - percent).toFixed(1)}%</span></div><div class="probability-track" role="img" aria-label="Warriors ${percent.toFixed(1)} percent; ${html(teams[1].team?.displayName)} ${(100 - percent).toFixed(1)} percent"><span style="width:${percent}%"></span></div></section>`;
}
function gameCard(event, detail, profiles = []) {
  const competition = game(event);
  const detailed = detail?.header?.competitions?.[0];
  const teams = [warriors(event), opponent(event)].map((entry, index) => {
    const match = detailed?.competitors?.find(item => String(item.team?.id) === String(entry.team?.id));
    return { ...entry, ...match, team: { ...profiles[index], ...entry.team, ...match?.team }, recordText: teamRecord(match) || teamRecord(entry) || teamRecord(profiles[index]) || "Record unavailable" };
  });
  const venue = detail?.gameInfo?.venue || competition.venue;
  const broadcasts = [...(detailed?.broadcasts || []), ...(competition.broadcasts || [])];
  const channels = [...new Set(broadcasts.flatMap(item => item.names || [item.media?.shortName]).filter(Boolean))];
  const location = [venue?.address?.city, venue?.address?.state].filter(Boolean).join(", ");
  const info = [["Tipoff", `${dateText(event)}, ${tipoff.format(new Date(event.date))}`], ["Watch", channels.join(", ") || "Broadcast to be announced"], ["Venue", venue?.fullName || "Venue to be announced"], ...(location ? [["Location", location]] : [])];
  const renderTeam = (entry, index) => `<div class="score-team score-team--${index ? "right" : "left"}"><div class="team-identity"><strong>${html(entry.team?.displayName)}</strong><span class="team-record">${html(entry.recordText)}</span><span class="team-location">${entry.homeAway === "home" ? "Home" : entry.homeAway === "away" ? "Away" : ""}</span></div><img src="https://a.espncdn.com/i/teamlogos/nba/500/${encodeURIComponent(entry.team?.abbreviation?.toLowerCase() || "nba")}.png" alt=""><b>${html(phase(event) === "pre" ? "—" : score(entry.score))}</b></div>`;
  const headline = `<section class="matchup-panel panel" aria-label="Warriors matchup" style="--opponent-color:${teamColor(teams[1].team, '#49566f')}"><div class="scoreboard">${renderTeam(teams[0], 0)}<div class="game-status"><strong>${html(status(event))}</strong><span>${html(dateText(event))}</span></div>${renderTeam(teams[1], 1)}</div><div class="game-info-bar">${info.map(([label, value]) => `<span><b>${label}:</b> ${html(value)}</span>`).join("")}</div>${table("Quarter scores", ["Team", "Q1", "Q2", "Q3", "Q4", ...Array.from({ length: Math.max(0, ...teams.map(entry => (entry.linescores?.length || 0) - 4)) }, (_, i) => `OT${i + 1}`), "Total"], teams.map(entry => row([entry.team?.abbreviation, ...Array.from({ length: Math.max(4, ...teams.map(item => item.linescores?.length || 0)) }, (_, i) => score(entry.linescores?.[i])), phase(event) === "pre" ? "—" : score(entry.score)].map(html), entry.team?.abbreviation === "GS")))}</section>`;
  return headline + probabilityCard(event, detail, teams);
}

async function home() {
  const events = await schedule();
  const upcoming = events.filter(event => phase(event) === "pre");
  const recent = events.filter(event => phase(event) === "post").slice(-3);
  const live = events.find(event => phase(event) === "in");
  const selected = events.find(event => String(event.id) === selectedGameId) || live || upcoming[0] || recent.at(-1);
  if (!selected) return '<p class="panel">No Warriors games available.</p>';
  const picks = [...new Set([...recent, ...(live ? [live] : []), ...upcoming.slice(0, 3), selected])];
  const picker = `<div class="game-picker" aria-label="Select a Warriors game">${picks.map(event => `<button type="button" data-game="${html(event.id)}" aria-pressed="${event === selected}"><small>${html(dateText(event))}</small><strong>${html(matchup(event))}</strong><span>${html(gameScore(event))}</span></button>`).join("")}</div>`;
  const detail = await load(`${espn}/summary?event=${encodeURIComponent(selected.id)}`).catch(() => null);
  const profiles = await Promise.all([warriors(selected), opponent(selected)].map(async entry => {
    const detailed = detail?.header?.competitions?.[0]?.competitors?.find(item => String(item.team?.id) === String(entry.team?.id));
    if (teamRecord(detailed) || teamRecord(entry) || !entry.team?.id) return null;
    return (await load(`${espn}/teams/${encodeURIComponent(entry.team.id)}`).catch(() => null))?.team;
  }));
  return picker + gameCard(selected, detail, profiles);
}
async function renderSchedule() {
  const events = await schedule();
  return panel("Regular-season games", table("Warriors schedule", ["Date", "Opponent", "Status", "Score or tipoff"], events.map(event => row([
    html(dateText(event)),
    `<a href="#home" data-game="${html(event.id)}">${html(matchup(event))}</a>`,
    html(phase(event) === "pre" ? "Scheduled" : status(event)),
    html(gameScore(event)),
  ]))));
}

async function roster() {
  const data = await load(`${espn}/teams/gs/roster`);
  const players = data.athletes || [];
  return panel("Warriors roster", players.length ? table("Warriors roster", ["No.", "Player", "Position", "Height"], players.map(player => row([
    html(player.jersey),
    /^\d+$/.test(player.id) ? `<a href="https://www.espn.com/nba/player/_/id/${player.id}">${html(player.displayName)}</a>` : html(player.displayName),
    html(player.position?.abbreviation), html(player.displayHeight),
  ]))) : "<p>Roster unavailable.</p>");
}

const stat = (entry, name) => entry?.stats?.find(item => item.name === name)?.displayValue;
async function standings() {
  const data = await load(standingsUrl);
  return data.children || [];
}
async function teamEntry() {
  const conferences = await standings();
  return conferences.flatMap(group => group.standings?.entries || []).find(entry => entry.team?.abbreviation === "GS");
}
function metrics(items) {
  return `<dl class="metric-grid">${items.map(([label, value]) => `<div><dt>${html(label)}</dt><dd>${html(value)}</dd></div>`).join("")}</dl>`;
}
async function stats() {
  const entry = await teamEntry();
  return panel("Team scoring", metrics([["Points per game", stat(entry, "avgPointsFor")], ["Allowed per game", stat(entry, "avgPointsAgainst")], ["Point differential", stat(entry, "differential")]]));
}
async function team() {
  const entry = await teamEntry();
  return panel("Season record", metrics([["Overall", stat(entry, "overall")], ["Home", stat(entry, "Home")], ["Away", stat(entry, "Road")], ["Last 10", stat(entry, "Last Ten Games")], ["Streak", stat(entry, "streak")]]));
}
async function league() {
  const [conferences, scoreboard] = await Promise.all([standings(), load(`${espn}/scoreboard`).catch(() => null)]);
  const games = scoreboard?.events || [];
  const scores = games.length ? panel(`NBA scores · ${dateText(games[0])}`, table("NBA scoreboard", ["Away", "Home", "Status"], games.map(event => row(["away", "home"].map(side => {
    const entry = entries(event).find(team => team.homeAway === side);
    return html(phase(event) === "pre" ? entry?.team?.displayName : `${entry?.team?.displayName || "TBD"} ${score(entry?.score)}`);
  }).concat(html(status(event))))))) : "";
  return scores + conferences.map(group => panel(group.name, table(group.name, ["Team", "W", "L", "PCT", "GB"], (group.standings?.entries || []).map(entry => row([
    entry.team?.displayName, stat(entry, "wins"), stat(entry, "losses"), stat(entry, "winPercent"), stat(entry, "gamesBehind"),
  ].map(html), entry.team?.abbreviation === "GS"))))).join("");
}

const pages = {
  home: ["Game Center", home], roster: ["Roster", roster], stats: ["Stats", stats],
  schedule: ["Schedule", renderSchedule], team: ["Team Overview", team], league: ["Around the League", league],
};

async function render() {
  const id = ++renderId;
  const hash = location.hash.slice(1);
  const active = Object.hasOwn(pages, hash) ? hash : "home";
  const [label, view] = pages[active];
  title.textContent = label;
  for (const link of links) {
    if (link.hash === `#${active}`) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  content.setAttribute("aria-busy", "true");
  content.innerHTML = '<p class="panel" role="status">Loading Warriors data…</p>';
  try {
    const markup = await view();
    if (id === renderId) content.innerHTML = markup;
  } catch {
    if (id === renderId) content.innerHTML = '<p class="panel" role="status">NBA data couldn’t load. Refresh the page to try again.</p>';
  } finally {
    if (id === renderId) content.setAttribute("aria-busy", "false");
  }
}

content.addEventListener("click", event => {
  const control = event.target.closest("[data-game]");
  if (!control) return;
  selectedGameId = control.dataset.game;
  if (control.tagName === "BUTTON") render();
});
window.addEventListener("hashchange", render);
load(`${espn}/teams/gs/schedule`).then(data => { season.textContent = data.season?.displayName || ""; }).catch(() => {});
render();
window.setInterval(() => {
  cache.clear();
  if (!location.hash || location.hash === "#home" || location.hash === "#league") render();
}, 60000);
