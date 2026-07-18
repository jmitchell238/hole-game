# VoidRush tests

## Target device

Graphics knobs in `js/config.js` (`GFX`) are tuned for a **1st-generation iPad Pro 12.9" (A9X, 2015)**: large Retina panel, limited fill rate/VRAM. Touch tablets get `renderScale ≈ 0.58`, 1k textures, aggressive spatial streaming, and no GLTF clones.

## Unit tests (`tests/unit`)

Node.js unit tests for `js/core.js` (pure game math: level tiers, rewards, growth formulas, seeded RNG) and static release-consistency checks (index.html script tags, sw.js CACHE/ASSETS, level registrations, tests/perf/budgets.json).

### Run

```bash
bash tests/run-tests.sh
```

Uses Node's native `test`/`describe`/`assert` (no npm dependencies). Exit code 0 = all pass.

### Coverage

- **core.test.js**: sizeLevel, growRadius, canEatR, maxHoleRadiusFor, soloTargetPct, soloReward, battleReward, isBattleLevel, mulberry32, rand, pick, checkinToday, exported constants
- **consistency.test.js**: index.html <script> paths exist; sw.js CACHE matches GAME_VERSION; ASSETS entries exist; level files have registerLevel + required keys; tests/perf/budgets.json matches perf-suite.js (ignoring _* metadata keys)

## Smoke / integration (`tests/integration`)

Per-level integration smoke tests: every level boots, props get eaten, solo-win and battle-elimination paths fire, zero console errors.

### Run

From the repo root (WSL):

```bash
bash tests/integration/run-smoke.sh
```

Or open `tests/integration/smoke-levels.html` in a desktop browser and read the on-page log / console.

### Output

- `SMOKE <levelId> boot props=<N>` — level booted with N props
- `SMOKE <levelId> eaten=<N> grewTo=<R>` — ate N props, grew to radius R
- `SMOKE solo_win soloWon=true` — solo win path triggered
- `SMOKE solo_win match_ended` — endMatch completed
- `SMOKE battle_elimination bot_eaten holes_eliminated=<N>` — battle elimination path triggered
- `SMOKE RESULT pass|fail` — suite summary

### Coverage

- **Boot**: all 6 levels (city, city-test, desert, island, medieval, winter) initialize without error
- **Eating**: ground-level props are consumed, hole radius grows
- **Solo win**: city level solo path triggers at devour threshold, endMatch completes
- **Battle elimination**: city level battle mode spawns 5 bots, player can eat a bot when sufficiently larger, hole-vs-hole elimination removes the bot

## Perf / integration (`tests/perf`)

Measures init, `update`, `render`, and **how many props stay parented to the scene** as the hole (camera) grows. Late-game lag is mostly “everything still drawn when zoomed out” — these budgets catch that.

### Run

From the repo root (WSL):

```bash
bash tests/perf/run-perf.sh
```

Or open `tests/perf/perf.html` in a desktop browser and read the on-page log / console.

### Output

- `PERF key=value` — measurement
- `PERF FAIL key=value budget=N` — over budget
- `PERF RESULT pass|fail` — suite summary

### Budgets

See `tests/perf/budgets.json` (mirrored in `perf-suite.js` for `file://` loads).

Primary **device-agnostic** bars:

| Metric | Meaning |
|--------|---------|
| `streamed_props_r*` | Props still in the scene at hole radius r |
| `streamed_growth_ratio` | `streamed(r250) / streamed(r12)` — must not explode |
| `scene_meshes_r*` | Total Mesh nodes under `scene` |

Headless Chrome timings vary by machine; treat ms budgets as soft CI guards, not iPad FPS.

### After optimizing

1. Run the suite, note FAIL lines  
2. Tighten code  
3. Re-run until `PERF RESULT pass`  
4. Optionally lower budgets in `budgets.json` + `perf-suite.js` to lock the win  
