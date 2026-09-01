const TEAM_ID = 147;
const MLB_API = "https://statsapi.mlb.com/api/v1";
const MLB_LIVE_API = "https://statsapi.mlb.com/api/v1.1";
const HARD_HIT_MPH = 95;
const LIVE_REFRESH_MS = 15000;
const DISMISSED_ALERTS_KEY = "yankees-dismissed-alerts";
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
const alertDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
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
  comparisonHeader: document.querySelector("#team-comparison-header"),
  recent: document.querySelector("#recent-games-grid"),
  recapButtons: document.querySelector("#recap-button-row"),
  grid: document.querySelector("#recap-grid"),
  breakingNews: document.querySelector("#breaking-news"),
  breakingNewsTitle: document.querySelector("#breaking-news-title"),
  breakingNewsItems: document.querySelector("#breaking-news-items"),
  breakingNewsClose: document.querySelector("#breaking-news-close"),
};

const state = {
  recentGames: [],
  seasonGames: [],
  liveGame: null,
  todayGame: null,
  selectedGame: null,
  currentFeed: null,
  upcomingGames: [],
  divisionRanks: {},
  playerStatsTeam: "yankees",
  liveRefreshTimer: null,
  absChallengeEvents: [],
  breakingNewsKey: "",
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
  const yankees = game.teams?.[yankeesSide(game)];
  const opponent = game.teams?.[opponentSide(game)];
  return `NYY ${yankees?.score ?? "-"}, ${teamAbbreviation(opponent?.team)} ${opponent?.score ?? "-"}`;
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

async function getCurrentGames() {
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + 45);
  const schedule = await getJson("/schedule", {
    sportId: 1, teamId: TEAM_ID, startDate: formatDate(start), endDate: formatDate(end),
    hydrate: "team,venue,linescore,broadcasts(all),probablePitcher",
  });
  const games = (schedule.dates || []).flatMap((day) => day.games || []);
  const todaysGames = games.filter((game) => game.officialDate === formatDate(start));
  const todayGame = todaysGames.find((game) => isLiveGame(game))
    || todaysGames.find((game) => game.status?.abstractGameState === "Preview")
    || [...todaysGames].sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate))[0]
    || null;
  const upcomingGames = games
    .filter((game) => !["Final", "Live"].includes(game.status?.abstractGameState))
    .sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate))
    .slice(0, 3);
  return { todayGame, upcomingGames };
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

function renderDecisionPitcher(label, labelClass, player, feed, detailOverride = "") {
  const person = player?.person || player;
  const name = person?.fullName || person?.initLastName || person?.lastName || "None";
  const stats = player?.seasonStats?.pitching || decisionPitchingStats(person, feed);
  const hasRecord = stats.wins !== undefined && stats.losses !== undefined;
  const details = detailOverride || (player
    ? [hasRecord ? `${stats.wins}-${stats.losses}` : "", stats.era !== undefined ? `${stats.era} ERA` : ""]
      .filter(Boolean)
      .join(", ") || "Stats unavailable"
    : "No decision");
  const image = playerHeadshotUrl(person?.id);
  const tag = person?.id ? "a" : "article";
  const link = person?.id ? ` href="./player-profile/?player=${escapeHtml(person.id)}"` : "";

  return `
    <${tag} class="decision-card"${link}>
      ${image
        ? `<img class="decision-player-portrait" src="${escapeHtml(image)}" alt="${escapeHtml(`${name} headshot`)}" />`
        : `<span class="decision-player-portrait decision-player-placeholder" aria-hidden="true">&mdash;</span>`}
      <span class="decision-player-copy">
        <strong>${escapeHtml(name)}</strong>
        <small>${escapeHtml(details)}</small>
      </span>
      <span class="decision-label ${labelClass}"${label === "POTG" ? ` title="Site-selected by Win Probability Added"` : ""}>${escapeHtml(label)}</span>
    </${tag}>
  `;
}

function pitcherGameScore(player, feed) {
  const person = player?.person || player;
  const pitching = boxscorePlayer(feed, person?.id)?.stats?.pitching;
  if (!pitching?.inningsPitched) return null;

  const inningsParts = String(pitching.inningsPitched).split(".");
  const completedInnings = Number(inningsParts[0] || 0);
  const outs = completedInnings * 3 + Number(inningsParts[1] || 0);
  const earnedRuns = Number(pitching.earnedRuns || 0);
  const unearnedRuns = Math.max(0, Number(pitching.runs || 0) - earnedRuns);
  return 50
    + outs
    + Math.max(0, completedInnings - 4) * 2
    + Number(pitching.strikeOuts || 0)
    - Number(pitching.hits || 0) * 2
    - earnedRuns * 4
    - unearnedRuns * 2
    - Number(pitching.baseOnBalls || 0);
}

function pitcherDecisionDetails(player, feed, gameScore) {
  if (!player) return "No decision";
  const person = player.person || player;
  const season = player.seasonStats?.pitching || decisionPitchingStats(person, feed);
  const record = season.wins !== undefined && season.losses !== undefined
    ? `${season.wins}-${season.losses}`
    : "";
  const era = season.era !== undefined ? `${season.era} ERA` : "";
  return [record, era, gameScore === null ? "GS unavailable" : `GS ${gameScore}`]
    .filter(Boolean)
    .join(" · ");
}

function playerGameSummary(player) {
  const pitching = player?.stats?.pitching || {};
  if (pitching.inningsPitched) {
    return `${pitching.inningsPitched} IP, ${Number(pitching.earnedRuns || 0)} ER, ${Number(pitching.strikeOuts || 0)} K`;
  }

  const batting = player?.stats?.batting || {};
  const hits = Number(batting.hits || 0);
  const atBats = Number(batting.atBats || 0);
  return [`${hits}-${atBats}`, Number(batting.homeRuns || 0) ? `${batting.homeRuns} HR` : "", Number(batting.rbi || 0) ? `${batting.rbi} RBI` : ""]
    .filter(Boolean)
    .join(", ");
}

function gamePlayerOfTheGame(feed) {
  const boxscoreTeams = feed.liveData?.boxscore?.teams || {};
  const playersById = new Map(Object.values(boxscoreTeams).flatMap((team) =>
    Object.values(team?.players || {}).map((player) => [Number(player.person?.id), player])
  ));
  const playerWpa = new Map();

  (feed._winProbability || []).forEach((play) => {
    const homeChange = Number(play.homeTeamWinProbabilityAdded);
    const batterId = Number(play.matchup?.batter?.id);
    const pitcherId = Number(play.matchup?.pitcher?.id);
    if (!Number.isFinite(homeChange) || !batterId || !pitcherId) return;
    const batterChange = play.about?.isTopInning ? -homeChange : homeChange;
    const pitcherChange = -batterChange;
    playerWpa.set(batterId, (playerWpa.get(batterId) || 0) + batterChange);
    playerWpa.set(pitcherId, (playerWpa.get(pitcherId) || 0) + pitcherChange);
  });

  const leader = [...playerWpa.entries()]
    .filter(([playerId]) => playersById.has(playerId))
    .sort((a, b) => b[1] - a[1])[0];
  if (!leader) return null;
  const player = playersById.get(leader[0]);
  return {
    player,
    details: `${playerGameSummary(player)} · WPA ${leader[1] >= 0 ? "+" : ""}${leader[1].toFixed(1)}%`,
  };
}

