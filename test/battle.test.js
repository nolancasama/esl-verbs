import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE, ENCOUNTERS, ENEMIES, SKILLS } from '../src/battle-data.js';
import {
  availableSkills, chooseEncounter, chooseEnemyIntent, createBattle, cycleTarget, getEnemyIntent,
  isDefeat, isVictory, resolveEnemyPhase, selectTarget, skillTierForStage, useSkill,
} from '../src/battle-engine.js';
import { battlePowerFor, campaignSummary, createCampaign, recordStage, retryPower } from '../src/campaign.js';

const fixed = (value) => () => value;
const battle = (options = {}) => createBattle({ heroId: 'fighter', encounterId: 'slime', power: 2, skillTier: 0, rng: fixed(0.99), ...options });
const patchEnemy = (state, uid, changes) => ({
  ...state,
  enemies: state.enemies.map((enemy) => enemy.uid === uid ? { ...enemy, ...changes } : enemy),
});
const damageTo = (events, target) => events.filter((event) => event.type === 'damage' && event.target === target).reduce((sum, event) => sum + event.amount, 0);

test('battle creation, campaign power, target selection, and skill gates still work', () => {
  const state = battle();
  assert.equal(state.turn, 'player');
  assert.equal(state.hero.hp, 32);
  assert.deepEqual(
    { combo: state.hero.combo, counter: state.hero.counter, openingUid: state.hero.openingUid, defense: state.hero.defense },
    { combo: false, counter: false, openingUid: null, defense: null },
  );
  assert.equal(battlePowerFor(0), 2);
  assert.equal(battlePowerFor(5), 7);
  assert.equal(battlePowerFor(10), 12);
  assert.deepEqual([1, 2, 3, 4].map(skillTierForStage), [0, 1, 2, 2]);
  assert.equal(chooseEncounter(2, fixed(0)).id, 'goblin-slime');
  assert.equal(chooseEncounter(4, fixed(0.99)).id, 'vampire-lord');

  const locked = useSkill(state, 'powerSlash');
  assert.equal(locked.events[0].reason, 'locked');
  const pair = battle({ encounterId: 'goblin-slime' });
  assert.equal(selectTarget(pair, pair.enemies[1].uid).selectedUid, pair.enemies[1].uid);
  assert.equal(cycleTarget(pair, 1).selectedUid, pair.enemies[1].uid);
});

test('stored intents exist, injected RNG is deterministic, and resolution uses the displayed intent', () => {
  const guard = battle({ encounterId: 'goblin-slime', rng: fixed(0) });
  const attack = battle({ encounterId: 'goblin-slime', rng: fixed(0.99) });
  assert.ok(guard.enemies.filter((enemy) => enemy.hp > 0).every((enemy) => getEnemyIntent(guard, enemy.uid)));
  assert.equal(guard.enemies[0].intent, 'guard');
  assert.equal(attack.enemies[0].intent, 'attack');
  assert.equal(chooseEnemyIntent(attack, attack.enemies[0], fixed(0)), 'guard');

  const acted = resolveEnemyPhase(useSkill(guard, 'slash').state, fixed(0.99));
  assert.equal(acted.state.enemies[0].guarding, true);
  assert.equal(acted.state.hero.hp, guard.hero.hp - ENEMIES.slime.attack);
  assert.ok(acted.events.some((event) => event.type === 'guard' && event.target === guard.enemies[0].uid));
  assert.ok(!acted.events.some((event) => event.type === 'attack' && event.source === guard.enemies[0].uid));
  assert.equal('rng' in acted.state, false);
});

test('Fighter combo, combo clearing, and Cleave work', () => {
  let state = battle({ encounterId: 'golem', power: 5, skillTier: 2 });
  const slash = useSkill(state, 'slash');
  assert.equal(slash.state.hero.combo, true);
  assert.ok(slash.events.some((event) => event.type === 'comboReady'));
  state = resolveEnemyPhase(slash.state, fixed(0.99)).state;
  const power = useSkill(state, 'powerSlash');
  assert.equal(damageTo(power.events, state.enemies[0].uid), SKILLS.powerSlash.damage + BALANCE.comboBonus);
  assert.equal(power.state.hero.combo, false);
  assert.ok(power.events.some((event) => event.type === 'combo'));

  state = { ...resolveEnemyPhase(power.state, fixed(0.99)).state, hero: { ...power.state.hero, combo: true } };
  const guarded = useSkill(state, 'guard');
  assert.equal(guarded.state.hero.combo, false);

  const group = battle({ encounterId: 'goblin-slime', power: 3, skillTier: 2 });
  const cleave = useSkill(group, 'cleave');
  assert.deepEqual(cleave.state.enemies.map((enemy) => enemy.hp), [5, 2]);
});

