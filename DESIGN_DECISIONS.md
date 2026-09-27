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
- **Balance is guarded by simulation tests:** every hero beats every encounter
  at 2 Power with a naive policy over several RNG seeds, 7 Power remains in
  the tier-length ranges, and smart play beats naive play in aggregate across
  tiers 3–4. Numbers live only in `battle-data.js`.
- **Escape in Adventure asks before quitting**, because a stray Escape would
  otherwise throw away up to 40 answers.
- **`?debug=battle` launcher** for tuning without replaying quizzes; uses the
  real engine and UI.
- Dropped from the request for now: optional persistence (campaigns
  completed etc.) and battle sound effects — neither is needed to validate
  the loop.

## 2026-09-27 — initial battle balance

- Tuned by simulation so a plain player wins every encounter at 2 Power.
  Bosses: 30–38 HP, 2-damage attacks, 9–12 damage telegraphed heavies — the
  threat is the telegraphed move, which is what makes Guard/Barrier/Dodge
  matter. Rejected: the first pass's 27-HP / 6-damage bosses, which never
  threatened anyone.
- Magic Bolt deals 5 (others' basic attack 4): the Mage has the least HP and
  no single-target special, so its free attack is slightly stronger.
- `captain-goblins` is captain + one goblin (not two): three attackers from
  turn 1 made it unwinnable at 2 Power.
- A summoner only summons when none of its summon type is alive, and a
  summoned enemy first acts next phase, so summoning never adds surprise
  damage.

## 2026-09-27 — frozen tactical combat revision

- The guiding principle is **“Easy to play casually; rewarding to understand
  deeply.”** Basic attacks plus defending against a shown big attack remain a
  winning path, while class mechanics provide measurable rewards for timing.
- Each hero keeps four skills and a distinct load: Fighter is the low-load
  combo/Break/Guard-counter class; Mage protects, heals, and exploits enemy
  states; Ninja times Openings, deterministic Dodge counters, and kill chains.
- Enemy intents are engine-owned plain state. The engine chooses each intent
  once with injected RNG, the UI displays it before the player acts, and the
  enemy phase resolves that exact stored choice without rerolling. This
  supersedes the original fixed-pattern approach.
- Boss phase 2 stays lightweight: crossing the HP threshold changes AI
  parameters in the same engine and emits one enrage event. It does not add a
  second boss engine or cancel an already-shown intent.
- Only Mage regenerates Power. Magic Bolt can gain at most 1 per player action
  from charging/tired targets, and Barrier can gain at most 1 per enemy phase
  from a resolved heavy; there is no passive or free-loop regeneration.
- Initial tuning keeps the existing HP/attack values, sets combo and counter
  bonuses to +4, Opening to +3 per Double Strike hit, and Shadow Strike to 11
  damage with a 4-damage kill chain. Heavy cadences are data-driven: standard
  heavy users act normally 2–3 times before CHARGING, while boss phase 2
  shortens cadence to 1–2; Dragon stops resting, Giant Golem keeps resting,
  Demon King raises its summon limit from 1 to 2, and Vampire Lord uses only
  drain as its phase-2 normal action.
- The necromancer heal was reduced from 4 to 2. With two starting skeletons,
  a 4-point self-heal erased nearly all free-skill progress while the adds kept
  attacking, which violated the multi-seed naive-at-2 requirement.
- Bat HP was reduced from 7 to 5. Phase-2 Demon King can legally leave two bats
  behind; at 7 HP, Mage needed two basic attacks per add plus a recovery turn,
  exceeding the tier-4 Power-7 length bound. Five HP lets Magic Bolt clear an
  add in one turn without changing summon behavior or damage pressure.
  (This also shortens the tier-1/2 bat fights slightly.)
- Vampire Lord's phase-1 drain chance is 0.5, not 0.75: at 0.75 its self-heal
  kept pace with Magic Bolt and a naive Mage needed 11 turns at Power 7.
- A shown intent never turns into something else. A Heal with nobody hurt, or
  an illegal Summon, fizzles instead of becoming an attack, so the screen
  never lies about incoming damage. Only Break changes an intent.
- The charge turn is kept as its own intent (⚡ POWERING UP, then 🔥 BIG
  ATTACK), giving two turns of warning and a visible window for Break,
  Opening and Mage's Bolt exploit.
- Dodge always fully avoids heavy attacks (previously it only zeroed whichever
  hit came first), so "Dodge when the big attack shows" is always right.
- COUNTER READY is one shared mechanic (Fighter Guard / Ninja Dodge vs a
  heavy → +4 on the next attack) rather than Power, keeping Power recovery
  the Mage's identity. Rejected: +1 Power for Fighter too.
- The defense button pulses with まもろう！ in every battle whenever an enemy
  shows a big attack. Not faded after repeated exposure yet.

A useful rule:

> If a future developer or AI could reasonably ask, "Why is it designed this way?", record the answer here.
