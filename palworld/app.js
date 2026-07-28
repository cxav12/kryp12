const DATA_URL = new URL(
  "./data/passive-skills.json?v=20260726-player1",
  document.currentScript.src,
);

const statusPanel = document.querySelector("#data-status");
const statusTitle = document.querySelector("#data-status-title");
const statusMessage = document.querySelector("#data-status-message");
const statusMeta = document.querySelector("#data-status-meta");
const skillsGrid = document.querySelector("#passive-skills-grid");
const typeFilters = document.querySelector("#type-filters");
const tierFilters = document.querySelector("#tier-filters");
const searchInput = document.querySelector("#passive-search-input");
const {
  createDataStatusController,
  formatDate,
  updateUrlParams,
} = window.PalworldUI;
const showStatus = createDataStatusController({
  panel: statusPanel,
  titleElement: statusTitle,
  messageElement: statusMessage,
  metaElement: statusMeta,
});

let allPassiveSkills = [];
let activeType = "all";
let activeTier = "all";
const initialParams = new URLSearchParams(window.location.search);
const requestedType = initialParams.get("type");
const requestedTier = initialParams.get("tier");

if (
  [...typeFilters.querySelectorAll("[data-type]")].some(
    (button) => button.dataset.type === requestedType,
  )
) {
  activeType = requestedType;
}
if (
  [...tierFilters.querySelectorAll("[data-tier]")].some(
    (button) => button.dataset.tier === requestedTier,
  )
) {
  activeTier = requestedTier;
}
searchInput.value = initialParams.get("q") || "";

