// Pixel icons, one-row effect sheets and stage backdrops. The DOM sequencer that
// plays effects for battle events lives in fx-player.js.
import { PAL } from './pixel-palette.js';
import { grid, px, rect, oval, line, poly, stamp, outline, dissolve, sheet, image, ditherMask } from './pixel-core.js';

const rad = (deg) => (deg * Math.PI) / 180;

/* ------------------------------------------------------------------- icons */

const ICONS = {
  attack: ['.......ii', '......iwi', '.....iwi.', '....iwi..', '.y.iwi...', '..yyi....', '..By.....', '.B..y....', 'B........'],
  guard: ['uuuuuuuuu', 'uUUUUUUDu', 'uUuuuuuDu', 'uUuyyuuDu', 'uUuyyuuDu', '.uUuuuDu.', '.uUuuuDu.', '..uUuDu..', '....u....'],
  heal: ['...eee...', '...eWe...', '...ele...', 'eeeeleeee', 'eWlllllle', 'eeeeleeee', '...ele...', '...ele...', '...eee...'],
  summon: ['..jjjjj..', '.jjjjjjj.', 'jjjjjjjjj', 'jkkjjjkkj', 'jkkjjjkkj', 'jjjjkjjjj', '.jjjjjjj.', '..jkjkj..', '..jjjjj..'],
  heavy: ['....y....', '...yo....', '...oo.y..', '..ooro.o.', '.oorroooo', '.orryrroo', 'oorYYyroo', '.orYYYro.', '..orrro..'],
  rest: ['....UUUU.', '.......U.', '......U..', '.....UUUU', 'UUUU.....', '...U.....', '..U......', '.U.......', 'UUUU.....'],
  charge: ['....yyyy.', '...yyyo..', '..yyyo...', '.yyyyyyy.', '..oyyyyo.', '....yyo..', '...yyo...', '..yo.....', '.y.......'],
  drain: ['....r....', '...rr....', '...rrr...', '..rrrrr..', '.rrWrrrr.', '.rWrrrrR.', '.rrrrrRR.', '..RrrRR..', '...RRR...'],
  opening: ['.........', '..kkkkk..', '.kwwwwwk.', 'kwwuuuwwk', 'kwwukuwwk', 'kwwuuuwwk', '.kwwwwwk.', '..kkkkk..', '.........'],
  combo: ['....y....', '....y....', '...yyy...', 'yyyyYyyyy', '.yyYYYyy.', '..yyyyy..', '..yy.yy..', '.yy...yy.', '.y.....y.'],
  counter: ['i.......i', '.i.....i.', '..i...i..', '...i.i...', '....i....', '...i.i...', '.yy...yy.', '..y...y..', '.B.....B.'],
  slash: ['.......ii', '......iwi', '.....iwi.', '....iwi..', '.y.iwi...', '..yyi....', '..By.....', '.B..y....', 'B........'],
  powerSlash: ['......YYY', '.....YiwY', '....YiwY.', '...YiwY..', '.yYiwY...', '..yiY....', '..By.....', '.B..y....', 'B........'],
  cleave: ['w.w.w.w..', '.........', 'B.yiiiiii', 'Byywwwwwi', 'B.yiiiiii', '.........', '..w.w.w.w', '.........', '.........'],
  magicBolt: ['...ccc...', '..cWWcc..', '.cWccccc.', '.cccccct.', '.ccccctt.', '..cctttt.', '...tttt..', '.........', '.........'],
  barrier: ['..ccccc..', '.c.....c.', 'c..ccc..c', 'c.c...c.c', 'c.c.W.c.c', 'c.c...c.c', 'c..ccc..c', '.c.....c.', '..ccccc..'],
  fireball: ['.....y...', '...yoo...', '..yorro..', '.yorYYro.', '.orYWYro.', '.orrYrro.', '..orrro..', '...ooo...', '.........'],
  strike: ['........W', '.......Wi', '......Wi.', '.....Wi..', '..S.Wi...', '...Si....', '..BS.....', '.B.......', 'B........'],
  dodge: ['.UUUUU...', '......U..', '.UUUU..U.', '.....U.U.', 'UUUU..U..', '....U....', '.UUU.....', '.........', '.........'],
  doubleStrike: ['...W....W', '..Wi...Wi', '.Wi...Wi.', 'Wi...Wi..', 'S...Wi...', '.S.Si....', 'B.BS.....', '.B.......', 'B........'],
  shadowStrike: ['........V', '.......Vi', '......Vi.', '.....Vi..', 'PP.SVi...', '.PPPi....', '..BPP....', '.B...P...', 'B........'],
  lock: ['..SSSS...', '.S....S..', '.S....S..', 'yyyyyyyy.', 'yYyyyyyo.', 'yyykkyyo.', 'yyykkyyo.', 'yyyyyyyo.', 'oooooooo.'],
  power: ['....yyyy.', '...yyyo..', '..yyyo...', '.yyyyyyy.', '..oyyyyo.', '....yyo..', '...yyo...', '..yo.....', '.y.......'],
  heart: ['.rr...rr.', 'rqqr.rrrr', 'rqrrrrrrr', 'rrrrrrrrr', '.rrrrrrR.', '..rrrrR..', '...rrR...', '....R....', '.........'],
  potion: ['...BBB...', '...jjj...', '....c....', '...ccc...', '..cUUUc..', '.cUWUUUc.', '.cUUUUuc.', '.cuUUuuc.', '..ccccc..'],
  cursor: ['yyy......', 'yYyy.....', 'yYYyy....', 'yYYYyy...', 'yYYYYyy..', 'yYYYyy...', 'yYYyy....', 'yYyy.....', 'yyy......'],
};

export function iconImage(name) {
  const rows = ICONS[name];
  if (!rows) return null;
  const g = grid(11, 11);
  stamp(g, rows, 1, 1);
  outline(g, 'k');
  return image(`icon-${name}`, g, PAL);
}

/* --------------------------------------------------------------- helpers */

function crescent(g, cx, cy, r, a0, a1, maxT, outer, core) {
  const steps = Math.ceil(Math.abs(a1 - a0) / 3);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps, a = rad(a0 + (a1 - a0) * t);
    const th = Math.max(1, Math.round(1 + (maxT - 1) * Math.sin(Math.PI * t)));
    const x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
    rect(g, x - (th >> 1), y - (th >> 1), th, th, outer);
    if (th >= 3 && core) px(g, x, y, core);
  }
}

