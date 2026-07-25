(() => {
  const elementDisplayNames = {
    Normal: "Neutral",
    Leaf: "Grass",
    Electricity: "Electric",
    Earth: "Ground",
  };

  function formatPalNumber(dexKey) {
    const match = String(dexKey).match(/^(\d+)(.*)$/);

    if (!match) {
      return String(dexKey);
    }

    return `${match[1].padStart(3, "0")}${match[2]}`;
  }

  function formatDate(dateString) {
    const localDate =
      /^\d{4}-\d{2}-\d{2}$/.test(dateString)
        ? new Date(`${dateString}T00:00:00`)
        : new Date(dateString);

    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(localDate);
  }

  function createDataStatusController({
    panel,
    titleElement,
    messageElement,
    metaElement,
  }) {
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

  window.PalworldUI = Object.freeze({
    applySpriteStyle,
    createDataStatusController,
    formatDate,
    formatPalNumber,
    getElementDisplayName,
    getRarityDetails,
  });
})();
