const ICON_SPRITE_URL = "../assets/paldeck/pal-icons.webp";
const ICON_COLUMNS = 7;
const ICON_ROWS = 3;

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
  const horizontalPosition =
    (column / (ICON_COLUMNS - 1)) * 100;
  const verticalPosition = (row / (ICON_ROWS - 1)) * 100;

  icon.className = "type-icon";
  icon.style.backgroundImage = `url("${ICON_SPRITE_URL}")`;
  icon.style.backgroundSize = `${ICON_COLUMNS * 100}% ${ICON_ROWS * 100}%`;
  icon.style.backgroundPosition =
    `${horizontalPosition}% ${verticalPosition}%`;

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
    card.className = "type-summary-card";
    card.dataset.type = type.key;

    const heading = document.createElement("h2");
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

function renderMatrix() {
  const head = document.querySelector("#damage-matrix-head");
  const body = document.querySelector("#damage-matrix-body");
  const headingRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.scope = "col";
  corner.textContent = "ATK \\ DEF";
  headingRow.append(corner);

  types.forEach((type) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.title = type.name;
    cell.append(createTypeIcon(type));
    headingRow.append(cell);
  });

  head.replaceChildren(headingRow);
  const rows = document.createDocumentFragment();

  types.forEach((attacker) => {
    const row = document.createElement("tr");
    const label = document.createElement("th");
    label.scope = "row";
    label.dataset.type = attacker.key;
    label.append(createTypeIcon(attacker, false), attacker.name);
    row.append(label);

    types.forEach((defender) => {
      const cell = document.createElement("td");

      if (attacker.beats.includes(defender.key)) {
        cell.className = "super-effective";
        cell.textContent = "2x";
      } else if (attacker.weakTo.includes(defender.key)) {
        cell.className = "resisted";
        cell.innerHTML = "&frac12;";
      } else {
        cell.className = "normal-damage";
        cell.textContent = "·";
      }

      cell.setAttribute(
        "aria-label",
        `${attacker.name} attacking ${defender.name}: ${cell.textContent}`,
      );
      row.append(cell);
    });

    rows.append(row);
  });

  body.replaceChildren(rows);
}

renderSummary();