function burst(g, cx, cy, r0, r1, rays, c, thick = 1, offset = 0) {
  for (let i = 0; i < rays; i += 1) {
    const a = rad(offset + (360 / rays) * i);
    line(g, cx + Math.cos(a) * r0, cy + Math.sin(a) * r0, cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, c, thick);
  }
}

function ring(g, cx, cy, r, c, thick = 1) {
  for (let a = 0; a < 360; a += 4) {
    const x = Math.round(cx + Math.cos(rad(a)) * r), y = Math.round(cy + Math.sin(rad(a)) * r);
    rect(g, x - (thick >> 1), y - (thick >> 1), thick, thick, c);
  }
}

function plus(g, x, y, c, size = 1) {
  rect(g, x - size, y - size * 3, size * 2 + 1, size * 6 + 1, c);
  rect(g, x - size * 3, y - size, size * 6 + 1, size * 2 + 1, c);
  px(g, x, y, 'W');
}

/* ----------------------------------------------------------------- effects */

// Effect colours: ramps for fire, magic, shadow, blood, holy and earth.
const FX_PAL = Object.freeze({
  ...PAL,
  f0: '#fffbe0', f1: '#fff07a', f2: '#ffc234', f3: '#ff8a1c', f4: '#e84a14', f5: '#a8200e', f6: '#5a1208',
  c0: '#ffffff', c1: '#d8fcff', c2: '#8ff0fa', c3: '#3cc4e6', c4: '#2280c0', c5: '#18427a',
  d0: '#f4d8ff', d1: '#c98cff', d2: '#9a4ee8', d3: '#6a24b8', d4: '#3e1478', d5: '#1c0838',
  b0: '#ffd0d8', b1: '#ff7a8c', b2: '#e82a4a', b3: '#a8102c', b4: '#5c061a',
  h0: '#f4ffe8', h1: '#c8ff9a', h2: '#7ee85a', h3: '#3eb43c', h4: '#1e7a2e',
  e0: '#e8dcc4', e1: '#b89c78', e2: '#8a6a48', e3: '#5a4430', e4: '#2e2218',
  g0: '#ffffff', g1: '#fff4c0', g2: '#ffe066', g3: '#f4b030',
  '~': '#3a4f9c80', '=': '#9ff3ee70', '+': '#c98cff70', '_': '#1a1c2c50', '*': '#ffffffc0', '^': '#ff8a1c90', '%': '#1c083890',
});

const fxFrames = (n, w, h, draw) => Array.from({ length: n }, (_, f) => { const g = grid(w, h); draw(g, f, f / Math.max(1, n - 1)); return g; });
const rnd = (seed) => { let v = seed >>> 0; return () => ((v = (Math.imul(v, 1664525) + 1013904223) >>> 0) / 0x100000000); };

/** Soft disc: rings of colours from the outside in (keys[0] outermost). */
function disc(g, cx, cy, r, keys, dither = true) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
    if (d > 1) continue;
    const band = Math.min(keys.length - 1, Math.floor((1 - d) * keys.length));
    const edge = (1 - d) * keys.length - band;
    const key = dither && band > 0 && edge < 0.35 && ditherMask(x, y, 0.5) ? keys[band - 1] : keys[band];
    px(g, x, y, key);
  }
}
/** Ring outline at radius r with thickness. */
function ringLine(g, cx, cy, r, key, thick = 1, squash = 1) {
  for (let a = 0; a < 360; a += Math.max(1, 90 / Math.max(r, 1))) {
    const x = cx + Math.cos(rad(a)) * r, y = cy + Math.sin(rad(a)) * r * squash;
    rect(g, Math.round(x - (thick >> 1)), Math.round(y - (thick >> 1)), thick, thick, key);
  }
}
/** Particles scattered deterministically around (cx, cy). */
function motes(g, cx, cy, count, spread, keys, seed, grow = 0) {
  const r = rnd(seed);
  for (let i = 0; i < count; i += 1) {
    const a = r() * Math.PI * 2, d = r() * spread;
    const x = Math.round(cx + Math.cos(a) * d), y = Math.round(cy + Math.sin(a) * d);
    const key = keys[Math.floor(r() * keys.length)];
    px(g, x, y, key);
    if (grow && r() < grow) { px(g, x + 1, y, key); px(g, x, y + 1, key); }
  }
}
/** Four-point star sparkle. */
function star(g, x, y, s, key = 'f1', core = 'c0') {
  line(g, x - s, y, x + s, y, key); line(g, x, y - s, x, y + s, key);
  if (s > 2) { px(g, x - 1, y - 1, key); px(g, x + 1, y + 1, key); px(g, x + 1, y - 1, key); px(g, x - 1, y + 1, key); }
  px(g, x, y, core);
}
function fade(g, level) { g.d = dissolve(g, level).d; }

