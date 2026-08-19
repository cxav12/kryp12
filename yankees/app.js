const TEAM_ID = 147;
const MLB_API = "https://statsapi.mlb.com/api/v1";
const MLB_LIVE_API = "https://statsapi.mlb.com/api/v1.1";
const HARD_HIT_MPH = 95;
const LIVE_REFRESH_MS = 15000;
const MLB_TEAM_PRIMARY_COLORS = {
  108: "#BA0021", 109: "#A71930", 110: "#DF4601", 111: "#BD3039", 112: "#CC3433",
  113: "#C6011F", 114: "#D50032", 115: "#C4CED4", 116: "#FA4616", 117: "#EB6E1F",
  118: "#004687", 119: "#005A9C", 120: "#AB0003", 121: "#FF5910", 133: "#EFB21E",
  134: "#FDB827", 135: "#FFC425", 136: "#005C5C", 137: "#FD5A1E", 138: "#C41E3A",
  139: "#8FBCE6", 140: "#C0111F", 141: "#134A8E", 142: "#D31145", 143: "#E81828",
  144: "#CE1141", 145: "#C4CED4", 146: "#00A3E0", 147: "#C4CED3", 158: "#FFC52F",
};
const MLB_TEAM_ABBREVIATIONS = {
  "arizona diamondbacks": "AZ", "atlanta braves": "ATL", "baltimore orioles": "BAL",
  "boston red sox": "BOS", "chicago cubs": "CHC", "chicago white sox": "CWS",
  "cincinnati reds": "CIN", "cleveland guardians": "CLE", "colorado rockies": "COL",
  "detroit tigers": "DET", "houston astros": "HOU", "kansas city royals": "KC",
  "los angeles angels": "LAA", "los angeles dodgers": "LAD", "miami marlins": "MIA",
  "milwaukee brewers": "MIL", "minnesota twins": "MIN", "new york mets": "NYM",
  "new york yankees": "NYY", "athletics": "ATH", "oakland athletics": "OAK",
  "philadelphia phillies": "PHI", "pittsburgh pirates": "PIT", "san diego padres": "SD",
  "san francisco giants": "SF", "seattle mariners": "SEA", "st. louis cardinals": "STL",
  "tampa bay rays": "TB", "texas rangers": "TEX", "toronto blue jays": "TOR",
  "washington nationals": "WSH",
};
const niceDateFormatter = new Intl.DateTimeFormat("en", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});
const compactDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "numeric",
  day: "numeric",
  timeZone: "America/New_York",
});
const gameTimeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "short",
});

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
  absChallengeEvents: [],
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
  return niceDateFormatter.format(new Date(`${value}T12:00:00`));
}

function compactDate(value) {
  if (!value) return "TBD";
  return compactDateFormatter.format(new Date(`${value}T12:00:00`));
}

function gameTime(value) {
  if (!value) return "TBD";
  return gameTimeFormatter.format(new Date(value));
}

function teamAbbreviation(team) {
  if (typeof team === "string") {
    const name = team.trim();
    return MLB_TEAM_ABBREVIATIONS[name.toLowerCase()] || name || "TBD";
  }

  const abbreviation = team?.abbreviation;
  if (abbreviation) return abbreviation;

  const name = team?.teamName || team?.name;
  return MLB_TEAM_ABBREVIATIONS[String(name || "").trim().toLowerCase()] || name || "TBD";
}

function teamLogoUrl(team) {
  const id = typeof team === "number" ? team : team?.id;
  return id ? `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${id}.svg` : "";
}

function teamPrimaryColor(team) {
  return MLB_TEAM_PRIMARY_COLORS[Number(team?.id)] || "#4C76B0";
}

