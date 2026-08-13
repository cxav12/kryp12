const MLB_API = "https://statsapi.mlb.com/api/v1";
const TEAM_ID = 147;
const SEASON = new Date().getFullYear();
const LIVE_REFRESH_MS = 30000;
const NOTABLE_CACHE_MS = 5 * 60 * 1000;
const NOTABLE_LIMIT = 10;
const HOT_HITTER_MIN_PA = 25;
const HOT_HITTER_MIN_GAMES = 7;
const HOT_HITTER_MIN_AT_BATS = 15;
const HOT_PITCHER_CANDIDATE_LIMIT = 20;
const HOT_PITCHER_LOOKBACK_DAYS = 21;
const HOT_RELIEVER_LOOKBACK_DAYS = 14;
const HOT_RELIEVER_MIN_GAMES = 5;
const PLAYER_HEADSHOT_URL = (id) => `https://img.mlbstatic.com/mlb-photos/image/upload/w_336,h_280,c_fill,g_face,q_auto:best/v1/people/${id}/headshot/silo/current`;
const BOX_SCORE_FIELDS = [
  "teams", "away", "home", "team", "id", "name", "abbreviation", "teamStats", "players", "person", "fullName",
  "stats", "batting", "atBats", "runs", "hits", "doubles", "triples", "homeRuns", "rbi", "baseOnBalls",
  "strikeOuts", "stolenBases", "pitching", "inningsPitched", "earnedRuns", "completeGames", "shutouts", "saves",
].join(",");
const PLAY_BY_PLAY_FIELDS = [
  "allPlays", "result", "type", "event", "eventType", "description", "rbi", "awayScore", "homeScore", "about",
  "isScoringPlay", "inning", "halfInning", "isComplete", "matchup", "batter", "id", "fullName",
].join(",");
const NOTABLE_FEED_FIELDS = `liveData,boxscore,${BOX_SCORE_FIELDS},plays,${PLAY_BY_PLAY_FIELDS}`;
const HOT_HITTER_FIELDS = "stats,splits,stat,gamesPlayed,plateAppearances,atBats,avg,homeRuns,rbi,ops,player,id,fullName,team,name,abbreviation";
const HOT_PITCHER_CANDIDATE_FIELDS = "stats,splits,stat,gamesStarted,era,inningsPitched,player,id,fullName,team,name,abbreviation";
const HOT_PITCHER_LOG_FIELDS = "stats,splits,date,stat,gamesStarted,outs,inningsPitched,earnedRuns,strikeOuts,baseOnBalls,hits,wins,losses,team,id,name,abbreviation,player,fullName";
const HOT_RELIEVER_FIELDS = "stats,splits,stat,gamesPlayed,gamesStarted,outs,inningsPitched,earnedRuns,strikeOuts,baseOnBalls,hits,era,whip,saves,blownSaves,player,id,fullName,team,name,abbreviation";
const PLAYER_LEADER_STATS = {
  hitting: [
    { key: "battingAverage", label: "Batting Average", group: "hitting" },
    { key: "homeRuns", label: "Home Runs", group: "hitting" },
    { key: "runsBattedIn", label: "RBI", group: "hitting" },
    { key: "hits", label: "Hits", group: "hitting" },
    { key: "stolenBases", label: "Stolen Bases", group: "hitting" },
  ],
  pitching: [
    { key: "wins", label: "Wins", group: "pitching" },
    { key: "earnedRunAverage", label: "ERA", group: "pitching", ascending: true },
    { key: "saves", label: "Saves", group: "pitching" },
    { key: "strikeouts", label: "Strikeouts", group: "pitching" },
    { key: "qualityStarts", label: "Quality Starts", group: "pitching" },
  ],
};
const TEAM_LEADER_STATS = {
  hitting: [
    { key: "avg", label: "Batting Average" },
    { key: "homeRuns", label: "Home Runs" },
    { key: "rbi", label: "RBI" },
    { key: "hits", label: "Hits" },
    { key: "stolenBases", label: "Stolen Bases" },
  ],
  pitching: [
    { key: "wins", label: "Wins" },
    { key: "era", label: "ERA", ascending: true },
    { key: "saves", label: "Saves" },
    { key: "strikeOuts", label: "Strikeouts" },
    { key: "qualityStarts", label: "Quality Starts" },
  ],
};
const EASTERN_TIME_ZONE = "America/New_York";
const fullDateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});
const gameTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: EASTERN_TIME_ZONE,
});

const state = {
  selectedDate: localNoon(new Date()),
  requestId: 0,
  abortController: null,
  refreshTimer: null,
  notableCache: new Map(),
  notableSignature: "",
  hotPlayers: {
    hitters: null,
    pitchers: null,
    relievers: null,
    status: "loading",
  },
  standingsRecords: [],
  standingsView: {
    mode: "division",
    filter: "American League East",
  },
  dataStatus: {
    scores: "loading",
    standings: "loading",
  },
  leagueLeaders: {
    players: null,
    teams: null,
    view: "players",
    status: "loading",
  },
};

const els = {
  status: document.querySelector("#data-status"),
  dateList: document.querySelector("#scores-date-list"),
  previousDate: document.querySelector("#previous-score-date"),
  nextDate: document.querySelector("#next-score-date"),
  scoreCards: document.querySelector("#score-cards"),
  notableEvents: document.querySelector("#notable-events"),
  whosHot: document.querySelector("#whos-hot"),
  whosNot: document.querySelector("#whos-not"),
  standingsContext: document.querySelector("#standings-context"),
  standingsModeControls: document.querySelector("#standings-mode-controls"),
  standingsFilterControls: document.querySelector("#standings-filter-controls"),
  standingsBody: document.querySelector("#standings-body"),
  leagueLeaders: document.querySelector("#league-leaders"),
  leaderboardToggle: document.querySelector("#leaderboard-toggle"),
};

function localNoon(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
}

