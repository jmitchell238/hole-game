# Development

## Running locally

There's no build step, so you can open `index.html` directly in a browser. To test the service worker and install prompt, serve it instead:

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080.

Turning on debug mode in Settings shows a level picker on the Play tab and an FPS counter. The original 2D prototype is still at `classic2d.html`.

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

Details are in [tests/README.md](../tests/README.md).

## Releasing

Bump `GAME_VERSION` in `js/config.js` and set `CACHE` in `sw.js` to `'voidrush-' + GAME_VERSION`. The tests check that they match. Changing `CACHE` is what makes installed copies download the update.
