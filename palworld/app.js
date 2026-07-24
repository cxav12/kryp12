const DATA_URL = "./data/passive-skills.json";

const statusPanel = document.querySelector("#data-status");
const statusTitle = document.querySelector("#data-status-title");
const statusMessage = document.querySelector("#data-status-message");
const statusMeta = document.querySelector("#data-status-meta");
const skillsGrid = document.querySelector("#passive-skills-grid");
const skillsCount = document.querySelector("#passive-skills-count");

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function showStatus({ state, title, message, meta = "" }) {
  statusPanel.dataset.state = state;
  statusTitle.textContent = title;
  statusMessage.textContent = message;
  statusMeta.textContent = meta;
  statusPanel.hidden = false;
}

function createBadge(text, className, attributes = {}) {
  const badge = document.createElement("span");
  badge.className = `skill-badge ${className}`;
  badge.textContent = text;

  Object.entries(attributes).forEach(([name, value]) => {
    badge.dataset[name] = value;
  });

  return badge;
}

function getTierLabel(rank) {
  const tierByRank = {
    5: "S-Tier",
    4: "A-Tier",
    3: "B-Tier",
    2: "C-Tier",
    1: "D-Tier",
    "-1": "F-Tier",
    "-2": "F−-Tier",
    "-3": "F−−-Tier",
  };

  return tierByRank[rank] ?? `Rank ${rank}`;
}

function createSkillCard(skill) {
  const column = document.createElement("div");
  column.className = "col-12 col-lg-6";

  const card = document.createElement("article");
  card.className = "passive-skill-card";

  const header = document.createElement("header");
  header.className = "passive-skill-header";

  const title = document.createElement("h2");
  title.className = "passive-skill-title";
  title.textContent = skill.name;

  const badges = document.createElement("div");
  badges.className = "skill-badges";

  skill.acquisition.forEach((method) => {
    badges.append(createBadge(`🧬 ${method}`, "surgery-badge"));
  });

  const rankBadge = createBadge(getTierLabel(skill.rank), "rank-badge", {
    rank: String(skill.rank),
    negative: String(skill.rank < 0),
  });
  rankBadge.title = `Palworld Rank ${skill.rank}`;
  rankBadge.setAttribute(
    "aria-label",
    `${getTierLabel(skill.rank)}, Palworld Rank ${skill.rank}`,
  );
  badges.append(rankBadge);

  header.append(title, badges);

  const effects = document.createElement("ul");
  effects.className = "skill-effects";

  skill.effects.forEach((effect) => {
    const item = document.createElement("li");
    item.textContent = effect;
    effects.append(item);
  });

  card.append(header, effects);
  column.append(card);

  return column;
}

function renderPassiveSkills(skills) {
  const fragment = document.createDocumentFragment();

  skills.forEach((skill) => {
    fragment.append(createSkillCard(skill));
  });

  skillsGrid.replaceChildren(fragment);
  skillsGrid.setAttribute("aria-busy", "false");
  skillsCount.textContent = `${skills.length} skills`;
}

async function loadPassiveSkills() {
  try {
    const response = await fetch(DATA_URL);

    if (!response.ok) {
      throw new Error(`Data request failed with status ${response.status}`);
    }

    const data = await response.json();
    const metadata = data.metadata;
    const updateRequired = metadata.updateStatus === "update-required";

    showStatus({
      state: updateRequired ? "update" : "current",
      title: updateRequired
        ? "Palworld data update needed"
        : "Palworld data is current",
      message: updateRequired
        ? metadata.updateMessage
        : `This dataset is verified for Palworld ${metadata.gameVersion}.`,
      meta: `Last checked ${formatDate(metadata.lastChecked)}`,
    });

    renderPassiveSkills(data.passiveSkills);
  } catch (error) {
    console.error("Unable to load Palworld passive skills.", error);
    showStatus({
      state: "error",
      title: "Data status unavailable",
      message:
        "The local Palworld dataset could not be loaded. Check the data file before publishing.",
    });

    skillsGrid.innerHTML =
      '<p class="skills-error">Passive skills could not be loaded.</p>';
    skillsGrid.setAttribute("aria-busy", "false");
  }
}

loadPassiveSkills();
