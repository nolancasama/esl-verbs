import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES, HEROES, SKILLS } from '../src/battle-data.js';
import { createBattle } from '../src/battle-engine.js';
import { ART_IDS, SPRITE_FRAMES, SPRITE_STATES, enemyRestState, eventSpriteStates, spriteStateCss } from '../src/battle-art.js';
import { FRAMES, LOOPING, spriteSheet } from '../src/pixel-sprites.js';
import { EFFECT_NAMES, backdropImage, effectSheet, iconImage, titleImage } from '../src/pixel-effects.js';
import { BOOT_STORY } from '../src/story.js';
import { battleHint, eventMessage } from '../src/battle-ui.js';

const filled = (g) => g.d.some(Boolean);
const bounds = (g) => {
  let top = g.h, bottom = -1;
  g.d.forEach((key, i) => { if (key && key !== '_') { const y = Math.floor(i / g.w); top = Math.min(top, y); bottom = Math.max(bottom, y); } });
  return { top, bottom, height: bottom - top + 1 };
};

// A city's art lands before its battle data (controller art slice → worker data
// slice: Osaka City O0 → O1 now); the data slice empties this list, so art
// without data never goes unnoticed.
const ART_AHEAD_OF_DATA = [];
const BOSS_ART_AHEAD = new Set();

test('every hero and enemy has a complete sprite sheet with one row per state', () => {
  for (const id of [...Object.keys(HEROES), ...Object.keys(ENEMIES), ...ART_AHEAD_OF_DATA, 'actionCore']) {
    const variants = ENEMIES[id]?.boss || BOSS_ART_AHEAD.has(id) ? ['', 'enraged'] : [''];
    for (const variant of variants) {
      const sheet = spriteSheet(id, variant);
      assert.ok(sheet, `${id} has no art`);
      assert.equal(sheet.grids.length, SPRITE_STATES.length, `${id} rows`);
      assert.equal(sheet.h, sheet.fh * SPRITE_STATES.length);
      assert.equal(sheet.w, sheet.fw * Math.max(...Object.values(SPRITE_FRAMES)));
      SPRITE_STATES.forEach((state, row) => assert.equal(sheet.grids[row].length, FRAMES[state], `${id} ${state} frames`));
    }
  }
  assert.deepEqual([...ART_IDS.enemies].sort(), [...Object.keys(ENEMIES), ...ART_AHEAD_OF_DATA.filter((id) => !ENEMIES[id])].sort());
});

test('sprite sizes follow the late-16-bit targets and the O0 Avatar frame', () => {
  for (const id of Object.keys(HEROES)) {
    const sheet = spriteSheet(id);
    assert.equal(sheet.fw, 72); assert.equal(sheet.fh, 72);
    const { height } = bounds(sheet.grids[0][0]);
    assert.ok(height >= 50 && height <= 72, `${id} idle is ${height}px tall`);
  }
  for (const id of Object.keys(ENEMIES)) {
    const sheet = spriteSheet(id);
    const { height } = bounds(sheet.grids[0][0]);
    // O0's crowned Avatar includes four extra rows; keep the old bounds for every other boss.
    if (id === 'blackStarAvatar') {
      assert.deepEqual([sheet.fw, sheet.fh], [112, 132]);
      assert.ok(height >= 90, `${id} idle is ${height}px tall`);
    } else if (ENEMIES[id].boss) assert.ok(sheet.fh >= 96 && sheet.fh <= 128 && height >= 90, `${id} boss ${sheet.fw}x${sheet.fh}, ${height} tall`);
    else assert.ok(sheet.fh >= 36 && sheet.fh <= 96, `${id} ${sheet.fw}x${sheet.fh}`);
  }
});

