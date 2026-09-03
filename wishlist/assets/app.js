document.querySelectorAll('form[data-confirm]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    if (!window.confirm(form.dataset.confirm || 'Continue?')) event.preventDefault();
  });
});

document.querySelectorAll('.product-image').forEach((image) => {
  image.addEventListener('error', () => {
    image.closest('.product-image-wrap')?.classList.add('image-unavailable');
    image.remove();
  }, { once: true });
});

const reducedCardMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const productCards = [...document.querySelectorAll('.product-card')];
if (productCards.length && !reducedCardMotion.matches && 'IntersectionObserver' in window) {
  const highlightedCards = new WeakSet();
  const cardObserver = new IntersectionObserver((entries) => {
    const enteringCards = entries.filter((entry) => entry.isIntersecting && !highlightedCards.has(entry.target));
    enteringCards.forEach((entry, index) => {
      highlightedCards.add(entry.target);
      cardObserver.unobserve(entry.target);
      window.setTimeout(() => {
        entry.target.classList.add('is-highlighted');
        window.setTimeout(() => entry.target.classList.remove('is-highlighted'), 1050);
      }, index * 75);
    });
  }, { threshold: 0.18 });

  productCards.forEach((card) => cardObserver.observe(card));
}
