# Design Decisions

This file records meaningful product, UX, visual, architectural, or behavioral decisions for this project.

For each significant decision, record:

- Date
- What was decided or changed
- Why
- Previous approach, if relevant
- Rejected alternatives, if useful

Only record decisions that may be useful to understand later.

Do NOT record:
- trivial UI adjustments
- routine bug fixes
- formatting changes
- mechanical refactors with no design consequence
- every individual code modification

Git is the source of truth for detailed code-change history.

## 2026-09-24 — fallback choices are regenerated for each rendered question

- What: Mic-free choice distractors are sampled fresh whenever a question is rendered.
- Why: The frozen spec requires random distractors but does not require their order to persist after a replay or UI refresh; this keeps the shared engine small.
- Rejected alternative: Storing a per-question choice order in round state, which adds state solely for a non-required persistence behavior.

## 2026-09-24 — deviations from the original brief

- **Unique Japanese prompts.** Modes 3–4 show/speak `ja`, so it must identify
  one verb. look/see and cut/wear collided (みる, きる); see → みえる,
  wear → みにつける, talk → しゃべる, draw → えをかく. Mode 1–2 still accept the
  ambiguous forms via `jaAccepted`. Rejected: disambiguating with kanji in
  parentheses — TTS cannot speak the difference and children read kana.
- **Show answer (こたえを見る) kept, not omitted.** Without it a student who
  cannot recall the word is stuck in speech modes. It counts as missed.
- **Romaji accepted in typed modes.** Chromebook IMEs are often off; an exact
  romaji → hiragana conversion (incl. `-` → ー) is not fuzzy matching.
- **Tap to talk, 6 s auto-stop**, adapted from esl-time's hold-to-talk error
  handling. Rejected: hold-to-talk (brief asked for single press).
- **English homophone aliases only** (see/sea/c, write/right, buy/by/bye,
  wear/where, read/reed); one leading "to " stripped. No partial-word matching.
- **No build step, node:test only.** Mode rendering is tested through the pure
  `viewModel`, not a DOM library.

A useful rule:

> If a future developer or AI could reasonably ask, "Why is it designed this way?", record the answer here.
