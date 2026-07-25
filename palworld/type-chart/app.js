const ICON_SPRITE_URL = "../assets/paldeck/pal-icons.webp";
const ICON_COLUMNS = 7;
const ICON_ROWS = 3;
const ICON_SIZE = 48;
const { applySpriteStyle } = window.PalworldUI;
const iconSprite = {
  cellSize: ICON_SIZE,
  columns: ICON_COLUMNS,
  rows: ICON_ROWS,
};

const types = [
  { key: "neutral", name: "Neutral", icon: 0, beats: [], weakTo: ["dark"] },
  {
    key: "fire",
    name: "Fire",
    icon: 1,
    beats: ["grass", "ice"],
    weakTo: ["water"],
  },
  {
    key: "water",
    name: "Water",
    icon: 2,
    beats: ["fire"],
    weakTo: ["electric"],
  },
  {
    key: "grass",
    name: "Grass",
    icon: 4,
    beats: ["ground"],
    weakTo: ["fire"],
  },
  {
    key: "electric",
    name: "Electric",
    icon: 3,
    beats: ["water"],
    weakTo: ["ground"],
  },
  {
    key: "ice",
    name: "Ice",
    icon: 8,
    beats: ["dragon"],
    weakTo: ["fire"],
  },
  {
    key: "ground",
    name: "Ground",
    icon: 7,
    beats: ["electric"],
    weakTo: ["grass"],
  },
  {
    key: "dark",
    name: "Dark",
    icon: 5,
    beats: ["neutral"],
    weakTo: ["dragon"],
  },
  {
    key: "dragon",
    name: "Dragon",
    icon: 6,
    beats: ["dark"],
    weakTo: ["ice"],
  },
];

const typeByKey = new Map(types.map((type) => [type.key, type]));

function createTypeIcon(type, label = true) {
  const icon = document.createElement("span");
  const column = type.icon % ICON_COLUMNS;
  const row = Math.floor(type.icon / ICON_COLUMNS);

  icon.className = "type-icon";
  applySpriteStyle(
    icon,
    iconSprite,
    { x: column * ICON_SIZE, y: row * ICON_SIZE },
    ICON_SPRITE_URL,
  );

  if (label) {
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

function renderSummary() {
  const summary = document.querySelector("#type-summary");
  const fragment = document.createDocumentFragment();

  types.forEach((type) => {
    const column = document.createElement("div");
    column.className = "col-12 col-md-6 col-xl-4";

    const card = document.createElement("article");
    card.className = "tinted-card type-summary-card";
    card.dataset.type = type.key;

    const heading = document.createElement("h2");
    heading.className = "card-title";
    heading.append(createTypeIcon(type), type.name);

    const beats = document.createElement("div");
    beats.className = "type-matchup-row";
    const beatsLabel = document.createElement("span");
    beatsLabel.textContent = "Strong against";
    const beatsValues = document.createElement("div");
    beatsValues.className = "type-matchup-values";
    beats.append(beatsLabel, beatsValues);

    if (type.beats.length === 0) {
      const nothing = document.createElement("em");
      nothing.textContent = "Nothing";
      beatsValues.append(nothing);
    } else {
      type.beats.forEach((key) => beatsValues.append(createTypeBadge(key)));
    }

    const weakness = document.createElement("div");
    weakness.className = "type-matchup-row";
    const weaknessLabel = document.createElement("span");
    weaknessLabel.textContent = "Weak against";
    const weaknessValues = document.createElement("div");
    weaknessValues.className = "type-matchup-values";
    weakness.append(weaknessLabel, weaknessValues);
    type.weakTo.forEach((key) =>
      weaknessValues.append(createTypeBadge(key)),
    );

    card.append(heading, beats, weakness);
    column.append(card);
    fragment.append(column);
  });

  summary.replaceChildren(fragment);
}

renderSummary();
