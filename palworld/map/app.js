const DATA_URL = "../data/map-locations.json";

const elements = {
  map: document.querySelector("#palworld-map"),
  mapSwitcher: document.querySelector("#map-switcher"),
  filters: document.querySelector("#map-filters"),
  search: document.querySelector("#map-search"),
  list: document.querySelector("#map-location-list"),
  resultCount: document.querySelector("#map-result-count"),
  detailTitle: document.querySelector("#map-detail-title"),
  detailBody: document.querySelector("#map-detail-body"),
  detailPanel: document.querySelector(".map-panel"),
  detailClose: document.querySelector("#map-panel-close"),
  statusPanel: document.querySelector("#data-status"),
  statusTitle: document.querySelector("#data-status-title"),
  statusMessage: document.querySelector("#data-status-message"),
  statusMeta: document.querySelector("#data-status-meta"),
};

const showStatus = PalworldUI.createDataStatusController({
  panel: elements.statusPanel,
  titleElement: elements.statusTitle,
  messageElement: elements.statusMessage,
  metaElement: elements.statusMeta,
});

let map;
let markerLayer;
let imageOverlay;
let dataSet;
let activeMapId = "";
let activeCategories = new Set();
let activeLocationId = "";
const markersById = new Map();

function getMaps() {
  if (Array.isArray(dataSet.metadata.maps) && dataSet.metadata.maps.length) {
    return dataSet.metadata.maps;
  }

  return [
    {
      id: "palpagos",
      label: "Palpagos",
      mapImage: dataSet.metadata.mapImage,
      coordinateBounds: dataSet.metadata.coordinateBounds,
    },
  ];
}

function getActiveMap() {
  const maps = getMaps();
  return maps.find((mapConfig) => mapConfig.id === activeMapId) || maps[0];
}

function getCategory(categoryId) {
  return dataSet.metadata.categories.find((category) => category.id === categoryId);
}

function getCategoryLabel(categoryId) {
  return getCategory(categoryId)?.label || categoryId;
}

function getCategoryColor(categoryId) {
  return getCategory(categoryId)?.color || "#758a99";
}

function getMarkerLabel(categoryId) {
  const labels = {
    "alpha-boss": "A",
    dungeon: "D",
    effigy: "E",
    "fast-travel": "F",
    "pal-habitat": "P",
    npc: "N",
    resource: "R",
    "skill-fruit": "S",
    tower: "T",
  };

  return labels[categoryId] || "•";
}

function getActiveMapLocations() {
  return dataSet.locations.filter(
    (location) => (location.mapId || "palpagos") === activeMapId,
  );
}

function getCategoryCounts() {
  return getActiveMapLocations().reduce((counts, location) => {
    counts.set(location.category, (counts.get(location.category) || 0) + 1);
    return counts;
  }, new Map());
}

function getVisibleCategories() {
  const counts = getCategoryCounts();

  return dataSet.metadata.categories.filter((category) => counts.has(category.id));
}

function selectAllVisibleCategories() {
  activeCategories = new Set(getVisibleCategories().map((category) => category.id));
}

function worldToMapPoint(coordinates) {
  const activeMap = getActiveMap();
  const bounds = activeMap.coordinateBounds;
  const image = activeMap.mapImage;
  const x =
    ((coordinates.x - bounds.minX) / (bounds.maxX - bounds.minX)) * image.width;
  const y =
    ((bounds.maxY - coordinates.y) / (bounds.maxY - bounds.minY)) *
    image.height;

  return [y, x];
}

