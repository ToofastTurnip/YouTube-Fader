/**
 * @file playlist.js
 * @description Manages the collection of tracks waiting to be loaded into decks.
 * Handles adding, removing, and reordering (via drag-and-drop) of playlist items,
 * as well as inline renaming of tracks and individual volume settings.
 */

class Playlist {
  /**
   * @param {Object} options - Configuration and event callbacks.
   */
  constructor(options) {
    this.items = [];    // Array of track objects { uid, id, title, originalTitle, author, volume }
    this.seq = 0;       // Unique ID generator for items
    this.container = document.getElementById('playlist-items');
    this.emptyEl = document.getElementById('playlist-empty');

    // Callbacks provided by main.js
    this.onUpdate = options.onUpdate || (() => {});
    this.onFetchInfo = options.onFetchInfo;
    this.onRemoveFromPlaylist = options.onRemoveFromPlaylist || (() => {});
    this.onDragStart = options.onDragStart;
    this.onDragEnd = options.onDragEnd;
    this.onDrop = options.onDrop;
    this.onThumbHover = options.onThumbHover;
    this.onThumbLeave = options.onThumbLeave;
    this.onThumbMove = options.onThumbMove;
  }

  /**
   * Appends a new video to the end of the playlist.
   */
  add(id, title, author, originalTitle, volume) {
    const t = title || id;
    const item = {
      uid: ++this.seq,
      id: id,
      title: t,
      originalTitle: originalTitle || t,
      author: author || '',
      volume: volume !== undefined ? volume : 100
    };
    this.items.push(item);
    this.render();
    this.onUpdate();
    return item;
  }

  /**
   * Inserts a video at a specific index (used during drag-and-drop reordering).
   */
  insert(id, title, author, atIndex, originalTitle, volume) {
    const t = title || id;
    const item = {
      uid: ++this.seq,
      id: id,
      title: t,
      originalTitle: originalTitle || t,
      author: author || '',
      volume: volume !== undefined ? volume : 100
    };
    if (atIndex >= 0 && atIndex <= this.items.length) {
      this.items.splice(atIndex, 0, item);
    } else {
      this.items.push(item);
    }
    this.render();
    this.onUpdate();
    return item;
  }

  /**
   * Removes an item from the playlist by its unique internal ID.
   */
  remove(uid) {
    const idx = this.findIndexByUid(uid);
    if (idx >= 0) {
      this.items.splice(idx, 1);
      this.render();
      this.onUpdate();
      this.onRemoveFromPlaylist(uid);
    }
  }

  findIndexByUid(uid) {
    return this.items.findIndex(item => item.uid === uid);
  }

  findByUid(uid) {
    return this.items.find(item => item.uid === uid);
  }

  /**
   * Empties the playlist.
   */
  clear() {
    this.items = [];
    this.render();
    this.onUpdate();
  }

  /**
   * Replaces the entire playlist (used for session loading).
   */
  setItems(newItems) {
    this.items = newItems.map(item => ({
      uid: ++this.seq,
      ...item,
      title: item.title || 'Loading\u2026',
      originalTitle: item.originalTitle || item.title || 'Loading\u2026',
      author: item.author || '',
      volume: item.volume !== undefined ? item.volume : 100
    }));
    this.render();
  }

  /**
   * Clears the DOM container and rebuilds all playlist item elements.
   */
  render() {
    const items = this.container.querySelectorAll('.playlist-item');
    items.forEach(el => this.container.removeChild(el));

    if (this.items.length === 0) {
      this.emptyEl.style.display = '';
      return;
    }
    this.emptyEl.style.display = 'none';

    this.items.forEach(item => {
      this.container.appendChild(this.buildItemEl(item));
    });
  }

