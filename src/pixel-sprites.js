// Original pixel-art heroes and enemies. Each character is drawn on a small
// integer grid (heroes 48x48, enemies 24-80 px) and rasterized into one PNG
// sheet whose rows are the semantic states below. CSS steps() plays a row.
import { PAL, DIM, FLASH } from './pixel-palette.js';
import {
  grid, clone, px, rect, oval, line, poly, stamp, mirror, outline, overlay, shift, squash,
  recolor, dissolve, sheet,
} from './pixel-core.js';

export const ROWS = Object.freeze(['idle', 'attack', 'special', 'guard', 'cast', 'dodge', 'hit', 'charge', 'defeat', 'victory',
  'broken', 'enraged', 'tired', 'heal', 'barrier', 'counter', 'shadow']);
export const FRAMES = Object.freeze({ idle: 2, attack: 4, special: 4, guard: 2, cast: 4, dodge: 3, hit: 3, charge: 2, defeat: 4,
  victory: 2, broken: 3, enraged: 2, tired: 2, heal: 3, barrier: 2, counter: 4, shadow: 4 });

const rad = (deg) => (deg * Math.PI) / 180;
const dir = (deg) => [Math.cos(rad(deg)), Math.sin(rad(deg))];

function arc(g, cx, cy, r, from, to, c, thick = 1) {
  const steps = Math.max(8, Math.abs(to - from) / 4);
  for (let i = 0; i <= steps; i += 1) {
    const [dx, dy] = dir(from + ((to - from) * i) / steps);
    if (thick === 1) px(g, cx + dx * r, cy + dy * r, c);
    else rect(g, Math.round(cx + dx * r) - (thick >> 1), Math.round(cy + dy * r) - (thick >> 1), thick, thick, c);
  }
}

function sparkle(g, x, y, c = 'Y', big = false) {
  px(g, x, y, 'W');
  px(g, x - 1, y, c); px(g, x + 1, y, c); px(g, x, y - 1, c); px(g, x, y + 1, c);
  if (big) { px(g, x - 2, y, c); px(g, x + 2, y, c); px(g, x, y - 2, c); px(g, x, y + 2, c); }
}

function stars(g, cx, cy, f) {
  const spots = f % 2 ? [[-5, 1], [0, -2], [5, 1]] : [[-4, -1], [1, 1], [5, -2]];
  spots.forEach(([dx, dy]) => sparkle(g, cx + dx, cy + dy, 'y'));
}

function speedLines(g, x, y, len, rows = [0, 4, 8]) {
  rows.forEach((dy, i) => line(g, x - len + i * 2, y + dy, x - 2 + i, y + dy, 'i'));
}

function ghost(src) {
  return recolor(src, () => '~');
}

/* ------------------------------------------------------------------ heroes */

const HEADS = {
  fighter: {
    rows: [
      '...b.bb.b...',
      '..bbbbbbbbb.',
      '.bbbnnbbbbbb',
      '.bbbbbbbbbbb',
      'Rrrrrrrrrrrr',
      'RRbbffffffff',
      '..bbffkfffkf',
      '..bbffkfffkf',
      '..bFffffffff',
      '...Fffffffff',
      '....FFfffF..',
    ],
    eyes: [[6, 6], [10, 6]], mouth: [8, 9],
  },
  mage: {
    rows: [
      '.PP...........',
      '.Pvv..........',
      '..vvv.........',
      '...vvv........',
      '...vvvV.......',
      '..vvvvVV......',
      '..vvvvvVV.....',
      '.vvvvvvvVV....',
      '.vvvvvvvvVV...',
      'yyyyyyyyyyyyy.',
      'PvvvvvvvvvvvvP',
      '..UUUfffffff..',
      '..UUffkfffkf..',
      '..UUffkfffkf..',
      '..UUFfffffff..',
      '...UFFffffF...',
      '....FFFFFF....',
    ],
    eyes: [[6, 12], [10, 12]], mouth: [8, 15],
  },
  ninja: {
    rows: [
      '...DDDDD....',
      '..DuuDDDDD..',
      '.DuDDDDDDDD.',
      '.DDDDDDDDDDD',
      'DDDDDfffffff',
      'DDDDDfkfffkf',
      'DDDDDfffffff',
      'DDDDDDDDDDDD',
      'rrrrrrrrrrrr',
      'RrrrrrrrrrrR',
      '.RRrrrrrrrR.',
    ],
    eyes: [[6, 5], [10, 5]], single: true,
  },
};

function head(g, id, x, y, eyes = 'open', glint = false) {
  const spec = HEADS[id];
  stamp(g, spec.rows, x, y);
  const tall = !spec.single;
  spec.eyes.forEach(([ex, ey]) => {
    if (eyes === 'open') { if (glint) px(g, x + ex, y + ey, 'Y'); return; }
    px(g, x + ex, y + ey, 'f');
    if (tall) px(g, x + ex, y + ey + 1, 'f');
    const row = y + ey + (tall ? 1 : 0);
    if (eyes === 'shut') { px(g, x + ex - 1, row, 'k'); px(g, x + ex, row, 'k'); }
    if (eyes === 'happy') { px(g, x + ex - 1, row, 'k'); px(g, x + ex, row - 1, 'k'); px(g, x + ex + 1, row, 'k'); }
  });
  if (eyes === 'happy' && spec.mouth) { px(g, x + spec.mouth[0], y + spec.mouth[1], 'R'); px(g, x + spec.mouth[0] + 1, y + spec.mouth[1], 'R'); }
}

const STYLE = {
  fighter: { legs: 'b', legShade: 'B', boots: 'B', torso: 'r', torsoShade: 'R', sleeve: 'r', sleeveShade: 'R', chest: 's', belt: 'B', buckle: 'y', headH: 11 },
  mage: { legs: 'P', legShade: 'P', boots: 'B', torso: 'v', torsoShade: 'P', sleeve: 'v', sleeveShade: 'P', robe: 'v', hem: 'y', belt: 'y', buckle: 'c', headH: 17 },
  ninja: { legs: 'D', legShade: 'K', boots: 'S', torso: 'D', torsoShade: 'K', sleeve: 'D', sleeveShade: 'K', belt: 'r', buckle: 'R', headH: 11 },
};

function sword(g, hx, hy, deg, len = 13) {
  const [dx, dy] = dir(deg);
  line(g, hx - dx * 2, hy - dy * 2, hx, hy, 'B', 2);
  line(g, hx + dx * 2, hy + dy * 2, hx + dx * len, hy + dy * len, 'i', 2);
  line(g, hx + dx * 3, hy + dy * 3, hx + dx * (len - 1), hy + dy * (len - 1), 'w');
  const cx = hx + dx * 1.5, cy = hy + dy * 1.5;
  line(g, cx - dy * 3, cy + dx * 3, cx + dy * 3, cy - dx * 3, 'y');
  px(g, hx - dx * 3, hy - dy * 3, 'y');
}

function dagger(g, hx, hy, deg, len = 8) {
  const [dx, dy] = dir(deg);
  line(g, hx, hy, hx + dx * len, hy + dy * len, 'i', 2);
  line(g, hx + dx * 2, hy + dy * 2, hx + dx * (len - 1), hy + dy * (len - 1), 'W');
  const cx = hx + dx, cy = hy + dy;
  line(g, cx - dy * 2, cy + dx * 2, cx + dy * 2, cy - dx * 2, 'S');
}

