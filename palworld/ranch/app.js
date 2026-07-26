(() => {
  const grid = document.querySelector("#ranch-grid");
  const filterGroup = document.querySelector("#ranch-filters");
  const filterButtons = [...filterGroup.querySelectorAll("[data-filter]")];
  const searchInput = document.querySelector("#ranch-search-input");
  const statusPanel = document.querySelector("#ranch-data-status");
  const palSpriteUrl = "../assets/paldeck/pal-portraits.webp";
  const farmingIconUrl = "../assets/paldeck/work/T_icon_palwork_12.webp";
  const palSprite = {
    cellSize: 96,
    columns: 18,
    rows: 17,
  };
  let ranchPals = [];
  let activeFilter = "all";

  function productMatchesCategory(product, category) {
    return (product.categories || [product.category]).includes(category);
  }

  const updateStatus = PalworldUI.createDataStatusController({
    panel: statusPanel,
    titleElement: document.querySelector("#ranch-data-status-title"),
    messageElement: document.querySelector("#ranch-data-status-message"),
    metaElement: document.querySelector("#ranch-data-status-meta"),
  });

  function createProduct(product) {
    const item = document.createElement("span");
    item.className = "ranch-product";

    const icon = document.createElement("span");
    icon.className = "ranch-product-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = product.icon;
    item.append(icon);

    const name = document.createElement("span");
    name.textContent = product.name;
    item.append(name);

    if (product.quantity) {
      const quantity = document.createElement("span");
      quantity.className = "ranch-product-quantity";
      quantity.textContent = product.quantity;
      item.append(quantity);
    }

    if (product.minimumLevel) {
      const level = document.createElement("span");
      level.className = "ranch-product-level";
      level.textContent = `Lv ${product.minimumLevel}+`;
      level.title = `Requires Ranch level ${product.minimumLevel} or higher`;
      item.append(level);
    }

    return item;
  }

  function createRanchCard(pal) {
    const column = document.createElement("div");
    column.className = "col-12 col-sm-6 col-xl-4 col-xxl-3";

    const card = document.createElement("article");
    card.className = "ranch-card tinted-card";
    card.dataset.ranchLevel = pal.ranchLevel;

    const header = document.createElement("div");
    header.className = "ranch-card-header";

    const portrait = document.createElement("div");
    portrait.className = "ranch-pal-portrait";
    portrait.setAttribute("role", "img");
    portrait.setAttribute("aria-label", `${pal.name} portrait`);
    PalworldUI.applySpriteStyle(
      portrait,
      palSprite,
      pal.sprite,
      palSpriteUrl,
    );

    const heading = document.createElement("div");
    heading.className = "ranch-pal-heading";

    const title = document.createElement("h2");
    title.className = "card-title";
    title.textContent = pal.name;

    const number = document.createElement("span");
    number.className = "ranch-pal-number";
    number.textContent = `#${PalworldUI.formatPalNumber(pal.dexKey)}`;
    title.append(number);

    const level = document.createElement("span");
    level.className = "ranch-level";

    const levelIcon = document.createElement("img");
    levelIcon.src = farmingIconUrl;
    levelIcon.alt = "";
    levelIcon.width = 17;
    levelIcon.height = 17;

    const levelText = document.createElement("span");
    levelText.textContent = `Ranch Lv ${pal.ranchLevel}`;
    level.append(levelIcon, levelText);
    heading.append(title, level);
    header.append(portrait, heading);

    const outputLabel = document.createElement("p");
    outputLabel.className = "ranch-output-label";
    outputLabel.textContent = "Produces";

    const products = document.createElement("div");
    products.className = "ranch-products";
    pal.products.forEach((product) => products.append(createProduct(product)));

    card.append(header, outputLabel, products);

    if (pal.note) {
      const note = document.createElement("p");
      note.className = "ranch-card-note";
      note.textContent = pal.note;
      card.append(note);
    }

    column.append(card);
    return column;
  }

  function render() {
    const query = searchInput.value.trim().toLowerCase();
    const queryMatchesAProduct =
      query.length > 0 &&
      ranchPals.some((pal) =>
        pal.products.some((product) =>
          product.name.toLowerCase().includes(query),
        ),
      );

    const matches = ranchPals.filter((pal) => {
      const matchesFilter =
        activeFilter === "all" ||
        pal.products.some((product) =>
          productMatchesCategory(product, activeFilter),
        );
      const matchesProduct = pal.products.some((product) =>
        product.name.toLowerCase().includes(query),
      );
      const matchesPal =
        pal.name.toLowerCase().includes(query) ||
        String(pal.dexKey).toLowerCase().includes(query);
      const matchesQuery =
        query.length === 0 ||
        (queryMatchesAProduct ? matchesProduct : matchesPal);

      return matchesFilter && matchesQuery;
    });

    const fragment = document.createDocumentFragment();
    matches.forEach((pal) => fragment.append(createRanchCard(pal)));

    grid.replaceChildren();
    grid.setAttribute("aria-busy", "false");

    if (matches.length === 0) {
      const empty = document.createElement("div");
      empty.className = "col-12";
      empty.innerHTML =
        '<p class="ranch-empty mb-0">No Ranch Pals match this filter and search.</p>';
      grid.append(empty);
      return;
    }

    grid.append(fragment);
  }

  filterGroup.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) {
      return;
    }

    activeFilter = button.dataset.filter;
    filterButtons.forEach((filterButton) => {
      const active = filterButton === button;
      filterButton.classList.toggle("active", active);
      filterButton.setAttribute("aria-pressed", String(active));
    });
    render();
  });

  searchInput.addEventListener("input", render);

  Promise.all([
    fetch("../data/ranch-products.json?v=20260726-cake1").then((response) => {
      if (!response.ok) {
        throw new Error(`Ranch data returned ${response.status}`);
      }
      return response.json();
    }),
    fetch("../data/pals.json").then((response) => {
      if (!response.ok) {
        throw new Error(`Pal data returned ${response.status}`);
      }
      return response.json();
    }),
  ])
    .then(([ranchData, palData]) => {
      const palsByName = new Map(
        palData.pals.map((pal) => [pal.name, pal]),
      );

      ranchPals = ranchData.pals
        .map((ranchPal) => {
          const pal = palsByName.get(ranchPal.name);
          const farming = pal?.workSuitability.find(
            (work) => work.name === "Farming",
          );

          if (!pal || !farming || !pal.sprite) {
            return null;
          }

          return {
            ...ranchPal,
            dexKey: pal.dexKey,
            sprite: pal.sprite,
            ranchLevel: farming.level,
          };
        })
        .filter(Boolean)
        .sort((a, b) =>
          String(a.dexKey).localeCompare(String(b.dexKey), undefined, {
            numeric: true,
          }),
        );

      if (ranchPals.length !== ranchData.pals.length) {
        throw new Error("One or more Ranch Pals could not be matched.");
      }

      render();
      updateStatus({
        state: "current",
        title: "Ranch data is ready",
        message: `${ranchPals.length} Ranch Pals and their products are available.`,
        meta: `Palworld ${ranchData.metadata.gameVersion} · Checked ${PalworldUI.formatDate(ranchData.metadata.verifiedAt)}`,
      });
    })
    .catch((error) => {
      console.error(error);
      grid.setAttribute("aria-busy", "false");
      grid.innerHTML =
        '<div class="col-12"><p class="ranch-empty mb-0">Ranch data could not be loaded. Please refresh the page.</p></div>';
      updateStatus({
        state: "error",
        title: "Ranch data could not be loaded",
        message: "Refresh the page to try again.",
      });
    });
})();