test('a defeated enemy leaves nothing behind: the last defeat frame is empty and the rest state is gone', () => {
  const row = SPRITE_STATES.indexOf('defeat');
  for (const id of Object.keys(ENEMIES)) {
    for (const variant of ENEMIES[id].boss ? ['', 'enraged'] : ['']) {
      const frames = spriteSheet(id, variant).grids[row];
      assert.ok(filled(frames[0]), `${id} defeat starts visible`);
      assert.equal(filled(frames.at(-1)), false, `${id}${variant ? ` (${variant})` : ''} keeps pixels after defeat`);
    }
  }
  const battle = createBattle({ heroId: 'fighter', encounterId: 'goblin-slime', ap: 5 });
  assert.equal(enemyRestState({ ...battle.enemies[0], hp: 0 }), 'gone');
  assert.equal(SPRITE_STATES.includes('gone'), false, 'gone is never drawn as a sprite row');
  // Heroes do not vanish on defeat: their last frame is the knocked-down pose.
  for (const id of Object.keys(HEROES)) assert.ok(filled(spriteSheet(id).grids[row].at(-1)), `${id} defeat pose`);
});

test('sprite CSS is generated from the frame table (loops cycle, actions hold the last frame)', () => {
  const css = spriteStateCss();
  for (const [index, state] of SPRITE_STATES.entries()) {
    assert.ok(css.includes(`[data-state="${state}"]{--row:${index};--n:${FRAMES[state]};--last:${FRAMES[state] - 1}`), state);
    assert.ok(css.includes(LOOPING.has(state) ? `pxs-${state} ` : `jump-none) forwards`), state);
  }
});

test('skills, intents, items, effects and all four stages have pixel art', () => {
  for (const id of Object.keys(SKILLS)) assert.ok(iconImage(id), `skill ${id} has no icon`);
  for (const icon of ['attack', 'guard', 'heal', 'summon', 'charge', 'heavy', 'rest', 'drain', 'power', 'lock', 'cursor', 'potion']) assert.ok(iconImage(icon), icon);
  for (const name of EFFECT_NAMES) assert.ok(effectSheet(name).frames >= 1, name);
  for (const name of ['slash', 'bigSlash', 'cleaveSweep', 'fireBlast', 'runeCircle', 'darkSlash', 'breath', 'quakeCrack', 'darkBurst', 'bloodMoon', 'barrierForm', 'healPillar', 'recoverFx', 'potionFx']) assert.ok(EFFECT_NAMES.includes(name), name);
  for (const stage of [1, 2, 3, 4]) assert.ok(backdropImage(stage), `stage ${stage}`);
});

test('the Ninja shuriken and the MATSUBARA HEROES title art are drawn in code', () => {
  assert.equal(effectSheet('shurikenProj').frames, 4);
  assert.ok(effectSheet('shurikenHit').frames >= 3);
  const sky = titleImage('sky'), ground = titleImage('ground');
  assert.deepEqual([sky.fw, sky.fh], [256, 112]);
  assert.equal(ground.fw, 128);
  // the sky reaches the horizon on every column, so the heroes' ground strip meets it with no gap
  const bottom = sky.grids[0][0].d.slice(-256);
  assert.ok(bottom.every(Boolean));
  assert.equal(titleImage('nope'), null);
});

test('boot cinematic: city, threat, heroes, then the logo, in about nine seconds', () => {
  const total = BOOT_STORY.reduce((sum, beat) => sum + beat.ms, 0);
  assert.ok(total >= 8000 && total <= 15000, `${total} ms`);
  assert.deepEqual(BOOT_STORY.map((beat) => beat.title?.en ?? null), ['MATSUBARA CITY', 'THE SHADOW HORDE IS COMING!', 'WHO WILL DEFEND THE CITY?', null]);
  assert.ok(BOOT_STORY[2].heroes && BOOT_STORY.at(-1).reveal);
  assert.ok(BOOT_STORY.every((beat) => !beat.card && !beat.hero), 'the boot cinematic chooses no hero and has no reading cards');
});

test('Ninja presentation pass leaves the Ninja numbers alone', () => {
  const pick = (id) => { const { cost, damage, splashDamage, tier } = SKILLS[id]; return { cost, damage, splashDamage, tier }; };
  assert.deepEqual(HEROES.ninja.skills, ['strike', 'dodge', 'doubleStrike', 'shadowStrike']);
  assert.deepEqual(pick('strike'), { cost: 1, damage: 4, splashDamage: undefined, tier: 0 });
  assert.deepEqual(pick('doubleStrike'), { cost: 2, damage: 5, splashDamage: undefined, tier: 1 });
  assert.deepEqual(pick('shadowStrike'), { cost: 3, damage: 14, splashDamage: 9, tier: 2 });
});