test('Fighter Break cancels a heavy and Guard readies a counter for the next damaging skill', () => {
  let state = battle({ encounterId: 'golem', power: 2, skillTier: 2 });
  const uid = state.enemies[0].uid;
  state = patchEnemy(state, uid, { intent: 'heavy', charging: true });
  const broken = useSkill(state, 'powerSlash', uid);
  assert.equal(broken.state.enemies[0].intent, 'rest');
  assert.equal(broken.state.enemies[0].charging, false);
  assert.ok(broken.events.some((event) => event.type === 'break'));
  const rested = resolveEnemyPhase(broken.state, fixed(0.99));
  assert.equal(rested.state.hero.hp, state.hero.hp);
  assert.equal(rested.state.enemies[0].tired, true);

  state = battle({ encounterId: 'golem', power: 0, skillTier: 2 });
  state = patchEnemy(state, uid, { intent: 'heavy', charging: true });
  const defended = resolveEnemyPhase(useSkill(state, 'guard').state, fixed(0.99));
  assert.equal(defended.state.hero.counter, true);
  assert.ok(defended.events.some((event) => event.type === 'counterReady'));
  const counter = useSkill(defended.state, 'slash', uid);
  assert.equal(damageTo(counter.events, uid), SKILLS.slash.damage + BALANCE.counterBonus);
  assert.equal(counter.state.hero.counter, false);
  assert.ok(counter.events.some((event) => event.type === 'counter'));
});

test('Mage Bolt recovers Power only from charging or tired targets', () => {
  for (const status of ['charging', 'tired']) {
    let state = battle({ heroId: 'mage', encounterId: 'golem', power: 0, skillTier: 2 });
    state = patchEnemy(state, state.enemies[0].uid, { [status]: true });
    const result = useSkill(state, 'magicBolt');
    assert.equal(result.state.power, 1, status);
    assert.ok(result.events.some((event) => event.type === 'power' && event.reason === 'exploit'));
  }
  const normal = useSkill(battle({ heroId: 'mage', encounterId: 'golem', power: 0, skillTier: 2 }), 'magicBolt');
  assert.equal(normal.state.power, 0);
  assert.ok(!normal.events.some((event) => event.type === 'power'));
});

test('Mage Barrier, low-HP Heal barrier, and Fireball work', () => {
  let state = battle({ heroId: 'mage', encounterId: 'golem', power: 0, skillTier: 2 });
  state = patchEnemy(state, state.enemies[0].uid, { intent: 'heavy', charging: true });
  const barrier = resolveEnemyPhase(useSkill(state, 'barrier').state, fixed(0.99));
  assert.equal(barrier.state.power, 1);
  assert.equal(barrier.events.filter((event) => event.type === 'power' && event.reason === 'barrier').length, 1);

  const low = useSkill(battle({ heroId: 'mage', heroHp: 10, power: 2, skillTier: 2 }), 'heal');
  assert.equal(low.state.hero.hp, 22);
  assert.equal(low.state.hero.defense, 'barrier');
  assert.ok(low.events.some((event) => event.type === 'barrierUp'));
  const high = useSkill(battle({ heroId: 'mage', heroHp: 15, power: 2, skillTier: 2 }), 'heal');
  assert.equal(high.state.hero.defense, null);

  const group = battle({ heroId: 'mage', encounterId: 'goblin-slime', power: 3, skillTier: 2 });
  assert.deepEqual(useSkill(group, 'fireball').state.enemies.map((enemy) => enemy.hp), [4, 1]);
});

