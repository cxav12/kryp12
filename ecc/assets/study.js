(() => {
  'use strict';
  const search = document.querySelector('#search');
  if (search) {
    const filter = () => {
      const q = search.value.trim().toLocaleLowerCase(); let count = 0;
      document.querySelectorAll('[data-search]').forEach(row => { row.hidden = !row.dataset.search.toLocaleLowerCase().includes(q); if (!row.hidden) count++; });
      document.querySelectorAll('.category').forEach(group => { group.hidden = ![...group.querySelectorAll('[data-search]')].some(row => !row.hidden); });
      document.querySelector('#empty-search').hidden = count > 0;
      document.querySelector('#search-status').textContent = q ? `${count} matching ${count === 1 ? 'topic' : 'topics'}` : '';
    };
    search.addEventListener('input', filter); filter();
    search.form.addEventListener('submit', event => { event.preventDefault(); filter(); });
  }
  const root = document.querySelector('#study'); if (!root) return;
  const topics = JSON.parse(document.querySelector('#study-data').textContent);
  const mode = root.dataset.mode;
  const entries = topics.flatMap(topic => (topic[mode === 'cards' ? 'flashcards' : 'quiz'] || []).map(item => ({ ...item, topicTitle: topic.title, status: topic.status })));
  let position = 0; let score = 0; let revealed = false; let submitted = false; let selected = null; let finished = false;
  function el(tag, text, className) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; }
  function button(text, action, secondary = false) { const b = el('button', text, secondary ? 'button secondary' : 'button'); b.type = 'button'; b.addEventListener('click', action); return b; }
  function heading(text) { const h = el('h2', text); h.tabIndex = -1; return h; }
  function render(focus = false) {
    root.replaceChildren();
    if (!entries.length) { root.append(heading('No practice material yet'), el('p', 'This topic has reference notes, but no questions yet. Choose another topic or return to the library.')); return; }
    if (finished) {
      root.append(el('span', 'SESSION COMPLETE', 'eyebrow'), heading('Practice complete'), el('p', `${score} of ${entries.length} correct`, 'score'), el('p', 'Review the reference and try again whenever you’re ready.'), button('Try again', () => { position = 0; score = 0; submitted = false; selected = null; finished = false; render(true); }));
    } else {
      const item = entries[position];
      root.append(el('p', `${mode === 'cards' ? 'Card' : 'Question'} ${position + 1} of ${entries.length} · ${item.topicTitle}`, 'progress-label'));
      const progress = document.createElement('progress'); progress.max = entries.length; progress.value = position + 1; progress.setAttribute('aria-label', 'Session progress'); root.append(progress);
      root.append(el('span', item.status === 'department-approved' ? 'Department approved' : 'General reference · confirm with your ECC', 'pill'), heading(item.question));
      if (mode === 'cards') {
        const answer = el('p', item.answer, 'answer'); answer.hidden = !revealed; root.append(answer);
        const reveal = button(revealed ? 'Hide answer' : 'Reveal answer', () => { revealed = !revealed; render(); root.querySelector('[aria-expanded]').focus(); }); reveal.setAttribute('aria-expanded', String(revealed)); root.append(reveal);
        const controls = el('div', undefined, 'study-controls');
        const previous = button('← Previous', () => { position--; revealed = false; render(true); }, true); previous.disabled = position === 0;
        const next = button(position === entries.length - 1 ? 'Start again ↻' : 'Next card →', () => { position = (position + 1) % entries.length; revealed = false; render(true); }, true);
        controls.append(previous, next); root.append(controls);
      } else {
        const form = el('form'); const choices = el('fieldset'); choices.append(el('legend', 'Choose one answer', 'visually-hidden'));
        item.choices.forEach((choice, index) => {
          const label = el('label', undefined, 'choice'); const input = document.createElement('input'); input.type = 'radio'; input.name = 'answer'; input.value = index; input.required = true; input.checked = selected === index; input.disabled = submitted;
          input.addEventListener('change', () => { selected = index; });
          label.append(input, el('span', choice)); choices.append(label);
        });
        form.append(choices);
        if (!submitted) { const check = el('button', 'Check answer', 'button'); check.type = 'submit'; form.append(check); }
        form.addEventListener('submit', event => { event.preventDefault(); if (selected === null || submitted) return; submitted = true; if (selected === item.correctIndex) score++; render(true); });
        root.append(form);
        if (submitted) {
          const feedback = el('div', undefined, 'feedback'); feedback.setAttribute('role', 'status');
          feedback.append(el('strong', selected === item.correctIndex ? 'Correct.' : `Correct answer: ${item.choices[item.correctIndex]}`), el('p', item.explanation)); root.append(feedback);
          root.append(button(position === entries.length - 1 ? 'See results' : 'Next question →', () => { if (position === entries.length - 1) finished = true; else position++; submitted = false; selected = null; render(true); }));
        }
      }
    }
    if (focus) root.querySelector('h2')?.focus();
  }
  render();
})();
