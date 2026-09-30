// The Adventure visual layer's public face. Callers ask for semantic art
// (a character in a state, an icon, a backdrop) and never see how pixels are
// drawn, so the art can be replaced without touching battle logic.
import { DURATION_MS, ENEMY_IDS, FRAMES, HERO_IDS, LOOPING, ROWS, hasSpriteSheet, spriteSheet } from './pixel-sprites.js';
import { backdropImage, cityImage, effectSheet, groundImage, iconImage, osakaMapImage } from './pixel-effects.js';
import { sheetClass } from './pixel-core.js';

export { createEffectsPlayer } from './fx-player.js';
export const SPRITE_STATES = ROWS;
export const SPRITE_FRAMES = FRAMES;
export const ART_IDS = Object.freeze({ heroes: HERO_IDS, enemies: ENEMY_IDS });
const BOSSES = new Set(['dragon', 'demonKing', 'giantGolem', 'vampireLord']);

/**
 * CSS that plays each state's row: looping rows cycle, the rest play once and
 * hold their last frame. Generated from the frame table so art and CSS agree.
 */
export function spriteStateCss() {
  return ROWS.map((row, index) => {
    const n = FRAMES[row], loop = LOOPING.has(row);
    const end = loop ? 'var(--n)' : 'var(--last)';
    return `.px-sprite[data-state="${row}"]{--row:${index};--n:${n};--last:${n - 1};animation:pxs-${row} ${DURATION_MS[row]}ms steps(${loop ? n : `${n}, jump-none`}) ${loop ? 'infinite' : 'forwards'}}`
      + `@keyframes pxs-${row}{to{background-position-x:calc(${end} * var(--fw) * var(--px) * -1px)}}`;
  }).join('\n');
}
if (typeof document !== 'undefined' && !document.getElementById('px-sprite-states')) {
  const style = document.createElement('style');
  style.id = 'px-sprite-states';
  style.textContent = spriteStateCss();
  document.head.append(style);
}

/** Markup for a hero or enemy in a semantic state (see SPRITE_STATES). */
export function getBattleArt(id, state = 'idle', { variant = '' } = {}) {
  const s = spriteSheet(id, variant);
  if (!s) return `<span class="battle-sprite px-sprite px-missing" data-art-id="${id}" data-state="idle" role="img" aria-label="${id}">?</span>`;
  const row = ROWS.includes(state) ? state : 'idle';
  const className = sheetClass('pxs', `${id}-${variant}`, s);
  return `<span class="battle-sprite px-sprite ${className}${BOSSES.has(id) ? ' battle-sprite--boss' : ''}" data-art-id="${id}" data-state="${row}" role="img" aria-label="${id}"></span>`;
}

export const battleArt = getBattleArt;

const whenIdle = globalThis.requestIdleCallback
  ? (fn) => globalThis.requestIdleCallback(fn, { timeout: 3000 })
  : (fn) => setTimeout(fn, 50);

/**
 * Build characters' sprite sheets ahead of time, one per idle moment: a sheet takes
 * ~50-70 ms on a desktop and several times that on a school Chromebook, so building
 * it on the frame that first shows it stalls the screen. `entries` are [id, variant]
 * pairs; `onReady(id, variant)` runs as each is ready (at once when already built).
 */
export function prewarmArt(entries, onReady = () => {}) {
  const queue = [];
  for (const [id, variant = ''] of entries) {
    if (queue.some(([i, v]) => i === id && v === variant)) continue;
    if (hasSpriteSheet(id, variant)) onReady(id, variant); else queue.push([id, variant]);
  }
  const next = () => {
    const [id, variant] = queue.shift();
    getBattleArt(id, 'idle', { variant }); // builds the sheet and registers its CSS class
    onReady(id, variant);
    if (queue.length) whenIdle(next);
  };
  if (queue.length) whenIdle(next);
}

/** Small pixel icon markup (intent, skill, status). Decorative: text sits beside it. */
export function getIcon(name) {
  const s = iconImage(name);
  return s ? `<span class="px-icon ${sheetClass('pxi', name, s)}" aria-hidden="true"></span>` : '';
}

/** A standing barrier dome shown while the Mage's Barrier is up. */
export function getBarrierArt() {
  const s = effectSheet('barrier');
  return s ? `<span class="px-fx px-fx--loop px-fx-barrier ${sheetClass('pxe', 'barrier', s)}" style="--n:${s.frames}" aria-hidden="true"></span>` : '';
}

/** Class name that paints a stage backdrop (1-4). */
export function backdropClass(stage) {
  const s = backdropImage(stage);
  return s ? sheetClass('pxb', `stage${stage}`, s) : '';
}

/** Class name that paints the repeating floor tile under stage `stage`'s backdrop. */
export function groundClass(stage) {
  const s = groundImage(stage);
  return s ? sheetClass('pxg', `ground${stage}`, s) : '';
}

/** Class name that paints the Osaka campaign map. */
export function osakaMapClass() {
  return sheetClass('pxm', 'osaka', osakaMapImage());
}

/** A one-shot effect sheet for screens outside the battle field: its class and frame count. */
export function effectArt(name) {
  const s = effectSheet(name);
  return s ? { className: sheetClass('pxe', name, s), frames: s.frames } : null;
}

/** Class name that paints Matsubara City: 'calm', 'danger', 'safe', or the 'monsters' overlay. */
export function cityClass(mood) {
  const s = cityImage(mood);
  return s ? sheetClass('pxc', mood, s) : '';
}

/** Sprite row for an enemy's standing condition. A defeated enemy is not drawn at all. */
export function enemyRestState(enemy) {
  if (enemy.hp <= 0) return 'gone';
  if (enemy.charging) return 'charge';
  if (enemy.tired) return 'tired';
  if (enemy.guarding) return 'guard';
  return 'idle';
}

/** Sprite row for the hero's standing condition. */
export function heroRestState(state) {
  if (state.turn === 'won') return 'victory';
  if (state.turn === 'lost') return 'defeat';
  return state.hero.defense || 'idle';
}

const HERO_ACTION = {
  slash: 'attack', powerSlash: 'special', cleave: 'special', guard: 'guard',
  magicBolt: 'cast', barrier: 'barrier', heal: 'heal', fireball: 'special',
  strike: 'attack', dodge: 'dodge', doubleStrike: 'special', shadowStrike: 'shadow',
};

/** [target, spriteState] pairs a battle event should show. */
export function eventSpriteStates(event) {
  switch (event.type) {
    case 'attack': return event.source ? [[event.source, 'attack']] : [['hero', HERO_ACTION[event.skillId] || 'attack']];
    case 'damage': return [[event.target, event.amount === 0 ? 'dodge' : 'hit']];
    case 'heal': return event.source ? [[event.source, 'cast']] : event.target === 'hero' ? [] : [[event.target, 'cast']];
    case 'item': return [['hero', 'heal']];
    case 'recover': return [['hero', 'tired']];
    case 'defend': return [['hero', event.defense]];
    case 'guard': return [[event.target, 'guard']];
    case 'charge': return [[event.target, 'charge']];
    case 'rest': return [[event.target, 'tired']];
    case 'summon': return [[event.source, 'cast']];
    case 'counter': return [['hero', 'counter']];
    case 'break': return [[event.target, 'broken']];
    case 'barrierUp': return [['hero', 'barrier']];
    case 'enrage': return [[event.target, 'enraged']];
    case 'defeat': return [[event.target, 'defeat']];
    case 'victory': return [['hero', 'victory']];
    case 'lost': return [['hero', 'defeat']];
    default: return [];
  }
}