function contrastTextColor(hexColor) {
  const hex = String(hexColor || "").replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#FFFFFF";
  const [red, green, blue] = [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.62 ? "#111820" : "#FFFFFF";
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

function gameBroadcastLabel(game) {
  const yankeesLocation = isYankeesHome(game) ? "home" : "away";
  const television = (game.broadcasts || []).filter((broadcast) => {
    const type = String(broadcast.type || "").toLowerCase();
    const language = String(broadcast.language || "en").toLowerCase();
    return type === "tv"
      && language === "en"
      && (broadcast.isNational || !broadcast.homeAway || broadcast.homeAway === yankeesLocation);
  });
  return [...new Set(television.map((broadcast) => broadcast.name).filter(Boolean))].join(" / ");
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
    hydrate: "team,venue,linescore,broadcasts(all)",
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

function playDescriptionSentences(description) {
  return String(description || "")
    .replace(/^.*?challenged.*?:\s*/i, "")
    .split(/\.\s+(?=[A-Z])/)
    .map((sentence) => sentence.trim().replace(/[.]+$/, ""))
    .filter(Boolean);
}

function scoringRunnerNames(play) {
  return [...new Set((play.runners || [])
    .filter((runner) => runner.details?.isScoringEvent || runner.movement?.end === "score")
    .map((runner) => runner.details?.runner?.fullName)
    .filter(Boolean))];
}

function playerNameList(names) {
  if (names.length < 2) return names[0] || "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names.at(-1)}`;
}

function scoringPlaySummary(play) {
  const result = play.result || {};
  const sentences = playDescriptionSentences(result.description);
  const batterName = play.matchup?.batter?.fullName || "";
  const action = sentences.find((sentence) => batterName && sentence.toLowerCase().startsWith(batterName.toLowerCase()))
    || sentences[0]
    || "";
  const scoringSentences = sentences.filter((sentence) => sentence !== action && /\b(scores?|homers?|home run|grand slam)\b/i.test(sentence));
  const details = [action, ...scoringSentences].filter(Boolean);
  const includedText = details.join(" ").toLowerCase();
  const missingScorers = scoringRunnerNames(play).filter((name) => !includedText.includes(name.toLowerCase()));

  if (missingScorers.length) {
    details.push(`${playerNameList(missingScorers)} ${missingScorers.length === 1 ? "scores" : "score"}`);
  }

  return [result.event, details.join(". ")]
    .filter(Boolean)
    .filter((value, index, values) => index === 0 || value.toLowerCase() !== values[0].toLowerCase())
    .join(" — ");
}

function scoringPlayRows(feed, game) {
  const plays = feed.liveData?.plays || {};
  const scoring = (plays.scoringPlays || []).map((index) => plays.allPlays?.[index]).filter(Boolean).reverse();
  if (!scoring.length) return `<p class="scoring-play-empty">No scoring plays yet.</p>`;
  return scoring.map((play) => {
    const half = play.about?.halfInning === "bottom" ? "Bot" : "Top";
    const side = play.about?.halfInning === "bottom" ? "home" : "away";
    const team = game.teams?.[side]?.team || feed.gameData?.teams?.[side] || {};
    const scoringTeamClass = Number(team.id) === TEAM_ID ? "is-yankees" : "is-opponent";
    const inning = ordinalInning(play.about?.inning);
    const result = play.result || {};
    const conciseDescription = scoringPlaySummary(play);
    return `
      <article class="scoring-play ${scoringTeamClass}" style="--scoring-team-color: ${teamPrimaryColor(team)}">
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
  const yankeesTeamSide = yankeesSide(game);
  const side = state.playerStatsTeam === "opponent" ? opponentSide(game) : yankeesTeamSide;
  const team = game.teams?.[side]?.team || feed.gameData?.teams?.[side] || {};
  const teamLabel = teamAbbreviation(team) || (side === yankeesTeamSide ? "NYY" : "Opponent");
  const teamName = team.teamName || team.name || teamLabel;
  const teamBox = feed.liveData?.boxscore?.teams?.[side] || {};
  const officialGroups = (teamBox.info || []).filter((group) =>
    ["batting", "baserunning", "fielding", "pitching"].includes(String(group.title || "").toLowerCase())
  );
  const batting = teamBox.teamStats?.batting || {};
  const fielding = teamBox.teamStats?.fielding || {};
  const pitching = teamBox.teamStats?.pitching || {};
  const lineTeam = feed.liveData?.linescore?.teams?.[side] || {};
  const stat = (key, fallback = 0) => statValue(batting, key, fallback);
  const detailRow = (label, value) => `<p><strong>${escapeHtml(label)}</strong> ${escapeHtml(value)}</p>`;
  const shouldShowDetailField = (field) => {
    const label = String(field?.label || "").toLowerCase();
    return !(
      label.includes("runners left in scoring position")
      && label.includes("2 out")
    );
  };
  const officialGroup = (title) => officialGroups.find((group) =>
    String(group.title || "").toLowerCase() === title.toLowerCase()
  );
  const detailGroup = (title, fallbackFields) => {
    const fields = (title === "Pitching" ? fallbackFields : (officialGroup(title)?.fieldList || fallbackFields))
      .filter(shouldShowDetailField);
    const groupClass = `game-notes-group-${title.toLowerCase()}`;
    return `
      <section class="${groupClass}">
        <h4>${escapeHtml(title)}</h4>
        ${fields.map((field) => detailRow(field.label, field.value)).join("")}
      </section>
    `;
  };
  const positivePitchingStat = (label, ...keys) => {
    const value = keys.reduce((result, key) => result || Number(pitching[key] || 0), 0);
    return value > 0 ? { label, value } : null;
  };
  const pitchCount = Number(pitching.numberOfPitches ?? pitching.pitchesThrown ?? 0);
  const strikeCount = Number(pitching.strikes ?? 0);
  const inheritedRunners = Number(pitching.inheritedRunners ?? 0);
  const inheritedScored = Number(pitching.inheritedRunnersScored ?? 0);
  const pitchingDetails = [
    positivePitchingStat("WP", "wildPitches"),
    positivePitchingStat("HBP", "hitBatsmen", "hitBatters"),
    positivePitchingStat("BK", "balks"),
    inheritedRunners > 0 ? { label: "IR-IRS", value: `${inheritedRunners}-${inheritedScored}` } : null,
    positivePitchingStat("HLD", "holds"),
    positivePitchingStat("SV", "saves"),
    positivePitchingStat("BS", "blownSaves"),
    pitchCount > 0 ? { label: "P-S", value: `${pitchCount}-${strikeCount}` } : null,
  ].filter(Boolean);

  return `
    <aside class="game-notes-panel" aria-label="${escapeHtml(`${teamName} box score details`)}">
      <h3>${escapeHtml(teamLabel)} Box Score Details</h3>
      <div class="game-notes-groups">
        ${detailGroup("Batting", [
          { label: "2B", value: playerStatSummary(teamBox, "doubles") },
          { label: "3B", value: playerStatSummary(teamBox, "triples") },
          { label: "HR", value: playerStatSummary(teamBox, "homeRuns") },
          { label: "RBI", value: playerStatSummary(teamBox, "rbi") },
          { label: "Team RISP", value: `${stat("hitsRisp")}-${stat("atBatsRisp")}` },
          { label: "Team LOB", value: lineTeam.leftOnBase ?? stat("leftOnBase") },
        ])}
        ${detailGroup("Baserunning", [
          { label: "SB", value: playerStatSummary(teamBox, "stolenBases") },
          { label: "CS", value: playerStatSummary(teamBox, "caughtStealing") },
        ])}
        ${detailGroup("Fielding", [
          { label: "DP", value: statValue(fielding, "doublePlays", stat("groundIntoDoublePlay")) },
          { label: "E", value: statValue(fielding, "errors", lineTeam.errors ?? 0) },
        ])}
        ${detailGroup("Pitching", pitchingDetails)}
      </div>
    </aside>
  `;
}

function renderGameSituation(feed, game) {
  const hasScoringPlays = (feed.liveData?.plays?.scoringPlays || []).length > 0;
  if (!hasScoringPlays) return "";
  return `
    <section class="game-situation" aria-label="Scoring plays">
      <div class="scoring-plays-panel">
        <h3>Scoring Plays</h3>
        <div class="scoring-plays-list">${renderScoringPlays(feed, game)}</div>
      </div>
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

function scoreboardTeamDetails(game, feed, side) {
  const entry = game.teams?.[side] || {};
  const team = entry.team || feed.gameData?.teams?.[side] || {};
  const name = team.teamName || team.name || teamAbbreviation(team);
  const record = gameTeamRecord(game, feed, side);
  const division = shortDivisionName(team.division?.name || feed.gameData?.teams?.[side]?.division?.name);
  const divisionPosition = ordinal(state.divisionRanks[Number(team.id)]);
  const divisionLabel = [divisionPosition, division].filter(Boolean).join(" ");
  return { team, name, record, divisionLabel };
}

function renderScoreboardTeam(details, side, score) {
  const copy = `
    <span class="scoreboard-team-copy">
      <strong>${escapeHtml(details.name)}</strong>
      ${details.record ? `<small>${escapeHtml(details.record)}</small>` : ""}
      ${details.divisionLabel ? `<small>${escapeHtml(details.divisionLabel)}</small>` : ""}
    </span>
  `;
  const logo = `<img class="team-logo" src="${escapeHtml(teamLogoUrl(details.team))}" alt="${escapeHtml(details.name)} logo" />`;
  return `
    <div class="scoreboard-team ${side}${Number(details.team.id) === TEAM_ID ? " is-yankees" : ""}">
      ${side === "away" ? `${copy}${logo}` : `${logo}${copy}`}
      <strong class="scoreboard-mobile-score">${escapeHtml(score)}</strong>
    </div>
  `;
}

function renderMobileGameStatList(entries, primaryLabels) {
  const primaryLabelSet = new Set(primaryLabels);
  return `
    <div class="game-player-mobile-list">
      ${entries.map((entry) => {
        const statValueByLabel = new Map(entry.stats);
        const secondaryStats = entry.stats.filter(([label]) => !primaryLabelSet.has(label));
        return `
          <details class="game-player-mobile-row${entry.isSubstitute ? " is-substitute" : ""}">
            <summary>
              <span class="mobile-player-identity">
                <strong>${escapeHtml(entry.name)}</strong>
                ${entry.position ? `<small>${escapeHtml(entry.position)}</small>` : ""}
                <span class="mobile-expand-icon" aria-hidden="true"></span>
              </span>
              ${primaryLabels.map((label) => `
                <span class="mobile-game-stat">
                  <small>${escapeHtml(label)}</small>
                  <strong>${escapeHtml(statValueByLabel.get(label) ?? 0)}</strong>
                </span>
              `).join("")}
            </summary>
            <div class="mobile-game-stat-details">
              ${secondaryStats.map(([label, value]) => `
                <span class="mobile-game-stat">
                  <small>${escapeHtml(label)}</small>
                  <strong>${escapeHtml(value ?? 0)}</strong>
                </span>
              `).join("")}
              <a class="mobile-player-profile-link" href="./player-profile/?player=${escapeHtml(entry.playerId)}">View player profile</a>
            </div>
          </details>
        `;
      }).join("")}
    </div>
  `;
}

function renderGameStatTable(headers, rows, mobileEntries, primaryLabels, emptyMessage) {
  if (!rows.length) return `<p class="game-player-empty">${escapeHtml(emptyMessage)}</p>`;
  return `
    <div class="game-player-table-scroll">
      <table class="game-player-table">
        <thead><tr>${headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join("")}</tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    </div>
    ${renderMobileGameStatList(mobileEntries, primaryLabels)}
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
  const yankeesToggleColor = teamPrimaryColor({ id: TEAM_ID });
  const opponentToggleColor = teamPrimaryColor(opponentTeam);
  const teamBox = feed.liveData?.boxscore?.teams?.[selectedSide] || {};
  const players = teamBox.players || {};
  const battingHeaders = ["Player", "AB", "R", "H", "2B", "3B", "HR", "RBI", "BB", "SO", "AVG"];
  const pitchingHeaders = ["Player", "IP", "H", "R", "ER", "BB", "SO", "HR", "P", "ERA"];
  const battingEntries = (teamBox.batters || []).map((playerId) => players[`ID${playerId}`]).filter((player) => {
    const stats = player?.stats?.batting || {};
    return player?.person && (Number(stats.plateAppearances || 0) > 0 || Number(stats.atBats || 0) > 0);
  }).map((player) => {
    const stats = player.stats.batting || {};
    const seasonAverage = player.seasonStats?.batting?.avg || "-";
    const values = [stats.atBats, stats.runs, stats.hits, stats.doubles, stats.triples, stats.homeRuns, stats.rbi, stats.baseOnBalls, stats.strikeOuts, seasonAverage];
    const battingOrder = String(player.battingOrder || "");
    const isSubstitute = battingOrder.length >= 3 && Number.parseInt(battingOrder.slice(-2), 10) > 0;
    return {
      playerId: player.person.id,
      name: player.person.fullName,
      position: player.position?.abbreviation || "",
      isSubstitute,
      values,
      stats: values.map((value, index) => [battingHeaders[index + 1], value]),
    };
  });
  const battingRows = battingEntries.map((entry) => {
    return `
      <tr class="${entry.isSubstitute ? "is-substitute" : ""}">
        <th scope="row"><a href="./player-profile/?player=${escapeHtml(entry.playerId)}">${escapeHtml(entry.name)}</a><small>${escapeHtml(entry.position)}</small></th>
        ${entry.values.map((value, index) => `<td data-label="${escapeHtml(battingHeaders[index + 1])}">${escapeHtml(value ?? 0)}</td>`).join("")}
      </tr>
    `;
  });
  const pitchingEntries = (teamBox.pitchers || []).map((playerId) => players[`ID${playerId}`]).filter((player) => player?.person && player.stats?.pitching).map((player) => {
    const stats = player.stats.pitching || {};
    const seasonEra = player.seasonStats?.pitching?.era || "-";
    const values = [stats.inningsPitched, stats.hits, stats.runs, stats.earnedRuns, stats.baseOnBalls, stats.strikeOuts, stats.homeRuns, stats.numberOfPitches ?? stats.pitchesThrown, seasonEra];
    return {
      playerId: player.person.id,
      name: player.person.fullName,
      position: "",
      isSubstitute: false,
      values,
      stats: values.map((value, index) => [pitchingHeaders[index + 1], value]),
    };
  });
  const pitchingRows = pitchingEntries.map((entry) => {
    return `
      <tr>
        <th scope="row"><a href="./player-profile/?player=${escapeHtml(entry.playerId)}">${escapeHtml(entry.name)}</a></th>
        ${entry.values.map((value, index) => `<td data-label="${escapeHtml(pitchingHeaders[index + 1])}">${escapeHtml(value ?? 0)}</td>`).join("")}
      </tr>
    `;
  });

  els.playerStats.innerHTML = `
    <header class="game-player-stats-toolbar">
      <div>
        <h2>Team Details</h2>
        <p>Box score details and player statistics</p>
      </div>
      <div class="game-player-team-switcher" role="group" aria-label="Team player statistics">
        <button class="game-player-team-button${state.playerStatsTeam === "yankees" ? " active" : ""}" style="--team-toggle-color:${yankeesToggleColor};--team-toggle-text:${contrastTextColor(yankeesToggleColor)}" type="button" data-player-stats-team="yankees" aria-pressed="${state.playerStatsTeam === "yankees"}">Yankees</button>
        <button class="game-player-team-button${state.playerStatsTeam === "opponent" ? " active" : ""}" style="--team-toggle-color:${opponentToggleColor};--team-toggle-text:${contrastTextColor(opponentToggleColor)}" type="button" data-player-stats-team="opponent" aria-pressed="${state.playerStatsTeam === "opponent"}">${escapeHtml(opponentName)}</button>
      </div>
    </header>
    ${renderGameNotes(feed, game)}
    <article class="game-player-column">
      <h3>${escapeHtml(selectedTeamName)} Batting</h3>
      ${renderGameStatTable(battingHeaders, battingRows, battingEntries, ["AB", "H", "RBI", "AVG"], `No ${selectedTeamName} batting statistics are available yet.`)}
    </article>
    <article class="game-player-column">
      <h3>${escapeHtml(selectedTeamName)} Pitching</h3>
      ${renderGameStatTable(pitchingHeaders, pitchingRows, pitchingEntries, ["IP", "H", "ER", "SO"], `No ${selectedTeamName} pitching statistics are available yet.`)}
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
  let longestHomeRun = null;

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

      const isHomeRun = play.result?.eventType === "home_run" || /home run|homer/i.test(play.result?.event || "");
      const homeRunDistance = Number(hitEvent?.hitData?.totalDistance);
      if (isHomeRun && Number.isFinite(homeRunDistance)) {
        const homeRun = {
          value: homeRunDistance,
          player: play.matchup?.batter?.fullName || "Batter",
          detail: Number.isFinite(exitVelo) ? `${exitVelo.toFixed(1)} mph exit velocity` : "Home run",
        };
        if (!longestHomeRun || homeRunDistance > longestHomeRun.value) longestHomeRun = homeRun;
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
    longestHomeRun,
  };
}

function comparisonLegend(opponentLabel) {
  return `
    <div class="comparison-legend" aria-label="Team comparison colors">
      <span class="comparison-team yankees"><i aria-hidden="true"></i>NYY</span>
      <span class="comparison-team opponent"><i aria-hidden="true"></i>${escapeHtml(opponentLabel)}</span>
    </div>
  `;
}

function comparisonRow(label, yankeesValue, opponentValue, options = {}) {
  const yankeesNumber = Number(yankeesValue);
  const opponentNumber = Number(opponentValue);
  const yankeesMagnitude = Number.isFinite(yankeesNumber) ? Math.max(0, Math.abs(yankeesNumber)) : 0;
  const opponentMagnitude = Number.isFinite(opponentNumber) ? Math.max(0, Math.abs(opponentNumber)) : 0;
  const total = yankeesMagnitude + opponentMagnitude;
  const yankeesWidth = total ? (yankeesMagnitude / total) * 100 : 50;
  const opponentWidth = total ? (opponentMagnitude / total) * 100 : 50;
  const yankeesDisplay = options.yankeesDisplay ?? yankeesValue ?? "-";
  const opponentDisplay = options.opponentDisplay ?? opponentValue ?? "-";
  const opponentLabel = options.opponentLabel || "Opponent";
  return `
    <div class="comparison-stat">
      <span class="comparison-stat-label">${escapeHtml(label)}</span>
      ${(options.yankeesDetail || options.opponentDetail) ? `
        <div class="comparison-stat-details">
          <small>${escapeHtml(options.yankeesDetail || "No tracked data")}</small>
          <small>${escapeHtml(options.opponentDetail || "No tracked data")}</small>
        </div>
      ` : ""}
      <div class="comparison-bars" aria-label="${escapeHtml(`${label}: NYY ${yankeesDisplay}; ${opponentLabel} ${opponentDisplay}`)}">
        <div class="comparison-track">
          <span class="comparison-fill yankees" style="width:${yankeesWidth.toFixed(1)}%"><strong>${escapeHtml(yankeesDisplay)}</strong></span>
          <span class="comparison-fill opponent" style="width:${opponentWidth.toFixed(1)}%"><strong>${escapeHtml(opponentDisplay)}</strong></span>
        </div>
      </div>
    </div>
  `;
}

function tablerMetricIcon(name) {
  const paths = {
    "ruler-measure": '<path d="M19.875 12c.621 0 1.125 .512 1.125 1.143v5.714c0 .631 -.504 1.143 -1.125 1.143h-15.875a1 1 0 0 1 -1 -1v-5.857c0 -.631 .504 -1.143 1.125 -1.143h15.75"/><path d="M9 12v2M6 12v3M12 12v3M18 12v3M15 12v2M3 3v4M3 5h18M21 3v4"/>',
    gauge: '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M11 12a1 1 0 1 0 2 0a1 1 0 1 0 -2 0M13.41 10.59l2.59 -2.59M7 12a5 5 0 0 1 5 -5"/>',
    "ball-baseball": '<path d="M5.636 18.364a9 9 0 1 0 12.728 -12.728a9 9 0 0 0 -12.728 12.728M12.495 3.02a9 9 0 0 1 -9.475 9.475M20.98 11.505a9 9 0 0 0 -9.475 9.475M9 9l2 2M13 13l2 2M11 7l2 1M7 11l1 2M16 11l1 2M11 16l2 1"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10M17 4v8a5 5 0 0 1 -10 0v-8M3 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M17 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>',
    scale: '<path d="M7 20h10M6 6l6 -1l6 1M12 3v17M9 12l-3 -6l-3 6a3 3 0 0 0 6 0M21 12l-3 -6l-3 6a3 3 0 0 0 6 0"/>',
    "info-circle": '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0M12 9h.01M11 12h1v4h1"/>',
  };
  const iconPaths = paths[name];
  if (!iconPaths) return "";
  return `<svg class="metric-feature-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths}</svg>`;
}

function metricFeature(label, value, unit, detail, icon) {
  return `
    <div class="metric-feature">
      <span class="metric-feature-label">${tablerMetricIcon(icon)}${escapeHtml(label)}</span>
      <strong class="stat-number">${escapeHtml(value)}${unit ? ` <small>${escapeHtml(unit)}</small>` : ""}</strong>
      <em>${escapeHtml(detail)}</em>
    </div>
  `;
}

function gameNoteFeature(label, detail, icon) {
  const lines = Array.isArray(detail) ? detail : [detail];
  return `
    <div class="metric-feature game-note-feature">
      <span class="metric-feature-label">${tablerMetricIcon(icon)}${escapeHtml(label)}</span>
      <div class="game-note-lines">
        ${lines.map((line) => {
          const text = String(line);
          const separator = text.indexOf(":");
          const outcomeClass = text.includes("✓")
            ? " challenge-success"
            : text.includes("✕") ? " challenge-unsuccessful" : "";
          if (separator < 0) return `<p class="${outcomeClass.trim()}">${escapeHtml(text)}</p>`;
          return `<p class="${outcomeClass.trim()}"><strong>${escapeHtml(text.slice(0, separator + 1))}</strong> ${escapeHtml(text.slice(separator + 1).trim())}</p>`;
        }).join("")}
      </div>
    </div>
  `;
}

function playerMilestoneNotes(feed) {
  const milestonePattern = /\b(?:\d+(?:st|nd|rd|th)\s+(?:career|season)|career\s+(?:hit|home run|homer|rbi|strikeout|save|win)|milestone|record-setting|franchise record|club record|major league record|mlb record)\b/i;
  const notes = [];
  (feed.liveData?.plays?.allPlays || []).forEach((play) => {
    const descriptions = [
      play.result?.description,
      ...(play.playEvents || []).map((event) => event.details?.description),
    ].filter(Boolean);
    descriptions.forEach((description) => {
      if (milestonePattern.test(description)) notes.push(String(description).trim());
    });
  });
  return [...new Set(notes)].slice(0, 3);
}

function gameDurationLabel(minutes) {
  const duration = Number(minutes);
  if (!Number.isFinite(duration) || duration <= 0) return "-";
  return `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`;
}

function gameDelayLabel(start, end, officialMinutes) {
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  const duration = Number(officialMinutes);
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || !Number.isFinite(duration) || duration <= 0) return "";
  const delayMinutes = Math.round((endTime - startTime) / 60000) - duration;
  return delayMinutes >= 5 ? gameDurationLabel(delayMinutes) : "";
}

function gameClockTime(value, fallback = "Unavailable") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : gameTimeFormatter.format(date);
}

function absChallengeNotes(feed) {
  const events = AbsChallenges.events(feed);
  state.absChallengeEvents = events;
  if (events.length) return events.map((event) => event.display).filter(Boolean);
  return [absChallengeNote(feed)];
}

function absChallengeNote(feed) {
  const note = (feed.liveData?.boxscore?.info || []).find((item) => String(item.label || "").toLowerCase() === "abs challenge");
  if (note?.value) return note.value;
  const challenges = feed.gameData?.absChallenges;
  if (!challenges?.hasChallenges) return "ABS challenge data unavailable";
  const used = [challenges.away, challenges.home]
    .reduce((total, team) => total + Number(team?.usedSuccessful || 0) + Number(team?.usedFailed || 0), 0);
  return used ? `${used} ABS challenge${used === 1 ? "" : "s"} used` : "No ABS challenges used";
}

function recapTeamComparisonData(feed, side) {
  const teamStats = feed.liveData?.boxscore?.teams?.[side]?.teamStats || {};
  const batting = teamStats.batting || {};
  const pitching = teamStats.pitching || {};
  const line = feed.liveData?.linescore?.teams?.[side] || {};
  const metrics = collectGameMetrics(feed, side);
  const pitchCount = numberValue(pitching, "numberOfPitches");
  const strikePercentage = pitchCount ? Math.round((numberValue(pitching, "strikes") / pitchCount) * 100) : 0;
  const averageExit = metrics.avgExit === null ? null : Number(metrics.avgExit.toFixed(1));
  const hardHitPercentage = metrics.trackedBattedBalls
    ? Number(((metrics.hardHitCount / metrics.trackedBattedBalls) * 100).toFixed(1))
    : null;
  return { batting, pitching, line, metrics, batted: metrics.battedBalls, strikePercentage, averageExit, hardHitPercentage };
}

function renderRecapColumn(title, body, className = "") {
  return `
    <article class="recap-column${className ? ` ${className}` : ""}">
      <h3>${escapeHtml(title)}</h3>
      <div class="recap-divider"></div>
      <div class="comparison-list">${body}</div>
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
          <img class="team-logo" src="${escapeHtml(teamLogoUrl(yankees.team))}" alt="${escapeHtml(teamAbbreviation(yankees.team))} logo" />
          <strong>NYY ${escapeHtml(yankees.score ?? "-")}</strong>
          <i aria-hidden="true">-</i>
          <strong>${escapeHtml(opponentEntry.score ?? "-")} ${escapeHtml(teamAbbreviation(opponent))}</strong>
          <img class="team-logo" src="${escapeHtml(teamLogoUrl(opponent))}" alt="${escapeHtml(teamAbbreviation(opponent))} logo" />
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
  const opponentTeamSide = opponentSide(game);
  const opponent = game.teams?.[opponentSide(game)]?.team;
  const yankeesComparison = recapTeamComparisonData(feed, side);
  const opponentComparison = recapTeamComparisonData(feed, opponentTeamSide);
  const decisions = feed.liveData?.decisions || {};
  const opponentAbbr = teamAbbreviation(opponent);
  const bestGameMetric = (key) => [
    yankeesComparison.metrics[key] ? { ...yankeesComparison.metrics[key], team: "NYY" } : null,
    opponentComparison.metrics[key] ? { ...opponentComparison.metrics[key], team: opponentAbbr } : null,
  ].filter(Boolean).sort((a, b) => Number(b.value) - Number(a.value))[0] || null;
  const gameMetrics = {
    longestHomeRun: bestGameMetric("longestHomeRun"),
    maxExit: bestGameMetric("maxExit"),
    maxPitch: bestGameMetric("maxPitch"),
  };
  const gameResultClass = resultClass(game);
  const liveLabel = inningLabel(feed, game);
  const broadcastLabel = gameBroadcastLabel(game);
  const livePlays = feed.liveData?.plays || {};
  const liveCurrentPlay = livePlays.currentPlay || livePlays.allPlays?.[livePlays.allPlays.length - 1] || {};
  const comparisonOptions = { opponentLabel: opponentAbbr };
  const yankeesTeam = game.teams?.[side]?.team || feed.gameData?.teams?.[side] || { id: TEAM_ID };
  const opponentPrimaryColor = teamPrimaryColor(opponent);
  const yankeesPrimaryColor = teamPrimaryColor(yankeesTeam);
  const awayScoreDetails = scoreboardTeamDetails(game, feed, "away");
  const homeScoreDetails = scoreboardTeamDetails(game, feed, "home");
  const awayPrimaryColor = teamPrimaryColor(awayScoreDetails.team);
  const homePrimaryColor = teamPrimaryColor(homeScoreDetails.team);

  els.grid.style.setProperty("--comparison-yankees-color", yankeesPrimaryColor);
  els.grid.style.setProperty("--comparison-yankees-text", contrastTextColor(yankeesPrimaryColor));
  els.grid.style.setProperty("--comparison-opponent-color", opponentPrimaryColor);
  els.grid.style.setProperty("--comparison-opponent-text", contrastTextColor(opponentPrimaryColor));
  const attendance = Number(feed.gameData?.gameInfo?.attendance);
  const weather = feed.gameData?.weather || {};
  const weatherSummary = [weather.temp ? `${weather.temp}°F` : "", weather.condition, weather.wind]
    .filter(Boolean)
    .join(", ") || "Unavailable";
  const milestoneNotes = playerMilestoneNotes(feed);
  const gameDurationMinutes = feed.gameData?.gameInfo?.gameDurationMinutes;
  const gameDuration = gameDurationLabel(gameDurationMinutes);
  const absChallenges = absChallengeNotes(feed);
  const attendanceLabel = Number.isFinite(attendance) && attendance > 0 ? attendance.toLocaleString("en-US") : "Unavailable";
  const ballpark = feed.gameData?.venue?.name || game.venue?.name || "Ballpark unavailable";
  const allPlays = feed.liveData?.plays?.allPlays || [];
  const firstPlayEvents = allPlays[0]?.playEvents || [];
  const lastPlayEvents = allPlays[allPlays.length - 1]?.playEvents || [];
  const gameStart = firstPlayEvents[0]?.startTime || feed.gameData?.datetime?.dateTime || game.gameDate;
  const gameEnd = lastPlayEvents[lastPlayEvents.length - 1]?.endTime;
  const gameDelay = gameDelayLabel(gameStart, gameEnd, gameDurationMinutes);
  const gameInformation = [
    `Game Start Time: ${gameClockTime(gameStart, "TBD")}`,
    `Game End Time: ${gameClockTime(gameEnd)}`,
    `Game Time: ${gameDuration}${gameDelay ? ` (${gameDelay} delay)` : ""}`,
    `Attendance: ${attendanceLabel} (${ballpark})`,
    `Weather: ${weatherSummary}`,
  ];

  els.status.textContent = isLiveGame(game) ? "Live game updating" : "Latest final loaded";
  els.status.style.color = isLiveGame(game) ? "#f6d365" : "#9af0c8";
  els.title.textContent = `${resultLabel(game)} vs ${teamAbbreviation(opponent)}`;
  els.subtitle.textContent = `${niceDate(game.officialDate)} - ${game.venue?.name || "Ballpark"} - ${scoreLine(game)}`;
  els.scoreboard.innerHTML = `
    <div class="home-score-team-colors" aria-hidden="true">
      <span style="background-color: ${awayPrimaryColor}"></span>
      <span style="background-color: ${homePrimaryColor}"></span>
    </div>
    ${isLiveGame(game) ? `
      <div class="game-live-status-row">
        <span><strong>Live:</strong> ${escapeHtml(game.status?.detailedState || "In Progress")}</span>
        <i aria-hidden="true">|</i>
        <span><strong>Inning:</strong> ${escapeHtml(liveLabel || "In Progress")}</span>
        ${broadcastLabel ? `
          <i aria-hidden="true">|</i>
          <span><strong>Watch:</strong> ${escapeHtml(broadcastLabel)}</span>
        ` : ""}
      </div>
    ` : ""}
    <div class="game-scoreboard-top ${gameResultClass}">
      ${renderScoreboardTeam(awayScoreDetails, "away", scoreForSide(game, feed, "away"))}
      <strong class="scoreboard-score">${escapeHtml(scoreForSide(game, feed, "away"))}</strong>
      <div class="scoreboard-state">${escapeHtml(scoreboardState(feed, game))}</div>
      <strong class="scoreboard-score">${escapeHtml(scoreForSide(game, feed, "home"))}</strong>
      ${renderScoreboardTeam(homeScoreDetails, "home", scoreForSide(game, feed, "home"))}
    </div>
    <div class="game-scoreboard-lower">
      <div class="game-linescore-box">${renderLinescore(feed, game)}</div>
      <div class="game-decisions${isLiveGame(game) ? " live-matchup-slot" : ""}">
        ${isLiveGame(game) ? `
          ${renderCurrentMatchup(feed, liveCurrentPlay.matchup || {})}
        ` : `
          <p><span class="win-label">W:</span><span class="decision-pitcher">${escapeHtml(formatDecisionPitcher(decisions.winner, feed))}</span></p>
          <p><span class="loss-label">L:</span><span class="decision-pitcher">${escapeHtml(formatDecisionPitcher(decisions.loser, feed))}</span></p>
          <p><span class="save-label">SV:</span><span class="decision-pitcher">${escapeHtml(formatDecisionPitcher(decisions.save, feed))}</span></p>
        `}
      </div>
    </div>
    ${renderGameSituation(feed, game)}
  `;
  renderGamePlayerStats(feed, side, game);

  els.grid.innerHTML = [
    `<header class="recap-grid-heading"><h2>Team Comparison</h2><p>Side-by-side totals, game-wide metrics, and notes</p></header>`,
    renderRecapColumn("Hitting", [
      comparisonLegend(opponentAbbr),
      ...[
        ["Hits", "hits"], ["Doubles", "doubles"], ["Triples", "triples"], ["Home Runs", "homeRuns"],
        ["Walks", "baseOnBalls"], ["Strikeouts", "strikeOuts"],
      ].map(([label, key]) => comparisonRow(label, statValue(yankeesComparison.batting, key), statValue(opponentComparison.batting, key), comparisonOptions)),
      comparisonRow("Team LOB", statValue(yankeesComparison.line, "leftOnBase", statValue(yankeesComparison.batting, "leftOnBase")), statValue(opponentComparison.line, "leftOnBase", statValue(opponentComparison.batting, "leftOnBase")), comparisonOptions),
      comparisonRow("Stolen Bases", statValue(yankeesComparison.batting, "stolenBases", 0), statValue(opponentComparison.batting, "stolenBases", 0), comparisonOptions),
      comparisonRow("Caught Stealing", statValue(yankeesComparison.batting, "caughtStealing", 0), statValue(opponentComparison.batting, "caughtStealing", 0), comparisonOptions),
      comparisonRow("GIDP", statValue(yankeesComparison.batting, "groundIntoDoublePlay"), statValue(opponentComparison.batting, "groundIntoDoublePlay"), comparisonOptions),
    ].join("")),
    renderRecapColumn("Pitching", [
      comparisonLegend(opponentAbbr),
      ...[
        ["Strikeouts", "strikeOuts"], ["Walks", "baseOnBalls"], ["Hits Allowed", "hits"], ["HR Allowed", "homeRuns"],
        ["Earned Runs", "earnedRuns"], ["Ground Balls", "groundOuts"], ["Fly Balls", "airOuts"],
        ["Innings", "inningsPitched"], ["Pitches", "numberOfPitches"],
      ].map(([label, key]) => comparisonRow(label, statValue(yankeesComparison.pitching, key), statValue(opponentComparison.pitching, key), comparisonOptions)),
      comparisonRow("Strike %", yankeesComparison.strikePercentage, opponentComparison.strikePercentage, { ...comparisonOptions, yankeesDisplay: yankeesComparison.strikePercentage ? `${yankeesComparison.strikePercentage}%` : "-", opponentDisplay: opponentComparison.strikePercentage ? `${opponentComparison.strikePercentage}%` : "-" }),
    ].join("")),
    renderRecapColumn("Metrics and Game Notes", [
      metricFeature("Longest Home Run", gameMetrics.longestHomeRun ? Math.round(gameMetrics.longestHomeRun.value) : "-", gameMetrics.longestHomeRun ? "FT" : "", gameMetrics.longestHomeRun ? `${gameMetrics.longestHomeRun.player} (${gameMetrics.longestHomeRun.team}) - ${gameMetrics.longestHomeRun.detail}` : "No tracked home run", "ruler-measure"),
      metricFeature("Max Exit Velo", gameMetrics.maxExit ? gameMetrics.maxExit.value.toFixed(1) : "-", "MPH", gameMetrics.maxExit ? `${gameMetrics.maxExit.player} (${gameMetrics.maxExit.team}) - ${gameMetrics.maxExit.detail}` : "No tracked batted balls", "gauge"),
      metricFeature("Max Pitch Velo", gameMetrics.maxPitch ? gameMetrics.maxPitch.value.toFixed(1) : "-", "MPH", gameMetrics.maxPitch ? `${gameMetrics.maxPitch.player} (${gameMetrics.maxPitch.team}) - ${gameMetrics.maxPitch.detail}` : "No tracked pitches", "ball-baseball"),
      ...milestoneNotes.map((note) => gameNoteFeature("Player Milestone", note, "trophy")),
      gameNoteFeature("ABS Challenges", absChallenges, "scale"),
      gameNoteFeature("Game Information", gameInformation, "info-circle"),
    ].join(""), "metrics-column"),
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
    const divisionRanks = loadDivisionRanks().catch(() => null);
    const [liveGame, games, upcomingGames] = await Promise.all([
      getTodaysLiveGame().catch(() => null),
      getRecentFinalGames(),
      getUpcomingGames().catch(() => []),
    ]);
    await divisionRanks;
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
          <p><span class="win-label">W:</span><span class="decision-pitcher">Try again shortly</span></p>
          <p><span class="loss-label">L:</span><span class="decision-pitcher">${escapeHtml(error.message)}</span></p>
          <p><span class="save-label">SV:</span><span class="decision-pitcher">None</span></p>
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
