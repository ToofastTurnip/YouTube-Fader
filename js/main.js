/**
 * @file main.js
 * @description The orchestrator of the YouTube Fader application. 
 * This file is responsible for:
 * 1. Importing and initializing all specialized modules.
 * 2. Maintaining the global state (decks, playlist, sessions).
 * 3. Wiring up all DOM event listeners.
 * 4. Coordinating complex cross-module actions (like dragging from playlist to deck).
 */

// ── Global Application State ──────────────────────────────────────────────
let deckA, deckB, playlist;
let sessions = [];
let isDirty = false;       // Tracks if there are unsaved changes
let currentDrag = null;    // Stores metadata of the item currently being dragged

/**
 * Main entry point. Initializes modules and creates core objects.
 */
function init() {
  initTheme();
  initYouTubeAPI();
  sessions = loadSessionsFromStorage();

  // Configuration for Deck A and Deck B
  const commonDeckOptions = {
    onUpdate: () => { markDirty(); updateUI(); },
    onStateChange: () => updateUI(),
    onFetchInfo: fetchVideoInfo,
    onDragStart: (e, info, num) => {
      currentDrag = { source: 'deck', deckNum: num, ...info };
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', JSON.stringify(currentDrag));
    },
    onDragEnd: () => { currentDrag = null; },
    onDrop: {
      over: (e, box) => {
        if (currentDrag && currentDrag.source === 'playlist') {
          e.preventDefault();
          box.classList.add('drop-active');
        }
      },
      leave: (box) => box.classList.remove('drop-active'),
      drop: (e, num, box) => {
        e.preventDefault();
        e.stopPropagation();
        box.classList.remove('drop-active');
        if (currentDrag && currentDrag.source === 'playlist') {
          const fromIdx = playlist.findIndexByUid(currentDrag.uid);
          const deck = num === 1 ? deckA : deckB;
          const existing = deck.info;

          // If deck already has a track, swap it back into the playlist slot
          if (existing && existing.id && fromIdx >= 0) {
            playlist.items.splice(fromIdx, 1, {
              uid: ++playlist.seq,
              id: existing.id,
              title: existing.title,
              originalTitle: existing.originalTitle || existing.title,
              author: existing.author || '',
              volume: parseInt(document.getElementById('vol' + num).value, 10)
            });
            playlist.render();
          } else {
            playlist.remove(currentDrag.uid);
          }
          
          // Load video and set volume
          deck.loadVideo(currentDrag.id, currentDrag.title, currentDrag.author, currentDrag.originalTitle);
          const volSlider = document.getElementById('vol' + num);
          volSlider.value = currentDrag.volume;
          deck.setVolume(currentDrag.volume);
          
          document.getElementById('url' + num).value = 'https://www.youtube.com/watch?v=' + currentDrag.id;
        }
        currentDrag = null;
      }
    },
    onClear: () => updateUI()
  };

  // Instantiate the decks
  deckA = new Deck(1, commonDeckOptions);
  deckB = new Deck(2, commonDeckOptions);

  // Instantiate the playlist
  playlist = new Playlist({
    onUpdate: () => { markDirty(); },
    onFetchInfo: fetchVideoInfo,
    onDragStart: (e, item, el) => {
      currentDrag = { source: 'playlist', ...item };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', JSON.stringify(currentDrag));
      setTimeout(() => el.classList.add('dragging'), 0);
    },
    onDragEnd: (el) => {
      el.classList.remove('dragging');
      clearDragIndicators();
      currentDrag = null;
    },
    onDrop: {
      over: (e, item, el) => {
        if (!currentDrag || currentDrag.source !== 'playlist') return;
        if (currentDrag.uid === item.uid) return;
        e.preventDefault();
        clearDragIndicators();
        const pos = getDragYPos(e, el);
        el.classList.add(pos === 'before' ? 'drop-before' : 'drop-after');
      },
      leave: (el) => el.classList.remove('drop-before', 'drop-after'),
      drop: (e, item, el) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('drop-before', 'drop-after');
        if (!currentDrag) return;

        if (currentDrag.source === 'playlist' && currentDrag.uid !== item.uid) {
          // Reordering within playlist
          const fromIdx = playlist.findIndexByUid(currentDrag.uid);
          const toIdx = playlist.findIndexByUid(item.uid);
          if (fromIdx < 0 || toIdx < 0) return;
          const pos = getDragYPos(e, el);
          let insertAt = pos === 'before' ? toIdx : toIdx + 1;
          const moved = playlist.items.splice(fromIdx, 1)[0];
          if (fromIdx < insertAt) insertAt--;
          playlist.items.splice(insertAt, 0, moved);
          playlist.render();
          markDirty();
        } else if (currentDrag.source === 'deck') {
          // Moving from deck back to a specific position in the playlist
          const toIdx = playlist.findIndexByUid(item.uid);
          const pos = getDragYPos(e, el);
          const deck = currentDrag.deckNum === 1 ? deckA : deckB;
          const deckVol = parseInt(document.getElementById('vol' + currentDrag.deckNum).value, 10);
          
          playlist.insert(currentDrag.id, currentDrag.title, currentDrag.author,
            pos === 'before' ? toIdx : toIdx + 1, currentDrag.originalTitle, deckVol);
          deck.clear();
        }
        currentDrag = null;
      }
    },
    onThumbHover: showThumb,
    onThumbLeave: hideThumb,
    onThumbMove: positionThumb
  });

  setupEventListeners();
  setupGlobalDragListeners();

  // YouTube API callback (global)
  window.onYouTubeIframeAPIReady = () => {
    const savedState = getAutoSave();
    if (savedState) applyState(savedState);
    renderSessionList();
  };
}

