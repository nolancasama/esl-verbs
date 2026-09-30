// Original enemies and bosses on the shaded rig. Each is drawn facing right
// with light from the top-right, then mirrored, so in battle it faces the
// heroes with the same top-left light. draw({ mode, f, angry }) returns a grid;
// modes: idle, attack, cast, guard, charge, tired (anything else falls back).
import { Painter, along, skeleton } from './pixel-rig.js';
import { flipX, recolor } from './pixel-core.js';

const lerp = (a, b, t) => a + (b - a) * t;
const pt = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const LIGHT = { lightDir: [1, -1] };

function limb(p, material, from, to, r0, r1 = r0, opts) {
  return p.shape(material, (id) => p.capsule(id, from[0], from[1], to[0], to[1], r0, r1), opts);
}
function blob(p, material, x, y, rx, ry, opts) { return p.shape(material, (id) => p.ellipse(id, x, y, rx, ry), opts); }
function poly(p, material, points, opts) { return p.shape(material, (id) => p.poly(id, points), opts); }

function sparkle(p, x, y, big = false, key = 'spark') {
  p.dot(x, y, 'white');
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => p.dot(x + dx, y + dy, key));
  if (big) [[2, 0], [-2, 0], [0, 2], [0, -2]].forEach(([dx, dy]) => p.dot(x + dx, y + dy, key));
}
function arc(p, cx, cy, r, from, to, key = 'white', width = 2, edge = 'spark') {
  const steps = Math.ceil(Math.abs(to - from) / 3);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps, a = ((from + (to - from) * t) * Math.PI) / 180;
    const thick = Math.max(1, Math.round(width * Math.sin(Math.PI * t) + 0.5));
    for (let k = 0; k < thick; k += 1) p.dot(cx + Math.cos(a) * (r - k), cy + Math.sin(a) * (r - k), k === 0 ? edge : key);
  }
}
/** A glowing eye: bright core with a coloured halo pixel. */
function glowEye(p, x, y, core = 'glow', halo = 'orange', size = 1) {
  for (let j = 0; j < size + 1; j += 1) for (let i = 0; i < size + 1; i += 1) p.dot(x + i, y + j, core);
  p.dot(x - 1, y, halo); p.dot(x + size + 1, y + size, halo);
}
/** Cartoon eye facing right: dark iris with a white glint; brow tilts when angry. */
function toonEye(p, x, y, { angry = false, h = 3, iris = 'eye', white = true } = {}) {
  for (let j = 0; j < h; j += 1) { p.dot(x, y + j, iris); p.dot(x + 1, y + j, iris); }
  if (white) p.dot(x + 1, y, 'white');
  if (angry) { p.dot(x - 1, y - 2, 'ink'); p.dot(x, y - 1, 'ink'); p.dot(x + 1, y - 1, 'ink'); p.dot(x + 2, y - 1, 'ink'); }
}
function fangs(p, x, y, n = 2, gap = 3) { for (let i = 0; i < n; i += 1) { p.dot(x + i * gap, y, 'fang'); p.dot(x + i * gap, y + 1, 'fang'); } }
function zzz(p, x, y) { p.stamp(['ZZZ', '..Z', '.Z.', 'ZZZ'], x, y, { Z: 'zzz' }); }
function smoke(p, x, y, f) { [[0, 0], [3, -3], [-2, -5]].forEach(([dx, dy], i) => { if ((i + f) % 3 !== 2) p.stamp(['.XX.', 'XXXX', '.XX.'], x + dx, y + dy - f, { X: 'speed' }); }); }

const done = (p) => flipX(p.render());

/* ------------------------------------------------------------ small foes */

function slime({ mode, f }) {
  const p = new Painter(46, 38, LIGHT);
  const lunge = mode === 'attack' ? [0, 5, 7, 2][f] : 0;
  const squash = mode === 'idle' ? [0, 1, 2, 1][f] : mode === 'attack' ? [2, -2, -2, 0][f] : mode === 'tired' ? 3 : mode === 'charge' ? -1 + (f % 2) : 0;
  const rx = 16 + squash * 0.8 + (mode === 'attack' && f === 2 ? 2 : 0), ry = 12 - squash;
  const cx = 21 + lunge, cy = 36 - ry;
  p.shape('slime', (id) => {
    p.ellipse(id, cx, cy, rx, ry);
    p.poly(id, [[cx - 2, cy - ry + 2], [cx + 3, cy - ry - 4 + squash * 0.5], [cx + 6, cy - ry + 3]]);
    p.rect(id, Math.round(cx - rx + 1), Math.round(cy + 2), Math.round(rx * 2 - 1), Math.round(ry - 2));
  }, { dark: 1, shadow: 2, dither: true, gloss: true });
  blob(p, 'slime', cx - 1, cy + 2, rx * 0.55, ry * 0.45, { level: 4, line: false });
  // glossy highlights (top-right before mirroring)
  p.stamp(['.WWW', 'WWWW', '.WW.'], Math.round(cx + rx * 0.35), Math.round(cy - ry * 0.55), { W: 'white' });
  p.dot(Math.round(cx + rx * 0.2), Math.round(cy - ry * 0.7), 'white');
  const ey = Math.round(cy - 1), ex = Math.round(cx + 3);
  if (mode === 'tired') { p.dots([[ex, ey + 1], [ex + 1, ey + 1], [ex + 5, ey + 1], [ex + 6, ey + 1]], 'ink'); zzz(p, Math.round(cx + 10), Math.round(cy - ry - 6)); }
  else { toonEye(p, ex, ey, { angry: mode === 'attack' || mode === 'charge', h: 4 }); toonEye(p, ex + 5, ey, { angry: mode === 'attack' || mode === 'charge', h: 4 }); }
  if (mode === 'attack' && f > 0) { p.stamp(['kkkk', 'krrk', '.kk.'], ex + 1, ey + 5, { k: 'ink', r: 'red' }); }
  else p.dots([[ex + 2, ey + 6], [ex + 3, ey + 7], [ex + 4, ey + 6]], 'ink');
  p.dot(ex - 2, ey + 4, 'blush'); p.dot(ex + 8, ey + 4, 'blush');
  return done(p);
}

function bat({ mode, f }) {
  const p = new Painter(54, 46, LIGHT);
  const bob = mode === 'tired' ? 6 : [0, -2, -1, 1][f % 4];
  const flap = mode === 'tired' ? 2 : f % 3; // 0 up, 1 mid, 2 down
  const cx = 26 + (mode === 'attack' ? [0, 4, 7, 2][f] : 0), cy = 20 + bob;
  const wing = (side) => {
    const s = side, tipY = [-14, -2, 10][flap], midY = [-6, 2, 8][flap];
    return [[cx + s * 4, cy - 3], [cx + s * 14, cy + tipY * 0.5 - 4], [cx + s * 24, cy + tipY], [cx + s * 21, cy + midY + 4], [cx + s * 17, cy + midY + 1], [cx + s * 14, cy + midY + 6], [cx + s * 10, cy + midY + 3], [cx + s * 6, cy + 6]];
  };
  poly(p, 'violet', wing(-1), { shadow: 2 });
  // wing bones
  poly(p, 'violet', wing(1), { shadow: 2 });
  blob(p, 'shade', cx, cy + 2, 7.5, 8.5, { dark: 1, shadow: 2, gloss: true });
  blob(p, 'violet', cx + 1, cy + 5, 4.5, 4.5, { line: false });
  poly(p, 'shade', [[cx - 6, cy - 3], [cx - 8, cy - 14], [cx - 2, cy - 5]]);
  poly(p, 'shade', [[cx + 6, cy - 3], [cx + 8, cy - 14], [cx + 2, cy - 5]]);
  p.dots([[cx - 6, cy - 10], [cx + 6, cy - 10]], 'violet4');
  if (mode === 'tired') { p.dots([[cx - 4, cy], [cx - 3, cy], [cx + 3, cy], [cx + 4, cy]], 'ink'); zzz(p, cx + 8, cy - 18); }
  else { glowEye(p, cx - 4, cy - 1, 'glow', 'red'); glowEye(p, cx + 3, cy - 1, 'glow', 'red'); }
  fangs(p, cx - 2, cy + 4, 2, 4);
  if (mode === 'attack' && f > 0) p.dots([[cx - 1, cy + 5], [cx, cy + 5], [cx + 1, cy + 5]], 'red');
  return done(p);
}

function mushroom({ mode, f }) {
  const p = new Painter(46, 52, LIGHT);
  const hop = mode === 'idle' ? [0, 1, 0, -1][f] : mode === 'attack' ? [0, -3, -1, 0][f] : 0;
  const tilt = mode === 'attack' ? [0, 3, 6, 2][f] : mode === 'tired' ? -2 : 0;
  const cx = 22 + tilt, base = 50;
  // feet
  blob(p, 'leather', cx - 5, base - 2, 3.5, 2.2); blob(p, 'leather', cx + 5, base - 2, 3.5, 2.2);
  // stalk
  p.shape('cream', (id) => p.poly(id, [[cx - 8, base - 3], [cx + 8, base - 3], [cx + 7, base - 20 + hop], [cx - 7, base - 20 + hop]]), { shadow: 2 });
  // cap
  const capY = base - 26 + hop + (mode === 'tired' ? 3 : 0);
  p.shape('mushroom', (id) => { p.ellipse(id, cx + tilt * 0.3, capY, 19, 13); }, { dark: 1, shadow: 2, gloss: true, dither: true });
  p.shape('cream', (id) => p.ellipse(id, cx + tilt * 0.3, capY + 8, 17, 4), { level: 2 });
  p.shape('mushroom', (id) => p.rect(id, Math.round(cx + tilt * 0.3 - 19), Math.round(capY + 5), 39, 3), { level: 1 });
  [[-9, -4, 4, 3], [4, -8, 5, 3.5], [11, 0, 3, 2.5], [-2, 1, 2.5, 2]].forEach(([dx, dy, rx, ry]) => blob(p, 'white', cx + tilt * 0.3 + dx, capY + dy, rx, ry, { line: false, level: 4 }));
  const ey = base - 16 + hop;
  if (mode === 'tired') { p.dots([[cx - 2, ey + 1], [cx - 1, ey + 1], [cx + 3, ey + 1], [cx + 4, ey + 1]], 'ink'); zzz(p, cx + 12, capY - 18); }
  else { toonEye(p, cx - 2, ey, { angry: mode === 'attack' || mode === 'charge' }); toonEye(p, cx + 3, ey, { angry: mode === 'attack' || mode === 'charge' }); }
  p.dots([[cx - 4, ey + 4], [cx + 6, ey + 4]], 'blush');
  p.dots([[cx, ey + 5], [cx + 1, ey + 6], [cx + 2, ey + 5]], 'ink');
  return done(p);
}