function renderWinProbabilityChart(feed, game) {
  const plays = (feed._winProbability || []).filter((play) =>
    Number.isFinite(Number(play.homeTeamWinProbability)) && Number(play.about?.inning) > 0
  );
  if (!plays.length) return "";

  const yankeesAreHome = Number(game.teams?.home?.team?.id) === TEAM_ID;
  const width = 1400;
  const height = 220;
  const plot = { left: 0, right: 0, top: 18, bottom: 34 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const points = [{ probability: 50, x: plot.left, play: null }].concat(plays.map((play, index) => {
    const homeProbability = Number(play.homeTeamWinProbability);
    return {
      probability: yankeesAreHome ? homeProbability : 100 - homeProbability,
      x: plot.left + ((index + 1) / plays.length) * plotWidth,
      play,
    };
  }));
  const y = (probability) => plot.top + ((100 - probability) / 100) * plotHeight;
  const linePoints = points.map((point) => `${point.x.toFixed(2)},${y(point.probability).toFixed(2)}`).join(" ");
  const areaPoints = `${plot.left},${y(0)} ${linePoints} ${width - plot.right},${y(0)}`;
  const innings = new Map();
  plays.forEach((play, index) => {
    const inning = Number(play.about.inning);
    const entry = innings.get(inning) || { first: index, last: index };
    entry.last = index;
    innings.set(inning, entry);
  });
  const inningMarkup = [...innings.entries()].map(([inning, range], index, entries) => {
    const startX = plot.left + (range.first / plays.length) * plotWidth;
    const endX = plot.left + ((range.last + 1) / plays.length) * plotWidth;
    const separator = index ? `<line x1="${startX.toFixed(2)}" y1="${plot.top}" x2="${startX.toFixed(2)}" y2="${y(0)}" class="win-probability-inning-line" />` : "";
    return `${separator}<text x="${((startX + endX) / 2).toFixed(2)}" y="${height - 10}" class="win-probability-inning-label">${inning}</text>`;
  }).join("");
  const scoringEvents = points.filter((point) => point.play?.about?.isScoringPlay);
  const scoringPoints = scoringEvents.map((point) => {
    const play = point.play;
    const title = `${play.about?.halfInning === "bottom" ? "Bot" : "Top"} ${play.about?.inning}: ${play.result?.description || play.result?.event || "Scoring play"} Yankees win probability ${point.probability.toFixed(1)}%`;
    return `<circle cx="${point.x.toFixed(2)}" cy="${y(point.probability).toFixed(2)}" r="6" class="win-probability-scoring-point" tabindex="0" data-win-probability-tooltip="${escapeHtml(title)}" />`;
  }).join("");
  const finalProbability = points.at(-1).probability;
  const displayedProbability = isLiveGame(game)
    ? finalProbability.toFixed(1)
    : finalProbability.toFixed(0);
  const probabilityValues = points.map((point) => point.probability);
  const lowestProbability = Math.min(...probabilityValues);
  const highestProbability = Math.max(...probabilityValues);
  const largestSwing = points.slice(1).map((point, index) => ({
    point,
    change: point.probability - points[index].probability,
  })).sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0];
  const largestSwingInning = largestSwing?.point.play?.about
    ? `${largestSwing.point.play.about.halfInning === "bottom" ? "Bot" : "Top"} ${largestSwing.point.play.about.inning}`
    : "Game";

  return `
    <section class="win-probability-panel" aria-labelledby="win-probability-title">
      <header class="win-probability-header">
        <div>
          <h3 id="win-probability-title">Yankees Win Probability</h3>
          <p>Plate-by-plate game momentum</p>
        </div>
        <strong>${displayedProbability}%</strong>
      </header>
      <div class="win-probability-chart-scroll">
        <svg class="win-probability-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Yankees win probability by inning">
          ${[100, 75, 50, 25, 0].map((value) => `
            <line x1="${plot.left}" y1="${y(value)}" x2="${width - plot.right}" y2="${y(value)}" class="win-probability-grid-line${value === 50 ? " is-midline" : ""}" />
            <text x="${plot.left}" y="${y(value) - 5}" class="win-probability-axis-label">${value}%</text>
          `).join("")}
          ${inningMarkup}
          <polygon points="${areaPoints}" class="win-probability-area" />
          <polyline points="${linePoints}" pathLength="1000" class="win-probability-line" />
          ${scoringPoints}
        </svg>
      </div>
      <div class="win-probability-mobile-summary">
        <div class="win-probability-mobile-metrics">
          <span><small>Final</small><strong>${finalProbability.toFixed(1)}%</strong></span>
          <span><small>Game range</small><strong>${lowestProbability.toFixed(1)}–${highestProbability.toFixed(1)}%</strong></span>
          <span><small>Largest swing</small><strong>${largestSwing?.change >= 0 ? "+" : ""}${(largestSwing?.change || 0).toFixed(1)}%</strong><em>${escapeHtml(largestSwingInning)}</em></span>
        </div>
        ${scoringEvents.length ? `
          <div class="win-probability-mobile-events">
            <h4>After scoring plays</h4>
            ${[...scoringEvents].reverse().map((point) => {
              const play = point.play;
              const inning = `${play.about?.halfInning === "bottom" ? "Bot" : "Top"} ${play.about?.inning}`;
              return `<p><span><strong>${escapeHtml(inning)}</strong>${escapeHtml(play.result?.event || "Scoring play")}</span><b>${point.probability.toFixed(1)}%</b></p>`;
            }).join("")}
          </div>
        ` : ""}
      </div>
    </section>
  `;
}

