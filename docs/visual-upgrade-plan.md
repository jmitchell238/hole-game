# Visual Upgrade Plan: Closing the Gap to hole.io

## Executive Summary

VoidRush runs on 1st-gen iPad Pro (A9X) with procedural props and flat MeshLambert/Basic materials. The visual gap to hole.io is **primarily art direction** (cohesive color palettes, baked lighting, soft shadows, rounded silhouettes) rather than engine limitations. All proposed improvements use **vertex colors and baked textures** — zero new per-frame cost on A9X. This document designs a three-phase roadmap: Palettes (Phase 1), Vertex AO & Blob Shadows (Phase 2), Silhouettes & Instancing (Phase 3).

---

## Part 1: Reference Breakdown — What Makes hole.io Read as Polished

### Visual Elements hole.io Nails

| Feature | Why It Works | Cost at Runtime | Our Gap |
|---------|-------------|-----------------|---------|
| **Saturated, cohesive palettes per district** | Each level has 5–6 core colors; everything samples from that palette. Streets, buildings, ground all harmonize. | Baked into textures / vertex colors — zero per-frame cost | Hardcoded colors per builder; no palette abstraction; colors feel random |
| **Baked ambient occlusion (darkened corners/seams)** | Walls darken near the ground, inside corners are shadowed. Creates depth without real-time shadow maps. | Vertex colors computed once at build time | Flat lighting; no corner darkening; buildings look plastic |
| **Soft blob shadows under props** | Every prop casts a soft circular shadow on the ground. One shared texture, merged into static geometry. | Single CanvasTexture + merged ground decals; zero per-frame hit | No shadows at all on perf tier; late-game looks floating |
| **Gradient sky** | Sky transitions from blue at horizon to lighter/warmer above. Not a solid color; draws the eye upward. | Vertex-colored dome or CSS background gradient | Flat solid-color background; feels empty |
| **Rounded low-poly silhouettes** | Boxes are beveled, pillars are octagons, trees are gentle cones. Reads as intentional craft, not lazy primitives. | Merged at build time; no per-frame cost | Sharp boxes, cylinders; reads as unfinished |
| **Color ramp from ground to horizon** | Buildings transition from saturated base to muted top. Creates atmospheric perspective. | Vertex color gradients in merged geometry | No color variation by height |
| **Chunky, readable props** | Props are large, solid, few colors each. No LOD pop-in; builds trust. | Merged procedural meshes | Many tiny colored boxes; visual noise |

### Why These Are "Cheap" Fixes

1. **Vertex AO**: Compute darkness at build time based on height/corner position, bake into `vertexColor` attribute. Lambert materials read vertex colors natively. Zero per-frame overhead.
2. **Blob shadows**: Pre-baked circular gradient texture, one plane per prop merged into the static batch. No shadow map updates, no real-time calculations.
3. **Palettes**: Define 5–6 colors per level in `js/levels/<name>.js`, sample in builders (`PALETTE.primary`, `PALETTE.accent1`, …). Single pass at level init.
4. **Gradient sky**: Large inverted dome with vertex colors (gradient from equator to top) or CSS background; both free on every frame.
5. **InstancedMesh**: Replace the top 10 most-repeated props (trees, cars, people) with `THREE.InstancedMesh` batches. Cuts draw calls by ~10–15% late-game.
6. **Rounded silhouettes**: More segments in cylinders, beveled boxes (using merged geometry tricks already in `optimizeProp`). Vertex count rises ~5–10%, but merged into batches so no draw-call increase.

---

## Part 2: Bead-Ready Specs — Implementation Per Improvement

### Improvement A: Palette System

**Impact**: HIGH (visual coherence) | **Effort**: LOW (config only)

**Files to touch**:
- `js/levels/city.js`, `js/levels/winter.js`, `js/levels/desert.js`, `js/levels/island.js`, `js/levels/medieval.js`
- `js/props.js` (builders)

