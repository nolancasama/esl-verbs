// Sprite sheets for heroes and enemies: one row per semantic state (ROWS),
// frames drawn by pixel-heroes.js / pixel-enemies.js on the shaded rig and
// rasterized once into a PNG sheet. CSS plays a row with steps(); the per-state
// rules are generated from FRAMES / LOOPING / DURATION_MS in battle-art.js.
import { RIG_PALETTE } from './pixel-rig.js';
import { dissolve, grid, oval, overlay, recolor, sheet, shift } from './pixel-core.js';
import { HERO_FRAME, POSES, heroFrame } from './pixel-heroes.js';
import { ENEMY_ART } from './pixel-enemies.js';

export const ROWS = Object.freeze(['idle', 'attack', 'special', 'guard', 'cast', 'dodge', 'hit', 'charge', 'defeat', 'victory',
  'broken', 'enraged', 'tired', 'heal', 'barrier', 'counter', 'shadow']);
export const FRAMES = Object.freeze({ idle: 4, attack: 5, special: 6, guard: 3, cast: 5, dodge: 4, hit: 3, charge: 2, defeat: 5, victory: 4,
  broken: 3, enraged: 2, tired: 2, heal: 4, barrier: 3, counter: 5, shadow: 6 });
/** Rows that loop; every other row plays once and holds its last frame. */
export const LOOPING = Object.freeze(new Set(['idle', 'charge', 'victory', 'enraged', 'tired']));
export const DURATION_MS = Object.freeze({ idle: 1000, attack: 420, special: 640, guard: 330, cast: 460, dodge: 380, hit: 330, charge: 520, defeat: 620,
  victory: 820, broken: 400, enraged: 320, tired: 1300, heal: 500, barrier: 380, counter: 480, shadow: 660 });

const PALETTE = Object.freeze({ ...RIG_PALETTE, _: '#1a1c2c55' });

export const HERO_IDS = Object.freeze(['fighter', 'mage', 'ninja']);
export const ENEMY_IDS = Object.freeze(Object.keys(ENEMY_ART));

const HERO_FALLBACK = {
  fighter: { cast: 'attack', charge: 'idle', broken: 'hit', enraged: 'idle', barrier: 'guard', shadow: 'special' },
  mage: { attack: 'cast', guard: 'barrier', counter: 'cast', charge: 'idle', broken: 'hit', enraged: 'idle', shadow: 'special' },
  ninja: { guard: 'dodge', cast: 'attack', barrier: 'dodge', charge: 'idle', broken: 'hit', enraged: 'idle' },
};

const isOutline = (key) => /^[a-zA-Z]+0$/.test(key);
const FLASH = (key) => (isOutline(key) ? key : 'flash');
/** One shade darker for every material pixel (a tired/beaten look). */
const DIM = (key) => {
  const match = /^([a-zA-Z]+)(\d)$/.exec(key);
  return match && Number(match[2]) > 1 ? `${match[1]}${Number(match[2]) - 1}` : key;
};

/** Horizontal centre and width of the pixels in a frame's bottom rows (where the feet are). */
function footprint(g, rows = 10) {
  let min = g.w, max = -1;
  for (let y = g.h - rows; y < g.h; y += 1) for (let x = 0; x < g.w; x += 1) if (g.d[y * g.w + x]) { min = Math.min(min, x); max = Math.max(max, x); }
  return max < 0 ? { x: g.w / 2, w: g.w * 0.4 } : { x: (min + max) / 2, w: max - min + 1 };
}

function withShadow(frame, shadow) {
  const out = grid(frame.w, frame.h);
  const w = Math.max(10, Math.round(shadow.w));
  oval(out, Math.round(shadow.x - w / 2), frame.h - 4, w, 4, '_');
  return overlay(out, frame);
}

