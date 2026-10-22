import test from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTERS, ENEMIES } from '../src/battle-data.js';
import { createBattle } from '../src/battle-engine.js';
import { battleHint, createBattleView, defeatHpLine, eventMessage } from '../src/battle-ui.js';
import { backdropClass, enemyRestState, eventSpriteStates, getBattleArt, getIcon } from '../src/battle-art.js';

// The public data maps are frozen; their legacy Slime entries provide an isolated
// test encounter and sprite without adding any Higashiosaka campaign data.
function withCoreBattle(check) {
  const enemy = { ...ENEMIES.slime };
  const encounter = { ...ENCOUNTERS.slime };
  Object.assign(ENEMIES.slime, { name: 'Test Core attacker', aim: 'core', heavy: 12, heavyName: 'Test heavy', ai: {} });
  Object.assign(ENCOUNTERS.slime, { core: { hp: 30 } });
  const restore = () => {
    for (const key of Object.keys(ENEMIES.slime)) delete ENEMIES.slime[key];
    for (const key of Object.keys(ENCOUNTERS.slime)) delete ENCOUNTERS.slime[key];
    Object.assign(ENEMIES.slime, enemy);
    Object.assign(ENCOUNTERS.slime, encounter);
  };
  try {
    const result = check(createBattle({ heroId: 'fighter', encounterId: 'slime', level: 5, ap: 10, potions: 2, rng: () => .99 }));
    if (result?.then) return result.finally(restore);
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

const intent = (state, value, aim = 'core') => ({ ...state, enemies: state.enemies.map((enemy) => ({ ...enemy, intent: value, aim })) });

// Exercise the actual view renderer with a markup-only host. Art is prepared
// before installing the document stub so these Node tests never need canvas.
function rendered(state, check) {
  for (const id of ['fighter', 'slime', 'actionCore']) getBattleArt(id);
  for (const name of ['slash', 'powerSlash', 'cleave', 'guard', 'potion', 'cursor', 'lock', 'attack', 'heavy', 'charge']) getIcon(name);
  backdropClass(1);
  const previousDocument = globalThis.document;
  globalThis.document = {
    body: { append() {} },
    createElement: () => ({ setAttribute() {}, remove() {} }),
    addEventListener() {}, removeEventListener() {}, querySelector: () => null,
  };
  const nodes = new Map();
  const host = {
    nodes, innerHTML: '', querySelector: (selector) => nodes.get(selector) ?? null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {}, replaceChildren() {},
  };
  let view;
  const restore = () => {
    view?.destroy();
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  };
  try {
    view = createBattleView(host, { state });
    const result = check(host, view);
    if (result?.then) return result.finally(restore);
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

test('Core plate and Core aim tag render through the battle view', () => withCoreBattle((state) => {
  rendered(state, (host, view) => {
    assert.match(host.innerHTML, /battle-field[^"\n]*battle-field--core/);
    assert.match(host.innerHTML, /<article class="battle-core battle-core--idle" data-combatant="core">/);
    assert.match(host.innerHTML, /battle-core__plate px-panel"><b>アクション・コア<\/b>/);
    assert.match(host.innerHTML, /battle-hp battle-hp--core" aria-label="Core HP 30 of 30"/);
    assert.match(host.innerHTML, /data-art-id="actionCore" data-state="idle"/);
    assert.match(host.innerHTML, /<span class="battle-intent__aim">→ コア<\/span>/);
    view.update({ ...state, core: null });
    assert.doesNotMatch(host.innerHTML, /battle-field--core|data-combatant="core"|battle-intent__aim/);
  });
}));

test('Core danger and broken sprites follow the frozen plate states', () => withCoreBattle((state) => {
  rendered({ ...state, core: { hp: 10, maxHp: 30 } }, (host, view) => {
    assert.match(host.innerHTML, /battle-core battle-core--low/);
    view.update({ ...state, core: { hp: 10.5, maxHp: 30 } });
    assert.match(host.innerHTML, /battle-core battle-core--idle/);
    view.update({ ...state, turn: 'lost', core: { hp: 0, maxHp: 30 } });
    assert.match(host.innerHTML, /battle-core battle-core--broken/);
    assert.match(host.innerHTML, /data-art-id="actionCore" data-state="tired"/);
    assert.match(host.innerHTML, /THE CORE IS BROKEN!/);
  });
}));

test('a Core heavy warns GUARD THE CORE and highlights defence', () => withCoreBattle((state) => {
  const heavy = intent(state, 'heavy');
  assert.deepEqual(battleHint(heavy), { skill: 'defense', text: '🛡 コアが ねらわれている！ まもろう！ GUARD THE CORE!' });
  rendered(heavy, (host) => {
    assert.match(host.innerHTML, /GUARD THE CORE!/);
    assert.match(host.innerHTML, /battle-skill--defense battle-skill--hint[^>]*data-skill-id="guard"/);
  });
  assert.match(battleHint(intent(state, 'heavy', 'hero')).text, /BIG ATTACK NEXT!/);
  assert.match(battleHint(intent(state, 'boom')).text, /BOOM NEXT!/);
  assert.equal(battleHint({ ...heavy, hero: { ...state.hero, hp: 1 } }).item, true);
  assert.equal(battleHint({ ...heavy, turn: 'enemy' }), null);
}));

test('Core target priority and low-Core hints follow existing hero danger checks', () => withCoreBattle((state) => {
  assert.deepEqual(battleHint(state), { text: 'コアを こわす てきを さきに たおそう！' });
  assert.equal(battleHint({ ...state, hero: { ...state.hero, hp: 1 } }).item, true);
  ENEMIES.slime.aim = 'hero';
  const lowCore = { ...intent(state, 'attack', 'hero'), core: { hp: 10, maxHp: 30 } };
  assert.deepEqual(battleHint(lowCore), { text: 'コアが ピンチ！ まもろう！' });
  assert.equal(battleHint({ ...lowCore, core: { hp: 10.5, maxHp: 30 } }), null);
}));

test('repair is telegraphed as support and uses cast sprite hooks', () => withCoreBattle((state) => {
  rendered(intent(state, 'repair', 'hero'), (host) => {
    assert.match(host.innerHTML, /battle-intent battle-intent--support">🔧 REPAIR \/ なおす/);
    assert.doesNotMatch(host.innerHTML, /battle-intent__aim/);
  });
  assert.equal(enemyRestState({ hp: 5, intent: 'repair' }), 'cast');
  assert.deepEqual(eventSpriteStates({ type: 'repair', source: 1, target: 2, amount: 5 }), [[1, 'cast']]);
  assert.equal(eventMessage({ type: 'repair', source: 1, target: 2, amount: 5 }), '🔧 なおした！');
}));

test('Core charge and loss use their messages while hero defeat retains its HP line', () => {
  assert.equal(eventMessage({ type: 'ap', reason: 'core', amount: 1 }), 'アクション・コア チャージ！ +1 AP');
  assert.equal(eventMessage({ type: 'lost', reason: 'core' }), 'アクション・コアが こわれた！ THE CORE IS BROKEN!');
  const lost = { turn: 'lost', core: { hp: 0, maxHp: 30 } };
  assert.equal(defeatHpLine(lost, 'HP 20 / 30'), 'アクション・コアが こわれた… / The Core broke…');
  assert.equal(defeatHpLine({ ...lost, core: null }, 'HP 0 / 30'), 'HP 0 / 30');
  assert.equal(defeatHpLine({ ...lost, core: { hp: 20, maxHp: 30 } }, 'HP 0 / 30'), 'HP 0 / 30');
});

test('Core event playback puts hit, charge, broken poses and floaters on the Core', () => withCoreBattle((state) => rendered(state, async (host, view) => {
  const coreNode = { className: '' };
  const coreSprite = { dataset: { state: 'idle' }, offsetWidth: 0 };
  const floaters = [];
  host.nodes.set('[data-combatant="core"]', coreNode);
  host.nodes.set('[data-combatant="core"] .battle-sprite', coreSprite);
  host.nodes.set('[data-combatant="core"] .battle-art-wrap', { append: (node) => floaters.push(node) });
  const hit = view.playEvents([{ type: 'damage', target: 'core', source: 1, amount: 4 }]);
  assert.match(coreNode.className, /battle-core--hit/);
  assert.equal(coreSprite.dataset.state, 'hit');
  assert.equal(floaters.at(-1).textContent, '-4');
  await hit;
  const charge = view.playEvents([{ type: 'ap', reason: 'core', amount: 1, ap: 10 }]);
  assert.match(coreNode.className, /battle-core--charge/);
  assert.equal(coreSprite.dataset.state, 'charge');
  assert.equal(floaters.at(-1).textContent, '+1 AP');
  await charge;
  view.update({ ...state, turn: 'lost', core: { hp: 0, maxHp: 30 } });
  const loss = view.playEvents([{ type: 'lost', reason: 'core' }]);
  assert.match(coreNode.className, /battle-core--broken/);
  assert.equal(coreSprite.dataset.state, 'tired');
  await loss;
})));
