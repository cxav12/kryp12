const TEAM_ID = 147;
const MLB_API = "https://statsapi.mlb.com/api/v1";
const MLB_LIVE_API = "https://statsapi.mlb.com/api/v1.1";
const HARD_HIT_MPH = 95;
const LIVE_REFRESH_MS = 15000;

const els = {
  status: document.querySelector("#recap-status"),
  title: document.querySelector("#recap-title"),
  subtitle: document.querySelector("#recap-subtitle"),
  scoreboard: document.querySelector("#recap-scoreboard"),
  playerStats: document.querySelector("#game-player-stats"),
  recent: document.querySelector("#recent-games-grid"),
  recapButtons: document.querySelector("#recap-button-row"),
  grid: document.querySelector("#recap-grid"),
};

const state = {
  recentGames: [],
  liveGame: null,
  selectedGame: null,
  currentFeed: null,
  upcomingGames: [],
  divisionRanks: {},
  playerStatsTeam: "yankees",
  liveRefreshTimer: null,
};

async function getJson(path, params = {}) {
  const url = new URL(`${MLB_API}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
  return response.json();
}

async function getLiveJson(path) {
  const response = await fetch(`${MLB_LIVE_API}${path}`);
  if (!response.ok) throw new Error(`MLB game feed returned ${response.status}`);
  return response.json();
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateWindow(daysBack) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - daysBack);
  return { start: formatDate(start), end: formatDate(end) };
}

function todayWindow() {
  const today = formatDate(new Date());
  return { start: today, end: today };
}

function niceDate(value) {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function compactDate(value) {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    month: "numeric",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(`${value}T12:00:00`));
}

function gameTime(value) {
  if (!value) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(new Date(value));
}

function teamAbbreviation(team) {
  return team?.abbreviation || team?.teamName || team?.name || "TBD";
}

function teamLogoUrl(team) {
  const id = typeof team === "number" ? team : team?.id;
  return id ? `https://www.mlbstatic.com/team-logos/${id}.svg` : "";
}

function statValue(source, key, fallback = "-") {
  const value = source?.[key];
  return value === undefined || value === null || value === "" ? fallback : value;
}

function numberValue(source, key) {
  const value = Number(source?.[key]);
  return Number.isFinite(value) ? value : 0;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[char]));
}

function isYankeesHome(game) {
  return game.teams?.home?.team?.id === TEAM_ID;
}

function yankeesSide(game) {
  return isYankeesHome(game) ? "home" : "away";
}

function opponentSide(game) {
  return isYankeesHome(game) ? "away" : "home";
}

function teamEntry(game, side) {
  return game.teams?.[side] || {};
}

function scoreLine(game) {
  const away = game.teams?.away;
  const home = game.teams?.home;
  return `${teamAbbreviation(away?.team)} ${away?.score ?? "-"}, ${teamAbbreviation(home?.team)} ${home?.score ?? "-"}`;
}

function resultLabel(game) {
  if (isLiveGame(game)) return "In Progress";
  const yankees = game.teams?.[yankeesSide(game)]?.score;
  const opponent = game.teams?.[opponentSide(game)]?.score;
  if (!Number.isFinite(Number(yankees)) || !Number.isFinite(Number(opponent))) return "Final";
  return Number(yankees) > Number(opponent) ? "Final - Win" : "Final - Loss";
}

function resultWord(game) {
  if (isLiveGame(game)) return "In Progress";
  const yankees = game.teams?.[yankeesSide(game)]?.score;
  const opponent = game.teams?.[opponentSide(game)]?.score;
  if (!Number.isFinite(Number(yankees)) || !Number.isFinite(Number(opponent))) return "Final";
  return Number(yankees) > Number(opponent) ? "Win" : "Loss";
}

function resultShort(game) {
  const yankees = teamEntry(game, yankeesSide(game))?.score;
  const opponent = teamEntry(game, opponentSide(game))?.score;
  if (!Number.isFinite(Number(yankees)) || !Number.isFinite(Number(opponent))) return "Final";
  return Number(yankees) > Number(opponent) ? "Win" : "Loss";
}

function resultLetter(game) {
  const result = resultShort(game);
  if (result === "Win") return "W";
  if (result === "Loss") return "L";
  return result.charAt(0) || "-";
}

function resultClass(game) {
  if (isLiveGame(game)) return "in-progress";
  return resultShort(game).toLowerCase();
}

function isLiveGame(game) {
  return game?.status?.abstractGameState === "Live";
}

function ordinalInning(inning) {
  const value = Number(inning);
  if (!Number.isFinite(value) || value < 1) return "Pregame";
  const suffix = value % 100 >= 11 && value % 100 <= 13
    ? "th"
    : ["th", "st", "nd", "rd"][value % 10] || "th";
  return `${value}${suffix}`;
}

function inningLabel(feed, game) {
  if (!isLiveGame(game)) return "";
  const linescore = feed.liveData?.linescore || {};
  const inningState = linescore.inningState || game.linescore?.inningState || "";
  const inning = ordinalInning(linescore.currentInning || game.linescore?.currentInning);
  const outs = Number(linescore.outs);
  const parts = [`${inningState} ${inning}`.trim()];
  if (Number.isFinite(outs)) parts.push(`${outs} out${outs === 1 ? "" : "s"}`);
  return parts.filter(Boolean).join(" - ");
}

function lineScoreTeam(feed, side) {
  return feed.liveData?.linescore?.teams?.[side] || {};
}

function scoreForSide(game, feed, side) {
  return lineScoreTeam(feed, side)?.runs ?? teamEntry(game, side).score ?? "-";
}

async function getTodaysLiveGame() {
  const { start, end } = todayWindow();
  const schedule = await getJson("/schedule", {
    sportId: 1,
    teamId: TEAM_ID,
    startDate: start,
    endDate: end,
    hydrate: "team,venue,linescore",
  });

  return (schedule.dates || [])
    .flatMap((dateEntry) => dateEntry.games || [])
    .find((game) => isLiveGame(game)) || null;
}

