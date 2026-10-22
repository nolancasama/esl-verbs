# Osaka City — "Master everything" — frozen spec (2026-10-22)

Controller-approved design for the final city. **Depends on Higashiosaka**
(`.ai/higashiosaka-spec.md`): it uses the Action Core, `enemy.aim`, repair and
the generalised protector. Implementers follow this exactly; numbers marked
**tune** are starting points for `npm run balance`. Read `DESIGN_DECISIONS.md`
(Yao balance correction, Higashiosaka entries) and `CURRENT_STATE.md` first.

Hard limits (unchanged): static ES modules, no build step, no framework, no new
runtime dependency, Chromebook first (1024×600, no page scroll), touch +
keyboard, CSS/light-DOM effects. Never add: gold, shops, equipment, inventory,
skill trees, free roaming, grid movement, timed reflex attacks, multiplayer,
party management.

---------------------------------------------------------------------------
## 1. Identity

**THE INVASION.** The whole Shadow Horde attacks Osaka City, led by the
**Black Star** itself (the thing that fell into Lake Biwa in the Matsubara
lore). Nothing new to learn: every battle **combines things the student
already knows** — waves (Sakai), callers and target priority (Yao), the Core
(Higashiosaka), support enemies (Healer, Engineer), protectors, big
telegraphed attacks and boss phases (Matsubara). Difficulty comes from the
combinations, not from new rules or huge HP.

**No new engine systems.** Everything here is data: encounters, enemies,
waves, `core`, `ally.joinsAtWave`, two boss forms. If an implementer believes
a new mechanic is needed, stop and ask the controller.

---------------------------------------------------------------------------
## 2. Stages (start here, tune)

Each stage foregrounds one earlier lesson and mixes in another. Familiar
enemies dominate; the only new creatures are the Black Star's two forms and
its Shadow Guard.

- **osk-1 "The Invasion / しんりゃく"** — Tennoji (battle music). Waves
  (Sakai) + callers (Yao): `[goblin, hornGoblin, bat]`, `[shieldGoblin,
  healer]`, `[wolf, hornGoblin, bombSlime]`. No Core.
- **osk-2 "Core Raid / コアを まもれ"** — Namba (battle). Core (30) + callers +
  a protector: `[saboteur, hornGoblin, goblin]`, `[guardianConstruct,
  saboteur, shadowArcher]`.
- **osk-3 "Shadow Generals / シャドウの しょうぐん"** — Osaka/Umeda (boss
  music). A two-boss rematch with the Sakai ally: `[signalCaptain,
  armoredOrc]`, then `[hordeCommander, engineerGoblin, goblinSniper]`; the
  **Osaka Defender joins at wave 2** (`ally: { id: 'osakaDefender',
  joinsAtWave: 2 }`) — the student meets an old friend before the finale.
- **osk-4 "The Black Star / ブラックスター"** — Osaka Castle (boss music),
  Core (36, **tune**), three waves = three boss phases:
  1. **Phase 1 — the guard:** `[shadowGuard, healer, hornGoblin]` — clear the
     Black Star's escort (supports and a caller; the Shadow Guard protects the
     caller).
  2. **Phase 2 — the Black Star attacks the Core:** `[blackStarAvatar,
     engineerGoblin]` — the boss alternates calls and a big Core attack
     (`heavyAim: 'core'`); Guard the Core or break the heavy, stop the calls.
  3. **Phase 3 — the true form, with friends:** `[blackStarTrue]` alone; the
     **Osaka Defender joins at wave 3** and fights beside the hero. A direct,
     enraged fight: frequent big attacks on the hero, telegraphed as usual.
  Wave clears give the usual +2 AP (the "Action Core charge" message) and the
  Core keeps its HP across all three phases. Rationale: each phase is one
  thing the student already knows, so the finale is long but never confusing.

Call budget 3 per wave (default); Core-charge rules from Higashiosaka apply.

---------------------------------------------------------------------------
## 3. New enemies (art is controller-owned; ids are frozen)

