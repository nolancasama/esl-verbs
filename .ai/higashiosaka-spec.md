# Higashiosaka — "Protect" — frozen spec (2026-10-22)

Controller-approved design for the fourth city. Implementers follow it exactly;
numbers marked **tune** are starting points for `npm run balance`. Read
`DESIGN_DECISIONS.md` (especially the Yao balance correction) and
`CURRENT_STATE.md` first.

Hard limits (unchanged): static ES modules, no build step, no framework, no new
runtime dependency, Chromebook first (1024×600 with no page scroll on quiz,
Stage Clear, station map and battle), touch + keyboard, CSS/light-DOM effects.
Never add: gold, shops, equipment, inventory, skill trees, free roaming, grid
movement, timed reflex attacks, multiplayer, party management.

---------------------------------------------------------------------------
## 1. Identity

**Protect: DEFEND THE ACTION CORE.** Higashiosaka is the "town of makers"
(ものづくりの まち); the Horde brings machines. For the first time the student
has something besides themselves to keep alive: the **Action Core**, the
glowing source of their Action Energy, stands on the battlefield with its own
HP. Enemies show whether they are going for the hero or the Core.

Learning goal: **"Watch what the enemy is aiming at. Protect what matters."**
It builds on Yao (choose the dangerous target) by adding a second thing to
defend, and on Matsubara (Guard against a big attack) by making defence cover
the Core.

One new system only: the Core. Everything else reuses Yao/Sakai machinery
(intents, charge/heavy, protector, waves, retry assist, station maps).

---------------------------------------------------------------------------
## 2. The Action Core (engine contract)

Data: an encounter may declare `core: { hp: 30 }` (**tune**). Only
Higashiosaka and Osaka City encounters do; every other battle is unchanged
(`state.core === null`).

State: `state.core = { hp, maxHp }` created by `createBattle`; it persists
across waves of the same battle, resets to full at every new battle and every
retry attempt. It is not carried between stages or saved in checkpoints.

Aim: whenever an intent is chosen for an enemy, the engine also stores
`enemy.aim = 'hero' | 'core'` (always `'hero'` when there is no Core). Rules,
from enemy data:
- `aim: 'core'` → every damaging intent aims at the Core (Saboteur).
- `heavyAim: 'core'` → `charge` and `heavy` aim at the Core, normal attacks at
  the hero (Sniper, Iron Foreman, Siege Golem).
- default → the hero.
The aim is part of the telegraph: it is chosen with the intent and never
changes before the enemy acts.

Resolution (`resolveEnemyPhase`): an attack/heavy aimed at the Core subtracts
`defendedDamage(amount, action)` from `core.hp` — **the hero's defence stance
covers the Core too** (Guard / Barrier reduce, Dodge follows its normal rules
across all hits of the phase). Event `{ type: 'damage', target: 'core',
source, amount }`. The ally's protect rule does not apply to the Core.
A heavy aimed at the Core and met by Guard/Barrier refunds AP exactly like a
heavy on the hero (the existing once-per-phase `defense` refund).

Losing: when `core.hp` reaches 0 the battle is lost
(`{ type: 'lost', reason: 'core' }`, message `アクション・コアが こわれた！
THE CORE IS BROKEN!`). Hero death still loses as before. Retry assist applies
unchanged (AP lift, city retry HP); the Core is full on every attempt.

**Core charge (the city's AP lever — see Yao's lesson).** A solo hero starves
on AP; the Core is the answer and the reason to protect it: at the start of
every 3rd player turn (`coreChargeEvery: 3`, **tune**), if `core.hp` is above
half (`coreChargeAbove: 0.5`), the hero gains +1 AP (`gainAp(..., 'core')`,
message `アクション・コア チャージ！ +1 AP`, the Core glows). A damaged Core
stops paying out — protecting it pays.

Helpers (pure, exported for tests and the UI): `coreThreats(state)` → enemies
whose current intent aims at the Core; `coreChargeDue(state)`.

