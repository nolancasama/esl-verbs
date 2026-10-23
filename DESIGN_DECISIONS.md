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

## 2026-09-30 — Sakai Horde battles and the Osaka Defender

- **Waves extend the existing battle engine.** A normal Matsubara encounter is still one wave with no ally; Sakai uses optional `waves` on the same encounter and state shapes rather than a second combat loop.
- **The Osaka Defender has no HP and never touches AP.** It is a deterministic phase between the player and enemies: above the protection threshold it hits the weakest living enemy, while at or below 30% hero HP it halves post-defence enemy damage for that phase.
- **Turn order is player → ally → enemy.** Clearing a wave by either the player or ally immediately replaces the enemy list, keeps campaign resources and persistent class setup, and gives the player the first move against the new wave. Temporary defence, exhaustion and Opening are cleared at the boundary.
- **Sakai is tuned so nobody gets stuck, measured the way Matsubara is.** The first tuning targeted the smart policy without retries and passed its tests, but a scripted browser run and a competent-policy check with the real retry assist showed 17–37% of campaigns permanently stuck at battles 3–4 at every AP from 0 to 8. The cause was HP, not AP: a hero who limps out of battle 3 enters battle 4 at the 40% floor, and a retry restored that same low HP forever, while the 10 AP cap limits what AP help can do in a 15+ turn, three-wave fight.
- **City retries also lift HP** (`CAMPAIGN.cityRetryHp` 60% → 80% → 100% of max after 1 / 2 / 3+ consecutive defeats, `retryHp()` in campaign.js). Matsubara retries are unchanged (still the battle-start HP). A cleared wave refills `BALANCE.waveClearAp` = 2 AP (an `ap` event, reason `wave`), so a long Horde battle does not drain to recovery turns. Rejected: a stronger ally or weaker enemies alone (the stuck runs remained while first-try play became trivial), and degenerate picks such as all-Healer waves that passed the numbers but made no sense as a Horde assault.
- **Final Sakai content** (escalates 4 → 7 → 7 + ally → 8 + ally + commander): First Assault [goblin, wolf, goblin, bat] with 6 watching silhouettes; Horde Battle [slime, goblin, bat] → [goblin, wolf, bat, slime]; Defenders Overwhelmed [goblin, wolf, goblin, bat] → [shieldGoblin, wolf, bat], ally at wave 2 (a Shield Goblin + Healer pair there made Ninja runs unwinnable); Final Sakai Defense [wolf, goblin, bat] → [shieldGoblin, healer] → [Shadow Commander, goblin, goblin], ally from wave 1. Shadow Commander 34 HP / 4 attack / 12 heavy (anything stronger brought stuck Ninja runs back). Ally: 3 damage, protects at ≤30% HP (half damage).
- **Measured (competent policy):** every campaign finishes within 6 attempts per battle at 0 / 3 / 5 / 7 AP; battles 3–4 first-try win ≈ 76% / 79% / 81% / 93% / 99% at 5 / 6 / 7 / 8 / 10 AP; a 5/10 student averages ~2.5 lost battles per city, a 10/10 student ~0.6; smart 100% vs naive 3% at 7 AP. Five AP is therefore easier on a first try than Matsubara's stage 3–4 bar (the hero is LV 5 with an ally); "difficult" shows up as retries across the city instead. Watch this in class.

## 2026-09-30 — Osaka expansion: story, quiz training field, map, Horde presentation

The Matsubara campaign stays as it was; this pass builds the world around it
and proves the regional framework with one full city (Sakai).

- **The lore is played straight and told in Japanese.** Year 2199; the Black
  Star (ブラック・スター) fell into Lake Biwa and the Shadow Horde (シャドウ・ホード)
  came out of it; Matsubara has Japan's strongest Action Energy, which the Horde
  wants; the Action Core turns action words (verbs) into battle power and has
  chosen the player — the only one who can use it. Action Energy is story
  language only: AP stays the one resource. The Black Star's origin is left
  unexplained on purpose (future hook, glimpsed on the Osaka map).
- **Exposition is kana-heavy Japanese with furigana** (`{漢字|かな}` in
  `src/story.js`) for 西暦, 科学者, 巨大, 地球, 何百万人, びわ湖; only very common
  kanji stand alone. Game terms (ACTION ENERGY, BATTLE POWER) stay English.
- **Readability beat the 20–35 s target.** The plan's script at a pace
  elementary students can read runs ~47 s untouched; cutting it to 30 s would
  have meant reading faster than they can. Instead every card can be tapped on
  (a fast reader finishes in ~20 s), SKIP / スキップ is always there, and cards
  are sized from their character count. Rejected: an auto-scroll fast enough
  to hit 30 s; a tilted Star-Wars-style plane (hard to read Japanese on a
  Chromebook) — cards drift up a little and fade at the top instead.
- **Music tells the turn:** field music on the calm city, an instant `cut()`
  (not a fade) the moment the Horde appears, ~0.5 s of silence, the `ominous`
  drone, `awaken` from the Action Core card, a fade to silence on 「それは――」,
  and `heroSting` on 「きみだ。」 as the chosen hero steps into the core's light.
- **The Adventure quiz is one training field**, not a character panel beside a
  form. Only menu / AP / music sit outside it. The stage backdrop is the sky and
  a matching floor tile (drawn from the same palette, seam-free by construction)
  fills the rest, so the hero stands on grass rather than on the screen edge.
  The word floats in the sky with an outline instead of sitting in a dark box;
  the speaker button sits beside it (or is the whole prompt in listening
  modes). A quiet mini-HUD keeps HP / potions visible between battles.
  The bottom row has a fixed height per input type so answering never moves
  the hero or the dummy.
- **A correct answer is a strike on a training dummy** (Fighter slash, Mage
  bolt projectile, Ninja cross-cut) and the AP point lands when the hit does,
  charging an in-field Action Energy gauge. That gauge mirrors the top AP meter
  and never holds its own value. A wrong answer is still only a stumble; the
  dummy never reacts to it.
- **The Osaka map is stylised pixel art**, not geography: the bay, the
  prefecture outline, the eastern hills, and a far-off purple Lake Biwa. City
  markers come from `src/region.js` data; the map's big button always names the
  next city (or つづき for a city in progress) so students need not discover
  that markers are clickable. Future cities show as locked; the count reads
  `まもった町: N`, never `N / 7`.
- **Wave battles are presented from the display snapshot.** The engine's state
  after a wave-clearing hit already holds the next wave (and maybe the ally),
  so the view keeps showing the old wave until `waveStart` plays and adds the
  ally only on `allyJoin`. Later waves stand as dark silhouettes on the horizon
  (paused sprites, no extra art) and march in when their wave starts.
- **The ally's hits have their own effect.** The effects player keyed damage
  effects to the last hero skill, so without an `allyAttack` case the ally
  would have shown the hero's Fireball.