const GOBLIN_BODY = { thigh: 7, shin: 7.5, torso: 10, upperArm: 6.5, foreArm: 6.5, headLift: 9 };

function goblinHead(p, hx, hy, { angry = false, open = false, helmet = false, captain = false } = {}) {
  // long ears swept back
  poly(p, 'goblin', [[hx - 3, hy - 2], [hx - 16, hy - 8], [hx - 5, hy + 3]]);
  blob(p, 'goblin', hx, hy, 8.5, 7.5, { gloss: true });
  poly(p, 'goblin', [[hx + 6, hy - 1], [hx + 12, hy + 3], [hx + 6, hy + 4]]);
  toonEye(p, hx + 2, hy - 2, { angry: true, iris: 'glow', white: false, h: 2 });
  toonEye(p, hx + 6, hy - 2, { angry: true, iris: 'glow', white: false, h: 2 });
  p.dots([[hx + 3, hy - 1], [hx + 7, hy - 1]], 'ink');
  if (open) p.stamp(['kkkkk', 'kWrWk', '.kkk.'], Math.round(hx + 1), Math.round(hy + 3), { k: 'ink', W: 'fang', r: 'red' });
  else p.stamp(['kWkWk'], Math.round(hx + 1), Math.round(hy + 4), { k: 'ink', W: 'fang' });
  if (helmet || captain) {
    p.shape('steel', (id) => { p.ellipse(id, hx - 0.5, hy - 4, 9.5, 6); }, { gloss: true });
    p.shape('steel', (id) => p.rect(id, Math.round(hx - 9), Math.round(hy - 3), 19, 2), { level: 2 });
    if (captain) { poly(p, 'bone', [[hx - 5, hy - 7], [hx - 12, hy - 18], [hx - 2, hy - 9]]); poly(p, 'bone', [[hx + 3, hy - 9], [hx + 8, hy - 20], [hx + 6, hy - 8]]); }
    p.dot(hx + 3, hy - 7, 'white');
  }
  if (angry) p.dots([[hx + 1, hy - 5], [hx + 8, hy - 5]], 'ink');
}

function goblin({ mode, f }) {
  const p = new Painter(56, 58, LIGHT);
  const poses = {
    idle: [{}, { bob: 1 }, { bob: 1, frontFore: 40 }, {}],
    attack: [{ x: 22, lean: -8, frontUpper: 196, frontFore: 214, weapon: 240 }, { x: 26, lean: 6, frontUpper: 160, frontFore: 150, weapon: 160 }, { x: 30, lean: 16, frontUpper: 90, frontFore: 70, weapon: 70, swing: true }, { x: 27, lean: 8, frontUpper: 50, frontFore: 40, weapon: 40 }],
    guard: [{ lean: -6, frontUpper: 60, frontFore: 150, weapon: 190 }, { lean: -6, bob: 1, frontUpper: 60, frontFore: 150, weapon: 190 }],
    tired: [{ lean: 20, head: 10, frontUpper: 20, frontFore: 10, weapon: 10 }, { lean: 22, head: 12, bob: 1, frontUpper: 20, frontFore: 10, weapon: 10 }],
  };
  const pose = { x: 24, ground: 56, backThigh: -16, frontThigh: 20, frontUpper: 30, frontFore: 60, weapon: 120, backUpper: -20, backFore: 10, ...(poses[mode] || poses.idle)[f % (poses[mode] || poses.idle).length] };
  const s = skeleton(pose, GOBLIN_BODY);
  limb(p, 'goblin', s.backLeg.start, s.backLeg.knee, 2.6, 2.1); limb(p, 'goblin', s.backLeg.knee, s.backLeg.foot, 2.1, 1.8);
  blob(p, 'leather', s.backLeg.foot[0] + 1, s.backLeg.foot[1] - 1, 3, 1.8);
  limb(p, 'goblin', s.backArm.shoulder, s.backArm.elbow, 2, 1.8); limb(p, 'goblin', s.backArm.elbow, s.backArm.hand, 1.8, 1.6);
  const [nx, ny] = s.neck, [px, py] = s.hip;
  poly(p, 'leather', [[nx - 5, ny + 1], [nx + 5, ny + 1], [px + 6, py + 4], [px - 6, py + 4]], { shadow: 2 });
  blob(p, 'goblin', lerp(nx, px, 0.55) + 2, lerp(ny, py, 0.55), 3, 3.5, { line: true });
  poly(p, 'wood', [[px - 6, py - 1], [px + 6, py - 1], [px + 5, py + 6], [px, py + 4], [px - 5, py + 6]]);
  limb(p, 'goblin', s.frontLeg.start, s.frontLeg.knee, 2.8, 2.2); limb(p, 'goblin', s.frontLeg.knee, s.frontLeg.foot, 2.2, 1.9);
  blob(p, 'leather', s.frontLeg.foot[0] + 1, s.frontLeg.foot[1] - 1, 3.2, 1.9);
  goblinHead(p, s.head[0], s.head[1], { open: mode === 'attack' && f > 0, angry: mode !== 'tired' });
  if (mode === 'tired') { p.dots([[s.head[0] + 2, s.head[1] - 1], [s.head[0] + 3, s.head[1] - 1], [s.head[0] + 6, s.head[1] - 1], [s.head[0] + 7, s.head[1] - 1]], 'goblin1'); zzz(p, Math.round(s.head[0] + 6), Math.round(s.head[1] - 18)); }
  // club
  const [dx, dy] = along(pose.weapon);
  const [hx, hy] = s.frontArm.hand;
  limb(p, 'wood', [hx - dx * 2, hy - dy * 2], [hx + dx * 14, hy + dy * 14], 1.4, 3.6, { gloss: true });
  p.dots([[hx + dx * 11 - dy * 2, hy + dy * 11 + dx * 2], [hx + dx * 8 + dy * 2, hy + dy * 8 - dx * 2]], 'wood1');
  limb(p, 'goblin', s.frontArm.shoulder, s.frontArm.elbow, 2.2, 2); limb(p, 'goblin', s.frontArm.elbow, s.frontArm.hand, 2, 1.8);
  blob(p, 'goblin', hx, hy, 2.2, 2.2);
  if (pose.swing) arc(p, s.frontArm.shoulder[0], s.frontArm.shoulder[1], 19, -80, 50, 'white', 3);
  return done(p);
}

function wolf({ mode, f }) {
  const p = new Painter(72, 52, LIGHT);
  const lunge = mode === 'attack' ? [-2, 6, 9, 3][f] : 0;
  const breathe = mode === 'idle' ? [0, 1, 1, 0][f] : 0;
  const crouch = mode === 'tired' ? 4 : mode === 'charge' ? 2 : 0;
  const x = 30 + lunge, y = 30 + crouch;
  const open = mode === 'attack' && f > 0;
  // tail
  const wag = mode === 'idle' ? [0, -2, -3, -1][f] : -2;
  p.shape('fur', (id) => { p.capsule(id, x - 12, y - 2, x - 22, y - 10 + wag, 3.2, 2.4); p.capsule(id, x - 22, y - 10 + wag, x - 27, y - 18 + wag, 2.4, 1.2); }, { gloss: true });
  // far legs
  limb(p, 'fur', [x - 8, y + 3], [x - 12, y + 12 - crouch * 0.4], 3, 2.2, { level: 2 });
  limb(p, 'fur', [x - 12, y + 12 - crouch * 0.4], [x - 10, 49], 2.2, 1.8, { level: 2 });
  limb(p, 'fur', [x + 14, y + 3], [x + 16 + (open ? 5 : 0), y + 12], 2.8, 2.2, { level: 2 });
  limb(p, 'fur', [x + 16 + (open ? 5 : 0), y + 12], [x + 17 + (open ? 7 : 0), 49], 2.2, 1.8, { level: 2 });
  // body, belly, ruff
  blob(p, 'fur', x, y - breathe * 0.5, 16, 8.5 + breathe * 0.3, { dark: 1, shadow: 2, dither: true });
  blob(p, 'cream', x + 2, y + 5, 11, 3.2, { level: 3, line: false });
  poly(p, 'fur', [[x + 6, y - 9], [x + 12, y - 12], [x + 14, y - 8], [x + 18, y - 9], [x + 18, y + 7], [x + 10, y + 6]], { dark: 1, shadow: 2 });
  // near legs
  limb(p, 'fur', [x - 10, y + 2], [x - 15, y + 12 - crouch * 0.4], 3.6, 2.6);
  limb(p, 'fur', [x - 15, y + 12 - crouch * 0.4], [x - 13, 49], 2.6, 2);
  blob(p, 'fur', x - 12, 49, 3, 1.6);
  limb(p, 'fur', [x + 12, y + 3], [x + 13 + (open ? 5 : 0), y + 12], 3.4, 2.6);
  limb(p, 'fur', [x + 13 + (open ? 5 : 0), y + 12], [x + 14 + (open ? 8 : 0), 49], 2.6, 2);
  blob(p, 'fur', x + 15 + (open ? 8 : 0), 49, 3.2, 1.6);
  // head
  const hx = x + 22, hy = y - 10 + (mode === 'tired' ? 6 : 0);
  blob(p, 'fur', hx, hy, 7.5, 6.5, { gloss: true });
  poly(p, 'fur', [[hx - 4, hy - 4], [hx - 3, hy - 13], [hx + 1, hy - 5]]);
  poly(p, 'fur', [[hx + 1, hy - 5], [hx + 3, hy - 13], [hx + 5, hy - 4]]);
  poly(p, 'fur', [[hx + 3, hy - 2], [hx + 14, hy + 1], [hx + 14, hy + 4], [hx + 3, hy + 4]], { gloss: true });
  if (open) {
    poly(p, 'fur', [[hx + 2, hy + 4], [hx + 13, hy + 9], [hx + 11, hy + 11], [hx + 2, hy + 7]]);
    p.stamp(['kkkkkkkkk', 'WkrrrrrkW', '.kkkkkkk.'], Math.round(hx + 4), Math.round(hy + 4), { k: 'ink', r: 'red', W: 'fang' });
  } else p.dots([[hx + 5, hy + 4], [hx + 6, hy + 4], [hx + 7, hy + 4], [hx + 8, hy + 4], [hx + 12, hy + 4]], 'ink');
  p.stamp(['kk', 'kk'], Math.round(hx + 13), Math.round(hy), { k: 'ink' });
  if (mode === 'tired') { p.dots([[hx + 2, hy - 1], [hx + 3, hy - 1], [hx + 4, hy - 1]], 'ink'); zzz(p, Math.round(hx + 6), Math.round(hy - 18)); }
  else glowEye(p, Math.round(hx + 3), Math.round(hy - 2), 'glow', 'orange');
  p.dots([[hx - 2, hy - 7], [hx + 3, hy - 7]], 'fur1');
  return done(p);
}