/**
 * Attaches event listeners to static DOM elements (buttons, inputs).
 */
function setupEventListeners() {
  // Header buttons
  document.querySelector('.header-btn[title="Save and load sessions"]').addEventListener('click', () => {
    updateSaveButtonState();
    openSaveLoadModal();
  });
  document.querySelector('.header-btn.danger').addEventListener('click', promptClearCurrent);
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // Modal overlays (close when clicking outside)
  document.getElementById('save-load-modal').addEventListener('click', (e) => {
    if (e.target.id === 'save-load-modal') closeSaveLoadModal();
  });
  document.getElementById('confirm-modal').addEventListener('click', (e) => {
    if (e.target.id === 'confirm-modal') closeConfirm(false);
  });

  // Modal close buttons
  document.querySelector('.modal-close').addEventListener('click', closeSaveLoadModal);

  // Deck controls (Load, Play, Volume)
  [1, 2].forEach(num => {
    const deck = num === 1 ? deckA : deckB;
    
    // Find the load button within this deck's panel
    const urlInput = document.getElementById('url' + num);
    const panel = urlInput.closest('.panel');
    const loadBtn = panel.querySelector('.btn-load');
    
    loadBtn.addEventListener('click', () => {
      const url = urlInput.value.trim();
      const id = parseVideoId(url);
      if (!id) { alert('Please enter a valid YouTube video URL.'); return; }
      deck.loadVideo(id);
    });
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const url = urlInput.value.trim();
        const id = parseVideoId(url);
        if (!id) { alert('Please enter a valid YouTube video URL.'); return; }
        deck.loadVideo(id);
      }
    });
    document.getElementById('vol' + num).addEventListener('input', (e) => {
      deck.setVolume(e.target.value);
      markDirty();
    });
    document.getElementById('play-btn' + num).addEventListener('click', () => deck.togglePlay());
  });

  // Center controls
  document.getElementById('fade-btn').addEventListener('click', () => {
    startFade(deckA.player, deckB.player, updateUI, () => markDirty());
  });

  // Playlist controls
  document.querySelector('.playlist-add-row .btn-load').addEventListener('click', addUrlToPlaylist);
  document.getElementById('playlist-url-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addUrlToPlaylist();
  });

  // Modal buttons
  document.getElementById('save-session-btn').addEventListener('click', saveNewSession);
  
  const nameInput = document.getElementById('new-session-name');
  nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !document.getElementById('save-session-btn').disabled) {
      saveNewSession();
    }
  });
  nameInput.addEventListener('input', updateSaveButtonState);
  
  const modalFooterBtns = document.querySelectorAll('.modal-footer .btn');
  modalFooterBtns[0].addEventListener('click', () => document.getElementById('import-file-input').click());
  modalFooterBtns[1].addEventListener('click', () => exportAllSessions(sessions));
  
  document.getElementById('import-file-input').addEventListener('change', (e) => handleImportFile(e.target));

  // Confirm modal buttons
  const confirmBtns = document.querySelectorAll('.confirm-btns .btn');
  confirmBtns[0].addEventListener('click', () => closeConfirm(false));
  document.getElementById('confirm-ok-btn').addEventListener('click', () => closeConfirm(true));

  // Global escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeConfirm(false);
      closeSaveLoadModal();
    }
  });

  // Periodic UI sync (checks player states)
  setInterval(updateUI, 800);
}

