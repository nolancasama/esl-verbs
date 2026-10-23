// Japanese neighbourhood scenes for the Adventure quiz and battles. A scene is
// a description (src/scenes.js): an archetype (station front, shopping street,
// rice paddies, ...), the city's far skyline and landmarks, a time of day and a
// damage level 0-3. This module draws it on a 384x128 grid of palette keys,
// side-on like the old backdrops, and returns anchors (the sidewalk lane,
// shutters, fires, the station sign) where src/battle-art.js places the small
// animated actors and the station-name sign over the image.
//
// Layout contract: the building line is row HZ (96); everything a scene needs
// to say sits between columns ~30 and ~354, because 1024x600 crops the edges.
// Training scenes keep the middle (OPEN) quiet: the quiz word is drawn there.

import { grid, image, sheet, px, rect, oval, line, poly, ditherMask, get } from './pixel-core.js';

export const SCENE_W = 384, SCENE_H = 128, SCENE_HZ = 96;
const W = SCENE_W, H = SCENE_H, HZ = SCENE_HZ;
// Behind the quiz word plate; the hero stands near x 60-105 and the dummy near 295-325.
const OPEN = [144, 250];

/* ---------------------------------------------------------------- palette */

// One street palette, muted on purpose so the heroes, enemies and UI gold stay
// the brightest things on screen; time of day tints it (lights stay lit).
const BASE = {
  cl: '#ffffff', cls: '#dde8f0', k: '#2b2833',
  wA: '#e6dcc8', wAs: '#cdc1a8', wB: '#d6d3cc', wBs: '#b9b5ad', wC: '#c8b498', wCs: '#ad997e',
  wD: '#a9b4bc', wDs: '#8e9aa3', wE: '#8e6e55', wEs: '#735641', wF: '#dcc3b2', wFs: '#c2a998',
  rA: '#4e576a', rAs: '#3c4354', rAh: '#68728a', rB: '#7a4e42', rBs: '#5e3b31', rC: '#5e8a7c', rCs: '#476b60',
  gl: '#8daec4', glh: '#c0d8e4', gld: '#5d7c93', lit: '#ffd98a', litw: '#fff1c4',
  sh: '#a8acb1', shl: '#c4c7cb', shd: '#888c92', wd: '#7a5338', wdd: '#5a3c28',
  bw: '#c0b8a8', bwd: '#a39b8b', po: '#8e8a82', pod: '#6e6a63', wi: '#36343c',
  as: '#6c6f75', asd: '#606369', asl: '#7b7e84', ln: '#dcdad0', sw: '#c3b9a7', swd: '#ada392', cb: '#99938a', gp: '#6f9a72',
  tl: '#d3c8b4', tld: '#bdb19c', tlr: '#c9ad98', dt: '#c2a57a', dtd: '#ab8f66', dtl: '#d0b68e',
  gr: '#82ad5c', grd: '#6c964a', grl: '#98c06c', gv: '#cdc6b6', gvd: '#b3ab9a', st: '#a9a499', std: '#8c877d',
  tA: '#5a9160', tAd: '#43784b', tAl: '#75aa70', tB: '#3e6a4a', tBd: '#2f5439', tBl: '#557f5a', pk: '#efbcc9', pkd: '#d99aad', trk: '#6e5240',
  wa: '#6d9cb6', wad: '#57849d', wal: '#a6cde0', ri: '#9ccb62', rid: '#7cae4a', pw: '#98bfcf', pwd: '#7ea6b7',
  red: '#cf5642', redd: '#a5402f', org: '#e48a3c', yel: '#eec552', grn: '#4f9a5c', blu: '#3f6fb3', pur: '#7a5aa4', wht: '#efeee8', blk: '#35333b', gold: '#d6b14a', cu: '#6fa594', cud: '#54857a',
  fmG: '#2a9e5c', fmB: '#2e6fbd', lwB: '#2f6dba', lwL: '#8fb6e2',
  trK: '#b0383f', trKw: '#ebe6dc', trN: '#c6c9ce', trO: '#e5852f', trNb: '#305fa6', trM: '#8a5cc0', trW: '#3f4d5d',
  sk: '#f0c8a0', skd: '#d8a880', hr: '#2e2622', hrB: '#6b4a32', hrG: '#b8b3ad',
  c1: '#d4604e', c2: '#4f7ec2', c3: '#e2bd52', c4: '#5aa274', c5: '#ecebe6', c6: '#9a70bd', pa: '#3e4962', bag: '#8a5a3a', pol: '#2e3e68',
  sm0: '#4d4853', sm1: '#6c6672', sm2: '#8f8994', sm3: '#b2adb6', smA: '#5a5560d9', smB: '#7d7884b3', smC: '#a29daa80',
  fi: '#ff8a3a', fiy: '#ffd25a', fir: '#e2482a', sc: '#3c3437', ck: '#46403f', db: '#958e83', dbd: '#716b62', gs: '#d4eaf3',
  cone: '#ee7a2c', tape: '#efc64a', neR: '#ff6b6b', neY: '#ffe066', neB: '#6bd0ff', neP: '#ff8ad8', sig: '#ff5a4a', sigo: '#5a2a2a',
};
// Lights and fire glow the same in every time of day.
const EMISSIVE = new Set(['lit', 'litw', 'fi', 'fiy', 'fir', 'neR', 'neY', 'neB', 'neP', 'sig', 'smA', 'smB', 'smC']);

