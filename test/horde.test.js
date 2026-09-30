import test from 'node:test';
import assert from 'node:assert/strict';
import { ALLIES, BALANCE, ENCOUNTERS, ENEMIES, SKILLS } from '../src/battle-data.js';
import {
  battleXp, chooseEncounter, createBattle, isVictory, resolveEnemyPhase, useSkill, waveInfo,
} from '../src/battle-engine.js';

const fixed = (value) => () => value;
const makeBattle = (encounterId, options = {}) => createBattle({
  heroId: 'mage', encounterId, ap: 10, level: 5, potions: 2, rng: fixed(0.99), ...options,
});
const patchEnemies = (state, update) => ({
  ...state,
  enemies: state.enemies.map((enemy) => ({ ...enemy, ...update(enemy) })),
});
const leaveForPlayer = (state, uid = state.enemies.at(-1).uid) => patchEnemies(state, (enemy) => ({
  hp: enemy.uid === uid ? 1 : 0,
  intent: enemy.uid === uid ? enemy.intent : null,
}));
const playerClearsWave = (state, uid = state.enemies.at(-1).uid) => useSkill(leaveForPlayer(state, uid), 'magicBolt', uid, fixed(0.99));
const xpForIds = (ids) => ids.reduce((sum, id) => sum + ENEMIES[id].xp, 0);

test('Sakai encounter and ally data follow the frozen schema and enemy cap', () => {
  const expected = [
    ['sakai-1', 1, 'First Assault', 'さいしょの こうげき', 'battle', null],
    ['sakai-2', 2, 'Horde Battle', 'ホードの なみ', 'battle', null],
    ['sakai-3', 3, 'Defenders Overwhelmed', 'まもりびとの ピンチ', 'battle', { id: 'osakaDefender', joinsAtWave: 2 }],
    ['sakai-4', 4, 'Final Sakai Defense', 'さかい さいごの たたかい', 'boss', { id: 'osakaDefender', joinsAtWave: 1 }],
  ];
  for (const [id, stage, name, jaName, music, ally] of expected) {
    const encounter = ENCOUNTERS[id];
    assert.equal(encounter.city, 'sakai');
    assert.deepEqual({ id: encounter.id, stage: encounter.stage, name: encounter.name, jaName: encounter.jaName, music: encounter.music, ally: encounter.ally },
      { id, stage, name, jaName, music, ally });
    assert.deepEqual(encounter.enemyIds, encounter.waves[0].enemyIds);
    assert.ok(Number.isInteger(encounter.reserve) && encounter.reserve >= 0);
    for (const wave of encounter.waves) {
      assert.ok(wave.enemyIds.length <= BALANCE.maxLivingEnemies, `${id} exceeds active enemy cap`);
      assert.ok(wave.enemyIds.every((enemyId) => ENEMIES[enemyId]), `${id} has known enemies`);
    }
  }
  assert.ok(ENCOUNTERS['sakai-4'].waves.at(-1).enemyIds.includes('hordeCommander'));
  assert.equal('boss' in ENEMIES.hordeCommander, false);
  assert.deepEqual(ALLIES.osakaDefender, {
    id: 'osakaDefender', name: 'Osaka Defender', jaName: '大阪の まもりびと',
    damage: 3, protectBelow: 0.3, protectMultiplier: 0.5,
  });
});

test('wave one is initialised, normal encounters remain one wave, and waveInfo counts reserves', () => {
  const horde = makeBattle('sakai-2');
  assert.deepEqual({ wave: horde.wave, waveCount: horde.waveCount, ally: horde.ally, clearedXp: horde.clearedXp, protected: horde.hero.protected },
    { wave: 1, waveCount: 2, ally: null, clearedXp: 0, protected: false });
  assert.deepEqual(horde.enemies.map((enemy) => enemy.id), ENCOUNTERS['sakai-2'].enemyIds);
  assert.deepEqual(horde.enemies.map((enemy) => enemy.uid), [1, 2, 3]);
  assert.deepEqual(waveInfo(horde), { wave: 1, waveCount: 2, reserveCount: 3 });

  for (const encounter of Object.values(ENCOUNTERS).filter((candidate) => !candidate.city)) {
    const state = makeBattle(encounter.id);
    assert.deepEqual({ wave: state.wave, waveCount: state.waveCount, ally: state.ally, clearedXp: state.clearedXp },
      { wave: 1, waveCount: 1, ally: null, clearedXp: 0 }, encounter.id);
    assert.deepEqual(waveInfo(state), { wave: 1, waveCount: 1, reserveCount: 0 }, encounter.id);
  }
  const normalWin = useSkill(createBattle({ heroId: 'fighter', encounterId: 'slime', ap: 2, level: 2, rng: fixed(0.99) }), 'powerSlash');
  assert.deepEqual(normalWin.events.map((event) => event.type), ['attack', 'damage', 'defeat', 'victory']);
});