**Technique**:
1. Each level defines a `PALETTE` object at the top:
   ```javascript
   const PALETTE = {
     primary: 0xf0e8d8,      // dominant building color
     accent1: 0xd84040,      // roof / trim
     accent2: 0x4f8ae8,      // windows / glass
     dark: 0x3a4048,         // shadow / metal
     ground: 0x8a8a8a,       // ground base
     sky: 0xcfe8ff,           // horizon color for lerp
   };
   ```
2. Builders sample from `PALETTE`:
   - `new THREE.MeshLambertMaterial({ color: PALETTE.primary })`
   - Audit hardcoded values in `houseWall()`, `towerWall()`, `aptWall()`, `shopWall()` and replace with palette samples.
3. Level's `hemi` color (sky dome) and `sunColor` already exist — verify they match the palette.

**Acceptance test** (for coder):
- Run headless on city + winter; verify `renderer.info.render.calls` unchanged (palette is baked, not runtime).
- Visually: all buildings in one district should use 4–5 coordinated colors; no jarring color transitions between adjacent buildings.

---

### Improvement B: Vertex-Color Baked AO (Ambient Occlusion)

**Impact**: VERY HIGH (depth, realism) | **Effort**: MEDIUM (geometry generation)

**Files to touch**:
- `js/props.js` (`_mergeGeometries`, individual builders or `optimizeProp` as a fallback)
- `js/engine.js` (optionally: declare materials with `vertexColors: true`)

**Technique**:
1. **During prop build** (in `optimizeProp` or individual builders):
   - For each merged geometry, iterate vertices and darken by heuristic:
     - `darkness = 0` at top, `darkness = 0.2–0.3` at bottom (height-based).
     - Corners of boxes: check adjacent faces, darken if enclosed angle > threshold.
   - Multiply `vertexColor` by `(1 - darkness)` to create a `Color` attribute.
2. **Material setup**: Ensure Lambert materials set `vertexColors: true`:
   ```javascript
   new THREE.MeshLambertMaterial({ color: baseColor, vertexColors: true })
   ```
3. **Zero per-frame cost**: Lambert already reads `vertexColor` if present; no shader change needed.

**Acceptance test** (for coder):
- Log `renderer.info.render.calls` and `triangles` (should be unchanged).
- Visually: bases of buildings noticeably darker; inside corners of pipes/boxes show shadow. Compare headless screenshot (r=12, r=60) before/after.

---

### Improvement C: Blob Shadows (Ground-Plane Decals)

**Impact**: HIGH (grounds objects, depth cues) | **Effort**: MEDIUM (texture + merging logic)

**Files to touch**:
- `js/props.js` (new `addBlobShadow` helper)
- `js/engine.js` (pre-create blob-shadow texture)
- `js/levels/city.js`, others (shadow radius in `populate()`)

**Technique**:

**Option 1: Merged Ground Decal** (preferred on A9X):
1. Pre-bake a circular gradient texture (512×512) in `engine.js`:
   ```javascript
   const blobShadowTex = canvasTex(512, 512, g => {
     g.fillStyle = 'rgba(0,0,0,0)'; g.fillRect(0,0,512,512);
     const grad = g.createRadialGradient(256, 256, 0, 256, 256, 250);
     grad.addColorStop(0, 'rgba(0,0,0,0.4)');
     grad.addColorStop(1, 'rgba(0,0,0,0)');
     g.fillStyle = grad; g.fillRect(0,0,512,512);
   });
   ```
2. In `optimizeProp`, after merging the prop geometry:
   - If shadow enabled, create a small flat plane under the prop (y ≈ 0.1).
   - UV scale it to fit the gradient (center of blob = center of shadow plane).
   - Material: `new THREE.MeshBasicMaterial({ map: blobShadowTex, transparent: true })`.
   - Merge this shadow plane into the prop's batch.
