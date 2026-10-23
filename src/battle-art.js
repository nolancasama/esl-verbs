// The Adventure visual layer's public face. Callers ask for semantic art
// (a character in a state, an icon, a backdrop) and never see how pixels are
// drawn, so the art can be replaced without touching battle logic.
import { DURATION_MS, ENEMY_IDS, FRAMES, HERO_IDS, LOOPING, ROWS, hasSpriteSheet, spriteSheet } from './pixel-sprites.js';
import { backdropImage, cityImage, effectSheet, groundImage, iconImage, osakaMapImage, titleImage } from './pixel-effects.js';
import { SCENE_H, SCENE_HZ, SCENE_W, actorSheet, sceneGroundImage, sceneImage } from './pixel-scenes.js';
import { sceneActors } from './scenes.js';
import { sheetClass } from './pixel-core.js';

export { createEffectsPlayer } from './fx-player.js';
export const SPRITE_STATES = ROWS;
export const SPRITE_FRAMES = FRAMES;
export const ART_IDS = Object.freeze({ heroes: HERO_IDS, enemies: ENEMY_IDS });
const BOSSES = new Set(['dragon', 'demonKing', 'giantGolem', 'vampireLord', 'warcaller']);

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

/* ------------------------------------------------------------ scenes */

/** Whole-pixel scale at which a scene covers `width` CSS px (never below 2), so it is never tiled. */
export function sceneScale(width) { return Math.max(2, Math.ceil((width || 0) / SCENE_W)); }
/** The scene's top sky colour, for any field area above the image. */
export function sceneSky(scene) { return sceneImage(scene).sky; }
/** Class that paints a scene image as an element's background. */
export function sceneClass(scene) { return sheetClass('pxs', scene.id, sceneImage(scene).image); }
/** Class that paints the floor tile continuing a scene's ground below it. */
export function sceneGroundClass(scene) {
  const { ground } = sceneImage(scene);
  return sheetClass('pxsg', `${ground}-${scene.time}`, sceneGroundImage(ground, scene.time));
}

const frameSeconds = { smoke: 1.6, blink: 1, flame: 0.45, cyclist: 0.4 };
/**
 * The scene layer: the image plus its small actors and the station sign, all in
 * scene pixels scaled by the container's --bgpx. Each animation takes a negative
 * delay from the clock, so the battle view redrawing every event never restarts them.
 */
export function sceneMarkup(scene, { now = Date.now() } = {}) {
  const built = sceneImage(scene); const t = now / 1000;
  const actors = sceneActors(scene, built.anchors).map((a) => {
    const s = actorSheet(a.kind, a.variant, scene.time);
    const fdur = frameSeconds[a.kind] ?? (a.still ? 1.2 : 0.5);
    const style = [`--x:${a.x}`, `--y:${a.y}`, `--n:${s.frames}`, `--fdur:${fdur}s`, `--fdelay:${-(t % fdur).toFixed(2)}s`];
    if (!a.still) style.push(`--dx:${a.dx}`, `--dur:${a.dur}s`, `--delay:${-((t + a.x / 7) % a.dur).toFixed(2)}s`);
    return `<i class="scene-actor scene-actor--${a.kind} ${sheetClass('pxa', `${a.kind}-${a.variant}-${scene.time}`, s)}${a.still ? ' scene-actor--still' : ''}${a.flip ? ' scene-actor--flip' : ''}" style="${style.join(';')}"></i>`;
  }).join('');
  const { sign, arcade } = built.anchors;
  const labels = (scene.sign && sign ? `<span class="scene-sign" style="--x:${sign.x};--y:${sign.y}">${scene.sign}</span>` : '')
    + (arcade ? `<span class="scene-sign scene-sign--arcade" style="--x:${arcade.x};--y:${arcade.y}">しょうてんがい</span>` : '');
  return `<div class="px-scene ${sceneClass(scene)}" data-scene="${scene.id}" aria-hidden="true">${actors}${labels}</div>`;
}

/** Draw a scene and its actors' sheets in idle time, so the screen that shows it opens without a stall. */
export function prewarmScene(scene) { if (scene) whenIdle(() => sceneMarkup(scene)); }

/**
 * Size scenes inside `root` to their containers ([data-scene-fit]): --bgpx from
 * the width; a "horizon" field (the quiz) also moves the scene so the hero's
 * feet stand on its road, and its floor tile continues underneath.
 */
export function fitScenes(root = typeof document === 'undefined' ? null : document) {
  if (!root?.querySelectorAll) return;
  const nodes = [...(root.matches?.('[data-scene-fit]') ? [root] : []), ...root.querySelectorAll('[data-scene-fit]')];
  for (const node of nodes) {
    const bgpx = sceneScale(node.clientWidth);
    node.style.setProperty('--bgpx', bgpx);
    if (node.dataset.sceneFit !== 'horizon') continue;
    const hero = node.querySelector('.rpg-field__hero');
    const box = node.getBoundingClientRect();
    const feet = hero ? hero.getBoundingClientRect().bottom - box.top : box.height * 0.55;
    node.style.setProperty('--scene-top', `${Math.round(feet - (SCENE_HZ + 14) * bgpx)}px`);
  }
}
if (typeof window !== 'undefined') window.addEventListener('resize', () => fitScenes());
export const SCENE_SIZE = Object.freeze({ w: SCENE_W, h: SCENE_H, horizon: SCENE_HZ });

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

/** Class name that paints the title screen art: 'sky' (skyline to the horizon) or 'ground' (the strip under the heroes). */
export function titleClass(part) {
  const s = titleImage(part);
  return s ? sheetClass('pxt', part, s) : '';
}

/** Sprite row for an enemy's standing condition. A defeated enemy is not drawn at all. */
export function enemyRestState(enemy) {
  if (enemy.hp <= 0) return 'gone';
  if (['call', 'repair'].includes(enemy.intent)) return 'cast';
  if (enemy.intent === 'boom') return 'charge';
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
    case 'repair': return [[event.source, 'cast']];
    case 'item': return [['hero', 'heal']];
    case 'recover': return [['hero', 'tired']];
    case 'defend': return [['hero', event.defense]];
    case 'guard': return [[event.target, 'guard']];
    case 'charge': return [[event.target, 'charge']];
    case 'rest': return [[event.target, 'tired']];
    case 'summon':
    case 'call': return [[event.source, 'cast']];
    case 'explode': return [[event.source, 'attack']];
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
