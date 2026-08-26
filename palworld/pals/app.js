const DATA_URL = "../data/pal-cards.json?v=20260725-clean1";
const FULL_DATA_URL = "../data/pals.json?v=20260727-bp1";
const {
  applySpriteStyle,
  createDataStatusController,
  formatDate,
  formatGameText,
  formatPalNumber,
  getElementDisplayName,
  getRarityDetails,
  hasPalPreference,
  setPalPreference,
  updateUrlParams,
} = window.PalworldUI;

const statusPanel = document.querySelector("#data-status");
const statusTitle = document.querySelector("#data-status-title");
const statusMessage = document.querySelector("#data-status-message");
const statusMeta = document.querySelector("#data-status-meta");
const palsGrid = document.querySelector("#pals-grid");
const palsViewFilters = document.querySelector("#pals-view-filters");
const workFilters = document.querySelector("#work-filters");
const rarityFilters = document.querySelector("#rarity-filters");
const elementFilterPanel = document.querySelector("#element-filter-panel");
const elementFilters = document.querySelector("#element-filters");
const secondElementToggle = document.querySelector("#second-element-toggle");
const secondElementPanel = document.querySelector("#second-element-panel");
const secondElementFilters = document.querySelector("#second-element-filters");
const palSearchInput = document.querySelector("#pal-search-input");
const palDetailDialog = document.querySelector("#pal-detail-dialog");
const palDetailContent = document.querySelector("#pal-detail-content");
const palDetailClose = document.querySelector("#pal-detail-close");
const showStatus = createDataStatusController({
  panel: statusPanel,
  titleElement: statusTitle,
  messageElement: statusMessage,
  metaElement: statusMeta,
});

let allPals = [];
let fullPalByName = new Map();
let fullPalDataPromise = null;
let selectedWork = null;
let selectedRarity = null;
let selectedCollection = null;
let activeView = "all";
let defaultWork = null;
let selectedElements = [];
let defaultElement = null;
let palSprite = null;
let palIconSprite = null;
const palCardCache = new Map();

function updatePreferenceMarker(card, palName) {
  const favorite = hasPalPreference(palName, "favorites");
  card.dataset.favorite = String(favorite);

  const marker = card.querySelector(".pal-preference-marker");
  if (!marker) {
    return;
  }

  marker.textContent = favorite ? "★" : "";
  marker.hidden = !favorite;
  marker.title = favorite ? "Favorite" : "";
}

function resolveAssetUrl(url) {
  if (!url || !url.startsWith("./")) {
    return url;
  }

  return `../${url.slice(2)}`;
}

function getWorkSuitability(pal, workName) {
  return pal.workSuitability.find((work) => work.name === workName);
}

function createSpriteIcon(icon, label = "") {
  const coordinates = palIconSprite?.icons?.[icon];

  if (!coordinates) {
    const image = document.createElement("img");
    image.src = resolveAssetUrl(icon);
    image.alt = label;
    return image;
  }

  const spriteIcon = document.createElement("span");
  spriteIcon.className = "pal-sprite-icon";
  applySpriteStyle(
    spriteIcon,
    palIconSprite,
    coordinates,
    resolveAssetUrl(palIconSprite.image),
  );

  if (label) {
    spriteIcon.setAttribute("role", "img");
    spriteIcon.setAttribute("aria-label", label);
  } else {
    spriteIcon.setAttribute("aria-hidden", "true");
  }

  return spriteIcon;
}

function createCornerIcons(items, className, showLevel = false) {
  const list = document.createElement("div");
  list.className = className;

  items.forEach((item) => {
    const badge = document.createElement("span");
    const displayName = getElementDisplayName(item.name);
    badge.className = "pal-corner-icon";
    badge.title = item.level
      ? `${displayName} Lv. ${item.level}`
      : displayName;

    if (item.icon) {
      badge.append(createSpriteIcon(item.icon, displayName));
    }

    if (showLevel && item.level) {
      const level = document.createElement("strong");
      level.textContent = item.level;
      badge.append(level);
    }

    list.append(badge);
  });

  return list;
}