3. **Shadow radius**: Per prop in `STATS` or indexed by prop size:
   ```javascript
   const shadowRadius = STATS[propName].r * 1.3;  // slightly larger than footprint
   ```

**Option 2: Real-Time Decal** (if Option 1 shows z-fighting):
- Use `THREE.Decal` (from examples) to project shadow onto the ground mesh every frame — more expensive but avoids clipping artifacts.

**Acceptance test** (for coder):
- Log call count before/after. Should stay ~same (merged into static batch).
- Visually: every prop has a soft shadow. Late-game (r=60): props no longer look floating.

---

### Improvement D: Gradient Sky

**Impact**: MEDIUM (atmosphere, polish) | **Effort**: LOW (either CSS or dome)

**Files to touch**:
- `css/style.css` (background gradient)
- OR `js/engine.js` (sky dome) + each level's `sky` color

**Technique**:

**Option 1: CSS Background** (simplest, free):
- In `css/style.css`, replace solid `background` with:
  ```css
  #frame {
    background: linear-gradient(to bottom, #87ceeb 0%, #cfe8ff 100%);
  }
  ```
- Per level, define `.sky-<levelId>` classes and toggle them in `applyEnvironment()`.

**Option 2: Three.js Dome** (blends with far clip):
- Create a large inverted hemisphere (or sphere with camera inside) at world origin.
- Vertex colors: gradient from horizon (saturated blue) to top (pale/warm).
- No lighting, no per-frame update; one render call amortized across all geometry.

**Acceptance test** (for coder):
- Visually: sky transitions smoothly from horizon upward. Colors match level palette.
- Headless render call count: +0 for CSS, +1 for dome (amortized).

---

### Improvement E: Rounded Silhouettes (Beveled Boxes, Tapered Cylinders)

**Impact**: MEDIUM (craft, readability) | **Effort**: MEDIUM (vertex generation)

**Files to touch**:
- `js/props.js` (builders: `person`, `tree`, `car`, `house`, `shop`, etc.)

**Technique**:
1. Replace sharp `BoxGeometry(w, h, d)` with `BoxGeometry(w, h, d, 2, 2, 2)` (adds segments).
2. **Manual bevel**: For prominent edges (roof lines, building corners):
   - Generate a custom geometry with extra verts at corners.
   - Example: building roof ridge → chamfered edge (3 verts instead of 1 per corner).
3. **Tapered cylinders**: `CylinderGeometry(radiusTop, radiusBottom, height, segments)` → vary `radiusTop` and `radiusBottom`.
4. **Merged impact**: All extra verts merge into the static batch; no new draw calls.

**Acceptance test** (for coder):
- Visually: boxes no longer have knife-edge corners; trees taper; people have rounded shoulders.
- Headless: triangle count +10–15%; call count unchanged.

---

### Improvement F: InstancedMesh for Top-10 Repeated Props

**Impact**: MEDIUM (late-game perf) | **Effort**: HIGH (new rendering path)

**Files to touch**:
- `js/props.js` (`optimizeProp`, new `batchedProp` registry)
- `js/spatial.js` or new `batching.js` (Instanced prop updates when props fall into hole)

**Technique**:
1. **Identify top repeats**: Log which props appear most (typically `person`, `tree`, `car`, `bush`, `bench`).
2. **Create InstancedMesh**:
   - Merge one instance of the prop into a single BufferGeometry.
   - Create `THREE.InstancedMesh(geo, mat, maxInstances)`.
   - Pre-compute all transform matrices for the level; upload once.
3. **Updates**: When a prop is devoured, mark that instance as culled (scale to 0 or move offscreen).
4. **Render**: InstancedMesh is **one** draw call regardless of instance count (up to 65k on WebGL 1).

**Acceptance test** (for coder):
- Log `renderer.info.render.calls` before/after. Should drop 10–15% late-game (r=60).
- Visually: no visible difference; identical tree/person/car placement.

---

## Part 3: Ranked Prioritization

