// Difficulty by starting AP, measured with deterministic simulated players
// (see balance-sim.js). These assert trends, not exact percentages:
// more AP clearly helps, 5 AP is hard, 8+ AP is strongly favourable, and
// tactical play beats button mashing. `node test/balance-report.mjs` prints
// the full tables used for tuning.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HEROES } from '../src/battle-data.js';
import { heroMaxHp } from '../src/battle-engine.js';
import {
  POLICIES, STAGE_LEVEL, encountersForTier, sakaiEncounters, simulateBattle, simulateCampaign, simulateSakaiCampaign,
} from './balance-sim.js';

const heroes = Object.keys(HEROES);
const SEEDS = [5, 36, 67, 98, 129, 160];
const HP_FRACTIONS = [0.7, 0.85, 1];

function winRate(tiers, ap, policyName) {
  let wins = 0;
  let total = 0;
  for (const tier of tiers) for (const encounter of encountersForTier(tier)) for (const heroId of heroes) {
    const level = STAGE_LEVEL[tier];
    for (const fraction of HP_FRACTIONS) for (const seed of SEEDS) {
      const result = simulateBattle({ heroId, encounterId: encounter.id, ap, level, heroHp: Math.ceil(heroMaxHp(heroId, level) * fraction), potions: 2, policy: POLICIES[policyName], seed });
      wins += result.won ? 1 : 0;
      total += 1;
    }
  }
  return wins / total;
}

const LADDER = [3, 5, 6, 7, 8, 10];
const curves = {};
for (const name of Object.keys(POLICIES)) curves[name] = Object.fromEntries(LADDER.map((ap) => [ap, winRate([3, 4], ap, name)]));
const show = (name) => LADDER.map((ap) => `${ap}:${curves[name][ap].toFixed(2)}`).join(' ');

test('stages 1-2 teach: any hero wins every early encounter from 3 AP with sensible play', () => {
  for (const tier of [1, 2]) for (const encounter of encountersForTier(tier)) for (const heroId of heroes) for (const seed of SEEDS) {
    const result = simulateBattle({ heroId, encounterId: encounter.id, ap: 3, level: STAGE_LEVEL[tier], potions: 2, policy: POLICIES.competent, seed });
    assert.ok(result.won, `${heroId} ${encounter.id} seed ${seed}`);
  }
  for (const encounter of encountersForTier(1)) for (const heroId of heroes) {
    assert.ok(simulateBattle({ heroId, encounterId: encounter.id, ap: 0, level: 1, potions: 2, policy: POLICIES.competent, seed: 5 }).won, `${heroId} ${encounter.id} at 0 AP`);
  }
});

test('stages 3-4: more starting AP gives a clear, steady advantage', () => {
  for (const name of ['competent', 'smart']) {
    for (let index = 1; index < LADDER.length; index += 1) {
      assert.ok(curves[name][LADDER[index]] >= curves[name][LADDER[index - 1]] - 0.03, `${name} not monotonic: ${show(name)}`);
    }
    assert.ok(curves[name][10] - curves[name][5] >= 0.5, `${name} 10 vs 5 AP: ${show(name)}`);
  }
});

test('stages 3-4: 5 AP is very hard, 7 AP is competitive, 8+ AP is strongly favourable', () => {
  assert.ok(curves.competent[5] <= 0.4, `5 AP should be very difficult: ${show('competent')}`);
  assert.ok(curves.smart[5] > 0.1, `5 AP must stay possible with good tactics: ${show('smart')}`);
  assert.ok(curves.competent[7] >= 0.45 && curves.competent[7] <= 0.85, `7 AP should be roughly fair: ${show('competent')}`);
  assert.ok(curves.competent[8] >= 0.8, `8 AP should be likely: ${show('competent')}`);
  assert.ok(curves.competent[10] >= 0.95, `10 AP should be expected: ${show('competent')}`);
});

test('tactical play beats button mashing, and is never worse than following the hints', () => {
  assert.ok(curves.smart[5] - curves.naive[5] >= 0.15, `smart vs naive at 5: ${show('smart')} / ${show('naive')}`);
  for (const ap of [7, 8, 10]) assert.ok(curves.smart[ap] - curves.naive[ap] >= 0.4, `smart vs naive at ${ap}: ${show('smart')} / ${show('naive')}`);
  for (const ap of LADDER) assert.ok(curves.smart[ap] >= curves.competent[ap] - 0.03, `smart vs competent at ${ap}: ${show('smart')} / ${show('competent')}`);
});

test('every hero can win every encounter at 10 AP by following the hints', () => {
  for (const tier of [3, 4]) for (const encounter of encountersForTier(tier)) for (const heroId of heroes) {
    let wins = 0;
    for (const seed of SEEDS) wins += simulateBattle({ heroId, encounterId: encounter.id, ap: 10, level: STAGE_LEVEL[tier], heroHp: Math.ceil(heroMaxHp(heroId, STAGE_LEVEL[tier]) * 0.85), potions: 2, policy: POLICIES.competent, seed }).won ? 1 : 0;
    assert.ok(wins * 2 >= SEEDS.length, `${heroId} ${encounter.id}: ${wins}/${SEEDS.length}`);
  }
});

