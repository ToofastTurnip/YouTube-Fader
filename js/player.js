/**
 * @file player.js
 * @description Defines the Deck class, which encapsulates a single YouTube player unit.
 * Each deck manages its own YT.Player instance, UI elements (volume, play/pause, status badges),
 * and drag-and-drop interactions.
 */

class Deck {
  /**
   * @param {number} num - The deck number (1 for Deck A, 2 for Deck B).
   * @param {Object} options - Callback functions for state changes and updates.
   */
  constructor(num, options) {
    this.num = num;
    this.player = null;
    this.info = null; // Stores { id, title, originalTitle, author }
    
    // Callbacks provided by the orchestrator (main.js)
    this.onUpdate = options.onUpdate || (() => {});
    this.onStateChange = options.onStateChange || (() => {});
    this.onFetchInfo = options.onFetchInfo;
    this.onDragStart = options.onDragStart;
    this.onDragEnd = options.onDragEnd;
    this.onDrop = options.onDrop;
    this.onClear = options.onClear || (() => {});

    this.setupUI();
  }

  /**
   * Caches DOM references for this deck's specific UI components.
   */
  setupUI() {
    this.box = document.getElementById('track-title-box' + this.num);
    this.textEl = document.getElementById('track-title-text' + this.num);
    this.origEl = document.getElementById('track-title-orig' + this.num);
    this.editBtn = document.getElementById('track-edit-btn' + this.num);
    this.delBtn = document.getElementById('track-del-btn' + this.num);
    this.contentEl = document.getElementById('track-title-content' + this.num);
    this.placeholder = document.getElementById('placeholder' + this.num);
    this.playBtn = document.getElementById('play-btn' + this.num);
    this.urlInput = document.getElementById('url' + this.num);

    this.setupTitleBoxDrag();
    this.setupTitleChipButtons();
  }

  /**
   * Initializes the YouTube Player instance for this deck.
   * @param {string} videoId - The ID to load.
   */
  createPlayer(videoId) {
    this.player = new window.YT.Player('player' + this.num, {
      height: '100%', width: '100%',
      playerVars: { playsinline: 1, rel: 0, modestbranding: 1, autoplay: 0 },
      events: {
        onReady: (e) => {
          e.target.cueVideoById(videoId);
          this.onUpdate();
        },
        onStateChange: (e) => {
          this.onStateChange(this.num, e);
          this.onUpdate();
        }
      }
    });
  }

  /**
   * Loads a video into the deck, fetching metadata if not provided.
   */
  loadVideo(id, title, author, originalTitle, customTitle) {
    this.info = {
      id: id,
      title: customTitle || title || 'Loading\u2026',
      originalTitle: originalTitle || title || 'Loading\u2026',
      author: author || '',
      _customTitle: customTitle || null
    };
    this.updateTitleDisplay();

    // If title is missing or generic, fetch the real one
    if (title === 'Loading\u2026' || !title) {
      this.onFetchInfo(id, (err, info) => {
        if (this.info && this.info.id === id) {
          const fetched = info ? info.title : ('Video ' + id);
          const stashed = this.info._customTitle;
          this.info.originalTitle = fetched;
          this.info.author = info ? info.author : '';
          this.info.title = stashed || fetched;
          delete this.info._customTitle;
          this.updateTitleDisplay();
        }
      });
    }

    if (this.player && typeof this.player.cueVideoById === 'function') {
      this.player.cueVideoById(id);
    } else {
      this.createPlayer(id);
    }

    this.placeholder.style.display = 'none';
    this.playBtn.disabled = false;
    this.onUpdate();
  }

