# AGENTS.md

## Overview

Vanilla HTML5 Canvas Asteroids clone. No dependencies, no bundler, no build step, no tests, no `package.json`. Do not introduce tooling or libraries unless asked.

## Run

Open `index.html` directly in a browser, or `npx serve .` → `http://localhost:3000`.

## Architecture

- Entire game lives in `game.js` (~420 lines), loaded as a plain `<script>` from `index.html` — it is NOT an ES module. Don't add `import`/`export` without also changing the script tag.
- Loop: `loop(ts)` → `update(dt)` + `draw()`. All movement is delta-time based; `dt` is clamped to 0.05s.
- State machine in the global `state`: `'playing' | 'dead' | 'gameover'`.
- Entities (`Ship`, `Bullet`, `Asteroid`, `Particle`) are plain classes sharing the globals `ctx`, `W`, `H`. Entities are flagged `dead` and filtered out each frame.
- Space is toroidal: positions wrap via `wrap(v, max)`.
- Input: `keys` = held state; `justPressed`/`pressed()` = edge-triggered and consumed on first read — call `pressed()` exactly once per frame per key.

## Gotchas

- Canvas size (800x600) is hardcoded in two places: the `<canvas>` tag in `index.html` and `W`/`H` in `game.js`. Change both.
- Comments and UI strings are in Spanish — keep them Spanish.
- README.md describes power-ups and a "estrella fugaz" asteroid type that are NOT implemented in `game.js`; trust the code.
- There are no lint, typecheck, or test commands. Verify changes by playing the game in a browser.
