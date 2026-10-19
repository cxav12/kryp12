(() => {
  'use strict';
  const root = document.getElementById('home-view');
  if (!root || !document.body.classList.contains('offseason-experience')) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const panels = [...root.querySelectorAll('.offseason-panel')];
  // Gentle, one-time entrances; content stays visible even if effects fail.
  if (!reduced.matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.filter(entry => entry.isIntersecting).forEach((entry, index) => {
        if (!reduced.matches && typeof entry.target.animate === 'function') {
          entry.target.animate([
            {opacity: .55, transform: 'translateY(10px)'},
            {opacity: 1, transform: 'translateY(0)'},
          ], {duration: 500, delay: Math.min(index, 2) * 60, easing: 'cubic-bezier(.2,.7,.2,1)'});
        }
        observer.unobserve(entry.target);
      });
    }, {threshold: .06});
    panels.forEach(panel => observer.observe(panel));
    reduced.addEventListener('change', () => {
      if (reduced.matches) {
        observer.disconnect();
        root.getAnimations({subtree: true}).forEach(animation => animation.cancel());
      }
    });
    window.addEventListener('pagehide', () => observer.disconnect(), {once: true});
  }
  let frame;
  let active;
  let x;
  let y;
  panels.forEach(panel => panel.addEventListener('pointermove', event => {
    if (reduced.matches || !pointer.matches) return;
    const bounds = panel.getBoundingClientRect();
    active = panel;
    x = event.clientX - bounds.left;
    y = event.clientY - bounds.top;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      active.style.setProperty('--spot-x', `${x}px`);
      active.style.setProperty('--spot-y', `${y}px`);
      frame = null;
    });
  }, {passive: true}));
  window.addEventListener('pagehide', () => { if (frame) cancelAnimationFrame(frame); }, {once: true});
})();
