import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE, ENCOUNTERS, ENEMIES, SKILLS } from '../src/battle-data.js';
import {
  chooseEnemyIntent, coreChargeDue, coreThreats, createBattle, isDefeat,
  protectedUid, resolveEnemyPhase, useSkill,
} from '../src/battle-engine.js';
import { battleSetup, createCampaign, recordDefeat, recordStage } from '../src/campaign.js';

const rng = () => 0.99;
const fixtureIds = ['slime', 'goblin', 'golem', 'healer', 'armoredOrc', 'dragon', 'bat', 'wolf'];
const replace = (target, value) => {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, value);
};

// The registry's mutable entries are borrowed only inside a test. All roles and
// numbers below belong to this fixture; no new city data enters the game.
function fixture(run, { ids = ['slime'], encounter = {}, enemies = {} } = {}) {
  const priorEncounter = { ...ENCOUNTERS.slime };
  const priorEnemies = fixtureIds.map((id) => [id, { ...ENEMIES[id] }]);
  try {
    replace(ENCOUNTERS.slime, { id: 'slime', enemyIds: ids, core: { hp: 30 }, ...encounter });
    for (const id of fixtureIds) replace(ENEMIES[id], {
      id, name: `Test ${id}`, jaName: 'テスト', maxHp: 80, attack: 6, xp: 0, ai: {}, ...enemies[id],
    });
    return run();
  } finally {
    replace(ENCOUNTERS.slime, priorEncounter);
    for (const [id, data] of priorEnemies) replace(ENEMIES[id], data);
  }
}

const battle = (options = {}) => createBattle({ heroId: 'mage', encounterId: 'slime', level: 5, ap: 5, rng, ...options });
const phase = (state) => resolveEnemyPhase({ ...state, turn: 'enemy' }, rng);
const patchEnemy = (state, uid, changes) => ({
  ...state, enemies: state.enemies.map((enemy) => enemy.uid === uid ? { ...enemy, ...changes } : enemy),
});
const damage = (events, target) => events.filter((event) => event.type === 'damage' && event.target === target);
const coreAp = (events) => events.filter((event) => event.type === 'ap' && event.reason === 'core');

test('encounters without a Core keep hero damage and always choose hero aim', () => fixture(() => {
  const initial = battle();
  assert.equal(initial.core, null);
  assert.equal(initial.enemies[0].aim, 'hero');
  assert.deepEqual(coreThreats(initial), []);
  assert.equal(coreChargeDue({ ...initial, round: 3 }), false);
  const next = phase(initial);
  assert.equal(next.state.hero.hp, initial.hero.hp - 6);
  assert.equal(next.state.core, null);
  assert.deepEqual(damage(next.events, 'core'), []);
  assert.deepEqual(coreAp(next.events), []);
}, { encounter: { core: undefined }, enemies: { slime: { aim: 'core' } } }));

test('aim is stored with its telegraph and stays fixed until the next intent is chosen', () => fixture(() => {
  const initial = battle();
  const attacker = initial.enemies[0];
  assert.equal(attacker.intent, 'attack');
  assert.equal(attacker.aim, 'core');
  assert.deepEqual(coreThreats(initial), [attacker]);
  ENEMIES.slime.aim = 'hero';
  const hit = useSkill(initial, 'magicBolt', attacker.uid, rng);
  assert.equal(hit.state.enemies[0].aim, 'core', 'player damage must not retarget the telegraph');
  const acted = resolveEnemyPhase(hit.state, rng);
  assert.equal(damage(acted.events, 'core')[0].source, attacker.uid);
  assert.deepEqual(damage(acted.events, 'hero'), []);
  assert.equal(acted.state.enemies[0].aim, 'hero', 'the following telegraph reads the current data');
  assert.deepEqual(coreThreats(patchEnemy(initial, attacker.uid, { hp: 0 })), []);
}, { enemies: { slime: { aim: 'core' } } }));

