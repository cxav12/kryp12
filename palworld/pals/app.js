const DATA_URL = "../data/pal-cards.json?v=20260725-clean1";
const {
  applySpriteStyle,
  createDataStatusController,
  formatDate,
  getElementDisplayName,
  getRarityDetails,
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
const showStatus = createDataStatusController({
  panel: statusPanel,
  titleElement: statusTitle,
  messageElement: statusMessage,
  metaElement: statusMeta,
});

let allPals = [];
let selectedWork = null;
let selectedRarity = null;
let defaultWork = null;
let selectedElements = [];
let defaultElement = null;
let palSprite = null;
let palIconSprite = null;
const palCardCache = new Map();

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

function getDisplayedSuitability(pal, workName = null) {
  if (workName) {
    return getWorkSuitability(pal, workName);
  }

  return pal.workSuitability.reduce(
    (best, work) => (!best || work.level > best.level ? work : best),
    null,
  );
}

function updatePalCardWork(cardEntry, pal, workName = null) {
  const selectedSuitability = getDisplayedSuitability(pal, workName);
  const replacement = selectedSuitability
    ? createCornerIcons([selectedSuitability], "pal-corner-work", true)
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
  const rarity = getRarityDetails(pal.rarity);
  card.dataset.rarity = rarity.key;

  const topRow = document.createElement("div");
  topRow.className = "pal-card-top";

  const elements = createCornerIcons(pal.elements, "pal-corner-elements");
  const selectedSuitability = getDisplayedSuitability(pal, workName);
  const work = selectedSuitability
    ? createCornerIcons([selectedSuitability], "pal-corner-work", true)
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

  card.append(topRow, media, identity, rarityBadge);
  column.append(card);

  return { column, work };
}

function getPalCard(pal, workName = null) {
  let cardEntry = palCardCache.get(pal);

  if (!cardEntry) {
    cardEntry = createPalCard(pal, workName);
    palCardCache.set(pal, cardEntry);
  } else {
    updatePalCardWork(cardEntry, pal, workName);
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

    return matchesSearch && matchesElement && matchesRarity;
  });

  if (!selectedWork) {
    renderPals(searchedPals);
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
    selectedElements = [];
    secondElementPanel.hidden = true;
    updateElementControls();
    applyFilters();
    return;
  }

  if (showWorkers) {
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
    if (selectedElements.length === 0 && defaultElement) {
      selectedElements = [defaultElement];
    }

    updateElementControls();
  }

  if (showRarity) {
    selectedWork = null;
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
    applyFilters();
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
