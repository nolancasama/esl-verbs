import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattle } from '../src/battle-engine.js';
import { battleHint, eventMessage } from '../src/battle-ui.js';
import { enemyRestState, eventSpriteStates } from '../src/battle-art.js';

const battle = () => createBattle({ heroId: 'fighter', encounterId: 'yao-1', level: 5, ap: 10, potions: 2, rng: () => .99 });
const withIntents = (state, intents) => ({ ...state, enemies: state.enemies.map((enemy, index) => ({ ...enemy, intent: intents[index] ?? 'attack' })) });

test('Yao call hint explains kill-to-stop and outranks charge and onboarding', () => {
  const state = withIntents(battle(), ['charge', 'call']);
  assert.deepEqual(battleHint(state, { skill: 'basic', text: 'Attack!' }), { text: '📯 よぶ まえに たおそう！ STOP THE CALL!' });
  assert.equal(battleHint({ ...state, turn: 'enemy' }), null);
  const stopped = { ...state, enemies: state.enemies.map((enemy) => enemy.intent === 'call' ? { ...enemy, hp: 0 } : enemy) };
  assert.equal(battleHint(stopped).keep, true, 'a dead caller cannot request the call hint');
});

test('a protected pending caller names the Orc first and drops that hint when the Orc dies', () => {
  const state = createBattle({ heroId: 'fighter', encounterId: 'yao-3', startWave: 2, level: 5, ap: 10, rng: () => .99 });
  const caller = state.enemies.find((enemy) => enemy.id === 'signalCaptain');
  const orc = state.enemies.find((enemy) => enemy.id === 'armoredOrc');
  const pending = { ...state, enemies: state.enemies.map((enemy) => ({ ...enemy, intent: enemy.uid === caller.uid ? 'call' : 'attack' })) };
  assert.deepEqual(battleHint(pending), { text: '🛡 オークを さきに たおそう！ BREAK THE GUARD!' });
  const noOrc = { ...pending, enemies: pending.enemies.map((enemy) => enemy.uid === orc.uid ? { ...enemy, hp: 0 } : enemy) };
  assert.deepEqual(battleHint(noOrc), { text: '📯 よぶ まえに たおそう！ STOP THE CALL!' });
  const noCaller = { ...pending, enemies: pending.enemies.map((enemy) => enemy.uid === caller.uid ? { ...enemy, hp: 0 } : enemy) };
  assert.doesNotMatch(battleHint(noCaller)?.text ?? '', /BREAK THE GUARD!/);
});

test('boom, heavy and low-HP hints take priority over pending calls', () => {
  const state = withIntents(battle(), ['boom', 'call']);
  const danger = { ...state, hero: { ...state.hero, hp: 1 } };
  assert.deepEqual(battleHint(danger), { skill: 'defense', text: '💣 BOOM NEXT! たおすか まもろう！' });
  assert.match(battleHint(withIntents(danger, ['heavy', 'call'])).text, /BIG ATTACK NEXT!/);
  assert.equal(battleHint(withIntents(danger, ['attack', 'call'])).item, true);
  assert.match(battleHint({ ...withIntents(danger, ['attack', 'call']), potions: 0 }).text, /STOP THE CALL!/);
});

test('caller and bomb rest poses visibly telegraph their intents', () => {
  assert.equal(enemyRestState({ hp: 10, intent: 'call' }), 'cast');
  assert.equal(enemyRestState({ hp: 10, intent: 'boom' }), 'charge');
  assert.equal(enemyRestState({ hp: 10, intent: 'fuse' }), 'idle');
  assert.equal(enemyRestState({ hp: 0, intent: 'call' }), 'gone');
  assert.equal(enemyRestState({ hp: 0, intent: 'boom' }), 'gone');
  assert.deepEqual(eventSpriteStates({ type: 'call', source: 4, targets: [5] }), [[4, 'cast']]);
  assert.deepEqual(eventSpriteStates({ type: 'explode', source: 6 }), [[6, 'attack']]);
});

test('Yao event messages show arrivals and explosions while countdowns stay quiet', () => {
  assert.equal(eventMessage({ type: 'call', source: 1, targets: [2, 3] }), 'なかまを よんだ！ Reinforcements!');
  assert.equal(eventMessage({ type: 'call', source: 1, targets: [] }), 'だれも こない！');
  assert.equal(eventMessage({ type: 'explode', source: 2 }), 'BOOM!');
  assert.equal(eventMessage({ type: 'fuse', target: 2, fuse: 1 }), '');
  assert.equal(eventMessage({ type: 'protected', target: 1, by: 2 }), '');
});
