// Static release-consistency checks using fs + regex. No jsdom, no THREE.
const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '../../');

describe('index.html script tags', () => {
  let indexContent;

  test('setup: read index.html', () => {
    indexContent = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
    assert(indexContent, 'index.html should exist');
  });

  test('every <script src="..."> path exists on disk', () => {
    const scriptRegex = /<script\s+src="([^"]+)"/g;
    let match;
    const missing = [];
    while ((match = scriptRegex.exec(indexContent))) {
      const src = match[1];
      const filePath = path.join(ROOT, src);
      if (!fs.existsSync(filePath)) {
        missing.push(src);
      }
    }
    assert.strictEqual(missing.length, 0, `Missing script files: ${missing.join(', ')}`);
  });
});

describe('sw.js CACHE and ASSETS consistency', () => {
  let swContent, configContent, indexContent;
  let cacheVersion, gameVersion;

  test('setup: read sw.js, js/config.js, index.html', () => {
    swContent = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf-8');
    configContent = fs.readFileSync(path.join(ROOT, 'js/config.js'), 'utf-8');
    indexContent = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
    assert(swContent, 'sw.js should exist');
    assert(configContent, 'js/config.js should exist');
  });

  test('CACHE in sw.js matches voidrush- + GAME_VERSION', () => {
    const cacheMatch = swContent.match(/const\s+CACHE\s*=\s*['"]([^'"]+)['"]/);
    assert(cacheMatch, 'CACHE should be defined in sw.js');
    cacheVersion = cacheMatch[1];

    const gameVersionMatch = configContent.match(/const\s+GAME_VERSION\s*=\s*['"]([^'"]+)['"]/);
    assert(gameVersionMatch, 'GAME_VERSION should be defined in js/config.js');
    gameVersion = gameVersionMatch[1];

    const expectedCache = 'voidrush-' + gameVersion;
    assert.strictEqual(cacheVersion, expectedCache,
      `CACHE "${cacheVersion}" should equal "voidrush-${gameVersion}"`);
  });

  test('every <script src> in index.html appears in sw.js ASSETS (except vendor if policy)', () => {
    const scriptRegex = /<script\s+src="([^"]+)"/g;
    const assetsRegex = /['"]([./][^'"]+)['"]/;
    const assetsLines = swContent.split('\n');
    const assetsSet = new Set();

    for (const line of assetsLines) {
      const match = line.match(assetsRegex);
      if (match) {
        assetsSet.add(match[1]);
      }
    }

    let match;
    const missing = [];
    while ((match = scriptRegex.exec(indexContent))) {
      const src = match[1];
      // Strip leading './' if present (ASSETS uses './' prefix)
      const normalizedSrc = src.startsWith('./') ? src : './' + src;
      if (!assetsSet.has(normalizedSrc)) {
        missing.push(src);
      }
    }
    assert.strictEqual(missing.length, 0,
      `Script tags in index.html not in sw.js ASSETS: ${missing.join(', ')}`);
  });

  test('every ASSETS entry exists on disk', () => {
    // Parse ASSETS array more carefully: look for lines with quoted strings
    // that are array elements (not in comments)
    const assetsMatch = swContent.match(/const\s+ASSETS\s*=\s*\[([\s\S]*?)\];/);
    assert(assetsMatch, 'ASSETS array should be defined');

    const assetsContent = assetsMatch[1];
    const assetsRegex = /['"]([./][^'"]*)['"]/g;
    const missing = [];
    let match;
    const seenAssets = new Set();

    while ((match = assetsRegex.exec(assetsContent))) {
      let assetPath = match[1];
      if (seenAssets.has(assetPath)) continue;
      seenAssets.add(assetPath);

      // Skip './' (root directory reference)
      if (assetPath === './') continue;

      const filePath = path.join(ROOT, assetPath);
      if (!fs.existsSync(filePath)) {
        missing.push(assetPath);
      }
    }
    assert.strictEqual(missing.length, 0,
      `ASSETS entries that don't exist on disk: ${missing.join(', ')}`);
  });
});

