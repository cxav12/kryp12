(() => {
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