function heroRows(id) {
  const cache = new Map();
  const draw = (pose) => { if (!cache.has(pose)) cache.set(pose, heroFrame(id, pose)); return cache.get(pose); };
  const poses = POSES[id];
  const rows = {};
  for (const row of ROWS) rows[row] = (poses[row] || poses[HERO_FALLBACK[id][row]] || poses.idle).map(draw);
  const idle = rows.idle[0];
  const foot = footprint(idle, 8);
  return { rows, fw: HERO_FRAME.w, fh: HERO_FRAME.h, shadow: { x: foot.x, w: foot.w * 0.9 } };
}

function enemyRows(spec, angry) {
  const cache = new Map();
  const draw = (mode, f) => {
    const key = `${mode}:${f}`;
    if (!cache.has(key)) cache.set(key, spec.draw({ mode, f, angry }));
    return cache.get(key);
  };
  const list = (mode) => Array.from({ length: spec.modes[mode] ?? 0 }, (_, f) => draw(mode, f));
  const idle = list('idle');
  const base = idle[0];
  const empty = grid(base.w, base.h);
  const flash = recolor(base, FLASH);
  const tired = spec.modes.tired ? list('tired') : [recolor(base, DIM), recolor(shift(base, 0, 1), DIM)];
  const guard = spec.modes.guard ? list('guard') : [shift(base, 2, 0), shift(base, 2, 0)];
  const cast = spec.modes.cast ? list('cast') : idle;
  const attack = list('attack');
  // Enemies face left: knock-back and dodges move right, away from the heroes.
  const rows = {
    idle,
    attack,
    guard,
    cast,
    dodge: [shift(base, 4, 0), shift(base, 8, -1), shift(base, 6, 0), shift(base, 2, 0)],
    hit: [flash, shift(base, 4, 0), shift(base, 2, 0)],
    charge: spec.modes.charge ? list('charge') : idle,
    // The last defeat frame is empty so nothing is left on the field.
    defeat: [flash, dissolve(shift(base, 2, 1), 0.3), dissolve(shift(base, 3, 2), 0.6), dissolve(shift(base, 4, 3), 0.85), empty],
    broken: [flash, shift(tired[0], 4, 0), shift(tired[0], 2, 0)],
    enraged: [flash, base],
    tired,
    heal: cast,
    barrier: guard,
    special: attack,
    counter: attack,
    shadow: attack,
    victory: idle,
  };
  const foot = footprint(base, spec.float ? 16 : 8);
  return { rows, fw: base.w, fh: base.h, shadow: { x: foot.x, w: foot.w * (spec.float ? 0.6 : 0.9) } };
}

const built = new Map();

/** Sprite sheet for a character; variant 'enraged' gives the boss phase-2 look. */
export function spriteSheet(id, variant = '') {
  const key = `${id}:${variant}`;
  if (!built.has(key)) built.set(key, buildSheet(id, variant, key));
  return built.get(key);
}

/** Whether spriteSheet(id, variant) is already built (a later call costs nothing). */
export function hasSpriteSheet(id, variant = '') {
  return built.has(`${id}:${variant}`);
}

function buildSheet(id, variant, key) {
  const isHero = HERO_IDS.includes(id);
  if (!isHero && !ENEMY_ART[id]) return null;
  const art = isHero ? heroRows(id) : enemyRows(ENEMY_ART[id], variant === 'enraged');
  const rows = ROWS.map((row) => {
    const frames = art.rows[row].slice(0, FRAMES[row]);
    while (frames.length < FRAMES[row]) frames.push(frames.at(-1));
    return frames.map((frame) => (row === 'defeat' && !isHero && frame === frames.at(-1) ? frame : withShadow(frame, art.shadow)));
  });
  const result = sheet(`px-${key}`, art.fw, art.fh, rows, PALETTE);
  // Transparent rows above the idle pose: the battle view lets name plates overlap them.
  if (result.top === undefined) result.top = Math.max(0, Math.min(...art.rows.idle.map(topRow)) - 2);
  return result;
}

function topRow(g) {
  for (let y = 0; y < g.h; y += 1) for (let x = 0; x < g.w; x += 1) if (g.d[y * g.w + x]) return y;
  return g.h;
}
