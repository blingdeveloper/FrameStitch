# FrameStitch

**Browser-based image-to-video editor with transitions.**  
No installs, no server, no dependencies — just open `index.html`.

---

## Getting started

1. Download the three files: `index.html`, `style.css`, `app.js`
2. Keep them in the **same folder**
3. Open `index.html` in any modern browser (Chrome, Firefox, Edge, Safari)

That's it. No build step, no npm, no server required.

---

## How to use

### Upload images
- Click **Upload images** in the top nav
- Or drag image files onto the dashed drop zone in the left panel
- Or click the drop zone to open your file browser
- Supported formats: **JPG, PNG, WebP, GIF**

### Build your video
1. Double-click any image in the library to add it as a frame — or drag it onto the **Frames** track
2. Switch to the **Transitions** tab, then double-click a transition to apply it between frames
3. Hit **Space** or the play button to preview

### Edit frames & transitions
- Click any block on the timeline to select it
- The right **Properties** panel lets you rename, change duration, or swap the transition type
- Click a frame's color swatch to cycle through colors

### Timeline controls
| Action | How |
|--------|-----|
| Seek | Click anywhere on the timeline |
| Scrub | Click the progress bar under the preview |
| Fine scrub | Arrow keys (← / →) |
| Zoom in/out | − / + buttons, or Fit to show all |
| Split frame | Position playhead, click **Split** |
| Delete selected | Click **Delete** or press `Backspace` |
| Undo / Redo | `Ctrl+Z` / `Ctrl+Shift+Z` (or `Cmd` on Mac) |

---

## File structure

```
framestitch/
├── index.html   — markup and layout
├── style.css    — all styling (CSS variables, components)
└── app.js       — all logic (state, rendering, upload, timeline)
```

### Architecture overview (`app.js`)

| Module | Responsibility |
|--------|---------------|
| `State` | Single source of truth (frames, transitions, library, playback) |
| `Paint` | Canvas drawing — sample image generator + uploaded image renderer |
| `Transitions` | Canvas compositing for all 10 transition effects |
| `Renderer` | Preview canvas — decides what to draw each frame |
| `Player` | Playback loop via `requestAnimationFrame` |
| `Upload` | File drag-and-drop + FileReader API |
| `LibraryUI` | Renders the image grid and transition list |
| `Timeline` | Ruler, frame blocks, fx blocks, playhead |
| `Inspector` | Right-side properties panel |
| `UI` | Shared helpers (toast, transport bar, tab switching) |
| `App` | Top-level coordinator — all public methods |

---

## Adding real video export

The export modal currently simulates progress. To add real MP4 export, integrate **FFmpeg.wasm**:

```js
// 1. npm install @ffmpeg/ffmpeg @ffmpeg/util
// 2. In startExport(), render each frame to canvas at 30fps
// 3. Feed raw pixel data to FFmpeg.wasm
// 4. Trigger download of the resulting MP4 blob
```

See: https://ffmpegwasm.netlify.app

---

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `←` `→` | Scrub ±0.5s |
| `Backspace` / `Delete` | Delete selected |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |

---

## Browser support

Works in any browser that supports:
- `Canvas 2D API`
- `FileReader API`
- `requestAnimationFrame`
- `Drag and Drop API`

This covers all modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+).
