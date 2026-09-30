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

## 2026-09-28 — first cohesive pixel-art pass for Adventure

- **Placeholder SVG battle art replaced by original, locally generated pixel
  art.** Every hero, enemy, boss, icon, effect and stage backdrop is drawn on a
  small integer grid (heroes 48×48, enemies 26–46 px, large foes ~50 px,
  bosses 64–88 px) from one shared palette (`src/pixel-palette.js`), then
  rasterized once at runtime into a PNG sprite sheet on a `<canvas>` and shown
  with nearest-neighbour integer scaling (`--px` 2/3/4 by viewport). Rejected:
  smooth SVG with `image-rendering: pixelated` (not real pixels), committed PNG
  files (needs an encoder/build step; grids in source are easier to revise),
  and any third-party or traced game assets.
- **Heroes use a paper-doll rig with hand-pixelled heads.** Poses are
  parameter sets (hip, shoulders, hands, feet, weapon angle) and each figure is
  auto-outlined, so new key poses are cheap. Enemies are primitives plus
  mirroring; their generic rows (hit flash, lunge, ordered-dither defeat,
  dimmed/slumped tired, palette-swapped charge) are derived in one place.
- **One sheet per character, one row per semantic state** (`SPRITE_STATES` in
  `battle-art.js`: idle, attack, special, guard, cast, dodge, hit, charge,
  defeat, victory, broken, enraged, tired, heal, barrier, counter, shadow).
  CSS plays a row with `steps()`; each state has its own keyframes name so a
  state change always restarts. The UI only sets `data-state`, and
  `eventSpriteStates()` maps engine events to states, so battle logic never
  knows how art is drawn and never waits on animation.
- **Boss phase 2 is a separate sheet variant** (palette swap + pose/aura), not a
  CSS filter, so the change is visible in the art itself.
- **Effects are cosmetic DOM nodes** from `createEffectsPlayer` (slashes,
  projectiles, heal/drain orbs, barrier dome, BREAK shards, summon rune, boss
  burst, small stepped shake/flash). They are skipped entirely under
  reduced motion and dropped on each re-render.
- **Readability over retro purity.** The pixel font (Press Start 2P, OFL,
  bundled in `assets/fonts/`) is used only for short English labels, numbers
  and floaters. Japanese, intents and enemy names stay in the system font.
  Adventure CSS moved to `rpg.css`; Study quiz styles are unchanged.
- **Battle mechanics, balance and the event contract were intentionally not
  changed** by this pass. The only UI-state change: a tired enemy now shows
  its own `tired` row instead of `idle`.

## 2026-09-28 — Adventure RPG upgrade (AP, campaign resources, art, effects, music)

Principle: **easy to understand casually; rewarding to play well.**

- **Quiz score is the starting AP** (0–10), replacing `Power = 2 + correct`
  and free basic actions. Every skill and the Potion costs AP (basic/defend 1,
  specials 2, big AoE/Shadow Strike 3, Potion 1). Rejected: keeping free basics —
  it made the quiz barely matter.
- **AP exhaustion = a RECOVERING turn**: at 0 AP the hero gains +1 AP and the
  enemies act. Recovery costs a turn on purpose (tempo loss). Rejected: free AP
  when reaching 0 (recreates free attacks), 2-AP recovery (flattened the AP
  curve: 3 AP still won ~55%), an ×1.5–2 "exhausted" damage multiplier (turned
  big attacks during recovery into one-shots and made more AP sometimes worse).
  Voluntary resting is not allowed, so waiting can never farm AP.
- **Tactical AP is AP-neutral, not a surplus**: Guard/Barrier up when a big
  attack lands +1 AP (all heroes); Mage Magic Bolt on a charging/tired enemy +1.
  Dodge avoids big attacks completely instead of refunding AP (it was too strong
  with both). Counter/Combo/Opening/Break/Chain keep their damage roles.
- **Balance targets tiers 3–4** (tiers 1–2 stay teaching fights): tuned by
  simulation so hint-following play wins about 27/57/75/90/100% at 5/6/7/8/10
  AP. Enemy big-attack cycles are odd lengths so a low-AP rest/act rhythm does
  not always meet the big attack on the same beat. Shadow Strike chains through
  kills (max 3), Fireball/Cleave hit harder, Mage/Ninja HP 27/28, Vampire drain
  heals at most 2. Balance tests assert trends, never exact percentages.
- **HP carries between battles** with a 28% victory heal and a 40% floor;
  **one item, the Potion** (35% max HP, start 2, +1 per victory, cap 2);
  **XP and levels** L1–L5 with thresholds at the minimum XP any encounter path
  gives, so skill unlocks stay on the old schedule (L2 after battle 1, L3 after
  battle 2) and the class passive arrives at L4. Rejected: the requested
  L3-passive/L4-final-skill order, which would have delayed the tier-2 skill
  the tier-3 group fights are balanced around.
