# Targeting / Sound / AP feedback / Station maps / Yao — frozen spec (2026-10-22)

Controller-approved design for this pass. Workers implement exactly this; where a
number says "tune", tune it with `npm run balance` and the balance tests.
Read `DESIGN_DECISIONS.md` and `CURRENT_STATE.md` first. Do not rebuild what is
already on master: Stage 3 and 4 share `SEE_JA_SPEAK_EN` (src/engine.js), the
"N in a row!" badge is wrapped with the dummy and centred above it, Stage Clear is
title → hero scene + nameplate → AP meter → AP note → BATTLE!.

Hard limits: static ES modules, no build step, no framework, no new runtime
dependency, Chromebook first (1024×600 must not page-scroll on verb screen,
Stage Clear, station map, battle), touch + keyboard usable, CSS/light DOM effects
only (no canvas loops, no large-area filters, no big particle systems).
Do NOT add: gold, shops, equipment, inventory, skill trees, free-roam maps, grid
movement, timed reflex attacks, multiplayer, party management.

---------------------------------------------------------------------------
## Slice 1 — targeting clarity, sound settings, verb-success feedback

### 1A. Target selection (src/battle-ui.js, rpg.css)
Keep the existing logic: ←/→ → `cycleTarget`, click/tap `[data-select-uid]` →
`selectTarget`. Selecting never attacks.

- The whole `.battle-enemy` button stays the hit target (sprite, name, HP plate,
  cues, and the slot around them). Make sure its box covers the sprite area
  (no `pointer-events:none` holes, no zero-height wrappers); a tap anywhere on
  the enemy's visual area selects it.
- Selected enemy, coordinated cues (none of them a modern neon glow):
  1. the existing bobbing target marker, larger (icon scale 3 instead of 2) and
     clearly pointing down at the enemy;
  2. a stronger gold plate: 3px gold border + a thin inner light edge and a
     slightly warmer plate background;
  3. a gold pixel ground ring under the selected sprite's feet — a flattened
     ellipse built from stepped boxes / box-shadow pixels (no blur), gently
     pulsing with `steps()`;
  4. a restrained warm backing behind the sprite (a soft, low-alpha radial patch
     or a 1–2px gold silhouette edge via `drop-shadow` on the sprite ONLY — not
     on the whole field).
- Non-selected enemies stay fully readable (no heavy dimming; at most a very
  slight desaturation is NOT wanted — leave them as they are).
- `aria-pressed` stays; the selected button also gets an accessible label that
  ends with ", selected / えらんでいる"; a polite live region announces
  "Target: <name>" when the target changes.
- Keyboard: ←/→ still cycle; 1–4, 5/I, Escape, Enter/Space behave as before.

Target hint (only while: player turn, not playing events, ≥2 living enemies):
- Element `.battle-target-hint` inside the battle field, near the enemy group but
  not covering any sprite, plate, intent or status badge (e.g. on the floor
  strip under the enemy row, or above the row if that is the only free space at
  1024×600). Compact, dark translucent RPG panel, Japanese first.
- Two levels, given by a new createBattleView option `targetHint`:
  `'intro'` → prominent:
  `← → てきを えらぶ` / `てきを タップしても OK！` / small `CHOOSE A TARGET`;
  `'quiet'` → one line `← → / タップ`. `null` → no hint (debug battles may use
  'quiet').
- createBattleView gets `onTargetChange(state)` (called by moveTarget and by a
  chooseTarget that actually changed the target). The first time it fires during
  an `'intro'` hint the view switches its own hint to `'quiet'` immediately.
- App: a module-level session flag `targetingTaught` (NOT localStorage — shared
  Chromebooks). It resets when a new Adventure starts (startCampaign and a fresh
  city campaign start; a checkpoint resume counts as a new session too). Adventure
  battles pass `targetHint: targetingTaught ? 'quiet' : 'intro'` and set the flag
  in `onTargetChange`. Study/debug battles pass `'quiet'`.
- No modal, nothing to dismiss.

