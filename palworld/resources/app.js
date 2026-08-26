const ITEM_DATA_URL = "../data/items.json?v=20260727-tools1";
const PARTY_DATA_URL = "../data/party-guides.json?v=20260727-party2";
const PAL_DATA_URL = "../data/pal-index.json?v=20260826-elements1";
const ICON_SPRITE_URL = "../assets/paldeck/pal-icons.webp";
const { applySpriteStyle, formatPalNumber, stylePalName } = window.PalworldUI;

const typeSummary = document.querySelector("#type-summary");
const itemSearch = document.querySelector("#resource-item-search");
const itemResults = document.querySelector("#resource-item-results");
const partyGrid = document.querySelector("#resource-party-grid");
const partyDialog = document.querySelector("#party-guide-dialog");
const partyDialogContent = document.querySelector("#party-guide-content");
const partyDialogClose = document.querySelector("#party-guide-close");
const resourceNavigation = document.querySelector(".resource-navigation");

let allItems = [];
let partyData = null;
let palSprite = null;
let palByName = new Map();

const iconSprite = { cellSize: 48, columns: 7, rows: 3 };
const types = [
  { key: "neutral", name: "Neutral", icon: 0, beats: [], weakTo: ["dark"] },
  { key: "fire", name: "Fire", icon: 1, beats: ["grass", "ice"], weakTo: ["water"] },
  { key: "water", name: "Water", icon: 2, beats: ["fire"], weakTo: ["electric"] },
  { key: "grass", name: "Grass", icon: 4, beats: ["ground"], weakTo: ["fire"] },
  { key: "electric", name: "Electric", icon: 3, beats: ["water"], weakTo: ["ground"] },
  { key: "ice", name: "Ice", icon: 8, beats: ["dragon"], weakTo: ["fire"] },
  { key: "ground", name: "Ground", icon: 7, beats: ["electric"], weakTo: ["grass"] },
  { key: "dark", name: "Dark", icon: 5, beats: ["neutral"], weakTo: ["dragon"] },
  { key: "dragon", name: "Dragon", icon: 6, beats: ["dark"], weakTo: ["ice"] },
];
const typeByKey = new Map(types.map((type) => [type.key, type]));

function createTypeIcon(type, labelled = true) {
  const icon = document.createElement("span");
  icon.className = "type-icon";
  applySpriteStyle(icon, iconSprite, {
    x: (type.icon % iconSprite.columns) * iconSprite.cellSize,
    y: Math.floor(type.icon / iconSprite.columns) * iconSprite.cellSize,
  }, ICON_SPRITE_URL);
  if (labelled) {
    icon.setAttribute("role", "img");
    icon.setAttribute("aria-label", type.name);
  } else {
    icon.setAttribute("aria-hidden", "true");
  }
  return icon;
}

function createTypeBadge(key) {
  const type = typeByKey.get(key);
  const badge = document.createElement("span");
  badge.className = "type-badge";
  badge.dataset.type = key;
  badge.append(createTypeIcon(type, false), type.name);
  return badge;
}

function createMatchupRow(label, keys, emptyText = "") {
  const row = document.createElement("div");
  row.className = "type-matchup-row";
  const heading = document.createElement("span");
  heading.textContent = label;
  const values = document.createElement("div");
  values.className = "type-matchup-values";
  if (keys.length) {
    keys.forEach((key) => values.append(createTypeBadge(key)));
  } else {
    const empty = document.createElement("em");
    empty.textContent = emptyText;
    values.append(empty);
  }
  row.append(heading, values);
  return row;
}

function renderTypeChart() {
  typeSummary.replaceChildren(...types.map((type) => {
    const column = document.createElement("div");
    column.className = "col-12 col-md-6 col-xl-4";
    const card = document.createElement("article");
    card.className = "tinted-card type-summary-card";
    card.dataset.type = type.key;
    const heading = document.createElement("h3");
    heading.className = "card-title";
    heading.append(createTypeIcon(type), type.name);
    card.append(
      heading,
      createMatchupRow("Strong against", type.beats, "Nothing"),
      createMatchupRow("Weak against", type.weakTo),
    );
    column.append(card);
    return column;
  }));
}