test('heavyAim targets charge and heavy at the Core, normal attacks at the hero, including enrage', () => fixture(() => {
  const initial = battle();
  assert.equal(initial.enemies[0].aim, 'hero');
  const charge = phase(initial);
  assert.equal(charge.state.enemies[0].intent, 'charge');
  assert.equal(charge.state.enemies[0].aim, 'core');
  const heavy = phase(charge.state);
  assert.equal(heavy.state.enemies[0].intent, 'heavy');
  assert.equal(heavy.state.enemies[0].aim, 'core');
  const nearEnrage = patchEnemy(heavy.state, heavy.state.enemies[0].uid, { hp: 42 });
  const enraged = useSkill(nearEnrage, 'magicBolt', nearEnrage.selectedUid, rng);
  assert.equal(enraged.state.enemies[0].phase, 2);
  assert.equal(enraged.state.enemies[0].intent, 'heavy');
  assert.equal(enraged.state.enemies[0].aim, 'core');
  const acted = resolveEnemyPhase(enraged.state, rng);
  assert.equal(damage(acted.events, 'core')[0].amount, 12);
  assert.equal(acted.state.enemies[0].aim, 'hero');
}, { enemies: { slime: { heavy: 12, heavyAim: 'core', ai: { heavyEvery: 1, rests: true, phase2: { at: 0.5, heavyEvery: 2 } } } } }));

test('Guard and Barrier cover Core hits and refund a heavy only once per phase', () => {
  for (const [heroId, skill, multiplier] of [['fighter', 'guard', 0.25], ['mage', 'barrier', BALANCE.barrierMultiplier]]) {
    fixture(() => {
      let initial = battle({ heroId });
      initial = { ...initial, enemies: initial.enemies.map((enemy) => ({ ...enemy, intent: 'heavy' })) };
      const defended = useSkill(initial, skill, initial.selectedUid, rng);
      const result = resolveEnemyPhase(defended.state, rng);
      assert.equal(initial.core.hp - result.state.core.hp, 2 * Math.ceil(12 * multiplier), heroId);
      assert.equal(result.state.hero.hp, initial.hero.hp, heroId);
      assert.deepEqual(damage(result.events, 'core').map(({ amount }) => amount), [Math.ceil(12 * multiplier), Math.ceil(12 * multiplier)]);
      assert.equal(result.events.filter((event) => event.type === 'ap' && event.reason === 'defense').length, 1);
      assert.equal(result.state.ap, initial.ap - SKILLS[skill].cost + BALANCE.defenseAp);
    }, { ids: ['slime', 'goblin'], enemies: { slime: { aim: 'core', heavy: 12 }, goblin: { aim: 'core', heavy: 12 } } });
  }
});

test('Dodge shares its first normal-hit avoidance across hero and Core, and avoids Core heavies', () => fixture(() => {
  const initial = battle({ heroId: 'ninja' });
  const result = resolveEnemyPhase(useSkill(initial, 'dodge', initial.selectedUid, rng).state, rng);
  assert.equal(damage(result.events, 'hero')[0].amount, 0);
  assert.equal(damage(result.events, 'core')[0].amount, Math.ceil(6 * BALANCE.dodgeRestMultiplier));
  const reversed = { ...initial, enemies: [...initial.enemies].reverse() };
  const reverseResult = resolveEnemyPhase(useSkill(reversed, 'dodge', reversed.selectedUid, rng).state, rng);
  assert.equal(damage(reverseResult.events, 'core')[0].amount, 0);
  assert.equal(damage(reverseResult.events, 'hero')[0].amount, Math.ceil(6 * BALANCE.dodgeRestMultiplier));
  const heavy = patchEnemy(initial, initial.enemies[1].uid, { intent: 'heavy' });
  const heavyResult = resolveEnemyPhase(useSkill(heavy, 'dodge', heavy.selectedUid, rng).state, rng);
  assert.equal(damage(heavyResult.events, 'core')[0].amount, 0);
  assert.ok(!heavyResult.events.some((event) => event.type === 'ap' && event.reason === 'defense'));
}, { ids: ['goblin', 'slime'], enemies: { slime: { aim: 'core', heavy: 12 } } }));

