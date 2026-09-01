const MLB_API = "https://statsapi.mlb.com/api/v1";
const YANKEES_TEAM_ID = 147;
const SEASON = new Date().getFullYear();
const PAGE_SIZE = 25;

const COLUMNS = {
  hitting: [
    ["gamesPlayed", "G", "desc"],
    ["atBats", "AB", "desc"],
    ["runs", "R", "desc"],
    ["hits", "H", "desc"],
    ["doubles", "2B", "desc"],
    ["triples", "3B", "desc"],
    ["homeRuns", "HR", "desc"],
    ["rbi", "RBI", "desc"],
    ["baseOnBalls", "BB", "desc"],
    ["strikeOuts", "SO", "asc"],
    ["stolenBases", "SB", "desc"],
    ["caughtStealing", "CS", "asc"],
    ["avg", "AVG", "desc"],
    ["obp", "OBP", "desc"],
    ["slg", "SLG", "desc"],
    ["ops", "OPS", "desc"],
  ],
  pitching: [
    ["wins", "W", "desc"],
    ["losses", "L", "asc"],
    ["era", "ERA", "asc"],
    ["gamesPlayed", "G", "desc"],
    ["gamesStarted", "GS", "desc"],
    ["completeGames", "CG", "desc"],
    ["shutouts", "SHO", "desc"],
    ["saves", "SV", "desc"],
    ["saveOpportunities", "SVO", "desc"],
    ["inningsPitched", "IP", "desc"],
    ["hits", "H", "asc"],
    ["runs", "R", "asc"],
    ["earnedRuns", "ER", "asc"],
    ["homeRuns", "HR", "asc"],
    ["hitBatsmen", "HB", "asc"],
    ["baseOnBalls", "BB", "asc"],
    ["strikeOuts", "SO", "desc"],
    ["whip", "WHIP", "asc"],
    ["avg", "AVG", "asc"],
  ],
};

const MOBILE_COLUMNS = {
  hitting: [
    ["ops", "OPS", "On-base plus slugging", "desc"],
    ["avg", "AVG", "Batting average", "desc"],
    ["homeRuns", "HR", "Home runs", "desc"],
    ["rbi", "RBI", "Runs batted in", "desc"],
    ["runs", "R", "Runs scored", "desc"],
    ["hits", "H", "Hits", "desc"],
    ["doubles", "2B", "Doubles", "desc"],
  ],
  pitching: [
    ["era", "ERA", "Earned run average", "asc"],
    ["wins", "W", "Wins", "desc"],
    ["strikeOuts", "SO", "Strikeouts", "desc"],
    ["whip", "WHIP", "Walks and hits per inning pitched", "asc"],
    ["saves", "SV", "Saves", "desc"],
    ["inningsPitched", "IP", "Innings pitched", "desc"],
  ],
};

const state = {
  scope: "player",
  group: "hitting",
  rows: { hitting: null, pitching: null },
  teamRows: { hitting: null, pitching: null },
  qualifiedIds: { hitting: null, pitching: null },
  qualifiedOnly: true,
  sortKey: "homeRuns",
  sortDirection: "desc",
  page: 1,
};

const els = {
  status: document.querySelector("#data-status"),
  title: document.querySelector("#stats-view-title"),
  summary: document.querySelector("#stats-summary"),
  head: document.querySelector("#stats-head"),
  body: document.querySelector("#stats-body"),
  pagination: document.querySelector("#stats-pagination"),
  mobileList: document.querySelector("#mobile-stat-list"),
  mobileCategories: document.querySelector("#mobile-stat-categories"),
  qualifiedOnly: document.querySelector("#qualified-only"),
  statsCard: document.querySelector(".stats-card"),
  scopes: document.querySelectorAll("[data-scope]"),
  toggles: document.querySelectorAll("[data-group]"),
};

function setStatus(message, tone = "neutral") {
  els.status.textContent = message;
  els.status.style.color = tone === "error" ? "#ffbec4" : tone === "good" ? "#9af0c8" : "";
}

function statUrl(group, playerPool = "ALL") {
  const url = new URL(`${MLB_API}/stats`);
  url.search = new URLSearchParams({
    stats: "season",
    group,
    season: String(SEASON),
    sportIds: "1",
    playerPool,
    limit: "5000",
    hydrate: "person,team",
  });
  return url;
}