describe('Level files consistency', () => {
  test('every js/levels/*.js contains registerLevel( and required keys', () => {
    const levelsDir = path.join(ROOT, 'js/levels');
    const files = fs.readdirSync(levelsDir).filter(f => f.endsWith('.js'));
    assert(files.length > 0, 'should have at least one level file');

    const requiredKeys = ['id', 'name', 'world', 'generate', 'populate'];
    const missing = [];

    for (const file of files) {
      const filePath = path.join(levelsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      if (!content.includes('registerLevel(')) {
        missing.push(`${file}: missing registerLevel(`);
        continue;
      }

      for (const key of requiredKeys) {
        const keyRegex = new RegExp(`["']?${key}["']?\\s*[,:=]`, 'i');
        if (!keyRegex.test(content)) {
          missing.push(`${file}: missing key '${key}'`);
        }
      }
    }

    assert.strictEqual(missing.length, 0,
      `Level files issues:\n${missing.join('\n')}`);
  });

  test('level files: city, city-test, island, winter, desert, medieval exist', () => {
    const levelsDir = path.join(ROOT, 'js/levels');
    const requiredLevels = ['city.js', 'city-test.js', 'island.js', 'winter.js', 'desert.js', 'medieval.js'];
    const missing = [];

    for (const level of requiredLevels) {
      const filePath = path.join(levelsDir, level);
      if (!fs.existsSync(filePath)) {
        missing.push(level);
      }
    }

    assert.strictEqual(missing.length, 0, `Missing level files: ${missing.join(', ')}`);
  });
});

describe('budgets.json consistency with perf-suite.js', () => {
  let budgetsData = {};

  test('tests/perf/budgets.json exists', () => {
    const budgetsPath = path.join(ROOT, 'tests/perf/budgets.json');
    assert(fs.existsSync(budgetsPath), 'tests/perf/budgets.json should exist');
    const content = fs.readFileSync(budgetsPath, 'utf-8');
    budgetsData = JSON.parse(content);
  });

  test('budgets.json keys match perf-suite BUDGETS (ignoring _* metadata)', () => {
    const perfSuitePath = path.join(ROOT, 'tests/perf/perf-suite.js');
    const perfContent = fs.readFileSync(perfSuitePath, 'utf-8');
    const budgetsMatch = perfContent.match(/const\s+BUDGETS\s*=\s*\{([^}]+)\}/s);
    assert(budgetsMatch, 'BUDGETS should be defined in perf-suite.js');

    const budgetsObj = {};
    const keyValueRegex = /(\w+)\s*:\s*([^,}]+)/g;
    let match;
    while ((match = keyValueRegex.exec(budgetsMatch[1]))) {
      const key = match[1];
      const value = parseFloat(match[2].trim());
      budgetsObj[key] = value;
    }

    // Filter out metadata keys (starting with _) from budgets.json
    const budgetsKeys = Object.keys(budgetsData)
      .filter(k => !k.startsWith('_'))
      .sort();
    const suiteKeys = Object.keys(budgetsObj).sort();

    assert.deepStrictEqual(budgetsKeys, suiteKeys,
      `budgets.json keys (excluding _*) should match perf-suite.js BUDGETS`);
  });

  test('budgets.json values match perf-suite BUDGETS', () => {
    const perfSuitePath = path.join(ROOT, 'tests/perf/perf-suite.js');
    const perfContent = fs.readFileSync(perfSuitePath, 'utf-8');
    const budgetsMatch = perfContent.match(/const\s+BUDGETS\s*=\s*\{([^}]+)\}/s);

    const budgetsObj = {};
    const keyValueRegex = /(\w+)\s*:\s*([^,}]+)/g;
    let match;
    while ((match = keyValueRegex.exec(budgetsMatch[1]))) {
      const key = match[1];
      const value = parseFloat(match[2].trim());
      budgetsObj[key] = value;
    }

    for (const [key, value] of Object.entries(budgetsObj)) {
      assert.strictEqual(budgetsData[key], value,
        `budgets.json['${key}'] should equal ${value}`);
    }
  });
});
