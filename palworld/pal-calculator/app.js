const PAL_DATA_URL = "../data/pals.json?v=20260727-bp1";
const PASSIVE_DATA_URL = "../data/passive-skills.json?v=20260726-current1";
const {
  applySpriteStyle,
  formatPalNumber,
  getPalPreferences,
} = window.PalworldUI;

const palSelect = document.querySelector("#pal-select");
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
const buildOutput = document.querySelector("#pal-build");
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
  orderedPals = [...pals].sort((first, second) => {
    const numberDifference =
      Number.parseInt(first.dexKey, 10) - Number.parseInt(second.dexKey, 10);
    return numberDifference || String(first.dexKey).localeCompare(String(second.dexKey));
  });
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
    button.append(name);
    button.addEventListener("click", () => {
      palSelect.value = pal.name;
      closePalOptions();
      renderBuild();
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

function updatePalOptions() {
  const searchTerm = palSelect.value.trim().toLocaleLowerCase();
  const matches = orderedPals
    .filter((pal) => !searchTerm || pal.name.toLocaleLowerCase().includes(searchTerm))
    .sort((first, second) => {
      if (!searchTerm) return 0;
      const firstStarts = first.name.toLocaleLowerCase().startsWith(searchTerm);
      const secondStarts = second.name.toLocaleLowerCase().startsWith(searchTerm);
      return firstStarts === secondStarts ? first.name.localeCompare(second.name) : firstStarts ? -1 : 1;
    })
    .slice(0, 12);
  const fragment = document.createDocumentFragment();

  matches.forEach((pal) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pal-autocomplete-option";
    button.setAttribute("role", "option");
    button.append(createPortrait(pal));
    const name = document.createElement("strong");
    name.textContent = pal.name;
    const number = document.createElement("span");
    number.textContent = `#${formatPalNumber(pal.dexKey)}`;
    button.append(name, number);
    button.addEventListener("mousedown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      palSelect.value = pal.name;
      closePalOptions();
      renderBuild();
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
  palSelect.setAttribute("aria-expanded", "true");
}

window.addEventListener("storage", (event) => {
  if (event.key === "palworld-pal-preferences-v1") {
    renderFavoritePals();
  }
});

function setupPassiveOptions() {
  orderedPassives = [...passives].sort((first, second) =>
    second.rank - first.rank || first.name.localeCompare(second.name),
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
    const updateMenu = () => {
      const searchTerm = input.value.trim().toLocaleLowerCase();
      const matches = orderedPassives
        .filter((passive) => !searchTerm || passive.name.toLocaleLowerCase().includes(searchTerm))
        .sort((first, second) => {
          if (!searchTerm) return 0;
          const firstStarts = first.name.toLocaleLowerCase().startsWith(searchTerm);
          const secondStarts = second.name.toLocaleLowerCase().startsWith(searchTerm);
          return firstStarts === secondStarts ? first.name.localeCompare(second.name) : firstStarts ? -1 : 1;
        })
        .slice(0, 12);
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
      input.setAttribute("aria-expanded", "true");
    };
    input.addEventListener("input", () => {
      renderBuild();
      updateMenu();
      updatePassiveSaveControls();
    });
    input.addEventListener("change", persistPassiveLoadout);
    input.addEventListener("focus", updateMenu);
    input.addEventListener("blur", () => window.setTimeout(closeMenu, 100));
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

function statCard(label, value, detail) {
  const card = document.createElement("article");
  card.className = "stat-card";
  const name = document.createElement("span");
  name.textContent = label;
  const number = document.createElement("strong");
  number.textContent = Number(value).toLocaleString();
  const copy = document.createElement("small");
  copy.textContent = detail;
  card.append(name, number, copy);
  return card;
}

function modifierCard(title, values, emptyText) {
  const card = document.createElement("article");
  card.className = "modifier-card";
  const heading = document.createElement("h3");
  heading.textContent = title;
  const list = document.createElement("div");
  list.className = "modifier-list";
  if (!values.length) {
    const empty = document.createElement("span");
    empty.className = "modifier-empty";
    empty.textContent = emptyText;
    list.append(empty);
  } else {
    values.forEach((value) => {
      const pill = document.createElement("span");
      pill.className = "modifier-pill";
      pill.textContent = value;
      list.append(pill);
    });
  }
  card.append(heading, list);
  return card;
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

function updatePalStatOverview(pal, hp, attack, defense) {
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
  const number = document.createElement("p");
  number.textContent = `Paldeck #${formatPalNumber(pal.dexKey)}`;
  copy.append(name, number);
  identity.append(copy);
  palStatOverview.replaceChildren(
    identity,
    overviewStat("Health", hp, "♥"),
    overviewStat("Attack", attack, "⚔"),
    overviewStat("Defense", defense, "⬟"),
  );
}

function renderBuild() {
  const query = palSelect.value.trim().toLocaleLowerCase();
  const pal = pals.find((entry) => entry.name.toLocaleLowerCase() === query);
  if (!pal) {
    updatePalStatOverview(null);
    buildOutput.innerHTML = '<div class="calculator-empty"><span aria-hidden="true">◎</span><p>Choose a Pal to calculate its build.</p></div>';
    buildOutput.setAttribute("aria-busy", "false");
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
  const workSpeed = Math.max(0, Math.floor(pal.stats.craftspeed * (1 + soul) * (1 + bonuses.work / 100)));
  updatePalStatOverview(pal, hp, attack, defense);

  const summary = document.createElement("header");
  summary.className = "pal-summary";
  summary.append(createPortrait(pal));
  const identity = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = pal.name;
  const subtitle = document.createElement("p");
  subtitle.textContent = `Paldeck #${formatPalNumber(pal.dexKey)} · ${pal.elements.map((element) => element.name).join(" / ")} · ${pal.size}`;
  identity.append(title, subtitle);
  const badges = document.createElement("div");
  badges.className = "build-badges";
  [`Lv. ${level}`, `Condensation ${condensationLevel}`, `Souls ${soulRank}`, ascended ? "Ascended" : "Not Ascended", alpha ? "Alpha Pal" : "Standard Pal", `IV ${iv.hp}/${iv.attack}/${iv.defense}`].forEach((label) => {
    const badge = document.createElement("span");
    badge.className = "build-badge";
    badge.textContent = label;
    badges.append(badge);
  });
  summary.append(identity, badges);

  const stats = document.createElement("div");
  stats.className = "stat-grid";
  stats.append(
    statCard("Health", hp, `Base coefficient ${pal.stats.hp}`),
    statCard("Attack", attack, `Base coefficient ${pal.stats.rangedattack}`),
    statCard("Defense", defense, `Base coefficient ${pal.stats.defense}`),
    statCard("Work Speed", workSpeed, `${bonuses.work >= 0 ? "+" : ""}${bonuses.work}% from passives`),
    statCard("Damage Bonus", bonuses.attack + Math.max(0, ...bonuses.damage.values(), 0), "Attack plus strongest elemental passive"),
    statCard("Resistance", Math.max(0, ...bonuses.resist.values(), 0), "Strongest passive damage reduction %"),
  );

  const modifiers = document.createElement("div");
  modifiers.className = "modifier-grid";
  modifiers.append(
    modifierCard("Elemental Damage", [...bonuses.damage].map(([element, value]) => `${element} +${value}%`), "No elemental damage passives selected."),
    modifierCard("Damage Resistance", [...bonuses.resist].map(([element, value]) => `${element} -${value}% incoming`), "No resistance passives selected."),
    modifierCard("Selected Passives", skills.map((skill) => skill.name), "No passive skills selected."),
    modifierCard("Other Passive Effects", [...new Set(bonuses.notes)], "No additional effects."),
  );
  buildOutput.replaceChildren(summary, stats, modifiers);
  buildOutput.setAttribute("aria-busy", "false");
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
  renderBuild();
  updatePalOptions();
});
palSelect.addEventListener("focus", updatePalOptions);
palSelect.addEventListener("blur", () => window.setTimeout(closePalOptions, 100));
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
  } catch (error) {
    console.error("Unable to load the Pal Calculator.", error);
    buildOutput.innerHTML = '<div class="calculator-empty"><span aria-hidden="true">×</span><p>The local calculator data could not be loaded.</p></div>';
  }
}

loadCalculator();