const SKELETON_BODY = { thigh: 9, shin: 9.5, torso: 12, upperArm: 7.5, foreArm: 7, headLift: 9 };

function skeletonFoe({ mode, f }) {
  const p = new Painter(54, 68, LIGHT);
  const poses = {
    idle: [{}, { bob: 1 }, { bob: 1, frontFore: 64 }, {}],
    attack: [{ x: 22, lean: -6, frontUpper: 196, frontFore: 210, weapon: 236 }, { x: 26, lean: 8, frontUpper: 160, frontFore: 150, weapon: 164 }, { x: 30, lean: 16, frontUpper: 92, frontFore: 70, weapon: 66, swing: true }, { x: 27, lean: 8, frontUpper: 50, frontFore: 30, weapon: 30 }],
    tired: [{ lean: 24, head: 16, frontUpper: 16, frontFore: 8, weapon: 4 }, { lean: 26, head: 18, bob: 1, frontUpper: 16, frontFore: 8, weapon: 4 }],
  };
  const pose = { x: 24, ground: 66, backThigh: -14, frontThigh: 18, frontUpper: 26, frontFore: 58, weapon: 120, backUpper: -18, backFore: 8, ...(poses[mode] || poses.idle)[f % (poses[mode] || poses.idle).length] };
  const s = skeleton(pose, SKELETON_BODY);
  const bone = (a, b, r = 1.3) => limb(p, 'bone', a, b, r, r * 0.9, { gloss: true });
  bone(s.backLeg.start, s.backLeg.knee); bone(s.backLeg.knee, s.backLeg.foot);
  blob(p, 'bone', s.backLeg.foot[0] + 1.5, s.backLeg.foot[1], 2.6, 1.3);
  bone(s.backArm.shoulder, s.backArm.elbow, 1.2); bone(s.backArm.elbow, s.backArm.hand, 1.1);
  const [nx, ny] = s.neck, [px, py] = s.hip;
  // spine, ribcage, pelvis, tattered cloth
  bone([nx, ny], [px, py], 1.2);
  for (let i = 0; i < 4; i += 1) {
    const [rx, ry] = pt(s.neck, s.hip, 0.18 + i * 0.16);
    p.shape('bone', (id) => p.capsule(id, rx - 5 + i * 0.5, ry, rx + 5 - i * 0.5, ry + 1, 1.1, 1.1), { gloss: true });
  }
  poly(p, 'shade', [[px - 6, py - 1], [px + 6, py - 1], [px + 7, py + 6], [px + 4, py + 4], [px + 2, py + 8], [px - 1, py + 5], [px - 4, py + 8], [px - 6, py + 5]], { shadow: 2 });
  blob(p, 'bone', px, py - 1, 4.5, 2, { gloss: true });
  bone(s.frontLeg.start, s.frontLeg.knee, 1.4); bone(s.frontLeg.knee, s.frontLeg.foot, 1.3);
  blob(p, 'bone', s.frontLeg.foot[0] + 1.5, s.frontLeg.foot[1], 2.8, 1.4);
  [s.frontLeg.knee, s.backLeg.knee].forEach(([kx, ky]) => blob(p, 'bone', kx, ky, 1.8, 1.8));
  // skull
  const [hx, hy] = s.head;
  blob(p, 'bone', hx, hy - 1, 7, 6.5, { gloss: true, shadow: 2 });
  p.shape('bone', (id) => p.poly(id, [[hx - 2, hy + 3], [hx + 7, hy + 2], [hx + 6, hy + 7], [hx - 1, hy + 7]]), { gloss: true });
  p.stamp(['kkk', 'kkk', '.k.'], Math.round(hx + 1), Math.round(hy - 2), { k: 'ink' });
  p.stamp(['kk', 'kk'], Math.round(hx + 5), Math.round(hy - 2), { k: 'ink' });
  if (mode !== 'tired') { p.dot(hx + 2, hy - 1, 'red'); p.dot(hx + 5, hy - 1, 'red'); }
  else zzz(p, Math.round(hx + 6), Math.round(hy - 18));
  p.dots([[hx + 5, hy + 1]], 'ink');
  p.stamp(['kWkWk'], Math.round(hx + 1), Math.round(hy + 4), { k: 'ink', W: 'fang' });
  // rusty sword
  const [dx, dy] = along(pose.weapon);
  const [wx, wy] = s.frontArm.hand;
  limb(p, 'leather', [wx - dx * 2.5, wy - dy * 2.5], [wx + dx, wy + dy], 1);
  p.shape('steel', (id) => p.poly(id, [[wx + dx * 2 - dy * 1.4, wy + dy * 2 + dx * 1.4], [wx + dx * 2 + dy * 1.4, wy + dy * 2 - dx * 1.4], [wx + dx * 17, wy + dy * 17]]), { gloss: true, dark: 1, shadow: 1 });
  p.dots([[wx + dx * 8 + dy, wy + dy * 8 - dx], [wx + dx * 12, wy + dy * 12]], 'leather2');
  limb(p, 'leather', [wx + dx * 2 - dy * 3, wy + dy * 2 + dx * 3], [wx + dx * 2 + dy * 3, wy + dy * 2 - dx * 3], 0.9);
  bone(s.frontArm.shoulder, s.frontArm.elbow, 1.3); bone(s.frontArm.elbow, s.frontArm.hand, 1.2);
  blob(p, 'bone', wx, wy, 1.8, 1.8);
  if (pose.swing) arc(p, s.frontArm.shoulder[0], s.frontArm.shoulder[1], 22, -80, 50, 'white', 3);
  return done(p);
}

function shieldGoblin({ mode, f }) {
  const p = new Painter(64, 64, LIGHT);
  const guard = mode === 'guard';
  const poses = {
    idle: [{}, { bob: 1 }, { bob: 1 }, {}],
    attack: [{ x: 22, lean: -4, frontUpper: 60, frontFore: 90 }, { x: 26, lean: 10 }, { x: 31, lean: 16, thrust: true }, { x: 27, lean: 8 }],
    guard: [{ lean: -4, bob: 1 }, { lean: -4, bob: 1 }],
    tired: [{ lean: 18, head: 10 }, { lean: 20, head: 12, bob: 1 }],
  };
  const pose = { x: 24, ground: 62, backThigh: -18, frontThigh: 22, backUpper: 150, backFore: 170, frontUpper: 40, frontFore: 80, ...(poses[mode] || poses.idle)[f % (poses[mode] || poses.idle).length] };
  const s = skeleton(pose, { ...GOBLIN_BODY, thigh: 8, shin: 8, torso: 11 });
  // spear held upright in the back hand
  const [bx, by] = s.backArm.hand;
  const spearTip = pose.thrust ? [bx + 28, by + 2] : [bx + 3, by - 26];
  limb(p, 'wood', pose.thrust ? [bx - 6, by - 1] : [bx - 1, by + 14], spearTip, 1.1);
  poly(p, 'steel', pose.thrust ? [[spearTip[0] - 1, spearTip[1] - 3], [spearTip[0] + 7, spearTip[1]], [spearTip[0] - 1, spearTip[1] + 3]] : [[spearTip[0] - 3, spearTip[1] + 1], [spearTip[0], spearTip[1] - 8], [spearTip[0] + 3, spearTip[1] + 1]], { gloss: true });
  limb(p, 'goblin', s.backLeg.start, s.backLeg.knee, 3, 2.4); limb(p, 'goblin', s.backLeg.knee, s.backLeg.foot, 2.4, 2);
  blob(p, 'leather', s.backLeg.foot[0] + 1, s.backLeg.foot[1] - 1, 3.4, 2);
  limb(p, 'goblin', s.backArm.shoulder, s.backArm.elbow, 2.2, 2); limb(p, 'goblin', s.backArm.elbow, s.backArm.hand, 2, 1.8);
  const [nx, ny] = s.neck, [px, py] = s.hip;
  poly(p, 'steel', [[nx - 6, ny + 1], [nx + 6, ny + 1], [px + 7, py + 3], [px - 7, py + 3]], { gloss: true, shadow: 2 });
  poly(p, 'leather', [[px - 7, py], [px + 7, py], [px + 6, py + 6], [px - 6, py + 6]]);
  limb(p, 'goblin', s.frontLeg.start, s.frontLeg.knee, 3.2, 2.6); limb(p, 'goblin', s.frontLeg.knee, s.frontLeg.foot, 2.6, 2.1);
  blob(p, 'leather', s.frontLeg.foot[0] + 1, s.frontLeg.foot[1] - 1, 3.6, 2);
  goblinHead(p, s.head[0], s.head[1], { helmet: true, open: mode === 'attack' && f === 2 });
  if (mode === 'tired') zzz(p, Math.round(s.head[0] + 6), Math.round(s.head[1] - 20));
  // big tower shield in front
  const shx = s.frontArm.hand[0] + (guard ? 6 : 4), shy = s.frontArm.hand[1] - (guard ? 8 : 4);
  p.shape('steel', (id) => p.poly(id, [[shx - 9, shy - 13], [shx + 9, shy - 13], [shx + 10, shy + 8], [shx, shy + 16], [shx - 10, shy + 8]]), { gloss: true });
  p.shape('blue', (id) => p.poly(id, [[shx - 7, shy - 11], [shx + 7, shy - 11], [shx + 8, shy + 7], [shx, shy + 13], [shx - 8, shy + 7]]), { line: false, shadow: 2, dither: true });
  poly(p, 'gold', [[shx - 1.5, shy - 9], [shx + 1.5, shy - 9], [shx + 1.5, shy + 9], [shx - 1.5, shy + 9]], { gloss: true, line: false });
  poly(p, 'gold', [[shx - 6, shy - 2], [shx + 6, shy - 2], [shx + 6, shy + 1], [shx - 6, shy + 1]], { gloss: true, line: false });
  if (guard) { sparkle(p, shx + 6, shy - 10, f % 2 === 0); sparkle(p, shx - 5, shy + 6, false, 'cyan'); }
  return done(p);
}

