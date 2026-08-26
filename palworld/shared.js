(() => {
  const palPreferencesKey = "palworld-pal-preferences-v1";
  const elementDisplayNames = {
    Normal: "Neutral",
    Leaf: "Grass",
    Electricity: "Electric",
    Earth: "Ground",
  };
  const palElementColors = {
    Normal: "#d9dde3",
    Leaf: "#78d66d",
    Water: "#69baff",
    Fire: "#ff806d",
    Electricity: "#f2d45c",
    Dark: "#bd8cff",
    Earth: "#d6a16c",
    Ice: "#7bdce8",
    Dragon: "#d991ff",
  };
  const gameTokenDisplayNames = {
    berries: "Red Berries",
    cavemushroom: "Cave Mushroom",
    copperore: "Copper Ore",
    egg: "Egg",
    fireorgan: "Flame Organ",
    iceorgan: "Ice Organ",
    money: "Gold Coin",
    mushroom: "Mushroom",
    palfluid: "Pal Fluids",
    paloil: "High Quality Pal Oil",
    sweet: "Cotton Candy",
    sweet_caramel: "Caramelized Cotton Candy",
    venom: "Venom Gland",
    wool: "Wool",
  };
  const longDateFormatter = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  function humanizeGameToken(token) {
    const normalizedToken = String(token)
      .replace(/^COMMON_ELEMENT_NAME_/i, "")
      .replace(/^ADDITIONAL_EFFECT_/i, "")
      .replace(/^COMMON_STATUS_/i, "")
      .replace(/^COMMON_WORK_SUITABILITY_/i, "")
      .replace(/^COMMON_CHARACTER_NAME_/i, "");
    const knownElement = getElementDisplayName(normalizedToken);

    if (knownElement !== normalizedToken) {
      return knownElement;
    }

    return normalizedToken
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatGameText(value) {
    if (!value) {
      return "";
    }

    return String(value)
      .replace(/â€™/g, "’")
      .replace(/â€œ|â€/g, '"')
      .replace(/Â·/g, "·")
      .replace(/<img\b[^>]*>/gi, "")
      .replace(
        /Unknown (?:Status|Character) \(([^|)]+)\|\s*style=\|[^)]+\)/gi,
        (_, token) => humanizeGameToken(token),
      )
      .replace(
        /\b(inflicts?\s+[A-Z][A-Za-z ]*?)\s*<Status_Up>\s*\{[^}]+\}\s*<\/>/gi,
        "$1",
      )
      .replace(
        /<(?:Status_Up|Status_Keyword)>\s*[+-]?\{[^}]+\}%?\s*<\/>/gi,
        "an amount based on Partner Skill level",
      )
      .replace(/\{ReferenceMsgId_[^}]+\}/gi, "")
      .replace(
        /\{[^}]+\}-second/gi,
        "Partner Skill level-based",
      )
      .replace(
        /[+-]?\{[^}]+\}%?/g,
        "an amount based on Partner Skill level",
      )
      .replace(/<[^>]*>/g, "")
      .replace(
        /([A-Za-z][A-Za-z0-9_]*)\|\s*style=\|[A-Za-z0-9_]+/gi,
        (_, token) =>
          gameTokenDisplayNames[token.toLowerCase()] ||
          humanizeGameToken(token),
      )
      .replace(
        /Unknown (?:Status|Character) \(([^)]+)\)/gi,
        (_, token) => humanizeGameToken(token.split("|")[0]),
      )
      .replace(/\s+([,.;:%)])/g, "$1")
      .replace(/\(\s*\)/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  function formatPalNumber(dexKey) {
    const match = String(dexKey).match(/^(\d+)(.*)$/);

    if (!match) {
      return String(dexKey);
    }

    return `${match[1].padStart(3, "0")}${match[2]}`;
  }

  function getPalElementColor(pal) {
    const primaryElement = pal?.elements?.[0]?.name;
    return palElementColors[primaryElement] || "#d9dde3";
  }

  function stylePalName(element, pal) {
    if (element) {
      element.style.color = getPalElementColor(pal);
    }
    return element;
  }

  function formatDate(dateString) {
    const localDate =
      /^\d{4}-\d{2}-\d{2}$/.test(dateString)
        ? new Date(`${dateString}T00:00:00`)
        : new Date(dateString);

    return longDateFormatter.format(localDate);
  }

  function createDataStatusController({
    panel,
    titleElement,
    messageElement,
    metaElement,
  }) {
    if (!panel || !titleElement || !messageElement || !metaElement) {
      return () => {};
    }

    return ({ state, title, message, meta = "" }) => {
      panel.dataset.state = state;
      titleElement.textContent = title;
      messageElement.textContent = message;
      metaElement.textContent = meta;
      panel.hidden = false;
    };
  }

  function getElementDisplayName(name) {
    return elementDisplayNames[name] || name;
  }

  function getRarityDetails(rarity) {
    if (rarity >= 11) {
      return { key: "legendary", label: "Legendary" };
    }

    if (rarity >= 8) {
      return { key: "epic", label: "Epic" };
    }

    if (rarity >= 5) {
      return { key: "rare", label: "Rare" };
    }

    return { key: "common", label: "Common" };
  }

  function applySpriteStyle(element, sprite, coordinates, imageUrl) {
    const column = coordinates.x / sprite.cellSize;
    const row = coordinates.y / sprite.cellSize;
    const horizontalPosition =
      sprite.columns > 1 ? (column / (sprite.columns - 1)) * 100 : 0;
    const verticalPosition =
      sprite.rows > 1 ? (row / (sprite.rows - 1)) * 100 : 0;

    element.style.backgroundImage = `url("${imageUrl}")`;
    element.style.backgroundSize =
      `${sprite.columns * 100}% ${sprite.rows * 100}%`;
    element.style.backgroundPosition =
      `${horizontalPosition}% ${verticalPosition}%`;
  }

  function getPalPreferences() {
    try {
      const storedPreferences = JSON.parse(
        window.localStorage.getItem(palPreferencesKey) || "{}",
      );

      return {
        favorites: Array.isArray(storedPreferences.favorites)
          ? storedPreferences.favorites
          : [],
      };
    } catch {
      return { favorites: [] };
    }
  }

  function hasPalPreference(name, preference) {
    return getPalPreferences()[preference]?.includes(name) === true;
  }

  function setPalPreference(name, preference, enabled) {
    const preferences = getPalPreferences();

    if (!Object.hasOwn(preferences, preference)) {
      return false;
    }

    const names = new Set(preferences[preference]);
    enabled ? names.add(name) : names.delete(name);
    preferences[preference] = [...names].sort((nameA, nameB) =>
      nameA.localeCompare(nameB),
    );

    try {
      window.localStorage.setItem(
        palPreferencesKey,
        JSON.stringify(preferences),
      );
    } catch {
      return false;
    }

    window.dispatchEvent(
      new CustomEvent("palworld:preferences-changed", {
        detail: { name, preference, enabled },
      }),
    );
    return true;
  }

  function updateUrlParams(values) {
    const url = new URL(window.location.href);

    Object.entries(values).forEach(([name, value]) => {
      if (
        value === undefined ||
        value === null ||
        value === "" ||
        value === false
      ) {
        url.searchParams.delete(name);
      } else {
        url.searchParams.set(name, String(value));
      }
    });

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }

  function initializeNavigation() {
    document.querySelectorAll(".palworld-nav").forEach((navigation) => {
      const toggle = navigation.querySelector(".nav-toggle");
      const links = navigation.querySelector(".navbar-nav");

      if (!toggle || !links) {
        return;
      }

      const setOpen = (open) => {
        navigation.dataset.open = String(open);
        toggle.setAttribute("aria-expanded", String(open));
        toggle.setAttribute(
          "aria-label",
          open ? "Close navigation" : "Open navigation",
        );
      };

      toggle.addEventListener("click", () => {
        setOpen(navigation.dataset.open !== "true");
      });

      links.addEventListener("click", (event) => {
        if (event.target.closest(".nav-link")) {
          setOpen(false);
        }
      });

      navigation.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && navigation.dataset.open === "true") {
          setOpen(false);
          toggle.focus();
        }
      });

      setOpen(false);
    });
  }

  initializeNavigation();

  window.PalworldUI = Object.freeze({
    applySpriteStyle,
    createDataStatusController,
    formatDate,
    formatGameText,
    formatPalNumber,
    getPalElementColor,
    getPalPreferences,
    getElementDisplayName,
    getRarityDetails,
    hasPalPreference,
    setPalPreference,
    stylePalName,
    updateUrlParams,
  });
})();
