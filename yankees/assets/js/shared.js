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
  const time = Number.isFinite(start.getTime()) ? ` · ${headerGameTimeFormatter.format(start)}` : "";
  return `${prefix} ${headerTeamAbbreviation(opponent)}${time}`;
}

function renderHeaderState(state) {
  yankeesBrandRecordLines.forEach((line) => {
    line.textContent = state.subtitle || "";
    line.hidden = !state.subtitle;
  });
  state.cards.forEach(([label, rawValue, tone], index) => {
    const value = typeof rawValue === "object" ? nextHeaderGameLabel(rawValue) : rawValue;
    setHeaderCard(index, label, value, tone);
  });
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
  scheduleUrl.searchParams.set("gameTypes", "R,F,D,L,W");
  scheduleUrl.searchParams.set("hydrate", "team");

  const [standingsResult, scheduleResult] = await Promise.allSettled([
    fetch(standingsUrl).then((response) => {
      if (!response.ok) throw new Error(`MLB standings returned ${response.status}`);
      return response.json();
    }),
    fetch(scheduleUrl).then((response) => {
      if (!response.ok) throw new Error(`MLB schedule returned ${response.status}`);
      return response.json();
    }),
  ]);
  return {
    standings: standingsResult.status === "fulfilled" ? standingsResult.value : null,
    games: scheduleResult.status === "fulfilled"
      ? (scheduleResult.value.dates || []).flatMap((date) => date.games || [])
      : [],
  };
}

async function renderYankeesHeader() {
  if (!window.YankeesHeaderSeason) return;
  const season = new Date().getFullYear();

  try {
    const data = await fetchHeaderData(season);
    const state = window.YankeesHeaderSeason.buildHeaderState({ season, ...data });
    renderHeaderState(state);
  } catch (error) {
    // Keep the neutral header placeholders when MLB data cannot be resolved safely.
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