function healer({ mode, f }) {
  const p = new Painter(56, 70, LIGHT);
  const cast = mode === 'cast';
  const bob = mode === 'idle' ? [0, 1, 1, 0][f] : 0;
  const lean = mode === 'attack' ? [0, 4, 8, 3][f] : mode === 'tired' ? -3 : 0;
  const x = 24 + lean * 0.5, base = 68;
  // staff behind in the back hand
  const staffTop = cast ? [x + 9, 8 - f] : [x + 12, 14 + bob];
  limb(p, 'wood', [staffTop[0] - 3, base - 3], staffTop, 1.3, 1.1, { gloss: true });
  // robe
  poly(p, 'leaf', [[x - 7, 26 + bob], [x + 7, 26 + bob], [x + 13 + lean, base - 3], [x + 8, base], [x - 8, base], [x - 12, base - 3]], { shadow: 2, dither: true });
  poly(p, 'cream', [[x - 12, base - 5], [x + 13 + lean, base - 5], [x + 13 + lean, base - 3], [x + 8, base], [x - 8, base], [x - 12, base - 3]], { gloss: true });
  poly(p, 'cream', [[x + 1, 28 + bob], [x + 4, 28 + bob], [x + 7 + lean * 0.5, base - 5], [x + 3, base - 5]], { line: false });
  blob(p, 'gold', x + 2, 40 + bob, 2, 2, { gloss: true });
  // hood and face in shadow
  const hx = x + 1 + lean * 0.4, hy = 20 + bob + (mode === 'tired' ? 3 : 0);
  poly(p, 'leaf', [[hx - 9, hy + 7], [hx - 8, hy - 6], [hx - 2, hy - 12], [hx + 7, hy - 9], [hx + 10, hy + 1], [hx + 9, hy + 8]], { shadow: 2, gloss: true });
  blob(p, 'shade', hx + 3, hy + 1, 5.5, 5.5, { level: 1, line: false });
  if (mode === 'tired') { p.dots([[hx + 1, hy + 1], [hx + 2, hy + 1], [hx + 5, hy + 1], [hx + 6, hy + 1]], 'green'); zzz(p, Math.round(hx + 8), Math.round(hy - 18)); }
  else { glowEye(p, Math.round(hx + 1), Math.round(hy), 'green', 'leaf4', 0); glowEye(p, Math.round(hx + 5), Math.round(hy), 'green', 'leaf4', 0); }
  poly(p, 'leaf', [[hx - 2, hy - 12], [hx - 7, hy - 17], [hx - 4, hy - 10]]);
  // sleeve and hand gripping the staff, flower gem on top
  limb(p, 'leaf', [x + 3, 30 + bob], [staffTop[0] - 1, staffTop[1] + 14], 3, 2.6);
  blob(p, 'skin', staffTop[0] - 1, staffTop[1] + 14, 2, 2);
  [[0, -4], [4, 0], [0, 4], [-4, 0]].forEach(([dx, dy]) => blob(p, 'mushroom', staffTop[0] + dx * 0.8, staffTop[1] + dy * 0.8, 2.2, 2.2, { line: false }));
  blob(p, 'crystal', staffTop[0], staffTop[1], 2.2, 2.2, { gloss: true });
  if (cast) { sparkle(p, staffTop[0] + 6, staffTop[1] - 3 + f, true, 'green'); sparkle(p, staffTop[0] - 8, staffTop[1] + 4, false, 'green'); sparkle(p, staffTop[0] + 2, staffTop[1] - 9, false, 'spark'); }
  return done(p);
}

/* ---------------------------------------------------------- large foes */

function golemBody(p, { mode, f, angry }, scale = 1, W = 84, H = 88) {
  const S = (v) => v * scale;
  const charge = mode === 'charge', tired = mode === 'tired', attack = mode === 'attack';
  const cx = W / 2 - S(2), base = H - 2;
  const slump = tired ? S(4) : 0;
  const fistY = charge ? S(36) : attack ? [S(40), S(18), S(64), S(62)][f] : tired ? S(66) : S(60) + (mode === 'idle' ? [0, 1, 2, 1][f] : 0);
  const stone = 'stone';
  const glow = charge ? (f % 2 ? 'glow' : 'orange') : tired ? 'stone2' : angry ? 'orange' : 'cyan';
  // legs
  poly(p, stone, [[cx - S(18), base - S(26)], [cx - S(5), base - S(26)], [cx - S(6), base - S(4)], [cx - S(20), base - S(4)]], { shadow: 2, dither: true });
  poly(p, stone, [[cx + S(4), base - S(26)], [cx + S(17), base - S(26)], [cx + S(19), base - S(4)], [cx + S(5), base - S(4)]], { shadow: 2, dither: true });
  blob(p, stone, cx - S(13), base - S(3), S(9), S(3.4)); blob(p, stone, cx + S(12), base - S(3), S(9), S(3.4));
  // back arm
  const armTop = S(34) + slump;
  poly(p, stone, [[cx - S(30), armTop], [cx - S(20), armTop - S(2)], [cx - S(20), fistY - S(4)], [cx - S(31), fistY - S(4)]], { shadow: 2 });
  blob(p, stone, cx - S(26), fistY, S(9), S(8), { gloss: true, shadow: 2 });
  // torso boulder
  p.shape(stone, (id) => { p.ellipse(id, cx, S(40) + slump, S(24), S(21)); p.rect(id, Math.round(cx - S(19)), Math.round(S(44) + slump), Math.round(S(38)), Math.round(S(16))); }, { dark: 1, shadow: 3, dither: true, gloss: true });
  // cracks and chest plate
  p.dots([[cx - S(10), S(36) + slump], [cx - S(9), S(37) + slump], [cx - S(9), S(38) + slump], [cx - S(8), S(39) + slump], [cx + S(12), S(46) + slump], [cx + S(11), S(47) + slump], [cx + S(11), S(48) + slump]], 'stone1');
  // core crystal
  poly(p, charge ? 'ember' : angry ? 'ember' : 'crystal', [[cx, S(40) + slump], [cx + S(6), S(47) + slump], [cx, S(54) + slump], [cx - S(6), S(47) + slump]], { gloss: true });
  // mossy shoulders and head
  blob(p, stone, cx - S(19), S(27) + slump, S(10), S(8), { gloss: true });
  blob(p, stone, cx + S(19), S(27) + slump, S(10), S(8), { gloss: true });
  blob(p, 'moss', cx - S(20), S(22) + slump, S(7), S(3), { line: false }); blob(p, 'moss', cx + S(17), S(21) + slump, S(6), S(2.5), { line: false });
  const hy = S(18) + slump * 1.5;
  p.shape(stone, (id) => p.poly(id, [[cx - S(9), hy - S(8)], [cx + S(9), hy - S(9)], [cx + S(11), hy + S(6)], [cx - S(10), hy + S(6)]]), { gloss: true, shadow: 2 });
  blob(p, 'moss', cx - S(1), hy - S(8), S(8), S(2.4), { line: false });
  p.shape('stone', (id) => p.rect(id, Math.round(cx - S(8)), Math.round(hy - S(1)), Math.round(S(17)), Math.round(S(4))), { level: 1 });
  glowEye(p, Math.round(cx - S(5)), Math.round(hy), glow, glow === 'cyan' ? 'crystal4' : 'orange', Math.max(1, Math.round(scale)));
  glowEye(p, Math.round(cx + S(3)), Math.round(hy), glow, glow === 'cyan' ? 'crystal4' : 'orange', Math.max(1, Math.round(scale)));
  // front arm
  poly(p, stone, [[cx + S(20), armTop], [cx + S(31), armTop - S(2)], [cx + S(32), fistY - S(4)], [cx + S(21), fistY - S(4)]], { shadow: 2 });
  blob(p, stone, cx + S(26), fistY, S(10), S(9), { gloss: true, shadow: 2 });
  p.dots([[cx + S(22), fistY - S(2)], [cx + S(26), fistY - S(3)], [cx + S(30), fistY - S(2)]], 'stone1');
  if (charge) { sparkle(p, cx - S(28), S(30) + f, true, 'orange'); sparkle(p, cx + S(30), S(28) - f, true, 'orange'); sparkle(p, cx, S(8), false, 'glow'); }
  if (attack && f >= 2) { [[cx - S(34), base], [cx + S(36), base - 1], [cx + S(22), base], [cx - S(20), base - 2]].forEach(([x, y], i) => sparkle(p, x, y, i % 2 === 0, 'speed')); }
  if (tired) zzz(p, Math.round(cx + S(10)), Math.round(hy - S(20)));
}

function golem(params) {
  const p = new Painter(84, 88, LIGHT);
  golemBody(p, params, 1, 84, 88);
  return done(p);
}