function addDays(date, amount) {
  const next = localNoon(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fullDateLabel(date) {
  return fullDateFormatter.format(date);
}

function gameTime(value) {
  if (!value) return "TBD";
  return gameTimeFormatter.format(new Date(value));
}

function ordinal(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  const remainder100 = number % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${number}th`;
  return `${number}${number % 10 === 1 ? "st" : number % 10 === 2 ? "nd" : number % 10 === 3 ? "rd" : "th"}`;
}

function element(tagName, className = "", text = "") {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  if (text !== "") node.textContent = text;
  return node;
}

function setStatus(message, tone = "neutral") {
  els.status.textContent = message;
  els.status.style.color = tone === "error" ? "#ffbec4" : tone === "good" ? "#9af0c8" : "";
}

function updateDataStatus() {
  const values = Object.values(state.dataStatus);
  if (values.includes("error")) {
    setStatus("Some MLB data is unavailable", "error");
  } else if (values.every((value) => value === "ready")) {
    setStatus("Live MLB data", "good");
  } else {
    setStatus("Loading MLB data");
  }
}

function setDataStatus(section, value) {
  state.dataStatus[section] = value;
  updateDataStatus();
}

function renderDatePicker() {
  const key = dateKey(state.selectedDate);
  const label = fullDateLabel(state.selectedDate);
  const display = element("time", "scores-date-current");

  display.dateTime = key;
  display.setAttribute("aria-label", `MLB scores for ${label}`);
  display.textContent = label;

  els.dateList.replaceChildren(display);
}

async function getScores(date, signal) {
  const key = dateKey(date);
  const url = new URL(`${MLB_API}/schedule`);
  url.searchParams.set("sportId", "1");
  url.searchParams.set("startDate", key);
  url.searchParams.set("endDate", key);
  url.searchParams.set("hydrate", "team,linescore");

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
  const schedule = await response.json();
  return (schedule.dates || []).flatMap((dateEntry) => dateEntry.games || []);
}

async function getStandings() {
  const url = new URL(`${MLB_API}/standings`);
  url.searchParams.set("leagueId", "103,104");
  url.searchParams.set("season", SEASON);
  url.searchParams.set("standingsTypes", "regularSeason");
  url.searchParams.set("hydrate", "team(division,league)");

  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
  return response.json();
}

async function getNotableGameData(game, signal) {
  const url = new URL(`https://statsapi.mlb.com/api/v1.1/game/${game.gamePk}/feed/live`);
  url.searchParams.set("fields", NOTABLE_FEED_FIELDS);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
  const data = await response.json();
  return { game, boxscore: data.liveData?.boxscore || {}, playByPlay: data.liveData?.plays || {} };
}

function storeStandings(data) {
  const records = [];
  (data.records || []).forEach((division) => {
    (division.teamRecords || []).forEach((record) => {
      if (!record.team?.id) return;
      const divisionName = division.division?.name || record.team.division?.name || "";
      const leagueName = division.league?.name || record.team.league?.name || "";
      const lastTen = record.records?.splitRecords?.find((split) => split.type === "lastTen");
      records.push({
        teamId: record.team.id,
        teamName: record.team.name || "Team",
        wins: record.leagueRecord?.wins ?? record.wins ?? "-",
        losses: record.leagueRecord?.losses ?? record.losses ?? "-",
        pct: record.leagueRecord?.pct || record.winningPercentage || "-",
        lastTen: lastTen ? `${lastTen.wins}-${lastTen.losses}` : "-",
        divisionGamesBack: record.divisionGamesBack ?? record.gamesBack ?? "-",
        leagueGamesBack: record.leagueGamesBack ?? record.gamesBack ?? "-",
        sportGamesBack: record.sportGamesBack ?? record.leagueGamesBack ?? record.gamesBack ?? "-",
        wildCardGamesBack: record.wildCardGamesBack ?? "-",
        divisionRank: Number(record.divisionRank),
        leagueRank: Number(record.leagueRank),
        sportRank: Number(record.sportRank),
        wildCardRank: Number(record.wildCardRank),
        divisionName,
        leagueName,
        teamAbbreviation: teamAbbreviation(record.team),
        streakCode: record.streak?.streakCode || "",
        streakNumber: Number(record.streak?.streakNumber),
        streakType: record.streak?.streakType || "",
      });
    });
  });
  state.standingsRecords = records;
}

function streakValue(record) {
  if (Number.isFinite(record.streakNumber) && record.streakNumber > 0) {
    const result = record.streakType.toLowerCase().startsWith("win") ? "W" : "L";
    return `${record.streakNumber}${result}`;
  }

  const match = record.streakCode.match(/^([WL])(\d+)$/i);
  return match ? `${match[2]}${match[1].toUpperCase()}` : "-";
}

function divisionShortName(name) {
  return String(name || "")
    .replace("American League", "AL")
    .replace("National League", "NL");
}

function leagueShortName(name) {
  if (name.includes("American")) return "American League";
  if (name.includes("National")) return "National League";
  return name || "League";
}

function leagueOrder(name) {
  return name.includes("American") ? 0 : name.includes("National") ? 1 : 2;
}

function divisionOrder(name) {
  const order = ["AL East", "AL Central", "AL West", "NL East", "NL Central", "NL West"];
  const index = order.indexOf(divisionShortName(name));
  return index === -1 ? order.length : index;
}

function rankValue(record, mode) {
  if (mode === "division") return record.divisionRank;
  if (mode === "league") return record.leagueRank;
  if (mode === "wild-card") return record.wildCardRank;
  return record.sportRank;
}

function gamesBackValue(record, mode) {
  if (mode === "division") return record.divisionGamesBack;
  if (mode === "league") return record.leagueGamesBack;
  if (mode === "wild-card") return record.wildCardGamesBack;
  return record.sportGamesBack;
}

function standingsFallbackSort(a, b) {
  const percentageDifference = Number(b.pct) - Number(a.pct);
  if (Number.isFinite(percentageDifference) && percentageDifference !== 0) return percentageDifference;
  const winDifference = Number(b.wins) - Number(a.wins);
  if (Number.isFinite(winDifference) && winDifference !== 0) return winDifference;
  return Number(a.losses) - Number(b.losses);
}

function sortStandings(records, mode) {
  return [...records].sort((a, b) => {
    const aRank = rankValue(a, mode);
    const bRank = rankValue(b, mode);
    if (Number.isFinite(aRank) && Number.isFinite(bRank)) return aRank - bRank;
    return standingsFallbackSort(a, b);
  });
}

function uniqueStandingsOptions(key, labeler, sorter) {
  const options = new Map();
  state.standingsRecords.forEach((record) => {
    if (record[key]) options.set(record[key], labeler(record[key]));
  });
  return [...options.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort(sorter);
}

function divisionOptions() {
  return uniqueStandingsOptions(
    "divisionName",
    divisionShortName,
    (a, b) => divisionOrder(a.value) - divisionOrder(b.value),
  );
}

function leagueOptions() {
  return uniqueStandingsOptions(
    "leagueName",
    leagueShortName,
    (a, b) => leagueOrder(a.value) - leagueOrder(b.value),
  );
}

function currentStandingsLabel() {
  const { mode, filter } = state.standingsView;
  if (mode === "division") return divisionShortName(filter);
  if (mode === "league") return leagueShortName(filter);
  if (mode === "wild-card") return `${filter.includes("American") ? "AL" : "NL"} Wild Card`;
  return "MLB";
}

function filteredStandings() {
  const { mode, filter } = state.standingsView;
  if (mode === "division") {
    return sortStandings(state.standingsRecords.filter((record) => record.divisionName === filter), mode);
  }
  if (mode === "league") {
    return sortStandings(state.standingsRecords.filter((record) => record.leagueName === filter), mode);
  }
  if (mode === "wild-card") {
    return sortStandings(
      state.standingsRecords.filter((record) => record.leagueName === filter && record.divisionRank !== 1),
      mode,
    );
  }
  return sortStandings(state.standingsRecords, mode);
}

function standingsButton(label, value, active) {
  const button = element("button", `standings-option${active ? " active" : ""}`, label);
  button.type = "button";
  button.dataset.standingsFilter = value;
  button.setAttribute("aria-pressed", String(active));
  return button;
}

function setStandingsMode(mode) {
  state.standingsView.mode = mode;
  if (mode === "division") {
    const yankeesStanding = state.standingsRecords.find((record) => record.teamId === TEAM_ID);
    state.standingsView.filter = yankeesStanding?.divisionName || divisionOptions()[0]?.value || "";
  } else if (mode === "league" || mode === "wild-card") {
    state.standingsView.filter = leagueOptions()[0]?.value || "";
  } else {
    state.standingsView.filter = "MLB";
  }
  renderStandings();
}

function setStandingsFilter(filter) {
  state.standingsView.filter = filter;
  renderStandings();
}

function renderStandingsFilters() {
  els.standingsFilterControls.replaceChildren();
  if (state.standingsView.mode === "mlb") {
    els.standingsFilterControls.hidden = true;
    return;
  }

  els.standingsFilterControls.hidden = false;
  const options = state.standingsView.mode === "division" ? divisionOptions() : leagueOptions();
  options.forEach((option) => {
    els.standingsFilterControls.append(standingsButton(option.label, option.value, option.value === state.standingsView.filter));
  });
}

function standingsCell(label, value, className = "") {
  const cell = element("td");
  cell.dataset.label = label;
  cell.append(element("span", className, value ?? "-"));
  return cell;
}

function renderStandingsRows() {
  const records = filteredStandings();
  els.standingsBody.replaceChildren();

  if (!records.length) {
    const row = element("tr");
    const cell = element("td", "standings-empty", "Standings unavailable");
    cell.colSpan = 8;
    row.append(cell);
    els.standingsBody.append(row);
    return;
  }

  const fragment = document.createDocumentFragment();
  records.forEach((record, index) => {
    const row = element("tr");
    const rankedValue = rankValue(record, state.standingsView.mode);
    const rank = Number.isFinite(rankedValue) ? rankedValue : index + 1;
    if (record.teamId === TEAM_ID) row.classList.add("is-yankees");
    row.append(
      standingsCell("Rank", rank, "rank-indicator"),
      standingsCell("Team", record.teamName),
      standingsCell("W", record.wins),
      standingsCell("L", record.losses),
      standingsCell("PCT", record.pct),
      standingsCell("GB", gamesBackValue(record, state.standingsView.mode)),
      standingsCell("Last 10", record.lastTen),
      standingsCell("Streak", streakValue(record)),
    );
    fragment.append(row);
  });
  els.standingsBody.append(fragment);
}

function renderStandings() {
  els.standingsContext.textContent = currentStandingsLabel();
  els.standingsModeControls.querySelectorAll("[data-standings-mode]").forEach((button) => {
    const active = button.dataset.standingsMode === state.standingsView.mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderStandingsFilters();
  renderStandingsRows();
}

async function loadStandings() {
  setDataStatus("standings", "loading");
  try {
    const data = await getStandings();
    storeStandings(data);
    setStandingsMode(state.standingsView.mode);
    setDataStatus("standings", "ready");
    renderWhosHot();
  } catch (error) {
    const row = element("tr");
    const cell = element("td", "standings-empty", "Could not load standings.");
    cell.colSpan = 8;
    row.append(cell);
    els.standingsBody.replaceChildren(row);
    setDataStatus("standings", "error");
    renderWhosHot();
  }
}

function teamAbbreviation(team) {
  return team?.abbreviation || team?.teamCode?.toUpperCase() || team?.fileCode?.toUpperCase() || team?.shortName || "TBD";
}

function hottestTeam() {
  return state.standingsRecords
    .filter((record) => record.streakType === "wins" && Number.isFinite(record.streakNumber))
    .sort((a, b) => b.streakNumber - a.streakNumber || Number(b.pct) - Number(a.pct))[0] || null;
}

function coldestTeam() {
  return state.standingsRecords
    .filter((record) => record.streakType === "losses" && Number.isFinite(record.streakNumber))
    .sort((a, b) => b.streakNumber - a.streakNumber || Number(a.pct) - Number(b.pct))[0] || null;
}

function mediaImage(src, className, alt, width, height) {
  if (!src) return null;
  const image = element("img", className);
  image.src = src;
  image.alt = alt;
  image.width = width;
  image.height = height;
  image.decoding = "async";
  image.addEventListener("error", () => { image.hidden = true; }, { once: true });
  return image;
}

function hotItem(label, name, stats, media = null) {
  const item = element("article", "hot-item");
  const content = element("div", "hot-content");
  content.append(
    element("span", "hot-label", label),
    element("strong", "hot-name", name),
    element("span", "hot-stats", stats),
  );
  if (media) item.append(media);
  item.append(content);
  return item;
}

function renderWhosHot() {
  const hotTeam = hottestTeam();
  const coldTeam = coldestTeam();
  const { hitters, pitchers, relievers, status } = state.hotPlayers;
  const teamLoading = state.dataStatus.standings === "loading";
  const loading = teamLoading || status === "loading";
  if (loading && els.whosHot.querySelector(".hot-message") && els.whosNot.querySelector(".hot-message")) return;

  const playerName = (player) => player ? `${player.playerName} | ${player.teamAbbreviation}` : "Unavailable";
  const playerImage = (player) => player
    ? mediaImage(PLAYER_HEADSHOT_URL(player.playerId), "hot-player-headshot", `${player.playerName} headshot`, 48, 44)
    : null;
  const teamImage = (team) => team
    ? mediaImage(teamLogoUrl({ id: team.teamId }), "hot-team-logo team-logo", `${team.teamName} logo`, 44, 44)
    : null;
  const hitterStats = (player) => player
    ? `AVG ${player.avg} | ${player.homeRuns} HR | ${player.rbi} RBI | OPS ${player.ops}`
    : "10-game hitting data is unavailable";
  const pitcherStats = (player) => player
    ? `${player.era} ERA | ${player.whip} WHIP | ${player.strikeouts} K | ${player.inningsPitched} IP`
    : "Three-start pitching data is unavailable";
  const relieverStats = (player) => player
    ? `${player.era} ERA | ${player.whip} WHIP | ${player.strikeouts} K | ${player.saves} SV`
    : "Recent relief data is unavailable";

  els.whosHot.replaceChildren(
    hotItem("Longest Winning Streak", hotTeam?.teamName || "Unavailable", hotTeam ? `${hotTeam.streakNumber}W | Longest active streak` : "Winning-streak data is unavailable", teamImage(hotTeam)),
    hotItem("Best Hitter | Last 10", playerName(hitters?.best), hitterStats(hitters?.best), playerImage(hitters?.best)),
    hotItem("Best Pitcher | Last 3", playerName(pitchers?.best), pitcherStats(pitchers?.best), playerImage(pitchers?.best)),
    hotItem("Best Reliever | Last 14 Days", playerName(relievers?.best), relieverStats(relievers?.best), playerImage(relievers?.best)),
    hotItem("Saves Leader | Last 14 Days", playerName(relievers?.saveLeader), relievers?.saveLeader ? `${relievers.saveLeader.saves} SV | ${relievers.saveLeader.era} ERA | ${relievers.saveLeader.strikeouts} K` : "Recent saves data is unavailable", playerImage(relievers?.saveLeader)),
  );
  els.whosNot.replaceChildren(
    hotItem("Longest Losing Streak", coldTeam?.teamName || "Unavailable", coldTeam ? `${coldTeam.streakNumber}L | Longest active streak` : "Losing-streak data is unavailable", teamImage(coldTeam)),
    hotItem("Worst Hitter | Last 10", playerName(hitters?.worst), hitterStats(hitters?.worst), playerImage(hitters?.worst)),
    hotItem("Worst Pitcher | Last 3", playerName(pitchers?.worst), pitcherStats(pitchers?.worst), playerImage(pitchers?.worst)),
    hotItem("Worst Reliever | Last 14 Days", playerName(relievers?.worst), relieverStats(relievers?.worst), playerImage(relievers?.worst)),
    hotItem("Blown Saves Leader | Last 14 Days", playerName(relievers?.blownSaveLeader), relievers?.blownSaveLeader ? `${relievers.blownSaveLeader.blownSaves} BS | ${relievers.blownSaveLeader.era} ERA | ${relievers.blownSaveLeader.whip} WHIP` : "Recent blown-save data is unavailable", playerImage(relievers?.blownSaveLeader)),
  );
  els.whosHot.setAttribute("aria-busy", String(loading));
  els.whosNot.setAttribute("aria-busy", String(loading));
}

function hitterSummary(split) {
  return {
    playerId: split.player.id,
    playerName: split.player?.fullName || "Player",
    teamAbbreviation: teamAbbreviation(split.team),
    avg: split.stat?.avg || "-",
    homeRuns: statNumber(split.stat?.homeRuns),
    rbi: statNumber(split.stat?.rbi),
    ops: split.stat?.ops || "-",
  };
}

async function getHitterRankings() {
  const url = new URL(`${MLB_API}/stats`);
  url.searchParams.set("stats", "lastXGames");
  url.searchParams.set("group", "hitting");
  url.searchParams.set("gameType", "R");
  url.searchParams.set("season", SEASON);
  url.searchParams.set("sportIds", "1");
  url.searchParams.set("playerPool", "QUALIFIED");
  url.searchParams.set("numGames", "10");
  url.searchParams.set("limit", "1000");
  url.searchParams.set("sortStat", "onBasePlusSlugging");
  url.searchParams.set("hydrate", "team");
  url.searchParams.set("fields", HOT_HITTER_FIELDS);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
  const data = await response.json();
  const hitters = (data.stats?.[0]?.splits || [])
    .filter((split) => statNumber(split.stat?.plateAppearances) >= HOT_HITTER_MIN_PA
      && statNumber(split.stat?.gamesPlayed) >= HOT_HITTER_MIN_GAMES
      && statNumber(split.stat?.atBats) >= HOT_HITTER_MIN_AT_BATS)
    .sort((a, b) => statNumber(b.stat?.ops) - statNumber(a.stat?.ops)
      || statNumber(b.stat?.homeRuns) - statNumber(a.stat?.homeRuns)
      || statNumber(b.stat?.rbi) - statNumber(a.stat?.rbi));
  if (!hitters.length) throw new Error("No qualified 10-game hitters found");
  return {
    best: hitterSummary(hitters[0]),
    worst: hitterSummary(hitters[hitters.length - 1]),
  };
}

async function getPitcherCandidates() {
  const endDate = localNoon(new Date());
  const startDate = addDays(endDate, -HOT_PITCHER_LOOKBACK_DAYS);
  const url = new URL(`${MLB_API}/stats`);
  url.searchParams.set("stats", "byDateRange");
  url.searchParams.set("group", "pitching");
  url.searchParams.set("gameType", "R");
  url.searchParams.set("season", SEASON);
  url.searchParams.set("sportIds", "1");
  url.searchParams.set("playerPool", "QUALIFIED");
  url.searchParams.set("limit", "1000");
  url.searchParams.set("sortStat", "earnedRunAverage");
  url.searchParams.set("startDate", dateKey(startDate));
  url.searchParams.set("endDate", dateKey(endDate));
  url.searchParams.set("hydrate", "team");
  url.searchParams.set("fields", HOT_PITCHER_CANDIDATE_FIELDS);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
  const data = await response.json();
  return (data.stats?.[0]?.splits || [])
    .filter((split) => split.player?.id && statNumber(split.stat?.gamesStarted) >= 3)
    .sort((a, b) => statNumber(a.stat?.era) - statNumber(b.stat?.era));
}

function inningsFromOuts(outs) {
  return `${Math.floor(outs / 3)}.${outs % 3}`;
}

async function getPitcherLastThreeStarts(candidate) {
  const url = new URL(`${MLB_API}/people/${candidate.player.id}/stats`);
  url.searchParams.set("stats", "gameLog");
  url.searchParams.set("group", "pitching");
  url.searchParams.set("gameType", "R");
  url.searchParams.set("season", SEASON);
  url.searchParams.set("hydrate", "team");
  url.searchParams.set("fields", HOT_PITCHER_LOG_FIELDS);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
  const data = await response.json();
  const starts = (data.stats?.[0]?.splits || [])
    .filter((split) => statNumber(split.stat?.gamesStarted) > 0)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);
  if (starts.length < 3) return null;

  const totals = starts.reduce((result, split) => {
    result.outs += statNumber(split.stat?.outs);
    result.earnedRuns += statNumber(split.stat?.earnedRuns);
    result.strikeouts += statNumber(split.stat?.strikeOuts);
    result.walks += statNumber(split.stat?.baseOnBalls);
    result.hits += statNumber(split.stat?.hits);
    return result;
  }, { outs: 0, earnedRuns: 0, strikeouts: 0, walks: 0, hits: 0 });
  if (totals.outs < 45) return null;

  const innings = totals.outs / 3;
  return {
    playerId: candidate.player.id,
    playerName: candidate.player.fullName,
    teamAbbreviation: teamAbbreviation(starts[0].team || candidate.team),
    eraValue: totals.earnedRuns * 9 / innings,
    whipValue: (totals.walks + totals.hits) / innings,
    era: (totals.earnedRuns * 9 / innings).toFixed(2),
    whip: ((totals.walks + totals.hits) / innings).toFixed(2),
    strikeouts: totals.strikeouts,
    inningsPitched: inningsFromOuts(totals.outs),
    outs: totals.outs,
  };
}

async function getPitcherRankings() {
  const candidates = await getPitcherCandidates();
  const candidatePool = [
    ...candidates.slice(0, HOT_PITCHER_CANDIDATE_LIMIT),
    ...candidates.slice(-HOT_PITCHER_CANDIDATE_LIMIT),
  ];
  const results = await Promise.allSettled(candidatePool.map(getPitcherLastThreeStarts));
  const pitchers = results
    .filter((result) => result.status === "fulfilled" && result.value)
    .map((result) => result.value)
    .sort((a, b) => a.eraValue - b.eraValue
      || a.whipValue - b.whipValue
      || b.outs - a.outs
      || b.strikeouts - a.strikeouts);
  if (!pitchers.length) throw new Error("No qualified three-start pitchers found");
  return { best: pitchers[0], worst: pitchers[pitchers.length - 1] };
}

function relieverSummary(split) {
  const outs = statNumber(split.stat?.outs);
  const innings = outs / 3;
  const whipValue = split.stat?.whip
    ? statNumber(split.stat.whip)
    : innings ? (statNumber(split.stat?.baseOnBalls) + statNumber(split.stat?.hits)) / innings : Number.POSITIVE_INFINITY;
  return {
    playerId: split.player.id,
    playerName: split.player?.fullName || "Player",
    teamAbbreviation: teamAbbreviation(split.team),
    eraValue: statNumber(split.stat?.era),
    whipValue,
    era: split.stat?.era || "-",
    whip: split.stat?.whip || (Number.isFinite(whipValue) ? whipValue.toFixed(2) : "-"),
    strikeouts: statNumber(split.stat?.strikeOuts),
    saves: statNumber(split.stat?.saves),
    blownSaves: statNumber(split.stat?.blownSaves),
  };
}

async function getRelieverRankings() {
  const endDate = localNoon(new Date());
  const startDate = addDays(endDate, -HOT_RELIEVER_LOOKBACK_DAYS);
  const url = new URL(`${MLB_API}/stats`);
  url.searchParams.set("stats", "byDateRange");
  url.searchParams.set("group", "pitching");
  url.searchParams.set("gameType", "R");
  url.searchParams.set("season", SEASON);
  url.searchParams.set("sportIds", "1");
  url.searchParams.set("playerPool", "ALL");
  url.searchParams.set("limit", "1000");
  url.searchParams.set("startDate", dateKey(startDate));
  url.searchParams.set("endDate", dateKey(endDate));
  url.searchParams.set("hydrate", "team");
  url.searchParams.set("fields", HOT_RELIEVER_FIELDS);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
  const data = await response.json();
  const relievers = (data.stats?.[0]?.splits || [])
    .filter((split) => split.player?.id
      && statNumber(split.stat?.gamesStarted) === 0
      && statNumber(split.stat?.gamesPlayed) >= HOT_RELIEVER_MIN_GAMES
      && statNumber(split.stat?.outs) >= 9)
    .map(relieverSummary)
    .sort((a, b) => a.eraValue - b.eraValue || a.whipValue - b.whipValue || b.strikeouts - a.strikeouts);
  if (!relievers.length) throw new Error("No qualified recent relievers found");
  const saveLeader = relievers
    .filter((reliever) => reliever.saves > 0)
    .sort((a, b) => b.saves - a.saves || a.eraValue - b.eraValue)[0] || null;
  const blownSaveLeader = relievers
    .filter((reliever) => reliever.blownSaves > 0)
    .sort((a, b) => b.blownSaves - a.blownSaves || b.eraValue - a.eraValue)[0] || null;
  return { best: relievers[0], worst: relievers[relievers.length - 1], saveLeader, blownSaveLeader };
}

async function loadHotPlayers() {
  const [hitterResult, pitcherResult, relieverResult] = await Promise.allSettled([
    getHitterRankings(),
    getPitcherRankings(),
    getRelieverRankings(),
  ]);
  if (hitterResult.status === "fulfilled") state.hotPlayers.hitters = hitterResult.value;
  if (pitcherResult.status === "fulfilled") state.hotPlayers.pitchers = pitcherResult.value;
  if (relieverResult.status === "fulfilled") state.hotPlayers.relievers = relieverResult.value;
  state.hotPlayers.status = "ready";
  renderWhosHot();
}

function leaderEntry(entry, index, type) {
  const item = element("li", "leader-entry");
  if ((type === "player" && entry.abbreviation === "NYY") || (type === "team" && Number(entry.id) === TEAM_ID)) {
    item.classList.add("is-yankees");
  }
  const identity = element("span", "leader-identity");
  identity.append(element("strong", "leader-name", entry.name));
  if (type === "player") identity.append(element("span", "leader-team", entry.abbreviation || "MLB"));
  const image = type === "player"
    ? mediaImage(PLAYER_HEADSHOT_URL(entry.id), "leader-image", `${entry.name} headshot`, 32, 32)
    : mediaImage(teamLogoUrl({ id: entry.id }), "leader-image team-logo", `${entry.name} logo`, 32, 32);
  item.append(
    element("span", "leader-rank", index + 1),
    image || element("span", "leader-image"),
    identity,
    element("strong", "leader-value", entry.value),
  );
  return item;
}

function leaderStatCard(definition, entries, type) {
  const card = element("section", "leader-stat-card");
  card.append(element("h4", "leader-stat-title", definition.label));
  if (!entries?.length) {
    card.append(element("p", "leader-stat-empty", "Unavailable"));
    return card;
  }
  const list = element("ol", "leader-list");
  entries.slice(0, 5).forEach((entry, index) => list.append(leaderEntry(entry, index, type)));
  card.append(list);
  return card;
}

function leaderGroup(title, definitions, leaders, type) {
  const group = element("section", "leader-group");
  const grid = element("div", "leader-stat-grid");
  definitions.forEach((definition) => grid.append(leaderStatCard(definition, leaders?.[definition.key], type)));
  group.append(element("h3", "leader-group-title", title), grid);
  return group;
}

function renderLeagueLeaders() {
  const { players, teams, view, status } = state.leagueLeaders;
  if (status === "loading") return;
  const showingPlayers = view === "players";
  const data = showingPlayers ? players : teams;
  const definitions = showingPlayers ? PLAYER_LEADER_STATS : TEAM_LEADER_STATS;
  const type = showingPlayers ? "player" : "team";
  els.leagueLeaders.replaceChildren(
    leaderGroup(showingPlayers ? "Hitters" : "Hitting", definitions.hitting, data?.hitting, type),
    leaderGroup(showingPlayers ? "Pitchers" : "Pitching", definitions.pitching, data?.pitching, type),
  );
  els.leaderboardToggle.querySelectorAll("[data-leader-view]").forEach((button) => {
    const active = button.dataset.leaderView === view;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  els.leagueLeaders.setAttribute("aria-busy", "false");
}

function setLeagueLeaderView(view) {
  if (view !== "players" && view !== "teams") return;
  state.leagueLeaders.view = view;
  renderLeagueLeaders();
}

function playerLeaderSummary(leader) {
  return {
    id: leader.person?.id,
    name: leader.person?.fullName || "Player",
    abbreviation: teamAbbreviation(leader.team),
    value: leader.value ?? "-",
  };
}

async function getPlayerLeagueLeaders() {
  const definitions = [...PLAYER_LEADER_STATS.hitting, ...PLAYER_LEADER_STATS.pitching]
    .filter((definition) => definition.key !== "qualityStarts");
  const url = new URL(`${MLB_API}/stats/leaders`);
  url.searchParams.set("leaderCategories", definitions.map((definition) => definition.key).join(","));
  url.searchParams.set("season", SEASON);
  url.searchParams.set("sportId", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("hydrate", "person(currentTeam),team");

  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
  const data = await response.json();
  const result = { hitting: {}, pitching: {} };
  definitions.forEach((definition) => {
    const board = (data.leagueLeaders || []).find((entry) => entry.leaderCategory === definition.key
      && entry.statGroup === definition.group);
    result[definition.group][definition.key] = (board?.leaders || []).slice(0, 5).map(playerLeaderSummary);
  });
  return result;
}

function teamLeaderSummary(split, key) {
  return {
    id: split.team?.id,
    name: split.team?.name || "Team",
    abbreviation: teamAbbreviation(split.team),
    value: split.stat?.[key] ?? "-",
  };
}

function rankTeamSplits(splits, definitions) {
  const result = {};
  definitions.filter((definition) => definition.key !== "qualityStarts").forEach((definition) => {
    const direction = definition.ascending ? 1 : -1;
    result[definition.key] = [...splits]
      .filter((split) => Number.isFinite(Number(split.stat?.[definition.key])))
      .sort((a, b) => direction * (Number(a.stat[definition.key]) - Number(b.stat[definition.key])))
      .slice(0, 5)
      .map((split) => teamLeaderSummary(split, definition.key));
  });
  return result;
}

async function getTeamLeagueLeaders() {
  const request = async (group) => {
    const url = new URL(`${MLB_API}/teams/stats`);
    url.searchParams.set("stats", "season");
    url.searchParams.set("group", group);
    url.searchParams.set("season", SEASON);
    url.searchParams.set("sportIds", "1");
    const response = await fetch(url);
    if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
    const data = await response.json();
    return data.stats?.[0]?.splits || [];
  };
  const [hitting, pitching] = await Promise.all([request("hitting"), request("pitching")]);
  return {
    hitting: rankTeamSplits(hitting, TEAM_LEADER_STATS.hitting),
    pitching: rankTeamSplits(pitching, TEAM_LEADER_STATS.pitching),
  };
}

async function getQualityStartLeaders() {
  const candidatesUrl = new URL(`${MLB_API}/stats`);
  candidatesUrl.searchParams.set("stats", "season");
  candidatesUrl.searchParams.set("group", "pitching");
  candidatesUrl.searchParams.set("gameType", "R");
  candidatesUrl.searchParams.set("season", SEASON);
  candidatesUrl.searchParams.set("sportIds", "1");
  candidatesUrl.searchParams.set("playerPool", "ALL");
  candidatesUrl.searchParams.set("limit", "1000");
  candidatesUrl.searchParams.set("hydrate", "team");
  candidatesUrl.searchParams.set("fields", "stats,splits,stat,gamesStarted,player,id,fullName,team,name,abbreviation,teamCode,fileCode,shortName");
  const candidatesResponse = await fetch(candidatesUrl);
  if (!candidatesResponse.ok) throw new Error(`MLB API returned ${candidatesResponse.status}`);
  const candidatesData = await candidatesResponse.json();
  const candidates = (candidatesData.stats?.[0]?.splits || [])
    .filter((split) => split.player?.id && statNumber(split.stat?.gamesStarted) > 0);

  const logsUrl = new URL(`${MLB_API}/people`);
  logsUrl.searchParams.set("personIds", candidates.map((split) => split.player.id).join(","));
  logsUrl.searchParams.set("hydrate", `stats(group=[pitching],type=[gameLog],season=${SEASON}),currentTeam`);
  logsUrl.searchParams.set("fields", "people,id,fullName,currentTeam,stats,splits,date,stat,gamesStarted,outs,earnedRuns,team,name,abbreviation,teamCode,fileCode,shortName");
  const logsResponse = await fetch(logsUrl);
  if (!logsResponse.ok) throw new Error(`MLB API returned ${logsResponse.status}`);
  const logsData = await logsResponse.json();
  const candidateLookup = new Map(candidates.map((split) => [Number(split.player.id), split]));
  const teamTotals = new Map();
  const players = (logsData.people || []).map((person) => {
    const candidate = candidateLookup.get(Number(person.id));
    let count = 0;
    (person.stats?.[0]?.splits || []).forEach((split) => {
      if (statNumber(split.stat?.gamesStarted) < 1
        || statNumber(split.stat?.outs) < 18
        || statNumber(split.stat?.earnedRuns) > 3) return;
      count += 1;
      if (split.team?.id) {
        const current = teamTotals.get(split.team.id) || { id: split.team.id, name: split.team.name || "Team", abbreviation: teamAbbreviation(split.team), value: 0 };
        current.value += 1;
        teamTotals.set(split.team.id, current);
      }
    });
    return {
      id: person.id,
      name: person.fullName || candidate?.player?.fullName || "Player",
      abbreviation: teamAbbreviation(candidate?.team || person.currentTeam),
      value: count,
    };
  }).filter((player) => player.value > 0);
  return {
    players: players.sort((a, b) => b.value - a.value).slice(0, 5),
    teams: [...teamTotals.values()].sort((a, b) => b.value - a.value).slice(0, 5),
  };
}

async function loadLeagueLeaders() {
  const [playersResult, teamsResult, qualityStartsResult] = await Promise.allSettled([
    getPlayerLeagueLeaders(),
    getTeamLeagueLeaders(),
    getQualityStartLeaders(),
  ]);
  const players = playersResult.status === "fulfilled" ? playersResult.value : { hitting: {}, pitching: {} };
  const teams = teamsResult.status === "fulfilled" ? teamsResult.value : { hitting: {}, pitching: {} };
  players.pitching.qualityStarts = qualityStartsResult.status === "fulfilled" ? qualityStartsResult.value.players : [];
  teams.pitching.qualityStarts = qualityStartsResult.status === "fulfilled" ? qualityStartsResult.value.teams : [];
  state.leagueLeaders.players = players;
  state.leagueLeaders.teams = teams;
  state.leagueLeaders.status = "ready";
  renderLeagueLeaders();
}

function teamLogoUrl(team) {
  return team?.id ? `https://www.mlbstatic.com/team-logos/team-cap-on-light/${team.id}.svg` : "";
}

function inningStatus(linescore = {}) {
  const inning = linescore.currentInningOrdinal || ordinal(linescore.currentInning);
  if (!inning) return "In Progress";

  const stateLabel = String(linescore.inningState || "").toLowerCase();
  if (stateLabel === "middle") return `Mid ${inning}`;
  if (stateLabel === "end") return `End ${inning}`;

  const half = String(linescore.inningHalf || linescore.inningState || "").toLowerCase();
  if (half.startsWith("bot")) return `Bot ${inning}`;
  if (half.startsWith("top")) return `Top ${inning}`;
  return `${linescore.inningState || "Live"} ${inning}`.trim();
}

function gameState(game) {
  const status = game.status || {};
  const abstractState = String(status.abstractGameState || "").toLowerCase();
  const detailedState = status.detailedState || status.abstractGameState || "Scheduled";
  const normalizedDetail = String(detailedState).toLowerCase();

  if (abstractState === "final" || status.codedGameState === "F" || normalizedDetail.includes("final")) {
    return { label: "Final", tone: "final" };
  }
  if (/postponed|cancelled|canceled|suspended|delayed/.test(normalizedDetail)) {
    return { label: detailedState, tone: "delayed" };
  }
  if (abstractState === "live" || status.codedGameState === "I" || normalizedDetail.includes("progress")) {
    return { label: inningStatus(game.linescore), tone: "live" };
  }
  return { label: gameTime(game.gameDate), tone: "scheduled" };
}

function teamRow(entry = {}) {
  const team = entry.team || {};
  const abbreviation = teamAbbreviation(team);
  const row = element("div", "score-team-row");
  const logo = element("img", "score-team-logo team-logo");
  const score = entry.score;

  logo.src = teamLogoUrl(team);
  logo.alt = `${team.name || abbreviation} logo`;
  logo.width = 38;
  logo.height = 38;
  logo.loading = "lazy";
  logo.decoding = "async";
  logo.addEventListener("error", () => { logo.hidden = true; }, { once: true });

  row.append(
    logo,
    element("span", "score-team-abbreviation", abbreviation),
    element("strong", "score-team-score", score === undefined || score === null ? "-" : String(score)),
  );
  return row;
}

function scoreCard(game) {
  const away = game.teams?.away || {};
  const home = game.teams?.home || {};
  const stateInfo = gameState(game);
  const card = element("article", `score-card ${stateInfo.tone}`);
  const matchup = element("div", "score-matchup");
  const status = element("div", "score-card-status");

  matchup.append(teamRow(away), teamRow(home));
  status.append(element("strong", "score-status-label", stateInfo.label));
  card.append(matchup, status);
  card.dataset.gamePk = String(game.gamePk);
  card.setAttribute(
    "aria-label",
    `${teamAbbreviation(away.team)} ${away.score ?? "no score"}, ${teamAbbreviation(home.team)} ${home.score ?? "no score"}, ${stateInfo.label}`,
  );
  return card;
}

function updateScoreCard(card, game) {
  const away = game.teams?.away || {};
  const home = game.teams?.home || {};
  const stateInfo = gameState(game);
  const teamEntries = [away, home];

  card.className = `score-card ${stateInfo.tone}`;
  card.querySelectorAll(".score-team-row").forEach((row, index) => {
    const entry = teamEntries[index] || {};
    const abbreviation = teamAbbreviation(entry.team);
    const score = entry.score;
    const abbreviationNode = row.querySelector(".score-team-abbreviation");
    const scoreNode = row.querySelector(".score-team-score");
    if (abbreviationNode) abbreviationNode.textContent = abbreviation;
    if (scoreNode) scoreNode.textContent = score === undefined || score === null ? "-" : String(score);
  });
  const statusNode = card.querySelector(".score-status-label");
  if (statusNode) statusNode.textContent = stateInfo.label;
  card.setAttribute(
    "aria-label",
    `${teamAbbreviation(away.team)} ${away.score ?? "no score"}, ${teamAbbreviation(home.team)} ${home.score ?? "no score"}, ${stateInfo.label}`,
  );
}

function renderMessage(message, className = "scores-message") {
  els.scoreCards.replaceChildren(element("p", className, message));
}

function renderScores(games, { preserveExisting = false } = {}) {
  if (!games.length) {
    renderMessage(`No MLB games are scheduled for ${fullDateLabel(state.selectedDate)}.`);
    return;
  }

  if (preserveExisting) {
    const existingCards = [...els.scoreCards.querySelectorAll(".score-card")];
    const sameGames = existingCards.length === games.length
      && existingCards.every((card, index) => card.dataset.gamePk === String(games[index].gamePk));
    if (sameGames) {
      existingCards.forEach((card, index) => updateScoreCard(card, games[index]));
      return;
    }
  }

  const fragment = document.createDocumentFragment();
  games.forEach((game) => fragment.append(scoreCard(game)));
  els.scoreCards.replaceChildren(fragment);
}

function statNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function isFinalGame(game) {
  const abstractState = String(game.status?.abstractGameState || "").toLowerCase();
  return abstractState === "final" || game.status?.codedGameState === "F";
}

function isStartedGame(game) {
  return isFinalGame(game) || isLiveGame(game);
}

function gameScore(game) {
  const away = game.teams?.away || {};
  const home = game.teams?.home || {};
  return `${teamAbbreviation(away.team)} ${away.score ?? "-"} - ${teamAbbreviation(home.team)} ${home.score ?? "-"}`;
}

function notableTeam(boxscore, game, side) {
  return { ...(game.teams?.[side]?.team || {}), ...(boxscore.teams?.[side]?.team || {}) };
}

function playerRecords(boxscore, game) {
  return ["away", "home"].flatMap((side) => {
    const boxTeam = boxscore.teams?.[side] || {};
    const team = notableTeam(boxscore, game, side);
    return Object.values(boxTeam.players || {}).map((player) => ({ player, side, team }));
  });
}

function notableEventsFromGame({ game, boxscore, playByPlay }) {
  const events = [];
  const players = playerRecords(boxscore, game);
  const hitTypes = new Map();
  const grandSlams = new Map();
  const plays = playByPlay.allPlays || [];
  const hitEvents = new Set(["single", "double", "triple", "home_run"]);
  const addEvent = (headline, priority, key, team) => {
    events.push({ headline, priority, key, score: gameScore(game), team });
  };

  plays.forEach((play) => {
    const batterId = Number(play.matchup?.batter?.id);
    if (!Number.isFinite(batterId)) return;
    const eventType = play.result?.eventType;
    if (hitEvents.has(eventType)) {
      if (!hitTypes.has(batterId)) hitTypes.set(batterId, new Set());
      hitTypes.get(batterId).add(eventType);
    }
    if (eventType === "home_run" && statNumber(play.result?.rbi) >= 4) {
      grandSlams.set(batterId, (grandSlams.get(batterId) || 0) + 1);
    }
  });

  players.forEach(({ player, side, team }) => {
    const playerId = Number(player.person?.id);
    const name = player.person?.fullName || "A player";
    const abbreviation = teamAbbreviation(team);
    const batting = player.stats?.batting || {};
    const pitching = player.stats?.pitching || {};
    const homeRuns = statNumber(batting.homeRuns);
    const hits = statNumber(batting.hits);
    const rbi = statNumber(batting.rbi);
    const stolenBases = statNumber(batting.stolenBases);
    const slamCount = grandSlams.get(playerId) || 0;
    const cycle = hitTypes.get(playerId)?.size === hitEvents.size;

    if (cycle) {
      addEvent(`${name} hits for the cycle for ${abbreviation}`, 0, `cycle-${game.gamePk}-${playerId}`, team);
    } else if (slamCount || homeRuns >= 2) {
      let performance;
      if (slamCount >= 2) {
        performance = `hits ${slamCount} grand slams`;
      } else if (homeRuns >= 3) {
        performance = `hits ${homeRuns} home runs${slamCount ? ", including a grand slam" : ""}`;
      } else if (homeRuns === 2) {
        performance = `homers twice${slamCount ? ", including a grand slam" : ""}`;
      } else {
        performance = "hits a grand slam";
      }
      const rbiText = rbi >= 5 ? ` and drives in ${rbi}` : "";
      addEvent(`${name} ${performance}${rbiText} for ${abbreviation}`, slamCount >= 2 || homeRuns >= 3 ? 0 : 1, `power-${game.gamePk}-${playerId}`, team);
    } else if (hits >= 4) {
      const details = rbi >= 5 ? ` and drives in ${rbi}` : stolenBases >= 3 ? ` and steals ${stolenBases} bases` : "";
      addEvent(`${name} collects ${hits} hits${details} for ${abbreviation}`, hits >= 5 ? 1 : 2, `hits-${game.gamePk}-${playerId}`, team);
    } else if (rbi >= 5) {
      addEvent(`${name} drives in ${rbi} runs for ${abbreviation}`, rbi >= 6 ? 1 : 2, `rbi-${game.gamePk}-${playerId}`, team);
    } else if (stolenBases >= 3) {
      addEvent(`${name} steals ${stolenBases} bases for ${abbreviation}`, 3, `steals-${game.gamePk}-${playerId}`, team);
    }

    const innings = Number.parseFloat(pitching.inningsPitched || "0");
    const strikeouts = statNumber(pitching.strikeOuts);
    const runs = statNumber(pitching.runs);
    const hitsAllowed = statNumber(pitching.hits);
    const scheduledInnings = statNumber(game.scheduledInnings) || 9;
    const opponentSide = side === "away" ? "home" : "away";
    const opponentHits = statNumber(boxscore.teams?.[opponentSide]?.teamStats?.batting?.hits);
    const teamScore = statNumber(game.teams?.[side]?.score);
    const opponentScore = statNumber(game.teams?.[opponentSide]?.score);
    const completeNoHitter = isFinalGame(game) && teamScore > opponentScore && innings >= scheduledInnings && hitsAllowed === 0 && opponentHits === 0;

    if (completeNoHitter) {
      addEvent(`${name} throws a no-hitter for ${abbreviation}`, 0, `no-hitter-${game.gamePk}`, team);
    } else if (statNumber(pitching.completeGames) && statNumber(pitching.shutouts)) {
      const strikeoutText = strikeouts >= 10 ? ` with ${strikeouts} strikeouts` : "";
      addEvent(`${name} fires a complete-game shutout${strikeoutText} for ${abbreviation}`, 0, `pitching-${game.gamePk}-${playerId}`, team);
    } else if (strikeouts >= 10 && runs === 0 && innings >= 6) {
      addEvent(`${name} strikes out ${strikeouts} over ${innings} scoreless innings for ${abbreviation}`, 1, `pitching-${game.gamePk}-${playerId}`, team);
    } else if (strikeouts >= 10) {
      addEvent(`${name} strikes out ${strikeouts} for ${abbreviation}`, strikeouts >= 14 ? 1 : 2, `pitching-${game.gamePk}-${playerId}`, team);
    } else if (runs === 0 && innings >= 7) {
      addEvent(`${name} throws ${innings} scoreless innings for ${abbreviation}`, innings >= 8 ? 1 : 3, `pitching-${game.gamePk}-${playerId}`, team);
    }
  });

  if (isFinalGame(game)) {
    ["away", "home"].forEach((side) => {
      const opponentSide = side === "away" ? "home" : "away";
      const teamScore = statNumber(game.teams?.[side]?.score);
      const opponentScore = statNumber(game.teams?.[opponentSide]?.score);
      const opponentHits = statNumber(boxscore.teams?.[opponentSide]?.teamStats?.batting?.hits);
      const scheduledInnings = statNumber(game.scheduledInnings) || 9;
      const hasCompleteNoHitter = players.some(({ player, side: playerSide }) =>
        playerSide === side && Number.parseFloat(player.stats?.pitching?.inningsPitched || "0") >= scheduledInnings && statNumber(player.stats?.pitching?.hits) === 0,
      );
      if (teamScore > opponentScore && opponentHits === 0 && !hasCompleteNoHitter) {
        const team = notableTeam(boxscore, game, side);
        const opponent = notableTeam(boxscore, game, opponentSide);
        addEvent(`${teamAbbreviation(team)} combines to no-hit ${teamAbbreviation(opponent)}`, 0, `no-hitter-${game.gamePk}`, team);
      }
    });

    const scoringPlays = plays.filter((play) => play.about?.isScoringPlay);
    const lastScoringPlay = scoringPlays.at(-1);
    const homeScore = statNumber(game.teams?.home?.score);
    const awayScore = statNumber(game.teams?.away?.score);
    if (homeScore > awayScore && lastScoringPlay?.about?.halfInning === "bottom" && statNumber(lastScoringPlay.about.inning) >= 9) {
      const batter = lastScoringPlay.matchup?.batter?.fullName;
      const eventLabels = { single: "single", double: "double", triple: "triple", home_run: "home run", walk: "walk", sac_fly: "sacrifice fly" };
      const eventLabel = eventLabels[lastScoringPlay.result?.eventType];
      const home = teamAbbreviation(game.teams?.home?.team);
      const away = teamAbbreviation(game.teams?.away?.team);
      const headline = batter && eventLabel
        ? `${batter} delivers a walk-off ${eventLabel} for ${home}`
        : `${home} walks off ${away} in the ${ordinal(lastScoringPlay.about.inning)} inning`;
      addEvent(headline, 1, `walkoff-${game.gamePk}`, game.teams?.home?.team);
    }

    const winnerSide = statNumber(game.teams?.away?.score) > statNumber(game.teams?.home?.score) ? "away" : "home";
    const loserSide = winnerSide === "away" ? "home" : "away";
    const winnerScore = statNumber(game.teams?.[winnerSide]?.score);
    const loserScore = statNumber(game.teams?.[loserSide]?.score);
    const winner = teamAbbreviation(game.teams?.[winnerSide]?.team);
    const loser = teamAbbreviation(game.teams?.[loserSide]?.team);
    const innings = Math.max(0, ...plays.map((play) => statNumber(play.about?.inning)));
    if (winnerScore >= 15) {
      addEvent(`${winner} erupts for ${winnerScore} runs in a win over ${loser}`, 3, `team-${game.gamePk}`, game.teams?.[winnerSide]?.team);
    } else if (winnerScore - loserScore >= 10) {
      addEvent(`${winner} rolls past ${loser}, ${winnerScore}-${loserScore}`, 4, `team-${game.gamePk}`, game.teams?.[winnerSide]?.team);
    } else if (innings >= 12) {
      addEvent(`${winner} outlasts ${loser} in ${innings} innings`, 4, `team-${game.gamePk}`, game.teams?.[winnerSide]?.team);
    }
  }

  return events;
}

function uniqueNotableEvents(events) {
  const seen = new Set();
  return events.filter((event) => {
    if (seen.has(event.key)) return false;
    seen.add(event.key);
    return true;
  });
}

function notableListItem(notable) {
  const item = element("li", "notable-item");
  const logo = mediaImage(teamLogoUrl(notable.team), "notable-team-logo team-logo", `${notable.team?.name || "Team"} logo`, 32, 32);
  if (logo) item.append(logo);
  item.append(
    element("strong", "notable-headline", notable.headline),
    element("span", "notable-game", notable.score),
  );
  return item;
}

function renderNotableMessage(message, tone = "") {
  const className = `notables-message${tone ? ` ${tone}` : ""}`;
  state.notableSignature = `message:${tone}:${message}`;
  els.notableEvents.replaceChildren(element("li", className, message));
}

function renderNotableEvents(events, { preserveIfSame = false } = {}) {
  if (!events.length) {
    const message = `No games have been played yet on ${fullDateLabel(state.selectedDate)}.`;
    const signature = `message::${message}`;
    if (preserveIfSame && signature === state.notableSignature) return;
    renderNotableMessage(message);
    return;
  }
  const signature = events.map((notable) => `${notable.key}:${notable.team?.id || ""}:${notable.headline}:${notable.score}`).join("|");
  if (preserveIfSame && signature === state.notableSignature) return;
  const fragment = document.createDocumentFragment();
  events.slice(0, NOTABLE_LIMIT).forEach((notable) => fragment.append(notableListItem(notable)));
  state.notableSignature = signature;
  els.notableEvents.replaceChildren(fragment);
}

async function fetchNotableEvents(games, signal) {
  const candidates = games.filter(isStartedGame);
  const events = [];
  const results = await Promise.allSettled(candidates.map((game) => getNotableGameData(game, signal)));
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const successfulRequests = results.filter((result) => result.status === "fulfilled");
  successfulRequests.forEach((result) => events.push(...notableEventsFromGame(result.value)));

  if (candidates.length && !successfulRequests.length) throw new Error("MLB performance data is unavailable");
  return uniqueNotableEvents(events)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, NOTABLE_LIMIT);
}

async function loadNotableEvents(games, requestId, signal, { silent = false } = {}) {
  const key = dateKey(state.selectedDate);
  const cached = state.notableCache.get(key);
  const cacheDuration = cached?.hasLiveGames ? LIVE_REFRESH_MS - 1000 : NOTABLE_CACHE_MS;
  if (cached && Date.now() - cached.cachedAt < cacheDuration) {
    renderNotableEvents(cached.events, { preserveIfSame: silent });
    els.notableEvents.setAttribute("aria-busy", "false");
    return;
  }

  els.notableEvents.setAttribute("aria-busy", "true");
  if (!silent) renderNotableMessage("Finding notable performances...");

  try {
    const events = games.length ? await fetchNotableEvents(games, signal) : [];
    if (requestId !== state.requestId) return;
    state.notableCache.set(key, { events, cachedAt: Date.now(), hasLiveGames: games.some(isLiveGame) });
    renderNotableEvents(events, { preserveIfSame: silent });
  } catch (error) {
    if (error.name === "AbortError" || requestId !== state.requestId) return;
    if (!silent) renderNotableMessage("Notable performances are unavailable right now.", "error");
  } finally {
    if (requestId === state.requestId) els.notableEvents.setAttribute("aria-busy", "false");
  }
}

function isLiveGame(game) {
  return String(game.status?.abstractGameState || "").toLowerCase() === "live" || game.status?.codedGameState === "I";
}

function scheduleLiveRefresh(games) {
  clearTimeout(state.refreshTimer);
  if (!games.some(isLiveGame)) return;
  state.refreshTimer = setTimeout(() => loadScores({ silent: true }), LIVE_REFRESH_MS);
}

async function loadScores({ silent = false } = {}) {
  const requestId = ++state.requestId;
  state.abortController?.abort();
  state.abortController = new AbortController();
  clearTimeout(state.refreshTimer);

  if (!silent) {
    els.scoreCards.setAttribute("aria-busy", "true");
    renderMessage("Loading MLB scores...");
    setDataStatus("scores", "loading");
  }

  try {
    const games = await getScores(state.selectedDate, state.abortController.signal);
    if (requestId !== state.requestId) return;
    renderScores(games, { preserveExisting: silent });
    els.scoreCards.setAttribute("aria-busy", "false");
    setDataStatus("scores", "ready");
    scheduleLiveRefresh(games);
    loadNotableEvents(games, requestId, state.abortController.signal, { silent });
  } catch (error) {
    if (error.name === "AbortError" || requestId !== state.requestId) return;
    els.scoreCards.setAttribute("aria-busy", "false");
    if (!silent) {
      renderMessage("MLB scores are unavailable right now.", "scores-message error");
      els.notableEvents.setAttribute("aria-busy", "false");
      renderNotableMessage("Notable performances are unavailable right now.", "error");
    }
    setDataStatus("scores", "error");
  }
}

function selectDate(date) {
  state.selectedDate = localNoon(date);
  renderDatePicker();
  els.notableEvents.setAttribute("aria-busy", "true");
  renderNotableMessage("Finding notable performances...");
  loadScores();
}

function bindEvents() {
  els.previousDate.addEventListener("click", () => selectDate(addDays(state.selectedDate, -1)));
  els.nextDate.addEventListener("click", () => selectDate(addDays(state.selectedDate, 1)));
  els.standingsModeControls.addEventListener("click", (event) => {
    const button = event.target.closest("[data-standings-mode]");
    if (button) setStandingsMode(button.dataset.standingsMode);
  });
  els.standingsFilterControls.addEventListener("click", (event) => {
    const button = event.target.closest("[data-standings-filter]");
    if (button) setStandingsFilter(button.dataset.standingsFilter);
  });
  els.leaderboardToggle.addEventListener("click", (event) => {
    const button = event.target.closest("[data-leader-view]");
    if (button) setLeagueLeaderView(button.dataset.leaderView);
  });
}

function init() {
  bindEvents();
  renderDatePicker();
  loadScores();
  loadStandings();
  loadHotPlayers();
  loadLeagueLeaders();
}

init();