## 2026-09-30 — Osaka continuation and shared city campaign flow

- **Regional progress changes the main-menu hierarchy.** After any city is saved, Continue Adventure becomes the dominant action and opens the Osaka map with the continuing hero; Start New Adventure is secondary and requires confirmation because it clears the regional save. The fresh-save menu remains unchanged, and Practice Only remains the quietest option.
- **Campaign completion leads back to the region.** Matsubara results now make continuing to the Osaka map the primary action, and non-origin city results return to the map with that city's save animation. Replay and practice actions remain available as secondary choices.
- **City campaigns share the existing Adventure stage flow.** Quiz mode, encounter, and final-stage detection come from regional campaign data rather than Matsubara literals, preserving Matsubara behavior while allowing Sakai's four stages to use the same screens and retry path.
- **Each non-origin stage starts with a checkpoint.** Quitting preserves the current city's stage and carried campaign resources, while battle defeat retries the same battle without repeating the quiz or changing saved cities. Matsubara keeps its original no-resume behavior.
- **City results do not use the Matsubara hero-title system.** They celebrate the saved city, summarize the 40-question campaign and missed words, then prioritize returning to the Osaka map.
- **Saved Sakai remains replayable from the map.** A replay starts a rested Sakai chapter with the same regional hero and does not require choosing a new hero.

## 2026-10-01 — Story pacing and the hero / word / dummy quiz scene

- **The Matsubara opening is brief again and holds only the immediate threat.**
  Four title beats, about 10 s untouched with nothing to read through:
  まつばら市 → まつばら市が あぶない！ (the Horde arrives, music cuts) → the
  chosen hero steps in, まつばら市を まもろう！ → STAGE 1. No dates,
  scientists, Black Star or Action Core. Rejected: keeping the ~47 s lore
  crawl before question 1. Students should play first.
- **The former opening lore is a post-victory story reveal.** ENDING_STORY is
  victory first (darkness clears, MATSUBARA CITY IS SAFE!, YOU PROTECTED THE
  CITY!) with no sequel setup. Then six short cards look back on what the
  student just played: Matsubara's Action Energy, the Black Star in Lake Biwa,
  the Shadow Horde coming out of it, why it attacked Matsubara, the Action Core
  (どうしに こたえると エネルギーが たまる, now understood from four stages of
  doing it) and 「きみだ！」 as the hero steps back in. Only then come two
  Osaka cards (the Horde has spread → 大阪を まもれ！), then the results and the
  map. Rejected: copying the old opening text as-is (it was written as a
  set-up, not a reveal); and putting the Osaka reveal after the results (the
  existing ending → results chain already gives the order with no flow change).
  The year 2199, "strongest city in Japan" and "millions failed" were cut or
  folded in to keep the reveal short.
- **Story lines are sized for the 1024×600 scene**: at most ~17 characters for
  a normal line and ~8 for a large one, so nothing wraps or clips in the story
  window.
- **The Adventure quiz scene is HERO | WORD | DUMMY.** A 31 / 38 / 31 column grid
  with one centre line at roughly 40–45% of the arena (spacer rows 1 : 1.35),
  hero and dummy on a shared ground line, the word centred on their height and
  the speaker under the word. The word fits its column on one line (`--ems` from
  the text, container-query font size, 2.4rem floor; a Japanese phrase may break
  only before を). Rejected: absolute positioning with the word in the sky and
  the actors at the bottom, which read as a dashboard with characters in it.
- **Hero and dummy are ~1.5–1.7× their former size** through their own scale
  `--apx`, separate from the backdrop's `--px`: 3 at Chromebook height (≤700 px,
  was 2), 5 at 1366×768 (was 3), 4 for 701–740 px or ≤1250 px wide, 6 at
  ≥1500×940 (was 4). 7 was tried at 1920×1080 and outweighed the word. Strike
  effects use `--apx` too, so they scale with the actors.
- **Hero status stands under the hero** (name · LV, HP, potions) on a light
  translucent gradient with a thin outline, replacing the bottom-left mini-HUD.
  The answer box stays centred below the scene. Each input type has a fixed
  answer-row height sized to its tallest state, so answering never moves the
  scene.
- **The quiz Action Energy gauge is removed.** It mirrored the top AP meter, so
  the top meter is now the only AP display. A correct answer is still the class
  strike on the dummy, and the AP point lands on the top meter with the hit. The
  mage's bolt now crosses the word's line, so projectiles draw behind the word.
- **A speech-synthesis failure (音が出ません) shows under the speaker**, not in the
  answer box, where its extra row pushed the controls off a 600 px screen.
- **Stage metadata is quieter**: a thin translucent strip, smaller type, same
  information.

## 2026-10-01 — Story / quiz polish: lower-third titles, shorter lore, centred word, shield layering

- **Intro title beats are a lower third.** The title sits bottom-centre (6% up)
  on a light horizontal gradient band with no panel frame, in slightly smaller
  type, so the skyline and the Horde stay the picture. Rejected: the old
  top-of-scene panel, which covered the skyline. The story hero stands
  bottom-centre, so in 「まつばら市を まもろう！」 the band covers the hero's
  legs; head, torso and sword stay visible.
- **The Matsubara ending is shorter (34.1 s → 26.4 s of auto-play).** 「やみが
  きえた！」 is folded into the SAFE beat (the darkness still visibly clears).
  The lore is five cards: Action Energy; Black Star in Lake Biwa + the Shadow
  Horde it released; why the Horde attacked; the Action Core (verbs charge it);
  then a short second beat 「コアが えらんだ ヒーローは―― きみだ！」. That beat is
  kept separate for the reveal and because one card of eight lines would not
  fit the 1024×600 window. The Osaka card is followed by a one-line
  「大阪を まもれ！ / SAVE OSAKA!」. "Many people tried" is gone.
- **The quiz word is centred between the banner and the answer box, not the
  viewport.** The field is banner | 1fr | scene (its own height) | 1fr | answer
  | 1.3fr, so the scene centres in the space between the banner and the answer.
  The word column spans the hero and status rows and centres the word itself
  (prompt grid `1fr auto 1fr`); the speaker and audio error hang below it. The
  word's centre is within 1 px of that midpoint at 1024×600, 1366×768 and
  1920×1080. Rejected: a fixed .3fr spacer under an arena with internal fr
  spacers. That squeezed the arena below the scene's height at 1366×768, and
  with the speaker counted, the word sat ~70 px high.
- **The answer box moved up** by taking free space from below it (the 1.3fr
  row). It moves 45–76 px depending on viewport and still has a fixed height
  per input type.
- **The stage banner is about twice as large**: STAGE 17–22 px, count 14–18 px,
  instruction 1.25–1.6rem (weight 900), 6 px padding, on the same translucent
  gradient. All four instructions fit on one line at 1024×600, and the word
  stays far larger.
