const yankeesBrandCopies = document.querySelectorAll(".brand-lockup > div");
const yankeesTopbars = document.querySelectorAll(".topbar");
const HEADER_YANKEES_TEAM_ID = 147;

function createHeaderStats(topbar) {
  const stats = document.createElement("div");
  stats.className = "header-team-stats";
  stats.setAttribute("aria-label", "Current Yankees status");
  stats.setAttribute("aria-live", "polite");
  stats.innerHTML = `
    <div class="header-team-stat">
      <span class="header-team-stat-label">Record</span>
      <strong data-header-record>&mdash;</strong>
    </div>
    <div class="header-team-stat">
      <span class="header-team-stat-label">Streak</span>
      <strong data-header-streak>&mdash;</strong>
    </div>
    <div class="header-team-stat">
      <span class="header-team-stat-label">Next</span>
      <strong data-header-next>&mdash;</strong>
    </div>
  `;
  topbar.append(stats);
  return stats;
}

const yankeesHeaderStats = [...yankeesTopbars].map(createHeaderStats);

function setHeaderStat(selector, value, tone = "") {
  yankeesHeaderStats.forEach((stats) => {
    const output = stats.querySelector(selector);
    if (!output) return;
    output.textContent = value;
    output.classList.toggle("is-win", tone === "win");
    output.classList.toggle("is-loss", tone === "loss");
  });
}

function apiDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextScheduledHeaderGame(games) {
  return games
    .filter((game) => game.status?.abstractGameState === "Preview"
      && !/postponed|cancelled|canceled|suspended/i.test(game.status?.detailedState || ""))
    .sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate))[0];
}

async function renderNextOpponent() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 180);

  const url = new URL("https://statsapi.mlb.com/api/v1/schedule");
  url.searchParams.set("sportId", "1");
  url.searchParams.set("teamId", String(HEADER_YANKEES_TEAM_ID));
  url.searchParams.set("startDate", apiDate(start));
  url.searchParams.set("endDate", apiDate(end));
  url.searchParams.set("hydrate", "team");

  const response = await fetch(url);
  if (!response.ok) throw new Error(`MLB schedule returned ${response.status}`);
  const data = await response.json();
  const games = (data.dates || []).flatMap((date) => date.games || []);
  const game = nextScheduledHeaderGame(games);
  if (!game) {
    setHeaderStat("[data-header-next]", "—");
    return;
  }

  const yankeesAreAway = Number(game.teams?.away?.team?.id) === HEADER_YANKEES_TEAM_ID;
  const opponent = yankeesAreAway ? game.teams?.home?.team : game.teams?.away?.team;
  const abbreviation = opponent?.abbreviation;
  if (abbreviation) setHeaderStat("[data-header-next]", `${yankeesAreAway ? "@" : ""}${abbreviation}`);
}

function standingsOrdinal(value) {
  const number = Number.parseInt(value, 10);
  if (!Number.isFinite(number)) return "";
  const remainder100 = number % 100;
  const suffix = remainder100 >= 11 && remainder100 <= 13
    ? "th"
    : ({ 1: "st", 2: "nd", 3: "rd" }[number % 10] || "th");
  return `${number}${suffix}`;
}

async function renderYankeesBrandRecord() {
  if (!yankeesBrandCopies.length) return;
  const recordLines = [...yankeesBrandCopies].map((brandCopy) => {
    brandCopy.classList.add("brand-copy");
    const newYork = brandCopy.querySelector(".brand-kicker");
    const yankees = brandCopy.querySelector(".brand-title");
    if (newYork && yankees) {
      newYork.textContent = `${newYork.textContent.trim()} ${yankees.textContent.trim()}`;
      newYork.classList.add("brand-wordmark");
      yankees.remove();
    }
    const line = document.createElement("p");
    line.className = "brand-record mb-0";
    line.setAttribute("aria-live", "polite");
    line.hidden = true;
    brandCopy.append(line);
    return line;
  });

  try {
    const season = new Date().getFullYear();
    const url = new URL("https://statsapi.mlb.com/api/v1/standings");
    url.searchParams.set("leagueId", "103");
    url.searchParams.set("season", season);
    url.searchParams.set("standingsTypes", "regularSeason");
    url.searchParams.set("hydrate", "team,division");
    const response = await fetch(url);
    if (!response.ok) throw new Error(`MLB standings returned ${response.status}`);
    const data = await response.json();
    const match = (data.records || []).flatMap((record) =>
      (record.teamRecords || []).map((teamRecord) => ({ record, teamRecord }))
    ).find(({ teamRecord }) => Number(teamRecord.team?.id) === HEADER_YANKEES_TEAM_ID);
    if (!match) throw new Error("Yankees standings unavailable");

    const { record, teamRecord } = match;
    const position = standingsOrdinal(teamRecord.divisionRank);
    const division = record.division?.name || "American League East";
    const label = `${position ? `${position} in ` : ""}${division} (${teamRecord.wins} - ${teamRecord.losses})`;
    recordLines.forEach((line) => {
      line.textContent = label;
      line.hidden = false;
    });

    setHeaderStat("[data-header-record]", `${teamRecord.wins}–${teamRecord.losses}`);
    const streak = teamRecord.streak?.streakCode || "—";
    setHeaderStat(
      "[data-header-streak]",
      streak,
      streak.toUpperCase().startsWith("W") ? "win" : streak.toUpperCase().startsWith("L") ? "loss" : ""
    );
  } catch (error) {
    recordLines.forEach((line) => line.remove());
  }
}

renderYankeesBrandRecord();
renderNextOpponent().catch(() => {});
