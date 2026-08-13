const SEASON = new Date().getFullYear();
const DEFAULT_PLAYER = 592450;
const TEAM_ID = 147;
const RECENT_ACTION_GAMES = 10;
const MLB_API = "https://statsapi.mlb.com/api/v1";
const FANGRAPHS_API = "https://www.fangraphs.com/api/leaders/major-league/data";
const HEADSHOT = (id) => `https://img.mlbstatic.com/mlb-photos/image/upload/w_336,h_280,c_fill,g_face,q_auto:best/v1/people/${id}/headshot/silo/current`;
const niceDateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const FANGRAPHS_TEAM_IDS = {
  108: 1, 109: 15, 110: 2, 111: 3, 112: 17, 113: 18, 114: 5, 115: 19, 116: 6, 117: 21,
  118: 7, 119: 22, 120: 24, 121: 25, 133: 10, 134: 27, 135: 29, 136: 11, 137: 30, 138: 28,
  139: 12, 140: 13, 141: 14, 142: 8, 143: 26, 144: 16, 145: 4, 146: 20, 147: 9, 158: 23,
};
const HITTING_DETAIL_PRIMARY_ITEMS = [
  ["AVG", "avg"],
  ["OBP", "obp"],
  ["SLG", "slg"],
  ["OPS", "ops"],
  ["wRC+", "wrcPlus"],
  ["WAR", "war"],
];
const HITTING_DETAIL_SECONDARY_ITEMS = [
  ["HR", "homeRuns"],
  ["RBI", "rbi"],
  ["AB", "atBats"],
  ["H", "hits"],
  ["2B", "doubles"],
  ["3B", "triples"],
  ["BB", "baseOnBalls"],
  ["K", "strikeOuts"],
  ["K%", "kRate"],
  ["PA", "plateAppearances"],
];
const PITCHING_DETAIL_PRIMARY_ITEMS = [
  ["ERA", "calculatedEra"],
  ["WHIP", "whip"],
  ["SO", "strikeOuts"],
  ["BB", "baseOnBalls"],
  ["AVG", "avg"],
  ["IP", "inningsPitched"],
];
const PITCHING_DETAIL_SECONDARY_ITEMS = [
  ["W", "wins"],
  ["L", "losses"],
  ["SV", "saves"],
  ["G", "gamesPlayed"],
  ["GS", "gamesStarted"],
  ["H", "hits"],
  ["ER", "earnedRuns"],
  ["HR", "homeRuns"],
  ["P", "numberOfPitches"],
  ["K/9", "strikeoutsPer9Inn"],
];
const HITTING_PACE_ITEMS = [
  ["HR", "homeRuns"],
  ["RBI", "rbi"],
  ["R", "runs"],
  ["H", "hits"],
  ["2B", "doubles"],
  ["BB", "baseOnBalls"],
  ["K", "strikeOuts"],
  ["SB", "stolenBases"],
];

const PITCHING_PACE_ITEMS = [
  ["W", "wins"],
  ["L", "losses"],
  ["SV", "saves"],
  ["GS", "gamesStarted"],
  ["IP", "inningsPitched"],
  ["SO", "strikeOuts"],
  ["BB", "baseOnBalls"],
  ["ER", "earnedRuns"],
];

const state = {
  selectedPlayerId: DEFAULT_PLAYER,
  currentGroup: "hitting",
  gameLogSplits: [],
  quickStatsMode: "regular",
  quickStatsData: {
    regular: { season: {}, yearByYear: {}, career: {} },
    postseason: { season: {}, yearByYear: {}, career: {} },
  },
  detailSplit: "season",
  detailTab: "recent",
  teamGamesPlayed: 0,
  detailStats: {
    season: {},
    risp: {},
    "vs-lhp": {},
    "vs-rhp": {},
    home: {},
    away: {},
    career: {},
    yearByYear: {},
    postseasonCareer: {},
    postseasonYearByYear: {},
    transactions: [],
  },
  selectedPerson: null,
};

const els = {
  status: document.querySelector("#data-status"),
  quickStatsTable: document.querySelector(".detail-quick-table"),
  quickStatsBody: document.querySelector("#quick-stats-body"),
  searchInput: document.querySelector("#player-search"),
  searchButton: document.querySelector("#search-button"),
  searchResults: document.querySelector("#search-results"),
  detailHeadshot: document.querySelector("#detail-headshot"),
  detailLastName: document.querySelector("#player-detail-title"),
  detailNumber: document.querySelector("#detail-number"),
  detailPlayerStatus: document.querySelector("#detail-player-status"),
  detailBio: document.querySelector("#detail-bio"),
  detailSplitControls: document.querySelector("#detail-split-controls"),
  detailTabControls: document.querySelector("#detail-tab-controls"),
  detailPrimaryStats: document.querySelector("#detail-primary-stats"),
  detailSecondaryStats: document.querySelector("#detail-secondary-stats"),
  detailTabPanel: document.querySelector("#detail-tab-panel"),
};

