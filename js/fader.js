/**
 * @file fader.js
 * @description Implements the crossfade logic between two YouTube players.
 * It uses a periodic interval to adjust volumes over a specified duration,
 * providing a smooth transition from one audio source to another.
 */

// ── Fader State ───────────────────────────────────────────────────────────
let fadeInterval = null;      // Holds the reference to the setInterval timer
let fadeOutNum = null;        // Which deck is fading OUT (1 or 2)
let fadeInNum = null;         // Which deck is fading IN (1 or 2)
let fadeStartVol = 0;         // Initial volume of the player being faded out
let fadeTargetVol = 0;        // Final volume of the player being faded in
let fadeStartTime = 0;        // Timestamp when the fade started
let fadeDurationMs = 0;       // Total duration of the fade in milliseconds

/**
 * Checks if a fade operation is currently active.
 * @returns {boolean}
 */
function isFading() {
  return fadeInterval !== null;
}

/**
 * Begins the crossfade process between two players.
 * @param {Object} player1 - The YT.Player instance for Deck A.
 * @param {Object} player2 - The YT.Player instance for Deck B.
 * @param {function} updateUI - Callback to refresh UI elements.
 * @param {function} finishFadeCallback - Callback when fade completes.
 */
function startFade(player1, player2, updateUI, finishFadeCallback) {
  if (fadeInterval) return; // Prevent overlapping fades

  const s1 = player1 ? player1.getPlayerState() : -1;
  const s2 = player2 ? player2.getPlayerState() : -1;
  const P = window.YT.PlayerState;

  // Determine direction: which one is playing?
  if (s1 === P.PLAYING) {
    fadeOutNum = 1;
    fadeInNum = 2;
  } else if (s2 === P.PLAYING) {
    fadeOutNum = 2;
    fadeInNum = 1;
  } else return; // Neither playing? Nothing to fade.

  const outPlayer = fadeOutNum === 1 ? player1 : player2;
  const inPlayer = fadeInNum === 1 ? player1 : player2;

  if (!outPlayer || !inPlayer) return;

  // Capture starting parameters
  fadeStartVol = outPlayer.getVolume();
  const rawTarget = parseInt(document.getElementById('vol' + fadeInNum).value, 10);
  fadeTargetVol = (isNaN(rawTarget) || rawTarget <= 0) ? 100 : rawTarget;
  fadeDurationMs = Math.max(1000, Math.min(60000,
    (parseFloat(document.getElementById('fade-duration').value) || 5) * 1000));
  fadeStartTime = Date.now();

  // Prepare the 'In' player
  inPlayer.setVolume(0);
  document.getElementById('vol' + fadeInNum).value = 0;
  document.getElementById('vol' + fadeInNum + '-display').textContent = '0%';
  inPlayer.playVideo();

  // Update UI state
  const fadeBtn = document.getElementById('fade-btn');
  fadeBtn.disabled = true;
  fadeBtn.classList.add('fading');
  fadeBtn.textContent = 'FADING\u2026';
  document.getElementById('fade-progress-wrap').style.display = 'block';

  // Run the tick function at high frequency for smooth audio ramping
  fadeInterval = setInterval(() => {
    tickFade(player1, player2, updateUI, finishFadeCallback);
  }, 50);
}

/**
 * Calculated adjustment for each interval tick.
 */
function tickFade(player1, player2, updateUI, finishFadeCallback) {
  const elapsed = Date.now() - fadeStartTime;
  const progress = Math.min(elapsed / fadeDurationMs, 1);
  
  // Linear ramp
  const outVol = Math.round(fadeStartVol * (1 - progress));
  const inVol = Math.round(fadeTargetVol * progress);

  const outPlayer = fadeOutNum === 1 ? player1 : player2;
  const inPlayer = fadeInNum === 1 ? player1 : player2;

  outPlayer.setVolume(outVol);
  inPlayer.setVolume(inVol);

  // Sync range inputs and displays
  document.getElementById('vol' + fadeOutNum).value = outVol;
  document.getElementById('vol' + fadeOutNum + '-display').textContent = outVol + '%';
  document.getElementById('vol' + fadeInNum).value = inVol;
  document.getElementById('vol' + fadeInNum + '-display').textContent = inVol + '%';

  // Update progress bar
  const pct = Math.round(progress * 100);
  document.getElementById('fade-progress-fill').style.width = pct + '%';
  document.getElementById('fade-progress-label').textContent = pct + '%';

  if (progress >= 1) {
    finishFade(player1, player2, updateUI, finishFadeCallback);
  }
}

/**
 * Cleanup after a fade completes.
 */
function finishFade(player1, player2, updateUI, finishFadeCallback) {
  clearInterval(fadeInterval);
  fadeInterval = null;

  const outPlayer = fadeOutNum === 1 ? player1 : player2;
  outPlayer.pauseVideo();
  outPlayer.setVolume(fadeStartVol); // Reset volume for next use

  document.getElementById('vol' + fadeOutNum).value = fadeStartVol;
  document.getElementById('vol' + fadeOutNum + '-display').textContent = fadeStartVol + '%';
  document.getElementById('fade-progress-wrap').style.display = 'none';
  document.getElementById('fade-progress-fill').style.width = '0%';
  document.getElementById('fade-progress-label').textContent = '0%';

  fadeOutNum = fadeInNum = null;
  updateUI();
  if (finishFadeCallback) finishFadeCallback();
}