function staff(g, hx, hy, deg, orb = 't') {
  const [dx, dy] = dir(deg);
  line(g, hx - dx * 12, hy - dy * 12, hx + dx * 10, hy + dy * 10, 'b', 2);
  line(g, hx - dx * 12 + 1, hy - dy * 12, hx + dx * 9 + 1, hy + dy * 9, 'n');
  const ox = Math.round(hx + dx * 13), oy = Math.round(hy + dy * 13);
  line(g, hx + dx * 10 - dy * 2, hy + dy * 10 + dx * 2, ox - dy * 3, oy + dx * 3, 'y');
  line(g, hx + dx * 10 + dy * 2, hy + dy * 10 - dx * 2, ox + dy * 3, oy - dx * 3, 'y');
  oval(g, ox - 3, oy - 3, 6, 6, orb === 't' ? 'T' : orb);
  oval(g, ox - 2, oy - 3, 5, 5, orb);
  px(g, ox - 1, oy - 2, 'W');
  return [ox, oy];
}

const SHIELD = [
  '.yyyyy.',
  'ysisssy',
  'ysirSsy',
  'yrrrrry',
  'ysSrSsy',
  '.ysrsy.',
  '.ysSsy.',
  '..ysy..',
  '...y...',
];

/** Paper-doll humanoid on a 48x48 grid facing right. Returns an outlined grid. */
function figure(id, p) {
  const st = STYLE[id];
  const g = grid(48, 48);
  const [hx, hy] = p.hip, [sx, sy] = p.sh;
  const fb = p.fb, ff = p.ff, hb = p.hb, hf = p.hf;

  if (id === 'ninja') scarf(g, sx, sy, p.f ?? 0, p.scarf ?? 0);
  // back leg and back arm
  if (!st.robe) {
    line(g, hx - 2, hy, fb[0], fb[1] - 1, st.legShade, 3);
    rect(g, fb[0] - 1, fb[1] - 2, 5, 3, st.boots);
  } else rect(g, fb[0] - 1, 44, 4, 2, st.boots);
  line(g, sx - 3, sy + 2, hb[0], hb[1], st.sleeveShade, 3);
  rect(g, hb[0] - 1, hb[1] - 1, 3, 3, 'F');
  if (id === 'fighter' && !p.shieldFront) stamp(g, SHIELD, hb[0] - 4, hb[1] - 4);
  if (id === 'mage' && p.staffBack) staff(g, hb[0], hb[1], p.w, p.orb);

  // front leg
  if (!st.robe) {
    line(g, hx + 2, hy, ff[0], ff[1] - 1, st.legs, 3);
    rect(g, ff[0] - 1, ff[1] - 2, 5, 3, st.boots);
    px(g, ff[0] + 3, ff[1] - 2, st.boots === 'S' ? 'X' : 'b');
  } else rect(g, ff[0] - 1, 44, 5, 2, st.boots);

  // torso
  if (st.robe) {
    const bottom = Math.max(fb[1], ff[1]) - 1;
    poly(g, [[sx - 4, sy], [sx + 5, sy], [hx + 8, bottom], [hx - 7, bottom]], st.robe);
    line(g, sx - 4, sy + 1, hx - 7, bottom - 1, 'P');
    line(g, hx - 6, bottom - 1, hx + 7, bottom - 1, st.hem);
    line(g, sx + 1, sy + 3, hx + 1, bottom - 2, 'V');
    rect(g, hx - 4, hy - 2, 10, 2, st.belt);
    px(g, hx + 1, hy - 2, st.buckle);
  } else {
    poly(g, [[sx - 4, sy], [sx + 5, sy], [hx + 5, hy + 1], [hx - 4, hy + 1]], st.torso);
    line(g, sx - 4, sy + 1, hx - 4, hy, st.torsoShade);
    if (st.chest) {
      rect(g, sx - 2, sy + 1, 6, 5, st.chest);
      px(g, sx - 1, sy + 2, 'i'); px(g, sx, sy + 2, 'i');
      line(g, sx - 2, sy + 5, sx + 3, sy + 5, 'S');
    }
    if (id === 'ninja') { line(g, sx - 1, sy + 1, hx + 3, hy - 2, 'u'); }
    rect(g, hx - 4, hy - 1, 10, 2, st.belt);
    px(g, hx + 2, hy - 1, st.buckle);
  }

  head(g, id, sx - (id === 'mage' ? 7 : 6), sy - st.headH + 1, p.eyes || 'open', p.glint);

  // front arm, weapon
  if (id === 'fighter') {
    if (!p.noWeapon) sword(g, hf[0], hf[1], p.w, p.len);
    if (p.shieldFront) stamp(g, SHIELD, hf[0] - 1, hf[1] - 5);
  }
  line(g, sx + 3, sy + 2, hf[0], hf[1], st.sleeve, 3);
  rect(g, hf[0] - 1, hf[1] - 1, 3, 3, 'f');
  if (id === 'mage' && !p.staffBack) p.orbAt = staff(g, hf[0], hf[1], p.w, p.orb);
  if (id === 'ninja' && !p.noWeapon) dagger(g, hf[0], hf[1], p.w, p.len);
  if (id === 'fighter' && p.shieldFront) stamp(g, SHIELD, hf[0] - 1, hf[1] - 5);
  outline(g, 'k');
  return g;
}

function scarf(g, sx, sy, f, lift) {
  const y = sy - 2 - lift;
  if (f % 2 === 0) {
    line(g, sx - 3, y, sx - 13, y - 3, 'r', 2);
    line(g, sx - 3, y + 1, sx - 11, y + 3, 'R', 2);
  } else {
    line(g, sx - 3, y, sx - 13, y - 1, 'r', 2);
    line(g, sx - 3, y + 1, sx - 12, y + 5, 'R', 2);
  }
}

const I = (p, extra) => ({ ...p, ...extra });

