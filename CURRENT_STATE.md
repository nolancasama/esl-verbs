# Current State

## Status

The four-mode Study quiz and the complete four-stage Adventure campaign are
implemented. Adventure includes hero selection, quiz-derived Power, battles,
skill unlocks, retry, campaign results, mistake practice, guarded exits, and a
battle debug launcher. Combat now has engine-owned displayed enemy intents,
injected RNG, distinct tactical mechanics for all three heroes, and lightweight
boss phase 2 behavior. Unit tests run with `npm test`.

Validation on 2026-09-27 runs 24 unit tests with deterministic coverage of stored
intents, every hero mechanic, phase-2 bosses, safety bounds, and a balance
simulation where every hero beats every encounter with naive play at 2 Power
over five seeds, 7 Power stays in the tier-length limits, and smart play beats
naive play in aggregate on tiers 3–4. All 24 pass. `npm run test:browser`
passes, and 1366×768 screenshots of a Dragon Break sequence and a
three-enemy fight showed readable intent chips, no overflow, no scrolling and
no page errors. Smart play's margin is large for Mage (≈17% fewer turns) but
small for Fighter/Ninja (similar turns, ≈2–3 more HP per fight), partly because
Counter rewards anyone who defends against a shown big attack. Not yet tried on
a real Chromebook or with students.

On 2026-09-28 the placeholder battle art was replaced by the first cohesive
pixel-art pass (original, generated locally from palette grids; see
`DESIGN_DECISIONS.md`). Mechanics and balance are unchanged. 27 unit tests pass
(3 new art-coverage tests) and `npm run test:browser` passes. Headless Chromium
screenshots at 1366×768 and 1366×635 were checked for: all three heroes, a
three-enemy fight, necromancer + skeletons, Golem, Shield Goblin + Healer with
Fireball, the Giant Golem and the phase-2 Dragon, hero select, stage complete,
victory with a skill unlock, final VERB MASTER victory and defeat. Sprites are
crisp (integer scale), the boss does not cover its intent/HP, there is no page
scroll at either height, and there were no page errors. Final classroom visual
testing on a real Chromebook is still required.

## What Exists

- Static, no-build application using the 50 verbs in `src/vocab.js`.
- Study mode retains the original level selection, quiz, scoring, and end screen.
- Adventure mode runs stages 1–4 in quiz modes 1–4, followed by the matching
  encounter tier. Fighter combo/Break/counter, Mage enemy-state Power recovery,
  and Ninja Opening/Dodge counter/chain play use the shared pure battle engine.
- Pixel-art Adventure layer: `src/battle-art.js` (semantic API:
  `getBattleArt(id, state)`, icons, backdrops, event → sprite state),
  `src/pixel-sprites.js` (heroes and all 15 enemies, 17 state rows each; boss
  phase-2 variants), `src/pixel-effects.js` (icons, effects, four stage
  backdrops, effects player), `src/pixel-core.js` (grid drawing and PNG sheet
  rasterizing), `src/pixel-palette.js`. Adventure styles live in `rpg.css`.
- Accessible keyboard/touch battle UI with pixel intent icons, hero status
  chips, a bottom HUD (message, hero HP, four command buttons with Power
  costs), event playback, phase-2 enrage feedback, and reduced-motion support.
- Bosses enter a single data-driven phase 2 at their HP threshold; the same
  intent engine applies the updated cadence/support parameters.
- A campaign results screen with aggregate scores and Study-mode mistake practice.
- A Playwright playthrough script at `test/browser/playthrough.mjs` (Playwright is
  intentionally not a package dependency).

Run locally with `npm run serve`, then open http://localhost:8010.

Run the unit tests with `npm test`. If Playwright is installed or available at a
module path, run `npm run test:browser` (set `PLAYWRIGHT_PATH` when needed).

Open http://localhost:8010/?debug=battle for the battle launcher, and
http://localhost:8010/?debug=art (or SPRITE GALLERY in the launcher) to review
every sprite in any state, the phase-2 variants, the backdrops, and previews of
the victory / final victory / defeat screens.

## Manual Chromebook Checks Still Needed

- Real microphone permission grant/denial and the three-error mic-free fallback.
- Interim SpeechRecognition timing and the six-second auto-stop on ChromeOS.
- Availability and pronunciation of an installed ja-JP speech voice.
- Japanese IME Enter/composition behavior.
- Keyboard-only targeting/actions and touch target comfort at 1366×768 and 360px.
- Battle animation pacing, fast-forward, reduced-motion, and absence of vertical
  scrolling at the classroom 1366×768 viewport.

- Classroom feel: battle length, whether students understand the CHARGING →
  BIG ATTACK intent flow and each hero's tactical status chips, and whether
  0/10 students still enjoy it.

## Known Issues

- Mic-free choices reshuffle if a question re-renders (for example after a TTS
  error), as recorded in `DESIGN_DECISIONS.md`.
- The battle view re-renders after each action, so Tab focus returns to the
  top; number keys 1–4 and ←/→ are the reliable keyboard path.
- At phone widths (~390px) the skill buttons sit below the fold.
- Pixel-art limits worth a later pass: heroes have no dedicated walk/turn
  frames; enemy attack rows are mostly generic lunges (only Goblin, Skeleton,
  Wolf, Captain, Golem and the bosses have pose changes); the Dragon's Fire
  Breath is a flame burst on the hero, not a travelling breath; the backdrop
  sky is a flat colour above 112 logical px on tall viewports; there are no
  battle sound effects.

## Next Steps

Run the classroom/Chromebook trial, focusing on intent readability, whether
the three tactical identities feel distinct without extra explanation, and how
the pixel art reads on the real 1366×768 screen (sprite size, font size of
intents and skill names, effect speed). If Fighter/Ninja smart play feels no
better than button-mashing, raise the Break or Opening reward in
`src/battle-data.js` first.
