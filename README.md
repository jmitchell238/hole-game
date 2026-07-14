# Hole Royale

A hole.io-style browser game — steer your hole around the map and swallow
everything that fits, growing as you go. Biggest hole when the timer hits
0:00 wins. Every match rolls a brand-new procedurally generated map — grid
size, block size, road width, districts, and spawn points all vary. No build
step, no dependencies to install (Three.js loads from a CDN); just open the
file in a browser.

## Play

- **`hole3d.html`** — the 3D game (current version)
- **`index.html`** — the original 2D prototype

Click and drag (or WASD) to steer. ESC pauses.

## Project layout

| File | What it owns |
|---|---|
| `hole3d.html` | Page markup and script tags |
| `css/style.css` | All styling |
| `js/config.js` | Game constants, helpers, the level registry, shared state |
| `js/engine.js` | Renderer, scene, camera, lights, ground |
| `js/props.js` | Prop library: stats, materials, mesh builders, `registerProp()` |
| `js/hole.js` | The holes: pit visuals, movement, grow/eat math |
| `js/rules.js` | Match rules: swallowing physics, bot AI, win/lose |
| `js/input.js` | Mouse, keyboard, resize |
| `js/hud.js` | Timer, leaderboard, menus, level select |
| `js/levels/` | One file per themed level |

## Adding a new level (desert, medieval, winter, …)

1. Copy `js/levels/city.js` to `js/levels/<name>.js`.
2. Change the layout, ground texture, colors, and props it registers —
   the full checklist is commented at the top of `city.js`.
3. Add a `<script>` tag for it in `hole3d.html`.

The level-select buttons on the start menu pick up new levels automatically.