| id | name / jaName | HP | atk | role (tune numbers) |
|---|---|---|---|---|
| shadowGuard | Shadow Guard / シャドウガード | 16 | 3 | `protector: true`, `protects: 'callers'` (the Orc rule in Horde black). |
| blackStarAvatar | Black Star / ブラックスター | 36 | 4 | boss: `support: 'call'` (callIds `['goblin']`, callEvery 3), `heavyEvery: 3`, `heavyAim: 'core'`, heavy 14 "Star Fall", rests; phase 2 at 0.5: callIds `['wolf', 'bat']`, heavyEvery 2. |
| blackStarTrue | Black Star — True Form / ブラックスター しんの すがた | 40 | 5 | boss: `heavyEvery: 2`, heavy 16 "Black Nova" (aims at the hero), rests: false; phase 2 at 0.5: `heavyEvery: 1` with `rests: true` (big hit, rest, big hit — always telegraphed), message `★ THE BLACK STAR IS FADING!`. |

Defeating `blackStarAvatar` ends wave 2; `blackStarTrue` appearing at wave 3
is the transformation (the wave banner says `しんの すがた！ TRUE FORM!`).
XP: the two forms give boss XP once each (they are separate enemies).

---------------------------------------------------------------------------
## 4. Region, ending, records

Region: `CITIES.higashiosaka.unlocks = ['osakaCity']`; `osakaCity.campaignId =
'osakaCity'` (requires higashiosaka); `CITY_CAMPAIGNS.osakaCity` stages modes
1–4 → osk-1..4. Old saves keep parsing.

Saving Osaka City completes the game:
- the city ending (below) plays with the existing `finale` track;
- the Osaka map's save animation shows **all five cities saved** with a final
  banner `おおさかを まもった！ / OSAKA IS SAFE!`;
- the hero's existing Adventure record (`src/records.js`) marks the full
  campaign complete for that hero (reuse `recordCompletion`; add only a field
  if needed — no new save key);
- the main menu then offers the existing new-adventure / continue choices;
  replaying any saved city stays possible as now.

Story (`CITY_STORIES.osakaCity`):
- intro: `おおさか市に ホードの 大ぐん！` / en `THE INVASION!` (danger,
  ominous, alarm) → `ブラックスターが あらわれた！` →
  `{hero}` `いままでの ちからを ぜんぶ つかおう！`
- ending (finale music): victory title `おおさかを まもった！` /
  `OSAKA IS SAFE!` → `{ally}` `大阪の まもりびと：「やったな！」` →
  `ブラックスターの やみは きえた。` → `まつばら、さかい、やお、
  ひがしおおさか… みんなの まちが ひかっている。` →
  `きみは おおさかの ヒーローだ！` (en `YOU ARE OSAKA'S HERO!`).
Furigana syntax `{漢字|かな}` for any kanji (大阪, 市, 大ぐん).

---------------------------------------------------------------------------
## 5. Stations

Controller adds them to `src/battle-locations.js` (coordinates checked
2026-10-22, Wikipedia / OpenStreetMap). The Horde drives from the south
through the city centre to the castle:

