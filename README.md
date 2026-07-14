# Hole Royale

A hole.io-style browser game — steer your hole around the map and swallow
everything that fits, growing as you go. Biggest hole when the timer hits
0:00 wins. Every match rolls a brand-new procedurally generated map. Matches
earn gold to spend in the Store on hole colors and designs (cat, dog, dragon,
tornado). No build step; just open `index.html` in a browser or visit the
hosted site.

**Play online:** https://jmitchell238.github.io/hole-game/

## Features

- **Two levels** (more coming): a procedurally generated **City** and an
  **Island** archipelago with villages, palms, and boats — pick on the Play tab
- **Random maps every match** — grid size, districts, islands, and spawns
  are all rolled fresh
- **Store + gold economy** — earn gold from matches (size + podium bonus),
  claim a daily check-in for +10 gold, buy hole colors (20 🪙) and rim
  designs (100–250 🪙)
- **Touch + mouse controls** — drag to steer; works on touchscreens and iPad
- **16:9 letterboxed frame** that flips to 9:16 when the device is held upright
- **Installable PWA** — "Add to Home Screen" on iPad gives a fullscreen app
  that works offline; a Full screen button lives in Settings
- **Old 2D prototype** preserved at `classic2d.html`

## Project layout

| File | What it owns |
|---|---|
| `index.html` | Page markup, tab bar, script tags |
| `css/style.css` | All styling |
| `js/config.js` | Game constants, helpers, the level registry, shared state |
| `js/engine.js` | Renderer, scene, camera, lights, 16:9 frame, ground |
| `js/props.js` | Prop library: stats, materials, mesh builders, `registerProp()` |
| `js/save.js` | Persistent progress: gold, purchases, settings (localStorage) |
| `js/cosmetics.js` | Store catalog: hole colors + 3D rim designs |
| `js/hole.js` | The holes: pit visuals, cosmetics, movement, grow/eat math |
| `js/rules.js` | Match rules: swallowing physics, hole collisions, bot AI |
| `js/input.js` | Pointer (mouse/touch) input, keyboard, resize |
| `js/hud.js` | HUD, leaderboard, Store/Play/Settings tabs, level select |
| `js/levels/` | One file per themed level |
| `sw.js` + `manifest.webmanifest` | PWA install + offline cache |

## Adding a new level (desert, medieval, winter, …)

1. Copy `js/levels/city.js` (grid city) or `js/levels/island.js` (organic
   blobs) to `js/levels/<name>.js` — whichever is closer to your theme.
2. Change the `generate()` roll, ground texture, colors, and props it
   registers — the full checklist is commented at the top of `city.js`.
3. Add a `<script>` tag for it in `index.html` and list it in `sw.js`.

The level-select buttons pick up new levels automatically.

## Releasing changes

The service worker caches aggressively: after changing any file, bump the
`CACHE` version string in `sw.js` so installed players get the update.