/**
 * Handles drag events on the container level (e.g. dropping a deck item anywhere into the playlist).
 */
function setupGlobalDragListeners() {
  const playlistSection = document.getElementById('playlist-section');
  const playlistEmpty = document.getElementById('playlist-empty');

  playlistSection.addEventListener('dragover', (e) => {
    if (!currentDrag) return;
    if (currentDrag.source === 'deck') {
      e.preventDefault();
      playlistEmpty.classList.add('drop-active');
    }
  });
  playlistSection.addEventListener('dragleave', (e) => {
    if (!playlistSection.contains(e.relatedTarget))
      playlistEmpty.classList.remove('drop-active');
  });
  playlistSection.addEventListener('drop', (e) => {
    playlistEmpty.classList.remove('drop-active');
    if (!currentDrag || currentDrag.source !== 'deck') return;
    e.preventDefault();
    const deckNum = currentDrag.deckNum;
    const deck = deckNum === 1 ? deckA : deckB;
    const deckVol = parseInt(document.getElementById('vol' + deckNum).value, 10);
    
    // Append to end with current volume
    playlist.add(currentDrag.id, currentDrag.title, currentDrag.author, currentDrag.originalTitle, deckVol);
    deck.clear();
    currentDrag = null;
  });
}

// ── Core Application Logic ────────────────────────────────────────────────

/**
 * Takes the URL from the playlist input and adds it to the list.
 */
function addUrlToPlaylist() {
  const input = document.getElementById('playlist-url-input');
  const url = input.value.trim();
  const id = parseVideoId(url);
  if (!id) { alert('Please enter a valid YouTube video URL.'); return; }
  input.value = '';
  const item = playlist.add(id, 'Loading\u2026', '');
  fetchVideoInfo(id, (err, info) => {
    const existing = playlist.findByUid(item.uid);
    if (!existing) return;
    existing.title = info ? info.title : ('Video ' + id);
    existing.originalTitle = existing.title;
    existing.author = info ? info.author : '';
    playlist.render();
  });
}

/**
 * Refreshes the global UI state (fade buttons, indicators, and status badges).
 */
function updateUI() {
  if (typeof window.YT === 'undefined' || !window.YT.PlayerState) return;
  const s1 = deckA.getState(), s2 = deckB.getState(), P = window.YT.PlayerState;
  const playing1 = s1 === P.PLAYING;
  const playing2 = s2 === P.PLAYING;
  const inactive1 = s1 === P.PAUSED || s1 === P.CUED || s1 === P.ENDED;
  const inactive2 = s2 === P.PAUSED || s2 === P.CUED || s2 === P.ENDED;
  
  // Can only fade if one is playing and the other is ready/paused
  const canFade = !isFading() && ((playing1 && inactive2) || (playing2 && inactive1));

  const fadeBtn = document.getElementById('fade-btn');
  if (!isFading()) {
    fadeBtn.disabled = !canFade;
    fadeBtn.classList.remove('fading');
    fadeBtn.textContent = 'FADE';
  }

  // Directional indicator arrow
  const ind = document.getElementById('flow-indicator');
  if (playing1 && inactive2) { ind.textContent = '→'; ind.classList.add('active'); }
  else if (playing2 && inactive1) { ind.textContent = '←'; ind.classList.add('active'); }
  else { ind.textContent = '⇄'; ind.classList.remove('active'); }

  updateDeckUI(1, s1);
  updateDeckUI(2, s2);
}

/**
 * Updates the visual status badge and play/pause button for a specific deck.
 */
