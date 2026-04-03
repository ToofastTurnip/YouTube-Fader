/**
 * @file storage.js
 * @description Handles all data persistence using LocalStorage and file-based export/import.
 * Responsible for saving sessions, managing the auto-save state, and triggering JSON downloads.
 */

// ── Session / Persistence State ──────────────────────────────────────────
let _sessions_storage_cache = [];

/**
 * Loads the list of saved sessions from local storage.
 * @returns {Array} The list of sessions.
 */
function loadSessionsFromStorage() {
  try {
    const raw = localStorage.getItem('yt-fader-sessions');
    _sessions_storage_cache = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(_sessions_storage_cache)) _sessions_storage_cache = [];
  } catch(e) { _sessions_storage_cache = []; }
  return _sessions_storage_cache;
}

/**
 * Saves the provided list of sessions to local storage.
 * @param {Array} updatedSessions - The new list of sessions to persist.
 */
function saveSessionsToStorage(updatedSessions) {
  _sessions_storage_cache = updatedSessions;
  try {
    localStorage.setItem('yt-fader-sessions', JSON.stringify(_sessions_storage_cache));
  } catch(e) {}
}

/**
 * Persists the current application state (decks and playlist) to an auto-save slot.
 * @param {Object} state - The serialized state of the application.
 */
function autoSave(state) {
  try {
    localStorage.setItem('yt-fader-autosave', JSON.stringify(state));
  } catch(e) {}
}

/**
 * Retrieves the auto-saved state from local storage.
 * @returns {Object|null} The saved state or null if none exists.
 */
function getAutoSave() {
  try {
    const raw = localStorage.getItem('yt-fader-autosave');
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

// ── File Export/Import ────────────────────────────────────────────────────

/**
 * Triggers a browser download of a JSON file.
 * @param {string} filename - Name of the file.
 * @param {Object} data - The data to serialize as JSON.
 */
function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

/**
 * Exports a single session as a JSON file.
 * @param {Object} session - The session object to export.
 */
function exportSession(session) {
  const safe = session.name.replace(/[^a-z0-9_\-]/gi, '_') || 'session';
  downloadJson(safe + '.json', {
    name: session.name,
    deckA: session.deckA,
    deckB: session.deckB,
    playlist: session.playlist
  });
}

/**
 * Exports all saved sessions as a single JSON array file.
 * @param {Array} sessionsToExport - The list of sessions.
 */
function exportAllSessions(sessionsToExport) {
  if (!sessionsToExport.length) {
    alert('No saved sessions to export.');
    return;
  }
  downloadJson('yt-fader-sessions.json', sessionsToExport);
}
