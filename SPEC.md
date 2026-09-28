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

No (in the quiz itself): pictures, sentences, story, coins, XP, achievements,
pronunciation scoring, login, analytics, timers, lives. The RPG wrapper below
adds heroes, battles, AP, XP/levels, HP and potions around the quiz; it never
changes answer checking, scoring or round logic.

---

# Adventure mode (RPG campaign) — added 2026-09-27, AP/RPG upgrade 2026-09-28

A lightweight 2D turn-based RPG wrapped around the unchanged quiz. Quiz and
battle are **separate phases**: 10 quiz questions earn Action Points (AP),
then one short battle. Never a combat turn per question. Principle: **easy to
understand casually; rewarding to play well.** Why each rule is the way it is:
`DESIGN_DECISIONS.md`. Every number lives in `src/battle-data.js` (`BALANCE`,
`CAMPAIGN`, `ITEMS`, `LEVELS`, `SKILLS`, `HEROES`, `ENEMIES`, `ENCOUNTERS`);
values quoted below are the current tuning, not a contract.

## Flow

```
Main Menu ─┬─ ADVENTURE / ぼうけん → Choose Hero → [Stage n quiz (mode n) → Stage n Clear → Battle n → Victory] ×4 → Campaign Results
           │                                                                    └─ Defeat → Retry battle n (the quiz is never redone)
           └─ STUDY / れんしゅう → existing level select (unchanged behaviour, existing end screen)
```

- Stage n uses quiz mode n (1→4), 10 unique questions, same engine, same
  `answer()`, same speech/TTS/mic-free behaviour. The マイクなし toggle stays on
  the main menu and in speech-mode questions.
- Battle tier = stage (1 tutorial, 2 group, 3 advanced, 4 boss). The encounter
  is drawn from the tier when the stage's quiz starts (so its art can be built
  while the student answers) and announced on Stage Clear.
- Adventure never shows the Study end screen between stages.
- `?debug=battle` opens the battle launcher, `?debug=art` the sprite gallery.

## Quiz → AP

- **Starting AP = quiz score**: `startingApFor(correct) = clamp(correct, 0,
  BALANCE.maxAp = 10)`. Wrong answers, Show answer, replay, "Try again" and STT
  errors cannot change AP by construction.
- One persistent **ACTION POINTS meter** (a single DOM node remounted per
  screen) sits top-centre through the Adventure quiz, Stage Clear, battle and
  Defeat. It fills/drains over ~500 ms with a `+N` / `−N` chip; during the quiz
  it shows the running correct count.
- The Adventure quiz has an RPG frame (hero panel with LV / HP / potions, stage
  banner); Study stays plain. Vocabulary stays in the readable Japanese font.
- Stage Clear: `STAGE n CLEAR!` · hero victory pose · `7 / 10 = 7 AP` ·
  LV / HP / potions · enemy names · an AP note (`Every action costs AP.`, or the
  0-AP recovery note) · `BATTLE!` (focused).

## AP in battle

- **Everything costs AP**: basic attack and defence 1, tier-1 specials 2,
  tier-2 specials 3, Potion 1. AP never goes below 0 or above 10.
- **RECOVERING turn**: when no skill or item is affordable (`mustRecover`), the
  turn becomes `recover()`: +1 AP, then the enemies act normally (no extra
  damage). It is rejected whenever anything is affordable, so waiting can never
  farm AP.
- **Tactical AP** is AP-neutral, not a surplus: Guard or Barrier up when a big
  attack lands → +1 AP (at most once per enemy phase); Mage Magic Bolt on a
  charging or tired enemy → +1 AP. Dodge avoids big attacks completely instead.

## Heroes

Hero cards show art, name (EN / JA), a kana summary and an English phrase — no
stat sheets. Each hero has four skills unlocked by level (skill tier 0 at L1, 1
at L2, 2 at L3) and a class passive at L4.

| Hero | HP | Tier 0 (1 AP) | Tier 1 (2 AP) | Tier 2 (3 AP) | L4 passive |
|---|---|---|---|---|---|
| Fighter / せんし | 32 | Slash 4, arms COMBO · Guard ×0.4 | Power Slash 10 (+4 COMBO right after Slash; BREAKs a shown big attack into a rest) | Cleave 10 to all | Iron Guard: Guard ×0.25 |
| Mage / まほうつかい | 27 | Magic Bolt 7 (+1 AP vs charging/tired) · Barrier ×0.25 | Heal +12 (below half HP it also raises Barrier) | Fireball 10 to all | Great Heal: Heal +4 |
| Ninja / にんじゃ | 28 | Strike 4, marks an OPENING on a charging / guarding / tired / healing / summoning enemy · Dodge | Double Strike 5 + 5 (+3 per hit on an OPENING) | Shadow Strike 14; each defeat chains 9 to the weakest enemy (max 3) | Keen Eye: OPENING +2 per hit |