function updateDeckUI(num, state) {
  const statusEl = document.getElementById('status' + num);
  const playBtn = document.getElementById('play-btn' + num);
  const icon = document.getElementById('play-icon' + num);
  const label = document.getElementById('play-text' + num);
  const P = window.YT.PlayerState;

  switch (state) {
    case P.PLAYING:
      statusEl.className = 'status-badge playing'; statusEl.textContent = 'Playing';
      playBtn.className = 'play-btn playing'; icon.textContent = '⏸'; label.textContent = 'Pause';
      playBtn.disabled = false; break;
    case P.PAUSED:
      statusEl.className = 'status-badge paused'; statusEl.textContent = 'Paused';
      playBtn.className = 'play-btn paused'; icon.textContent = '▶'; label.textContent = 'Play';
      playBtn.disabled = false; break;
    case P.BUFFERING:
      statusEl.className = 'status-badge idle'; statusEl.textContent = 'Loading\u2026';
      playBtn.disabled = true; break;
    case P.CUED:
      statusEl.className = 'status-badge ready'; statusEl.textContent = 'Ready';
      playBtn.className = 'play-btn'; icon.textContent = '▶'; label.textContent = 'Play';
      playBtn.disabled = false; break;
    case P.ENDED:
      statusEl.className = 'status-badge idle'; statusEl.textContent = 'Ended';
      playBtn.className = 'play-btn'; icon.textContent = '▶'; label.textContent = 'Replay';
      playBtn.disabled = false; break;
    default:
      statusEl.className = 'status-badge idle'; statusEl.textContent = 'Idle';
      playBtn.className = 'play-btn'; icon.textContent = '▶'; label.textContent = 'Play';
  }
}

/**
 * Enables or disables the "Save Current" button based on validation.
 */
function updateSaveButtonState() {
  const input = document.getElementById('new-session-name');
  const btn = document.getElementById('save-session-btn');
  const name = input.value.trim();
  
  const alreadyExists = sessions.some(s => s.name.toLowerCase() === name.toLowerCase());
  
  btn.disabled = (name === '' || alreadyExists);
}

// ── Persistence & Session Handling ────────────────────────────────────────

function markDirty() { isDirty = true; autoSave(serializeState()); }
function markClean() { isDirty = false; }

/**
 * Converts current deck and playlist state into a JSON-friendly object.
 */
function serializeState() {
  const serializeDeck = (num) => {
    const deck = (num === 1 ? deckA : deckB);
    if (!deck.info || !deck.info.id) return null;
    const obj = { 
      id: deck.info.id,
      volume: parseInt(document.getElementById('vol' + num).value, 10)
    };
    if (deck.info.originalTitle && deck.info.title !== deck.info.originalTitle) obj.customTitle = deck.info.title;
    return obj;
  };
  return {
    deckA: serializeDeck(1),
    deckB: serializeDeck(2),
    playlist: playlist.items.map(item => {
      const obj = { 
        id: item.id,
        volume: item.volume
      };
      if (item.originalTitle && item.title !== item.originalTitle) obj.customTitle = item.title;
      return obj;
    })
  };
}

/**
 * Reconstructs the application state from a saved object.
 */
function applyState(state) {
  if (!state) return;
  deckA.clear();
  deckB.clear();
  playlist.clear();

  if (state.deckA && state.deckA.id) {
    deckA.loadVideo(state.deckA.id, 'Loading\u2026', '', null, state.deckA.customTitle || null);
    const vol = state.deckA.volume !== undefined ? state.deckA.volume : 100;
    document.getElementById('vol1').value = vol;
    deckA.setVolume(vol);
  }
  if (state.deckB && state.deckB.id) {
    deckB.loadVideo(state.deckB.id, 'Loading\u2026', '', null, state.deckB.customTitle || null);
    const vol = state.deckB.volume !== undefined ? state.deckB.volume : 100;
    document.getElementById('vol2').value = vol;
    deckB.setVolume(vol);
  }

  if (Array.isArray(state.playlist) && state.playlist.length) {
    playlist.setItems(state.playlist.map(item => ({
      id: item.id,
      customTitle: item.customTitle,
      volume: item.volume !== undefined ? item.volume : 100
    })));

    // Background fetch of metadata for playlist items
    playlist.items.forEach(pItem => {
      fetchVideoInfo(pItem.id, (err, info) => {
        const item = playlist.findByUid(pItem.uid);
        if (!item) return;
        const fetched = info ? info.title : ('Video ' + pItem.id);
        const savedCustom = item.customTitle;
        item.originalTitle = fetched;
        item.author = info ? info.author : '';
        item.title = savedCustom || fetched;
        delete item.customTitle;
        playlist.render();
      });
    });
  }
  markClean();
  autoSave(serializeState());
}