function goblinCaptain({ mode, f }) {
  const p = new Painter(70, 76, LIGHT);
  const poses = {
    idle: [{}, { bob: 1 }, { bob: 1 }, {}],
    attack: [{ x: 26, lean: -8, frontUpper: 196, frontFore: 214, weapon: 236 }, { x: 30, lean: 6, frontUpper: 164, frontFore: 150, weapon: 168 }, { x: 35, lean: 18, frontUpper: 96, frontFore: 72, weapon: 66, swing: true }, { x: 31, lean: 10, frontUpper: 54, frontFore: 30, weapon: 26 }],
    charge: [{ lean: -6, frontUpper: 176, frontFore: 176, weapon: 180, glow: true }, { lean: -6, bob: 1, frontUpper: 176, frontFore: 176, weapon: 180, glow: true }],
    guard: [{ lean: -6, frontUpper: 60, frontFore: 150, weapon: 176 }, { lean: -6, bob: 1, frontUpper: 60, frontFore: 150, weapon: 176 }],
    tired: [{ lean: 22, head: 12, frontUpper: 20, frontFore: 8, weapon: 4 }, { lean: 24, head: 14, bob: 1, frontUpper: 20, frontFore: 8, weapon: 4 }],
  };
  const pose = { x: 28, ground: 74, backThigh: -18, frontThigh: 22, frontUpper: 30, frontFore: 60, weapon: 126, backUpper: -24, backFore: 4, ...(poses[mode] || poses.idle)[f % (poses[mode] || poses.idle).length] };
  const s = skeleton(pose, { thigh: 9.5, shin: 10, torso: 14, upperArm: 8.5, foreArm: 8, headLift: 11 });
  const [nx, ny] = s.neck, [px, py] = s.hip;
  // red cape
  poly(p, 'red', [[nx - 7, ny], [nx + 2, ny], [px - 2, py + 10], [px - 14, py + 14], [px - 16, py + 8]], { shadow: 2, dither: true });
  limb(p, 'goblin', s.backLeg.start, s.backLeg.knee, 3.4, 2.8); limb(p, 'steel', s.backLeg.knee, s.backLeg.foot, 2.8, 2.3, { gloss: true });
  blob(p, 'leather', s.backLeg.foot[0] + 1, s.backLeg.foot[1] - 1, 3.8, 2.2);
  limb(p, 'goblin', s.backArm.shoulder, s.backArm.elbow, 2.6, 2.3); limb(p, 'goblin', s.backArm.elbow, s.backArm.hand, 2.3, 2);
  poly(p, 'steel', [[nx - 7, ny + 1], [nx + 7, ny + 1], [px + 8, py + 2], [px - 8, py + 2]], { gloss: true, shadow: 2 });
  poly(p, 'gold', [[nx - 1, ny + 2], [nx + 2, ny + 2], [px + 2, py], [px - 1, py]], { gloss: true, line: false });
  poly(p, 'red', [[px - 8, py], [px + 8, py], [px + 7, py + 7], [px - 7, py + 7]], { shadow: 2 });
  poly(p, 'leather', [[px - 8, py - 1], [px + 8, py - 1], [px + 8, py + 2], [px - 8, py + 2]]);
  limb(p, 'goblin', s.frontLeg.start, s.frontLeg.knee, 3.6, 3); limb(p, 'steel', s.frontLeg.knee, s.frontLeg.foot, 3, 2.4, { gloss: true });
  blob(p, 'leather', s.frontLeg.foot[0] + 1, s.frontLeg.foot[1] - 1, 4, 2.2);
  goblinHead(p, s.head[0], s.head[1], { captain: true, open: mode === 'attack' && f === 2 });
  if (mode === 'tired') zzz(p, Math.round(s.head[0] + 6), Math.round(s.head[1] - 24));
  // broadsword
  const [dx, dy] = along(pose.weapon);
  const [wx, wy] = s.frontArm.hand;
  limb(p, 'leather', [wx - dx * 3, wy - dy * 3], [wx + dx, wy + dy], 1.2);
  p.shape(pose.glow ? 'ember' : 'steel', (id) => p.poly(id, [[wx + dx * 2.5 - dy * 2.4, wy + dy * 2.5 + dx * 2.4], [wx + dx * 2.5 + dy * 2.4, wy + dy * 2.5 - dx * 2.4], [wx + dx * 23 + dy * 1.6, wy + dy * 23 - dx * 1.6], [wx + dx * 26, wy + dy * 26], [wx + dx * 23 - dy * 1.6, wy + dy * 23 + dx * 1.6]]), { gloss: true, dark: 1, shadow: 1 });
  limb(p, 'gold', [wx + dx * 2.5 - dy * 4, wy + dy * 2.5 + dx * 4], [wx + dx * 2.5 + dy * 4, wy + dy * 2.5 - dx * 4], 1.2, 1.2, { gloss: true });
  limb(p, 'goblin', s.frontArm.shoulder, s.frontArm.elbow, 2.8, 2.5); limb(p, 'goblin', s.frontArm.elbow, s.frontArm.hand, 2.5, 2.2);
  blob(p, 'leather', wx, wy, 2.6, 2.6);
  blob(p, 'steel', s.frontArm.shoulder[0], s.frontArm.shoulder[1] - 1, 4.5, 3.6, { gloss: true });
  if (pose.swing) arc(p, s.frontArm.shoulder[0], s.frontArm.shoulder[1], 30, -80, 50, 'white', 4);
  if (pose.glow) { sparkle(p, wx + dx * 26, wy + dy * 26, true, 'orange'); sparkle(p, wx - 10, wy + 4 - f * 2, false, 'orange'); sparkle(p, wx + 10, wy - 10 + f, false, 'glow'); }
  return done(p);
}

// The Shadow Horde's field commander: the captain's rig in the invaders' colours.
const COMMANDER_MATERIAL = { goblin: 'shade', steel: 'shadowCloth', red: 'crimson', gold: 'ember', leather: 'indigo' };
function hordeCommander(opts) {
  return recolor(goblinCaptain(opts), (key) => key.replace(/^([a-zA-Z]+)(\d)$/, (all, name, level) => (COMMANDER_MATERIAL[name] ? `${COMMANDER_MATERIAL[name]}${level}` : all)));
}

function necromancer({ mode, f }) {
  const p = new Painter(62, 82, LIGHT);
  const cast = mode === 'cast' || mode === 'charge';
  const float = [0, -1, -2, -1][f % 4];
  const lean = mode === 'attack' ? [0, 4, 8, 3][f] : mode === 'tired' ? -2 : 0;
  const x = 26 + lean * 0.5, base = 76 + float;
  // staff with skull topper
  const top = cast ? [x + 12, 8 - (f % 2)] : [x + 14, 16 + float];
  limb(p, 'wood', [top[0] - 4, base - 2], top, 1.3, 1.1, { gloss: true });
  blob(p, 'bone', top[0], top[1] - 3, 4, 3.5, { gloss: true });
  p.stamp(['kk.kk', '..k..'], Math.round(top[0] - 2), Math.round(top[1] - 4), { k: 'ink' });
  const flame = cast ? 'green' : 'leaf4';
  [[0, -9], [2, -12], [-2, -11], [0, -14]].forEach(([dx, dy], i) => { if ((i + f) % 4 !== 3) p.dot(top[0] + dx, top[1] + dy, i % 2 ? flame : 'leaf3'); });
  // tattered robe
  const hem = [[x + 14 + lean, base - 6], [x + 11, base], [x + 7, base - 4], [x + 3, base + 1], [x - 1, base - 4], [x - 5, base + 1], [x - 9, base - 3], [x - 13, base - 1], [x - 12, base - 8]];
  poly(p, 'shade', [[x - 8, 30 + float], [x + 8, 30 + float], ...hem], { shadow: 2, dither: true });
  poly(p, 'violet', [[x + 1, 32 + float], [x + 4, 32 + float], [x + 7 + lean * 0.4, base - 5], [x + 3, base - 3]], { line: false });
  poly(p, 'gold', [[x - 8, 44 + float], [x + 9, 44 + float], [x + 9, 46 + float], [x - 8, 46 + float]], { gloss: true, line: false });
  // hood with a skull face
  const hx = x + 1 + lean * 0.4, hy = 22 + float + (mode === 'tired' ? 3 : 0);
  poly(p, 'shade', [[hx - 11, hy + 9], [hx - 10, hy - 6], [hx - 2, hy - 15], [hx + 8, hy - 10], [hx + 11, hy + 1], [hx + 10, hy + 9]], { shadow: 2, gloss: true });
  blob(p, 'shade', hx + 3, hy + 1, 6, 6.5, { level: 0, line: false });
  blob(p, 'bone', hx + 4, hy + 1, 4.5, 5, { gloss: true, line: false });
  p.stamp(['kk.kk', 'kk.kk', '..k..'], Math.round(hx + 2), Math.round(hy), { k: 'ink' });
  if (mode !== 'tired') { p.dot(hx + 3, hy + 1, 'green'); p.dot(hx + 6, hy + 1, 'green'); } else zzz(p, Math.round(hx + 8), Math.round(hy - 20));
  p.stamp(['kWkWk'], Math.round(hx + 2), Math.round(hy + 4), { k: 'ink', W: 'fang' });
  // sleeve and bony hand
  const handAt = [top[0] - 2, top[1] + 16];
  limb(p, 'shade', [x + 4, 34 + float], handAt, 3.2, 3.8);
  blob(p, 'bone', handAt[0] + 1, handAt[1], 2.2, 2.2);
  if (cast) { sparkle(p, top[0] + 7, top[1] - 6 + f, true, 'violet'); sparkle(p, top[0] - 8, top[1] + 2, false, 'green'); sparkle(p, x - 12, 40 - f * 2, false, 'violet'); }
  return done(p);
}

/* ------------------------------------------------------------------ bosses */