function renderLinescore(feed, game) {
  const linescore = feed.liveData?.linescore || {};
  const innings = linescore.innings || [];
  const inningNumbers = innings.map((inning) => inning.num);
  const minimumInnings = isLiveGame(game) ? Math.max(9, ...inningNumbers, 0) : Math.max(...inningNumbers, 9);
  const displayedInnings = Array.from({ length: minimumInnings }, (_, index) => index + 1);
  const inningMap = new Map(innings.map((inning) => [inning.num, inning]));
  const teams = [
    [yankeesSide(game), game.teams?.[yankeesSide(game)]?.team],
    [opponentSide(game), game.teams?.[opponentSide(game)]?.team],
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

function linkedPlayerText(value, feed) {
  const players = Object.values(feed.liveData?.boxscore?.teams || {}).flatMap((team) =>
    Object.values(team?.players || {})
  );
  const people = new Map(players
    .filter((player) => player.person?.id && player.person?.fullName)
    .map((player) => [player.person.fullName.toLowerCase(), player.person]));
  if (!people.size) return escapeHtml(value);

  const names = [...people.values()]
    .map((person) => person.fullName)
    .sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`(${names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return String(value).split(pattern).map((part) => {
    const person = people.get(part.toLowerCase());
    return person
      ? `<a class="inline-player-profile-link" href="./player-profile/?player=${escapeHtml(person.id)}">${escapeHtml(part)}</a>`
      : escapeHtml(part);
  }).join("");
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
  const tag = person?.id ? "a" : "div";
  const link = person?.id ? ` href="./player-profile/?player=${escapeHtml(person.id)}"` : "";
  return `
    <${tag} class="matchup-player ${role}"${link}>
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" />` : ""}
      <div class="matchup-player-copy">
        <strong>${escapeHtml(name)}</strong>
        <span>${escapeHtml(hand || "")}</span>
        <small>${escapeHtml(matchupStatLine(player, role))}</small>
      </div>
    </${tag}>
  `;
}

function renderBaseDiamond(linescore, game) {
  const offense = linescore.offense || {};
  const outs = Math.max(0, Math.min(3, Number(linescore.outs) || 0));
  return `
    <div class="matchup-state" aria-label="${escapeHtml(outs)} outs">
      <div class="base-diamond" aria-label="Current base runners">
        <span class="base second${offense.second ? " occupied" : ""}" aria-label="Second base${offense.second ? " occupied" : " empty"}"></span>
        <span class="base third${offense.third ? " occupied" : ""}" aria-label="Third base${offense.third ? " occupied" : " empty"}"></span>
        <span class="base first${offense.first ? " occupied" : ""}" aria-label="First base${offense.first ? " occupied" : " empty"}"></span>
      </div>
      <strong>${escapeHtml(linescore.teams?.[yankeesSide(game)]?.runs ?? 0)} - ${escapeHtml(linescore.teams?.[opponentSide(game)]?.runs ?? 0)}</strong>
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
    const opponent = game.teams?.[opponentSide(game)]?.team || feed.gameData?.teams?.[opponentSide(game)] || {};
    const inning = ordinalInning(play.about?.inning);
    const result = play.result || {};
    const yankeesScore = yankeesSide(game) === "away" ? result.awayScore : result.homeScore;
    const opponentScore = opponentSide(game) === "away" ? result.awayScore : result.homeScore;
    const conciseDescription = scoringPlaySummary(play);
    const probabilityPlay = (feed._winProbability || []).find((candidate) =>
      Number(candidate.atBatIndex ?? candidate.about?.atBatIndex) === Number(play.about?.atBatIndex)
    );
    const homeProbability = Number(probabilityPlay?.homeTeamWinProbability);
    const yankeesProbability = Number.isFinite(homeProbability)
      ? (Number(game.teams?.home?.team?.id) === TEAM_ID ? homeProbability : 100 - homeProbability)
      : null;
    return `
      <article class="scoring-play ${scoringTeamClass}" style="--scoring-team-color: ${teamPrimaryColor(team)}">
        <div class="scoring-play-identity">
          <img src="${escapeHtml(teamLogoUrl(team))}" alt="" aria-hidden="true" />
          <span>
            <strong class="scoring-play-team">${escapeHtml(teamAbbreviation(team))}</strong>
            <small class="scoring-play-inning">${escapeHtml(`${half} ${inning}`)}</small>
          </span>
        </div>
        <p>${linkedPlayerText(conciseDescription || "Scoring play", feed)}</p>
        <div class="scoring-play-metrics">
          <span class="scoring-play-scoreline">
            <b>NYY</b>
            <strong>${escapeHtml(yankeesScore ?? "-")}</strong>
            <i aria-hidden="true">–</i>
            <strong>${escapeHtml(opponentScore ?? "-")}</strong>
            <b>${escapeHtml(teamAbbreviation(opponent))}</b>
          </span>
          ${yankeesProbability === null ? "" : `<small class="scoring-play-probability">NYY WP ${yankeesProbability.toFixed(1)}%</small>`}
        </div>
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
  const teamBox = feed.liveData?.boxscore?.teams?.[side] || {};
  const officialGroups = (teamBox.info || []).filter((group) =>
    ["batting", "baserunning", "fielding", "pitching"].includes(String(group.title || "").toLowerCase())
  );
  const batting = teamBox.teamStats?.batting || {};
  const fielding = teamBox.teamStats?.fielding || {};
  const pitching = teamBox.teamStats?.pitching || {};
  const lineTeam = feed.liveData?.linescore?.teams?.[side] || {};
  const stat = (key, fallback = 0) => statValue(batting, key, fallback);
  const detailRow = (label, value) => `<p><strong>${escapeHtml(label)}</strong> ${linkedPlayerText(Array.isArray(value) ? value.join("; ") : value, feed)}</p>`;
  const shouldShowDetailField = (field) => {
    const label = String(field?.label || "").trim().toLowerCase();
    if (["sac", "sf"].includes(label.replace(/:$/, ""))) return false;
    if (/\b2[\s-]*out\s+rbi\b/.test(label)) return false;
    return !(
      label.includes("runners left in scoring position")
      && label.includes("2 out")
    );
  };
  const officialGroup = (title) => officialGroups.find((group) =>
    String(group.title || "").toLowerCase() === title.toLowerCase()
  );
  const detailGroup = (title, fallbackFields) => {
    const needsPlayerAttribution = title === "Fielding" || title === "Pitching";
    const fields = (needsPlayerAttribution ? fallbackFields : (officialGroup(title)?.fieldList || fallbackFields))
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
  const players = teamBox.players || {};
  const pitcherEntries = (teamBox.pitchers || [])
    .map((playerId) => players[`ID${playerId}`])
    .filter((player) => player?.person && player.stats?.pitching);
  const playerFieldingSummary = (statKey) => Object.values(players)
    .filter((player) => Number(player.stats?.fielding?.[statKey] || 0) > 0)
    .map((player) => `${player.person?.fullName || "Player"} (${player.stats.fielding[statKey]})`)
    .join(", ") || "none";
  const playerPitchingSummary = (...keys) => pitcherEntries
    .map((player) => {
      const stats = player.stats.pitching;
      const value = keys.reduce((result, key) => result || Number(stats[key] || 0), 0);
      return value > 0 ? `${player.person.fullName} (${value})` : "";
    })
    .filter(Boolean)
    .join(", ") || "none";
  const pitcherPitchCounts = pitcherEntries
    .map((player) => {
      const stats = player.stats.pitching;
      const pitches = Number(stats.numberOfPitches ?? stats.pitchesThrown ?? 0);
      return pitches > 0 ? `${player.person.fullName} (${pitches}-${Number(stats.strikes || 0)})` : "";
    })
    .filter(Boolean);
  const pitcherInheritedRunners = pitcherEntries
    .map((player) => {
      const stats = player.stats.pitching;
      const inherited = Number(stats.inheritedRunners || 0);
      return inherited > 0
        ? `${player.person.fullName} (${inherited}-${Number(stats.inheritedRunnersScored || 0)})`
        : "";
    })
    .filter(Boolean)
    .join(", ");
  const pitchingDetails = [
    positivePitchingStat("WP", "wildPitches") ? { label: "WP", value: playerPitchingSummary("wildPitches") } : null,
    positivePitchingStat("HBP", "hitBatsmen", "hitBatters") ? { label: "HBP", value: playerPitchingSummary("hitBatsmen", "hitBatters") } : null,
    positivePitchingStat("BK", "balks") ? { label: "BK", value: playerPitchingSummary("balks") } : null,
    inheritedRunners > 0 ? { label: "IR-IRS", value: pitcherInheritedRunners || `${inheritedRunners}-${inheritedScored}` } : null,
    positivePitchingStat("HLD", "holds") ? { label: "HLD", value: playerPitchingSummary("holds") } : null,
    positivePitchingStat("SV", "saves") ? { label: "SV", value: playerPitchingSummary("saves") } : null,
    positivePitchingStat("BS", "blownSaves") ? { label: "BS", value: playerPitchingSummary("blownSaves") } : null,
    pitchCount > 0 ? { label: "P-S", value: pitcherPitchCounts.length ? pitcherPitchCounts : [`${pitchCount}-${strikeCount}`] } : null,
  ].filter(Boolean);

  return {
    batting: detailGroup("Batting", [
      { label: "2B", value: playerStatSummary(teamBox, "doubles") },
      { label: "3B", value: playerStatSummary(teamBox, "triples") },
      { label: "HR", value: playerStatSummary(teamBox, "homeRuns") },
      { label: "RBI", value: playerStatSummary(teamBox, "rbi") },
      { label: "Team RISP", value: `${stat("hitsRisp")}-${stat("atBatsRisp")}` },
      { label: "Team LOB", value: lineTeam.leftOnBase ?? stat("leftOnBase") },
    ]),
    baserunning: detailGroup("Baserunning", [
      { label: "SB", value: playerStatSummary(teamBox, "stolenBases") },
      { label: "CS", value: playerStatSummary(teamBox, "caughtStealing") },
    ]),
    fielding: detailGroup("Fielding", [
      { label: "DP", value: `${statValue(fielding, "doublePlays", stat("groundIntoDoublePlay"))}; involved: ${playerFieldingSummary("doublePlays")}` },
      { label: "E", value: `${statValue(fielding, "errors", lineTeam.errors ?? 0)}; charged to: ${playerFieldingSummary("errors")}` },
    ]),
    pitching: detailGroup("Pitching", pitchingDetails),
  };
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

function renderCurrentMatchup(feed, game, matchup, linescore = feed.liveData?.linescore || {}) {
  return `
    <div class="current-matchup-grid">
      ${renderMatchupPlayer(feed, matchup.pitcher, "pitcher", matchup.pitchHand?.code ? `${matchup.pitchHand.code}HP` : "")}
      ${renderBaseDiamond(linescore, game)}
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
  const battingHeaders = ["Player", "AB", "R", "H", "HR", "RBI", "BB", "SO", "AVG"];
  const pitchingHeaders = ["Player", "IP", "H", "R", "ER", "BB", "SO", "HR", "ERA"];
  const battingEntries = (teamBox.batters || []).map((playerId) => players[`ID${playerId}`]).filter((player) => {
    const stats = player?.stats?.batting || {};
    return player?.person && (Number(stats.plateAppearances || 0) > 0 || Number(stats.atBats || 0) > 0);
  }).map((player) => {
    const stats = player.stats.batting || {};
    const seasonAverage = player.seasonStats?.batting?.avg || "-";
    const values = [stats.atBats, stats.runs, stats.hits, stats.homeRuns, stats.rbi, stats.baseOnBalls, stats.strikeOuts, seasonAverage];
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
    const values = [stats.inningsPitched, stats.hits, stats.runs, stats.earnedRuns, stats.baseOnBalls, stats.strikeOuts, stats.homeRuns, seasonEra];
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

  const teamSwitcher = `
      <div class="game-player-team-switcher" role="group" aria-label="Team box score and player statistics">
        <button class="game-player-team-button${state.playerStatsTeam === "yankees" ? " active" : ""}" style="--team-toggle-color:${yankeesToggleColor};--team-toggle-text:${contrastTextColor(yankeesToggleColor)}" type="button" data-player-stats-team="yankees" aria-pressed="${state.playerStatsTeam === "yankees"}">Yankees</button>
        <button class="game-player-team-button${state.playerStatsTeam === "opponent" ? " active" : ""}" style="--team-toggle-color:${opponentToggleColor};--team-toggle-text:${contrastTextColor(opponentToggleColor)}" type="button" data-player-stats-team="opponent" aria-pressed="${state.playerStatsTeam === "opponent"}">${escapeHtml(opponentName)}</button>
      </div>
  `;

  els.comparisonHeader.innerHTML = `
    <div><h2>Team Comparison</h2><p>Side-by-side totals, game-wide metrics, and notes</p></div>
    ${teamSwitcher}
  `;
  els.playerStats.innerHTML = `
    <article class="game-player-column batting-column">
      <h3>${escapeHtml(selectedTeamName)} Batting</h3>
      ${renderGameStatTable(battingHeaders, battingRows, battingEntries, ["AB", "H", "RBI", "AVG"], `No ${selectedTeamName} batting statistics are available yet.`)}
    </article>
    <article class="game-player-column pitching-column">
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

async function getBreakingTransactions() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 2);
  const data = await getJson("/transactions", {
    teamId: TEAM_ID,
    startDate: formatDate(start),
    endDate: formatDate(end),
  });
  return data.transactions || [];
}

function renderBreakingNews(alerts) {
  els.breakingNewsItems.replaceChildren();
  if (!alerts.length) {
    state.breakingNewsKey = "";
    els.breakingNews.hidden = true;
    return;
  }

  const hasGameAlerts = alerts.some((alert) => alert.kind === "game" || alert.kind === "weather");
  const hasTransactions = alerts.some((alert) => alert.kind !== "game" && alert.kind !== "weather");
  els.breakingNewsTitle.textContent = hasGameAlerts
    ? (hasTransactions ? "Game Alerts & Transactions" : "Game Alerts")
    : "Latest Transactions";
  state.breakingNewsKey = alerts.map((alert) => alert.id || `${alert.label}:${alert.text}`).join("|");
  try {
    if (localStorage.getItem(DISMISSED_ALERTS_KEY) === state.breakingNewsKey) {
      els.breakingNews.hidden = true;
      return;
    }
  } catch (error) {
    // Storage can be unavailable; dismissal still works for the current page view.
  }

  alerts.forEach((alert) => {
    const item = document.createElement("article");
    item.className = `breaking-news-item ${alert.kind || "team-news"}`;
    const label = document.createElement("strong");
    label.textContent = alert.label;
    item.append(label);
    if (alert.date) {
      const marker = document.createElement("span");
      marker.className = "breaking-news-marker";
      marker.setAttribute("aria-hidden", "true");
      marker.textContent = "•";
      const date = document.createElement("time");
      date.dateTime = alert.date;
      const parsedDate = new Date(`${alert.date}T12:00:00`);
      date.textContent = Number.isNaN(parsedDate.getTime()) ? alert.date : alertDateFormatter.format(parsedDate);
      item.append(marker, date);
    }
    const marker = document.createElement("span");
    marker.className = "breaking-news-marker";
    marker.setAttribute("aria-hidden", "true");
    marker.textContent = "•";
    const description = document.createElement("p");
    description.textContent = alert.text;
    item.append(marker, description);
    els.breakingNewsItems.append(item);
  });
  els.breakingNews.hidden = false;
}

async function loadBreakingNews(todayGame, upcomingGames, transactions) {
  const games = [todayGame, ...upcomingGames]
    .filter(Boolean)
    .filter((game, index, list) => list.findIndex((item) => Number(item.gamePk) === Number(game.gamePk)) === index);
  const weatherGame = upcomingGames[0]
    || games.find((game) => !["Final", "Live"].includes(game.status?.abstractGameState))
    || null;
  const timeUntilStart = new Date(weatherGame?.gameDate).getTime() - Date.now();
  let weatherFeed = null;

  if (weatherGame && timeUntilStart >= 0 && timeUntilStart <= 12 * 60 * 60 * 1000) {
    try {
      weatherFeed = await getLiveJson(`/game/${weatherGame.gamePk}/feed/live`);
    } catch (error) {
      weatherFeed = null;
    }
  }

  renderBreakingNews(HomeAlerts.build({ games, transactions, weatherGame, weatherFeed }));
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

let winProbabilityRevealed = false;
let winProbabilityObserver = null;

function prepareWinProbabilityReveal() {
  winProbabilityObserver?.disconnect();
  winProbabilityObserver = null;
  const chart = els.scoreboard.querySelector(".win-probability-chart");
  if (!chart) return;
  chart.classList.remove("chart-awaiting-reveal");
  if (winProbabilityRevealed || window.matchMedia("(prefers-reduced-motion: reduce)").matches
    || !("IntersectionObserver" in window) || !("animate" in Element.prototype)) return;
  chart.classList.add("chart-awaiting-reveal");
  winProbabilityObserver = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    winProbabilityObserver.disconnect();
    chart.classList.remove("chart-awaiting-reveal");
    winProbabilityRevealed = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    chart.querySelector(".win-probability-line")?.animate(
      [{ strokeDasharray: "1000", strokeDashoffset: "1000" }, { strokeDasharray: "1000", strokeDashoffset: "0" }],
      { duration: 1000, easing: "ease-out" }
    );
    chart.querySelector(".win-probability-area")?.animate(
      [{ opacity: 0 }, { opacity: 1 }], { duration: 1000, easing: "ease-out" }
    );
  }, { threshold: 0 });
  winProbabilityObserver.observe(chart);
}

function highlightChangedScores(previousScores) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("animate" in Element.prototype)) return;
  const scores = [...els.scoreboard.querySelectorAll(".game-scoreboard-top > .scoreboard-score")];
  scores.forEach((score, index) => {
    const previous = Number(previousScores[index]);
    const current = Number(score.textContent.trim());
    if (!previousScores[index]?.trim() || !Number.isFinite(previous) || !Number.isFinite(current) || previous === current) return;
    const mobileScore = els.scoreboard.querySelector(`.scoreboard-team.${index === 0 ? "away" : "home"} .scoreboard-mobile-score`);
    [score, mobileScore].filter(Boolean).forEach((node) => node.animate(
      [{ backgroundColor: "rgba(154, 198, 235, 0.28)" }, { backgroundColor: "transparent" }],
      { duration: 1100, easing: "ease-out" }
    ));
  });
}

const revealedComparisonColumns = new Set();
let comparisonRevealObserver = null;

function prepareComparisonReveal() {
  comparisonRevealObserver?.disconnect();
  comparisonRevealObserver = null;
  const columns = [...els.grid.querySelectorAll(".batting-column, .pitching-column")];
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  columns.forEach((column) => column.classList.remove("comparison-awaiting-reveal"));
  if (reducedMotion || !("IntersectionObserver" in window) || !("animate" in Element.prototype)) return;

  comparisonRevealObserver = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      if (!isIntersecting) return;
      const column = target.closest(".recap-column");
      const key = column.classList.contains("batting-column") ? "batting" : "pitching";
      comparisonRevealObserver.unobserve(target);
      column.classList.remove("comparison-awaiting-reveal");
      if (revealedComparisonColumns.has(key)) return;
      revealedComparisonColumns.add(key);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      column.querySelectorAll(".comparison-stat").forEach((row, index) => {
        row.querySelectorAll(".comparison-fill").forEach((bar) => {
          bar.animate(
            [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
            { duration: 700, delay: index * 45, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" }
          );
        });
      });
    });
  }, { threshold: 0 });

  columns.forEach((column) => {
    const key = column.classList.contains("batting-column") ? "batting" : "pitching";
    if (revealedComparisonColumns.has(key)) return;
    const firstRow = column.querySelector(".comparison-stat");
    if (!firstRow) return;
    column.classList.add("comparison-awaiting-reveal");
    comparisonRevealObserver.observe(firstRow);
  });
}

window.addEventListener("pageshow", (event) => {
  if (!event.persisted) return;
  revealedComparisonColumns.clear();
  prepareComparisonReveal();
  winProbabilityRevealed = false;
  prepareWinProbabilityReveal();
});

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
  const scale = Math.max(yankeesMagnitude, opponentMagnitude);
  const yankeesWidth = scale ? (yankeesMagnitude / scale) * 100 : 0;
  const opponentWidth = scale ? (opponentMagnitude / scale) * 100 : 0;
  const yankeesDisplay = options.yankeesDisplay ?? yankeesValue ?? "-";
  const opponentDisplay = options.opponentDisplay ?? opponentValue ?? "-";
  const opponentLabel = options.opponentLabel || "Opponent";
  return `
    <div class="comparison-stat" role="group" aria-label="${escapeHtml(`${label}: NYY ${yankeesDisplay}; ${opponentLabel} ${opponentDisplay}`)}">
      <div class="comparison-bars">
        <div class="comparison-track yankees${yankeesMagnitude > 0 ? " has-value" : ""}">
          <span class="comparison-fill yankees" style="width:${yankeesWidth.toFixed(1)}%"></span>
          <strong>${escapeHtml(yankeesDisplay)}</strong>
        </div>
        <span class="comparison-stat-label">${escapeHtml(label)}</span>
        <div class="comparison-track opponent${opponentMagnitude > 0 ? " has-value" : ""}">
          <span class="comparison-fill opponent" style="width:${opponentWidth.toFixed(1)}%"></span>
          <strong>${escapeHtml(opponentDisplay)}</strong>
        </div>
      </div>
    </div>
  `;
}

function metricFeature(label, value, unit, detail) {
  return `
    <div class="metric-feature">
      <span class="metric-feature-label">${escapeHtml(label)}</span>
      <strong class="stat-number">${escapeHtml(value)}${unit ? ` <small>${escapeHtml(unit)}</small>` : ""}</strong>
      <em>${escapeHtml(detail)}</em>
    </div>
  `;
}

function gameNoteFeature(label, detail) {
  const lines = Array.isArray(detail) ? detail : [detail];
  return `
    <div class="metric-feature game-note-feature">
      <span class="metric-feature-label">${escapeHtml(label)}</span>
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
  const upcomingGames = [state.liveGame, ...state.upcomingGames]
    .filter(Boolean)
    .filter((game, index, items) => items.findIndex((item) => Number(item.gamePk) === Number(game.gamePk)) === index)
    .slice(0, 3);

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
    return `
      <button class="recap-selector-button ${tone}${isSelected ? " active" : ""}" type="button" data-game-pk="${escapeHtml(game.gamePk)}">
        <span class="selector-date">${escapeHtml(compactDate(game.officialDate))}</span>
        <span class="selector-final-score">
          <span class="selector-result">${escapeHtml(resultLetter(game))}</span>
          <img src="${escapeHtml(teamLogoUrl(yankees.team))}" alt="" aria-hidden="true" />
          <b>NYY</b>
          <strong>${escapeHtml(yankees.score ?? "-")}</strong>
          <i aria-hidden="true">–</i>
          <strong>${escapeHtml(opponentEntry.score ?? "-")}</strong>
          <b>${escapeHtml(teamAbbreviation(opponent))}</b>
          <img src="${escapeHtml(teamLogoUrl(opponent))}" alt="" aria-hidden="true" />
        </span>
      </button>
    `;
  }).join("");

  const upcomingItems = [...upcomingGames].reverse().map((game) => {
    const opponent = teamEntry(game, opponentSide(game)).team;
    const matchup = isYankeesHome(game) ? `vs ${teamAbbreviation(opponent)}` : `@${teamAbbreviation(opponent)}`;
    const isSelected = Number(game.gamePk) === Number(selectedGamePk);
    const live = isLiveGame(game);
    const timeLabel = live ? (game.status?.detailedState || "Live") : gameTime(game.gameDate);
    return `
      <button class="recap-selector-button ${live ? "in-progress" : "upcoming"}${isSelected ? " active" : ""}" type="button" data-game-pk="${escapeHtml(game.gamePk)}" aria-label="${live ? "Live" : "Upcoming"} game ${escapeHtml(compactDate(game.officialDate))} ${escapeHtml(matchup)} ${escapeHtml(timeLabel)}">
        <img class="selector-opponent-logo" src="${escapeHtml(teamLogoUrl(opponent))}" alt="" aria-hidden="true" />
        <span class="selector-date">${escapeHtml(compactDate(game.officialDate))}</span>
        <span class="selector-matchup-row">
          <span class="selector-score">${escapeHtml(matchup)}</span>
          <span class="selector-time">${escapeHtml(timeLabel)}</span>
        </span>
      </button>
    `;
  }).join("");

  els.recapButtons.innerHTML = upcomingItems + completedButtons;
}

function syncGameScoresFromFeed(game, feed) {
  ["away", "home"].forEach((side) => {
    const runs = Number(feed.liveData?.linescore?.teams?.[side]?.runs);
    if (Number.isFinite(runs) && game.teams?.[side]) game.teams[side].score = runs;
  });
}

function finalizeLiveGame(game) {
  state.liveGame = null;
  state.todayGame = game;
  state.upcomingGames = state.upcomingGames.filter(
    (item) => Number(item.gamePk) !== Number(game.gamePk),
  );
  state.recentGames = [
    game,
    ...state.recentGames.filter(
      (item) => Number(item.gamePk) !== Number(game.gamePk),
    ),
  ].sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate));
  state.seasonGames = [
    game,
    ...state.seasonGames.filter(
      (item) => Number(item.gamePk) !== Number(game.gamePk),
    ),
  ].sort((a, b) => new Date(b.gameDate) - new Date(a.gameDate));

  renderRecentGames(state.recentGames, game.gamePk);
  renderRecapButtons(state.recentGames, game.gamePk);

}