Protector generalisation: the Yao protector rule becomes data-driven —
`protects: 'callers'` (Armored Orc, unchanged behaviour) or
`protects: 'coreAttackers'` (Guardian Construct: the first living enemy with
`aim: 'core'` or `heavyAim: 'core'`, else a boss). One protected enemy per
living protector, same halving, same badges.

Repair: `ai.support: 'repair'` chooses `repair` when a living `machine: true`
enemy (other than itself) is damaged; resolving heals it by `data.repair`
(**tune**, ~5), event `{ type: 'repair', source, target, amount }`. Telegraphed
like `heal` (`🔧 REPAIR / なおす`). Ninja Strike's OPENING list gains `repair`.

---------------------------------------------------------------------------
## 3. New enemies (art is controller-owned; ids are frozen)

About half of every wave is familiar (goblin, wolf, bat, slime, shieldGoblin,
hornGoblin, bombSlime, shadowArcher).

| id | name / jaName | HP | atk | role (tune numbers) |
|---|---|---|---|---|
| saboteur | Saboteur / こわしや | 8 | 3 | `aim: 'core'`: every attack hits the Core. Low HP: the obvious first kill. |
| engineerGoblin | Engineer Goblin / ゴブリンぎし | 12 | 2 | `support: 'repair'`, repair 5: fixes a damaged machine. |
| goblinSniper | Goblin Sniper / ゴブリンそげきへい | 10 | 2 | `heavyEvery: 3`, `heavyAim: 'core'`, heavy 12 "Core Shot", chargeLabel `AIMING AT CORE! / コアを ねらっている！`. |
| guardianConstruct | Guardian Construct / まもりの からくり | 20 | 2 | `machine: true`, `protector: true`, `protects: 'coreAttackers'`. |
| ironForeman | Iron Foreman / てつの おやかた | 26 | 3 | miniboss (large): `support: 'repair'` (repair 6), `heavyEvery: 3`, `heavyAim: 'core'`, heavy 12 "Wrecking Swing", rests. |
| siegeGolem | Siege Golem / こうじょう ゴーレム | 44 | 4 | boss, `machine: true`: `heavyEvery: 3`, `heavyAim: 'core'`, heavy 16 "Siege Blast", rests; phase 2 at 0.5 (`💢 SIEGE GOLEM IS ANGRY!`): `heavyEvery: 2`, rests false. Repairable by Engineers. |

Existing rules that now matter: Fighter's Power Slash on a `heavy` intent
BREAKs it (the Siege Blast can be stopped); Mage's Magic Bolt on a charging
enemy refunds AP; Ninja Strike opens a charging enemy.

---------------------------------------------------------------------------
## 4. Encounters (start here, tune)

Two waves each, small line-ups (Yao's lesson: a solo hero cannot carry
Sakai-sized waves). `core: { hp: 30 }` on all four. No ally.

- **hig-1 "Core Under Attack / コアが ねらわれた"** (battle): waves
  `[saboteur, goblin]`, `[saboteur, wolf, slime]`, reserve 3. Teaches: the
  red → コア intent; kill the Saboteur; Guard covers the Core.
- **hig-2 "Repair Crew / しゅうりはん"** (battle): `[engineerGoblin,
  guardianConstruct, bat]`, `[goblinSniper, saboteur]`.
- **hig-3 "Iron Foreman / てつの おやかた"** (battle): `[hornGoblin, saboteur]`,
  `[guardianConstruct, ironForeman]`.
- **hig-4 "Siege Golem / こうじょう ゴーレム"** (boss): `[goblinSniper,
  engineerGoblin, saboteur]`, `[engineerGoblin, siegeGolem]`.

Call budgets as in Yao (default 3) where a caller appears.

---------------------------------------------------------------------------
## 5. UI (src/battle-ui.js, CSS)

- **The Core on the field:** a pixel Action Core on a pedestal behind the hero
  (left side), with a compact plate `アクション・コア` + HP bar, readable at
  1024×600 next to the hero; states idle (slow glow), hit (flash + shake),
  charge (bright pulse + `+1 AP` floater), broken (dark, cracked). When an ally
  is also present (Osaka City), the ally stands in front-left of the Core;
  nothing overlaps at 1024×600.