test('a wave waits for every living enemy including summons', () => {
  let state = makeBattle('sakai-2');
  const summoned = {
    ...createBattle({ heroId: 'mage', encounterId: 'slime', rng: fixed(0.99) }).enemies[0],
    uid: state.nextUid, id: 'skeleton', hp: ENEMIES.skeleton.maxHp, maxHp: ENEMIES.skeleton.maxHp, summoned: true,
  };
  state = {
    ...patchEnemies(state, () => ({ hp: 0, intent: null })),
    turn: 'enemy', enemies: [...patchEnemies(state, () => ({ hp: 0, intent: null })).enemies, summoned], nextUid: state.nextUid + 1,
  };
  const result = resolveEnemyPhase(state, fixed(0.99));
  assert.equal(result.state.wave, 1);
  assert.ok(result.state.enemies.some((enemy) => enemy.summoned && enemy.hp > 0));
  assert.ok(!result.events.some((event) => ['waveClear', 'waveStart', 'victory'].includes(event.type)));
});

test('player clears into fresh UIDs on their turn and only the final wave wins', () => {
  const initial = makeBattle('sakai-2');
  const firstUids = initial.enemies.map((enemy) => enemy.uid);
  const first = playerClearsWave(initial);
  assert.equal(first.state.wave, 2);
  assert.equal(first.state.turn, 'player');
  assert.equal(first.state.round, 2);
  assert.deepEqual(first.events.slice(-2), [
    { type: 'waveClear', wave: 1 },
    { type: 'waveStart', wave: 2, waveCount: 2, targets: first.state.enemies.map((enemy) => enemy.uid) },
  ]);
  assert.ok(first.state.enemies.every((enemy) => !firstUids.includes(enemy.uid)));
  assert.deepEqual(first.state.enemies.map((enemy) => enemy.id), ENCOUNTERS['sakai-2'].waves[1].enemyIds);
  assert.equal(first.state.selectedUid, first.state.enemies[0].uid);
  assert.equal(isVictory(first.state), false);

  const final = playerClearsWave(first.state);
  assert.equal(final.state.turn, 'won');
  assert.equal(isVictory(final.state), true);
  assert.equal(final.events.at(-1).type, 'victory');
  assert.ok(!final.events.some((event) => event.type === 'waveStart'));
});

test('wave changes preserve resources and combat setups except temporary defence/opening', () => {
  let state = makeBattle('sakai-4');
  state = patchEnemies(state, (enemy) => ({ hp: enemy.uid === state.enemies[0].uid ? 2 : 0, intent: enemy.uid === state.enemies[0].uid ? 'attack' : null }));
  state = {
    ...state, turn: 'enemy', ap: 7, potions: 1, round: 6,
    hero: { ...state.hero, hp: 23, combo: true, counter: true, defense: 'barrier', exhausted: true, openingUid: state.enemies[0].uid },
  };
  const result = resolveEnemyPhase(state, fixed(0.99));
  assert.equal(result.events[0].type, 'allyAttack');
  assert.deepEqual({ hp: result.state.hero.hp, ap: result.state.ap, potions: result.state.potions, combo: result.state.hero.combo, counter: result.state.hero.counter },
    { hp: 23, ap: 7, potions: 1, combo: true, counter: true });
  assert.deepEqual({ defense: result.state.hero.defense, exhausted: result.state.hero.exhausted, openingUid: result.state.hero.openingUid, protected: result.state.hero.protected },
    { defense: null, exhausted: false, openingUid: null, protected: false });
  assert.equal(result.state.turn, 'player');
  assert.equal(result.state.round, 7);
  const fresh = new Set(result.state.enemies.map((enemy) => enemy.uid));
  assert.ok(!result.events.some((event) => event.type === 'attack' && fresh.has(event.source)), 'next wave did not act');
});

test('ally join timing and createBattle startWave follow encounter data', () => {
  assert.equal(makeBattle('sakai-1').ally, null);
  assert.equal(makeBattle('sakai-2').ally, null);
  assert.equal(makeBattle('sakai-3').ally, null);
  assert.deepEqual(makeBattle('sakai-4').ally, { id: 'osakaDefender' });

  const joined = playerClearsWave(makeBattle('sakai-3'));
  assert.deepEqual(joined.events.slice(-3), [
    { type: 'waveClear', wave: 1 },
    { type: 'waveStart', wave: 2, waveCount: 2, targets: joined.state.enemies.map((enemy) => enemy.uid) },
    { type: 'allyJoin', allyId: 'osakaDefender' },
  ]);
  assert.deepEqual(joined.state.ally, { id: 'osakaDefender' });

  const debug = makeBattle('sakai-3', { startWave: 2 });
  assert.equal(debug.wave, 2);
  assert.deepEqual(debug.enemies.map((enemy) => enemy.id), ENCOUNTERS['sakai-3'].waves[1].enemyIds);
  assert.deepEqual(debug.ally, { id: 'osakaDefender' });
  assert.equal(debug.clearedXp, xpForIds(ENCOUNTERS['sakai-3'].waves[0].enemyIds));
  assert.deepEqual(waveInfo(makeBattle('sakai-4', { startWave: 3 })), { wave: 3, waveCount: 3, reserveCount: 0 });
});

