# Current State

## Status
MVP implemented; unit tests pass (9) and a mocked-speech Playwright playthrough
of all 4 modes passed (2026-09-24). Not yet tried on a real Chromebook.

## What Exists
Static, no-build four-mode verb quiz (see SPEC.md). `src/vocab.js` is the only
vocabulary source (50 verbs). One config-driven engine (`src/engine.js`),
normalization, tap-to-talk recognition, TTS, mic-free choices, scoring, end
screen with practice-mistakes. Tests: `npm test`.

Run: `npm run serve`, open http://localhost:8010.

## Known Issues
Needs a real Chromebook + microphone check: permission prompt/denial,
interim-result timing on ChromeOS, the 6 s auto-stop, whether a ja-JP voice is
installed, and IME Enter behavior when typing Japanese.
Mic-free choices reshuffle if the question re-renders (e.g. after a TTS error).

## Next Steps
Device check before classroom use.