test('ally protection reduces hero damage but never reduces Core damage', () => fixture(() => {
  const initial = battle({ heroHp: 1 });
  const result = phase(initial);
  assert.ok(result.events.some((event) => event.type === 'allyProtect'));
  assert.equal(damage(result.events, 'core')[0].amount, 6);
  assert.equal(result.state.hero.hp, 1);
}, { encounter: { ally: { id: 'osakaDefender', joinsAtWave: 1 } }, enemies: { slime: { aim: 'core' } } }));

test('a broken Core loses immediately, before later enemies can act', () => fixture(() => {
  const initial = battle();
  const result = phase(initial);
  assert.equal(result.state.core.hp, 0);
  assert.equal(result.state.turn, 'lost');
  assert.equal(isDefeat(result.state), true);
  assert.deepEqual(result.events.at(-1), { type: 'lost', reason: 'core' });
  assert.equal(result.state.hero.hp, initial.hero.hp, 'the following hero attack never acts');
  assert.ok(!result.events.some((event) => event.source === initial.enemies[1].uid));
  assert.ok(!result.events.some((event) => ['waveStart', 'victory'].includes(event.type)));
}, { ids: ['slime', 'goblin'], encounter: { core: { hp: 6 } }, enemies: { slime: { aim: 'core' }, goblin: { attack: 100 } } }));

test('new battles and campaign retries start with a full Core and unchanged retry assist', () => fixture(() => {
  const campaign = recordStage(createCampaign('mage'), {
    mode: 1, items: [{}], correctCount: 1, bestStreak: 1, missedIds: new Set(),
  }, 'slime');
  const initial = createBattle({ ...battleSetup(campaign), rng });
  const damaged = phase(initial);
  assert.equal(damaged.state.core.hp, 24);
  assert.deepEqual(initial.core, { hp: 30, maxHp: 30 }, 'resolution leaves its input untouched');
  const retry = createBattle({ ...battleSetup(recordDefeat(campaign)), rng });
  assert.deepEqual(retry.core, { hp: 30, maxHp: 30 });
  assert.equal(retry.ap, initial.ap + BALANCE.retryApBonus);
  assert.deepEqual(battle().core, { hp: 30, maxHp: 30 });
  assert.ok(!Object.hasOwn(battleSetup(campaign), 'core'), 'the campaign carries no Core HP');
}, { enemies: { slime: { aim: 'core' } } }));

test('waves preserve Core HP and the third player turn charges on wave arrival', () => fixture(() => {
  let initial = battle({ ap: 0 });
  initial = { ...initial, ap: 3, round: 2, core: { ...initial.core, hp: 23 } };
  initial = patchEnemy(initial, initial.enemies[0].uid, { hp: 1 });
  const next = useSkill(initial, 'magicBolt', initial.selectedUid, rng);
  assert.equal(next.state.wave, 2);
  assert.equal(next.state.round, 3);
  assert.equal(next.state.turn, 'player');
  assert.deepEqual(next.state.core, { hp: 23, maxHp: 30 });
  assert.equal(coreAp(next.events).length, 1);
  assert.equal(coreAp(next.events)[0].amount, 1);
  assert.equal(next.state.ap, 3 - SKILLS.magicBolt.cost + BALANCE.waveClearAp + 1);
}, { encounter: { waves: [{ enemyIds: ['slime'] }, { enemyIds: ['goblin'] }] } }));

