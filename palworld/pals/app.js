const DATA_URL = "../data/pals.json";

const statusPanel = document.querySelector("#data-status");
const statusTitle = document.querySelector("#data-status-title");
const statusMessage = document.querySelector("#data-status-message");
const statusMeta = document.querySelector("#data-status-meta");
const palsGrid = document.querySelector("#pals-grid");
const palsViewFilters = document.querySelector("#pals-view-filters");
const workFilters = document.querySelector("#work-filters");
const elementFilterPanel = document.querySelector("#element-filter-panel");
const elementFilters = document.querySelector("#element-filters");
const secondElementToggle = document.querySelector("#second-element-toggle");
const secondElementPanel = document.querySelector("#second-element-panel");
const secondElementFilters = document.querySelector("#second-element-filters");
const palSearchInput = document.querySelector("#pal-search-input");

let allPals = [];
let selectedWork = null;
let defaultWork = null;
let selectedElements = [];
let defaultElement = null;
const palImageCache = new Map();

function formatDate(dateString) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateString));
}

function showStatus({ state, title, message, meta = "" }) {
  statusPanel.dataset.state = state;
  statusTitle.textContent = title;
  statusMessage.textContent = message;
  statusMeta.textContent = meta;
  statusPanel.hidden = false;
}

function resolveAssetUrl(url) {
  if (!url || !url.startsWith("./")) {
    return url;
  }

  return `../${url.slice(2)}`;
}

function preloadPalImage(url) {
  return new Promise((resolve) => {
    const image = new Image();

    image.onload = async () => {
      try {
        await image.decode();
      } catch {
        // A successfully loaded image can still be used if decoding is deferred.
      }

      palImageCache.set(url, image);
      resolve();
    };

    image.onerror = () => resolve();
    image.src = url;
  });
}

async function preloadPalImages(pals) {
  const imageUrls = [
    ...new Set(pals.map((pal) => resolveAssetUrl(pal.image)).filter(Boolean)),
  ];

  await Promise.all(imageUrls.map(preloadPalImage));
}

function createIconList(items, className, highlightedName = null) {
  const list = document.createElement("div");
  list.className = className;

  items.forEach((item) => {
    const badge = document.createElement("span");
    badge.className = "pal-icon-badge";
    badge.classList.toggle("selected-work", item.name === highlightedName);
    badge.title = item.level ? `${item.name} Lv. ${item.level}` : item.name;

    if (item.icon) {
      const image = document.createElement("img");
      image.src = resolveAssetUrl(item.icon);
      image.alt = item.name;
      image.loading = "lazy";
      badge.append(image);
    }

    const text = document.createElement("span");
    text.textContent = item.level ? `${item.name} ${item.level}` : item.name;
    badge.append(text);
    list.append(badge);
  });

  return list;
}

function createStat(label, value) {
  const item = document.createElement("span");
  item.className = "pal-stat";
  item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;

  return item;
}

function getWorkSuitability(pal, workName) {
  return pal.workSuitability.find((work) => work.name === workName);
}

function createPalCard(pal, workName = null) {
  const column = document.createElement("div");
  column.className = "col-12 col-md-6 col-lg-4 col-xxl-3";

  const card = document.createElement("article");
  card.className = "pal-card";

  const identity = document.createElement("div");
  identity.className = "pal-card-identity";

  const portraitColumn = document.createElement("div");
  portraitColumn.className = "pal-portrait-column";

  const media = document.createElement("div");
  media.className = "pal-card-media";

  const imageUrl = resolveAssetUrl(pal.image);
  const cachedImage = palImageCache.get(imageUrl);
  const image = cachedImage
    ? cachedImage.cloneNode(false)
    : document.createElement("img");
  image.src = imageUrl;
  image.alt = pal.name;
  image.loading = cachedImage ? "eager" : "lazy";
  image.decoding = "async";
  media.append(image);

  const number = document.createElement("p");
  number.className = "pal-card-number";
  number.textContent = `#${pal.dexKey}`;
  portraitColumn.append(media, number);

  const identityDetails = document.createElement("div");
  identityDetails.className = "pal-identity-details";

  const header = document.createElement("header");
  header.className = "pal-card-header";

  const title = document.createElement("h2");
  title.className = "passive-skill-title";
  title.textContent = pal.name;

  header.append(title);

  if (workName) {
    const selectedSuitability = getWorkSuitability(pal, workName);
    const workLevel = document.createElement("span");
    workLevel.className = "selected-work-level";
    workLevel.textContent = `${workName} Lv. ${selectedSuitability.level}`;
    header.append(workLevel);
  }

  const elements = createIconList(pal.elements, "pal-elements");
  identityDetails.append(header, elements);
  identity.append(portraitColumn, identityDetails);

  const body = document.createElement("div");
  body.className = "pal-card-body";

  const stats = document.createElement("div");
  stats.className = "pal-stats";
  stats.append(
    createStat("HP", pal.stats.hp),
    createStat("ATK", pal.stats.rangedattack),
    createStat("DEF", pal.stats.defense),
  );

  const workItems = [...pal.workSuitability]
    .sort((a, b) => {
      if (a.name === workName) return -1;
      if (b.name === workName) return 1;
      return 0;
    })
    .slice(0, 4);
  const workSuitability = createIconList(workItems, "pal-work", workName);

  body.append(identity, stats, workSuitability);
  card.append(body);
  column.append(card);

  return column;
}

