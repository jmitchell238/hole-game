// Unit tests for spatial hash grid (js/core.js::makeGrid)
const { test, describe } = require('node:test');
const assert = require('node:assert');
const core = require('../../js/core.js');

describe('makeGrid(cellSize)', () => {
  test('insert and queryCircle basic case', () => {
    const grid = core.makeGrid(120);

    // Create mock objects
    const props = [
      { x: 0, z: 0, r: 10, id: 1 },
      { x: 50, z: 50, r: 8, id: 2 },
      { x: 200, z: 200, r: 12, id: 3 },
      { x: 150, z: 0, r: 9, id: 4 },
    ];

    // Insert all props
    for (const p of props) {
      grid.insert(p, p.x, p.z);
    }

    // Query circle at (0,0) with radius 100 — should get props 1, 2
    const results = grid.queryCircle(0, 0, 100, []);
    const ids = results.map(p => p.id).sort();
    assert.deepStrictEqual(ids, [1, 2], 'queryCircle(0,0,100) should return props 1,2');
  });

  test('remove works correctly', () => {
    const grid = core.makeGrid(120);

    const p1 = { x: 0, z: 0, r: 10, id: 1 };
    const p2 = { x: 50, z: 50, r: 8, id: 2 };

    grid.insert(p1, p1.x, p1.z);
    grid.insert(p2, p2.x, p2.z);

    let results = grid.queryCircle(0, 0, 100, []);
    assert.strictEqual(results.length, 2, 'should have 2 props after insert');

    grid.remove(p1);
    results = grid.queryCircle(0, 0, 100, []);
    assert.strictEqual(results.length, 1, 'should have 1 prop after remove');
    assert.strictEqual(results[0].id, 2, 'remaining prop should be p2');
  });

  test('queryRect works correctly', () => {
    const grid = core.makeGrid(120);

    const props = [
      { x: 50, z: 50, r: 10, id: 1 },
      { x: 100, z: 100, r: 8, id: 2 },
      { x: 200, z: 200, r: 12, id: 3 },
    ];

    for (const p of props) {
      grid.insert(p, p.x, p.z);
    }

    // Query rect from 0 to 150 in both axes — should get props 1, 2
    const results = grid.queryRect(0, 150, 0, 150, []);
    const ids = results.map(p => p.id).sort();
    assert.deepStrictEqual(ids, [1, 2], 'queryRect should find props within bounds');
  });

  test('empty query returns empty array', () => {
    const grid = core.makeGrid(120);
    const results = grid.queryCircle(1000, 1000, 50, []);
    assert.strictEqual(results.length, 0, 'empty grid query should return []');
  });

  test('cellCount and totalObjects', () => {
    const grid = core.makeGrid(120);

    assert.strictEqual(grid.cellCount(), 0, 'empty grid has 0 cells');
    assert.strictEqual(grid.totalObjects(), 0, 'empty grid has 0 objects');

    const p1 = { x: 0, z: 0, r: 10 };
    const p2 = { x: 50, z: 50, r: 8 };
    grid.insert(p1, p1.x, p1.z);
    grid.insert(p2, p2.x, p2.z);

    assert.strictEqual(grid.cellCount(), 1, 'two nearby props should be in 1 cell');
    assert.strictEqual(grid.totalObjects(), 2, 'should have 2 objects');
  });

  test('large grid with random props (brute-force comparison)', () => {
    // Use seeded RNG for reproducibility
    const rng = core.mulberry32(12345);
    const grid = core.makeGrid(120);

    // Generate 100 random props in [-500, 500] x [-500, 500]
    const props = [];
    for (let i = 0; i < 100; i++) {
      const p = {
        x: (rng() - 0.5) * 1000,
        z: (rng() - 0.5) * 1000,
        r: 5 + rng() * 15,
        id: i
      };
      props.push(p);
      grid.insert(p, p.x, p.z);
    }

    // Test several random queries against brute force
    for (let test = 0; test < 10; test++) {
      const cx = (rng() - 0.5) * 1000;
      const cz = (rng() - 0.5) * 1000;
      const r = 50 + rng() * 200;

      const r2 = r * r;
      const bruteForce = props.filter(p => {
        const dx = p.x - cx, dz = p.z - cz;
        return dx*dx + dz*dz <= r2;
      });

      const gridResults = grid.queryCircle(cx, cz, r, []);
      const gridIds = gridResults.map(p => p.id).sort();
      const bruteIds = bruteForce.map(p => p.id).sort();

      assert.deepStrictEqual(gridIds, bruteIds,
        `grid query at (${cx.toFixed(0)},${cz.toFixed(0)}) r=${r.toFixed(0)} matches brute force`);
    }
  });

  test('clear resets grid', () => {
    const grid = core.makeGrid(120);

    grid.insert({ x: 0, z: 0, r: 10 }, 0, 0);
    grid.insert({ x: 50, z: 50, r: 8 }, 50, 50);

    assert.strictEqual(grid.totalObjects(), 2, 'should have 2 objects');

    grid.clear();
    assert.strictEqual(grid.cellCount(), 0, 'clear should remove all cells');
    assert.strictEqual(grid.totalObjects(), 0, 'clear should remove all objects');
  });

  test('queryCircle with reused output array', () => {
    const grid = core.makeGrid(120);

    const p1 = { x: 0, z: 0, r: 10 };
    const p2 = { x: 50, z: 50, r: 8 };
    grid.insert(p1, 0, 0);
    grid.insert(p2, 50, 50);

    const output = [];
    grid.queryCircle(0, 0, 100, output);
    assert.strictEqual(output.length, 2, 'output array should be populated');

    // Query again with same array (should append)
    grid.queryCircle(200, 200, 50, output);
    assert.strictEqual(output.length, 2, 'second query should not find anything in far region');
  });

  test('cells correspond to cellSize boundary', () => {
    const grid = core.makeGrid(120);

    // Props in different cells
    const p1 = { x: 60, z: 60, r: 10 };    // cell (0,0)
    const p2 = { x: 120, z: 120, r: 10 };  // cell (1,1)

    grid.insert(p1, 60, 60);
    grid.insert(p2, 120, 120);

    // Query at p1 with radius 100 should cross cell boundary and find both
    // (distance from (60,60) to (120,120) is sqrt(7200) ≈ 84.85, so radius 100 includes it)
    const results = grid.queryCircle(60, 60, 100, []);
    assert.strictEqual(results.length, 2, 'circle crossing cell boundary should find both props');
  });
});