function dragon({ mode, f, angry }) {
  const p = new Painter(132, 116, LIGHT);
  const charge = mode === 'charge', attack = mode === 'attack', tired = mode === 'tired';
  const breathe = mode === 'idle' ? [0, 1, 2, 1][f] : 0;
  const neckLift = charge ? -5 : attack ? [-3, 3, 6, 2][f] : tired ? 12 : breathe * 0.5;
  const reach = attack ? [-2, 5, 9, 3][f] : 0;
  const flap = mode === 'idle' ? [0, -3, -5, -2][f] : charge ? -6 + f * 2 : tired ? 10 : attack ? [-4, 0, 3, 0][f] : 0;
  const scale = 'scale';
  const bx = 54, by = 76 + (tired ? 4 : 0);
  // far wing (behind the body)
  poly(p, 'membrane', [[bx + 2, by - 18], [bx - 14, by - 58 + flap], [bx - 34, by - 62 + flap * 1.2], [bx - 30, by - 44], [bx - 16, by - 26]], { shadow: 2, dither: true });
  // tail: thick, sweeping back and curling up, spiked tip
  p.shape(scale, (id) => {
    p.capsule(id, bx - 20, by + 4, bx - 36, by + 18, 11, 8);
    p.capsule(id, bx - 36, by + 18, bx - 48, by + 24, 8, 5.5);
    p.capsule(id, bx - 48, by + 24, bx - 52, by + 12, 5.5, 3);
  }, { dark: 1, shadow: 3, dither: true, gloss: true });
  poly(p, 'bone', [[bx - 56, by + 12], [bx - 51, by], [bx - 47, by + 12]], { gloss: true });
  // far legs (darker)
  limb(p, scale, [bx - 14, by + 8], [bx - 18, by + 30], 7, 5, { level: 2 });
  limb(p, scale, [bx + 16, by + 8], [bx + 20 + reach * 0.4, by + 32], 6, 4.4, { level: 2 });
  // body and belly plates
  p.shape(scale, (id) => p.ellipse(id, bx, by + breathe * 0.3, 31, 21), { dark: 1, shadow: 3, dither: true, gloss: true, light: 2 });
  p.shape('belly', (id) => p.ellipse(id, bx + 8, by + 10, 23, 9), { shadow: 2, dither: true });
  for (let i = -4; i <= 3; i += 1) p.dots([[bx + 8 + i * 5, by + 5], [bx + 8 + i * 5, by + 6], [bx + 8 + i * 5, by + 7]], 'belly2');
  // back spikes along the spine
  for (let i = 0; i < 7; i += 1) {
    const sx = bx - 24 + i * 8, sy = by - 19 + Math.abs(i - 3) * 1.5;
    poly(p, 'bone', [[sx - 3, sy + 3], [sx - 1, sy - 6 - (i === 3 ? 2 : 0)], [sx + 3, sy + 3]], { gloss: true });
  }
  // near hind leg: heavy thigh, bent shin, clawed foot
  blob(p, scale, bx - 12, by + 12, 12, 13, { gloss: true, dark: 1, shadow: 2, dither: true });
  limb(p, scale, [bx - 14, by + 20], [bx - 18, by + 34], 6.5, 5);
  blob(p, scale, bx - 12, by + 36, 9, 3.6, { gloss: true });
  p.dots([[bx - 4, by + 37], [bx - 4, by + 38], [bx - 8, by + 38], [bx - 13, by + 38]], 'bone4');
  // near foreleg
  p.shape(scale, (id) => { p.capsule(id, bx + 18, by + 4, bx + 24 + reach * 0.5, by + 22, 8, 6); p.capsule(id, bx + 24 + reach * 0.5, by + 22, bx + 26 + reach * 0.7, by + 33, 6, 4.5); }, { gloss: true, dark: 1, shadow: 2 });
  blob(p, scale, bx + 30 + reach * 0.7, by + 35, 7, 3.2, { gloss: true });
  p.dots([[bx + 36 + reach * 0.7, by + 36], [bx + 36 + reach * 0.7, by + 37], [bx + 32 + reach * 0.7, by + 37]], 'bone4');
  // neck: S-curve, belly plates on the front
  const n0 = [bx + 20, by - 10], hx = bx + 50 + reach, hy = by - 44 + neckLift;
  const mid = [lerp(n0[0], hx, 0.45) - 4, lerp(n0[1], hy, 0.55)];
  p.shape(scale, (id) => { p.capsule(id, n0[0], n0[1], mid[0], mid[1], 12, 10); p.capsule(id, mid[0], mid[1], hx - 8, hy + 6, 10, 8.5); }, { dark: 1, shadow: 3, dither: true, gloss: true });
  for (let i = 0; i < 5; i += 1) { const [sx, sy] = pt([n0[0] + 9, n0[1] + 6], [hx - 1, hy + 12], 0.1 + i * 0.2); p.dots([[sx, sy], [sx + 1, sy], [sx + 2, sy]], 'belly3'); }
  // near wing: three bony fingers spreading up and back
  const wx = bx + 4, wy = by - 16;
  const tips = [[wx - 44, wy - 34 + flap], [wx - 26, wy - 58 + flap * 1.3], [wx - 2, wy - 62 + flap * 1.4], [wx + 18, wy - 44 + flap]];
  poly(p, 'membrane', [[wx, wy], tips[0], [wx - 30, wy - 22], tips[1], [wx - 16, wy - 34], tips[2], [wx, wy - 34], tips[3], [wx + 12, wy - 16]], { shadow: 2, dither: true, gloss: true });
  const elbow = [wx - 6, wy - 30 + flap * 0.6];
  limb(p, scale, [wx + 2, wy], elbow, 4, 3, { gloss: true });
  tips.forEach((tip) => limb(p, scale, elbow, tip, 2.4, 1, { gloss: true }));
  poly(p, 'bone', [[elbow[0] - 2, elbow[1] - 1], [elbow[0] - 1, elbow[1] - 7], [elbow[0] + 2, elbow[1] - 1]], { gloss: true });
  // head: horns, skull, long snout, jaw
  poly(p, 'bone', [[hx - 5, hy - 8], [hx - 26, hy - 18], [hx - 20, hy - 12], [hx - 8, hy - 2]], { gloss: true });
  poly(p, 'bone', [[hx + 1, hy - 10], [hx - 14, hy - 28], [hx - 8, hy - 24], [hx - 3, hy - 6]], { gloss: true });
  blob(p, scale, hx, hy, 13, 11, { gloss: true, shadow: 2, dither: true });
  const open = attack && f > 0 ? 8 : charge ? 6 : 0;
  poly(p, scale, [[hx + 4, hy - 8], [hx + 28, hy - 4], [hx + 31, hy + 1], [hx + 28, hy + 4], [hx + 6, hy + 5]], { gloss: true, shadow: 2 });
  poly(p, scale, [[hx + 2, hy + 4], [hx + 26, hy + 5 + open], [hx + 24, hy + 10 + open], [hx + 2, hy + 10]], { shadow: 2 });
  poly(p, scale, [[hx + 10, hy - 8], [hx + 16, hy - 12], [hx + 18, hy - 6]], { gloss: true });
  if (open) {
    poly(p, charge ? 'ember' : 'membrane', [[hx + 6, hy + 5], [hx + 26, hy + 5], [hx + 24, hy + 5 + open], [hx + 6, hy + 8]], { level: charge ? 4 : 1, line: false });
    for (let i = 0; i < 5; i += 1) { p.dot(hx + 9 + i * 4, hy + 5, 'fang'); p.dot(hx + 9 + i * 4, hy + 6, 'fang'); p.dot(hx + 10 + i * 4, hy + 4 + open, 'fang'); }
  } else for (let i = 0; i < 4; i += 1) p.dot(hx + 10 + i * 4, hy + 5, 'fang');
  p.dots([[hx + 28, hy - 2], [hx + 29, hy - 2]], 'ink');
  if (tired) { p.dots([[hx + 4, hy - 2], [hx + 5, hy - 2], [hx + 6, hy - 2], [hx + 7, hy - 2], [hx + 8, hy - 2]], 'ink'); zzz(p, Math.round(hx + 12), Math.round(hy - 30)); }
  else {
    glowEye(p, Math.round(hx + 5), Math.round(hy - 3), angry || charge ? 'white' : 'glow', angry ? 'red' : 'orange', 1);
    p.dots([[hx + 2, hy - 6], [hx + 3, hy - 6], [hx + 4, hy - 5], [hx + 5, hy - 5], [hx + 6, hy - 5], [hx + 7, hy - 5], [hx + 8, hy - 6]], 'ink');
  }
  if (charge) {
    smoke(p, Math.round(hx + 26), Math.round(hy - 10), f);
    for (let i = 0; i < 6; i += 1) sparkle(p, hx + 30 + ((i * 7 + f * 3) % 12) - 6, hy + 4 + ((i * 5) % 10) - 5, i % 2 === 0, i % 2 ? 'orange' : 'glow');
  }
  if (angry) [[bx - 24, by - 30], [bx - 4, by - 34], [bx + 16, by - 30], [bx - 40, by + 2], [bx + 30, by - 20]].forEach(([x, y], i) => {
    const h = 6 + ((i + f) % 2) * 4;
    poly(p, 'ember', [[x - 3, y + h], [x, y], [x + 3, y + h]], { gloss: true, line: false });
  });
  return done(p);
}

/** Wide, bulky boss humanoid pieces shared by the Demon King and Vampire Lord. */
function bossLimbs(p, s, { cloth, skin, boots, k = 1 }) {
  limb(p, cloth, s.backLeg.start, s.backLeg.knee, 6.5 * k, 5.2 * k, { dark: 1, shadow: 2 });
  limb(p, cloth, s.backLeg.knee, s.backLeg.foot, 5.2 * k, 4.2 * k, { dark: 1, shadow: 2 });
  poly(p, boots, [[s.backLeg.foot[0] - 5, s.backLeg.foot[1] - 5], [s.backLeg.foot[0] + 7, s.backLeg.foot[1] - 4], [s.backLeg.foot[0] + 9, s.backLeg.foot[1] + 1], [s.backLeg.foot[0] - 5, s.backLeg.foot[1] + 1]], { gloss: true });
  limb(p, cloth, s.backArm.shoulder, s.backArm.elbow, 5.4 * k, 4.6 * k);
  limb(p, skin, s.backArm.elbow, s.backArm.hand, 4 * k, 3.6 * k);
  blob(p, skin, s.backArm.hand[0], s.backArm.hand[1], 3.6 * k, 3.6 * k);
}
function bossFrontLeg(p, s, { cloth, boots, knee, k = 1 }) {
  limb(p, cloth, s.frontLeg.start, s.frontLeg.knee, 7 * k, 5.6 * k, { dark: 1, shadow: 2 });
  limb(p, cloth, s.frontLeg.knee, s.frontLeg.foot, 5.6 * k, 4.6 * k, { dark: 1, shadow: 2 });
  poly(p, boots, [[s.frontLeg.foot[0] - 5, s.frontLeg.foot[1] - 6], [s.frontLeg.foot[0] + 8, s.frontLeg.foot[1] - 4], [s.frontLeg.foot[0] + 10, s.frontLeg.foot[1] + 1], [s.frontLeg.foot[0] - 5, s.frontLeg.foot[1] + 1]], { gloss: true });
  if (knee) blob(p, knee, s.frontLeg.knee[0] + 1, s.frontLeg.knee[1], 4.4 * k, 4.4 * k, { gloss: true });
}

const DEMON_BODY = { thigh: 15, shin: 15, torso: 24, upperArm: 13, foreArm: 12, headLift: 15 };

