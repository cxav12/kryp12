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
      <span class="header-team-stat-label" data-header-label>Record</span>
      <strong data-header-value>&mdash;</strong>
    </div>
    <div class="header-team-stat">
      <span class="header-team-stat-label" data-header-label>Streak</span>
      <strong data-header-value>&mdash;</strong>
    </div>
    <div class="header-team-stat">
      <span class="header-team-stat-label" data-header-label>Next</span>
      <strong data-header-value>&mdash;</strong>
    </div>
  `;
  topbar.append(stats);
  return stats;
}

const yankeesHeaderStats = [...yankeesTopbars].map(createHeaderStats);

function setHeaderCard(index, label, value, tone = "") {
  yankeesHeaderStats.forEach((stats) => {
    const card = stats.querySelectorAll(".header-team-stat")[index];
    const output = card?.querySelector("[data-header-value]");
    const labelNode = card?.querySelector("[data-header-label]");
    if (!output || !labelNode) return;
    labelNode.textContent = label;
    output.textContent = value;
    output.classList.toggle("is-win", tone === "win");
    output.classList.toggle("is-loss", tone === "loss");
  });
}

function createYankeesBrandRecordLines() {
  if (!yankeesBrandCopies.length) return;
  return [...yankeesBrandCopies].map((brandCopy) => {
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
}

const yankeesBrandRecordLines = createYankeesBrandRecordLines() || [];

const headerGameTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "short",
});

function headerTeamAbbreviation(team) {
  return team?.abbreviation || team?.teamCode?.toUpperCase() || team?.fileCode?.toUpperCase() || "TBD";
}

function nextHeaderGameLabel(details) {
  if (typeof details === "string") return details;
  const game = details?.game;
  const opponent = details?.opponent;
  if (!game || !opponent) return "TBD";
  const yankeesAreAway = Number(game.teams?.away?.team?.id) === HEADER_YANKEES_TEAM_ID;
  const prefix = yankeesAreAway ? "@" : "vs";
  const start = new Date(game.gameDate || "");
  const date = game.officialDate ? new Intl.DateTimeFormat("en-US", {month: "short", day: "numeric", timeZone: "America/New_York"}).format(new Date(`${game.officialDate}T12:00:00Z`)) : "";
  const time = Number.isFinite(start.getTime()) && !game.status?.startTimeTBD ? ` · ${headerGameTimeFormatter.format(start)}` : "";
  return `${prefix} ${headerTeamAbbreviation(opponent)}${date ? ` · ${date}` : ""}${time}`;
}

let headerCountdownTimer;
let headerSeasonRefreshTimer;
let activeYankeesSeasonState;
function publishSeasonState(state) {
  activeYankeesSeasonState = state;
  window.YankeesPageSeason = state;
  window.dispatchEvent(new CustomEvent("yankees-season-mode", {detail: state}));
}

function renderHeaderState(state) {
  clearInterval(headerCountdownTimer);
  clearTimeout(headerSeasonRefreshTimer);
  const refreshDelay = state.offseasonSwitchAt ? Math.max(1000, Math.min(300000, state.offseasonSwitchAt - Date.now())) : 300000;
  headerSeasonRefreshTimer = setTimeout(renderYankeesHeader, refreshDelay);
  yankeesBrandRecordLines.forEach((line) => {
    line.textContent = state.subtitle || "";
    line.hidden = !state.subtitle;
  });
  yankeesHeaderStats.forEach(stats => {
    stats.classList.toggle("is-offseason", state.mode === "offseason");
    stats.setAttribute("aria-live", state.mode === "offseason" ? "off" : "polite");
    stats.querySelectorAll(".header-team-stat").forEach((card, index) => { card.hidden = index >= state.cards.length; });
  });
  state.cards.forEach(([label, rawValue, tone], index) => {
    if (rawValue && typeof rawValue === "object" && "countdownDate" in rawValue) {
      const tick = () => {
        setHeaderCard(index, label, window.YankeesHeaderSeason.openingCountdown(rawValue.countdownDate));
        if (rawValue.countdownDate && Date.now() >= window.YankeesHeaderSeason.openingDayStart(rawValue.countdownDate)) {
          clearInterval(headerCountdownTimer);
          renderYankeesHeader();
        }
      };
      tick();
      if (rawValue.countdownDate) headerCountdownTimer = setInterval(tick, 1000);
    } else {
      setHeaderCard(index, label, typeof rawValue === "object" ? nextHeaderGameLabel(rawValue) : rawValue, tone);
    }
  });
  publishSeasonState(state);
}

async function fetchHeaderData(season) {
  const standingsUrl = new URL("https://statsapi.mlb.com/api/v1/standings");
  standingsUrl.searchParams.set("leagueId", "103");
  standingsUrl.searchParams.set("season", season);
  standingsUrl.searchParams.set("standingsTypes", "regularSeason");
  standingsUrl.searchParams.set("hydrate", "team,division");

  const scheduleUrl = new URL("https://statsapi.mlb.com/api/v1/schedule");
  scheduleUrl.searchParams.set("sportId", "1");
  scheduleUrl.searchParams.set("teamId", String(HEADER_YANKEES_TEAM_ID));
  scheduleUrl.searchParams.set("startDate", `${season}-01-01`);
  scheduleUrl.searchParams.set("endDate", `${season}-12-31`);
  scheduleUrl.searchParams.set("gameTypes", "S,R,F,D,L,W");
  scheduleUrl.searchParams.set("hydrate", "team");

  const [standingsResult, scheduleResult] = await Promise.allSettled([
    fetch(standingsUrl, {signal: AbortSignal.timeout(15000)}).then((response) => {
      if (!response.ok) throw new Error(`MLB standings returned ${response.status}`);
      return response.json();
    }),
    fetch(scheduleUrl, {signal: AbortSignal.timeout(15000)}).then((response) => {
      if (!response.ok) throw new Error(`MLB schedule returned ${response.status}`);
      return response.json();
    }),
  ]);
  return {
    scheduleAvailable: scheduleResult.status === "fulfilled",
    standings: standingsResult.status === "fulfilled" ? standingsResult.value : null,
    games: scheduleResult.status === "fulfilled"
      ? (scheduleResult.value.dates || []).flatMap((date) => date.games || [])
      : [],
  };
}

async function renderYankeesHeader() {
  if (!window.YankeesHeaderSeason) return;
  const model = window.YankeesHeaderSeason;
  const today = model.easternDate();
  const season = Number(today.slice(0, 4));
  try {
    const data = await fetchHeaderData(season);
    if (!data.scheduleAvailable) throw new Error("Schedule unavailable");
    if (!model.regularSeasonStarted({season, games: data.games})) {
      renderHeaderState(model.buildOffseasonState({season: season - 1, games: data.games}));
      return;
    }
    const state = model.buildHeaderState({ season, ...data });
    if (["postseason-complete", "season-complete"].includes(state.mode)) {
      const finalGame = model.lastSeasonGame({season, ...data});
      let switchAt = null;
      if (finalGame?.gamePk) {
        try {
          const url = new URL(`https://statsapi.mlb.com/api/v1.1/game/${finalGame.gamePk}/feed/live`);
          url.searchParams.set("fields", "gamePk,gameData,status,abstractGameState,detailedState,liveData,plays,currentPlay,allPlays,about,endTime");
          const response = await fetch(url, {signal: AbortSignal.timeout(15000)});
          if (!response.ok) throw new Error("Final game timing unavailable");
          switchAt = model.offseasonSwitchAt({season, ...data, feed: await response.json()});
        } catch {
          // Keep the game view until the end time can be verified.
        }
      }
      if (!switchAt || Date.now() < switchAt) {
        renderHeaderState({...state, offseasonSwitchAt: switchAt});
        return;
      }
      renderHeaderState(model.buildOffseasonState({ season }));
      try {
        const url = new URL("https://statsapi.mlb.com/api/v1/schedule");
        url.search = new URLSearchParams({ sportId: "1", teamId: String(HEADER_YANKEES_TEAM_ID), season: String(season + 1), gameTypes: "S,R" });
        const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error("Next season schedule unavailable");
        const schedule = await response.json();
        const games = (schedule.dates || []).flatMap((date) => date.games || []);
        renderHeaderState(model.buildOffseasonState({ season, games }));
      } catch {
        // Unconfirmed dates remain TBD; the offseason layout stays available.
      }
      return;
    }
    renderHeaderState(state);
  } catch {
    if (!activeYankeesSeasonState) publishSeasonState({mode: "unavailable"});
  }
}