function heroFrames(id) {
  const base = id === 'ninja'
    ? { hip: [20, 36], sh: [22, 27], fb: [15, 46], ff: [27, 46], hb: [17, 33], hf: [28, 32], w: 115 }
    : { hip: [21, 34], sh: [22, 24], fb: [18, 46], ff: [26, 46], hb: [17, 31], hf: [28, 31], w: id === 'mage' ? -80 : -55 };
  const F = (p) => figure(id, p);
  const idle0 = F(base);
  const hurt = F(I(base, { hip: [base.hip[0] - 3, base.hip[1]], sh: [base.sh[0] - 5, base.sh[1] + 1], hb: [base.hb[0] - 5, base.hb[1]], hf: [base.hf[0] - 6, base.hf[1] + 1], w: id === 'mage' ? -100 : id === 'ninja' ? 150 : -85, eyes: 'shut' }));
  const hurt2 = F(I(base, { hip: [base.hip[0] - 1, base.hip[1]], sh: [base.sh[0] - 2, base.sh[1]], hb: [base.hb[0] - 2, base.hb[1]], hf: [base.hf[0] - 2, base.hf[1]], eyes: 'shut' }));
  const kneel = F(I(base, { hip: [20, 40], sh: [20, 30], fb: [14, 46], ff: [27, 46], hb: [16, 37], hf: [26, 38], w: id === 'mage' ? -95 : id === 'ninja' ? 100 : 75, eyes: 'shut', scarf: -2 }));
  const sit = (f) => {
    const g = F(I(base, { hip: [19, 43], sh: [18, 33], fb: [26, 46], ff: [31, 46], hb: [14, 41], hf: [25, 41], w: id === 'mage' ? -20 : id === 'ninja' ? 10 : 5, eyes: 'shut', scarf: -4, f }));
    if (f !== undefined) stars(g, 18, 18, f);
    return g;
  };
  const rows = {
    idle: [idle0, squash(id === 'ninja' ? F(I(base, { f: 1 })) : idle0, 36, 1)],
    hit: [recolor(idle0, FLASH), hurt, hurt2],
    defeat: [hurt, kneel, sit(), sit(1)],
  };

  if (id === 'fighter') {
    const wind = F(I(base, { hip: [20, 35], sh: [20, 25], fb: [17, 46], ff: [25, 46], hb: [16, 31], hf: [18, 22], w: -140 }));
    const lunge = F(I(base, { hip: [24, 35], sh: [27, 25], fb: [18, 46], ff: [31, 46], hb: [21, 31], hf: [33, 27], w: -30 }));
    const chop = F(I(base, { hip: [25, 36], sh: [28, 26], fb: [18, 46], ff: [32, 46], hb: [22, 32], hf: [34, 32], w: 35 }));
    arc(chop, 30, 26, 15, -80, 40, 'w', 2); arc(chop, 30, 26, 13, -60, 30, 'Y');
    const back = F(I(base, { hip: [22, 34], sh: [23, 24], fb: [18, 46], ff: [27, 46], hb: [18, 31], hf: [29, 31], w: -30 }));
    rows.attack = [wind, lunge, chop, back];

    const crouch = F(I(base, { hip: [20, 38], sh: [19, 28], fb: [15, 46], ff: [25, 46], hb: [15, 34], hf: [16, 25], w: -150 }));
    [[10, 20], [30, 18], [8, 36], [34, 34]].forEach(([x, y]) => sparkle(crouch, x, y, 'y'));
    const leap = F(I(base, { hip: [22, 30], sh: [23, 20], fb: [19, 40], ff: [27, 41], hb: [18, 27], hf: [24, 13], w: -95, len: 15 }));
    sparkle(leap, 24, 2, 'Y', true);
    const slam = F(I(base, { hip: [26, 37], sh: [29, 27], fb: [19, 46], ff: [33, 46], hb: [23, 33], hf: [35, 33], w: 25, len: 15 }));
    arc(slam, 30, 28, 17, -100, 45, 'Y', 3); arc(slam, 30, 28, 14, -80, 35, 'w', 2);
    const land = F(I(base, { hip: [24, 37], sh: [26, 27], fb: [18, 46], ff: [31, 46], hb: [21, 33], hf: [34, 35], w: 65 }));
    rows.special = [crouch, leap, slam, land];

    const guard = F(I(base, { hip: [20, 35], sh: [21, 25], fb: [17, 46], ff: [26, 46], hb: [16, 31], hf: [27, 29], w: -125, shieldFront: true }));
    const guardGlint = clone(guard); sparkle(guardGlint, 31, 26, 'W');
    rows.guard = [guard, guardGlint];

    const thrust = F(I(base, { hip: [26, 35], sh: [29, 25], fb: [19, 46], ff: [33, 46], hb: [24, 31], hf: [35, 28], w: -5, len: 11 }));
    const thrust2 = clone(thrust); sparkle(thrust2, 46, 27, 'Y', true);
    const guardFlash = recolor(guard, (c) => (c === 's' || c === 'i' ? 'W' : c));
    rows.counter = [guardFlash, thrust, thrust2, back];

    const cheer = F(I(base, { hf: [26, 15], w: -90, eyes: 'happy' }));
    const cheer2 = shift(cheer, 0, -1); sparkle(cheer2, 26, 1, 'Y', true);
    rows.victory = [cheer, cheer2];
  }

  if (id === 'mage') {
    const pull = F(I(base, { hf: [25, 28], w: -115, orb: 'c' }));
    const point = F(I(base, { hip: [22, 34], sh: [24, 24], hf: [31, 27], w: -45, orb: 'W' }));
    const point2 = clone(point); sparkle(point2, 42, 16, 'c', true);
    const rest = F(I(base, { hf: [29, 30], w: -70 }));
    rows.cast = [pull, point, point2, rest];

    const raise = F(I(base, { hb: [21, 21], hf: [25, 19], w: -90, orb: 'o' }));
    const raise2 = F(I(base, { hb: [21, 21], hf: [25, 19], w: -90, orb: 'y' }));
    [[16, 2], [33, 2], [25, -1], [12, 10], [37, 9]].forEach(([x, y]) => sparkle(raise2, x, y + 3, 'o'));
    const fling = F(I(base, { hip: [22, 34], sh: [24, 24], hf: [32, 26], w: -30, orb: 'Y' }));
    rows.special = [raise, raise2, fling, rest];

    const ward = F(I(base, { hb: [30, 27], hf: [26, 32], w: -85, orb: 'c' }));
    const ward2 = clone(ward);
    [[33, 20], [35, 26], [33, 32]].forEach(([x, y]) => sparkle(ward, x, y, 'c'));
    [[34, 22], [36, 29], [34, 35]].forEach(([x, y]) => sparkle(ward2, x, y, 'c'));
    rows.barrier = [ward, ward2];

    const pray = F(I(base, { hf: [26, 21], w: -90, orb: 'l', eyes: 'shut' }));
    const pray2 = clone(pray); [[14, 18], [34, 22], [20, 8]].forEach(([x, y]) => sparkle(pray2, x, y, 'l'));
    const pray3 = clone(pray); [[16, 12], [32, 14], [22, 30], [36, 34]].forEach(([x, y]) => sparkle(pray3, x, y, 'l'));
    rows.heal = [pray, pray2, pray3];

    const cheer = F(I(base, { hf: [27, 20], w: -90, orb: 'Y', eyes: 'happy' }));
    const cheer2 = shift(cheer, 0, -1); sparkle(cheer2, 36, 4, 'Y'); sparkle(cheer2, 19, 8, 'c');
    rows.victory = [cheer, cheer2];
  }

  if (id === 'ninja') {
    const low = F(I(base, { hip: [19, 38], sh: [20, 29], fb: [14, 46], ff: [26, 46], hb: [16, 35], hf: [24, 34], w: 150, f: 1, scarf: -1 }));
    const dash = F(I(base, { hip: [27, 35], sh: [31, 27], fb: [21, 46], ff: [35, 46], hb: [25, 31], hf: [37, 28], w: -20, scarf: 2 }));
    speedLines(dash, 18, 24, 10);
    const cut = F(I(base, { hip: [28, 35], sh: [32, 27], fb: [21, 46], ff: [36, 46], hb: [26, 32], hf: [38, 33], w: 40, f: 1, scarf: 2 }));
    arc(cut, 34, 28, 12, -70, 50, 'w', 2);
    const back = F(I(base, { hip: [22, 36], sh: [24, 27], fb: [16, 46], ff: [29, 46], hb: [19, 33], hf: [30, 32], w: 120 }));
    rows.attack = [low, dash, cut, back];

    const hi = F(I(base, { hip: [27, 35], sh: [31, 27], fb: [21, 46], ff: [35, 46], hb: [25, 31], hf: [37, 24], w: -60, scarf: 2 }));
    arc(hi, 33, 26, 12, -110, -10, 'w', 2);
    const lo = F(I(base, { hip: [28, 36], sh: [32, 28], fb: [21, 46], ff: [36, 46], hb: [26, 33], hf: [38, 35], w: 50, f: 1, scarf: 2 }));
    arc(lo, 34, 30, 12, 10, 100, 'w', 2);
    rows.special = [dash, hi, lo, back];

    const fade1 = recolor(dissolve(idle0, 0.4), (c) => (c === 'k' ? 'k' : c === 'r' || c === 'R' ? 'm' : 'K'));
    const fade2 = dissolve(fade1, 0.8);
    [[14, 30], [22, 24], [30, 34], [18, 40]].forEach(([x, y]) => sparkle(fade2, x, y, 'V'));
    const appear = grid(48, 48);
    overlay(appear, ghost(dash), -12, 0); overlay(appear, ghost(dash), -6, 0); overlay(appear, dash);
    const shadowCut = clone(cut); arc(shadowCut, 34, 28, 14, -80, 60, 'V', 2);
    rows.shadow = [fade1, fade2, appear, shadowCut];

    const dodge = (dx, ghosts) => {
      const g = grid(48, 48);
      ghosts.forEach((gx) => overlay(g, ghost(idle0), gx, 0));
      overlay(g, idle0, dx, 0);
      speedLines(g, 44 + dx, 28, 8);
      return g;
    };
    rows.dodge = [dodge(-6, [0]), dodge(-10, [-3, 0]), dodge(-4, [])];

    const watch = F(I(base, { glint: true, f: 1 }));
    sparkle(watch, 36, 20, 'Y', true);
    rows.counter = [watch, dash, cut, back];

    const cheer = F(I(base, { hip: [21, 34], sh: [22, 24], fb: [17, 46], ff: [26, 46], hb: [16, 30], hf: [27, 18], w: -75, eyes: 'happy', scarf: 3 }));
    const cheer2 = F(I(base, { hip: [21, 34], sh: [22, 24], fb: [17, 46], ff: [26, 46], hb: [16, 30], hf: [27, 18], w: -75, eyes: 'happy', scarf: 4, f: 1 }));
    sparkle(cheer2, 33, 8, 'Y');
    rows.victory = [cheer, cheer2];
  }
  return rows;
}