function matchesSearch(location, query) {
  if (!query) {
    return true;
  }

  const searchableText = [
    location.name,
    getCategoryLabel(location.category),
    location.summary,
    ...(location.nearby || []),
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(query);
}

function getFilteredLocations() {
  const query = elements.search.value.trim().toLowerCase();

  return getActiveMapLocations().filter(
    (location) => activeCategories.has(location.category) && matchesSearch(location, query),
  );
}

function createMapButton({ id, label }) {
  const button = document.createElement("button");
  button.className = "map-view-button";
  button.type = "button";
  button.dataset.mapId = id;
  button.textContent = label;
  button.setAttribute("role", "tab");
  button.setAttribute("aria-selected", String(id === activeMapId));

  if (id === activeMapId) {
    button.classList.add("active");
  }

  return button;
}

function renderMapSwitcher() {
  const buttons = getMaps().map(createMapButton);
  elements.mapSwitcher.replaceChildren(...buttons);
}

function createFilterButton({ id, label, count = 0 }) {
  const button = document.createElement("button");
  button.className = "filter-button";
  button.type = "button";
  button.dataset.category = id;
  button.innerHTML = `<span>${label}</span><small>${count}</small>`;

  const isAllButton = id === "all";
  const visibleCategories = getVisibleCategories();
  const isActive = isAllButton
    ? visibleCategories.every((category) => activeCategories.has(category.id))
    : activeCategories.has(id);

  button.setAttribute("aria-pressed", String(isActive));

  if (isActive) {
    button.classList.add("active");
  }

  return button;
}

function renderFilters() {
  const counts = getCategoryCounts();
  const visibleCategories = getVisibleCategories();
  const buttons = [
    createFilterButton({
      id: "all",
      label: "All Layers",
      count: getActiveMapLocations().length,
    }),
    ...visibleCategories.map((category) =>
      createFilterButton({
        ...category,
        count: counts.get(category.id) || 0,
      }),
    ),
  ];

  elements.filters.replaceChildren(...buttons);
}

function createMarker(location) {
  const color = getCategoryColor(location.category);
  const marker = L.marker(worldToMapPoint(location.coordinates), {
    icon: L.divIcon({
      className: "",
      html: `<span class="map-marker" style="--marker-color: ${color}">${getMarkerLabel(location.category)}</span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    }),
    title: location.name,
  });

  marker.on("click", () => selectLocation(location.id, { focusMap: false }));
  markersById.set(location.id, marker);

  return marker;
}

function setMarkerActive(locationId) {
  markersById.forEach((marker, id) => {
    const markerElement = marker.getElement()?.querySelector(".map-marker");
    markerElement?.classList.toggle("is-active", id === locationId);
  });
}

function renderMarkers(locations) {
  markersById.clear();
  markerLayer.clearLayers();
  locations.forEach((location) => {
    markerLayer.addLayer(createMarker(location));
  });
}

function createLocationCard(location) {
  const column = document.createElement("div");
  column.className = "col-12 col-md-6 col-xl-3";

  const button = document.createElement("button");
  button.className = "map-location-card map-location-card-button tinted-card";
  button.type = "button";
  button.dataset.locationId = location.id;
  button.style.setProperty("--location-color", getCategoryColor(location.category));
  button.classList.toggle("is-active", location.id === activeLocationId);

  button.innerHTML = `
    <div class="map-location-card-header">
      <div>
        <p class="map-detail-category">${getCategoryLabel(location.category)}</p>
        <h3>${location.name}</h3>
      </div>
      <span class="map-location-coords">${location.coordinates.x}, ${location.coordinates.y}</span>
    </div>
    <p>${location.summary}</p>
  `;

  button.addEventListener("click", () => selectLocation(location.id));
  column.append(button);

  return column;
}

function renderLocationList(locations) {
  const fragment = document.createDocumentFragment();

  locations.forEach((location) => {
    fragment.append(createLocationCard(location));
  });

  elements.list.replaceChildren(fragment);
  elements.resultCount.textContent = `${locations.length} location${
    locations.length === 1 ? "" : "s"
  } on ${getActiveMap().label}`;
}

function renderDetail(location) {
  elements.detailTitle.textContent = location.name;
  elements.detailBody.style.setProperty(
    "--location-color",
    getCategoryColor(location.category),
  );

  const nearbyItems = (location.nearby || [])
    .map((item) => `<li>${item}</li>`)
    .join("");

  elements.detailBody.innerHTML = `
    <span class="map-detail-category">${getCategoryLabel(location.category)}</span>
    <p>${location.summary}</p>
    <div class="map-detail-grid">
      <div class="map-detail-stat">
        <span>Coordinates</span>
        <strong>${location.coordinates.x}, ${location.coordinates.y}</strong>
      </div>
      <div class="map-detail-stat">
        <span>Recommended</span>
        <strong>${location.recommendedLevel}</strong>
      </div>
    </div>
    <div>
      <p class="map-panel-kicker">Nearby</p>
      <ul class="map-nearby-list">${nearbyItems}</ul>
    </div>
  `;
  elements.detailPanel.dataset.open = "true";
}

function selectLocation(locationId, options = {}) {
  const location = dataSet.locations.find(
    (item) => item.id === locationId && (item.mapId || "palpagos") === activeMapId,
  );

  if (!location) {
    return;
  }

  activeLocationId = locationId;
  renderDetail(location);
  setMarkerActive(locationId);

  document.querySelectorAll(".map-location-card").forEach((card) => {
    card.classList.toggle("is-active", card.dataset.locationId === locationId);
  });

  if (options.focusMap !== false) {
    map.flyTo(worldToMapPoint(location.coordinates), Math.max(map.getZoom(), 0.25), {
      duration: 0.35,
    });
  }
}

function refreshMap() {
  const locations = getFilteredLocations();
  renderMarkers(locations);
  renderLocationList(locations);
  setMarkerActive(activeLocationId);

  if (!locations.some((location) => location.id === activeLocationId)) {
    activeLocationId = "";
    elements.detailTitle.textContent = "Choose a marker";
    elements.detailBody.innerHTML =
      '<p class="empty-state-message">Tap a marker or choose a location from the list.</p>';
    elements.detailPanel.dataset.open = "false";
  }
}

function getMapBounds() {
  const image = getActiveMap().mapImage;
  return [
    [0, 0],
    [image.height, image.width],
  ];
}

function setInitialMapView() {
  const initialView = getActiveMap().initialView;

  if (initialView?.coordinates && Number.isFinite(initialView.zoom)) {
    map.setView(worldToMapPoint(initialView.coordinates), initialView.zoom, {
      animate: false,
      reset: true,
    });
    return;
  }

  map.fitBounds(getMapBounds(), { animate: false });
}

function setMapImage() {
  const image = getActiveMap().mapImage;
  const bounds = getMapBounds();

  if (imageOverlay) {
    imageOverlay.remove();
  }

  setInitialMapView();

  imageOverlay = L.imageOverlay(image.url, bounds).addTo(map);

  imageOverlay.bringToBack();
}

function clearLocationDetail() {
  activeLocationId = "";
  elements.detailTitle.textContent = "Choose a marker";
  elements.detailBody.innerHTML =
    '<p class="empty-state-message">Tap a marker or choose a location from the list.</p>';
  elements.detailPanel.dataset.open = "false";
}

function initializeMap() {
  const bounds = [
    [0, 0],
    [getActiveMap().mapImage.height, getActiveMap().mapImage.width],
  ];

  map = L.map(elements.map, {
    attributionControl: false,
    crs: L.CRS.Simple,
    maxZoom: 2,
    minZoom: -4,
    fadeAnimation: false,
    inertia: false,
    markerZoomAnimation: false,
    zoomAnimation: false,
    zoomSnap: 0.25,
  });
  markerLayer = L.layerGroup().addTo(map);
  setMapImage();
}

function bindEvents() {
  elements.mapSwitcher.addEventListener("click", (event) => {
    const button = event.target.closest("[data-map-id]");

    if (!button || button.dataset.mapId === activeMapId) {
      return;
    }

    activeMapId = button.dataset.mapId;
    elements.search.value = "";
    selectAllVisibleCategories();
    clearLocationDetail();
    renderMapSwitcher();
    renderFilters();
    setMapImage();
    refreshMap();
  });

  elements.filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");

    if (!button) {
      return;
    }

    const nextCategory = button.dataset.category;

    if (nextCategory === "all") {
      selectAllVisibleCategories();
    } else if (activeCategories.has(nextCategory)) {
      activeCategories.delete(nextCategory);
    } else {
      activeCategories.add(nextCategory);
    }

    renderFilters();
    refreshMap();
  });

  elements.search.addEventListener("input", refreshMap);
  elements.detailClose.addEventListener("click", () => {
    elements.detailPanel.dataset.open = "false";
  });
}

async function loadMapData() {
  try {
    const response = await fetch(DATA_URL);

    if (!response.ok) {
      throw new Error(`Map data request failed with status ${response.status}`);
    }

    dataSet = await response.json();
    activeMapId = getMaps()[0].id;
    selectAllVisibleCategories();

    initializeMap();
    renderMapSwitcher();
    renderFilters();
    bindEvents();
    refreshMap();

    showStatus({
      state: "current",
      title: "Map data is ready",
      message:
        "Palpagos and World Tree map views are loaded from local images and local JSON.",
      meta: `Updated ${PalworldUI.formatDate(dataSet.metadata.lastUpdated)}`,
    });
  } catch (error) {
    console.error("Unable to load Palworld map data.", error);
    showStatus({
      state: "error",
      title: "Map data unavailable",
      message: "The local map dataset could not be loaded.",
    });
  }
}

loadMapData();
