import test from 'node:test';
import assert from 'node:assert/strict';
import { ALLIES, BALANCE, ENCOUNTERS, ENEMIES, SKILLS } from '../src/battle-data.js';
import { battleXp, chooseEnemyIntent, createBattle, protectedUid, resolveEnemyPhase, useSkill } from '../src/battle-engine.js';

const rng = () => 0.99;
const battle = (encounterId = 'yao-1', options = {}) => createBattle({ heroId: 'mage', encounterId, level: 5, ap: 10, rng, ...options });
const patch = (state, uid, changes) => ({ ...state, enemies: state.enemies.map((enemy) => enemy.uid === uid ? { ...enemy, ...changes } : enemy) });
const alone = (state, id) => {
  const next = { ...state, wave: 1, waveCount: 1, enemies: state.enemies.filter((enemy) => enemy.id === id), selectedUid: state.enemies.find((enemy) => enemy.id === id).uid };
  return { ...next, enemies: next.enemies.map((enemy) => ({ ...enemy, intent: chooseEnemyIntent(next, enemy, rng) })) };
};
const phase = (state) => resolveEnemyPhase({ ...state, turn: 'enemy' }, rng);
/** A battle showing exactly these enemies (ids from any Yao wave), intents re-chosen. */
const scene = (ids, options = {}) => {
  const pool = ['yao-1', 'yao-2', 'yao-3', 'yao-4'].flatMap((id) => [1, 2].map((startWave) => battle(id, { ...options, startWave }))).flatMap((state) => state.enemies);
  const base = battle('yao-3', { ...options, startWave: 2 });
  const enemies = ids.map((id, index) => ({ ...pool.find((enemy) => enemy.id === id), uid: 100 + index }));
  const next = { ...base, enemies, selectedUid: enemies[0].uid, nextUid: 100 + enemies.length };
  return { ...next, enemies: next.enemies.map((enemy) => ({ ...enemy, intent: chooseEnemyIntent(next, enemy, rng) })) };
};
const damage = (events, uid) => events.filter((event) => event.type === 'damage' && event.target === uid).reduce((sum, event) => sum + event.amount, 0);

test('Yao has four city encounters, two capped waves each and no ally', () => {
  for (let stage = 1; stage <= 4; stage += 1) {
    const encounter = ENCOUNTERS[`yao-${stage}`];
    assert.equal(encounter.city, 'yao');
    assert.equal(encounter.stage, stage);
    assert.equal(encounter.ally, null);
    assert.equal(encounter.waves.length, 2);
    assert.deepEqual(encounter.enemyIds, encounter.waves[0].enemyIds);
    for (const wave of encounter.waves) assert.ok(wave.enemyIds.length <= BALANCE.maxLivingEnemies);
  }
  assert.ok(ENCOUNTERS['yao-4'].waves[1].enemyIds.includes('warcaller'));
  assert.ok(ENCOUNTERS['yao-3'].waves[1].enemyIds.includes('signalCaptain'));
  // Roles stay real threats; difficulty comes from behaviour (balance tests guard the totals).
  assert.ok(ENEMIES.armoredOrc.attack >= 2 && ENEMIES.armoredOrc.maxHp >= 12);
  assert.ok(ENEMIES.signalCaptain.heavy >= 12 && ENEMIES.warcaller.heavy >= 12 && ENEMIES.warcaller.attack >= 3);
  for (const id of ['yao-3', 'yao-4']) for (const wave of ENCOUNTERS[id].waves) assert.ok(wave.callBudget >= 2);
});

test('next waves initialise fresh caller counters and bomb fuses before the player turn', () => {
  for (const encounterId of ['yao-1', 'yao-2']) {
    const initial = battle(encounterId);
    const clear = useSkill({ ...initial, callBudget: 0, enemies: initial.enemies.map((enemy) => ({ ...enemy, hp: 1 })) }, 'fireball', initial.selectedUid, rng);
    assert.equal(clear.state.wave, 2);
    assert.equal(clear.state.turn, 'player');
    const caller = clear.state.enemies.find((enemy) => enemy.id === 'hornGoblin');
    assert.equal(caller.callWait, ENEMIES.hornGoblin.ai.firstCall);
    assert.equal(caller.calls, 0);
    assert.equal(caller.intent, 'attack', 'three living enemies block calls on the new wave');
    assert.equal(clear.state.callBudget, ENCOUNTERS[encounterId].waves[1].callBudget ?? 3);
    const bomb = clear.state.enemies.find((enemy) => enemy.id === 'bombSlime');
    if (bomb) {
      assert.equal(bomb.fuse, ENEMIES.bombSlime.fuse);
      assert.equal(bomb.intent, 'fuse');
    }
  }
});