/* ----------------------------------------------------------------- enemies */

// Each draw(p) returns an un-outlined art grid. p = { mode, f, angry }.
const ENEMY_ART = {
  slime: { w: 30, h: 22, draw() {
    const g = grid(30, 22);
    oval(g, 1, 2, 28, 24, 'G');
    oval(g, 2, 2, 26, 19, 'e');
    oval(g, 6, 5, 7, 4, 'l'); px(g, 7, 6, 'W'); px(g, 8, 6, 'W');
    rect(g, 10, 10, 2, 4, 'k'); rect(g, 17, 10, 2, 4, 'k'); px(g, 10, 10, 'W'); px(g, 17, 10, 'W');
    px(g, 12, 16, 'k'); rect(g, 13, 17, 3, 1, 'k'); px(g, 16, 16, 'k');
    px(g, 8, 14, 'q'); px(g, 20, 14, 'q');
    return g;
  } },

  bat: { w: 30, h: 26, float: true, draw({ f }) {
    const g = grid(30, 26);
    if (f % 2 === 0) {
      poly(g, [[13, 10], [3, 1], [0, 9], [3, 8], [5, 13], [8, 11], [10, 15]], 'v');
      line(g, 12, 10, 3, 3, 'P');
    } else {
      poly(g, [[13, 11], [2, 12], [2, 19], [5, 16], [7, 20], [10, 16], [12, 18]], 'v');
      line(g, 12, 12, 3, 16, 'P');
    }
    poly(g, [[10, 4], [11, 0], [14, 5]], 'v');
    mirror(g);
    oval(g, 9, 4, 12, 13, 'v'); oval(g, 11, 9, 8, 7, 'V');
    rect(g, 11, 8, 3, 3, 'y'); rect(g, 16, 8, 3, 3, 'y'); px(g, 11, 9, 'k'); px(g, 16, 9, 'k');
    px(g, 13, 13, 'W'); px(g, 16, 13, 'W');
    return g;
  } },

  mushroom: { w: 26, h: 28, draw() {
    const g = grid(26, 28);
    rect(g, 7, 13, 12, 13, 'j'); rect(g, 7, 13, 3, 13, 'n');
    rect(g, 6, 25, 5, 3, 'b'); rect(g, 15, 25, 5, 3, 'b');
    oval(g, 0, 0, 26, 28, 'R'); rect(g, 0, 14, 26, 14, '');
    oval(g, 0, 0, 26, 25, 'r');
    rect(g, 0, 13, 26, 15, '');
    rect(g, 7, 13, 12, 12, 'j'); rect(g, 7, 13, 2, 12, 'n');
    line(g, 2, 12, 23, 12, 'R');
    oval(g, 4, 4, 5, 4, 'w'); oval(g, 16, 2, 4, 3, 'w'); oval(g, 12, 7, 3, 3, 'w'); px(g, 21, 8, 'w');
    rect(g, 10, 16, 2, 3, 'k'); rect(g, 15, 16, 2, 3, 'k');
    px(g, 9, 20, 'q'); px(g, 18, 20, 'q'); rect(g, 12, 21, 3, 1, 'k');
    rect(g, 6, 25, 5, 3, 'b'); rect(g, 15, 25, 5, 3, 'b');
    return g;
  } },

  goblin: { w: 28, h: 32, draw({ mode, f }) {
    const g = grid(28, 32);
    poly(g, [[7, 8], [0, 4], [2, 10], [7, 13]], 'e'); px(g, 3, 8, 'G'); px(g, 4, 9, 'G');
    oval(g, 5, 2, 18, 15, 'e');
    oval(g, 7, 3, 7, 3, 'l');
    poly(g, [[8, 17], [14, 17], [14, 28], [6, 28]], 'b');
    rect(g, 6, 23, 8, 2, 'B');
    rect(g, 9, 28, 4, 3, 'G'); rect(g, 8, 30, 5, 2, 'B');
    line(g, 20, 19, 24, 24, 'e', 3);
    mirror(g);
    rect(g, 8, 8, 4, 3, 'y'); rect(g, 16, 8, 4, 3, 'y'); px(g, 8, 9, 'k'); px(g, 9, 9, 'k'); px(g, 16, 9, 'k'); px(g, 17, 9, 'k');
    line(g, 7, 7, 11, 7, 'G'); line(g, 16, 7, 20, 7, 'G');
    rect(g, 9, 13, 10, 2, 'k'); px(g, 10, 13, 'W'); px(g, 17, 13, 'W');
    px(g, 17, 24, 'y');
    const up = mode === 'attack' && f === 1;
    line(g, 7, 19, 3, up ? 14 : 23, 'e', 3);
    if (up) { line(g, 3, 14, 6, 1, 'b', 3); oval(g, 3, -2, 7, 7, 'n'); }
    else { line(g, 3, 25, 1, 11, 'b', 3); oval(g, -1, 6, 6, 8, 'n'); px(g, 1, 8, 'B'); px(g, 3, 11, 'B'); }
    return g;
  } },

  wolf: { w: 42, h: 28, split: 20, draw({ f, mode }) {
    const g = grid(42, 28);
    if (f % 2 === 0) poly(g, [[34, 12], [41, 3], [41, 9], [37, 16]], 'x');
    else poly(g, [[34, 12], [41, 7], [40, 13], [36, 16]], 'x');
    rect(g, 32, 19, 3, 8, 'z'); rect(g, 17, 19, 3, 8, 'z');
    oval(g, 10, 8, 28, 14, 'x');
    oval(g, 14, 15, 18, 6, 'X');
    rect(g, 28, 19, 4, 8, 'x'); rect(g, 13, 19, 4, 8, 'x');
    rect(g, 27, 26, 6, 2, 'z'); rect(g, 12, 26, 6, 2, 'z');
    poly(g, [[12, 8], [20, 6], [26, 9], [12, 14]], 'z');
    oval(g, 3, 4, 14, 12, 'x');
    const open = mode === 'attack';
    poly(g, [[0, 9], [6, 8], [7, 13], [0, 12]], 'X');
    if (open) { poly(g, [[0, 14], [7, 13], [6, 17], [1, 16]], 'X'); line(g, 1, 13, 6, 13, 'R'); px(g, 2, 14, 'W'); px(g, 5, 14, 'W'); }
    else { line(g, 1, 13, 6, 13, 'k'); px(g, 3, 14, 'W'); }
    px(g, 0, 9, 'k');
    poly(g, [[9, 5], [11, 0], [13, 5]], 'x'); px(g, 11, 3, 'z');
    poly(g, [[5, 5], [7, 0], [9, 5]], 'x');
    rect(g, 6, 8, 2, 2, 'y'); px(g, 6, 8, 'k');
    line(g, 5, 7, 8, 7, 'z');
    line(g, 16, 9, 28, 8, 'X');
    return g;
  } },

  skeleton: { w: 26, h: 36, draw({ mode, f }) {
    const g = grid(26, 36);
    oval(g, 6, 0, 14, 12, 'j');
    rect(g, 8, 9, 10, 4, 'j');
    rect(g, 8, 4, 4, 4, 'k');
    px(g, 12, 8, 'k');
    rect(g, 12, 13, 2, 16, 'j');
    [16, 18, 20, 22].forEach((y) => line(g, 7, y, 12, y, 'j'));
    rect(g, 8, 27, 6, 3, 'j');
    line(g, 10, 30, 9, 34, 'j', 2); rect(g, 7, 34, 4, 2, 'j');
    line(g, 20, 16, 23, 25, 'j', 2);
    mirror(g);
    [9, 11, 14, 16].forEach((x) => px(g, x, 11, 'k'));
    px(g, 10, 6, 'r'); px(g, 15, 6, 'r');
    const up = mode === 'attack' && f === 1;
    line(g, 6, 16, 3, up ? 12 : 25, 'j', 2);
    if (up) line(g, 3, 12, 8, 0, 's', 2); else line(g, 3, 24, 1, 10, 's', 2);
    if (up) rect(g, 1, 12, 5, 1, 'b'); else rect(g, 0, 24, 5, 1, 'b');
    return g;
  } },

  shieldGoblin: { w: 34, h: 34, draw({ mode }) {
    const g = grid(34, 34);
    poly(g, [[31, 8], [34, 4], [33, 11]], 'e');
    oval(g, 11, 4, 18, 14, 'e');
    oval(g, 10, 1, 20, 10, 's'); rect(g, 10, 7, 20, 4, ''); rect(g, 10, 6, 20, 2, 'S'); oval(g, 13, 7, 14, 11, 'e');
    px(g, 15, 3, 'i'); px(g, 16, 3, 'i');
    rect(g, 14, 10, 3, 3, 'y'); rect(g, 22, 10, 3, 3, 'y'); px(g, 14, 11, 'k'); px(g, 22, 11, 'k');
    rect(g, 16, 15, 8, 2, 'k'); px(g, 17, 15, 'W'); px(g, 22, 15, 'W');
    poly(g, [[13, 18], [27, 18], [29, 29], [11, 29]], 'b'); rect(g, 11, 25, 18, 2, 'B');
    rect(g, 14, 29, 4, 3, 'G'); rect(g, 22, 29, 4, 3, 'G'); rect(g, 13, 31, 5, 3, 'B'); rect(g, 22, 31, 5, 3, 'B');
    line(g, 28, 19, 31, 25, 'e', 3); line(g, 31, 26, 31, 16, 's', 2);
    const up = mode === 'guard' ? -5 : 0, fx = mode === 'guard' ? 3 : 0;
    poly(g, [[0 + fx, 11 + up], [15 + fx, 11 + up], [15 + fx, 26 + up], [8 + fx, 33 + up], [0 + fx, 26 + up]], 'y');
    poly(g, [[1 + fx, 12 + up], [14 + fx, 12 + up], [14 + fx, 25 + up], [8 + fx, 31 + up], [1 + fx, 25 + up]], 'u');
    poly(g, [[1 + fx, 12 + up], [5 + fx, 12 + up], [5 + fx, 27 + up], [1 + fx, 25 + up]], 'D');
    oval(g, 5 + fx, 16 + up, 6, 6, 'i'); px(g, 7 + fx, 18 + up, 'W');
    if (mode === 'guard') { px(g, 12 + fx, 13 + up, 'W'); px(g, 13 + fx, 14 + up, 'W'); }
    return g;
  } },

  healer: { w: 30, h: 40, draw({ mode, f }) {
    const g = grid(30, 40);
    poly(g, [[10, 15], [21, 15], [27, 39], [4, 39]], 'e');
    poly(g, [[10, 15], [13, 15], [9, 39], [4, 39]], 'G');
    rect(g, 4, 37, 24, 2, 'l'); line(g, 16, 18, 16, 36, 'l');
    oval(g, 7, 2, 17, 16, 'n');
    poly(g, [[15, 0], [18, 3], [12, 3]], 'n');
    oval(g, 10, 6, 11, 10, 'e');
    rect(g, 12, 9, 2, 2, 'y'); rect(g, 17, 9, 2, 2, 'y'); px(g, 12, 9, 'k'); px(g, 17, 9, 'k');
    rect(g, 14, 13, 3, 1, 'G');
    [[8, 3], [12, 1], [19, 1], [23, 3]].forEach(([x, y]) => { px(g, x, y, 'l'); px(g, x, y + 1, 'e'); });
    const lift = mode === 'cast' ? -4 : 0;
    line(g, 4, 39, 4, 10 + lift, 'b', 2);
    line(g, 7, 20, 4, 24 + lift, 'n', 2);
    const cy = 6 + lift;
    oval(g, 0, cy - 4, 9, 9, 'y');
    rect(g, 3, cy - 3, 3, 7, 'l'); rect(g, 1, cy - 1, 7, 3, 'l');
    px(g, 4, cy, mode === 'cast' ? 'W' : 'Y');
    if (mode === 'cast') { sparkle(g, 10, cy - 2 + (f % 2), 'l'); sparkle(g, 1, cy + 8, 'l'); }
    return g;
  } },

  golem: { w: 46, h: 50, split: 38, draw({ mode, f, angry }) {
    const g = grid(46, 50);
    const eye = mode === 'charge' ? (f % 2 ? 'W' : 'Y') : mode === 'tired' ? 'z' : angry ? 'o' : 'y';
    const crack = mode === 'charge' ? (f % 2 ? 'y' : 'o') : 'z';
    const fistY = mode === 'charge' ? 18 : mode === 'attack' && f >= 1 ? 38 : mode === 'tired' ? 36 : 33;
    rect(g, 12, 38, 9, 12, 'x'); rect(g, 25, 38, 9, 12, 'x'); rect(g, 12, 38, 2, 12, 'z'); rect(g, 25, 38, 2, 12, 'z');
    rect(g, 10, 47, 12, 3, 'z'); rect(g, 24, 47, 12, 3, 'z');
    poly(g, [[8, 13], [38, 13], [35, 40], [11, 40]], 'x');
    rect(g, 12, 15, 16, 4, 'X'); poly(g, [[33, 14], [38, 13], [35, 40], [31, 40]], 'z');
    rect(g, 17, 4, 12, 11, 'x'); rect(g, 17, 4, 12, 3, 'X'); rect(g, 17, 12, 12, 1, 'z');
    rect(g, 19, 8, 3, 2, eye); rect(g, 25, 8, 3, 2, eye);
    line(g, 15, 22, 20, 27, crack); line(g, 20, 27, 18, 33, crack); line(g, 29, 20, 26, 26, crack); line(g, 26, 26, 30, 31, crack);
    oval(g, 20, 24, 6, 6, crack === 'z' ? 'x' : crack); px(g, 22, 26, crack === 'z' ? 'X' : 'W');
    oval(g, 0, 11, 13, 12, 'x'); oval(g, 33, 11, 13, 12, 'x');
    rect(g, 3, 13, 5, 3, 'G'); rect(g, 37, 12, 5, 2, 'G'); px(g, 4, 12, 'e'); px(g, 38, 11, 'e');
    const armTop = 20;
    rect(g, 2, armTop, 9, fistY - armTop, 'x'); rect(g, 35, armTop, 9, fistY - armTop, 'x');
    rect(g, 2, armTop, 2, fistY - armTop, 'z'); rect(g, 35, armTop, 2, fistY - armTop, 'z');
    oval(g, 0, fistY - 2, 13, 11, 'X'); oval(g, 33, fistY - 2, 13, 11, 'X');
    rect(g, 2, fistY + 5, 9, 2, 'x'); rect(g, 35, fistY + 5, 9, 2, 'x');
    if (mode === 'attack' && f >= 1) { [[0, 47], [6, 46], [40, 47], [45, 46]].forEach(([x, y]) => sparkle(g, x, y, 'X')); }
    return g;
  } },

  goblinCaptain: { w: 36, h: 42, draw({ mode, f }) {
    const g = grid(36, 42);
    poly(g, [[10, 15], [26, 15], [33, 41], [3, 41]], 'R');
    poly(g, [[10, 16], [26, 16], [25, 34], [11, 34]], 's');
    line(g, 12, 17, 12, 33, 'i'); poly(g, [[22, 16], [26, 16], [25, 34], [22, 34]], 'S');
    rect(g, 11, 31, 14, 3, 'B'); px(g, 18, 32, 'y');
    rect(g, 12, 34, 5, 6, 'G'); rect(g, 20, 34, 5, 6, 'G'); rect(g, 11, 39, 7, 3, 'B'); rect(g, 19, 39, 7, 3, 'B');
    poly(g, [[27, 9], [35, 5], [32, 12]], 'e');
    oval(g, 9, 3, 18, 15, 'e');
    oval(g, 8, 0, 20, 10, 's'); rect(g, 8, 6, 20, 5, ''); rect(g, 8, 5, 20, 2, 'S'); oval(g, 11, 6, 14, 11, 'e');
    poly(g, [[10, 3], [4, -2], [6, 1], [9, 6]], 'j'); poly(g, [[26, 3], [32, -2], [30, 1], [27, 6]], 'j');
    line(g, 12, 8, 15, 9, 'G'); line(g, 21, 9, 24, 8, 'G');
    rect(g, 12, 9, 3, 3, 'y'); rect(g, 21, 9, 3, 3, 'y'); px(g, 12, 10, 'k'); px(g, 21, 10, 'k');
    rect(g, 13, 14, 10, 2, 'k'); px(g, 14, 13, 'W'); px(g, 21, 13, 'W');
    line(g, 26, 18, 30, 26, 'e', 3);
    const raised = mode === 'charge' || (mode === 'attack' && f === 1);
    line(g, 10, 18, 5, raised ? 12 : 26, 'e', 3);
    if (raised) {
      poly(g, [[3, 10], [8, 10], [12, -4], [5, -2]], 'i'); line(g, 8, 10, 12, -3, 'S');
      rect(g, 2, 10, 7, 2, 'y');
      if (mode === 'charge') { sparkle(g, 12, -1 + f, 'o'); sparkle(g, 2, 4 - f, 'o'); }
    } else {
      poly(g, [[2, 4], [7, 2], [8, 24], [3, 24]], 'i'); line(g, 7, 3, 8, 23, 'S');
      rect(g, 2, 24, 7, 2, 'y'); rect(g, 4, 26, 3, 3, 'B');
    }
    return g;
  } },

  necromancer: { w: 34, h: 48, draw({ mode, f }) {
    const g = grid(34, 48);
    poly(g, [[10, 15], [24, 15], [31, 47], [3, 47]], 'P');
    poly(g, [[10, 15], [13, 15], [8, 47], [3, 47]], 'K');
    rect(g, 3, 45, 29, 2, 'v'); line(g, 17, 18, 17, 44, 'K');
    poly(g, [[17, 0], [26, 9], [27, 19], [7, 19], [8, 9]], 'P'); poly(g, [[17, 0], [20, 3], [9, 12], [8, 9]], 'v');
    oval(g, 11, 8, 12, 10, 'k');
    const eye = mode === 'cast' ? 'Y' : 'l';
    rect(g, 13, 12, 2, 1, eye); rect(g, 19, 12, 2, 1, eye);
    rect(g, 24, 27, 3, 3, 'j');
    const lift = mode === 'cast' ? -5 : 0;
    line(g, 4, 47, 4, 10 + lift, 'B', 2);
    line(g, 10, 22, 5, 26 + lift, 'P', 3); rect(g, 4, 25 + lift, 3, 3, 'j');
    oval(g, 1, 3 + lift, 8, 8, 'j'); px(g, 3, 6 + lift, 'k'); px(g, 6, 6 + lift, 'k'); rect(g, 3, 9 + lift, 4, 1, 'k');
    const orb = mode === 'cast' ? 'M' : 'V';
    oval(g, 2, -1 + lift, 6, 5, orb === 'M' ? 'm' : 'v'); px(g, 4, 0 + lift, orb);
    if (mode === 'cast') { sparkle(g, 11, 2 + lift + (f % 2), 'V'); sparkle(g, 0, 14 + lift, 'V'); sparkle(g, 9, -2 + lift, 'M'); }
    return g;
  } },

  dragon: { w: 88, h: 70, split: 52, angryMap: { r: 'R', q: 'r', y: 'Y', o: 'y' }, draw({ mode, f, angry }) {
    const g = grid(88, 70);
    const lift = mode === 'charge' ? -6 : 0;
    const wingUp = angry ? -6 : 0;
    poly(g, [[42, 30], [50, 2 + wingUp], [60, 10 + wingUp], [72, 2 + wingUp], [72, 24], [60, 32]], 'R');
    line(g, 50, 3 + wingUp, 50, 30, 'r'); line(g, 60, 11 + wingUp, 58, 30, 'r'); line(g, 71, 4 + wingUp, 66, 27, 'r');
    line(g, 66, 50, 80, 55, 'r', 6); line(g, 80, 55, 85, 44, 'r', 4);
    poly(g, [[83, 36], [88, 43], [81, 46]], 'y');
    rect(g, 62, 52, 7, 12, 'R'); rect(g, 60, 62, 11, 5, 'R');
    oval(g, 32, 28, 40, 30, 'r');
    oval(g, 35, 41, 26, 15, 'y');
    [44, 47, 50, 53].forEach((y) => line(g, 37, y, 58, y, 'o'));
    rect(g, 54, 50, 9, 14, 'r'); rect(g, 52, 62, 12, 5, 'r'); [52, 55, 58].forEach((x) => px(g, x, 66, 'w'));
    rect(g, 38, 52, 8, 12, 'r'); rect(g, 35, 62, 11, 5, 'r'); [35, 38, 41].forEach((x) => px(g, x, 66, 'w'));
    rect(g, 38, 52, 2, 12, 'R');
    poly(g, [[36, 38], [46, 34], [30, 16 + lift], [21, 20 + lift]], 'r');
    poly(g, [[34, 42], [38, 40], [25, 22 + lift], [22, 25 + lift]], 'y');
    const hy = lift;
    poly(g, [[4, 16 + hy], [14, 10 + hy], [26, 10 + hy], [30, 16 + hy], [28, 24 + hy], [14, 25 + hy], [4, 22 + hy]], 'r');
    line(g, 6, 15 + hy, 16, 11 + hy, 'q');
    const open = mode === 'attack' || mode === 'charge';
    if (open) {
      poly(g, [[4, 21 + hy], [24, 22 + hy], [22, 29 + hy], [8, 27 + hy]], 'r');
      poly(g, [[6, 21 + hy], [22, 22 + hy], [20, 25 + hy], [8, 24 + hy]], mode === 'charge' ? 'o' : 'R');
      [7, 10, 13, 16].forEach((x) => px(g, x, 21 + hy, 'w'));
    } else {
      line(g, 6, 21 + hy, 24, 21 + hy, 'R');
      [8, 12, 16].forEach((x) => px(g, x, 22 + hy, 'w'));
    }
    poly(g, [[21, 11 + hy], [33, 1 + hy], [27, 13 + hy]], 'j'); poly(g, [[16, 10 + hy], [24, 0 + hy], [21, 11 + hy]], 'j');
    rect(g, 16, 14 + hy, 4, 3, angry ? 'Y' : 'y'); px(g, 16, 15 + hy, 'k'); line(g, 15, 13 + hy, 21, 12 + hy, 'R');
    px(g, 5, 17 + hy, 'k');
    [[30, 18], [34, 23], [40, 28], [48, 28], [56, 29], [64, 32]].forEach(([x, y], i) => poly(g, [[x, y + (i < 2 ? lift : 0)], [x + 3, y - 4 + (i < 2 ? lift : 0)], [x + 4, y + 1 + (i < 2 ? lift : 0)]], 'y'));
    if (angry) {
      [[44, 22], [56, 24], [68, 28], [76, 40], [30, 30], [84, 30]].forEach(([x, y], i) => {
        const h = 4 + ((i + f) % 2) * 3;
        poly(g, [[x - 2, y + h], [x, y], [x + 2, y + h]], 'o'); px(g, x, y + h - 1, 'y');
      });
    }
    if (mode === 'charge') {
      const smoke = f % 2 ? [[2, 6], [6, 2], [0, 0]] : [[4, 4], [8, 0], [1, 2]];
      smoke.forEach(([x, y]) => oval(g, x, y + hy - 2, 4, 3, 'X'));
      sparkle(g, 3, 25 + hy, 'y'); sparkle(g, 10, 29 + hy, 'o');
    }
    return g;
  } },

  demonKing: { w: 64, h: 76, split: 62, angryMap: { v: 'm', P: 'R' }, draw({ mode, f, angry }) {
    const g = grid(64, 76);
    poly(g, [[20, 20], [32, 18], [32, 75], [2, 75], [8, 40]], 'K');
    poly(g, [[8, 44], [12, 44], [9, 75], [2, 75]], angry ? 'r' : 'R');
    poly(g, [[22, 26], [32, 24], [32, 62], [21, 62]], 'z'); line(g, 23, 28, 23, 58, 'x');
    rect(g, 21, 50, 11, 3, 'y'); poly(g, [[21, 53], [32, 53], [32, 64], [18, 64]], 'P');
    rect(g, 24, 64, 6, 10, 'z'); rect(g, 22, 72, 9, 3, 'k');
    oval(g, 13, 20, 15, 11, 'P'); poly(g, [[15, 22], [9, 13], [19, 20]], 'j'); px(g, 17, 22, 'V');
    line(g, 17, 30, 16, 43, 'P', 4); oval(g, 13, 42, 7, 6, 'v');
    oval(g, 22, 6, 20, 19, 'v');
    poly(g, [[24, 12], [16, 9], [11, 0], [17, 4], [26, 8]], 'j');
    rect(g, 23, 4, 18, 3, 'y'); poly(g, [[23, 4], [25, -1], [27, 4]], 'y'); poly(g, [[29, 4], [32, -3], [35, 4]], 'y');
    px(g, 32, 1, 'r');
    mirror(g);
    const eye = angry ? 'Y' : 'r';
    poly(g, [[25, 13], [30, 14], [30, 16], [25, 15]], eye); poly(g, [[38, 13], [33, 14], [33, 16], [38, 15]], eye);
    line(g, 24, 12, 29, 13, 'P'); line(g, 39, 12, 34, 13, 'P');
    rect(g, 27, 19, 10, 2, 'k'); px(g, 28, 21, 'W'); px(g, 35, 21, 'W');
    const orb = mode === 'charge' || mode === 'cast';
    oval(g, 10, 36, 10, 10, orb ? 'M' : 'V'); px(g, 13, 39, 'W');
    if (orb) { sparkle(g, 8, 34 - f, 'M'); sparkle(g, 21, 36 + f, 'V'); }
    if (angry) [[4, 14], [58, 14], [2, 30], [61, 30], [16, 2], [47, 2]].forEach(([x, y], i) => sparkle(g, x, y + ((f + i) % 2), i % 2 ? 'M' : 'V', true));
    return g;
  } },

  giantGolem: { w: 80, h: 80, split: 60, angryMap: { x: 'z', X: 'x', z: 'K' }, draw({ mode, f, angry }) {
    const g = grid(80, 80);
    const core = mode === 'charge' ? (f % 2 ? 'Y' : 'o') : mode === 'tired' ? 'T' : angry ? 'o' : 't';
    const crack = mode === 'charge' ? (f % 2 ? 'y' : 'o') : angry ? 'o' : 'z';
    const eye = mode === 'charge' ? 'W' : mode === 'tired' ? 'z' : angry ? 'r' : 'c';
    const fistY = mode === 'charge' ? 38 : mode === 'attack' && f >= 1 ? 62 : mode === 'tired' ? 60 : 54;
    rect(g, 22, 60, 13, 19, 'x'); rect(g, 22, 60, 3, 19, 'z'); rect(g, 19, 76, 17, 4, 'z');
    poly(g, [[14, 20], [40, 17], [40, 62], [18, 62]], 'x');
    rect(g, 18, 22, 14, 5, 'X'); line(g, 15, 22, 18, 60, 'z');
    rect(g, 32, 7, 8, 12, 'x'); rect(g, 32, 7, 8, 3, 'X'); rect(g, 32, 16, 8, 1, 'z');
    rect(g, 34, 12, 4, 2, eye);
    line(g, 22, 34, 28, 42, crack); line(g, 28, 42, 24, 52, crack);
    oval(g, 1, 14, 24, 21, 'x'); oval(g, 4, 15, 12, 7, 'X');
    rect(g, 4, 13, 10, 4, 'G'); rect(g, 7, 12, 4, 2, 'e'); rect(g, 30, 17, 6, 2, 'G'); px(g, 32, 16, 'e');
    rect(g, 4, 32, 15, fistY - 32, 'x'); rect(g, 4, 32, 4, fistY - 32, 'z');
    oval(g, 0, fistY - 3, 22, 17, 'X'); rect(g, 3, fistY + 7, 16, 3, 'x'); line(g, 7, fistY + 1, 7, fistY + 5, 'x'); line(g, 12, fistY + 1, 12, fistY + 5, 'x');
    mirror(g);
    poly(g, [[40, 28], [47, 37], [40, 47], [33, 37]], 'z');
    poly(g, [[40, 30], [45, 37], [40, 45], [35, 37]], core); px(g, 38, 34, 'W'); px(g, 39, 33, 'W');
    if (mode === 'charge') [[26, 30], [54, 30], [40, 22]].forEach(([x, y]) => sparkle(g, x, y + f, 'o'));
    if (mode === 'attack' && f >= 1) [[0, 78], [10, 76], [70, 76], [79, 78]].forEach(([x, y]) => sparkle(g, x, y, 'X', true));
    return g;
  } },

  vampireLord: { w: 64, h: 76, split: 62, angryMap: { K: 'R', z: 'K' }, draw({ mode, f, angry }) {
    const g = grid(64, 76);
    const spread = angry ? 6 : 0;
    poly(g, [[10, 24], [32, 20], [32, 76], [0 - spread, 76], [4 - spread, 44]], 'K');
    if (angry) [[0, 76], [6, 70], [12, 76]].forEach(([x, y]) => px(g, x, y, ''));
    poly(g, [[12, 30], [24, 28], [22, 76], [6 - spread, 76]], angry ? 'r' : 'R');
    poly(g, [[13, 8], [22, 17], [23, 30], [10, 27]], 'K'); poly(g, [[15, 11], [21, 18], [21, 27], [13, 25]], 'R');
    poly(g, [[23, 26], [32, 26], [32, 70], [22, 70]], 'z'); poly(g, [[26, 28], [32, 28], [32, 50], [27, 50]], 'P');
    rect(g, 29, 26, 3, 8, 'W');
    rect(g, 24, 64, 6, 11, 'z'); rect(g, 23, 73, 9, 3, 'k');
    line(g, 20, 30, 17, 45, 'K', 4); rect(g, 15, 44, 5, 4, 'w'); px(g, 15, 48, 'w'); px(g, 18, 48, 'w');
    oval(g, 24, 4, 16, 21, 'w'); rect(g, 24, 15, 3, 7, 'X');
    poly(g, [[25, 12], [20, 7], [25, 16]], 'w');
    oval(g, 24, 2, 16, 8, 'k'); rect(g, 26, 7, 6, 3, 'w'); poly(g, [[27, 6], [32, 6], [32, 10]], 'k');
    rect(g, 24, 6, 2, 6, 'k'); px(g, 27, 3, 'z'); px(g, 28, 3, 'z');
    mirror(g);
    rect(g, 30, 26, 4, 3, 'r'); px(g, 32, 29, 'R');
    const eye = angry || mode === 'charge' ? 'Y' : 'r';
    rect(g, 27, 13, 3, 2, eye); rect(g, 34, 13, 3, 2, eye);
    line(g, 26, 12, 29, 12, 'K'); line(g, 35, 12, 38, 12, 'K');
    rect(g, 29, 20, 6, 1, 'R'); px(g, 29, 21, 'W'); px(g, 34, 21, 'W');
    if (mode === 'charge' || mode === 'cast') { oval(g, 12, 36, 8, 8, 'R'); oval(g, 13, 37, 5, 5, 'r'); px(g, 14, 38, 'W'); sparkle(g, 10, 34 + f, 'r'); }
    if (angry) [[2, 20], [60, 20], [4, 36], [59, 36]].forEach(([x, y], i) => sparkle(g, x, y + ((f + i) % 2), 'r'));
    return g;
  } },
};

