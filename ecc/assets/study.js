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
  const scope = document.querySelector('.scope-form select');
  if (scope) {
    scope.addEventListener('change', () => {
      if (window.matchMedia('(max-width: 759px)').matches) scope.form.requestSubmit();
    });
    scope.form.classList.add('mobile-auto-load');
  }
  const root = document.querySelector('#study'); if (!root) return;
  const topics = JSON.parse(document.querySelector('#study-data').textContent);
  const mode = root.dataset.mode;
  const entries = topics.flatMap(topic => (topic[mode === 'cards' ? 'flashcards' : 'quiz'] || []).map(item => ({ ...item, topicTitle: topic.title, status: topic.status })));
  const poolData = document.querySelector('#quiz-topic-pool');
  const quizTopics = poolData ? JSON.parse(poolData.textContent) : topics;
  const alphabetSlugs = ['phonetic-alphabet', 'phonetic-alphabet-police'];
  const alphabets = quizTopics.filter(topic => alphabetSlugs.includes(topic.slug));
  const alphabetWords = topic => topic.sections.flatMap(section => section.items || []);
  function shuffle(values) {
    const result = [...values];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
  function randomizeQuizChoices() {
    if (mode !== 'quiz') return;
    let offset = 0;
    topics.forEach(topic => {
      const isAlphabet = alphabetSlugs.includes(topic.slug);
      topic.quiz.forEach(question => {
        const entry = entries[offset++];
        const correct = question.choices[question.correctIndex];
        const ownWord = isAlphabet ? alphabetWords(topic).find(word => word.text === correct) : null;
        const other = alphabets.find(alphabet => alphabet.slug !== topic.slug);
        const alternate = ownWord && other ? alphabetWords(other).find(word => word.label === ownWord.label)?.text : null;
        const distinctAlternate = alternate && alternate !== correct ? alternate : null;
        const candidates = isAlphabet
          ? alphabets.flatMap(alphabet => alphabetWords(alphabet).map(word => word.text))
          : topic.quiz.flatMap(item => item.choices);
        const wrong = shuffle([...new Set(candidates)].filter(word => word !== correct && word !== distinctAlternate));
        const distractors = distinctAlternate && Math.random() < 0.75 ? [distinctAlternate] : [];
        distractors.push(...wrong.slice(0, question.choices.length - 1 - distractors.length));
        entry.choices = shuffle([correct, ...distractors]);
        entry.correctIndex = entry.choices.indexOf(correct);
      });
    });
  }
  randomizeQuizChoices();
  let position = 0; let score = 0; let revealed = false; let submitted = false; let attempted = false; let selected = null; let finished = false;
  let answerStyle = new URLSearchParams(window.location.search).get('answer') === 'typed' ? 'typed' : 'multiple';
  const formatOptions = document.querySelectorAll('[name="quiz-format"]');
  const formatField = document.createElement('input'); formatField.type = 'hidden'; formatField.name = 'answer'; formatField.value = answerStyle;
  if (mode === 'quiz' && scope) scope.form.append(formatField);
  formatOptions.forEach(option => {
    option.checked = option.value === answerStyle;
    option.addEventListener('change', () => {
      answerStyle = option.value; formatField.value = answerStyle;
      const url = new URL(window.location.href); url.searchParams.set('answer', answerStyle); window.history.replaceState(null, '', url);
      position = 0; score = 0; submitted = false; attempted = false; selected = null; finished = false;
      randomizeQuizChoices(); render();
    });
  });
  function normalizeAnswer(value) { return value.trim().toLocaleLowerCase().replace(/[‐‑–—]/g, '-').replace(/\s+/g, ' '); }
  function el(tag, text, className) { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; }
  function button(text, action, secondary = false) { const b = el('button', text, secondary ? 'button secondary' : 'button'); b.type = 'button'; b.addEventListener('click', action); return b; }
  function heading(text) { const h = el('h2', text); h.tabIndex = -1; return h; }
  function render(focus = false) {
    root.replaceChildren();
    if (!entries.length) { root.append(heading('No practice material yet'), el('p', 'This topic has reference notes, but no questions yet. Choose another topic or return to the library.')); return; }
    if (finished) {
      root.append(el('span', 'SESSION COMPLETE', 'eyebrow'), heading('Practice complete'), el('p', `${score} of ${entries.length} correct on the first try`, 'score'), el('p', 'Review the reference and try again whenever you’re ready.'), button('Try again', () => { position = 0; score = 0; submitted = false; attempted = false; selected = null; finished = false; randomizeQuizChoices(); render(true); }));
    } else {
      const item = entries[position];
      root.append(el('p', `${mode === 'cards' ? 'Card' : 'Question'} ${position + 1} of ${entries.length} · ${item.topicTitle}`, 'progress-label'));
      const progress = document.createElement('progress'); progress.max = entries.length; progress.value = position + 1; progress.setAttribute('aria-label', 'Session progress'); root.append(progress);
      root.append(heading(item.question));
      if (mode === 'cards') {
        const answer = el('p', item.answer, 'answer'); answer.hidden = !revealed; root.append(answer);
        const reveal = button(revealed ? 'Hide answer' : 'Reveal answer', () => { revealed = !revealed; render(); root.querySelector('[aria-expanded]').focus(); }); reveal.setAttribute('aria-expanded', String(revealed)); root.append(reveal);
        const controls = el('div', undefined, 'study-controls');
        const previous = button('← Previous', () => { position--; revealed = false; render(true); }, true); previous.disabled = position === 0;
        const next = button(position === entries.length - 1 ? 'Start again ↻' : 'Next card →', () => { position = (position + 1) % entries.length; revealed = false; render(true); }, true);
        controls.append(previous, next); root.append(controls);
      } else {
        const choices = el('fieldset'); choices.append(el('legend', 'Choose one answer', 'visually-hidden'));
        const status = el('span', '', 'visually-hidden'); status.setAttribute('role', 'status');
        const next = button(position === entries.length - 1 ? 'See results' : 'Next question →', () => {
          if (!submitted) return;
          if (position === entries.length - 1) finished = true; else position++;
          submitted = false; attempted = false; selected = null; render(true);
        });
        next.disabled = !submitted;
        if (answerStyle === 'typed') {
          const form = el('form', undefined, 'typed-form');
          const label = el('label', 'Your answer'); label.htmlFor = 'typed-answer';
          const input = el('input'); input.id = 'typed-answer'; input.type = 'text'; input.required = true;
          input.autocomplete = 'off'; input.spellcheck = false; input.setAttribute('autocapitalize', 'none');
          const feedback = el('p', '', 'typed-feedback'); feedback.setAttribute('role', 'status');
          const submit = el('button', 'Submit', 'button'); submit.type = 'submit';
          input.addEventListener('input', () => { input.classList.remove('typed-wrong'); feedback.textContent = ''; });
          form.addEventListener('submit', event => {
            event.preventDefault(); if (submitted || !input.value.trim()) return;
            const correct = normalizeAnswer(input.value) === normalizeAnswer(item.choices[item.correctIndex]);
            input.classList.toggle('typed-correct', correct); input.classList.toggle('typed-wrong', !correct);
            feedback.textContent = correct ? '✓ Correct' : '✕ Incorrect — try again';
            feedback.className = `typed-feedback ${correct ? 'is-correct' : 'is-wrong'}`;
            if (correct) {
              if (!attempted) score++;
              submitted = true; next.disabled = false; input.disabled = true; submit.disabled = true; next.focus();
            } else input.focus();
            attempted = true;
          });
          form.append(label, input, feedback, submit); root.append(form, next);
        } else {
        item.choices.forEach((choice, index) => {
          const label = el('label', undefined, 'choice'); const input = document.createElement('input');
          input.type = 'radio'; input.name = 'answer'; input.value = index; input.checked = selected === index; input.disabled = submitted;
          const mark = el('span', '', 'choice-mark'); mark.setAttribute('aria-hidden', 'true');
          input.addEventListener('change', () => {
            if (submitted) return;
            selected = index;
            const correct = index === item.correctIndex;
            label.classList.add(correct ? 'choice-correct' : 'choice-wrong');
            mark.textContent = correct ? '✓' : '✕';
            input.setAttribute('aria-label', `${choice}: ${correct ? 'Correct' : 'Incorrect'}`);
            status.textContent = correct ? 'Correct. You can continue.' : 'Incorrect. Choose another answer.';
            if (correct) {
              if (!attempted) score++;
              submitted = true; next.disabled = false;
              choices.querySelectorAll('input').forEach(option => { option.disabled = true; });
            }
            attempted = true;
          });
          label.append(input, el('span', choice), mark); choices.append(label);
        });
        root.append(choices, status, next);
        }
      }
    }
    if (focus) root.querySelector('h2')?.focus();
  }
  render();
})();