/**
 * Creates a named session based on current state.
 */
function saveNewSession() {
  const input = document.getElementById('new-session-name');
  const name = input.value.trim();
  if (!name) { input.focus(); return; }
  const state = serializeState();
  sessions.push({ id: Date.now(), name, createdAt: Date.now(), ...state });
  saveSessionsToStorage(sessions);
  markClean();
  input.value = '';
  updateSaveButtonState();
  renderSessionList();
}

/**
 * Rebuilds the session list inside the modal.
 */
function renderSessionList() {
  const list = document.getElementById('session-list');
  const empty = document.getElementById('session-list-empty');
  const existing = list.querySelectorAll('.session-item');
  existing.forEach(el => list.removeChild(el));

  if (!sessions.length) { empty.style.display = ''; return; }
  empty.style.display = 'none';

  sessions.forEach(session => {
    const item = document.createElement('div');
    item.className = 'session-item';

    const nameEl = document.createElement('span');
    nameEl.className = 'session-item-name';
    nameEl.textContent = session.name;

    const loadBtn = document.createElement('button');
    loadBtn.className = 'session-item-btn';
    loadBtn.textContent = 'Load';
    loadBtn.onclick = () => {
      if (!isDirty) { applyState(session); closeSaveLoadModal(); return; }
      showConfirm('Load Session', `Loading "${session.name}" will replace your unsaved changes. Continue?`, 'Load', () => {
        applyState(session);
        closeSaveLoadModal();
      });
    };

    const expBtn = document.createElement('button');
    expBtn.className = 'session-item-btn';
    expBtn.title = 'Export as JSON';
    expBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';
    expBtn.onclick = () => exportSession(session);

    const delBtn = document.createElement('button');
    delBtn.className = 'session-item-btn del';
    delBtn.title = 'Delete session';
    delBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>';
    delBtn.onclick = () => {
      showConfirm('Delete Session', `Delete "${session.name}"? This cannot be undone.`, 'Delete', () => {
        sessions = sessions.filter(s => s.id !== session.id);
        saveSessionsToStorage(sessions);
        updateSaveButtonState();
        renderSessionList();
      });
    };

    item.appendChild(nameEl);
    item.appendChild(loadBtn);
    item.appendChild(expBtn);
    item.appendChild(delBtn);
    list.appendChild(item);
  });
}

/**
 * Handles JSON file import for sessions.
 */
function handleImportFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const toImport = Array.isArray(data) ? data : [data];
      let added = 0;
      toImport.forEach(s => {
        if (!s || !Array.isArray(s.playlist)) return;
        sessions.push({
          id: Date.now() + Math.random(),
          name: s.name || 'Imported Session',
          createdAt: Date.now(),
          deckA: s.deckA || null,
          deckB: s.deckB || null,
          playlist: s.playlist
        });
        added++;
      });
      if (added) {
        saveSessionsToStorage(sessions);
        updateSaveButtonState();
        renderSessionList();
        alert(`Imported ${added} session${added > 1 ? 's' : ''}.`);
      } else {
        alert('No valid sessions found in file.');
      }
    } catch(err) { alert('Failed to parse JSON file.'); }
  };
  reader.readAsText(file);
  input.value = '';
}

/**
 * Prompt to clear the current active deck/playlist state.
 */
function promptClearCurrent() {
  showConfirm('Clear Session', 'This will clear both decks and the entire playlist. Continue?', 'Clear', () => {
    applyState({ deckA: null, deckB: null, playlist: [] });
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Determines if a drag-over event is on the top or bottom half of an element.
 */
function getDragYPos(e, el) {
  const rect = el.getBoundingClientRect();
  return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
}

/**
 * Removes visual indicators from drop zones.
 */
function clearDragIndicators() {
  document.querySelectorAll('.playlist-item').forEach(el => el.classList.remove('drop-before', 'drop-after'));
  document.getElementById('playlist-empty').classList.remove('drop-active');
  document.getElementById('track-title-box1').classList.remove('drop-active');
  document.getElementById('track-title-box2').classList.remove('drop-active');
}

// Kick off the application
init();