/* ---------------------------------------------------------- sheet building */

const PAD_L = 8, PAD_R = 4, PAD_T = 4;

function withShadow(frame, fw, fh, width) {
  const out = grid(fw, fh);
  const w = Math.max(10, Math.round(width));
  oval(out, Math.round((fw - w) / 2), fh - 3, w, 3, '_');
  return overlay(out, frame);
}

function tiredMark(g, f) {
  let top = g.h;
  for (let i = 0; i < g.d.length; i += 1) if (g.d[i]) { top = Math.floor(i / g.w); break; }
  const x = g.w - 10, y = Math.max(0, top - 2 - f);
  stamp(g, ['UUU', '..U', '.U.', 'UUU'], x, y);
  if (f) stamp(g, ['UU', '.U', 'UU'], x + 4, y - 3);
  return g;
}

function enemyRows(spec, angry) {
  const fw = spec.w + PAD_L + PAD_R, fh = spec.h + PAD_T;
  const split = PAD_T + (spec.split ?? spec.h);
  const make = (mode, f = 0) => {
    const g = grid(fw, fh);
    const art = spec.draw({ mode, f, angry });
    overlay(g, angry && spec.angryMap ? recolor(art, spec.angryMap) : art, PAD_L, PAD_T);
    return outline(g, 'k');
  };
  const b = make('idle', 0);
  const idle1 = spec.float ? shift(make('idle', 1), 0, -1) : (spec.id === 'wolf' ? squash(make('idle', 1), split, 1) : squash(b, split, 1));
  const atk1 = make('attack', 1), atk2 = make('attack', 2);
  const tired0 = recolor(squash(make('tired', 0), split, 2), DIM);
  const flash = recolor(b, FLASH);
  const rows = {
    idle: [b, idle1],
    attack: [shift(b, 2, 0), shift(atk1, -4, 0), shift(atk2, -7, 0), shift(b, -2, 0)],
    guard: [make('guard'), make('guard')],
    cast: [make('cast', 0), shift(make('cast', 1), 0, -1), shift(make('cast', 1), 0, -2), make('cast', 0)],
    dodge: [shift(b, 4, 0), shift(b, 6, 0), shift(b, 2, 0)],
    hit: [flash, shift(b, 3, 0), shift(b, 1, 0)],
    charge: [make('charge', 0), squash(make('charge', 1), split, 1)],
    defeat: [flash, dissolve(shift(b, 0, 1), 0.35), dissolve(shift(b, 0, 2), 0.65), dissolve(shift(b, 0, 3), 0.9)],
    broken: [flash, shift(tired0, 4, 0), shift(tired0, 2, 0)],
    enraged: [flash, b],
    tired: [tiredMark(clone(tired0), 0), tiredMark(recolor(squash(make('tired', 0), split, 3), DIM), 1)],
  };
  rows.special = rows.attack; rows.counter = rows.attack; rows.shadow = rows.attack;
  rows.victory = rows.idle; rows.heal = rows.cast.slice(0, 3); rows.barrier = rows.guard;
  return { rows, fw, fh, shadowW: spec.w * (spec.float ? 0.45 : 0.75) };
}