test('a call is visible before the player acts; arrival is summoned, gives no XP and waits to act', () => {
  const initial = alone(battle(), 'hornGoblin');
  const caller = initial.enemies.find((enemy) => enemy.id === 'hornGoblin');
  assert.equal(caller.intent, 'call');
  assert.equal(caller.callWait, 0);
  assert.equal(caller.calls, 0);
  assert.equal(initial.enemies.length, 1, 'the telegraph has not added an enemy');
  const result = phase(initial);
  const event = result.events.find((candidate) => candidate.type === 'call');
  assert.deepEqual(event, { type: 'call', source: caller.uid, targets: [initial.nextUid] });
  const added = result.state.enemies.find((enemy) => enemy.uid === event.targets[0]);
  assert.equal(added.id, 'goblin');
  assert.equal(added.summoned, true);
  assert.equal(result.state.callBudget, initial.callBudget - 1);
  assert.ok(!result.events.some((candidate) => candidate.source === added.uid), 'arrival does not attack');
  assert.ok(added.intent, 'the next phase has a chosen intent');
  assert.equal(battleXp({ ...result.state, enemies: [{ ...added, hp: 0 }] }), 0);
  assert.ok(phase(result.state).events.some((candidate) => candidate.source === added.uid), 'arrival acts next phase');
});

test('killing a caller on the player turn stops its pending call', () => {
  const initial = alone(battle('yao-1', { heroId: 'fighter' }), 'hornGoblin');
  const caller = initial.enemies.find((enemy) => enemy.id === 'hornGoblin');
  const killed = useSkill(initial, 'powerSlash', caller.uid, rng);
  assert.equal(killed.state.enemies.find((enemy) => enemy.uid === caller.uid).hp, 0);
  const result = resolveEnemyPhase(killed.state, rng);
  assert.ok(!result.events.some((event) => event.type === 'call'));
  assert.equal(result.state.nextUid, initial.nextUid);
});

test('three or more living enemies block call selection and resolution', () => {
  let state = scene(['armoredOrc', 'signalCaptain', 'shadowArcher']);
  const captain = state.enemies.find((enemy) => enemy.id === 'signalCaptain');
  assert.equal(chooseEnemyIntent(state, { ...captain, callWait: 0 }, rng), 'attack');
  state = patch(state, captain.uid, { intent: 'call', callWait: 0 });
  const result = phase(state);
  assert.equal(result.state.enemies.filter((enemy) => enemy.hp > 0).length, 3);
  assert.equal(result.state.nextUid, state.nextUid);
  assert.equal(result.state.callBudget, state.callBudget);
  assert.deepEqual(result.events.find((event) => event.type === 'call').targets, []);
});

test('a multi-enemy call adds at most the remaining budget and stops when spent', () => {
  let state = alone(battle('yao-3', { startWave: 2 }), 'signalCaptain');
  const captain = state.enemies[0];
  assert.equal(state.callBudget, ENCOUNTERS['yao-3'].waves[1].callBudget ?? 3);
  state = patch({ ...state, callBudget: 1 }, captain.uid, { intent: 'call', callWait: 0 });
  const result = phase(state);
  assert.equal(result.events.find((event) => event.type === 'call').targets.length, 1);
  assert.equal(result.state.callBudget, 0);
  const ready = { ...result.state.enemies[0], intent: 'attack', cadence: 0, callWait: 0 };
  assert.equal(chooseEnemyIntent(result.state, ready, rng), 'attack');
  const forced = phase(patch(result.state, captain.uid, { intent: 'call', callWait: 0 }));
  assert.equal(forced.state.nextUid, result.state.nextUid);
  assert.equal(forced.state.callBudget, 0);
  assert.deepEqual(forced.events.find((event) => event.type === 'call').targets, []);
});