function createItemSource(source, sourceType) {
  const link = document.createElement("a");
  link.className = "resource-item-source";
  link.href = `../pals/?detail=${encodeURIComponent(source.pal)}`;
  const name = document.createElement("strong");
  name.textContent = source.pal;
  stylePalName(name, palByName.get(source.pal));
  const detail = document.createElement("span");
  if (sourceType === "ranch") {
    detail.textContent = source.minimumLevel ? `Ranch Lv ${source.minimumLevel}+` : "Ranch";
  } else {
    const quantity = source.minimum === source.maximum ? source.minimum : `${source.minimum}-${source.maximum}`;
    detail.textContent = `${source.rate}% · Qty ${quantity}`;
  }
  link.append(name, detail);
  return link;
}

function createItemResult(item) {
  const card = document.createElement("article");
  card.className = "resource-item-card";
  const heading = document.createElement("header");
  const title = document.createElement("h3");
  title.textContent = item.name;
  const category = document.createElement("span");
  category.textContent = item.category;
  heading.append(title, category);
  const sources = document.createElement("div");
  sources.className = "resource-item-sources";
  item.wildSources.forEach((source) => sources.append(createItemSource(source, "wild")));
  item.ranchSources.forEach((source) => sources.append(createItemSource(source, "ranch")));
  if (!sources.childElementCount) {
    const unavailable = document.createElement("p");
    unavailable.textContent = "No Pal sources are currently indexed for this item.";
    sources.append(unavailable);
  }
  card.append(heading, sources);
  return card;
}

function renderItemResults() {
  const query = itemSearch.value.trim().toLocaleLowerCase();
  if (!query) {
    itemResults.innerHTML = '<p class="resource-placeholder">Enter an item name to find the Pals that drop or produce it.</p>';
    return;
  }
  const matches = allItems.filter((item) => item.name.toLocaleLowerCase().includes(query));
  if (!matches.length) {
    itemResults.innerHTML = '<p class="resource-placeholder">No indexed items match that search.</p>';
    return;
  }
  itemResults.replaceChildren(...matches.map(createItemResult));
}

function createPortrait(name, flexible = false) {
  const frame = document.createElement("div");
  frame.className = "party-pal-portrait";
  if (flexible) {
    frame.classList.add("is-flexible");
    frame.textContent = "?";
    frame.setAttribute("aria-label", `${name}, flexible party slot`);
    return frame;
  }
  const pal = palByName.get(name);
  if (!pal?.sprite || !palSprite) {
    frame.textContent = name.slice(0, 1);
    frame.setAttribute("aria-label", name);
    return frame;
  }
  const portrait = document.createElement("span");
  portrait.className = "party-pal-sprite";
  applySpriteStyle(portrait, palSprite, pal.sprite, `../${palSprite.image.slice(2)}`);
  portrait.setAttribute("role", "img");
  portrait.setAttribute("aria-label", name);
  frame.append(portrait);
  return frame;
}