| Rank | Improvement | Impact | Effort | Est. Time | Phase |
|------|------------|--------|--------|-----------|-------|
| 1 | Palette System | HIGH | LOW | 2h | 1 |
| 2 | Blob Shadows | HIGH | MEDIUM | 4h | 2 |
| 3 | Vertex AO | VERY HIGH | MEDIUM | 4h | 2 |
| 4 | Gradient Sky | MEDIUM | LOW | 1h | 1 |
| 5 | Rounded Silhouettes | MEDIUM | MEDIUM | 3h | 3 |
| 6 | InstancedMesh | MEDIUM | HIGH | 6h | 3 |

---

## Part 4: Three-Phase Rollout

### Phase 1: Cohesion & Atmosphere (6 hours, **shippable**)

**Goal**: Each level reads as a unified world. Fixes the "random colors" and "flat sky" problems.

**Included**:
- Palette system (audit + abstract colors in all levels)
- Gradient sky (CSS or dome)

**Not included**:
- Real-time shadows or lighting changes (zero perf cost, but needs acceptance testing)
- Blob shadows (wait for Phase 2; introduces new geometry type)

**Smoke test**:
- Headless: city + winter, r=12 & r=60. Assert `calls` and `triangles` **unchanged** or within ±2%.
- Manual: each level visually reads as intentional color scheme; sky transitions smoothly.

**Result if shippable**: Players immediately see "this looks less random"; sets stage for depth in Phase 2.

---

### Phase 2: Depth & Lighting (8 hours, **shippable**)

**Goal**: Props no longer look plastic or floating. Baked lighting + shadows create cohesion.

**Included**:
- Vertex-color baked AO (darkened corners, ground proximity)
- Blob shadows (soft groundings)

**Not included**:
- Rounded silhouettes (defer to Phase 3; corner-darkening already adds perceived roundness)
- InstancedMesh (defer; perf optimization, not visual)

**Smoke test**:
- Headless: verify call count & triangles (may rise slightly for AO baking, but merged → no draw calls).
- Manual: corners of buildings visibly darker; props have soft shadows; late-game (r=60) props feel grounded.
- Device test: iPad Air (high perf tier) and iPad mini 2 (low end) — ensure no regression.

**Result if shippable**: Visual quality reaches hole.io baseline. Players say "looks polished now."

---

### Phase 3: Craft & Performance (9 hours, **optional polish**)

**Goal**: Finish the silhouettes and squeeze out late-game perf.

**Included**:
- Rounded silhouettes (beveled boxes, tapered cylinders, tapered trees)
- InstancedMesh for top-10 repeated props

**Not included**:
- Further lighting refinements (if Phase 2 already looks great, diminishing returns)

**Smoke test**:
- Headless: city + winter, r=60. Assert call count drops 10–15% vs. Phase 1 baseline (due to Instancing).
- Manual: silhouettes read as intentional craft; no popping when props appear/disappear; late-game stays smooth on perf tier.

**Result if shippable**: Visual excellence + confirmed late-game perf headroom. Players on older devices stay 60fps; high-end players see zero difference.

---

## Part 5: Implementation Constraints & Gotchas

### Always-On Constraints

1. **GFX tiers**: Changes must not break perf tier (A9X, renderScale 0.45, no soft shadows).
   - Vertex colors: fine on all tiers (pre-computed, not per-frame).
   - Blob shadows: must be merged (no new full-screen pass).
   - Instancing: verify works on WebGL 1 (iPad Air, iPad mini 2).

2. **Script-tag load order**: All new utilities (palette helpers, blob-shadow creation) must be in `props.js` (loaded before levels).

3. **Level registry**: Each level's palette is local to the IIFE in `js/levels/<name>.js`. No cross-level pollution.

4. **Backwards-compatible save data**: Props already serialized; palette change doesn't affect saved state.

### Measurement Gotchas

