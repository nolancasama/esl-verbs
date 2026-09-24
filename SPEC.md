# esl-verbs — spec (frozen for MVP)

A simple English verb study quiz for Japanese students. Primary device: school
Chromebook (keyboard, touchpad, maybe touch). Static site, plain ES modules, no
build step, no framework, no dependencies. Tests: `node --test`.

## Data

`src/vocab.js` is the single vocabulary source (already written, 50 verbs).
Do not change translations. Shape: `{ id, en, enAccepted[], ja, jaAccepted[] }`.
`ja` is the unique Japanese prompt shown/spoken in modes 3–4.

## Modes (one shared engine, config-driven — never four implementations)

```js
const MODES = {
  1: { prompt: 'en', showPrompt: true,  speakLang: 'en-US', answer: 'jaText'   },
  2: { prompt: 'en', showPrompt: false, speakLang: 'en-US', answer: 'jaText'   },
  3: { prompt: 'ja', showPrompt: true,  speakLang: 'ja-JP', answer: 'enSpeech' },
  4: { prompt: 'ja', showPrompt: false, speakLang: 'ja-JP', answer: 'enSpeech' },
};
```

Level select titles (all unlocked, no progression):
1. English → Japanese — See and hear English. Type Japanese. (えいごを見て聞いて、日本語を書こう)
2. Listen → Japanese — Hear English. Type Japanese. (えいごを聞いて、日本語を書こう)
3. Japanese → Speak English — See and hear Japanese. Say the English word. (日本語を見て聞いて、えいごで言おう)
4. Listen → Speak English — Hear Japanese. Say the English word. (日本語を聞いて、えいごで言おう)

Every question auto-speaks its prompt (only the word: `en` or `ja`, nothing
else). Every mode has a `🔊 Replay` button (unlimited). Prompt text dominates the
screen when shown; audio-only modes show a large 🔊 in its place.

## Answer checking

- `normalizeJapanese(s)`: NFKC, trim, remove all whitespace, katakana→hiragana,
  strip punctuation 、。・！？!?.,「」『』~〜 (keep ー — it is part of words like スキー).
  Then, if the result is entirely ASCII letters, convert romaji → hiragana
  (Hepburn + common kunrei: shi/si, chi/ti, tsu/tu, fu/hu, ji/zi, n/nn, double
  consonant → っ, ya/yu/yo combos e.g. kya, sha, cha, ja). Compare against
  `jaAccepted` each normalized the same way (so katakana entries match hiragana
  input: スキー and すきー). Exact match only; no fuzzy matching.
  Note: after katakana→hiragana, ジャンプ → じゃんぷ, so romaji "janpu" matches.
- `normalizeEnglish(s)`: lowercase, trim, strip `.,!?`, collapse whitespace,
  strip one leading "to ". Exact match against `enAccepted` (normalized).

## Typed modes (1, 2)

Large input (lang="ja", autofocus on each question), `Check` button, Enter
submits. Empty input does nothing. Correct → "Correct! / せいかい！" then Next.
Wrong → mark wrong, show correct `ja` (and `en` in mode 2), Next after
acknowledgment (button or Enter). Next button receives focus.

## Speech modes (3, 4)

Single press on a big 🎤 button starts ONE recognition session (en-US,
interimResults true, continuous false, maxAlternatives 5). Auto-stop after 6 s.
Pressing again while listening stops it. No hold-to-talk, no continuous
listening, no auto-start.

On every `onresult`, loop over ALL `event.results` and every alternative in
each; if any normalized transcript is in `enAccepted`, accept immediately
(do not wait for isFinal), stop recognition, mark correct. Otherwise show
`Heard: <best transcript>`. When a session ends without a match → "Try again"
(NOT wrong; unlimited retries).

Status line states: `Ready` · `Listening...` · `Heard: climb` · `Correct!` · `Try again`.

`Show answer` button (こたえを見る): reveals `en`, counts as missed/wrong, then Next.

Reuse the error handling pattern from `../esl-time/src/speech.js` (read it;
adapt, don't import): `not-allowed`/`service-not-allowed` → DENIED;
`audio-capture` → ERROR; guard against missing `onend`; abort on question change.
Permission denied: never start recognition again this page load; switch to
mic-free automatically and show the message. Unsupported (no SpeechRecognition):
same — show 「音声認識を使えません。「マイクなし」を使ってください。」 and turn on
mic-free. 3 consecutive errors (network/audio-capture/other, excluding
`no-speech`/`aborted`) → same fallback.

## Mic-free (マイクなし)

A toggle visible on the level-select screen and during modes 3–4. When on,
modes 3–4 replace the mic with 4 large English choice buttons: the correct `en`
plus 3 distinct random distractors from VOCABULARY, shuffled. Keys 1–4 select.
Choosing correct/wrong is scored like typed modes (wrong shows the answer, then
Next). Persist the toggle in localStorage (try/catch around every access).

## TTS

`speak(text, lang)`: cancel any current speech, new SpeechSynthesisUtterance,
set lang, choose a voice whose lang matches (prefix match, e.g. `ja`) if one is
loaded, rate ~0.9. If speechSynthesis is missing or the utterance errors:
- modes 1, 3 (prompt visible): continue silently, small non-blocking note.
- modes 2, 4 (audio-only): show 「音が出ません」 + Replay; the prompt is NOT
  revealed. `Show answer` / mic-free / typing still work so the student is not trapped.

## Round logic and scoring

`QUESTIONS_PER_ROUND = 10`. Round = shuffle(pool).slice(0, 10), no repeats.
State: `{ mode, items, currentIndex, correctCount, currentStreak, bestStreak, missedIds:Set }`.
Correct: correctCount++, currentStreak++, bestStreak = max. Wrong/Show answer:
currentStreak = 0, missedIds.add(id). No deductions, lives, timers, points.
HUD: `4 / 10` (question number) prominent; `3 in a row!` small, only when streak ≥ 2.

## End screen

`Score: 8 / 10`, `Best streak: 4`, list of missed verbs (en — ja).
Buttons: `Practice mistakes` (round of only missed items, shuffled; hidden when
none, show `Perfect!` instead), `Again` (same mode, new round), `Next level`
(mode+1; hidden on mode 4), `Level select`. A practice round's length = number
of missed items.

## UI

Big text (prompt ≥ 4rem), big buttons (≥ 56px tall), visible focus rings
(`:focus-visible` outline), no hover-only UI, works 1366×768 and narrow
widths, no animation beyond a simple color change. Everything reachable by
keyboard. `Escape` or a `← Level select` button quits a round. Japanese font
stack: system (`"Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif`).

## Architecture

- `src/vocab.js` — data (done).
- `src/normalize.js` — normalizeJapanese, normalizeEnglish, romajiToHiragana, isJapaneseCorrect, isEnglishMatch.
- `src/engine.js` — pure: MODES, createRound, answer(state, correct), practiceItems, makeChoices(item, vocab, rng), viewModel(mode, item, {micFree}) → { promptText|null, speak:{text,lang}, input:'jaText'|'enSpeech'|'choices' }.
- `src/speech.js` — TapToTalk recognizer wrapper (accepts an injected SpeechRecognition constructor for tests) + findMatch(event.results, accepted).
- `src/tts.js` — speak().
- `src/app.js` — DOM rendering/wiring driven by viewModel; no mode-specific branches beyond input type.
- `index.html`, `styles.css`.

No: pictures, sentences, avatars, story, coins, XP, achievements, pronunciation
scoring, login, analytics, timers, lives, unlocks.
