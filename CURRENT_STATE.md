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
Counter rewards anyone who defends against a shown big attack. Placeholder art
only. Not yet tried on a real Chromebook or with students.

## What Exists

- Static, no-build application using the 50 verbs in `src/vocab.js`.
- Study mode retains the original level selection, quiz, scoring, and end screen.
- Adventure mode runs stages 1–4 in quiz modes 1–4, followed by the matching
  encounter tier. Fighter combo/Break/counter, Mage enemy-state Power recovery,
  and Ninja Opening/Dodge counter/chain play use the shared pure battle engine.
- Inline placeholder SVG battle art and an accessible keyboard/touch battle UI
  with displayed enemy intents, hero status chips, event playback, phase-2
  enrage feedback, and reduced-motion support.
- Bosses enter a single data-driven phase 2 at their HP threshold; the same
  intent engine applies the updated cadence/support parameters.
- A campaign results screen with aggregate scores and Study-mode mistake practice.
- A Playwright playthrough script at `test/browser/playthrough.mjs` (Playwright is
  intentionally not a package dependency).

Run locally with `npm run serve`, then open http://localhost:8010.

Run the unit tests with `npm test`. If Playwright is installed or available at a
module path, run `npm run test:browser` (set `PLAYWRIGHT_PATH` when needed).

Open http://localhost:8010/?debug=battle for the battle launcher.

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

## Next Steps

Run the classroom/Chromebook trial, focusing on intent readability and whether
the three tactical identities feel distinct without extra explanation. If
Fighter/Ninja smart play feels no better than button-mashing, raise the Break
or Opening reward in `src/battle-data.js` first. Replace
placeholder art in `src/battle-art.js` after the combat loop is validated.
