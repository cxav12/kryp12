const BREEDING_DATA_URL = "../data/breeding.json?v=20260725a";
const PAL_DATA_URL = "../data/pals.json?v=20260725sprite2";
const INITIAL_RESULT_LIMIT = 60;

const modes = document.querySelector("#breeding-modes");
const parentsControls = document.querySelector("#parents-controls");
const childControls = document.querySelector("#child-controls");
const parentAInput = document.querySelector("#parent-a-input");
const parentBInput = document.querySelector("#parent-b-input");
const childInput = document.querySelector("#child-input");
const sTierPals = document.querySelector("#s-tier-pals");
const aTierPals = document.querySelector("#a-tier-pals");
const quickSelectToggle = document.querySelector("#quick-select-toggle");
const quickSelectContent = document.querySelector("#quick-select-content");
const results = document.querySelector("#breeding-results");
const status = document.querySelector("#breeding-data-status");

let currentMode = "child";
let breedingData = null;
let palSprite = null;
let palByName = new Map();
let orderedPalNames = [];
let breedingNameByLowercase = new Map();
let pairResults = new Map();
let childResults = new Map();
let visibleResultLimit = INITIAL_RESULT_LIMIT;
const autocompleteMenus = new Map();

function pairKey(firstIndex, secondIndex) {
  return firstIndex < secondIndex
    ? `${firstIndex}:${secondIndex}`
    : `${secondIndex}:${firstIndex}`;
}

function formatPalNumber(dexKey) {
  const match = String(dexKey).match(/^(\d+)(.*)$/);

  if (!match) {
    return String(dexKey);
  }

  return `${match[1].padStart(3, "0")}${match[2]}`;
}

function getSelectedName(input, optional = false) {
  const value = input.value.trim();

  if (!value && optional) {
    input.setCustomValidity("");
    return null;
  }

  const name = breedingNameByLowercase.get(value.toLowerCase());
  input.setCustomValidity(name || !value ? "" : "Choose a Pal from the list.");
  return name || null;
}

function closeAutocomplete(input) {
  const menu = autocompleteMenus.get(input);

  if (menu) {
    menu.hidden = true;
  }
}

function updateAutocomplete(input) {
  const menu = autocompleteMenus.get(input);
  const searchTerm = input.value.trim().toLowerCase();

  if (!menu || !breedingData) {
    closeAutocomplete(input);
    return;
  }

  autocompleteMenus.forEach((otherMenu, otherInput) => {
    if (otherInput !== input) {
      otherMenu.hidden = true;
    }
  });

  const matches = orderedPalNames
    .filter(
      (name) =>
        !searchTerm || name.toLowerCase().includes(searchTerm),
    )
    .sort((nameA, nameB) => {
      if (!searchTerm) {
        return 0;
      }

      const startsA = nameA.toLowerCase().startsWith(searchTerm);
      const startsB = nameB.toLowerCase().startsWith(searchTerm);

      if (startsA !== startsB) {
        return startsA ? -1 : 1;
      }

      return nameA.localeCompare(nameB);
    });

  const fragment = document.createDocumentFragment();

  matches.forEach((name) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "breeding-autocomplete-option";
    const pal = palByName.get(name);
    button.append(createPortrait(pal, name));

    const optionName = document.createElement("strong");
    optionName.textContent = name;
    button.append(optionName);

    if (pal?.dexKey) {
      const optionNumber = document.createElement("span");
      optionNumber.textContent = `#${formatPalNumber(pal.dexKey)}`;
      button.append(optionNumber);
    }
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    button.addEventListener("click", () => {
      input.value = name;
      input.setCustomValidity("");
      closeAutocomplete(input);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    fragment.append(button);
  });

  if (matches.length === 0) {
    const message = document.createElement("p");
    message.className = "breeding-autocomplete-empty";
    message.textContent = "No matching Pals";
    fragment.append(message);
  }

  menu.replaceChildren(fragment);
  menu.hidden = false;
}

function setupAutocomplete(input) {
  const menu = document.createElement("div");
  menu.className = "breeding-autocomplete";
  menu.hidden = true;
  input.parentElement.append(menu);
  autocompleteMenus.set(input, menu);

  input.addEventListener("input", () => updateAutocomplete(input));
  input.addEventListener("focus", () => updateAutocomplete(input));
  input.addEventListener("blur", () => {
    window.setTimeout(() => closeAutocomplete(input), 100);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAutocomplete(input);
    }
  });
}

function createPortrait(pal, name) {
  const frame = document.createElement("div");
  frame.className = "breeding-pal-portrait";

  if (!pal || !palSprite || !pal.sprite) {
    frame.textContent = name.slice(0, 1);
    return frame;
  }

  const portrait = document.createElement("span");
  const column = pal.sprite.x / palSprite.cellSize;
  const row = pal.sprite.y / palSprite.cellSize;
  const horizontalPosition =
    (column / (palSprite.columns - 1)) * 100;
  const verticalPosition = (row / (palSprite.rows - 1)) * 100;

  portrait.className = "breeding-pal-sprite";
  portrait.style.backgroundImage =
    `url("../${palSprite.image.slice(2)}")`;
  portrait.style.backgroundSize =
    `${palSprite.columns * 100}% ${palSprite.rows * 100}%`;
  portrait.style.backgroundPosition =
    `${horizontalPosition}% ${verticalPosition}%`;
  portrait.setAttribute("role", "img");
  portrait.setAttribute("aria-label", name);
  frame.append(portrait);
  return frame;
}

