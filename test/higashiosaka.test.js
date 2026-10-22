import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE, ENCOUNTERS, ENEMIES, SKILLS } from '../src/battle-data.js';
import { chooseEnemyIntent, createBattle, protectedUid, resolveEnemyPhase, useSkill } from '../src/battle-engine.js';

const rng = () => 0.99;
const battle = (encounterId = 'hig-1', options = {}) => createBattle({ heroId: 'mage', encounterId, level: 5, ap: 10, rng, ...options });
const patch = (state, uid, changes) => ({ ...state, enemies: state.enemies.map((enemy) => enemy.uid === uid ? { ...enemy, ...changes } : enemy) });
const phase = (state) => resolveEnemyPhase({ ...state, turn: 'enemy' }, rng);
const damage = (events, uid) => events.filter((event) => event.type === 'damage' && event.target === uid).reduce((sum, event) => sum + event.amount, 0);

// Exercise the actual city data while isolating the role under test from other threats.
const scene = (ids, options = {}) => {
  const pool = [1, 2, 3, 4].flatMap((stage) => [1, 2].map((startWave) => battle(`hig-${stage}`, { ...options, startWave }))).flatMap((state) => state.enemies);
  const enemies = ids.map((id, index) => ({ ...pool.find((enemy) => enemy.id === id), uid: 100 + index }));
  return { ...battle('hig-1', options), wave: 1, waveCount: 1, enemies, selectedUid: enemies[0].uid, nextUid: 100 + enemies.length };
};

test('Higashiosaka has four two-wave encounters with a fresh Core and no ally', () => {
  const names = [
    ['Core Under Attack', 'コアが ねらわれた'], ['Repair Crew', 'しゅうりはん'],
    ['Iron Foreman', 'てつの おやかた'], ['Siege Golem', 'こうじょう ゴーレム'],
  ];
  for (let stage = 1; stage <= 4; stage += 1) {
    const encounter = ENCOUNTERS[`hig-${stage}`];
    assert.equal(encounter.city, 'higashiosaka');
    assert.equal(encounter.stage, stage);
    assert.deepEqual([encounter.name, encounter.jaName], names[stage - 1]);
    assert.equal(encounter.ally, null);
    assert.equal(encounter.waves.length, 2);
    assert.deepEqual(encounter.enemyIds, encounter.waves[0].enemyIds);
    assert.ok(encounter.core.hp > 0);
    assert.deepEqual(battle(encounter.id).core, { hp: encounter.core.hp, maxHp: encounter.core.hp });
    for (const wave of encounter.waves) assert.ok(wave.enemyIds.length <= BALANCE.maxLivingEnemies);
  }
  assert.equal(ENCOUNTERS['hig-4'].music, 'boss');
  assert.ok(ENCOUNTERS['hig-4'].waves[1].enemyIds.includes('siegeGolem'));
  assert.ok(ENEMIES.guardianConstruct.large && ENEMIES.ironForeman.large && ENEMIES.siegeGolem.boss);
});

test('Saboteur attacks the Core while leaving the hero unharmed', () => {
  const initial = scene(['saboteur']);
  assert.equal(initial.enemies[0].intent, 'attack');
  assert.equal(initial.enemies[0].aim, 'core');
  const result = phase(initial);
  assert.equal(damage(result.events, 'core'), ENEMIES.saboteur.attack);
  assert.equal(result.state.core.hp, initial.core.hp - ENEMIES.saboteur.attack);
  assert.equal(result.state.hero.hp, initial.hero.hp);
  assert.equal(result.state.enemies[0].aim, 'core');
});

test('Goblin Sniper telegraphs Core Shot after its normal hero attacks, then hits the Core', () => {
  let state = scene(['goblinSniper']);
  assert.equal(ENEMIES.goblinSniper.heavyName, 'Core Shot');
  assert.equal(ENEMIES.goblinSniper.chargeLabel, 'AIMING AT CORE!');
  assert.equal(ENEMIES.goblinSniper.chargeLabelJa, 'コアを ねらっている！');
  for (let turn = 0; turn < ENEMIES.goblinSniper.ai.heavyEvery; turn += 1) {
    assert.equal(state.enemies[0].intent, 'attack');
    assert.equal(state.enemies[0].aim, 'hero');
    state = phase(state).state;
  }
  assert.equal(state.enemies[0].intent, 'charge');
  assert.equal(state.enemies[0].aim, 'core');
  const charging = phase(state);
  assert.equal(damage(charging.events, 'core'), 0);
  assert.equal(charging.state.enemies[0].intent, 'heavy');
  assert.equal(charging.state.enemies[0].aim, 'core');
  const result = phase(charging.state);
  assert.equal(damage(result.events, 'core'), ENEMIES.goblinSniper.heavy);
  assert.equal(damage(result.events, 'hero'), 0);
});

