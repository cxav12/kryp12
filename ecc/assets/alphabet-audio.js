(() => {
  'use strict';
  const button = document.querySelector('#alphabet-read');
  const status = document.querySelector('#alphabet-audio-status');
  if (!button || !status) return;
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    status.textContent = 'Alphabet audio is unavailable in this browser.';
    return;
  }
  const words = [...document.querySelectorAll('.topic-layout article .reference-grid dd')]
    .map(item => item.textContent.trim()).filter(Boolean);
  if (!words.length) return;
  const synth = window.speechSynthesis;
  let playing = false;
  let session = 0;
  let timer;
  let utterance;
  function stop(message = '') {
    session++;
    playing = false;
    clearTimeout(timer);
    synth.cancel();
    utterance = null;
    button.textContent = 'Play alphabet';
    status.textContent = message;
  }
  function readWord(index, currentSession) {
    if (!playing || currentSession !== session) return;
    if (index >= words.length) {
      stop('Finished reading A–Z.');
      return;
    }
    utterance = new window.SpeechSynthesisUtterance(words[index]);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    const voices = synth.getVoices();
    const voice = voices.find(item => item.lang === 'en-US' && item.localService)
      || voices.find(item => item.lang === 'en-US');
    if (voice) utterance.voice = voice;
    utterance.onend = () => {
      if (playing && currentSession === session) {
        timer = setTimeout(() => readWord(index + 1, currentSession), 250);
      }
    };
    utterance.onerror = () => {
      if (playing && currentSession === session) {
        stop('Unable to play audio. Try again or use another browser.');
      }
    };
    try {
      synth.speak(utterance);
    } catch {
      stop('Unable to play audio. Try again or use another browser.');
    }
  }
  button.hidden = false;
  button.addEventListener('click', () => {
    if (playing) {
      stop('Reading stopped.');
      return;
    }
    stop();
    playing = true;
    button.textContent = 'Stop';
    status.textContent = 'Reading A–Z…';
    readWord(0, session);
  });
  window.addEventListener('pagehide', () => stop());
})();