function demonKing({ mode, f, angry }) {
  const p = new Painter(110, 128, LIGHT);
  const cast = mode === 'cast' || mode === 'charge';
  const poses = {
    idle: [{}, { bob: 1 }, { bob: 2 }, { bob: 1 }],
    attack: [{ x: 48, lean: -6, frontUpper: 140, frontFore: 160 }, { x: 52, lean: 8, frontUpper: 100, frontFore: 96 }, { x: 56, lean: 14, frontUpper: 92, frontFore: 90 }, { x: 52, lean: 6, frontUpper: 60, frontFore: 80 }],
    cast: [{ lean: -4, frontUpper: 150, frontFore: 170 }, { lean: -4, bob: 1, frontUpper: 156, frontFore: 172 }],
    charge: [{ lean: -6, frontUpper: 120, frontFore: 150 }, { lean: -6, bob: 1, frontUpper: 124, frontFore: 152 }],
    guard: [{ lean: -6, frontUpper: 60, frontFore: 150, backUpper: 80, backFore: 150 }, { lean: -6, bob: 1, frontUpper: 60, frontFore: 150, backUpper: 80, backFore: 150 }],
    tired: [{ lean: 18, head: 10, frontUpper: 20, frontFore: 10 }, { lean: 20, head: 12, bob: 1, frontUpper: 20, frontFore: 10 }],
  };
  const pose = { x: 50, ground: 125, backThigh: -16, backShin: -2, frontThigh: 20, frontShin: 2, frontUpper: 34, frontFore: 76, backUpper: -26, backFore: 0, ...(poses[mode] || poses.idle)[f % (poses[mode] || poses.idle).length] };
  const s = skeleton(pose, DEMON_BODY);
  const [nx, ny] = s.neck, [px, py] = s.hip;
  const spread = angry ? 8 : 0;
  // dark aura when angry
  if (angry) for (let i = 0; i < 8; i += 1) { const a = (i / 8) * Math.PI * 2 + f; sparkle(p, nx + Math.cos(a) * 34, ny + 20 + Math.sin(a) * 40, i % 2 === 0, i % 2 ? 'violet' : 'red'); }
  // cape: wide, dark outside, crimson lining
  poly(p, 'shadowCloth', [[nx - 16, ny - 4], [nx + 6, ny - 4], [px, py + 6], [px - 6, 124], [px - 36 - spread, 125], [px - 44 - spread, 104], [nx - 34 - spread, ny + 24], [nx - 26, ny + 2]], { shadow: 3, dither: true, gloss: true });
  poly(p, angry ? 'red' : 'crimson', [[nx - 14, ny + 2], [px - 6, py + 4], [px - 12, 122], [px - 34 - spread, 122], [px - 40 - spread, 104], [nx - 30 - spread, ny + 26]], { shadow: 2, dither: true });
  bossLimbs(p, s, { cloth: 'shadowCloth', skin: 'demon', boots: 'steel' });
  // armoured torso with a gold trim and a gem
  poly(p, 'shadowCloth', [[nx - 14, ny], [nx + 13, ny], [px + 12, py + 2], [px - 12, py + 2]], { shadow: 3, dither: true, gloss: true });
  const mid = pt(s.neck, s.hip, 0.62);
  poly(p, 'steel', [[nx - 12, ny + 2], [nx + 11, ny + 2], [mid[0] + 10, mid[1]], [mid[0], mid[1] + 5], [mid[0] - 10, mid[1]]], { gloss: true, shadow: 2 });
  poly(p, 'gold', [[nx - 2, ny + 3], [nx + 2, ny + 3], [mid[0] + 2, mid[1] + 3], [mid[0] - 2, mid[1] + 3]], { gloss: true, line: false });
  blob(p, angry ? 'ember' : 'crimson', nx, ny + 12, 3.2, 3.2, { gloss: true });
  poly(p, 'gold', [[px - 13, py - 3], [px + 13, py - 3], [px + 13, py + 2], [px - 13, py + 2]], { gloss: true });
  blob(p, 'crimson', px, py - 0.5, 2.4, 2.4, { gloss: true });
  poly(p, 'shadowCloth', [[px - 12, py + 1], [px + 12, py + 1], [px + 15, py + 18], [px + 4, py + 16], [px - 4, py + 19], [px - 14, py + 17]], { shadow: 2, dither: true });
  bossFrontLeg(p, s, { cloth: 'shadowCloth', boots: 'steel', knee: 'steel' });
  // head: purple skin, great horns, crown, glowing eyes, fangs
  const [hx, hy] = s.head;
  poly(p, 'bone', [[hx - 6, hy - 7], [hx - 24, hy - 26], [hx - 20, hy - 32], [hx - 2, hy - 11]], { gloss: true });
  blob(p, 'demon', hx, hy, 11, 12, { gloss: true, shadow: 2, dither: true });
  poly(p, 'demon', [[hx + 7, hy - 1], [hx + 14, hy + 3], [hx + 8, hy + 5]], { gloss: true });
  poly(p, 'bone', [[hx + 4, hy - 10], [hx + 12, hy - 30], [hx + 17, hy - 28], [hx + 9, hy - 7]], { gloss: true });
  p.shape('gold', (id) => p.poly(id, [[hx - 10, hy - 7], [hx + 11, hy - 8], [hx + 12, hy - 13], [hx + 8, hy - 10], [hx + 6, hy - 18], [hx + 2, hy - 12], [hx - 1, hy - 20], [hx - 4, hy - 12], [hx - 8, hy - 17], [hx - 10, hy - 11]]), { gloss: true });
  p.dots([[hx - 1, hy - 14], [hx - 1, hy - 13], [hx, hy - 14], [hx, hy - 13]], 'red');
  if (mode === 'tired') { p.dots([[hx + 1, hy - 1], [hx + 2, hy - 1], [hx + 3, hy - 1], [hx + 6, hy - 1], [hx + 7, hy - 1], [hx + 8, hy - 1]], 'ink'); zzz(p, Math.round(hx + 14), Math.round(hy - 34)); }
  else {
    glowEye(p, Math.round(hx + 1), Math.round(hy - 2), angry ? 'white' : 'glow', 'red', 1); glowEye(p, Math.round(hx + 7), Math.round(hy - 2), angry ? 'white' : 'glow', 'red', 1);
    p.dots([[hx - 1, hy - 5], [hx, hy - 5], [hx + 1, hy - 4], [hx + 2, hy - 4], [hx + 6, hy - 4], [hx + 7, hy - 5], [hx + 8, hy - 5], [hx + 9, hy - 5]], 'ink');
  }
  p.stamp(['kkkkkkk', 'kWkkkWk'], Math.round(hx + 1), Math.round(hy + 5), { k: 'ink', W: 'fang' });
  // front arm, huge spiked pauldron, dark orb
  limb(p, 'shadowCloth', s.frontArm.shoulder, s.frontArm.elbow, 6, 5.2); limb(p, 'demon', s.frontArm.elbow, s.frontArm.hand, 4.4, 4);
  blob(p, 'gold', lerp(s.frontArm.elbow[0], s.frontArm.hand[0], 0.7), lerp(s.frontArm.elbow[1], s.frontArm.hand[1], 0.7), 4.6, 4.6, { gloss: true });
  const [sx, sy] = s.frontArm.shoulder;
  blob(p, 'steel', sx, sy - 1, 9.5, 7, { gloss: true, shadow: 2 });
  [[-5, -6], [0, -8], [5, -6]].forEach(([dx, dy]) => poly(p, 'steel', [[sx + dx - 2.5, sy + dy + 2], [sx + dx, sy + dy - 7], [sx + dx + 2.5, sy + dy + 2]], { gloss: true }));
  const [ox, oy] = s.frontArm.hand;
  const orbR = mode === 'charge' ? 7 + f * 1.5 : cast ? 6 : mode === 'attack' && f > 0 ? 6.5 : 4.8;
  blob(p, 'shade', ox + 5, oy - 5, orbR, orbR, { gloss: true, dark: 1, shadow: 2 });
  p.dots([[ox + 3, oy - 8], [ox + 4, oy - 9], [ox + 2, oy - 7]], 'violet');
  blob(p, 'demon', ox, oy, 4, 4);
  if (cast || mode === 'charge') [[ox + 16, oy - 16], [ox - 6, oy - 12], [ox + 14, oy + 8]].forEach(([x, y], i) => sparkle(p, x, y + ((f + i) % 2), i === 0, i % 2 ? 'violet' : 'red'));
  return done(p);
}

function giantGolem(params) {
  const p = new Painter(120, 126, LIGHT);
  golemBody(p, params, 1.42, 120, 126);
  const angry = params.angry || params.mode === 'charge';
  const sink = params.mode === 'tired' ? 6 : 0;
  // crystal growths on the shoulders and glowing runes
  [[22, 30, 10], [30, 26, 14], [96, 28, 12], [88, 25, 8]].forEach(([x, y, h], i) => poly(p, angry ? 'ember' : 'crystal', [[x - 3, y + sink], [x + (i % 2 ? 1 : -1), y - h + sink], [x + 3, y + sink]], { gloss: true }));
  const rune = angry ? 'orange' : 'cyan';
  [[44, 64], [45, 65], [50, 60], [70, 60], [75, 64], [76, 65], [56, 82], [57, 83], [63, 82], [64, 83]].forEach(([x, y]) => p.dot(x, y + sink, rune));
  return done(p);
}

const VAMPIRE_BODY = { thigh: 18, shin: 19, torso: 26, upperArm: 13.5, foreArm: 13, headLift: 15 };

