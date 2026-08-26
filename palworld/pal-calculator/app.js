const PAL_DATA_URL = "../data/pals.json?v=20260727-bp1";
const PASSIVE_DATA_URL = "../data/passive-skills.json?v=20260726-current1";
const {
  applySpriteStyle,
  formatPalNumber,
  getPalPreferences,
  stylePalName,
} = window.PalworldUI;

const palSelect = document.querySelector("#pal-select");
const palSelectedDisplay = document.querySelector("#pal-selected-display");
const palOptions = document.querySelector("#pal-options");
const calculatorFavorites = document.querySelector("#calculator-favorites");
const calculatorFavoritePals = document.querySelector(
  "#calculator-favorite-pals",
);
const condensationSelect = document.querySelector("#condensation-select");
const soulsSelect = document.querySelector("#souls-select");
const combatLevelSelect = document.querySelector("#combat-level-select");
const ascendedInput = document.querySelector("#ascended-input");
const alphaInput = document.querySelector("#alpha-input");
const passiveSelects = document.querySelector("#passive-selects");
const savePassivesButton = document.querySelector("#save-passives");
const savedPassivesStatus = document.querySelector("#saved-passives-status");
const clearSavedPassivesButton = document.querySelector("#clear-saved-passives");
const palStatOverview = document.querySelector("#pal-stat-overview");
const ivSliders = document.querySelector("#iv-sliders");
const ivModeButtons = document.querySelectorAll("[data-iv-mode]");
const ivInputs = {
  hp: document.querySelector("#hp-iv"),
  attack: document.querySelector("#attack-iv"),
  defense: document.querySelector("#defense-iv"),
};

let pals = [];
let passives = [];
let palSprite = null;
let ivMode = "perfect";
let orderedPals = [];
let orderedPassives = [];
let passiveLoadoutSaved = false;
const PASSIVE_LOADOUT_KEY = "palworld-calculator-passive-loadout";
const displayedStats = new Map();
const statAnimations = new Map();

function animateStatNumber(element, key, target) {
  const numericTarget = Number(target);
  const previous = displayedStats.get(key);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (previous === undefined || previous === numericTarget || reducedMotion) {
    displayedStats.set(key, numericTarget);
    element.textContent = numericTarget.toLocaleString();
    return;
  }
  const existingAnimation = statAnimations.get(key);
  if (existingAnimation) cancelAnimationFrame(existingAnimation);
  const startedAt = performance.now();
  const duration = 480;
  element.classList.add("stat-number-animating");

  const tick = (now) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - ((1 - progress) ** 3);
    const current = Math.round(previous + ((numericTarget - previous) * eased));
    displayedStats.set(key, current);
    element.textContent = current.toLocaleString();
    if (progress < 1) {
      statAnimations.set(key, requestAnimationFrame(tick));
    } else {
      displayedStats.set(key, numericTarget);
      statAnimations.delete(key);
      element.classList.remove("stat-number-animating");
    }
  };
  statAnimations.set(key, requestAnimationFrame(tick));
}

function option(value, label, selected = false) {
  const item = document.createElement("option");
  item.value = value;
  item.textContent = label;
  item.selected = selected;
  return item;
}

function setupStaticControls() {
  for (let rank = 20; rank >= 0; rank -= 1) {
    const label = rank === 20
      ? "Fully Souled · Rank 20 (+60%)"
      : rank === 0
        ? "No Souls · Rank 0"
        : `Rank ${rank} (+${rank * 3}%)`;
    soulsSelect.append(option(String(rank), label, rank === 20));
  }

  for (let level = 80; level >= 1; level -= 1) {
    combatLevelSelect.append(
      option(String(level), `Level ${level}`, level === 80),
    );
  }
}

function setupPalOptions() {
  orderedPals = [...pals].sort((first, second) =>
    first.name.localeCompare(second.name),
  );
  palSelect.placeholder = "Type or choose a Pal...";
}