function decisionPitchingStats(player, feed) {
  if (!player?.id) return {};
  const playerKey = `ID${player.id}`;
  const boxscoreTeams = feed?.liveData?.boxscore?.teams || {};
  return boxscoreTeams.away?.players?.[playerKey]?.seasonStats?.pitching
    || boxscoreTeams.home?.players?.[playerKey]?.seasonStats?.pitching
    || player.stats?.pitching
    || player.stats?.statsSingleSeason?.pitching
    || {};
}

function formatDecisionPitcher(player, feed, fallback = "None") {
  if (!player) return fallback;
  const name = player.initLastName || player.lastName || player.fullName || fallback;
  const stats = decisionPitchingStats(player, feed);
  const wins = stats.wins;
  const losses = stats.losses;
  const era = stats.era;
  const record = wins !== undefined && losses !== undefined && era !== undefined
    ? ` (${wins}-${losses}, ${era} ERA)`
    : "";
  return `${name}${record}`;
}

function renderLinescore(feed, game) {
  const linescore = feed.liveData?.linescore || {};
  const innings = linescore.innings || [];
  const inningNumbers = innings.map((inning) => inning.num);
  const minimumInnings = isLiveGame(game) ? Math.max(9, ...inningNumbers, 0) : Math.max(...inningNumbers, 9);
  const displayedInnings = Array.from({ length: minimumInnings }, (_, index) => index + 1);
  const inningMap = new Map(innings.map((inning) => [inning.num, inning]));
  const teams = [
    ["away", game.teams?.away?.team],
    ["home", game.teams?.home?.team],
  ];
  const head = displayedInnings.map((inning) => `<th scope="col">${inning}</th>`).join("");
  const body = teams.map(([side, team]) => {
    const inningCells = displayedInnings.map((inning) => {
      const runs = inningMap.get(inning)?.[side]?.runs;
      return `<td>${escapeHtml(runs ?? "-")}</td>`;
    }).join("");
    const totals = linescore.teams?.[side] || {};
    return `
      <tr>
        <th scope="row">${escapeHtml(teamAbbreviation(team))}</th>
        ${inningCells}
        <td class="line-total">${escapeHtml(totals.runs ?? scoreForSide(game, feed, side))}</td>
        <td>${escapeHtml(totals.hits ?? "-")}</td>
        <td>${escapeHtml(totals.errors ?? "-")}</td>
      </tr>
    `;
  }).join("");
  return `
    <div class="linescore-scroll">
      <table class="linescore-table" aria-label="Inning-by-inning box score">
        <thead>
          <tr><th scope="col"><span class="visually-hidden">Team</span></th>${head}<th scope="col">R</th><th scope="col">H</th><th scope="col">E</th></tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function boxscorePlayer(feed, playerId) {
  if (!playerId) return {};
  const key = `ID${playerId}`;
  const teams = feed.liveData?.boxscore?.teams || {};
  return teams.away?.players?.[key] || teams.home?.players?.[key] || {};
}

function playerHeadshotUrl(playerId) {
  return playerId
    ? `https://img.mlbstatic.com/mlb-photos/image/upload/w_96,q_auto:best/v1/people/${playerId}/headshot/silo/current`
    : "";
}

function matchupStatLine(player, role) {
  if (role === "pitcher") {
    const stats = player.stats?.pitching || {};
    return `${stats.inningsPitched || "0.0"} IP, ${stats.hits || 0} H, ${stats.earnedRuns || 0} ER, ${stats.strikeOuts || 0} K`;
  }
  const stats = player.stats?.batting || {};
  return `${stats.hits || 0}-${stats.atBats || 0}, ${stats.homeRuns || 0} HR, ${stats.rbi || 0} RBI`;
}

