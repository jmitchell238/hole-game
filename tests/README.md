# VoidRush tests

## Target device

Graphics knobs in `js/config.js` (`GFX`) are tuned for a **1st-generation iPad Pro 12.9" (A9X, 2015)**: large Retina panel, limited fill rate/VRAM. Touch tablets get `renderScale ≈ 0.58`, 1k textures, aggressive spatial streaming, and no GLTF clones.

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