const api = {
  async get(path, params = {}) {
    const url = new URL(`${MLB_API}${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    });
    const response = await fetch(url);
    if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
    return response.json();
  },
  async player(id) {
    return this.get(`/people/${id}`, {
      hydrate: "currentTeam,team,education",
    });
  },
  async activeRoster() {
    return this.get(`/teams/${TEAM_ID}/roster`, { rosterType: "active", hydrate: "person" });
  },
  async stats(id, group, type = "season", params = {}) {
    return this.get(`/people/${id}/stats`, { stats: type, group, season: SEASON, ...params });
  },
  async statSummary(id, group, type, params = {}) {
    return this.get(`/people/${id}/stats`, { stats: type, group, ...params });
  },
  async gameLog(id, group) {
    return this.stats(id, group, "gameLog");
  },
  async yearByYear(id, group, params = {}) {
    return this.statSummary(id, group, "yearByYear", params);
  },
  async transactions(id) {
    return this.get("/transactions", {
      playerId: id,
      startDate: `${SEASON}-01-01`,
      endDate: isoDate(new Date()),
    });
  },
  async searchPlayer(query) {
    return this.get("/people/search", { names: query, sportId: 1 });
  },
  async draftDetails(id, year) {
    if (!id || !year) return null;
    const data = await this.get(`/draft/${year}`, { playerId: id });
    const rounds = data.drafts?.rounds || [];
    const pick = rounds
      .flatMap((round) => (round.picks || []).map((item) => ({ ...item, draftRound: round })))
      .find((item) => Number(item.person?.id) === Number(id));
    if (!pick) return null;
    return {
      year: Number(year),
      team: pick.team?.name || "",
      round: pick.pickRound || pick.round || pick.draftRound?.roundNumber || pick.draftRound?.round || "",
      pick: pick.pickNumber || pick.overallPickNumber || "",
    };
  },
  async teamGamesPlayed(teamId) {
    if (!teamId) return 0;
    const data = await this.get("/standings", {
      leagueId: "103,104",
      season: SEASON,
      standingsTypes: "regularSeason",
    });
    const teamRecord = data.records
      ?.flatMap((record) => record.teamRecords || [])
      .find((record) => Number(record.team?.id) === Number(teamId));
    return Number(teamRecord?.wins || 0) + Number(teamRecord?.losses || 0) + Number(teamRecord?.ties || 0);
  },
  async advancedHitting(id, mlbTeamId) {
    const team = FANGRAPHS_TEAM_IDS[Number(mlbTeamId)];
    if (!team) return null;
    const url = new URL(FANGRAPHS_API);
    Object.entries({
      pos: "all", stats: "bat", lg: "all", qual: 0, type: 8, season: SEASON,
      season1: SEASON, ind: 0, team, pageitems: 200, pagenum: 1,
    }).forEach(([key, value]) => url.searchParams.set(key, value));
    const response = await fetch(url);
    if (!response.ok) throw new Error(`FanGraphs API returned ${response.status}`);
    const data = await response.json();
    const player = data.data?.find((row) => Number(row.xMLBAMID) === Number(id));
    if (!player) return null;
    const wrcPlus = Number(player["wRC+"]);
    const war = Number(player.WAR);
    return {
      wrcPlus: Number.isFinite(wrcPlus) ? Math.round(wrcPlus) : null,
      war: Number.isFinite(war) ? Number(war.toFixed(1)) : null,
    };
  },
};

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function niceDate(value) {
  if (!value) return "Unknown";
  const datePart = String(value).includes("T") ? String(value).slice(0, 10) : value;
  return niceDateFormatter.format(new Date(`${datePart}T12:00:00`));
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function isHitter(entry) {
  const position = entry.position || entry.person?.primaryPosition || {};
  return position.abbreviation !== "P" && position.type !== "Pitcher";
}

async function randomYankeesHitterId() {
  try {
    const data = await api.activeRoster();
    const hitterIds = (data.roster || [])
      .filter(isHitter)
      .map((entry) => Number(entry.person?.id))
      .filter((id) => Number.isInteger(id) && id > 0);
    return hitterIds[Math.floor(Math.random() * hitterIds.length)] || DEFAULT_PLAYER;
  } catch {
    return DEFAULT_PLAYER;
  }
}

function formatAverage(hits, atBats) {
  if (!atBats) return ".000";
  return (hits / atBats).toFixed(3).replace(/^0/, "");
}

function inningsToOuts(value) {
  if (!value) return 0;
  const [whole, partial = "0"] = String(value).split(".");
  return Number(whole) * 3 + Number(partial);
}

function outsToInnings(outs) {
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}

function setStatus(message, tone = "neutral") {
  els.status.textContent = message;
  els.status.style.color = tone === "error" ? "#ffbec4" : tone === "good" ? "#9af0c8" : "";
}

function persistPlayerInUrl(id) {
  const url = new URL(window.location.href);
  url.searchParams.set("player", String(id));
  window.history.replaceState({ playerId: id }, "", url);
}

function statValue(stats, key, fallback = "-") {
  const value = stats?.[key];
  return value === undefined || value === null || value === "" ? fallback : value;
}

function elementWithText(tagName, text, className = "") {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function playerStatusLabel(person) {
  const status = person.rosterStatus || person.status?.code || person.status?.description;
  const labels = {
    A: "Active",
    D7: "Injured 7-Day",
    D10: "Injured 10-Day",
    D15: "Injured 15-Day",
    D60: "Injured 60-Day",
    MIN: "Minors",
    RM: "Restricted",
    RL: "Restricted",
  };
  if (labels[status]) return labels[status];
  if (person.status?.description) return person.status.description;
  if (status) return status;
  return person.active === false ? "Inactive" : "Active";
}

function loadHeadshot(id, playerName = "") {
  const playerId = String(id);
  const image = els.detailHeadshot;
  image.classList.remove("is-loaded");
  image.alt = playerName ? `${playerName} headshot` : "";
  image.dataset.playerId = playerId;
  image.fetchPriority = "high";
  image.decoding = "async";
  image.onload = () => {
    if (image.dataset.playerId === playerId) image.classList.add("is-loaded");
  };
  image.onerror = () => {
    if (image.dataset.playerId !== playerId) return;
    image.classList.remove("is-loaded");
    image.removeAttribute("src");
    image.alt = "";
  };
  image.src = HEADSHOT(id);
}

function quickStatFields(group) {
  return group === "pitching"
    ? [["IP", "inningsPitched"], ["W", "wins"], ["ERA", "era"], ["G", "gamesPlayed"], ["GS", "gamesStarted"], ["SO", "strikeOuts"], ["BB", "baseOnBalls"], ["WHIP", "whip"], ["AVG", "avg"]]
    : [["AB", "atBats"], ["R", "runs"], ["H", "hits"], ["HR", "homeRuns"], ["RBI", "rbi"], ["SB", "stolenBases"], ["AVG", "avg"], ["OBP", "obp"], ["OPS", "ops"]];
}

function statsBySeason(data) {
  return (data?.stats?.[0]?.splits || []).reduce((seasons, split) => {
    if (split.season) seasons[String(split.season)] = split.stat || {};
    return seasons;
  }, {});
}

function quickStatRows(group, data, mode) {
  const fields = quickStatFields(group);
  const seasonLabel = mode === "postseason" ? "Postseason" : "Regular Season";
  const seasons = [
    [`${SEASON} ${seasonLabel}`, data.season],
    ...[1, 2].map((offset) => {
      const year = SEASON - offset;
      return [`${year} ${seasonLabel}`, data.yearByYear[String(year)] || {}];
    }),
    [`Career ${seasonLabel}`, data.career],
  ];
  return {
    headers: ["Season", ...fields.map(([label]) => label)],
    rows: seasons.map(([label, stats]) => [label, ...fields.map(([, key]) => statValue(stats, key))]),
  };
}

function quickSeasonToggle() {
  const control = document.createElement("div");
  control.className = "quick-season-toggle";
  control.setAttribute("role", "group");
  control.setAttribute("aria-label", "Stats season type");
  [["regular", "Regular"], ["postseason", "Postseason"]].forEach(([mode, label], index) => {
    if (index) control.append(elementWithText("span", "|", "quick-season-divider"));
    const button = elementWithText("button", label, "quick-season-button");
    button.type = "button";
    button.dataset.quickSeason = mode;
    const active = state.quickStatsMode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    control.append(button);
  });
  return control;
}

function renderQuickStats(group = state.currentGroup) {
  if (!els.quickStatsBody) return;
  const table = els.quickStatsBody.closest("table");
  const data = state.quickStatsData[state.quickStatsMode];
  const { headers, rows } = quickStatRows(group, data, state.quickStatsMode);
  const head = table?.querySelector("thead tr");
  if (head) {
    head.replaceChildren();
    headers.forEach((label, index) => {
      const th = document.createElement("th");
      if (index === 0) {
        th.className = "quick-season-heading";
        th.append(quickSeasonToggle());
      } else {
        th.textContent = label;
      }
      head.append(th);
    });
  }

  els.quickStatsBody.replaceChildren();
  rows.forEach((values) => {
    const row = document.createElement("tr");
    values.forEach((value, index) => {
      const cell = document.createElement("td");
      cell.textContent = value ?? "-";
      cell.dataset.label = headers[index];
      if (index === 0) cell.className = "quick-row-label";
      row.append(cell);
    });
    els.quickStatsBody.append(row);
  });
}

function firstStatSplit(data) {
  return data?.stats?.[0]?.splits?.[0]?.stat || {};
}

function homeAwayStat(data, key) {
  const splits = data?.stats?.[0]?.splits || [];
  const match = splits.find((split) => {
    if (key === "home" && split.isHome === true) return true;
    if (key === "away" && split.isHome === false) return true;
    const label = normalizeText(split.homeAway || split.split?.name || split.split?.value || split.split);
    return label === key;
  });
  return match?.stat || {};
}

async function splitStat(id, group, sitCodes) {
  for (const code of sitCodes) {
    const data = await api.stats(id, group, "statSplits", { sitCodes: code }).catch(() => null);
    const stat = firstStatSplit(data);
    if (Object.keys(stat).length) return stat;
  }
  return {};
}

function kRate(stats) {
  const strikeouts = Number(stats?.strikeOuts || 0);
  const plateAppearances = Number(stats?.plateAppearances || 0);
  return plateAppearances ? `${((strikeouts / plateAppearances) * 100).toFixed(1)}%` : "-";
}

function detailStatValue(stats, key) {
  if (key === "kRate") return kRate(stats);
  if (key === "calculatedEra") {
    if (stats?.era !== undefined && stats?.era !== null && stats?.era !== "") return stats.era;
    const outs = inningsToOuts(stats?.inningsPitched);
    const earnedRuns = Number(stats?.earnedRuns);
    return outs && Number.isFinite(earnedRuns) ? ((earnedRuns * 27) / outs).toFixed(2) : "-";
  }
  return statValue(stats, key);
}

function detailItems(group = state.currentGroup) {
  return group === "pitching"
    ? { primary: PITCHING_DETAIL_PRIMARY_ITEMS, secondary: PITCHING_DETAIL_SECONDARY_ITEMS }
    : { primary: HITTING_DETAIL_PRIMARY_ITEMS, secondary: HITTING_DETAIL_SECONDARY_ITEMS };
}

function renderDetailHeader(person) {
  if (els.detailHeadshot.dataset.playerId === String(person.id)) {
    els.detailHeadshot.alt = `${person.fullName} headshot`;
    if (els.detailHeadshot.complete && els.detailHeadshot.naturalWidth) els.detailHeadshot.classList.add("is-loaded");
  } else {
    loadHeadshot(person.id, person.fullName);
  }
  els.detailLastName.textContent = person.fullName || "Player Detail";
  els.detailNumber.textContent = person.primaryNumber || "--";
  els.detailPlayerStatus.textContent = playerStatusLabel(person);
}

function setActiveButtons(container, dataName, activeValue) {
  container?.querySelectorAll(`[data-${dataName}]`).forEach((button) => {
    const active = button.dataset[dataName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] === activeValue;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function detailStatCard(label, value, featured = false) {
  const card = document.createElement("article");
  card.className = `detail-stat-card${featured ? " featured" : ""}`;
  card.innerHTML = `<span>${label}</span><strong class="stat-number">${value}</strong>`;
  if (label === "wRC+") card.title = "FanGraphs wRC+: 100 is league average; higher is better.";
  if (label === "WAR") card.title = "FanGraphs WAR: estimated wins above a replacement-level player.";
  return card;
}

function renderDetailStats() {
  const stats = state.detailStats[state.detailSplit] || {};
  const items = detailItems();
  els.detailPrimaryStats.replaceChildren();
  els.detailSecondaryStats.replaceChildren();
  items.primary.forEach(([label, key]) => {
    els.detailPrimaryStats.append(detailStatCard(label, detailStatValue(stats, key), true));
  });
  items.secondary.forEach(([label, key]) => {
    els.detailSecondaryStats.append(detailStatCard(label, detailStatValue(stats, key)));
  });
}

function paceValue(stats, key, gamesPlayed, targetGames) {
  if (!gamesPlayed) return "-";
  if (key === "inningsPitched") {
    return outsToInnings(Math.round((inningsToOuts(stats?.[key]) / gamesPlayed) * targetGames));
  }
  const value = Number(stats?.[key] || 0);
  return Math.round((value / gamesPlayed) * targetGames);
}

function renderPaceTab() {
  const stats = state.detailStats.season || {};
  const isPitcher = state.currentGroup === "pitching";
  const playerGames = Number(stats.gamesPlayed || 0);
  const elapsedGames = isPitcher ? state.teamGamesPlayed : playerGames;
  const targetGames = isPitcher ? 162 : 152;
  const paceItems = isPitcher ? PITCHING_PACE_ITEMS : HITTING_PACE_ITEMS;
  const paceCards = paceItems.map(([label, key]) => detailStatCard(label, paceValue(stats, key, elapsedGames, targetGames)));
  els.detailTabPanel.replaceChildren();
  const intro = document.createElement("p");
  intro.className = "detail-tab-note";
  intro.textContent = isPitcher
    ? `${elapsedGames || "-"} team games played. Pitching totals are projected through the 162-game regular season.`
    : `${playerGames || "-"} games played. Counting stats are paced across a 152-game season.`;
  const grid = document.createElement("div");
  grid.className = "detail-tab-grid";
  grid.append(...paceCards);
  els.detailTabPanel.append(intro, grid);
}

function pitchingDecision(split) {
  const stat = split?.stat || {};
  if (Number(stat.wins || 0) > 0) return "W";
  if (Number(stat.losses || 0) > 0) return "L";
  const decisionText = String(stat.decision || stat.note || split?.note || "").toUpperCase();
  const decision = decisionText.match(/(?:^|\W)(W|L)(?:\W|$)/)?.[1];
  return decision || "ND";
}

function renderRecentActionTab() {
  const games = state.gameLogSplits.slice(-RECENT_ACTION_GAMES).reverse();
  els.detailTabPanel.replaceChildren();
  if (!games.length) {
    els.detailTabPanel.append(elementWithText("p", "No recent game rows are available for this player yet.", "empty"));
    return;
  }

  const table = document.createElement("table");
  table.className = "detail-table";
  table.setAttribute("aria-label", `Last ${games.length} games`);
  const headers = state.currentGroup === "pitching"
    ? ["Date", "Opp", "IP", "ER", "SO", "BB", "DEC"]
    : ["Date", "Opp", "H-AB", "HR", "RBI", "R", "BB", "K", "SB"];
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  headers.forEach((label) => headRow.append(elementWithText("th", label)));
  head.append(headRow);
  const body = document.createElement("tbody");
  games.forEach((split) => {
    const stat = split.stat || {};
    const decision = state.currentGroup === "pitching" ? pitchingDecision(split) : "";
    const values = state.currentGroup === "pitching"
      ? [niceDate(split.date), split.opponent?.abbreviation || split.opponent?.name || "-", stat.inningsPitched, stat.earnedRuns, stat.strikeOuts, stat.baseOnBalls, decision]
      : [niceDate(split.date), split.opponent?.abbreviation || split.opponent?.name || "-", `${stat.hits || 0}-${stat.atBats || 0}`, stat.homeRuns, stat.rbi, stat.runs, stat.baseOnBalls, stat.strikeOuts, stat.stolenBases];
    const row = document.createElement("tr");
    if (decision) row.classList.add(`decision-${decision.toLowerCase()}`);
    values.forEach((value, index) => {
      const cell = elementWithText("td", value ?? "-");
      cell.dataset.label = headers[index];
      row.append(cell);
    });
    body.append(row);
  });
  table.append(head, body);
  els.detailTabPanel.append(table);
}

function sumGameStats(games, key) {
  return games.reduce((total, split) => total + Number(split.stat?.[key] || 0), 0);
}

function recentHittingCards(games) {
  const hits = sumGameStats(games, "hits");
  const atBats = sumGameStats(games, "atBats");
  return [
    ["H/AB", `${hits}/${atBats}`],
    ["AVG", formatAverage(hits, atBats)],
    ["HR", sumGameStats(games, "homeRuns")],
    ["RBI", sumGameStats(games, "rbi")],
    ["R", sumGameStats(games, "runs")],
  ];
}

function recentPitchingCards(games) {
  const outs = games.reduce((total, split) => total + inningsToOuts(split.stat?.inningsPitched), 0);
  const earnedRuns = sumGameStats(games, "earnedRuns");
  const era = outs ? ((earnedRuns * 27) / outs).toFixed(2) : "-";
  return [
    ["ERA", era],
    ["W-L", `${sumGameStats(games, "wins")}-${sumGameStats(games, "losses")}`],
    ["IP", outsToInnings(outs)],
    ["ER", earnedRuns],
    ["SO", sumGameStats(games, "strikeOuts")],
    ["BB", sumGameStats(games, "baseOnBalls")],
  ];
}

function formatRate(value, decimals) {
  return Number(value).toFixed(decimals).replace(/^0/, "");
}

function formatRateDifference(value, decimals) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "±";
  return `${sign}${formatRate(Math.abs(value), decimals)}`;
}

function recentHittingOps(games) {
  const atBats = sumGameStats(games, "atBats");
  if (!atBats) return null;
  const hits = sumGameStats(games, "hits");
  const walks = sumGameStats(games, "baseOnBalls");
  const hitByPitch = sumGameStats(games, "hitByPitch");
  const sacrificeFlies = sumGameStats(games, "sacFlies");
  const totalBases = hits
    + sumGameStats(games, "doubles")
    + (2 * sumGameStats(games, "triples"))
    + (3 * sumGameStats(games, "homeRuns"));
  const onBaseDenominator = atBats + walks + hitByPitch + sacrificeFlies;
  const onBasePercentage = onBaseDenominator ? (hits + walks + hitByPitch) / onBaseDenominator : 0;
  return onBasePercentage + (totalBases / atBats);
}

function recentFormTrend(games) {
  const seasonStats = state.detailStats.season || {};
  if (state.currentGroup === "pitching") {
    const outs = games.reduce((total, split) => total + inningsToOuts(split.stat?.inningsPitched), 0);
    const seasonEra = Number(seasonStats.era);
    if (!outs || !Number.isFinite(seasonEra)) {
      return { tone: "even", label: "Even", detail: "Not enough data for a season comparison." };
    }
    const recentEra = (sumGameStats(games, "earnedRuns") * 27) / outs;
    const difference = recentEra - seasonEra;
    const tone = difference <= -0.5 ? "hot" : difference >= 0.5 ? "cold" : "even";
    return {
      tone,
      label: tone[0].toUpperCase() + tone.slice(1),
      detail: `Recent ERA ${recentEra.toFixed(2)} · ${formatRateDifference(difference, 2)} vs ${seasonEra.toFixed(2)} season ERA`,
    };
  }

  const recentOps = recentHittingOps(games);
  const seasonOps = Number(seasonStats.ops);
  if (!Number.isFinite(recentOps) || !Number.isFinite(seasonOps)) {
    return { tone: "even", label: "Even", detail: "Not enough data for a season comparison." };
  }
  const difference = recentOps - seasonOps;
  const tone = difference >= 0.075 ? "hot" : difference <= -0.075 ? "cold" : "even";
  return {
    tone,
    label: tone[0].toUpperCase() + tone.slice(1),
    detail: `Recent OPS ${formatRate(recentOps, 3)} · ${formatRateDifference(difference, 3)} vs ${formatRate(seasonOps, 3)} season OPS`,
  };
}

function recentFormCard(trend) {
  const card = document.createElement("article");
  card.className = `detail-stat-card recent-form-card ${trend.tone}`;
  card.title = trend.detail;
  card.setAttribute("aria-label", `${trend.label} form. ${trend.detail}`);

  const iconPaths = {
    hot: "/yankees/assets/fire-icon.svg",
    cold: "/yankees/assets/snowflake-icon.svg",
    even: "/yankees/assets/even-icon.svg",
  };
  const icon = document.createElement("img");
  icon.className = "recent-form-icon";
  icon.src = iconPaths[trend.tone];
  icon.alt = "";
  icon.setAttribute("aria-hidden", "true");
  card.append(icon);
  card.append(elementWithText("strong", trend.label));
  return card;
}

function renderRecentGamesSummary(gameCount) {
  const games = state.gameLogSplits.slice(-gameCount);
  els.detailTabPanel.replaceChildren();
  if (!games.length) {
    els.detailTabPanel.append(elementWithText("p", "No recent games are available for this player yet.", "empty"));
    return;
  }

  const trend = recentFormTrend(games);
  const grid = document.createElement("div");
  grid.className = `detail-tab-grid recent-summary-grid ${trend.tone}${state.currentGroup === "pitching" ? " pitching" : ""}`;
  const cards = state.currentGroup === "pitching" ? recentPitchingCards(games) : recentHittingCards(games);
  grid.append(recentFormCard(trend));
  cards.forEach(([label, value]) => grid.append(detailStatCard(label, value)));
  els.detailTabPanel.append(grid);
}

function relevantTransactions(transactions) {
  const keywords = ["recall", "selected", "option", "injured", "il", "activated", "reinstated", "call"];
  const filtered = transactions.filter((transaction) => {
    const text = normalizeText(`${transaction.typeDesc || ""} ${transaction.description || ""}`);
    return keywords.some((keyword) => text.includes(keyword));
  });
  return (filtered.length ? filtered : transactions)
    .slice()
    .sort((a, b) => new Date(b.effectiveDate || b.date || 0) - new Date(a.effectiveDate || a.date || 0));
}

function renderSeasonLogTab() {
  const transactions = relevantTransactions(state.detailStats.transactions || []).slice(0, 8);
  els.detailTabPanel.replaceChildren();
  if (!transactions.length) {
    els.detailTabPanel.append(elementWithText("p", "No call-up, option, or IL notes are available for this season.", "empty"));
    return;
  }

  const list = document.createElement("div");
  list.className = "detail-log-list";
  transactions.forEach((transaction) => {
    const row = document.createElement("article");
    row.className = "detail-log-row";
    row.append(
      elementWithText("time", niceDate(transaction.effectiveDate || transaction.date)),
      elementWithText("strong", transaction.typeDesc || "Transaction"),
      elementWithText("span", transaction.description || "No transaction description available."),
    );
    list.append(row);
  });
  els.detailTabPanel.append(list);
}

function renderCareerTab() {
  const stats = state.detailStats.career || {};
  const items = detailItems();
  els.detailTabPanel.replaceChildren();
  const grid = document.createElement("div");
  grid.className = "detail-tab-grid";
  [...items.primary, ...items.secondary].forEach(([label, key], index) => {
    grid.append(detailStatCard(label, detailStatValue(stats, key), index < items.primary.length));
  });
  els.detailTabPanel.append(grid);
}

function renderDetailTab() {
  if (state.detailTab === "recent") renderRecentActionTab();
  else if (state.detailTab === "pace") renderPaceTab();
  else if (state.detailTab === "last-10") renderRecentGamesSummary(10);
  else if (state.detailTab === "last-30") renderRecentGamesSummary(30);
  else if (state.detailTab === "season-log") renderSeasonLogTab();
  else if (state.detailTab === "career") renderCareerTab();
  else renderRecentActionTab();
}

function renderDetailLoading() {
  els.detailPrimaryStats.innerHTML = `<p class="empty">Loading player detail stats...</p>`;
  els.detailSecondaryStats.replaceChildren();
  els.detailTabPanel.innerHTML = `<p class="empty">Loading player detail tabs...</p>`;
}

function renderDetail() {
  setActiveButtons(els.detailSplitControls, "detail-split", state.detailSplit);
  setActiveButtons(els.detailTabControls, "detail-tab", state.detailTab);
  renderDetailStats();
  renderDetailTab();
}

async function loadDetailData(id, seasonStats, group = "hitting", mlbTeamId) {
  const [careerData, yearByYearData, postseasonCareerData, postseasonYearByYearData, homeAwayData, risp, vsLhp, vsRhp, transactionsData, advancedHitting, teamGamesPlayed] = await Promise.all([
    api.statSummary(id, group, "career").catch(() => ({ stats: [] })),
    api.yearByYear(id, group).catch(() => ({ stats: [] })),
    api.statSummary(id, group, "career", { gameType: "P" }).catch(() => ({ stats: [] })),
    api.yearByYear(id, group, { gameType: "P" }).catch(() => ({ stats: [] })),
    api.stats(id, group, "homeAndAway").catch(() => ({ stats: [] })),
    splitStat(id, group, ["risp", "risp2out"]).catch(() => ({})),
    splitStat(id, group, ["vl", "vsl", "vsLHP"]).catch(() => ({})),
    splitStat(id, group, ["vr", "vsr", "vsRHP"]).catch(() => ({})),
    api.transactions(id).catch(() => ({ transactions: [] })),
    group === "hitting" ? api.advancedHitting(id, mlbTeamId).catch(() => null) : Promise.resolve(null),
    group === "pitching" ? api.teamGamesPlayed(mlbTeamId).catch(() => 0) : Promise.resolve(0),
  ]);

  state.teamGamesPlayed = teamGamesPlayed;

  state.detailStats = {
    season: {
      ...(seasonStats || {}),
      wrcPlus: advancedHitting?.wrcPlus ?? "-",
      war: advancedHitting?.war ?? "-",
    },
    risp,
    "vs-lhp": vsLhp,
    "vs-rhp": vsRhp,
    home: homeAwayStat(homeAwayData, "home"),
    away: homeAwayStat(homeAwayData, "away"),
    career: firstStatSplit(careerData),
    yearByYear: statsBySeason(yearByYearData),
    postseasonCareer: firstStatSplit(postseasonCareerData),
    postseasonYearByYear: statsBySeason(postseasonYearByYearData),
    transactions: transactionsData.transactions || [],
  };
}

function playerPosition(person) {
  return person.primaryPosition?.abbreviation || person.primaryPosition?.name || "Player";
}

function ageWithDays(person) {
  if (!person.birthDate) return `${person.currentAge || "-"} years old`;
  const today = new Date();
  const birth = new Date(`${person.birthDate}T12:00:00`);
  let years = today.getFullYear() - birth.getFullYear();
  let lastBirthday = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
  if (today < lastBirthday) {
    years -= 1;
    lastBirthday = new Date(today.getFullYear() - 1, birth.getMonth(), birth.getDate());
  }
  const days = Math.max(0, Math.floor((today - lastBirthday) / 86400000));
  return `${years} years, ${days} days old`;
}

function compactBirthDate(value) {
  if (!value) return "";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return "";
  return `${Number(month)}/${Number(day)}/${year}`;
}

function birthplaceLabel(person) {
  if (person.birthCity && person.birthStateProvince) return `${person.birthCity}, ${person.birthStateProvince}`;
  if (person.birthCity && person.birthCountry) return `${person.birthCity}, ${person.birthCountry}`;
  return person.birthCountry || "Birthplace unavailable";
}

function bornLabel(person) {
  const date = compactBirthDate(person.birthDate);
  const place = birthplaceLabel(person);
  return date ? `${date} in ${place}` : place;
}

function undraftedPlayerLabel(person) {
  const country = normalizeText(person.birthCountry);
  const domesticCountries = new Set(["usa", "us", "united states", "united states of america"]);
  return country && !domesticCountries.has(country) ? "International Free Agent" : "Undrafted Free Agent";
}

function draftLabel(person) {
  const details = person.draftDetails || {};
  const year = details.year || person.draftYear || person.draft?.year;
  const round = details.round || person.draftRound || person.draftRoundNumber || person.draft?.round;
  const pick = details.pick || person.draftPick || person.pickNumber || person.draftNumber || person.draft?.pickNumber;
  const team = details.team || person.draftTeam?.name || person.draftedBy?.name || person.draft?.team?.name;
  if (!year && !round && !pick && !team) return undraftedPlayerLabel(person);
  return `${year || "Year unavailable"}, ${team || "Team unavailable"}, Round: ${round || "-"}, Overall Pick: ${pick || "-"}`;
}

function detailBioRows(person) {
  return [
    ["Size", `${person.height || "-"} / ${person.weight ? `${person.weight} lbs` : "-"}`],
    ["Age", ageWithDays(person)],
    ["Born", bornLabel(person)],
    ["B/T", `${person.batSide?.code || "-"} / ${person.pitchHand?.code || "-"}`],
    ["Draft", draftLabel(person)],
  ];
}

function renderDetailBio(person) {
  els.detailBio.replaceChildren();
  detailBioRows(person).forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "detail-bio-row";
    row.append(elementWithText("span", label), elementWithText("span", value));
    els.detailBio.append(row);
  });
}

function chooseGroup(person, hittingStats, pitchingStats) {
  const position = playerPosition(person);
  if (position === "P" || Number(statValue(pitchingStats, "gamesPlayed", 0)) > Number(statValue(hittingStats, "gamesPlayed", 0))) {
    return "pitching";
  }
  return "hitting";
}

async function loadPlayer(id) {
  state.selectedPlayerId = id;
  loadHeadshot(id);
  setStatus("Loading player data");
  try {
    const [profile, hitting, pitching] = await Promise.all([
      api.player(id),
      api.stats(id, "hitting").catch(() => ({ stats: [] })),
      api.stats(id, "pitching").catch(() => ({ stats: [] })),
    ]);
    const person = profile.people?.[0];
    if (!person) throw new Error("Player not found");
    person.draftDetails = await api.draftDetails(person.id, person.draftYear).catch(() => null);
    const hittingStats = hitting.stats?.[0]?.splits?.[0]?.stat || {};
    const pitchingStats = pitching.stats?.[0]?.splits?.[0]?.stat || {};
    state.currentGroup = chooseGroup(person, hittingStats, pitchingStats);
    state.selectedPerson = person;
    state.detailSplit = "season";
    state.detailTab = "recent";
    state.quickStatsMode = "regular";
    const activeStats = state.currentGroup === "pitching" ? pitchingStats : hittingStats;
    state.quickStatsData = {
      regular: { season: activeStats, yearByYear: {}, career: {} },
      postseason: { season: {}, yearByYear: {}, career: {} },
    };

    renderDetailHeader(person);
    renderDetailBio(person);
    renderQuickStats();
    renderDetailLoading();
    await Promise.all([
      loadGameLog(id, state.currentGroup),
      loadDetailData(id, activeStats, state.currentGroup, person.currentTeam?.id),
    ]);
    state.quickStatsData = {
      regular: {
        season: activeStats,
        yearByYear: state.detailStats.yearByYear,
        career: state.detailStats.career,
      },
      postseason: {
        season: state.detailStats.postseasonYearByYear[String(SEASON)] || {},
        yearByYear: state.detailStats.postseasonYearByYear,
        career: state.detailStats.postseasonCareer,
      },
    };
    renderQuickStats();
    renderDetail();
    persistPlayerInUrl(id);
    setStatus("Live MLB data", "good");
  } catch (error) {
    setStatus("Data connection issue", "error");
    els.detailTabPanel.innerHTML = `<p class="error">Could not load the player profile.</p>`;
  }
}

async function loadGameLog(id, group) {
  const data = await api.gameLog(id, group).catch(() => ({ stats: [] }));
  state.gameLogSplits = data.stats?.[0]?.splits?.slice(-30) || [];
}

function bestDirectMatch(query, people) {
  const normalized = normalizeText(query);
  const exact = people.find((person) => normalizeText(person.fullName) === normalized);
  if (exact) return exact;
  const lastNameMatches = people.filter((person) => normalizeText(person.lastName) === normalized);
  if (lastNameMatches.length === 1) return lastNameMatches[0];
  return null;
}

function showSearchMessage(message, className = "empty") {
  const copy = document.createElement("p");
  copy.className = className;
  copy.textContent = message;
  els.searchResults.replaceChildren(copy);
}

async function searchPlayers(options = {}) {
  const query = els.searchInput.value.trim();
  if (!query) return;
  els.searchResults.hidden = false;
  showSearchMessage("Searching players...");
  try {
    const data = await api.searchPlayer(query);
    const people = (data.people || []).slice(0, 12);
    if (!people.length) {
      showSearchMessage(`No players found for "${query}".`);
      els.searchInput.value = "";
      return;
    }

    const directMatch = options.direct ? bestDirectMatch(query, people) : null;
    if (directMatch) {
      els.searchResults.hidden = true;
      els.searchInput.value = "";
      await loadPlayer(directMatch.id);
      return;
    }

    els.searchResults.replaceChildren();
    people.forEach((person) => {
      const shell = document.createElement("div");
      shell.className = "col-12 col-md-6 result-shell";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "result-button";
      const name = document.createElement("span");
      name.textContent = person.fullName;
      const details = document.createElement("small");
      details.textContent = `${person.primaryPosition?.abbreviation || "Player"} - ${person.currentTeam?.name || "MLB"}`;
      button.append(name, details);
      button.addEventListener("click", () => {
        els.searchResults.hidden = true;
        els.searchInput.value = "";
        loadPlayer(person.id);
      });
      shell.append(button);
      els.searchResults.append(shell);
    });
    els.searchInput.value = "";
  } catch (error) {
    showSearchMessage("Search is unavailable right now.", "error");
  }
}

function bindEvents() {
  els.searchButton.addEventListener("click", () => searchPlayers());
  els.searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      searchPlayers({ direct: true });
    }
  });
  els.quickStatsTable?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-quick-season]");
    if (!button || button.dataset.quickSeason === state.quickStatsMode) return;
    state.quickStatsMode = button.dataset.quickSeason;
    renderQuickStats();
  });
  els.detailSplitControls?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-detail-split]");
    if (!button) return;
    state.detailSplit = button.dataset.detailSplit;
    renderDetail();
  });
  els.detailTabControls?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-detail-tab]");
    if (!button) return;
    state.detailTab = button.dataset.detailTab;
    renderDetail();
  });
}

async function init() {
  bindEvents();
  const requestedPlayer = Number(new URLSearchParams(window.location.search).get("player"));
  const initialPlayer = Number.isFinite(requestedPlayer) && requestedPlayer > 0
    ? requestedPlayer
    : await randomYankeesHitterId();
  await loadPlayer(initialPlayer);
}

init();