- Defence lasts one enemy phase. Guard/Barrier damage is `Math.ceil(base ×
  multiplier)`. Dodge: big attacks do 0, the first normal hit 0, later hits ×0.5.
- COUNTER READY: Guard or Dodge against a big attack → +4 on the next damaging skill.
- Heal on full HP is allowed and restores 0.

## Enemies — shown intents

Every enemy (bosses included) is data: `{ id, name, jaName, maxHp, attack,
heavy?, heavyName?, heal?, summonId?, drainHeal?, boss?, xp, ai }`. The engine
chooses each enemy's **intent** once (injected `rng`), the UI shows it before
the player acts, and the enemy phase resolves exactly that stored intent.

- `ai`: `heavyEvery` (normal actions before charging), `rests` (tired after a
  big attack), `guardChance`, `drainChance`, `support: 'heal' | 'summon'`,
  `maxSummons`, `normal` (forced normal action), `phase2` (overrides).
- Intents: `attack`; `guard` (🛡, incoming ×0.5 until its next action);
  `charge` (⚡ POWERING UP), always followed by `heavy` (🔥 BIG ATTACK, `heavy`
  damage); `rest` (Tired, incoming ×1.5); `heal` (the most-damaged living enemy
  by `heal`); `summon` (adds `summonId` under the limit and below 4 living
  enemies); `drain` (attack, then heal self up to `drainHeal`).
- A shown intent never turns into something else: a heal with nobody hurt or an
  illegal summon fizzles. Only Break changes an intent.
- Heavy cycles are odd lengths so a low-AP rest/act rhythm does not always meet
  the big attack on the same beat.
- **Boss phase 2** at 60% HP: one `enrage` event, a separate enraged sprite
  sheet, and the `ai.phase2` overrides (one normal action between big attacks; Dragon
  and Giant Golem stop resting, Demon King may keep 2 bats, Vampire Lord only
  drains).
- Summoned enemies first act in the next enemy phase and give no XP.

Roster: slime, bat, mushroom; goblin, wolf, skeleton; shieldGoblin, healer,
golem (Rock Smash), goblinCaptain (Captain Slash), necromancer (summons
skeleton). Bosses: dragon (Fire Breath), demonKing (Dark Blast, summons bat),
giantGolem (Earthquake), vampireLord (Blood Moon, drain).

## Encounters (`ENCOUNTERS`, `chooseEncounter(tier, rng)`)

- Tier 1: `slime` · `bat` (two bats) · `mushroom`
- Tier 2: `goblin-slime` · `bat-bat-mushroom` · `wolf-slime` · `goblin-goblin`
- Tier 3: `golem` · `captain-goblins` · `necromancer-skeletons` · `shield-goblin-healer`
- Tier 4: `dragon` · `demon-king` · `giant-golem` · `vampire-lord`

## Items

One item, the **Potion / ポーション**: 1 AP, heals 35% of max HP (capped), ends
the turn. Start with 2, +1 per victory, cap 2. Shown disabled with its reason
at 0 potions, full HP or too little AP.

## Campaign (`src/campaign.js`, pure)

```js
createCampaign(heroId) → { heroId, stage: 1, stageResults: [], active, heroHp, level: 1, xp: 0, potions: 2, retries: 0 }
recordStage(campaign, round, encounterId) → campaign   // appends { mode, correct, total, bestStreak, missedIds[], startingAp, perfect, encounterId }
battleSetup(campaign) → { heroId, encounterId, level, heroHp, potions, ap }   // the createBattle input
battleAp(campaign) = min(10, startingAp + retryAssist(retries))
retryAssist(retries) → 0, 1, 3, 6, 10 …   // after 0, 1, 2, 3, 4 consecutive defeats
recordDefeat(campaign) → { …campaign, retries + 1 }
applyVictory(campaign, battleState) → { campaign, rewards }   // XP, level ups, HP carry-over, potion restock
levelUpReward(heroId, level) · xpProgress(xp) · campaignMaxHp(campaign)
campaignSummary(campaign) → { totalCorrect, totalQuestions, bestStreak, missedIds, level }
```

