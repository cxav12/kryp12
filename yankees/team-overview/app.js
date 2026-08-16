const TEAM_ID = 147;
const SEASON = new Date().getFullYear();
const MLB_API = "https://statsapi.mlb.com/api/v1";

const metricConfig = [
  { key: "runDifferential", label: "Run Differential", badge: "DIFF", group: "derived", category: "performance", rank: "desc" },
  { key: "oneRun", label: "One-Run Record", badge: "1R", group: "standings", category: "performance", rank: "desc", record: true },
  { key: "home", label: "Home Record", badge: "HOME", group: "standings", category: "performance", rank: "desc", record: true },
  { key: "away", label: "Away Record", badge: "AWAY", group: "standings", category: "performance", rank: "desc", record: true },
  { key: "extraInning", label: "Extra-Inning Record", badge: "XI", group: "standings", category: "performance", rank: "desc", record: true },
  { key: "winningPercentage", label: "Winning Percentage", badge: "WIN%", group: "standings", category: "performance", rank: "desc" },
  { key: "runs", label: "Runs Scored", badge: "RS", group: "hitting", category: "offense", rank: "desc" },
  { key: "avg", label: "Team AVG", badge: "AVG", group: "hitting", category: "offense", rank: "desc" },
  { key: "obp", label: "OBP", badge: "OBP", group: "hitting", category: "offense", rank: "desc" },
  { key: "ops", label: "Team OPS", badge: "OPS", group: "hitting", category: "offense", rank: "desc" },
  { key: "homeRuns", label: "Home Runs", badge: "HR", group: "hitting", category: "offense", rank: "desc" },
  { key: "stolenBases", label: "Stolen Bases", badge: "SB", group: "hitting", category: "offense", rank: "desc" },
  { key: "runsAllowed", label: "Runs Allowed", badge: "RA", group: "pitching", category: "pitching", rank: "asc" },
  { key: "era", label: "Team ERA", badge: "ERA", group: "pitching", category: "pitching", rank: "asc" },
  { key: "whip", label: "Team WHIP", badge: "WHIP", group: "pitching", category: "pitching", rank: "asc" },
  { key: "qualityStarts", label: "Quality Starts", badge: "QS", group: "qualityStarts", category: "pitching", rank: "desc" },
  { key: "saves", label: "Saves", badge: "SV", group: "pitching", category: "pitching", rank: "desc" },
  { key: "strikeOuts", label: "Strikeouts", badge: "SO", group: "pitching", category: "pitching", rank: "desc" },
  { key: "fielding", label: "Fielding Percentage", badge: "FLD", group: "fielding", category: "defense", rank: "desc" },
  { key: "errors", label: "Errors", badge: "E", group: "fielding", category: "defense", rank: "asc" },
  { key: "throwingErrors", label: "Throwing Errors", badge: "TE", group: "fielding", category: "defense", rank: "asc" },
  { key: "doublePlays", label: "Double Plays", badge: "DP", group: "fielding", category: "defense", rank: "desc" },
  { key: "caughtStealingPercentage", label: "Caught-Stealing", badge: "CS%", group: "fielding", category: "defense", rank: "desc" },
  { key: "assists", label: "Assists", badge: "A", group: "fielding", category: "defense", rank: "desc" },
];

const metricCategories = [
  { key: "performance", label: "Team Performance" },
  { key: "offense", label: "Offense" },
  { key: "pitching", label: "Pitching" },
  { key: "defense", label: "Defense" },
];

const els = {
  status: document.querySelector("#data-status"),
  yankeesCard: document.querySelector("#yankees-card"),
  metricTemplate: document.querySelector("#metric-template"),
};

const state = {
  teams: [],
  teamMap: new Map(),
  standings: new Map(),
  hitting: new Map(),
  pitching: new Map(),
  fielding: new Map(),
  qualityStarts: new Map(),
  ranks: new Map(),
};

const api = {
  async get(path, params = {}) {
    const url = new URL(`${MLB_API}${path}`);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url);
    if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
    return response.json();
  },
  teams() {
    return this.get("/teams", { sportId: 1, season: SEASON });
  },
  stats(group) {
    return this.get("/teams/stats", { stats: "season", group, sportIds: 1, season: SEASON });
  },
  standings() {
    return this.get("/standings", { leagueId: "103,104", season: SEASON, standingsTypes: "regularSeason" });
  },
  qualityStartCandidates() {
    return this.get("/stats", {
      stats: "season", group: "pitching", gameType: "R", season: SEASON,
      sportIds: 1, playerPool: "ALL", limit: 1000, hydrate: "team",
      fields: "stats,splits,stat,gamesStarted,player,id,fullName,team,id,name",
    });
  },
  pitcherGameLogs(personIds) {
    return this.get("/people", {
      personIds: personIds.join(","),
      hydrate: `stats(group=[pitching],type=[gameLog],season=${SEASON})`,
      fields: "people,id,stats,splits,stat,gamesStarted,outs,earnedRuns,team,id,name",
    });
  },
};