test('a call from two living enemies respects the field cap', () => {
  const state = { ...scene(['signalCaptain', 'shadowArcher']), callBudget: 3 };
  const captain = state.enemies.find((enemy) => enemy.id === 'signalCaptain');
  const result = phase(patch(state, captain.uid, { intent: 'call', callWait: 0 }));
  assert.equal(result.events.find((event) => event.type === 'call').targets.length, 2);
  assert.equal(result.state.enemies.filter((enemy) => enemy.hp > 0).length, BALANCE.maxLivingEnemies);
  assert.equal(result.state.callBudget, state.callBudget - 2);
});

test('caller cadence and individual maximum calls still apply within the wave budget', () => {
  let state = alone(battle(), 'hornGoblin');
  const caller = state.enemies[0];
  const actions = [];
  for (let turn = 0; turn < 10; turn += 1) {
    actions.push(state.enemies.find((enemy) => enemy.uid === caller.uid).intent);
    const step = phase(state);
    state = { ...step.state, hero: { ...step.state.hero, hp: step.state.hero.maxHp }, enemies: step.state.enemies.filter((enemy) => !enemy.summoned) };
  }
  assert.deepEqual(actions.slice(0, 4), ['call', 'attack', 'attack', 'call']);
  assert.equal(actions.filter((action) => action === 'call').length, ENEMIES.hornGoblin.ai.maxCalls);
  assert.equal(state.enemies[0].calls, ENEMIES.hornGoblin.ai.maxCalls);
});

test('caller heavy charge and heavy take priority before the pending call', () => {
  const state = alone(battle('yao-3', { startWave: 2 }), 'signalCaptain');
  const caller = { ...state.enemies[0], callWait: 0, intent: 'attack', cadence: ENEMIES.signalCaptain.ai.heavyEvery };
  assert.equal(chooseEnemyIntent(state, caller, rng), 'charge');
  assert.equal(chooseEnemyIntent(state, { ...caller, intent: 'charge' }, rng), 'heavy');
  // The Captain rests after a heavy (rests: true), then the pending call comes.
  assert.equal(chooseEnemyIntent(state, { ...caller, intent: 'heavy', cadence: 0 }, rng), 'rest');
  assert.equal(chooseEnemyIntent(state, { ...caller, intent: 'rest', cadence: 0 }, rng), 'call');
});

test('bomb counts down 3 to 2 to boom at 1, explodes once and gives no XP', () => {
  const initial = alone(battle('yao-2'), 'bombSlime');
  assert.equal(initial.enemies[0].fuse, 3);
  assert.equal(initial.enemies[0].intent, 'fuse');
  const second = phase(initial);
  assert.deepEqual(second.events, [{ type: 'fuse', target: initial.enemies[0].uid, fuse: 2 }]);
  const third = phase(second.state);
  assert.equal(third.state.enemies[0].fuse, 1);
  assert.equal(third.state.enemies[0].intent, 'boom');
  const exploded = phase(third.state);
  assert.equal(damage(exploded.events, 'hero'), ENEMIES.bombSlime.boom);
  assert.deepEqual(exploded.events.slice(-3).map((event) => event.type), ['explode', 'defeat', 'victory']);
  assert.equal(exploded.state.enemies[0].hp, 0);
  assert.equal(battleXp(exploded.state), 0);
});