- **Headless init() does NOT start the render loop**: Must call `renderer.render(scene, camera)` manually after `update()`.
- **Screenshot headless**: Use `--timeout=NNNN --screenshot=...` and `--virtual-time-budget=20000` together; first fixes timing, second ensures all async loads finish.
- **Camera lerp is SLOW on headless**: Snap camera explicitly (`camPos.set(...)`).
- **Instancing vertex buffer uploads**: May add 1–2ms on first pass; measure after warmup loops.

---

## Part 6: Acceptance Criteria Per Phase

### Phase 1 Acceptance

- [ ] All levels have a defined `PALETTE` object with 5–6 core colors.
- [ ] All prop builders sample from palette (audit `houseWall()`, `towerWall()`, hardcoded colors in builders).
- [ ] Sky visibly transitions from horizon (palette.sky) to lighter above.
- [ ] Headless: `calls` and `triangles` **identical** to baseline.

### Phase 2 Acceptance

- [ ] Vertices have AO baked (heights < 25% darkened by 0.2–0.3).
- [ ] Every prop has a soft circular shadow merged into static geometry.
- [ ] Corners of buildings noticeably darker than walls.
- [ ] Late-game (r=60) props appear grounded, not floating.
- [ ] Headless: call count ≤ baseline + 2%; triangles ≤ baseline + 5%.
- [ ] Perf tier device (iPad mini 2): no framerate regression.

### Phase 3 Acceptance

- [ ] Top-10 props (person, tree, car, bush, bench, …) use InstancedMesh.
- [ ] Boxes have visible bevels; cylinders taper; trees cone smoothly.
- [ ] Headless: call count drops 10–15% at r=60 vs. Phase 1.
- [ ] Silhouettes read as intentional craft, not lazy.

---

## Appendix: Baseline Measurements

### Measurement Recipe

1. Copy `index.html` to `smoke.html`.
2. Append a script that:
   - Calls `init(LEVELS.<name>)` for city + winter.
   - Sets `player.r = 12` then `60`, calls `syncHole(player)`.
   - Snaps camera: `camPos.set(player.x, 200, player.z + 160)`.
   - Calls `update()` 3 times to populate scene.
   - Calls `renderer.render(scene, camera)` once.
   - Logs `renderer.info.render.calls` and `.triangles` per level/radius.
3. Run headless:
   ```bash
   "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" \
     --headless=new --disable-gpu --enable-unsafe-swiftshader \
     --enable-logging=stderr --virtual-time-budget=20000 \
     "file:///C:/Users/jmitc/workspace/hole-game/smoke.html" 2>&1 | grep SMOKE
   ```

### Baseline Results

| Level | Radius | Calls | Triangles | Notes |
|-------|--------|-------|-----------|-------|
| city | r=12 | 379 | 15,398 | Starting size |
| city | r=60 | 412 | 17,850 | Late-game (large hole) |
| winter | r=12 | 378 | 23,342 | Denser (more props) |
| winter | r=60 | 359 | 20,554 | Winter LOD/culling kicks in |

**Key insight**: Winter's call count *drops* r=12→r=60 (378→359) because camera zoom culls distant clutter props. City trends up (379→412) because the hole reveals new props. Both are normal LOD behavior.

**Phase targets**:
- Phase 1 (palette + sky): Calls/triangles **unchanged**.
- Phase 2 (AO + shadows): Calls ≤ baseline + 2%, triangles ≤ baseline + 5%.
- Phase 3 (instancing): Calls 10–15% **lower** at r=60 (due to batching).

---

## Conclusion

This roadmap is grounded in **baked, zero-cost-per-frame techniques**. Every improvement ships merged into static geometry or pre-baked textures. A9X perf tier will see identical framerate; modern phones get enhanced visual polish. Phases are independently shippable; Phase 1 alone delivers cohesion; Phase 2 delivers hole.io visual parity; Phase 3 is polish + confirmed late-game headroom.