function teamStatUrl(group) {
  const url = new URL(`${MLB_API}/teams/stats`);
  url.search = new URLSearchParams({
    stats: "season",
    group,
    season: String(SEASON),
    sportIds: "1",
  });
  return url;
}

async function loadTeamGroup(group) {
  if (state.teamRows[group]) return;
  setStatus(`Loading team ${group === "hitting" ? "batting" : "pitching"} stats`);
  const response = await fetch(teamStatUrl(group));
  if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
  const data = await response.json();
  state.teamRows[group] = (data?.stats?.[0]?.splits || []).map((split) => ({
    playerId: split.team?.id,
    playerName: split.team?.name || "Unknown Team",
    team: "",
    position: "",
    isTeam: true,
    stat: split.stat || {},
  }));
}

async function loadGroup(group) {
  if (state.rows[group]) return;
  setStatus(`Loading ${group === "hitting" ? "batting" : "pitching"} stats`);
  const [allResponse, qualifiedResponse] = await Promise.all([
    fetch(statUrl(group, "ALL")),
    fetch(statUrl(group, "QUALIFIED")),
  ]);
  if (!allResponse.ok) throw new Error(`MLB API returned ${allResponse.status}`);
  const data = await allResponse.json();
  const qualifiedData = qualifiedResponse.ok ? await qualifiedResponse.json() : null;
  const splits = data?.stats?.[0]?.splits || [];
  state.rows[group] = splits
    .filter((split) => split.player?.id && Number(split.stat?.gamesPlayed || 0) > 0)
    .map((split) => ({
      playerId: split.player.id,
      playerName: split.player.fullName || "Unknown Player",
      position: split.player.primaryPosition?.abbreviation || "",
      teamId: split.team?.id,
      team: split.team?.abbreviation || "—",
      stat: split.stat || {},
    }));
  state.qualifiedIds[group] = new Set(
    (qualifiedData?.stats?.[0]?.splits || []).map((split) => Number(split.player?.id)).filter(Boolean),
  );
}

function numberValue(row, key) {
  const value = row.stat?.[key];
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : null;
}

function sortedRows() {
  const direction = state.sortDirection === "asc" ? 1 : -1;
  const qualifiedIds = state.qualifiedIds[state.group];
  const sourceRows = state.scope === "team" ? state.teamRows[state.group] : state.rows[state.group];
  let rows = sourceRows || [];
  if (state.scope === "yankees") {
    rows = rows.filter((row) => Number(row.teamId) === YANKEES_TEAM_ID || row.team === "NYY");
  } else if (state.scope === "player" && state.qualifiedOnly && qualifiedIds?.size) {
    rows = rows.filter((row) => qualifiedIds.has(Number(row.playerId)));
  }
  return [...rows].sort((a, b) => {
    const aValue = numberValue(a, state.sortKey);
    const bValue = numberValue(b, state.sortKey);
    if (aValue === null && bValue !== null) return 1;
    if (aValue !== null && bValue === null) return -1;
    if (aValue === null && bValue === null) return a.playerName.localeCompare(b.playerName);
    if (aValue !== bValue) return (aValue - bValue) * direction;
    return a.playerName.localeCompare(b.playerName);
  });
}

function formatValue(row, key) {
  const value = row.stat?.[key];
  return value === undefined || value === null || value === "" ? "—" : value;
}

function isYankeesEntry(row) {
  return Number(row.teamId) === YANKEES_TEAM_ID
    || Number(row.playerId) === YANKEES_TEAM_ID
    || row.team === "NYY";
}

function setTableMessage(message, colspan = COLUMNS[state.group].length + 2) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.className = "stats-message";
  cell.colSpan = colspan;
  cell.textContent = message;
  row.append(cell);
  els.body.replaceChildren(row);
}

function renderHead() {
  const row = document.createElement("tr");
  const playerHead = document.createElement("th");
  playerHead.scope = "col";
  playerHead.textContent = state.scope === "team" ? "Team" : "Player";
  row.append(playerHead);

  if (state.scope === "player") {
    const teamHead = document.createElement("th");
    teamHead.scope = "col";
    teamHead.textContent = "Team";
    row.append(teamHead);
  }

  COLUMNS[state.group].forEach(([key, label]) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    const button = document.createElement("button");
    const active = key === state.sortKey;
    cell.classList.toggle("is-sort-column", active);
    button.type = "button";
    button.className = `sort-button${active ? " active" : ""}`;
    button.dataset.sortKey = key;
    button.dataset.direction = active ? state.sortDirection : "";
    button.setAttribute("aria-label", `Sort by ${label}${active ? `, currently ${state.sortDirection === "desc" ? "descending" : "ascending"}` : ""}`);
    button.textContent = label;
    cell.setAttribute("aria-sort", active ? (state.sortDirection === "desc" ? "descending" : "ascending") : "none");
    cell.append(button);
    row.append(cell);
  });
  els.head.replaceChildren(row);
}