test('Core charge occurs every third player turn only strictly above half HP', () => fixture(() => {
  const initial = battle();
  const snapshot = structuredClone(initial);
  for (const round of [1, 2, 4, 5]) assert.equal(coreChargeDue({ ...initial, round }), false);
  for (const round of [3, 6, 9]) assert.equal(coreChargeDue({ ...initial, round }), true);
  assert.equal(coreChargeDue({ ...initial, round: 3, turn: 'enemy' }), false);
  for (const hp of [0, 14, 15]) assert.equal(coreChargeDue({ ...initial, round: 3, core: { hp, maxHp: 30 } }), false);
  assert.equal(coreChargeDue({ ...initial, round: 3, core: { hp: 16, maxHp: 30 } }), true);
  const third = phase(phase(initial).state);
  assert.equal(third.state.round, 3);
  assert.equal(coreAp(third.events).length, 1);
  assert.equal(third.state.ap, initial.ap + 1);
  const low = phase({ ...initial, round: 2, core: { hp: 15, maxHp: 30 } });
  assert.deepEqual(coreAp(low.events), []);
  coreThreats(initial);
  assert.deepEqual(initial, snapshot, 'helpers and phase resolution leave the input unchanged');
}, { enemies: { slime: { attack: 0 } } }));

test('Core charge honours encounter cadence and health threshold', () => fixture(() => {
  const initial = battle();
  assert.equal(coreChargeDue({ ...initial, round: 2, core: { hp: 22, maxHp: 30 } }), false);
  assert.equal(coreChargeDue({ ...initial, round: 2, core: { hp: 23, maxHp: 30 } }), true);
  assert.equal(coreChargeDue({ ...initial, round: 3 }), false);
  const second = phase(initial);
  assert.equal(coreAp(second.events).length, 1);
}, { encounter: { coreChargeEvery: 2, coreChargeAbove: 0.75 }, enemies: { slime: { attack: 0 } } }));

test('Core charge checks HP after damage and respects the AP cap', () => fixture(() => {
  const initial = battle();
  const half = phase({ ...initial, round: 2, core: { hp: 21, maxHp: 30 } });
  assert.equal(half.state.core.hp, 15);
  assert.deepEqual(coreAp(half.events), [], 'damage at the end of turn two can stop the turn-three charge');
  const capped = phase({ ...initial, ap: BALANCE.maxAp, round: 2 });
  assert.equal(capped.state.ap, BALANCE.maxAp);
  assert.deepEqual(coreAp(capped.events), []);
}, { enemies: { slime: { aim: 'core' } } }));

test('the debug Core override starts full on every attempt without altering encounter data', () => fixture(() => {
  const config = { core: { hp: 30 } };
  const initial = battle(config);
  assert.deepEqual(initial.core, { hp: 30, maxHp: 30 });
  assert.equal(phase(initial).state.core.hp, 24);
  assert.deepEqual(battle(config).core, { hp: 30, maxHp: 30 });
  assert.equal(ENCOUNTERS.slime.core, undefined);
  assert.deepEqual(config.core, { hp: 30 });
}, { encounter: { core: undefined }, enemies: { slime: { aim: 'core' } } }));

test('coreAttackers protectors prioritise data-defined Core attackers, then distinct bosses', () => fixture(() => {
  const initial = battle();
  const [boss, protector, attacker, heavyAttacker] = initial.enemies;
  assert.equal(protectedUid(initial, protector.uid), attacker.uid, 'a lower UID boss does not outrank a Core attacker');
  const firstDead = patchEnemy(initial, attacker.uid, { hp: 0 });
  assert.equal(protectedUid(firstDead, protector.uid), heavyAttacker.uid, 'heavyAim data counts even during a hero-aimed normal attack');
  const attackersDead = patchEnemy(firstDead, heavyAttacker.uid, { hp: 0 });
  assert.equal(protectedUid(attackersDead, protector.uid), boss.uid);
  assert.equal(protectedUid(patchEnemy(attackersDead, boss.uid, { hp: 0 }), protector.uid), null);
  const hit = useSkill(initial, 'magicBolt', attacker.uid, rng);
  assert.equal(damage(hit.events, attacker.uid)[0].amount, Math.ceil(SKILLS.magicBolt.damage / 2));
  const multiple = { ...initial, enemies: [...initial.enemies, { ...protector, uid: 9 }] };
  assert.equal(protectedUid(multiple, protector.uid), attacker.uid);
  assert.equal(protectedUid(multiple, 9), heavyAttacker.uid, 'protectors never cover the same attacker');
}, { ids: ['dragon', 'armoredOrc', 'slime', 'golem'], enemies: {
  dragon: { boss: true }, armoredOrc: { protector: true, protects: 'coreAttackers' },
  slime: { aim: 'core' }, golem: { heavyAim: 'core' },
} }));

