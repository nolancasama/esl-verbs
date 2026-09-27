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

## 2026-09-27 — Adventure (RPG) mode wraps the quiz

- **Adventure and Study coexist.** Study is the original level select,
  untouched, so the teacher can always run a plain quiz even if Adventure
  misbehaves.
- **Quiz and battle are separate phases** (10 questions → one short battle).
  Rejected: a combat turn per question — it breaks the retrieval rhythm.
- **Power = 2 + correct answers, basic actions free.** Quiz skill buys
  options (specials), not raw damage multipliers, so a 0/10 student can still
  win. Power is derived from `round.correctCount`, not a separate counter, so
  wrong answers / Show answer / STT retries cannot touch it by construction.
- **Three heroes, one engine.** Fighter/Mage/Ninja differ only in skill data.
  Ninja Dodge is deterministic (first hit 0, rest halved). Rejected: random
  miss chance — frustrating and untestable.
- **Skills unlock inside a campaign** (tiers 0,1,2,2 for battles 1–4), which
  teaches RPG basics progressively. No persistent levels/XP; replay variety
  comes from heroes, random quiz rounds and random encounter/boss pools.
- **One pattern mechanism for every enemy and boss** (attack, guard, charge,
  heavy, rest, healAlly, summon, drain). Enemies escalate by behaviour, and
  every special behaviour is telegraphed on the sprite. Rejected: per-boss
  engines.
- **Always-selected target instead of a targeting mode.** One living enemy is
  always selected; clicking/←→ changes it and skills fire immediately. Removes
  the "stuck in targeting" failure and one step per turn for children.
- **Animation never drives logic.** The engine returns the final state plus an
  event list; the UI only replays events and can fast-forward them.
- **Placeholder art in one module** (`battle-art.js`, inline SVG + CSS
  `data-state`). Rejected: ~40 per-state SVG files before the loop is
  validated.
- **Balance is guarded by a simulation test** (every hero beats every
  encounter at 2 Power with a simple policy). Numbers live only in
  `battle-data.js`.
- **Escape in Adventure asks before quitting**, because a stray Escape would
  otherwise throw away up to 40 answers.
- **`?debug=battle` launcher** for tuning without replaying quizzes; uses the
  real engine and UI.
- Dropped from the request for now: optional persistence (campaigns
  completed etc.) and battle sound effects — neither is needed to validate
  the loop.

A useful rule:

> If a future developer or AI could reasonably ask, "Why is it designed this way?", record the answer here.