function renderFavoritePals() {
  const palByName = new Map(pals.map((pal) => [pal.name, pal]));
  const favorites = getPalPreferences().favorites
    .map((name) => palByName.get(name))
    .filter(Boolean)
    .sort(
      (first, second) =>
        Number.parseInt(first.dexKey, 10) -
          Number.parseInt(second.dexKey, 10) ||
        first.name.localeCompare(second.name),
    );
  const fragment = document.createDocumentFragment();

  favorites.forEach((pal) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "calculator-favorite-pal";
    button.title = `Calculate stats for ${pal.name}`;
    button.append(createPortrait(pal));
    const name = document.createElement("span");
    name.textContent = pal.name;
    stylePalName(name, pal);
    button.append(name);
    button.addEventListener("click", () => {
      palSelect.value = pal.name;
      closePalOptions();
      renderBuild();
      updateSelectedPalDisplay();
      palSelect.blur();
    });
    fragment.append(button);
  });

  calculatorFavoritePals.replaceChildren(fragment);
  calculatorFavorites.hidden = favorites.length === 0;
}

function closePalOptions() {
  palOptions.hidden = true;
  palSelect.setAttribute("aria-expanded", "false");
}

function positionAutocomplete(menu, input, preferredHeight) {
  const viewportGap = 8;
  const inputBounds = input.getBoundingClientRect();
  const spaceBelow = window.innerHeight - inputBounds.bottom - viewportGap;
  const spaceAbove = inputBounds.top - viewportGap;
  const requiredHeight = Math.min(preferredHeight, menu.scrollHeight);
  const opensUpward = spaceBelow < requiredHeight && spaceAbove > spaceBelow;
  const availableSpace = opensUpward ? spaceAbove : spaceBelow;

  menu.classList.toggle("opens-upward", opensUpward);
  menu.style.setProperty(
    "--autocomplete-max-height",
    `${Math.max(96, Math.min(preferredHeight, availableSpace))}px`,
  );
}

function repositionOpenAutocompletes() {
  if (!palOptions.hidden) {
    positionAutocomplete(palOptions, palSelect, 288);
  }

  document.querySelectorAll(".passive-autocomplete:not([hidden])").forEach((menu) => {
    const input = menu.parentElement.querySelector(".passive-input");
    if (input) positionAutocomplete(menu, input, 272);
  });
}

window.addEventListener("resize", repositionOpenAutocompletes);
window.addEventListener("scroll", repositionOpenAutocompletes, true);

function updatePalOptions(showAll = false) {
  const searchTerm = showAll ? "" : palSelect.value.trim().toLocaleLowerCase();
  const matches = orderedPals
    .filter((pal) => !searchTerm || pal.name.toLocaleLowerCase().includes(searchTerm))
    .sort((first, second) => {
      if (!searchTerm) return 0;
      const firstStarts = first.name.toLocaleLowerCase().startsWith(searchTerm);
      const secondStarts = second.name.toLocaleLowerCase().startsWith(searchTerm);
      return firstStarts === secondStarts ? first.name.localeCompare(second.name) : firstStarts ? -1 : 1;
    });
  const fragment = document.createDocumentFragment();

  matches.forEach((pal) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pal-autocomplete-option";
    button.setAttribute("role", "option");
    button.append(createPortrait(pal));
    const identity = document.createElement("span");
    identity.className = "pal-autocomplete-identity";
    const name = document.createElement("strong");
    name.textContent = pal.name;
    stylePalName(name, pal);
    const number = document.createElement("span");
    number.className = "pal-id";
    number.textContent = `#${formatPalNumber(pal.dexKey)}`;
    identity.append(name, number);
    button.append(identity);
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      palSelect.value = pal.name;
      closePalOptions();
      renderBuild();
      updateSelectedPalDisplay();
      palSelect.blur();
    });
    fragment.append(button);
  });

  if (!matches.length) {
    const message = document.createElement("p");
    message.className = "pal-autocomplete-empty";
    message.textContent = "No matching Pals";
    fragment.append(message);
  }
  palOptions.replaceChildren(fragment);
  palOptions.hidden = false;
  positionAutocomplete(palOptions, palSelect, 288);
  palSelect.setAttribute("aria-expanded", "true");
}

