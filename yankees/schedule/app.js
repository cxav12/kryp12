const TEAM_ID = 147;
const MLB_API = "https://statsapi.mlb.com/api/v1";
const MLB_TEAM_PRIMARY_COLORS = {
  108: "#BA0021", 109: "#A71930", 110: "#DF4601", 111: "#BD3039", 112: "#CC3433",
  113: "#C6011F", 114: "#D50032", 115: "#33006F", 116: "#FA4616", 117: "#EB6E1F",
  118: "#004687", 119: "#005A9C", 120: "#AB0003", 121: "#FF5910", 133: "#EFB21E",
  134: "#FDB827", 135: "#FFC425", 136: "#005C5C", 137: "#FD5A1E", 138: "#C41E3A",
  139: "#8FBCE6", 140: "#C0111F", 141: "#134A8E", 142: "#D31145", 143: "#E81828",
  144: "#CE1141", 145: "#C4CED4", 146: "#00A3E0", 147: "#C4CED3", 158: "#FFC52F",
};
const monthFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
});
const agendaDateFormatter = new Intl.DateTimeFormat("en", {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const timeFormatter = new Intl.DateTimeFormat("en", {
  hour: "numeric",
  minute: "2-digit",
});

const els = {
  status: document.querySelector("#data-status"),
  monthTitle: document.querySelector("#month-title"),
  monthControlLabel: document.querySelector("#month-control-label"),
  monthSummary: document.querySelector("#month-summary"),
  grid: document.querySelector("#calendar-grid"),
  calendarShell: document.querySelector(".calendar-shell"),
  list: document.querySelector("#schedule-list"),
  gridView: document.querySelector("#grid-view"),
  listView: document.querySelector("#list-view"),
  prev: document.querySelector("#prev-month"),
  next: document.querySelector("#next-month"),
};

const state = {
  selectedDate: startOfMonth(new Date()),
  standings: new Map(),
  schedule: null,
  view: "grid",
};

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function monthLabel(date) {
  return monthFormatter.format(date);
}

function agendaDateLabel(date) {
  return agendaDateFormatter.format(date);
}

function timeLabel(value) {
  return timeFormatter.format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setStatus(message, tone = "neutral") {
  els.status.textContent = message;
  els.status.style.color = tone === "error" ? "#ffbec4" : tone === "good" ? "#9af0c8" : "";
}

async function getSchedule(monthDate) {
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const url = new URL(`${MLB_API}/schedule`);
  url.searchParams.set("sportId", "1");
  url.searchParams.set("teamId", TEAM_ID);
  url.searchParams.set("startDate", dateKey(start));
  url.searchParams.set("endDate", dateKey(end));
  url.searchParams.set("hydrate", "team,venue,linescore,probablePitcher,decisions,person,stats");

  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
  return response.json();
}

async function getStandings(season) {
  const url = new URL(`${MLB_API}/standings`);
  url.searchParams.set("leagueId", "103,104");
  url.searchParams.set("season", season);
  url.searchParams.set("standingsTypes", "regularSeason");
  url.searchParams.set("hydrate", "team(division)");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
  return response.json();
}

function storeStandings(data) {
  state.standings.clear();
  (data.records || []).forEach((division) => {
    (division.teamRecords || []).forEach((record) => {
      if (!record.team?.id) return;
      state.standings.set(Number(record.team.id), {
        wins: record.leagueRecord?.wins ?? record.wins,
        losses: record.leagueRecord?.losses ?? record.losses,
        divisionRank: Number(record.divisionRank),
        divisionName: division.division?.name || record.team.division?.name || "",
      });
    });
  });
}

function groupGamesByDate(schedule) {
  const games = new Map();
  (schedule.dates || []).forEach((dateEntry) => {
    games.set(dateEntry.date, dateEntry.games || []);
  });
  return games;
}

function isYankeesHome(game) {
  return game.teams?.home?.team?.id === TEAM_ID;
}

function teamAbbreviation(team) {
  return team?.abbreviation || team?.teamName || team?.name || "TBD";
}

function teamOnlyName(team) {
  return team?.teamName || team?.clubName || team?.name || "TBD";
}

function teamLogoUrl(team) {
  return team?.id ? `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${team.id}.svg` : "";
}

function teamPrimaryColor(team) {
  return MLB_TEAM_PRIMARY_COLORS[Number(team?.id)] || "#60798f";
}

function ordinal(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  const remainder100 = number % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${number}th`;
  return `${number}${number % 10 === 1 ? "st" : number % 10 === 2 ? "nd" : number % 10 === 3 ? "rd" : "th"}`;
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

function teamRecordLabel(entry = {}) {
  const standing = state.standings.get(Number(entry.team?.id));
  const wins = standing?.wins ?? entry.leagueRecord?.wins;
  const losses = standing?.losses ?? entry.leagueRecord?.losses;
  const record = wins !== undefined && losses !== undefined ? `${wins}-${losses}` : "Record unavailable";
  if (!standing?.divisionRank) return record;
  return `${record}|${ordinal(standing.divisionRank)} ${divisionCardCode(standing.divisionName)}`;
}

function teamRecordMarkup(entry = {}) {
  const [record, rank] = teamRecordLabel(entry).split("|");
  const rankMarkup = rank ? `<i class="card-record-divider" aria-hidden="true"></i><span>${rank}</span>` : "";
  return `<span class="game-record-summary"><span>${record}</span>${rankMarkup}</span>`;
}

function yankeesTeamEntry(game) {
  return isYankeesHome(game) ? game.teams?.home : game.teams?.away;
}

function opponentTeamEntry(game) {
  return isYankeesHome(game) ? game.teams?.away : game.teams?.home;
}

function yankeesResult(game) {
  if (game.status?.abstractGameState !== "Final") return "";
  const yankeesScore = Number(yankeesTeamEntry(game)?.score);
  const opponentScore = Number(opponentTeamEntry(game)?.score);
  if (!Number.isFinite(yankeesScore) || !Number.isFinite(opponentScore)) return "";
  if (yankeesScore === opponentScore) return "";
  return yankeesScore > opponentScore ? "win" : "loss";
}

function statusLabel(game) {
  const status = game.status?.abstractGameState;
  if (status === "Final") {
    const result = yankeesResult(game);
    if (result === "win") return "Win";
    if (result === "loss") return "Loss";
    return "Final";
  }
  if (status === "Live") {
    const linescore = game.linescore || {};
    const inning = linescore.currentInningOrdinal || ordinal(linescore.currentInning);
    const half = String(linescore.inningHalf || linescore.inningState || "Live");
    const outs = Number(linescore.outs);
    return [`${half} ${inning}`.trim(), Number.isFinite(outs) ? `${outs} out${outs === 1 ? "" : "s"}` : ""]
      .filter(Boolean)
      .join(" · ");
  }
  return timeLabel(game.gameDate);
}

function gameClass(game) {
  const status = game.status?.abstractGameState;
  if (status === "Final") return `final ${yankeesResult(game)}`;
  if (status === "Live") return "live";
  return "scheduled";
}

function renderGame(game) {
  const isUpcoming = game.status?.abstractGameState === "Preview";
  const card = document.createElement(isUpcoming ? "article" : "a");
  const away = game.teams?.away || {};
  const home = game.teams?.home || {};
  const started = ["Final", "Live"].includes(game.status?.abstractGameState);
  card.className = `game-card ${gameClass(game)}`;
  if (!isUpcoming) {
    card.href = `../?game=${encodeURIComponent(game.gamePk)}`;
    card.setAttribute("aria-label", `Open game recap for ${away.team?.name || "away team"} at ${home.team?.name || "home team"}`);
  }
  card.innerHTML = `
    <div class="game-team-colors" aria-hidden="true">
      <span style="background-color:${teamPrimaryColor(away.team)}"></span>
      <span style="background-color:${teamPrimaryColor(home.team)}"></span>
    </div>
    <div class="game-matchup-row">
      <img class="game-team-logo team-logo" src="${teamLogoUrl(away.team)}" alt="${teamAbbreviation(away.team)} logo" />
      <div class="game-matchup-center">
        ${started
          ? `<strong>${away.score ?? "-"}</strong><span>-</span><strong>${home.score ?? "-"}</strong>`
          : `<strong class="game-versus">vs</strong>`}
      </div>
      <img class="game-team-logo team-logo" src="${teamLogoUrl(home.team)}" alt="${teamAbbreviation(home.team)} logo" />
    </div>
    <div class="game-records-row">
      ${teamRecordMarkup(away)}
      <i aria-hidden="true">·</i>
      ${teamRecordMarkup(home)}
    </div>
    <div class="game-status"><span>${statusLabel(game)}${game.status?.abstractGameState === "Final" ? ` <span aria-hidden="true">·</span> <span class="game-stats-link">Game Recap</span>` : ""}</span></div>
  `;
  return card;
}

function recordAtGame(entry = {}) {
  const wins = entry.leagueRecord?.wins;
  const losses = entry.leagueRecord?.losses;
  return wins !== undefined && losses !== undefined ? `${wins}-${losses}` : "—";
}

function decisionStats(person = {}) {
  return (person.stats || []).find((entry) =>
    entry.type?.displayName === "statsSingleSeason" && entry.group?.displayName === "pitching"
  )?.stats || {};
}

function decisionLabel(person, type) {
  if (!person?.fullName) return "—";
  const stats = decisionStats(person);
  const record = stats.wins !== undefined && stats.losses !== undefined ? `${stats.wins}-${stats.losses}` : "";
  const count = type === "save" && stats.saves !== undefined ? `${stats.saves} SV` : record;
  return `${escapeHtml(person.fullName)}${count ? ` <span>(${escapeHtml(count)})</span>` : ""}`;
}

function listResult(game) {
  const gameState = game.status?.abstractGameState;
  if (gameState === "Final") {
    const result = yankeesResult(game);
    const yankeesScore = yankeesTeamEntry(game)?.score ?? "—";
    const opponentScore = opponentTeamEntry(game)?.score ?? "—";
    return `${result === "win" ? "W" : result === "loss" ? "L" : "Final"} ${yankeesScore}-${opponentScore}`;
  }
  return gameState === "Live" ? statusLabel(game) : `${timeLabel(game.gameDate)} · Upcoming`;
}

function probableStarterLabel(entry = {}) {
  const pitcher = entry.probablePitcher;
  if (!pitcher?.fullName) return "TBD";
  const stats = decisionStats(pitcher);
  const wins = stats.wins;
  const losses = stats.losses;
  const era = stats.era;
  const details = [];
  if (wins !== undefined && losses !== undefined) details.push(`${wins}-${losses}`);
  if (era !== undefined) details.push(`${era} ERA`);
  return `${pitcher.fullName}${details.length ? ` (${details.join(" · ")})` : ""}`;
}

function renderListGame(game) {
  const opponent = opponentTeamEntry(game);
  const venueMarker = isYankeesHome(game) ? "vs" : "@";
  const isUpcoming = game.status?.abstractGameState === "Preview";
  const card = document.createElement(isUpcoming ? "article" : "a");
  card.className = `schedule-list-card ${gameClass(game)}`;
  if (!isUpcoming) {
    card.href = `../?game=${encodeURIComponent(game.gamePk)}`;
    card.setAttribute("aria-label", `Open game recap against ${opponent.team?.name || "opponent"}`);
  }
  card.innerHTML = `
    <div class="list-field list-date" data-label="Date"><strong>${escapeHtml(agendaDateLabel(new Date(`${game.officialDate}T12:00:00`)))}</strong></div>
    <div class="list-field list-opponent" data-label="Opponent"><strong><b>${venueMarker}</b><img src="${teamLogoUrl(opponent.team)}" alt="" />${escapeHtml(teamOnlyName(opponent.team))}</strong></div>
    <div class="list-field list-result" data-label="Result"><strong>${escapeHtml(listResult(game))}</strong></div>
    <div class="list-field" data-label="W-L"><strong>${escapeHtml(recordAtGame(yankeesTeamEntry(game)))}</strong></div>
    <div class="list-field" data-label="Opp. W-L"><strong>${escapeHtml(recordAtGame(opponent))}</strong></div>
    <div class="list-field" data-label="Winner"><strong>${decisionLabel(game.decisions?.winner, "winner")}</strong></div>
    <div class="list-field" data-label="Loser"><strong>${decisionLabel(game.decisions?.loser, "loser")}</strong></div>
    <div class="list-field" data-label="Save"><strong>${decisionLabel(game.decisions?.save, "save")}</strong></div>
  `;
  return card;
}

function renderUpcomingListGame(game) {
  const yankees = yankeesTeamEntry(game);
  const opponent = opponentTeamEntry(game);
  const venueMarker = isYankeesHome(game) ? "vs" : "@";
  const card = document.createElement("article");
  card.className = "schedule-list-card schedule-list-card-upcoming scheduled";
  card.innerHTML = `
    <div class="list-field list-date" data-label="Date"><strong>${escapeHtml(agendaDateLabel(new Date(`${game.officialDate}T12:00:00`)))}</strong></div>
    <div class="list-field list-opponent" data-label="Opponent"><strong><b>${venueMarker}</b><img src="${teamLogoUrl(opponent.team)}" alt="" />${escapeHtml(teamOnlyName(opponent.team))}</strong></div>
    <div class="list-field list-result" data-label="Start Time"><strong>${escapeHtml(timeLabel(game.gameDate))}</strong></div>
    <div class="list-field" data-label="W-L"><strong>${escapeHtml(recordAtGame(yankees))}</strong></div>
    <div class="list-field" data-label="Opp. W-L"><strong>${escapeHtml(recordAtGame(opponent))}</strong></div>
    <div class="list-field list-starter" data-label="NYY Probable Starter"><strong>${escapeHtml(probableStarterLabel(yankees))}</strong></div>
    <div class="list-field list-starter" data-label="Opp. Probable Starter"><strong>${escapeHtml(probableStarterLabel(opponent))}</strong></div>
  `;
  return card;
}

function createListHeader(className, labels) {
  const header = document.createElement("div");
  header.className = `schedule-list-header ${className}`;
  header.setAttribute("aria-hidden", "true");
  header.innerHTML = labels.map((label) => `<span>${label}</span>`).join("");
  return header;
}

function renderList(schedule) {
  els.list.replaceChildren();
  const games = (schedule?.dates || [])
    .flatMap((dateEntry) => dateEntry.games || [])
    .sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));
  if (!games.length) {
    els.list.innerHTML = `<p class="error p-3 mb-0">No games scheduled this month.</p>`;
    return;
  }
  const playedGames = games.filter((game) => game.status?.abstractGameState !== "Preview");
  const upcomingGames = games.filter((game) => game.status?.abstractGameState === "Preview");

  if (playedGames.length) {
    els.list.append(createListHeader("", ["Date", "Opponent", "Result", "W-L", "Opp. W-L", "Winner", "Loser", "Save"]));
    playedGames.forEach((game) => els.list.append(renderListGame(game)));
  }

  if (upcomingGames.length) {
    els.list.append(createListHeader("schedule-list-header-upcoming", [
      "Date", "Opponent", "Start Time", "W-L", "Opp. W-L", "NYY Probable Starter", "Opp. Probable Starter",
    ]));
    upcomingGames.forEach((game) => els.list.append(renderUpcomingListGame(game)));
  }
}

function setView(view) {
  state.view = view;
  const isGrid = view === "grid";
  els.calendarShell.hidden = !isGrid;
  els.list.hidden = isGrid;
  els.gridView.classList.toggle("active", isGrid);
  els.listView.classList.toggle("active", !isGrid);
  els.gridView.setAttribute("aria-pressed", String(isGrid));
  els.listView.setAttribute("aria-pressed", String(!isGrid));
}

function renderCalendar(monthDate, gamesByDate) {
  els.grid.replaceChildren();

  const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const last = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const cursor = new Date(first);
  cursor.setDate(cursor.getDate() - cursor.getDay());

  const today = dateKey(new Date());
  const cells = Math.ceil((first.getDay() + last.getDate()) / 7) * 7;

  for (let index = 0; index < cells; index += 1) {
    const cellDate = new Date(cursor);
    const key = dateKey(cellDate);
    const games = gamesByDate.get(key) || [];
    const cell = document.createElement("article");
    cell.className = "day-cell";
    if (cellDate.getMonth() !== monthDate.getMonth()) cell.classList.add("outside-month");
    if (key === today) cell.classList.add("today");

    const dayNumber = document.createElement("div");
    dayNumber.className = "day-number";
    dayNumber.dataset.mobileLabel = agendaDateLabel(cellDate);
    dayNumber.textContent = String(cellDate.getDate());
    cell.append(dayNumber);

    if (games.length) {
      games.forEach((game) => cell.append(renderGame(game)));
    } else {
      const empty = document.createElement("div");
      empty.className = "empty-day";
      empty.textContent = cellDate.getMonth() === monthDate.getMonth() ? "No game" : "";
      cell.append(empty);
    }

    els.grid.append(cell);
    cursor.setDate(cursor.getDate() + 1);
  }
}

function summarize(schedule, monthDate) {
  const games = (schedule.dates || []).flatMap((dateEntry) => dateEntry.games || []);
  const finalCount = games.filter((game) => game.status?.abstractGameState === "Final").length;
  const liveCount = games.filter((game) => game.status?.abstractGameState === "Live").length;
  const upcomingCount = games.length - finalCount - liveCount;
  els.monthSummary.textContent = `${games.length} games in ${monthLabel(monthDate)} · ${finalCount} final · ${liveCount} live · ${upcomingCount} upcoming`;
}

async function loadMonth(monthDate) {
  state.selectedDate = startOfMonth(monthDate);
  els.monthTitle.textContent = monthLabel(state.selectedDate);
  els.monthControlLabel.textContent = monthLabel(state.selectedDate);
  els.grid.innerHTML = `<p class="error p-3 mb-0">Loading schedule...</p>`;
  setStatus("Loading schedule");

  try {
    const [schedule, standings] = await Promise.all([
      getSchedule(state.selectedDate),
      getStandings(state.selectedDate.getFullYear()).catch(() => null),
    ]);
    if (standings) storeStandings(standings);
    state.schedule = schedule;
    renderCalendar(state.selectedDate, groupGamesByDate(schedule));
    renderList(schedule);
    summarize(schedule, state.selectedDate);
    setStatus("Live MLB data", "good");
  } catch (error) {
    setStatus("Data connection issue", "error");
    els.monthSummary.textContent = "The schedule could not be loaded right now.";
    els.grid.innerHTML = `<p class="error p-3 mb-0">Could not load the Yankees schedule. ${error.message}</p>`;
  }
}

function bindEvents() {
  els.prev.addEventListener("click", () => loadMonth(addMonths(state.selectedDate, -1)));
  els.next.addEventListener("click", () => loadMonth(addMonths(state.selectedDate, 1)));
  els.gridView.addEventListener("click", () => setView("grid"));
  els.listView.addEventListener("click", () => setView("list"));
}

bindEvents();
loadMonth(state.selectedDate);