  /**
   * Constructs a single playlist item DOM element with all its buttons and listeners.
   */
  buildItemEl(item) {
    const el = document.createElement('div');
    el.className = 'playlist-item';
    el.setAttribute('draggable', 'true');
    el.dataset.uid = item.uid;

    const handle = document.createElement('span');
    handle.className = 'playlist-item-handle';
    handle.textContent = '\u28ff'; // Braille dots handle

    const info = document.createElement('div');
    info.className = 'playlist-item-info';

    const titleRow = document.createElement('div');
    titleRow.className = 'playlist-item-title-row';

    const editBtn = document.createElement('button');
    editBtn.className = 'playlist-item-edit';
    editBtn.title = 'Rename';
    editBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';

    const titleEl = document.createElement('span');
    titleEl.className = 'playlist-item-title';

    const origEl = document.createElement('span');
    origEl.className = 'playlist-item-orig-title';

    const updateTitleDisplay = () => {
      const isCustom = item.originalTitle && item.title !== item.originalTitle;
      titleEl.textContent = item.title;
      if (isCustom) {
        origEl.textContent = '\u00a0(' + item.originalTitle + ')';
        if (!titleRow.contains(origEl)) titleRow.appendChild(origEl);
      } else {
        if (titleRow.contains(origEl)) titleRow.removeChild(origEl);
      }
    };
    titleRow.appendChild(editBtn);
    titleRow.appendChild(titleEl);
    updateTitleDisplay();

    const authorEl = document.createElement('div');
    authorEl.className = 'playlist-item-author';
    authorEl.textContent = item.author;

    info.appendChild(titleRow);
    if (item.author) info.appendChild(authorEl);

    // ── Volume Control ──
    const volRow = document.createElement('div');
    volRow.className = 'playlist-item-vol-row';
    
    const volIcon = document.createElement('span');
    volIcon.className = 'playlist-item-vol-icon';
    volIcon.textContent = 'Vol';
    
    const volSlider = document.createElement('input');
    volSlider.type = 'range';
    volSlider.className = 'playlist-item-vol-slider';
    volSlider.min = '0';
    volSlider.max = '100';
    volSlider.value = item.volume;
    
    const volDisplay = document.createElement('span');
    volDisplay.className = 'playlist-item-vol-display';
    volDisplay.textContent = item.volume + '%';
    
    volSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      item.volume = val;
      volDisplay.textContent = val + '%';
      updateSliderFill(volSlider);
      this.onUpdate();
    });
    
    // Initial fill
    setTimeout(() => updateSliderFill(volSlider), 0);
    
    // Stop drag when interacting with slider
    volSlider.addEventListener('mousedown', (e) => e.stopPropagation());
    
    volRow.appendChild(volIcon);
    volRow.appendChild(volSlider);
    volRow.appendChild(volDisplay);
    info.appendChild(volRow);

    // Inline Renaming
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (titleRow.querySelector('.playlist-item-title-input')) return;

      el.setAttribute('draggable', 'false');
      titleEl.style.display = 'none';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'playlist-item-title-input';
      input.value = item.title;
      titleRow.appendChild(input);
      input.focus();
      input.select();

      const commit = () => {
        const newTitle = input.value.trim();
        item.title = newTitle || item.originalTitle || item.title;
        updateTitleDisplay();
        titleEl.style.display = '';
        if (titleRow.contains(input)) titleRow.removeChild(input);
        el.setAttribute('draggable', 'true');
        this.onUpdate();
      };
      const cancel = () => {
        titleEl.style.display = '';
        if (titleRow.contains(input)) titleRow.removeChild(input);
        el.setAttribute('draggable', 'true');
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      });
      input.addEventListener('blur', commit);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'playlist-item-del';
    delBtn.title = 'Remove';
    delBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onThumbLeave) this.onThumbLeave();
      this.remove(item.uid);
    });

    el.appendChild(handle);
    el.appendChild(info);
    el.appendChild(delBtn);

    // ── Drag Source Logic ──
    el.addEventListener('dragstart', (e) => {
      if (this.onThumbLeave) this.onThumbLeave();
      if (this.onDragStart) this.onDragStart(e, item, el);
    });
    el.addEventListener('dragend', () => {
      if (this.onDragEnd) this.onDragEnd(el);
    });

    // ── Drop Target Logic (Reordering) ──
    el.addEventListener('dragover', (e) => {
      if (this.onDrop) this.onDrop.over(e, item, el, 'playlist');
    });
    el.addEventListener('dragleave', () => {
      if (this.onDrop) this.onDrop.leave(el);
    });
    el.addEventListener('drop', (e) => {
      if (this.onDrop) this.onDrop.drop(e, item, el, 'playlist');
    });

    // ── Thumbnails on Hover ──
    let hoverTimer = null;
    el.addEventListener('mouseenter', (e) => {
      hoverTimer = setTimeout(() => {
        if (this.onThumbHover) this.onThumbHover(item.id, e.clientX, e.clientY);
      }, 1000); // 1-second delay
    });
    el.addEventListener('mousemove', (e) => {
      if (this.onThumbMove) this.onThumbMove(e.clientX, e.clientY);
    });
    el.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimer);
      if (this.onThumbLeave) this.onThumbLeave();
    });

    return el;
  }
}