function renderMatchupPlayer(feed, person, role, hand) {
  const player = boxscorePlayer(feed, person?.id);
  const name = person?.fullName || player.person?.fullName || "TBD";
  const image = playerHeadshotUrl(person?.id);
  return `
    <div class="matchup-player ${role}">
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" />` : ""}
      <div class="matchup-player-copy">
        <strong>${escapeHtml(name)}</strong>
        <span>${escapeHtml(hand || "")}</span>
        <small>${escapeHtml(matchupStatLine(player, role))}</small>
      </div>
    </div>
  `;
}

function renderBaseDiamond(linescore) {
  const offense = linescore.offense || {};
  const outs = Math.max(0, Math.min(3, Number(linescore.outs) || 0));
  return `
    <div class="matchup-state" aria-label="${escapeHtml(outs)} outs">
      <div class="base-diamond" aria-label="Current base runners">
        <span class="base second${offense.second ? " occupied" : ""}" aria-label="Second base${offense.second ? " occupied" : " empty"}"></span>
        <span class="base third${offense.third ? " occupied" : ""}" aria-label="Third base${offense.third ? " occupied" : " empty"}"></span>
        <span class="base first${offense.first ? " occupied" : ""}" aria-label="First base${offense.first ? " occupied" : " empty"}"></span>
      </div>
      <strong>${escapeHtml(linescore.teams?.away?.runs ?? 0)} - ${escapeHtml(linescore.teams?.home?.runs ?? 0)}</strong>
      <div class="out-lights" aria-hidden="true">
        ${[0, 1, 2].map((index) => `<span class="${index < outs ? "active" : ""}"></span>`).join("")}
      </div>
    </div>
  `;
}

function scoringPlayRows(feed, game) {
  const plays = feed.liveData?.plays || {};
  const scoring = (plays.scoringPlays || []).map((index) => plays.allPlays?.[index]).filter(Boolean).reverse();
  if (!scoring.length) return `<p class="scoring-play-empty">No scoring plays yet.</p>`;
  return scoring.map((play) => {
    const half = play.about?.halfInning === "bottom" ? "Bot" : "Top";
    const side = play.about?.halfInning === "bottom" ? "home" : "away";
    const team = game.teams?.[side]?.team || feed.gameData?.teams?.[side] || {};
    const inning = ordinalInning(play.about?.inning);
    const result = play.result || {};
    const description = String(result.description || "").replace(/^.*?challenged.*?:\s*/i, "");
    const scoringDetails = description
      .split(/\.\s+/)
      .map((sentence) => sentence.trim().replace(/[.]+$/, ""))
      .filter((sentence) => /\b(scores?|homers?|home run|grand slam)\b/i.test(sentence))
      .slice(0, 2)
      .join(". ");
    const conciseDescription = [result.event, scoringDetails || description.split(".")[0]]
      .filter(Boolean)
      .filter((value, index, values) => index === 0 || value.toLowerCase() !== values[0].toLowerCase())
      .join(" — ");
    return `
      <article class="scoring-play">
        <strong class="scoring-play-inning">${escapeHtml(`${half} ${inning}`)}</strong>
        <span class="scoring-play-separator" aria-hidden="true">|</span>
        <strong class="scoring-play-team">${escapeHtml(teamAbbreviation(team))}</strong>
        <p>${escapeHtml(conciseDescription || "Scoring play")}</p>
        <strong class="scoring-play-score">${escapeHtml(`${result.awayScore ?? "-"}-${result.homeScore ?? "-"}`)}</strong>
      </article>
    `;
  }).join("");
}

function renderScoringPlays(feed, game) {
  return scoringPlayRows(feed, game);
}

function playerStatSummary(teamBox, statKey) {
  return Object.values(teamBox.players || {})
    .map((player) => ({
      name: player.person?.fullName || "Player",
      value: Number(player.stats?.batting?.[statKey] || 0),
    }))
    .filter((entry) => entry.value > 0)
    .map((entry) => `${entry.name} (${entry.value})`)
    .join(", ") || "None";
}

function renderGameNotes(feed, game) {
  const side = yankeesSide(game);
  const teamBox = feed.liveData?.boxscore?.teams?.[side] || {};
  const officialGroups = (teamBox.info || []).filter((group) =>
    ["batting", "baserunning", "fielding"].includes(String(group.title || "").toLowerCase())
  );
  const batting = teamBox.teamStats?.batting || {};
  const fielding = teamBox.teamStats?.fielding || {};
  const lineTeam = feed.liveData?.linescore?.teams?.[side] || {};
  const stat = (key, fallback = 0) => statValue(batting, key, fallback);
  const detailRow = (label, value) => `<p><strong>${escapeHtml(label)}</strong> ${escapeHtml(value)}</p>`;

  if (officialGroups.length) {
    return `
      <aside class="game-notes-panel" aria-label="Yankees game notes">
        <h3>NYY Game Notes</h3>
        <div class="game-notes-groups">
          ${officialGroups.map((group) => `
            <section>
              <h4>${escapeHtml(group.title)}</h4>
              ${(group.fieldList || []).map((field) => detailRow(field.label, field.value)).join("")}
            </section>
          `).join("")}
        </div>
      </aside>
    `;
  }

  return `
    <aside class="game-notes-panel" aria-label="Yankees game notes">
      <h3>NYY Game Notes</h3>
      <div class="game-notes-groups">
        <section>
          <h4>Batting</h4>
          ${detailRow("2B", playerStatSummary(teamBox, "doubles"))}
          ${detailRow("3B", playerStatSummary(teamBox, "triples"))}
          ${detailRow("HR", playerStatSummary(teamBox, "homeRuns"))}
          ${detailRow("RBI", playerStatSummary(teamBox, "rbi"))}
          ${detailRow("Team RISP", `${stat("hitsRisp")}-${stat("atBatsRisp")}`)}
          ${detailRow("Team LOB", lineTeam.leftOnBase ?? stat("leftOnBase"))}
        </section>
        <section>
          <h4>Baserunning</h4>
          ${detailRow("SB", playerStatSummary(teamBox, "stolenBases"))}
          ${detailRow("CS", playerStatSummary(teamBox, "caughtStealing"))}
        </section>
        <section>
          <h4>Fielding</h4>
          ${detailRow("DP", statValue(fielding, "doublePlays", stat("groundIntoDoublePlay")))}
        </section>
      </div>
    </aside>
  `;
}

function renderGameSituation(feed, game) {
  return `
    <section class="game-situation" aria-label="Scoring plays">
      <div class="scoring-plays-panel">
        <h3>Scoring Plays</h3>
        <div class="scoring-plays-list">${renderScoringPlays(feed, game)}</div>
      </div>
      ${renderGameNotes(feed, game)}
    </section>
  `;
}

function renderCurrentMatchup(feed, matchup, linescore = feed.liveData?.linescore || {}) {
  return `
    <div class="current-matchup-grid">
      ${renderMatchupPlayer(feed, matchup.pitcher, "pitcher", matchup.pitchHand?.code ? `${matchup.pitchHand.code}HP` : "")}
      ${renderBaseDiamond(linescore)}
      ${renderMatchupPlayer(feed, matchup.batter, "batter", matchup.batSide?.code ? `${matchup.batSide.code}HB` : "")}
    </div>
  `;
}

function shortDivisionName(name) {
  return String(name || "")
    .replace("American League", "AL")
    .replace("National League", "NL");
}

function ordinal(value) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return "";
  const remainder100 = number % 100;
  const suffix = remainder100 >= 11 && remainder100 <= 13
    ? "th"
    : ({ 1: "st", 2: "nd", 3: "rd" }[number % 10] || "th");
  return `${number}${suffix}`;
}

async function loadDivisionRanks() {
  const data = await getJson("/standings", {
    leagueId: "103,104",
    season: new Date().getFullYear(),
    standingsTypes: "regularSeason",
    hydrate: "team,division",
  });
  state.divisionRanks = Object.fromEntries(
    (data.records || []).flatMap((record) => (record.teamRecords || []).map((teamRecord) => [
      Number(teamRecord.team?.id),
      teamRecord.divisionRank,
    ])),
  );
}

function gameTeamRecord(game, feed, side) {
  const record = game.teams?.[side]?.leagueRecord || feed.gameData?.teams?.[side]?.record || {};
  return record.wins !== undefined && record.losses !== undefined ? `${record.wins}-${record.losses}` : "";
}

function scoreboardState(feed, game) {
  if (isLiveGame(game)) return "Live";
  if (game.status?.abstractGameState === "Final") {
    const innings = feed.liveData?.linescore?.innings?.length || 9;
    return innings > 9 ? `Final/${innings}` : "Final";
  }
  return game.status?.detailedState || "Scheduled";
}

function renderScoreboardTeam(game, feed, side) {
  const entry = game.teams?.[side] || {};
  const team = entry.team || feed.gameData?.teams?.[side] || {};
  const name = team.teamName || team.name || teamAbbreviation(team);
  const record = gameTeamRecord(game, feed, side);
  const division = shortDivisionName(team.division?.name || feed.gameData?.teams?.[side]?.division?.name);
  const divisionPosition = ordinal(state.divisionRanks[Number(team.id)]);
  const divisionLabel = [divisionPosition, division].filter(Boolean).join(" ");
  const details = `
    <span class="scoreboard-team-copy">
      <strong>${escapeHtml(name)}</strong>
      ${record ? `<small>${escapeHtml(record)}</small>` : ""}
      ${divisionLabel ? `<small>${escapeHtml(divisionLabel)}</small>` : ""}
    </span>
  `;
  const logo = `<img src="${escapeHtml(teamLogoUrl(team))}" alt="${escapeHtml(name)} logo" />`;
  return `
    <div class="scoreboard-team ${side}${Number(team.id) === TEAM_ID ? " is-yankees" : ""}">
      ${side === "away" ? `${details}${logo}` : `${logo}${details}`}
      <strong class="scoreboard-mobile-score">${escapeHtml(scoreForSide(game, feed, side))}</strong>
    </div>
  `;
}

function renderGameStatTable(headers, rows, emptyMessage) {
  if (!rows.length) return `<p class="game-player-empty">${escapeHtml(emptyMessage)}</p>`;
  return `
    <div class="game-player-table-scroll">
      <table class="game-player-table">
        <thead><tr>${headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    </div>
  `;
}

function renderGamePlayerStats(feed, yankeesTeamSide, game) {
  const selectedSide = state.playerStatsTeam === "opponent"
    ? (yankeesTeamSide === "home" ? "away" : "home")
    : yankeesTeamSide;
  const selectedTeam = game.teams?.[selectedSide]?.team || feed.gameData?.teams?.[selectedSide];
  const selectedTeamName = selectedTeam?.teamName || selectedTeam?.name || teamAbbreviation(selectedTeam);
  const opponentSideValue = yankeesTeamSide === "home" ? "away" : "home";
  const opponentTeam = game.teams?.[opponentSideValue]?.team || feed.gameData?.teams?.[opponentSideValue];
  const opponentName = opponentTeam?.teamName || opponentTeam?.name || "Opponent";
  const teamBox = feed.liveData?.boxscore?.teams?.[selectedSide] || {};
  const players = teamBox.players || {};
  const battingHeaders = ["Player", "AB", "R", "H", "2B", "3B", "HR", "RBI", "BB", "SO", "AVG"];
  const pitchingHeaders = ["Player", "IP", "H", "R", "ER", "BB", "SO", "HR", "P", "ERA"];
  const battingRows = (teamBox.batters || []).map((playerId) => players[`ID${playerId}`]).filter((player) => {
    const stats = player?.stats?.batting || {};
    return player?.person && (Number(stats.plateAppearances || 0) > 0 || Number(stats.atBats || 0) > 0);
  }).map((player) => {
    const stats = player.stats.batting || {};
    const seasonAverage = player.seasonStats?.batting?.avg || "-";
    const values = [stats.atBats, stats.runs, stats.hits, stats.doubles, stats.triples, stats.homeRuns, stats.rbi, stats.baseOnBalls, stats.strikeOuts, seasonAverage];
    const battingOrder = String(player.battingOrder || "");
    const isSubstitute = battingOrder.length >= 3 && Number.parseInt(battingOrder.slice(-2), 10) > 0;
    return `
      <tr class="${isSubstitute ? "is-substitute" : ""}">
        <th scope="row"><a href="./player-spotlight/?player=${escapeHtml(player.person.id)}">${escapeHtml(player.person.fullName)}</a><small>${escapeHtml(player.position?.abbreviation || "")}</small></th>
        ${values.map((value, index) => `<td data-label="${escapeHtml(battingHeaders[index + 1])}">${escapeHtml(value ?? 0)}</td>`).join("")}
      </tr>
    `;
  });
  const pitchingRows = (teamBox.pitchers || []).map((playerId) => players[`ID${playerId}`]).filter((player) => player?.person && player.stats?.pitching).map((player) => {
    const stats = player.stats.pitching || {};
    const seasonEra = player.seasonStats?.pitching?.era || "-";
    const values = [stats.inningsPitched, stats.hits, stats.runs, stats.earnedRuns, stats.baseOnBalls, stats.strikeOuts, stats.homeRuns, stats.numberOfPitches ?? stats.pitchesThrown, seasonEra];
    return `
      <tr>
        <th scope="row"><a href="./player-spotlight/?player=${escapeHtml(player.person.id)}">${escapeHtml(player.person.fullName)}</a></th>
        ${values.map((value, index) => `<td data-label="${escapeHtml(pitchingHeaders[index + 1])}">${escapeHtml(value ?? 0)}</td>`).join("")}
      </tr>
    `;
  });

  els.playerStats.innerHTML = `
    <div class="game-player-team-switcher" role="group" aria-label="Team player statistics">
      <button class="game-player-team-button${state.playerStatsTeam === "yankees" ? " active" : ""}" type="button" data-player-stats-team="yankees" aria-pressed="${state.playerStatsTeam === "yankees"}">Yankees</button>
      <button class="game-player-team-button${state.playerStatsTeam === "opponent" ? " active" : ""}" type="button" data-player-stats-team="opponent" aria-pressed="${state.playerStatsTeam === "opponent"}">${escapeHtml(opponentName)}</button>
    </div>
    <article class="game-player-column">
      <h3>${escapeHtml(selectedTeamName)} Batting</h3>
      ${renderGameStatTable(battingHeaders, battingRows, `No ${selectedTeamName} batting statistics are available yet.`)}
    </article>
    <article class="game-player-column">
      <h3>${escapeHtml(selectedTeamName)} Pitching</h3>
      ${renderGameStatTable(pitchingHeaders, pitchingRows, `No ${selectedTeamName} pitching statistics are available yet.`)}
    </article>
  `;
  els.playerStats.setAttribute("aria-label", `${selectedTeamName} player statistics for this game`);
}

async function getRecentFinalGames() {
  for (const daysBack of [21, 45, 90]) {
    const { start, end } = dateWindow(daysBack);
    const schedule = await getJson("/schedule", {
      sportId: 1,
      teamId: TEAM_ID,
      startDate: start,
      endDate: end,
      hydrate: "team,venue,linescore",
    });
    const games = (schedule.dates || [])
      .flatMap((dateEntry) => dateEntry.games || [])
      .filter((game) => game.status?.abstractGameState === "Final")
      .sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate));

    if (games.length >= 5 || daysBack === 90) return games;
  }

  throw new Error("No completed Yankees games found.");
}

async function getUpcomingGames() {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 45);
  const schedule = await getJson("/schedule", {
    sportId: 1,
    teamId: TEAM_ID,
    startDate: formatDate(start),
    endDate: formatDate(end),
    hydrate: "team,venue",
  });

  return (schedule.dates || [])
    .flatMap((dateEntry) => dateEntry.games || [])
    .filter((game) => !["Final", "Live"].includes(game.status?.abstractGameState))
    .sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate))
    .slice(0, 3);
}

function battedBallCategory(play) {
  const events = (play.playEvents || []).slice().reverse();
  const hitEvent = events.find((event) => event.hitData || event.details?.isInPlay);
  const angle = Number(hitEvent?.hitData?.launchAngle);

  if (Number.isFinite(angle)) {
    if (angle < 10) return "ground";
    if (angle < 25) return "line";
    if (angle < 50) return "fly";
    return "popup";
  }

  const text = `${play.result?.eventType || ""} ${play.result?.event || ""}`.toLowerCase();
  if (text.includes("ground")) return "ground";
  if (text.includes("line")) return "line";
  if (text.includes("fly")) return "fly";
  if (text.includes("pop")) return "popup";
  return "";
}

function collectGameMetrics(feed, side) {
  const allPlays = feed.liveData?.plays?.allPlays || [];
  const battingHalf = side === "home" ? "bottom" : "top";
  const pitchingHalf = side === "home" ? "top" : "bottom";
  const battedBalls = {
    ground: 0,
    line: 0,
    fly: 0,
    popup: 0,
    total: 0,
  };
  const exitVelos = [];
  let maxExit = null;
  let maxPitch = null;

  allPlays.forEach((play) => {
    if (play.about?.halfInning === battingHalf) {
      const category = battedBallCategory(play);
      const hitEvent = (play.playEvents || []).slice().reverse().find((event) => event.hitData?.launchSpeed);
      const exitVelo = Number(hitEvent?.hitData?.launchSpeed);

      if (category) {
        battedBalls[category] += 1;
        battedBalls.total += 1;
      }

      if (Number.isFinite(exitVelo)) {
        const distance = Number(hitEvent?.hitData?.totalDistance);
        const entry = {
          value: exitVelo,
          player: play.matchup?.batter?.fullName || "Batter",
          detail: Number.isFinite(distance) ? `${Math.round(distance)} ft` : "Batted ball",
        };
        exitVelos.push(exitVelo);
        if (!maxExit || exitVelo > maxExit.value) maxExit = entry;
      }
    }

    if (play.about?.halfInning === pitchingHalf) {
      (play.playEvents || []).forEach((event) => {
        const speed = Number(event.pitchData?.startSpeed);
        if (!Number.isFinite(speed)) return;
        const entry = {
          value: speed,
          player: play.matchup?.pitcher?.fullName || "Pitcher",
          detail: event.details?.type?.description || event.details?.type?.code || "Pitch",
        };
        if (!maxPitch || speed > maxPitch.value) maxPitch = entry;
      });
    }
  });

  const avgExit = exitVelos.length
    ? exitVelos.reduce((sum, value) => sum + value, 0) / exitVelos.length
    : null;
  const hardHitCount = exitVelos.filter((value) => value >= HARD_HIT_MPH).length;

  return {
    battedBalls,
    maxExit,
    avgExit,
    hardHitCount,
    trackedBattedBalls: exitVelos.length,
    maxPitch,
  };
}

function statRow(label, value) {
  return `
    <div class="recap-row">
      <span>${escapeHtml(label)}</span>
      <strong class="stat-number">${escapeHtml(value)}</strong>
    </div>
  `;
}

function barRow(label, count, total, tone) {
  const percentage = total ? Math.round((count / total) * 100) : 0;
  return `
    <div class="bar-stat">
      <div class="bar-stat-heading">
        <span>${escapeHtml(label)}</span>
        <strong class="stat-number">${escapeHtml(count)}</strong>
      </div>
      <div class="bar-track" aria-hidden="true">
        <span class="bar-fill ${tone}" style="width: ${percentage}%">${percentage ? `${percentage}%` : ""}</span>
      </div>
    </div>
  `;
}

function metricFeature(label, value, unit, detail) {
  return `
    <div class="metric-feature">
      <span>${escapeHtml(label)}</span>
      <strong class="stat-number">${escapeHtml(value)}${unit ? ` <small>${escapeHtml(unit)}</small>` : ""}</strong>
      <em>${escapeHtml(detail)}</em>
    </div>
  `;
}

function renderRecapColumn(title, body) {
  return `
    <article class="recap-column">
      <h3>${escapeHtml(title)}</h3>
      <div class="recap-divider"></div>
      ${body}
    </article>
  `;
}

function renderRecentGames(games, selectedGamePk, { includeLatest = false } = {}) {
  const previousGames = includeLatest ? games.slice(0, 4) : games.slice(1, 5);

  if (!previousGames.length) {
    els.recent.innerHTML = `<button class="recent-game-button" type="button" disabled>No previous games found.</button>`;
    return;
  }

  els.recent.innerHTML = previousGames.map((game) => {
    const yankees = teamEntry(game, yankeesSide(game));
    const opponentEntry = teamEntry(game, opponentSide(game));
    const opponent = opponentEntry.team;
    const isSelected = Number(game.gamePk) === Number(selectedGamePk);
    return `
      <button class="recent-game-button${isSelected ? " active" : ""}" type="button" data-game-pk="${escapeHtml(game.gamePk)}">
        <span class="recent-game-date">${escapeHtml(niceDate(game.officialDate))}</span>
        <span class="recent-game-matchup">
          <img src="${escapeHtml(teamLogoUrl(yankees.team))}" alt="${escapeHtml(teamAbbreviation(yankees.team))} logo" />
          <strong>NYY ${escapeHtml(yankees.score ?? "-")}</strong>
          <i aria-hidden="true">-</i>
          <strong>${escapeHtml(opponentEntry.score ?? "-")} ${escapeHtml(teamAbbreviation(opponent))}</strong>
          <img src="${escapeHtml(teamLogoUrl(opponent))}" alt="${escapeHtml(teamAbbreviation(opponent))} logo" />
        </span>
        <span class="recent-game-result ${resultClass(game)}">${escapeHtml(resultShort(game))}</span>
      </button>
    `;
  }).join("");
}

function renderRecapButtons(games, selectedGamePk) {
  const recentGames = games.slice(0, 3);
  const upcomingGames = state.upcomingGames.slice(0, 3);

  if (!recentGames.length && !upcomingGames.length) {
    els.recapButtons.innerHTML = `<button class="recap-selector-button" type="button" disabled>No games found.</button>`;
    return;
  }

  const completedButtons = recentGames.map((game) => {
    const yankees = teamEntry(game, yankeesSide(game));
    const opponentEntry = teamEntry(game, opponentSide(game));
    const opponent = opponentEntry.team;
    const result = resultShort(game);
    const tone = result.toLowerCase();
    const isSelected = Number(game.gamePk) === Number(selectedGamePk);
    const location = isYankeesHome(game) ? teamAbbreviation(opponent) : `@${teamAbbreviation(opponent)}`;

    return `
      <button class="recap-selector-button ${tone}${isSelected ? " active" : ""}" type="button" data-game-pk="${escapeHtml(game.gamePk)}">
        <span class="selector-date">${escapeHtml(compactDate(game.officialDate))}</span>
        <span class="selector-result">${escapeHtml(resultLetter(game))}</span>
        <span class="selector-score">${escapeHtml(yankees.score ?? "-")}-${escapeHtml(opponentEntry.score ?? "-")} ${escapeHtml(location)}</span>
      </button>
    `;
  }).join("");

  const upcomingItems = [...upcomingGames].reverse().map((game) => {
    const opponent = teamEntry(game, opponentSide(game)).team;
    const matchup = isYankeesHome(game) ? `vs ${teamAbbreviation(opponent)}` : `@${teamAbbreviation(opponent)}`;
    return `
      <div class="recap-selector-button upcoming" aria-label="Upcoming game ${escapeHtml(compactDate(game.officialDate))} ${escapeHtml(matchup)} at ${escapeHtml(gameTime(game.gameDate))}">
        <span class="selector-date">${escapeHtml(compactDate(game.officialDate))}</span>
        <span class="selector-score">${escapeHtml(matchup)}</span>
        <span class="selector-time">${escapeHtml(gameTime(game.gameDate))}</span>
      </div>
    `;
  }).join("");

  els.recapButtons.innerHTML = upcomingItems + completedButtons;
}

function renderRecap(game, feed) {
  if (feed.gameData?.status) game.status = feed.gameData.status;
  state.currentFeed = feed;
  const side = yankeesSide(game);
  const summarySide = state.playerStatsTeam === "opponent" ? opponentSide(game) : side;
  const summaryTeam = game.teams?.[summarySide]?.team || feed.gameData?.teams?.[summarySide];
  const summaryTeamLabel = teamAbbreviation(summaryTeam) || (summarySide === side ? "NYY" : "Opponent");
  const yankees = teamEntry(game, yankeesSide(game));
  const opponentEntry = teamEntry(game, opponentSide(game));
  const opponent = game.teams?.[opponentSide(game)]?.team;
  const teamStats = feed.liveData?.boxscore?.teams?.[summarySide]?.teamStats || {};
  const batting = teamStats.batting || {};
  const pitching = teamStats.pitching || {};
  const lineTeam = feed.liveData?.linescore?.teams?.[summarySide] || {};
  const decisions = feed.liveData?.decisions || {};
  const metrics = collectGameMetrics(feed, summarySide);
  const batted = metrics.battedBalls;
  const yankeesScore = scoreForSide(game, feed, yankeesSide(game));
  const opponentScore = scoreForSide(game, feed, opponentSide(game));
  const opponentAbbr = teamAbbreviation(opponent);
  const gameResult = resultWord(game);
  const gameResultClass = resultClass(game);
  const liveLabel = inningLabel(feed, game);
  const livePlays = feed.liveData?.plays || {};
  const liveCurrentPlay = livePlays.currentPlay || livePlays.allPlays?.[livePlays.allPlays.length - 1] || {};
  const strikePercentage = numberValue(pitching, "numberOfPitches")
    ? Math.round((numberValue(pitching, "strikes") / numberValue(pitching, "numberOfPitches")) * 100)
    : 0;
  const avgExit = metrics.avgExit === null ? "-" : metrics.avgExit.toFixed(1);
  const hardHitPct = metrics.trackedBattedBalls
    ? ((metrics.hardHitCount / metrics.trackedBattedBalls) * 100).toFixed(1)
    : "-";

  els.status.textContent = isLiveGame(game) ? "Live game updating" : "Latest final loaded";
  els.status.style.color = isLiveGame(game) ? "#f6d365" : "#9af0c8";
  els.title.textContent = `${resultLabel(game)} vs ${teamAbbreviation(opponent)}`;
  els.subtitle.textContent = `${niceDate(game.officialDate)} - ${game.venue?.name || "Ballpark"} - ${scoreLine(game)}`;
  els.scoreboard.innerHTML = `
    ${isLiveGame(game) ? `
      <div class="game-live-status-row">
        <span><strong>Live:</strong> ${escapeHtml(game.status?.detailedState || "In Progress")}</span>
        <i aria-hidden="true">|</i>
        <span><strong>Inning:</strong> ${escapeHtml(liveLabel || "In Progress")}</span>
      </div>
    ` : ""}
    <div class="game-scoreboard-top ${gameResultClass}">
      ${renderScoreboardTeam(game, feed, "away")}
      <strong class="scoreboard-score">${escapeHtml(scoreForSide(game, feed, "away"))}</strong>
      <div class="scoreboard-state">${escapeHtml(scoreboardState(feed, game))}</div>
      <strong class="scoreboard-score">${escapeHtml(scoreForSide(game, feed, "home"))}</strong>
      ${renderScoreboardTeam(game, feed, "home")}
    </div>
    <div class="game-scoreboard-lower">
      <div class="game-linescore-box">${renderLinescore(feed, game)}</div>
      <div class="game-decisions${isLiveGame(game) ? " live-matchup-slot" : ""}">
        ${isLiveGame(game) ? `
          ${renderCurrentMatchup(feed, liveCurrentPlay.matchup || {})}
        ` : `
          <p><span class="win-label">W:</span> ${escapeHtml(formatDecisionPitcher(decisions.winner, feed))}</p>
          <p><span class="loss-label">L:</span> ${escapeHtml(formatDecisionPitcher(decisions.loser, feed))}</p>
          <p><span class="save-label">SV:</span> ${escapeHtml(formatDecisionPitcher(decisions.save, feed))}</p>
        `}
      </div>
    </div>
    ${renderGameSituation(feed, game)}
  `;
  renderGamePlayerStats(feed, side, game);

  els.grid.innerHTML = [
    renderRecapColumn(`${summaryTeamLabel} Hitting`, [
      statRow("Hits", statValue(batting, "hits")),
      statRow("Doubles", statValue(batting, "doubles")),
      statRow("Triples", statValue(batting, "triples")),
      statRow("Home Runs", statValue(batting, "homeRuns")),
      statRow("Walks", statValue(batting, "baseOnBalls")),
      statRow("Strikeouts", statValue(batting, "strikeOuts")),
      statRow("Team LOB", statValue(lineTeam, "leftOnBase", statValue(batting, "leftOnBase"))),
      statRow("Batter LOB", statValue(batting, "leftOnBase")),
      statRow("SB / CS", `${statValue(batting, "stolenBases", 0)} / ${statValue(batting, "caughtStealing", 0)}`),
      statRow("GIDP", statValue(batting, "groundIntoDoublePlay")),
      statRow("Runs", statValue(batting, "runs")),
    ].join("")),
    renderRecapColumn(`${summaryTeamLabel} Batted Balls`, [
      barRow("Ground Balls", batted.ground, batted.total, "blue"),
      barRow("Line Drives", batted.line, batted.total, "green"),
      barRow("Fly Balls", batted.fly, batted.total, "gold"),
      barRow("Popups", batted.popup, batted.total, "red"),
      `<div class="recap-row total-row"><span>Total</span><strong class="stat-number">${escapeHtml(batted.total || "-")}</strong></div>`,
    ].join("")),
    renderRecapColumn(`${summaryTeamLabel} Pitching`, [
      statRow("Strikeouts", statValue(pitching, "strikeOuts")),
      statRow("Walks", statValue(pitching, "baseOnBalls")),
      statRow("Hits Allowed", statValue(pitching, "hits")),
      statRow("HR Allowed", statValue(pitching, "homeRuns")),
      statRow("Earned Runs", statValue(pitching, "earnedRuns")),
      statRow("Ground Balls", statValue(pitching, "groundOuts")),
      statRow("Fly Balls", statValue(pitching, "airOuts")),
      statRow("Innings", statValue(pitching, "inningsPitched")),
      statRow("Pitches", statValue(pitching, "numberOfPitches")),
      `
        <div class="bar-stat compact-bar">
          <div class="bar-stat-heading">
            <span>Strike %</span>
            <strong class="stat-number">${strikePercentage ? `${strikePercentage}%` : "-"}</strong>
          </div>
          <div class="bar-track" aria-hidden="true">
            <span class="bar-fill green" style="width: ${strikePercentage}%"></span>
          </div>
        </div>
      `,
    ].join("")),
    renderRecapColumn(`${summaryTeamLabel} Metrics`, [
      metricFeature("Max Exit Velo", metrics.maxExit ? metrics.maxExit.value.toFixed(1) : "-", "MPH", metrics.maxExit ? `${metrics.maxExit.player} - ${metrics.maxExit.detail}` : "No tracked batted balls"),
      metricFeature("Avg Exit Velo", avgExit, avgExit === "-" ? "" : "MPH", `${metrics.trackedBattedBalls || 0} tracked batted balls`),
      metricFeature("Hard Hit %", hardHitPct, hardHitPct === "-" ? "" : "%", `${metrics.hardHitCount} of ${metrics.trackedBattedBalls} batted balls`),
      metricFeature("Max Pitch Velo", metrics.maxPitch ? metrics.maxPitch.value.toFixed(1) : "-", "MPH", metrics.maxPitch ? `${metrics.maxPitch.player} - ${metrics.maxPitch.detail}` : "No tracked pitches"),
    ].join("")),
  ].join("");
}

function stopLiveRefresh() {
  if (!state.liveRefreshTimer) return;
  clearInterval(state.liveRefreshTimer);
  state.liveRefreshTimer = null;
}

function startLiveRefresh(game) {
  stopLiveRefresh();
  state.liveRefreshTimer = setInterval(async () => {
    if (!state.selectedGame || Number(state.selectedGame.gamePk) !== Number(game.gamePk)) {
      stopLiveRefresh();
      return;
    }

    try {
      const feed = await getLiveJson(`/game/${game.gamePk}/feed/live`);
      renderRecap(game, feed);
      if (!isLiveGame(game)) stopLiveRefresh();
    } catch (error) {
      els.status.textContent = "Live update paused";
      els.status.style.color = "#ffbec4";
    }
  }, LIVE_REFRESH_MS);
}

async function loadGameRecap(game, { live = false } = {}) {
  state.selectedGame = game;
  state.playerStatsTeam = "yankees";
  els.scoreboard.classList.add("loading");

  try {
    const feed = await getLiveJson(`/game/${game.gamePk}/feed/live`);
    renderRecap(game, feed);
    if (live && isLiveGame(game)) startLiveRefresh(game);
    else stopLiveRefresh();
  } finally {
    els.scoreboard.classList.remove("loading");
  }
}

async function init() {
  try {
    const [liveGame, games, upcomingGames] = await Promise.all([
      getTodaysLiveGame().catch(() => null),
      getRecentFinalGames(),
      getUpcomingGames().catch(() => []),
      loadDivisionRanks().catch(() => null),
    ]);
    const selectedGame = liveGame || games[0];
    state.liveGame = liveGame;
    state.recentGames = games;
    state.upcomingGames = upcomingGames;
    renderRecentGames(games, selectedGame?.gamePk, { includeLatest: Boolean(liveGame) });
    renderRecapButtons(games, selectedGame?.gamePk);
    if (!selectedGame) throw new Error("No Yankees games found.");
    await loadGameRecap(selectedGame, { live: Boolean(liveGame) });
  } catch (error) {
    els.status.textContent = "Recap unavailable";
    els.status.style.color = "#ffbec4";
    els.title.textContent = "Latest recap could not be loaded";
    els.subtitle.textContent = "The MLB data feed did not return the completed game recap right now.";
    els.scoreboard.innerHTML = `
      <div class="game-scoreboard-top">
        <div class="scoreboard-team away"><span class="scoreboard-team-copy"><strong>Yankees</strong></span></div>
        <strong class="scoreboard-score">-</strong>
        <div class="scoreboard-state">Unavailable</div>
        <strong class="scoreboard-score">-</strong>
        <div class="scoreboard-team home"><span class="scoreboard-team-copy"><strong>Opponent</strong></span></div>
      </div>
      <div class="game-scoreboard-lower">
        <div class="game-linescore-box"><span>Box score unavailable</span></div>
        <div class="game-decisions">
          <p><span class="win-label">W:</span> Try again shortly</p>
          <p><span class="loss-label">L:</span> ${escapeHtml(error.message)}</p>
          <p><span class="save-label">SV:</span> None</p>
        </div>
      </div>
    `;
    els.playerStats.innerHTML = `
      <article class="game-player-column game-player-unavailable">
        <h3>Game Player Stats</h3>
        <p>Player statistics are unavailable right now.</p>
      </article>
    `;
    els.grid.innerHTML = `
      <article class="recap-column recap-error">
        <h3>Data Error</h3>
        <p class="recap-loading mb-0">${escapeHtml(error.message)}</p>
      </article>
    `;
  }
}

async function handleRecapButtonClick(event) {
  const button = event.target.closest(".recent-game-button[data-game-pk]");
  const selectorButton = event.target.closest(".recap-selector-button[data-game-pk]");
  const selectedButton = button || selectorButton;
  if (!selectedButton) return;

  const gamePk = Number(selectedButton.dataset.gamePk);
  const game = state.recentGames.find((item) => Number(item.gamePk) === gamePk);
  if (!game) return;

  els.status.textContent = "Loading selected recap";
  els.status.style.color = "";
  stopLiveRefresh();
  renderRecentGames(state.recentGames, gamePk, { includeLatest: Boolean(state.liveGame) });
  renderRecapButtons(state.recentGames, gamePk);

  try {
    await loadGameRecap(game);
  } catch (error) {
    els.status.textContent = "Selected recap unavailable";
    els.status.style.color = "#ffbec4";
  }
}

els.recent.addEventListener("click", handleRecapButtonClick);
els.recapButtons.addEventListener("click", handleRecapButtonClick);
els.playerStats.addEventListener("click", (event) => {
  const button = event.target.closest("[data-player-stats-team]");
  if (!button || !state.currentFeed || !state.selectedGame) return;
  state.playerStatsTeam = button.dataset.playerStatsTeam;
  renderRecap(state.selectedGame, state.currentFeed);
});

init();