[typeFilters, tierFilters].forEach((group) => {
  const dataName = group === typeFilters ? "type" : "tier";
  const activeValue = dataName === "type" ? activeType : activeTier;
  group.querySelectorAll(".filter-button").forEach((button) => {
    const active = button.dataset[dataName] === activeValue;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
});

const skillTypeMatchers = {
  player: (skill) => skill.affectsPlayer === true,
  combat: (skill, effects) =>
    /attack|defense|damage|health|life steal|active skill cooldown|flinch|knockback|pacifist/i.test(
      effects,
    ),
  work: (skill, effects) =>
    /work speed|san |sanity|hunger|sleep|work suitability|breeding farm|farming/i.test(
      effects,
    ),
  movement: (skill, effects) =>
    /movement speed|stamina|mounted jump|rideable/i.test(effects),
  elemental: (skill, effects) =>
    /(Neutral|Fire|Water|Lightning|Grass|Ice|Earth|Dark|Dragon) (attack )?damage|incoming (Neutral|Fire|Water|Lightning|Grass|Ice|Earth|Dark|Dragon) damage/i.test(
      effects,
    ),
  economy: (skill, effects) =>
    /value of items|dropped items/i.test(effects),
};

function getTierKey(rank) {
  if (rank < 0) {
    return "f";
  }

  const tierByRank = {
    5: "s",
    4: "a",
    3: "b",
    2: "c",
    1: "d",
  };

  return tierByRank[rank] ?? "unranked";
}

function createRankIcon(rank) {
  const icon = document.createElement("span");
  const isNegative = rank < 0;
  const chevronCount = Math.max(0, Math.min(Math.abs(rank) - 1, 4));
  const rankLabel = `Palworld Rank ${rank > 0 ? `+${rank}` : rank}`;

  icon.className = "passive-rank-icon";
  icon.classList.toggle("rank-icon-single", chevronCount === 0);
  icon.dataset.direction = isNegative ? "negative" : "positive";
  icon.setAttribute("role", "img");
  icon.setAttribute("aria-label", rankLabel);
  icon.title = rankLabel;

  for (let index = 0; index < chevronCount; index += 1) {
    const chevron = document.createElement("span");
    chevron.className = "rank-chevron";
    chevron.setAttribute("aria-hidden", "true");
    icon.append(chevron);
  }

  const sign = document.createElement("span");
  sign.className = "rank-sign";
  sign.setAttribute("aria-hidden", "true");
  sign.textContent = isNegative ? "−" : "+";
  icon.append(sign);

  return icon;
}

function createSkillCard(skill) {
  const column = document.createElement("div");
  column.className = "col-12 col-md-6 col-lg-4 col-xxl-3";

  const card = document.createElement("article");
  card.className = "tinted-card passive-skill-card";
  card.dataset.tier = getTierKey(skill.rank);

  const header = document.createElement("header");
  header.className = "passive-skill-header";

  const title = document.createElement("h2");
  title.className = "card-title";
  title.textContent = skill.name;

  const titleRow = document.createElement("div");
  titleRow.className = "passive-skill-title-row";
  titleRow.append(title, createRankIcon(skill.rank));

  header.append(titleRow);

  const effects = document.createElement("ul");
  effects.className = "skill-effects";

  skill.effects.forEach((effect) => {
    const item = document.createElement("li");
    item.textContent = effect;
    effects.append(item);
  });

  card.append(header, effects);
  column.append(card);

  return column;
}

function renderPassiveSkills(skills) {
  if (skills.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-state-message";
    message.textContent = "No passive skills match these filters.";
    skillsGrid.replaceChildren(message);
    skillsGrid.setAttribute("aria-busy", "false");
    return;
  }

  const fragment = document.createDocumentFragment();

  skills.forEach((skill) => {
    fragment.append(createSkillCard(skill));
  });

  skillsGrid.replaceChildren(fragment);
  skillsGrid.setAttribute("aria-busy", "false");
}

function applyFilters() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  const filteredSkills = allPassiveSkills
    .filter((skill) => {
      const effects = skill.effects.join(" ");
      const matchesType =
        activeType === "all" ||
        skillTypeMatchers[activeType]?.(skill, effects) === true;
      const matchesTier =
        activeTier === "all" || getTierKey(skill.rank) === activeTier;
      const searchableText = [skill.name, ...skill.effects]
        .join(" ")
        .toLowerCase();
      const matchesSearch =
        searchTerm.length === 0 || searchableText.includes(searchTerm);

      return matchesType && matchesTier && matchesSearch;
    })
    .sort(
      (firstSkill, secondSkill) =>
        secondSkill.rank - firstSkill.rank ||
        firstSkill.name.localeCompare(secondSkill.name),
    );

  renderPassiveSkills(filteredSkills);
  updateUrlParams({
    type: activeType === "all" ? null : activeType,
    tier: activeTier === "all" ? null : activeTier,
    q: searchTerm || null,
  });
}

typeFilters.addEventListener("click", (event) => {
  const button = event.target.closest(".filter-button");

  if (!button) {
    return;
  }

  activeType = button.dataset.type;

  typeFilters.querySelectorAll(".filter-button").forEach((filterButton) => {
    const isActive = filterButton === button;
    filterButton.classList.toggle("active", isActive);
    filterButton.setAttribute("aria-pressed", String(isActive));
  });

  applyFilters();
});

tierFilters.addEventListener("click", (event) => {
  const button = event.target.closest(".filter-button");

  if (!button) {
    return;
  }

  activeTier = button.dataset.tier;

  tierFilters.querySelectorAll(".filter-button").forEach((filterButton) => {
    const isActive = filterButton === button;
    filterButton.classList.toggle("active", isActive);
    filterButton.setAttribute("aria-pressed", String(isActive));
  });

  applyFilters();
});

searchInput.addEventListener("input", applyFilters);

async function loadPassiveSkills() {
  try {
    const response = await fetch(DATA_URL);

    if (!response.ok) {
      throw new Error(`Data request failed with status ${response.status}`);
    }

    const data = await response.json();
    const metadata = data.metadata;
    const updateRequired = metadata.updateStatus === "update-required";

    showStatus({
      state: updateRequired ? "update" : "current",
      title: updateRequired
        ? "Palworld data update needed"
        : "Palworld data is current",
      message: updateRequired
        ? metadata.updateMessage
        : `This dataset is verified for Palworld ${metadata.gameVersion}.`,
      meta: `Last checked ${formatDate(metadata.lastChecked)}`,
    });

    allPassiveSkills = data.passiveSkills;
    applyFilters();
  } catch (error) {
    console.error("Unable to load Palworld passive skills.", error);
    showStatus({
      state: "error",
      title: "Data status unavailable",
      message:
        "The local Palworld dataset could not be loaded. Check the data file before publishing.",
    });

    const message = document.createElement("p");
    message.className = "empty-state-message";
    message.textContent = "Passive skills could not be loaded.";
    skillsGrid.replaceChildren(message);
    skillsGrid.setAttribute("aria-busy", "false");
  }
}

loadPassiveSkills();
