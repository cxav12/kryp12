const TEAM_ID = 147;
const MLB_API = "https://statsapi.mlb.com/api/v1";
const TRANSACTIONS_PER_PAGE = 6;
const POSITION_ORDER = ["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH", "OF", "IF", "UTIL"];
const POSITION_KEYS = new Set(POSITION_ORDER);
const shortDateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});

const state = {
  transactions: [],
  transactionPage: 1,
};

const els = {
  status: document.querySelector("#data-status"),
  rosterTabs: document.querySelectorAll(".roster-tab"),
  rosterGroups: document.querySelectorAll(".roster-group"),
  batters: document.querySelector("#batters-list"),
  pitchers: document.querySelector("#pitchers-list"),
  injuredList: document.querySelector("#injured-list"),
  optioned: document.querySelector("#optioned-list"),
  rosterCount: document.querySelector("#roster-count"),
  battersCount: document.querySelector("#batters-count"),
  pitchersCount: document.querySelector("#pitchers-count"),
  injuredListCount: document.querySelector("#injured-list-count"),
  optionedCount: document.querySelector("#optioned-count"),
  transactionFeed: document.querySelector("#transaction-feed"),
  transactionPagination: document.querySelector("#transaction-pagination"),
  transactionWindow: document.querySelector("#transaction-window"),
};

const api = {
  async get(path, params = {}) {
    const url = new URL(`${MLB_API}${path}`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
    });
    const response = await fetch(url);
    if (!response.ok) throw new Error(`MLB API returned ${response.status}`);
    return response.json();
  },
  async roster(rosterType = "active") {
    return this.get(`/teams/${TEAM_ID}/roster`, { rosterType, hydrate: "person" });
  },
  async transactions() {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 45);
    els.transactionWindow.textContent = `${niceDate(formatDate(start))} - ${niceDate(formatDate(end))}`;
    return this.get("/transactions", {
      teamId: TEAM_ID,
      startDate: formatDate(start),
      endDate: formatDate(end),
    });
  },
};

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function niceDate(value) {
  if (!value) return "Unknown";
  return shortDateFormatter.format(new Date(`${value}T12:00:00`));
}

function setStatus(message, tone = "neutral") {
  els.status.textContent = message;
  els.status.style.color = tone === "error" ? "#ffbec4" : tone === "good" ? "#9af0c8" : "";
}

function isIlMove(item) {
  const description = item.description || item.note || item.typeDesc || "";
  return /injured|injury|10-day|15-day|60-day|\bIL\b|rehab|reinstated/i.test(description);
}

function transactionType(item) {
  const description = `${item.description || ""} ${item.note || ""} ${item.typeDesc || ""}`;
  if (/recall|recalled/i.test(description)) return { key: "recalled", label: "Recall" };
  if (/option|optioned/i.test(description)) return { key: "optioned", label: "Option" };
  if (/activate|activated|reinstate|reinstated/i.test(description)) return { key: "activated", label: "Active" };
  if (/injured|injury|10-day|15-day|60-day|\bIL\b|rehab/i.test(description)) return { key: "il", label: "IL" };
  if (/select|selected|contract/i.test(description)) return { key: "selected", label: "Select" };
  if (/assign|assigned|designated/i.test(description)) return { key: "assigned", label: "Assign" };
  if (/claim|claimed|acquire|acquired|trade|traded/i.test(description)) return { key: "acquired", label: "Acquire" };
  if (/sign|signed/i.test(description)) return { key: "signed", label: "Sign" };
  if (/release|released/i.test(description)) return { key: "released", label: "Release" };
  return { key: "other", label: item.typeDesc || "Move" };
}

function isPitcher(entry) {
  return entry.position?.abbreviation === "P" || entry.position?.code === "1";
}

function isInjuredListEntry(entry) {
  const code = entry.status?.code || "";
  const description = entry.status?.description || "";
  return /^D\d+$/i.test(code) || /injured/i.test(description);
}

function isOptionedEntry(entry) {
  const code = entry.status?.code || "";
  const description = entry.status?.description || "";
  return /^MIN$/i.test(code) || /minor|option/i.test(description);
}