function renderBody(rows) {
  if (!rows.length) {
    setTableMessage(`No ${state.group === "hitting" ? "batting" : "pitching"} statistics are available.`);
    return;
  }

  const fragment = document.createDocumentFragment();
  rows.forEach((item) => {
    const row = document.createElement("tr");
    row.classList.toggle("is-yankees-row", isYankeesEntry(item));
    const playerCell = document.createElement("td");
    const player = document.createElement("div");
    player.className = "player-cell";
    const identity = document.createElement(item.isTeam ? "strong" : "a");
    identity.textContent = item.playerName;
    if (!item.isTeam) identity.href = `../player-profile/?player=${item.playerId}`;
    player.append(identity);
    playerCell.append(player);
    row.append(playerCell);
    if (!item.isTeam && state.scope === "player") {
      const teamCell = document.createElement("td");
      teamCell.className = "team-code";
      teamCell.textContent = item.team;
      row.append(teamCell);
    }
    COLUMNS[state.group].forEach(([key, label]) => {
      const cell = document.createElement("td");
      cell.dataset.label = label;
      cell.textContent = formatValue(item, key);
      cell.classList.toggle("is-sort-column", key === state.sortKey);
      row.append(cell);
    });
    fragment.append(row);
  });
  els.body.replaceChildren(fragment);
}

function renderMobileLeaderboard(rows, start) {
  const categories = MOBILE_COLUMNS[state.group];
  const activeCategory = categories.find(([key]) => key === state.sortKey) || categories[0];
  const [activeKey] = activeCategory;
  const listFragment = document.createDocumentFragment();

  rows.forEach((item, index) => {
    const row = document.createElement("li");
    row.className = "mobile-stat-row";
    row.classList.toggle("is-yankees-row", isYankeesEntry(item));
    const rank = document.createElement("span");
    rank.className = "mobile-stat-rank";
    rank.textContent = start + index + 1;
    const link = document.createElement(item.isTeam ? "div" : "a");
    link.className = "mobile-player-link";
    if (!item.isTeam) link.href = `../player-profile/?player=${item.playerId}`;
    const image = document.createElement("img");
    if (item.isTeam) image.classList.add("team-logo-image", "team-logo");
    image.src = item.isTeam
      ? `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${item.playerId}.svg`
      : `https://img.mlbstatic.com/mlb-photos/image/upload/w_80,q_auto:best/v1/people/${item.playerId}/headshot/silo/current`;
    image.alt = "";
    image.loading = "lazy";
    image.addEventListener("error", () => image.classList.add("is-missing"), { once: true });
    const identity = document.createElement("span");
    identity.className = "mobile-player-identity";
    const name = document.createElement("strong");
    name.textContent = item.playerName;
    const detail = document.createElement("small");
    detail.textContent = item.isTeam ? "MLB" : [item.team, item.position].filter(Boolean).join(" · ");
    identity.append(name, detail);
    link.append(image, identity);
    const value = document.createElement("strong");
    value.className = "mobile-stat-value";
    value.textContent = formatValue(item, activeKey);
    row.append(rank, link, value);
    listFragment.append(row);
  });
  els.mobileList.replaceChildren(listFragment);

  const categoryFragment = document.createDocumentFragment();
  categories.forEach(([key, label, description, direction]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `mobile-stat-category${key === activeKey ? " active" : ""}`;
    button.dataset.mobileSortKey = key;
    button.dataset.direction = direction;
    button.textContent = label;
    button.setAttribute("aria-label", `Show leaders in ${description}`);
    button.setAttribute("aria-pressed", String(key === activeKey));
    categoryFragment.append(button);
  });
  els.mobileCategories.replaceChildren(categoryFragment);
}

function pageButton(label, accessibleLabel, page) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "page-button";
  button.textContent = label;
  button.dataset.page = page;
  button.setAttribute("aria-label", accessibleLabel);
  return button;
}

