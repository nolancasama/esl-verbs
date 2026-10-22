// Prints battle and campaign win rates for tuning src/battle-data.js.
// Usage: node test/balance-report.mjs [seeds=20]
import { CAMPAIGN } from '../src/battle-data.js';
import { createBattle, heroMaxHp, resolveEnemyPhase } from '../src/battle-engine.js';
import {
  POLICIES, STAGE_LEVEL, encountersForTier, sakaiEncounters, simulateBattle, simulateCampaign, simulateSakaiCampaign,
  YAO_POLICIES, simulateYaoCampaign, yaoEncounters, yaoEntryCampaign, step, seeded,
  measureHigashiosaka, HIGASHIOSAKA_ENCOUNTER_IDS, HIGASHIOSAKA_POLICIES,
  HIGASHIOSAKA_FIRST_APS, HIGASHIOSAKA_CAMPAIGN_APS,
} from './balance-sim.js';

const seeds = Number(process.argv[2] || 20);
const heroes = ['fighter', 'mage', 'ninja'];
const aps = [0, 3, 5, 6, 7, 8, 10];
const pct = (value) => `${String(Math.round(value * 100)).padStart(3)}%`;

function reportHigashiosaka() {
  const report = measureHigashiosaka(seeds);
  console.log('\nHigashiosaka battles after Yao (real progression, 70/85/100% HP, 2 potions)');
  console.log(`hero     encounter              policy     ${HIGASHIOSAKA_FIRST_APS.map((ap) => `AP${ap}`.padStart(5)).join(' ')}`);
  for (const heroId of heroes) for (const encounterId of HIGASHIOSAKA_ENCOUNTER_IDS) for (const name of Object.keys(HIGASHIOSAKA_POLICIES)) {
    const cells = HIGASHIOSAKA_FIRST_APS.map((ap) => pct(report.firstTry.find((row) => row.heroId === heroId && row.encounterId === encounterId && row.name === name && row.ap === ap).rate).padStart(5));
    console.log(`${heroId.padEnd(8)} ${encounterId.padEnd(22)} ${name.padEnd(10)} ${cells.join(' ')}`);
  }
  console.log('\nHigashiosaka three-hero first-try means (AP5 / AP7 / AP10); defeats AP5-10 (hero / Core / turn cap)');
  for (const encounterId of HIGASHIOSAKA_ENCOUNTER_IDS) for (const name of Object.keys(HIGASHIOSAKA_POLICIES)) {
    const rows = report.firstTry.filter((row) => row.encounterId === encounterId && row.name === name);
    const means = [5, 7, 10].map((ap) => `${(100 * rows.filter((row) => row.ap === ap).reduce((sum, row) => sum + row.rate, 0) / heroes.length).toFixed(1)}%`);
    const causes = rows.reduce((sum, row) => {
      for (const cause of Object.keys(sum)) sum[cause] += row.defeats[cause];
      return sum;
    }, { hero: 0, core: 0, turnCap: 0 });
    console.log(`${encounterId} ${name.padEnd(10)} ${means.join(' / ')}; defeats ${causes.hero} / ${causes.core} / ${causes.turnCap}`);
  }
  for (const encounterId of ['hig-2', 'hig-3']) {
    const rows = report.firstTry.filter((row) => row.encounterId === encounterId && row.ap <= 7);
    const mean = (name) => rows.filter((row) => row.name === name).reduce((sum, row) => sum + row.rate, 0) / (heroes.length * 3);
    console.log(`${encounterId} awareness gain AP5-7: ${(100 * (mean('core-aware') - mean('naive'))).toFixed(1)} points`);
  }
  for (const name of Object.keys(HIGASHIOSAKA_POLICIES)) {
    const rows = report.campaigns.filter((row) => row.name === name && row.ap === 5);
    console.log(`${name} AP5 mean city retries: ${(rows.reduce((sum, row) => sum + row.retries, 0) / heroes.length).toFixed(2)}`);
  }
  console.log('\nHigashiosaka campaign completion / mean retries (post-Yao, resources carried, at most 6 attempts per battle)');
  console.log(`hero     policy     ${HIGASHIOSAKA_CAMPAIGN_APS.map((ap) => `AP${ap} done/retries`.padStart(16)).join(' ')}`);
  for (const heroId of heroes) for (const name of Object.keys(HIGASHIOSAKA_POLICIES)) {
    const cells = HIGASHIOSAKA_CAMPAIGN_APS.map((ap) => {
      const row = report.campaigns.find((row) => row.heroId === heroId && row.name === name && row.ap === ap);
      return `${pct(row.rate)} / ${row.retries.toFixed(1)}`.padStart(16);
    });
    console.log(`${heroId.padEnd(8)} ${name.padEnd(10)} ${cells.join(' ')}`);
  }
  console.log('\nHigashiosaka defeats (hero death / Core broken / turn cap)');
  for (const name of Object.keys(HIGASHIOSAKA_POLICIES)) {
    const causes = report.defeats[name];
    const campaign = report.campaigns.filter((row) => row.name === name).reduce((sum, row) => {
      for (const cause of Object.keys(sum)) sum[cause] += row.defeats[cause];
      return sum;
    }, { hero: 0, core: 0, turnCap: 0 });
    console.log(`${name.padEnd(10)} first-try AP5-10: ${causes.hero} / ${causes.core} / ${causes.turnCap}; campaign AP0-10: ${campaign.hero} / ${campaign.core} / ${campaign.turnCap}`);
  }
}