| stage | station | lines (schematic) | neighbours | landmarks |
|---|---|---|---|---|
| 1 | 天王寺 Tennoji 34.64732, 135.51394 | JR Osaka Loop | 寺田町 Teradacho 34.64788, 135.52337 (E); 新今宮 Shin-Imamiya 34.65017, 135.50069 (W) | あべのハルカス Abeno Harukas 34.64577, 135.51401 (S); 通天閣 Tsutenkaku 34.65254, 135.50631 (NW); Tennoji Park / Zoo between them (park polygon to be drawn from OSM before use) |
| 2 | 難波 Namba (Nankai) 34.66341, 135.50191 | Osaka Metro Midosuji (N–S) | 心斎橋 Shinsaibashi 34.67501, 135.50033 (N); 大国町 Daikokucho 34.65607, 135.49780 (S) | 道頓堀川 Dotonbori canal, E–W through 戎橋 Ebisubashi 34.66907, 135.50130 |
| 3 | 大阪 Osaka (Umeda) 34.70251, 135.49618 | JR Osaka Loop | 福島 Fukushima 34.69689, 135.48722 (SW); 天満 Tenma 34.70492, 135.51232 (E) | 梅田スカイビル Umeda Sky Building 34.70529, 135.49053 (NW); 淀川 Yodo River to the north (十三大橋 Jūsō Bridge ≈34.7141–34.7168, 135.484–135.486) |
| 4 | 大阪城公園 Osakajōkōen 34.68776, 135.53440 | JR Osaka Loop | 京橋 Kyōbashi 34.69600, 135.53470 (N); 森ノ宮 Morinomiya 34.68110, 135.53384 (S) | 大阪城 Osaka Castle keep 34.68718, 135.52540 (W) inside the castle park; 大川 Ōkawa river NW of the park (passes 天満橋 Tenmabashi ≈34.6904, 135.5164 — trace the course from OSM before drawing) |

Map notes: the castle stage shows the castle keep as the landmark the student
is defending (the Core stands there in the story). Rivers whose course was not
traced are left out rather than guessed.

---------------------------------------------------------------------------
## 6. Art (controller-owned, done before the worker slice)

Shadow Guard (Armored-Orc build in Horde black with a star shield), Black Star
(boss: a dark star-crowned figure wreathed in violet light; enraged variant),
Black Star — True Form (larger, a living black star with arms of shadow;
enraged variant), the five-cities-saved map banner, station maps for the four
stations above. Osaka skyline for intro/ending is optional (the city scenes
reuse the Matsubara art today).

---------------------------------------------------------------------------
## 7. Balance

Measure like Higashiosaka (real post-Higashiosaka state; 70/85/100% HP; two
potions; retry assist) with the **core-aware priority bot** and the **naive
first-target bot**; report how defeats end (hero death / Core / turn cap)
before tuning. osk-4 is three waves long: measure its turn count too.

Targets (hero mean):
- both bots complete Osaka City 100% at every AP 0–10 within six attempts per
  battle;
- priority first-try: osk-1..3 ≥ 30% / 70% / 95% and osk-4 ≥ 10% / 60% / 90%
  at AP5 / 7 / 10;
- priority beats naive on average at AP5–7 on osk-2 and osk-4;
- osk-4 mean length ≤ 45 player turns at AP7 (a finale, not a slog) — if it
  is longer, shrink line-ups before touching boss HP;
- mean retries for the city at AP5 ≤ 5;
- every new assertion shown failing once with a too-hard number.
Earlier cities' report lines stay byte-identical.

---------------------------------------------------------------------------
## 8. Tests

Encounters/region/story wiring; ally joins at the right waves (osk-3 wave 2,
osk-4 wave 3); the Core persists through all three osk-4 waves and resets on
retry; the transformation wave banner; Shadow Guard protects a caller; both
Black Star forms' phase changes; saving Osaka City marks all five cities
saved, plays the finale ending, records completion, and the menu still works
afterwards; checkpoint/resume at each stage. Browser: Tennoji station map →
battle; osk-4 via `?debug=battle` (start wave 2 and 3) with Core + ally both
visible and not overlapping at 1024×600; the final map with five saved cities.
The dev jump panel (Ctrl+Alt+Shift+D) lists Higashiosaka and Osaka City
automatically (it reads CITY_CAMPAIGNS) — confirm it reaches osk-4.

---------------------------------------------------------------------------
## 9. Slices

- **O0 — controller:** art (§6), station locations (trace the Tennoji park
  and Ōkawa outlines from OSM first), story text check.
- **O1 — worker:** everything in §2–§4 and §7–§8 as data and wiring (no new
  engine systems), bots/report/assertions, docs.

Docs: append dated DESIGN_DECISIONS entries; revise CURRENT_STATE lines.