test('Ninja Opening is created and consumed for boosted Double Strike', () => {
  for (const status of ['guarding', 'charging']) {
    let state = battle({ heroId: 'ninja', encounterId: 'golem', power: 2, skillTier: 2 });
    state = patchEnemy(state, state.enemies[0].uid, { [status]: true });
    const strike = useSkill(state, 'strike');
    assert.equal(strike.state.hero.openingUid, state.enemies[0].uid, status);
    assert.ok(strike.events.some((event) => event.type === 'opening'));
  }

  let state = battle({ heroId: 'ninja', encounterId: 'golem', power: 2, skillTier: 2 });
  const uid = state.enemies[0].uid;
  state = { ...state, hero: { ...state.hero, openingUid: uid } };
  const doubled = useSkill(state, 'doubleStrike', uid);
  assert.equal(damageTo(doubled.events, uid), 2 * (SKILLS.doubleStrike.damage + BALANCE.openingBonus));
  assert.equal(doubled.state.hero.openingUid, null);
  assert.ok(doubled.events.some((event) => event.type === 'opening-hit'));
});

test('Ninja Dodge fully avoids heavy damage, readies counter, and Shadow Strike chains only on a kill', () => {
  let state = battle({ heroId: 'ninja', encounterId: 'golem', power: 0, skillTier: 2 });
  const uid = state.enemies[0].uid;
  state = patchEnemy(state, uid, { intent: 'heavy', charging: true });
  const dodged = resolveEnemyPhase(useSkill(state, 'dodge').state, fixed(0.99));
  assert.equal(dodged.state.hero.hp, state.hero.hp);
  assert.equal(dodged.state.hero.counter, true);
  assert.ok(dodged.events.some((event) => event.type === 'damage' && event.target === 'hero' && event.amount === 0));

  state = battle({ heroId: 'ninja', encounterId: 'goblin-slime', power: 3, skillTier: 2 });
  const goblin = state.enemies[0].uid;
  const slime = state.enemies[1].uid;
  const chained = useSkill(state, 'shadowStrike', slime);
  assert.equal(chained.state.enemies.find((enemy) => enemy.uid === goblin).hp, ENEMIES.goblin.maxHp - SKILLS.shadowStrike.splashDamage);
  assert.ok(chained.events.some((event) => event.type === 'chain' && event.target === goblin));

  const boss = battle({ heroId: 'ninja', encounterId: 'golem', power: 3, skillTier: 2 });
  const single = useSkill(boss, 'shadowStrike');
  assert.equal(single.state.enemies[0].hp, ENEMIES.golem.maxHp - SKILLS.shadowStrike.damage);
  assert.ok(!single.events.some((event) => event.type === 'chain'));
});

test('boss phase 2 triggers once and deterministically changes cadence', () => {
  let state = battle({ encounterId: 'dragon', power: 6, skillTier: 2 });
  const uid = state.enemies[0].uid;
  state = patchEnemy(state, uid, { hp: 25 });
  const enraged = useSkill(state, 'powerSlash', uid);
  assert.equal(enraged.state.enemies[0].phase, 2);
  assert.equal(enraged.events.filter((event) => event.type === 'enrage').length, 1);
  const next = resolveEnemyPhase(enraged.state, fixed(0.99)).state;
  const later = useSkill(next, 'slash', uid);
  assert.equal(later.events.filter((event) => event.type === 'enrage').length, 0);

  const baseEnemy = { ...state.enemies[0], hp: state.enemies[0].maxHp, intent: 'attack', cadence: 1 };
  assert.equal(chooseEnemyIntent(state, { ...baseEnemy, phase: 1 }, fixed(0.99)), 'attack');
  assert.equal(chooseEnemyIntent(state, { ...baseEnemy, phase: 2 }, fixed(0.99)), 'charge');
});