if (process.argv[3] === 'yao-trace') {
  const heroId = process.argv[4] || 'fighter';
  const policy = YAO_POLICIES[process.argv[7] || 'competent'];
  const rng = seeded(Number(process.argv[8] || 65554));
  const fraction = Number(process.argv[9] || 1);
  let state = createBattle({ heroId, encounterId: process.argv[5] || 'yao-3', level: 5, ap: Number(process.argv[6] || 5), heroHp: Math.ceil(heroMaxHp(heroId, 5) * fraction), potions: 2, rng });
  for (let turn = 0; turn < 60 && state.turn === 'player'; turn += 1) {
    const choice = policy(state);
    console.log(turn, state.wave, state.hero.hp, state.ap, state.callBudget, state.enemies.filter((enemy) => enemy.hp > 0).map((enemy) => [enemy.id, enemy.hp, enemy.intent]), choice);
    state = step(state, choice, rng).state;
    if (state.turn === 'enemy') state = resolveEnemyPhase(state, rng).state;
  }
  console.log('result', state.turn, 'HP', state.hero.hp);
  process.exit(0);
}

if (process.argv[3] === 'yao-diagnostic') {
  for (const encounterId of ['yao-3', 'yao-4']) {
    let losses = 0; let turns = 0; let reinforcements = 0;
    for (const heroId of heroes) for (let seed = 1; seed <= seeds; seed += 1) {
      const entry = yaoEntryCampaign({ heroId, ap: 5, seed: seed * 65537 + 17 });
      for (const fraction of [0.7, 0.85, 1]) {
        const result = simulateBattle({ heroId, encounterId, ap: 5, level: entry.level,
          heroHp: Math.ceil(heroMaxHp(heroId, entry.level) * fraction), potions: entry.potions,
          policy: YAO_POLICIES.competent, seed: seed * 65537 + 17 });
        if (!result.won) { losses += 1; turns += result.turns; reinforcements += result.reinforcements; }
      }
    }
    console.log(`${encounterId} AP5 priority: ${losses}/${heroes.length * seeds * 3} losses; mean reinforcements/loss ${losses ? (reinforcements / losses).toFixed(2) : 'n/a'}; turns/loss ${losses ? (turns / losses).toFixed(2) : 'n/a'}`);
  }
  process.exit(0);
}


if (process.argv[3] === 'thresholds') {
  // Minimum starting AP that wins >= half the seeds, per hero x encounter, at 85% entry HP.
  const hpFraction = Number(process.argv[4] || 0.85);
  const threshold = (heroId, encounter, name) => {
    for (let ap = 0; ap <= 10; ap += 1) {
      let wins = 0;
      for (let seed = 1; seed <= seeds; seed += 1) {
        const level = STAGE_LEVEL[encounter.tier];
        const result = simulateBattle({ heroId, encounterId: encounter.id, ap, level, heroHp: Math.ceil(heroMaxHp(heroId, level) * hpFraction), potions: 2, policy: POLICIES[name], seed: seed * 31 + 5 });
        wins += result.won ? 1 : 0;
      }
      if (wins * 2 >= seeds) return String(ap);
    }
    return '-';
  };
  console.log(`thresholds at ${hpFraction * 100}% HP (naive/competent/smart), '-' = never`);
  console.log(`${''.padEnd(22)} ${heroes.map((h) => h.padEnd(10)).join('')}`);
  for (const tier of [2, 3, 4]) for (const encounter of encountersForTier(tier)) {
    console.log(`${encounter.id.padEnd(22)} ${heroes.map((heroId) => ['naive', 'competent', 'smart'].map((name) => threshold(heroId, encounter, name)).join('/').padEnd(10)).join('')}`);
  }
  process.exit(0);
}

