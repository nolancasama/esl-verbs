# Current State

## Status

The four-mode Study quiz and the complete four-stage Adventure campaign are
implemented. Adventure includes hero selection, quiz-derived Power, battles,
skill unlocks, retry, campaign results, mistake practice, guarded exits, and a
battle debug launcher. Unit tests run with `npm test`.

Verified 2026-09-27: 19 unit tests (incl. a balance simulation: every hero
beats every encounter at 2 Power), `npm run test:browser` passes and was shown
to fail on a broken Power formula, and a controller-run full mocked campaign
(40 questions, 4 battles, results) had no page errors and no scrolling at
1366×768. Placeholder art only. Not yet tried on a real Chromebook or with
students.

## What Exists

- Static, no-build application using the 50 verbs in `src/vocab.js`.
- Study mode retains the original level selection, quiz, scoring, and end screen.
- Adventure mode runs stages 1–4 in quiz modes 1–4, followed by the matching
  encounter tier. Fighter, Mage, and Ninja use the shared pure battle engine.
- Inline placeholder SVG battle art and an accessible keyboard/touch battle UI
  with event playback and reduced-motion support.
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

- Classroom feel: battle length, whether students understand Guard/Dodge/Heal
  and the ⚠️ charging warning, and whether 0/10 students still enjoy it.

## Known Issues

- Mic-free choices reshuffle if a question re-renders (for example after a TTS
  error), as recorded in `DESIGN_DECISIONS.md`.
- The battle view re-renders after each action, so Tab focus returns to the
  top; number keys 1–4 and ←/→ are the reliable keyboard path.
- At phone widths (~390px) the skill buttons sit below the fold.

## Next Steps

Classroom/Chromebook trial, then tune `src/battle-data.js` with the
`?debug=battle` launcher. Replace placeholder art in `src/battle-art.js`.