function heroRowsFor(id) {
  const rows = heroFrames(id);
  const idle = rows.idle;
  const fallback = {
    attack: rows.cast || rows.attack, special: rows.attack, guard: rows.barrier || rows.dodge?.slice(0, 2) || idle,
    cast: rows.attack, dodge: rows.guard || idle, charge: idle, victory: idle, broken: rows.hit, enraged: idle,
    tired: idle, heal: rows.cast || rows.special, barrier: rows.guard || idle, counter: rows.attack, shadow: rows.special,
  };
  const out = {};
  ROWS.forEach((row) => { out[row] = rows[row] || fallback[row] || idle; });
  return { rows: out, fw: 48, fh: 48, shadowW: 20 };
}

Object.entries(ENEMY_ART).forEach(([id, spec]) => { spec.id = id; });

export const HERO_IDS = Object.freeze(['fighter', 'mage', 'ninja']);
export const ENEMY_IDS = Object.freeze(Object.keys(ENEMY_ART));

const built = new Map();

/** Sprite sheet for a character; variant 'enraged' gives the boss phase-2 look. */
export function spriteSheet(id, variant = '') {
  const key = `${id}:${variant}`;
  if (!built.has(key)) built.set(key, buildSheet(id, variant, key));
  return built.get(key);
}

function buildSheet(id, variant, key) {
  const isHero = HERO_IDS.includes(id);
  if (!isHero && !ENEMY_ART[id]) return null;
  const art = isHero ? heroRowsFor(id) : enemyRows(ENEMY_ART[id], variant === 'enraged');
  const rows = ROWS.map((row) => {
    const frames = art.rows[row].slice(0, FRAMES[row]);
    while (frames.length < FRAMES[row]) frames.push(frames.at(-1));
    return frames.map((frame) => withShadow(frame, art.fw, art.fh, art.shadowW));
  });
  return sheet(key, art.fw, art.fh, rows, PAL);
}