function renderPals(pals, workName = null) {
  if (pals.length === 0) {
    const message = document.createElement("p");
    message.className = "no-skills-message";
    message.textContent = "No Pals match this search and filter.";
    palsGrid.replaceChildren(message);
    palsGrid.setAttribute("aria-busy", "false");
    return;
  }

  const fragment = document.createDocumentFragment();

  pals.forEach((pal) => {
    fragment.append(createPalCard(pal, workName));
  });

  palsGrid.replaceChildren(fragment);
  palsGrid.setAttribute("aria-busy", "false");
}

function createWorkFilter(name, icon = null) {
  const button = document.createElement("button");
  button.className = "tier-filter work-filter";
  button.type = "button";
  button.dataset.work = name;
  button.setAttribute("aria-pressed", "false");

  if (icon) {
    const image = document.createElement("img");
    image.src = resolveAssetUrl(icon);
    image.alt = "";
    image.loading = "lazy";
    button.append(image);
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
  button.className = "tier-filter element-filter";
  button.type = "button";
  button.dataset.element = name;
  button.dataset.position = filterPosition;
  button.setAttribute("aria-pressed", "false");

  if (icon) {
    const image = document.createElement("img");
    image.src = resolveAssetUrl(icon);
    image.alt = "";
    image.loading = "lazy";
    button.append(image);
  }

  const label = document.createElement("span");
  label.textContent = name;
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
  const [primaryElement, secondaryElement] = selectedElements;

  elementFilters.querySelectorAll(".element-filter").forEach((button) => {
    const isActive = button.dataset.element === primaryElement;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  secondElementFilters.querySelectorAll(".element-filter").forEach((button) => {
    const isPrimary = button.dataset.element === primaryElement;
    const isActive = button.dataset.element === secondaryElement;
    button.disabled = isPrimary;
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

function applyWorkFilter() {
  const searchTerm = palSearchInput.value.trim().toLowerCase();
  const searchedPals = allPals.filter((pal) => {
    const searchableText = [
      pal.name,
      pal.dexKey,
      ...pal.elements.map((element) => element.name),
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch =
      searchTerm.length === 0 || searchableText.includes(searchTerm);
    const palElements = pal.elements.map((element) => element.name);
    const matchesElement = selectedElements.every((elementName) =>
      palElements.includes(elementName),
    );

    return matchesSearch && matchesElement;
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

      const workSpeedDifference =
        palB.stats.craftspeed - palA.stats.craftspeed;

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

  palsViewFilters.querySelectorAll("[data-view]").forEach((viewButton) => {
    const isActive = viewButton === button;
    viewButton.classList.toggle("active", isActive);
    viewButton.setAttribute("aria-pressed", String(isActive));
  });

  workFilters.hidden = !showWorkers;
  elementFilterPanel.hidden = !showElements;

  if (!showWorkers && !showElements) {
    selectedWork = null;
    selectedElements = [];
    secondElementPanel.hidden = true;
    updateElementControls();
    applyWorkFilter();
    return;
  }

  if (showWorkers) {
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
    if (selectedElements.length === 0 && defaultElement) {
      selectedElements = [defaultElement];
    }

    updateElementControls();
  }

  applyWorkFilter();
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

  applyWorkFilter();
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
  applyWorkFilter();
});

secondElementToggle.addEventListener("click", () => {
  const openingPanel = secondElementPanel.hidden;
  secondElementPanel.hidden = !openingPanel;

  if (!openingPanel) {
    selectedElements.splice(1, 1);
    applyWorkFilter();
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
  applyWorkFilter();
});

palSearchInput.addEventListener("input", applyWorkFilter);

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
    renderWorkFilters(allPals);
    renderElementFilters(allPals);
    applyWorkFilter();

    const beginImagePreload = () => {
      preloadPalImages(allPals).catch((error) => {
        console.warn("Some Pal images could not be preloaded.", error);
      });
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(beginImagePreload, { timeout: 1500 });
    } else {
      window.setTimeout(beginImagePreload, 250);
    }
  } catch (error) {
    console.error("Unable to load Palworld Pals.", error);
    showStatus({
      state: "error",
      title: "Pal data unavailable",
      message:
        "The local Paldeck dataset could not be loaded. Check the data file before publishing.",
    });

    palsGrid.innerHTML = '<p class="skills-error">Pals could not be loaded.</p>';
    palsGrid.setAttribute("aria-busy", "false");
  }
}

loadPals();