test('Guardian Construct protects a Core attacker, halves its damage and stops protecting when defeated', () => {
  const initial = scene(['guardianConstruct', 'saboteur']);
  const [construct, saboteur] = initial.enemies;
  assert.equal(ENEMIES.guardianConstruct.machine, true);
  assert.equal(ENEMIES.guardianConstruct.protects, 'coreAttackers');
  assert.equal(protectedUid(initial, construct.uid), saboteur.uid);
  const hit = useSkill(initial, 'magicBolt', saboteur.uid, rng);
  assert.equal(damage(hit.events, saboteur.uid), Math.ceil(SKILLS.magicBolt.damage / 2));
  assert.ok(hit.events.some((event) => event.type === 'protected' && event.by === construct.uid));
  const dead = patch(initial, construct.uid, { hp: 0 });
  assert.equal(protectedUid(dead, construct.uid), null);
  assert.equal(damage(useSkill(dead, 'magicBolt', saboteur.uid, rng).events, saboteur.uid), SKILLS.magicBolt.damage);
  const foreman = battle('hig-3', { startWave: 2 });
  assert.equal(protectedUid(foreman), foreman.enemies.find((enemy) => enemy.id === 'ironForeman').uid, 'a heavyAim attacker counts even during a normal attack');
});

test('Engineer and Foreman telegraph repair only for other damaged living machines', () => {
  for (const repairerId of ['engineerGoblin', 'ironForeman']) {
    let initial = scene([repairerId, 'guardianConstruct', 'saboteur', 'siegeGolem']);
    const [repairer, machine, organic, deadMachine] = initial.enemies;
    assert.equal(ENEMIES[repairerId].ai.support, 'repair');
    initial = patch(initial, repairer.uid, { hp: 1, intent: 'attack', cadence: 0 });
    initial = patch(initial, organic.uid, { hp: 1 });
    initial = patch(initial, deadMachine.uid, { hp: 0 });
    assert.equal(chooseEnemyIntent(initial, initial.enemies[0], rng), 'attack', 'self, organics and dead machines are ineligible');
    const missing = Math.min(10, machine.maxHp - 1);
    initial = patch(initial, machine.uid, { hp: machine.maxHp - missing });
    assert.equal(chooseEnemyIntent(initial, initial.enemies[0], rng), 'repair');
    assert.equal(initial.enemies[1].hp, machine.maxHp - missing, 'choosing the telegraph does not heal');
    const result = phase(patch(initial, repairer.uid, { intent: 'repair' }));
    const amount = Math.min(ENEMIES[repairerId].repair, missing);
    assert.deepEqual(result.events.find((event) => event.type === 'repair'), { type: 'repair', source: repairer.uid, target: machine.uid, amount });
    assert.equal(result.state.enemies[1].hp, machine.maxHp - missing + amount);
    assert.equal(result.state.enemies[0].hp, 1);
    assert.equal(result.state.enemies[2].hp, 1);
    assert.equal(result.state.enemies[3].hp, 0);
  }
});

test('the finale Engineer repairs the Siege Golem, including its angry phase', () => {
  let initial = battle('hig-4', { startWave: 2 });
  const [engineer, golem] = initial.enemies;
  assert.equal(ENEMIES.siegeGolem.machine, true);
  initial = patch(initial, golem.uid, { hp: Math.floor(golem.maxHp / 2), phase: 2 });
  assert.equal(chooseEnemyIntent(initial, initial.enemies[0], rng), 'repair');
  const result = phase(patch(initial, engineer.uid, { intent: 'repair' }));
  assert.deepEqual(result.events.find((event) => event.type === 'repair'), { type: 'repair', source: engineer.uid, target: golem.uid, amount: ENEMIES.engineerGoblin.repair });
});

test('Siege Golem enrages once at half HP, charges sooner and no longer rests', () => {
  let initial = scene(['siegeGolem'], { heroId: 'fighter' });
  const golem = initial.enemies[0];
  const ai = ENEMIES.siegeGolem.ai;
  assert.equal(ai.phase2.at, 0.5);
  assert.equal(ai.phase2.message, '💢 SIEGE GOLEM IS ANGRY!');
  assert.equal(chooseEnemyIntent(initial, { ...golem, intent: 'heavy' }, rng), 'rest');
  assert.equal(chooseEnemyIntent(initial, { ...golem, intent: 'attack', cadence: ai.phase2.heavyEvery }, rng), 'attack');
  initial = patch(initial, golem.uid, { hp: Math.floor(golem.maxHp * ai.phase2.at) + 1 });
  const hit = useSkill(initial, 'slash', golem.uid, rng);
  assert.equal(hit.state.enemies[0].phase, 2);
  assert.deepEqual(hit.events.filter((event) => event.type === 'enrage'), [{ type: 'enrage', target: golem.uid, message: ai.phase2.message }]);
  const angry = hit.state.enemies[0];
  assert.equal(chooseEnemyIntent(hit.state, { ...angry, intent: 'attack', cadence: ai.phase2.heavyEvery }, rng), 'charge');
  assert.equal(chooseEnemyIntent(hit.state, { ...angry, intent: 'heavy' }, rng), 'attack');
  const again = useSkill({ ...hit.state, turn: 'player' }, 'slash', golem.uid, rng);
  assert.ok(!again.events.some((event) => event.type === 'enrage'));
});