test('Guard and Barrier reduce boom and refund AP, Dodge avoids it, and a lethal last bomb loses', () => {
  for (const [heroId, skill, multiplier] of [['fighter', 'guard', 0.25], ['mage', 'barrier', BALANCE.barrierMultiplier], ['ninja', 'dodge', 0]]) {
    let initial = alone(battle('yao-2', { heroId }), 'bombSlime');
    initial = patch(initial, initial.enemies[0].uid, { fuse: 1, intent: 'boom' });
    const result = resolveEnemyPhase(useSkill(initial, skill).state, rng);
    assert.equal(initial.hero.hp - result.state.hero.hp, Math.ceil(ENEMIES.bombSlime.boom * multiplier), heroId);
    assert.equal(result.events.some((event) => event.type === 'ap' && event.reason === 'defense'), heroId !== 'ninja');
    assert.equal(battleXp(result.state), 0);
  }
  let last = alone(battle('yao-2', { heroHp: 1 }), 'bombSlime');
  last = patch(last, last.enemies[0].uid, { fuse: 1, intent: 'boom' });
  const lost = phase(last);
  assert.equal(lost.state.turn, 'lost');
  assert.ok(!lost.events.some((event) => ['victory', 'waveStart'].includes(event.type)));
});

test('killing the bomb before boom prevents damage and awards its normal XP', () => {
  let initial = alone(battle('yao-2'), 'bombSlime');
  initial = patch(initial, initial.enemies[0].uid, { hp: SKILLS.magicBolt.damage, fuse: 1, intent: 'boom' });
  const killed = useSkill(initial, 'magicBolt', initial.enemies[0].uid, rng);
  assert.equal(killed.state.turn, 'won');
  assert.equal(killed.state.hero.hp, initial.hero.hp);
  assert.ok(!killed.events.some((event) => event.type === 'explode'));
  assert.equal(battleXp(killed.state), ENEMIES.bombSlime.xp);
});

test('Orc protection halves damage, stacks with guard and ends immediately when the Orc dies', () => {
  const initial = scene(['armoredOrc', 'hornGoblin']);
  const caller = initial.enemies.find((enemy) => enemy.id === 'hornGoblin');
  const orc = initial.enemies.find((enemy) => enemy.id === 'armoredOrc');
  assert.equal(protectedUid(initial), caller.uid);
  const hit = useSkill(initial, 'magicBolt', caller.uid, rng);
  assert.equal(damage(hit.events, caller.uid), Math.ceil(SKILLS.magicBolt.damage / 2));
  assert.ok(hit.events.some((event) => event.type === 'protected' && event.target === caller.uid && event.by === orc.uid));
  const guarding = useSkill(patch(initial, caller.uid, { guarding: true }), 'magicBolt', caller.uid, rng);
  assert.equal(damage(guarding.events, caller.uid), Math.ceil(SKILLS.magicBolt.damage * 0.5 * BALANCE.enemyGuardMultiplier));
  const noOrc = useSkill(patch(initial, orc.uid, { hp: SKILLS.magicBolt.damage }), 'magicBolt', orc.uid, rng).state;
  assert.equal(protectedUid(noOrc), null);
  assert.equal(damage(useSkill({ ...noOrc, turn: 'player' }, 'magicBolt', caller.uid, rng).events, caller.uid), SKILLS.magicBolt.damage);
});

test('protection applies to area attacks, every double hit and the ally damage path', () => {
  const mage = scene(['armoredOrc', 'hornGoblin']);
  const caller = mage.enemies.find((enemy) => enemy.id === 'hornGoblin');
  const area = useSkill(mage, 'fireball', caller.uid, rng);
  assert.equal(damage(area.events, caller.uid), Math.ceil(SKILLS.fireball.damage / 2));
  const ninja = scene(['armoredOrc', 'hornGoblin'], { heroId: 'ninja' });
  const double = useSkill(ninja, 'doubleStrike', caller.uid, rng);
  assert.equal(damage(double.events, caller.uid), 2 * Math.ceil(SKILLS.doubleStrike.damage / 2));
  const allied = phase({ ...mage, ally: { id: 'osakaDefender' } });
  assert.equal(allied.events[0].type, 'allyAttack');
  assert.equal(damage(allied.events, caller.uid), Math.ceil(ALLIES.osakaDefender.damage / 2));
});

