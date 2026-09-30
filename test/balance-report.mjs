// Prints battle and campaign win rates for tuning src/battle-data.js.
// Usage: node test/balance-report.mjs [seeds=20]
import { CAMPAIGN } from '../src/battle-data.js';
import { heroMaxHp } from '../src/battle-engine.js';
import {
  POLICIES, STAGE_LEVEL, encountersForTier, sakaiEncounters, simulateBattle, simulateCampaign, simulateSakaiCampaign,
} from './balance-sim.js';

const seeds = Number(process.argv[2] || 20);
const heroes = ['fighter', 'mage', 'ninja'];
const aps = [0, 3, 5, 6, 7, 8, 10];
const pct = (value) => `${String(Math.round(value * 100)).padStart(3)}%`;

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
