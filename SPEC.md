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
adds heroes, battles and in-campaign skill unlocks around the quiz; it never
changes answer checking, scoring or round logic.

---

# Adventure mode (RPG campaign) — added 2026-09-27

A lightweight 2D turn-based RPG wrapped around the unchanged quiz. Quiz and
battle are **separate phases**: 10 quiz questions earn Power, then one short
battle. Never a combat turn per question.

## Flow

```
Main Menu ─┬─ ADVENTURE / ぼうけん → Choose Hero → [Stage n quiz (mode n) → Stage Complete → Battle n] ×4 → Campaign Results
           └─ STUDY / れんしゅう → existing level select (unchanged behaviour, existing end screen)
```

- Stage n uses quiz mode n (1→4), 10 unique questions, same engine, same
  `answer()`, same speech/TTS/mic-free behaviour. The マイクなし toggle stays on
  the main menu and in speech-mode questions.
- Battle tier = stage (1 tutorial, 2 group, 3 advanced, 4 boss).
- Skill tier for battle n: `[0, 1, 2, 2][n-1]` (`skillTierForStage`).
- Adventure never shows the Study end screen between stages.
- `?debug=battle` opens the debug battle launcher instead of the main menu.

## Quiz → Power

- `battlePowerFor(correctCount) = BALANCE.basePower (2) + correctCount`.
  There is no separate Power counter: the quiz meter displays
  `battlePowerFor(round.correctCount)`, so wrong answers, Show answer, replay,
  "Try again" and STT errors cannot change Power by construction.
- During Adventure quizzes a Power meter (`⚡ POWER 7`) is visible under the HUD;
  a correct answer shows `Correct! / せいかい！  ⚡ +1 POWER` and the meter pulses
  briefly. No combat visuals during questions.
- Stage Complete screen: `STAGE 2 COMPLETE` · `8 / 10` · `⚡ Battle Power: 10` ·
  `[BATTLE!]` (focused).

## Heroes (all numbers live in `src/battle-data.js`)

Hero cards show art, name (EN / JA), a one-line kana summary and an English
phrase — no stat sheets. Every hero has a free basic attack and a free defence
from the start; specials unlock at skill tier 1 (cost 2) and 2 (cost 3).

| Hero | HP | Basic (0) | Defence (0) | Tier 1 (2 Power) | Tier 2 (3 Power) |
|---|---|---|---|---|---|
| Fighter / せんし — つよくて じょうぶ | 32 | Slash: 4 to target | Guard: next enemy phase damage ×0.4 | Power Slash: 10 to target | Cleave: 6 to all |
| Mage / まほうつかい — まほうと かいふく | 25 | Magic Bolt: 4 to target | Barrier: next enemy phase damage ×0.5 | Heal: +12 HP (cap max) | Fireball: 7 to all |
| Ninja / にんじゃ — はやくて よける | 27 | Strike: 4 to target | Dodge: first hit of next enemy phase does 0, the rest ×0.5 | Double Strike: 4 + 4 to target | Shadow Strike: 10 to target + 4 to lowest-HP other enemy |

Starting values; tune in `BALANCE` / `HEROES` only. Reduced damage is
`Math.ceil(base × multiplier)`; a dodged hit is 0. Defence lasts exactly one
enemy phase. Heal on a full-HP hero is allowed but restores 0 (it is not
blocked, never exceeds max).

## Enemies — one pattern mechanism

Every enemy (bosses included) is data: `{ id, name, jaName, maxHp, attack,
pattern: [...actions], heavy?, heavyName?, heal?, summonId?, boss? }`. Each
enemy phase, every living enemy performs `pattern[step % pattern.length]`
then `step++`. Actions:

- `attack` — `attack` damage to hero.
- `guard` — enemy is 🛡 Guarding until its next action: incoming damage ×0.5.
- `charge` — shows `⚠️ <heavyName> NEXT TURN!` / `Charging!`; must be followed
  by `heavy` in the pattern.
