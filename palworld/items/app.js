const DATA_URL = "../data/items.json?v=20260727-tools1";
const categories = document.querySelector("#item-categories");
const searchInput = document.querySelector("#item-search");
const grid = document.querySelector("#items-grid");
const status = document.querySelector("#items-status");
const initialParams = new URLSearchParams(window.location.search);

let allItems = [];
let activeCategory = initialParams.get("category") || "all";
searchInput.value = initialParams.get("q") || "";

function createFilter(category) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "filter-button";
  button.dataset.category = category;
  button.textContent = category === "all" ? "All" : category;
  const active = category === activeCategory;
  button.classList.toggle("active", active);
  button.setAttribute("aria-pressed", String(active));
  return button;
}

function renderFilters() {
  const available = [...new Set(allItems.map((item) => item.category))].sort();
  if (activeCategory !== "all" && !available.includes(activeCategory)) {
    activeCategory = "all";
  }
  const fragment = document.createDocumentFragment();
  fragment.append(createFilter("all"));
  available.forEach((category) => fragment.append(createFilter(category)));
  categories.replaceChildren(fragment);
}

function createSource(source, type) {
  const link = document.createElement("a");
  link.className = "item-source";
  link.href = `../pals/?detail=${encodeURIComponent(source.pal)}`;

  const name = document.createElement("strong");
  name.textContent = source.pal;
  const detail = document.createElement("span");
  if (type === "ranch") {
    detail.textContent = source.minimumLevel
      ? `Ranch Lv ${source.minimumLevel}+`
      : "Ranch";
  } else {
    const quantity =
      source.minimum === source.maximum
        ? `${source.minimum}`
        : `${source.minimum}-${source.maximum}`;
    detail.textContent = `${source.rate}% · Qty ${quantity}`;
  }
  link.append(name, detail);
  return link;
}

function createItemCard(item) {
  const column = document.createElement("div");
  column.className = "col-12 col-md-6 col-xl-4";
  const card = document.createElement("article");
  card.className = "item-card tinted-card";
  card.dataset.category = item.category;

  const header = document.createElement("header");
  const icon = document.createElement("span");
  icon.className = "item-letter-icon";
  icon.textContent = item.name.slice(0, 1);
  const identity = document.createElement("div");
  const title = document.createElement("h2");
  title.className = "card-title";
  title.textContent = item.name;
  const category = document.createElement("span");
  category.className = "item-category";
  category.textContent = item.category;
  identity.append(title, category);
  header.append(icon, identity);

  const sources = document.createElement("div");
  sources.className = "item-sources";
  if (item.ranchSources.length) {
    const label = document.createElement("h3");
    label.textContent = "Ranch sources";
    sources.append(label);
    item.ranchSources.forEach((source) =>
      sources.append(createSource(source, "ranch")),
    );
  }
  if (item.wildSources.length) {
    const label = document.createElement("h3");
    label.textContent = "Wild drops";
    sources.append(label);
    item.wildSources.forEach((source) =>
      sources.append(createSource(source, "wild")),
    );
  }

  card.append(header, sources);
  column.append(card);
  return column;
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const matches = allItems.filter((item) => {
    const sourceNames = [
      ...item.ranchSources.map((source) => source.pal),
      ...item.wildSources.map((source) => source.pal),
    ];
    const searchable = [item.name, item.category, ...sourceNames]
      .join(" ")
      .toLowerCase();
    return (
      (activeCategory === "all" || item.category === activeCategory) &&
      (!query || searchable.includes(query))
    );
  });

  if (!matches.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state-message";
    empty.textContent = "No items match this category and search.";
    grid.replaceChildren(empty);
  } else {
    const fragment = document.createDocumentFragment();
    matches.forEach((item) => fragment.append(createItemCard(item)));
    grid.replaceChildren(fragment);
  }

  PalworldUI.updateUrlParams({
    category: activeCategory === "all" ? null : activeCategory,
    q: query || null,
  });
}

categories.addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) {
    return;
  }
  activeCategory = button.dataset.category;
  categories.querySelectorAll("[data-category]").forEach((filter) => {
    const active = filter === button;
    filter.classList.toggle("active", active);
    filter.setAttribute("aria-pressed", String(active));
  });
  render();
});
searchInput.addEventListener("input", render);

async function loadItems() {
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    throw new Error("Item data could not be loaded.");
  }
  const data = await response.json();
  allItems = data.items;
  renderFilters();
  render();
  const statusCopy = document.createElement("div");
  const statusTitle = document.createElement("strong");
  statusTitle.textContent = "Item data is ready";
  const statusMessage = document.createElement("p");
  statusMessage.className = "mb-0";
  statusMessage.textContent =
    `${data.metadata.itemCount} locally indexed items are available.`;
  statusCopy.append(statusTitle, statusMessage);
  status.replaceChildren(statusCopy);
  status.hidden = false;
}

loadItems().catch(() => {
  const error = document.createElement("p");
  error.className = "empty-state-message";
  error.textContent = "Item data could not be loaded.";
  grid.replaceChildren(error);
});