window.addEventListener("storage", (event) => {
  if (event.key === "palworld-pal-preferences-v1") {
    renderFavoritePals();
  }
});

function setupPassiveOptions() {
  orderedPassives = [...passives].sort((first, second) =>
    first.name.localeCompare(second.name),
  );
  for (let slot = 0; slot < 4; slot += 1) {
    const wrapper = document.createElement("div");
    wrapper.className = "passive-search";
    const input = document.createElement("input");
    input.type = "search";
    input.className = "form-control calculator-select passive-input";
    input.placeholder = `Passive ${slot + 1} · None`;
    input.autocomplete = "off";
    input.setAttribute("aria-label", `Passive skill ${slot + 1}`);
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    const menu = document.createElement("div");
    menu.className = "passive-autocomplete";
    menu.hidden = true;
    menu.setAttribute("role", "listbox");

    const closeMenu = () => {
      menu.hidden = true;
      input.setAttribute("aria-expanded", "false");
    };
    const selectedPassive = () => {
      const query = input.value.trim().toLocaleLowerCase();
      return passives.find(
        (passive) => passive.name.toLocaleLowerCase() === query,
      ) || null;
    };
    const updateMenu = (showAll = false) => {
      const searchTerm = showAll ? "" : input.value.trim().toLocaleLowerCase();
      const matches = orderedPassives
        .filter((passive) => !searchTerm || passive.name.toLocaleLowerCase().includes(searchTerm))
        .sort((first, second) => {
          if (!searchTerm) return 0;
          const firstStarts = first.name.toLocaleLowerCase().startsWith(searchTerm);
          const secondStarts = second.name.toLocaleLowerCase().startsWith(searchTerm);
          return firstStarts === secondStarts ? first.name.localeCompare(second.name) : firstStarts ? -1 : 1;
        });
      const fragment = document.createDocumentFragment();
      matches.forEach((passive) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "passive-autocomplete-option";
        button.setAttribute("role", "option");
        const name = document.createElement("strong");
        name.textContent = passive.name;
        const rank = document.createElement("span");
        rank.textContent = `Rank ${passive.rank > 0 ? `+${passive.rank}` : passive.rank}`;
        button.append(name, rank);
        button.addEventListener("mousedown", (event) => event.preventDefault());
        button.addEventListener("click", () => {
          input.value = passive.name;
          closeMenu();
          renderBuild();
          updatePassiveSaveControls();
          persistPassiveLoadout();
          input.blur();
        });
        fragment.append(button);
      });
      if (!matches.length) {
        const message = document.createElement("p");
        message.className = "pal-autocomplete-empty";
        message.textContent = "No matching passive skills";
        fragment.append(message);
      }
      menu.replaceChildren(fragment);
      menu.hidden = false;
      positionAutocomplete(menu, input, 272);
      input.setAttribute("aria-expanded", "true");
    };
    input.addEventListener("input", () => {
      input.dataset.replaceOnType = "false";
      renderBuild();
      updateMenu();
      updatePassiveSaveControls();
    });
    input.addEventListener("change", persistPassiveLoadout);
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
      const hasSelectedPassive = Boolean(selectedPassive());
      input.dataset.replaceOnType = String(hasSelectedPassive);
      if (hasSelectedPassive) {
        input.setSelectionRange(input.value.length, input.value.length);
      }
      updateMenu(hasSelectedPassive);
    });
    input.addEventListener("blur", () => {
      input.dataset.replaceOnType = "false";
      window.setTimeout(closeMenu, 100);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
    wrapper.append(input, menu);
    passiveSelects.append(wrapper);
  }
  restorePassiveLoadout();
}

