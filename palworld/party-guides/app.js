const PARTY_DATA_URL = "../data/party-guides.json?v=20260727-party2";
const PAL_DATA_URL = "../data/pal-index.json?v=20260727-bp1";
const {
  applySpriteStyle,
  createDataStatusController,
  formatDate,
  formatPalNumber,
} = window.PalworldUI;

const filtersElement = document.querySelector("#party-filters");
const guidesGridElement = document.querySelector("#party-guides-grid");
const dropGridElement = document.querySelector("#drop-booster-grid");

const updateStatus = createDataStatusController({
  panel: document.querySelector("#party-data-status"),
  titleElement: document.querySelector("#party-data-status-title"),
  messageElement: document.querySelector("#party-data-status-message"),
  metaElement: document.querySelector("#party-data-status-meta"),
});

let partyData = null;
let palSprite = null;
let palByName = new Map();
let activeCategory = "all";

function createPortrait(name, className = "", flexible = false) {
  const frame = document.createElement("div");
  frame.className = `party-pal-portrait ${className}`.trim();
  if (flexible) {
    frame.classList.add("is-flexible");
    frame.textContent = "?";
    frame.setAttribute("aria-label", `${name}, flexible party slot`);
    return frame;
  }

  const pal = palByName.get(name);

  if (!pal || !palSprite || !pal.sprite) {
    frame.textContent = name.slice(0, 1);
    frame.setAttribute("aria-label", name);
    return frame;
  }

  const portrait = document.createElement("span");
  portrait.className = "party-pal-sprite";
  applySpriteStyle(
    portrait,
    palSprite,
    pal.sprite,
    `../${palSprite.image.slice(2)}`,
  );
  portrait.setAttribute("role", "img");
  portrait.setAttribute("aria-label", name);
  frame.append(portrait);
  return frame;
}

function createFilterButton(category) {
  const button = document.createElement("button");
  button.className = "filter-button";
  button.type = "button";
  button.textContent = category.label;
  button.dataset.category = category.id;
  button.classList.toggle("active", category.id === activeCategory);
  button.setAttribute("aria-pressed", String(category.id === activeCategory));

  button.addEventListener("click", () => {
    activeCategory = category.id;
    renderFilters();
    renderGuides();
  });

  return button;
}

function renderFilters() {
  filtersElement.replaceChildren(
    ...partyData.categories.map(createFilterButton),
  );
}

function createMember(member, accent) {
  const item = document.createElement("article");
  item.className = "party-member";
  item.style.setProperty("--card-tint", accent);
  item.append(createPortrait(member.name, "", member.flexible === true));

  const heading = document.createElement("div");
  heading.className = "party-member-heading";

  const name = document.createElement("h3");
  name.className = "party-member-name";
  name.textContent = member.name;
  heading.append(name);

  const pal = palByName.get(member.name);
  if (pal?.dexKey) {
    const number = document.createElement("span");
    number.className = "party-member-number";
    number.textContent = `#${formatPalNumber(pal.dexKey)}`;
    heading.append(number);
  }

  const role = document.createElement("p");
  role.className = "party-member-role";
  role.textContent = member.role;

  const effect = document.createElement("p");
  effect.className = "party-member-effect";
  effect.textContent = member.effect;

  const details = document.createElement("div");
  details.className = "party-member-meta";

  const requirement = document.createElement("span");
  requirement.className = "party-requirement";
  requirement.textContent = member.requirement;
  details.append(requirement);

  (member.alternatives || []).forEach((alternative) => {
    const chip = document.createElement("span");
    chip.className = "party-alternative";
    chip.textContent = `Also: ${alternative}`;
    details.append(chip);
  });

  const body = document.createElement("div");
  body.append(heading, role, effect, details);
  item.append(body);
  return item;
}

