# YouTube Fader

A DJ-style audio crossfader for YouTube videos — built for tabletop RPG game masters who want seamless transitions between ambiance, combat music, and any other audio tracks during a session.

**[Try it live →](https://toofastturnip.github.io/YouTube-Fader/)**

---

## Getting Started

Paste any YouTube URL into Deck A or Deck B and click **Load**. The video will cue up and be ready to play. Repeat for the other deck. Hit **Play** on whichever deck you want to start with.

> **Note:** The app must be served over HTTP/HTTPS to load YouTube videos. The live GitHub Pages link above works out of the box. For local use, run `python3 -m http.server 8080` in the project folder and open `http://localhost:8080`.

---

## The Two Decks

Each deck is independent:

- **Load** — paste a YouTube URL and click Load (or press Enter)
- **Play / Pause** — toggle playback for that deck
- **Volume slider** — controls the volume of that deck only
- **Track chip** (bottom of each deck) — shows the loaded video's title; drag it to the playlist to move the track there, or use the pencil icon to rename it and the trash icon to clear the deck

---

## Crossfade

When one deck is **playing** and the other is **paused or cued**, the **FADE** button activates. Clicking it will:

1. Start playing the inactive deck at volume 0
2. Smoothly ramp its volume up to the target level
3. Simultaneously ramp the active deck's volume down to 0, then pause it

Set the **Fade Duration** (in seconds) before triggering to control how fast the transition is.

---

## Playlist

The playlist lives below the decks and holds your track queue.

- **Add a track** — paste a YouTube URL into the playlist input and click **Add**
- **Reorder** — drag tracks up and down by their handle (⣿)
- **Load to a deck** — drag a playlist track up onto either deck's title chip
- **Send a deck to playlist** — drag a deck's title chip down into the playlist
- Both of the above are **moves** — the track is removed from its origin

Hovering over a playlist item for 1 second shows a thumbnail preview.

### Renaming tracks

Click the **pencil icon** on any playlist item or deck chip to rename it. Press Enter or click away to confirm; leave it blank to revert to the original YouTube title. The original title stays visible in parentheses at 50% opacity so you always know what it is.

---

## Sessions

Sessions let you save, load, and share your playlists and deck setups.

### Auto-save

Everything is saved automatically as you work. If you close the tab or refresh the page, your decks and playlist will be exactly where you left them — no action needed.

### Saving a named session

Click **Save / Load** in the top-left corner to open the Sessions panel. Type a name and click **Save Current** to snapshot your current state. Named sessions are saved in creation order.

### Loading a session

Click **Load** next to any session. If you have unsaved changes since your last save, you'll be asked to confirm before the current state is replaced.

### Deleting a session

Click the trash icon next to a session. You'll be asked to confirm.

### Exporting and importing

- **Export** (↓ icon) — downloads a single session as a `.json` file
- **Export All** — downloads all sessions as one `.json` file
- **Import JSON** — imports a `.json` file (single session or an array of sessions) and appends them to your session list

Exported files are a good way to back up a playlist you've spent time building, or to share a curated track list with another GM.

**Session file format:**
```json
{
  "name": "Session Name",
  "deckA": { "id": "youtubeVideoId", "customTitle": "Optional rename" },
  "deckB": null,
  "playlist": [
    { "id": "youtubeVideoId" },
    { "id": "youtubeVideoId", "customTitle": "Optional rename" }
  ]
}
```
Only `customTitle` fields that differ from the original YouTube title are included. Video titles and authors are always re-fetched from YouTube when a session is loaded.

### Clearing the current session

Click the **✕ Clear** button in the top-left corner to wipe both decks and the playlist. This does not affect any named sessions.

---

## Other Features

- **Light / Dark mode** — toggle with the ☀ / ☾ button in the top-right corner; preference is remembered across sessions
- **Layering audio** — you can play both decks simultaneously at any volume mix by using the individual volume sliders without triggering the crossfade
