const DATA_URL = "../data/pals.json";

const statusPanel = document.querySelector("#data-status");
const statusTitle = document.querySelector("#data-status-title");
const statusMessage = document.querySelector("#data-status-message");
const statusMeta = document.querySelector("#data-status-meta");
const palsGrid = document.querySelector("#pals-grid");
const palsCount = document.querySelector("#pals-count");

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

function createIconList(items, className) {
  const list = document.createElement("div");
  list.className = className;

  items.forEach((item) => {
    const badge = document.createElement("span");
    badge.className = "pal-icon-badge";
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

function createPalCard(pal) {
  const column = document.createElement("div");
  column.className = "col-12 col-md-6 col-lg-4 col-xxl-3";

  const card = document.createElement("article");
  card.className = "pal-card";

  const media = document.createElement("div");
  media.className = "pal-card-media";

  const image = document.createElement("img");
  image.src = resolveAssetUrl(pal.image);
  image.alt = pal.name;
  image.loading = "lazy";
  media.append(image);

  const body = document.createElement("div");
  body.className = "pal-card-body";

  const header = document.createElement("header");
  header.className = "pal-card-header";

  const titleGroup = document.createElement("div");

  const number = document.createElement("p");
  number.className = "pal-card-number";
  number.textContent = `#${pal.dexKey}`;

  const title = document.createElement("h2");
  title.className = "passive-skill-title";
  title.textContent = pal.name;

  titleGroup.append(number, title);
  header.append(titleGroup);

  const elements = createIconList(pal.elements, "pal-elements");

  const description = document.createElement("p");
  description.className = "pal-description";
  description.textContent = pal.description;

  const stats = document.createElement("div");
  stats.className = "pal-stats";
  stats.append(
    createStat("HP", pal.stats.hp),
    createStat("ATK", pal.stats.rangedattack),
    createStat("DEF", pal.stats.defense),
  );

  const workItems = pal.workSuitability.slice(0, 4);
  const workSuitability = createIconList(workItems, "pal-work");

  body.append(header, elements, description, stats, workSuitability);
  card.append(media, body);
  column.append(card);

  return column;
}

function renderPals(pals) {
  const fragment = document.createDocumentFragment();

  pals.forEach((pal) => {
    fragment.append(createPalCard(pal));
  });

  palsGrid.replaceChildren(fragment);
  palsGrid.setAttribute("aria-busy", "false");
  palsCount.textContent = `${pals.length} Pals`;
}

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

    renderPals(data.pals);
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