function createPalChip(name, gender = 0, emphasis = false) {
  const pal = palByName.get(name);
  const chip = document.createElement("div");
  chip.className = emphasis
    ? "breeding-pal-chip breeding-pal-child"
    : "breeding-pal-chip";
  chip.append(createPortrait(pal, name));

  const identity = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = name;
  identity.append(title);

  if (pal?.dexKey) {
    const number = document.createElement("span");
    number.textContent = `#${formatPalNumber(pal.dexKey)}`;
    identity.append(number);
  }

  if (gender) {
    const genderLabel = document.createElement("small");
    genderLabel.textContent = gender === 1 ? "Male required" : "Female required";
    identity.append(genderLabel);
  }

  chip.append(identity);
  return chip;
}

function renderQuickPickTier(container, pals, tierClass = "") {
  const fragment = document.createDocumentFragment();

  pals.forEach((pal) => {
    const button = document.createElement("button");
    button.className = `s-tier-pal ${tierClass}`.trim();
    button.type = "button";
    button.title = `Find parents for ${pal.name}`;
    button.append(createPortrait(pal, pal.name));

    const name = document.createElement("span");
    name.textContent = pal.name;
    button.append(name);
    button.addEventListener("click", () => {
      childInput.value = pal.name;
      childInput.setCustomValidity("");
      closeAutocomplete(childInput);
      renderCurrentMode();
    });
    fragment.append(button);
  });

  container.replaceChildren(fragment);
}

function renderQuickPickPals() {
  const eligiblePals = [...palByName.values()]
    .filter((pal) =>
      breedingNameByLowercase.has(pal.name.toLowerCase()),
    )
    .sort(
      (palA, palB) =>
        Number.parseInt(palA.dexKey, 10) -
        Number.parseInt(palB.dexKey, 10),
    );

  renderQuickPickTier(
    sTierPals,
    eligiblePals.filter((pal) => pal.rarity >= 11),
  );
  renderQuickPickTier(
    aTierPals,
    eligiblePals.filter((pal) => pal.rarity >= 8 && pal.rarity <= 10),
    "a-tier-pal",
  );
}

function showEmpty(message, symbol = "◎") {
  const empty = document.createElement("div");
  empty.className = "breeding-empty";
  const icon = document.createElement("span");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = symbol;
  const text = document.createElement("p");
  text.textContent = message;
  empty.append(icon, text);
  results.replaceChildren(empty);
  results.setAttribute("aria-busy", "false");
}

function createCombinationRow(combination, showChild = false) {
  const [parentA, parentB, child, genderA, genderB] = combination;
  const row = document.createElement("article");
  row.className = showChild
    ? "breeding-combination with-child"
    : "breeding-combination parent-pair";
  row.append(
    createPalChip(breedingData.pals[parentA], genderA),
  );

  const plus = document.createElement("span");
  plus.className = "breeding-operator breeding-plus";
  plus.textContent = "+";
  row.append(plus, createPalChip(breedingData.pals[parentB], genderB));

  if (showChild) {
    const arrow = document.createElement("span");
    arrow.className = "breeding-operator breeding-arrow";
    arrow.textContent = "→";
    row.append(
      arrow,
      createPalChip(breedingData.pals[child], 0, true),
    );
  }

  return row;
}

function renderParentResult() {
  const parentAName = getSelectedName(parentAInput);
  const parentBName = getSelectedName(parentBInput);

  if (!parentAName || !parentBName) {
    showEmpty("Pick two parent Pals to see the child they produce.");
    return;
  }

  const parentA = breedingData.pals.indexOf(parentAName);
  const parentB = breedingData.pals.indexOf(parentBName);
  const matches = pairResults.get(pairKey(parentA, parentB)) || [];

  if (matches.length === 0) {
    showEmpty("No breeding result is available for this parent pair.", "×");
    return;
  }

  const uniqueChildren = [
    ...new Map(matches.map((combination) => [
      combination[2],
      combination,
    ])).values(),
  ];
  const wrapper = document.createElement("div");
  wrapper.className = "breeding-result-list child-result-list";
  const heading = document.createElement("h1");
  heading.textContent =
    uniqueChildren.length === 1 ? "Expected child" : "Possible children";
  wrapper.append(heading);
  uniqueChildren.forEach((combination) => {
    const child = createPalChip(
      breedingData.pals[combination[2]],
      0,
      true,
    );
    child.classList.add("breeding-child-only");
    wrapper.append(child);
  });
  results.replaceChildren(wrapper);
}

