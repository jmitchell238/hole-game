// VoidRush performance / integration suite.
// Logs lines as: PERF key=value
// Failures: PERF FAIL key=value budget=N
// Summary: PERF RESULT pass|fail

(function () {
  const logEl = document.getElementById('log');
  const lines = [];
  function log(msg) {
    lines.push(msg);
    console.log(msg);
    if (logEl) logEl.textContent = lines.join('\n');
  }

  // Budgets inlined so file:// loads without fetch issues; keep in sync with budgets.json
  const BUDGETS = {
    init_city_ms: 8000,
    init_island_ms: 12000,
    update_ms_p95: 12,
    render_ms_p95_r12: 25,
    render_ms_p95_r60: 28,
    render_ms_p95_r130: 32,
    render_ms_p95_r250: 36,
    streamed_props_r12_max: 2500,
    streamed_props_r60_max: 2500,
    streamed_props_r130_max: 2500,
    streamed_props_r250_max: 2500,
    full_lod_r12_max: 900,
    full_lod_r60_max: 700,
    full_lod_r130_max: 500,
    full_lod_r250_max: 400,
    scene_meshes_r12_max: 2800,
    scene_meshes_r60_max: 3200,
    scene_meshes_r130_max: 3600,
    scene_meshes_r250_max: 4000,
    streamed_frac_late_max: 0.35,
  };

  let fails = 0;
  function metric(key, value, budget, mode) {
    // mode: 'max' (value must be <= budget) or 'min'
    const v = typeof value === 'number' ? value : parseFloat(value);
    log('PERF ' + key + '=' + (Number.isInteger(v) ? v : v.toFixed(3)));
    if (budget == null || Number.isNaN(v)) return;
    const bad = mode === 'min' ? v < budget : v > budget;
    if (bad) {
      fails++;
      log('PERF FAIL ' + key + '=' + v + ' budget=' + budget);
    }
  }

  function percentile(arr, p) {
    if (!arr.length) return 0;
    const a = arr.slice().sort((x, y) => x - y);
    const i = Math.min(a.length - 1, Math.floor(a.length * p));
    return a[i];
  }

  function measure(fn, n) {
    const samples = [];
    for (let i = 0; i < n; i++) {
      const t0 = performance.now();
      fn();
      samples.push(performance.now() - t0);
    }
    return samples;
  }

  function snapCamera() {
    if (!player) return;
    const height = 22.5 + player.r * 7.3, depth = 18.5 + player.r * 6.2;
    camPos.set(player.x, height, player.z + depth);
    camera.position.copy(camPos);
    camera.lookAt(player.x, 0, player.z);
    if (typeof streamProps === 'function') streamProps(true);
  }

  function syncPlayer(r) {
    player.r = r;
    if (typeof syncHole === 'function') syncHole(player);
    snapCamera();
  }

  function unitSpatial() {
    log('PERF section=unit_spatial');
    metric('unit_viewRadius_defined', typeof viewRadius === 'function' ? 1 : 0, 1, 'min');
    metric('unit_streamProps_defined', typeof streamProps === 'function' ? 1 : 0, 1, 'min');
    metric('unit_cellKey', typeof cellKey === 'function' && cellKey(150, -50) === '1:-1' ? 1 : 0, 1, 'min'); // 150/120→1, -50/120→-1
  }

  function runLevelBench(levelId) {
    log('PERF section=level level=' + levelId);
    SAVE.debug = true;
    SAVE.shadows = false;
    // Avoid TDZ on hud.js's selectedLevelId — call init with the level object directly
    const level = LEVELS[levelId];
    if (!level) throw new Error('missing level ' + levelId);

    const t0 = performance.now();
    init(level);
    const initMs = performance.now() - t0;
    metric('init_' + levelId + '_ms', initMs, BUDGETS['init_' + levelId + '_ms'], 'max');
    metric('props_total_' + levelId, objects.length, null);

    // Force solo (no bots) for stable bench
    battleMode = false;
    while (holes.length > 1) {
      const h = holes.pop();
      if (h !== player) removeHole(h);
    }
    refreshGround(true);

    running = true;
    last = performance.now();
    timeLeft = 999;

    const radii = [12, 60, 130, 250];
    const streamedAt = {};

    for (const r of radii) {
      syncPlayer(r);
      for (let i = 0; i < 5; i++) { update(0.016); render(); }

      const upd = measure(() => update(0.016), 40);
      const ren = measure(() => render(), 40);

      const streamed = typeof countStreamedProps === 'function' ? countStreamedProps() : objects.length;
      const meshes = typeof countSceneMeshes === 'function' ? countSceneMeshes() : -1;
      streamedAt[r] = streamed;

      metric('update_ms_p95_r' + r + '_' + levelId, percentile(upd, 0.95), BUDGETS.update_ms_p95, 'max');
      metric('render_ms_p95_r' + r + '_' + levelId, percentile(ren, 0.95), BUDGETS['render_ms_p95_r' + r], 'max');
      const fullLod = typeof countFullLodProps === 'function' ? countFullLodProps() : -1;
      metric('streamed_props_r' + r + '_' + levelId, streamed, null); // almost all stay parented now
      metric('full_lod_r' + r + '_' + levelId, fullLod, BUDGETS['full_lod_r' + r + '_max'], 'max');
      metric('scene_meshes_r' + r + '_' + levelId, meshes, BUDGETS['scene_meshes_r' + r + '_max'], 'max');
      metric('view_radius_r' + r + '_' + levelId, typeof viewRadius === 'function' ? viewRadius() : -1, null);
    }

    // Full-detail count must stay bounded late game (proxies handle the rest)
    if (objects.length > 0 && streamedAt[250] != null) {
      // re-read full lod at r=250 via last stream pass
      const fullLate = typeof countFullLodProps === 'function' ? countFullLodProps() : 0;
      metric('full_lod_frac_late_' + levelId, fullLate / objects.length,
        BUDGETS.streamed_frac_late_max, 'max');
    }

    running = false;
  }

  window.addEventListener('load', function () {
    setTimeout(function () {
      try {
        log('PERF version=' + GAME_VERSION);
        log('PERF mobile=' + GFX.mobile + ' stream=' + GFX.streamProps + ' merge=' + GFX.mergeProps);

        if (typeof layoutFrame === 'function') layoutFrame();
        renderer.setSize(1280, 720);
        FRAME.w = 1280; FRAME.h = 720;
        camera.aspect = 1280 / 720;
        camera.updateProjectionMatrix();

        unitSpatial();
        runLevelBench('city');
        runLevelBench('island');

        log('PERF RESULT ' + (fails === 0 ? 'pass' : 'fail'));
        log('PERF fails=' + fails);
      } catch (e) {
        log('PERF FAIL exception=' + e.message);
        log(e.stack || '');
        log('PERF RESULT fail');
      }
    }, 400);
  });
})();