- **Retry assist grows**: retries restart from the battle's entry HP/potions
  with +1, +3, +6, +10 AP. Rejected: +1 per retry (a 0/10 student needed ~14
  retries per campaign).
- **One persistent AP meter** (a single DOM node remounted per screen) is the
  visual link from quiz to battle; the Adventure quiz gets an RPG frame while
  Study stays plain. Vocabulary stays in a readable Japanese font.
- **Art moved to a shaded part rig** (`pixel-rig.js`): hue-shifted material
  ramps with automatic top-left lighting, interior lines and outlines; heroes
  72×72, bosses up to 132×128; enemies are drawn facing right with top-right
  light and mirrored. Sprite-state CSS is generated from the frame table.
  Rejected: hand-authored frames (too many at this size), enlarging the 48 px
  art.
- **Defeated enemies disappear completely**: the defeat row ends on an empty
  frame and dead enemies are not rendered after playback.
- **Effects are tiered** (basic quick, specials bigger, Fireball / Shadow
  Strike / boss signatures cinematic ~1 s), run from `fx-player.js`, which also
  tells the view how long each event needs. Heroes dash to melee targets.
  Reduced motion keeps static hit flashes only.
- **Integer pixel scale fitted per battle**: the view picks `--px` 2–4 so the
  tallest enemy, its plate and intents fit the field (Chromebook heights vary).
- **Music is synthesized** (Web Audio, original compositions, no files or
  remote audio), ducked under TTS, silenced during speech recognition, off in
  Study mode, and toggled with ♫ MUSIC ON/OFF saved in localStorage.

## 2026-09-29 — screen-fit pass and idle-time sprite building

- **Sprite sheets are built ahead of time, one per idle callback**
  (`prewarmArt` in `battle-art.js`). Measured at 4× CPU throttle (roughly a
  school Chromebook), a hero sheet costs 250–380 ms, a boss 380–510 ms and a
  boss's enraged variant another ~420 ms. Built on demand, that froze the first
  menu paint for ~1.3 s and froze a boss fight at the phase-2 moment. The main
  menu now paints first and adds the hero trio as each sheet is ready (the row's
  height is reserved).
- **The stage's encounter is drawn when its quiz starts**, not at Stage Clear,
  so the enemies, their summons and enraged variants build during the ten
  questions (the longest idle window). Same random draw, earlier. Rejected: building
  on the Stage Clear screen (a few seconds, and a stall would delay the BATTLE!
  click), and a Web Worker (bigger change; grids would still have to cross to the
  main thread for the canvas).
- **Pixel scale may drop to 1** when even 2 would clip a boss (very short
  windows such as 1024×600), and `fit()` now measures instead of trusting its
  estimate: it steps the scale down while the field's content still overflows.
  This supersedes "the view picks `--px` 2–4" above. A clipped floor line was
  worse than small art, and letting the page scroll would push the skill
  buttons below the fold.
- **Enemy names wrap between the English and the Japanese name** instead of
  spilling out of the plate (Goblin Captain ゴブリンたいちょう was 13 px wider than
  its plate). The measured fit handles the taller two-line plate.
- **Below 1100 px wide the hero panel is one row** (name · HP · statuses);
  stacked, it was a mostly empty 90 px band taken from the field.
- **Short screens**: victory/defeat cards tighten between 741 and 820 px tall
  (the compact rules started at 740 but the full card needs ~790); the main menu
  tightens at ≤740 px so the マイクなし / MUSIC toggles are not below the fold on a
  1366×635 Chromebook window.
- **Final-victory burst is rays only.** The solid sun disc behind VICTORY! made
  "TO" unreadable, and rotating the whole ellipse swept rays above the card; the
  gradient now turns (`@property --burst-turn`) inside a fixed band.
- **Campaign results**: hero, score and streak share one row; buttons are two
  columns; the missed words sit in a grid that scrolls inside the card, under a
  `Review: n words` count. Rejected: CSS multi-column (with a max-height it
  overflows sideways, hiding words with no cue) and letting the page scroll.

## 2026-09-29 — COMBO / OPENING / COUNTER are explained where they pay off

- **Taught in context, not in a rules screen.** Players saw COMBO READY,
  OPENING and COUNTER READY with no idea what they did. Now a skill button
  shows a gold `+N` while it would deal extra damage, and the one-hint-per-turn
  line names the payoff (`COMBO！ パワースラッシュで +4！`). The payoff hint ranks
  below the big-attack, low-HP and keep-1-AP hints, so it never hides a warning.
  COUNTER highlights no button (every attack gets it); the badges carry it.
  Rejected: a pop-up or rules page (students click through them, and the game
  teaches everything else in context).