- `heavy` — `heavy` damage to hero.
- `rest` — "Tired!": takes ×1.5 damage until its next action.
- `healAlly` — heals the most-damaged living *other* enemy by `heal` (green
  `+HP`); if no ally is damaged, it attacks instead.
- `summon` — adds one `summonId` enemy if the encounter has < 4 living enemies
  and this enemy's summon is not alive; otherwise attacks.
- `drain` — attack; the enemy heals by the damage dealt (cap max).

Defeated enemies never act and are never targeted. Enemy behaviour is fully
deterministic; randomness is only in encounter selection (injected `rng`).

Roster (tune values): slime, bat, mushroom (tier-1 easy); goblin, wolf
(high attack), skeleton; shieldGoblin `[attack, guard]`; healer (shaman)
`[healAlly]`; golem `[attack, charge, heavy, rest]`; goblinCaptain
`[attack, charge, heavy]`; necromancer `[summon, healAlly, attack]` summoning
skeleton. Bosses: dragon `[attack, attack, charge, heavy(Fire Breath), rest]`,
demonKing `[attack, summon(bat), guard, charge, heavy(Dark Blast)]`,
giantGolem `[attack, charge, heavy(Earthquake), rest]` (most HP),
vampireLord `[drain, attack, charge, heavy(Blood Moon)]`.

## Encounters (`ENCOUNTERS`, `chooseEncounter(tier, rng)`)

- Tier 1: `slime` · `bat` · `mushroom`
- Tier 2: `goblin-slime` · `bat-bat-mushroom` · `wolf-slime` · `goblin-goblin`
- Tier 3: `golem` · `captain-goblins` · `necromancer-skeletons` · `shield-goblin-healer`
- Tier 4: `dragon` · `demon-king` · `giant-golem` · `vampire-lord`

## Battle engine contract (`src/battle-engine.js`, pure, no DOM)

```js
createBattle({ heroId, encounterId, power, skillTier, heroHp }) → state
state = {
  heroId, encounterId, skillTier, power, turn: 'player'|'won'|'lost', round,
  hero: { hp, maxHp, defense: null|'guard'|'barrier'|'dodge' },
  enemies: [{ uid, id, hp, maxHp, step, guarding, tired, charging }],
  selectedUid, nextUid,
}
availableSkills(state) → [{ id, name, jaName, cost, kind, target: 'one'|'all'|'self', affordable }]
useSkill(state, skillId, targetUid = state.selectedUid) → { state, events }
resolveEnemyPhase(state) → { state, events }
selectTarget(state, uid) / cycleTarget(state, +1|-1) → state   // living enemies only
isVictory(state) / isDefeat(state)
chooseEncounter(tier, rng = Math.random) → encounter
skillTierForStage(stage) → 0|1|2
```

- Functions never mutate their input; state is plain JSON-able data.
- `useSkill` on an unknown, locked or unaffordable skill, or when `turn !==
  'player'`, returns the same state and `[{ type: 'rejected', reason }]`.
  Power can never go negative.
- A target skill aimed at a dead/missing uid falls back to the first living
  enemy. When the selected enemy dies, selection moves to the next living one.
- `events` is an ordered list the UI animates (`attack`, `damage`, `heal`,
  `defend`, `guard`, `charge`, `rest`, `summon`, `defeat`, `victory`,
  `lost`); the state is already final — animation never drives logic.
- One shared engine for all heroes; hero differences are skill data.

## Campaign (`src/campaign.js`, pure)

```js
createCampaign(heroId) → { heroId, stage: 1, stageResults: [], active: true }
recordStage(campaign, round, encounterId) → campaign   // appends {mode, correct, total, bestStreak, missedIds[], battlePower, encounterId}
retryPower(stageResult) = battlePower + BALANCE.retryBonusPower (2)
campaignSummary(campaign) → { totalCorrect, totalQuestions, bestStreak (max of stages), missedIds (union) }
```