- **Fighter raised shield is layered behind the torso.** Raised-shield order is
  back upper arm → shield → torso / breastplate → head → back forearm and hand
  → front arm. The breastplate covers the shield's inner edge, and the forearm
  and hand show in front holding the grip. The shield moved only 1 px outward.
  The lowered-shield order is unchanged. The Osaka Defender's small round
  shield was left as is.

## 2026-10-01 — Correction: the shield problem was Fighter idle; intro hero on the left

- **The raised-shield layering change was reverted.** The reported problem was
  Fighter idle, not Guard / Counter. Raised shield is back to its original
  order and position (upper arm → torso → forearm → hand → shield, at hand
  +1.5).
- **The lowered shield sits further out**: centre at hand −5 / −3 (was −1 / −3),
  still drawn behind the torso. Before, the torso covered over half of it, so it
  looked embedded. Now only its inner third is covered, and the boss and rim
  show beside the body. The hand barely moves in the idle loop (0.3 px), so the
  shield does not jump. Changed for every lowered pose, not just idle, so it
  does not jump 4 px when idle switches to attack, hit or stumble. Rejected:
  −6, which looked detached from the hand.
- **The intro hero stands on the left** (`.story--intro`: `left: 8%` — was 15% —,
  `bottom: 25%`), the Horde on the right. It is raised so the hero stands on the
  grass above the lower-third title. At bottom 4% the centred title covered the
  lower half of every hero, and nearly all of the Ninja. It still slides in from
  off-screen left. The ending keeps the shared centred position (44%).

## 2026-10-01 — Fighter's lowered shield shows its inside

- The lowered shield hangs on the far arm, on the far side of a right-facing
  body, so its front faces away from the viewer. It now draws as the shield's
  back (`shieldBack`): gold rim, wooden inside and two leather straps, with the
  lower strap running in to the hand. Before, the blue face and boss showed
  behind his back, so the shield read as flipped. The arm and hand are drawn
  over the inside, and the torso still covers the inner third. Same position
  (hand −5 / −3) and same for every lowered pose. The raised Guard / Counter
  shield keeps its front face: it swings round to face the enemy.

## 2026-10-02 — Quiz UI polish: word plate, answer slot, status nameplate, Ninja text

- **Ninja hero text matches how it plays**: チャンスを ねらえ！ / "Create
  openings and strike hard." (was タイミングが だいじ！ / "Fast and elusive.").
  The Ninja sets up an OPENING and then exploits it. The old line suggested a
  reflex-timing mechanic that does not exist. The hero card stays two short
  lines with no rules text. Mechanics are unchanged.
- **Visible vocabulary words sit on a quiet backing plate**
  (`.rpg-field__word-plate`): dark navy gradient at ~65–70% opacity, a 2px
  hairline outline, square corners. It gives steady contrast on every stage
  backdrop and makes the word the clear focus. The plate sizes to the word
  (min ~46% of the centre column, max the full column). The word's one-line
  fit now subtracts the plate's padding, from 98% of the column (was 94%), so
  long words lose at most ~7% size. Listening modes have no word and so no
  plate; the big speaker stays the prompt. The Mage's bolt still passes behind
  the word, so it is dimmed behind the plate. Rejected: a heavy framed window
  around the word, which would compete with the scene.
- **Typed Adventure answers use a labelled answer slot**, not a search bar: a
  dark recessed field (cream centred text, gold caret, thin light outline,
  gold when focused) about 430–470px wide beside Check. A こたえ / ANSWER tab
  sits on its top edge, like a legend, so the label adds no height at
  1024×600. Speech and fallback-choice answers keep their own layouts in the
  same dark panel. Study mode's plain input is unchanged.
- **The hero's status is a flat nameplate** under the hero: NAME · LV on one
  line, HP bar + numbers + potions on the next. It sits on a horizontal strip
  that fades at both ends (like the stage banner), not a boxed card. Same
  information, less weight than the hero.
- **Quiz actors draw at 90%** (`--px: calc(var(--apx) * .9)` on the hero, the
  dummy and the quiz strike effects). That leaves more room for the plate and
  the nameplate. The next integer `--apx` step would be −25–33%. The
  fractional scale stays hard-edged because the sprites are `pixelated`
  backgrounds. Battle and cinematic sizes are unchanged.
- **Intro hero a little further left**: `.story--intro` `left: 5%` (was 8%),
  ~17px at 1024×600. The sprite frame's transparent margin keeps the Fighter's
  shield, the Mage's hat and the Ninja well inside the scene. The ending
  position is unchanged.

## 2026-10-05 — Streak badge over the dummy; leaner Stage Clear

- **The "N in a row!" badge is centred above the training dummy**, not pinned to
  the arena's top-right. The dummy sits in a `.rpg-field__dummy-wrap` column
  (the grid's `dummy` area); the badge is absolutely positioned on that wrap,
  so it follows the dummy at every actor scale. The badge is a sibling of the
  dummy, so the hit shake moves only the dummy. Centring uses `transform`
  because `px-bob` animates `translate`. Rejected: a `right:` percentage, which
  drifts from the dummy as the columns and `--apx` change.
- **Stage Clear reads SUCCESS → hero → AP → BATTLE.** It has no Menu / Music /
  AP topbar, no score → AP line (the meter says it), and no enemy names (the
  battle introduces them). The shared AP meter is mounted under the hero scene,
  then the AP note (English and Japanese on separate lines), then BATTLE!.
  Other screens keep their topbars. Rejected: keeping the enemy preview; it
  duplicated the battle's own introduction and cost a lot of height at
  1024×600.
- **The hero's nameplate stands on the floor under the hero.** The Stage Clear
  scene (`.rpg-stage-scene--clear`) raises the backdrop by a strip of the
  stage's floor tile (as the quiz field does), and the quiz's flat nameplate
  (now the shared `.rpg-nameplate`, built by `heroNameplate()`) sits on it,
  just under the feet. Scene height 236 → 284px (162 → 234px in the compact
  ≤740px-tall layout); the hero's scale is unchanged. Rejected: putting the
  nameplate under the hero on the backdrop itself, which lifts the hero off
  the horizon.

## 2026-10-17 — Stage 4 uses the Stage 3 format (see Japanese → speak English)

- **Mode 4 now shares Mode 3's configuration** (`SEE_JA_SPEAK_EN` in
  `src/engine.js`): the Japanese word is shown and stays on screen, it is
  spoken with ja-JP TTS, and the student says the English verb with the same
  tap-to-talk flow and the same fallback (choices only when recognition is
  unsupported, denied, or keeps failing). Title: "Japanese → Speak English /
  See and hear Japanese. Say the English word. / 日本語を見て聞いて、えいごで言おう".
- **Why:** the learning target is the English verb, not Japanese listening
  comprehension. The old Mode 4 (hear Japanese only → speak English) made the
  last stage a Japanese-listening test.