test('multiple Orcs cover distinct callers and bosses in UID order, never another Orc', () => {
  const initial = scene(['hornGoblin', 'armoredOrc']);
  const [horn, orc] = initial.enemies;
  const state = { ...initial, enemies: [
    { ...orc, uid: 8 }, { ...horn, id: 'warcaller', uid: 7 },
    { ...horn, uid: 3 }, { ...orc, uid: 2 },
  ] };
  assert.equal(protectedUid(state), 3);
  assert.equal(protectedUid(state, 2), 3);
  assert.equal(protectedUid(state, 8), 7);
  assert.equal(protectedUid(state, 7), null);
  const one = patch(state, 2, { hp: 0 });
  assert.equal(protectedUid(one, 8), 3, 'remaining Orc immediately covers the first candidate');
});

test('Ninja Strike finds an opening during a pending call', () => {
  const state = alone(battle('yao-1', { heroId: 'ninja' }), 'hornGoblin');
  const caller = state.enemies.find((enemy) => enemy.id === 'hornGoblin');
  const result = useSkill(state, 'strike', caller.uid, rng);
  assert.equal(result.state.hero.openingUid, caller.uid);
  assert.ok(result.events.some((event) => event.type === 'opening' && event.target === caller.uid));
});

test('Warcaller enrages once and phase two changes reinforcement ids and call cadence', () => {
  let state = { ...alone(battle('yao-4', { startWave: 2, heroId: 'fighter' }), 'warcaller'), callBudget: 3 };
  const boss = state.enemies[0];
  const phaseOne = phase(state);
  assert.deepEqual(phaseOne.state.enemies.filter((enemy) => enemy.summoned).map((enemy) => enemy.id), ['goblin']);
  assert.equal(phaseOne.state.enemies[0].callWait, ENEMIES.warcaller.ai.callEvery - 1);
  state = patch(state, boss.uid, { hp: Math.floor(boss.maxHp / 2) + 1, callWait: 0, intent: 'call' });
  const hit = useSkill(state, 'slash', boss.uid, rng);
  assert.equal(hit.state.enemies[0].phase, 2);
  assert.equal(hit.events.filter((event) => event.type === 'enrage').length, 1);
  const result = resolveEnemyPhase(hit.state, rng);
  assert.deepEqual(result.state.enemies.filter((enemy) => enemy.summoned).map((enemy) => enemy.id), ['wolf', 'bombSlime']);
  assert.equal(result.state.enemies[0].callWait, ENEMIES.warcaller.ai.phase2.callEvery - 1);
  assert.equal(result.state.enemies.find((enemy) => enemy.id === 'bombSlime').fuse, ENEMIES.bombSlime.fuse);
  const again = useSkill(result.state, 'slash', boss.uid, rng);
  assert.ok(!again.events.some((event) => event.type === 'enrage'));
  assert.equal(chooseEnemyIntent(result.state, { ...result.state.enemies[0], intent: 'attack', cadence: 3 }, rng), 'charge');
});

test('no reinforcement roster contains a caller', () => {
  for (const id of ['hornGoblin', 'signalCaptain', 'warcaller']) {
    for (const ai of [ENEMIES[id].ai, ENEMIES[id].ai.phase2].filter(Boolean)) {
      for (const calledId of ai.callIds ?? []) assert.notEqual(ENEMIES[calledId].ai.support, 'call', `${id} calls ${calledId}`);
    }
  }
});

test('defeating a caller during its CALLING HELP turn charges +1 AP; other kills do not', () => {
  const initial = alone(battle('yao-1', { heroId: 'fighter', ap: 5 }), 'hornGoblin');
  const caller = initial.enemies[0];
  assert.equal(caller.intent, 'call');
  const stopped = useSkill(patch(initial, caller.uid, { hp: 1 }), 'slash', caller.uid, rng);
  assert.ok(stopped.events.some((event) => event.type === 'interrupt' && event.target === caller.uid));
  assert.ok(stopped.events.some((event) => event.type === 'ap' && event.reason === 'interrupt' && event.amount === BALANCE.interruptAp));
  assert.equal(stopped.state.ap, 5 - SKILLS.slash.cost + BALANCE.interruptAp);
  const quiet = useSkill(patch(initial, caller.uid, { hp: 1, intent: 'attack' }), 'slash', caller.uid, rng);
  assert.ok(!quiet.events.some((event) => event.type === 'interrupt'));
  assert.equal(quiet.state.ap, 5 - SKILLS.slash.cost);
});