- **Aim in the intent:** an intent aimed at the Core gets a cyan `→ コア` tag
  and a small Core icon after its label (e.g. `⚔ 3 ATTACK → コア`,
  `⚡ AIMING AT CORE!`, `💥 16 SIEGE BLAST → コア`). Hero-aimed intents are
  unchanged.
- **Hints** (`battleHint`, after the existing heavy/boom/low-HP checks):
  a heavy aimed at the Core → `🛡 コアが ねらわれている！ まもろう！ GUARD THE CORE!`
  (highlights defence); a living Saboteur → `コアを こわす てきを さきに
  たおそう！`; Core below 35% → `コアが ピンチ！ まもろう！`.
- Messages/floaters: core damage floater on the Core; `repair` → `🔧 なおした！`;
  lost by Core → the defeat screen says `アクション・コアが こわれた… / The Core broke…`
  instead of the HP line.
- Sprite hooks: `enemyRestState` unchanged except `repair` intent shows `cast`;
  `eventSpriteStates`: `repair` → `[[source, 'cast']]`.

---------------------------------------------------------------------------
## 6. Region, story, stations

Region: `CITIES.yao.unlocks = ['higashiosaka']`; `higashiosaka.campaignId =
'higashiosaka'` (requires yao); `CITY_CAMPAIGNS.higashiosaka` stages modes 1–4
→ hig-1..4. Old saves keep parsing.

Story (`CITY_STORIES.higashiosaka`, same shape as Yao):
- intro: `ひがしおおさかが あぶない！` / en `HIGASHIOSAKA IS IN DANGER!`
  (danger, ominous, alarm) → `ものづくりの まちに きかいの てきが きた！` →
  `{hero}` `アクション・コアが ねらわれている！ まもりぬけ！`
- ending: title `ひがしおおさかを まもった！` / `HIGASHIOSAKA IS SAFE!` →
  `コアの ひかりが まちを てらす。` → `さいごは おおさか市だ！`
  (en `ON TO OSAKA CITY!`).

Stations (controller adds them to `src/battle-locations.js`; coordinates
checked 2026-10-22 on Wikipedia / OpenStreetMap). The Horde pushes west from
the Ikoma hills toward Osaka City:

| stage | station | line | neighbours | landmarks |
|---|---|---|---|---|
| 1 | 石切 Ishikiri 34.68523, 135.65544 | Kintetsu Nara | 額田 Nukata 34.67539, 135.65108 (S); 生駒 Ikoma (E, Nara Pref., edge) | 石切劔箭神社 Ishikiri Tsurugiya Shrine 34.68199, 135.64617; 新石切 Shin-Ishikiri (Keihanna) 34.68015, 135.64087; Ikoma hills to the east |
| 2 | 東花園 Higashi-Hanazono 34.66252, 135.62646 | Kintetsu Nara | 河内花園 Kawachi-Hanazono 34.66284, 135.61799 (W); 瓢箪山 Hyōtan-yama 34.66211, 135.63975 (E) | 花園ラグビー場 Hanazono Rugby Stadium 34.66930, 135.62657 (N) |
| 3 | 荒本 Aramoto 34.67861, 135.60490 | Kintetsu Keihanna | 長田 Nagata 34.67844, 135.59302 (W); 吉田 Yoshita ≈34.6797, 135.6232 (E — station point to be re-checked; OSM gave the station bus stop) | 東大阪市役所 Higashiosaka City Hall 34.67942, 135.60064 |
| 4 | 布施 Fuse 34.66412, 135.56321 | Kintetsu Nara / Osaka (junction) | 今里 Imazato 34.66468, 135.54966 (W); 河内永和 Kawachi-Eiwa 34.66429, 135.57321 (E, Nara Line); 俊徳道 Shuntokumichi 34.65830, 135.57184 (SE, Osaka Line) | note line only: `おおさか市への いりぐち / The gateway to Osaka City` |