- **Stage 4 stays its own stage:** its own 10-question round, AP, battle and
  campaign result. Difficulty, AP, battles, vocabulary and campaign structure
  are unchanged; later-stage difficulty comes from the battles.
- **Study mode** reads the same `MODES`, so Study Level 4 is now the same
  format as Level 3. Study's マイクなし behaviour is unchanged.
- Rejected: hiding the prompt or adding a Stage-4-only flag; mapping Adventure
  stage 4 to mode 3 (would blur the stage/mode link used by titles and saves).

## 2026-10-22 — Slice 1: target discovery, sound settings and AP arrival

- SOUND replaces the music ON/OFF toggle with a single RPG popover on
  `document.body`. Native Music and SFX ranges remain usable across battle
  re-renders; Escape/outside click closes it, restores button focus and keeps
  battle shortcuts from consuming slider keys.
- Music and SFX default independently to 12%, with separate persisted decimal
  volumes. Legacy music OFF migrates once to music 0; it never mutes SFX.
  Ducking multiplies the chosen music volume, and live gain changes preserve
  the current track rather than restarting it.
- Target hints use in-memory Adventure session state, reset on a new campaign
  or checkpoint resume. The first actual selection change makes the prominent
  Japanese-first hint quiet immediately; debug/Study use the quiet version.
  Gold marker, plate, pixel ground ring and warm sprite backing identify the
  target without dimming other enemies or changing selection/attack rules.
- Correct answers retain the existing class strike timing: weapon/cast sound,
  class impact, then a 300 ms gold +1 mote to the new AP segment. Arrival fills
  and pops that segment with an AP chime (also used by battle AP events).
  A pending credit settles once if a screen re-renders early, so the quiz
  gains no delay and AP cannot be lost or doubled. Reduced motion skips travel
  and applies AP with sound at impact; the segment flashes without scaling.

## 2026-10-22 — Slice 2: Yao and station defence

- Reinforcement calls use the existing intent ordering: choose at the end of
  an enemy phase, show CALLING HELP during the player's turn, resolve next
  phase. The opening call is shown when a wave begins. Killing the caller
  cancels the call and charges the Action Core +1 AP (see the correction below).
  Reinforcements are summoned enemies, give no XP, respect the living cap,
  and wait until the next enemy phase before acting.
- Armored Orc protection is passive: each living Orc protects the next living
  caller or boss in UID order, halving incoming damage and stacking with guard.
  Matching status badges identify both ends; killing the Orc ends protection
  immediately. This leaves its ordinary turns free to attack.
- Bomb Slimes count down through intents, then explode through the heavy-hit
  defence rules and give no XP when they explode. Shadow Archer uses the
  existing charge/heavy cadence with AIMING labels. Warcaller changes its
  reinforcement roster and call cadence at half HP.
- Horde Shaman is deferred. Yao teaches callers, countdowns and protection
  using the six controller-provided enemies and no ally; Sakai retains the
  Osaka Defender.
- Stage Clear's BATTLE! opens the controller-provided station defence map
  before every Matsubara, Sakai and Yao battle. DEFEND! starts immediately;
  missing locations fall through to battle. A defeat retry skips the map so
  another attempt needs no repeated location introduction.
- Yao keeps the existing save shape, city checkpoints and retry assist.
  Balance measures both threat-priority targeting and first-living targeting
  with ordinary competent skill/defence choices; target priority helps but
  is not required to clear the city with retry assistance.
- **Balance correction (controller, same day).** The first tuning cut Yao
  stats far below their roles (Orc 9 HP / 1 attack, Warcaller 30 / 2) yet
  yao-3/4 stayed 0% at AP5–7 and ~100% at AP10, and threat-priority play lost
  to first-target play. Measured (30 seeds, AP5): every loss was hero death —
  none hit the 200-turn cap — and reinforcements averaged ~1, so the call
  snowball was not the cause. The cause is the AP economy: an AP-starved hero
  recovers every other turn and deals ~2 damage a turn; Sakai survives that
  through the Osaka Defender's 3 damage a turn, Yao has no ally. Fixes:
  - **Stopping a call charges the Action Core: +1 AP** (`BALANCE.interruptAp`)
    when the player defeats an enemy whose CALLING HELP is showing. Yao's
    lesson pays out in the resource the student understands, and gives the
    solo hero part of the economy Sakai's ally provides.
  - **Per-wave call budget** (`callBudget`, default 3; 2 in Yao 3–4), calls
    need fewer than 3 living enemies, and no caller ever calls another caller
    (Warcaller: goblin → wolf + Bomb Slime in phase 2).
  - **A protected caller points at the Orc:** the hint becomes
    `🛡 オークを さきに たおそう！ BREAK THE GUARD!`, and the priority bot follows it.
  - **Smaller Yao 3–4 line-ups instead of tiny stats:** Horn Call wave 1 is
    Horn Goblin + Goblin; Signal Captain wave 2 is Orc + Captain; Warcaller
    wave 1 is Archer + Horn Goblin, wave 2 Orc + Warcaller. Final stats: Horn
    Goblin 9 HP / 2; Orc 12 HP / 2 (halves damage to its ward); Captain 24 /
    2, heavy 12, rests; Archer 8 / 3, heavy 10; Warcaller 28 / 3, heavy 12
    (effectively 56 while the Orc stands, enrages at half).
  - Result (report seeds): both bots complete Yao 100% at AP 0–10; mean
    first-try with priority targeting across heroes is yao-3 37/75/100% and
    yao-4 22/100/100% at AP5/7/10; priority targeting beats first-target
    play on average where the lesson is taught. Retries per city at AP5
    (2.3–4.3) are in Sakai's range (2.8). The assertions in
    test/balance.test.js check the hero-mean thresholds and advantage (single
    cells are too noisy at 20 seeds) and were shown to fail with a 42-HP
    Warcaller. Rejected: shrinking stats until AP5 wins (an AP10 player then
    meets no resistance) and giving Yao the ally (Sakai owns it).
  Matsubara and Sakai numbers remain untouched.

## 2026-10-22 — Station-defence maps before every city battle

- **What:** Stage Clear's BATTLE! now opens a local map of the station being
  defended (Matsubara, Sakai and Yao, stages 1–4), then まもる！/ DEFEND! starts
  the battle. A retry after defeat goes straight back into the battle.
