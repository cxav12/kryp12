const picker = document.querySelector("#color-picker");
const openPickerButton = document.querySelector("#open-color-picker");
const hexField = document.querySelector("#hex-value");
const fullscreenButton = document.querySelector("#fullscreen-button");
const exitButton = document.querySelector("#exit-fullscreen-button");
const showExitButton = document.querySelector("#show-exit-button");
const escapeMessage = document.querySelector("#escape-message");
const message = document.querySelector("#fullscreen-message");
const root = document.documentElement;
const colorCards = [...document.querySelectorAll("[data-color]")];
const HEX_PATTERN = /^#[0-9A-F]{6}$/i;
let selectedColor = "#FFFFFF";

function normalizeHex(value) {
  const candidate = String(value || "").trim();
  return HEX_PATTERN.test(candidate) ? candidate.toUpperCase() : "";
}

function setColor(value) {
  const color = normalizeHex(value);
  if (!color) return false;
  selectedColor = color;
  picker.value = color.toLowerCase();
  hexField.value = color;
  hexField.setAttribute("aria-invalid", "false");
  root.style.setProperty("--screen-color", color);
  colorCards.forEach((card) => card.setAttribute("aria-pressed", String(card.dataset.color === color)));
  return true;
}

colorCards.forEach((card) => card.addEventListener("click", () => { setColor(card.dataset.color); message.textContent = ""; }));
openPickerButton.addEventListener("click", () => {
  try {
    if (typeof picker.showPicker === "function") picker.showPicker();
    else picker.click();
  } catch (_) {
    message.textContent = "The color picker could not be opened in this browser.";
  }
});
picker.addEventListener("input", () => { setColor(picker.value); message.textContent = ""; });
hexField.addEventListener("input", () => { const valid = setColor(hexField.value); hexField.setAttribute("aria-invalid", String(!valid)); });
hexField.addEventListener("blur", () => {
  if (!setColor(hexField.value)) { hexField.value = selectedColor; hexField.setAttribute("aria-invalid", "false"); }
});

fullscreenButton.addEventListener("click", async () => {
  message.textContent = "";
  if (typeof root.requestFullscreen !== "function") { message.textContent = "Full screen is not supported by this browser."; return; }
  try { await root.requestFullscreen(); }
  catch (_) { message.textContent = "Full screen could not be opened. Check your browser permissions and try again."; }
});

exitButton.addEventListener("click", async () => {
  if (!document.fullscreenElement || typeof document.exitFullscreen !== "function") return;
  try { await document.exitFullscreen(); }
  catch (_) { message.textContent = "Full screen could not be closed automatically. Press Esc to exit."; }
});

function updateExitPreference() {
  const showExit = showExitButton.checked;
  escapeMessage.hidden = showExit;
  exitButton.hidden = !document.fullscreenElement || !showExit;
  exitButton.setAttribute("aria-hidden", String(exitButton.hidden));
}

showExitButton.addEventListener("change", updateExitPreference);

document.addEventListener("fullscreenchange", () => {
  const active = Boolean(document.fullscreenElement);
  root.classList.toggle("is-color-fullscreen", active);
  updateExitPreference();
  if (!active) fullscreenButton.focus();
});

setColor(selectedColor);
updateExitPreference();
