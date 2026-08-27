(function initBasePlanner() {
const DATA_URL = "../data/pal-cards.json?v=20260725-clean1";
const { applySpriteStyle, stylePalName, stylePalPortraitRing } = window.PalworldUI;

const jobsContainer = document.querySelector("#planner-jobs");
const teamContainer = document.querySelector("#planner-team");
const summary = document.querySelector("#planner-summary");
const teamSizeInput = document.querySelector("#team-size");
const resetButton = document.querySelector("#planner-reset");
const initialParams = new URLSearchParams(window.location.search);
const initialJobs = new Map(
  (initialParams.get("jobs") || "")
    .split(",")
    .map((entry) => entry.split(":"))
    .filter(([name, count]) => name && Number.parseInt(count, 10) > 0)
    .map(([name, count]) => [name, Number.parseInt(count, 10)]),
);

const requestedTeamSize = initialParams.get("size");
if (Number.parseInt(requestedTeamSize, 10) > 0) {
  teamSizeInput.value = requestedTeamSize;
}
let allPals = [];
let palSprite = null;
const requirements = new Map();

function resolveAssetUrl(url) {
  return url?.startsWith("./") ? `../${url.slice(2)}` : url;
}

function createJobControl(name, icon) {
  const control = document.createElement("div");
  control.className = "planner-job";

  if (icon) {
    const image = document.createElement("img");
    image.src = resolveAssetUrl(icon);
    image.alt = "";
    control.append(image);
  }

  const label = document.createElement("strong");
  label.textContent = name;
  const stepper = document.createElement("div");
  stepper.className = "planner-stepper";

  const decrease = document.createElement("button");
  decrease.type = "button";
  decrease.textContent = "−";
  decrease.setAttribute("aria-label", `Decrease ${name} workers`);

  const value = document.createElement("span");
  const initialValue = requirements.get(name) || 0;
  value.textContent = initialValue;
  value.setAttribute("aria-live", "polite");

  const increase = document.createElement("button");
  increase.type = "button";
  increase.textContent = "+";
  increase.setAttribute("aria-label", `Increase ${name} workers`);

  const update = (change) => {
    const nextValue = Math.max(
      0,
      Math.min(5, (requirements.get(name) || 0) + change),
    );
    requirements.set(name, nextValue);
    value.textContent = nextValue;
    control.classList.toggle("active", nextValue > 0);
    renderPlan();
  };

  decrease.addEventListener("click", () => update(-1));
  increase.addEventListener("click", () => update(1));
  stepper.append(decrease, value, increase);
  control.append(label, stepper);
  control.dataset.job = name;
  control.classList.toggle("active", initialValue > 0);
  return control;
}

function renderJobControls() {
  const workTypes = new Map();
  allPals.forEach((pal) => {
    pal.workSuitability.forEach((work) => {
      workTypes.set(work.name, work.icon);
      requirements.set(work.name, initialJobs.get(work.name) || 0);
    });
  });

  const fragment = document.createDocumentFragment();
  [...workTypes.entries()]
    .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
    .forEach(([name, icon]) => {
      fragment.append(createJobControl(name, icon));
    });
  jobsContainer.replaceChildren(fragment);
}

function getCandidateScore(pal, remainingJobs) {
  return pal.workSuitability.reduce((score, work) => {
    const demand = remainingJobs.get(work.name) || 0;
    return demand > 0
      ? score + work.level ** 2 * 100 + pal.craftSpeed / 10
      : score;
  }, 0);
}

function buildTeam(candidates, teamSize) {
  const remainingJobs = new Map(
    [...requirements].filter(([, count]) => count > 0),
  );
  const available = [...candidates];
  const selected = [];

  while (
    selected.length < teamSize &&
    available.length &&
    [...remainingJobs.values()].some((count) => count > 0)
  ) {
    available.sort(
      (palA, palB) =>
        getCandidateScore(palB, remainingJobs) -
          getCandidateScore(palA, remainingJobs) ||
        palB.craftSpeed - palA.craftSpeed ||
        palA.name.localeCompare(palB.name),
    );
    const pal = available.shift();

    if (getCandidateScore(pal, remainingJobs) === 0) {
      break;
    }

    selected.push(pal);
    pal.workSuitability.forEach((work) => {
      const demand = remainingJobs.get(work.name) || 0;
      if (demand > 0) {
        remainingJobs.set(work.name, demand - 1);
      }
    });
  }

  return { selected, remainingJobs };
}

function createTeamCard(pal) {
  const card = document.createElement("article");
  card.className = "planner-pal";

  const portrait = document.createElement("div");
  portrait.className = "planner-pal-portrait";
  stylePalPortraitRing(portrait, pal);
  if (palSprite && pal.sprite) {
    const sprite = document.createElement("span");
    sprite.className = "planner-pal-sprite";
    applySpriteStyle(
      sprite,
      palSprite,
      pal.sprite,
      resolveAssetUrl(palSprite.image),
    );
    sprite.setAttribute("role", "img");
    sprite.setAttribute("aria-label", pal.name);
    portrait.append(sprite);
  }

  const content = document.createElement("div");
  const title = document.createElement("h3");
  title.textContent = pal.name;
  stylePalName(title, pal);
  const jobs = document.createElement("div");
  jobs.className = "planner-pal-jobs";
  pal.workSuitability
    .filter((work) => (requirements.get(work.name) || 0) > 0)
    .sort((workA, workB) => workB.level - workA.level)
    .forEach((work) => {
      const badge = document.createElement("span");
      badge.textContent = `${work.name} ${work.level}`;
      jobs.append(badge);
    });
  content.append(title, jobs);
  card.append(portrait, content);
  return card;
}

function renderPlan() {
  const teamSize = Math.max(1, Number.parseInt(teamSizeInput.value, 10) || 1);

  const activeJobs = [...requirements].filter(([, count]) => count > 0);
  PalworldUI.updateUrlParams({
    jobs: activeJobs.length
      ? activeJobs.map(([name, count]) => `${name}:${count}`).join(",")
      : null,
    size: teamSize === 10 ? null : teamSize,
  });

  if (!activeJobs.length) {
    summary.textContent = "Choose at least one job to build a team.";
    teamContainer.replaceChildren();
    return;
  }

  const { selected, remainingJobs } = buildTeam(allPals, teamSize);
  const unmet = [...remainingJobs]
    .filter(([, count]) => count > 0)
    .map(([name, count]) => `${name} ×${count}`);
  summary.textContent = unmet.length
    ? `${selected.length} recommended Pals. Still needed: ${unmet.join(", ")}.`
    : `${selected.length} Pals cover every selected job requirement.`;

  const fragment = document.createDocumentFragment();
  selected.forEach((pal) => fragment.append(createTeamCard(pal)));
  teamContainer.replaceChildren(fragment);
}

teamSizeInput.addEventListener("change", renderPlan);
resetButton.addEventListener("click", () => {
  requirements.forEach((_, name) => requirements.set(name, 0));
  jobsContainer.querySelectorAll(".planner-job").forEach((control) => {
    control.classList.remove("active");
    control.querySelector(".planner-stepper span").textContent = "0";
  });
  renderPlan();
});

async function loadPlanner() {
  const response = await fetch(DATA_URL);
  if (!response.ok) {
    summary.textContent = "Planner data could not be loaded.";
    return;
  }

  const data = await response.json();
  allPals = data.pals;
  palSprite = data.metadata.palSprite;
  renderJobControls();
}

loadPlanner().catch(() => {
  summary.textContent = "Planner data could not be loaded.";
});
})();