- **HP carries over.** After a victory: max HP gained by levelling arrives
  filled, then +28% of max HP, at least 40% of max, never above max.
- **XP** from defeated non-summoned enemies, +5 for a perfect quiz. Levels at
  8 / 30 / 70 / 140 XP (L2–L5); thresholds sit at the minimum XP any encounter
  path gives, so every hero reaches L2 / L3 / L4 / L5 after battles 1 / 2 / 3 / 4.
  Max HP +3 / +6 / +10 / +14.
- **Retry** restarts the same encounter from the battle's entry HP and potions
  with the growing AP assist; the quiz is never redone. Practising mistakes never
  changes the campaign.

## Battle engine contract (`src/battle-engine.js`, pure, no DOM)

```js
createBattle({ heroId, encounterId, ap, level, skillTier?, heroHp?, potions, rng }) → state
state = {
  heroId, encounterId, level, skillTier, ap, potions, turn: 'player'|'enemy'|'won'|'lost', round,
  hero: { hp, maxHp, defense: null|'guard'|'barrier'|'dodge', combo, counter, openingUid, exhausted },
  enemies: [{ uid, id, hp, maxHp, phase, intent, cadence, guarding, tired, charging, summoned }],
  selectedUid, nextUid,
}
availableSkills(state) · availableItems(state) · mustRecover(state)
useSkill(state, skillId, targetUid?) · useItem(state, 'potion') · recover(state)   → { state, events }
resolveEnemyPhase(state, rng) → { state, events }
selectTarget(state, uid) · cycleTarget(state, ±1) → state   // living enemies only
getEnemyIntent(state, uid) · isVictory · isDefeat · battleXp(state)
chooseEncounter(tier, rng) · levelData · levelForXp · heroMaxHp · skillTierForLevel · heroPassive
```

- Functions never mutate their input; state is plain JSON-able data.
- An invalid action (wrong turn; unknown, locked or unaffordable skill; blocked
  item; `recover` while something is affordable) returns the same state and
  `[{ type: 'rejected', reason }]`.
- A target skill aimed at a dead or missing uid falls back to the first living
  enemy; selection moves on when the selected enemy dies.
- `events` is an ordered list the UI animates; the state is already final —
  animation never drives logic.

## Battle UI (`src/battle-ui.js`, `src/battle-art.js`, `src/fx-player.js`)

- Side view: hero left; enemies right, each with a name plate, HP bar and shown
  intent. AP meter and `TURN n` on top; a message line with at most one hint;
  hero panel (LV, HP, statuses); skill buttons 1–4 with AP cost pips and
  `Need n AP` when unaffordable; 5 = ITEM opens the potion menu (1 uses it,
  5 / Backspace / Escape go back).
- **Targeting without a mode:** one living enemy is always selected (▼ marker,
  gold plate). Click/tap selects; ←/→ cycles. Single-target skills hit it at once.
- **Hints** (`battleHint`, one per turn): a shown big attack → the defence
  button pulses with `まもろう！`; HP ≤ 35% with a usable potion → ITEM
  highlighted; an enemy powering up while AP ≥ 1 → `AP を 1 のこそう！`;
  then a set-up bonus waiting to be cashed in: `COMBO！ パワースラッシュで +4！`,
  `OPENING！ にれんだで +6！` (that button highlighted) or `COUNTER！ つぎの
  こうげき +4！`. Adventure battle 1 adds onboarding (`こうげきしてみよう！`,
  then `まもろう！` the first time HP drops below half).
- **Bonus badges**: a skill button shows a gold `+N` while it would deal extra
  damage from COMBO, OPENING or COUNTER (`skillBonus` in the engine, the same
  rules `useSkill` applies). COMBO and OPENING stay hidden — no badge, floater
  or message — until Power Slash / Double Strike is unlocked.
- Player action → its events play → the enemy phase resolves and plays → a
  forced recovery turn plays by itself. During playback the view shows a
  pre-turn snapshot so HP bars drop hit by hit. Input is ignored while events
  play; click / Enter / Space fast-forwards the cosmetic playback only.
- **Art**: original pixel art rasterized at runtime into one PNG sheet per
  character (one row per `SPRITE_STATES` entry). The field uses a whole-pixel
  scale `--px`: the largest of 4 / 3 / 2 at which every sprite, plate and intent
  fits, or 1 on a window so short that 2 would clip a boss. Bosses have a
  separate enraged sheet. Sheets are built ahead of time in idle callbacks
  (`prewarmArt`): the hero trio after the main menu paints, and the upcoming
  encounter (enemies, summons, enraged variants) during the stage quiz. Dead
  enemies disappear completely.