test('Power is safe and Mage recovery stays bounded by enemy-created opportunities', () => {
  const zero = battle({ power: 0 });
  assert.equal(useSkill(zero, 'slash').state.power, 0);
  const rejected = useSkill(battle({ power: 1, skillTier: 1 }), 'powerSlash');
  assert.equal(rejected.state.power, 1);
  assert.equal(rejected.events[0].reason, 'unaffordable');

  let state = battle({ heroId: 'mage', encounterId: 'giant-golem', power: 0, skillTier: 2 });
  let gained = 0;
  let opportunities = 0;
  for (let turn = 0; turn < 30 && state.turn === 'player'; turn += 1) {
    const enemy = state.enemies.find((candidate) => candidate.hp > 0);
    state = patchEnemy(state, enemy.uid, { hp: enemy.maxHp });
    const driven = enemy.intent === 'heavy' || enemy.charging || enemy.tired;
    if (driven) opportunities += 1;
    let skillId = 'barrier';
    if (state.hero.hp < state.hero.maxHp / 2 && state.power >= SKILLS.heal.cost) skillId = 'heal';
    else if (enemy.tired) skillId = 'magicBolt';
    const player = useSkill(state, skillId, enemy.uid);
    gained += player.events.filter((event) => event.type === 'power').reduce((sum, event) => sum + event.amount, 0);
    const phase = resolveEnemyPhase(player.state, fixed(0.99));
    gained += phase.events.filter((event) => event.type === 'power').reduce((sum, event) => sum + event.amount, 0);
    state = phase.state;
  }
  assert.equal(state.turn, 'player');
  assert.ok(gained > 0);
  assert.ok(gained <= opportunities, `${gained} Power from ${opportunities} enemy-created opportunities`);
});

test('dead enemies never act and a heal intent fizzles instead of attacking', () => {
  let state = battle({ encounterId: 'goblin-slime', power: 0 });
  const [goblin, slime] = state.enemies;
  state = patchEnemy(state, goblin.uid, { hp: 0, intent: null });
  const phase = resolveEnemyPhase(useSkill(state, 'guard').state, fixed(0.99));
  assert.equal(phase.state.hero.hp, state.hero.hp - 1);
  assert.ok(!phase.events.some((event) => event.source === goblin.uid));
  assert.ok(phase.events.some((event) => event.type === 'attack' && event.source === slime.uid));

  state = battle({ encounterId: 'shield-goblin-healer', power: 0 });
  const healer = state.enemies.find((enemy) => enemy.id === 'healer');
  state = {
    ...state,
    enemies: state.enemies.map((enemy) => ({ ...enemy, intent: enemy.id === 'healer' ? 'heal' : 'guard' })),
  };
  const fizzle = resolveEnemyPhase(useSkill(state, 'guard').state, fixed(0.99));
  assert.equal(fizzle.state.hero.hp, state.hero.hp);
  assert.ok(fizzle.events.some((event) => event.type === 'heal' && event.source === healer.uid && event.amount === 0));
  assert.ok(!fizzle.events.some((event) => event.type === 'attack' && event.source === healer.uid));
});

test('zero Power cannot soft-lock any hero', () => {
  for (const heroId of ['fighter', 'mage', 'ninja']) for (const skillTier of [0, 1, 2]) {
    const skills = availableSkills(battle({ heroId, skillTier, power: 0 }));
    assert.ok(skills.some((skill) => skill.affordable && skill.cost === 0 && skill.kind === 'damage'), `${heroId} tier ${skillTier}`);
    assert.ok(skills.every((skill) => skill.affordable === (skill.cost === 0)));
  }
});

test('victory, defeat, fallback targeting, and campaign aggregation remain intact', () => {
  const won = useSkill(battle({ power: 2, skillTier: 1 }), 'powerSlash');
  assert.ok(isVictory(won.state));
  const fallback = useSkill(battle({ encounterId: 'goblin-slime' }), 'slash', 999);
  assert.equal(fallback.state.enemies[0].hp, 7);
  const lostStart = patchEnemy(battle({ heroHp: 1 }), 1, { intent: 'attack' });
  assert.ok(isDefeat(resolveEnemyPhase(useSkill(lostStart, 'slash').state, fixed(0.99)).state));

  const round = { mode: 1, items: [{ id: 'run' }, { id: 'jump' }], correctCount: 1, bestStreak: 1, missedIds: new Set(['jump']) };
  const campaign = recordStage(createCampaign('mage'), round, 'slime');
  assert.equal(retryPower(campaign.stageResults[0]), 5);
  const second = recordStage(campaign, { ...round, mode: 2, correctCount: 2, bestStreak: 2, missedIds: new Set(['run']) }, 'bat');
  assert.deepEqual(campaignSummary(second), { totalCorrect: 3, totalQuestions: 4, bestStreak: 2, missedIds: ['jump', 'run'] });
});

