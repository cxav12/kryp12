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