test('battle events only ask for sprite states that exist', () => {
  const events = [
    ...Object.keys(SKILLS).map((skillId) => ({ type: 'attack', skillId, target: 1 })),
    { type: 'attack', source: 1, action: 'heavy' }, { type: 'damage', target: 'hero', amount: 0 }, { type: 'damage', target: 1, amount: 3 },
    { type: 'heal', source: 2, target: 1 }, { type: 'heal', target: 'hero' }, { type: 'defend', defense: 'guard' }, { type: 'defend', defense: 'barrier' },
    { type: 'defend', defense: 'dodge' }, { type: 'guard', target: 1 }, { type: 'charge', target: 1 }, { type: 'rest', target: 1 },
    { type: 'summon', source: 1, target: 2 }, { type: 'counter', target: 1 }, { type: 'break', target: 1 }, { type: 'barrierUp' },
    { type: 'enrage', target: 1 }, { type: 'defeat', target: 1 }, { type: 'victory' }, { type: 'lost' }, { type: 'item', itemId: 'potion' }, { type: 'recover', amount: 1 },
  ];
  for (const event of events) {
    for (const [, state] of eventSpriteStates(event)) assert.ok(SPRITE_STATES.includes(state), `${event.type} -> ${state}`);
  }
  assert.deepEqual(eventSpriteStates({ type: 'recover' }), [['hero', 'tired']]);
  assert.deepEqual(eventSpriteStates({ type: 'item' }), [['hero', 'heal']]);
});

test('battle hints: big attack first, then low HP potion, then keep-1-AP before a charge', () => {
  const base = createBattle({ heroId: 'ninja', encounterId: 'golem', ap: 4, level: 3, potions: 1 });
  const withIntent = (intent, hp = base.hero.hp) => ({ ...base, hero: { ...base.hero, hp }, enemies: base.enemies.map((enemy) => ({ ...enemy, intent })) });
  assert.equal(battleHint(withIntent('heavy', 3)).skill, 'defense');
  assert.equal(battleHint(withIntent('attack', 3)).item, true);
  assert.equal(battleHint({ ...withIntent('attack', 3), potions: 0 }), null);
  assert.equal(battleHint(withIntent('charge')).keep, true);
  assert.equal(battleHint({ ...withIntent('charge'), ap: 0 }), null);
  assert.deepEqual(battleHint(withIntent('attack'), { skill: 'basic', text: 'hi' }), { skill: 'basic', text: 'hi' });
  assert.equal(battleHint({ ...withIntent('heavy'), turn: 'enemy' }), null);

  // COMBO / OPENING / COUNTER point at the payoff, below the danger and keep-AP hints.
  const hero = (state, changes) => ({ ...state, hero: { ...state.hero, ...changes }, enemies: state.enemies.map((enemy) => ({ ...enemy, intent: 'attack' })) });
  const fighter = (level) => createBattle({ heroId: 'fighter', encounterId: 'golem', ap: 4, level });
  const combo = battleHint(hero(fighter(2), { combo: true }));
  assert.equal(combo.skillId, 'powerSlash');
  assert.match(combo.text, /COMBO.*\+4/);
  assert.equal(battleHint(hero(fighter(1), { combo: true })), null, 'no combo hint before Power Slash unlocks');
  assert.match(battleHint(hero(fighter(2), { combo: true, counter: true })).text, /\+8/);
  assert.equal(battleHint(hero(fighter(1), { counter: true })).counter, true);
  const opening = battleHint(hero(base, { openingUid: base.enemies[0].uid }));
  assert.equal(opening.skillId, 'doubleStrike');
  assert.match(opening.text, /OPENING/);
  const charging = { ...hero(fighter(2), { combo: true }), enemies: fighter(2).enemies.map((enemy) => ({ ...enemy, intent: 'charge' })) };
  assert.equal(battleHint(charging).keep, true, 'keeping 1 AP for a coming big attack still wins');
  assert.equal(eventMessage({ type: 'rejected', reason: 'unaffordable' }), 'Not enough AP!');
  assert.match(eventMessage({ type: 'ap', amount: 1, reason: 'recover', ap: 1 }), /RECOVERING/);
});