renderYankeesHeader();

function setupStickySiteNavigation() {
  const navs = [...document.querySelectorAll(".desktop-site-nav, .site-nav")];
  if (!navs.length) return;

  const placeholders = new Map(navs.map((nav) => {
    const placeholder = document.createElement("div");
    placeholder.className = "site-nav-sticky-placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    nav.before(placeholder);
    if (nav.matches(".site-nav")) {
      nav.addEventListener("toggle", () => updatePlaceholder(nav));
    }
    return [nav, placeholder];
  }));
  let activeNav = null;
  let threshold = 0;

  function visibleNav() {
    return navs.find((nav) => getComputedStyle(nav).display !== "none") || null;
  }

  function updatePlaceholder(nav) {
    if (!nav?.classList.contains("is-stuck")) return;
    placeholders.get(nav).style.height = `${nav.offsetHeight + 14}px`;
  }

  function update() {
    if (!activeNav) return;
    const shouldStick = window.scrollY >= threshold;
    activeNav.classList.toggle("is-stuck", shouldStick);
    const placeholder = placeholders.get(activeNav);
    placeholder.classList.toggle("active", shouldStick);
    placeholder.style.height = shouldStick ? `${activeNav.offsetHeight + 14}px` : "";
  }

  function measure() {
    navs.forEach((nav) => nav.classList.remove("is-stuck"));
    placeholders.forEach((placeholder) => {
      placeholder.classList.remove("active");
      placeholder.style.height = "";
    });
    activeNav = visibleNav();
    if (activeNav) {
      const shell = activeNav.closest(".site-shell, .app-shell");
      if (shell) {
        const shellRect = shell.getBoundingClientRect();
        const shellStyle = getComputedStyle(shell);
        const contentWidth = shellRect.width
          - Number.parseFloat(shellStyle.paddingLeft || 0)
          - Number.parseFloat(shellStyle.paddingRight || 0);
        activeNav.style.setProperty("--sticky-site-content-width", `${contentWidth}px`);
      }
    }
    threshold = activeNav ? activeNav.getBoundingClientRect().top + window.scrollY : 0;
    update();
  }

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", measure);
  window.addEventListener("load", measure, { once: true });
  measure();
}

setupStickySiteNavigation();

document.addEventListener("error", (event) => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  const source = image.currentSrc || image.src || "";
  if (!source.includes("/headshot/") || image.dataset.silhouetteFallback === "true") return;

  event.stopImmediatePropagation();
  image.dataset.silhouetteFallback = "true";
  image.classList.add("player-silhouette-fallback");
  image.classList.remove("invisible", "is-unavailable", "is-missing");
  image.hidden = false;
  const isNonYankeesPlayer = image.dataset.playerTeamFallback === "other"
    || (image.dataset.teamId && Number(image.dataset.teamId) !== HEADER_YANKEES_TEAM_ID);
  image.src = isNonYankeesPlayer
    ? "/yankees/assets/non-yankees-player-silhouette.png?v=20260910-neutral3"
    : "/yankees/assets/player-silhouette.png?v=20260908-yankees1";
}, true);

// Recheck on return to a background tab, including across the season boundary.
document.addEventListener("visibilitychange", () => { if (!document.hidden) renderYankeesHeader(); });
