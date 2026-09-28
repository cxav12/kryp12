(() => {
  const accountNav = document.querySelector("#hub-account-nav");
  fetch("/api/account-session.php", { credentials: "same-origin", cache: "no-store" })
    .then((response) => response.ok ? response.json() : Promise.reject())
    .then((session) => {
      if (!session.authenticated || !accountNav) return;
      const account = document.createElement("a");
      account.href = "/account/"; account.textContent = "Account";
      accountNav.replaceChildren(account);
      if (session.isAdmin) {
        const admin = document.createElement("a");
        admin.href = "/admin/"; admin.textContent = "Admin";
        accountNav.append(admin);
      }
      const form = document.createElement("form");
      form.method = "post"; form.action = "/login/logout.php";
      const csrf = document.createElement("input");
      csrf.type = "hidden"; csrf.name = "csrf_token"; csrf.value = session.csrfToken || "";
      const signOut = document.createElement("button");
      signOut.type = "submit"; signOut.textContent = "Sign out";
      form.append(csrf, signOut); accountNav.append(form);
      accountNav.classList.add("is-authenticated");
    })
    .catch(() => {});

  const defaults = { yankees: true, palworld: true, color: true, wishlist: false, ravens: false };
  const applyVisibility = (visibility) => document.querySelectorAll("[data-site-key]").forEach((item) => {
    const key = item.dataset.siteKey;
    item.hidden = !(visibility[key] ?? defaults[key] ?? false);
  });
  applyVisibility(defaults);
  fetch("/api/site-visibility.php", { credentials: "same-origin", cache: "no-store" })
    .then((response) => response.ok ? response.json() : Promise.reject())
    .then((data) => applyVisibility(data.sites || defaults))
    .catch(() => applyVisibility(defaults));

  const overlay = document.querySelector("#contour-motion");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!overlay || reduceMotion.matches) return;

  const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

  async function start() {
    const lines = [...overlay.querySelectorAll(".trace")];
    if (!lines.length) return;

    let previousIndex = -1;
    while (!reduceMotion.matches) {
      let index;
      do index = Math.floor(Math.random() * lines.length);
      while (lines.length > 1 && index === previousIndex);
      previousIndex = index;

      const animation = lines[index].animate([
        { strokeDashoffset: 1150, opacity: 0 },
        { strokeDashoffset: 1050, opacity: 0.42, offset: 0.12 },
        { strokeDashoffset: 0, opacity: 0.42, offset: 0.88 },
        { strokeDashoffset: 0, opacity: 0 },
      ], {
        duration: 3000,
        easing: "ease-in-out",
      });
      await animation.finished.catch(() => {});
      await wait(3000);
    }
  }

  start();
})();
