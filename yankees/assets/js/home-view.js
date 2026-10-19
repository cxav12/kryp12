(() => {
  'use strict';
  const container = document.getElementById('home-view');
  if (!container) return;
  let currentMode;
  function loadScript(name) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `./assets/js/${name}.js?v=20261019-home-switch1`;
      script.onload = resolve;
      script.onerror = reject;
      document.body.append(script);
    });
  }
  async function render(state) {
    if (!state) return;
    if (state.mode === 'unavailable') {
      if (!currentMode) container.innerHTML = '<p class="offseason-empty">Home updates are unavailable. Please refresh to try again.</p>';
      container.setAttribute('aria-busy', 'false');
      return;
    }
    const mode = state.mode === 'offseason' ? 'offseason' : 'regular';
    if (mode === currentMode) return;
    // A reload clears the old view's live-game refreshes or offseason requests.
    if (currentMode) { location.reload(); return; }
    currentMode = mode;
    const template = document.getElementById(`${mode}-home-template`);
    container.replaceChildren(template.content.cloneNode(true));
    container.setAttribute('aria-busy', 'false');
    document.title = mode === 'offseason' ? 'Offseason Hub · Yankees' : 'Game Center · Yankees';
    try {
      if (mode === 'offseason') {
        container.dataset.reviewSeason = String(state.season);
        await loadScript('offseason');
      } else {
        for (const name of ['abs-challenges', 'game-status', 'home-game-selection', 'home-alerts', 'app']) await loadScript(name);
      }
    } catch {
      const message = document.createElement('p');
      message.className = 'offseason-empty';
      message.textContent = 'Unable to load home updates. Please refresh to try again.';
      container.prepend(message);
    }
  }
  window.addEventListener('yankees-season-mode', event => render(event.detail));
  render(window.YankeesPageSeason);
})();