function getDisplayedSuitability(pal) {
  return [...pal.workSuitability].sort(
    (first, second) =>
      second.level - first.level || first.name.localeCompare(second.name),
  ).slice(0, 4);
}

function updatePalCardWork(cardEntry, pal) {
  const workSuitability = getDisplayedSuitability(pal);
  const replacement = workSuitability.length
    ? createCornerIcons(workSuitability, "pal-corner-work", true)
    : document.createElement("div");

  replacement.classList.add("pal-corner-work");
  cardEntry.work.replaceWith(replacement);
  cardEntry.work = replacement;
}

function createPalCard(pal, workName = null) {
  const column = document.createElement("div");
  column.className = "col-6 col-sm-4 col-md-3 col-xl-2";

  const card = document.createElement("article");
  card.className = "tinted-card pal-card";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `View details for ${pal.name}`);
  const rarity = getRarityDetails(pal.rarity);
  card.dataset.rarity = rarity.key;

  const preferenceMarker = document.createElement("span");
  preferenceMarker.className = "pal-preference-marker";
  preferenceMarker.hidden = true;

  const topRow = document.createElement("div");
  topRow.className = "pal-card-top";

  const elements = createCornerIcons(pal.elements, "pal-corner-elements");
  const workSuitability = getDisplayedSuitability(pal);
  const work = workSuitability.length
    ? createCornerIcons(workSuitability, "pal-corner-work", true)
    : document.createElement("div");
  work.classList.add("pal-corner-work");
  topRow.append(elements, work);

  const media = document.createElement("div");
  media.className = "pal-card-media";

  if (palSprite && pal.sprite) {
    const portrait = document.createElement("div");

    portrait.className = "pal-portrait-sprite";
    portrait.setAttribute("role", "img");
    portrait.setAttribute("aria-label", pal.name);
    applySpriteStyle(
      portrait,
      palSprite,
      pal.sprite,
      resolveAssetUrl(palSprite.image),
    );
    media.append(portrait);
  } else {
    const image = document.createElement("img");
    image.src = resolveAssetUrl(pal.image);
    image.alt = pal.name;
    image.loading = "eager";
    image.decoding = "async";
    media.append(image);
  }

  const identity = document.createElement("div");
  identity.className = "pal-card-name-row";
  const title = document.createElement("h2");
  title.className = "card-title";
  title.textContent = pal.name;

  identity.append(title);

  const hasPalNumber =
    pal.dexKey !== undefined &&
    pal.dexKey !== null &&
    String(pal.dexKey).trim() !== "" &&
    String(pal.dexKey).toLowerCase() !== "undefined";

  if (hasPalNumber) {
    const number = document.createElement("span");
    number.className = "pal-card-number";
    number.textContent = `#${pal.dexKey}`;
    identity.append(number);
  }

  const rarityBadge = document.createElement("div");
  rarityBadge.className = "pal-rarity";

  const rarityNumber = document.createElement("strong");
  rarityNumber.textContent = pal.rarity;

  const rarityLabel = document.createElement("span");
  rarityLabel.textContent = rarity.label;
  rarityBadge.append(rarityNumber, rarityLabel);

  card.append(preferenceMarker, topRow, media, identity, rarityBadge);
  card.addEventListener("click", () => openPalDetails(pal));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openPalDetails(pal);
    }
  });
  updatePreferenceMarker(card, pal.name);
  column.append(card);

  return { column, work };
}

function getPalCard(pal, workName = null) {
  let cardEntry = palCardCache.get(pal);

  if (!cardEntry) {
    cardEntry = createPalCard(pal, workName);
    palCardCache.set(pal, cardEntry);
  } else {
    updatePalCardWork(cardEntry, pal);
  }

  return cardEntry.column;
}

function renderPals(pals, workName = null) {
  if (pals.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-state-message";
    message.textContent = "No Pals match this search and filter.";
    palsGrid.replaceChildren(message);
    palsGrid.setAttribute("aria-busy", "false");
    return;
  }

  const fragment = document.createDocumentFragment();

  pals.forEach((pal) => {
    fragment.append(getPalCard(pal, workName));
  });

  palsGrid.replaceChildren(fragment);
  palsGrid.setAttribute("aria-busy", "false");
}