function setStatus(message, tone = "neutral") {
  els.status.textContent = message;
  els.status.style.color = tone === "error" ? "#ffbec4" : tone === "good" ? "#9af0c8" : "";
}

function ordinal(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  const suffix = number % 100 >= 11 && number % 100 <= 13 ? "th" : { 1: "st", 2: "nd", 3: "rd" }[number % 10] || "th";
  return `${number}${suffix}`;
}

function rankTone(rank, total = 30) {
  const position = Number(rank);
  const fieldSize = Number(total);
  if (!Number.isFinite(position) || !Number.isFinite(fieldSize) || fieldSize < 2) return "rank-neutral";

  const percentile = position / fieldSize;
  if (percentile <= 0.2) return "rank-strong";
  if (percentile > 0.8) return "rank-weak";
  if (percentile > 0.6) return "rank-watch";
  return "rank-neutral";
}

function statNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatStat(key, value) {
  if (value === undefined || value === null || value === "") return "-";
  if (["avg", "ops", "obp", "fielding", "caughtStealingPercentage", "winningPercentage"].includes(key)) return String(value).replace(/^0/, "");
  if (key === "runDifferential" && Number(value) > 0) return `+${value}`;
  return String(value);
}

function storeStats(group, data) {
  const target = group === "hitting" ? state.hitting : group === "pitching" ? state.pitching : state.fielding;
  const splits = data.stats?.[0]?.splits || [];
  splits.forEach((split) => {
    target.set(split.team.id, split.stat || {});
  });
}

function storeStandings(data) {
  (data.records || []).forEach((division) => {
    (division.teamRecords || []).forEach((record) => {
      const teamId = record.team?.id;
      if (!teamId) return;
      const team = state.teamMap.get(teamId);
      const divisionName = division.division?.name || team?.division?.name || "";
      const wins = record.leagueRecord?.wins ?? record.wins ?? "-";
      const losses = record.leagueRecord?.losses ?? record.losses ?? "-";
      const splitRecords = new Map((record.records?.splitRecords || []).map((split) => [split.type, split]));
      const gamesPlayed = Number(wins) + Number(losses);
      state.standings.set(teamId, {
        wins,
        losses,
        winningPercentage: gamesPlayed > 0 ? (Number(wins) / gamesPlayed).toFixed(3) : null,
        divisionRank: Number(record.divisionRank),
        divisionName,
        oneRun: splitRecords.get("oneRun"),
        home: splitRecords.get("home"),
        away: splitRecords.get("away"),
        extraInning: splitRecords.get("extraInning"),
      });
    });
  });
}

function metricValue(teamId, metric) {
  if (metric.group === "standings") return state.standings.get(teamId)?.[metric.key];
  if (metric.group === "qualityStarts") return state.qualityStarts.get(teamId) ?? 0;
  if (metric.key === "runDifferential") {
    const runs = statNumber(state.hitting.get(teamId)?.runs);
    const runsAllowed = statNumber(state.pitching.get(teamId)?.runs);
    return runs === null || runsAllowed === null ? null : runs - runsAllowed;
  }
  const stats = metric.group === "hitting"
    ? state.hitting.get(teamId)
    : metric.group === "fielding" ? state.fielding.get(teamId) : state.pitching.get(teamId);
  if (metric.key === "runsAllowed") return stats?.runs;
  return stats?.[metric.key];
}

function metricRankValue(teamId, metric) {
  const value = metricValue(teamId, metric);
  if (!metric.record) return statNumber(value);
  const wins = statNumber(value?.wins);
  const losses = statNumber(value?.losses);
  return wins === null || losses === null || wins + losses === 0 ? null : wins / (wins + losses);
}

function calculateRanks() {
  metricConfig.forEach((metric) => {
    const ranked = state.teams
      .map((team) => ({ teamId: team.id, value: metricRankValue(team.id, metric) }))
      .filter((item) => item.value !== null)
      .sort((a, b) => metric.rank === "asc" ? a.value - b.value : b.value - a.value);

    const ranks = new Map();
    ranked.forEach((item, index) => {
      ranks.set(item.teamId, index + 1);
    });
    state.ranks.set(metric.key, ranks);
  });
}