function positionKey(entry) {
  const abbr = entry.position?.abbreviation || "";
  if (POSITION_KEYS.has(abbr)) return abbr;
  if (abbr.includes("OF")) return "OF";
  if (abbr.includes("IF")) return "IF";
  return "UTIL";
}

function positionRank(entry) {
  const index = POSITION_ORDER.indexOf(positionKey(entry));
  return index === -1 ? POSITION_ORDER.length : index;
}

function rosterCard(entry, showStatus = false, statusOverride = "") {
  const link = document.createElement("a");
  link.className = "roster-link";
  link.href = `../player-profile/?player=${entry.person.id}`;
  const playerId = Number(entry.person.id);
  if (Number.isInteger(playerId)) {
    link.style.setProperty("--roster-headshot", `url("https://img.mlbstatic.com/mlb-photos/image/upload/w_96,q_auto:best/v1/people/${playerId}/headshot/silo/current")`);
  }
  const name = document.createElement("span");
  name.textContent = entry.person.fullName;
  const details = document.createElement("small");
  const position = entry.position?.abbreviation || "NYY";
  const status = statusOverride || entry.status?.description || "Injured List";
  const number = entry.jerseyNumber ? `#${entry.jerseyNumber} - ` : "";
  details.textContent = showStatus
    ? `${number}${position} - ${status}`
    : `${number}${position}`;
  link.append(name, details);
  return link;
}

function renderRosterGroup(target, entries, showStatus = false, statusOverride = "") {
  target.replaceChildren();
  if (!entries.length) {
    target.innerHTML = `<p class="empty">No players returned.</p>`;
    return;
  }
  entries.forEach((entry) => target.append(rosterCard(entry, showStatus, statusOverride)));
}

async function renderRoster() {
  try {
    const [activeData, fortyManData] = await Promise.all([api.roster(), api.roster("40Man")]);
    const roster = (activeData.roster || []).slice().sort((a, b) => a.person.fullName.localeCompare(b.person.fullName));
    const injuredList = (fortyManData.roster || [])
      .filter(isInjuredListEntry)
      .sort((a, b) => a.person.fullName.localeCompare(b.person.fullName));
    const activeIds = new Set(roster.map((entry) => Number(entry.person.id)));
    const optioned = (fortyManData.roster || [])
      .filter((entry) => !activeIds.has(Number(entry.person.id)))
      .filter((entry) => !isInjuredListEntry(entry) && isOptionedEntry(entry))
      .sort((a, b) => a.person.fullName.localeCompare(b.person.fullName));
    const pitchers = roster.filter(isPitcher);
    const batters = roster
      .filter((entry) => !isPitcher(entry))
      .sort((a, b) => positionRank(a) - positionRank(b) || a.person.fullName.localeCompare(b.person.fullName));

    els.rosterCount.textContent = `${roster.length} active - ${injuredList.length} IL - ${optioned.length} AAA`;
    els.battersCount.textContent = `${batters.length}`;
    els.pitchersCount.textContent = `${pitchers.length}`;
    els.injuredListCount.textContent = `${injuredList.length}`;
    els.optionedCount.textContent = `${optioned.length}`;

    if (!roster.length) {
      els.batters.innerHTML = `<p class="empty">No active roster entries were returned.</p>`;
      els.pitchers.replaceChildren();
      renderRosterGroup(els.injuredList, injuredList, true);
      renderRosterGroup(els.optioned, optioned, true, "Optioned to AAA");
      return true;
    }

    renderRosterGroup(els.batters, batters);
    renderRosterGroup(els.pitchers, pitchers);
    renderRosterGroup(els.injuredList, injuredList, true);
    renderRosterGroup(els.optioned, optioned, true, "Optioned to AAA");
    return true;
  } catch (error) {
    els.batters.innerHTML = `<p class="error">Roster data is unavailable right now.</p>`;
    els.pitchers.replaceChildren();
    els.injuredList.replaceChildren();
    els.optioned.replaceChildren();
    els.rosterCount.textContent = "Unavailable";
    els.battersCount.textContent = "--";
    els.pitchersCount.textContent = "--";
    els.injuredListCount.textContent = "--";
    els.optionedCount.textContent = "--";
    return false;
  }
}