test('ally attacks for zero AP through damageEnemy and ignores dead targets', () => {
  let state = makeBattle('sakai-4');
  state = patchEnemies(state, (enemy) => {
    if (enemy.uid === 1) return { hp: 0, intent: null };
    if (enemy.uid === 2) return { hp: 5, guarding: true, intent: 'guard' };
    if (enemy.uid === 3) return { hp: 5, intent: 'guard' };
    return { hp: 7, intent: 'guard' };
  });
  state = { ...state, turn: 'enemy', ap: 6 };
  const result = resolveEnemyPhase(state, fixed(0.99));
  assert.deepEqual(result.events.slice(0, 2), [
    { type: 'allyAttack', allyId: 'osakaDefender', target: 2 },
    { type: 'damage', target: 2, amount: Math.ceil(ALLIES.osakaDefender.damage * BALANCE.enemyGuardMultiplier) },
  ]);
  assert.equal(result.state.ap, 6);
  assert.equal(result.state.enemies.find((enemy) => enemy.uid === 1).hp, 0);
});

test('ally protect triggers at the threshold, halves post-defence damage, and expires', () => {
  let state = makeBattle('sakai-4', { heroId: 'fighter', startWave: 3 });
  const commander = state.enemies.find((enemy) => enemy.id === 'hordeCommander');
  state = patchEnemies(state, (enemy) => ({ hp: enemy.uid === commander.uid ? enemy.hp : 0, intent: enemy.uid === commander.uid ? 'attack' : null }));
  const hp = Math.floor(state.hero.maxHp * ALLIES.osakaDefender.protectBelow);
  state = { ...state, turn: 'enemy', hero: { ...state.hero, hp, defense: 'guard' } };
  const result = resolveEnemyPhase(state, fixed(0.99));
  const expected = Math.ceil(Math.ceil(ENEMIES.hordeCommander.attack * 0.25) * ALLIES.osakaDefender.protectMultiplier);
  assert.equal(result.events[0].type, 'allyProtect');
  assert.ok(!result.events.some((event) => event.type === 'allyAttack'));
  assert.equal(hp - result.state.hero.hp, expected);
  assert.equal(result.state.hero.protected, false);
});

test('ally can clear an intermediate wave or win the final wave without spending AP', () => {
  let middle = makeBattle('sakai-4');
  middle = patchEnemies(middle, (enemy) => ({ hp: enemy.uid === 1 ? ALLIES.osakaDefender.damage : 0, intent: enemy.uid === 1 ? 'attack' : null }));
  middle = { ...middle, turn: 'enemy', ap: 4 };
  const advanced = resolveEnemyPhase(middle, fixed(0.99));
  assert.deepEqual(advanced.events.map((event) => event.type).slice(0, 5), ['allyAttack', 'damage', 'defeat', 'waveClear', 'waveStart']);
  assert.equal(advanced.state.turn, 'player');
  assert.equal(advanced.state.ap, 4);

  let last = makeBattle('sakai-4', { startWave: 3 });
  last = patchEnemies(last, (enemy) => ({ hp: enemy.uid === last.enemies.at(-1).uid ? ALLIES.osakaDefender.damage : 0, intent: null }));
  last = { ...last, turn: 'enemy', ap: 4 };
  const won = resolveEnemyPhase(last, fixed(0.99));
  assert.equal(won.state.turn, 'won');
  assert.equal(won.state.ap, 4);
  assert.equal(won.events.at(-1).type, 'victory');
});

test('battleXp includes cleared waves and excludes summons', () => {
  const encounter = ENCOUNTERS['sakai-2'];
  const first = playerClearsWave(makeBattle('sakai-2'));
  const waveOneXp = xpForIds(encounter.waves[0].enemyIds);
  assert.equal(first.state.clearedXp, waveOneXp);
  assert.equal(battleXp(first.state), waveOneXp);
  const oneCurrentDead = patchEnemies(first.state, (enemy) => ({ hp: enemy.uid === first.state.enemies[0].uid ? 0 : enemy.hp }));
  assert.equal(battleXp(oneCurrentDead), waveOneXp + ENEMIES[first.state.enemies[0].id].xp);
  const summonedDead = { ...first.state.enemies[0], uid: first.state.nextUid, hp: 0, summoned: true };
  assert.equal(battleXp({ ...oneCurrentDead, enemies: [...oneCurrentDead.enemies, summonedDead] }), battleXp(oneCurrentDead));
});

test('chooseEncounter never selects a city encounter', () => {
  for (const tier of [1, 2, 3, 4]) for (const roll of [0, 0.2, 0.5, 0.8, 0.999999]) {
    assert.equal(chooseEncounter(tier, fixed(roll)).city, undefined);
  }
});
