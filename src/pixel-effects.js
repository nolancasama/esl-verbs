// Pixel icons, one-row effect sheets, stage backdrops, and the small DOM
// player that shows effects for battle events. Effects are cosmetic only:
// battle logic never waits for them, and nodes are dropped on every re-render.
import { PAL } from './pixel-palette.js';
import { grid, px, rect, oval, line, poly, stamp, outline, dissolve, recolor, sheet, image, sheetClass, ditherMask } from './pixel-core.js';

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

/* ----------------------------------------------------------------- effects */

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

const frames = (n, w, h, draw) => Array.from({ length: n }, (_, f) => { const g = grid(w, h); draw(g, f); return g; });

const EFFECTS = {
  slash: () => frames(4, 32, 32, (g, f) => {
    if (f === 0) crescent(g, 12, 20, 14, -100, -40, 2, 'w', 'W');
    else crescent(g, 12, 20, 14, -110, 20, f === 1 ? 4 : 3, f === 3 ? 'i' : 'w', 'Y');
    if (f === 2) { burst(g, 22, 16, 3, 6, 6, 'Y'); }
    if (f === 3) g.d = dissolve(g, 0.5).d;
  }),
  quickA: () => frames(3, 32, 32, (g, f) => {
    line(g, 4 + f * 2, 4, 26, 26 - f * 2, f === 2 ? 'i' : 'w', f === 1 ? 3 : 2);
    if (f === 1) line(g, 6, 6, 24, 24, 'W');
  }),
  quickB: () => frames(3, 32, 32, (g, f) => {
    line(g, 27 - f * 2, 5, 5, 27 - f * 2, f === 2 ? 'i' : 'w', f === 1 ? 3 : 2);
    if (f === 1) line(g, 25, 7, 7, 25, 'W');
  }),
  bigSlash: () => frames(4, 48, 48, (g, f) => {
    if (f === 0) { crescent(g, 16, 30, 22, -110, -50, 3, 'Y', 'W'); return; }
    crescent(g, 16, 30, 22, -115, 35, f === 1 ? 7 : 5, 'Y', 'W');
    crescent(g, 16, 30, 17, -100, 20, 3, 'w', 'W');
    if (f >= 2) { burst(g, 34, 24, 4 + f * 2, 9 + f * 3, 8, f === 3 ? 'o' : 'y', 1, 22); }
    if (f === 3) g.d = dissolve(g, 0.45).d;
  }),
  cleave: () => frames(4, 72, 32, (g, f) => {
    const reach = [80, 200, 200, 200][f];
    crescent(g, 36, -40, 64, 150 - reach / 4, 150 - reach / 4 - reach, f === 1 ? 6 : 4, f === 3 ? 'i' : 'Y', 'W');
    if (f >= 1) crescent(g, 36, -44, 64, 120, 60, 2, 'w', null);
    if (f === 3) g.d = dissolve(g, 0.5).d;
  }),
  counterX: () => frames(4, 32, 32, (g, f) => {
    line(g, 5, 5, 26, 26, f === 3 ? 'i' : 'Y', f ? 3 : 2);
    if (f >= 1) line(g, 26, 5, 5, 26, f === 3 ? 'i' : 'W', f === 1 ? 3 : 2);
    if (f === 2) burst(g, 16, 16, 7, 12, 8, 'y');
    if (f === 3) g.d = dissolve(g, 0.5).d;
  }),
  impact: () => frames(3, 24, 24, (g, f) => {
    burst(g, 12, 12, f * 2, 5 + f * 3, 8, f === 2 ? 'o' : 'Y', 1, f * 22);
    if (f < 2) oval(g, 12 - (f + 1) * 2, 12 - (f + 1) * 2, (f + 1) * 4, (f + 1) * 4, 'W');
  }),
  bigImpact: () => frames(4, 40, 40, (g, f) => {
    burst(g, 20, 20, 2 + f * 3, 9 + f * 4, 10, f >= 2 ? 'o' : 'Y', 2, f * 18);
    if (f < 3) oval(g, 20 - (f + 2) * 2, 20 - (f + 2) * 2, (f + 2) * 4, (f + 2) * 4, f ? 'Y' : 'W');
    if (f >= 1) ring(g, 20, 20, 8 + f * 4, 'y');
    if (f === 3) g.d = dissolve(g, 0.5).d;
  }),
  breakFx: () => frames(4, 48, 48, (g, f) => {
    const shards = [[0, -1], [0.8, -0.6], [1, 0.2], [0.6, 0.9], [-0.3, 1], [-1, 0.3], [-0.8, -0.7]];
    shards.forEach(([dx, dy], i) => {
      const d = 4 + f * 6, x = 24 + dx * d, y = 24 + dy * d;
      poly(g, [[x, y - 2], [x + 2, y], [x, y + 3], [x - 2, y]], i % 2 ? 'c' : 'W');
    });
    if (f <= 1) { oval(g, 16, 16, 16, 16, 'W'); burst(g, 24, 24, 9, 20, 12, 'Y', 2); }
    if (f >= 1) ring(g, 24, 24, 10 + f * 4, f === 3 ? 'o' : 'y', 2);
    if (f === 3) g.d = dissolve(g, 0.4).d;
  }),
  boltProj: () => frames(2, 14, 14, (g, f) => {
    oval(g, 5, 4, 7, 7, 't'); oval(g, 6, 5, 5, 5, 'c'); px(g, 7, 6, 'W'); px(g, 8, 6, 'W');
    [[3, 7], [1, 6 + f], [0, 8 - f]].forEach(([x, y]) => px(g, x, y, 'c'));
  }),
  boltHit: () => frames(3, 24, 24, (g, f) => {
    ring(g, 12, 12, 3 + f * 3, f === 2 ? 't' : 'c', f === 0 ? 3 : 2);
    if (f < 2) oval(g, 9, 9, 6, 6, 'W');
    burst(g, 12, 12, 5 + f * 2, 7 + f * 3, 6, 'c', 1, 30);
  }),
  fireProj: () => frames(2, 28, 24, (g, f) => {
    poly(g, [[0, 12 + (f ? 2 : -2)], [14, 5], [14, 19]], 'o');
    poly(g, [[4, 12 + (f ? -1 : 1)], [14, 8], [14, 16]], 'y');
    oval(g, 10, 3, 17, 18, 'r'); oval(g, 12, 5, 13, 14, 'o'); oval(g, 14, 7, 9, 10, 'y'); oval(g, 16, 9, 5, 5, 'Y');
    px(g, 18, 10, 'W');
  }),
  fireHit: () => frames(4, 44, 44, (g, f) => {
    const r = [8, 14, 18, 20][f];
    oval(g, 22 - r, 22 - r, r * 2, r * 2, f === 3 ? 'R' : 'r');
    oval(g, 22 - r + 3, 22 - r + 3, r * 2 - 6, r * 2 - 6, f >= 2 ? 'r' : 'o');
    if (f < 3) oval(g, 22 - r + 6, 22 - r + 6, Math.max(2, r * 2 - 12), Math.max(2, r * 2 - 12), f === 0 ? 'W' : 'y');
    if (f >= 2) g.d = dissolve(g, f === 2 ? 0.25 : 0.6).d;
    burst(g, 22, 22, r, r + 4, 10, 'y', 1, f * 17);
  }),
  flames: () => frames(4, 40, 44, (g, f) => {
    [4, 12, 20, 28, 34].forEach((x, i) => {
      const h = 14 + ((i + f) % 3) * 8;
      poly(g, [[x - 5, 43], [x + 1, 43 - h], [x + 6, 43]], 'r');
      poly(g, [[x - 3, 43], [x + 1, 43 - h * 0.7], [x + 4, 43]], 'o');
      poly(g, [[x - 1, 43], [x + 1, 43 - h * 0.4], [x + 2, 43]], 'y');
    });
    if (f === 3) g.d = dissolve(g, 0.5).d;
  }),
  heal: () => frames(4, 32, 44, (g, f) => {
    [[8, 36], [22, 30], [14, 22], [26, 14], [6, 12]].forEach(([x, y], i) => {
      const yy = y - f * 5;
      if (yy < 3 || (i + f) % 4 === 3) return;
      if (i % 2) plus(g, x, yy, i % 3 ? 'l' : 'Y'); else { px(g, x, yy, 'W'); px(g, x - 1, yy, 'l'); px(g, x + 1, yy, 'l'); px(g, x, yy - 1, 'l'); px(g, x, yy + 1, 'l'); }
    });
  }),
  drainHeal: () => EFFECTS.heal().map((g) => recolor(g, { l: 'r', Y: 'M' })),
  healOrb: () => frames(2, 12, 12, (g, f) => { oval(g, 2, 2, 8, 8, 'e'); oval(g, 3, 3, 6, 6, 'l'); px(g, 5, 4, 'W'); if (f) px(g, 0, 6, 'l'); }),
  drainOrb: () => frames(2, 12, 12, (g, f) => { oval(g, 2, 2, 8, 8, 'R'); oval(g, 3, 3, 6, 6, 'r'); px(g, 5, 4, 'M'); if (f) px(g, 11, 6, 'r'); }),
  guardFx: () => frames(3, 24, 24, (g, f) => {
    const rows = ICONS.guard;
    const big = rows.flatMap((row) => [row.replace(/./g, (c) => c + c), row.replace(/./g, (c) => c + c)]);
    stamp(g, big, 3, 3, f === 1 ? { map: { u: 'W', U: 'W', D: 'i', y: 'Y' } } : {});
    if (f === 2) g.d = dissolve(g, 0.5).d;
  }),
  barrier: () => frames(2, 52, 60, (g, f) => {
    for (let y = 0; y < 60; y += 1) for (let x = 0; x < 52; x += 1) {
      const dx = (x + 0.5 - 26) / 25, dy = (y + 0.5 - 32) / 29;
      const d = dx * dx + dy * dy;
      if (d > 1 || y > 58) continue;
      if (d > 0.82) px(g, x, y, 'c');
      else if (ditherMask(x + f, y, 0.3)) px(g, x, y, '=');
    }
    [[12, 18], [38, 16], [26, 8], [10, 40], [42, 38]].forEach(([x, y], i) => { if ((i + f) % 2) { px(g, x, y, 'W'); px(g, x + 1, y, 'c'); px(g, x - 1, y, 'c'); } });
  }),
  summon: () => frames(4, 48, 48, (g, f) => {
    oval(g, 6, 38, 36, 9, 'v'); oval(g, 9, 40, 30, 5, ''); if (f >= 1) oval(g, 12, 40, 24, 5, 'P');
    [[14, 36], [24, 32], [34, 36], [19, 28], [29, 26]].forEach(([x, y], i) => {
      const yy = y - f * 5 - (i % 2) * 3;
      if (yy > 0) { rect(g, x, yy, 2, 4, i % 2 ? 'V' : 'M'); px(g, x, yy - 1, 'W'); }
    });
    if (f === 3) g.d = dissolve(g, 0.45).d;
  }),
  enrage: () => frames(4, 64, 64, (g, f) => {
    ring(g, 32, 32, 8 + f * 7, f >= 2 ? 'o' : 'r', 3);
    burst(g, 32, 32, 12 + f * 5, 20 + f * 6, 12, 'y', 2, f * 15);
    if (f === 3) g.d = dissolve(g, 0.5).d;
  }),
  poof: () => frames(4, 36, 36, (g, f) => {
    [[18, 18, 8], [10, 20, 6], [26, 20, 6], [18, 11, 6], [18, 26, 5]].forEach(([x, y, r], i) => {
      const s = r + f * 2, ox = (x - 18) * f * 0.35, oy = (y - 18) * f * 0.35;
      oval(g, x + ox - s / 2, y + oy - s / 2, s, s, i % 2 ? 'X' : 'w');
    });
    if (f >= 2) g.d = dissolve(g, f === 2 ? 0.3 : 0.7).d;
  }),
  bossBurst: () => frames(4, 80, 80, (g, f) => {
    for (let i = 0; i < 5; i += 1) {
      const a = rad(i * 72 + f * 20), d = f * 9;
      const x = 40 + Math.cos(a) * d, y = 40 + Math.sin(a) * d, r = 10 - f;
      oval(g, x - r, y - r, r * 2, r * 2, f % 2 ? 'Y' : 'W');
    }
    ring(g, 40, 40, 10 + f * 8, 'y', 3);
    burst(g, 40, 40, 16 + f * 5, 26 + f * 6, 16, 'o', 2, f * 11);
    if (f === 3) g.d = dissolve(g, 0.5).d;
  }),
  sparkle: () => frames(3, 16, 16, (g, f) => {
    const s = [2, 5, 3][f];
    line(g, 8, 8 - s, 8, 8 + s, 'Y'); line(g, 8 - s, 8, 8 + s, 8, 'Y'); px(g, 8, 8, 'W');
    if (f === 1) { px(g, 6, 6, 'y'); px(g, 10, 10, 'y'); px(g, 10, 6, 'y'); px(g, 6, 10, 'y'); }
  }),
  status: () => frames(3, 32, 32, (g, f) => {
    burst(g, 16, 16, 4 + f * 3, 10 + f * 4, 8, f === 2 ? 'o' : 'y', 2, 22);
    if (f < 2) { oval(g, 11 - f, 11 - f, 10 + f * 2, 10 + f * 2, 'Y'); oval(g, 13, 13, 6, 6, 'W'); }
  }),
  eyeFx: () => frames(3, 24, 16, (g, f) => {
    const open = [1, 4, 3][f];
    oval(g, 2, 8 - open, 20, open * 2, 'w'); if (open > 1) { oval(g, 9, 8 - Math.min(open, 3), 6, Math.min(open, 3) * 2, 'u'); px(g, 11, 7, 'W'); }
    outline(g, 'k');
  }),
  darkSlash: () => frames(4, 32, 32, (g, f) => {
    crescent(g, 12, 20, 14, -110, f === 0 ? -40 : 20, f === 1 ? 5 : 3, f === 3 ? 'P' : 'V', 'M');
    if (f === 2) burst(g, 22, 16, 3, 7, 6, 'M');
    if (f === 3) g.d = dissolve(g, 0.5).d;
  }),
  chargeFx: () => frames(3, 40, 40, (g, f) => {
    [[6, 34], [14, 30], [26, 32], [34, 36], [20, 38]].forEach(([x, y], i) => {
      const yy = y - f * 8 - (i % 2) * 4;
      if (yy > 1) { px(g, x, yy, i % 2 ? 'y' : 'o'); px(g, x, yy + 1, 'o'); }
    });
  }),
  flash: () => frames(1, 4, 4, (g) => rect(g, 0, 0, 4, 4, 'W')),
};