function probablePitcherForSide(game, feed, side) {
  return feed.gameData?.probablePitchers?.[side]
    || game.teams?.[side]?.probablePitcher
    || null;
}

function probablePitcherStats(game, side, pitcher) {
  return game._probablePitcherStats?.[side]
    || pitcher?.stats?.pitching
    || pitcher?.stats?.statsSingleSeason?.pitching
    || {};
}

function renderProbablePitcher(game, feed, side) {
  const pitcher = probablePitcherForSide(game, feed, side);
  const name = pitcher?.fullName || pitcher?.initLastName || "To be announced";
  const stats = probablePitcherStats(game, side, pitcher);
  const hasRecord = stats.wins !== undefined && stats.losses !== undefined;
  const record = hasRecord ? `${stats.wins}-${stats.losses}` : "Record unavailable";
  const era = stats.era !== undefined ? `${stats.era} ERA` : "ERA unavailable";
  const image = playerHeadshotUrl(pitcher?.id);
  const team = game.teams?.[side]?.team || feed.gameData?.teams?.[side] || {};
  const tag = pitcher?.id ? "a" : "div";
  const link = pitcher?.id ? ` href="./player-profile/?player=${escapeHtml(pitcher.id)}"` : "";
  return `
    <${tag} class="probable-pitcher ${side}"${link}>
      <span class="probable-pitcher-team">${escapeHtml(teamAbbreviation(team))}</span>
      ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(`${name} headshot`)}" />` : `<span class="probable-pitcher-placeholder" aria-hidden="true">?</span>`}
      <div class="probable-pitcher-copy">
        <strong>${escapeHtml(name)}</strong>
        <small>${escapeHtml(record)} <i aria-hidden="true">|</i> ${escapeHtml(era)}</small>
      </div>
    </${tag}>
  `;
}

function renderPregamePreview(game, feed) {
  winProbabilityObserver?.disconnect();
  const opponent = game.teams?.[opponentSide(game)]?.team || feed.gameData?.teams?.[opponentSide(game)] || {};
  const broadcastLabel = gameBroadcastLabel(game) || "Broadcast information unavailable";
  const venue = feed.gameData?.venue?.name || game.venue?.name || "Venue to be announced";
  const firstPitch = feed.gameData?.datetime?.dateTime || game.gameDate;
  const yankeesGameSide = yankeesSide(game);
  const opponentGameSide = opponentSide(game);
  const leftDetails = scoreboardTeamDetails(game, feed, yankeesGameSide);
  const rightDetails = scoreboardTeamDetails(game, feed, opponentGameSide);
  const leftColor = teamPrimaryColor(leftDetails.team);
  const rightColor = teamPrimaryColor(rightDetails.team);
  const gameData = feed.gameData?.game || {};
  const weather = feed.gameData?.weather || {};
  const seriesDescription = gameData.seriesDescription || game.seriesDescription || "Regular season";
  const seriesGameNumber = gameData.seriesGameNumber || game.seriesGameNumber;
  const gamesInSeries = gameData.gamesInSeries || game.gamesInSeries;
  const seriesPosition = seriesGameNumber && gamesInSeries
    ? `Game ${seriesGameNumber} of ${gamesInSeries}`
    : "Series position unavailable";
  const conditions = [weather.temp ? `${weather.temp}°F` : "", weather.condition, weather.wind]
    .filter(Boolean)
    .join(", ") || "Forecast not yet available";
  const dayNight = String(gameData.dayNight || game.dayNight || "");
  const gameSetting = dayNight ? `${dayNight[0].toUpperCase()}${dayNight.slice(1)} game` : "Start classification unavailable";
  const seasonSeries = game._seasonSeries || {};
  const seasonSeriesSummary = seasonSeries.games > 0
    ? `${seasonSeries.label} · Runs: NYY ${seasonSeries.yankeesRuns}, ${teamAbbreviation(opponent)} ${seasonSeries.opponentRuns}`
    : "First meeting this season";
  const milestoneSummary = game._possibleMilestones === null
    ? "Milestone watch unavailable"
    : game._possibleMilestones?.length
      ? game._possibleMilestones.join("; ")
      : "No major round-number milestones within immediate reach";
  const previewDetails = [
    `<span><strong>First pitch:</strong> ${escapeHtml(gameTime(firstPitch))}</span>`,
    `<span><strong>Watch:</strong> ${escapeHtml(broadcastLabel)}</span>`,
    `<span><strong>Venue:</strong> ${escapeHtml(venue)}</span>`,
  ].join(`<i aria-hidden="true">|</i>`);

  els.status.textContent = "Upcoming game preview";
  els.status.style.color = "#9ac7ff";
  els.title.textContent = `Next Game ${isYankeesHome(game) ? "vs" : "at"} ${teamAbbreviation(opponent)}`;
  els.subtitle.textContent = `${niceDate(game.officialDate)} - ${venue} - ${gameTime(firstPitch)}`;
  els.scoreboard.innerHTML = `
    <div class="home-score-team-colors" aria-hidden="true">
      <span style="background-color: ${leftColor}"></span>
      <span style="background-color: ${rightColor}"></span>
    </div>
    <div class="game-scoreboard-top upcoming" style="--scoreboard-left-color:${leftColor};--scoreboard-right-color:${rightColor}">
      ${renderScoreboardTeam(leftDetails, "away", "-")}
      <strong class="scoreboard-score">-</strong>
      <div class="scoreboard-state">${escapeHtml(game.status?.detailedState || "Scheduled")}</div>
      <strong class="scoreboard-score">-</strong>
      ${renderScoreboardTeam(rightDetails, "home", "-")}
    </div>
    <div class="game-live-status-row pregame-info-row">${previewDetails}</div>
    <div class="game-scoreboard-lower pregame-scoreboard-lower">
      <div class="pregame-details">
        <h3>Pregame Notes</h3>
        <p><strong>Season series</strong><span>${escapeHtml(seasonSeriesSummary)}</span></p>
        <p><strong>Series</strong><span>${escapeHtml(`${seriesDescription} · ${seriesPosition}`)}</span></p>
        <p><strong>Milestones</strong><span>${escapeHtml(milestoneSummary)}</span></p>
        <p><strong>Conditions</strong><span>${escapeHtml(conditions)}</span></p>
        <p><strong>Setting</strong><span>${escapeHtml(gameSetting)}</span></p>
      </div>
      <div class="game-decisions probable-pitchers-slot">
        <h3>Probable Pitchers</h3>
        <div class="probable-pitchers-grid">
          ${renderProbablePitcher(game, feed, yankeesGameSide)}
          <strong class="probable-versus">VS</strong>
          ${renderProbablePitcher(game, feed, opponentGameSide)}
        </div>
      </div>
    </div>
  `;
  els.playerStats.innerHTML = "";
  els.comparisonHeader.innerHTML = "";
  els.playerStats.setAttribute("aria-label", "");
  comparisonRevealObserver?.disconnect();
  els.grid.innerHTML = "";
}

async function loadProbablePitcherStats(game, feed) {
  const sides = ["away", "home"];
  const entries = await Promise.all(sides.map(async (side) => {
    const pitcher = probablePitcherForSide(game, feed, side);
    if (!pitcher?.id) return [side, {}];
    try {
      const data = await getJson(`/people/${pitcher.id}/stats`, {
        stats: "season",
        group: "pitching",
        season: new Date(game.gameDate).getFullYear(),
      });
      return [side, data.stats?.[0]?.splits?.[0]?.stat || {}];
    } catch (error) {
      return [side, {}];
    }
  }));
  game._probablePitcherStats = Object.fromEntries(entries);
}

async function loadSeasonSeries(game) {
  const opponent = game.teams?.[opponentSide(game)]?.team;
  if (!opponent?.id) return;
  const season = new Date(game.gameDate).getFullYear();
  try {
    const data = await getJson("/schedule", {
      sportId: 1,
      teamId: TEAM_ID,
      opponentId: opponent.id,
      startDate: `${season}-01-01`,
      endDate: formatDate(new Date()),
      hydrate: "team,linescore",
    });
    const completed = (data.dates || [])
      .flatMap((dateEntry) => dateEntry.games || [])
      .filter((seriesGame) => seriesGame.status?.abstractGameState === "Final")
      .filter((seriesGame) => Number(seriesGame.gamePk) !== Number(game.gamePk));
    const totals = completed.reduce((result, seriesGame) => {
      const yankees = teamEntry(seriesGame, yankeesSide(seriesGame));
      const opposing = teamEntry(seriesGame, opponentSide(seriesGame));
      const yankeesScore = Number(yankees.score || 0);
      const opponentScore = Number(opposing.score || 0);
      result.yankeesRuns += yankeesScore;
      result.opponentRuns += opponentScore;
      if (yankeesScore > opponentScore) result.yankeesWins += 1;
      else if (opponentScore > yankeesScore) result.opponentWins += 1;
      return result;
    }, { yankeesWins: 0, opponentWins: 0, yankeesRuns: 0, opponentRuns: 0 });
    const opponentAbbr = teamAbbreviation(opponent);
    const label = totals.yankeesWins === totals.opponentWins
      ? `Tied ${totals.yankeesWins}-${totals.opponentWins}`
      : totals.yankeesWins > totals.opponentWins
        ? `NYY leads ${totals.yankeesWins}-${totals.opponentWins}`
        : `${opponentAbbr} leads ${totals.opponentWins}-${totals.yankeesWins}`;
    game._seasonSeries = { ...totals, games: completed.length, label };
  } catch (error) {
    game._seasonSeries = { games: 0 };
  }
}

function nextCareerMilestone(value, interval, minimum, reachable) {
  const current = Number(value);
  if (!Number.isFinite(current)) return null;
  const target = Math.max(minimum, Math.ceil((current + 1) / interval) * interval);
  const needed = target - current;
  return needed <= reachable ? { needed, target } : null;
}

async function loadPossibleMilestones(game) {
  const teamIds = [game.teams?.away?.team?.id, game.teams?.home?.team?.id].filter(Boolean);
  try {
    const rosters = await Promise.all(teamIds.map((teamId) => getJson(`/teams/${teamId}/roster`, {
      rosterType: "active",
      hydrate: "person(stats(type=career,group=[hitting,pitching]))",
    })));
    const milestoneTypes = {
      hitting: [
        ["hits", 500, 500, 4, "hit", "hits"],
        ["homeRuns", 50, 100, 2, "home run", "home runs"],
        ["rbi", 500, 500, 4, "RBI", "RBI"],
        ["runs", 500, 500, 4, "run", "runs"],
        ["stolenBases", 100, 100, 2, "stolen base", "stolen bases"],
      ],
      pitching: [
        ["strikeOuts", 500, 500, 12, "strikeout", "strikeouts"],
        ["wins", 50, 50, 1, "win", "wins"],
        ["saves", 50, 100, 1, "save", "saves"],
      ],
    };
    const candidates = rosters.flatMap((roster) => roster.roster || []).flatMap((entry) => {
      const name = entry.person?.fullName || "Player";
      return (entry.person?.stats || []).flatMap((statGroup) => {
        const group = String(statGroup.group?.displayName || statGroup.group?.displayNameShort || "").toLowerCase();
        const stats = statGroup.splits?.[0]?.stat || {};
        return (milestoneTypes[group] || []).map(([key, interval, minimum, reachable, singular, plural]) => {
          const milestone = nextCareerMilestone(stats[key], interval, minimum, reachable);
          const neededLabel = milestone?.needed === 1 ? singular : plural;
          return milestone ? {
            needed: milestone.needed,
            text: `${name} needs ${milestone.needed} ${neededLabel} for ${milestone.target} career ${plural}`,
          } : null;
        }).filter(Boolean);
      });
    });
    game._possibleMilestones = candidates
      .sort((a, b) => a.needed - b.needed || a.text.localeCompare(b.text))
      .slice(0, 3)
      .map((candidate) => candidate.text);
  } catch (error) {
    game._possibleMilestones = null;
  }
}

function renderRecap(game, feed) {
  if (feed.gameData?.status) game.status = feed.gameData.status;
  state.currentFeed = feed;
  if (!["Final", "Live"].includes(game.status?.abstractGameState)) {
    renderPregamePreview(game, feed);
    return;
  }
  const side = yankeesSide(game);
  const opponentTeamSide = opponentSide(game);
  const opponent = game.teams?.[opponentSide(game)]?.team;
  const yankeesComparison = recapTeamComparisonData(feed, side);
  const opponentComparison = recapTeamComparisonData(feed, opponentTeamSide);
  const decisions = feed.liveData?.decisions || {};
  const playerOfTheGame = gamePlayerOfTheGame(feed);
  const winnerGameScore = pitcherGameScore(decisions.winner, feed);
  const loserGameScore = pitcherGameScore(decisions.loser, feed);
  const saveGameScore = pitcherGameScore(decisions.save, feed);
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
  const yankeesScoreDetails = scoreboardTeamDetails(game, feed, side);
  const opponentScoreDetails = scoreboardTeamDetails(game, feed, opponentTeamSide);
  const yankeesScoreColor = teamPrimaryColor(yankeesScoreDetails.team);
  const opponentScoreColor = teamPrimaryColor(opponentScoreDetails.team);

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
  const firstPlay = allPlays[0] || {};
  const lastPlay = allPlays[allPlays.length - 1] || {};
  const lastPlayEvents = allPlays[allPlays.length - 1]?.playEvents || [];
  const gameStart = feed.gameData?.gameInfo?.firstPitch
    || firstPlay.about?.startTime
    || feed.gameData?.datetime?.dateTime
    || game.gameDate;
  const gameEnd = lastPlay.about?.endTime
    || lastPlayEvents[lastPlayEvents.length - 1]?.endTime;
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
      <span style="background-color: ${yankeesScoreColor}"></span>
      <span style="background-color: ${opponentScoreColor}"></span>
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
    <div class="game-scoreboard-top ${gameResultClass}" style="--scoreboard-left-color:${yankeesScoreColor};--scoreboard-right-color:${opponentScoreColor}">
      ${renderScoreboardTeam(yankeesScoreDetails, "away", scoreForSide(game, feed, side))}
      <strong class="scoreboard-score">${escapeHtml(scoreForSide(game, feed, side))}</strong>
      <div class="scoreboard-state">${escapeHtml(scoreboardState(feed, game))}</div>
      <strong class="scoreboard-score">${escapeHtml(scoreForSide(game, feed, opponentTeamSide))}</strong>
      ${renderScoreboardTeam(opponentScoreDetails, "home", scoreForSide(game, feed, opponentTeamSide))}
    </div>
    <div class="game-scoreboard-lower">
      <div class="game-linescore-box">${renderLinescore(feed, game)}</div>
      <div class="game-decisions${isLiveGame(game) ? " live-matchup-slot" : " decision-cards"}">
        ${isLiveGame(game) ? `
          ${renderCurrentMatchup(feed, game, liveCurrentPlay.matchup || {})}
        ` : `
          ${renderDecisionPitcher("W", "win-label", decisions.winner, feed, pitcherDecisionDetails(decisions.winner, feed, winnerGameScore))}
          ${renderDecisionPitcher("L", "loss-label", decisions.loser, feed, pitcherDecisionDetails(decisions.loser, feed, loserGameScore))}
          ${renderDecisionPitcher("SV", "save-label", decisions.save, feed, pitcherDecisionDetails(decisions.save, feed, saveGameScore))}
          ${renderDecisionPitcher("POTG", "potg-label", playerOfTheGame?.player, feed, playerOfTheGame?.details || "WPA unavailable")}
        `}
      </div>
    </div>
    ${renderWinProbabilityChart(feed, game)}
    ${renderGameSituation(feed, game)}
  `;
  const metricsPanel = renderRecapColumn("Metrics and Game Notes", [
      metricFeature("Longest Home Run", gameMetrics.longestHomeRun ? Math.round(gameMetrics.longestHomeRun.value) : "-", gameMetrics.longestHomeRun ? "FT" : "", gameMetrics.longestHomeRun ? `${gameMetrics.longestHomeRun.player} (${gameMetrics.longestHomeRun.team}) - ${gameMetrics.longestHomeRun.detail}` : "No tracked home run"),
      metricFeature("Max Exit Velo", gameMetrics.maxExit ? gameMetrics.maxExit.value.toFixed(1) : "-", "MPH", gameMetrics.maxExit ? `${gameMetrics.maxExit.player} (${gameMetrics.maxExit.team}) - ${gameMetrics.maxExit.detail}` : "No tracked batted balls"),
      metricFeature("Max Pitch Velo", gameMetrics.maxPitch ? gameMetrics.maxPitch.value.toFixed(1) : "-", "MPH", gameMetrics.maxPitch ? `${gameMetrics.maxPitch.player} (${gameMetrics.maxPitch.team}) - ${gameMetrics.maxPitch.detail}` : "No tracked pitches"),

      gameNoteFeature("ABS Challenges", absChallenges),
      gameNoteFeature("Game Information", gameInformation),
      ...milestoneNotes.map((note) => gameNoteFeature("Player Milestone", note)),
    ].join(""), "metrics-column");
  renderGamePlayerStats(feed, side, game);
  const details = renderGameNotes(feed, game);

  els.grid.innerHTML = [
    renderRecapColumn("Hitting", [
      comparisonLegend(opponentAbbr),
      ...[
        ["Hits", "hits"], ["Doubles", "doubles"], ["Triples", "triples"], ["Home Runs", "homeRuns"],
        ["Walks", "baseOnBalls"], ["Strikeouts", "strikeOuts"],
      ].map(([label, key]) => comparisonRow(label, statValue(yankeesComparison.batting, key), statValue(opponentComparison.batting, key), comparisonOptions)),
      comparisonRow("Team LOB", statValue(yankeesComparison.line, "leftOnBase", statValue(yankeesComparison.batting, "leftOnBase")), statValue(opponentComparison.line, "leftOnBase", statValue(opponentComparison.batting, "leftOnBase")), comparisonOptions),
      comparisonRow("Stolen Bases", statValue(yankeesComparison.batting, "stolenBases", 0), statValue(opponentComparison.batting, "stolenBases", 0), comparisonOptions),
      comparisonRow("GIDP", statValue(yankeesComparison.batting, "groundIntoDoublePlay"), statValue(opponentComparison.batting, "groundIntoDoublePlay"), comparisonOptions),
      `<div class="comparison-details game-notes-groups">${details.batting}</div>`,
    ].join(""), "batting-column"),
    renderRecapColumn("Pitching", [
      comparisonLegend(opponentAbbr),
      ...[
        ["Strikeouts", "strikeOuts"], ["Walks", "baseOnBalls"], ["Hits Allowed", "hits"], ["HR Allowed", "homeRuns"],
        ["Earned Runs", "earnedRuns"], ["Ground Balls", "groundOuts"], ["Fly Balls", "airOuts"],
        ["Pitches", "numberOfPitches"],
      ].map(([label, key]) => comparisonRow(label, statValue(yankeesComparison.pitching, key), statValue(opponentComparison.pitching, key), comparisonOptions)),
      comparisonRow("Strike %", yankeesComparison.strikePercentage, opponentComparison.strikePercentage, { ...comparisonOptions, yankeesDisplay: yankeesComparison.strikePercentage ? `${yankeesComparison.strikePercentage}%` : "-", opponentDisplay: opponentComparison.strikePercentage ? `${opponentComparison.strikePercentage}%` : "-" }),
      `<div class="comparison-details game-notes-groups">${details.pitching}<div class="baserunning-fielding-row">${details.baserunning}${details.fielding}</div></div>`,
    ].join(""), "pitching-column"),
    metricsPanel,
  ].join("");
  prepareComparisonReveal();
  prepareWinProbabilityReveal();
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
      const wasLive = isLiveGame(game);
      const [feed, winProbability] = await Promise.all([
        getLiveJson(`/game/${game.gamePk}/feed/live`),
        getJson(`/game/${game.gamePk}/winProbability`).catch(() => []),
      ]);
      feed._winProbability = winProbability;
      if (Number(state.selectedGame?.gamePk) !== Number(game.gamePk)) return;
      const previousScores = [...els.scoreboard.querySelectorAll(".game-scoreboard-top > .scoreboard-score")]
        .map((score) => score.textContent.trim());
      syncGameScoresFromFeed(game, feed);
      renderRecap(game, feed);
      highlightChangedScores(previousScores);
      if (!isLiveGame(game)) {
        stopLiveRefresh();
        if (wasLive && game.status?.abstractGameState === "Final") finalizeLiveGame(game);
      }
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
    const wasLive = isLiveGame(game);
    const [feed, winProbability] = await Promise.all([
      getLiveJson(`/game/${game.gamePk}/feed/live`),
      getJson(`/game/${game.gamePk}/winProbability`).catch(() => []),
    ]);
    feed._winProbability = winProbability;
    syncGameScoresFromFeed(game, feed);
    renderRecap(game, feed);
    if (!["Final", "Live"].includes(feed.gameData?.status?.abstractGameState || game.status?.abstractGameState)) {
      await Promise.all([
        loadProbablePitcherStats(game, feed),
        loadSeasonSeries(game),
        loadPossibleMilestones(game),
      ]);
      if (Number(state.selectedGame?.gamePk) !== Number(game.gamePk)) return;
      renderRecap(game, feed);
    }
    if (wasLive && game.status?.abstractGameState === "Final") finalizeLiveGame(game);
    if (live && isLiveGame(game)) startLiveRefresh(game);
    else stopLiveRefresh();
  } finally {
    els.scoreboard.classList.remove("loading");
  }
}