const EFFECTS = {
  // Tier 1 ---------------------------------------------------------------
  slash: () => fxFrames(5, 44, 44, (g, f) => {
    const sweep = [-60, 0, 30, 40, 40][f];
    crescent(g, 16, 26, 20, -120, sweep, [2, 5, 4, 3, 2][f], f >= 3 ? 'i' : 'w', 'W');
    if (f >= 1) crescent(g, 16, 26, 16, -105, sweep - 10, 2, 'Y', null);
    if (f === 2) { star(g, 32, 20, 4, 'Y', 'W'); }
    if (f >= 3) fade(g, f === 3 ? 0.35 : 0.7);
  }),
  strikeX: () => fxFrames(4, 36, 36, (g, f) => {
    line(g, 6, 6, 29, 29, f >= 2 ? 'i' : 'W', f === 1 ? 3 : 2);
    if (f >= 1) line(g, 29, 6, 6, 29, f === 3 ? 'i' : 'W', f === 1 ? 3 : 2);
    if (f === 1) star(g, 18, 18, 5, 'Y');
    if (f === 3) fade(g, 0.55);
  }),
  impact: () => fxFrames(4, 32, 32, (g, f) => {
    if (f < 2) disc(g, 16, 16, 5 + f * 3, ['f2', 'f1', 'f0', 'c0']);
    burst(g, 16, 16, 4 + f * 3, 9 + f * 3, 8, f >= 2 ? 'f3' : 'f1', f < 2 ? 2 : 1, f * 22);
    if (f === 3) fade(g, 0.5);
  }),
  quickA: () => fxFrames(4, 40, 40, (g, f) => {
    line(g, 4 + f * 2, 6, 34, 34 - f * 2, f >= 2 ? 'c2' : 'c0', f === 1 ? 3 : 2);
    if (f < 2) line(g, 8, 4, 36, 30, 'c1');
    [0, 6, 12].forEach((dy) => line(g, 0, 20 + dy - f * 2, 10 - f * 2, 20 + dy - f * 2, 'c1'));
    if (f === 3) fade(g, 0.6);
  }),
  quickB: () => fxFrames(4, 40, 40, (g, f) => {
    line(g, 35 - f * 2, 6, 5, 34 - f * 2, f >= 2 ? 'c2' : 'c0', f === 1 ? 3 : 2);
    if (f < 2) line(g, 31, 4, 3, 30, 'c1');
    if (f === 1) star(g, 20, 20, 6, 'c2');
    if (f === 3) fade(g, 0.6);
  }),
  boltProj: () => fxFrames(3, 22, 18, (g, f) => {
    disc(g, 14, 9, 5, ['c4', 'c3', 'c2', 'c0']);
    [[7, 9], [4, 8 + (f % 2)], [2, 10 - (f % 2)], [9, 6], [9, 12]].forEach(([x, y]) => px(g, x, y, 'c2'));
    star(g, 14, 9, 2 + (f % 2), 'c1', 'c0');
  }),
  boltHit: () => fxFrames(4, 36, 36, (g, f) => {
    ringLine(g, 18, 18, 4 + f * 4, f >= 2 ? 'c3' : 'c1', f === 0 ? 3 : 2);
    if (f < 2) disc(g, 18, 18, 6 - f, ['c3', 'c2', 'c0']);
    burst(g, 18, 18, 6 + f * 3, 9 + f * 4, 6, 'c2', 1, 30);
    if (f === 3) fade(g, 0.55);
  }),
  // Tier 2 ---------------------------------------------------------------
  bigSlash: () => fxFrames(6, 72, 72, (g, f) => {
    if (f === 0) { crescent(g, 24, 44, 32, -120, -80, 3, 'Y', 'W'); return; }
    const end = [0, 10, 40, 50, 50, 50][f];
    crescent(g, 24, 44, 32, -125, end, [0, 10, 8, 6, 4, 3][f], f >= 4 ? 'g3' : 'g2', 'g0');
    crescent(g, 24, 44, 26, -110, end - 10, [0, 5, 4, 3, 2, 2][f], 'g1', 'W');
    if (f >= 2) burst(g, 50, 36, 5 + f * 3, 12 + f * 4, 10, f >= 4 ? 'f3' : 'f2', 2, 18);
    if (f === 2) star(g, 52, 34, 8, 'g1');
    if (f >= 4) fade(g, f === 4 ? 0.4 : 0.75);
  }),
  bigImpact: () => fxFrames(5, 60, 60, (g, f) => {
    if (f < 3) disc(g, 30, 30, [8, 13, 16][f], ['f3', 'f2', 'f1', 'f0', 'c0']);
    ringLine(g, 30, 30, 10 + f * 5, f >= 3 ? 'f3' : 'f1', 2);
    burst(g, 30, 30, 8 + f * 4, 16 + f * 5, 12, f >= 3 ? 'f4' : 'f2', 2, f * 15);
    if (f >= 3) fade(g, f === 3 ? 0.4 : 0.75);
  }),
  cleaveSweep: () => fxFrames(5, 176, 48, (g, f) => {
    const reach = [40, 110, 168, 172, 172][f];
    for (let x = 2; x < reach; x += 1) {
      const t = x / 172, y = Math.round(30 - Math.sin(t * Math.PI) * 12);
      const lead = reach - x;
      const thick = f >= 3 ? 3 : Math.max(3, Math.round(12 * Math.sin(t * Math.PI) * Math.min(1, lead / 30 + 0.3)));
      for (let k = 0; k < thick; k += 1) px(g, x, y - (thick >> 1) + k, k === 0 ? 'g0' : k < thick / 2 ? 'g1' : k === thick - 1 ? 'g3' : 'g2');
      if (lead < 6) rect(g, x, y - (thick >> 1) - 1, 1, thick + 2, 'c0');
      if (x % 7 === 0 && f < 3) { px(g, x - 4, y + thick, 'f2'); px(g, x - 8, y + thick + 2, 'f1'); }
    }
    if (f >= 1) motes(g, reach - 8, 24, 16, 12, ['g1', 'g0', 'f2'], 7 + f, 0.4);
    if (f >= 3) fade(g, f === 3 ? 0.4 : 0.78);
  }),
  breakFx: () => fxFrames(6, 72, 72, (g, f) => {
    const shards = 11;
    for (let i = 0; i < shards; i += 1) {
      const a = rad(i * (360 / shards) + 12), d = 5 + f * 6;
      const x = 36 + Math.cos(a) * d, y = 36 + Math.sin(a) * d;
      poly(g, [[x, y - 3], [x + 2, y], [x, y + 4], [x - 2, y]], i % 3 === 0 ? 'c0' : i % 3 === 1 ? 'c2' : 'c3');
    }
    if (f <= 1) { disc(g, 36, 36, 10 + f * 3, ['c3', 'c2', 'c1', 'c0']); burst(g, 36, 36, 12, 30, 14, 'c0', 2); }
    if (f >= 1) ringLine(g, 36, 36, 12 + f * 5, f >= 4 ? 'c4' : 'c2', 2);
    if (f >= 4) fade(g, f === 4 ? 0.45 : 0.8);
  }),
  counterX: () => fxFrames(5, 44, 44, (g, f) => {
    line(g, 6, 6, 37, 37, f >= 3 ? 'g3' : 'g1', f ? 3 : 2);
    if (f >= 1) line(g, 37, 6, 6, 37, f >= 3 ? 'g3' : 'g0', f === 1 ? 4 : 2);
    if (f === 2) { burst(g, 22, 22, 8, 17, 10, 'g2', 2); star(g, 22, 22, 6, 'g1'); }
    if (f >= 3) fade(g, f === 3 ? 0.4 : 0.75);
  }),
  guardFx: () => fxFrames(4, 40, 44, (g, f) => {
    const w = 14 + f, top = 6;
    poly(g, [[20 - w, top], [20 + w, top], [20 + w, 26], [20, 40], [20 - w, 26]], f === 1 ? 'c1' : 'c2');
    poly(g, [[20 - w + 3, top + 3], [20 + w - 3, top + 3], [20 + w - 3, 25], [20, 36], [20 - w + 3, 25]], f === 1 ? 'c0' : '=');
    line(g, 20, top + 4, 20, 34, 'c0');
    if (f === 1) star(g, 30, 10, 4, 'c0');
    if (f >= 2) fade(g, f === 2 ? 0.35 : 0.7);
  }),
  barrierForm: () => fxFrames(5, 64, 76, (g, f) => {
    const rise = [0.25, 0.5, 0.8, 1, 1][f];
    for (let y = 0; y < 76; y += 1) for (let x = 0; x < 64; x += 1) {
      const dx = (x + 0.5 - 32) / 30, dy = (y + 0.5 - 40) / 36;
      const d = dx * dx + dy * dy;
      if (d > 1 || y > 74 || y < 76 - 76 * rise) continue;
      if (d > 0.84) px(g, x, y, f === 3 ? 'c0' : 'c2');
      else if ((x + y * 3) % 12 === 0 || (x * 3 - y) % 13 === 0) px(g, x, y, 'c1');
      else if (ditherMask(x, y, 0.28)) px(g, x, y, '=');
    }
    if (f >= 3) motes(g, 32, 40, 14, 30, ['c0', 'c1'], 31 + f);
    if (f === 4) fade(g, 0.4);
  }),
  barrier: () => fxFrames(2, 60, 70, (g, f) => {
    for (let y = 0; y < 70; y += 1) for (let x = 0; x < 60; x += 1) {
      const dx = (x + 0.5 - 30) / 28, dy = (y + 0.5 - 37) / 33;
      const d = dx * dx + dy * dy;
      if (d > 1 || y > 68) continue;
      if (d > 0.86) px(g, x, y, 'c2');
      else if (((x + y * 3 + f * 4) % 14 === 0) || ((x * 3 - y + f * 3) % 15 === 0)) px(g, x, y, 'c1');
      else if (ditherMask(x + f, y, 0.22)) px(g, x, y, '=');
    }
    [[14, 18], [44, 16], [30, 8], [12, 44], [48, 42]].forEach(([x, y], i) => { if ((i + f) % 2) star(g, x, y, 2, 'c1', 'c0'); });
  }),
  healPillar: () => fxFrames(6, 52, 88, (g, f) => {
    const w = [6, 12, 16, 16, 12, 6][f];
    for (let y = 0; y < 88; y += 1) for (let x = 26 - w; x <= 26 + w; x += 1) {
      const t = Math.abs(x + 0.5 - 26) / w;
      if (t > 1) continue;
      const key = t < 0.3 ? 'h0' : t < 0.65 ? 'h1' : 'h2';
      if (t > 0.65 && !ditherMask(x, y, 0.5)) continue;
      if (y < 10 && !ditherMask(x, y, y / 10)) continue;
      px(g, x, y, key);
    }
    for (let i = 0; i < 6; i += 1) {
      const y = 80 - ((i * 14 + f * 12) % 80), x = 10 + ((i * 17) % 32);
      plus(g, x, y, i % 2 ? 'h1' : 'h0', 1);
    }
    if (f >= 4) fade(g, f === 4 ? 0.35 : 0.7);
  }),
  potionFx: () => fxFrames(5, 44, 52, (g, f) => {
    for (let i = 0; i < 7; i += 1) {
      const y = 46 - ((i * 9 + f * 8) % 44), x = 8 + ((i * 11) % 28), r = 1 + (i % 3);
      ringLine(g, x, y, r, i % 2 ? 'h1' : 'c1', 1);
    }
    if (f >= 1 && f <= 3) star(g, 22, 22 - f * 3, 4 + f, 'h1', 'h0');
    if (f === 4) fade(g, 0.6);
  }),
  recoverFx: () => fxFrames(5, 56, 64, (g, f) => {
    const y = 56 - f * 8;
    ringLine(g, 28, y, 18 - f * 2, f >= 3 ? 'c3' : 'c1', 2, 0.35);
    ringLine(g, 28, y + 8, 14 - f, 'c2', 1, 0.35);
    motes(g, 28, y - 6, 10, 18, ['c0', 'c1', 'c2'], 11 + f);
    if (f === 4) fade(g, 0.6);
  }),
  // Tier 3: fire ---------------------------------------------------------
  runeCircle: () => fxFrames(6, 76, 28, (g, f) => {
    const spin = f * 20;
    ringLine(g, 38, 14, 34, f % 2 ? 'f2' : 'f1', 1, 0.34);
    ringLine(g, 38, 14, 26, 'f3', 1, 0.34);
    for (let i = 0; i < 8; i += 1) {
      const a = rad(i * 45 + spin), x = 38 + Math.cos(a) * 30, y = 14 + Math.sin(a) * 30 * 0.34;
      rect(g, Math.round(x) - 1, Math.round(y) - 1, 3, 2, i % 2 ? 'f1' : 'f0');
    }
    for (let i = 0; i < 3; i += 1) { const a = rad(i * 120 - spin); line(g, 38 + Math.cos(a) * 26, 14 + Math.sin(a) * 8.8, 38 + Math.cos(a + rad(120)) * 26, 14 + Math.sin(a + rad(120)) * 8.8, 'f2'); }
    if (f === 5) fade(g, 0.5);
  }),
  fireProj: () => fxFrames(4, 48, 36, (g, f) => {
    const wob = f % 2 ? 2 : -2;
    poly(g, [[0, 18 + wob], [22, 7], [22, 29]], 'f4');
    poly(g, [[6, 18 - wob], [22, 11], [22, 25]], 'f3');
    poly(g, [[12, 18], [22, 14], [22, 22]], 'f2');
    disc(g, 30, 18, 12, ['f5', 'f4', 'f3', 'f2', 'f1', 'f0']);
    motes(g, 10, 18, 8, 10, ['f2', 'f3', 'f1'], 5 + f);
  }),
  fireBlast: () => fxFrames(7, 104, 104, (g, f) => {
    const r = [10, 24, 34, 40, 44, 46, 46][f];
    if (f < 5) disc(g, 52, 52, r, f < 2 ? ['f3', 'f2', 'f1', 'f0', 'c0'] : ['f5', 'f4', 'f3', 'f2', 'f1']);
    if (f >= 2) ringLine(g, 52, 52, r + 4, f >= 5 ? 'e2' : 'f4', 3);
    if (f >= 3) for (let i = 0; i < 10; i += 1) { const a = rad(i * 36 + f * 9); disc(g, 52 + Math.cos(a) * (r - 6), 52 + Math.sin(a) * (r - 6), 7 - Math.min(5, f - 3), f >= 5 ? ['e3', 'e2', 'e1'] : ['f5', 'f4', 'f3']); }
    motes(g, 52, 52, 30, r + 10, ['f1', 'f2', 'f0', 'f3'], 99 + f, 0.3);
    if (f >= 5) fade(g, f === 5 ? 0.35 : 0.7);
  }),
  fireHit: () => fxFrames(4, 44, 44, (g, f) => {
    const r = [8, 14, 18, 18][f];
    disc(g, 22, 24, r, f < 2 ? ['f4', 'f3', 'f2', 'f1', 'f0'] : ['f5', 'f4', 'f3', 'f2']);
    [6, 14, 22, 30, 38].forEach((x, i) => { const h = 8 + ((i + f) % 3) * 5; poly(g, [[x - 4, 34], [x, 34 - h], [x + 4, 34]], i % 2 ? 'f2' : 'f3'); });
    if (f >= 2) fade(g, f === 2 ? 0.3 : 0.65);
  }),
  embers: () => fxFrames(5, 72, 56, (g, f) => {
    const r = rnd(17);
    for (let i = 0; i < 26; i += 1) {
      const x = Math.round(4 + r() * 64), y0 = 50 - r() * 20, y = Math.round(y0 - f * (4 + r() * 5));
      if (y < 0) continue;
      px(g, x, y, ['f0', 'f1', 'f2', 'f3'][i % 4]);
      if (i % 3 === 0) px(g, x, y + 1, 'f4');
    }
    if (f >= 3) fade(g, f === 3 ? 0.35 : 0.65);
  }),
  breath: () => fxFrames(4, 52, 44, (g, f) => {
    disc(g, 26, 22, [12, 16, 18, 16][f], f < 2 ? ['f4', 'f3', 'f2', 'f1', 'f0'] : ['f5', 'f4', 'f3', 'f2']);
    motes(g, 26, 22, 14, 22, ['f1', 'f2', 'f0'], 3 + f, 0.4);
    if (f === 3) fade(g, 0.45);
  }),
  chargeGather: () => fxFrames(4, 64, 64, (g, f) => {
    const r = 28 - f * 6;
    for (let i = 0; i < 12; i += 1) {
      const a = rad(i * 30 + f * 12), x = 32 + Math.cos(a) * r, y = 32 + Math.sin(a) * r;
      line(g, x, y, 32 + Math.cos(a) * (r + 5), 32 + Math.sin(a) * (r + 5), i % 2 ? 'f2' : 'f1');
    }
    disc(g, 32, 32, 3 + f * 2, ['f3', 'f2', 'f1', 'f0']);
  }),
  // Tier 3: shadow / dark / blood / earth --------------------------------
  darkSlash: () => fxFrames(5, 52, 52, (g, f) => {
    const end = [-20, 30, 40, 40, 40][f];
    crescent(g, 18, 30, 24, -125, end, [3, 7, 5, 4, 3][f], f >= 3 ? 'd3' : 'd2', 'd0');
    crescent(g, 18, 30, 19, -110, end - 12, 2, 'd4', null);
    if (f === 2) { burst(g, 38, 24, 4, 11, 8, 'd1', 1); star(g, 38, 24, 5, 'd1', 'd0'); }
    if (f >= 3) fade(g, f === 3 ? 0.4 : 0.75);
  }),
  shadowPuff: () => fxFrames(5, 48, 60, (g, f) => {
    [[24, 40, 10], [14, 44, 7], [34, 44, 7], [24, 28, 8], [20, 52, 6], [30, 52, 6]].forEach(([x, y, r], i) => {
      const s = r + f * 2, ox = (x - 24) * f * 0.25, oy = (y - 40) * f * 0.25 - f * 2;
      disc(g, x + ox, y + oy, s, i % 2 ? ['d5', 'd4', 'd3'] : ['d4', 'd3', 'd2'], true);
    });
    if (f >= 2) fade(g, [0, 0, 0.3, 0.55, 0.8][f]);
  }),
  darkGather: () => fxFrames(5, 64, 64, (g, f) => {
    const r = 30 - f * 5;
    for (let i = 0; i < 14; i += 1) {
      const a = rad(i * (360 / 14) - f * 16), x = 32 + Math.cos(a) * r, y = 32 + Math.sin(a) * r;
      line(g, x, y, 32 + Math.cos(a - 0.4) * (r + 6), 32 + Math.sin(a - 0.4) * (r + 6), i % 2 ? 'd1' : 'd3');
    }
    disc(g, 32, 32, 3 + f * 2.5, ['d5', 'd4', 'd3', 'd1', 'd0']);
  }),
  darkOrb: () => fxFrames(3, 44, 44, (g, f) => {
    disc(g, 22, 22, 13, ['d5', 'd4', 'd3', 'd2', 'd1']);
    ringLine(g, 22, 22, 15 + f, 'd1', 1);
    motes(g, 22, 22, 12, 20, ['d1', 'd0', 'd2'], 21 + f);
  }),
  darkBurst: () => fxFrames(7, 104, 104, (g, f) => {
    const r = [8, 20, 32, 40, 44, 46, 46][f];
    if (f < 5) disc(g, 52, 52, r, f < 2 ? ['d3', 'd2', 'd1', 'd0', 'c0'] : ['d5', 'd4', 'd3', 'd2', 'd1']);
    ringLine(g, 52, 52, r + 3, f >= 4 ? 'd4' : 'd1', 3);
    burst(g, 52, 52, r * 0.6, r + 10, 16, f >= 4 ? 'd3' : 'd1', 2, f * 11);
    if (f >= 5) fade(g, f === 5 ? 0.4 : 0.75);
  }),
  bloodMoon: () => fxFrames(6, 56, 56, (g, f) => {
    const r = [6, 12, 16, 18, 18, 18][f];
    disc(g, 28, 28, r + 4, ['b4', 'b4']);
    disc(g, 28, 28, r, ['b4', 'b3', 'b2', 'b1']);
    if (f >= 2) { px(g, 24, 22, 'b0'); px(g, 25, 22, 'b0'); px(g, 24, 23, 'b0'); }
    if (f >= 3) motes(g, 28, 28, 12, 26, ['b1', 'b2', 'b0'], 41 + f);
    if (f === 5) fade(g, 0.3);
  }),
  bloodSlash: () => fxFrames(5, 52, 52, (g, f) => {
    const end = [-20, 30, 40, 40, 40][f];
    crescent(g, 18, 30, 24, -125, end, [3, 7, 5, 4, 3][f], f >= 3 ? 'b3' : 'b2', 'b0');
    if (f === 2) star(g, 38, 24, 5, 'b1', 'b0');
    if (f >= 3) fade(g, f === 3 ? 0.4 : 0.75);
  }),
  drainOrb: () => fxFrames(3, 16, 16, (g, f) => { disc(g, 8, 8, 5, ['b4', 'b3', 'b2', 'b1']); px(g, 6, 6, 'b0'); if (f) px(g, 14, 8, 'b2'); }),
  healOrb: () => fxFrames(3, 16, 16, (g, f) => { disc(g, 8, 8, 5, ['h4', 'h3', 'h2', 'h1']); px(g, 6, 6, 'h0'); if (f) px(g, 1, 8, 'h2'); }),
  drainHeal: () => fxFrames(4, 36, 48, (g, f) => {
    for (let i = 0; i < 5; i += 1) { const y = 42 - ((i * 9 + f * 7) % 40), x = 6 + ((i * 11) % 24); plus(g, x, y, i % 2 ? 'b1' : 'b2', 1); }
    if (f === 3) fade(g, 0.5);
  }),
  quakeCrack: () => fxFrames(6, 200, 40, (g, f) => {
    const reach = [40, 100, 160, 200, 200, 200][f];
    const r = rnd(77);
    for (const dir of [1, -1]) {
      let y = 20;
      for (let x = 100; Math.abs(x - 100) < reach / 2; x += dir) {
        y += Math.round(r() * 2 - 1); y = Math.max(10, Math.min(30, y));
        rect(g, x, y - 1, 1, 3, 'e4'); px(g, x, y - 2, 'e3'); if (f < 3) px(g, x, y + 2, 'f3');
        if (x % 12 === 0) { const ty = y + (r() < 0.5 ? -8 : 8); line(g, x, y, x + dir * 5, ty, 'e4', 2); }
      }
    }
    if (f >= 1) motes(g, 100, 16, 30 + f * 8, reach / 2, ['e1', 'e2', 'e0', 'e3'], 5 + f, 0.6);
    if (f <= 2) disc(g, 100, 22, 8 + f * 4, ['f4', 'f3', 'f2']);
    if (f >= 4) fade(g, f === 4 ? 0.35 : 0.7);
  }),
  debris: () => fxFrames(5, 80, 80, (g, f) => {
    const r = rnd(13);
    for (let i = 0; i < 16; i += 1) {
      const vx = r() * 2.4 - 1.2, vy = -(1.6 + r() * 2.2), s = 2 + Math.floor(r() * 3);
      const x = 40 + vx * f * 9, y = 68 + vy * f * 9 + f * f * 1.8;
      rect(g, Math.round(x), Math.round(y), s + 1, s, i % 3 ? 'e2' : 'e1');
      px(g, Math.round(x), Math.round(y), 'e0'); px(g, Math.round(x + s), Math.round(y + s - 1), 'e3');
    }
    if (f <= 1) disc(g, 40, 72, 16 + f * 8, ['e3', 'e2', 'e1']);
    if (f >= 3) fade(g, f === 3 ? 0.35 : 0.7);
  }),
  // Misc ------------------------------------------------------------------
  enrage: () => fxFrames(5, 80, 80, (g, f) => {
    ringLine(g, 40, 40, 10 + f * 7, f >= 3 ? 'b3' : 'b2', 3);
    burst(g, 40, 40, 14 + f * 5, 22 + f * 6, 14, f >= 3 ? 'f3' : 'f1', 2, f * 13);
    if (f >= 3) fade(g, f === 3 ? 0.4 : 0.75);
  }),
  poof: () => fxFrames(5, 48, 48, (g, f) => {
    [[24, 24, 9], [14, 27, 7], [34, 27, 7], [24, 15, 7], [24, 34, 6]].forEach(([x, y, r], i) => {
      const s = r + f * 2, ox = (x - 24) * f * 0.35, oy = (y - 24) * f * 0.35;
      disc(g, x + ox, y + oy, s, i % 2 ? ['e2', 'e1', 'e0'] : ['e1', 'e0', 'c0']);
    });
    if (f >= 2) fade(g, [0, 0, 0.3, 0.55, 0.8][f]);
  }),
  bossBurst: () => fxFrames(7, 120, 120, (g, f) => {
    for (let i = 0; i < 7; i += 1) {
      const a = rad(i * (360 / 7) + f * 17), d = f * 7;
      disc(g, 60 + Math.cos(a) * d, 60 + Math.sin(a) * d, Math.max(3, 14 - f * 1.5), f % 2 ? ['f2', 'f1', 'f0'] : ['f1', 'f0', 'c0']);
    }
    ringLine(g, 60, 60, 12 + f * 8, 'g2', 3);
    burst(g, 60, 60, 20 + f * 5, 32 + f * 6, 18, 'f3', 2, f * 11);
    if (f >= 5) fade(g, f === 5 ? 0.4 : 0.75);
  }),
  sparkle: () => fxFrames(4, 24, 24, (g, f) => { star(g, 12, 12, [3, 7, 5, 2][f], 'g1', 'c0'); if (f === 1) motes(g, 12, 12, 6, 9, ['g2', 'g1'], 3); }),
  status: () => fxFrames(4, 36, 36, (g, f) => {
    burst(g, 18, 18, 4 + f * 3, 10 + f * 4, 8, f >= 2 ? 'g3' : 'g2', 2, 22);
    if (f < 2) { disc(g, 18, 18, 5 + f, ['g2', 'g1', 'g0']); }
    if (f === 3) fade(g, 0.55);
  }),
  eyeFx: () => fxFrames(3, 28, 18, (g, f) => {
    const open = [1, 5, 4][f];
    oval(g, 2, 9 - open, 24, open * 2, 'w');
    if (open > 1) { oval(g, 10, 9 - Math.min(open, 4), 8, Math.min(open, 4) * 2, 'u'); px(g, 12, 7, 'W'); }
    outline(g, 'k');
  }),
  summon: () => fxFrames(5, 60, 60, (g, f) => {
    ringLine(g, 30, 50, 24, 'd2', 2, 0.3); ringLine(g, 30, 50, 17, 'd3', 1, 0.3);
    for (let i = 0; i < 6; i += 1) { const x = 10 + i * 8, y = 48 - f * 7 - (i % 2) * 5; if (y > 2) { rect(g, x, y, 2, 4, i % 2 ? 'd1' : 'd0'); } }
    if (f === 4) fade(g, 0.5);
  }),
  flash: () => fxFrames(1, 4, 4, (g) => rect(g, 0, 0, 4, 4, 'W')),
};