function selectedPassives() {
  const names = [...new Set(
    [...document.querySelectorAll(".passive-input")]
      .map((input) => input.value.trim().toLocaleLowerCase())
      .filter(Boolean),
  )];
  return names
    .map((name) => passives.find((passive) => passive.name.toLocaleLowerCase() === name))
    .filter(Boolean);
}

function updatePassiveSaveControls() {
  savePassivesButton.disabled = selectedPassives().length === 0;
  savePassivesButton.hidden = passiveLoadoutSaved;
  savedPassivesStatus.hidden = !passiveLoadoutSaved;
}

function persistPassiveLoadout() {
  if (!passiveLoadoutSaved) return;
  const names = selectedPassives().map((passive) => passive.name);
  try {
    localStorage.setItem(PASSIVE_LOADOUT_KEY, JSON.stringify({ active: true, names }));
  } catch (error) {
    console.warn("Unable to save the passive loadout.", error);
  }
}

function restorePassiveLoadout() {
  try {
    const saved = JSON.parse(localStorage.getItem(PASSIVE_LOADOUT_KEY));
    if (!saved?.active || !Array.isArray(saved.names)) {
      updatePassiveSaveControls();
      return;
    }
    const validNames = saved.names.filter((name) =>
      passives.some((passive) => passive.name.toLocaleLowerCase() === String(name).toLocaleLowerCase()),
    );
    [...document.querySelectorAll(".passive-input")].forEach((input, index) => {
      input.value = validNames[index] || "";
    });
    passiveLoadoutSaved = true;
  } catch (error) {
    console.warn("Unable to restore the saved passive loadout.", error);
  }
  updatePassiveSaveControls();
}

savePassivesButton.addEventListener("click", () => {
  if (!selectedPassives().length) return;
  passiveLoadoutSaved = true;
  persistPassiveLoadout();
  updatePassiveSaveControls();
});

clearSavedPassivesButton.addEventListener("click", () => {
  passiveLoadoutSaved = false;
  try {
    localStorage.removeItem(PASSIVE_LOADOUT_KEY);
  } catch (error) {
    console.warn("Unable to remove the saved passive loadout.", error);
  }
  updatePassiveSaveControls();
});

function effectBonuses(skills) {
  const bonuses = { hp: 0, attack: 0, defense: 0, work: 0, damage: new Map(), resist: new Map(), notes: [] };
  skills.forEach((skill) => {
    skill.effects.forEach((effect) => {
      const core = effect.match(/^(Attack|Defense|Work Speed|Max Health)\s*([+-])\s*(\d+(?:\.\d+)?)%/i);
      if (core) {
        const key = { attack: "attack", defense: "defense", "work speed": "work", "max health": "hp" }[core[1].toLowerCase()];
        bonuses[key] += Number(core[3]) * (core[2] === "-" ? -1 : 1);
        return;
      }
      const damage = effect.match(/(\d+(?:\.\d+)?)% increase (?:in|to) ([A-Za-z]+) attack damage/i)
        || effect.match(/^([A-Za-z]+) damage \+(\d+(?:\.\d+)?)%/i);
      if (damage) {
        const element = Number.isNaN(Number(damage[1])) ? damage[1] : damage[2];
        const value = Number.isNaN(Number(damage[1])) ? Number(damage[2]) : Number(damage[1]);
        bonuses.damage.set(element, (bonuses.damage.get(element) || 0) + value);
        return;
      }
      const resist = effect.match(/(\d+(?:\.\d+)?)% decrease in incoming ([A-Za-z]+) damage/i)
        || effect.match(/^([A-Za-z]+) damage reduction (\d+(?:\.\d+)?)%/i);
      if (resist) {
        const element = Number.isNaN(Number(resist[1])) ? resist[1] : resist[2];
        const value = Number.isNaN(Number(resist[1])) ? Number(resist[2]) : Number(resist[1]);
        bonuses.resist.set(element, (bonuses.resist.get(element) || 0) + value);
        return;
      }
      bonuses.notes.push(`${skill.name}: ${effect}`);
    });
  });
  return bonuses;
}