- **Effects** (`fx-player.js`) are tiered: basic quick, specials bigger,
  Fireball / Shadow Strike / boss signatures ~1 s; hero dash, lighting shifts,
  shake, zoom punch. `prefers-reduced-motion` keeps static hit flashes only.
- Fits 1366×768, 1366×635 (a Chromebook browser window) and 1024×600 without
  scrolling; phones stack the field.
- The UI object exposes `destroy()`, which clears every timer and listener.

## Victory, defeat and campaign results

- **Victory**: `VICTORY!` + hero pose; `+N XP` (and `PERFECT +5`); an XP bar
  that fills through each level up with `LEVEL UP!`, `MAX HP +n`,
  `NEW SKILL! …` (with the skill's one-line kana `tip` from `SKILLS`) and
  `POWER UP! <passive>`; then `HP a → b / max (+healed)` and
  the potion restock; `NEXT STAGE` (focused). Any key or click finishes the
  sequence at once. After battle 4: `VERB MASTER!` and `CAMPAIGN RESULTS`.
- **Defeat**: `DEFEATED... もういちど！`, `RETRY: 5 AP + 3 HELP = 8 AP`, the
  restored HP and potions, a Guard / Barrier / Dodge tip from the second defeat
  on, `RETRY BATTLE (n AP)` and `MAIN MENU`.
- **Campaign results**: `VICTORY! VERB MASTER!` · hero with LV · `34 / 40` ·
  best streak · four stage scores · `Review: n words` and the missed verbs
  (en — ja; a long list scrolls inside the card) or `PERFECT!`. Buttons in two
  columns: `Practice mistakes` (pick mode 1–4, then a Study practice round of
  the missed items), `Play Again`, `Choose Hero`, `Main Menu`.

## Music and sound (`src/audio.js`)

Original chiptune tracks synthesized with Web Audio (no files, nothing remote):
title, field, battle, boss, victory, defeat, finale, plus SFX, through a
SNES-style echo. Music ducks under TTS and is silenced while the mic listens;
Study mode has no music. `♫ MUSIC ON/OFF` is saved in localStorage
(`esl-verbs-music`). Without Web Audio everything is a silent no-op.

## Exits

Adventure (quiz, stage clear, battle): a visible `← Menu` button and `Escape`
open a confirm `Quit adventure? / やめる？` [Quit] [Keep playing]; in battle,
Escape is ignored while events play and closes the item menu first. Quitting
cancels recognition and TTS, destroys the battle UI and clears campaign state.
Study keeps its existing Escape → level select.

## Debug and tools

- `?debug=battle`: hero, encounter (all 15 by tier), starting AP with
  0 / 5 / 6 / 7 / 8 / 10 presets, level, skill-tier override, hero HP (blank =
  full), potions, `START BATTLE`. On battle end: `Retry`, `Random encounter
  (same tier)`, `Back to debug`. Same `createBattle` and battle UI — no separate
  combat path.
- `?debug=art`: every character in any state and variant, the stage backdrops,
  and previews of each victory screen (level up / new skill / passive / final),
  defeat, and campaign results with 18 missed words.
- `npm run art:png -- <outDir> [scale] [ids...]` writes sheets as PNGs without
  a browser; `npm run balance -- [seeds] [thresholds|detail]` prints win-rate
  tables.

## Balance acceptance (automated, `test/balance.test.js`)

Simulated policies (button-mashing, hint-following, smart) over many seeds; the
tests assert trends, never exact percentages:
- stages 1–2 teach: any hero wins every early encounter from 3 AP with sensible play;
- stages 3–4: more starting AP gives a clear, steady advantage — 5 AP is very
  hard, 7 AP competitive, 8+ AP strongly favourable (hint-following currently
  wins ≈ 27 / 57 / 75 / 90 / 100 % at 5 / 6 / 7 / 8 / 10 AP);
- tactical play beats button-mashing and is never worse than following the hints;
- every hero wins every encounter at 10 AP by following the hints;
- full campaigns with HP carry-over: 10 AP clears first try, 5 AP struggles,
  retries always finish.

`test/audio.test.js` checks that every track parses, every written bar line
falls on a whole bar, and looping tracks loop on whole bars.

## Not in this version

Equipment, inventory beyond the Potion, loot, progression that persists between
campaigns, stats screens, elemental types, random damage or miss chance, online
anything.
