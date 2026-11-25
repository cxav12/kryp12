(() => {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  const version = document.currentScript.dataset.version;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`/ecc/service-worker.js?v=${version}`, {
      scope: '/ecc/',
      updateViaCache: 'none'
    }).catch(error => console.warn('ECC offline setup failed:', error));
  });
})();
