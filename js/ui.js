/**
 * @file ui.js
 * @description Manages all UI-related tasks, including theme toggling, modal visibility,
 * and the thumbnail hover tooltip.
 */

// ── Theme Management ──────────────────────────────────────────────────────

let _isLight_theme_state = false;

/**
 * Toggles the 'light' class on the document root and updates local storage.
 */
function toggleTheme() {
  _isLight_theme_state = !_isLight_theme_state;
  document.documentElement.classList.toggle('light', _isLight_theme_state);
  document.getElementById('theme-icon').textContent = _isLight_theme_state ? '☾' : '☀';
  document.getElementById('theme-label').textContent = _isLight_theme_state ? 'Dark' : 'Light';
  try { localStorage.setItem('yt-fader-theme', _isLight_theme_state ? 'light' : 'dark'); } catch(e) {}
}

/**
 * Restores the theme from local storage on initial load.
 */
function initTheme() {
  try {
    if (localStorage.getItem('yt-fader-theme') === 'light') toggleTheme();
  } catch(e) {}
}

// ── Modals ────────────────────────────────────────────────────────────────

let confirmCb = null; // Stashes the function to call if a 'confirm' modal is accepted

/**
 * Shows the Save/Load modal.
 */
function openSaveLoadModal() {
  document.getElementById('save-load-modal').classList.add('visible');
}

/**
 * Hides the Save/Load modal.
 */
function closeSaveLoadModal() {
  document.getElementById('save-load-modal').classList.remove('visible');
}

/**
 * Generic confirmation dialog.
 * @param {string} title - Title of the modal.
 * @param {string} msg - Body message.
 * @param {string} okLabel - Text for the confirm button.
 * @param {function} cb - Action to perform if confirmed.
 */
function showConfirm(title, msg, okLabel, cb) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = msg;
  document.getElementById('confirm-ok-btn').textContent = okLabel;
  confirmCb = cb;
  document.getElementById('confirm-modal').classList.add('visible');
}

/**
 * Closes the confirmation modal and executes the callback if confirmed.
 * @param {boolean} confirmed - Whether the OK button was pressed.
 */
function closeConfirm(confirmed) {
  document.getElementById('confirm-modal').classList.remove('visible');
  if (confirmed && confirmCb) confirmCb();
  confirmCb = null;
}

// ── Thumbnail Tooltip ─────────────────────────────────────────────────────

/**
 * Shows the thumbnail tooltip at a specific X, Y position.
 * @param {string} videoId - YouTube ID for image fetching.
 * @param {number} x - Client X coordinate.
 * @param {number} y - Client Y coordinate.
 */
function showThumb(videoId, x, y) {
  const img = document.getElementById('thumb-img');
  // Use Medium Quality thumbnail
  img.src = 'https://img.youtube.com/vi/' + videoId + '/mqdefault.jpg';
  positionThumb(x, y);
  document.getElementById('thumb-tooltip').style.display = 'block';
}

/**
 * Updates the position of the tooltip to track the mouse.
 * @param {number} x - Client X coordinate.
 * @param {number} y - Client Y coordinate.
 */
function positionThumb(x, y) {
  const tt = document.getElementById('thumb-tooltip');
  // Keep tooltip within viewport bounds
  const left = Math.min(x + 14, window.innerWidth - 256);
  const top = Math.max(y - 145, 8);
  tt.style.left = left + 'px';
  tt.style.top = top + 'px';
}

/**
 * Hides the thumbnail tooltip.
 */
function hideThumb() {
  document.getElementById('thumb-tooltip').style.display = 'none';
}

/**
 * Updates the CSS background of a slider to show a "fill" effect.
 * @param {HTMLInputElement} slider - The range input element.
 */
function updateSliderFill(slider) {
  if (!slider) return;
  const pct = (slider.value - slider.min) / (slider.max - slider.min) * 100;
  slider.style.setProperty('--fill-pct', pct + '%');
}