const TIMES = {
  day: { sky: ['#7dbfe9', '#9dd0ef', '#c1e3f4', '#dff0f5'], tint: null, far: ['#a9c3cf', '#93adbb', '#7e98a8'], farLit: '#c9d6dc' },
  evening: { sky: ['#7d9cd2', '#e8b08a', '#f4cd9c', '#f9e2bb'], tint: ['#ffae74', 0.14, 0], far: ['#b9a6ab', '#9e8f9a', '#86798a'], farLit: '#ffd98a' },
  smoke: { sky: ['#8e909c', '#aaa5aa', '#c6b4a2', '#d6bc9b'], tint: ['#9a8a84', 0.2, 0.04], far: ['#a69c9c', '#8f8789', '#7a7377'], farLit: '#ffd98a' },
  dusk: { sky: ['#463a6a', '#7d4c6e', '#c76d5a', '#eb9d60'], tint: ['#7a4878', 0.3, 0.12], far: ['#8f5f74', '#704c66', '#563c56'], farLit: '#ffcf7a' },
  night: { sky: ['#151b34', '#1f2848', '#2c3459', '#473f66'], tint: ['#23305c', 0.5, 0.32], far: ['#2f3558', '#262b4a', '#1d213c'], farLit: '#ffd98a' },
};
export const SCENE_TIMES = Object.freeze(Object.keys(TIMES));

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb) => `#${rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
function mix(a, b, t) { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); }

const paletteCache = new Map();
function scenePalette(time) {
  if (paletteCache.has(time)) return paletteCache.get(time);
  const T = TIMES[time] ?? TIMES.day;
  const pal = {};
  for (const [key, value] of Object.entries(BASE)) {
    if (EMISSIVE.has(key) || !T.tint) { pal[key] = value; continue; }
    const alpha = value.length > 7 ? value.slice(7) : '';
    const [tc, amount, dark] = T.tint;
    pal[key] = mix(mix(value.slice(0, 7), tc, amount), '#000000', dark) + alpha;
  }
  T.sky.forEach((c, i) => { pal[`s${i}`] = c; });
  T.far.forEach((c, i) => { pal[`F${i}`] = c; });
  pal.Fw = T.farLit;
  pal.glow = time === 'night' || time === 'dusk' ? '#ff9a5a' : '#ffb27a';
  paletteCache.set(time, pal);
  return pal;
}

/* ------------------------------------------------------------- utilities */

function seeded(text) {
  let h = 2166136261;
  for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hline = (g, x0, x1, y, c) => { for (let x = x0; x <= x1; x += 1) px(g, x, y, c); };
const vline = (g, x, y0, y1, c) => { for (let y = y0; y <= y1; y += 1) px(g, x, y, c); };
function dither(g, x, y, w, h, c, level) { for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) if (ditherMask(x + i, y + j, level)) px(g, x + i, y + j, c); }
const isBack = (k) => !k || /^(s\d|F|cl)/.test(k);
/** Paint only over sky / far layers (smoke behind buildings, not on them). */
function behind(g, x, y, c) { if (isBack(get(g, x, y))) px(g, x, y, c); }

// 3x5 capitals for the store fascia lettering.
const FONT = {
  A: ['010', '101', '111', '101', '101'], F: ['111', '100', '110', '100', '100'], M: ['101', '111', '111', '101', '101'],
  I: ['111', '010', '010', '010', '111'], L: ['100', '100', '100', '100', '111'], Y: ['101', '101', '010', '010', '010'],
  R: ['110', '101', '110', '101', '101'], T: ['111', '010', '010', '010', '010'], W: ['101', '101', '111', '111', '101'],
  S: ['011', '100', '010', '001', '110'], O: ['010', '101', '101', '101', '010'], N: ['110', '101', '101', '101', '101'],
  E: ['111', '100', '110', '100', '111'], P: ['110', '101', '110', '100', '100'], H: ['101', '101', '111', '101', '101'],
};
function text(g, x, y, str, c) {
  let cx = x;
  for (const ch of str) { const glyph = FONT[ch]; if (glyph) glyph.forEach((row, j) => [...row].forEach((b, i) => { if (b === '1') px(g, cx + i, y + j, c); })); cx += 4; }
}
export const textWidth = (str) => str.length * 4 - 1;

/* ------------------------------------------------------------------ sky */

function drawSky(ctx) {
  const { g, time } = ctx;
  const bands = [0, 30, 58, 80];
  for (let y = 0; y < HZ; y += 1) for (let x = 0; x < W; x += 1) {
    let b = bands.filter((v) => y >= v).length - 1;
    const next = bands[b + 1];
    if (next && y >= next - 4 && ditherMask(x, y, (y - (next - 5)) / 5)) b += 1;
    px(g, x, y, `s${b}`);
  }
  if (time === 'night') {
    for (let i = 0; i < 40; i += 1) px(g, Math.floor(ctx.rnd() * W), Math.floor(ctx.rnd() * 44), i % 5 ? 's2' : 'cl');
    oval(g, 300, 10, 9, 9, 'litw'); oval(g, 303, 9, 7, 7, 's0');
  } else if (time === 'day' || time === 'evening') {
    const clouds = [[20, 14], [110, 8], [200, 18], [300, 10]];
    clouds.forEach(([x, y]) => { if (ctx.rnd() < 0.75) { oval(g, x, y, 26, 7, 'cl'); oval(g, x + 6, y - 4, 13, 8, 'cl'); oval(g, x + 15, y - 2, 12, 7, 'cl'); hline(g, x + 3, x + 22, y + 6, 'cls'); } });
    if (time === 'evening') oval(g, 330, 54, 14, 14, 'litw');
  } else if (time === 'smoke') {
    oval(g, 320, 26, 12, 12, 's3');
  } else if (time === 'dusk') {
    oval(g, 60, 60, 16, 16, 'fiy'); dither(g, 52, 56, 32, 24, 's3', 0.25);
  }
}

/* ------------------------------------------------------------- far layer */

// Far elements draw in the three haze tones F0 (farthest) .. F2 (nearest).
const FAR = {
  hills(ctx, { base = 84, amp = 9, period = 140, phase = 0, key = 'F0' } = {}) {
    for (let x = 0; x < W; x += 1) {
      const top = Math.round(base - amp * (0.55 + 0.45 * Math.sin(((x + phase) / period) * Math.PI * 2)) - 3 * Math.sin((x + phase) / 23));
      for (let y = top; y < HZ; y += 1) px(ctx.g, x, y, key);
    }
  },
  // The Ikoma range east of Osaka, with the TV masts on its ridge.
  ikoma(ctx, { base = 78, amp = 20, x0 = 180, masts = true } = {}) {
    const { g } = ctx;
    for (let x = 0; x < W; x += 1) {
      const d = (x - x0) / 150;
      const top = Math.round(base - amp * Math.exp(-d * d * 2) - 4 * Math.sin(x / 17) * Math.exp(-d * d));
      for (let y = top; y < HZ; y += 1) px(g, x, y, y < top + 2 && ditherMask(x, y, 0.5) ? 'F1' : 'F0');
    }
    if (masts) [x0 - 14, x0 - 4, x0 + 9].forEach((mx, i) => { const top = base - amp - 1 + (i === 1 ? 0 : 2); vline(g, mx, top - 9 + i, top + 2, 'F2'); px(g, mx, top - 9 + i, 'sig'); });
  },
  skyline(ctx, { y = 86, max = 18, key = 'F1', lit = true, from = 0, to = W } = {}) {
    const { g, rnd } = ctx;
    for (let x = from; x < to;) {
      const w = 6 + Math.floor(rnd() * 10), h = 4 + Math.floor(rnd() * max);
      rect(g, x, y - h, w, HZ - (y - h), key);
      if (lit) for (let wy = y - h + 2; wy < y - 1; wy += 3) for (let wx = x + 1; wx < x + w - 1; wx += 2) if (rnd() < 0.18) px(g, wx, wy, 'Fw');
      x += w + (rnd() < 0.3 ? 3 : 0);
    }
  },
  // Abeno Harukas: Japan's tallest skyscraper, three stepped blocks.
  harukas(ctx, { x = 300, h = 60, key = 'F2' } = {}) {
    const { g } = ctx; const b = HZ - 4;
    rect(g, x, b - h, 16, h, key); rect(g, x + 2, b - h - 6, 12, 6, key); rect(g, x + 5, b - h - 12, 8, 6, key);
    rect(g, x + 16, b - Math.round(h * 0.55), 4, Math.round(h * 0.55), key);
    for (let wy = b - h + 2; wy < b; wy += 3) for (let wx = x + 2; wx < x + 15; wx += 3) if ((wx + wy) % 4) px(g, wx, wy, 'Fw');
    px(g, x + 9, b - h - 13, 'sig');
  },
  // Tsutenkaku: a lattice tower on four legs with a round top.
  tsutenkaku(ctx, { x = 60, key = 'F2' } = {}) {
    const { g } = ctx; const b = HZ - 2;
    poly(g, [[x - 7, b], [x - 2, b - 16], [x + 2, b - 16], [x + 7, b]], key); rect(g, x - 3, b - 9, 6, 9, 's3');
    rect(g, x - 2, b - 38, 5, 22, key); rect(g, x - 5, b - 42, 11, 6, key); rect(g, x - 3, b - 47, 7, 5, key); vline(g, x, b - 53, b - 47, key);
    rect(g, x - 4, b - 40, 9, 2, 'Fw');
  },
  // Umeda Sky Building: twin towers joined by a floating garden at the top.
  umedaSky(ctx, { x = 280, key = 'F2' } = {}) {
    const { g } = ctx; const b = HZ - 2;
    rect(g, x, b - 50, 9, 50, key); rect(g, x + 15, b - 50, 9, 50, key); rect(g, x - 1, b - 55, 26, 5, key); oval(g, x + 6, b - 58, 12, 7, key); rect(g, x + 9, b - 30, 6, 3, key);
    for (let wy = b - 46; wy < b; wy += 3) { px(g, x + 3, wy, 'Fw'); px(g, x + 19, wy, 'Fw'); }
  },
  // HEP Five's red Ferris wheel on a department store roof.
  ferris(ctx, { x = 90, key = 'F2' } = {}) {
    const { g } = ctx; const b = HZ - 2; const cx = x + 12, cy = b - 36;
    rect(g, x, b - 22, 24, 22, key);
    for (let a = 0; a < 360; a += 8) px(g, Math.round(cx + Math.cos(a * Math.PI / 180) * 11), Math.round(cy + Math.sin(a * Math.PI / 180) * 11), 'redd');
    for (let a = 0; a < 360; a += 45) { line(g, cx, cy, Math.round(cx + Math.cos(a * Math.PI / 180) * 10), Math.round(cy + Math.sin(a * Math.PI / 180) * 10), 'redd'); px(g, Math.round(cx + Math.cos(a * Math.PI / 180) * 11), Math.round(cy + Math.sin(a * Math.PI / 180) * 11) + 1, 'Fw'); }
    line(g, cx - 6, b - 22, cx, cy, key); line(g, cx + 6, b - 22, cx, cy, key);
  },
  // Sakai's keyhole-shaped burial mounds: low wooded hills with a flat top.
  kofun(ctx, { x = 40, w = 90, key = 'F2' } = {}) {
    const { g } = ctx; const b = HZ - 4;
    oval(g, x, b - 14, Math.round(w * 0.45), 18, key); poly(g, [[x + w * 0.35, b - 4], [x + w * 0.4, b - 10], [x + w, b - 12], [x + w, b - 4]], key); oval(g, x + w - 10, b - 15, 20, 14, key);
    for (let i = 0; i < w; i += 3) px(g, x + i + 2, b - 8 - ((i * 7) % 4), 'F1');
    hline(g, x - 4, x + w + 10, b - 3, 'wal');
  },
  tower(ctx, { x = 300, h = 46, w = 14, key = 'F2', deck = true } = {}) {
    const { g } = ctx; const b = HZ - 2;
    rect(g, x, b - h, w, h, key); if (deck) rect(g, x - 1, b - h - 3, w + 2, 3, key);
    for (let wy = b - h + 2; wy < b; wy += 3) for (let wx = x + 2; wx < x + w - 1; wx += 3) px(g, wx, wy, 'Fw');
  },
  plane(ctx, { x = 250, y = 30 } = {}) {
    const { g } = ctx;
    rect(g, x, y, 12, 2, 'wht'); poly(g, [[x + 4, y], [x + 7, y], [x + 3, y - 5]], 'wht'); rect(g, x + 4, y + 2, 5, 1, 'shd'); poly(g, [[x + 10, y], [x + 12, y], [x + 12, y - 3]], 'blu'); px(g, x + 1, y, 'blu');
  },
  stadium(ctx, { x = 250, key = 'F2' } = {}) {
    const { g } = ctx; const b = HZ - 2;
    poly(g, [[x, b], [x + 6, b - 12], [x + 60, b - 12], [x + 66, b]], key); hline(g, x + 6, x + 60, b - 12, 'F1');
    [x + 4, x + 62].forEach((lx) => { vline(g, lx, b - 30, b - 12, key); rect(g, lx - 3, b - 33, 7, 3, 'Fw'); });
  },
  castle(ctx, { x = 280, key = 'F2' } = {}) {
    const { g } = ctx; const b = HZ - 4;
    poly(g, [[x - 4, b], [x, b - 8], [x + 30, b - 8], [x + 34, b]], key);
    [[0, 30, 6], [3, 24, 6], [6, 18, 5], [8, 14, 5], [10, 10, 5]].forEach(([dx, w, h], i) => { const y = b - 8 - (i + 1) * 6; rect(g, x + dx, y + 2, w, h - 2, 'F0'); rect(g, x + dx - 2, y, w + 4, 2, key); });
    px(g, x + 12, b - 39, 'gold'); px(g, x + 17, b - 39, 'gold');
  },
  cranes(ctx, { x = 40, key = 'F1' } = {}) {
    const { g } = ctx; const b = HZ - 2;
    [x, x + 34].forEach((cx) => { vline(g, cx, b - 30, b, key); vline(g, cx + 6, b - 30, b, key); hline(g, cx - 12, cx + 22, b - 30, key); line(g, cx + 3, b - 38, cx - 12, b - 30, key); line(g, cx + 3, b - 38, cx + 22, b - 30, key); vline(g, cx - 8, b - 30, b - 20, key); });
  },
  pines(ctx, { from = 0, to = W, y = 90, key = 'F2' } = {}) {
    const { g, rnd } = ctx;
    for (let x = from; x < to; x += 9 + Math.floor(rnd() * 6)) { vline(g, x + 3, y - 12, y + 6, key); oval(g, x - 3, y - 18, 10, 5, key); oval(g, x + 2, y - 13, 9, 4, key); oval(g, x - 4, y - 9, 8, 4, key); }
  },
  pylons(ctx, { xs = [70, 250], key = 'F2' } = {}) {
    const { g } = ctx; const b = HZ - 1;
    xs.forEach((x) => { line(g, x - 4, b, x, b - 34, key); line(g, x + 4, b, x, b - 34, key); [b - 30, b - 22].forEach((y) => hline(g, x - 6, x + 6, y, key)); line(g, x - 3, b - 10, x + 3, b - 20, key); line(g, x + 3, b - 10, x - 3, b - 20, key); });
    for (let i = 0; i + 1 < xs.length; i += 1) [-6, 6].forEach((dx) => { const x0 = xs[i] + dx, x1 = xs[i + 1] + dx; for (let x = x0; x <= x1; x += 1) { const t = (x - x0) / (x1 - x0); px(g, x, b - 30 + Math.round(4 * Math.sin(t * Math.PI)), 'wi'); } });
  },
};

/* --------------------------------------------------------- street lots */

// Each lot draws one building standing on row HZ and records its wall, windows
// and signs so damage can find them. `ctx.ruinNext` turns the next big lot into
// a damaged shell (damage level 3).
function wallRect(ctx, x, y, w, h) { ctx.anchors.walls.push({ x, y, w, h }); }
function windowRect(ctx, x, y, w, h, c = 'gl') {
  const { g } = ctx; rect(g, x, y, w, h, c); hline(g, x, x + w - 1, y, 'glh'); if (w > 3) vline(g, x + Math.floor(w / 2), y, y + h - 1, 'wBs');
  ctx.anchors.windows.push({ x, y, w, h });
}
function litWindow(ctx, x, y, w, h) { if (ctx.time === 'night' || ctx.time === 'dusk' ? ctx.rnd() < 0.6 : false) { rect(ctx.g, x, y, w, h, 'lit'); ctx.anchors.windows.push({ x, y, w, h }); } else windowRect(ctx, x, y, w, h); }

function kawara(ctx, x, y, w, h, c = 'rA') {
  const { g } = ctx; const s = c === 'rA' ? 'rAs' : c === 'rB' ? 'rBs' : 'rCs';
  poly(g, [[x - 2, y + h], [x + 3, y], [x + w - 3, y], [x + w + 2, y + h]], c);
  for (let i = x; i < x + w; i += 2) for (let j = y + 1; j < y + h; j += 1) if (ditherMask(i, j, 0.5)) px(g, i, j, s);
  hline(g, x + 2, x + w - 3, y, c === 'rA' ? 'rAh' : s); hline(g, x - 2, x + w + 1, y + h, s);
}

const LOTS = {
  house(ctx, x, w, { h = 24, wall = 'wA', roof = 'rA', balcony = true } = {}) {
    const { g, rnd } = ctx; const top = HZ - h; const ws = `${wall}s`;
    rect(g, x, top, w, h, wall); vline(g, x + w - 1, top, HZ - 1, ws); wallRect(ctx, x, top, w, h);
    kawara(ctx, x, top - 6, w, 6, roof);
    hline(g, x - 1, x + w, top + 11, `${roof}s` in BASE ? `${roof}s` : 'rAs'); hline(g, x - 1, x + w, top + 12, roof);
    litWindow(ctx, x + 3, top + 3, 5, 5); if (w > 18) litWindow(ctx, x + w - 9, top + 3, 5, 5);
    if (balcony && w > 18 && rnd() < 0.6) {
      rect(g, x + w - 12, top + 7, 10, 4, 'wBs'); for (let i = x + w - 12; i < x + w - 2; i += 2) px(g, i, top + 8, 'wB');
      if (rnd() < 0.5) rect(g, x + w - 11, top + 5, 4, 5, ['c5', 'c3', 'c2'][Math.floor(rnd() * 3)]); // a futon airing
    }
    rect(g, x + 3, HZ - 9, 5, 9, 'wd'); px(g, x + 6, HZ - 5, 'gold');
    litWindow(ctx, x + w - 10, HZ - 8, 7, 4);
  },
  apartment(ctx, x, w, { floors = 4, wall = 'wB' } = {}) {
    const { g, rnd } = ctx; const fh = 8, top = HZ - floors * fh - 2; const ws = `${wall}s`;
    rect(g, x, top, w, HZ - top, wall); vline(g, x + w - 1, top, HZ - 1, ws); hline(g, x, x + w - 1, top, ws); wallRect(ctx, x, top, w, HZ - top);
    if (rnd() < 0.5) { rect(g, x + 3, top - 4, 7, 4, 'shl'); hline(g, x + 3, x + 9, top - 4, 'sh'); }
    for (let f = 0; f < floors; f += 1) {
      const y = top + 2 + f * fh;
      for (let u = x + 2; u + 8 <= x + w - 1; u += 9) {
        litWindow(ctx, u + 1, y + 1, 6, 4);
        rect(g, u, y + 5, 8, 3, ws); for (let i = u; i < u + 8; i += 2) px(g, i, y + 6, wall);
        if (rnd() < 0.15) rect(g, u + 1, y + 3, 3, 3, ['c1', 'c5', 'c2', 'c3'][Math.floor(rnd() * 4)]);
      }
    }
    rect(g, x + Math.floor(w / 2) - 3, HZ - 7, 6, 7, 'gld');
  },
  // Two storeys: a shop on the ground floor, the family living upstairs.
  shop(ctx, x, w, { kind = 'ramen', wall = 'wC', shutter = 0 } = {}) {
    const { g, rnd } = ctx; const top = HZ - 22; const ws = `${wall}s`;
    rect(g, x, top, w, 22, wall); vline(g, x + w - 1, top, HZ - 1, ws); wallRect(ctx, x, top, w, 22);
    rect(g, x - 1, top - 2, w + 2, 2, 'rAs');
    litWindow(ctx, x + 3, top + 2, 5, 4); if (w > 16) litWindow(ctx, x + w - 8, top + 2, 5, 4);
    const signs = { ramen: ['red', 'yel'], bakery: ['org', 'wht'], drug: ['yel', 'blu'], veg: ['grn', 'wht'], cafe: ['wdd', 'wht'], book: ['blu', 'wht'], barber: ['wht', 'red'], takoyaki: ['red', 'wht'] };
    const [bg, fg] = signs[kind] ?? signs.ramen;
    rect(g, x + 1, top + 8, w - 2, 4, bg); for (let i = x + 3; i < x + w - 3; i += 3) px(g, i, top + 9 + (i % 2), fg);
    ctx.anchors.signs.push({ x: x + 1, y: top + 8, w: w - 2, h: 4 });
    const fy = top + 12, fhgt = HZ - fy;
    rect(g, x + 1, fy, w - 2, fhgt, ctx.time === 'night' ? 'lit' : 'gld'); hline(g, x + 1, x + w - 2, fy, 'k');
    for (let i = x + 3; i < x + w - 3; i += 4) rect(g, i, fy + 3, 2, 2, ['c1', 'c3', 'c4', 'c5'][Math.floor(rnd() * 4)]);
    if (kind === 'ramen' || kind === 'takoyaki') { for (let i = x + 2; i < x + w - 2; i += 3) rect(g, i, fy + 1, 2, 4, kind === 'ramen' ? 'redd' : 'blu'); oval(g, x + w - 4, fy - 1, 3, 4, 'red'); }
    if (kind === 'bakery' || kind === 'veg') for (let i = x; i < x + w; i += 1) px(g, i, fy + ((i - x) % 4 < 2 ? 0 : 1), (i - x) % 4 < 2 ? bg : 'wht');
    if (kind === 'veg') { rect(g, x + 2, HZ - 3, 5, 3, 'wd'); rect(g, x + 2, HZ - 4, 5, 1, 'grn'); rect(g, x + 8, HZ - 3, 5, 3, 'wd'); rect(g, x + 8, HZ - 4, 5, 1, 'org'); }
    if (kind === 'barber') { rect(g, x - 2, fy, 2, 8, 'wht'); for (let j = 0; j < 8; j += 2) px(g, x - 2 + (j % 4 ? 1 : 0), fy + j, j % 4 ? 'red' : 'blu'); }
    if (shutter > 0) { // a roll shutter, part way down
      const sh = Math.round(fhgt * shutter); rect(g, x + 1, fy, w - 2, sh, 'sh'); for (let j = fy + 1; j < fy + sh; j += 2) hline(g, x + 1, x + w - 2, j, 'shd'); hline(g, x + 1, x + w - 2, fy + sh - 1, 'shl');
      ctx.anchors.shutters.push({ x: x + Math.floor(w / 2), y: fy + sh });
    }
    // vertical kanban on the side
    if (w > 18 && rnd() < 0.5) { rect(g, x + w - 3, top - 8, 3, 14, bg); for (let j = top - 6; j < top + 5; j += 3) px(g, x + w - 2, j, fg); }
  },
  // A convenience store with its brand's fascia, glass front and parking.
  konbini(ctx, x, w, { brand = 'familymart' } = {}) {
    const { g, rnd } = ctx; const top = HZ - 20;
    rect(g, x, top, w, 20, 'wB'); wallRect(ctx, x, top, w, 20);
    if (brand === 'lawson') {
      rect(g, x, top, w, 7, 'lwB'); const tw = textWidth('LAWSON'); text(g, x + Math.floor((w - tw) / 2) + 3, top + 1, 'LAWSON', 'wht');
      oval(g, x + Math.floor((w - tw) / 2) - 4, top + 1, 4, 5, 'wht'); px(g, x + Math.floor((w - tw) / 2) - 3, top + 3, 'lwB');
    } else if (brand === 'familymart') {
      rect(g, x, top, w, 7, 'wht'); hline(g, x, x + w - 1, top, 'fmG'); hline(g, x, x + w - 1, top + 6, 'fmB');
      const tw = textWidth('FAMILYMART'); text(g, x + Math.floor((w - tw) / 2), top + 1, 'FAMILYMART', 'fmB');
    } else { rect(g, x, top, w, 7, 'wht'); hline(g, x, x + w - 1, top + 2, 'org'); hline(g, x, x + w - 1, top + 3, 'grn'); hline(g, x, x + w - 1, top + 4, 'red'); }
    ctx.anchors.signs.push({ x, y: top, w, h: 7 });
    const gy = top + 8;
    rect(g, x + 2, gy, w - 4, HZ - gy, 'lit');
    for (let i = x + 4; i < x + w - 4; i += 1) { if ((i - x) % 9 === 0) vline(g, i, gy, HZ - 1, 'shd'); else if (rnd() < 0.5) px(g, i, gy + 4 + Math.floor(rnd() * 5), ['c1', 'c2', 'c3', 'c4'][Math.floor(rnd() * 4)]); }
    for (let i = x + 4; i < x + w - 4; i += 1) { px(g, i, gy + 3, 'shl'); px(g, i, gy + 7, 'shl'); }
    ctx.anchors.windows.push({ x: x + 2, y: gy, w: w - 4, h: HZ - gy });
    rect(g, x + w - 14, gy + 2, 8, HZ - gy - 2, 'glh'); vline(g, x + w - 10, gy + 2, HZ - 1, 'shd');
    rect(g, x + 1, HZ - 4, 3, 4, 'shd');
  },
  vending(ctx, x, w = 15) {
    const { g } = ctx;
    [[x, 'red'], [x + 8, 'blu']].forEach(([vx, c]) => { if (vx + 7 > x + w) return; rect(g, vx, HZ - 13, 7, 13, c); rect(g, vx + 1, HZ - 12, 5, 5, 'litw'); for (let i = 0; i < 5; i += 2) px(g, vx + 1 + i, HZ - 10, 'c1'); rect(g, vx + 1, HZ - 5, 5, 2, 'k'); });
  },
  gap(ctx, x, w, { kind = 'tree' } = {}) {
    const { g, rnd } = ctx;
    if (kind === 'parking') { rect(g, x, HZ - 1, w, 1, 'cb'); for (let i = x + 2; i < x + w; i += 8) vline(g, i, HZ - 1, HZ - 1, 'ln'); if (rnd() < 0.7) car(ctx, x + 3, ['c5', 'c2', 'shl'][Math.floor(rnd() * 3)]); return; }
    if (kind === 'lot') { rect(g, x, HZ - 2, w, 2, 'gr'); dither(g, x, HZ - 3, w, 1, 'grd', 0.5); rect(g, x, HZ - 6, w, 1, 'wi'); for (let i = x; i < x + w; i += 6) vline(g, i, HZ - 6, HZ - 1, 'pod'); return; }
    for (let i = x + 2; i < x + w - 4; i += 9) tree(ctx, i, HZ, 'round');
  },
  bikes(ctx, x, w) { for (let i = x; i < x + w - 6; i += 5) bicycle(ctx, i, HZ + 2, ['c2', 'c1', 'shd', 'c5'][(i / 5) % 4 | 0]); },
  // A damaged shell (damage level 3): broken top, open floors, rubble.
  ruin(ctx, x, w, { h = 30 } = {}) {
    const { g, rnd } = ctx; const top = HZ - h;
    const edge = []; for (let i = 0; i < w; i += 1) edge.push(top + Math.round(Math.abs(Math.sin(i / 3.1)) * 6 + (i > w * 0.4 ? (i - w * 0.4) * 0.5 : 0) + rnd() * 2));
    for (let i = 0; i < w; i += 1) vline(g, x + i, edge[i], HZ - 1, i === w - 1 ? 'wBs' : 'wB');
    for (let f = top + 6; f < HZ - 4; f += 8) for (let u = x + 2; u < x + w - 4; u += 7) if (edge[u - x] < f) { rect(g, u, f, 5, 4, 'k'); if (rnd() < 0.4) px(g, u + 1, f + 3, 'gs'); }
    for (let i = 0; i < w; i += 1) { px(g, x + i, edge[i], 'ck'); if (i % 5 === 2) vline(g, x + i, edge[i] - 3, edge[i], 'dbd'); }
    for (let f = top + 13; f < HZ; f += 8) hline(g, x, x + w - 1, f, 'wBs');
    scorch(ctx, x + Math.floor(w * 0.6), top + 10, 10);
    rubble(ctx, x - 3, w + 6);
    ctx.anchors.fires.push({ x: x + Math.floor(w * 0.55), y: edge[Math.floor(w * 0.55)] + 1 });
    ctx.anchors.smoke.push({ x: x + Math.floor(w * 0.55), y: edge[Math.floor(w * 0.55)] });
  },
};

function car(ctx, x, color) {
  const { g } = ctx; const y = HZ;
  rect(g, x, y - 5, 16, 4, color); rect(g, x + 3, y - 8, 9, 3, color); rect(g, x + 4, y - 7, 3, 2, 'gld'); rect(g, x + 8, y - 7, 3, 2, 'gld');
  rect(g, x + 2, y - 1, 3, 2, 'k'); rect(g, x + 11, y - 1, 3, 2, 'k'); px(g, x, y - 4, 'lit');
}
function bicycle(ctx, x, y, color) {
  const { g } = ctx;
  oval(g, x, y - 4, 4, 4, 'k'); oval(g, x + 5, y - 4, 4, 4, 'k'); px(g, x + 1, y - 3, 'sw'); px(g, x + 6, y - 3, 'sw');
  line(g, x + 2, y - 2, x + 4, y - 5, color); line(g, x + 4, y - 5, x + 7, y - 2, color); hline(g, x + 3, x + 6, y - 5, color); px(g, x + 3, y - 6, 'k');
}
function tree(ctx, x, base, kind = 'round', key = null) {
  const { g } = ctx;
  if (kind === 'pine') {
    line(g, x + 3, base - 1, x + 6, base - 20, 'trk'); line(g, x + 5, base - 12, x + 10, base - 15, 'trk'); line(g, x + 4, base - 8, x - 1, base - 11, 'trk');
    [[x - 1, base - 25, 14], [x + 5, base - 18, 12], [x - 5, base - 14, 10]].forEach(([cx, cy, w]) => { rect(g, cx, cy, w, 3, 'tB'); hline(g, cx + 1, cx + w - 2, cy - 1, 'tB'); hline(g, cx + 2, cx + w - 3, cy - 1, 'tBl'); hline(g, cx, cx + w - 1, cy + 3, 'tBd'); });
    return;
  }
  if (kind === 'sakura') { vline(g, x + 4, base - 8, base - 1, 'trk'); oval(g, x - 2, base - 18, 13, 11, 'pk'); dither(g, x - 1, base - 13, 11, 5, 'pkd', 0.4); return; }
  vline(g, x + 3, base - 7, base - 1, 'trk'); oval(g, x - 2, base - 17, 11, 11, key ?? 'tA'); dither(g, x - 1, base - 12, 9, 5, 'tAd', 0.45); oval(g, x, base - 16, 5, 4, 'tAl');
}
function pole(ctx, x, { lean = 0 } = {}) {
  const { g } = ctx; const top = HZ - 44;
  if (lean) { line(g, x, HZ + 1, x + lean, top + 4, 'po', 2); hline(g, x + lean - 4, x + lean + 4, top + 7, 'pod'); ctx.anchors.poles.push({ x: x + lean, y: top + 7, fallen: true }); return; }
  rect(g, x, top, 2, HZ - top + 1, 'po'); vline(g, x + 1, top, HZ, 'pod');
  hline(g, x - 4, x + 5, top + 3, 'pod'); hline(g, x - 3, x + 4, top + 8, 'pod');
  rect(g, x + 2, top + 12, 3, 4, 'sh'); px(g, x + 2, top + 12, 'shl'); // transformer
  rect(g, x - 1, top + 26, 4, 3, 'yel'); hline(g, x - 1, x + 2, top + 27, 'k'); // the yellow-and-black pole guard
  ctx.anchors.poles.push({ x, y: top + 3 });
}
function wires(ctx) {
  const { g } = ctx; const poles = ctx.anchors.poles.filter((p) => !p.fallen).sort((a, b) => a.x - b.x);
  for (let i = 0; i + 1 < poles.length; i += 1) {
    const a = poles[i], b = poles[i + 1]; if (b.x - a.x > 170) continue;
    if (ctx.open && a.x < ctx.open[1] && b.x > ctx.open[0]) continue;
    [0, 5].forEach((dy) => { for (let x = a.x - 3; x <= b.x + 3; x += 1) { const t = (x - a.x + 3) / (b.x - a.x + 6); px(g, x, a.y + dy + Math.round(5 * Math.sin(t * Math.PI)), 'wi'); } });
    if (ctx.rnd() < 0.5) { const cx = Math.round((a.x + b.x) / 2); rect(g, cx, a.y + 2, 2, 2, 'k'); px(g, cx - 1, a.y + 3, 'k'); } // a crow on the wire
  }
}
function blockWall(ctx, x0, x1) {
  const { g } = ctx;
  for (let x = x0; x <= x1; x += 1) for (let y = HZ - 5; y < HZ; y += 1) px(g, x, y, (y - HZ) % 2 === 0 || (x + (y % 4 < 2 ? 0 : 3)) % 6 === 0 ? 'bwd' : 'bw');
  for (let x = x0 + 4; x < x1 - 3; x += 12) { px(g, x, HZ - 3, 'k'); px(g, x + 2, HZ - 3, 'k'); }
}

/* -------------------------------------------------------------- ground */

// Ground patterns continue below the scene as the quiz floor tile (rows >= H),
// so each is periodic in y with a period dividing GROUND_TILE_H.
export const GROUND_TILE_H = 48;
const GROUND = {
  street: (x, y) => (y % 8 === 0 && (x * 3 + y) % 11 === 0 ? 'asl' : ditherMask(x, y, 0.22) ? 'asd' : 'as'),
  lane: (x, y) => (ditherMask(x, y, 0.15) ? 'asd' : (x * 7 + y * 5) % 61 === 0 ? 'asl' : 'as'),
  plaza: (x, y) => ((y % 8 === 0 || (x + (Math.floor(y / 8) % 2) * 8) % 16 === 0) ? 'tld' : y % 48 >= 24 && y % 48 < 32 && x % 64 < 16 ? 'tlr' : 'tl'),
  dirt: (x, y) => ((x * 7 + y * 13) % 29 === 0 ? 'dtd' : (x * 5 + y * 3) % 37 === 0 ? 'dtl' : ditherMask(x, y, 0.1) ? 'dtd' : 'dt'),
  grass: (x, y) => (Math.floor(y / 6) % 2 && ditherMask(x, y, 0.3) ? 'grd' : (x * 7 + y * 13) % 41 === 0 ? 'grl' : 'gr'),
  gravel: (x, y) => ((x * 7 + y * 11) % 23 === 0 ? 'gvd' : (x * 3 + y * 5) % 37 === 0 ? 'st' : ditherMask(x, y, 0.08) ? 'gvd' : 'gv'),
  farm: (x, y) => (ditherMask(x, y, 0.12) ? 'dtd' : (x * 5 + y * 7) % 31 === 0 ? 'grd' : 'dt'),
  promenade: (x, y) => ((y % 8 === 0 || (x + (Math.floor(y / 8) % 2) * 8) % 16 === 0) ? 'swd' : 'sw'),
};
export const GROUND_TYPES = Object.freeze(Object.keys(GROUND));

function drawGround(ctx, type) {
  const { g } = ctx; const f = GROUND[type] ?? GROUND.street;
  for (let y = HZ; y < H; y += 1) for (let x = 0; x < W; x += 1) px(g, x, y, f(x, y));
  if (type === 'street') {
    for (let y = HZ; y < HZ + 4; y += 1) for (let x = 0; x < W; x += 1) px(g, x, y, x % 8 === 0 ? 'swd' : 'sw');
    hline(g, 0, W - 1, HZ + 4, 'cb'); hline(g, 0, W - 1, HZ + 7, 'ln');
  } else if (type === 'lane') {
    hline(g, 0, W - 1, HZ, 'cb'); hline(g, 0, W - 1, HZ + 1, 'cb'); hline(g, 0, W - 1, HZ + 2, 'ln');
    for (let y = HZ + 3; y < HZ + 6; y += 1) for (let x = 0; x < W; x += 1) px(g, x, y, ditherMask(x, y, 0.2) ? 'grd' : 'gp');
    hline(g, 0, W - 1, HZ + 6, 'ln');
  } else if (type === 'farm') {
    for (let y = HZ; y < HZ + 2; y += 1) for (let x = 0; x < W; x += 1) px(g, x, y, ditherMask(x, y, 0.4) ? 'grd' : 'gr');
  } else if (type === 'promenade') {
    hline(g, 0, W - 1, HZ, 'cb');
  }
}

/* ------------------------------------------------------------ helpers */

/** Lay lots left to right from `x`; returns the x after the last lot. */
function street(ctx, x, lots) {
  for (const [kind, w, opts] of lots) {
    if (x > W) break;
    let k = kind;
    if (ctx.ruinNext && ['house', 'apartment', 'shop'].includes(kind) && w >= 18 && x >= 200 && x + w <= 330 && !(ctx.open && x < ctx.open[1] && x + w > ctx.open[0])) { k = 'ruin'; ctx.ruinNext = false; }
    LOTS[k](ctx, x, w, opts ?? {});
    x += w + (kind === 'gap' ? 0 : 2);
  }
  return x;
}
function scorch(ctx, x, y, r) {
  const { g } = ctx;
  for (let j = -r; j <= r; j += 1) for (let i = -Math.round(r * 0.7); i <= Math.round(r * 0.7); i += 1) {
    const d = Math.hypot(i / (r * 0.7), (j + r * 0.3) / r); const k = get(g, x + i, y + j);
    if (d < 1 && k && !isBack(k) && ditherMask(x + i, y + j, 1 - d)) px(g, x + i, y + j, 'sc');
  }
}
function rubble(ctx, x, w) {
  const { g, rnd } = ctx;
  for (let i = 0; i < w; i += 1) { const h = Math.round(3 * Math.sin((i / w) * Math.PI) + rnd() * 1.5); for (let j = 0; j < h; j += 1) px(g, x + i, HZ + 1 - j, (i + j) % 3 ? 'db' : 'dbd'); }
  for (let i = 0; i < w; i += 4) px(g, x + i + 1, HZ + 2, 'gs');
}
function barricade(ctx, x) {
  const { g } = ctx;
  for (let i = 0; i < 18; i += 1) px(g, x + i, HZ - 4, Math.floor(i / 2) % 2 ? 'k' : 'tape');
  for (let i = 0; i < 18; i += 1) px(g, x + i, HZ - 3, Math.floor((i + 1) / 2) % 2 ? 'k' : 'tape');
  vline(g, x + 1, HZ - 4, HZ + 1, 'shd'); vline(g, x + 16, HZ - 4, HZ + 1, 'shd');
  [x + 22, x + 28].forEach((cx) => { poly(g, [[cx, HZ + 2], [cx + 2, HZ - 4], [cx + 3, HZ - 4], [cx + 5, HZ + 2]], 'cone'); hline(g, cx + 1, cx + 4, HZ - 1, 'wht'); });
}
function plume(ctx, x, y, h, { dark = false } = {}) {
  const { g } = ctx;
  for (let j = 0; j < h; j += 1) {
    const t = j / h; const cy = y - j; const drift = Math.round(t * t * 20); const r = 2 + Math.round(t * 7);
    for (let i = -r; i <= r; i += 1) {
      const k = Math.abs(i) / (r + 0.5); if (ditherMask(x + i + drift, cy, 1 - k * (0.6 + t * 0.6))) behind(g, x + i + drift, cy, dark || t < 0.35 ? 'sm0' : t < 0.7 ? 'sm1' : 'sm2');
    }
  }
}

/* ---------------------------------------------------------- archetypes */

// Each archetype draws the midground and the ground, sets the actors' lane and
// may record a station sign. `ctx.open` keeps the middle quiet for training.
const pickFrom = (ctx, arr) => arr[Math.floor(ctx.rnd() * arr.length)];
const shopKinds = ['ramen', 'bakery', 'drug', 'veg', 'cafe', 'book', 'barber'];

const ARCHETYPES = {
  // A narrow residential lane: houses, block walls, poles, a small apartment.
  residential(ctx) {
    const { rnd } = ctx;
    const walls = ['wA', 'wB', 'wC', 'wF', 'wE'], roofs = ['rA', 'rA', 'rB', 'rC'];
    const lots = [];
    for (let i = 0; i < 14; i += 1) {
      const r = rnd();
      if (r < 0.2) lots.push(['apartment', 34 + Math.floor(rnd() * 10), { floors: 3 + Math.floor(rnd() * 3), wall: pickFrom(ctx, ['wB', 'wD', 'wF']) }]);
      else if (r < 0.22) lots.push(['gap', 14, { kind: pickFrom(ctx, ['tree', 'parking']) }]);
      else lots.push(['house', 22 + Math.floor(rnd() * 8), { wall: pickFrom(ctx, walls), roof: pickFrom(ctx, roofs), h: 19 + Math.floor(rnd() * 9), balcony: rnd() < 0.7 }]);
    }
    layoutAround(ctx, lots, { lot: ['gap', 44, { kind: 'lot' }] });
    blockWallRuns(ctx);
    poles(ctx, [34, 120, 266, 350]);
    drawGround(ctx, 'lane');
    ctx.anchors.lane = { y: HZ + 4, x0: 40, x1: 340 };
    if (rnd() < 0.6 && !ctx.open) bicycle(ctx, 210, HZ + 1, 'c2');
  },
  // Station front: the station building, a train at the platform, a konbini, shops, a taxi rank.
  station(ctx) {
    const { g, rnd, def } = ctx;
    const sx = ctx.open ? 244 : 150;
    // the platform and train behind, raised on an embankment
    const ty = HZ - 22;
    rect(g, 0, ty + 12, W, 3, 'std'); hline(g, 0, W - 1, ty + 12, 'st');
    train(ctx, ctx.open ? 200 : 40, ty, def.line ?? 'kintetsu', ctx.open ? 180 : 300);
    for (let x = 6; x < W; x += 48) { vline(g, x, ty - 14, ty + 12, 'pod'); hline(g, x - 3, x + 3, ty - 14, 'pod'); }
    hline(g, 0, W - 1, ty - 12, 'wi');
    // station building
    const bw = 76;
    rect(g, sx, HZ - 34, bw, 34, 'wB'); vline(g, sx + bw - 1, HZ - 34, HZ - 1, 'wBs'); wallRect(ctx, sx, HZ - 34, bw, 34);
    rect(g, sx - 2, HZ - 36, bw + 4, 3, 'rAs');
    rect(g, sx + 8, HZ - 31, bw - 16, 9, 'wht'); hline(g, sx + 8, sx + bw - 9, HZ - 23, def.lineColor ?? 'trK'); ctx.anchors.sign = { x: sx + bw / 2, y: HZ - 27, w: bw - 16 };
    rect(g, sx + 3, HZ - 20, bw - 6, 3, 'shd');
    for (let i = sx + 6; i < sx + bw - 6; i += 10) windowRect(ctx, i, HZ - 15, 7, 15);
    oval(g, sx + bw - 10, HZ - 31, 6, 6, 'wht'); px(g, sx + bw - 7, HZ - 29, 'k'); px(g, sx + bw - 7, HZ - 28, 'k'); px(g, sx + bw - 6, HZ - 28, 'k');
    // left and right of the station
    if (ctx.open) {
      street(ctx, 4, [['shop', 26, { kind: pickFrom(ctx, shopKinds) }], ['vending', 15], ['gap', 14, { kind: 'tree' }], ['konbini', 60, { brand: def.store ?? 'familymart' }]]);
      street(ctx, sx + bw + 4, [['shop', 26, { kind: pickFrom(ctx, shopKinds) }], ['vending', 15]]);
    } else {
      const store = def.store ? [['konbini', 60, { brand: def.store }]] : [['shop', 28, { kind: pickFrom(ctx, shopKinds) }], ['shop', 26, { kind: pickFrom(ctx, shopKinds) }]];
      street(ctx, 4, [['shop', 26, { kind: pickFrom(ctx, shopKinds), shutter: ctx.damage >= 1 ? 0.5 : 0 }], ...store, ['vending', 15]]);
      street(ctx, sx + bw + 4, [['bikes', 34], ['shop', 28, { kind: pickFrom(ctx, shopKinds), shutter: ctx.damage >= 2 ? 0.7 : 0 }], ['apartment', 36, { floors: 4 }], ['shop', 30, { kind: pickFrom(ctx, shopKinds) }]]);
    }
    poles(ctx, ctx.open ? [26, 360] : [6, 136, 238, 378]);
    drawGround(ctx, ctx.open ? 'plaza' : 'street');
    if (!ctx.open) { taxi(ctx, sx + 12); }
    ctx.anchors.lane = { y: HZ + 3, x0: 30, x1: 350 };
  },
  // A covered shopping arcade entrance among shophouses.
  shotengai(ctx) {
    const { g, rnd } = ctx;
    const ax = ctx.open ? 278 : 150, aw = 74;
    // arcade: a translucent arched roof seen end-on, shops receding inside
    rect(g, ax, HZ - 30, aw, 30, 'k');
    for (let i = 0; i < aw; i += 1) { const y = HZ - 34 + Math.round(6 * (1 - Math.sin((i / (aw - 1)) * Math.PI))); vline(g, ax + i, y, HZ - 31, i % 6 ? 'shl' : 'sh'); }
    rect(g, ax + 4, HZ - 26, aw - 8, 26, 'gld');
    for (let i = ax + 6; i < ax + aw - 6; i += 8) { rect(g, i, HZ - 18, 6, 18, ctx.time === 'night' ? 'lit' : 'wC'); rect(g, i, HZ - 20, 6, 2, pickFrom(ctx, ['red', 'grn', 'blu', 'org'])); }
    rect(g, ax + 10, HZ - 31, aw - 20, 5, 'red'); ctx.anchors.arcade = { x: ax + aw / 2, y: HZ - 29 };
    for (let i = ax + 2; i < ax + aw - 2; i += 6) oval(g, i, HZ - 25, 3, 4, i % 12 ? 'red' : 'wht');
    wallRect(ctx, ax, HZ - 30, aw, 30);
    const left = []; for (let i = 0; i < 6; i += 1) left.push(['shop', 22 + Math.floor(rnd() * 8), { kind: pickFrom(ctx, shopKinds), shutter: ctx.damage >= 1 && rnd() < 0.5 ? 0.4 + rnd() * 0.4 : 0 }]);
    if (ctx.open) { street(ctx, 22, left.slice(0, 4)); street(ctx, ax + aw + 4, [['vending', 15]]); }
    else { fillLeftOf(ctx, ax - 2, left); street(ctx, ax + aw + 3, [['shop', 26, { kind: 'takoyaki' }], ['shop', 24, { kind: pickFrom(ctx, shopKinds), shutter: ctx.damage >= 2 ? 0.8 : 0 }], ['apartment', 34, { floors: 4, wall: 'wF' }], ['shop', 26, { kind: 'drug' }]]); }
    poles(ctx, ctx.open ? [16, 140] : [16, 140, 250, 366]);
    drawGround(ctx, 'street');
    ctx.anchors.lane = { y: HZ + 3, x0: 30, x1: 350 };
  },
  // Rice paddies on the edge of town: farmhouses, a storehouse, greenhouses.
  paddies(ctx) {
    const { g, rnd } = ctx;
    FAR.pylons(ctx, { xs: ctx.open ? [40, 330] : [70, 250, 380] });
    // distant low houses at the far edge of the fields
    for (let x = 0; x < W; x += 14 + Math.floor(rnd() * 10)) { if (ctx.open && x > OPEN[0] - 10 && x < OPEN[1]) continue; const h = 6 + Math.floor(rnd() * 4); rect(g, x, HZ - 12 - h, 11, h, pickFrom(ctx, ['wA', 'wB', 'wF'])); poly(g, [[x - 1, HZ - 12 - h], [x + 5, HZ - 16 - h], [x + 12, HZ - 12 - h]], pickFrom(ctx, ['rA', 'rB'])); }
    for (let x = 0; x < W; x += 1) for (let y = HZ - 12; y < HZ; y += 1) px(g, x, y, y === HZ - 12 ? 'grd' : ditherMask(x, y, 0.5) ? 'rid' : 'ri');
    // farmhouse + white storehouse on the left, greenhouses on the right
    farmhouse(ctx, 18); kura(ctx, 74);
    greenhouse(ctx, ctx.open ? 262 : 250); greenhouse(ctx, ctx.open ? 306 : 294);
    if (!ctx.open) { tree(ctx, 120, HZ - 10); tree(ctx, 200, HZ - 11); }
    // fields in the ground: paddy water with rows of rice, levees, the farm road
    drawGround(ctx, 'farm');
    for (let y = HZ + 2; y < HZ + 15; y += 1) for (let x = 0; x < W; x += 1) {
      const levee = y === HZ + 8 || (x + Math.round((y - HZ) * 1.5)) % 128 < 2;
      const tuft = (x + (y % 4 < 2 ? 0 : 2)) % 4;
      px(g, x, y, levee ? 'grd' : y % 2 === 0 ? (tuft === 0 ? 'rid' : 'ri') : tuft === 2 ? ((x * 5 + y) % 13 === 0 ? 'wal' : 'pw') : 'rid');
    }
    hline(g, 0, W - 1, HZ + 15, 'grd'); hline(g, 0, W - 1, HZ + 16, 'gr');
    // irrigation channel
    hline(g, 0, W - 1, HZ + 17, 'cb'); hline(g, 0, W - 1, HZ + 18, 'wa'); hline(g, 0, W - 1, HZ + 19, 'cb');
    ctx.anchors.lane = { y: HZ + 1, x0: 30, x1: 350 };
    if (!ctx.open) crossing(ctx, 344);
  },
  // A river with grassy banks, a rail bridge and the far-bank neighbourhood.
  river(ctx) {
    const { g, rnd, def } = ctx;
    const fb = HZ - 14; // far bank line
    for (let x = 0; x < W;) { const w = 10 + Math.floor(rnd() * 12), h = 6 + Math.floor(rnd() * 12); rect(g, x, fb - h, w, h, pickFrom(ctx, ['wA', 'wB', 'wD', 'wF'])); if (rnd() < 0.5) poly(g, [[x - 1, fb - h], [x + w / 2, fb - h - 4], [x + w + 1, fb - h]], pickFrom(ctx, ['rA', 'rB'])); for (let wy = fb - h + 2; wy < fb - 1; wy += 4) litWindow(ctx, x + 2, wy, 3, 2); x += w + 1; }
    rect(g, 0, fb, W, 2, 'gr');
    // the water
    for (let y = fb + 2; y < HZ; y += 1) for (let x = 0; x < W; x += 1) px(g, x, y, (x * 3 + y * 7) % 23 === 0 ? 'wal' : ditherMask(x, y, 0.3) ? 'wad' : 'wa');
    // rail bridge on piers with a train crossing
    const bx0 = ctx.open ? 260 : 210, bx1 = W;
    for (let x = bx0; x < bx1; x += 1) { px(g, x, fb - 10, 'shd'); px(g, x, fb - 3, 'shd'); if ((x - bx0) % 8 === 0) line(g, x, fb - 3, x + 4, fb - 10, 'shd'); if ((x - bx0) % 8 === 4) line(g, x, fb - 10, x + 4, fb - 3, 'shd'); }
    for (let x = bx0 + 6; x < bx1; x += 28) rect(g, x, fb - 3, 4, HZ - fb + 3, 'std');
    train(ctx, bx0 + 18, fb - 17, def.line ?? 'kintetsu', 120);
    // near embankment: grass slope then the path with a railing
    for (let y = HZ; y < HZ + 6; y += 1) for (let x = 0; x < W; x += 1) px(g, x, y, ditherMask(x, y, 0.35) ? 'grd' : 'gr');
    for (let y = HZ + 6; y < H; y += 1) for (let x = 0; x < W; x += 1) px(g, x, y, GROUND.promenade(x, y));
    hline(g, 0, W - 1, HZ + 6, 'cb');
    for (let x = 0; x < W; x += 1) { px(g, x, HZ - 1, 'shd'); if (x % 6 === 0) vline(g, x, HZ - 1, HZ + 5, 'shd'); }
    for (const x of ctx.open ? [40, 300] : [40, 150, 300]) { tree(ctx, x, HZ + 4, rnd() < 0.5 ? 'sakura' : 'round'); }
    if (def.lighthouse) lighthouse(ctx, ctx.open ? 76 : 96);
    ctx.ground = 'promenade';
    ctx.anchors.lane = { y: HZ + 9, x0: 30, x1: 350 };
  },
  // A shrine: torii, the hall in its grove, stone lanterns, gravel.
  shrine(ctx) {
    const { g, rnd, def } = ctx;
    const hx = ctx.open ? 270 : 200;
    for (let x = hx - 40; x < hx + 110; x += 12) tree(ctx, x, HZ - 6, 'round', 'tB');
    // hall
    rect(g, hx + 8, HZ - 22, 52, 16, 'wE'); for (let i = hx + 10; i < hx + 58; i += 6) vline(g, i, HZ - 22, HZ - 7, 'wdd'); wallRect(ctx, hx + 8, HZ - 22, 52, 16);
    poly(g, [[hx, HZ - 21], [hx + 6, HZ - 32], [hx + 62, HZ - 32], [hx + 68, HZ - 21], [hx + 62, HZ - 23], [hx + 6, HZ - 23]], def.copper ? 'cu' : 'rA');
    hline(g, hx + 6, hx + 62, HZ - 32, def.copper ? 'cud' : 'rAs'); rect(g, hx + 30, HZ - 36, 8, 4, def.copper ? 'cu' : 'rA');
    hline(g, hx + 14, hx + 54, HZ - 19, 'wht'); for (let i = hx + 18; i < hx + 52; i += 8) vline(g, i, HZ - 19, HZ - 16, 'wht');
    rect(g, hx + 4, HZ - 6, 60, 2, 'st'); rect(g, hx + 2, HZ - 4, 64, 4, 'std');
    // red fence
    for (let x = hx - 30; x < hx + 100; x += 4) vline(g, x, HZ - 6, HZ - 1, 'red'); hline(g, hx - 30, hx + 100, HZ - 5, 'redd');
    // torii and lanterns
    const tx = ctx.open ? 100 : 110;
    torii(ctx, tx, def.stoneTorii ? 'st' : 'red');
    [tx - 14, tx + 40].forEach((lx) => { rect(g, lx, HZ - 8, 4, 8, 'st'); rect(g, lx - 1, HZ - 11, 6, 3, 'std'); rect(g, lx + 1, HZ - 10, 2, 1, ctx.time === 'night' || ctx.time === 'dusk' ? 'lit' : 'k'); });
    if (def.sando) street(ctx, 4, [['shop', 24, { kind: 'cafe' }], ['shop', 22, { kind: 'veg' }], ['shop', 24, { kind: 'book' }]]);
    else { tree(ctx, 20, HZ, 'round'); tree(ctx, 44, HZ, 'sakura'); }
    drawGround(ctx, 'gravel');
    for (let x = tx - 2; x < tx + 30; x += 1) for (let y = HZ; y < H; y += 1) if ((y - HZ) % 5 !== 4) px(g, x + Math.round((y - HZ) * 0.2), y, x % 7 ? 'st' : 'std');
    ctx.anchors.lane = { y: HZ + 2, x0: 30, x1: 350 };
    if (rnd() < 0.5) pole(ctx, 8);
  },
  // A park: trees, playground, benches; `pines` for Hamadera.
  park(ctx) {
    const { g, rnd, def } = ctx;
    for (let x = -4; x < W; x += 10 + Math.floor(rnd() * 6)) { if (ctx.open && x > OPEN[0] - 8 && x < OPEN[1]) continue; tree(ctx, x, HZ - 2, def.pines ? 'pine' : rnd() < 0.2 ? 'sakura' : 'round'); }
    if (def.pines) for (let x = 0; x < W; x += 5) px(g, x, HZ - 1, 'tBd');
    // playground
    const px0 = ctx.open ? 40 : 60;
    line(g, px0, HZ, px0 + 10, HZ - 12, 'red'); rect(g, px0 + 10, HZ - 13, 6, 2, 'red'); vline(g, px0 + 15, HZ - 12, HZ, 'shd'); line(g, px0 + 16, HZ - 12, px0 + 20, HZ - 12, 'shd'); // slide
    hline(g, px0 + 26, px0 + 44, HZ - 14, 'yel'); line(g, px0 + 26, HZ - 14, px0 + 24, HZ, 'yel'); line(g, px0 + 44, HZ - 14, px0 + 46, HZ, 'yel'); vline(g, px0 + 31, HZ - 13, HZ - 4, 'k'); vline(g, px0 + 39, HZ - 13, HZ - 4, 'k'); hline(g, px0 + 30, px0 + 32, HZ - 4, 'c2'); hline(g, px0 + 38, px0 + 40, HZ - 4, 'c1');
    // bench, clock, toilet block
    const bx = ctx.open ? 268 : 170;
    rect(g, bx, HZ - 4, 12, 2, 'wd'); vline(g, bx + 1, HZ - 2, HZ - 1, 'k'); vline(g, bx + 10, HZ - 2, HZ - 1, 'k');
    vline(g, bx + 24, HZ - 22, HZ - 1, 'shd'); oval(g, bx + 21, HZ - 27, 7, 7, 'wht'); px(g, bx + 24, HZ - 25, 'k'); px(g, bx + 25, HZ - 24, 'k');
    if (!ctx.open) { rect(g, 290, HZ - 14, 26, 14, 'wC'); rect(g, 288, HZ - 16, 30, 2, 'rB'); rect(g, 296, HZ - 9, 4, 9, 'gld'); rect(g, 306, HZ - 9, 4, 9, 'gld'); wallRect(ctx, 290, HZ - 14, 26, 14); }
    if (def.oldStation) oldStation(ctx, ctx.open ? 280 : 236);
    drawGround(ctx, 'grass');
    for (let y = HZ + 2; y < HZ + 6; y += 1) for (let x = 0; x < W; x += 1) px(g, x, y, GROUND.promenade(x, y));
    ctx.anchors.lane = { y: HZ + 4, x0: 30, x1: 350 };
  },
  // A school or university building behind its fence and sports ground.
  school(ctx) {
    const { g, def } = ctx;
    const x0 = 40, w = 300, top = HZ - 40;
    rect(g, x0, top, w, 34, def.university ? 'wD' : 'wA'); hline(g, x0, x0 + w - 1, top, def.university ? 'wDs' : 'wAs'); wallRect(ctx, x0, top, w, 34);
    for (let f = 0; f < 3; f += 1) for (let x = x0 + 4; x < x0 + w - 6; x += 8) { if (ctx.open && x > OPEN[0] + 4 && x < OPEN[1] - 10 && f === 2) continue; litWindow(ctx, x, top + 4 + f * 10, 6, 6); }
    const cx = x0 + Math.floor(w / 2) - 6;
    rect(g, cx, top - 8, 12, 8, def.university ? 'wD' : 'wA'); oval(g, cx + 2, top - 7, 8, 8, 'wht'); px(g, cx + 6, top - 5, 'k'); px(g, cx + 6, top - 4, 'k'); px(g, cx + 7, top - 3, 'k');
    if (def.university) { rect(g, x0 + w - 70, top - 10, 50, 10, 'gl'); hline(g, x0 + w - 70, x0 + w - 21, top - 10, 'glh'); }
    for (const x of [8, 20, 350, 364]) tree(ctx, x, HZ - 6, 'sakura');
    // field fence
    for (let x = 0; x < W; x += 1) { px(g, x, HZ - 6, 'grn'); if (x % 2 === 0) vline(g, x, HZ - 5, HZ - 1, 'grd'); }
    drawGround(ctx, ctx.def.rugby ? 'grass' : 'dirt');
    if (def.rugby) { [70, 314].forEach((gx) => { vline(g, gx, HZ - 28, HZ + 10, 'wht'); vline(g, gx + 12, HZ - 28, HZ + 10, 'wht'); hline(g, gx, gx + 12, HZ - 2, 'wht'); }); for (let x = 0; x < W; x += 1) if (x % 3 !== 2) px(g, x, HZ + 12, 'grl'); }
    else { for (let x = 0; x < W; x += 1) px(g, x, HZ + 10 + Math.round(2 * Math.sin(x / 61)), 'wht'); rect(g, 12, HZ - 4, 14, 8, 'wht'); rect(g, 14, HZ - 2, 10, 6, 'dtd'); }
    ctx.anchors.lane = { y: HZ + 4, x0: 30, x1: 350 };
  },
  // Small factories (machi-koba) with sawtooth roofs, shutters, a chimney.
  industrial(ctx) {
    const { g, rnd } = ctx;
    const xs = ctx.open ? [[4, 70], [262, 118]] : [[4, 84], [92, 64], [160, 92], [256, 124]];
    for (const [x, w] of xs) factory(ctx, x, w);
    if (!ctx.open) { chimney(ctx, 150); tank(ctx, 236); } else chimney(ctx, 86);
    poles(ctx, ctx.open ? [80, 256] : [88, 154, 250, 380]);
    drawGround(ctx, 'street');
    for (let x = 10; x < W; x += 70) if (!ctx.open || x < OPEN[0] - 20 || x > OPEN[1]) { rect(g, x, HZ - 3, 8, 3, 'wd'); hline(g, x, x + 7, HZ - 2, 'wdd'); }
    if (!ctx.open && rnd() < 0.8) truck(ctx, 196);
    ctx.anchors.lane = { y: HZ + 3, x0: 30, x1: 350 };
  },
  // Downtown: tall buildings, billboards, an elevated expressway.
  downtown(ctx) {
    const { g, rnd, def } = ctx;
    for (let x = 0; x < W;) {
      const w = 22 + Math.floor(rnd() * 16), h = 34 + Math.floor(rnd() * 30);
      if (ctx.open && x + w > OPEN[0] && x < OPEN[1]) { x = OPEN[1]; continue; }
      const wall = pickFrom(ctx, ['wB', 'wD', 'wC', 'wF']);
      rect(g, x, HZ - h, w, h, wall); vline(g, x + w - 1, HZ - h, HZ - 1, `${wall}s`); wallRect(ctx, x, HZ - h, w, h);
      for (let wy = HZ - h + 3; wy < HZ - 12; wy += 4) for (let wx = x + 2; wx < x + w - 3; wx += 4) litWindow(ctx, wx, wy, 3, 2);
      if (rnd() < 0.6) { const by = HZ - h + 4 + Math.floor(rnd() * 10); const c = pickFrom(ctx, ['neR', 'neY', 'neB', 'neP']); const lit = ctx.time === 'night' || ctx.time === 'dusk'; rect(g, x + 2, by, w - 5, 7, lit ? c : pickFrom(ctx, ['red', 'yel', 'blu', 'org'])); hline(g, x + 4, x + w - 6, by + 3, 'wht'); ctx.anchors.signs.push({ x: x + 2, y: by, w: w - 5, h: 7 }); }
      rect(g, x + 1, HZ - 10, w - 3, 10, ctx.time === 'night' ? 'lit' : 'gld'); hline(g, x + 1, x + w - 3, HZ - 10, 'k');
      x += w + 1;
    }
    if (def.highway) highway(ctx, HZ - 30);
    if (def.octopus) octopus(ctx, ctx.open ? 70 : 120);
    drawGround(ctx, 'street');
    ctx.anchors.lane = { y: HZ + 3, x0: 30, x1: 350 };
  },
  // Dotonbori: the canal, lit signboards, a bridge, a giant octopus sign.
  canal(ctx) {
    const { g, rnd } = ctx;
    const fb = HZ - 12;
    for (let x = 0; x < W;) {
      const w = 18 + Math.floor(rnd() * 14), h = 30 + Math.floor(rnd() * 26), wall = pickFrom(ctx, ['wB', 'wD', 'wF', 'wC']);
      rect(g, x, fb - h, w, h, wall); wallRect(ctx, x, fb - h, w, h);
      for (let wy = fb - h + 3; wy < fb - 2; wy += 4) for (let wx = x + 2; wx < x + w - 3; wx += 4) litWindow(ctx, wx, wy, 2, 2);
      const lit = ctx.time !== 'day'; const c = pickFrom(ctx, lit ? ['neR', 'neY', 'neB', 'neP'] : ['red', 'yel', 'blu', 'org']);
      rect(g, x + 2, fb - h + 6, w - 4, 10, c); for (let j = fb - h + 8; j < fb - h + 14; j += 2) hline(g, x + 4, x + w - 6, j, j % 4 ? 'wht' : c); ctx.anchors.signs.push({ x: x + 2, y: fb - h + 6, w: w - 4, h: 10 });
      if (rnd() < 0.5) { rect(g, x + w - 4, fb - h - 6, 3, 22, pickFrom(ctx, ['neY', 'red', 'wht'])); }
      x += w + 1;
    }
    for (let y = fb; y < HZ; y += 1) for (let x = 0; x < W; x += 1) px(g, x, y, ditherMask(x, y, 0.35) ? 'wad' : (x + y * 5) % 13 === 0 ? 'neY' : 'wa');
    // Ebisu bridge: a low arch across the left
    const bx = ctx.open ? 30 : 40;
    for (let i = 0; i < 70; i += 1) { const y = fb - 1 - Math.round(4 * Math.sin((i / 69) * Math.PI)); vline(g, bx + i, y, y + 2, 'st'); px(g, bx + i, y - 1, 'std'); }
    octopus(ctx, ctx.open ? 300 : 280);
    drawGround(ctx, 'promenade');
    for (let x = 0; x < W; x += 1) { px(g, x, HZ, 'blk'); px(g, x, HZ - 3, 'blk'); if (x % 5 === 0) vline(g, x, HZ - 3, HZ, 'blk'); }
    ctx.anchors.lane = { y: HZ + 4, x0: 30, x1: 350 };
  },
  // Osaka Castle above its stone walls and moat, in the park.
  castle(ctx) {
    const { g } = ctx;
    const cx = ctx.open ? 300 : 192, base = HZ - 12;
    for (let x = 0; x < W; x += 9) tree(ctx, x, base + 2, 'round', 'tB');
    // stone wall
    const sw0 = cx - 54, sw1 = cx + 54;
    for (let y = base - 22; y < base; y += 1) { const inset = Math.round((base - y) * 0.35); for (let x = sw0 + inset; x <= sw1 - inset; x += 1) px(g, x, y, (x + (y % 4 < 2 ? 0 : 2)) % 5 === 0 || y % 4 === 0 ? 'std' : 'st'); }
    // the keep: five tiers, white walls, green roofs, gold trim
    const tiers = [[60, 10], [50, 9], [40, 8], [30, 8], [22, 8]];
    let y = base - 22;
    tiers.forEach(([w, h], i) => {
      const x = cx - w / 2;
      rect(g, x, y - h, w, h, 'wht'); for (let wx = x + 3; wx < x + w - 3; wx += 5) rect(g, wx, y - h + 3, 2, 3, i < 2 ? 'k' : 'gld');
      poly(g, [[x - 5, y - h + 2], [x - 2, y - h - 1], [x + w + 2, y - h - 1], [x + w + 5, y - h + 2]], 'cu'); hline(g, x - 5, x + w + 4, y - h + 2, 'cud');
      if (i === 2) poly(g, [[cx - 8, y - h - 1], [cx, y - h - 6], [cx + 8, y - h - 1]], 'cu');
      wallRect(ctx, x, y - h, w, h); y -= h + 2;
    });
    poly(g, [[cx - 14, y + 2], [cx, y - 6], [cx + 14, y + 2]], 'cu'); px(g, cx - 10, y, 'gold'); px(g, cx + 10, y, 'gold'); px(g, cx - 11, y - 1, 'gold'); px(g, cx + 11, y - 1, 'gold');
    // moat
    for (let yy = base; yy < HZ; yy += 1) for (let x = 0; x < W; x += 1) px(g, x, yy, ditherMask(x, yy, 0.3) ? 'wad' : 'wa');
    hline(g, 0, W - 1, base, 'st');
    drawGround(ctx, 'gravel');
    for (let x = 0; x < W; x += 1) { px(g, x, HZ, 'std'); px(g, x, HZ + 1, 'st'); }
    ctx.anchors.lane = { y: HZ + 4, x0: 30, x1: 350 };
  },
};
ARCHETYPES.plaza = (ctx) => { ctx.open = ctx.open ?? OPEN; ARCHETYPES.station(ctx); };
ARCHETYPES.lot = (ctx) => { ctx.open = ctx.open ?? OPEN; ARCHETYPES.residential(ctx); };
export const ARCHETYPE_IDS = Object.freeze(Object.keys(ARCHETYPES));

/** Lay the archetype's lots across the scene, leaving the open zone with `fill` lots. */
function layoutAround(ctx, lots, { lot } = {}) {
  if (!ctx.open) { street(ctx, -6, lots); return; }
  let x = -6, i = 0;
  while (x < ctx.open[0] - 18 && i < lots.length) { const [k, w, o] = lots[i++]; if (x + w > ctx.open[0]) break; x = street(ctx, x, [[k, w, o]]); }
  if (lot) street(ctx, ctx.open[0] - 8, [[lot[0], ctx.open[1] - ctx.open[0] + 16, lot[2]]]);
  x = ctx.open[1] + 10;
  while (x < W && i < lots.length) x = street(ctx, x, [lots[i++]]);
}
function fillLeftOf(ctx, right, lots) {
  let total = lots.reduce((s, [, w]) => s + w + 2, 0); let x = right - total;
  while (x > 0 && lots.length) { lots.push(lots[lots.length % 3]); total += lots[0][1] + 2; x = right - total; }
  street(ctx, x, lots);
}
function blockWallRuns(ctx) { for (let x = 0; x < W; x += 60) if (!ctx.open || x + 30 < ctx.open[0] || x > ctx.open[1]) blockWall(ctx, x, x + 18); }
function poles(ctx, xs) { xs.forEach((x, i) => { if (ctx.open && x > ctx.open[0] - 4 && x < ctx.open[1] + 4) return; const lean = ctx.damage >= 3 && i === 1 ? 14 : 0; pole(ctx, x, { lean }); }); wires(ctx); }

function train(ctx, x, y, kind, len) {
  const { g } = ctx;
  const look = { kintetsu: ['trK', 'trKw', 'trK'], nankai: ['trN', 'trO', 'trNb'], jr: ['trN', 'trO', 'trO'], metro: ['trN', 'trM', 'trM'], keihan: ['c4', 'trKw', 'c4'] }[kind] ?? ['trK', 'trKw', 'trK'];
  const [body, stripe, band] = look;
  rect(g, x, y, len, 11, body); hline(g, x, x + len - 1, y, 'shd');
  hline(g, x, x + len - 1, y + 7, stripe); hline(g, x, x + len - 1, y + 8, band);
  for (let i = x; i < x + len; i += 1) { const u = (i - x) % 40; if (u === 39) vline(g, i, y + 1, y + 10, 'k'); else if (u % 8 >= 2 && u % 8 <= 6 && u < 36) { px(g, i, y + 3, 'trW'); px(g, i, y + 4, 'trW'); px(g, i, y + 5, 'trW'); } else if (u === 37 || u === 1) vline(g, i, y + 2, y + 6, 'trW'); }
  rect(g, x, y + 11, len, 1, 'k');
}
function taxi(ctx, x) { const { g } = ctx; car(ctx, x, 'yel'); rect(g, x + 6, HZ - 10, 3, 2, 'wht'); }
function truck(ctx, x) { const { g } = ctx; rect(g, x, HZ - 12, 22, 10, 'wht'); rect(g, x + 22, HZ - 9, 8, 7, 'c2'); rect(g, x + 25, HZ - 8, 4, 3, 'gld'); rect(g, x + 3, HZ - 2, 4, 2, 'k'); rect(g, x + 23, HZ - 2, 4, 2, 'k'); hline(g, x + 2, x + 19, HZ - 8, 'c2'); }
function crossing(ctx, x) {
  const { g } = ctx;
  vline(g, x, HZ - 16, HZ + 1, 'k'); for (let j = HZ - 16; j < HZ; j += 2) px(g, x, j, 'yel');
  line(g, x - 4, HZ - 18, x + 4, HZ - 14, 'yel'); line(g, x - 4, HZ - 14, x + 4, HZ - 18, 'k');
  rect(g, x - 4, HZ - 12, 3, 3, 'sigo'); rect(g, x + 2, HZ - 12, 3, 3, 'sigo');
  ctx.anchors.crossing = { x: x - 4, y: HZ - 12 };
}
function farmhouse(ctx, x) {
  const { g } = ctx; const top = HZ - 30;
  rect(g, x, top + 10, 46, 20, 'wA'); wallRect(ctx, x, top + 10, 46, 20); for (let i = x + 4; i < x + 44; i += 10) litWindow(ctx, i, top + 16, 6, 5);
  poly(g, [[x - 4, top + 11], [x + 6, top], [x + 40, top], [x + 50, top + 11]], 'rA'); hline(g, x + 6, x + 39, top, 'rAh'); for (let i = x; i < x + 46; i += 2) vline(g, i, top + 2, top + 10, 'rAs');
  rect(g, x + 4, HZ - 8, 10, 8, 'wd');
}
function kura(ctx, x) {
  const { g } = ctx; const top = HZ - 26;
  rect(g, x, top + 6, 22, 20, 'wht'); rect(g, x, HZ - 7, 22, 7, 'k'); for (let i = x; i < x + 22; i += 3) vline(g, i, HZ - 7, HZ - 1, 'blk');
  poly(g, [[x - 3, top + 7], [x + 2, top], [x + 20, top], [x + 25, top + 7]], 'rA'); rect(g, x + 8, top + 10, 5, 5, 'blk'); wallRect(ctx, x, top + 6, 22, 20);
}
function greenhouse(ctx, x) {
  const { g } = ctx;
  for (let i = 0; i < 40; i += 1) { const y = HZ - 10 - Math.round(8 * Math.sin((i / 39) * Math.PI)); vline(g, x + i, y, HZ - 11, i % 6 ? 'cls' : 'shl'); }
  rect(g, x, HZ - 11, 40, 1, 'shd');
  for (let i = x + 2; i < x + 38; i += 3) px(g, i, HZ - 13, 'ri');
}
function torii(ctx, x, c) {
  const { g } = ctx; const d = c === 'red' ? 'redd' : 'std';
  rect(g, x, HZ - 26, 3, 26, c); rect(g, x + 22, HZ - 26, 3, 26, c);
  poly(g, [[x - 6, HZ - 28], [x - 4, HZ - 31], [x + 29, HZ - 31], [x + 31, HZ - 28]], 'blk'); rect(g, x - 4, HZ - 28, 33, 2, c); rect(g, x - 2, HZ - 22, 29, 2, c);
  vline(g, x + 12, HZ - 26, HZ - 23, d); hline(g, x + 1, x + 2, HZ - 1, d);
}
function lighthouse(ctx, x) {
  const { g } = ctx; const b = HZ - 14;
  poly(g, [[x, b], [x + 3, b - 26], [x + 9, b - 26], [x + 12, b]], 'wht'); for (let j = b - 22; j < b; j += 4) hline(g, x + 2, x + 10, j, 'wBs');
  rect(g, x + 2, b - 31, 8, 5, 'wd'); rect(g, x + 3, b - 30, 6, 3, 'lit'); poly(g, [[x + 1, b - 31], [x + 6, b - 36], [x + 11, b - 31]], 'rA');
  wallRect(ctx, x + 2, b - 24, 8, 22);
}
function oldStation(ctx, x) {
  const { g } = ctx; const top = HZ - 28;
  rect(g, x, top + 8, 60, 20, 'wF'); for (let i = x + 4; i < x + 58; i += 7) { rect(g, i, top + 12, 4, 8, 'gl'); vline(g, i - 1, top + 8, HZ - 1, 'wE'); }
  poly(g, [[x - 4, top + 9], [x + 10, top - 4], [x + 50, top - 4], [x + 64, top + 9]], 'rC'); poly(g, [[x + 22, top - 4], [x + 30, top - 12], [x + 38, top - 4]], 'rC'); rect(g, x + 28, top - 9, 4, 4, 'wht');
  rect(g, x + 26, HZ - 9, 8, 9, 'wd'); wallRect(ctx, x, top + 8, 60, 20);
  ctx.anchors.sign = { x: x + 30, y: top + 4, w: 30 };
}
function factory(ctx, x, w) {
  const { g, rnd } = ctx; const top = HZ - 24;
  rect(g, x, top, w, 24, 'sh'); for (let i = x; i < x + w; i += 2) vline(g, i, top, HZ - 1, 'shd'); wallRect(ctx, x, top, w, 24);
  for (let i = x; i < x + w; i += 12) { poly(g, [[i, top], [i, top - 8], [i + 12, top]], 'rA'); vline(g, i, top - 8, top, 'glh'); }
  const sx = x + 6, sw = Math.min(26, w - 16);
  rect(g, sx, HZ - 14, sw, 14, 'shl'); for (let j = HZ - 13; j < HZ; j += 2) hline(g, sx, sx + sw - 1, j, 'sh');
  if (ctx.damage >= 1 && rnd() < 0.5) rect(g, sx, HZ - 6, sw, 6, 'k'); else ctx.anchors.shutters.push({ x: sx + sw / 2, y: HZ - 1 });
  rect(g, x + w - 18, top + 4, 14, 5, pickFrom(ctx, ['wht', 'blu'])); hline(g, x + w - 16, x + w - 7, top + 6, 'k'); ctx.anchors.signs.push({ x: x + w - 18, y: top + 4, w: 14, h: 5 });
  litWindow(ctx, x + w - 14, HZ - 12, 8, 5);
}
function chimney(ctx, x) { const { g } = ctx; rect(g, x, HZ - 64, 6, 64, 'wB'); for (let j = HZ - 64; j < HZ - 40; j += 6) rect(g, x, j, 6, 3, 'red'); ctx.anchors.walls.push({ x, y: HZ - 64, w: 6, h: 64 }); }
function tank(ctx, x) { const { g } = ctx; oval(g, x, HZ - 26, 18, 12, 'wB'); rect(g, x + 2, HZ - 20, 14, 20, 'wB'); vline(g, x + 15, HZ - 20, HZ - 1, 'wBs'); for (let j = HZ - 18; j < HZ; j += 4) hline(g, x + 2, x + 15, j, 'wBs'); }
function highway(ctx, y) {
  const { g } = ctx;
  rect(g, 0, y, W, 6, 'st'); hline(g, 0, W - 1, y, 'wB'); hline(g, 0, W - 1, y + 5, 'std'); hline(g, 0, W - 1, y - 2, 'shd');
  for (let x = 0; x < W; x += 8) vline(g, x, y - 2, y - 1, 'shd');
  for (let x = 30; x < W; x += 90) { rect(g, x, y + 6, 8, HZ - y - 6, 'st'); vline(g, x + 7, y + 6, HZ - 1, 'std'); rect(g, x - 4, y + 6, 16, 3, 'std'); }
}
function octopus(ctx, x) {
  const { g } = ctx; const y = HZ - 46;
  oval(g, x, y, 22, 18, 'red'); oval(g, x + 4, y + 3, 5, 5, 'wht'); oval(g, x + 13, y + 3, 5, 5, 'wht'); px(g, x + 6, y + 5, 'k'); px(g, x + 15, y + 5, 'k'); rect(g, x + 8, y + 11, 6, 2, 'redd');
  rect(g, x + 7, y - 3, 8, 3, 'wht'); hline(g, x + 7, x + 14, y - 2, 'red'); // headband
  for (let i = 0; i < 4; i += 1) { const tx = x + 1 + i * 6; for (let j = 0; j < 8; j += 1) px(g, tx + Math.round(Math.sin(j / 2 + i) * 1.5), y + 16 + j, 'red'); }
}

/* ---------------------------------------------------------------- damage */

// 0 peaceful · 1 tension (far smoke, barricade) · 2 attack (cracks, broken
// windows, a small fire, debris) · 3 severe (a ruined building, more fire).
// Never people hurt: the danger is to buildings, and people are getting away.
function drawDamage(ctx) {
  const { g, rnd, damage, def } = ctx;
  if (damage <= 0) return;
  // Smoke rises from the streets, never from a landmark (a plume drifts right as it rises).
  const landmarks = (def.far ?? []).filter((f) => Array.isArray(f) && f[1]?.x !== undefined && !['skyline', 'hills', 'ikoma', 'pylons', 'pines', 'plane'].includes(f[0])).map((f) => f[1].x);
  if (def.archetype === 'castle') landmarks.push(192 - 40, 192, 192 + 30);
  const free = [40, 96, 150, 200, 250, 296, 340].filter((x) => landmarks.every((lx) => x < lx - 34 || x > lx + 24) && !(ctx.open && x > ctx.open[0] - 30 && x < ctx.open[1]));
  const count = Math.min(free.length, damage === 1 ? 1 : damage === 2 ? 2 : 3);
  const step = free.length / Math.max(1, count);
  for (let i = 0; i < count; i += 1) plume(ctx, free[Math.min(free.length - 1, Math.floor(step * i + step / 2))], HZ - 22, 30 + damage * 10, { dark: damage >= 3 });
  if (!ctx.training || damage >= 1) {
    const bx = ctx.open ? 32 : pickFrom(ctx, [30, 250]);
    if (ctx.anchors.lane) barricade(ctx, bx);
  }
  if (damage < 2) return;
  const walls = ctx.anchors.walls.filter((r) => r.w >= 10 && (!ctx.open || r.x + r.w < ctx.open[0] || r.x > ctx.open[1]));
  const hits = Math.min(walls.length, damage === 2 ? 3 : 5);
  for (let i = 0; i < hits; i += 1) {
    const r = walls[Math.floor(rnd() * walls.length)];
    let cx = r.x + 2 + Math.floor(rnd() * (r.w - 4)), cy = r.y + 1;
    for (let s = 0; s < Math.min(r.h * 0.5, 14); s += 1) { const k = get(g, cx, cy); if (/^w[A-F]/.test(k)) px(g, cx, cy, 'ck'); cy += 1; cx += rnd() < 0.33 ? -1 : rnd() < 0.5 ? 1 : 0; }
  }
  const windows = ctx.anchors.windows.filter((r) => !ctx.open || r.x + r.w < ctx.open[0] || r.x > ctx.open[1]);
  const broken = Math.min(windows.length, damage === 2 ? 4 : 8);
  for (let i = 0; i < broken; i += 1) {
    const r = windows[Math.floor(rnd() * windows.length)];
    rect(g, r.x, r.y, r.w, r.h, 'k'); px(g, r.x, r.y + r.h - 1, 'gs'); if (r.w > 2) px(g, r.x + r.w - 1, r.y, 'gs'); if (r.h > 3) px(g, r.x + 1, r.y + 2, 'gs');
  }
  // one window on fire, scorched above
  const fireWin = windows.filter((r) => r.y < HZ - 14 && r.w <= 8);
  const fires = damage === 2 ? 1 : 2;
  for (let i = 0; i < Math.min(fires, fireWin.length); i += 1) {
    const r = fireWin[Math.floor(rnd() * fireWin.length)];
    scorch(ctx, r.x + Math.floor(r.w / 2), r.y - 2, 6); rect(g, r.x, r.y, r.w, r.h, 'fir'); hline(g, r.x, r.x + r.w - 1, r.y + r.h - 1, 'fiy');
    ctx.anchors.fires.push({ x: r.x + Math.floor(r.w / 2), y: r.y + r.h }); ctx.anchors.smoke.push({ x: r.x + Math.floor(r.w / 2), y: r.y - 2 });
  }
  // a broken, hanging sign
  const sign = ctx.anchors.signs.find((s) => !ctx.open || s.x + s.w < ctx.open[0] || s.x > ctx.open[1]);
  if (sign) { for (let i = 0; i < sign.w; i += 1) { const dy = Math.round((i / sign.w) * 3); vline(g, sign.x + i, sign.y + sign.h, sign.y + sign.h + dy, 'k'); } px(g, sign.x + sign.w - 1, sign.y + sign.h + 4, 'db'); }
  // debris on the sidewalk
  for (let i = 0; i < damage + 1; i += 1) { const x = 30 + Math.floor(rnd() * 320); if (ctx.open && x > ctx.open[0] - 20 && x < ctx.open[1]) continue; rubble(ctx, x, 6 + Math.floor(rnd() * 8)); }
}

/* ----------------------------------------------------------------- build */

/**
 * Draw a scene description. Returns { grid, anchors, sky } where anchors are
 * scene-pixel positions for actors (lane, shutters, fires, smoke, crossing)
 * and the station sign.
 */
export function buildScene(def) {
  const g = grid(W, H);
  const ctx = {
    g, def, rnd: seeded(def.id), time: def.time ?? 'day', damage: def.damage ?? 0, training: def.kind === 'training',
    open: def.kind === 'training' ? OPEN : null, ruinNext: (def.damage ?? 0) >= 3,
    anchors: { walls: [], windows: [], signs: [], shutters: [], fires: [], smoke: [], poles: [], lane: null, sign: null, crossing: null, arcade: null },
  };
  if (!ARCHETYPES[def.archetype]) throw new Error(`Unknown scene archetype "${def.archetype}"`);
  drawSky(ctx);
  for (const item of def.far ?? []) { const [name, opts] = Array.isArray(item) ? item : [item, {}]; FAR[name](ctx, opts); }
  ARCHETYPES[def.archetype](ctx);
  drawDamage(ctx);
  return { grid: g, anchors: ctx.anchors, ground: ctx.ground ?? groundOf(def.archetype), sky: scenePalette(ctx.time).s0 };
}
function groundOf(archetype) {
  return { residential: 'lane', lot: 'lane', station: 'street', plaza: 'plaza', shotengai: 'street', paddies: 'farm', river: 'promenade', shrine: 'gravel', park: 'grass', school: 'dirt', industrial: 'street', downtown: 'street', canal: 'promenade', castle: 'gravel' }[archetype] ?? 'street';
}

const sceneCache = new Map();
/** The scene image (a one-frame sheet) plus anchors and its ground type. */
export function sceneImage(def) {
  if (sceneCache.has(def.id)) return sceneCache.get(def.id);
  const built = buildScene(def);
  const result = { ...built, image: image(`scene-${def.id}`, built.grid, scenePalette(def.time ?? 'day')) };
  sceneCache.set(def.id, result);
  return result;
}

/** The repeating floor tile that continues a ground type below a scene, in a time of day. */
export function sceneGroundImage(type, time = 'day') {
  const g = grid(W, GROUND_TILE_H); const f = GROUND[type] ?? GROUND.street;
  for (let y = 0; y < GROUND_TILE_H; y += 1) for (let x = 0; x < W; x += 1) px(g, x, y, f(x, H + y));
  return image(`scene-ground-${type}-${time}`, g, scenePalette(time));
}

/* ---------------------------------------------------------------- actors */

// Small animated people and effects placed over a scene. Every sheet is one
// row of frames; people face left (fleeing away from the Horde on the right).
const ACTOR_FRAMES = { runner: [10, 14, 4], family: [16, 14, 4], cyclist: [14, 14, 2], walker: [10, 14, 4], waver: [10, 14, 2], police: [10, 14, 2], shopkeeper: [10, 14, 2], smoke: [14, 22, 4], flame: [7, 9, 3], blink: [9, 3, 2] };
export const ACTOR_KINDS = Object.freeze(Object.keys(ACTOR_FRAMES));

function person(g, ox, oy, { shirt = 'c2', hair = 'hr', pants = 'pa', pose = 'stand', f = 0, child = false, cap = null, bag = false } = {}) {
  const top = oy + (child ? 4 : 0);
  const hx = ox + 3, lean = pose === 'run' ? -1 : 0;
  // head
  rect(g, hx + lean, top, 3, 3, 'sk'); hline(g, hx + lean, hx + lean + 2, top, hair); px(g, hx + lean + 2, top + 1, hair);
  if (cap) { hline(g, hx + lean - 1, hx + lean + 2, top - 1, cap); hline(g, hx + lean, hx + lean + 2, top, cap); }
  // body
  const bh = child ? 3 : 4; rect(g, hx + lean, top + 3, 3, bh, shirt);
  const legY = top + 3 + bh, legH = child ? 3 : 4;
  // legs
  const runLegs = [[-2, 2], [0, 0], [2, -2], [0, 0]], walkLegs = [[-1, 1], [0, 0], [1, -1], [0, 0]];
  const [a, b] = pose === 'run' ? runLegs[f] : pose === 'walk' ? walkLegs[f] : [0, 0];
  line(g, hx + 1, legY, hx + 1 + a, legY + legH - 1, pants); line(g, hx + 1, legY, hx + 1 + b, legY + legH - 1, pants);
  px(g, hx + 1 + a, legY + legH - 1, 'k'); px(g, hx + 1 + b, legY + legH - 1, 'k');
  // arms
  const ay = top + 3;
  if (pose === 'run') { const sw = [[-2, 2], [0, 0], [2, -2], [0, 0]][f]; line(g, hx + lean, ay, hx + lean + sw[0] - 1, ay + 2, 'sk'); line(g, hx + lean + 2, ay, hx + lean + 3 + sw[1], ay + 2, 'sk'); }
  else if (pose === 'wave') { line(g, hx - 1, ay, hx - 2, ay - (f ? 3 : 2), 'sk'); px(g, hx - 2 - f, ay - 3, 'sk'); line(g, hx + 3, ay, hx + 4, ay + 2, 'sk'); }
  else if (pose === 'police') { line(g, hx - 1, ay, hx - 2 - f, ay - 2, 'wht'); line(g, hx - 2 - f, ay - 3, hx - 3 - f * 2, ay - 6 + f, 'sig'); line(g, hx + 3, ay, hx + 3, ay + 2, 'wht'); }
  else if (pose === 'pull') { vline(g, hx - 1, ay - 2 + f, ay + 1, 'sk'); vline(g, hx + 3, ay - 2 + f, ay + 1, 'sk'); }
  else { vline(g, hx - 1, ay, ay + 2, 'sk'); vline(g, hx + 3, ay, ay + 2, 'sk'); }
  if (bag) rect(g, hx + 3, ay + 2, 2, 2, 'bag');
}

const actorCache = new Map();
/** One actor's sheet: { url, fw, fh, frames } (palette per time of day). */
export function actorSheet(kind, variant = 0, time = 'day') {
  const key = `${kind}-${variant}-${time}`;
  if (actorCache.has(key)) return actorCache.get(key);
  const [fw, fh, n] = ACTOR_FRAMES[kind];
  const shirts = ['c1', 'c2', 'c3', 'c4', 'c6', 'c5'], hairs = ['hr', 'hrB', 'hr', 'hrG'];
  const shirt = shirts[variant % shirts.length], hair = hairs[variant % hairs.length];
  const frames = [];
  for (let f = 0; f < n; f += 1) {
    const g = grid(fw, fh);
    if (kind === 'runner') person(g, 1, 1, { pose: 'run', f, shirt, hair, bag: variant % 2 === 1 });
    else if (kind === 'walker') person(g, 1, 1, { pose: 'walk', f, shirt, hair, bag: variant % 2 === 0 });
    else if (kind === 'family') { person(g, 6, 1, { pose: 'run', f, shirt, hair }); person(g, 0, 1, { pose: 'run', f: (f + 2) % 4, shirt: shirts[(variant + 2) % shirts.length], child: true }); hline(g, 4, 7, 8, 'sk'); }
    else if (kind === 'waver') person(g, 2, 1, { pose: 'wave', f, shirt, hair });
    else if (kind === 'police') person(g, 3, 1, { pose: 'police', f, shirt: 'pol', pants: 'pol', cap: 'pol' });
    else if (kind === 'shopkeeper') person(g, 3, 1, { pose: 'pull', f, shirt: 'c5', hair, pants: 'pa' });
    else if (kind === 'cyclist') {
      oval(g, 0, 9, 5, 5, 'k'); oval(g, 8, 9, 5, 5, 'k'); px(g, 2, 11, 'sw'); px(g, 10, 11, 'sw');
      line(g, 2, 11, 6, 8, 'c2'); line(g, 6, 8, 10, 11, 'c2'); hline(g, 4, 9, 8, 'c2'); px(g, 3, 7, 'k'); px(g, 3, 6, 'k');
      person(g, 3, -1, { pose: 'stand', shirt, hair }); rect(g, 5, 9, 1, 4, 'k'); // overwrite the legs: pedalling
      for (let y = 7; y < 13; y += 1) for (let x = 3; x < 8; x += 1) if (get(g, x, y) === 'pa' || get(g, x, y) === 'k') px(g, x, y, '');
      line(g, 5, 7, f ? 4 : 7, 10, 'pa'); line(g, 5, 7, f ? 7 : 4, 11, 'pa'); oval(g, 0, 9, 5, 5, 'k'); oval(g, 8, 9, 5, 5, 'k'); px(g, 2, 11, 'sw'); px(g, 10, 11, 'sw');
    } else if (kind === 'smoke') {
      for (let i = 0; i < 5; i += 1) { const t = ((i + f / n) % 5) / 5; const r = 2 + Math.round(t * 4); oval(g, 4 + Math.round(t * 4) - r / 2 + 2, Math.round(18 - t * 18) - r / 2, r + 1, r, t < 0.4 ? 'smA' : t < 0.75 ? 'smB' : 'smC'); }
    } else if (kind === 'flame') {
      const h = [7, 8, 6][f]; poly(g, [[0, 8], [2, 8 - h + 2], [3, 8 - h], [4, 8 - h + 3], [6, 8]], 'fir'); poly(g, [[1, 8], [3, 8 - h + 3], [5, 8]], 'fi'); vline(g, 3, 6, 7, 'fiy');
    } else if (kind === 'blink') { rect(g, 0, 0, 3, 3, f ? 'sigo' : 'sig'); rect(g, 6, 0, 3, 3, f ? 'sig' : 'sigo'); }
    frames.push(g);
  }
  const s = sheet(`actor-${key}`, fw, fh, [frames], scenePalette(time));
  const result = { ...s, frames: n };
  if (s.grids) Object.defineProperties(result, { grids: { value: s.grids }, palette: { value: s.palette } });
  actorCache.set(key, result);
  return result;
}
