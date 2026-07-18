// Unit tests for js/core.js using Node's test/describe + assert
const { test, describe } = require('node:test');
const assert = require('node:assert');
const core = require('../../js/core.js');

describe('sizeLevel(r)', () => {
  test('below first tier (r < 8) → level 1', () => {
    assert.strictEqual(core.sizeLevel(7), 1);
    assert.strictEqual(core.sizeLevel(0), 1);
    assert.strictEqual(core.sizeLevel(1), 1);
  });

  test('at tier boundaries', () => {
    // SIZE_TIERS[0]=8 (not a boundary; lv 1 if r<9)
    // SIZE_TIERS[1]=9 (tier index 1 → level 2 if r>=9)
    assert.strictEqual(core.sizeLevel(8), 1);
    assert.strictEqual(core.sizeLevel(9), 2);
    assert.strictEqual(core.sizeLevel(11), 3);
    assert.strictEqual(core.sizeLevel(12), 4);
    assert.strictEqual(core.sizeLevel(14), 5);
  });

  test('max level cap (r >= 110) → level 20', () => {
    assert.strictEqual(core.sizeLevel(110), 20);
    assert.strictEqual(core.sizeLevel(200), 20);
    assert.strictEqual(core.sizeLevel(1000), 20);
  });
});

describe('growRadius(r, addArea, battleMode)', () => {
  test('no area added → r unchanged', () => {
    assert.strictEqual(core.growRadius(12, 0, false), 12);
    assert.strictEqual(core.growRadius(50, 0, true), 50);
  });

  test('monotonic increase with added area', () => {
    const r1 = core.growRadius(12, 50, false);
    assert(r1 > 12, 'should grow');
    const r2 = core.growRadius(12, 100, false);
    assert(r2 > r1, 'more area → larger radius');
  });

  test('diminishing returns at large radius', () => {
    // Same addArea at r=12 vs r=80 produces less growth at r=80
    const growth12 = core.growRadius(12, 50, false) - 12;
    const growth80 = core.growRadius(80, 50, false) - 80;
    assert(growth80 < growth12, 'diminishing returns at large r');
  });

  test('battle mode damping reduces growth at large r', () => {
    const normalGrowth = core.growRadius(150, 100, false);
    const battleGrowth = core.growRadius(150, 100, true);
    assert(battleGrowth < normalGrowth, 'battle mode reduces growth at large r');
  });
});

describe('canEatR(holeR, propR)', () => {
  test('exact 1.5x boundary', () => {
    // EAT_RATIO = 1.5, so holeR >= propR * 1.5
    assert.strictEqual(core.canEatR(18, 12), true);   // 18 >= 12*1.5 = 18
    assert.strictEqual(core.canEatR(17.9, 12), false); // 17.9 < 18
  });

  test('smaller prop always eatable', () => {
    assert.strictEqual(core.canEatR(20, 10), true);
  });

  test('prop barely larger than hole not eatable', () => {
    assert.strictEqual(core.canEatR(10, 10), false);
  });
});

describe('maxHoleRadiusFor(world)', () => {
  test('world 200 → 50', () => {
    assert.strictEqual(core.maxHoleRadiusFor(200), 50);
  });

  test('world 1000 → 110 (capped by last tier)', () => {
    assert.strictEqual(core.maxHoleRadiusFor(1000), 110);
  });

  test('falsy world → 110 (default)', () => {
    assert.strictEqual(core.maxHoleRadiusFor(null), 110);
    assert.strictEqual(core.maxHoleRadiusFor(undefined), 110);
    assert.strictEqual(core.maxHoleRadiusFor(0), 110);
  });

  test('formula: min(world * 0.25, 110)', () => {
    assert.strictEqual(core.maxHoleRadiusFor(400), 100); // min(100, 110)
    assert.strictEqual(core.maxHoleRadiusFor(440), 110); // min(110, 110)
  });
});

describe('soloTargetPct(campaignLevel)', () => {
  test('level 1 → 50%', () => {
    assert.strictEqual(core.soloTargetPct(1), 50);
  });

  test('level 14 → 89%', () => {
    // min(50 + 3*(14-1), 90) = min(50 + 39, 90) = min(89, 90) = 89
    assert.strictEqual(core.soloTargetPct(14), 89);
  });

  test('level 20 → 90% (capped)', () => {
    // min(50 + 3*(20-1), 90) = min(50 + 57, 90) = min(107, 90) = 90
    assert.strictEqual(core.soloTargetPct(20), 90);
  });

  test('formula: min(50 + 3*(lv-1), 90)', () => {
    for (let lv = 1; lv <= 20; lv++) {
      const expected = Math.min(50 + 3 * (lv - 1), 90);
      assert.strictEqual(core.soloTargetPct(lv), expected);
    }
  });
});

describe('soloReward(won, playerR)', () => {
  test('won: Math.max(5, round(playerR/2)) + 20', () => {
    assert.strictEqual(core.soloReward(true, 12), 26);  // max(5, 6) + 20 = 26
    assert.strictEqual(core.soloReward(true, 100), 70); // max(5, 50) + 20 = 70
  });

  test('lost: Math.max(3, round(playerR/4))', () => {
    assert.strictEqual(core.soloReward(false, 12), 3);  // max(3, 3) = 3
    assert.strictEqual(core.soloReward(false, 100), 25); // max(3, 25) = 25
  });
});