- **Style:** the same look as the Osaka campaign map — its palette, dithered
  green land, blue sea with dashed waves and a cream shore, dark-green lines,
  the same hill triangles — and labelled the same way: the station under attack
  is a red alarm pin with a dark plate (駅名 / きけん！), neighbouring stations
  are grey pins with plates, landmarks are plates, river and hill names are
  plain shadowed text like びわ湖. (The first draft used a beige town style; the
  user asked for the Osaka map's style and labelling.)
- **Geography:** stations, neighbours and landmarks are placed from real
  latitude/longitude (Wikipedia / OpenStreetMap, checked 2026-10-22) through
  one projection per map, so directions between stations are true, as the
  cities' are on the Osaka map. A neighbour inside the frame gets its own pin;
  one outside gets an edge plate pointing the true way (dropped if it would
  cover a nearer station). Landmarks appear only where their position was
  verified (Hannan University, Nunose Shrine, Sakai City Hall, the old Sakai
  lighthouse, Ohama Park, Hamadera Park, Yao Airport, Mt. Takayasu, the
  Yamato River); unverifiable sides (Matsubara City Hall at Takaminosato) go in
  the note line instead. No roads are drawn — none were verified.
- **Atmosphere:** houses near the Horde's approach routes burn (pixel flames),
  small monsters roam by the fires, and one marching unit per approach has a red
  arrow to the station. Decoration only: the map is not interactive and nothing
  waits for an animation.
- **Rejected:** embedding map tiles/screenshots (licensing, runtime service),
  a tactical/movement map (out of scope), a separate screen function per
  station (data in `src/battle-locations.js`, one renderer in
  `src/station-map.js`), station-specific battle backdrops (deferred — the maps
  carry the sense of place; the backdrop system is unchanged).

## 2026-10-22 — Yao enemy art

Six sprites on the shaded rig, each role readable from its silhouette: Horn
Goblin (war horn + red signal flag; `cast` is the call, horn to the mouth with
sound rings — the telegraph is visible on the sprite itself), Bomb Slime (dark
iron slime with a lit fuse; `charge` glows red before BOOM), Shadow Archer
(hooded, violet bow; `charge` is the drawn bow with a glowing arrow), Armored
Orc (tusked orc with a tower shield bearing the Horde's black star), Signal
Captain (the captain rig recoloured with a smoking beacon banner; `cast` raises
the sword to signal) and the Warcaller boss (orc warlord, horned helm, giant war
horn, Horde banner; angry variant has red eyes and steam). Rejected: plain
recolours of existing enemies for every role — a new role needs a new shape.

## 2026-10-22 — City campaign identities (locked roadmap)

One memorable tactical idea per city, old enemies mixed with new specialists,
difficulty from behaviour rather than HP:

- **Matsubara — Learn:** AP, attack/defence, intents, skills, target selection
  (first multi-enemy fight teaches it), bosses.
- **Sakai — Survive:** waves, Shield Goblin, Healer, the Osaka Defender ally,
  Shadow Commander.
- **Yao — Prioritize:** reinforcement callers telegraphed a turn ahead; kill the
  dangerous target first (Horn Goblin, Bomb Slime, Shadow Archer, Armored Orc,
  Signal Captain, Warcaller).
- **Higashiosaka — Protect (future, not built):** a visible Action Core with
  its own HP; enemies choose hero or Core. Saboteur (goes for the Core), Siege
  Golem (big charged Core attack; boss), Engineer Goblin (repairs/supports
  machines), Sniper (strong targeted damage), Guardian Construct (protects
  attackers).
- **Osaka City — Master everything (future, not built):** "The Invasion" —
  combinations of waves, priority, allies, callers, support enemies and the Core
  objective; no new subsystems for the finale. Multi-phase final boss (Shadow
  General / Black Star Avatar / Horde King — name TBD): minions → special
  mechanic → direct fight; earlier allies may cameo as scripted support, never
  party management.
- Still out of scope: gold, shops, equipment, inventory, skill trees, free
  roaming, grid tactics, timed reflex attacks, Verb Rush, multiplayer.

## 2026-10-22 — Higashiosaka and Osaka City specs frozen

Full designs in `.ai/higashiosaka-spec.md` and `.ai/osaka-city-spec.md`
(not built yet). Key decisions:

- **Higashiosaka's one new system is the Action Core:** an object with its own
  HP on the field; each enemy intent carries an aim (hero or Core) chosen with
  the intent, so the threat is always telegraphed. The hero's defence stance
  covers the Core too (one rule to learn). The Core breaking loses the battle,
  with the normal retry assist and a full Core on every attempt.
- **Core charge is the city's AP lever** (Yao showed a solo hero starves on
  AP): every 3rd turn the Core gives +1 AP while above half HP, so protecting
  it pays in the resource students understand.
- Higashiosaka roster: Saboteur (always hits the Core), Engineer Goblin
  (repairs machines), Goblin Sniper (aimed Core Shot), Guardian Construct
  (the Orc's protector rule, protecting Core attackers), Iron Foreman
  (miniboss), Siege Golem (boss). Small two-wave line-ups, no ally.
- **Osaka City adds no engine systems:** four stages that each combine earlier
  lessons, the Osaka Defender returning in stages 3–4, and a three-phase
  finale at Osaka Castle built from three waves (escort → Black Star attacking
  the Core → the True Form with the ally). Rejected: a new finale mechanic,
  party management, HP-only difficulty.
- Stations (real coordinates in the specs): Higashiosaka Ishikiri →
  Higashi-Hanazono → Aramoto → Fuse (the Horde pushes west from the Ikoma
  hills); Osaka City Tennoji → Namba → Osaka/Umeda → Osakajōkōen (Osaka Castle).
- Balance targets carry Yao's lessons: measure how defeats end before tuning,
  assert hero-mean thresholds, both bots must complete every city at AP 0–10,
  prove each new assertion can fail.

## 2026-10-22 — Higashiosaka H0: art, stations, Core plate

- The Core stands at the back-left of the hero column; the hero moves right
  of it. With an ally (Osaka City) the ally stands **between** the Core and
  the hero, not front-left of the Core as the spec first said: at 1024×600 a
  front-left ally hid half the Core and its plate. The Core is then scaled
  .8 and raised, reading as "further back"; the hero column widens.
- The Core plate is cyan (the Core's colour, also the `→ コア` intent tag),
  pulses red under 35%; the broken Core is a fallen dark crystal (the
  sprite's `tired` row) rather than a separate sheet.
- New foes reuse the goblin and captain rigs through small gear hooks
  (head / torso / weapon / behind) instead of copies; every existing sprite
  is byte-identical. The Sniper carries a crossbow, never a gun.
- Higashiosaka maps show sawtooth factory roofs for the town of makers
  (decoration only, never a named building); both Ishikiri lines end in a
  tunnel portal because they really tunnel under the Ikoma hills.
- Art lands before battle data: the art test lists the art-ahead ids
  explicitly (H2 empties the list), instead of loosening the check.

## 2026-10-22 — Higashiosaka H1: generic Action Core contract

- Encounters opt into a fresh `{ hp, maxHp }` Core; it survives wave changes
  within that battle and resets on retry. Checkpoints continue carrying only
  campaign resources. The battle debug launcher's Core checkbox passes a
  30-HP Core override to `createBattle`; Adventure data is unchanged.
- Core charge counts the existing player-turn round across waves, including
  the turn opened by clearing a wave. The interval and strict HP threshold
  come from encounter `coreChargeEvery` / `coreChargeAbove` (defaults 3 / .5).
  AP remains capped through the existing gain function.
- Aim is stored with each intent and used through resolution. Core attacks
  carry their target into animation events too, so playback cannot redirect
  an old attack using the following turn's telegraph. Guard, Barrier and
  the phase-wide Dodge sequence cover both hero and Core; ally protection
  covers only the hero. Core loss immediately ends the phase.
- Protectors choose distinct wards in UID order. The default caller/boss rule
  retains Yao behavior; `coreAttackers` prefers enemies whose data can target
  the Core, then falls back to a boss. Repair follows heal's lowest HP-ratio,
  then UID ordering, restricted to other living damaged machines.
- Core-specific hints follow hero-heavy, boom and hero-HP emergencies; the
  generic heavy hint applies to hero threats so a Core heavy can display
  GUARD THE CORE. The H0 Core markup and CSS remain the visual contract.
- Generic tests define temporary encounter/enemy fixtures inside the tests
  and restore the mutable registry entries afterward. No Higashiosaka enemy,
  encounter, region or story data is introduced before H2.

## 2026-10-22 — Higashiosaka H2: campaign and measured Core charge

- **Campaign:** Yao now unlocks Higashiosaka (including existing saves); four
  quiz modes lead to hig-1..4 with the existing checkpoint, retry, city story,
  results and map-save flow. Osaka City stays locked. The exact spec story
  reuses city art; H0's Ishikiri, Higashi-Hanazono, Aramoto and Fuse cards are
  mounted through the existing station flow. Dev jump enumerates the new data;
  map presets add `yao` and `higashiosaka`. No save migration or Core engine
  contract change was needed. Art-ahead allowlists are empty again.
- **Measurement and determinism diagnosis:** 20 seeds per cell, real post-Yao
  progression, three heroes, 70/85/100% HP and two potions. Campaigns carry
  victory resources, city retry HP and at most six attempts per battle.
  `simulateBattle` passes its seeded RNG to `createBattle`, player steps and
  `resolveEnemyPhase`, including subsequent waves. Both bots use deterministic
  decisions from visible state; their fixed .9 lookahead avoids consuming the
  battle RNG. All six new enemies originally had deterministic intents: no
  guard/drain rolls or random reinforcements. Hig-1's goblin and hig-3's called
  goblins could guard, but never changed the win/loss result. HP fractions alone
  therefore produced 0/33/67/100% cells. Yao's goblin guards and random caller
  reinforcement choices affect close outcomes. No simulator RNG fix was needed.
- **Final tuning:** Engineer and Construct use the existing goblin-style
  `guardChance: .25`: the Engineer can defend when no machine needs repair
  (repair still takes priority), and the Construct can raise its own shield.
  Saboteur attacks and charged-heavy cadence remain fixed and readable.
  Hig-1 retains a 30-HP Core and its original waves, charging every 3 turns;
  hig-2 retains 30 HP/every 2 but adds a Construct before the Sniper/Saboteur
  in wave 2. This protects the Core attackers while naive spends AP on the
  first target; awareness kills the Saboteur and guards Core heavies.
  Hig-3 retains its waves/every 2 charge with Core HP reduced to 22, so ignoring
  the early Saboteur and protected Foreman can break it. Hig-4 stays 30 HP/every
  2. All charge thresholds remain strictly above half HP. Enemy numbers remain
  Saboteur HP8/attack3; Engineer 12/2, repair5; Sniper 10/2, heavy12 every3;
  Construct 20/2; Foreman 26/3, repair6, heavy12 every3/rest; Golem 44/4,
  heavy16 every3/rest, at half HP every2/no rest. XP and role flags are unchanged.
- **Before → after, three-hero first-try means (AP5/AP7/AP10, %):**

  | Encounter | Naive before | Naive after | Core-aware before | Core-aware after |
  |---|---|---|---|---|
  | hig-1 | 100/100/100 | 100/100/100 | 100/100/100 | 100/100/100 |
  | hig-2 | 100/100/100 | 8.3/90.0/100 | 100/100/100 | 100/100/100 |
  | hig-3 | 100/100/100 | 57.8/63.9/77.8 | 100/100/100 | 91.7/92.8/96.1 |
  | hig-4 | 11.1/33.3/100 | 12.2/31.1/100 | 66.7/100/100 | 60.0/100/100 |

  Awareness gains at AP5–7 are hig-2 **0 → 42.2 points**, hig-3 **0 → 31.5**.
  All section 8 targets still pass: both bots complete 100% at every AP0–10;
  awareness never falls below naive overall at any AP5–10; AP5 city retries
  are aware **0.67 → 0.80**, naive **2.00 → 3.83**, both within 4.5.
- **Defeat causes before → after (hero/Core/turn cap):**

  | Encounter, first tries AP5–10 | Naive before | Naive after | Aware before | Aware after |
  |---|---|---|---|---|
  | hig-1 | 0/0/0 | 0/0/0 | 0/0/0 | 0/0/0 |
  | hig-2 | 0/0/0 | 0/231/0 | 0/0/0 | 0/0/0 |
  | hig-3 | 0/0/0 | 0/352/0 | 0/0/0 | 46/23/0 |
  | hig-4 | 0/480/0 | 0/510/0 | 0/120/0 | 0/132/0 |
  | All | 0/480/0 | 0/1093/0 | 0/120/0 | 46/155/0 |

  Core breaks are **100% → 100%** of naive hig-2..4 first-try defeats, now
  represented in all three encounters. Across campaign AP0–10 attempts,
  naive changes **168/1359/0 → 44/2448/0**, aware **172/295/0 → 266/285/0**.
  Hero death remains real in campaigns; the old campaign defeat-share checks
  remain, alongside the new first-try-only Core-share assertion.
- **Assertion proof and validation:** seven correction tests cover the six
  new balance targets and seed-sensitive outcomes in each of hig-2..4.
  Temporarily using naive ceilings -1, gain/Core-share/tutorial floors 1.01
  and minimum varied cells 1,000,000 made exactly these seven tests fail
  (`npm test`: 186 pass / 7 fail). Restoring approved thresholds passes
  **193/193**. `npm run balance` passes. Original H2 target checks remain.
  `.ai/hig-balance-before.txt` and `.ai/hig-balance-after.txt` preserve reports;
  comparison of all output before the Higashiosaka section is byte-identical
  (10,518 characters, including Matsubara/Sakai/Yao). No H1 contract changed.
- **Browser scope:** the playthrough now checks unlock/checkpoint, dev jump,
  Stage Clear → Ishikiri → visible Core, debug hig-4 wave 2, guarded Core-heavy
  damage with Fighter's LV5 passive, and 1024×600 no scroll. Screenshot paths
  are prepared, but no browser suite or screenshot capture was run: H2's
  validation order lists only `npm test` and `npm run balance`. Layout and
  Claude's final aesthetic review remain open; Osaka City O0 follows H2.

## 2026-10-22 — Osaka City O0: art, traced maps, final banner

- The Black Star's first form is a crowned, hooded sorcerer with a purple
  cape lining and sleeves: an all-black robe read as a blob at battle scale.
  The true form is a one-eyed black star with shadow arms from its side
  points and a dark corona; arms from the lower points read as walking legs
  and made the final boss look comic.
- River and park outlines are traced from OpenStreetMap ways (ids in
  `battle-locations.js`), never guessed: a first draft extended the Okawa
  west by eye and was replaced by the traced Tosabori branch.
- The final OSAKA IS SAFE! banner sits at the top of the Osaka map, where no
  city marker is; centred or low it covered the saved cities it celebrates.
  It lives in `osakaMapView.reveal()`, so the last save needs no new wiring.
- Long story lines from the spec are split at phrase breaks (~17 characters
  per line at 1024×600); the text itself is unchanged.

## 2026-10-22 — Osaka City O1: final campaign wiring and ending

- Saving Higashiosaka unlocks Osaka City. Four existing quiz modes lead to
  osk-1..4 through the same checkpoints, resume, retry assistance, station
  cards, city results and saved-city replay flow as Higashiosaka. Osaka City
  combines familiar roles; it adds no engine system and does not change the
  H1 Core contract or earlier cities' data.
- The Osaka Castle finale uses three encounter waves: the Shadow Guard
  escort, the Black Star avatar attacking the Core, then its True Form.
  The Core survives all wave changes and resets on retry. The Osaka Defender
  joins Shadow Generals at wave 2 and the finale at wave 3 through the
  existing `ally.joinsAtWave` field.
- The only wave presentation addition is optional data `banner`, carried on
  the existing `waveStart` event and displayed by the existing banner UI.
  Finale wave 3 supplies `しんの すがた！ TRUE FORM!`; other waves retain their
  existing text. Both boss forms keep their existing half-HP phase rules,
  with the True Form announcing `★ THE BLACK STAR IS FADING!`.
- Story cards use the exact section 10 phrase breaks, including the returning
  ally's 「やったな！」. The ending plays the existing `finale` track. Saving
  Osaka City passes `justSaved: 'osakaCity'` into the normal map flow, so
  O0's reveal supplies the five saved cities and OSAKA IS SAFE! banner without
  changing the map implementation or CSS.
- Full completion reuses `recordCompletion` and the existing Adventure
  records save key. An optional per-hero `fullCampaignCompleted` field marks
  the Osaka City ending; Matsubara's title/best-score and completion behavior
  remain intact, and parsing accepts records without the new field. Existing
  menu choices, regional continue and replay of saved cities remain available.
- Unit coverage includes encounter/region/story wiring, ally arrival waves,
  Core persistence and retry reset, the transformation banner, caller
  protection, both boss phase changes, completion records and stage resumes.
  Browser checks are written for unlock → Tennoji → battle, debug finale
  waves 2 and 3, Core/ally geometry without page scroll at 1024×600, five saved
  cities and the final map banner, and the dev jump to osk-4. The worker does
  not run the browser suite; the controller runs it and Claude makes the
  final aesthetic judgment. No new visual evidence is claimed by this entry.

## 2026-10-22 — Osaka City O1: measured balance and finale attrition

- Measurement matches Higashiosaka: 20 seeds, all three heroes, actual
  post-Higashiosaka progression and city rest, 70/85/100% entry HP, two
  potions, carried campaign resources and six attempts per battle. Both
  bots reuse the Higashiosaka skill/resource plan; priority also recognizes
  Core targets and protects the Core. In osk-4 only, both Fighter bots now
  use affordable Power Slash to BREAK a heavy before defence or a potion.
  No previous city's bot, enemy or encounter numbers changed; osk-1..3
  still use their original policies and numbers.
- Before numerical tuning, first-try outcomes already varied within HP
  samples: across both bots, osk-1/2/3/4 had 20/2/14/21 cells outside
  0/33/67/100%. Existing goblin, Engineer and Commander guard rolls, random
  call choices and the Shadow Guard's role-appropriate 25% guard intent
  provide seed variety. Fixed heavy telegraphs remain fixed.
- Initial first-try defeats (hero/Core/turn cap) were overwhelmingly hero
  deaths. osk-4 was naive 698/3/0 and priority 971/22/0; osk-2 was naive
  4/0/0 and priority 0/0/0. Traces showed AP starvation and reinforcement
  attrition, especially Ninja spending AP on Core defence and arriving at
  the True Form exhausted. The initial priority finale averaged 19.57
  player turns at AP7 because many runs died early; it was not a turn-cap
  problem. Final first-try and campaign cause counts are saved in
  `.ai/osaka-balance-after.txt`; the earlier-city baseline is retained in
  `.ai/osaka-balance-before.txt`.
- Final line-ups shrink the combinations before cutting boss HP: osk-1's
  second wave keeps the Healer and drops the Shield Goblin; osk-3's first
  wave keeps Signal Captain and drops the Orc; osk-4's escort keeps Shadow
  Guard + Horn Goblin and drops the Healer. Other waves retain the spec
  line-ups, including the Engineer beside the avatar and the solo True Form.
  Call budgets stay 3 except avatar wave 2, which uses 1. This leaves each
  lesson present without a long support/caller attrition loop.
- Fighter AP inversion was traced at AP5/AP7 with matching seeds 65554 and
  131091 under both policies. In seed 131091, naive AP5 won with 1 HP while
  AP7 died in wave 3. AP7 affords a second escort Cleave and reaches wave 2
  at player turn 3 instead of 6. Its retained combo makes Power Slash hit
  for 14 instead of 10, crossing Avatar's half-HP threshold and calling a
  wolf instead of a goblin. At charge/AP1, Slash leaves zero AP for Guard
  on Star Fall; voluntary recovery is illegal. Core 36→22→18 then shuts
  off periodic AP (strictly above half HP), extending recovery attrition.
  This is real phase/resource timing, compounded by both bots overlooking
  affordable nonlethal Fighter BREAK. The shared finale-only BREAK fix
  removes that oversight; Avatar HP36 avoids the immediate combo phase
  crossing, and Core HP24 makes two ignored Star Falls lethal. The
  remaining AP1 timing rule and H1 Core contract are unchanged.
- Final new-enemy numbers: Shadow Guard HP12/attack3/25% guard, protecting
  callers; Avatar HP36/attack1/heavy14, call every3, heavy every3/rest,
  at half HP wolf/bat calls and heavy every2; True Form HP32/attack3/heavy16,
  heavy every2/no rest, then every1/rest at half HP. Each form gives 70 XP.
  The avatar's ordinary damage is small because its threats are calls and
  Star Fall at the Core. Core HP is osk-2 **18**, osk-4 **24**, charging
  every3 turns strictly above half HP. Lowering the raid Core creates real
  pressure when the protected Saboteur is ignored; the H1 contract is intact.
- Final hero-mean first-try percentages at AP5/AP7/AP10:

  | Encounter | Naive | Priority |
  |---|---|---|
  | osk-1 | 100/100/100 | 100/100/100 |
  | osk-2 | 48.3/95.0/100 | 100/100/100 |
  | osk-3 | 28.9/86.7/100 | 74.4/98.3/100 |
  | osk-4 | 20.0/64.4/98.9 | 52.8/97.8/100 |

  Priority gains **24.4** and **42.6** points over naive at AP5–7 in osk-2
  and osk-4. Both bots complete **100% at every AP0–10**; AP5 mean city
  retries are naive **3.75**, priority **1.25**. Finale AP7 mean length is
  naive **18.12**, priority **20.57** player turns (all sampled attempts).
  Priority AP7 rates are Fighter **95.0%**, Mage **100%**, Ninja **98.3%**.
  Both bots' AP5→7→10 means increase. The AP5 priority mean is below 60%
  and osk-3's 74.4%, making the finale the measured climax.
- Final first-try defeat counts (hero/Core/turn cap): osk-1 both 0/0/0;
  osk-2 naive 0/135/0, priority 0/0/0; osk-3 naive 260/0/0, priority 89/0/0;
  osk-4 naive 240/140/0, priority 1/93/0. Core breakage is **36.8%** of
  naive finale first-try defeats, so guarding Star Fall matters. Across
  campaign AP0–10 attempts: naive 2166/1075/0, priority 1610/301/0.
  No measured loss hits the turn cap.
- All 31 balance threshold tests, including the finale ceiling, osk-3
  comparison, per-hero AP7 floors, both bots' monotonic means, Core-defeat
  share and both AP7 turn ceilings, were demonstrated failing with floors
  1.01, ceilings -1, a comparison margin of 2, monotonic slack -2 and
  1,000,000 required varied cells, then restored
  (`.ai/osaka-assertion-proof.txt`). That run also exposed O0's existing
  112×132 Avatar frame exceeding the old generic 128-pixel boss limit;
  the art test now checks that exact frame without changing any sprite.
  Final `npm test`: **237/237 pass**; `npm run balance`: pass. All output
  for Matsubara, Sakai, Yao and Higashiosaka is byte-identical to the saved
  pre-change report (**30,554 bytes**, including its encoding).

## 2026-10-22 — Osaka City acceptance fixes (controller)

- With the Core and the ally on a boss field, the ally stands at a fixed
  142px (clear of the Core's 150px plate at scale .8): the H0 offset scaled
  with sprite size and put the Osaka Defender on top of the Core in the
  finale, where boss sprites are drawn smaller. Caught by the new browser
  check; verified at 1024×600 and 1366×768.
- After the last city is saved the map shows ALL CITIES SAVED with a MAIN
  MENU button instead of "more cities coming soon"; the OSAKA IS SAFE!
  banner is smaller and sits low on the map, where it covers no city at the
  real card size (the O0 mock used a different size).
- Known and accepted: at AP5 the priority bot wins the finale first try only
  3% as the Mage (naive 47%); from AP6 the Mage wins ~100%, the three-hero
  targets hold and city retries stay low. Left after two balance passes;
  watch Mage at low quiz scores in class.

## 2026-10-23 — MATSUBARA HEROES: title, boot cinematic, Ninja moves

- **Name.** The player-facing game is **MATSUBARA HEROES**, subtitle
  **SAVE OSAKA! / 大阪を まもれ！** (document title "Matsubara Heroes"). The
  repo, file names, CSS classes and every `esl-verbs-*` storage key stay as
  they were: renaming keys would have reset students' heroes, levels, cities
  and sound settings for a branding change. Rejected: a key migration.
- **Boot cinematic.** Before the first title screen of each page load, a
  ~9 s story plays over the already-built (hidden, inert) title: まつばら市 →
  シャドウ・ホードが せまる！ (danger sky, Horde) → だれが 町を まもる？ (all
  three heroes walk on; nobody is chosen) → a reveal that fades into the title
  with a restrained flash and a new `titleSting`. It reuses `playStory` (a
  hosted mode) and the intro's city art. SKIP, Escape, Enter and Space end it
  at once (a key's release is ignored by START for 400 ms); a tap moves to the
  next beat. "Played" is a module flag, not storage: returning to the menu
  never replays it, a reload does, and future students always see it. Debug
  URLs skip it. Reduced motion keeps the beats with no slides or flash.
- **Title screen.** The screen is the scene: new programmatic art
  (`titleImage('sky')`: Osaka at sunset seen from Matsubara — Osaka Castle,
  Abeno Harukas, Tsutenkaku, a Kintetsu train on its viaduct, Matsubara roofs,
  the Horde on the eastern hills and the Black Star far off) above a ground
  strip where Fighter, Mage and Ninja stand on the horizon. The logo is the
  existing pixel font with a stepped gold face, an ink outline and a rare
  short highlight sweep; nothing else moves. The main button is a gold
  START / CONTINUE ADVENTURE button with no art in it. A returning player's
  hero stands centre front; under the button a progress line comes from the
  real save (`HERO · LV n`, saved cities ★, the city in danger !, locked
  cities omitted); NEW ADVENTURE / はじめから is a small secondary button
  using the unchanged confirmation. SOUND moved to the top-right corner
  (same popover). Rejected: keeping the old white card, or a glossy
  mobile-style menu that would not match the rest of the game.
- **Practice off the title.** Study mode stays intact but is reached only by
  `?debug=study` or the dev panel (Ctrl+Alt+Shift+D → Practice); results
  screens keep "Practice mistakes".
- **Ninja attacks are cosmetic shuriken and dash-slash moves.** Strike
  alternates (per battle) a thrown shuriken (`shurikenProj`, new art) and a
  blink to the target's side → slash → quick return. Double Strike throws for
  hit 1 and dashes for hit 2 (if the target dies to the shuriken there is no
  dash; if it will survive both hits the dash starts as the shuriken lands).
  Shadow Strike vanishes in a puff, streaks in shadow, reappears beside the
  target for the dark slash and returns in shadow. The blink is a Web
  Animation on the hero's art wrap: a re-render, playback skip or destroy
  cancels it, a defeat of the target sends the Ninja home, and a 500 ms
  fallback returns it regardless, so the hero cannot be stranded. The choice
  never touches battle state: damage, AP, OPENING and targeting are
  unchanged (`npm run balance` byte-identical). Reduced motion: the Ninja
  stays home and the shuriken / slash mark shows on the target, with sound.
  New sfx: `shurikenThrow`, `shurikenHit`, `ninjaDash`.
- **Verb training.** A correct Ninja answer throws a shuriken at the dummy (a
  dash would cross the word in the middle of the scene); the impact → +1
  mote → AP sequence is unchanged.