function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function supportRank(enemy) {
  return ENEMIES[enemy.id].ai.support ? 0 : 1;
}

function targetFor(state) {
  return state.enemies.filter((enemy) => enemy.hp > 0)
    .sort((a, b) => supportRank(a) - supportRank(b) || a.hp - b.hp || a.uid - b.uid)[0];
}

function skillValue(skill, state, target) {
  const data = SKILLS[skill.id];
  const alive = state.enemies.filter((enemy) => enemy.hp > 0);
  if (data.kind === 'damage') return data.target === 'all' ? data.damage * alive.length : Math.min(data.damage, target.hp);
  if (data.kind === 'doubleDamage') return Math.min(2 * data.damage, target.hp);
  if (data.kind === 'splitDamage') return Math.min(data.damage, target.hp) + (target.hp <= data.damage && alive.length > 1 ? data.splashDamage : 0);
  return 0;
}

function bestAttack(state, target) {
  return availableSkills(state)
    .filter((skill) => skill.affordable && ['damage', 'doubleDamage', 'splitDamage'].includes(skill.kind))
    .sort((a, b) => skillValue(b, state, target) - skillValue(a, state, target) || a.cost - b.cost)[0];
}

function naiveChoice(state) {
  const skills = availableSkills(state);
  const target = targetFor(state);
  if (state.heroId === 'mage' && state.hero.hp < state.hero.maxHp / 2) {
    const heal = skills.find((skill) => skill.id === 'heal' && skill.affordable);
    if (heal) return { skill: heal, target };
  }
  if (state.enemies.some((enemy) => enemy.hp > 0 && enemy.intent === 'heavy')) {
    return { skill: skills.find((candidate) => candidate.kind === 'defense'), target };
  }
  return { skill: bestAttack(state, target), target };
}

function smartChoice(state) {
  const skills = availableSkills(state);
  let target = targetFor(state);
  const heavy = state.enemies.find((enemy) => enemy.hp > 0 && enemy.intent === 'heavy');
  if (heavy) {
    target = heavy;
    if (state.heroId === 'fighter') {
      const breaker = skills.find((skill) => skill.id === 'powerSlash' && skill.affordable);
      if (breaker) return { skill: breaker, target };
      return { skill: skills.find((skill) => skill.id === 'guard'), target };
    }
    if (state.heroId === 'mage') {
      const heal = skills.find((skill) => skill.id === 'heal' && skill.affordable && state.hero.hp < state.hero.maxHp / 2);
      if (heal) return { skill: heal, target };
      const incoming = state.enemies.filter((enemy) => enemy.hp > 0 && ['attack', 'heavy', 'drain'].includes(enemy.intent))
        .reduce((sum, enemy) => sum + (enemy.intent === 'heavy' ? ENEMIES[enemy.id].heavy : ENEMIES[enemy.id].attack), 0);
      if (heavy.charging && state.hero.hp > incoming + 2) return { skill: skills.find((skill) => skill.id === 'magicBolt'), target };
      return { skill: skills.find((skill) => skill.id === 'barrier'), target };
    }
    return { skill: skills.find((skill) => skill.id === 'dodge'), target };
  }

  if (state.heroId === 'fighter') {
    const powerSlash = skills.find((skill) => skill.id === 'powerSlash' && skill.affordable);
    if (state.hero.combo && powerSlash) return { skill: powerSlash, target };
    const cleave = skills.find((skill) => skill.id === 'cleave' && skill.affordable);
    if (cleave && state.enemies.filter((enemy) => enemy.hp > 0).length >= 3) return { skill: cleave, target };
    return { skill: skills.find((skill) => skill.id === 'slash'), target };
  }
  if (state.heroId === 'mage') {
    const heal = skills.find((skill) => skill.id === 'heal' && skill.affordable && state.hero.hp < state.hero.maxHp / 2);
    if (heal) return { skill: heal, target };
    const exploit = state.enemies.filter((enemy) => enemy.hp > 0 && (enemy.charging || enemy.tired)).sort((a, b) => a.hp - b.hp)[0];
    if (exploit) return { skill: skills.find((skill) => skill.id === 'magicBolt'), target: exploit };
    return { skill: bestAttack(state, target), target };
  }

  const opening = state.enemies.find((enemy) => enemy.hp > 0 && enemy.uid === state.hero.openingUid);
  const double = skills.find((skill) => skill.id === 'doubleStrike' && skill.affordable);
  if (opening && double) return { skill: double, target: opening };
  const shadow = skills.find((skill) => skill.id === 'shadowStrike' && skill.affordable);
  const chainTarget = state.enemies.filter((enemy) => enemy.hp > 0 && enemy.hp <= SKILLS.shadowStrike.damage)
    .sort((a, b) => supportRank(a) - supportRank(b) || a.hp - b.hp)[0];
  if (shadow && chainTarget && state.enemies.filter((enemy) => enemy.hp > 0).length > 1) return { skill: shadow, target: chainTarget };
  const vulnerable = state.enemies.filter((enemy) => enemy.hp > 0 && (enemy.guarding || enemy.charging || enemy.tired || ['heal', 'summon'].includes(enemy.intent)))
    .sort((a, b) => supportRank(a) - supportRank(b) || a.hp - b.hp)[0];
  if (vulnerable) return { skill: skills.find((skill) => skill.id === 'strike'), target: vulnerable };
  return { skill: bestAttack(state, target), target };
}