function finalStat(flatBase, scaling, rate, level, iv, condensation, soul, passive, ascended) {
  const growth = scaling * rate * level * (1 + iv * 0.003) * (ascended ? 1.1 : 1);
  const unmodified = Math.floor(flatBase + growth);
  return Math.floor(unmodified * (1 + condensation) * (1 + soul) * (1 + passive));
}

function createPortrait(pal) {
  const frame = document.createElement("div");
  frame.className = "calculator-portrait";
  const sprite = document.createElement("span");
  sprite.className = "calculator-pal-sprite";
  applySpriteStyle(sprite, palSprite, pal.sprite, `../${palSprite.image.slice(2)}`);
  sprite.setAttribute("role", "img");
  sprite.setAttribute("aria-label", pal.name);
  frame.append(sprite);
  return frame;
}

function selectedPal() {
  const query = palSelect.value.trim().toLocaleLowerCase();
  return pals.find((pal) => pal.name.toLocaleLowerCase() === query) || null;
}

function updateSelectedPalDisplay() {
  const pal = selectedPal();
  palSelectedDisplay.hidden = !pal;
  palSelect.classList.toggle("has-selected-pal", Boolean(pal));

  if (!pal) {
    palSelectedDisplay.replaceChildren();
    return;
  }

  const identity = document.createElement("span");
  identity.className = "calculator-selected-identity";
  const name = document.createElement("strong");
  name.textContent = pal.name;
  stylePalName(name, pal);
  const number = document.createElement("span");
  number.className = "pal-id";
  number.textContent = `#${formatPalNumber(pal.dexKey)}`;
  identity.append(name, number);
  palSelectedDisplay.replaceChildren(createPortrait(pal), identity);
}

function overviewStat(label, value, icon) {
  const stat = document.createElement("article");
  stat.className = `pal-overview-stat pal-overview-${label.toLocaleLowerCase()}`;
  const symbol = document.createElement("span");
  symbol.className = "pal-overview-icon";
  symbol.setAttribute("aria-hidden", "true");
  symbol.textContent = icon;
  const copy = document.createElement("div");
  const name = document.createElement("small");
  name.className = "visually-hidden";
  name.textContent = label;
  const number = document.createElement("strong");
  animateStatNumber(number, `overview-${label.toLocaleLowerCase()}`, value);
  copy.append(name, number);
  stat.append(symbol, copy);
  return stat;
}

function updatePalStatOverview(pal, hp, attack, defense, buildDetails = []) {
  if (!pal) {
    palStatOverview.innerHTML = '<p class="pal-overview-empty">Choose a Pal to view its core stats.</p>';
    return;
  }
  const identity = document.createElement("div");
  identity.className = "pal-overview-identity";
  identity.append(createPortrait(pal));
  const copy = document.createElement("div");
  const name = document.createElement("h2");
  name.textContent = pal.name;
  stylePalName(name, pal);
  const number = document.createElement("p");
  number.className = "pal-id";
  number.textContent = `Paldeck #${formatPalNumber(pal.dexKey)}`;
  copy.append(name, number);
  identity.append(copy);
  const badges = document.createElement("div");
  badges.className = "pal-overview-badges";
  buildDetails.forEach((label) => {
    const badge = document.createElement("span");
    badge.className = "build-badge";
    badge.textContent = label;
    badges.append(badge);
  });
  palStatOverview.replaceChildren(
    identity,
    overviewStat("Health", hp, "♥"),
    overviewStat("Attack", attack, "⚔"),
    overviewStat("Defense", defense, "⬟"),
    badges,
  );
}