describe('battleReward(eaten, playerR, rank)', () => {
  test('eaten: Math.max(3, round(playerR/4))', () => {
    assert.strictEqual(core.battleReward(true, 12, 0), 3);  // max(3, 3)
    assert.strictEqual(core.battleReward(true, 100, 0), 25); // max(3, 25)
  });

  test('podium bonuses (not eaten)', () => {
    // base = max(5, round(12/2)) = 6
    assert.strictEqual(core.battleReward(false, 12, 1), 31); // 6 + 25 = 31
    assert.strictEqual(core.battleReward(false, 12, 2), 21); // 6 + 15 = 21
    assert.strictEqual(core.battleReward(false, 12, 3), 16); // 6 + 10 = 16
    assert.strictEqual(core.battleReward(false, 12, 4), 6);  // 6 + 0 = 6
  });
});

describe('isBattleLevel(n)', () => {
  test('BATTLE_EVERY = 5; true for n % 5 === 0', () => {
    assert.strictEqual(core.isBattleLevel(5), true);
    assert.strictEqual(core.isBattleLevel(10), true);
    assert.strictEqual(core.isBattleLevel(15), true);
  });

  test('false otherwise', () => {
    assert.strictEqual(core.isBattleLevel(1), false);
    assert.strictEqual(core.isBattleLevel(4), false);
    assert.strictEqual(core.isBattleLevel(6), false);
  });
});

describe('mulberry32(seed)', () => {
  test('same seed produces same sequence', () => {
    const rng1 = core.mulberry32(12345);
    const rng2 = core.mulberry32(12345);
    for (let i = 0; i < 5; i++) {
      assert.strictEqual(rng1(), rng2());
    }
  });

  test('different seed produces different sequence', () => {
    const rng1 = core.mulberry32(12345);
    const rng2 = core.mulberry32(67890);
    const v1 = rng1();
    const v2 = rng2();
    assert.notStrictEqual(v1, v2);
  });

  test('values in [0,1)', () => {
    const rng = core.mulberry32(12345);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      assert(v >= 0 && v < 1, `value ${v} should be in [0,1)`);
    }
  });
});

describe('rand(a, b) with currentRandSource', () => {
  test('honors setRandSource for determinism', () => {
    const seed = 99999;
    core.setRandSource(core.mulberry32(seed));
    const v1 = core.rand(10, 20);

    core.setRandSource(core.mulberry32(seed));
    const v2 = core.rand(10, 20);

    assert.strictEqual(v1, v2);
  });

  test('result in [a, b)', () => {
    core.setRandSource(core.mulberry32(12345));
    for (let i = 0; i < 50; i++) {
      const v = core.rand(10, 20);
      assert(v >= 10 && v < 20, `rand(10,20) should be in [10,20)`);
    }
  });

  test('default Math.random when not set', () => {
    // Reset to Math.random (careful: don't test exact values, just presence)
    core.setRandSource(Math.random);
    const v = core.rand(0, 1);
    assert(typeof v === 'number');
    assert(v >= 0 && v < 1);
  });
});

describe('pick(arr) with currentRandSource', () => {
  test('honors setRandSource for determinism', () => {
    const arr = ['a', 'b', 'c', 'd', 'e'];

    core.setRandSource(core.mulberry32(12345));
    const v1 = core.pick(arr);

    core.setRandSource(core.mulberry32(12345));
    const v2 = core.pick(arr);

    assert.strictEqual(v1, v2);
  });

  test('returns element from array', () => {
    const arr = ['x', 'y', 'z'];
    core.setRandSource(core.mulberry32(12345));
    for (let i = 0; i < 20; i++) {
      const v = core.pick(arr);
      assert(arr.includes(v), `pick should return element from array`);
    }
  });
});

describe('checkinToday(dateObj)', () => {
  test('format YYYY-M-D (not zero-padded)', () => {
    const date = new Date(2025, 0, 15); // Jan 15, 2025
    assert.strictEqual(core.checkinToday(date), '2025-1-15');
  });

  test('single digit month and day', () => {
    const date = new Date(2025, 2, 5); // Mar 5, 2025
    assert.strictEqual(core.checkinToday(date), '2025-3-5');
  });

  test('double digit month and day', () => {
    const date = new Date(2025, 11, 25); // Dec 25, 2025
    assert.strictEqual(core.checkinToday(date), '2025-12-25');
  });
});

describe('Constants exported', () => {
  test('SIZE_TIERS array with 20 entries', () => {
    assert.strictEqual(core.SIZE_TIERS.length, 20);
    assert.strictEqual(core.SIZE_TIERS[0], 8);
    assert.strictEqual(core.SIZE_TIERS[19], 110);
  });

  test('GROW and GROW_FALLOFF', () => {
    assert.strictEqual(core.GROW, 0.40);
    assert.strictEqual(core.GROW_FALLOFF, 30);
  });

  test('EAT_RATIO', () => {
    assert.strictEqual(core.EAT_RATIO, 1.5);
  });

  test('BATTLE_EVERY', () => {
    assert.strictEqual(core.BATTLE_EVERY, 5);
  });

  test('MATCH_TIME and PVP_GRACE', () => {
    assert.strictEqual(core.MATCH_TIME, 150);
    assert.strictEqual(core.PVP_GRACE, 15);
  });
});
