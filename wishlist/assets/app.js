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
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
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
  const currentIndex = Math.floor(Math.random() * messages.length);

  const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

  const createTaglineContent = (message) => {
    const content = message.italic ? document.createElement('em') : document.createTextNode(message.text);
    if (message.italic) content.textContent = message.text;
    return content;
  };

  const showTagline = async (message, transition = true) => {
    if (reducedMotion.matches) {
      tagline.replaceChildren(createTaglineContent(message));
      return;
    }

    if (transition) {
      tagline.classList.add('is-changing');
      await wait(180);
    }

    const content = createTaglineContent({ ...message, text: '' });
    tagline.replaceChildren(content);
    tagline.classList.remove('is-changing');
    tagline.classList.add('is-typing');

    for (const character of message.text) {
      content.textContent += character;
      await wait(character === '.' || character === '…' ? 90 : 26);
    }

    tagline.classList.remove('is-typing');
  };

  showTagline(messages[currentIndex], false);
}