### 1B. Sound settings (src/audio.js, src/app.js, CSS)
- Defaults: music 0.12, SFX 0.12 (replace MUSIC_VOLUME 0.3 / SFX_VOLUME 0.42 as
  defaults; the buses scale by the chosen volume). Keep the relative loudness of
  individual sfx as they are.
- Storage keys: `esl-verbs-music-volume`, `esl-verbs-sfx-volume`, stored as a
  decimal string 0–1. Parsing: non-finite / missing → default; clamp to [0, 1].
- Migration (runs only when `esl-verbs-music-volume` is absent): old
  `esl-verbs-music` === 'off' → music volume 0 (write the new key); otherwise
  the default. SFX defaults to 0.12 independently. Never rerun once the new key
  exists. Leave the old key in place (harmless).
- API (export pure helpers for tests, e.g. `readVolumes(storage)`):
  `audio.musicVolume`, `audio.sfxVolume`, `audio.setMusicVolume(v)`,
  `audio.setSfxVolume(v)`. 0 = silent for that bus only. `audio.enabled` may stay
  as a read-only "music > 0" getter if other code needs it; remove setEnabled
  uses. SFX must play whenever sfxVolume > 0, even with music at 0.
- Live: changing music sets `musicBus` gain smoothly (setTargetAtTime) without
  restarting the track; if music goes 0 → >0 while a track is wanted, it starts
  playing; >0 → 0 silences (may stop the scheduler). SFX changes apply to the
  next sound. On SFX slider `change` (release), play one quiet `cursor` — never
  on every `input` event.
- Ducking keeps its ratios but multiplies the chosen music volume
  (`level = musicVolume * min(DUCK[...])`); SFX are not ducked (the existing
  "no sfx while STT listens" rule stays).
- UI: replace every `♫ MUSIC ON/OFF` toggle (main menu, hero select, quiz
  topbar, battle `topRight`) with one compact `🔊 SOUND` button
  (`data-sound-button`, `aria-haspopup="dialog"`, `aria-expanded`). It opens one
  document-level popover (appended to `body`, `position: fixed`, anchored under
  the button, kept inside the viewport) styled as an RPG panel:
  `SOUND / おと` title; rows `MUSIC おんがく [range] 12%` and
  `SFX こうかおん [range] 12%`. Native `<input type="range" min=0 max=100 step=1>`
  restyled, rows ≥ 44px tall, labels tied to inputs, value text updates live.
  Escape or a click/tap outside closes it and returns focus to the button.
  Battle re-renders must not destroy it (it lives outside the battle container),
  and while it is open the battle's document keydown handler must ignore keys
  (arrows move the slider, Escape closes the popover, never the battle menu).
  The battle click handler already ignores `[data-topbar-extra]`; the popover is
  not inside the battle container so clicks in it never act on the battle.

### 1C. Verb-success feedback (src/app.js trainingStrike, src/audio.js, src/ap-meter.js, CSS)
Reuse `TRAINING_STRIKE` timings; add sfx times there, no new scheduler.
New sfx names in `playSfx` (Web Audio, short, all through sfxBus):
- `swordSwing` (Fighter whoosh, ~0.12s band-passed noise sweep + faint metal
  ring) at ~40ms; `swordHit` (solid, metallic impact) at `impact`.
- `magicCast` (rising shimmer, ~0.18s) at 0ms; `boltTravel` (short sparkly
  whoosh) at `launch`; `magicHit` (bright magical burst, unlike `hit`) at
  `impact`.
- `ninjaSlash` (very fast, higher, thinner whoosh ~0.07s) at ~30ms; `ninjaHit`
  (quick light snap) at `impact`.
- `apGain` — short rising two/three-note chime (~0.18s, sine/triangle, not a coin,
  not a fanfare). Battle AP gains (`ap` events) use `apGain` too.
The old generic `audio.sfx('hit')` in trainingStrike is replaced by the
hero-specific impact.

