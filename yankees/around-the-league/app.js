const MLB_API = "https://statsapi.mlb.com/api/v1";
const TEAM_ID = 147;
const AL_EAST_TEAM_IDS = new Set([110, 111, 139, 141, 147]);
const SEASON = new Date().getFullYear();
const LIVE_REFRESH_MS = 30000;
const MLB_TEAM_PRIMARY_COLORS = {
  108: "#BA0021", 109: "#A71930", 110: "#DF4601", 111: "#BD3039", 112: "#CC3433",
  113: "#C6011F", 114: "#D50032", 115: "#C4CED4", 116: "#FA4616", 117: "#EB6E1F",
  118: "#004687", 119: "#005A9C", 120: "#AB0003", 121: "#FF5910", 133: "#EFB21E",
  134: "#FDB827", 135: "#FFC425", 136: "#005C5C", 137: "#FD5A1E", 138: "#C41E3A",
  139: "#8FBCE6", 140: "#C0111F", 141: "#134A8E", 142: "#D31145", 143: "#E81828",
  144: "#CE1141", 145: "#C4CED4", 146: "#00A3E0", 147: "#C4CED3", 158: "#FFC52F",
};
const HOT_PLAYERS_CACHE_MS = 6 * 60 * 60 * 1000;
const HOT_PLAYERS_CACHE_KEY = `kryp12-hot-players-${SEASON}-v4`;
const HOT_HITTER_MIN_PA = 25;
const HOT_HITTER_MIN_GAMES = 7;
const HOT_HITTER_MIN_AT_BATS = 15;
const HOT_RELIEVER_MIN_GAMES = 5;
const PLAYER_HEADSHOT_URL = (id) => `https://img.mlbstatic.com/mlb-photos/image/upload/w_336,h_280,c_fill,g_face,q_auto:best/v1/people/${id}/headshot/silo/current`;
const HOT_HITTER_FIELDS = "stats,splits,stat,gamesPlayed,plateAppearances,atBats,avg,homeRuns,rbi,ops,player,id,fullName,team,name,abbreviation";
const HOT_PITCHER_CANDIDATE_FIELDS = "stats,splits,stat,gamesStarted,outs,inningsPitched,earnedRuns,strikeOuts,baseOnBalls,hits,era,whip,player,id,fullName,team,name,abbreviation";
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
  hotPlayers: {
    hitters: null,
    pitchers: null,
    relievers: null,
    status: "loading",
  },
  standingsRecords: [],
  liveStandingsRecords: [],
  currentScoreGames: [],
  standingsView: {
    mode: "al",
    season: SEASON,
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
  whosHot: document.querySelector("#whos-hot"),
  whosNot: document.querySelector("#whos-not"),
  standingsModeControls: document.querySelector("#standings-mode-controls"),
  standingsSeason: document.querySelector("#standings-season"),
  previousStandingsSeason: document.querySelector("#previous-standings-season"),
  nextStandingsSeason: document.querySelector("#next-standings-season"),
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

async function getStandings(season = state.standingsView.season) {
  const url = new URL(`${MLB_API}/standings`);
  url.searchParams.set("leagueId", "103,104");
  url.searchParams.set("season", season);
  url.searchParams.set("standingsTypes", "regularSeason");
  url.searchParams.set("hydrate", "team(division,league)");

  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
  return response.json();
}

function standingsRecordsFromData(data) {
  const records = [];
  (data.records || []).forEach((division) => {
    (division.teamRecords || []).forEach((record) => {
      if (!record.team?.id) return;
      const divisionName = division.division?.name || record.team.division?.name || "";
      const leagueName = division.league?.name || record.team.league?.name || "";
      const lastTen = record.records?.splitRecords?.find((split) => split.type === "lastTen");
      const home = record.records?.splitRecords?.find((split) => split.type === "home");
      const away = record.records?.splitRecords?.find((split) => split.type === "away");
      records.push({
        teamId: record.team.id,
        teamName: record.team.name || "Team",
        wins: record.leagueRecord?.wins ?? record.wins ?? "-",
        losses: record.leagueRecord?.losses ?? record.losses ?? "-",
        pct: record.leagueRecord?.pct || record.winningPercentage || "-",
        lastTen: lastTen ? `${lastTen.wins}-${lastTen.losses}` : "-",
        homeRecord: home ? `${home.wins}-${home.losses}` : "-",
        awayRecord: away ? `${away.wins}-${away.losses}` : "-",
        runsScored: record.runsScored ?? "-",
        runsAllowed: record.runsAllowed ?? "-",
        runDifferential: record.runDifferential ?? "-",
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
  return records;
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

function divisionCardCode(name) {
  const shortName = divisionShortName(name);
  return {
    "AL East": "ALE",
    "AL Central": "ALC",
    "AL West": "ALW",
    "NL East": "NLE",
    "NL Central": "NLC",
    "NL West": "NLW",
  }[shortName] || shortName;
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
  if (mode === "divisions") return record.divisionRank;
  if (mode === "mlb") return record.sportRank;
  if (mode === "al" || mode === "nl") return record.leagueRank;
  if (mode === "wild-card") return record.wildCardRank;
  return record.leagueRank;
}

function gamesBackValue(record, mode) {
  if (mode === "divisions") return record.divisionGamesBack;
  if (mode === "mlb") return record.sportGamesBack;
  if (mode === "al" || mode === "nl") return record.leagueGamesBack;
  if (mode === "wild-card") return record.wildCardGamesBack;
  return record.leagueGamesBack;
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

function filteredStandings() {
  const { mode } = state.standingsView;
  if (mode === "mlb") return sortStandings(state.standingsRecords, mode);
  if (mode === "divisions") {
    return [...state.standingsRecords].sort((a, b) => {
      const divisionDifference = divisionOrder(a.divisionName) - divisionOrder(b.divisionName);
      if (divisionDifference) return divisionDifference;
      const aRank = rankValue(a, mode);
      const bRank = rankValue(b, mode);
      if (Number.isFinite(aRank) && Number.isFinite(bRank)) return aRank - bRank;
      return standingsFallbackSort(a, b);
    });
  }
  if (mode === "al") return sortStandings(state.standingsRecords.filter((record) => record.leagueName.includes("American")), mode);
  if (mode === "nl") return sortStandings(state.standingsRecords.filter((record) => record.leagueName.includes("National")), mode);
  if (mode === "wild-card") {
    return [...state.standingsRecords]
      .filter((record) => record.divisionRank !== 1)
      .sort((a, b) => {
        const leagueDifference = leagueOrder(a.leagueName) - leagueOrder(b.leagueName);
        if (leagueDifference) return leagueDifference;
        const aRank = rankValue(a, mode);
        const bRank = rankValue(b, mode);
        if (Number.isFinite(aRank) && Number.isFinite(bRank)) return aRank - bRank;
        return standingsFallbackSort(a, b);
      });
  }
  return [];
}

function setStandingsMode(mode) {
  state.standingsView.mode = mode;
  renderStandings();
}

function renderStandingsSeason() {
  const oldestSeason = SEASON - 9;
  els.standingsSeason.textContent = String(state.standingsView.season);
  els.previousStandingsSeason.disabled = state.standingsView.season <= oldestSeason;
  els.nextStandingsSeason.disabled = state.standingsView.season >= SEASON;
}

function standingsCell(label, value, className = "") {
  const cell = element("td");
  cell.dataset.label = label;
  cell.append(element("span", className, value ?? "-"));
  return cell;
}

function signedStandingsValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value ?? "-";
  return number > 0 ? `+${number}` : String(number);
}

function renderStandingsRows() {
  const records = filteredStandings();
  els.standingsBody.replaceChildren();

  if (!records.length) {
    const row = element("tr");
    const cell = element("td", "standings-empty", "Standings unavailable");
    cell.colSpan = 14;
    row.append(cell);
    els.standingsBody.append(row);
    return;
  }

  const fragment = document.createDocumentFragment();
  let activeLeague = "";
  let activeDivision = "";
  records.forEach((record, index) => {
    if (state.standingsView.mode === "wild-card" && record.leagueName !== activeLeague) {
      activeLeague = record.leagueName;
      const leagueRow = element("tr", "standings-league-divider");
      const leagueCell = element("th", "", leagueShortName(activeLeague));
      leagueCell.colSpan = 14;
      leagueCell.scope = "rowgroup";
      leagueRow.append(leagueCell);
      fragment.append(leagueRow);
    }
    if (state.standingsView.mode === "divisions" && record.divisionName !== activeDivision) {
      activeDivision = record.divisionName;
      const divisionRow = element("tr", "standings-league-divider standings-division-divider");
      const divisionCell = element("th", "", divisionShortName(activeDivision));
      divisionCell.colSpan = 14;
      divisionCell.scope = "rowgroup";
      divisionRow.append(divisionCell);
      fragment.append(divisionRow);
    }
    const row = element("tr", "team-standing-row");
    row.style.setProperty("--standing-team-color", teamPrimaryColor({ id: record.teamId }));
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
      standingsCell("Wild Card Games Back", record.divisionRank === 1 ? "-" : record.wildCardGamesBack),
      standingsCell("Last 10", record.lastTen),
      standingsCell("Streak", streakValue(record)),
      standingsCell("Home", record.homeRecord),
      standingsCell("Away", record.awayRecord),
      standingsCell("Runs Scored", record.runsScored),
      standingsCell("Runs Against", record.runsAllowed),
      standingsCell("Run Differential", signedStandingsValue(record.runDifferential)),
    );
    fragment.append(row);
  });
  els.standingsBody.append(fragment);
}

function renderStandings() {
  els.standingsModeControls.querySelectorAll("[data-standings-mode]").forEach((button) => {
    const active = button.dataset.standingsMode === state.standingsView.mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderStandingsRows();
}

async function loadStandings() {
  setDataStatus("standings", "loading");
  try {
    const data = await getStandings(state.standingsView.season);
    state.standingsRecords = standingsRecordsFromData(data);
    if (state.standingsView.season === SEASON) {
      state.liveStandingsRecords = state.standingsRecords;
      if (state.currentScoreGames.length) renderScores(state.currentScoreGames, { preserveExisting: true });
    }
    renderStandings();
    setDataStatus("standings", "ready");
    renderWhosHot();
  } catch (error) {
    const row = element("tr");
    const cell = element("td", "standings-empty", "Could not load standings.");
    cell.colSpan = 14;
    row.append(cell);
    els.standingsBody.replaceChildren(row);
    setDataStatus("standings", "error");
    renderWhosHot();
  }
}

async function selectStandingsSeason(season) {
  const selectedSeason = Number(season);
  if (!Number.isInteger(selectedSeason) || selectedSeason < SEASON - 9 || selectedSeason > SEASON || selectedSeason === state.standingsView.season) return;
  state.standingsView.season = selectedSeason;
  renderStandingsSeason();
  await loadStandings();
}

function teamAbbreviation(team) {
  return team?.abbreviation || team?.teamCode?.toUpperCase() || team?.fileCode?.toUpperCase() || team?.shortName || "TBD";
}

function hottestTeam() {
  return state.liveStandingsRecords
    .filter((record) => record.streakType === "wins" && Number.isFinite(record.streakNumber))
    .sort((a, b) => b.streakNumber - a.streakNumber || Number(b.pct) - Number(a.pct))[0] || null;
}

function coldestTeam() {
  return state.liveStandingsRecords
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

function featuredTeamColor(featured) {
  if (!featured) return "#60798f";
  const teamId = featured.teamId || state.liveStandingsRecords.find(
    (record) => record.teamAbbreviation === featured.teamAbbreviation,
  )?.teamId;
  return teamPrimaryColor({ id: teamId });
}

function hotItem(label, name, stats, media = null, featured = null) {
  const item = element("article", "hot-item");
  item.style.setProperty("--hot-team-color", featuredTeamColor(featured));
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

  const playerName = (player) => player ? `${player.playerName} · ${player.teamAbbreviation}` : "Unavailable";
  const playerImage = (player) => player
    ? mediaImage(PLAYER_HEADSHOT_URL(player.playerId), "hot-player-headshot", `${player.playerName} headshot`, 48, 44)
    : null;
  const teamImage = (team) => team
    ? mediaImage(teamLogoUrl({ id: team.teamId }), "hot-team-logo team-logo", `${team.teamName} logo`, 44, 44)
    : null;
  const hitterStats = (player) => player
    ? `AVG ${player.avg} | ${player.homeRuns} HR | ${player.rbi} RBI | OPS ${player.ops}`
    : "15-game hitting data is unavailable";
  const pitcherStats = (player) => player
    ? `${player.era} ERA | ${player.whip} WHIP | ${player.strikeouts} K | ${player.inningsPitched} IP`
    : "Recent starting-pitching data is unavailable";
  const relieverStats = (player) => player
    ? `${player.era} ERA | ${player.whip} WHIP | ${player.strikeouts} K | ${player.saves} SV`
    : "Recent relief data is unavailable";

  els.whosHot.replaceChildren(
    hotItem("Longest Winning Streak", hotTeam?.teamName || "Unavailable", hotTeam ? `${hotTeam.streakNumber} ${hotTeam.streakNumber === 1 ? "Win" : "Wins"}` : "Winning-streak data is unavailable", teamImage(hotTeam), hotTeam),
    hotItem("Best Hitter (Last 15 games)", playerName(hitters?.best), hitterStats(hitters?.best), playerImage(hitters?.best), hitters?.best),
    hotItem("Best Pitcher (Last 5 games)", playerName(pitchers?.best), pitcherStats(pitchers?.best), playerImage(pitchers?.best), pitchers?.best),
    hotItem("Best Reliever (Last 5 games)", playerName(relievers?.best), relieverStats(relievers?.best), playerImage(relievers?.best), relievers?.best),
    hotItem("Saves Leader (Last 5 games)", playerName(relievers?.saveLeader), relievers?.saveLeader ? `${relievers.saveLeader.saves} SV | ${relievers.saveLeader.era} ERA | ${relievers.saveLeader.strikeouts} K` : "Recent saves data is unavailable", playerImage(relievers?.saveLeader), relievers?.saveLeader),
  );
  els.whosNot.replaceChildren(
    hotItem("Longest Losing Streak", coldTeam?.teamName || "Unavailable", coldTeam ? `${coldTeam.streakNumber} ${coldTeam.streakNumber === 1 ? "Loss" : "Losses"}` : "Losing-streak data is unavailable", teamImage(coldTeam), coldTeam),
    hotItem("Worst Hitter (Last 15 games)", playerName(hitters?.worst), hitterStats(hitters?.worst), playerImage(hitters?.worst), hitters?.worst),
    hotItem("Worst Pitcher (Last 5 games)", playerName(pitchers?.worst), pitcherStats(pitchers?.worst), playerImage(pitchers?.worst), pitchers?.worst),
    hotItem("Worst Reliever (Last 5 games)", playerName(relievers?.worst), relieverStats(relievers?.worst), playerImage(relievers?.worst), relievers?.worst),
    hotItem("Blown Saves Leader (Last 5 games)", playerName(relievers?.blownSaveLeader), relievers?.blownSaveLeader ? `${relievers.blownSaveLeader.blownSaves} BS | ${relievers.blownSaveLeader.era} ERA | ${relievers.blownSaveLeader.whip} WHIP` : "Recent blown-save data is unavailable", playerImage(relievers?.blownSaveLeader), relievers?.blownSaveLeader),
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
  url.searchParams.set("numGames", "15");
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
  if (!hitters.length) throw new Error("No qualified 15-game hitters found");
  return {
    best: hitterSummary(hitters[0]),
    worst: hitterSummary(hitters[hitters.length - 1]),
  };
}

async function getPitcherCandidates() {
  const url = new URL(`${MLB_API}/stats`);
  url.searchParams.set("stats", "lastXGames");
  url.searchParams.set("group", "pitching");
  url.searchParams.set("gameType", "R");
  url.searchParams.set("season", SEASON);
  url.searchParams.set("sportIds", "1");
  url.searchParams.set("playerPool", "QUALIFIED");
  url.searchParams.set("limit", "1000");
  url.searchParams.set("sortStat", "earnedRunAverage");
  url.searchParams.set("numGames", "5");
  url.searchParams.set("hydrate", "team");
  url.searchParams.set("fields", HOT_PITCHER_CANDIDATE_FIELDS);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
  const data = await response.json();
  return (data.stats?.[0]?.splits || [])
    .filter((split) => split.player?.id && statNumber(split.stat?.gamesStarted) >= 3)
    .sort((a, b) => statNumber(a.stat?.era) - statNumber(b.stat?.era));
}

function pitcherSummary(split) {
  const outs = statNumber(split.stat?.outs);
  const innings = outs / 3;
  const calculatedWhip = innings
    ? (statNumber(split.stat?.baseOnBalls) + statNumber(split.stat?.hits)) / innings
    : Number.POSITIVE_INFINITY;
  const eraValue = statNumber(split.stat?.era);
  const whipValue = split.stat?.whip ? statNumber(split.stat.whip) : calculatedWhip;
  return {
    playerId: split.player.id,
    playerName: split.player?.fullName || "Player",
    teamAbbreviation: teamAbbreviation(split.team),
    eraValue,
    whipValue,
    era: split.stat?.era || (innings ? (statNumber(split.stat?.earnedRuns) * 9 / innings).toFixed(2) : "-"),
    whip: split.stat?.whip || (Number.isFinite(calculatedWhip) ? calculatedWhip.toFixed(2) : "-"),
    strikeouts: statNumber(split.stat?.strikeOuts),
    inningsPitched: split.stat?.inningsPitched || "-",
    outs,
  };
}

async function getPitcherRankings() {
  const candidates = await getPitcherCandidates();
  const pitchers = candidates
    .filter((split) => split.player?.id
      && statNumber(split.stat?.gamesStarted) >= 3
      && statNumber(split.stat?.outs) >= 45)
    .map(pitcherSummary)
    .sort((a, b) => a.eraValue - b.eraValue
      || a.whipValue - b.whipValue
      || b.outs - a.outs
      || b.strikeouts - a.strikeouts);
  if (!pitchers.length) throw new Error("No qualified three-start pitchers found");
  return { best: pitchers[0], worst: pitchers[pitchers.length - 1] };
}

function restoreHotPlayersCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(HOT_PLAYERS_CACHE_KEY) || "null");
    if (!cached || Date.now() - cached.cachedAt > HOT_PLAYERS_CACHE_MS) return false;
    if (!cached.hitters || !cached.pitchers || !cached.relievers) return false;
    state.hotPlayers = {
      hitters: cached.hitters,
      pitchers: cached.pitchers,
      relievers: cached.relievers,
      status: "ready",
    };
    return true;
  } catch (error) {
    return false;
  }
}

function persistHotPlayersCache() {
  try {
    localStorage.setItem(HOT_PLAYERS_CACHE_KEY, JSON.stringify({
      hitters: state.hotPlayers.hitters,
      pitchers: state.hotPlayers.pitchers,
      relievers: state.hotPlayers.relievers,
      cachedAt: Date.now(),
    }));
  } catch (error) {
    // Storage can be unavailable in private browsing; live data still works.
  }
}

function recentRelieverSummary(person, candidate) {
  const appearances = (person.stats?.[0]?.splits || [])
    .filter((split) => statNumber(split.stat?.gamesStarted) === 0)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, 5);
  if (appearances.length < HOT_RELIEVER_MIN_GAMES) return null;

  const totals = appearances.reduce((sum, appearance) => {
    sum.outs += statNumber(appearance.stat?.outs);
    sum.earnedRuns += statNumber(appearance.stat?.earnedRuns);
    sum.strikeouts += statNumber(appearance.stat?.strikeOuts);
    sum.walks += statNumber(appearance.stat?.baseOnBalls);
    sum.hits += statNumber(appearance.stat?.hits);
    sum.saves += statNumber(appearance.stat?.saves);
    sum.blownSaves += statNumber(appearance.stat?.blownSaves);
    return sum;
  }, { outs: 0, earnedRuns: 0, strikeouts: 0, walks: 0, hits: 0, saves: 0, blownSaves: 0 });

  if (totals.outs < 1) return null;
  const innings = totals.outs / 3;
  const eraValue = totals.earnedRuns * 9 / innings;
  const whipValue = (totals.walks + totals.hits) / innings;
  return {
    playerId: person.id,
    playerName: person.fullName || candidate?.player?.fullName || "Player",
    teamAbbreviation: teamAbbreviation(candidate?.team || person.currentTeam),
    eraValue,
    whipValue,
    era: eraValue.toFixed(2),
    whip: whipValue.toFixed(2),
    strikeouts: totals.strikeouts,
    saves: totals.saves,
    blownSaves: totals.blownSaves,
  };
}

async function getRelieverRankings() {
  const url = new URL(`${MLB_API}/stats`);
  url.searchParams.set("stats", "season");
  url.searchParams.set("group", "pitching");
  url.searchParams.set("gameType", "R");
  url.searchParams.set("season", SEASON);
  url.searchParams.set("sportIds", "1");
  url.searchParams.set("playerPool", "ALL");
  url.searchParams.set("limit", "1000");
  url.searchParams.set("hydrate", "team");
  url.searchParams.set("fields", HOT_RELIEVER_FIELDS);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
  const data = await response.json();
  const candidates = (data.stats?.[0]?.splits || [])
    .filter((split) => split.player?.id
      && statNumber(split.stat?.gamesStarted) === 0
      && statNumber(split.stat?.gamesPlayed) >= HOT_RELIEVER_MIN_GAMES);
  if (!candidates.length) throw new Error("No qualified recent relievers found");

  const logsUrl = new URL(`${MLB_API}/people`);
  logsUrl.searchParams.set("personIds", candidates.map((split) => split.player.id).join(","));
  logsUrl.searchParams.set("hydrate", `stats(group=[pitching],type=[gameLog],season=${SEASON}),currentTeam`);
  logsUrl.searchParams.set("fields", "people,id,fullName,currentTeam,stats,splits,date,stat,gamesStarted,outs,earnedRuns,strikeOuts,baseOnBalls,hits,saves,blownSaves,team,name,abbreviation,teamCode,fileCode,shortName");
  const logsResponse = await fetch(logsUrl);
  if (!logsResponse.ok) throw new Error(`MLB API returned ${logsResponse.status}`);
  const logsData = await logsResponse.json();
  const candidateLookup = new Map(candidates.map((split) => [Number(split.player.id), split]));
  const relievers = (logsData.people || [])
    .map((person) => recentRelieverSummary(person, candidateLookup.get(Number(person.id))))
    .filter(Boolean)
    .sort((a, b) => a.eraValue - b.eraValue || a.whipValue - b.whipValue || b.strikeouts - a.strikeouts);
  if (!relievers.length) throw new Error("No qualified recent relievers found");
  const saveLeader = relievers
    .filter((reliever) => reliever.saves > 0)
    .sort((a, b) => b.saves - a.saves
      || a.eraValue - b.eraValue
      || a.whipValue - b.whipValue)[0] || null;
  const blownSaveLeader = relievers
    .filter((reliever) => reliever.blownSaves > 0)
    .sort((a, b) => b.blownSaves - a.blownSaves
      || a.eraValue - b.eraValue
      || a.whipValue - b.whipValue)[0] || null;
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
  if (state.hotPlayers.hitters && state.hotPlayers.pitchers && state.hotPlayers.relievers) {
    persistHotPlayersCache();
  }
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
  return team?.id ? `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${team.id}.svg` : "";
}

function teamPrimaryColor(team) {
  return MLB_TEAM_PRIMARY_COLORS[Number(team?.id)] || "#60798f";
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
    const outs = Number(game.linescore?.outs);
    const outLabel = Number.isFinite(outs) ? `${outs} out${outs === 1 ? "" : "s"}` : "";
    return { label: [inningStatus(game.linescore), outLabel].filter(Boolean).join(" · "), tone: "live" };
  }
  return { label: gameTime(game.gameDate), tone: "scheduled" };
}

function scoreTeamLogo(entry = {}) {
  const team = entry.team || {};
  const abbreviation = teamAbbreviation(team);
  const logo = element("img", "score-team-logo team-logo");

  logo.src = teamLogoUrl(team);
  logo.alt = `${team.name || abbreviation} logo`;
  logo.width = 38;
  logo.height = 38;
  logo.loading = "lazy";
  logo.decoding = "async";
  logo.addEventListener("error", () => { logo.hidden = true; }, { once: true });
  return logo;
}

function scoreTeamRecord(entry = {}) {
  const standing = state.liveStandingsRecords.find((record) => Number(record.teamId) === Number(entry.team?.id));
  const wins = standing?.wins ?? entry.leagueRecord?.wins;
  const losses = standing?.losses ?? entry.leagueRecord?.losses;
  const record = wins !== undefined && losses !== undefined ? `${wins}-${losses}` : "Record unavailable";
  if (!standing?.divisionRank) return record;
  return `${record}|${ordinal(standing.divisionRank)} ${divisionCardCode(standing.divisionName)}`;
}

function scoreTeamRecordNode(entry = {}) {
  const summary = element("span", "score-team-record");
  const [record, rank] = scoreTeamRecord(entry).split("|");
  summary.append(element("span", "score-record-value", record));
  if (rank) summary.append(element("i", "card-record-divider"), element("span", "score-division-rank", rank));
  return summary;
}

function populateScoreCard(card, game) {
  const away = game.teams?.away || {};
  const home = game.teams?.home || {};
  const stateInfo = gameState(game);
  const isScheduled = stateInfo.tone === "scheduled";
  const accent = element("div", "score-team-colors");
  const awayColor = element("span", "score-away-color");
  const homeColor = element("span", "score-home-color");
  const matchup = element("div", "score-matchup-row");
  const matchupCenter = element("div", "score-matchup-center");
  const records = element("div", "score-records-row");
  const status = element("div", "score-card-status");

  awayColor.style.backgroundColor = teamPrimaryColor(away.team);
  homeColor.style.backgroundColor = teamPrimaryColor(home.team);
  accent.append(awayColor, homeColor);

  matchup.append(scoreTeamLogo(away));
  if (isScheduled) {
    matchupCenter.append(element("strong", "score-versus", "vs"));
  } else {
    matchupCenter.append(
      element("strong", "score-team-score", away.score ?? "-"),
      element("span", "score-separator", "-"),
      element("strong", "score-team-score", home.score ?? "-"),
    );
  }
  matchup.append(matchupCenter, scoreTeamLogo(home));

  records.append(
    scoreTeamRecordNode(away),
    element("span", "score-record-separator", "·"),
    scoreTeamRecordNode(home),
  );
  status.append(element("strong", "score-status-label", stateInfo.label));

  card.className = `score-card ${stateInfo.tone}`;
  card.replaceChildren(accent, matchup, records, status);
  card.dataset.gamePk = String(game.gamePk);
  card.setAttribute(
    "aria-label",
    `${teamAbbreviation(away.team)} ${away.score ?? "no score"}, ${teamAbbreviation(home.team)} ${home.score ?? "no score"}, ${stateInfo.label}`,
  );
}

function scoreCard(game) {
  const card = element("article", "score-card");
  populateScoreCard(card, game);
  return card;
}

function updateScoreCard(card, game) {
  populateScoreCard(card, game);
}

function renderMessage(message, className = "scores-message") {
  els.scoreCards.replaceChildren(element("p", className, message));
}

function isAlEastGame(game) {
  const awayTeamId = Number(game.teams?.away?.team?.id);
  const homeTeamId = Number(game.teams?.home?.team?.id);
  return AL_EAST_TEAM_IDS.has(awayTeamId) || AL_EAST_TEAM_IDS.has(homeTeamId);
}

function scoreGroup(title, games, { showEmpty = false } = {}) {
  const section = element("section", "scores-group");
  const heading = element("h3", "scores-group-title", title);
  section.append(heading);

  if (!games.length && showEmpty) {
    section.append(element("p", "scores-group-empty", "No AL East games are scheduled for this date."));
    return section;
  }

  const grid = element("div", "scores-grid");
  games.forEach((game) => grid.append(scoreCard(game)));
  section.append(grid);
  return section;
}

function renderScores(games, { preserveExisting = false } = {}) {
  state.currentScoreGames = games;
  if (!games.length) {
    renderMessage(`No MLB games are scheduled for ${fullDateLabel(state.selectedDate)}.`);
    return;
  }

  if (preserveExisting) {
    const existingCards = [...els.scoreCards.querySelectorAll(".score-card")];
    const sameGames = existingCards.length === games.length
      && games.every((game) => existingCards.some((card) => card.dataset.gamePk === String(game.gamePk)));
    if (sameGames) {
      games.forEach((game) => {
        const card = existingCards.find((candidate) => candidate.dataset.gamePk === String(game.gamePk));
        if (card) updateScoreCard(card, game);
      });
      return;
    }
  }

  const alEastGames = games.filter(isAlEastGame);
  const otherGames = games.filter((game) => !isAlEastGame(game));
  const fragment = document.createDocumentFragment();
  fragment.append(scoreGroup("AL East Games", alEastGames, { showEmpty: true }));
  if (otherGames.length) fragment.append(scoreGroup("Other MLB Games", otherGames));
  els.scoreCards.replaceChildren(fragment);
}

function statNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
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
  } catch (error) {
    if (error.name === "AbortError" || requestId !== state.requestId) return;
    els.scoreCards.setAttribute("aria-busy", "false");
    if (!silent) {
      renderMessage("MLB scores are unavailable right now.", "scores-message error");
    }
    setDataStatus("scores", "error");
  }
}

function selectDate(date) {
  state.selectedDate = localNoon(date);
  renderDatePicker();
  loadScores();
}

function bindEvents() {
  els.previousDate.addEventListener("click", () => selectDate(addDays(state.selectedDate, -1)));
  els.nextDate.addEventListener("click", () => selectDate(addDays(state.selectedDate, 1)));
  els.standingsModeControls.addEventListener("click", (event) => {
    const button = event.target.closest("[data-standings-mode]");
    if (button) setStandingsMode(button.dataset.standingsMode);
  });
  els.previousStandingsSeason.addEventListener("click", () => selectStandingsSeason(state.standingsView.season - 1));
  els.nextStandingsSeason.addEventListener("click", () => selectStandingsSeason(state.standingsView.season + 1));
  els.leaderboardToggle.addEventListener("click", (event) => {
    const button = event.target.closest("[data-leader-view]");
    if (button) setLeagueLeaderView(button.dataset.leaderView);
  });
}

function init() {
  bindEvents();
  renderDatePicker();
  renderStandingsSeason();
  restoreHotPlayersCache();
  loadScores();
  loadStandings();
  loadHotPlayers();
  loadLeagueLeaders();
}

init();