function simulate(heroId, encounter, power, seed, policy) {
  const rng = seeded(seed);
  let state = createBattle({ heroId, encounterId: encounter.id, power, skillTier: skillTierForStage(encounter.tier), rng });
  let turns = 0;
  while (state.turn === 'player' && turns < 100) {
    const { skill, target } = policy(state);
    assert.ok(skill, `${heroId} ${encounter.id} has an action`);
    state = useSkill(state, skill.id, target.uid).state;
    turns += 1;
    if (state.turn === 'enemy') state = resolveEnemyPhase(state, rng).state;
  }
  return { state, turns, hp: state.hero.hp };
}

test('balance: naive Power 2 wins over several seeds and Power 7 stays in tier ranges', () => {
  const ranges = { 1: [2, 4], 2: [3, 6], 3: [4, 7], 4: [5, 9] };
  const seeds = [1, 7, 19, 41, 97];
  for (const heroId of ['fighter', 'mage', 'ninja']) for (const encounter of Object.values(ENCOUNTERS)) {
    for (const seed of seeds) {
      const low = simulate(heroId, encounter, 2, seed, naiveChoice);
      assert.equal(low.state.turn, 'won', `${heroId} ${encounter.id} at Power 2 seed ${seed}`);
    }
    const middle = simulate(heroId, encounter, 7, 23, naiveChoice);
    assert.equal(middle.state.turn, 'won', `${heroId} ${encounter.id} at Power 7`);
    assert.ok(middle.turns <= ranges[encounter.tier][1] + 1, `${heroId} ${encounter.id} at Power 7: ${middle.turns}`);
  }
});

test('balance: smart play beats naive play on tier 3-4 encounters in aggregate', () => {
  const hard = Object.values(ENCOUNTERS).filter((encounter) => encounter.tier >= 3);
  const seeds = [3, 11, 29, 53, 89];
  for (const heroId of ['fighter', 'mage', 'ninja']) {
    const totals = { naiveTurns: 0, smartTurns: 0, naiveHp: 0, smartHp: 0 };
    for (const encounter of hard) for (const seed of seeds) {
      const naive = simulate(heroId, encounter, 7, seed, naiveChoice);
      const smart = simulate(heroId, encounter, 7, seed, smartChoice);
      assert.equal(smart.state.turn, 'won', `${heroId} smart ${encounter.id} seed ${seed}`);
      totals.naiveTurns += naive.turns;
      totals.smartTurns += smart.turns;
      totals.naiveHp += naive.hp;
      totals.smartHp += smart.hp;
    }
    assert.ok(
      totals.smartTurns < totals.naiveTurns || totals.smartHp > totals.naiveHp,
      `${heroId}: smart ${totals.smartTurns} turns/${totals.smartHp} HP vs naive ${totals.naiveTurns}/${totals.naiveHp}`,
    );
  }
});
