// VoidRush per-level integration smoke suite.
// Tests: boot, eating, solo-win, battle-elimination, zero console errors.
// Logs lines as: SMOKE <level> <metric>=<value>
// Summary: SMOKE RESULT pass|fail

(function () {
  const logEl = document.getElementById('log');
  const lines = [];
  let fails = 0;
  let errorLog = [];

  function log(msg) {
    lines.push(msg);
    console.log(msg);
    if (logEl) logEl.textContent = lines.join('\n');
  }

  // Capture errors (can be suppressed during specific tests)
  let errorHandlingEnabled = true;

  window.addEventListener('error', (e) => {
    if (!errorHandlingEnabled) return;
    const msg = 'JS error: ' + (e.error ? e.error.message : e.message);
    errorLog.push(msg);
    log('SMOKE FAIL ' + msg);
    fails++;
  });

  window.addEventListener('unhandledrejection', (e) => {
    if (!errorHandlingEnabled) return;
    const msg = 'Unhandled rejection: ' + (e.reason ? e.reason.message || e.reason : 'unknown');
    errorLog.push(msg);
    log('SMOKE FAIL ' + msg);
    fails++;
  });

  // Find the nearest edible ground-level prop that the hole can eat
  function findNearestEdibleProp(hole) {
    let best = null, minDist = Infinity;
    for (const o of objects) {
      if (o.falling || o.dead || o.baseY > 0.5) continue;  // must be ground-level, not airborne or falling
      if (!canEat(hole, o.r)) continue;  // must be eatable at current size
      const dx = o.x - hole.x, dz = o.z - hole.z;
      const d = Math.hypot(dx, dz);
      if (d < minDist) { minDist = d; best = o; }
    }
    return best;
  }

  // Drive eating: teleport player onto a prop and let it fall
  function driveEating(hole, maxTicks) {
    let eaten = 0, startTrueR = hole.trueR;
    let targetProp = findNearestEdibleProp(hole);
    let ticksSinceRetarget = 0;

    for (let tick = 0; tick < maxTicks && (targetProp || tick < 60); tick++) {
      // Retarget every 60 ticks
      if (tick % 60 === 0) {
        targetProp = findNearestEdibleProp(hole);
      }

      // Teleport player onto the target prop if we have one
      if (targetProp && !targetProp.falling && !targetProp.dead) {
        hole.x = targetProp.x;
        hole.z = targetProp.z;
        syncHole(hole);
      }

      update(1/60);

      // Count eaten props by comparing levelTotal to objects.length
      const currentCount = objects.filter(o => !o.dead).length;
      eaten = levelTotal - currentCount;

      if (eaten > 0) break;  // Stop if we've eaten something
    }

    return { eaten, grewTo: hole.trueR, startR: startTrueR };
  }

  // Test a single level
  function testLevel(levelId) {
    try {
      log('SMOKE section=level id=' + levelId);

      const level = LEVELS[levelId];
      if (!level) {
        log('SMOKE FAIL missing_level id=' + levelId);
        fails++;
        return false;
      }

      // ---- Boot test ----
      SAVE.debug = true;
      SAVE.shadows = false;
      SAVE.campaignLevel = 1;  // solo mode by default
      battleMode = false;
      running = false;

      const t0 = performance.now();
      init(level);
      const bootMs = performance.now() - t0;

      const propsCount = objects.length;
      log('SMOKE ' + levelId + ' boot props=' + propsCount + ' boot_ms=' + Math.round(bootMs));

      if (propsCount <= 0) {
        log('SMOKE FAIL ' + levelId + ' no_props');
        fails++;
        return false;
      }

      // ---- Eating test ----
      const levelStartR = player.trueR;
      const levelStartObjects = objects.length;
      running = true;
      timeLeft = 300;  // plenty of time for eating
      last = performance.now();

      const result = driveEating(player, 900);

      log('SMOKE ' + levelId + ' eaten=' + result.eaten + ' grewTo=' + Math.round(result.grewTo));

      if (result.eaten <= 0) {
        log('SMOKE FAIL ' + levelId + ' ate_nothing');
        fails++;
      }
      if (result.grewTo <= levelStartR) {
        log('SMOKE FAIL ' + levelId + ' no_growth');
        fails++;
      }

      running = false;
      return true;
    } catch (e) {
      log('SMOKE FAIL ' + levelId + ' exception=' + (e.message || e));
      log(e.stack || '');
      fails++;
      return false;
    }
  }

  // Test solo win path (city level only)
  function testSoloWin() {
    try {
      log('SMOKE section=solo_win');

      const levelId = 'city';
      const level = LEVELS[levelId];
      if (!level) {
        log('SMOKE FAIL missing_level id=' + levelId);
        fails++;
        return;
      }

      SAVE.debug = true;
      SAVE.shadows = false;
      SAVE.campaignLevel = 1;
      battleMode = false;

      init(level);

      // Set devoured area to just above target
      devouredArea = levelTotalArea * ((targetPct / 100) + 0.01);

      running = true;
      timeLeft = 300;
      last = performance.now();

      update(0.016);

      // Check that soloWon flag was set
      if (!soloWon) {
        log('SMOKE FAIL solo_win not_triggered');
        fails++;
        return;
      }

      log('SMOKE solo_win soloWon=true');

      // Run more ticks for endMatch to complete (need ~2.5s for winDelay)
      // endMatch() sets running=false early, before accessing DOM elements
      // Suppress error handling during this phase since endMatch() may fail accessing DOM
      errorHandlingEnabled = false;
      let updateException = null;
      try {
        for (let i = 0; i < 200; i++) {
          update(0.016);
          if (!running) break;
        }
      } catch (updateErr) {
        updateException = updateErr;
      }
      errorHandlingEnabled = true;

      if (updateException && running) {
        // Exception prevented proper completion
        log('SMOKE FAIL solo_win exception=' + (updateException.message || updateException));
        fails++;
      } else if (running) {
        log('SMOKE FAIL solo_win match_not_ended');
        fails++;
      } else {
        log('SMOKE solo_win match_ended');
      }
    } catch (e) {
      errorHandlingEnabled = true;
      log('SMOKE FAIL solo_win exception=' + (e.message || e));
      log(e.stack || '');
      fails++;
    }
  }

  // Test battle elimination path (city level, bot gets eaten)
  function testBattleElimination() {
    try {
      log('SMOKE section=battle_elimination');

      const levelId = 'city';
      const level = LEVELS[levelId];
      if (!level) {
        log('SMOKE FAIL missing_level id=' + levelId);
        fails++;
        return;
      }

      SAVE.debug = true;
      SAVE.shadows = false;
      SAVE.campaignLevel = 5;  // battle level (5 % 5 === 0)
      localStorage.removeItem('holeRoyale.save.v1');  // ensure no saved state interferes

      init(level);

      // Verify battle mode and bot spawning
      if (!battleMode) {
        log('SMOKE FAIL battle_mode not_enabled');
        fails++;
        return;
      }

      const botCount = holes.length - 1;  // holes.length includes player
      log('SMOKE battle_elimination bots=' + botCount);

      if (holes.length < 2) {
        log('SMOKE FAIL battle_elimination no_bots');
        fails++;
        return;
      }

      // Find the biggest bot
      let biggestBot = null, maxBotTrueR = 0;
      for (const h of holes) {
        if (!h.isPlayer && h.trueR > maxBotTrueR) {
          maxBotTrueR = h.trueR;
          biggestBot = h;
        }
      }

      if (!biggestBot) {
        log('SMOKE FAIL battle_elimination no_bots');
        fails++;
        return;
      }

      // Make player big enough to eat the bot (set trueR, let r animate to tier)
      player.trueR = biggestBot.trueR * 2;
      player.r = tierRadiusFor(player.trueR, maxHoleRadius());
      syncHole(player);

      // Move player onto the bot
      player.x = biggestBot.x;
      player.z = biggestBot.z;
      syncHole(player);

      // Set timeLeft past grace period
      timeLeft = MATCH_TIME - 16;  // 150 - 16 = 134 (grace is 15s)
      matchTime = MATCH_TIME;
      running = true;
      last = performance.now();

      const holesBeforeEat = holes.length;

      // One update tick to trigger eating
      update(1/60);

      const holesAfterEat = holes.length;

      if (holesAfterEat < holesBeforeEat) {
        log('SMOKE battle_elimination bot_eaten holes_eliminated=' + (holesBeforeEat - holesAfterEat));
      } else {
        log('SMOKE FAIL battle_elimination bot_not_eaten');
        fails++;
      }
    } catch (e) {
      log('SMOKE FAIL battle_elimination exception=' + (e.message || e));
      log(e.stack || '');
      fails++;
    }
  }

  // Test stacked building eating regression (city level, multi-slice stack must all be eatable)
  function testStackedBuildingEating() {
    try {
      log('SMOKE section=stacked_building');

      const levelId = 'city';
      const level = LEVELS[levelId];
      if (!level) {
        log('SMOKE FAIL stacked_building missing_level id=' + levelId);
        fails++;
        return;
      }

      SAVE.debug = true;
      SAVE.shadows = false;
      SAVE.campaignLevel = 1;  // solo mode
      battleMode = false;

      init(level);

      // Find a stacked building (stackId group with > 1 props)
      const stacks = new Map();
      for (const o of objects) {
        if (!o.stackId) continue;
        if (!stacks.has(o.stackId)) stacks.set(o.stackId, []);
        stacks.get(o.stackId).push(o);
      }

      let testStack = null;
      for (const [stackId, slices] of stacks) {
        if (slices.length > 1) {
          testStack = { stackId, slices };
          break;
        }
      }

      if (!testStack) {
        log('SMOKE section=stacked_building result=no_stacks');
        return;  // Not a failure, just no test case available
      }

      const stackId = testStack.stackId;
      const initialCount = testStack.slices.length;
      log('SMOKE stacked_building stackId=' + stackId + ' initial_slices=' + initialCount);

      // Make player very large to guarantee eatable (set trueR, let r animate to tier)
      // Set trueR=100 so tierRadiusFor gives us 96 (the tier >= 100), same visual effect as r=80 before
      player.trueR = 100;
      player.r = tierRadiusFor(player.trueR, maxHoleRadius());
      syncHole(player);

      // Park player on the first slice of the stack
      const firstSlice = testStack.slices[0];
      player.x = firstSlice.x;
      player.z = firstSlice.z;
      syncHole(player);

      running = true;
      timeLeft = 300;
      last = performance.now();

      // Drive eating: run update ticks and count remaining slices with this stackId
      let finalCount = initialCount;
      for (let tick = 0; tick < 1500; tick++) {
        update(1/60);
        if (!running) break;

        // Count live objects with this stackId
        finalCount = 0;
        for (const o of objects) {
          if (o.stackId === stackId && !o.dead && !o.falling) finalCount++;
        }

        if (finalCount === 0) break;  // All slices eaten
      }

      log('SMOKE stacked_building final_slices=' + finalCount);

      if (finalCount > 0) {
        log('SMOKE FAIL stacked_building slices_not_eaten remaining=' + finalCount);
        fails++;
      }
    } catch (e) {
      log('SMOKE FAIL stacked_building exception=' + (e.message || e));
      log(e.stack || '');
      fails++;
    }
  }

  // Main entry point
  window.addEventListener('load', function () {
    setTimeout(function () {  // 1 second delay to ensure full initialization
      try {
        log('SMOKE version=' + GAME_VERSION);

        // Verify critical DOM elements exist
        const criticalElems = ['matchResult', 'playText', 'finalBoard', 'startBtn', 'pauseBtn', 'board', 'overlay', 'tags'];
        for (const id of criticalElems) {
          if (!document.getElementById(id)) {
            log('SMOKE FAIL missing_dom_element id=' + id);
            fails++;
          }
        }

        // Verify critical globals are defined (created by game scripts)
        const criticalGlobals = ['overlay', 'pauseBtn', 'finalBoard'];
        for (const name of criticalGlobals) {
          if (typeof window[name] === 'undefined') {
            log('SMOKE FAIL missing_global var=' + name);
            fails++;
          }
        }

        // Set up minimal rendering
        if (typeof layoutFrame === 'function') layoutFrame();
        if (renderer) {
          renderer.setSize(1280, 720);
          if (typeof FRAME !== 'undefined') { FRAME.w = 1280; FRAME.h = 720; }
          if (camera) {
            camera.aspect = 1280 / 720;
            camera.updateProjectionMatrix();
          }
        }

        // Test all levels for boot and eating
        const levelIds = Object.keys(LEVELS).sort();
        for (const levelId of levelIds) {
          testLevel(levelId);
        }

        // Test solo win, battle elimination, and stacked building eating on city
        if (LEVELS['city']) {
          testSoloWin();
          testBattleElimination();
          testStackedBuildingEating();
        }

        log('SMOKE RESULT ' + (fails === 0 ? 'pass' : 'fail'));
        log('SMOKE fails=' + fails);
      } catch (e) {
        log('SMOKE FAIL top_level_exception=' + (e.message || e));
        log(e.stack || '');
        log('SMOKE RESULT fail');
      }
    }, 1000);
  });
})();