function divisionShortName(name) {
  return name
    .replace("American League", "AL")
    .replace("National League", "NL");
}

function teamOverview(teamId) {
  const team = state.teamMap.get(teamId);
  const standing = state.standings.get(teamId) || {};
  const divisionName = standing.divisionName || team?.division?.name || "";
  return {
    team,
    standing,
    record: `${standing.wins ?? "-"}-${standing.losses ?? "-"}`,
    standingLine: standing.divisionRank ? `${ordinal(standing.divisionRank)} in ${divisionShortName(divisionName)}` : "Standing unavailable",
  };
}

function renderMetric(teamId, metric) {
  const node = els.metricTemplate.content.firstElementChild.cloneNode(true);
  const value = metricValue(teamId, metric);
  const rank = state.ranks.get(metric.key)?.get(teamId);
  node.querySelector(".metric-badge").textContent = metric.badge;
  node.querySelector("strong").textContent = metric.label;
  node.querySelector(".metric-value span").textContent = metric.record && value
    ? `${value.wins}-${value.losses}`
    : formatStat(metric.key, value);
  const rankLabel = node.querySelector(".metric-value small");
  rankLabel.textContent = rank ? ordinal(rank) : "-";
  rankLabel.classList.add(rankTone(rank, state.ranks.get(metric.key)?.size || 30));
  return node;
}

function renderCard(target, teamId) {
  const overview = teamOverview(teamId);
  if (!overview.team) {
    target.innerHTML = `<p class="error mb-0">Team data is unavailable.</p>`;
    return;
  }

  target.replaceChildren();
  const header = document.createElement("header");
  header.className = "team-header";
  header.innerHTML = `
    <h3 class="team-name">${overview.team.name}</h3>
    <div class="team-record-row">
      <div class="record-line stat-number">${overview.record}</div>
      <div class="standing-line">${overview.standingLine}</div>
    </div>
  `;

  const list = document.createElement("section");
  list.className = "metric-groups";
  metricCategories.forEach((category) => {
    const group = document.createElement("section");
    group.className = "metric-group";
    const heading = document.createElement("h4");
    heading.className = "metric-group-title";
    heading.textContent = category.label;
    const metrics = document.createElement("div");
    metrics.className = "metric-list";
    metricConfig
      .filter((metric) => metric.category === category.key)
      .forEach((metric) => metrics.append(renderMetric(teamId, metric)));
    group.append(heading, metrics);
    list.append(group);
  });

  target.append(header, list);
}

function storeQualityStarts(candidates, logs) {
  const candidateTeam = new Map((candidates.stats?.[0]?.splits || [])
    .map((split) => [Number(split.player?.id), split.team?.id]));
  state.teams.forEach((team) => state.qualityStarts.set(team.id, 0));
  (logs.people || []).forEach((person) => {
    (person.stats?.[0]?.splits || []).forEach((split) => {
      if (statNumber(split.stat?.gamesStarted) < 1
        || statNumber(split.stat?.outs) < 18
        || statNumber(split.stat?.earnedRuns) > 3) return;
      const teamId = split.team?.id || candidateTeam.get(Number(person.id));
      if (teamId) state.qualityStarts.set(teamId, (state.qualityStarts.get(teamId) || 0) + 1);
    });
  });
}

async function init() {
  setStatus("Loading team data");
  try {
    const [teams, hitting, pitching, fielding, standings, qualityStartCandidates] = await Promise.all([
      api.teams(),
      api.stats("hitting"),
      api.stats("pitching"),
      api.stats("fielding"),
      api.standings(),
      api.qualityStartCandidates(),
    ]);

    state.teams = (teams.teams || []).filter((team) => team.active);
    state.teams.forEach((team) => state.teamMap.set(team.id, team));
    storeStats("hitting", hitting);
    storeStats("pitching", pitching);
    storeStats("fielding", fielding);
    storeStandings(standings);
    const starterIds = (qualityStartCandidates.stats?.[0]?.splits || [])
      .filter((split) => split.player?.id && statNumber(split.stat?.gamesStarted) > 0)
      .map((split) => split.player.id);
    storeQualityStarts(qualityStartCandidates, await api.pitcherGameLogs(starterIds));
    calculateRanks();

    renderCard(els.yankeesCard, TEAM_ID);
    setStatus("Live MLB data", "good");
  } catch (error) {
    setStatus("Data connection issue", "error");
    const message = document.createElement("p");
    message.className = "error mb-0";
    message.textContent = `Could not load team overview data. ${error.message}`;
    els.yankeesCard.replaceChildren(message);
  }
}

init();