const effectCache = new Map();
export function effectSheet(name) {
  if (!EFFECTS[name]) return null;
  if (!effectCache.has(name)) {
    const list = EFFECTS[name]();
    const s = sheet(`fx-${name}`, list[0].w, list[0].h, [list], FX_PAL);
    effectCache.set(name, { ...s, frames: list.length, grids: s.grids, palette: s.palette });
  }
  return effectCache.get(name);
}
export const EFFECT_NAMES = Object.freeze(Object.keys(EFFECTS));

/* --------------------------------------------------------------- backdrops */

const BG_W = 192, BG_H = 112, HORIZON = 70;
const wrapX = (fn) => { for (const off of [-BG_W, 0, BG_W]) fn(off); };

// Backdrop palettes are quieter than the character palette on purpose.
const BG = {
  1: { a: '#8fd0f2', b: '#b5e2f6', c: '#d8f1f7', h: '#9cc9b4', t: '#4f9a6a', T: '#3a7c56', g: '#78b35a', G: '#62a04c', d: '#8cc166', p: '#d2c08a', P: '#bca874', w: '#ffffff', f: '#f7a1b4', y: '#f3db77', k: '#2d5b43' },
  2: { a: '#f2b88a', b: '#f7cf98', c: '#fbe3b0', h: '#b69ab2', t: '#3d6a64', T: '#2c524f', g: '#8f8a58', G: '#7a744a', d: '#a39b64', p: '#b58c62', P: '#9a744f', w: '#d9cdb6', f: '#bdb3a0', y: '#e9c77e', k: '#2a3a3b' },
  3: { a: '#2e3350', b: '#373d5e', c: '#41486b', h: '#4f5678', t: '#5f6688', T: '#282c45', g: '#555d78', G: '#474e69', d: '#636b86', p: '#6c7490', P: '#3c4260', w: '#8a92ac', f: '#f5a14a', y: '#ffd86b', k: '#1d2034' },
  4: { a: '#3a2350', b: '#5a2c55', c: '#7e3a52', h: '#5b3150', t: '#2c1c3c', T: '#1f1530', g: '#4c3a52', G: '#3e2f46', d: '#5b4760', p: '#e0643a', P: '#b54434', w: '#8f7a95', f: '#ff9a45', y: '#ffd16a', k: '#170f24' },
};