  /**
   * Updates the text display in the track title chip.
   */
  updateTitleDisplay() {
    if (this.info && this.info.id) {
      this.textEl.textContent = this.info.title || this.info.id;
      const isCustom = this.info.originalTitle && this.info.title !== this.info.originalTitle;
      this.origEl.style.display = '';
      this.origEl.textContent = isCustom ? '\u00a0(' + this.info.originalTitle + ')' : '';
      this.box.classList.add('has-track');
      this.box.setAttribute('draggable', 'true');
      this.editBtn.style.display = '';
      this.delBtn.style.display = '';
    } else {
      this.textEl.textContent = 'No track loaded';
      this.origEl.textContent = '';
      this.box.classList.remove('has-track');
      this.box.setAttribute('draggable', 'false');
      this.editBtn.style.display = 'none';
      this.delBtn.style.display = 'none';
    }
  }

  /**
   * Destroys the player and resets the deck to an empty state.
   */
  clear() {
    if (this.player && typeof this.player.destroy === 'function') {
      this.player.destroy();
    }
    this.player = null;
    this.info = null;
    this.updateTitleDisplay();
    this.placeholder.style.display = '';
    this.playBtn.disabled = true;
    this.urlInput.value = '';
    this.onUpdate();
    this.onClear(this.num);
  }

  /**
   * Toggles between play and pause states.
   */
  togglePlay() {
    if (!this.player) return;
    const state = this.player.getPlayerState();
    if (state === window.YT.PlayerState.PLAYING) {
      this.player.pauseVideo();
    } else {
      this.player.playVideo();
    }
  }

  /**
   * Updates the player volume.
   * @param {string|number} value - Volume from 0 to 100.
   */
  setVolume(value) {
    if (this.player && typeof this.player.setVolume === 'function') {
      this.player.setVolume(parseInt(value, 10));
    }
    const slider = document.getElementById('vol' + this.num);
    if (slider) {
      slider.value = value;
      updateSliderFill(slider);
    }
    const display = document.getElementById('vol' + this.num + '-display');
    if (display) display.textContent = value + '%';
  }

  /**
   * Gets the current YouTube player state.
   * @returns {number}
   */
  getState() {
    try {
      if (!this.player || typeof this.player.getPlayerState !== 'function') return -1;
      return this.player.getPlayerState();
    } catch(e) { return -1; }
  }

  /**
   * Sets up drag start and drop target logic for the deck.
   */
  setupTitleBoxDrag() {
    this.box.addEventListener('dragstart', (e) => {
      if (!this.info || !this.info.id) { e.preventDefault(); return; }
      if (this.onDragStart) this.onDragStart(e, this.info, this.num);
    });
    this.box.addEventListener('dragend', () => {
      if (this.onDragEnd) this.onDragEnd();
    });

    this.box.addEventListener('dragover', (e) => {
      if (this.onDrop) this.onDrop.over(e, this.box);
    });
    this.box.addEventListener('dragleave', () => {
      if (this.onDrop) this.onDrop.leave(this.box);
    });
    this.box.addEventListener('drop', (e) => {
      if (this.onDrop) this.onDrop.drop(e, this.num, this.box);
    });
  }

  /**
   * Sets up click handlers for the Pencil (edit) and Trash (delete) icons on the chip.
   */
  setupTitleChipButtons() {
    this.editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.contentEl.querySelector('.track-title-input')) return;
      if (!this.info) return;

      this.box.setAttribute('draggable', 'false');
      this.textEl.style.display = 'none';
      this.origEl.style.display = 'none';

      // Create inline text input
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'track-title-input';
      input.value = this.info.title;
      this.contentEl.appendChild(input);
      input.focus();
      input.select();

      const commit = () => {
        const newTitle = input.value.trim();
        this.info.title = newTitle || this.info.originalTitle || this.info.title;
        this.textEl.style.display = '';
        this.origEl.style.display = '';
        if (this.contentEl.contains(input)) this.contentEl.removeChild(input);
        this.box.setAttribute('draggable', 'true');
        this.updateTitleDisplay();
        this.onUpdate();
      };
      const cancel = () => {
        this.textEl.style.display = '';
        this.origEl.style.display = '';
        if (this.contentEl.contains(input)) this.contentEl.removeChild(input);
        this.box.setAttribute('draggable', 'true');
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      });
      input.addEventListener('blur', commit);
    });

    this.delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clear();
    });
  }
}
