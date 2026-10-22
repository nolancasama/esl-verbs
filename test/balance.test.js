// Difficulty by starting AP, measured with deterministic simulated players
// (see balance-sim.js). These assert trends, not exact percentages:
// more AP clearly helps, 5 AP is hard, 8+ AP is strongly favourable, and
// tactical play beats button mashing. `node test/balance-report.mjs` prints
// the full tables used for tuning.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HEROES } from '../src/battle-data.js';
import { createBattle, heroMaxHp } from '../src/battle-engine.js';
import {
  POLICIES, STAGE_LEVEL, encountersForTier, sakaiEncounters, simulateBattle, simulateCampaign, simulateSakaiCampaign,
  YAO_POLICIES, simulateYaoCampaign, yaoEntryCampaign, yaoEncounters,
  HIGASHIOSAKA_POLICIES, higashiosakaEntryCampaign, simulateHigashiosakaCampaign, measureHigashiosaka,
  OSAKA_CITY_POLICIES, measureOsakaCity, osakaCityEntryCampaign,
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

test('Yao starts with the real post-Sakai level and XP, then the normal chapter rest', () => {
  for (const heroId of heroes) {
    const sakai = simulateSakaiCampaign({ heroId, ap: 7, policy: POLICIES.competent, seed: 23, maxAttempts: 6 });
    const entry = yaoEntryCampaign({ heroId, ap: 7, seed: 23 });
    assert.ok(sakai.completed);
    assert.equal(entry.cityId, 'yao');
    assert.equal(entry.level, sakai.campaign.level);
    assert.equal(entry.xp, sakai.campaign.xp);
    assert.equal(entry.heroHp, heroMaxHp(heroId, sakai.campaign.level));
    assert.equal(entry.potions, 2);
    assert.equal(entry.stage, 1);
    assert.deepEqual(entry.stageResults, []);
  }
});

test('Yao bots compare threat priority against always choosing the first living target', () => {
  const base = createBattle({ heroId: 'fighter', encounterId: 'yao-4', level: 5, ap: 1, rng: () => 0.9 });
  const bombFrom = createBattle({ heroId: 'fighter', encounterId: 'yao-2', level: 5, ap: 1, rng: () => 0.9 }).enemies.find((enemy) => enemy.id === 'bombSlime');
  const state = { ...base, enemies: [...base.enemies.map((enemy) => ({ ...enemy })), { ...bombFrom, uid: base.nextUid }], nextUid: base.nextUid + 1 };
  const [archer, caller, bomb] = state.enemies;
  archer.intent = 'charge';
  caller.intent = 'call';
  bomb.intent = 'boom';
  assert.equal(YAO_POLICIES.competent(state).target, bomb.uid);
  bomb.intent = 'fuse';
  assert.equal(YAO_POLICIES.competent(state).target, caller.uid);
  caller.intent = 'attack';
  assert.equal(YAO_POLICIES.competent(state).target, archer.uid);
  archer.intent = 'attack';
  bomb.hp = 1;
  assert.equal(YAO_POLICIES.competent(state).target, bomb.uid);
  state.selectedUid = bomb.uid;
  assert.equal(YAO_POLICIES.naive(state).target, archer.uid);
  archer.hp = 0;
  assert.equal(YAO_POLICIES.naive(state).target, caller.uid);
});

test('Yao: both target strategies clear every stage within six attempts, including 0 AP', () => {
  const seeds = Array.from({ length: 20 }, (_, index) => index * 97 + 11);
  const failures = [];
  const retries = { naive: 0, competent: 0 };
  for (const ap of Array.from({ length: 11 }, (_, value) => value)) for (const heroId of heroes) for (const seed of seeds) {
    for (const [name, policy] of Object.entries(YAO_POLICIES)) {
      const run = simulateYaoCampaign({ heroId, ap, policy, seed, maxAttempts: 6 });
      retries[name] += run.stages.reduce((sum, stage) => sum + stage.attempts - 1, 0);
      if (!run.completed || run.stages.some((stage) => stage.attempts > 6)) {
        failures.push(`${heroId} ${name} AP${ap} seed${seed} stage${run.stages.at(-1).stage}`);
      } else {
        assert.deepEqual(run.stages.map((stage) => stage.encounterId), ['yao-1', 'yao-2', 'yao-3', 'yao-4']);
      }
    }
  }
  assert.deepEqual(failures, []);
  assert.ok(retries.competent < retries.naive, `priority should reduce retries overall: ${JSON.stringify(retries)}`);
});

// Match the report's 20 seeds, seed transforms, entry progression and HP samples.
// Single hero/AP cells are noisy at this seed count, so thresholds and the
// priority advantage are checked on the mean over the three heroes.
const YAO_REPORT_SEEDS = 20;
const YAO_FIRST_TRY = { 'yao-3': { 5: .3, 7: .75, 10: .95 }, 'yao-4': { 5: .15, 7: .75, 10: .95 } };
test('Yao correction: first-try thresholds and priority advantage match the report', () => {
  const failures = [];
  const mean = {};
  for (const heroId of heroes) for (const ap of [5, 6, 7, 8, 10]) {
    const entries = Array.from({ length: YAO_REPORT_SEEDS }, (_, index) => yaoEntryCampaign({ heroId, ap, seed: (index + 1) * 65537 + 17 }));
    for (const encounter of yaoEncounters()) {
      const rates = {};
      for (const [name, policy] of Object.entries(YAO_POLICIES)) {
        let wins = 0;
        for (let index = 0; index < YAO_REPORT_SEEDS; index += 1) for (const fraction of HP_FRACTIONS) {
          const entry = entries[index];
          wins += simulateBattle({ heroId, encounterId: encounter.id, ap, level: entry.level,
            heroHp: Math.ceil(heroMaxHp(heroId, entry.level) * fraction), potions: entry.potions,
            policy, seed: (index + 1) * 65537 + 17 }).won ? 1 : 0;
        }
        rates[name] = wins / (YAO_REPORT_SEEDS * HP_FRACTIONS.length);
      }
      for (const name of Object.keys(rates)) {
        const key = `${encounter.id} AP${ap} ${name}`;
        mean[key] = (mean[key] ?? 0) + rates[name] / heroes.length;
      }
    }
  }
  for (const [encounterId, thresholds] of Object.entries(YAO_FIRST_TRY)) for (const [ap, threshold] of Object.entries(thresholds)) {
    const rate = mean[`${encounterId} AP${ap} competent`];
    if (rate + 1e-9 < threshold) failures.push(`${encounterId} AP${ap}: priority ${rate.toFixed(2)} < ${threshold}`);
  }
  // Choosing the dangerous target first must pay off where the lesson is taught (calls and the Orc).
  for (const encounterId of ['yao-3', 'yao-4']) {
    const gain = [5, 6, 7].reduce((sum, ap) => sum + mean[`${encounterId} AP${ap} competent`] - mean[`${encounterId} AP${ap} naive`], 0) / 3;
    if (gain < .05) failures.push(`${encounterId}: priority advantage at AP5-7 ${gain.toFixed(2)} < .05`);
    const overall = [5, 6, 7, 8, 10].reduce((sum, ap) => sum + mean[`${encounterId} AP${ap} competent`] - mean[`${encounterId} AP${ap} naive`], 0) / 5;
    if (overall < -.05) failures.push(`${encounterId}: priority below naive overall ${overall.toFixed(2)}`);
  }
  assert.deepEqual(failures, []);
});

test('Yao correction: both report bots complete; priority AP7 needs at most 1.5 retries per hero', () => {
  const failures = [];
  for (const heroId of heroes) for (const ap of [0, 3, 5, 6, 7, 8, 10]) for (const [name, policy] of Object.entries(YAO_POLICIES)) {
    let retries = 0;
    for (let seed = 1; seed <= YAO_REPORT_SEEDS; seed += 1) {
      const run = simulateYaoCampaign({ heroId, ap, policy, seed: seed * 8191 + 23, maxAttempts: 6 });
      if (!run.completed) failures.push(`${heroId} ${name} AP${ap} seed${seed} incomplete`);
      retries += run.stages.reduce((sum, stage) => sum + stage.attempts - 1, 0);
    }
    if (name === 'competent' && ap === 7 && retries / YAO_REPORT_SEEDS > 1.5) failures.push(`${heroId} AP7 mean retries ${retries / YAO_REPORT_SEEDS}`);
  }
  assert.deepEqual(failures, []);
});

test('Higashiosaka enters with real post-Yao progression and the normal city rest', () => {
  for (const heroId of heroes) {
    const yao = simulateYaoCampaign({ heroId, ap: 7, seed: 23 });
    const entry = higashiosakaEntryCampaign({ heroId, ap: 7, seed: 23 });
    assert.ok(yao.completed);
    assert.equal(entry.cityId, 'higashiosaka');
    assert.equal(entry.level, yao.campaign.level);
    assert.equal(entry.xp, yao.campaign.xp);
    assert.equal(entry.heroHp, heroMaxHp(heroId, entry.level));
    assert.equal(entry.potions, 2);
    assert.deepEqual(entry.stageResults, []);
    const run = simulateHigashiosakaCampaign({ heroId, ap: 7, seed: 23 });
    assert.ok(run.completed);
    assert.deepEqual(run.stages.map((stage) => stage.encounterId), ['hig-1', 'hig-2', 'hig-3', 'hig-4']);
    assert.equal(run.stages[1].entryHp, Math.min(heroMaxHp(heroId, entry.level),
      Math.max(run.stages[0].hpLeft + Math.round(heroMaxHp(heroId, entry.level) * .28), Math.ceil(heroMaxHp(heroId, entry.level) * .4))));
    assert.equal(run.stages[1].entryPotions, Math.min(2, run.stages[0].potionsLeft + 1));
  }
});

test('Higashiosaka bots differ in Core targeting and defence, keeping the Yao resource plan', () => {
  const base = createBattle({ heroId: 'fighter', encounterId: 'hig-4', level: 5, ap: 1, rng: () => .9 });
  const [sniper, , saboteur] = base.enemies;
  assert.equal(HIGASHIOSAKA_POLICIES.naive(base).target, sniper.uid);
  assert.equal(HIGASHIOSAKA_POLICIES['core-aware'](base).target, saboteur.uid);
  const heavy = { ...base, enemies: base.enemies.map((enemy) => enemy.uid === sniper.uid ? { ...enemy, intent: 'heavy', aim: 'core' } : enemy) };
  assert.equal(HIGASHIOSAKA_POLICIES['core-aware'](heavy).skillId, 'guard');
  assert.notEqual(HIGASHIOSAKA_POLICIES.naive(heavy).skillId, 'guard');
  const heroHeavy = { ...heavy, enemies: heavy.enemies.map((enemy) => enemy.uid === sniper.uid ? { ...enemy, aim: 'hero' } : enemy) };
  assert.equal(HIGASHIOSAKA_POLICIES.naive(heroHeavy).skillId, 'guard');
  const noSaboteur = { ...heavy, enemies: heavy.enemies.filter((enemy) => enemy.id !== 'saboteur').map((enemy) => ({ ...enemy, intent: 'charge' })) };
  assert.equal(HIGASHIOSAKA_POLICIES['core-aware'](noSaboteur).target, sniper.uid);
});

// Exactly the report's 20 seeds, entry progression, HP samples and retry rules.
// Keep thresholds together so a deliberately impossible pass can prove every
// balance assertion before restoring the approved values.
const HIG_TARGETS = {
  completion: 1,
  firstTry: { 'hig-3': { 5: .30, 7: .70, 10: .95 }, 'hig-4': { 5: .15, 7: .70, 10: .95 } },
  advantage: .05, overallAdvantage: 0, maxRetries: 4.5, coreDefeatShare: .20, heroDefeatShare: .001,
  naiveAp5: { 'hig-2': .85, 'hig-3': .75 }, stageAdvantage: .10,
  firstTryCoreShare: .40, tutorial: .85, variedCells: 1,
};
const higReport = measureHigashiosaka(20);
const average = (rows, field = 'rate') => rows.reduce((sum, row) => sum + row[field], 0) / rows.length;
const higRate = (name, encounterId, ap) => average(higReport.firstTry.filter((row) => row.name === name && row.encounterId === encounterId && row.ap === ap));

for (const encounterId of ['hig-2', 'hig-3']) {
  test(`Higashiosaka correction: ${encounterId} naive AP5 has real Core pressure`, () => {
    const rate = higRate('naive', encounterId, 5);
    assert.ok(rate <= HIG_TARGETS.naiveAp5[encounterId], `${encounterId}: naive AP5 ${rate}`);
  });
  test(`Higashiosaka correction: ${encounterId} awareness gains ten points at AP5-7`, () => {
    const gain = average([5, 6, 7].map((ap) => ({ rate: higRate('core-aware', encounterId, ap) - higRate('naive', encounterId, ap) })));
    assert.ok(gain + 1e-9 >= HIG_TARGETS.stageAdvantage, `${encounterId}: awareness gain ${gain}`);
  });
}
test('Higashiosaka correction: Core breaks cause at least 40% of naive hig-2..4 first-try defeats', () => {
  const causes = higReport.firstTry.filter((row) => row.name === 'naive' && row.encounterId !== 'hig-1')
    .reduce((sum, row) => {
      for (const cause of Object.keys(sum)) sum[cause] += row.defeats[cause];
      return sum;
    }, { hero: 0, core: 0, turnCap: 0 });
  const losses = Object.values(causes).reduce((sum, count) => sum + count, 0);
  assert.ok(causes.core / losses >= HIG_TARGETS.firstTryCoreShare, JSON.stringify(causes));
});
test('Higashiosaka correction: hig-1 stays a gentle Core-aware AP5 tutorial', () => {
  assert.ok(higRate('core-aware', 'hig-1', 5) >= HIG_TARGETS.tutorial);
});
test('Higashiosaka correction: seeds change outcomes within HP samples in hig-2..4', () => {
  // Without within-HP variation, three equally weighted HP samples can only
  // produce 0, 1/3, 2/3 or 1. Require other rates in each pressure encounter.
  const failures = ['hig-2', 'hig-3', 'hig-4'].filter((encounterId) => {
    const varied = higReport.firstTry.filter((row) => row.encounterId === encounterId
      && Math.abs(row.rate * 3 - Math.round(row.rate * 3)) > 1e-9).length;
    return varied < HIG_TARGETS.variedCells;
  });
  assert.deepEqual(failures, []);
});

for (const name of Object.keys(HIGASHIOSAKA_POLICIES)) {
  test(`Higashiosaka: ${name} completes 100% at every AP0-10 within six attempts`, () => {
    for (let ap = 0; ap <= 10; ap += 1) {
      const rate = average(higReport.campaigns.filter((row) => row.name === name && row.ap === ap));
      assert.ok(rate >= HIG_TARGETS.completion, `${name} AP${ap}: completed ${rate}`);
    }
  });
  test(`Higashiosaka: ${name} AP5 hero-mean city retries stay at most 4.5`, () => {
    const retries = average(higReport.campaigns.filter((row) => row.name === name && row.ap === 5), 'retries');
    assert.ok(retries <= HIG_TARGETS.maxRetries, `${name} AP5: mean retries ${retries}`);
  });
}
for (const [encounterId, thresholds] of Object.entries(HIG_TARGETS.firstTry)) for (const [ap, threshold] of Object.entries(thresholds)) {
  test(`Higashiosaka: core-aware ${encounterId} AP${ap} meets the hero-mean first-try target`, () => {
    const rate = higRate('core-aware', encounterId, Number(ap));
    assert.ok(rate + 1e-9 >= threshold, `${encounterId} AP${ap}: ${rate} < ${threshold}`);
  });
}
test('Higashiosaka: Core awareness wins at least five points at AP5-7 across hig-2..4', () => {
  const rows = higReport.firstTry.filter((row) => row.encounterId !== 'hig-1' && row.ap <= 7);
  const gain = average(rows.filter((row) => row.name === 'core-aware')) - average(rows.filter((row) => row.name === 'naive'));
  assert.ok(gain + 1e-9 >= HIG_TARGETS.advantage, `Core-aware advantage ${gain}`);
});
test('Higashiosaka: Core awareness is never below naive overall at any reported AP', () => {
  for (let ap = 5; ap <= 10; ap += 1) {
    const rows = higReport.firstTry.filter((row) => row.ap === ap);
    const gain = average(rows.filter((row) => row.name === 'core-aware')) - average(rows.filter((row) => row.name === 'naive'));
    assert.ok(gain + 1e-9 >= HIG_TARGETS.overallAdvantage, `AP${ap}: overall advantage ${gain}`);
  }
});
// Defeat composition is over campaign attempts at all AP0-10: first-try-only
// AP5-10 omits the hero deaths that still occur when arriving with little AP.
const naiveHigDefeats = higReport.campaigns.filter((row) => row.name === 'naive').reduce((sum, row) => {
  for (const cause of Object.keys(sum)) sum[cause] += row.defeats[cause];
  return sum;
}, { hero: 0, core: 0, turnCap: 0 });
const naiveHigLosses = Object.values(naiveHigDefeats).reduce((sum, n) => sum + n, 0);
test('Higashiosaka: Core breakage causes at least 20% of naive defeats', () => {
  assert.ok(naiveHigDefeats.core / naiveHigLosses >= HIG_TARGETS.coreDefeatShare, JSON.stringify(naiveHigDefeats));
});
test('Higashiosaka: hero death also causes naive defeats', () => {
  assert.ok(naiveHigDefeats.hero / naiveHigLosses >= HIG_TARGETS.heroDefeatShare, JSON.stringify(naiveHigDefeats));
});

// Every threshold uses the same three-hero mean and samples as npm run balance.
const OSAKA_TARGETS = {
  completion: 1, maxRetries: 5, advantage: .10, maxTurns: 45, variedCells: 1,
  finaleMaxAp5: .60, climaxMargin: 0, heroMinAp7: .40, coreDefeatShare: .25, monotonicSlack: .05,
  firstTry: {
    'osk-1': { 5: .30, 7: .70, 10: .95 },
    'osk-2': { 5: .30, 7: .70, 10: .95 },
    'osk-3': { 5: .30, 7: .70, 10: .95 },
    'osk-4': { 5: .10, 7: .60, 10: .90 },
  },
};
const osakaReport = measureOsakaCity(20);
const osakaRate = (name, encounterId, ap) => average(osakaReport.firstTry.filter((row) => row.name === name && row.encounterId === encounterId && row.ap === ap));

test('Osaka City: both finale Fighter bots BREAK an affordable heavy before defence or a potion', () => {
  const battle = createBattle({ heroId: 'fighter', encounterId: 'osk-4', startWave: 3, level: 5, ap: 2, heroHp: 10, potions: 2, rng: () => .9 });
  const state = { ...battle, enemies: battle.enemies.map((enemy) => ({ ...enemy, intent: 'heavy', charging: true })) };
  for (const policy of Object.values(OSAKA_CITY_POLICIES)) {
    assert.deepEqual(policy(state), { skillId: 'powerSlash', target: state.enemies[0].uid });
  }
});

test('Osaka City enters after real Higashiosaka completion with the normal rest', () => {
  for (const heroId of heroes) {
    const previous = simulateHigashiosakaCampaign({ heroId, ap: 7, seed: 23 });
    const entry = osakaCityEntryCampaign({ heroId, ap: 7, seed: 23 });
    assert.ok(previous.completed);
    assert.equal(entry.cityId, 'osakaCity');
    assert.equal(entry.level, previous.campaign.level);
    assert.equal(entry.xp, previous.campaign.xp);
    assert.equal(entry.heroHp, heroMaxHp(heroId, entry.level));
    assert.equal(entry.potions, 2);
    assert.deepEqual(entry.stageResults, []);
  }
});
for (const name of Object.keys(OSAKA_CITY_POLICIES)) {
  test(`Osaka City: ${name} completes 100% at every AP0-10 within six attempts`, () => {
    for (let ap = 0; ap <= 10; ap += 1) {
      const rate = average(osakaReport.campaigns.filter((row) => row.name === name && row.ap === ap));
      assert.ok(rate >= OSAKA_TARGETS.completion, `${name} AP${ap}: completion ${rate}`);
    }
  });
  test(`Osaka City: ${name} AP5 mean city retries stay at most five`, () => {
    const retries = average(osakaReport.campaigns.filter((row) => row.name === name && row.ap === 5), 'retries');
    assert.ok(retries <= OSAKA_TARGETS.maxRetries, `${name}: retries ${retries}`);
  });
}
for (const [encounterId, thresholds] of Object.entries(OSAKA_TARGETS.firstTry)) for (const [ap, threshold] of Object.entries(thresholds)) {
  test(`Osaka City: priority ${encounterId} AP${ap} meets the first-try target`, () => {
    const rate = osakaRate('priority', encounterId, Number(ap));
    assert.ok(rate + 1e-9 >= threshold, `${encounterId} AP${ap}: ${rate} < ${threshold}`);
  });
}
for (const encounterId of ['osk-2', 'osk-4']) {
  test(`Osaka City: priority gains ten points on ${encounterId} at AP5-7`, () => {
    const gain = [5, 6, 7].reduce((sum, ap) => sum + osakaRate('priority', encounterId, ap) - osakaRate('naive', encounterId, ap), 0) / 3;
    assert.ok(gain + 1e-9 >= OSAKA_TARGETS.advantage, `${encounterId}: priority gain ${gain}`);
  });
}
for (const name of Object.keys(OSAKA_CITY_POLICIES)) test(`Osaka City: ${name} osk-4 AP7 mean length stays within 45 player turns`, () => {
  const turns = average(osakaReport.firstTry.filter((row) => row.name === name && row.encounterId === 'osk-4' && row.ap === 7), 'turns');
  assert.ok(turns <= OSAKA_TARGETS.maxTurns, `finale turns ${turns}`);
});
test('Osaka City: priority finale AP5 first-try mean stays at most 60%', () => {
  const rate = osakaRate('priority', 'osk-4', 5);
  assert.ok(rate <= OSAKA_TARGETS.finaleMaxAp5, `finale AP5 ${rate}`);
});
test('Osaka City: priority finale is harder than osk-3 at AP5', () => {
  const finale = osakaRate('priority', 'osk-4', 5);
  const generals = osakaRate('priority', 'osk-3', 5);
  assert.ok(finale + OSAKA_TARGETS.climaxMargin < generals, `finale ${finale}, generals ${generals}`);
});
for (const heroId of heroes) test(`Osaka City: priority ${heroId} finale AP7 first-try rate is at least 40%`, () => {
  const row = osakaReport.firstTry.find((row) => row.heroId === heroId && row.name === 'priority' && row.encounterId === 'osk-4' && row.ap === 7);
  assert.ok(row.rate >= OSAKA_TARGETS.heroMinAp7, `${heroId} AP7 ${row.rate}`);
});
for (const name of Object.keys(OSAKA_CITY_POLICIES)) for (const [lower, upper] of [[5, 7], [7, 10]]) {
  test(`Osaka City: ${name} finale mean does not fall from AP${lower} to AP${upper} beyond five points`, () => {
    const before = osakaRate(name, 'osk-4', lower);
    const after = osakaRate(name, 'osk-4', upper);
    assert.ok(after + OSAKA_TARGETS.monotonicSlack + 1e-9 >= before, `${name} AP${lower} ${before}, AP${upper} ${after}`);
  });
}
test('Osaka City: Core breakage causes at least 25% of naive finale first-try defeats', () => {
  const losses = osakaReport.firstTry.filter((row) => row.name === 'naive' && row.encounterId === 'osk-4')
    .reduce((sum, row) => ({ core: sum.core + row.defeats.core,
      total: sum.total + Object.values(row.defeats).reduce((a, b) => a + b, 0) }), { core: 0, total: 0 });
  assert.ok(losses.total > 0 && losses.core / losses.total >= OSAKA_TARGETS.coreDefeatShare, JSON.stringify(losses));
});
test('Osaka City: first-try outcomes vary with the seed in the combined Core encounters', () => {
  const failures = ['osk-2', 'osk-4'].filter((encounterId) => osakaReport.firstTry.filter((row) => row.encounterId === encounterId
    && Math.abs(row.rate * 3 - Math.round(row.rate * 3)) > 1e-9).length < OSAKA_TARGETS.variedCells);
  assert.deepEqual(failures, []);
});