Notes: Ishikiri is uphill of the shrine (the line climbs the hillside, then
tunnels east to Ikoma). Higashiosaka is known for small factories
(ものづくり) — the map may show factory roofs instead of houses as decoration,
never a named, unverified building.

---------------------------------------------------------------------------
## 7. Art (controller-owned, done before the worker slices)

Action Core prop (idle/hit/charge/broken), Saboteur (goblin with a lit
satchel), Engineer Goblin (goggles, wrench), Goblin Sniper (long rifle-bow
with a scope — not a gun, a crossbow), Guardian Construct (wooden-and-iron
clockwork guardian, からくり), Iron Foreman (large; goblin foreman in a
hammer rig), Siege Golem (boss; factory golem with a chimney and a ram arm;
enraged variant), station maps for the four stations above.

---------------------------------------------------------------------------
## 8. Balance (test/balance-sim.js, balance-report.mjs, balance.test.js)

Measure like Yao (hero arrives with real post-Yao state, 70/85/100% HP, 2
potions, retry assist with city retry HP) with two bots that differ only in
what they protect/target:
- **core-aware**: kills Saboteurs and core-aimed chargers first, Guards when a
  heavy aims at the Core, repairs nothing (heroes cannot), otherwise as the
  Yao priority bot;
- **naive**: first living target, Guards only for heavies aimed at the hero.
Report: first-try per hero/encounter at AP5–10, campaign completion and mean
retries at AP0–10, and **how defeats end (hero death vs Core broken vs turn
cap)** — measure this before tuning anything (the Yao lesson).

Targets (assert on the mean over the three heroes; single cells are noisy):
- both bots complete Higashiosaka 100% at every AP 0–10 within six attempts
  per battle;
- core-aware first-try: hig-3 ≥ 30% / 70% / 95% and hig-4 ≥ 15% / 70% / 95% at
  AP5 / 7 / 10;
- core-aware beats naive by ≥ 5 points on average at AP5–7 on hig-2..4 and is
  never below naive overall;
- mean retries for the city at AP5 ≤ 4.5 (Sakai 2.8, Yao 2.3–4.3);
- Core-broken defeats are real (≥ 20% of naive defeats) but not the only way
  to lose;
- show each new assertion failing once with a deliberately too-hard number.
Matsubara, Sakai and Yao report lines stay byte-identical.

---------------------------------------------------------------------------
## 9. Tests

Engine: no Core → identical behaviour (existing suites pass untouched); aim is
chosen with the intent and does not change before acting; core damage uses
the hero's defence (Guard/Barrier reduce, Dodge rules, AP refund on a core
heavy); Core at 0 loses with reason `core` even mid-phase; Core full on retry
and new waves keep its HP; core charge every 3rd turn only above half;
Guardian Construct protects a core attacker, then a boss; repair heals only
damaged machines and is telegraphed; Power Slash breaks a core-aimed heavy.
UI: the `→ コア` tag, the Core plate, the GUARD THE CORE hint, the Core
defeat message. Region/campaign: unlock after Yao, 4 stages, checkpoints,
retry, victory saves Higashiosaka. Browser: Stage Clear → Ishikiri map →
battle with the Core visible; a core-aimed heavy telegraphed then guarded;
the Siege Golem via `?debug=battle` (hig-4, wave 2); 1024×600 no scroll.

---------------------------------------------------------------------------
## 10. Slices

- **H0 — controller:** art (§7), station locations (re-check Yoshita), Core
  plate visual design. Commit before H1.
- **H1 — worker:** the Core system (§2) + Core UI (§5) + generic engine/UI
  tests on a test-only encounter. Freeze `state.core`, `enemy.aim`,
  `coreThreats`, `coreChargeDue`, the `protects` field and `repair` first.
- **H2 — worker:** Higashiosaka enemies data, encounters, region, story,
  bots, balance report and assertions, browser checks, docs. Runs after H1.

Docs: append dated DESIGN_DECISIONS entries for every decision taken while
implementing; revise CURRENT_STATE lines instead of appending logs.