function createGuideCard(guide) {
  const card = document.createElement("article");
  card.className = "party-guide-card tinted-card";
  card.style.setProperty("--card-tint", guide.accent);

  const header = document.createElement("header");
  header.className = "party-guide-header";

  const headingGroup = document.createElement("div");
  const eyebrow = document.createElement("p");
  eyebrow.className = "party-guide-eyebrow";
  eyebrow.textContent = guide.eyebrow;

  const title = document.createElement("h2");
  title.className = "party-guide-title";
  title.textContent = guide.title;

  const summary = document.createElement("p");
  summary.className = "party-guide-summary";
  summary.textContent = guide.summary;
  headingGroup.append(eyebrow, title, summary);

  const size = document.createElement("span");
  size.className = "party-size";
  size.textContent = `${guide.members.length} Pal party`;
  header.append(headingGroup, size);

  const members = document.createElement("div");
  members.className = "party-members";
  members.append(
    ...guide.members.map((member) => createMember(member, guide.accent)),
  );

  const tip = document.createElement("p");
  tip.className = "party-tip";
  const tipLabel = document.createElement("strong");
  tipLabel.textContent = "Guide note: ";
  tip.append(tipLabel, guide.tip);

  card.append(header, members, tip);
  return card;
}

function renderGuides() {
  const visibleGuides = partyData.guides.filter(
    (guide) =>
      activeCategory === "all" || guide.category === activeCategory,
  );

  if (visibleGuides.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-state-message";
    message.textContent = "No party guides match this filter.";
    guidesGridElement.replaceChildren(message);
    return;
  }

  guidesGridElement.replaceChildren(...visibleGuides.map(createGuideCard));
}

function createDropBoosterCard(booster) {
  const card = document.createElement("article");
  card.className = "drop-booster-card tinted-card";
  card.style.setProperty("--card-tint", booster.color);
  card.append(createPortrait(booster.pal));

  const element = document.createElement("p");
  element.className = "drop-booster-element";
  element.textContent = `${booster.element} enemy drops`;

  const pal = document.createElement("p");
  pal.className = "drop-booster-pal";
  pal.textContent = booster.pal;
  card.append(element, pal);

  if (booster.alternatives.length > 0) {
    const alternatives = document.createElement("p");
    alternatives.className = "drop-booster-alt";
    alternatives.textContent = `Alternative: ${booster.alternatives.join(", ")}`;
    card.append(alternatives);
  }

  return card;
}

function renderDropBoosters() {
  dropGridElement.replaceChildren(
    ...partyData.dropBoosters.map(createDropBoosterCard),
  );
}

function renderCondensationPriorities() {
  const list = document.querySelector("#condensation-priorities");
  list.replaceChildren(
    ...partyData.condensationPriorities.map((name) => {
      const item = document.createElement("li");
      item.textContent = name;
      return item;
    }),
  );
}

async function initialize() {
  try {
    const [partyResponse, palResponse] = await Promise.all([
      fetch(PARTY_DATA_URL),
      fetch(PAL_DATA_URL),
    ]);

    if (!partyResponse.ok || !palResponse.ok) {
      throw new Error("Party guide data could not be loaded.");
    }

    partyData = await partyResponse.json();
    const palData = await palResponse.json();
    palSprite = palData.metadata.palSprite;
    palByName = new Map(palData.pals.map((pal) => [pal.name, pal]));

    renderFilters();
    renderGuides();
    renderDropBoosters();
    renderCondensationPriorities();

    updateStatus({
      state: "current",
      title: "Party recommendations are ready",
      message: `${partyData.metadata.guideCount} task-focused parties and ${partyData.dropBoosters.length} enemy drop boosters are available.`,
      meta: `Palworld ${partyData.metadata.gameVersion} · Reviewed ${formatDate(partyData.metadata.reviewedAt)}`,
    });
  } catch (error) {
    guidesGridElement.replaceChildren();
    const message = document.createElement("p");
    message.className = "empty-state-message";
    message.textContent =
      "Party guide data could not be loaded. Refresh the page to try again.";
    guidesGridElement.append(message);

    updateStatus({
      state: "error",
      title: "Party guide data is unavailable",
      message: error.message,
    });
  }
}

initialize();