Sequence after a correct Adventure answer:
correct → weapon/cast sfx → impact (existing dummy hit + effect) → a small
`+1` energy mote (gold pixel spark, fixed-position DOM node) travels from the
dummy to the AP meter's newly filled segment (~260–320ms, CSS transform
transition, ease-in) → on arrival: `apMeter.set(value)` + segment pop + `apGain`.
Total answer → AP pop ≤ ~800ms; the quiz must not wait longer than it does now
to show the next question (if the next question renders before the mote
arrives, the mote still completes against the persistent meter node, or the AP
is applied immediately — never lost or doubled). Reduced motion: no mote, AP set
at impact time, sound still plays.

AP meter (src/ap-meter.js): on a positive, animated, non-quiet gain:
- the newly filled segment(s) pop: a `.ap-meter__pop` overlay at the segment
  slot(s) — gold flash, scale ~1.25 → 1 over ~200ms with `steps()` or ease,
  then removed;
- the meter frame gives one short pulse (brightness/border, ≤200ms). No screen
  shake. Respect prefers-reduced-motion (no scale, just the colour flash).
`set(value, opts)` keeps its signature; add `segmentRect(index)` (or similar)
so app.js can aim the mote.

### Slice 1 tests
- test/audio.test.js: defaults 0.12/0.12; independent persistence; malformed
  ('abc', '-1', '7', '') handled; old 'off' → music 0 and SFX 0.12; old 'on' or
  absent → 0.12; migration does not rerun when the new key exists; ducked level
  is proportional to the chosen music volume.
- test/battle.test.js (or a new test file) where DOM-free: battleHint unchanged.
  Hint visibility rule as a pure exported helper
  `targetHintMode(state, requested)` → null when <2 living enemies or not the
  player's turn.
- Browser playthrough (test/browser/playthrough.mjs): a multi-enemy battle via
  `?debug=battle` or the Adventure: hint visible with 2+ enemies; ArrowRight moves
  `aria-pressed`; clicking another enemy's sprite area selects it and does not
  attack (AP unchanged, turn still player); a defeated enemy is skipped;
  intro hint turns quiet after a change; sound popover opens, sliders change the
  numbers, Escape closes it, battle still responds afterwards.

---------------------------------------------------------------------------
## Slice 2 — Yao campaign, reinforcements, station-map flow

### 2A. Station-map flow (src/app.js)
Controller provides (do not rewrite their art):
- `src/battle-locations.js`: `battleLocation(cityId, stage)` → location or null.
- `src/station-map.js`: `stationMapScreen(location, { heroId, stage, onDefend })`
  → an HTMLElement (the whole card, including the `DEFEND! / まもる！` button,
  which it focuses itself). Enter/Space work through the focused button.
Flow: Stage Clear `BATTLE!` → `stationMapScreen` (clear screen, mount) →
DEFEND → `startAdventureBattle()`. If `battleLocation` returns null, go straight
to the battle. A retry after defeat goes straight to the battle (no map).
No forced wait; the button is usable at once.

### 2B. Yao data (src/battle-data.js, src/region.js, src/story.js)
Region:
- `CITIES.sakai.unlocks = ['yao']`; `CITIES.yao.campaignId = 'yao'`
  (requires ['sakai']); Higashiosaka requires ['yao'], Osaka City requires
  ['higashiosaka'] (both stay `campaignId: null` → locked).
- `CITY_CAMPAIGNS.yao` with 4 stages, modes 1–4, encounters yao-1..yao-4.
- Old saves: unchanged shape; a save with Matsubara+Sakai shows Yao as danger.

New enemy ids (art is provided by the controller in src/pixel-enemies.js with
exactly these ids; do not draw art): `hornGoblin`, `bombSlime`, `shadowArcher`,
`armoredOrc`, `signalCaptain` (large), `warcaller` (boss).
Starting numbers (tune for balance; keep roles):