if (process.argv[3] === 'detail') {
  console.log('hero     encounter              policy     ' + [5, 7, 8, 10].map((ap) => `AP${ap} win/turns/hp`.padEnd(18)).join(''));
  for (const tier of [2, 3, 4]) for (const encounter of encountersForTier(tier)) for (const heroId of heroes) for (const name of ['competent', 'smart']) {
    const cells = [5, 7, 8, 10].map((ap) => {
      let wins = 0; let turns = 0; let hp = 0;
      for (let seed = 1; seed <= seeds; seed += 1) {
        const result = simulateBattle({ heroId, encounterId: encounter.id, ap, level: STAGE_LEVEL[tier], potions: 2, policy: POLICIES[name], seed: seed * 31 + 5 });
        wins += result.won ? 1 : 0; turns += result.turns; hp += result.won ? result.hp : 0;
      }
      return `${pct(wins / seeds)} ${(turns / seeds).toFixed(1).padStart(5)} ${(wins ? hp / wins : 0).toFixed(0).padStart(3)}`.padEnd(18);
    });
    console.log(`${heroId.padEnd(8)} ${encounter.id.padEnd(22)} ${name.padEnd(10)} ${cells.join('')}`);
  }
  process.exit(0);
}

function battleRate(tier, ap, policyName, hpFraction = 1) {
  let wins = 0; let total = 0; let turns = 0; let recoveries = 0;
  for (const heroId of heroes) for (const encounter of encountersForTier(tier)) for (let seed = 1; seed <= seeds; seed += 1) {
    const level = STAGE_LEVEL[tier];
    const maxHp = heroMaxHp(heroId, level);
    const result = simulateBattle({
      heroId, encounterId: encounter.id, ap, level, heroHp: Math.ceil(maxHp * hpFraction),
      potions: tier === 1 ? CAMPAIGN.startingPotions : CAMPAIGN.maxPotions, policy: POLICIES[policyName], seed: seed * 7919 + tier,
    });
    total += 1; wins += result.won ? 1 : 0; turns += result.turns; recoveries += result.recoveries;
  }
  return { rate: wins / total, turns: turns / total, recoveries: recoveries / total };
}

for (const hpFraction of [1, 0.7]) {
  console.log(`\nBattle win rate by tier (hero at ${hpFraction * 100}% HP, stage level, 2 potions)`);
  console.log(`tier policy     ${aps.map((ap) => `AP${String(ap).padStart(2)}`.padStart(5)).join(' ')}`);
  for (const tier of [1, 2, 3, 4]) for (const name of Object.keys(POLICIES)) {
    const row = aps.map((ap) => battleRate(tier, ap, name, hpFraction));
    console.log(`  ${tier}  ${name.padEnd(10)} ${row.map((r) => pct(r.rate).padStart(5)).join(' ')}   turns@7 ${row[4].turns.toFixed(1)} rec@5 ${row[2].recoveries.toFixed(1)}`);
  }
}

console.log('\nPer hero, tiers 3-4 combined, full HP');
for (const heroId of heroes) for (const name of Object.keys(POLICIES)) {
  const cells = aps.map((ap) => {
    let wins = 0; let total = 0;
    for (const tier of [3, 4]) for (const encounter of encountersForTier(tier)) for (let seed = 1; seed <= seeds; seed += 1) {
      const result = simulateBattle({ heroId, encounterId: encounter.id, ap, level: STAGE_LEVEL[tier], potions: 2, policy: POLICIES[name], seed: seed * 104729 + tier });
      total += 1; wins += result.won ? 1 : 0;
    }
    return pct(wins / total).padStart(5);
  });
  console.log(`  ${heroId.padEnd(8)} ${name.padEnd(10)} ${cells.join(' ')}`);
}

console.log('\nPer encounter, competent, full HP');
for (const tier of [3, 4]) for (const encounter of encountersForTier(tier)) {
  const cells = aps.map((ap) => {
    let wins = 0; let total = 0;
    for (const heroId of heroes) for (let seed = 1; seed <= seeds; seed += 1) {
      const result = simulateBattle({ heroId, encounterId: encounter.id, ap, level: STAGE_LEVEL[tier], potions: 2, policy: POLICIES.competent, seed: seed * 31 + 5 });
      total += 1; wins += result.won ? 1 : 0;
    }
    return pct(wins / total).padStart(5);
  });
  console.log(`  ${encounter.id.padEnd(22)} ${cells.join(' ')}`);
}

console.log('\nCampaign: first-try battle wins / completed (<=10 retries), mean retries');
for (const name of Object.keys(POLICIES)) for (const ap of [0, 3, 5, 6, 7, 8, 10]) {
  let firstTry = 0; let battles = 0; let completed = 0; let retries = 0; let runs = 0;
  const byStage = [0, 0, 0, 0];
  for (const heroId of heroes) for (let seed = 1; seed <= seeds; seed += 1) {
    const run = simulateCampaign({ heroId, ap, policy: POLICIES[name], seed: seed * 17 + ap });
    runs += 1; completed += run.completed ? 1 : 0;
    run.stages.forEach((stage, index) => { battles += 1; if (stage.attempts === 1 && stage.won) { firstTry += 1; byStage[index] += 1; } retries += stage.attempts - 1; });
  }
  console.log(`  ${name.padEnd(10)} AP${String(ap).padStart(2)}: first-try ${pct(firstTry / battles)}  by stage ${byStage.map((n) => pct(n / runs)).join(' ')}  completed ${pct(completed / runs)}  retries/run ${(retries / runs).toFixed(1)}`);
}