function createPartyMember(member) {
  const item = document.createElement("article");
  item.className = "party-member";
  item.append(createPortrait(member.name, member.flexible === true));
  const body = document.createElement("div");
  const heading = document.createElement("div");
  heading.className = "party-member-heading";
  const name = document.createElement("h3");
  name.className = "party-member-name";
  name.textContent = member.name;
  stylePalName(name, palByName.get(member.name));
  heading.append(name);
  const pal = palByName.get(member.name);
  if (pal?.dexKey) {
    const number = document.createElement("span");
    number.className = "party-member-number pal-id";
    number.textContent = `#${formatPalNumber(pal.dexKey)}`;
    heading.append(number);
  }
  const role = document.createElement("p");
  role.className = "party-member-role";
  role.textContent = member.role;
  const effect = document.createElement("p");
  effect.className = "party-member-effect";
  effect.textContent = member.effect;
  const meta = document.createElement("div");
  meta.className = "party-member-meta";
  [member.requirement, ...(member.alternatives || []).map((value) => `Also: ${value}`)].forEach((value, index) => {
    const chip = document.createElement("span");
    chip.className = index ? "party-alternative" : "party-requirement";
    chip.textContent = value;
    meta.append(chip);
  });
  body.append(heading, role, effect, meta);
  item.append(body);
  return item;
}

function createFullGuide(guide) {
  const card = document.createElement("article");
  card.className = "party-guide-card";
  const header = document.createElement("header");
  header.className = "party-guide-header";
  const heading = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "party-guide-eyebrow";
  eyebrow.textContent = guide.eyebrow;
  const title = document.createElement("h2");
  title.id = "party-dialog-title";
  title.className = "party-guide-title";
  title.textContent = guide.title;
  const summary = document.createElement("p");
  summary.className = "party-guide-summary";
  summary.textContent = guide.summary;
  heading.append(eyebrow, title, summary);
  const size = document.createElement("span");
  size.className = "party-size";
  size.textContent = `${guide.members.length} Pal party`;
  header.append(heading, size);
  const members = document.createElement("div");
  members.className = "party-members";
  members.append(...guide.members.map((member) => createPartyMember(member)));
  const tip = document.createElement("p");
  tip.className = "party-tip";
  const tipLabel = document.createElement("strong");
  tipLabel.textContent = "Guide note: ";
  tip.append(tipLabel, guide.tip);
  card.append(header, members, tip);
  return card;
}

function openPartyGuide(guide) {
  partyDialogContent.replaceChildren(createFullGuide(guide));
  partyDialog.showModal();
}

function renderPartyGuideButtons() {
  partyGrid.replaceChildren(...partyData.guides.map((guide) => {
    const button = document.createElement("button");
    button.className = "resource-party-card";
    button.type = "button";
    const eyebrow = document.createElement("span");
    eyebrow.textContent = guide.eyebrow;
    const title = document.createElement("strong");
    title.textContent = guide.title;
    button.append(eyebrow, title);
    button.addEventListener("click", () => openPartyGuide(guide));
    return button;
  }));
}

itemSearch.addEventListener("input", renderItemResults);
resourceNavigation.addEventListener("click", (event) => {
  const link = event.target.closest("a[href^='#']");
  if (!link) return;
  resourceNavigation.querySelectorAll("a").forEach((item) => {
    item.classList.toggle("active", item === link);
  });
});
partyDialogClose.addEventListener("click", () => partyDialog.close());
partyDialog.addEventListener("click", (event) => {
  if (event.target === partyDialog) partyDialog.close();
});

async function initializeResources() {
  renderTypeChart();
  try {
    const [itemResponse, partyResponse, palResponse] = await Promise.all([
      fetch(ITEM_DATA_URL), fetch(PARTY_DATA_URL), fetch(PAL_DATA_URL),
    ]);
    if (!itemResponse.ok || !partyResponse.ok || !palResponse.ok) throw new Error("Resource data could not be loaded.");
    const itemData = await itemResponse.json();
    allItems = itemData.items;
    partyData = await partyResponse.json();
    const palData = await palResponse.json();
    palSprite = palData.metadata.palSprite;
    palByName = new Map(palData.pals.map((pal) => [pal.name, pal]));
    renderPartyGuideButtons();
  } catch (error) {
    console.error(error);
    partyGrid.innerHTML = '<p class="resource-placeholder">Resource data could not be loaded.</p>';
    itemResults.innerHTML = '<p class="resource-placeholder">Item data could not be loaded.</p>';
  }
}

initializeResources();