| id | name / jaName | HP | atk | role |
|---|---|---|---|---|
| hornGoblin | Horn Goblin / つのぶえゴブリン | 10 | 2 | caller: callIds ['goblin'], callEvery 3, firstCall 0, maxCalls 2 |
| bombSlime | Bomb Slime / ばくだんスライム | 12 | – | fuse 3, boom 12 (BOOM!) |
| shadowArcher | Shadow Archer / かげの ゆみへい | 8 | 5 | heavyEvery 2 (charge label AIMING! / ねらっている！), heavy 11 "Shadow Arrow" |
| armoredOrc | Armored Orc / よろいオーク | 26 | 4 | protector (passive), guardChance 0 |
| signalCaptain | Signal Captain / のろし たいちょう | 34 | 5 | caller: callIds ['goblin','bat'], callEvery 3, firstCall 1; heavyEvery 4 heavy 12 "Signal Strike" |
| warcaller | Warcaller / ウォーコーラー | 52 | 5 | boss: caller callIds ['hornGoblin'] → phase 2 (at 0.5) callIds ['wolf','bombSlime'], callEvery 3 → 2; heavy 14 "War Horn Blast" heavyEvery 3 → 3; message '📯 WARCALLER IS ANGRY!' |

Engine (src/battle-engine.js), data-driven through ENEMIES fields; all via the
existing intent system (intent chosen at the end of a phase, shown during the
player's turn, executed next phase — that IS the telegraph):
- `call` intent (ai.support === 'call'): chosen when the caller's `callWait`
  ≤ 0, `calls < maxCalls` (if set) and there is room
  (`living < BALANCE.maxLivingEnemies`). Enemy state gains `callWait`
  (starts at `ai.firstCall ?? 0`) and `calls` (0). Every phase in which the
  caller acts without calling decrements callWait. Resolving `call`: only if
  the caller is still alive at its turn in the enemy phase (it always is if it
  acts) — adds `min(callIds.length, room)` enemies as `summoned: true` (no XP),
  `calls += 1`, `callWait = callEvery - 1`; event `{ type: 'call', source,
  targets: [uids] }` (targets empty → "nobody came"). Reinforcements do not act
  in the phase they arrive (same rule as summons). If the caller dies during the
  player's turn the call never happens — that is the whole lesson.
  Charge/heavy cadence keeps priority over call when both are due (a caller
  that also has heavyEvery: charge → heavy → then call).
- Bomb: enemy state `fuse` (from data.fuse). Intent `fuse` while fuse > 1,
  `boom` when fuse === 1. Each enemy phase a `fuse` intent decrements fuse
  (event `{ type: 'fuse', target, fuse }`). Resolving `boom`: hero takes
  `data.boom` damage through `defendedDamage(…, 'heavy')` (Guard/Barrier reduce
  and refund AP like a heavy; Dodge avoids it), then the bomb's hp → 0 with a
  `{ type: 'explode', source }` event followed by `defeat`. A self-exploded
  bomb gives no XP (mark it so `defeatedXp` skips it, e.g. `summoned: true` or
  an `exploded` flag).
  `battleHint`: a living `boom` intent counts like `heavy` (BIG ATTACK NEXT!
  まもろう！ — but text: `💣 BOOM NEXT! たおすか まもろう！`).
- Archer: existing charge/heavy flow; optional `data.chargeLabel` /
  `chargeLabelJa` used by the UI instead of POWERING UP.
- Protector: an Armored Orc alive protects one living ally: the first living
  enemy (lowest uid) that is a caller (`ai.support === 'call'`) or `boss`, not an
  Armored Orc. Pure helper `protectedUid(state)` → uid | null (one protected
  enemy per living Orc; with two Orcs, the next candidate). Damage to a protected
  enemy × 0.5 (stacks with guard), applies to all damage sources. Event on hit:
  `{ type: 'protected', target, by }` (UI floater "🛡 ORC!" ). When the Orc dies
  protection ends immediately.
- Ninja Strike's OPENING trigger list includes `call` (it already has heal and
  summon).
- `chooseEncounter` stays Matsubara-only (city encounters have `city`).

UI (src/battle-ui.js), labels Japanese-visible, short:
- `call` intent: `📯 CALLING HELP! なかまを よぶ！`, its own tone class
  (urgent orange/red, pulsing like heavy), and the battle hint (when no heavy/
  boom/low-HP hint outranks it): `📯 よぶ まえに たおそう！ STOP THE CALL!`.
