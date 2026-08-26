const BREEDING_DATA_URL = "../data/breeding.json?v=20260725-clean1";
const PAL_DATA_URL = "../data/pal-index.json?v=20260826-elements1";
const MUTATION_DATA_URL = "../data/mutations.json?v=20260826-mutations1";
const INITIAL_RESULT_LIMIT = 60;
const {
  applySpriteStyle,
  formatPalNumber,
  getPalPreferences,
  stylePalName,
  stylePalPortraitRing,
  updateUrlParams,
} = window.PalworldUI;

const modes = document.querySelector("#breeding-modes");
const modeDescriptions = document.querySelectorAll("[data-mode-description]");
const parentsControls = document.querySelector("#parents-controls");
const childControls = document.querySelector("#child-controls");
const singleControls = document.querySelector("#single-controls");
const mutationControls = document.querySelector("#mutation-controls");
const mutationParentControls = document.querySelector("#mutation-parent-controls");
const parentAInput = document.querySelector("#parent-a-input");
const parentBInput = document.querySelector("#parent-b-input");
const childInput = document.querySelector("#child-input");
const singlePalInput = document.querySelector("#single-pal-input");
const mutationParentAInput = document.querySelector("#mutation-parent-a-input");
const mutationParentBInput = document.querySelector("#mutation-parent-b-input");
const mutationCakeSelect = document.querySelector("#mutation-cake-select");
const mutationTargetInput = document.querySelector("#mutation-target-input");
const reverseMutationCakeSelect = document.querySelector("#reverse-mutation-cake-select");
const favoritePalsSection = document.querySelector("#favorite-pals-section");
const favoritePals = document.querySelector("#favorite-pals");
const results = document.querySelector("#breeding-results");
const status = document.querySelector("#breeding-data-status");

let currentMode = "child";
let breedingData = null;
let palSprite = null;
let mutationData = null;
let mutationEligiblePals = [];
let mutationParentPool = [];
let mutationOwnerByRank = [];
let palByName = new Map();
let orderedPalNames = [];
let breedingNameByLowercase = new Map();
let breedingIndexByName = new Map();
let pairResults = new Map();
let childResults = new Map();
let parentResults = new Map();
let visibleResultLimit = INITIAL_RESULT_LIMIT;
const autocompleteMenus = new Map();

function pairKey(firstIndex, secondIndex) {
  return firstIndex < secondIndex
    ? `${firstIndex}:${secondIndex}`
    : `${secondIndex}:${firstIndex}`;
}