Retry after defeat restarts the same encounter with full HP and
`retryPower`; the quiz is never redone. Practising mistakes never changes the
campaign result.

## Battle UI (`src/battle-ui.js`, `src/battle-art.js`)

- Side view: hero left, enemies right, HP bars, `⚡ POWER n`, skill buttons
  (≥56px, show cost as ⚡ icons, unaffordable = disabled with reason), turn
  message line, `← Menu` button. Fits 1366×768 without scrolling; wraps at
  narrow widths.
- **Targeting without a mode:** one living enemy is always selected (thick
  outline + ▼ marker). Enemies are buttons: click/tap selects; ←/→ cycles.
  Single-target skills hit the selected enemy immediately; area/self skills
  ignore it. Keys 1–4 trigger skills.
- Enemy status is always visible on the enemy: 🛡 Guarding, ⚠️ Charging!
  (with `heavyName NEXT TURN!` banner), 💤 Tired!, green `+HP` on heal.
- Player action → animate its events → if not over, enemy phase resolves
  automatically and its events animate one after another (~350–450 ms each).
  Input is ignored while events play; click/Enter/Space fast-forwards the
  cosmetic playback only. `prefers-reduced-motion` shortens it to near zero.
- Art: `battle-art.js` exports one placeholder inline SVG per hero/enemy id.
  Sprites carry `data-state` ∈ idle · attack · special · guard · cast · dodge
  · hit · charge · defeat · victory; states are CSS classes/keyframes only.
  Replacing art means replacing this module (or pointing it at files).
- Onboarding (Adventure battle 1 only): first turn highlights the basic
  attack with `こうげきしてみよう！`; the first time an enemy charges or hero HP
  drops below half, the defence button is highlighted with `まもろう！`.
- Victory: enemy defeat + hero victory pose, `VICTORY!`, then if a skill tier
  unlocked `NEW SKILL!` + skill name/cost, then `NEXT STAGE` (focused).
  Defeat: `DEFEATED... もういちど！` with `RETRY BATTLE` (retry power shown)
  and `MAIN MENU`.
- The UI object exposes `destroy()`, which clears every timer/listener.

## Campaign results

`VICTORY! VERB MASTER!` · hero · `34 / 40` · best streak · four stage scores
· missed verbs (en — ja) or `PERFECT!`. Buttons: `Practice mistakes` (pick
mode 1–4, then a Study practice round of the missed items; result screen is
the Study end screen), `Play Again` (same hero, fresh campaign), `Choose
Hero`, `Main Menu`.

## Exits

Adventure (quiz, stage complete, battle): a visible `← Menu` button and
`Escape` open a confirm `Quit adventure? / やめる？` [Quit] [Keep playing]; in
battle, Escape is ignored while events play. Quitting cancels recognition
and TTS, destroys the battle UI and clears campaign state. Study keeps its
existing Escape → level select.

## Debug battle launcher (`?debug=battle`)

Hero select, encounter select (all 15, grouped by tier), Power number input
(0–99), skill tier 0/1/2, hero HP (blank = full), `START BATTLE`. On
battle end: `Retry`, `Random encounter (same tier)`, `Back to debug`. Uses
`createBattle` and the same battle UI — no separate combat path.

## Balance acceptance (automated)

A scripted policy (defend when any enemy is charging; Mage heals below 50% HP
when affordable; otherwise best affordable damage skill, else basic attack, on
the lowest-HP enemy) must, for every hero × every encounter at its campaign
skill tier:
- win at Power 2;
- at Power 7, finish within the player-turn range for its tier
  (1: 2–4 · 2: 3–6 · 3: 4–7 · 4: 5–9);
- at Power 12, take no more turns than at Power 2, and strictly fewer for tiers 3–4.

## Not in this version

Equipment, inventory, loot, XP/levels, persistent progression, stats
screens, elemental types, random damage/miss chance, battle audio, online
anything. Placeholder art is intentionally temporary.