function renderBuild() {
  const query = palSelect.value.trim().toLocaleLowerCase();
  const pal = pals.find((entry) => entry.name.toLocaleLowerCase() === query);
  if (!pal) {
    updatePalStatOverview(null);
    return;
  }
  const level = Number(combatLevelSelect.value);
  const condensationLevel = Number(condensationSelect.value);
  const condensation = (condensationLevel - 1) * 0.05;
  const soulRank = Number(soulsSelect.value);
  const soul = soulRank * 0.03;
  const ascended = ascendedInput.checked;
  const alpha = alphaInput.checked;
  const skills = selectedPassives();
  const bonuses = effectBonuses(skills);
  const iv = Object.fromEntries(Object.entries(ivInputs).map(([key, input]) => [key, ivMode === "perfect" ? 100 : Number(input.value)]));
  const hp = finalStat(500 + 5 * level, pal.stats.hp, 0.5, level, iv.hp, condensation, soul, (bonuses.hp + (alpha ? 20 : 0)) / 100, ascended);
  const attack = finalStat(100, pal.stats.rangedattack, 0.075, level, iv.attack, condensation, soul, bonuses.attack / 100, ascended);
  const defense = finalStat(50, pal.stats.defense, 0.075, level, iv.defense, condensation, soul, bonuses.defense / 100, ascended);
  updatePalStatOverview(pal, hp, attack, defense, [
    `Lv. ${level}`,
    `Condensation ${condensationLevel}`,
    `Souls ${soulRank}`,
    ascended ? "Ascended" : "Not Ascended",
    alpha ? "Alpha Pal" : "Standard Pal",
    `IV ${iv.hp}/${iv.attack}/${iv.defense}`,
  ]);
}

function updateIvMode(mode) {
  ivMode = mode;
  ivSliders.hidden = mode !== "custom";
  ivModeButtons.forEach((button) => {
    const active = button.dataset.ivMode === mode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderBuild();
}

setupStaticControls();
ivModeButtons.forEach((button) => button.addEventListener("click", () => updateIvMode(button.dataset.ivMode)));
Object.entries(ivInputs).forEach(([key, input]) => {
  input.addEventListener("input", () => {
    document.querySelector(`#${key}-iv-output`).textContent = input.value;
    renderBuild();
  });
});
[condensationSelect, soulsSelect, combatLevelSelect, ascendedInput, alphaInput].forEach((control) => control.addEventListener("change", renderBuild));
palSelect.addEventListener("input", () => {
  palSelect.dataset.replaceOnType = "false";
  updateSelectedPalDisplay();
  renderBuild();
  updatePalOptions();
});
palSelect.addEventListener("beforeinput", (event) => {
  if (
    palSelect.dataset.replaceOnType === "true" &&
    (event.inputType.startsWith("insert") || event.inputType.startsWith("delete"))
  ) {
    palSelect.value = "";
    palSelect.dataset.replaceOnType = "false";
  }
});
palSelect.addEventListener("focus", () => {
  const hasSelectedPal = Boolean(selectedPal());
  palSelect.dataset.replaceOnType = String(hasSelectedPal);
  if (hasSelectedPal) {
    palSelect.setSelectionRange(palSelect.value.length, palSelect.value.length);
  }
  updatePalOptions(hasSelectedPal);
});
palSelect.addEventListener("blur", () => {
  palSelect.dataset.replaceOnType = "false";
  window.setTimeout(closePalOptions, 100);
});
palSelect.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closePalOptions();
});

async function loadCalculator() {
  try {
    const [palResponse, passiveResponse] = await Promise.all([fetch(PAL_DATA_URL), fetch(PASSIVE_DATA_URL)]);
    if (!palResponse.ok || !passiveResponse.ok) throw new Error("A calculator data request failed.");
    const palData = await palResponse.json();
    const passiveData = await passiveResponse.json();
    pals = palData.pals.filter((pal) => pal.dexKey && pal.stats);
    passives = passiveData.passiveSkills;
    palSprite = palData.metadata.palSprite;
    setupPalOptions();
    renderFavoritePals();
    setupPassiveOptions();
    renderBuild();
    updateSelectedPalDisplay();
  } catch (error) {
    console.error("Unable to load the Pal Calculator.", error);
    palStatOverview.innerHTML = '<p class="pal-overview-empty">The local calculator data could not be loaded.</p>';
  }
}

loadCalculator();