function renderPagination(totalPages) {
  els.pagination.replaceChildren();
  if (totalPages <= 1) return;
  const previous = pageButton("‹", "Previous page", Math.max(state.page - 1, 1));
  previous.disabled = state.page === 1;
  const summary = document.createElement("span");
  summary.className = "pagination-summary";
  summary.textContent = `Page ${state.page} of ${totalPages}`;
  summary.setAttribute("aria-live", "polite");
  const next = pageButton("›", "Next page", Math.min(state.page + 1, totalPages));
  next.disabled = state.page === totalPages;
  els.pagination.append(previous, summary, next);
}

function render() {
  const rows = sortedRows();
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * PAGE_SIZE;
  const visibleRows = rows.slice(start, start + PAGE_SIZE);
  const groupLabel = state.group === "hitting" ? "Batting" : "Pitching";

  els.title.textContent = state.scope === "yankees" ? `Yankees ${groupLabel}` : groupLabel;
  const subject = state.scope === "team"
    ? "teams"
    : state.scope === "yankees"
      ? "Yankees players"
      : `${state.qualifiedOnly ? "qualified " : ""}players`;
  els.summary.textContent = `${rows.length.toLocaleString()} ${subject} · ${SEASON} regular season · 25 per page`;
  els.qualifiedOnly.closest(".qualified-filter").hidden = state.scope !== "player";
  els.scopes.forEach((button) => {
    const active = button.dataset.scope === state.scope;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  els.toggles.forEach((button) => {
    const active = button.dataset.group === state.group;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderHead();
  renderBody(visibleRows);
  renderMobileLeaderboard(visibleRows, start);
  renderPagination(totalPages);
}

async function setGroup(group) {
  const loadedRows = state.scope === "team" ? state.teamRows[group] : state.rows[group];
  if (!COLUMNS[group] || (group === state.group && loadedRows)) return;
  state.group = group;
  state.page = 1;
  const defaultColumn = group === "hitting" ? ["homeRuns", "desc"] : ["strikeOuts", "desc"];
  [state.sortKey, state.sortDirection] = defaultColumn;
  setTableMessage(`Loading ${group === "hitting" ? "batting" : "pitching"} statistics`, COLUMNS[group].length + 2);
  els.pagination.replaceChildren();
  try {
    if (state.scope === "team") await loadTeamGroup(group);
    else await loadGroup(group);
    render();
    setStatus("Live MLB data", "good");
  } catch (error) {
    setStatus("Data connection issue", "error");
    setTableMessage(`Could not load player statistics. ${error.message}`, COLUMNS[group].length + 2);
  }
}

function bindEvents() {
  els.scopes.forEach((button) => button.addEventListener("click", async () => {
    if (button.dataset.scope === state.scope) return;
    state.scope = button.dataset.scope;
    state.page = 1;
    try {
      if (state.scope === "team") await loadTeamGroup(state.group);
      else await loadGroup(state.group);
      render();
      setStatus("Live MLB data", "good");
    } catch (error) {
      setStatus("Data connection issue", "error");
    }
  }));
  els.toggles.forEach((button) => button.addEventListener("click", () => setGroup(button.dataset.group)));
  els.qualifiedOnly.addEventListener("change", () => {
    state.qualifiedOnly = els.qualifiedOnly.checked;
    state.page = 1;
    render();
  });
  els.mobileCategories.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mobile-sort-key]");
    if (!button) return;
    state.sortKey = button.dataset.mobileSortKey;
    state.sortDirection = button.dataset.direction;
    state.page = 1;
    render();
  });
  els.head.addEventListener("click", (event) => {
    const button = event.target.closest("[data-sort-key]");
    if (!button) return;
    const column = COLUMNS[state.group].find(([key]) => key === button.dataset.sortKey);
    if (!column) return;
    if (state.sortKey === column[0]) {
      state.sortDirection = state.sortDirection === "desc" ? "asc" : "desc";
    } else {
      state.sortKey = column[0];
      state.sortDirection = column[2];
    }
    state.page = 1;
    render();
  });
  els.pagination.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (!button || button.disabled) return;
    state.page = Number(button.dataset.page);
    render();
    els.statsCard.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

async function init() {
  bindEvents();
  try {
    await loadGroup("hitting");
    render();
    setStatus("Live MLB data", "good");
  } catch (error) {
    setStatus("Data connection issue", "error");
    setTableMessage(`Could not load player statistics. ${error.message}`);
  }
}

init();