function createDetailList(items, renderItem) {
  const list = document.createElement("div");
  list.className = "pal-detail-list";
  items.forEach((item) => list.append(renderItem(item)));
  return list;
}

function createDetailSection(title, content) {
  const section = document.createElement("section");
  section.className = "pal-detail-section";
  const heading = document.createElement("h3");
  heading.textContent = title;
  section.append(heading, content);
  return section;
}

function createPreferenceButton(palName, preference, label, activeLabel) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "filter-button pal-preference-button";

  const update = () => {
    const active = hasPalPreference(palName, preference);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.textContent = active ? activeLabel : label;
  };

  button.addEventListener("click", () => {
    const active = hasPalPreference(palName, preference);
    setPalPreference(palName, preference, !active);
    update();
    const cardEntry = [...palCardCache.entries()].find(
      ([pal]) => pal.name === palName,
    )?.[1];
    if (cardEntry) {
      updatePreferenceMarker(
        cardEntry.column.querySelector(".pal-card"),
        palName,
      );
    }
    applyFilters();
  });
  update();
  return button;
}

async function loadFullPalData() {
  if (!fullPalDataPromise) {
    fullPalDataPromise = fetch(FULL_DATA_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Full Pal data could not be loaded.");
        }
        return response.json();
      })
      .then((data) => {
        fullPalByName = new Map(
          data.pals.map((pal) => [pal.name, pal]),
        );
      });
  }
  return fullPalDataPromise;
}

async function openPalDetails(palSummary) {
  updateUrlParams({ detail: palSummary.name });
  if (!fullPalByName.size) {
    const loading = document.createElement("p");
    loading.className = "empty-state-message";
    loading.textContent = `Loading details for ${palSummary.name}...`;
    palDetailContent.replaceChildren(loading);
    if (!palDetailDialog.open) {
      palDetailDialog.showModal();
    }

    try {
      await loadFullPalData();
    } catch {
      loading.textContent = "Pal details could not be loaded.";
      return;
    }
  }

  const pal = fullPalByName.get(palSummary.name) || palSummary;
  const rarity = getRarityDetails(pal.rarity);
  const header = document.createElement("header");
  header.className = "pal-detail-header";

  const portrait = document.createElement("div");
  portrait.className = "pal-detail-portrait";
  if (palSprite && palSummary.sprite) {
    const sprite = document.createElement("span");
    sprite.className = "pal-detail-sprite";
    applySpriteStyle(
      sprite,
      palSprite,
      palSummary.sprite,
      resolveAssetUrl(palSprite.image),
    );
    sprite.setAttribute("role", "img");
    sprite.setAttribute("aria-label", pal.name);
    portrait.append(sprite);
  }

  const identity = document.createElement("div");
  const eyebrow = document.createElement("span");
  eyebrow.className = "pal-detail-eyebrow";
  eyebrow.textContent =
    `#${formatPalNumber(pal.dexKey)} · ${rarity.label}`;
  const title = document.createElement("h2");
  title.textContent = pal.name;
  const elements = document.createElement("p");
  elements.textContent = pal.elements
    .map((element) => getElementDisplayName(element.name))
    .join(" · ");
  identity.append(eyebrow, title, elements);
  header.append(portrait, identity);

  const actions = document.createElement("div");
  actions.className = "pal-detail-actions";
  actions.append(
    createPreferenceButton(
      pal.name,
      "favorites",
      "☆ Add Favorite",
      "★ Favorite",
    ),
  );
  const breedingLink = document.createElement("a");
  breedingLink.className = "filter-button active";
  breedingLink.href = `../breeding/?target=${encodeURIComponent(pal.name)}`;
  breedingLink.textContent = "Find breeding pairs";
  actions.append(breedingLink);

  const body = document.createElement("div");
  body.className = "pal-detail-grid";

  if (pal.partnerSkill?.name) {
    const partner = document.createElement("div");
    const partnerName = document.createElement("strong");
    partnerName.textContent = pal.partnerSkill.name;
    const partnerDescription = document.createElement("p");
    partnerDescription.textContent =
      formatGameText(pal.partnerSkill.description) ||
      "No description available.";
    partner.append(partnerName, partnerDescription);
    body.append(createDetailSection("Partner Skill", partner));
  }

  if (pal.workSuitability?.length) {
    body.append(
      createDetailSection(
        "Work Suitability",
        createDetailList(pal.workSuitability, (work) => {
          const item = document.createElement("span");
          item.className = "pal-detail-chip";
          item.textContent = `${work.name} Lv. ${work.level}`;
          return item;
        }),
      ),
    );
  }

  if (pal.drops?.length) {
    body.append(
      createDetailSection(
        "Item Drops",
        createDetailList(pal.drops, (drop) => {
          const item = document.createElement("span");
          item.className = "pal-detail-chip";
          item.textContent =
            `${drop.name} · ${drop.dropRate}% · ${drop.min}-${drop.max}`;
          return item;
        }),
      ),
    );
  }

  if (Number.isInteger(pal.breedingPower)) {
    const breeding = document.createElement("div");
    const power = document.createElement("span");
    power.className = "pal-detail-stat";
    const powerLabel = document.createElement("small");
    powerLabel.textContent = "Breeding Power";
    const powerValue = document.createElement("strong");
    powerValue.textContent = pal.breedingPower.toLocaleString();
    power.append(powerLabel, powerValue);

    const explanation = document.createElement("p");
    explanation.className = "pal-breeding-power-note";
    explanation.textContent =
      "Used with the other parent's value to determine standard offspring.";
    breeding.append(power, explanation);
    body.append(createDetailSection("Breeding", breeding));
  }

  if (pal.stats) {
    body.append(
      createDetailSection(
        "Base Stats",
        createDetailList(
          [
            ["HP", pal.stats.hp],
            ["Attack", pal.stats.rangedattack],
            ["Defense", pal.stats.defense],
            ["Stamina", pal.stats.stamina],
            ["Work Speed", pal.stats.craftspeed],
          ],
          ([label, value]) => {
            const item = document.createElement("span");
            item.className = "pal-detail-stat";
            const statLabel = document.createElement("small");
            statLabel.textContent = label;
            const statValue = document.createElement("strong");
            statValue.textContent = value;
            item.append(statLabel, statValue);
            return item;
          },
        ),
      ),
    );
  }

  palDetailDialog.dataset.rarity = rarity.key;
  palDetailContent.replaceChildren(header, actions, body);
  if (!palDetailDialog.open) {
    palDetailDialog.showModal();
  }
}

