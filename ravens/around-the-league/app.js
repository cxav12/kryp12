const SEASON = 2026;
const API = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const LEADERS_API = "https://site.api.espn.com/apis/site/v3/sports/football/nfl/leaders";
const NORTH = new Set(["bal", "cin", "cle", "pit"]);
const AFC = new Set(["bal","buf","cin","cle","den","hou","ind","jax","kc","lac","lv","mia","ne","nyj","pit","ten"]);
const DIVISIONS = { bal:"AFC North",cin:"AFC North",cle:"AFC North",pit:"AFC North",buf:"AFC East",mia:"AFC East",ne:"AFC East",nyj:"AFC East",hou:"AFC South",ind:"AFC South",jax:"AFC South",ten:"AFC South",den:"AFC West",kc:"AFC West",lac:"AFC West",lv:"AFC West",chi:"NFC North",det:"NFC North",gb:"NFC North",min:"NFC North",dal:"NFC East",nyg:"NFC East",phi:"NFC East",wsh:"NFC East",atl:"NFC South",car:"NFC South",no:"NFC South",tb:"NFC South",ari:"NFC West",lar:"NFC West",sea:"NFC West",sf:"NFC West" };
const state = { week: 1, maxWeek: 18, conference: "afc", leaderType: "players", category: "passingYards", games: [], standings: [], leaders: null };
const els = { status: document.querySelector("#league-status"), games: document.querySelector("#division-games"), otherGames: document.querySelector("#other-games"), otherWeek: document.querySelector("#other-games-week"), week: document.querySelector("#week-label"), previous: document.querySelector("#previous-week"), next: document.querySelector("#next-week"), standings: document.querySelector("#standings-body"), standingsSummary: document.querySelector("#standings-summary"), leaders: document.querySelector("#leader-list"), leadersSummary: document.querySelector("#leaders-summary"), category: document.querySelector("#leader-category") };
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
async function getJson(url) { const response = await fetch(url); if (!response.ok) throw new Error(`Data request returned ${response.status}`); return response.json(); }
function logo(team) { return team?.logo || team?.logos?.[0]?.href || `https://a.espncdn.com/i/teamlogos/nfl/500/${team?.abbreviation?.toLowerCase()}.png`; }
function formatDate(value) { return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(new Date(value)); }
async function loadGames() {
  els.games.innerHTML = '<p class="empty-copy">Loading AFC North games…</p>';
  try {
    const data = await getJson(`${API}/scoreboard?dates=${SEASON}&seasontype=2&week=${state.week}&limit=100`);
    state.games = data.events || [];
  } catch { state.games = []; }
  renderGames();
}
async function currentWeekNumber() {
  try {
    const data = await getJson(`${API}/scoreboard?dates=${SEASON}&seasontype=2&limit=100`);
    const week = Number(data.week?.number || data.week?.value || data.events?.[0]?.week?.number);
    return Number.isInteger(week) && week >= 1 && week <= state.maxWeek ? week : 1;
  } catch { return 1; }
}
function renderGames() {
  els.week.textContent = `Week ${state.week}`; els.otherWeek.textContent = state.week; els.previous.disabled = state.week <= 1; els.next.disabled = state.week >= state.maxWeek;
  if (!state.games.length) { els.games.innerHTML = `<p class="empty-copy">The 2026 Week ${state.week} schedule is not available yet.</p>`; els.otherGames.innerHTML = ""; return; }
  const scoreCards = (events) => events.map((event) => {
    const competition = event.competitions[0]; const status = event.status?.type; const teams = [...competition.competitors].sort((a, b) => (b.homeAway === "away") - (a.homeAway === "away"));
    return `<article class="score-card"><div class="score-meta"><span>${escapeHtml(status?.shortDetail || formatDate(event.date))}</span><span>${escapeHtml(competition.broadcasts?.[0]?.names?.[0] || "NFL")}</span></div>${teams.map((entry) => { const team = entry.team; const north = NORTH.has(team.abbreviation?.toLowerCase()); return `<div class="score-team-row ${north ? "afc-north" : ""}"><img src="${escapeHtml(logo(team))}" alt=""><strong>${escapeHtml(team.shortDisplayName || team.displayName)}</strong><b>${status?.completed || status?.state === "in" ? escapeHtml(entry.score || "0") : "—"}</b></div>`; }).join("")}</article>`;
  }).join("");
  const divisionGames = state.games.filter((event) => event.competitions?.[0]?.competitors?.some((entry) => NORTH.has(entry.team?.abbreviation?.toLowerCase())));
  const otherGames = state.games.filter((event) => !event.competitions?.[0]?.competitors?.some((entry) => NORTH.has(entry.team?.abbreviation?.toLowerCase())));
  els.games.innerHTML = scoreCards(divisionGames) || `<p class="empty-copy">No AFC North games are scheduled for Week ${state.week}.</p>`;
  els.otherGames.innerHTML = scoreCards(otherGames) || `<p class="empty-copy">No other games are scheduled for Week ${state.week}.</p>`;
}
function statValue(stats, names, fallback = "—") { const stat = stats.find((item) => names.some((name) => item.name === name || item.abbreviation === name)); return stat?.displayValue ?? stat?.value ?? fallback; }
function flattenStandings(data) {
  const groups = data.children || data.groups || [];
  return groups.flatMap((conference) => (conference.children?.length ? conference.children : [conference]).flatMap((division) => (division.standings?.entries || []).map((entry) => ({ ...entry, conference: conference.name || conference.abbreviation || "", division: division.name || division.abbreviation || "" }))));
}
async function computedStandings(throughWeek) {
  const weeks = await Promise.all(Array.from({ length: throughWeek }, (_, index) => getJson(`${API}/scoreboard?dates=${SEASON}&seasontype=2&week=${index + 1}&limit=100`).catch(() => ({ events: [] }))));
  const records = new Map();
  weeks.forEach((data) => (data.events || []).forEach((event) => {
    const competition = event.competitions?.[0]; if (!(event.status?.type?.completed || competition?.status?.type?.completed)) return;
    const competitors = competition.competitors || [];
    competitors.forEach((entry) => {
      const team = entry.team || {}; const abbreviation = String(team.abbreviation || "").toLowerCase(); if (!abbreviation) return;
      if (!records.has(abbreviation)) records.set(abbreviation, { team, wins:0, losses:0, ties:0, pointsFor:0, pointsAgainst:0, results:[] });
      const record = records.get(abbreviation); const opponent = competitors.find((item) => item !== entry); const scored = Number(entry.score || 0); const allowed = Number(opponent?.score || 0);
      record.pointsFor += scored; record.pointsAgainst += allowed;
      const result = scored > allowed ? "W" : scored < allowed ? "L" : "T"; record.results.push(result);
      if (result === "W") record.wins++; else if (result === "L") record.losses++; else record.ties++;
    });
  }));
  return [...records.entries()].map(([abbreviation, record]) => {
    const games = record.wins + record.losses + record.ties; const latest = record.results.at(-1); let streakCount = 0;
    for (let index = record.results.length - 1; index >= 0 && record.results[index] === latest; index--) streakCount++;
    const stat = (name, abbreviation, displayValue) => ({ name, abbreviation, displayValue });
    return { team:record.team, conference:AFC.has(abbreviation) ? "AFC" : "NFC", division:DIVISIONS[abbreviation] || (AFC.has(abbreviation) ? "AFC" : "NFC"), stats:[stat("wins","W",record.wins),stat("losses","L",record.losses),stat("ties","T",record.ties),stat("winPercent","PCT",games ? (record.wins / games).toFixed(3).replace(/^0/,"") : ".000"),stat("pointsFor","PF",record.pointsFor),stat("pointsAgainst","PA",record.pointsAgainst),stat("pointDifferential","DIFF",`${record.pointsFor-record.pointsAgainst>0?"+":""}${record.pointsFor-record.pointsAgainst}`),stat("streak","STRK",latest ? `${latest}${streakCount}` : "—")] };
  }).sort((a,b) => a.conference.localeCompare(b.conference) || a.division.localeCompare(b.division) || Number(statValue(b.stats,["PCT"])) - Number(statValue(a.stats,["PCT"])) || Number(statValue(b.stats,["DIFF"])) - Number(statValue(a.stats,["DIFF"])));
}
function renderStandings() {
  const rows = state.standings.filter((entry) => entry.conference.toLowerCase().includes(state.conference));
  els.standingsSummary.textContent = `${state.conference.toUpperCase()} standings · 2026 regular season`;
  if (!rows.length) { els.standings.innerHTML = '<tr><td colspan="9">2026 standings will appear after regular-season play begins.</td></tr>'; return; }
  let division = ""; const html = [];
  rows.forEach((entry) => { if (entry.division !== division) { division = entry.division; html.push(`<tr class="division-row"><td colspan="9">${escapeHtml(division)}</td></tr>`); } const stats = entry.stats || []; const team = entry.team || {}; html.push(`<tr><td><span class="standings-team ${team.abbreviation?.toLowerCase() === "bal" ? "ravens" : ""}"><img src="${escapeHtml(logo(team))}" alt="">${escapeHtml(team.shortDisplayName || team.displayName)}</span></td><td>${escapeHtml(statValue(stats,["wins","W"]))}</td><td>${escapeHtml(statValue(stats,["losses","L"]))}</td><td>${escapeHtml(statValue(stats,["ties","T"],"0"))}</td><td>${escapeHtml(statValue(stats,["winPercent","PCT"]))}</td><td>${escapeHtml(statValue(stats,["pointsFor","PF"]))}</td><td>${escapeHtml(statValue(stats,["pointsAgainst","PA"]))}</td><td>${escapeHtml(statValue(stats,["pointDifferential","DIFF"]))}</td><td>${escapeHtml(statValue(stats,["streak","STRK"]))}</td></tr>`); });
  els.standings.innerHTML = html.join("");
}
function findLeaderCategory(root, name) { const queue = [root], seen = new Set(); while (queue.length) { const item = queue.shift(); if (!item || typeof item !== "object" || seen.has(item)) continue; seen.add(item); if (`${item.name || ""} ${item.abbreviation || ""}`.toLowerCase().replace(/\s/g, "").includes(name.toLowerCase())) return item; Object.values(item).forEach((value) => { if (value && typeof value === "object") queue.push(value); }); } return null; }
function renderLeaders() {
  const category = findLeaderCategory(state.leaders, state.category); const source = category?.leaders || category?.entries || category?.items || [];
  const entries = source.filter((entry) => state.leaderType === "teams" ? entry.team && !entry.athlete : entry.athlete).slice(0, 5);
  els.leadersSummary.textContent = `${els.category.selectedOptions[0].text} · ${state.leaderType === "players" ? "Players" : "Teams"}`;
  if (!entries.length) { els.leaders.innerHTML = `<p class="empty-copy">2026 ${escapeHtml(state.leaderType)} leaders will appear after regular-season games begin.</p>`; return; }
  els.leaders.innerHTML = entries.map((entry, index) => { const subject = entry.athlete || entry.team; const image = entry.athlete?.headshot?.href || logo(entry.team || subject); const team = entry.team?.abbreviation || entry.athlete?.team?.abbreviation || "NFL"; return `<article class="leader-card"><span class="leader-rank">#${index + 1} in NFL</span><div class="leader-person"><img src="${escapeHtml(image)}" alt=""><div><strong>${escapeHtml(subject.displayName || subject.shortDisplayName)}</strong><small>${escapeHtml(team)}</small></div></div><div class="leader-value">${escapeHtml(entry.displayValue ?? entry.value ?? "—")}</div></article>`; }).join("");
}
async function init() {
  const [weekResult, leadersResult] = await Promise.allSettled([currentWeekNumber(), getJson(`${LEADERS_API}?season=${SEASON}&seasontype=2`)]);
  if (weekResult.status === "fulfilled") state.week = weekResult.value;
  if (leadersResult.status === "fulfilled") state.leaders = leadersResult.value;
  state.standings = await computedStandings(state.week);
  renderStandings(); renderLeaders(); await loadGames();
  els.status.textContent = state.games.length || state.standings.length ? "2026 NFL data" : "Awaiting 2026 season";
}
els.previous.addEventListener("click", () => { if (state.week > 1) { state.week--; loadGames(); } });
els.next.addEventListener("click", () => { if (state.week < state.maxWeek) { state.week++; loadGames(); } });
document.querySelector("#standings-toggle").addEventListener("click", (event) => { const button = event.target.closest("button[data-conference]"); if (!button) return; state.conference = button.dataset.conference; document.querySelectorAll("[data-conference]").forEach((item) => item.classList.toggle("active", item === button)); renderStandings(); });
document.querySelector("#leader-type-toggle").addEventListener("click", (event) => { const button = event.target.closest("button[data-type]"); if (!button) return; state.leaderType = button.dataset.type; document.querySelectorAll("[data-type]").forEach((item) => item.classList.toggle("active", item === button)); renderLeaders(); });
els.category.addEventListener("change", () => { state.category = els.category.value; renderLeaders(); });
init();