- **`skillBonus` lives in the engine** beside `useSkill`, and a test pins it to
  the damage `useSkill` actually adds, so the badge cannot drift from the hit.
- **COMBO and OPENING are hidden until their payoff skill is unlocked.** In
  battle 1 Slash announced COMBO READY although Power Slash was still locked.
  The engine still tracks them (no balance change); only the UI hides the badge,
  floater, message and sparkle.
- **Each unlocked skill gets a one-line kana tip on the victory screen**
  (`SKILLS[id].tip`), e.g. `スラッシュの つぎに つかうと COMBO で +4！`. The combo
  and opening numbers come from `BALANCE`.

## 2026-09-29 — classroom feedback pass: menu, speaking, story, titles, replay

Students played Adventure and liked it; this pass fixes what the classroom
showed, without touching battle rules or balance.

- **Adventure is visually the main game; Practice is explicitly secondary.**
  Students pressed `STUDY / れんしゅう` because the illustrated Adventure panel did
  not read as a button. Now: a big gold-framed button with a `▶ START ADVENTURE`
  plate and a pressed state (no hover needed on touchpads), and a small quiet
  `PRACTICE ONLY / れんしゅうだけ` below. Study stays — teachers need it. The main
  menu lost its マイクなし toggle (it lives on the Practice screen), since on the
  menu it looked like a setting for the game.
- **Adventure speech stages have no voluntary マイクなし.** Most students ticked it
  and tapped choices. Speaking is the challenge in stages 3–4, so choices are
  only a technical fallback (no recognition, mic denied, or 3 recognition errors
  in the stage — retried next stage), explained in kana, never penalised. The
  Study preference `esl-verbs-mic-free` is separate and never forces Adventure
  into choices; an Adventure fallback does not write it either. Rejected:
  making speech mandatory (a broken mic would trap the student).
- **Wrong quiz answers never damage campaign HP**; the hero uses a new
  quiz-only `stumble` sprite state ("!", sweat, lean back) instead of `hit`,
  and the error SFX is a soft two-note cue instead of a buzz. Missing AP is
  already the consequence; HP loss would punish the same mistake twice. The
  state is a real sprite row so it reuses the sprite pipeline; no battle event
  maps to it (tested).
- **Story is exactly two short cinematics** (intro after Choose Hero, ending
  after the final victory screen), ~10 s, skippable, on the existing screen
  timers with a finish-once guard. Simple premise (monsters threaten Matsubara
  City; the chosen hero protects it), no named villain, always the chosen hero.
  City art is programmatic pixel art in three moods plus a silhouette layer, so
  there are no files or video. Rejected: dialogue between stages (it would slow
  the quiz rhythm students liked). The ending comes after the final XP screen,
  not before it, so level-ups are still shown right after the boss.
- **The campaign awards a positive hero title from the 40 answers** (38/34/28/20
  thresholds, `src/records.js`); every title means the city was saved, so none
  is negative. The final victory no longer says `VERB MASTER!` since that is now
  a title rank. The next rank and how many answers it needs are shown only on
  results, as a replay surprise.
- **Best result and hero completions persist locally** (per hero best score and
  title, plus discovered final bosses) to give two replay paths: beat your score,
  or play a hero who has not protected the city yet. Records never give combat
  power; each campaign starts with the normal balance. Stored titles are
  recomputed from the score on read. Missed-word weighting on replay was
  skipped: optional, and the round generator stays untouched.
- **Fighter Guard/Counter shield: the real back arm raises it.** The old pose
  drew the normal hanging back arm behind the body *and* a fake forearm that
  started inside the chest, then painted the shield over the breastplate. Now
  the back upper arm stays behind the torso and the forearm, hand and shield
  are drawn after it (shoulder → elbow → hand → shield), the shield held in
  front, and the sword lowered at the side so it does not cross the shield.
- **Reward lines are laid out before they are revealed** on the victory screen.
  A first click there ends the XP sequence; revealing lines then grew the card,
  so the button moved under the pointer and the click was lost (found while
  scripting the campaign).

A useful rule:

> If a future developer or AI could reasonably ask, "Why is it designed this way?", record the answer here.

## 2026-09-30 — Osaka regional campaign persistence

- Regional progress uses the versioned local save key `esl-verbs-region-v1` and stores only `{ heroId, level, xp, savedCities, checkpoint }`; it contains no player names or other personal data.
- Cities are `saved`, `danger`, or `locked`. A playable city is dangerous only after all prerequisites are saved, while declared future cities with no campaign remain locked.
- Starting a chapter after the origin city is a chapter rest: the continuing hero keeps level and XP, returns to full HP and maximum potions, and clears retries.
- Stage checkpoints are written only for non-origin city campaigns. Matsubara keeps its original no-resume campaign behavior.
- The level cap remains unchanged at level 5; XP can continue accumulating after the cap.
