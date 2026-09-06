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
  coaches: document.querySelector("#coaches-list"),
  coachesCount: document.querySelector("#coaches-count"),
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
  async coaches(season = new Date().getFullYear()) {
    return this.get(`/teams/${TEAM_ID}/coaches`, {
      season,
      hydrate: "person",
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
  if (/recall|recalled/i.test(description)) return { key: "recalled", label: "Recalled" };
  if (/option|optioned/i.test(description)) return { key: "optioned", label: "Optioned" };
  if (/activate|activated|reinstate|reinstated/i.test(description)) return { key: "activated", label: "Activated" };
  if (/injured|injury|10-day|15-day|60-day|\bIL\b|rehab/i.test(description)) return { key: "il", label: "Injured List" };
  if (/select|selected|contract/i.test(description)) return { key: "selected", label: "Selected" };
  if (/assign|assigned|designated/i.test(description)) return { key: "assigned", label: "Assigned" };
  if (/claim|claimed|acquire|acquired|trade|traded/i.test(description)) return { key: "acquired", label: "Acquired" };
  if (/sign|signed/i.test(description)) return { key: "signed", label: "Signed" };
  if (/release|released/i.test(description)) return { key: "released", label: "Released" };
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

function playerExperience(person) {
  const debutYear = Number(String(person?.mlbDebutDate || "").slice(0, 4));
  if (!debutYear) return "MLB experience unavailable";
  const seasons = Math.max(1, new Date().getFullYear() - debutYear + 1);
  return `${seasons} ${seasons === 1 ? "season" : "seasons"} MLB experience`;
}

function profilePortrait(src, alt) {
  const image = document.createElement("img");
  image.className = "roster-card-headshot";
  image.src = src;
  image.alt = alt;
  image.loading = "lazy";
  image.decoding = "async";
  image.addEventListener("error", () => {
    image.src = "../assets/new-york-yankees.svg";
    image.classList.add("is-fallback");
  }, { once: true });
  return image;
}

function rosterCard(entry, showStatus = false, statusOverride = "") {
  const link = document.createElement("a");
  link.className = "roster-link";
  link.href = `../player-profile/?player=${entry.person.id}`;
  const playerId = Number(entry.person.id);
  const portraitUrl = `https://img.mlbstatic.com/mlb-photos/image/upload/w_180,q_auto:best/v1/people/${playerId}/headshot/silo/current`;
  const copy = document.createElement("span");
  copy.className = "roster-card-copy";
  const heading = document.createElement("span");
  heading.className = "roster-card-name";
  const name = document.createElement("strong");
  name.textContent = entry.person.fullName;
  heading.append(name);
  if (entry.jerseyNumber) {
    const number = document.createElement("b");
    number.textContent = `#${entry.jerseyNumber}`;
    heading.append(number);
  }
  const position = document.createElement("small");
  position.className = "roster-card-position";
  const positionLabel = entry.position?.name || entry.position?.abbreviation || "Yankees player";
  const status = statusOverride || entry.status?.description || "Injured List";
  position.textContent = showStatus ? `${positionLabel} · ${status}` : positionLabel;
  const measurements = document.createElement("small");
  measurements.textContent = [entry.person?.height, entry.person?.weight ? `${entry.person.weight} lbs` : ""].filter(Boolean).join(" · ") || "Measurements unavailable";
  const career = document.createElement("small");
  career.textContent = [entry.person?.currentAge ? `Age ${entry.person.currentAge}` : "", playerExperience(entry.person)].filter(Boolean).join(" · ");
  copy.append(heading, position, measurements, career);
  link.append(profilePortrait(portraitUrl, `${entry.person.fullName} headshot`), copy);
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

  const personId = Number(item.person?.id);
  const portrait = Number.isInteger(personId)
    ? `https://img.mlbstatic.com/mlb-photos/image/upload/w_120,q_auto:best/v1/people/${personId}/headshot/silo/current`
    : "../assets/new-york-yankees.svg";
  const image = profilePortrait(portrait, item.person?.fullName ? `${item.person.fullName} headshot` : "Yankees logo");
  image.classList.add("transaction-headshot");

  const content = document.createElement("div");
  content.className = "transaction-content";

  const meta = document.createElement("div");
  meta.className = "transaction-meta";

  const badge = document.createElement("span");
  badge.className = "transaction-badge";
  badge.textContent = type.label;

  const detail = document.createElement("small");
  detail.textContent = niceDate(item.effectiveDate || item.date);

  const copy = document.createElement("p");
  copy.textContent = description;

  meta.append(badge, detail);
  content.append(meta, copy);
  article.append(image, content);
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

function coachCard(entry) {
  const article = document.createElement("article");
  article.className = "coach-card";
  const personId = Number(entry.person?.id);
  const portrait = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:83:current.png/ar_1:1,c_pad,b_auto:border/r_max/w_180,q_auto:best/v1/people/${personId}/headshot/83/coach/current`;
  const copy = document.createElement("div");
  copy.className = "coach-card-copy";
  const heading = document.createElement("span");
  heading.className = "roster-card-name";
  const name = document.createElement("strong");
  name.textContent = entry.person?.fullName || "Yankees coach";
  heading.append(name);
  if (entry.jerseyNumber) {
    const number = document.createElement("b");
    number.textContent = `#${entry.jerseyNumber}`;
    heading.append(number);
  }
  const role = document.createElement("small");
  role.className = "roster-card-position";
  role.textContent = entry.title || entry.job || "Coach";
  const experience = document.createElement("small");
  experience.textContent = entry.roleExperience === null
    ? "Experience unavailable"
    : `${entry.roleExperience}${entry.roleExperienceCapped ? "+" : ""} ${entry.roleExperience === 1 ? "season" : "seasons"} in role`;
  copy.append(heading, role, experience);
  article.append(profilePortrait(portrait, `${entry.person?.fullName || "Yankees coach"} headshot`), copy);
  return article;
}

async function addCoachExperience(coaches) {
  const currentSeason = new Date().getFullYear();
  const seasons = Array.from({ length: 15 }, (_, index) => currentSeason - index - 1);
  const historyResults = await Promise.allSettled(seasons.map((season) => api.coaches(season)));
  coaches.forEach((coach) => {
    let experience = 1;
    let unavailable = false;
    for (const result of historyResults) {
      if (result.status !== "fulfilled") {
        unavailable = true;
        break;
      }
      const matchingRole = (result.value.roster || []).some((entry) => Number(entry.person?.id) === Number(coach.person?.id)
        && String(entry.title || entry.job || "").trim().toLowerCase() === String(coach.title || coach.job || "").trim().toLowerCase());
      if (!matchingRole) break;
      experience += 1;
    }
    coach.roleExperience = unavailable ? null : experience;
    coach.roleExperienceCapped = !unavailable && experience === seasons.length + 1;
  });
}

async function renderCoaches() {
  try {
    const data = await api.coaches();
    const coaches = data.roster || [];
    await addCoachExperience(coaches);
    els.coaches.replaceChildren();
    coaches.forEach((entry) => els.coaches.append(coachCard(entry)));
    els.coachesCount.textContent = `${coaches.length} staff members`;
    if (!coaches.length) els.coaches.innerHTML = `<p class="empty">No coaching staff entries were returned.</p>`;
    return true;
  } catch (error) {
    els.coaches.innerHTML = `<p class="error">Coaching staff data is unavailable right now.</p>`;
    els.coachesCount.textContent = "Unavailable";
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
  const results = await Promise.all([renderRoster(), renderTransactions(), renderCoaches()]);
  setStatus(results.every(Boolean) ? "Live MLB data" : "Some MLB data is unavailable", results.every(Boolean) ? "good" : "error");
}

init();