test('full campaigns with HP carry-over: 10 AP clears first try, 5 AP struggles, retries always finish', () => {
  const runs = (ap, name = 'competent') => heroes.flatMap((heroId) => SEEDS.map((seed) => simulateCampaign({ heroId, ap, policy: POLICIES[name], seed, maxRetries: 6 })));
  const firstTryFinal = (list) => list.filter((run) => run.stages[3]?.attempts === 1 && run.stages[3].won).length / list.length;
  const ten = runs(10);
  assert.ok(ten.every((run) => run.completed));
  assert.ok(ten.filter((run) => run.stages.every((stage) => stage.attempts === 1)).length / ten.length >= 0.9, 'a 10/10 student rarely needs a retry');
  assert.ok(firstTryFinal(runs(8)) >= 0.5, 'an 8/10 student usually beats the final boss first try');
  assert.ok(firstTryFinal(runs(5)) <= 0.3, 'a 5/10 student usually needs a retry for the final boss');
  for (const ap of [0, 3, 5]) assert.ok(runs(ap).every((run) => run.completed), `retry assist lets a ${ap}/10 student finish`);
});

const SAKAI_LADDER = [5, 6, 7, 8, 10];
const SAKAI_CURVE_SEEDS = SEEDS.map((seed) => seed * 8191 + 23);
const sakaiLateRate = (ap, policyName) => {
  let wins = 0;
  let total = 0;
  for (const encounter of sakaiEncounters().slice(2)) for (const heroId of heroes) {
    for (const fraction of HP_FRACTIONS) for (const seed of SAKAI_CURVE_SEEDS) {
      const result = simulateBattle({
        heroId, encounterId: encounter.id, ap, level: 5,
        heroHp: Math.ceil(heroMaxHp(heroId, 5) * fraction), potions: 2,
        policy: POLICIES[policyName], seed,
      });
      wins += result.won ? 1 : 0;
      total += 1;
    }
  }
  return wins / total;
};
const sakaiCurves = Object.fromEntries(Object.keys(POLICIES).map((name) => [
  name, Object.fromEntries(SAKAI_LADDER.map((ap) => [ap, sakaiLateRate(ap, name)])),
]));
const showSakai = (name) => SAKAI_LADDER.map((ap) => `${ap}:${sakaiCurves[name][ap].toFixed(2)}`).join(' ');

// Sakai is played at LV 5 with an ally, and the city retry assist guarantees a finish,
// so "5 AP is difficult" is measured over the whole city: a 5/10 student usually loses
// some battles on the way, a 10/10 student rarely does. The per-battle curve must still climb.
test('Sakai: more AP is a steady advantage, and 5 AP usually costs retries across the city', () => {
  const curve = sakaiCurves.competent;
  for (let index = 1; index < SAKAI_LADDER.length; index += 1) {
    assert.ok(curve[SAKAI_LADDER[index]] >= curve[SAKAI_LADDER[index - 1]] - 0.05, `Sakai curve not monotonic: ${showSakai('competent')}`);
  }
  assert.ok(curve[10] - curve[5] >= 0.2, `10 AP should beat 5 AP clearly: ${showSakai('competent')}`);
  assert.ok(curve[6] >= 0.5, `6 AP should be viable: ${showSakai('competent')}`);
  assert.ok(curve[8] >= 0.75, `8 AP should be strong: ${showSakai('competent')}`);
  assert.ok(curve[10] >= 0.9, `10 AP should be expected: ${showSakai('competent')}`);
  const seeds = Array.from({ length: 12 }, (_, index) => index * 53 + 7);
  const retries = (ap) => {
    const runs = heroes.flatMap((heroId) => seeds.map((seed) => simulateSakaiCampaign({ heroId, ap, policy: POLICIES.competent, seed, maxAttempts: 10 })));
    return runs.reduce((sum, run) => sum + run.stages.reduce((n, stage) => n + stage.attempts - 1, 0), 0) / runs.length;
  };
  const low = retries(5), high = retries(10);
  assert.ok(low >= 1.5, `a 5/10 student should usually need retries in Sakai: ${low.toFixed(2)} per city`);
  assert.ok(high <= 0.75 && high <= low / 2, `a 10/10 student should need far fewer: ${high.toFixed(2)} vs ${low.toFixed(2)} per city`);
});

test('Sakai retry assist lets every 0/3/5 student finish within six attempts per battle', () => {
  const seeds = Array.from({ length: 20 }, (_, index) => index * 97 + 11);
  const failures = [];
  for (const ap of [0, 3, 5]) for (const heroId of heroes) for (const seed of seeds) {
    const run = simulateSakaiCampaign({ heroId, ap, policy: POLICIES.competent, seed, maxAttempts: 6 });
    if (!run.completed || run.stages.some((stage) => stage.attempts > 6)) {
      failures.push(`${heroId} AP${ap} seed${seed} stage${run.stages.at(-1).stage}`);
    }
  }
  assert.deepEqual(failures, []);
});

test('smart play clearly beats naive play in Sakai battles 3-4', () => {
  for (const ap of [7, 8, 10]) {
    assert.ok(sakaiCurves.smart[ap] - sakaiCurves.naive[ap] >= 0.5,
      `smart vs naive at ${ap}: ${showSakai('smart')} / ${showSakai('naive')}`);
  }
});