function sky(g, top, mid, low) {
  for (let y = 0; y < HORIZON; y += 1) for (let x = 0; x < BG_W; x += 1) {
    const t = y / HORIZON;
    let c = t < 0.4 ? top : t < 0.75 ? mid : low;
    if (t >= 0.34 && t < 0.4 && ditherMask(x, y, 0.5)) c = mid;
    if (t >= 0.69 && t < 0.75 && ditherMask(x, y, 0.5)) c = low;
    px(g, x, y, c);
  }
}

function ground(g, base, alt, speck) {
  for (let y = HORIZON; y < BG_H; y += 1) for (let x = 0; x < BG_W; x += 1) {
    const band = Math.floor((y - HORIZON) / 6) % 2;
    px(g, x, y, band && ditherMask(x, y, 0.25) ? alt : base);
    if (speck && ((x * 7 + y * 13) % 53 === 0)) px(g, x, y, speck);
  }
}

function hills(g, baseY, amp, period, c, phase = 0) {
  for (let x = 0; x < BG_W; x += 1) {
    const top = Math.round(baseY - amp * (0.5 + 0.5 * Math.sin(((x + phase) / period) * Math.PI * 2)));
    for (let y = top; y < HORIZON; y += 1) px(g, x, y, c);
  }
}

const BACKDROPS = {
  1: (g) => {
    sky(g, 'a', 'b', 'c');
    [[20, 12], [96, 20], [150, 8]].forEach(([x, y]) => wrapX((o) => { oval(g, x + o, y, 22, 7, 'w'); oval(g, x + o + 6, y - 4, 12, 8, 'w'); oval(g, x + o + 14, y - 1, 12, 6, 'w'); }));
    hills(g, 60, 12, 96, 'h', 10);
    for (let x = 0; x < BG_W; x += 12) wrapX((o) => { oval(g, x + o, 56 + ((x / 12) % 3), 16, 14, 'T'); oval(g, x + o + 2, 55 + ((x / 12) % 3), 12, 8, 't'); });
    rect(g, 0, 66, BG_W, 4, 'T');
    ground(g, 'g', 'G', 'd');
    for (let x = 0; x < BG_W; x += 1) { const y = 84 + Math.round(3 * Math.sin((x / BG_W) * Math.PI * 2)); rect(g, x, y, 1, 7, 'p'); px(g, x, y + 7, 'P'); }
    [[14, 76], [60, 100], [118, 78], [170, 104], [88, 74]].forEach(([x, y], i) => { px(g, x, y, 'k'); px(g, x + 1, y - 1, 'k'); px(g, x + 2, y, 'k'); if (i % 2) px(g, x + 1, y - 2, i % 4 === 1 ? 'f' : 'y'); });
  },
  2: (g) => {
    sky(g, 'a', 'b', 'c');
    hills(g, 54, 16, 64, 'h', 20);
    for (let x = 0; x < BG_W; x += 10) wrapX((o) => {
      const h = 18 + ((x * 3) % 11);
      poly(g, [[x + o - 5, 70], [x + o, 70 - h], [x + o + 5, 70]], (x / 10) % 2 ? 'T' : 't');
    });
    [[40, 3], [140, 2]].forEach(([x, n]) => wrapX((o) => {
      for (let i = 0; i < n; i += 1) { const h = 22 - i * 7; rect(g, x + o + i * 12, 70 - h, 7, h, 'w'); rect(g, x + o + i * 12, 70 - h, 7, 2, 'f'); rect(g, x + o + i * 12 + 5, 70 - h, 2, h, 'f'); }
    }));
    ground(g, 'g', 'G', 'd');
    for (let y = 80; y < 96; y += 1) for (let x = 0; x < BG_W; x += 1) px(g, x, y, ditherMask(x, y, 0.15) ? 'P' : 'p');
    [[20, 88], [70, 84], [130, 90], [180, 86]].forEach(([x, y]) => { rect(g, x, y, 3, 2, 'w'); px(g, x, y + 2, 'P'); });
  },
  3: (g) => {
    for (let y = 0; y < HORIZON; y += 1) for (let x = 0; x < BG_W; x += 1) {
      const row = Math.floor(y / 8), bx = (x + (row % 2) * 8) % 16;
      px(g, x, y, y % 8 === 7 || bx === 15 ? 'T' : row % 3 === 0 && ditherMask(x, y, 0.2) ? 'c' : 'b');
    }
    [[24, 20], [120, 20]].forEach(([x, w]) => wrapX((o) => {
      oval(g, x + o, 22, w + 16, 40, 'a'); rect(g, x + o, 42, w + 16, 28, 'a');
      for (let y = 30; y < 70; y += 1) for (let i = 0; i < w + 16; i += 1) if (ditherMask(i, y, 0.15)) px(g, x + o + i, y, 'T');
    }));
    [[80, 30], [176, 30]].forEach(([x, y]) => wrapX((o) => {
      rect(g, x + o, y, 4, 8, 'P'); rect(g, x + o - 1, y - 1, 6, 2, 'w');
      poly(g, [[x + o - 2, y - 1], [x + o + 2, y - 9], [x + o + 6, y - 1]], 'f'); poly(g, [[x + o, y - 1], [x + o + 2, y - 6], [x + o + 4, y - 1]], 'y');
      for (let r = 0; r < 12; r += 1) for (let a = 0; a < 360; a += 20) { const gx = Math.round(x + o + 2 + Math.cos(rad(a)) * r), gy = Math.round(y - 4 + Math.sin(rad(a)) * r); if (r > 6 && ditherMask(gx, gy, 0.12)) px(g, gx, gy, 'h'); }
    }));
    rect(g, 0, 68, BG_W, 2, 'k');
    for (let y = HORIZON; y < BG_H; y += 1) for (let x = 0; x < BG_W; x += 1) {
      const row = Math.floor((y - HORIZON) / 10), bx = (x + (row % 2) * 12) % 24;
      px(g, x, y, (y - HORIZON) % 10 === 9 || bx === 23 ? 'G' : ditherMask(x, y, 0.1) ? 'd' : 'g');
    }
  },
  4: (g) => {
    sky(g, 'a', 'b', 'c');
    [[12, 6], [60, 14], [100, 4], [150, 18], [180, 9]].forEach(([x, y]) => px(g, x, y, 'y'));
    hills(g, 58, 14, 48, 'h', 0);
    for (let x = 0; x < BG_W; x += 1) if ((x % 48) > 20 && (x % 48) < 28) px(g, x, 52 + Math.abs((x % 48) - 24), 'p');
    wrapX((o) => {
      const x = 110 + o;
      rect(g, x, 34, 40, 36, 't'); rect(g, x + 4, 22, 8, 48, 't'); rect(g, x + 28, 18, 8, 52, 't'); rect(g, x + 16, 28, 8, 42, 't');
      poly(g, [[x + 3, 22], [x + 8, 12], [x + 13, 22]], 't'); poly(g, [[x + 27, 18], [x + 32, 6], [x + 37, 18]], 't'); poly(g, [[x + 15, 28], [x + 20, 20], [x + 25, 28]], 't');
      [[x + 7, 30], [x + 31, 26], [x + 19, 36], [x + 10, 46], [x + 30, 44]].forEach(([wx, wy]) => rect(g, wx, wy, 2, 3, 'y'));
      for (let i = 0; i < 40; i += 4) rect(g, x + i, 32, 2, 2, 't');
    });
    rect(g, 0, 66, BG_W, 4, 'T');
    for (let y = HORIZON; y < BG_H; y += 1) for (let x = 0; x < BG_W; x += 1) {
      const row = Math.floor((y - HORIZON) / 8), bx = (x + (row % 2) * 8) % 16;
      px(g, x, y, (y - HORIZON) % 8 === 7 || bx === 15 ? 'G' : 'g');
    }
    [[30, 80, 44, 88], [120, 96, 134, 100], [80, 104, 70, 110]].forEach(([x0, y0, x1, y1]) => wrapX((o) => line(g, x0 + o, y0, x1 + o, y1, 'P')));
  },
};

export function backdropImage(stage) {
  const draw = BACKDROPS[stage];
  if (!draw) return null;
  const g = grid(BG_W, BG_H);
  draw(g);
  return image(`backdrop-${stage}`, g, BG[stage]);
}