async function init() {
  try {
    const divisionRanks = loadDivisionRanks().catch(() => null);
    const transactions = getBreakingTransactions().catch(() => []);
    const [currentGames, games] = await Promise.all([
      getCurrentGames().catch(() => ({ todayGame: null, upcomingGames: [] })),
      getRecentFinalGames(),
    ]);
    const { todayGame, upcomingGames } = currentGames;
    await divisionRanks;
    const liveGame = isLiveGame(todayGame) ? todayGame : null;
    const requestedGamePk = Number(new URLSearchParams(window.location.search).get("game"));
    let archivedGame = games.find((game) => Number(game.gamePk) === requestedGamePk);
    if (!archivedGame && Number.isSafeInteger(requestedGamePk) && requestedGamePk > 0) {
      const archiveSchedule = await getJson("/schedule", { sportId: 1, gamePk: requestedGamePk, hydrate: "team,venue,linescore" });
      archivedGame = (archiveSchedule.dates || []).flatMap((date) => date.games || []).find((game) =>
        Number(game.gamePk) === requestedGamePk
        && game.status?.abstractGameState === "Final"
        && [game.teams?.home?.team?.id, game.teams?.away?.team?.id].some((id) => Number(id) === TEAM_ID)
      );
      if (!archivedGame) throw new Error("The requested archived Yankees game is unavailable.");
    }
    const selectedGame = archivedGame || HomeGameSelection.featuredGame({
      todayGame,
      recentGames: games,
      upcomingGames,
    });
    const selectedIsCurrent = selectedGame?.status?.abstractGameState !== "Final";
    state.todayGame = todayGame;
    state.liveGame = liveGame;
    state.recentGames = games;
    state.seasonGames = games;
    state.upcomingGames = upcomingGames;
    renderRecentGames(games, selectedGame?.gamePk, { includeLatest: selectedIsCurrent });
    renderRecapButtons(games, selectedGame?.gamePk);

    if (!selectedGame) throw new Error("No Yankees games found.");
    await loadGameRecap(selectedGame, { live: isLiveGame(selectedGame) });
    transactions.then((items) => loadBreakingNews(todayGame, upcomingGames, items))
      .catch(() => renderBreakingNews([]));
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

async function selectRecapGame(game) {
  hideWinProbabilityTooltip();
  els.status.textContent = "Loading selected recap";
  els.status.style.color = "";
  stopLiveRefresh();
  renderRecentGames(state.recentGames, game.gamePk, { includeLatest: game.status?.abstractGameState !== "Final" });
  renderRecapButtons(state.recentGames, game.gamePk);


  try {
    await loadGameRecap(game, { live: isLiveGame(game) });
  } catch (error) {
    els.status.textContent = "Selected recap unavailable";
    els.status.style.color = "#ffbec4";
  }
}

async function handleRecapButtonClick(event) {
  const button = event.target.closest(".recent-game-button[data-game-pk]");
  const selectorButton = event.target.closest(".recap-selector-button[data-game-pk]");
  const selectedButton = button || selectorButton;
  if (!selectedButton) return;

  const gamePk = Number(selectedButton.dataset.gamePk);
  const game = [state.liveGame, ...state.upcomingGames, ...state.recentGames, ...state.seasonGames]
    .filter(Boolean)
    .find((item) => Number(item.gamePk) === gamePk);
  if (game) await selectRecapGame(game);
}

els.recent.addEventListener("click", handleRecapButtonClick);
els.recapButtons.addEventListener("click", handleRecapButtonClick);

let winProbabilityTooltip = null;

function getWinProbabilityTooltip() {
  if (winProbabilityTooltip?.isConnected) return winProbabilityTooltip;
  winProbabilityTooltip = document.createElement("div");
  winProbabilityTooltip.className = "win-probability-tooltip";
  winProbabilityTooltip.setAttribute("role", "tooltip");
  winProbabilityTooltip.hidden = true;
  document.body.append(winProbabilityTooltip);
  return winProbabilityTooltip;
}

function showWinProbabilityTooltip(point, clientX, clientY) {
  const tooltip = getWinProbabilityTooltip();
  const pointRect = point.getBoundingClientRect();
  const anchorX = clientX ?? pointRect.left + pointRect.width / 2;
  const anchorY = clientY ?? pointRect.top;
  tooltip.textContent = point.dataset.winProbabilityTooltip || "";
  tooltip.hidden = false;
  tooltip.style.transform = "translate(-50%, -100%)";
  tooltip.style.left = `${anchorX}px`;
  tooltip.style.top = `${anchorY - 10}px`;

  const tooltipRect = tooltip.getBoundingClientRect();
  const halfWidth = tooltipRect.width / 2;
  const clampedX = Math.min(window.innerWidth - halfWidth - 10, Math.max(halfWidth + 10, anchorX));
  tooltip.style.left = `${clampedX}px`;
  if (tooltipRect.top < 10) {
    tooltip.style.top = `${anchorY + 12}px`;
    tooltip.style.transform = "translate(-50%, 0)";
  }
}

function hideWinProbabilityTooltip() {
  if (winProbabilityTooltip) winProbabilityTooltip.hidden = true;
}

els.scoreboard.addEventListener("pointerover", (event) => {
  const point = event.target.closest?.("[data-win-probability-tooltip]");
  if (point) showWinProbabilityTooltip(point, event.clientX, event.clientY);
});
els.scoreboard.addEventListener("pointermove", (event) => {
  const point = event.target.closest?.("[data-win-probability-tooltip]");
  if (point) showWinProbabilityTooltip(point, event.clientX, event.clientY);
});
els.scoreboard.addEventListener("pointerout", (event) => {
  const point = event.target.closest?.("[data-win-probability-tooltip]");
  if (point && !point.contains(event.relatedTarget)) hideWinProbabilityTooltip();
});
els.scoreboard.addEventListener("focusin", (event) => {
  const point = event.target.closest?.("[data-win-probability-tooltip]");
  if (point) showWinProbabilityTooltip(point);
});
els.scoreboard.addEventListener("focusout", (event) => {
  const point = event.target.closest?.("[data-win-probability-tooltip]");
  if (point) hideWinProbabilityTooltip();
});
els.comparisonHeader.addEventListener("click", (event) => {
  const button = event.target.closest("[data-player-stats-team]");
  if (!button || !state.currentFeed || !state.selectedGame) return;
  state.playerStatsTeam = button.dataset.playerStatsTeam;
  renderRecap(state.selectedGame, state.currentFeed);
});
els.breakingNewsClose.addEventListener("click", () => {
  try {
    if (state.breakingNewsKey) localStorage.setItem(DISMISSED_ALERTS_KEY, state.breakingNewsKey);
  } catch (error) {
    // Keep dismissal functional for this page view even when storage is unavailable.
  }
  els.breakingNews.hidden = true;
});

init();