function renderChildResults() {
  const childName = getSelectedName(childInput);

  if (!childName) {
    showEmpty("Pick a target Pal to see every parent pair that produces it.");
    return;
  }

  const child = breedingData.pals.indexOf(childName);
  const matches = childResults.get(child) || [];

  if (matches.length === 0) {
    showEmpty(`No parent combinations are available for ${childName}.`, "×");
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "breeding-result-list";
  const heading = document.createElement("div");
  heading.className = "breeding-results-heading";
  const title = document.createElement("h1");
  title.textContent = `Parents for ${childName}`;
  const count = document.createElement("span");
  count.textContent = `${matches.length.toLocaleString()} combinations`;
  heading.append(title, count);
  wrapper.append(heading);

  matches.slice(0, visibleResultLimit).forEach((combination) =>
    wrapper.append(createCombinationRow(combination)),
  );

  if (visibleResultLimit < matches.length) {
    const showMore = document.createElement("button");
    showMore.className = "tier-filter breeding-show-more";
    showMore.type = "button";
    showMore.textContent =
      `Show more (${(matches.length - visibleResultLimit).toLocaleString()} remaining)`;
    showMore.addEventListener("click", () => {
      visibleResultLimit += INITIAL_RESULT_LIMIT;
      renderChildResults();
    });
    wrapper.append(showMore);
  }

  results.replaceChildren(wrapper);
}

function renderCurrentMode() {
  visibleResultLimit = INITIAL_RESULT_LIMIT;

  if (currentMode === "parents") {
    renderParentResult();
  } else {
    renderChildResults();
  }
}

function buildIndexes() {
  breedingData.pals.forEach((name) => {
    breedingNameByLowercase.set(name.toLowerCase(), name);
  });

  breedingData.combinations.forEach((combination) => {
    const [parentA, parentB, child] = combination;
    const key = pairKey(parentA, parentB);

    if (!pairResults.has(key)) {
      pairResults.set(key, []);
    }
    pairResults.get(key).push(combination);

    if (!childResults.has(child)) {
      childResults.set(child, []);
    }
    childResults.get(child).push(combination);
  });
}

modes.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mode]");

  if (!button) {
    return;
  }

  currentMode = button.dataset.mode;
  modes.querySelectorAll("[data-mode]").forEach((modeButton) => {
    const active = modeButton === button;
    modeButton.classList.toggle("active", active);
    modeButton.setAttribute("aria-pressed", String(active));
  });
  parentsControls.hidden = currentMode !== "parents";
  childControls.hidden = currentMode !== "child";
  renderCurrentMode();
});

[parentAInput, parentBInput].forEach((input) => {
  input.addEventListener("input", renderParentResult);
  input.addEventListener("change", renderParentResult);
});

childInput.addEventListener("input", renderCurrentMode);
childInput.addEventListener("change", renderCurrentMode);

quickSelectToggle.addEventListener("click", () => {
  const opening = quickSelectContent.hidden;
  quickSelectContent.hidden = !opening;
  quickSelectToggle.textContent = opening
    ? "Hide Quick Select"
    : "Show Quick Select";
  quickSelectToggle.setAttribute("aria-expanded", String(opening));
});

async function loadBreedingCalculator() {
  try {
    const [breedingResponse, palResponse] = await Promise.all([
      fetch(BREEDING_DATA_URL),
      fetch(PAL_DATA_URL),
    ]);

    if (!breedingResponse.ok || !palResponse.ok) {
      throw new Error("A calculator data request failed.");
    }

    breedingData = await breedingResponse.json();
    const palData = await palResponse.json();
    palSprite = palData.metadata.palSprite;
    palByName = new Map(palData.pals.map((pal) => [pal.name, pal]));
    orderedPalNames = [...breedingData.pals].sort((nameA, nameB) => {
      const palA = palByName.get(nameA);
      const palB = palByName.get(nameB);
      const numberA = Number.parseInt(palA?.dexKey, 10);
      const numberB = Number.parseInt(palB?.dexKey, 10);

      if (Number.isNaN(numberA) && Number.isNaN(numberB)) {
        return nameA.localeCompare(nameB);
      }

      if (Number.isNaN(numberA)) {
        return 1;
      }

      if (Number.isNaN(numberB)) {
        return -1;
      }

      if (numberA !== numberB) {
        return numberA - numberB;
      }

      return String(palA.dexKey).localeCompare(String(palB.dexKey));
    });
    buildIndexes();
    renderQuickPickPals();

    [
      parentAInput,
      parentBInput,
      childInput,
    ].forEach(setupAutocomplete);

    status.innerHTML =
      `<div><strong>Breeding data is ready</strong>` +
      `<p class="mb-0">${breedingData.metadata.palCount} Pals and ` +
      `${breedingData.metadata.combinationCount.toLocaleString()} ` +
      `combinations are available.</p></div>` +
      `<div class="data-status-meta">Source data: ` +
      `${breedingData.metadata.sourceExportedAt}</div>`;
    status.hidden = false;
    renderCurrentMode();
  } catch (error) {
    console.error("Unable to load breeding data.", error);
    showEmpty("The local breeding dataset could not be loaded.", "×");
  }
}

loadBreedingCalculator();
