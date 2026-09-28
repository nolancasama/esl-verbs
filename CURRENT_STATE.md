# Current State

## Status (2026-09-29)

The Adventure RPG upgrade (AP economy, HP/potion/XP campaign, RPG quiz UI,
persistent AP meter, late-16-bit art, tiered effects, synthesized music) is
implemented. On 2026-09-29 the follow-up list from the 2026-09-28 handoff was
worked through (screen-fit review, idle-time sprite building, audio tests,
SPEC rewrite, in-play COMBO/OPENING/COUNTER explanations). Everything is
committed and pushed to `origin/master` (github.com/nolancasama/esl-verbs),
which GitHub Pages serves live at https://nolancasama.github.io/esl-verbs/
(checked after the build: new code served, menu and a debug battle run with no
console errors).

Verified 2026-09-29:
- `npm test` — 55 unit tests pass (battle, campaign, balance, art, quiz, audio).
  `test/audio.test.js` was shown to fail on three deliberately broken tracks.
- `PLAYWRIGHT_PATH=C:/Users/nolan/ui-verify/node_modules/playwright npm run test:browser`
  passes with zero console errors.
- Scripted screenshots with overflow / plate-spill / sprite-clip checks at
  1366×768, 1366×742, 1366×700, 1366×635, 1280×800, 1280×650, 1536×730,
  1100×620, 1024×600, 1920×1000: menu, quiz, stage clear, every victory variant,
  defeat, campaign results (9 and 18 missed words), recovery turn, low-HP hint,
  item menu (with and without potions), every tier-3/4 encounter — no page
  scroll, no clipped sprites. (The scripts live in the session scratchpad, not
  the repo.)
- 4× CPU throttle: menu first paint 1640 ms → 404 ms; the stage's enemies are
  built before BATTLE!; an enraged boss's first use costs 0 ms after prewarm.
- Not heard: music/SFX were never listened to (no audio device). Not tried on a
  real Chromebook or with students.

## Architecture notes (details: SPEC.md Adventure section, DESIGN_DECISIONS.md)

- Rules, numbers and contracts: `SPEC.md` (Adventure section rewritten
  2026-09-29 for AP / items / XP / levels / HP carry-over / retry assist).
  Every number lives in `src/battle-data.js`.
- `src/battle-art.js` `prewarmArt(entries, onReady)` builds sprite sheets one
  per idle callback; `src/app.js` uses it for the menu hero trio and in
  `prepareEncounter()` (the encounter is drawn when a stage's quiz starts).
- `src/battle-ui.js` `fit()` picks `--px` 4→1 by measuring field overflow.
- COMBO / OPENING / COUNTER are explained in play: gold `+N` badges on skill
  buttons (`skillBonus` in the engine), a payoff hint, and a kana `tip` per
  unlocked skill on the victory screen. COMBO / OPENING stay hidden until
  Power Slash / Double Strike unlock. Checked in real debug battles.
- `?debug=art` has preview buttons for every victory screen, defeat, and
  campaign results with 18 missed words.

## Next Steps

1. Play-test feedback from the user (they are playing the live/local build).
2. Optional polish: richer stage backdrops; the smart-vs-hint balance margin is
   small (tactical rewards could be raised a little, then re-run
   `npm run balance` and `npm test`).
3. Pushing `master` deploys live (GitHub Pages, legacy build from `/`).

## Manual Chromebook / classroom checks still needed

- Music volume/mix and ducking under ja-JP/en-US TTS; mic silencing during STT.
- Sprite-sheet build time and effect smoothness on a real school Chromebook
  (4× throttle is only an estimate).
- Real microphone grant/denial, mic-free fallback, IME Enter behaviour (unchanged).
- Whether 5/10 students find stage 3–4 "hard but possible", and whether the
  RECOVERING turn and the keep-1-AP hint are understood without explanation.

## Tools

- `npm run art:png -- <outDir> [scale] [ids...]` writes sprite / effect /
  backdrop sheets as PNGs (no browser) for art review.
- `npm run balance -- [seeds] [thresholds|detail]` prints win-rate tables.
- Run locally: `npm run serve` → http://localhost:8010 (`?debug=battle`, `?debug=art`).
