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

const tagline = document.querySelector('#wishlist-tagline');
if (tagline) {
  const messages = [
    { text: 'Stuff I Definitely Don’t Need' },
    { text: 'Things Future Me Will Regret Buying' },
    { text: 'My Ongoing Financial Mistakes' },
    { text: 'Things I Need. Need is a strong word.', italic: true },
    { text: 'Future Packages on My Porch' },
    { text: 'Stuff I’ll Buy Eventually… Probably' },
    { text: 'Things I Absolutely Need According to Me' },
    { text: 'Proof I Have No Self-Control' },
  ];
  let currentIndex = Math.floor(Math.random() * messages.length);

  const renderTagline = (message) => {
    const content = message.italic ? document.createElement('em') : document.createTextNode(message.text);
    if (message.italic) content.textContent = message.text;
    tagline.replaceChildren(content);
  };

  renderTagline(messages[currentIndex]);

  const showRandomTagline = () => {
    let nextIndex;
    do nextIndex = Math.floor(Math.random() * messages.length);
    while (nextIndex === currentIndex);

    tagline.classList.add('is-changing');
    window.setTimeout(() => {
      renderTagline(messages[nextIndex]);
      tagline.classList.remove('is-changing');
      currentIndex = nextIndex;
    }, 240);
  };

  window.setInterval(showRandomTagline, 5000);
}
