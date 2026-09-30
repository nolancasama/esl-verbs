# Osaka expansion — frozen contract (2026-09-30)

Controller-approved. Workers implement against this; do not invent other
schemas. If something here is impossible, stop and say so in the summary
rather than redesigning it.

The Matsubara campaign, its encounters (`chooseEncounter` tiers 1–4), its
balance, quiz modes, Study mode and every existing test stay as they are.

## 1. Encounter data (src/battle-data.js) — engine slice

City encounters sit in the same `ENCOUNTERS` table with extra optional fields.
A normal encounter is one wave, no ally.

```js
'sakai-2': {
  id: 'sakai-2', city: 'sakai', stage: 2,
  name: 'Horde Battle', jaName: 'ホードの なみ',
  music: 'battle',                     // 'battle' | 'boss' (app picks the track)
  enemyIds: Object.freeze([...waves[0].enemyIds]),   // kept = first wave, for old callers
  waves: Object.freeze([ Object.freeze({ enemyIds: Object.freeze([...]) }), ... ]),
  ally: null | Object.freeze({ id: 'osakaDefender', joinsAtWave: 1 | 2 | ... }),
  reserve: 6,                           // background silhouettes shown at the start (presentation only)
}
```

- `chooseEncounter(tier)` must ignore any encounter with `city` set.
- Every wave has at most `BALANCE.maxLivingEnemies` (4) enemies.
- Starting design (the engine worker tunes enemy picks and numbers so the
  balance targets in §4 hold; keep the escalation shape):
  - `sakai-1` First Assault / さいしょの こうげき — 1 wave of 4 (e.g. goblin, wolf, bat, slime). No ally. music battle.
  - `sakai-2` Horde Battle / ホードの なみ — 2 waves (e.g. [slime, goblin, bat], [goblin, wolf, goblin, bat]). No ally. music battle.
  - `sakai-3` Defenders Overwhelmed / まもりびとの ピンチ — 2–3 waves, the second a clear jump (shieldGoblin/healer/wolf class). `ally: { id: 'osakaDefender', joinsAtWave: 2 }`. music battle.
  - `sakai-4` Final Sakai Defense / さかい さいごの たたかい — 3 waves, the last led by `hordeCommander` (already in ENEMIES with art; tune its numbers, keep `boss` unset). `ally: { id: 'osakaDefender', joinsAtWave: 1 }`. music boss.

```js
export const ALLIES = Object.freeze({
  osakaDefender: Object.freeze({
    id: 'osakaDefender', name: 'Osaka Defender', jaName: '大阪の まもりびと',
    damage: 3,              // tune: ≈50–75% of a hero basic attack
    protectBelow: 0.3,      // hero HP ratio at or below which the ally protects instead of attacking
    protectMultiplier: 0.5, // damage the hero takes from enemies while protected
  }),
});
```

## 2. Battle engine (src/battle-engine.js) — engine slice

One engine. Extend `createBattle` and the existing turn functions; no forked
engine.

State additions (plain data, no functions):
- `wave` (1-based), `waveCount`
- `ally`: `null` or `{ id }` (the ally has no HP; enemies never target it)
- `clearedXp`: XP of non-summoned enemies defeated in earlier waves
- `hero.protected`: boolean, only true during an enemy phase

`createBattle({ ..., startWave = 1 })` — `startWave` is for debug; enemies
come from `waves[startWave - 1]`, `ally` is present if `joinsAtWave <= startWave`.

Wave clear: when every enemy of the current wave (summons included) is dead
and a later wave exists —
- emit `{ type: 'waveClear', wave }`, then the next wave's enemies replace
  `state.enemies` (new uids continue from `nextUid`; dead enemies never return),
- emit `{ type: 'waveStart', wave, waveCount, targets: [uids] }`,
- if the ally joins at this wave: set `state.ally` and emit `{ type: 'allyJoin', allyId }`,
- new enemies get intents; `turn` becomes `'player'`, `round + 1`; the enemies
  of the new wave do not act until after the player's next action,
- hero keeps hp, ap, potions, combo, counter; `defense`, `exhausted` and
  `openingUid` are cleared; `selectedUid` is the first new enemy.
Victory (`turn: 'won'`, `{ type: 'victory' }`) only after the final wave.

Ally turn — PLAYER → ALLY → ENEMY. At the start of `resolveEnemyPhase`, if
`state.ally`:
- hero HP ≤ `protectBelow` × maxHp → `hero.protected = true`, emit
  `{ type: 'allyProtect', allyId }`; every enemy hit on the hero this phase is
  `Math.ceil(damage × protectMultiplier)` after the hero's own defence;
- otherwise attack the weakest living enemy (lowest hp, then lowest uid):
  emit `{ type: 'allyAttack', allyId, target }`, then damage through the
  existing `damageEnemy` (so `damage` / `defeat` / `enrage` events and
  guard/tired multipliers apply as for the hero).
- If the ally's hit clears the wave, the wave-clear rule applies (enemies of the
  new wave do not act); if it clears the last wave, victory.
- The ally never changes `ap`. Deterministic: no rng in ally decisions.
- `protected` is cleared at the end of the enemy phase.

`battleXp(state)` = `clearedXp` + defeated non-summoned enemies of the current wave.

Export a helper `waveInfo(state)` → `{ wave, waveCount, reserveCount }` where
`reserveCount` is the number of enemies in waves after the current one (the UI
draws that many background silhouettes).

## 3. Regional campaign (src/region.js, src/campaign.js) — region slice