- `fuse`: `💣 N`, `boom`: `💣 BOOM! {boom}` with the heavy tone.
- protected enemy: status badge `🛡 まもられている` (and on the Orc:
  `🛡 まもっている`); a visible link is enough as the two badges + same colour.
- events: call → "なかまを よんだ！ Reinforcements!" (or "だれも こない！" when
  none came), with reinforcements entering like summons; explode → "BOOM!";
  fuse → no message needed beyond the updated countdown; protected → floater.
- Reinforcement arrival sfx: reuse `summon`/`wave`; boom: `bigHit`/`quake`.

Encounters (start here, tune):
- yao-1 "Horn Call / つのぶえの あいず" (music battle): waves
  [ ['slime','hornGoblin','goblin'], ['hornGoblin','wolf','bat'] ], reserve 3.
- yao-2 "Danger Everywhere / あぶない てきが いっぱい": waves
  [ ['bombSlime','goblin','shadowArcher'], ['hornGoblin','bombSlime','wolf'] ].
- yao-3 "Signal Captain / のろし たいちょう": waves
  [ ['hornGoblin','armoredOrc','goblin'], ['armoredOrc','signalCaptain','shadowArcher'] ].
- yao-4 "Warcaller / ウォーコーラー" (music boss): waves
  [ ['shadowArcher','hornGoblin','bombSlime'], ['armoredOrc','warcaller'] ].
No ally in Yao (Sakai owns the ally). Familiar/new ≈ 50/50.

Balance (test/balance-sim.js, test/balance-report.mjs, test/balance.test.js):
the hero arrives at Yao with Sakai's actual end state (level 5 cap, XP, all
skills). Add Yao to the report and tests the same way Sakai is measured
(competent play, HP carried, retry assist with city retry HP). The competent
bot targets by priority: boom bomb → caller with a pending call → archer
charging → lowest HP. Also measure a "naive" bot that always targets the first
living enemy: it must still be able to clear every Yao stage within the retry
assist (priority makes it easier, never mandatory). Matsubara and Sakai numbers
must stay byte-identical in the report.

Story (src/story.js) `CITY_STORIES.yao` (same shape as sakai):
- intro: `やおが あぶない！` / en `YAO IS IN DANGER!` (danger, ominous, alarm) →
  `ホードの つのぶえが きこえる…` → `{hero}` `なかまを よぶ てきを さきに たおせ！`
- ending: victory title `やおを まもった！` / `YAO IS SAFE!` →
  `つのぶえは もう きこえない。` → `つぎの 町へ いこう！` (en ON TO THE NEXT CITY!).
Furigana syntax per story.js if any kanji is used.

### 2C. Slice 2 tests
- region: Yao locked before Sakai, danger after, playable; old saves parse;
  checkpoint/resume for yao; markCitySaved('yao') → Higashiosaka still locked
  (campaignId null).
- engine: call telegraphed one turn ahead; killing the caller during the player
  turn prevents reinforcements; caller alive → reinforcements arrive (summoned,
  no XP) and do not act that phase; room cap respected; maxCalls respected;
  bomb counts 3 → 2 → 1/boom → explode damage reduced by Guard, avoided by
  Dodge, no XP; killing the bomb before boom prevents damage; protector halves
  damage to the protected caller and stops when the Orc dies; Warcaller phase 2
  switches callIds and cadence.
- campaign flow: quiz → Stage Clear → station map → battle (browser test);
  Yao 4 stages with the right encounters; retry assist; AP flow; victory saves
  Yao and the map shows it saved.
- Browser playthrough adds: Yao reinforcement encounter (a call telegraphed,
  then reinforcements), Yao final boss reachable via `?debug=battle`
  (yao-4, start wave 2).

---------------------------------------------------------------------------
## Docs (each slice)
Append dated entries to DESIGN_DECISIONS.md for real decisions made; revise
CURRENT_STATE.md lines that become stale (no append-only logs).
