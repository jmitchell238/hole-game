# VoidRush

A hole.io-style 3D browser game. Steer a hole around the map, swallow anything small enough to fit, and grow. Whoever is biggest when the timer hits 0:00 wins.

Play at https://jmitchell238.github.io/hole-game/

## Features

- Five themed levels: City, Island, Winter City, Wild West and Medieval. Each match picks one at random and generates a new map for it.
- Gold from each match (based on size, plus a podium bonus) and a daily check-in worth 10 gold.
- A Store with hole colors (20 gold each) and image rim designs like Black Cat, Puppy, Twister and Black Hole (150–250 gold).
- Drag to steer, with mouse or touch.
- 16:9 frame that switches to 9:16 when the device is held upright.
- Installable PWA that works offline. There's a full-screen button in Settings.
- The original 2D prototype is still at `classic2d.html`.

Turning on debug mode in Settings adds a level picker to the Play tab.

## Project layout

| File | Contents |
|---|---|
| `index.html` | Markup, tab bar, script tags |
| `css/style.css` | Styles |
| `js/core.js` | Pure game math: level tiers, growth, rewards, seeded RNG (also loaded by the Node tests) |
| `js/config.js` | Constants, helpers, level registry, shared state, `GAME_VERSION` |
| `js/models.js` | Holes, props and other entities |
| `js/spatial.js` | Spatial index for collision and search queries |
| `js/engine.js` | Renderer, scene, camera, lights, frame, ground |
| `js/props.js` | Prop library and `registerProp()` |
| `js/save.js` | Gold, purchases and settings in localStorage |
| `js/cosmetics.js` | Store catalog |
| `js/hole.js` | Hole visuals, cosmetics, movement, growth |
| `js/rules.js` | Swallowing physics, hole collisions, bot AI |
| `js/input.js` | Mouse, touch, keyboard, resize |
| `js/hud.js` | HUD, leaderboard, Store/Play/Settings tabs, level picker |
| `js/main.js` | Game loop, setup, match flow |
| `js/levels/*.js` | One file per level, plus `city-test.js` and `sizelab.js` for debugging |
| `sw.js`, `manifest.webmanifest` | PWA install and offline cache |

There's no build step. Scripts are plain `<script>` tags that share global scope, so `index.html` also runs straight from disk.

## Adding a level

1. Copy `js/levels/city.js` (grid layout) or `js/levels/island.js` (organic islands) to `js/levels/<name>.js`.
2. Change the generator, ground texture, colors and props. The checklist is in the comment at the top of `city.js`.
3. Add a `<script>` tag for it in `index.html` and add it to `ASSETS` in `sw.js`.

The new level is added to the random rotation and the debug level picker automatically.

## Tests

```bash
bash tests/run-tests.sh              # unit + release consistency
bash tests/integration/run-smoke.sh  # boots every level
bash tests/perf/run-perf.sh          # performance budgets
```

Details are in [tests/README.md](tests/README.md).

## Releasing

Bump `GAME_VERSION` in `js/config.js` and set `CACHE` in `sw.js` to `'voidrush-' + GAME_VERSION`. The tests check that they match. Changing `CACHE` is what makes installed copies download the update.