function createWorkFilter(name, icon = null) {
  const button = document.createElement("button");
  button.className = "filter-button work-filter";
  button.type = "button";
  button.dataset.work = name;
  button.setAttribute("aria-pressed", "false");

  if (icon) {
    button.append(createSpriteIcon(icon));
  }

  const label = document.createElement("span");
  label.textContent = name;
  button.append(label);

  return button;
}

function renderWorkFilters(pals) {
  const workTypes = new Map();

  pals.forEach((pal) => {
    pal.workSuitability.forEach((work) => {
      if (!workTypes.has(work.name)) {
        workTypes.set(work.name, work.icon);
      }
    });
  });

  const fragment = document.createDocumentFragment();
  const sortedWorkTypes = [...workTypes.entries()].sort(([nameA], [nameB]) =>
    nameA.localeCompare(nameB),
  );

  sortedWorkTypes.forEach(([name, icon]) => {
    fragment.append(createWorkFilter(name, icon));
  });

  workFilters.replaceChildren(fragment);
  defaultWork = sortedWorkTypes[0]?.[0] ?? null;
}

function createElementFilter(name, icon, filterPosition) {
  const button = document.createElement("button");
  button.className = "filter-button element-filter";
  button.type = "button";
  button.dataset.element = name;
  button.dataset.position = filterPosition;
  button.setAttribute("aria-pressed", "false");

  if (icon) {
    button.append(createSpriteIcon(icon));
  }

  const label = document.createElement("span");
  label.textContent = getElementDisplayName(name);
  button.append(label);

  return button;
}