const sakaiAps = [5, 6, 7, 8, 10];
console.log('\nSakai battles 3-4 at LV5 (70/85/100% HP, 2 potions)');
console.log(`hero     encounter              policy     ${sakaiAps.map((ap) => `AP${ap}`.padStart(5)).join(' ')}`);
for (const heroId of heroes) for (const encounter of sakaiEncounters().slice(2)) for (const name of ['naive', 'competent', 'smart']) {
  const cells = sakaiAps.map((ap) => {
    let wins = 0; let total = 0;
    for (const hpFraction of [0.7, 0.85, 1]) for (let seed = 1; seed <= seeds; seed += 1) {
      wins += simulateBattle({
        heroId, encounterId: encounter.id, ap, level: 5,
        heroHp: Math.ceil(heroMaxHp(heroId, 5) * hpFraction), potions: 2,
        policy: POLICIES[name], seed: seed * 65537 + 17,
      }).won ? 1 : 0;
      total += 1;
    }
    return pct(wins / total).padStart(5);
  });
  console.log(`${heroId.padEnd(8)} ${encounter.id.padEnd(22)} ${name.padEnd(10)} ${cells.join(' ')}`);
}

console.log('\nSakai campaign completion (LV5 start, resources carried, at most 6 attempts per battle)');
console.log(`hero     policy     ${[0, 3, 5, 6, 7, 8, 10].map((ap) => `AP${ap}`.padStart(5)).join(' ')}`);
for (const heroId of heroes) for (const name of ['competent', 'smart']) {
  const cells = [0, 3, 5, 6, 7, 8, 10].map((ap) => {
    let completed = 0;
    for (let seed = 1; seed <= seeds; seed += 1) {
      completed += simulateSakaiCampaign({ heroId, ap, policy: POLICIES[name], seed: seed * 8191 + 23, maxAttempts: 6 }).completed ? 1 : 0;
    }
    return pct(completed / seeds).padStart(5);
  });
  console.log(`${heroId.padEnd(8)} ${name.padEnd(10)} ${cells.join(' ')}`);
}

console.log('\nYao battles after Sakai (real progression, 70/85/100% HP, 2 potions)');
console.log(`hero     encounter              policy     ${sakaiAps.map((ap) => `AP${ap}`.padStart(5)).join(' ')}`);
for (const heroId of heroes) for (const encounter of yaoEncounters()) for (const name of Object.keys(YAO_POLICIES)) {
  const cells = sakaiAps.map((ap) => {
    let wins = 0; let total = 0;
    for (let seed = 1; seed <= seeds; seed += 1) {
      const entry = yaoEntryCampaign({ heroId, ap, seed: seed * 65537 + 17 });
      for (const hpFraction of [0.7, 0.85, 1]) {
        wins += simulateBattle({
          heroId, encounterId: encounter.id, ap, level: entry.level,
          heroHp: Math.ceil(heroMaxHp(heroId, entry.level) * hpFraction), potions: entry.potions,
          policy: YAO_POLICIES[name], seed: seed * 65537 + 17,
        }).won ? 1 : 0;
        total += 1;
      }
    }
    return pct(wins / total).padStart(5);
  });
  console.log(`${heroId.padEnd(8)} ${encounter.id.padEnd(22)} ${name.padEnd(10)} ${cells.join(' ')}`);
}

console.log('\nYao campaign completion / mean retries (post-Sakai, resources carried, at most 6 attempts per battle)');
console.log(`hero     policy     ${[0, 3, 5, 6, 7, 8, 10].map((ap) => `AP${ap} done/retries`.padStart(16)).join(' ')}`);
for (const heroId of heroes) for (const name of Object.keys(YAO_POLICIES)) {
  const cells = [0, 3, 5, 6, 7, 8, 10].map((ap) => {
    let completed = 0; let retries = 0;
    for (let seed = 1; seed <= seeds; seed += 1) {
      const run = simulateYaoCampaign({ heroId, ap, policy: YAO_POLICIES[name], seed: seed * 8191 + 23, maxAttempts: 6 });
      completed += run.completed ? 1 : 0;
      retries += run.stages.reduce((sum, stage) => sum + stage.attempts - 1, 0);
    }
    return `${pct(completed / seeds)} / ${(retries / seeds).toFixed(1)}`.padStart(16);
  });
  console.log(`${heroId.padEnd(8)} ${name.padEnd(10)} ${cells.join(' ')}`);
}

reportHigashiosaka();
