const SEASON = 2026;
const ESPN_API = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";
const state = { roster: [], rankings: [], rankingGroup: "offense", rosterGroup: "offense" };
const els = {
  status: document.querySelector("#overview-status"), summary: document.querySelector("#team-summary"),
  rankingsSummary: document.querySelector("#rankings-summary"), rankings: document.querySelector("#ranking-grid"),
  rosterSummary: document.querySelector("#roster-summary"), roster: document.querySelector("#roster-grid"),
  transactions: document.querySelector("#transactions"), injuries: document.querySelector("#injured-reserve"),
};
const SPECIAL_POSITIONS = new Set(["K", "P", "LS", "H", "KR", "PR"]);
const OFFENSE_POSITIONS = new Set(["QB", "RB", "FB", "WR", "TE", "OT", "T", "OG", "G", "C", "OL"]);
const DEFENSE_POSITIONS = new Set(["DE", "DT", "DL", "NT", "LB", "ILB", "OLB", "CB", "DB", "S", "FS", "SS"]);
const RANKING_PATTERNS = {
  offense: /offen|pointsPerGame|totalYards|passing|rushing|firstDown|thirdDown|redZone/i,
  defense: /defen|allowed|opponent|sack|interception|takeaway|turnoverForced/i,
  special: /special|fieldGoal|extraPoint|punt|kickoff|return/i,
};
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])); }
async function getJson(url) { const response = await fetch(url); if (!response.ok) throw new Error(`Data request returned ${response.status}`); return response.json(); }
function playerName(player) { return player?.displayName || player?.fullName || player?.athlete?.displayName || "Ravens Player"; }
function position(player) { return player?.position?.abbreviation || player?.position?.name || "NFL"; }
function headshot(player) { const athlete = player.athlete || player; return athlete.headshot?.href || athlete.headshot || `https://a.espncdn.com/i/headshots/nfl/players/full/${athlete.id}.png`; }
function flattenRoster(data) {
  return (data.athletes || []).flatMap((group) => {
    const groupName = String(group.position || group.displayName || group.name || "");
    return (group.items || group.athletes || (group.id ? [group] : [])).map((player) => ({ ...player, _group: groupName }));
  });
}
function rosterCategory(player) {
  const status = `${player.status?.name || ""} ${player.status?.abbreviation || ""} ${player._group || ""}`;
  if (/practice|squad|developmental|\bDEV\b/i.test(status)) return "practice";
  const pos = position(player);
  if (SPECIAL_POSITIONS.has(pos) || /special/i.test(player._group)) return "special";
  if (OFFENSE_POSITIONS.has(pos) || /offense/i.test(player._group)) return "offense";
  if (DEFENSE_POSITIONS.has(pos) || /defense/i.test(player._group)) return "defense";
  return "practice";
}
function renderRoster() {
  const players = state.roster.filter((player) => rosterCategory(player) === state.rosterGroup);
  els.rosterSummary.textContent = `${players.length} players · ${state.rosterGroup === "special" ? "Special Teams" : state.rosterGroup[0].toUpperCase() + state.rosterGroup.slice(1)}`;
  els.roster.innerHTML = players.length ? players.map((player) => {
    const experience = player.experience?.years ?? player.experience; const detail = experience === 0 ? "Rookie" : experience ? `${experience} yrs` : "Experience —";
    return `<a class="roster-card" href="./player-profile/?player=${encodeURIComponent(player.id)}"><span class="roster-headshot"><img src="${escapeHtml(headshot(player))}" alt="" onerror="this.style.visibility='hidden'"></span><span class="roster-copy"><span>#${escapeHtml(player.jersey || "—")} · ${escapeHtml(position(player))}</span><strong>${escapeHtml(playerName(player))}</strong><small>${escapeHtml(detail)}</small></span></a>`;
  }).join("") : `<p class="empty-copy">No ${escapeHtml(state.rosterGroup === "practice" ? "practice-squad" : state.rosterGroup)} players are listed by the current roster feed.</p>`;
}
function collectStats(root) {
  const found = []; const visited = new Set(); const queue = [root];
  while (queue.length) {
    const value = queue.shift();
    if (!value || typeof value !== "object" || visited.has(value)) continue;
    visited.add(value);
    if (!Array.isArray(value) && (value.name || value.displayName) && (value.displayValue !== undefined || value.value !== undefined) && !value.athlete) found.push(value);
    Object.values(value).forEach((child) => { if (child && typeof child === "object") queue.push(child); });
  }
  return [...new Map(found.map((stat) => [stat.name || stat.displayName, stat])).values()];
}
function rankingCategory(stat) {
  const key = `${stat.name || ""} ${stat.displayName || ""} ${stat.shortDisplayName || ""}`;
  if (RANKING_PATTERNS.special.test(key)) return "special";
  if (RANKING_PATTERNS.defense.test(key)) return "defense";
  if (RANKING_PATTERNS.offense.test(key) && !/allowed|opponent/i.test(key)) return "offense";
  return "";
}
function renderRankings() {
  const stats = state.rankings.filter((stat) => rankingCategory(stat) === state.rankingGroup).slice(0, 9);
  els.rankingsSummary.textContent = `2026 ${state.rankingGroup === "special" ? "special-teams" : state.rankingGroup} rankings`;
  els.rankings.innerHTML = stats.length ? stats.map((stat) => {
    const label = stat.displayName || stat.shortDisplayName || stat.name; const value = stat.displayValue ?? stat.value ?? "—";
    const rank = stat.rankDisplayValue || stat.displayRank || stat.rank && `#${stat.rank}` || "Rank —";
    return `<article class="ranking-card"><span>${escapeHtml(label)}</span><div class="ranking-value"><strong>${escapeHtml(value)}</strong><b>${escapeHtml(rank)}</b></div></article>`;
  }).join("") : `<p class="empty-copy">2026 ${escapeHtml(state.rankingGroup === "special" ? "special-teams" : state.rankingGroup)} rankings will appear after regular-season games begin.</p>`;
}
function recordSummary(teamData) {
  const team = teamData.team || teamData; const records = team.record?.items || team.record || [];
  const total = Array.isArray(records) ? records.find((item) => item.type === "total" || /overall/i.test(item.name || item.description || "")) || records[0] : records;
  return total?.summary || team.recordSummary || "0-0";
}
function renderSummary(teamData) {
  const team = teamData.team || teamData; const standing = team.standingSummary || "AFC North"; const record = recordSummary(teamData);
  const streak = team.record?.items?.[0]?.stats?.find((item) => /streak/i.test(item.name))?.displayValue || "—";
  const coach = team.coach?.displayName || team.coach?.fullName || "—";
  els.summary.innerHTML = [[`${SEASON} Record`, record], ["Standing", standing], ["Streak", streak], ["Head Coach", coach]].map(([label, value]) => `<div class="summary-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
}
function transactionItems(data) {
  const source = data.transactions?.items || data.transactions || data.items || [];
  return Array.isArray(source) ? source.flatMap((item) => item.items || [item]) : [];
}
function renderTransactions(data) {
  const items = transactionItems(data).slice(0, 8);
  els.transactions.innerHTML = items.length ? `<ol class="detail-list">${items.map((item) => {
    const description = item.description || item.text || item.type?.description || item.type || "Roster transaction";
    const name = playerName(item.athlete || item.player || item);
    const date = item.date ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }).format(new Date(item.date)) : "";
    return `<li class="detail-item"><div><strong>${escapeHtml(name === "Ravens Player" ? "Baltimore Ravens" : name)}</strong><p>${escapeHtml(description)}</p></div><time>${escapeHtml(date)}</time></li>`;
  }).join("")}</ol>` : `<p class="empty-copy">No recent transactions are listed.</p>`;
}
function injuryItems(data) {
  const source = data.injuries || data.items || [];
  const items = Array.isArray(source) ? source.flatMap((group) => group.injuries || group.items || [group]) : [];
  return items.filter((item) => /injured reserve|\bIR\b/i.test(`${item.status || ""} ${item.type?.description || ""} ${item.details?.type || ""} ${item.description || ""}`));
}
function renderInjuries(data) {
  const items = injuryItems(data);
  els.injuries.innerHTML = items.length ? `<ol class="detail-list">${items.map((item) => {
    const athlete = item.athlete || item.player || item; const status = item.status || item.type?.description || item.details?.type || "Injured Reserve";
    const detail = item.longComment || item.shortComment || item.description || "Currently listed on injured reserve.";
    return `<li class="detail-item"><div><strong>${escapeHtml(playerName(athlete))}</strong><p>${escapeHtml(detail)}</p></div><span class="status-tag">${escapeHtml(status)}</span></li>`;
  }).join("")}</ol>` : `<p class="empty-copy">No players are currently identified as injured reserve by the feed.</p>`;
}
function activate(container, selected) { container.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button === selected)); }
async function init() {
  const urls = {
    team: `${ESPN_API}/teams/bal`, roster: `${ESPN_API}/teams/bal/roster?season=${SEASON}`,
    stats: `${ESPN_API}/teams/bal/statistics?season=${SEASON}`, transactions: `${ESPN_API}/teams/bal/transactions?season=${SEASON}`,
    injuries: `${ESPN_API}/teams/bal/injuries`,
  };
  const results = await Promise.allSettled(Object.values(urls).map(getJson));
  const [team, roster, stats, transactions, injuries] = results.map((result) => result.status === "fulfilled" ? result.value : null);
  if (team) renderSummary(team); else els.summary.innerHTML = `<p class="empty-copy">Team summary is unavailable.</p>`;
  state.roster = roster ? flattenRoster(roster) : []; renderRoster();
  state.rankings = stats ? collectStats(stats) : []; renderRankings();
  renderTransactions(transactions || {}); renderInjuries(injuries || {});
  const available = results.filter((result) => result.status === "fulfilled").length;
  els.status.textContent = available === results.length ? "2026 team data" : `${available} of ${results.length} feeds loaded`;
}
document.querySelector("#ranking-toggle").addEventListener("click", (event) => { const button = event.target.closest("[data-ranking]"); if (!button) return; state.rankingGroup = button.dataset.ranking; activate(event.currentTarget, button); renderRankings(); });
document.querySelector("#roster-toggle").addEventListener("click", (event) => { const button = event.target.closest("[data-roster]"); if (!button) return; state.rosterGroup = button.dataset.roster; activate(event.currentTarget, button); renderRoster(); });
init();