const effectCache = new Map();
export function effectSheet(name) {
  if (!EFFECTS[name]) return null;
  if (!effectCache.has(name)) {
    const list = EFFECTS[name]();
    const s = sheet(`fx-${name}`, list[0].w, list[0].h, [list], PAL);
    effectCache.set(name, { ...s, frames: list.length });
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

/* ------------------------------------------------------------ DOM player */

const SKILL_HIT = {
  slash: 'slash', powerSlash: 'bigSlash', cleave: 'slash', magicBolt: 'boltHit', fireball: 'fireHit',
  strike: 'slash', doubleStrike: 'quickA', shadowStrike: 'darkSlash',
};
const DURATION = { default: 360, sparkle: 300, barrier: 600, flames: 400, bossBurst: 520, heal: 420 };

/**
 * Effects for one battle view. play(event, state) is called for every event
 * the view replays; clear() removes leftover nodes. Never throws on a missing
 * target, because the view may re-render mid-effect.
 */
export function createEffectsPlayer(root, { reducedMotion = false } = {}) {
  let lastSkill = null, lastEnemyAction = null, lastEnemyId = null, lastTarget = null, hitCount = 0;
  const timers = new Set();
  const field = () => root.querySelector('.battle-field');
  const nodeFor = (target) => root.querySelector(target === 'hero' ? '[data-combatant="hero"] .battle-sprite' : `[data-enemy-uid="${target}"] .battle-sprite`);

  function centre(target, lift = 0.5) {
    const host = field(), node = nodeFor(target);
    if (!host || !node) return null;
    const a = host.getBoundingClientRect(), b = node.getBoundingClientRect();
    return { x: b.left - a.left + b.width / 2, y: b.top - a.top + b.height * lift, h: b.height };
  }

  function later(ms, fn) {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  }

  function spawn(name, at, { dur = DURATION[name] || DURATION.default, flip = false, loop = false, className = '' } = {}) {
    const host = field();
    const s = effectSheet(name);
    if (!host || !at || !s) return null;
    const node = document.createElement('span');
    node.className = `px-fx ${sheetClass('pxe', name, s)}${loop ? ' px-fx--loop' : ''}${flip ? ' px-fx--flip' : ''} ${className}`;
    node.style.cssText = `left:${Math.round(at.x)}px;top:${Math.round(at.y)}px;--n:${s.frames};--dur:${dur}ms`;
    node.setAttribute('aria-hidden', 'true');
    if (!loop) later(dur + 40, () => node.remove());
    host.append(node);
    return node;
  }

  function projectile(name, from, to, dur, then) {
    if (!from || !to) { then?.(); return; }
    if (reducedMotion) { then?.(); return; }
    const node = spawn(name, from, { loop: true, className: 'px-proj', flip: to.x < from.x });
    if (node) node.style.cssText += `;--dx:${Math.round(to.x - from.x)}px;--dy:${Math.round(to.y - from.y)}px;--travel:${dur}ms`;
    later(dur, () => { node?.remove(); then?.(); });
  }

  function streak(from, to, dark = true) {
    const host = field();
    if (!host || !from || !to || reducedMotion) return;
    const node = document.createElement('span');
    const dx = to.x - from.x, dy = to.y - from.y;
    node.className = `px-streak${dark ? ' px-streak--dark' : ''}`;
    node.style.cssText = `left:${Math.round(from.x)}px;top:${Math.round(from.y)}px;width:${Math.round(Math.hypot(dx, dy))}px;transform:rotate(${Math.atan2(dy, dx)}rad)`;
    node.setAttribute('aria-hidden', 'true');
    host.append(node);
    later(320, () => node.remove());
  }

  function screen(kind) {
    if (reducedMotion) return;
    const host = field();
    if (!host) return;
    host.classList.remove('px-shake', 'px-shake--big', 'px-flash', 'px-flash--red');
    void host.offsetWidth;
    host.classList.add(kind);
    later(420, () => host.classList.remove(kind));
  }

  function enemyTargets(state) {
    return state.enemies.filter((enemy) => enemy.hp > 0 || enemy.uid === lastTarget).map((enemy) => enemy.uid);
  }

  function play(event, state) {
    if (reducedMotion) return;
    switch (event.type) {
      case 'attack': {
        if (!event.source) {
          lastSkill = event.skillId; hitCount = 0;
          const hero = centre('hero', 0.45);
          if (event.skillId === 'magicBolt') projectile('boltProj', hero, centre(event.target, 0.45), 260);
          if (event.skillId === 'fireball') {
            const ids = enemyTargets(state);
            projectile('fireProj', hero, centre(ids[Math.floor(ids.length / 2)] ?? event.target, 0.45), 300);
          }
          if (event.skillId === 'shadowStrike') streak(hero, centre(event.target, 0.5));
          if (event.skillId === 'cleave') {
            const ids = enemyTargets(state);
            const first = centre(ids[0], 0.55), last = centre(ids.at(-1), 0.55);
            if (first && last) later(200, () => streak({ x: first.x - 40, y: first.y }, { x: last.x + 40, y: last.y }, false));
          }
        } else {
          lastEnemyAction = event.action;
          lastEnemyId = state.enemies.find((enemy) => enemy.uid === event.source)?.id ?? null;
          if (event.action === 'drain') projectile('drainOrb', centre('hero', 0.45), centre(event.source, 0.45), 300);
          if (event.action === 'heavy' && lastEnemyId === 'dragon') spawn('flames', centre('hero', 0.55), { dur: 400 });
        }
        break;
      }
      case 'damage': {
        const at = centre(event.target, event.target === 'hero' ? 0.45 : 0.5);
        if (event.amount === 0) { spawn('poof', at, { dur: 300 }); break; }
        if (event.target === 'hero') {
          spawn(lastEnemyAction === 'heavy' ? 'bigImpact' : 'impact', at);
          screen(lastEnemyAction === 'heavy' ? 'px-shake--big' : 'px-shake');
          break;
        }
        lastTarget = event.target;
        let name = SKILL_HIT[lastSkill] || 'slash';
        if (lastSkill === 'doubleStrike') name = hitCount % 2 ? 'quickB' : 'quickA';
        hitCount += 1;
        spawn(name, at);
        if (lastSkill === 'cleave') spawn('slash', at, { flip: true, dur: 300 });
        if (lastSkill === 'powerSlash') screen('px-shake');
        break;
      }
      case 'heal': {
        const at = centre(event.target, 0.5);
        if (event.target === 'hero') { spawn('heal', at); break; }
        if (event.source && event.source !== event.target) {
          projectile('healOrb', centre(event.source, 0.3), at, 240, () => spawn('heal', centre(event.target, 0.5)));
        } else spawn(lastEnemyAction === 'drain' ? 'drainHeal' : 'heal', at);
        break;
      }
      case 'defend':
        if (event.defense === 'guard') spawn('guardFx', centre('hero', 0.45));
        if (event.defense === 'barrier') spawn('barrier', centre('hero', 0.55), { dur: 600 });
        break;
      case 'barrierUp': spawn('barrier', centre('hero', 0.55), { dur: 600 }); break;
      case 'guard': spawn('guardFx', centre(event.target, 0.45)); break;
      case 'charge': spawn('chargeFx', centre(event.target, 0.5), { dur: 400 }); break;
      case 'summon': {
        if (event.target != null) {
          spawn('summon', centre(event.target, 0.7), { dur: 420 });
          nodeFor(event.target)?.classList.add('px-summoned');
        }
        break;
      }
      case 'comboReady':
      case 'counterReady': spawn('status', centre('hero', 0.08)); break;
      case 'combo':
      case 'counter': spawn('counterX', centre(event.target, 0.5)); break;
      case 'opening':
      case 'opening-hit': spawn('eyeFx', centre(event.target, 0.2), { dur: 300 }); break;
      case 'break': spawn('breakFx', centre(event.target, 0.5)); screen('px-shake--big'); break;
      case 'power': spawn('sparkle', centre('hero', 0.25), { dur: 300 }); break;
      case 'chain': {
        const from = centre(lastTarget, 0.5), to = centre(event.target, 0.5);
        streak(from, to);
        lastTarget = event.target;
        break;
      }
      case 'enrage': spawn('enrage', centre(event.target, 0.5)); screen('px-flash--red'); break;
      case 'defeat': {
        const boss = state.enemies.find((enemy) => enemy.uid === event.target);
        const isBoss = ['dragon', 'demonKing', 'giantGolem', 'vampireLord'].includes(boss?.id);
        spawn(isBoss ? 'bossBurst' : 'poof', centre(event.target, 0.55), { dur: isBoss ? 520 : 360 });
        if (isBoss) screen('px-flash');
        break;
      }
      case 'victory': spawn('sparkle', centre('hero', 0.2), { dur: 300 }); break;
      default: break;
    }
  }

  function clear() {
    root.querySelectorAll('.px-fx, .px-streak').forEach((node) => node.remove());
  }

  function destroy() {
    timers.forEach((id) => clearTimeout(id));
    timers.clear();
    clear();
  }

  return { play, clear, destroy };
}
