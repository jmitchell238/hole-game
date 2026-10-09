# Architecture

## Files

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

There's no build step. The scripts are plain `<script>` tags that share global scope, loaded in order from `index.html`, so the game also runs straight from disk.

## Levels

Each file in `js/levels/` calls `registerLevel({...})`, which adds it to `LEVELS` in `js/config.js`. When a match starts, `start()` in `js/main.js` picks a random level from `LEVELS`, unless debug mode is on and a level is selected. The level picker in `js/hud.js` builds one button per registered level.

## Performance

Target floor: **1st-gen iPad Pro 12.9" (A9X, 2015)**.

**Minecraft runs well because it is a native Metal app**, not Safari WebGL.
We still refuse to accept a laggy hole.io clone — budget: static ground, no fog,
~0.4× internal res, thin clutter, unlit materials, no per-frame mesh rebuilds.

### What does *not* dominate cost

City Test with **~90 MeshBasicMaterial boxes** still lagged. That means
prop triangle count is **not** the primary problem once props are simple.

### What *does* dominate cost

| System | Cost | Notes |
|--------|------|--------|
| **Ground ShapeGeometry rebuild** | Very high | Was #1 — removed in v2.37+. |
| **Full-screen hole discard shader** | Very high | Per-pixel loop on the entire ground (fills the screen). Removed in v2.38 — mouth disc instead. |
| **Fog** | High | Per-fragment on every pixel. Disabled on lowEnd. |
| **Fill rate / resolution** | High | 12.9" panel; `renderScale ~0.48`. |
| **Prop meshes** | Low on City Test | ~30 basic boxes still lagged until ground/fog fixed. |

### Intended design (v2.37+)

```
index.html
  config.js     GAME_VERSION, GFX profile (lowEnd iPad)
  engine.js     renderer, camera, lights, STATIC ground + hole uniforms
  props.js      builders, optimizeProp (merge), addProp
  spatial.js    optional frustum parent (off when N is small)
  hole.js       pit/ring (shared geo, scaled)
  rules.js      simulation (broad-phase eat)
  main.js       loop: update → refreshGround(uniforms) → render
  levels/*      generate / texture / populate only
```

#### Ground

- **Static** `PlaneGeometry` + full-map texture (UVs 0–1).
- Hole openings: **shader `discard`** from hole position uniforms — **zero geometry rebuild**.
- Pit cylinder/ring still provide the 3D hole look.

#### Props

- Prefer 1 mesh + BasicMaterial on low-end test maps.
- `destroyProp` on eat (leave scene + free unique geos).
- Frustum streaming only when prop count is large (>300).

#### Loop

- `update(dt)`: move holes, eat checks near hole only.
- `refreshGround()`: write uniforms only.
- `render()`: camera, fog from camera distance, optional stream, `renderer.render`, HUD.

### How to profile

1. Settings → Debug → **City Test** (minimal props).
2. If still slow → ground/fill/JS, not buildings.
3. `bash tests/perf/run-perf.sh` for regression counts.
4. On device: watch debug FPS chip (when debug on).