function renderTransactionPage() {
  const totalPages = Math.max(1, Math.ceil(state.transactions.length / TRANSACTIONS_PER_PAGE));
  state.transactionPage = Math.min(Math.max(1, state.transactionPage), totalPages);
  const start = (state.transactionPage - 1) * TRANSACTIONS_PER_PAGE;
  const pageItems = state.transactions.slice(start, start + TRANSACTIONS_PER_PAGE);

  els.transactionFeed.replaceChildren();
  if (!pageItems.length) {
    els.transactionFeed.innerHTML = `<p class="empty">No Yankees transactions were returned for this window.</p>`;
  } else {
    pageItems.forEach((item) => els.transactionFeed.append(transactionCard(item)));
  }

  renderTransactionPagination(totalPages);
}

function transactionCard(item) {
  const type = transactionType(item);
  const description = item.description || item.note || item.typeDesc || "Transaction";
  const article = document.createElement("article");
  article.className = `transaction-card ${type.key}`;
  if (isIlMove(item)) article.classList.add("il");

  const meta = document.createElement("div");
  meta.className = "transaction-meta";

  const badge = document.createElement("span");
  badge.className = "transaction-badge";
  badge.textContent = type.label;

  const detail = document.createElement("small");
  detail.textContent = `${niceDate(item.date)} - ${item.typeDesc || "Move"}`;

  const copy = document.createElement("p");
  copy.textContent = description;

  meta.append(badge, detail);
  article.append(meta, copy);
  return article;
}

function renderTransactionPagination(totalPages) {
  els.transactionPagination.replaceChildren();
  if (!state.transactions.length) return;

  const controls = document.createElement("div");
  controls.className = "pagination-controls";

  const prev = transactionPageButton("‹", "Previous page", state.transactionPage - 1, state.transactionPage === 1);
  controls.append(prev);

  const label = document.createElement("span");
  label.className = "pagination-summary";
  label.textContent = `Page ${state.transactionPage} of ${totalPages}`;
  controls.append(label);

  const next = transactionPageButton("›", "Next page", state.transactionPage + 1, state.transactionPage === totalPages);
  controls.append(next);
  els.transactionPagination.append(controls);
}

function transactionPageButton(label, accessibleLabel, page, disabled) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pagination-button";
  button.textContent = label;
  button.setAttribute("aria-label", accessibleLabel);
  button.disabled = disabled;
  button.dataset.page = page;
  return button;
}

async function renderTransactions() {
  try {
    const data = await api.transactions();
    const transactions = (data.transactions || []).slice().reverse();
    state.transactions = transactions;
    state.transactionPage = 1;
    renderTransactionPage();
    return true;
  } catch (error) {
    els.transactionFeed.innerHTML = `<p class="error">Transactions are unavailable right now.</p>`;
    els.transactionPagination.replaceChildren();
    return false;
  }
}

function bindEvents() {
  els.transactionPagination.addEventListener("click", (event) => {
    const button = event.target.closest(".pagination-button");
    if (!button || button.disabled) return;
    state.transactionPage = Number(button.dataset.page);
    renderTransactionPage();
  });

  els.rosterTabs.forEach((button) => {
    button.addEventListener("click", () => setRosterTab(button.dataset.rosterTab));
  });
}

function setRosterTab(tab) {
  els.rosterTabs.forEach((button) => {
    const active = button.dataset.rosterTab === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  els.rosterGroups.forEach((panel) => {
    const active = panel.id === `${tab}-panel`;
    panel.classList.toggle("active", active);
    panel.hidden = !active;
  });
}

async function init() {
  bindEvents();
  setStatus("Loading roster");
  const results = await Promise.all([renderRoster(), renderTransactions()]);
  setStatus(results.every(Boolean) ? "Live MLB data" : "Some MLB data is unavailable", results.every(Boolean) ? "good" : "error");
}

init();