function getSelectedName(input) {
  const value = input.value.trim();

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

function updateAutocomplete(input, showAll = false) {
  const menu = autocompleteMenus.get(input);
  const searchTerm = showAll ? "" : input.value.trim().toLowerCase();

  if (!menu || !breedingData) {
    closeAutocomplete(input);
    return;
  }

  autocompleteMenus.forEach((otherMenu, otherInput) => {
    if (otherInput !== input) {
      otherMenu.hidden = true;
    }
  });

  const availableNames = input === mutationTargetInput
    ? mutationData.eligiblePals
    : orderedPalNames;
  const matches = availableNames
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

    const optionIdentity = document.createElement("span");
    optionIdentity.className = "breeding-autocomplete-identity";
    const optionName = document.createElement("strong");
    optionName.textContent = name;
    stylePalName(optionName, pal);
    optionIdentity.append(optionName);

    if (pal?.dexKey) {
      const optionNumber = document.createElement("span");
      optionNumber.className = "pal-id";
      optionNumber.textContent = `#${formatPalNumber(pal.dexKey)}`;
      optionIdentity.append(optionNumber);
    }
    button.append(optionIdentity);
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    button.addEventListener("click", () => {
      input.value = name;
      input.setCustomValidity("");
      closeAutocomplete(input);
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.blur();
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
  const selectedDisplay = document.createElement("div");
  selectedDisplay.className = "breeding-selected-pal";
  selectedDisplay.setAttribute("aria-hidden", "true");
  selectedDisplay.hidden = true;

  const menu = document.createElement("div");
  menu.className = "breeding-autocomplete";
  menu.hidden = true;
  input.parentElement.append(selectedDisplay, menu);
  autocompleteMenus.set(input, menu);

  const updateSelectedDisplay = () => {
    const name = breedingNameByLowercase.get(input.value.trim().toLowerCase());
    const pal = name ? palByName.get(name) : null;
    selectedDisplay.hidden = !name;
    input.classList.toggle("has-selected-pal", Boolean(name));

    if (!name) {
      selectedDisplay.replaceChildren();
      return;
    }

    const identity = document.createElement("span");
    identity.className = "breeding-selected-identity";
    const selectedName = document.createElement("strong");
    selectedName.textContent = name;
    stylePalName(selectedName, pal);
    identity.append(selectedName);

    if (pal?.dexKey) {
      const selectedNumber = document.createElement("span");
      selectedNumber.className = "pal-id";
      selectedNumber.textContent = `#${formatPalNumber(pal.dexKey)}`;
      identity.append(selectedNumber);
    }

    selectedDisplay.replaceChildren(createPortrait(pal, name), identity);
  };

  input.addEventListener("input", () => {
    input.dataset.replaceOnType = "false";
    updateSelectedDisplay();
    updateAutocomplete(input);
  });
  input.addEventListener("change", updateSelectedDisplay);
  input.addEventListener("beforeinput", (event) => {
    if (
      input.dataset.replaceOnType === "true" &&
      (event.inputType.startsWith("insert") || event.inputType.startsWith("delete"))
    ) {
      input.value = "";
      input.dataset.replaceOnType = "false";
    }
  });
  input.addEventListener("focus", () => {
    const hasSelectedPal = Boolean(
      breedingNameByLowercase.get(input.value.trim().toLowerCase()),
    );

    if (hasSelectedPal) {
      input.dataset.replaceOnType = "true";
      input.setSelectionRange(input.value.length, input.value.length);
    }

    updateAutocomplete(input, hasSelectedPal);
  });
  input.addEventListener("blur", () => {
    input.dataset.replaceOnType = "false";
    window.setTimeout(() => closeAutocomplete(input), 100);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAutocomplete(input);
    }
  });
  input.updateSelectedDisplay = updateSelectedDisplay;
}

function createPortrait(pal, name) {
  const frame = document.createElement("div");
  frame.className = "breeding-pal-portrait";
  stylePalPortraitRing(frame, pal);

  if (!pal || !palSprite || !pal.sprite) {
    frame.textContent = name.slice(0, 1);
    return frame;
  }

  const portrait = document.createElement("span");

  portrait.className = "breeding-pal-sprite";
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

function createPalNameText(name) {
  const text = document.createElement("span");
  text.textContent = name;
  stylePalName(text, palByName.get(name));
  return text;
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
  stylePalName(title, pal);
  identity.append(title);

  if (pal?.dexKey) {
    const number = document.createElement("span");
    number.className = "pal-id";
    number.textContent = `#${formatPalNumber(pal.dexKey)}`;
    identity.append(number);
  }

  if (Number.isInteger(pal?.breedingPower)) {
    const power = document.createElement("span");
    power.className = "breeding-power-badge";
    power.textContent = `BP ${pal.breedingPower.toLocaleString()}`;
    power.title = "Breeding Power";
    identity.append(power);
  }

  if (gender) {
    const genderLabel = document.createElement("small");
    genderLabel.textContent = gender === 1 ? "Male required" : "Female required";
    identity.append(genderLabel);
  }

  chip.append(identity);
  return chip;
}

function renderFavoritePals() {
  const favorites = getPalPreferences().favorites
    .map((name) => palByName.get(name))
    .filter(
      (pal) =>
        pal && breedingNameByLowercase.has(pal.name.toLowerCase()),
    )
    .sort(
      (palA, palB) =>
        Number.parseInt(palA.dexKey, 10) -
          Number.parseInt(palB.dexKey, 10) ||
        palA.name.localeCompare(palB.name),
    );
  const fragment = document.createDocumentFragment();

  favorites.forEach((pal) => {
    const button = document.createElement("button");
    button.className = "favorite-pal";
    button.type = "button";
    button.title = `Find parents for ${pal.name}`;
    button.append(createPortrait(pal, pal.name));

    const name = document.createElement("span");
    name.textContent = pal.name;
    stylePalName(name, pal);
    button.append(name);
    button.addEventListener("click", () => {
      childInput.value = pal.name;
      childInput.setCustomValidity("");
      closeAutocomplete(childInput);
      renderCurrentMode();
    });
    fragment.append(button);
  });

  favoritePals.replaceChildren(fragment);
  favoritePalsSection.hidden = favorites.length === 0;
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

function createCombinationRow(combination) {
  const [parentA, parentB, , genderA, genderB] = combination;
  const row = document.createElement("article");
  row.className = "breeding-combination parent-pair";
  row.append(
    createPalChip(breedingData.pals[parentA], genderA),
  );

  const plus = document.createElement("span");
  plus.className = "breeding-operator breeding-plus";
  plus.textContent = "+";
  row.append(plus, createPalChip(breedingData.pals[parentB], genderB));

  return row;
}

function createOffspringRow(combination, selectedParent) {
  const [parentA, parentB, child, genderA, genderB] = combination;
  const selectedIsParentA = parentA === selectedParent;
  const partner = selectedIsParentA ? parentB : parentA;
  const selectedGender = selectedIsParentA ? genderA : genderB;
  const partnerGender = selectedIsParentA ? genderB : genderA;
  const row = document.createElement("article");
  row.className = "breeding-combination breeding-offspring-combination";

  const selectedChip = createPalChip(
    breedingData.pals[selectedParent],
    selectedGender,
  );
  selectedChip.classList.add("breeding-selected-parent");

  const plus = document.createElement("span");
  plus.className = "breeding-operator breeding-plus";
  plus.textContent = "+";

  const partnerChip = createPalChip(
    breedingData.pals[partner],
    partnerGender,
  );
  partnerChip.classList.add("breeding-partner");

  const produces = document.createElement("span");
  produces.className = "breeding-operator breeding-produces";
  produces.textContent = "→";
  produces.setAttribute("aria-label", "produces");

  const childChip = createPalChip(breedingData.pals[child], 0, true);
  childChip.classList.add("breeding-offspring-child");
  row.append(selectedChip, plus, partnerChip, produces, childChip);
  return row;
}

function renderParentResult() {
  const parentAName = getSelectedName(parentAInput);
  const parentBName = getSelectedName(parentBInput);

  if (!parentAName || !parentBName) {
    showEmpty("Pick two parent Pals to see the child they produce.");
    return;
  }

  const parentA = breedingIndexByName.get(parentAName);
  const parentB = breedingIndexByName.get(parentBName);
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
  results.setAttribute("aria-busy", "false");
}

function renderChildResults() {
  const childName = getSelectedName(childInput);

  if (!childName) {
    showEmpty("Pick a target Pal to see every parent pair that produces it.");
    return;
  }

  const child = breedingIndexByName.get(childName);
  const matches = childResults.get(child) || [];

  if (matches.length === 0) {
    showEmpty(
      `No parent combinations are available for ${childName}.`,
      "×",
    );
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "breeding-result-list";
  const heading = document.createElement("div");
  heading.className = "breeding-results-heading";
  const title = document.createElement("h1");
  title.append("Parents for ", createPalNameText(childName));
  const count = document.createElement("span");
  count.textContent =
    `${matches.length.toLocaleString()} combination${matches.length === 1 ? "" : "s"}`;
  heading.append(title, count);
  wrapper.append(heading);

  matches.slice(0, visibleResultLimit).forEach((combination) =>
    wrapper.append(createCombinationRow(combination)),
  );

  if (visibleResultLimit < matches.length) {
    const showMore = document.createElement("button");
    showMore.className = "filter-button breeding-show-more";
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
  results.setAttribute("aria-busy", "false");
}

function renderSinglePalResults() {
  const selectedName = getSelectedName(singlePalInput);

  if (!selectedName) {
    showEmpty(
      "Pick one Pal to see every partner and child it can produce.",
    );
    return;
  }

  const selectedParent = breedingIndexByName.get(selectedName);
  const matches = parentResults.get(selectedParent) || [];

  if (matches.length === 0) {
    showEmpty(
      `No breeding outcomes are available for ${selectedName}.`,
      "×",
    );
    return;
  }

  const uniqueChildren = new Set(
    matches.map((combination) => combination[2]),
  );
  const uniquePartners = new Set(
    matches.map((combination) =>
      combination[0] === selectedParent
        ? combination[1]
        : combination[0],
    ),
  );
  const wrapper = document.createElement("div");
  wrapper.className = "breeding-result-list";
  const heading = document.createElement("div");
  heading.className = "breeding-results-heading";
  const title = document.createElement("h1");
  title.append("Breeding outcomes for ", createPalNameText(selectedName));
  const count = document.createElement("span");
  count.textContent =
    `${uniqueChildren.size.toLocaleString()} possible ` +
    `child${uniqueChildren.size === 1 ? "" : "ren"} · ` +
    `${uniquePartners.size.toLocaleString()} ` +
    `partner${uniquePartners.size === 1 ? "" : "s"}`;
  heading.append(title, count);
  wrapper.append(heading);

  matches.slice(0, visibleResultLimit).forEach((combination) =>
    wrapper.append(createOffspringRow(combination, selectedParent)),
  );

  if (visibleResultLimit < matches.length) {
    const showMore = document.createElement("button");
    showMore.className = "filter-button breeding-show-more";
    showMore.type = "button";
    showMore.textContent =
      `Show more (${(matches.length - visibleResultLimit).toLocaleString()} remaining)`;
    showMore.addEventListener("click", () => {
      visibleResultLimit += INITIAL_RESULT_LIMIT;
      renderSinglePalResults();
    });
    wrapper.append(showMore);
  }

  results.replaceChildren(wrapper);
  results.setAttribute("aria-busy", "false");
}

function nearestMutationPal(rank) {
  return mutationEligiblePals.reduce((closest, pal) => {
    if (!closest) return pal;
    const distance = Math.abs(pal.breedingPower - rank);
    const closestDistance = Math.abs(closest.breedingPower - rank);
    return distance < closestDistance ? pal : closest;
  }, null);
}

function mutationRollRange(parentA, parentB) {
  const lowerPower = Math.min(parentA.breedingPower, parentB.breedingPower);
  const powerDifference = Math.abs(parentA.breedingPower - parentB.breedingPower);
  const rollCount = Math.max(1, Math.floor(lowerPower * 0.1 + 0.5));
  const firstRank =
    Math.floor(lowerPower * 0.5 + 0.5) +
    Math.floor(powerDifference * 0.4 + 0.5) +
    1;

  return { firstRank, rollCount, lastRank: firstRank + rollCount - 1 };
}

function mutationOutcomes(parentA, parentB) {
  const { firstRank, rollCount } = mutationRollRange(parentA, parentB);
  const outcomeCounts = new Map();

  for (let offset = 0; offset < rollCount; offset += 1) {
    const pal = nearestMutationPal(firstRank + offset);
    if (pal) outcomeCounts.set(pal.name, (outcomeCounts.get(pal.name) || 0) + 1);
  }

  return [...outcomeCounts].map(([name, rolls]) => ({
    name,
    rolls,
    probability: rolls / rollCount,
  })).sort(
    (first, second) =>
      second.rolls - first.rolls || first.name.localeCompare(second.name),
  );
}

function formatMutationChance(value) {
  return `${Number((value * 100).toFixed(2))}%`;
}

function renderMutationResults() {
  const parentAName = getSelectedName(mutationParentAInput);
  const parentBName = getSelectedName(mutationParentBInput);

  if (!parentAName || !parentBName) {
    showEmpty("Pick two parent Pals to calculate possible mutated egg outcomes.", "✦");
    return;
  }

  const parentA = palByName.get(parentAName);
  const parentB = palByName.get(parentBName);
  if (!Number.isFinite(parentA?.breedingPower) || !Number.isFinite(parentB?.breedingPower)) {
    showEmpty("Mutation data is unavailable for this parent pair.", "×");
    return;
  }

  const cakeKey = mutationCakeSelect.value === "extravagant"
    ? "extravagantCakeChance"
    : "normalCakeChance";
  const mutationChance = Number(mutationData.metadata[cakeKey]);
  const outcomes = mutationOutcomes(parentA, parentB);
  const wrapper = document.createElement("div");
  wrapper.className = "breeding-result-list mutation-result-list";

  const heading = document.createElement("div");
  heading.className = "breeding-results-heading";
  const title = document.createElement("h1");
  title.append(
    "Mutation outcomes for ",
    createPalNameText(parentAName),
    " + ",
    createPalNameText(parentBName),
  );
  const count = document.createElement("span");
  count.textContent =
    `${outcomes.length} possible · ${formatMutationChance(mutationChance)} mutation chance`;
  heading.append(title, count);
  wrapper.append(heading);

  const normalMatches = pairResults.get(pairKey(
    breedingIndexByName.get(parentAName),
    breedingIndexByName.get(parentBName),
  )) || [];
  const normalChildren = [...new Set(normalMatches.map((match) => breedingData.pals[match[2]]))];
  if (normalChildren.length) {
    const normal = document.createElement("section");
    normal.className = "mutation-normal-result";
    const label = document.createElement("strong");
    label.textContent = "Normal child";
    normal.append(label, ...normalChildren.map((name) => createPalChip(name, 0, true)));
    wrapper.append(normal);
  }

  const note = document.createElement("p");
  note.className = "mutation-note";
  note.textContent =
    "Percentages on each card show the outcome split after a mutation occurs, followed by the overall chance per egg. Mutated offspring are Alpha Pals with mutation bonuses.";
  wrapper.append(note);

  const grid = document.createElement("div");
  grid.className = "mutation-outcome-grid";
  outcomes.forEach((outcome) => {
    const card = document.createElement("article");
    card.className = "mutation-outcome-card";
    card.append(createPalChip(outcome.name, 0, true));
    const probability = document.createElement("p");
    probability.innerHTML =
      `<strong>${formatMutationChance(outcome.probability)}</strong> if mutated` +
      ` · ${formatMutationChance(outcome.probability * mutationChance)} per egg`;
    card.append(probability);
    grid.append(card);
  });
  wrapper.append(grid);
  results.replaceChildren(wrapper);
  results.setAttribute("aria-busy", "false");
}

function reverseMutationPairs(targetName) {
  const prefix = new Uint32Array(mutationOwnerByRank.length);
  for (let rank = 1; rank < mutationOwnerByRank.length; rank += 1) {
    prefix[rank] = prefix[rank - 1] +
      (mutationOwnerByRank[rank] === targetName ? 1 : 0);
  }

  const pairs = [];
  const maximumRank = mutationOwnerByRank.length - 1;
  for (let first = 0; first < mutationParentPool.length; first += 1) {
    for (let second = first; second < mutationParentPool.length; second += 1) {
      const parentA = mutationParentPool[first];
      const parentB = mutationParentPool[second];
      const range = mutationRollRange(parentA, parentB);
      const start = Math.max(1, range.firstRank);
      const end = Math.min(maximumRank, range.lastRank);
      if (start > end) continue;
      const matchingRolls = prefix[end] - prefix[start - 1];
      if (!matchingRolls) continue;
      pairs.push({
        parentA,
        parentB,
        matchingRolls,
        rollCount: range.rollCount,
        probability: matchingRolls / range.rollCount,
      });
    }
  }

  return pairs.sort(
    (first, second) =>
      second.probability - first.probability ||
      first.parentA.name.localeCompare(second.parentA.name) ||
      first.parentB.name.localeCompare(second.parentB.name),
  );
}

function createReverseMutationPair(pair, mutationChance) {
  const row = document.createElement("article");
  row.className = "reverse-mutation-pair";
  row.append(createPalChip(pair.parentA.name));
  const plus = document.createElement("span");
  plus.className = "breeding-operator breeding-plus";
  plus.textContent = "+";
  row.append(plus, createPalChip(pair.parentB.name));
  const probability = document.createElement("p");
  const conditional = document.createElement("strong");
  conditional.textContent = formatMutationChance(pair.probability);
  probability.append(
    conditional,
    " if mutated · ",
    `${formatMutationChance(pair.probability * mutationChance)} per egg`,
  );
  row.append(probability);
  return row;
}

function renderReverseMutationResults() {
  const targetName = getSelectedName(mutationTargetInput);
  if (!targetName) {
    showEmpty("Choose a mutated Pal to find every parent pair that can produce it.", "✦");
    return;
  }
  if (!mutationData.eligiblePals.includes(targetName)) {
    showEmpty(`${targetName} is not in the current mutation outcome pool.`, "×");
    return;
  }

  const cakeKey = reverseMutationCakeSelect.value === "extravagant"
    ? "extravagantCakeChance"
    : "normalCakeChance";
  const mutationChance = Number(mutationData.metadata[cakeKey]);
  const pairs = reverseMutationPairs(targetName);
  const wrapper = document.createElement("div");
  wrapper.className = "breeding-result-list reverse-mutation-results";
  const heading = document.createElement("div");
  heading.className = "breeding-results-heading";
  const title = document.createElement("h1");
  title.append("Mutation parents for ", createPalNameText(targetName));
  const count = document.createElement("span");
  count.textContent =
    `${pairs.length.toLocaleString()} combination${pairs.length === 1 ? "" : "s"} · ` +
    `${formatMutationChance(mutationChance)} mutation chance`;
  heading.append(title, count);
  wrapper.append(heading);

  const note = document.createElement("p");
  note.className = "mutation-note";
  note.textContent =
    "Pairs are ranked by the chance that this Pal is selected after a mutation occurs. The second percentage is the overall chance per egg with the selected cake.";
  wrapper.append(note);

  pairs.slice(0, visibleResultLimit).forEach((pair) =>
    wrapper.append(createReverseMutationPair(pair, mutationChance)),
  );
  if (visibleResultLimit < pairs.length) {
    const showMore = document.createElement("button");
    showMore.className = "filter-button breeding-show-more";
    showMore.type = "button";
    showMore.textContent =
      `Show more (${(pairs.length - visibleResultLimit).toLocaleString()} remaining)`;
    showMore.addEventListener("click", () => {
      visibleResultLimit += INITIAL_RESULT_LIMIT;
      renderReverseMutationResults();
    });
    wrapper.append(showMore);
  }
  results.replaceChildren(wrapper);
  results.setAttribute("aria-busy", "false");
}

function renderCurrentMode() {
  visibleResultLimit = INITIAL_RESULT_LIMIT;

  if (currentMode === "parents") {
    renderParentResult();
  } else if (currentMode === "single") {
    renderSinglePalResults();
  } else if (currentMode === "mutations") {
    renderMutationResults();
  } else if (currentMode === "mutation-parents") {
    renderReverseMutationResults();
  } else {
    renderChildResults();
  }

  updateUrlParams({
    mode: currentMode === "child" ? null : currentMode,
    target:
      currentMode === "child" ? getSelectedName(childInput) : null,
    parentA:
      currentMode === "parents" ? getSelectedName(parentAInput) : null,
    parentB:
      currentMode === "parents" ? getSelectedName(parentBInput) : null,
    pal:
      currentMode === "single" ? getSelectedName(singlePalInput) : null,
    mutationA:
      currentMode === "mutations" ? getSelectedName(mutationParentAInput) : null,
    mutationB:
      currentMode === "mutations" ? getSelectedName(mutationParentBInput) : null,
    cake:
      currentMode === "mutations" && mutationCakeSelect.value === "extravagant"
        ? "extravagant"
        : null,
    mutant:
      currentMode === "mutation-parents" ? getSelectedName(mutationTargetInput) : null,
    reverseCake:
      currentMode === "mutation-parents" && reverseMutationCakeSelect.value === "extravagant"
        ? "extravagant"
        : null,
  });
}

function updateModeDescription() {
  modeDescriptions.forEach((description) => {
    description.hidden = description.dataset.modeDescription !== currentMode;
  });
}

function restoreBreedingFromUrl() {
  const params = new URLSearchParams(window.location.search);
  currentMode = ["parents", "single", "mutations", "mutation-parents"].includes(params.get("mode"))
    ? params.get("mode")
    : "child";
  childInput.value =
    breedingNameByLowercase.get(
      (params.get("target") || "").toLowerCase(),
    ) || "";
  parentAInput.value =
    breedingNameByLowercase.get(
      (params.get("parentA") || "").toLowerCase(),
    ) || "";
  parentBInput.value =
    breedingNameByLowercase.get(
      (params.get("parentB") || "").toLowerCase(),
    ) || "";
  singlePalInput.value =
    breedingNameByLowercase.get(
      (params.get("pal") || "").toLowerCase(),
    ) || "";
  mutationParentAInput.value =
    breedingNameByLowercase.get(
      (params.get("mutationA") || "").toLowerCase(),
    ) || "";
  mutationParentBInput.value =
    breedingNameByLowercase.get(
      (params.get("mutationB") || "").toLowerCase(),
    ) || "";
  mutationCakeSelect.value = params.get("cake") === "extravagant"
    ? "extravagant"
    : "normal";
  mutationTargetInput.value =
    breedingNameByLowercase.get(
      (params.get("mutant") || "").toLowerCase(),
    ) || "";
  reverseMutationCakeSelect.value = params.get("reverseCake") === "extravagant"
    ? "extravagant"
    : "normal";
  modes.querySelectorAll("[data-mode]").forEach((button) => {
    const active = button.dataset.mode === currentMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  updateModeDescription();
  parentsControls.hidden = currentMode !== "parents";
  childControls.hidden = currentMode !== "child";
  singleControls.hidden = currentMode !== "single";
  mutationControls.hidden = currentMode !== "mutations";
  mutationParentControls.hidden = currentMode !== "mutation-parents";
  renderCurrentMode();
}

function buildIndexes() {
  breedingData.pals.forEach((name, index) => {
    breedingNameByLowercase.set(name.toLowerCase(), name);
    breedingIndexByName.set(name, index);
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

    [parentA, parentB].forEach((parent) => {
      if (!parentResults.has(parent)) {
        parentResults.set(parent, []);
      }

      if (
        parentA !== parentB ||
        !parentResults.get(parent).includes(combination)
      ) {
        parentResults.get(parent).push(combination);
      }
    });
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
  updateModeDescription();
  parentsControls.hidden = currentMode !== "parents";
  childControls.hidden = currentMode !== "child";
  singleControls.hidden = currentMode !== "single";
  mutationControls.hidden = currentMode !== "mutations";
  mutationParentControls.hidden = currentMode !== "mutation-parents";
  renderCurrentMode();
});

[parentAInput, parentBInput].forEach((input) => {
  input.addEventListener("input", renderParentResult);
  input.addEventListener("change", renderParentResult);
});

childInput.addEventListener("input", renderCurrentMode);
childInput.addEventListener("change", renderCurrentMode);
singlePalInput.addEventListener("input", renderCurrentMode);
singlePalInput.addEventListener("change", renderCurrentMode);
[mutationParentAInput, mutationParentBInput].forEach((input) => {
  input.addEventListener("input", renderCurrentMode);
  input.addEventListener("change", renderCurrentMode);
});
mutationCakeSelect.addEventListener("change", renderCurrentMode);
mutationTargetInput.addEventListener("input", renderCurrentMode);
mutationTargetInput.addEventListener("change", renderCurrentMode);
reverseMutationCakeSelect.addEventListener("change", renderCurrentMode);
window.addEventListener("storage", (event) => {
  if (event.key === "palworld-pal-preferences-v1") {
    renderFavoritePals();
  }
});

async function loadBreedingCalculator() {
  try {
    const [breedingResponse, palResponse, mutationResponse] = await Promise.all([
      fetch(BREEDING_DATA_URL),
      fetch(PAL_DATA_URL),
      fetch(MUTATION_DATA_URL),
    ]);

    if (!breedingResponse.ok || !palResponse.ok || !mutationResponse.ok) {
      throw new Error("A calculator data request failed.");
    }

    breedingData = await breedingResponse.json();
    const palData = await palResponse.json();
    mutationData = await mutationResponse.json();
    palSprite = palData.metadata.palSprite;
    palByName = new Map(palData.pals.map((pal) => [pal.name, pal]));
    mutationEligiblePals = mutationData.eligiblePals
      .map((name) => palByName.get(name))
      .filter((pal) => Number.isFinite(pal?.breedingPower));
    mutationParentPool = breedingData.pals
      .map((name) => palByName.get(name))
      .filter(
        (pal) =>
          Number.isFinite(pal?.breedingPower) &&
          pal.breedingPower > 0 &&
          pal.breedingPower !== 9999,
      )
      .sort((first, second) => first.name.localeCompare(second.name));
    const maximumMutationRank = Math.max(
      ...mutationParentPool.map((pal) => pal.breedingPower),
    );
    mutationOwnerByRank = new Array(maximumMutationRank + 1);
    for (let rank = 1; rank <= maximumMutationRank; rank += 1) {
      mutationOwnerByRank[rank] = nearestMutationPal(rank)?.name || null;
    }
    orderedPalNames = [...breedingData.pals].sort((nameA, nameB) =>
      nameA.localeCompare(nameB),
    );
    buildIndexes();
    renderFavoritePals();

    [
      parentAInput,
      parentBInput,
      childInput,
      singlePalInput,
      mutationParentAInput,
      mutationParentBInput,
      mutationTargetInput,
    ].forEach(setupAutocomplete);

    const statusCopy = document.createElement("div");
    const statusTitle = document.createElement("strong");
    statusTitle.textContent = "Breeding data is ready";
    const statusMessage = document.createElement("p");
    statusMessage.className = "mb-0";
    statusMessage.textContent =
      `${breedingData.metadata.palCount} Pals and ` +
      `${breedingData.metadata.combinationCount.toLocaleString()} ` +
      "combinations are available.";
    statusCopy.append(statusTitle, statusMessage);

    const statusMeta = document.createElement("div");
    statusMeta.className = "data-status-meta";
    statusMeta.textContent =
      `Source data: ${breedingData.metadata.sourceExportedAt}`;
    if (status) {
      status.replaceChildren(statusCopy, statusMeta);
      status.hidden = false;
    }
    restoreBreedingFromUrl();
    autocompleteMenus.forEach((_menu, input) => input.updateSelectedDisplay());
  } catch (error) {
    console.error("Unable to load breeding data.", error);
    showEmpty("The local breeding dataset could not be loaded.", "×");
  }
}

loadBreedingCalculator();
