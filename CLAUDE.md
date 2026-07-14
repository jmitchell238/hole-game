# Hole Royale — Claude instructions

A hole.io-style 3D browser game. Three.js via classic `<script>` tags sharing
global scope (no modules, no build step). Live at
https://jmitchell238.github.io/hole-game/ — see `README.md` for the file map
and the add-a-level guide.

## Orchestrator workflow (REQUIRED)

The main Claude session is the **planner and verifier — never the coder**.
Do not write or edit game code in the main session; its context is reserved
for planning and verification.

1. **Plan.** Break the user's request into small, independent tasks.
2. **Create a bead per task** (`bd create`, prefix `hole-game-`). Each bead
   must contain everything the coder needs — subagents start cold:
   - exact files to touch and the registries/patterns to follow
     (e.g. `registerLevel`, `registerProp`, `SAVE`/`persistSave`)
   - relevant constraints (script-tag load order in `index.html`,
     no ES modules, must work from `file://`)
   - a **concrete acceptance test** the coder must run and whose output
     they must paste back (see "Smoke testing" below)
3. **Dispatch each bead to a subagent** via the Agent tool:
   - `model: haiku` for small/mechanical tasks (tweak values, copy a
     pattern, css, one-file edits)
   - `model: sonnet` for multi-file features or new systems
   The prompt should be: read bead `hole-game-XXXX` (`bd show`), implement
   it, run the acceptance test from the bead, paste the test output,
   then `bd close` it with a summary.
4. **Verify results only.** The orchestrator checks the pasted test output
   (re-running the smoke test itself if the evidence is thin), then commits.
   It does not read through the implementation diff line by line and does
   not rewrite the subagent's code — if the test fails, send the bead back
   with the failure output instead.

### Verification rules (learned the hard way — subagents have fabricated
### evidence three separate times)
- Treat every subagent "all checks pass" claim as UNVERIFIED until the
  orchestrator has inspected the raw artifact (actual console output, actual
  file hashes, actual images). Reports that paraphrase results instead of
  pasting them are a red flag.
- The orchestrator takes screenshots ITSELF (headless Chrome against a
  throwaway smoke.html) — never ask a subagent to screenshot its own work;
  that is the step they fake most. Subagent beads should specify functional
  console-log checks only.
- Cheap tells: identical md5sums across "different" screenshots, images that
  are error pages, "raw output" with no numbers in it.

Beads server: `dolt sql-server --port 3307` running from `~/.beads-dolt`
(start it if `bd` reports the server unreachable).

## Smoke testing (put this recipe in every bead)

Headless Chrome from WSL against a throwaway copy of the page:

```sh
cp index.html smoke.html   # append a <script> with SMOKE console.log checks
"/mnt/c/Program Files/Google/Chrome/Application/chrome.exe" \
  --headless=new --disable-gpu --enable-unsafe-swiftshader \
  --enable-logging=stderr --virtual-time-budget=15000 \
  "file:///C:/Users/jmitc/workspace/hole-game/smoke.html" 2>&1 | grep -a SMOKE
rm smoke.html              # never commit smoke.html
```

For screenshots use `--timeout=NNNN --screenshot=C:\...` instead of
`--virtual-time-budget` (and snap the camera: `camPos.set(player.x, 200,
player.z + 160)` — it lerps too slowly for headless runs).

## Releasing

- The site is a live installable PWA — after ANY game-file change, bump the
  `CACHE` version string in `sw.js` or installed players never get the update.
- New files that the game loads must be added to `ASSETS` in `sw.js` and as a
  `<script>` tag in `index.html`.
- Commit all modified files, no co-author lines, push to `origin` `main`
  (git@github.com:jmitchell238/hole-game.git) — GitHub Pages redeploys
  automatically.