test('repair is telegraphed only for another damaged living machine and heals only that machine', () => fixture(() => {
  let initial = battle();
  const [repairer, machine, organic, deadMachine] = initial.enemies;
  assert.equal(repairer.intent, 'attack', 'full machines do not need repair');
  initial = patchEnemy(initial, repairer.uid, { hp: 1 });
  initial = patchEnemy(initial, organic.uid, { hp: 1 });
  initial = patchEnemy(initial, deadMachine.uid, { hp: 0 });
  assert.equal(chooseEnemyIntent(initial, initial.enemies[0], rng), 'attack', 'self, organic and dead machines are ineligible');
  initial = patchEnemy(initial, machine.uid, { hp: 77, intent: 'rest' });
  assert.equal(chooseEnemyIntent(initial, initial.enemies[0], rng), 'repair');
  initial = patchEnemy(initial, repairer.uid, { intent: 'repair' });
  assert.equal(initial.enemies[1].hp, 77, 'selection does not heal');
  const result = phase(initial);
  assert.deepEqual(result.events.find((event) => event.type === 'repair'), { type: 'repair', source: repairer.uid, target: machine.uid, amount: 3 });
  assert.equal(result.state.enemies[1].hp, 80, 'repair caps at machine max HP');
  assert.equal(result.state.enemies[0].hp, 1);
  assert.equal(result.state.enemies[2].hp, 1);
  assert.equal(result.state.enemies[3].hp, 0);
  const moreDamaged = phase(patchEnemy(initial, machine.uid, { hp: 60 }));
  assert.equal(moreDamaged.events.find((event) => event.type === 'repair').amount, 5, 'repair uses the enemy data amount');
}, { ids: ['healer', 'golem', 'goblin', 'bat'], enemies: {
  healer: { machine: true, repair: 5, ai: { support: 'repair' } }, golem: { machine: true }, bat: { machine: true },
} }));

test('Ninja Strike creates an opening against a repair telegraph', () => fixture(() => {
  let initial = battle({ heroId: 'ninja' });
  initial = patchEnemy(initial, initial.enemies[1].uid, { hp: 60 });
  assert.equal(chooseEnemyIntent(initial, initial.enemies[0], rng), 'repair');
  initial = patchEnemy(initial, initial.enemies[0].uid, { intent: 'repair' });
  const hit = useSkill(initial, 'strike', initial.selectedUid, rng);
  assert.equal(hit.state.hero.openingUid, initial.selectedUid);
  assert.ok(hit.events.some((event) => event.type === 'opening' && event.target === initial.selectedUid));
}, { ids: ['healer', 'golem'], enemies: { healer: { repair: 5, ai: { support: 'repair' } }, golem: { machine: true } } }));

test('Power Slash breaks a Core-aimed heavy before it can damage the Core', () => fixture(() => {
  const initial = battle({ heroId: 'fighter' });
  const charge = phase(initial);
  const heavy = phase(charge.state);
  assert.equal(heavy.state.enemies[0].intent, 'heavy');
  assert.equal(heavy.state.enemies[0].aim, 'core');
  const broken = useSkill(heavy.state, 'powerSlash', heavy.state.selectedUid, rng);
  assert.ok(broken.events.some((event) => event.type === 'break' && event.target === initial.selectedUid));
  assert.equal(broken.state.enemies[0].intent, 'rest');
  const result = resolveEnemyPhase(broken.state, rng);
  assert.equal(result.state.core.hp, 30);
  assert.deepEqual(damage(result.events, 'core'), []);
}, { enemies: { slime: { heavy: 12, heavyAim: 'core', ai: { heavyEvery: 1, rests: true } } } }));
