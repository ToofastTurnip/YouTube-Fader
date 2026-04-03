/**
 * @file youtube.js
 * @description This module handles all direct interactions with the YouTube ecosystem.
 * It is responsible for initializing the IFrame API, parsing URLs to extract Video IDs,
 * and fetching video metadata (like title and author) via YouTube's oEmbed service.
 */

// ── YouTube IFrame API Initialization ─────────────────────────────────────

/**
 * Injects the YouTube IFrame Player API script into the document head.
 * This is required for the YT.Player constructor to be available.
 */
function initYouTubeAPI() {
  if (window.YT) return; // Already loaded or loading
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

// ── Parsing Helpers ───────────────────────────────────────────────────────

/**
 * Extracts a 11-character YouTube Video ID from various URL formats.
 * Supports: youtu.be, youtube.com/watch?v=, and raw IDs.
 * @param {string} raw - The input string (usually a URL) from the user.
 * @returns {string|null} - The extracted Video ID or null if invalid.
 */
function parseVideoId(raw) {
  if (!raw) return null;
  const url = raw.trim();
  try {
    const u = new URL(url);
    // Handle short URLs (youtu.be/ID)
    if (u.hostname === 'youtu.be' || u.hostname === 'www.youtu.be')
      return u.pathname.slice(1).split(/[/?]/)[0] || null;
    // Handle standard URLs (youtube.com/watch?v=ID)
    if (u.hostname.includes('youtube.com'))
      return u.searchParams.get('v') || null;
  } catch(e) {
    // Fallback to regex if URL constructor fails (e.g. for partial strings)
  }
  const m = url.match(/(?:[?&]v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ── Metadata Fetching ─────────────────────────────────────────────────────

/**
 * Fetches video details (Title and Author) using the oEmbed API.
 * This allows us to show track names without needing a heavy API key.
 * @param {string} videoId - The YouTube Video ID.
 * @param {function} cb - Callback function (error, data).
 */
function fetchVideoInfo(videoId, cb) {
  const url = 'https://www.youtube.com/oembed?url=' +
            encodeURIComponent('https://www.youtube.com/watch?v=' + videoId) +
            '&format=json';
  fetch(url)
    .then(r => {
      if (!r.ok) throw new Error('Video info not found');
      return r.json();
    })
    .then(d => cb(null, { title: d.title, author: d.author_name }))
    .catch(e => cb(e, null));
}