function vampireLord({ mode, f, angry }) {
  const p = new Painter(112, 128, LIGHT);
  const cast = mode === 'cast' || mode === 'charge';
  const poses = {
    idle: [{}, { bob: 1 }, { bob: 1 }, {}],
    attack: [{ x: 50, lean: -6, frontUpper: 150, frontFore: 170 }, { x: 56, lean: 10, frontUpper: 100, frontFore: 90 }, { x: 60, lean: 16, frontUpper: 80, frontFore: 60, swipe: true }, { x: 55, lean: 8, frontUpper: 50, frontFore: 40 }],
    cast: [{ lean: -4, frontUpper: 120, frontFore: 150 }, { lean: -4, bob: 1, frontUpper: 124, frontFore: 152 }],
    charge: [{ lean: -8, frontUpper: 150, frontFore: 170 }, { lean: -8, bob: 1, frontUpper: 152, frontFore: 172 }],
    tired: [{ lean: 16, head: 12, frontUpper: 18, frontFore: 8 }, { lean: 18, head: 14, bob: 1, frontUpper: 18, frontFore: 8 }],
  };
  const pose = { x: 52, ground: 125, backThigh: -12, backShin: -2, frontThigh: 16, frontShin: 2, frontUpper: 26, frontFore: 64, backUpper: -22, backFore: 6, ...(poses[mode] || poses.idle)[f % (poses[mode] || poses.idle).length] };
  const s = skeleton(pose, VAMPIRE_BODY);
  const [nx, ny] = s.neck, [px, py] = s.hip;
  const spread = angry || mode === 'charge' ? 1 : 0;
  // blood-red moon glow behind when angry
  if (angry) blob(p, 'crimson', nx - 16, ny - 18, 16, 16, { level: 1, line: false });
  // great bat-wing cape: scalloped, spreading wide when angry
  const capeTop = [nx - 10, ny - 8], capeTip = [nx - 46 - spread * 8, ny - 10 - spread * 14];
  const capePts = [capeTop, [nx + 8, ny - 8], [px + 6, py + 10], [px, 124], [px - 16, 118], [px - 26, 124], [px - 36 - spread * 6, 114], [px - 46 - spread * 8, 118], [capeTip[0] + 2, ny + 30], capeTip, [nx - 24, ny - 4]];
  poly(p, 'shadowCloth', capePts, { shadow: 3, dither: true, gloss: true });
  poly(p, 'crimson', [[nx - 10, ny - 2], [px - 2, py + 8], [px - 6, 116], [px - 16, 112], [px - 26, 118], [px - 34 - spread * 6, 108], [px - 42 - spread * 8, 110], [capeTip[0] + 6, ny + 28], [capeTip[0] + 6, ny - 4 - spread * 10]], { shadow: 2, dither: true });
  // cape ribs
  [[capeTip[0] + 6, ny + 28], [px - 34 - spread * 6, 108], [px - 16, 112]].forEach((end) => limb(p, 'shadowCloth', [nx - 12, ny], end, 1, 0.8, { level: 1, line: false }));
  bossLimbs(p, s, { cloth: 'shadowCloth', skin: 'skinPale', boots: 'shadowCloth', k: 0.85 });
  // long coat, crimson vest, white cravat, gold brooch
  poly(p, 'shadowCloth', [[nx - 12, ny], [nx + 11, ny], [px + 10, py + 2], [px + 15, py + 20], [px - 12, py + 20], [px - 11, py + 2]], { shadow: 3, dither: true, gloss: true });
  poly(p, 'crimson', [[nx - 3, ny + 3], [nx + 9, ny + 3], [px + 8, py], [px + 2, py + 5], [px - 2, py]], { gloss: true, shadow: 2 });
  poly(p, 'white', [[nx + 1, ny + 1], [nx + 8, ny + 1], [nx + 6, ny + 12], [nx + 3, ny + 12]], { gloss: true });
  blob(p, 'gold', nx + 4, ny + 3, 2.6, 2.6, { gloss: true });
  blob(p, 'crimson', nx + 4, ny + 3, 1.2, 1.2, { level: 4, line: false });
  bossFrontLeg(p, s, { cloth: 'shadowCloth', boots: 'shadowCloth', k: 0.85 });
  // high collar
  poly(p, 'crimson', [[nx - 12, ny + 2], [nx - 16, ny - 20], [nx - 4, ny - 8]], { shadow: 2 });
  poly(p, 'shadowCloth', [[nx + 8, ny + 2], [nx + 13, ny - 18], [nx + 5, ny - 5]], { gloss: true });
  // head: pale, silver hair swept back, red eyes, fangs, pointed ear
  const [hx, hy] = s.head;
  blob(p, 'skinPale', hx + 1, hy + 1, 9, 10.5, { gloss: true, shadow: 2 });
  poly(p, 'skinPale', [[hx + 7, hy], [hx + 12, hy + 3], [hx + 7, hy + 5]]);
  poly(p, 'skinPale', [[hx - 5, hy], [hx - 11, hy - 4], [hx - 6, hy + 4]], { gloss: true });
  poly(p, 'silver', [[hx - 10, hy + 4], [hx - 11, hy - 7], [hx - 4, hy - 12], [hx + 7, hy - 12], [hx + 11, hy - 6], [hx + 5, hy - 6], [hx + 2, hy - 2], [hx, hy - 6], [hx - 5, hy - 4], [hx - 6, hy + 5]], { gloss: true });
  poly(p, 'silver', [[hx - 9, hy - 2], [hx - 18, hy + 8], [hx - 8, hy + 6]], { gloss: true });
  if (mode === 'tired') { p.dots([[hx + 2, hy], [hx + 3, hy], [hx + 4, hy], [hx + 7, hy], [hx + 8, hy]], 'ink'); zzz(p, Math.round(hx + 14), Math.round(hy - 28)); }
  else {
    glowEye(p, Math.round(hx + 2), Math.round(hy - 1), angry || cast ? 'white' : 'red', 'crimson4', 1); glowEye(p, Math.round(hx + 7), Math.round(hy - 1), angry || cast ? 'white' : 'red', 'crimson4', 1);
    p.dots([[hx + 1, hy - 4], [hx + 2, hy - 4], [hx + 3, hy - 3], [hx + 7, hy - 3], [hx + 8, hy - 4], [hx + 9, hy - 4]], 'ink');
  }
  p.stamp(['kkkkkk', 'W....W'], Math.round(hx + 3), Math.round(hy + 6), { k: 'ink', W: 'fang' });
  // front arm with claws; the blood-moon orb when casting
  limb(p, 'shadowCloth', s.frontArm.shoulder, s.frontArm.elbow, 5, 4.4); limb(p, 'shadowCloth', s.frontArm.elbow, s.frontArm.hand, 4.4, 3.8);
  const cuff = pt(s.frontArm.elbow, s.frontArm.hand, 0.8);
  blob(p, 'white', cuff[0], cuff[1], 3.6, 3.6, { gloss: true });
  const [cx, cy] = s.frontArm.hand;
  blob(p, 'skinPale', cx, cy, 3.4, 3.4, { gloss: true });
  p.dots([[cx + 4, cy - 1], [cx + 5, cy], [cx + 4, cy + 2], [cx + 5, cy + 3], [cx + 3, cy + 4]], 'crimson4');
  if (cast) {
    const r = 6 + (mode === 'charge' ? f * 1.5 : 0);
    blob(p, 'crimson', cx + 7, cy - 7, r, r, { gloss: true, dark: 1, shadow: 2, dither: true });
    p.dots([[cx + 4, cy - 11], [cx + 5, cy - 11], [cx + 4, cy - 10]], 'white');
    sparkle(p, cx + 18, cy - 14 + f, true, 'red'); sparkle(p, cx - 4, cy - 16, false, 'red');
  }
  if (pose.swipe) arc(p, s.frontArm.shoulder[0], s.frontArm.shoulder[1], 30, -40, 60, 'crimson4', 4, 'white');
  if (angry) [[nx - 40, ny + 16], [nx + 34, ny - 6], [px + 26, py + 12]].forEach(([x, y], i) => sparkle(p, x, y + ((f + i) % 2), true, 'red'));
  return done(p);
}

// The Adventure quiz's practice target: a wooden post, a straw-padded body with
// a painted target and a stitched sack head. Friendly equipment, not a monster.
function trainingDummy({ mode, f }) {
  const p = new Painter(44, 64, LIGHT);
  const sway = mode === 'idle' ? [0, 1, 0, -1][f] : 0;
  const cx = 22, top = 18;
  // feet, post, crossbar
  poly(p, 'wood', [[11, 63], [33, 63], [30, 59], [14, 59]], { shadow: 1 });
  limb(p, 'wood', [cx, 60], [cx + sway, top], 2.4, 2, { gloss: true });
  limb(p, 'wood', [cx - 14 + sway, 33], [cx + 14 + sway, 33], 1.7, 1.7);
  p.dots([[cx - 15 + sway, 32], [cx + 15 + sway, 32]], 'wood1');
  // straw body with rope bands and a painted target
  blob(p, 'belly', cx + sway, 39, 9.5, 12.5, { dither: true, shadow: 2 });
  [30, 47].forEach((y) => p.shape('leather', (id) => p.rect(id, cx - 8 + sway, y, 17, 2), { line: false }));
  blob(p, 'red', cx + sway, 39, 5.2, 5.2, { line: false });
  blob(p, 'white', cx + sway, 39, 3.4, 3.4, { line: false });
  blob(p, 'red', cx + sway, 39, 1.6, 1.6, { line: false });
  // straw tufts
  p.dots([[cx - 9 + sway, 50], [cx - 7 + sway, 52], [cx + 8 + sway, 51], [cx + 10 + sway, 49], [cx + sway, 53]], 'belly4');
  // sack head with stitched eyes, tied at the neck
  blob(p, 'cream', cx + sway, top, 7, 7.5, { gloss: true });
  p.shape('leather', (id) => p.rect(id, cx - 4 + sway, top + 6, 9, 2), { line: false });
  [[-3, -1], [3, -1]].forEach(([dx, dy]) => p.stamp(['k.k', '.k.', 'k.k'], cx + dx - 1 + sway, top + dy - 1, { k: 'ink' }));
  p.stamp(['kkk'], cx - 1 + sway, top + 3, { k: 'leather1' });
  return done(p);
}

/** Props on the sprite pipeline that are not enemies (no battle data). */
export const PROP_ART = {
  trainingDummy: { draw: trainingDummy, modes: { idle: 4, attack: 1 } },
};

// Frame counts per drawn mode; derived rows (hit, defeat, dodge...) are built in pixel-sprites.js.
export const ENEMY_ART = {
  slime: { draw: slime, modes: { idle: 4, attack: 4, tired: 2, charge: 2 } },
  bat: { draw: bat, float: true, modes: { idle: 4, attack: 4, tired: 2 } },
  mushroom: { draw: mushroom, modes: { idle: 4, attack: 4, tired: 2 } },
  goblin: { draw: goblin, modes: { idle: 4, attack: 4, guard: 2, tired: 2 } },
  wolf: { draw: wolf, modes: { idle: 4, attack: 4, tired: 2, charge: 2 } },
  skeleton: { draw: skeletonFoe, modes: { idle: 4, attack: 4, tired: 2 } },
  shieldGoblin: { draw: shieldGoblin, modes: { idle: 4, attack: 4, guard: 2, tired: 2 } },
  healer: { draw: healer, modes: { idle: 4, attack: 4, cast: 3, tired: 2 } },
  golem: { draw: golem, large: true, modes: { idle: 4, attack: 4, charge: 2, tired: 2 } },
  goblinCaptain: { draw: goblinCaptain, large: true, modes: { idle: 4, attack: 4, charge: 2, guard: 2, tired: 2 } },
  hordeCommander: { draw: hordeCommander, large: true, modes: { idle: 4, attack: 4, charge: 2, guard: 2, tired: 2 } },
  necromancer: { draw: necromancer, float: true, modes: { idle: 4, attack: 4, cast: 3, charge: 2, tired: 2 } },
  dragon: { draw: dragon, boss: true, modes: { idle: 4, attack: 4, charge: 2, tired: 2 } },
  demonKing: { draw: demonKing, boss: true, modes: { idle: 4, attack: 4, cast: 2, charge: 2, guard: 2, tired: 2 } },
  giantGolem: { draw: giantGolem, boss: true, modes: { idle: 4, attack: 4, charge: 2, tired: 2 } },
  vampireLord: { draw: vampireLord, boss: true, modes: { idle: 4, attack: 4, cast: 2, charge: 2, tired: 2 } },
};