```js
export const REGION_KEY = 'esl-verbs-region-v1';
export const CITIES = Object.freeze({
  matsubara:    { id, name: 'Matsubara',     jaName: 'まつばら',       map: { x, y }, campaignId: 'matsubara', unlocks: ['sakai'] },
  sakai:        { id, name: 'Sakai',         jaName: 'さかい',         map: { x, y }, campaignId: 'sakai', requires: ['matsubara'] },
  yao:          { id, name: 'Yao',           jaName: 'やお',           map: { x, y }, campaignId: null, requires: ['sakai'] },
  higashiosaka: { id, name: 'Higashiosaka',  jaName: 'ひがしおおさか', map: { x, y }, campaignId: null, requires: ['sakai'] },
  osakaCity:    { id, name: 'Osaka City',    jaName: 'おおさか市',     map: { x, y }, campaignId: null, requires: ['sakai'] },
});
```
`map` is percent coordinates on the stylised prefecture map (controller draws
it; roughly: osakaCity 40,30 · higashiosaka 58,34 · yao 62,48 · matsubara 52,60 · sakai 34,64).
A city with `campaignId: null` is always `'locked'` (future content).

```js
export const CITY_CAMPAIGNS = Object.freeze({
  matsubara: { id: 'matsubara', cityId: 'matsubara', origin: true,
    stages: [{ mode: 1, tier: 1 }, { mode: 2, tier: 2 }, { mode: 3, tier: 3 }, { mode: 4, tier: 4 }] },
  sakai: { id: 'sakai', cityId: 'sakai',
    stages: [{ mode: 1, encounterId: 'sakai-1' }, { mode: 2, encounterId: 'sakai-2' },
             { mode: 3, encounterId: 'sakai-3' }, { mode: 4, encounterId: 'sakai-4' }] },
});
```
Each stage = 10 fresh random questions in that mode (`createRound(VOCABULARY)`),
so a city is 40 questions / 4 battles like Matsubara.

Functions (pure, tested):
- `cityStatus(region, cityId)` → `'saved' | 'danger' | 'locked'`
  (danger = has a campaign, every `requires` saved, not itself saved).
- `parseRegion(raw, heroIds)` → always a valid region; corrupt/missing → fresh:
  `{ heroId: null, level: 1, xp: 0, savedCities: [], checkpoint: null }`.
  Unknown hero ids, unknown city ids, non-arrays, NaN → dropped/defaulted.
  `savedCities` keeps CITIES order, no duplicates.
- `markCitySaved(region, cityId, campaign)` → region with the city added and
  `heroId/level/xp` from the campaign, `checkpoint: null`.
- `stageCheckpoint(region, campaign)` → region with
  `checkpoint: { cityId, stage, heroHp, potions, stageResults }` (only for
  non-origin campaigns; the origin campaign keeps the old no-resume behaviour).
- `serializeRegion(region)` → JSON string. No names or personal data.
- `stageCount(cityId)`, `stageMode(campaign)`, `stageEncounterId(campaign, rng)`
  (origin: `chooseEncounter(tier, rng).id`; others: the fixed `encounterId`).

campaign.js:
- `createCampaign(heroId, { cityId = 'matsubara', level = 1, xp = 0 } = {})`:
  adds `cityId`; HP is full at that level; potions `CAMPAIGN.startingPotions`.
  Existing callers `createCampaign(heroId)` behave exactly as today.
- `chapterRest(campaign)`: full HP at current level, potions `CAMPAIGN.maxPotions`,
  retries 0 (AP always starts from the quiz, so it resets by itself).
- `resumeCampaign(region)` → campaign rebuilt from `region.checkpoint` + hero/level/xp.
- Level stays capped at 5 (no new levels). XP keeps accumulating; the bar shows MAX.

## 4. Balance targets (engine slice)

Simulate Sakai at LV 5 (every hero reaches LV 5 by the end of Matsubara),
each hero, starting AP 5 / 6 / 7 / 8 / 10, several seeds, with the existing
smart policy (extended to waves: it attacks with the group skill when ≥2
enemies live, etc.) and the naive policy:
- 5 AP: difficult (clearly below 6–7, but not hopeless),
- 6–7 AP: viable / competitive,
- 8+ AP: strong,
- same philosophy as the existing Matsubara thresholds in test/balance.test.js.
Also a campaign-level check: all four Sakai battles in a row with HP/potions
carried through `applyVictory` from a chapter rest, at 6–7 AP per stage —
reachable without perfect quizzes; ally battles (3, 4) survivable.
Matsubara numbers and thresholds must not move.

## 5. Events the UI replays (controller owns battle-ui)

`waveClear`, `waveStart`, `allyJoin`, `allyAttack`, `allyProtect` as above,
plus the existing ones. Game logic emits events; animation never owns state.

## 6. Flow (app.js — flow slice, after engine + region merge)

- Main menu: if the region save has a saved city: primary `▶ CONTINUE ADVENTURE`
  / `大阪を まもる` (→ Osaka map), then `START NEW ADVENTURE` (confirm dialog
  if a region save exists: it is reset), then `PRACTICE ONLY`.
- Matsubara final boss falls → `markCitySaved('matsubara')` + saved.
  Ending cinematic (with the Osaka reveal, controller) → results →
  primary CTA `つづける つぎの まちへ！ / CONTINUE ADVENTURE` → map.
- Map → a `danger` city (or a saved non-origin city, as a replay) →
  `chapterRest` → city intro cinematic → quiz stage 1 … battle 4 → city ending
  cinematic → city results → map with the save animation for that city.
- Checkpoint written at the start of every non-origin stage quiz; map shows
  `つづき STAGE n` for a city with a checkpoint and resumes there.
- Defeat inside a city: retry that battle (same as today; no quiz repeat).
- Same hero continues; hero select only on START NEW ADVENTURE.
