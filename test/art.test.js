import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES, HEROES, SKILLS } from '../src/battle-data.js';
import { ART_IDS, SPRITE_FRAMES, SPRITE_STATES, eventSpriteStates } from '../src/battle-art.js';
import { spriteSheet } from '../src/pixel-sprites.js';
import { EFFECT_NAMES, backdropImage, effectSheet, iconImage } from '../src/pixel-effects.js';

test('every hero and enemy in the battle data has a complete pixel sprite sheet', () => {
  for (const id of [...Object.keys(HEROES), ...Object.keys(ENEMIES)]) {
    const variants = ENEMIES[id]?.boss ? ['', 'enraged'] : [''];
    for (const variant of variants) {
      const sheet = spriteSheet(id, variant);
      assert.ok(sheet, `${id} has no art`);
      assert.equal(sheet.h, sheet.fh * SPRITE_STATES.length, `${id} sheet has one row per state`);
      assert.equal(sheet.w, sheet.fw * Math.max(...Object.values(SPRITE_FRAMES)));
    }
  }
  assert.deepEqual([...ART_IDS.enemies].sort(), Object.keys(ENEMIES).sort());
});

test('skills, intents, effects and all four stages have pixel art', () => {
  for (const id of Object.keys(SKILLS)) assert.ok(iconImage(id), `skill ${id} has no icon`);
  for (const icon of ['attack', 'guard', 'heal', 'summon', 'charge', 'heavy', 'rest', 'drain', 'power', 'lock', 'cursor']) assert.ok(iconImage(icon), icon);
  for (const name of EFFECT_NAMES) assert.ok(effectSheet(name).frames >= 1, name);
  for (const stage of [1, 2, 3, 4]) assert.ok(backdropImage(stage), `stage ${stage}`);
});

test('battle events only ask for sprite states that exist', () => {
  const events = [
    ...Object.keys(SKILLS).map((skillId) => ({ type: 'attack', skillId, target: 1 })),
    { type: 'attack', source: 1, action: 'heavy' }, { type: 'damage', target: 'hero', amount: 0 }, { type: 'damage', target: 1, amount: 3 },
    { type: 'heal', source: 2, target: 1 }, { type: 'heal', target: 'hero' }, { type: 'defend', defense: 'guard' }, { type: 'defend', defense: 'barrier' },
    { type: 'defend', defense: 'dodge' }, { type: 'guard', target: 1 }, { type: 'charge', target: 1 }, { type: 'rest', target: 1 },
    { type: 'summon', source: 1, target: 2 }, { type: 'counter', target: 1 }, { type: 'break', target: 1 }, { type: 'barrierUp' },
    { type: 'enrage', target: 1 }, { type: 'defeat', target: 1 }, { type: 'victory' }, { type: 'lost' },
  ];
  for (const event of events) {
    for (const [, state] of eventSpriteStates(event)) assert.ok(SPRITE_STATES.includes(state), `${event.type} -> ${state}`);
  }
});