function renderElementFilters(pals) {
  const elements = new Map();

  pals.forEach((pal) => {
    pal.elements.forEach((element) => {
      if (!elements.has(element.name)) {
        elements.set(element.name, element.icon);
      }
    });
  });

  const sortedElements = [...elements.entries()].sort(([nameA], [nameB]) =>
    nameA.localeCompare(nameB),
  );
  const primaryFragment = document.createDocumentFragment();
  const secondaryFragment = document.createDocumentFragment();

  sortedElements.forEach(([name, icon]) => {
    primaryFragment.append(createElementFilter(name, icon, "primary"));
    secondaryFragment.append(createElementFilter(name, icon, "secondary"));
  });

  elementFilters.replaceChildren(primaryFragment);
  secondElementFilters.replaceChildren(secondaryFragment);
  defaultElement = sortedElements[0]?.[0] ?? null;
}

function updateElementControls() {
  const primaryElement = selectedElements[0];
  let secondaryElement = selectedElements[1];
  const validSecondaryElements = new Set();

  if (primaryElement) {
    allPals.forEach((pal) => {
      const palElements = pal.elements.map((element) => element.name);

      if (palElements.includes(primaryElement)) {
        palElements
          .filter((elementName) => elementName !== primaryElement)
          .forEach((elementName) => validSecondaryElements.add(elementName));
      }
    });
  }

  if (
    secondaryElement &&
    !validSecondaryElements.has(secondaryElement)
  ) {
    selectedElements.splice(1, 1);
    secondaryElement = null;
  }

  elementFilters.querySelectorAll(".element-filter").forEach((button) => {
    const isActive = button.dataset.element === primaryElement;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  secondElementFilters.querySelectorAll(".element-filter").forEach((button) => {
    const isPrimary = button.dataset.element === primaryElement;
    const hasMatchingPals = validSecondaryElements.has(
      button.dataset.element,
    );
    const isActive = button.dataset.element === secondaryElement;
    button.disabled = isPrimary || !hasMatchingPals;
    const primaryDisplayName = getElementDisplayName(primaryElement);
    const secondaryDisplayName = getElementDisplayName(
      button.dataset.element,
    );
    button.title = button.disabled
      ? `No Pals have both ${primaryDisplayName} and ${secondaryDisplayName}.`
      : `Show Pals with ${primaryDisplayName} and ${secondaryDisplayName}.`;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  const secondPanelIsOpen = !secondElementPanel.hidden;
  secondElementToggle.textContent = secondPanelIsOpen
    ? "Remove 2nd Element"
    : "Add a 2nd Element";
  secondElementToggle.classList.toggle("active", secondPanelIsOpen);
  secondElementToggle.setAttribute(
    "aria-expanded",
    String(secondPanelIsOpen),
  );
}

function applyFilters() {
  const searchTerm = palSearchInput.value.trim().toLowerCase();
  const searchedPals = allPals.filter((pal) => {
    const searchableText = [
      pal.name,
      pal.dexKey,
      ...pal.elements.map((element) => element.name),
      ...pal.elements.map((element) =>
        getElementDisplayName(element.name),
      ),
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch =
      searchTerm.length === 0 || searchableText.includes(searchTerm);
    const palElements = pal.elements.map((element) => element.name);
    const matchesElement = selectedElements.every((elementName) =>
      palElements.includes(elementName),
    );
    const matchesRarity =
      !selectedRarity ||
      getRarityDetails(pal.rarity).key === selectedRarity;
    const matchesCollection =
      !selectedCollection ||
      hasPalPreference(pal.name, selectedCollection);

    return (
      matchesSearch &&
      matchesElement &&
      matchesRarity &&
      matchesCollection
    );
  });

  if (!selectedWork) {
    renderPals(searchedPals);
    syncPalsUrl();
    return;
  }

  const rankedPals = searchedPals
    .filter((pal) => getWorkSuitability(pal, selectedWork))
    .sort((palA, palB) => {
      const levelDifference =
        getWorkSuitability(palB, selectedWork).level -
        getWorkSuitability(palA, selectedWork).level;

      if (levelDifference !== 0) {
        return levelDifference;
      }

      const workSpeedDifference = palB.craftSpeed - palA.craftSpeed;

      if (workSpeedDifference !== 0) {
        return workSpeedDifference;
      }

      return palA.name.localeCompare(palB.name);
    });

  renderPals(rankedPals, selectedWork);
  syncPalsUrl();
}

function syncPalsUrl() {
  updateUrlParams({
    view: activeView === "all" ? null : activeView,
    q: palSearchInput.value.trim() || null,
    work: activeView === "workers" ? selectedWork : null,
    rarity: activeView === "rarity" ? selectedRarity : null,
    element:
      activeView === "elements" ? selectedElements[0] : null,
    element2:
      activeView === "elements" ? selectedElements[1] : null,
  });
}

function restorePalsFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view") || "all";
  const viewButton =
    [...palsViewFilters.querySelectorAll("[data-view]")].find(
      (button) => button.dataset.view === requestedView,
    ) || palsViewFilters.querySelector('[data-view="all"]');

  palSearchInput.value = params.get("q") || "";
  if (
    requestedView === "workers" &&
    workFilters.querySelector(
      `[data-work="${CSS.escape(params.get("work") || "")}"]`,
    )
  ) {
    selectedWork = params.get("work");
  }
  if (
    requestedView === "rarity" &&
    [...rarityFilters.querySelectorAll("[data-rarity]")].some(
      (button) => button.dataset.rarity === params.get("rarity"),
    )
  ) {
    selectedRarity = params.get("rarity");
  }
  if (requestedView === "elements" && params.get("element")) {
    const availableElements = new Set(
      [...elementFilters.querySelectorAll("[data-element]")].map(
        (button) => button.dataset.element,
      ),
    );
    selectedElements = [params.get("element"), params.get("element2")]
      .filter((element) => availableElements.has(element));
    secondElementPanel.hidden = selectedElements.length < 2;
  }
  viewButton.click();
}

palsViewFilters.addEventListener("click", (event) => {
  const button = event.target.closest("[data-view]");

  if (!button) {
    return;
  }

  const showWorkers = button.dataset.view === "workers";
  const showElements = button.dataset.view === "elements";
  const showAll = button.dataset.view === "all";
  const showRarity = button.dataset.view === "rarity";
  const showCollection = button.dataset.view === "favorites";
  activeView = button.dataset.view;

  palsViewFilters.querySelectorAll("[data-view]").forEach((viewButton) => {
    const isActive = viewButton === button;
    viewButton.classList.toggle("active", isActive);
    viewButton.setAttribute("aria-pressed", String(isActive));
  });

  workFilters.hidden = !showWorkers;
  elementFilterPanel.hidden = !showElements;
  rarityFilters.hidden = !showRarity;

  if (showAll) {
    selectedWork = null;
    selectedRarity = null;
    selectedCollection = null;
    selectedElements = [];
    secondElementPanel.hidden = true;
    updateElementControls();
    applyFilters();
    return;
  }

  if (showWorkers) {
    selectedCollection = null;
    selectedRarity = null;
    selectedElements = [];
    secondElementPanel.hidden = true;
    updateElementControls();
    selectedWork ??= defaultWork;

    workFilters.querySelectorAll(".work-filter").forEach((filterButton) => {
      const isActive = filterButton.dataset.work === selectedWork;
      filterButton.classList.toggle("active", isActive);
      filterButton.setAttribute("aria-pressed", String(isActive));
    });
  }

  if (showElements) {
    selectedWork = null;
    selectedRarity = null;
    selectedCollection = null;
    if (selectedElements.length === 0 && defaultElement) {
      selectedElements = [defaultElement];
    }

    updateElementControls();
  }

  if (showRarity) {
    selectedWork = null;
    selectedCollection = null;
    selectedElements = [];
    secondElementPanel.hidden = true;
    updateElementControls();
    selectedRarity ??= "legendary";

    rarityFilters.querySelectorAll(".rarity-filter").forEach((filterButton) => {
      const isActive = filterButton.dataset.rarity === selectedRarity;
      filterButton.classList.toggle("active", isActive);
      filterButton.setAttribute("aria-pressed", String(isActive));
    });
  }

  if (showCollection) {
    selectedWork = null;
    selectedRarity = null;
    selectedElements = [];
    selectedCollection = button.dataset.view;
    secondElementPanel.hidden = true;
    updateElementControls();
  }

  applyFilters();
});

workFilters.addEventListener("click", (event) => {
  const button = event.target.closest(".work-filter");

  if (!button) {
    return;
  }

  selectedWork = button.dataset.work;

  workFilters.querySelectorAll(".work-filter").forEach((filterButton) => {
    const isActive = filterButton === button;
    filterButton.classList.toggle("active", isActive);
    filterButton.setAttribute("aria-pressed", String(isActive));
  });

  applyFilters();
});

rarityFilters.addEventListener("click", (event) => {
  const button = event.target.closest(".rarity-filter");

  if (!button) {
    return;
  }

  selectedRarity =
    button.dataset.rarity === "all" ? null : button.dataset.rarity;
  rarityFilters.querySelectorAll(".rarity-filter").forEach((filterButton) => {
    const isActive = filterButton === button;
    filterButton.classList.toggle("active", isActive);
    filterButton.setAttribute("aria-pressed", String(isActive));
  });
  applyFilters();
});

elementFilters.addEventListener("click", (event) => {
  const button = event.target.closest(".element-filter");

  if (!button) {
    return;
  }

  const primaryElement = button.dataset.element;
  selectedElements[0] = primaryElement;

  if (selectedElements[1] === primaryElement) {
    selectedElements.splice(1, 1);
  }

  updateElementControls();
  applyFilters();
});

secondElementToggle.addEventListener("click", () => {
  const openingPanel = secondElementPanel.hidden;
  secondElementPanel.hidden = !openingPanel;

  if (!openingPanel) {
    selectedElements.splice(1, 1);
    applyFilters();
  }

  updateElementControls();
});

secondElementFilters.addEventListener("click", (event) => {
  const button = event.target.closest(".element-filter");

  if (!button || button.disabled) {
    return;
  }

  selectedElements[1] = button.dataset.element;
  updateElementControls();
  applyFilters();
});

palSearchInput.addEventListener("input", applyFilters);
palDetailClose.addEventListener("click", () => palDetailDialog.close());
palDetailDialog.addEventListener("close", () => {
  updateUrlParams({ detail: null });
});
palDetailDialog.addEventListener("click", (event) => {
  if (event.target === palDetailDialog) {
    palDetailDialog.close();
  }
});
window.addEventListener("palworld:preferences-changed", () => {
  palCardCache.forEach((entry, pal) => {
    updatePreferenceMarker(
      entry.column.querySelector(".pal-card"),
      pal.name,
    );
  });
});

async function loadPals() {
  try {
    const response = await fetch(DATA_URL);

    if (!response.ok) {
      throw new Error(`Data request failed with status ${response.status}`);
    }

    const data = await response.json();
    const metadata = data.metadata;

    showStatus({
      state: "current",
      title: "Paldeck data is ready",
      message: `${metadata.palCount} Pals and ${metadata.assetCount} local assets are available.`,
      meta: `Imported ${formatDate(metadata.importedAt)}`,
    });

    allPals = data.pals;
    palSprite = metadata.palSprite || null;
    palIconSprite = metadata.palIconSprite || null;
    renderWorkFilters(allPals);
    renderElementFilters(allPals);
    restorePalsFromUrl();
    const detailName = new URLSearchParams(window.location.search).get(
      "detail",
    );
    const detailPal = allPals.find((pal) => pal.name === detailName);
    if (detailPal) {
      openPalDetails(detailPal);
    }
  } catch (error) {
    console.error("Unable to load Palworld Pals.", error);
    showStatus({
      state: "error",
      title: "Pal data unavailable",
      message:
        "The local Paldeck dataset could not be loaded. Check the data file before publishing.",
    });

    const message = document.createElement("p");
    message.className = "empty-state-message";
    message.textContent = "Pals could not be loaded.";
    palsGrid.replaceChildren(message);
    palsGrid.setAttribute("aria-busy", "false");
  }
}

loadPals();
