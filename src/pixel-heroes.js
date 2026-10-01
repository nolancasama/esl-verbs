// The three heroes, drawn on the shaded rig (pixel-rig.js) in a 72x72 frame,
// facing right toward the enemies. Each state is a list of poses; a pose is a
// small set of joint angles plus extras (weapon angle, expression, effects).
import { Painter, along, skeleton } from './pixel-rig.js';
import { dissolve, grid, overlay, recolor } from './pixel-core.js';

export const HERO_FRAME = Object.freeze({ w: 72, h: 72 });

const BODY = {
  fighter: { thigh: 11, shin: 11.5, torso: 13.5, upperArm: 8, foreArm: 7.5, headLift: 10 },
  mage: { thigh: 10, shin: 10.5, torso: 13, upperArm: 7.5, foreArm: 7.5, headLift: 10 },
  ninja: { thigh: 10.5, shin: 11, torso: 13, upperArm: 8, foreArm: 7.5, headLift: 9.5 },
  osakaDefender: { thigh: 11, shin: 11.5, torso: 13.5, upperArm: 8, foreArm: 7.5, headLift: 10 },
};

/* ------------------------------------------------------------ shared bits */

const lerp = (a, b, t) => a + (b - a) * t;
const pt = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

function limb(p, material, from, to, r0, r1, opts) {
  return p.shape(material, (id) => p.capsule(id, from[0], from[1], to[0], to[1], r0, r1), opts);
}

function boot(p, material, foot, forward = 1) {
  const [x, y] = foot;
  return p.shape(material, (id) => p.poly(id, [[x - 3, y - 4], [x + 2, y - 4], [x + 3 + 2 * forward, y - 1], [x + 3 + 2 * forward, y + 1], [x - 3, y + 1]]));
}

function hand(p, material, at, r = 2.2) {
  return p.shape(material, (id) => p.ellipse(id, at[0], at[1], r, r));
}

/** Eyes and mouth for a head centred at (cx, cy), facing right. */
function face(p, cx, cy, { eyes = 'open', mouth = 'none', blush = true, eyeY = 1, iris = 'eye', spacing = 5 } = {}) {
  const ex = [Math.round(cx + 1), Math.round(cx + 1 + spacing)];
  const ey = Math.round(cy + eyeY);
  ex.forEach((x, index) => {
    if (eyes === 'open' || eyes === 'fierce') {
      p.dot(x, ey - 1, iris); p.dot(x, ey, iris); p.dot(x, ey + 1, iris);
      if (index === 1 || eyes === 'open') p.dot(x + 1, ey - 1, iris);
      p.dot(x + 1, ey, iris); p.dot(x + 1, ey + 1, iris);
      p.dot(x, ey - 1, 'white');
      if (eyes === 'fierce') { p.dot(x - 1, ey - 2, 'ink'); p.dot(x, ey - 2, 'ink'); p.dot(x + 1, ey - 2, 'ink'); p.dot(x + 1, ey - 1, 'ink'); }
    } else if (eyes === 'shut' || eyes === 'hurt') {
      p.dot(x, ey, 'ink'); p.dot(x + 1, ey, 'ink');
      if (eyes === 'hurt') { p.dot(x - 1, ey - 1, 'ink'); p.dot(x + 2, ey - 1, 'ink'); }
    } else if (eyes === 'happy') {
      p.dot(x - 1, ey + 1, 'ink'); p.dot(x, ey, 'ink'); p.dot(x + 1, ey, 'ink'); p.dot(x + 2, ey + 1, 'ink');
    }
  });
  if (blush) { p.dot(ex[0] - 1, ey + 3, 'blush'); p.dot(ex[1] + 2, ey + 3, 'blush'); }
  const mx = Math.round(cx + 4), my = Math.round(cy + 6);
  if (mouth === 'open') { p.dot(mx, my, 'ink'); p.dot(mx + 1, my, 'ink'); p.dot(mx, my + 1, 'red'); p.dot(mx + 1, my + 1, 'red'); }
  else if (mouth === 'grit') { p.dot(mx - 1, my, 'ink'); p.dot(mx, my, 'white'); p.dot(mx + 1, my, 'white'); p.dot(mx + 2, my, 'ink'); }
  else if (mouth === 'smile') { p.dot(mx - 1, my - 1, 'ink'); p.dot(mx, my, 'ink'); p.dot(mx + 1, my, 'ink'); p.dot(mx + 2, my - 1, 'ink'); }
  else if (mouth === 'line') { p.dot(mx, my, 'ink'); p.dot(mx + 1, my, 'ink'); }
}

function ear(p, hx, hy) {
  p.shape('skin', (id) => p.ellipse(id, hx - 5, hy + 1.5, 1.3, 2), { level: 3, line: false });
  p.dot(hx - 5, hy + 1.5, 'skin2');
}

function sparkle(p, x, y, big = false, key = 'spark') {
  p.dot(x, y, 'white');
  [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => p.dot(x + dx, y + dy, key));
  if (big) [[2, 0], [-2, 0], [0, 2], [0, -2]].forEach(([dx, dy]) => p.dot(x + dx, y + dy, key));
}

/** Motion arc: a crescent of detail pixels (sword trails). */
function arc(p, cx, cy, r, from, to, key = 'white', width = 2, edge = 'spark') {
  const steps = Math.ceil(Math.abs(to - from) / 3);
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps, a = ((from + (to - from) * t) * Math.PI) / 180;
    const thick = Math.max(1, Math.round(width * Math.sin(Math.PI * t) + 0.5));
    for (let k = 0; k < thick; k += 1) p.dot(cx + Math.cos(a) * (r - k), cy + Math.sin(a) * (r - k), k === 0 ? edge : key);
  }
}

/** A small potion flask in a hand. */
function potion(p, at) {
  const [x, y] = at;
  p.shape('crystal', (id) => { p.ellipse(id, x + 1, y - 3, 2.6, 2.6); p.rect(id, Math.round(x), Math.round(y - 8), 2, 3); }, { gloss: true });
  p.dots([[x, y - 3], [x + 1, y - 2], [x + 2, y - 3], [x + 1, y - 4]], 'red');
  p.dots([[x, y - 9], [x + 1, y - 9]], 'wood3');
}

/* ---------------------------------------------------------------- weapons */

function sword(p, handAt, deg, len = 20, glow = false) {
  const [dx, dy] = along(deg);
  const [hx, hy] = handAt;
  const guard = [hx + dx * 2.5, hy + dy * 2.5];
  const tip = [hx + dx * len, hy + dy * len];
  // grip and pommel behind the hand
  limb(p, 'leather', [hx - dx * 3, hy - dy * 3], [hx + dx, hy + dy], 1.1);
  p.shape('gold', (id) => p.ellipse(id, hx - dx * 4, hy - dy * 4, 1.2, 1.2));
  p.shape(glow ? 'ember' : 'steel', (id) => p.poly(id, [
    [guard[0] - dy * 1.6, guard[1] + dx * 1.6], [guard[0] + dy * 1.6, guard[1] - dx * 1.6],
    [tip[0] + dy * 0.6 - dx, tip[1] - dx * 0.6 - dy], [tip[0], tip[1]], [tip[0] - dy * 0.6 - dx, tip[1] + dx * 0.6 - dy],
  ]), { gloss: true, light: 1 });
  p.shape('gold', (id) => p.capsule(id, guard[0] - dy * 3.2, guard[1] + dx * 3.2, guard[0] + dy * 3.2, guard[1] - dx * 3.2, 1, 1));
  return tip;
}

function shield(p, center, bright = false) {
  const [cx, cy] = center;
  p.shape('gold', (id) => p.ellipse(id, cx, cy, 7.5, 9.5), { gloss: true });
  p.shape(bright ? 'crystal' : 'blue', (id) => p.ellipse(id, cx + 0.3, cy + 0.2, 5.6, 7.6), { line: false, dark: 1, shadow: 2 });
  p.shape('steel', (id) => p.ellipse(id, cx + 0.5, cy, 2, 2.2), { gloss: true });
  p.dot(cx - 3, cy - 5, 'white'); p.dot(cx - 2, cy - 6, 'white');
}

/** The same shield seen from behind: gold rim, wooden inside, two leather straps (the lower one is the grip). */
function shieldBack(p, center) {
  const [cx, cy] = center;
  p.shape('gold', (id) => p.ellipse(id, cx, cy, 7.5, 9.5));
  p.shape('wood', (id) => p.ellipse(id, cx - 0.3, cy + 0.2, 5.6, 7.6), { line: false, dark: 1, shadow: 2 });
  p.shape('leather', (id) => { p.capsule(id, cx - 4, cy - 3.5, cx + 4, cy - 3.5, 0.9, 0.9); p.capsule(id, cx - 4, cy + 3, cx + 5, cy + 3, 0.9, 0.9); }, { line: false });
}

function staff(p, handAt, deg, orbKey = 'crystal', orbSize = 3.4) {
  const [dx, dy] = along(deg);
  const [hx, hy] = handAt;
  const top = [hx + dx * 16, hy + dy * 16];
  limb(p, 'wood', [hx - dx * 12, hy - dy * 12], [hx + dx * 13, hy + dy * 13], 1.2);
  // gold claws cradle the orb
  p.shape('gold', (id) => {
    p.capsule(id, hx + dx * 12 - dy * 2.5, hy + dy * 12 + dx * 2.5, top[0] - dy * 3.5, top[1] + dx * 3.5, 0.9, 0.7);
    p.capsule(id, hx + dx * 12 + dy * 2.5, hy + dy * 12 - dx * 2.5, top[0] + dy * 3.5, top[1] - dx * 3.5, 0.9, 0.7);
    p.capsule(id, hx + dx * 11.5 - dy * 2.4, hy + dy * 11.5 + dx * 2.4, hx + dx * 11.5 + dy * 2.4, hy + dy * 11.5 - dx * 2.4, 1, 1);
  });
  p.shape(orbKey, (id) => p.ellipse(id, top[0], top[1], orbSize, orbSize), { gloss: true, dark: 1, shadow: 1 });
  p.dot(top[0] - 1, top[1] - 2, 'white'); p.dot(top[0] - 2, top[1] - 1, 'white');
  return top;
}

function dagger(p, handAt, deg, len = 11) {
  const [dx, dy] = along(deg);
  const [hx, hy] = handAt;
  const tip = [hx + dx * len, hy + dy * len];
  limb(p, 'navy', [hx - dx * 2.5, hy - dy * 2.5], [hx + dx, hy + dy], 1);
  p.shape('steel', (id) => p.poly(id, [[hx + dx * 1.5 - dy * 1.5, hy + dy * 1.5 + dx * 1.5], [hx + dx * 1.5 + dy * 1.5, hy + dy * 1.5 - dx * 1.5], [tip[0], tip[1]]]), { gloss: true });
  p.shape('red', (id) => p.ellipse(id, hx - dx * 3.5, hy - dy * 3.5, 1.3, 1.3));
  return tip;
}

/* ---------------------------------------------------------------- fighter */

function fighterHair(p, hx, hy) {
  p.shape('auburn', (id) => {
    // cap and bangs framing the face
    p.poly(id, [[hx - 8.5, hy + 2], [hx - 9, hy - 5], [hx - 5.5, hy - 9], [hx, hy - 10.5], [hx + 6, hy - 9], [hx + 8.5, hy - 5], [hx + 8.5, hy - 2],
      [hx + 6.5, hy - 3.5], [hx + 5, hy - 1], [hx + 3.5, hy - 4], [hx + 1.5, hy - 1.5], [hx - 0.5, hy - 4], [hx - 2.5, hy - 2], [hx - 4.5, hy + 2]]);
    // four broad spikes swept back
    p.poly(id, [[hx - 3, hy - 8], [hx - 17, hy - 10], [hx - 7, hy - 1]]);
    p.poly(id, [[hx, hy - 10], [hx - 13, hy - 16], [hx - 5, hy - 5]]);
    p.poly(id, [[hx + 4, hy - 9.5], [hx - 4, hy - 18], [hx - 2, hy - 7]]);
    p.poly(id, [[hx + 8, hy - 7], [hx + 5, hy - 15], [hx + 1, hy - 9]]);
    p.poly(id, [[hx - 7, hy - 1], [hx - 13, hy], [hx - 8, hy + 4]]);
  }, { gloss: true });
}

function drawFighter(pose = {}) {
  const p = new Painter(HERO_FRAME.w, HERO_FRAME.h);
  const s = skeleton(pose, BODY.fighter);
  const o = s.pose;
  const [hx, hy] = s.head;
  const [nx, ny] = s.neck, [px, py] = s.hip;

  // headband tails flutter behind the head
  const tail = o.tail ?? 0;
  p.shape('red', (id) => { p.capsule(id, hx - 7, hy - 4, hx - 16, hy - 6 + tail, 1.6, 1); p.capsule(id, hx - 7, hy - 3, hx - 14, hy + 1 + tail, 1.4, 0.8); });

  // back leg and back arm
  limb(p, 'indigo', s.backLeg.start, s.backLeg.knee, 3.6, 2.8);
  limb(p, 'indigo', s.backLeg.knee, s.backLeg.foot, 3, 2.2);
  boot(p, 'leather', s.backLeg.foot);
  // The shield is on the back arm. Raised (guard), only the upper arm is behind
  // the body; the forearm and shield are drawn in front of the torso below.
  // Lowered, it hangs on the far side of the body facing away from us, so we
  // see its inside, with the hand gripping its strap, behind the torso.
  limb(p, 'red', s.backArm.shoulder, s.backArm.elbow, 2.6, 2.2);
  if (!o.shieldUp) {
    shieldBack(p, [s.backArm.hand[0] - 5, s.backArm.hand[1] - 3]);
    limb(p, 'leather', s.backArm.elbow, s.backArm.hand, 2.2, 2);
    hand(p, 'leather', s.backArm.hand, 2.1);
  }

  // torso: tunic with a flared skirt, breastplate, belt; the shield hangs behind
  const waist = pt(s.neck, s.hip, 0.72);
  p.shape('red', (id) => p.poly(id, [[nx - 7.5, ny + 1], [nx + 6.5, ny + 1], [waist[0] + 6, waist[1]], [px + 8.5, py + 7], [px - 8.5, py + 7], [waist[0] - 6.5, waist[1]]]), { shadow: 2 });
  p.shape('steel', (id) => p.poly(id, [[nx - 6.5, ny + 1.5], [nx + 6.5, ny + 1.5], [waist[0] + 6.5, waist[1] - 2], [waist[0] + 1, waist[1] + 1], [waist[0] - 6.5, waist[1] - 2]]), { gloss: true, shadow: 2 });
  p.shape('leather', (id) => p.poly(id, [[px - 7.5, py - 1.5], [px + 7.5, py - 1.5], [px + 7.5, py + 1.5], [px - 7.5, py + 1.5]]));
  p.shape('gold', (id) => p.rect(id, Math.round(px + 1), Math.round(py - 1.5), 3, 3), { gloss: true });

  // front leg with a knee guard
  limb(p, 'indigo', s.frontLeg.start, s.frontLeg.knee, 3.8, 3);
  limb(p, 'indigo', s.frontLeg.knee, s.frontLeg.foot, 3.1, 2.3);
  boot(p, 'leather', s.frontLeg.foot);
  p.shape('steel', (id) => p.ellipse(id, s.frontLeg.knee[0] + 0.5, s.frontLeg.knee[1] - 0.5, 2.2, 2.2), { gloss: true });

  // head
  p.shape('skin', (id) => p.ellipse(id, hx, hy, 7.8, 8.2));
  ear(p, hx, hy);
  fighterHair(p, hx, hy);
  p.shape('red', (id) => p.poly(id, [[hx - 8, hy - 5.5], [hx + 8, hy - 6.5], [hx + 8.5, hy - 4], [hx - 8, hy - 3]]));
  face(p, hx, hy, { eyes: o.eyes, mouth: o.mouth });

  if (o.shieldUp) {
    // Guarding: the back forearm comes forward across the body and holds the shield out front.
    limb(p, 'leather', s.backArm.elbow, s.backArm.hand, 2.2, 2);
    hand(p, 'leather', s.backArm.hand, 2.1);
    shield(p, [s.backArm.hand[0] + 1.5, s.backArm.hand[1]], o.flashShield);
  }

  // front arm: sword behind the fist, pauldron on the shoulder
  limb(p, 'red', s.frontArm.shoulder, s.frontArm.elbow, 2.8, 2.4);
  if (!o.noSword) sword(p, s.frontArm.hand, o.weapon, o.swordLen ?? 21, o.glow);
  limb(p, 'leather', s.frontArm.elbow, s.frontArm.hand, 2.4, 2.1);
  hand(p, 'leather', s.frontArm.hand, 2.4);
  if (o.potion) potion(p, s.frontArm.hand);
  p.shape('steel', (id) => p.ellipse(id, s.frontArm.shoulder[0] + 0.5, s.frontArm.shoulder[1] - 0.5, 4.2, 3.4), { gloss: true });

  (o.fx || []).forEach((effect) => effect(p, s));
  return p.render();
}

/* --------------------------------------------------------- osaka defender */

// The Sakai guest ally: blue and white with a crested helmet, a spear and a
// small round shield, so it reads as a local guard rather than a fourth hero.
function spear(p, handAt, deg, tassel = true) {
  const [dx, dy] = along(deg);
  const [hx, hy] = handAt;
  const tip = [hx + dx * 20, hy + dy * 20];
  limb(p, 'wood', [hx - dx * 14, hy - dy * 14], [hx + dx * 15, hy + dy * 15], 1, 1, { gloss: true });
  if (tassel) p.shape('red', (id) => p.ellipse(id, hx + dx * 14.5 - dy * 1.2, hy + dy * 14.5 + dx * 1.2, 1.6, 1.6));
  p.shape('steel', (id) => p.poly(id, [
    [hx + dx * 14.5 - dy * 1.8, hy + dy * 14.5 + dx * 1.8], [hx + dx * 14.5 + dy * 1.8, hy + dy * 14.5 - dx * 1.8], [tip[0], tip[1]],
  ]), { gloss: true, light: 1 });
  return tip;
}

function roundShield(p, center, bright = false) {
  const [cx, cy] = center;
  p.shape('white', (id) => p.ellipse(id, cx, cy, 5.5, 6.5), { gloss: true });
  p.shape(bright ? 'crystal' : 'blue', (id) => p.ellipse(id, cx + 0.3, cy + 0.2, 3.6, 4.6), { line: false, dark: 1 });
  p.dot(cx, cy, 'gold4'); p.dot(cx + 1, cy, 'gold3');
  p.dot(cx - 2, cy - 4, 'white');
}

function drawDefender(pose = {}) {
  const p = new Painter(HERO_FRAME.w, HERO_FRAME.h);
  const s = skeleton(pose, BODY.osakaDefender);
  const o = s.pose;
  const [hx, hy] = s.head;
  const [nx, ny] = s.neck, [px, py] = s.hip;

  limb(p, 'navy', s.backLeg.start, s.backLeg.knee, 3.5, 2.8);
  limb(p, 'navy', s.backLeg.knee, s.backLeg.foot, 3, 2.2);
  boot(p, 'leather', s.backLeg.foot);
  limb(p, 'blue', s.backArm.shoulder, s.backArm.elbow, 2.5, 2.2);
  if (!o.shieldUp) {
    limb(p, 'white', s.backArm.elbow, s.backArm.hand, 2.2, 2);
    hand(p, 'skin', s.backArm.hand, 2);
    roundShield(p, [s.backArm.hand[0] - 1, s.backArm.hand[1] - 2]);
  }

  // blue tabard with white trim over white plate, a navy sash
  const waist = pt(s.neck, s.hip, 0.72);
  p.shape('blue', (id) => p.poly(id, [[nx - 7, ny + 1], [nx + 6.5, ny + 1], [waist[0] + 6, waist[1]], [px + 8, py + 8], [px - 8, py + 8], [waist[0] - 6.5, waist[1]]]), { shadow: 2 });
  p.shape('white', (id) => p.poly(id, [[px - 8, py + 6], [px + 8, py + 6], [px + 8, py + 8], [px - 8, py + 8]]), { line: false });
  p.shape('white', (id) => p.poly(id, [[nx - 6, ny + 1.5], [nx + 6, ny + 1.5], [waist[0] + 5.5, waist[1] - 2], [waist[0] - 6, waist[1] - 2]]), { gloss: true, shadow: 2 });
  p.shape('blue', (id) => p.poly(id, [[nx - 1, ny + 2], [nx + 2, ny + 2], [waist[0] + 1.5, waist[1] - 2.5], [waist[0] - 1.5, waist[1] - 2.5]]), { line: false });
  p.shape('navy', (id) => p.poly(id, [[px - 7.5, py - 1.5], [px + 7.5, py - 1.5], [px + 7.5, py + 1.5], [px - 7.5, py + 1.5]]));

  limb(p, 'navy', s.frontLeg.start, s.frontLeg.knee, 3.7, 3);
  limb(p, 'navy', s.frontLeg.knee, s.frontLeg.foot, 3.1, 2.3);
  boot(p, 'leather', s.frontLeg.foot);
  p.shape('white', (id) => p.ellipse(id, s.frontLeg.knee[0] + 0.5, s.frontLeg.knee[1] - 0.5, 2.1, 2.1), { gloss: true });

  // head: short dark hair under a rounded helmet with a gold crescent crest
  p.shape('skin', (id) => p.ellipse(id, hx, hy, 7.6, 8));
  ear(p, hx, hy);
  p.shape('shadowCloth', (id) => p.poly(id, [[hx - 8.5, hy + 3], [hx - 8.5, hy - 3], [hx - 3, hy - 2], [hx - 5, hy + 4]]));
  p.shape('steel', (id) => { p.ellipse(id, hx - 0.5, hy - 5, 9, 5.8); p.rect(id, Math.round(hx - 9.5), Math.round(hy - 4), 3, 7); }, { gloss: true });
  p.shape('blue', (id) => p.rect(id, Math.round(hx - 9), Math.round(hy - 3.5), 18, 2), { line: false });
  p.shape('gold', (id) => { p.capsule(id, hx + 1, hy - 9, hx - 4, hy - 16, 1, 0.6); p.capsule(id, hx + 1, hy - 9, hx + 7, hy - 15, 1, 0.6); }, { gloss: true });
  face(p, hx, hy, { eyes: o.eyes, mouth: o.mouth });

  if (o.shieldUp) {
    limb(p, 'white', s.backArm.elbow, s.backArm.hand, 2.2, 2);
    hand(p, 'skin', s.backArm.hand, 2);
    roundShield(p, [s.backArm.hand[0] + 1.5, s.backArm.hand[1]], o.flashShield);
  }

  limb(p, 'blue', s.frontArm.shoulder, s.frontArm.elbow, 2.7, 2.4);
  spear(p, s.frontArm.hand, o.weapon);
  limb(p, 'white', s.frontArm.elbow, s.frontArm.hand, 2.3, 2.1);
  hand(p, 'skin', s.frontArm.hand, 2.2);
  p.shape('white', (id) => p.ellipse(id, s.frontArm.shoulder[0] + 0.5, s.frontArm.shoulder[1] - 0.5, 4, 3.2), { gloss: true });

  (o.fx || []).forEach((effect) => effect(p, s));
  return p.render();
}

/* ------------------------------------------------------------------- mage */

function drawMage(pose = {}) {
  const p = new Painter(HERO_FRAME.w, HERO_FRAME.h);
  const s = skeleton(pose, BODY.mage);
  const o = s.pose;
  const [hx, hy] = s.head;
  const [nx, ny] = s.neck, [px, py] = s.hip;
  const ground = o.ground - (o.lift ?? 0);

  // back sleeve and hand
  limb(p, 'violet', s.backArm.shoulder, s.backArm.elbow, 2.6, 2.8);
  limb(p, 'violet', s.backArm.elbow, s.backArm.hand, 2.8, 3.2);
  hand(p, 'skin', s.backArm.hand, 2);

  // boots peek out under the robe
  boot(p, 'leather', [s.backLeg.foot[0], s.backLeg.foot[1]]);
  boot(p, 'leather', [s.frontLeg.foot[0], s.frontLeg.foot[1]]);

  // robe: shoulders to a wide hem, with gold trim, an inner panel and a sash
  const kneel = (o.backThigh ?? 0) > 40;
  const hemBack = Math.min(s.backLeg.foot[0], px) - 7, hemFront = Math.max(s.frontLeg.foot[0], px) + 6;
  const hemY = Math.min(ground - 4, Math.max(s.backLeg.foot[1], s.frontLeg.foot[1]) - 4) + (kneel ? 2 : 0);
  const flare = o.flare ?? 0;
  p.shape('violet', (id) => p.poly(id, [[nx - 6, ny + 1], [nx + 5, ny + 1], [px + 5.5, py - 2], [hemFront + flare, hemY], [hemFront - 3, hemY + 1.5], [hemBack + 3, hemY + 1.5], [hemBack - flare, hemY], [px - 6.5, py - 2]]), { shadow: 2, dither: true });
  p.shape('gold', (id) => p.poly(id, [[hemBack - flare, hemY - 2], [hemFront + flare, hemY - 2], [hemFront + flare, hemY], [hemFront - 3, hemY + 1.5], [hemBack + 3, hemY + 1.5], [hemBack - flare, hemY]]), { gloss: true });
  p.shape('indigo', (id) => p.poly(id, [[nx + 1, ny + 2], [nx + 4, ny + 2], [px + 4, py], [lerp(px, hemFront, 0.6), hemY - 2], [lerp(px, hemFront, 0.2), hemY - 2], [px + 1, py]]));
  p.shape('gold', (id) => p.poly(id, [[px - 6.5, py - 3], [px + 6, py - 3], [px + 6, py], [px - 6.5, py]]), { gloss: true });
  p.shape('crystal', (id) => p.ellipse(id, px + 3, py - 1.5, 1.6, 1.6), { gloss: true });
  p.shape('indigo', (id) => p.poly(id, [[nx - 7, ny], [nx + 5, ny], [nx + 6, ny + 4], [nx - 8, ny + 5]]));

  // head: silver bob, face, wizard hat with a star
  p.shape('silver', (id) => p.poly(id, [[hx - 8, hy - 3], [hx + 7, hy - 4], [hx + 8, hy + 3], [hx + 5, hy + 1], [hx - 3, hy + 6], [hx - 8.5, hy + 6]]), { gloss: true });
  p.shape('skin', (id) => p.ellipse(id, hx + 0.5, hy + 0.5, 7.4, 7.8));
  ear(p, hx + 0.5, hy);
  p.shape('silver', (id) => p.poly(id, [[hx - 7.5, hy - 4], [hx + 8, hy - 5], [hx + 8, hy - 1], [hx + 6, hy - 2.5], [hx + 4, hy], [hx + 2.5, hy - 2.5], [hx, hy - 0.5], [hx - 3, hy - 2], [hx - 5, hy + 3], [hx - 7.5, hy + 4]]), { gloss: true });
  const tip = o.hatTip ?? 0;
  p.shape('violet', (id) => p.poly(id, [[hx - 7, hy - 6], [hx + 7, hy - 7], [hx + 3, hy - 14], [hx - 3 - tip * 0.3, hy - 20], [hx - 10 - tip, hy - 22 + tip * 0.5], [hx - 5, hy - 15]]), { shadow: 2 });
  p.shape('gold', (id) => p.poly(id, [[hx - 7.5, hy - 9], [hx + 6, hy - 10], [hx + 6.5, hy - 7.5], [hx - 7.5, hy - 6.5]]), { gloss: true });
  p.shape('violet', (id) => p.ellipse(id, hx, hy - 6, 12.5, 2.4));
  p.stamp(['.y.', 'yYy', '.y.'], Math.round(hx - 1), Math.round(hy - 15), { y: 'gold4', Y: 'white' });
  face(p, hx + 0.5, hy + 0.5, { eyes: o.eyes, mouth: o.mouth, spacing: 5 });

  // front sleeve, staff, cuff, hand
  limb(p, 'violet', s.frontArm.shoulder, s.frontArm.elbow, 2.8, 3);
  if (!o.noStaff) staff(p, s.frontArm.hand, o.weapon, o.orb ?? 'crystal', o.orbSize ?? 3.4);
  limb(p, 'violet', s.frontArm.elbow, s.frontArm.hand, 3, 3.4);
  p.shape('gold', (id) => p.ellipse(id, lerp(s.frontArm.elbow[0], s.frontArm.hand[0], 0.8), lerp(s.frontArm.elbow[1], s.frontArm.hand[1], 0.8), 2.4, 2.4), { gloss: true });
  hand(p, 'skin', s.frontArm.hand, 2.1);

  (o.fx || []).forEach((effect) => effect(p, s));
  return p.render();
}

/* ------------------------------------------------------------------ ninja */

function drawNinja(pose = {}) {
  const p = new Painter(HERO_FRAME.w, HERO_FRAME.h);
  const s = skeleton(pose, BODY.ninja);
  const o = s.pose;
  const [hx, hy] = s.head;
  const [nx, ny] = s.neck, [px, py] = s.hip;

  // long scarf streaming behind
  const wave = o.scarf ?? 0;
  p.shape('red', (id) => {
    p.capsule(id, nx - 2, ny - 1, nx - 11, ny - 2 + wave * 0.6, 1.9, 1.5);
    p.capsule(id, nx - 11, ny - 2 + wave * 0.6, nx - 20, ny - 1 - wave * 0.4, 1.5, 0.9);
  }, { gloss: true });
  p.shape('red', (id) => {
    p.capsule(id, nx - 2, ny + 1, nx - 10, ny + 3 + wave * 0.3, 1.5, 1.2);
    p.capsule(id, nx - 10, ny + 3 + wave * 0.3, nx - 17, ny + 5 - wave * 0.5, 1.2, 0.8);
  });

  // back leg, back arm
  limb(p, 'navy', s.backLeg.start, s.backLeg.knee, 3.2, 2.6);
  limb(p, 'navy', s.backLeg.knee, s.backLeg.foot, 2.6, 2);
  p.shape('steel', (id) => p.capsule(id, ...pt(s.backLeg.knee, s.backLeg.foot, 0.3), ...pt(s.backLeg.knee, s.backLeg.foot, 0.8), 2.3, 2), { gloss: true });
  boot(p, 'navy', s.backLeg.foot, 0.5);
  limb(p, 'navy', s.backArm.shoulder, s.backArm.elbow, 2.4, 2);
  limb(p, 'navy', s.backArm.elbow, s.backArm.hand, 2, 1.8);
  hand(p, 'navy', s.backArm.hand, 1.9);
  if (o.backBlade) dagger(p, s.backArm.hand, o.backBlade, 9);

  // torso: wrapped top, red sash
  const waist = pt(s.neck, s.hip, 0.75);
  p.shape('navy', (id) => p.poly(id, [[nx - 5.5, ny + 1], [nx + 5, ny + 1], [waist[0] + 5, waist[1]], [px + 6, py + 5], [px - 6, py + 5], [waist[0] - 5, waist[1]]]), { shadow: 2 });
  p.shape('indigo', (id) => p.poly(id, [[nx - 1, ny + 1], [nx + 3, ny + 1], [waist[0] + 4, waist[1] - 1], [waist[0] + 1, waist[1]]]));
  p.shape('red', (id) => p.poly(id, [[px - 6.5, py - 2.5], [px + 6.5, py - 2.5], [px + 6.5, py + 1], [px - 6.5, py + 1]]), { gloss: true });
  p.shape('red', (id) => p.poly(id, [[px - 5, py], [px - 8, py + 7], [px - 5, py + 7], [px - 3, py + 1]]));

  // front leg
  limb(p, 'navy', s.frontLeg.start, s.frontLeg.knee, 3.4, 2.7);
  limb(p, 'navy', s.frontLeg.knee, s.frontLeg.foot, 2.7, 2);
  p.shape('steel', (id) => p.capsule(id, ...pt(s.frontLeg.knee, s.frontLeg.foot, 0.3), ...pt(s.frontLeg.knee, s.frontLeg.foot, 0.8), 2.4, 2.1), { gloss: true });
  boot(p, 'navy', s.frontLeg.foot, 0.5);

  // head: hood, face slit, mask, headband with a plate
  p.shape('navy', (id) => p.ellipse(id, hx, hy, 8, 8.4), { shadow: 2 });
  p.shape('red', (id) => { p.capsule(id, hx - 7, hy - 5, hx - 11, hy - 7 + wave * 0.4, 1.2, 0.8); p.capsule(id, hx - 7, hy - 4, hx - 10, hy - 2 + wave * 0.3, 1.1, 0.7); });
  p.shape('skin', (id) => p.poly(id, [[hx - 1, hy - 3], [hx + 8.5, hy - 3.5], [hx + 8.5, hy + 1.5], [hx - 1, hy + 1.5]]), { line: false });
  p.shape('indigo', (id) => p.poly(id, [[hx - 2, hy + 1.5], [hx + 8.5, hy + 1.5], [hx + 7, hy + 7], [hx, hy + 8]]), { gloss: true });
  p.shape('red', (id) => p.poly(id, [[hx - 8, hy - 6], [hx + 7, hy - 8], [hx + 8, hy - 5.5], [hx - 8, hy - 3.5]]), { gloss: true });
  p.stamp(['sss', 'sSs'], Math.round(hx + 1), Math.round(hy - 8), { s: 'steel3', S: 'white' });
  face(p, hx, hy - 1.5, { eyes: o.eyes, mouth: 'none', blush: false, eyeY: 0, spacing: 4.5 });

  // front arm and blade
  limb(p, 'navy', s.frontArm.shoulder, s.frontArm.elbow, 2.6, 2.2);
  if (!o.noBlade) dagger(p, s.frontArm.hand, o.weapon, o.bladeLen ?? 12);
  p.shape('steel', (id) => p.capsule(id, ...pt(s.frontArm.elbow, s.frontArm.hand, 0.15), ...pt(s.frontArm.elbow, s.frontArm.hand, 0.8), 2.4, 2.1), { gloss: true });
  hand(p, 'navy', s.frontArm.hand, 2);
  if (o.potion) potion(p, s.frontArm.hand);

  (o.fx || []).forEach((effect) => effect(p, s));
  return p.render();
}

/* ------------------------------------------------------------------- poses */

const WEAPON_LEN = { fighter: 21, mage: 16, ninja: 12 };
const swing = (from, to, r = 26, width = 3, key = 'white', edge = 'spark') => (p, s) => arc(p, s.frontArm.shoulder[0], s.frontArm.shoulder[1], r, from, to, key, width, edge);
const sparks = (list, key = 'spark') => (p) => list.forEach(([x, y, big]) => sparkle(p, x, y, big, key));
const tipSpark = (big = true, key = 'spark') => (p, s) => {
  const [dx, dy] = along(s.pose.weapon);
  const len = WEAPON_LEN[s.pose.id] ?? 20;
  sparkle(p, s.frontArm.hand[0] + dx * len, s.frontArm.hand[1] + dy * len, big, key);
};
const sweat = (p, s) => { const [hx, hy] = s.head; p.dot(hx + 9, hy - 4, 'cyan'); p.dot(hx + 9, hy - 3, 'cyan'); p.dot(hx + 10, hy - 3, 'white'); p.dot(hx + 9, hy - 2, 'cyan'); };
/** A small "!" over the head: surprised, not hurt (a wrong quiz answer). */
const oops = (p, s) => { const [hx, hy] = s.head; const x = Math.round(hx + 10), y = Math.round(hy - 14); [0, 1, 2, 3].forEach((d) => { p.dot(x, y + d, 'gold4'); p.dot(x + 1, y + d, 'gold4'); }); p.dot(x, y + 5, 'gold4'); p.dot(x + 1, y + 5, 'gold4'); };
const puff = (p, s) => { const [x, y] = s.backLeg.foot; [[-4, 0], [-7, -2], [-10, 0]].forEach(([dx, dy]) => sparkle(p, x + dx, y + dy - 1, false, 'speed')); };
const streaks = (y0 = 26, len = 18, x0 = 22) => (p) => [0, 6, 12].forEach((dy, i) => { for (let k = 0; k < len - i * 3; k += 1) if (k % 6 !== 5) p.dot(x0 - k, y0 + dy, 'speed'); });
const ring = (color, r = 10) => (p, s) => {
  const [cx, cy] = [s.hip[0], s.hip[1] - 8];
  for (let a = 0; a < 360; a += 12) if ((a / 12) % 2 === 0) p.dot(cx + Math.cos((a * Math.PI) / 180) * r, cy + Math.sin((a * Math.PI) / 180) * r * 1.3, color);
};

const F = (extra) => ({ id: 'fighter', ...extra });
const M = (extra) => ({ id: 'mage', ...extra });
const N = (extra) => ({ id: 'ninja', ...extra });
// The ninja's low ready stance, shared by many frames.
const NS = { lean: 14, backThigh: -34, backShin: 6, frontThigh: 44, frontShin: -4, frontUpper: 40, frontFore: 90, weapon: 20, backUpper: -30, backFore: 10 };
const LUNGE = { backThigh: -34, backShin: -12, frontThigh: 42, frontShin: 12 };
const KNEEL = { backThigh: 74, backShin: -88, frontThigh: 80, frontShin: -2 };
// The fighter's raised shield: the back arm reaches forward from its own shoulder.
const SHIELD_UP = { shieldUp: true, backUpper: 40, backFore: 100 };

export const POSES = {
  fighter: {
    idle: [F({}), F({ bob: 1, frontFore: 62, backFore: -2, weapon: 124, tail: 1 }), F({ bob: 1, frontFore: 62, backFore: -2, weapon: 124, tail: 2 }), F({ tail: 1 })],
    attack: [
      F({ lean: -6, backThigh: -14, frontThigh: 20, frontUpper: 196, frontFore: 214, weapon: 250, eyes: 'fierce', mouth: 'grit', tail: 2 }),
      F({ x: 36, lean: 10, backThigh: -30, backShin: -10, frontThigh: 36, frontShin: 10, frontUpper: 164, frontFore: 150, weapon: 170, eyes: 'fierce', mouth: 'grit', tail: 3, fx: [streaks(34, 14, 18)] }),
      F({ x: 40, lean: 18, ...LUNGE, frontUpper: 100, frontFore: 78, weapon: 70, eyes: 'fierce', mouth: 'open', tail: 4, fx: [swing(-80, 40, 28, 4)] }),
      F({ x: 40, lean: 20, ...LUNGE, frontUpper: 58, frontFore: 28, weapon: 18, eyes: 'fierce', tail: 3, fx: [swing(10, 70, 27, 2, 'spark', 'white')] }),
      F({ x: 36, lean: 8, frontUpper: 30, frontFore: 72, weapon: 112, tail: 1 }),
    ],
    special: [
      F({ lean: 12, backThigh: -44, backShin: 18, frontThigh: 56, frontShin: -8, frontUpper: 204, frontFore: 236, weapon: 262, eyes: 'fierce', mouth: 'grit', tail: 1, glow: true, fx: [sparks([[14, 30], [52, 34], [20, 58], [50, 60, true]], 'orange')] }),
      F({ x: 34, lift: 9, lean: 4, backThigh: 30, backShin: -30, frontThigh: 60, frontShin: 4, frontUpper: 156, frontFore: 166, weapon: 172, eyes: 'fierce', mouth: 'open', tail: 4, glow: true, fx: [tipSpark(true, 'orange'), streaks(58, 10, 34)] }),
      F({ x: 36, lift: 11, lean: -4, backThigh: 34, backShin: -24, frontThigh: 62, frontShin: 8, frontUpper: 190, frontFore: 204, weapon: 214, eyes: 'fierce', mouth: 'grit', tail: 5, glow: true, fx: [tipSpark(true, 'glow')] }),
      F({ x: 40, lift: 3, lean: 22, backThigh: -36, backShin: -14, frontThigh: 46, frontShin: 14, frontUpper: 92, frontFore: 62, weapon: 52, eyes: 'fierce', mouth: 'open', tail: 5, glow: true, fx: [swing(-110, 55, 30, 5, 'glow', 'white')] }),
      F({ x: 40, lean: 26, backThigh: -48, backShin: -16, frontThigh: 58, frontShin: 18, frontUpper: 52, frontFore: 18, weapon: 8, eyes: 'fierce', mouth: 'grit', tail: 3, glow: true, fx: [sparks([[62, 64, true], [54, 60], [66, 58]], 'orange')] }),
      F({ x: 35, lean: 8, frontUpper: 30, frontFore: 70, weapon: 112, tail: 1 }),
    ],
    guard: [
      F({ bob: 1, lean: -3, backThigh: -26, frontThigh: 30, frontUpper: -16, frontFore: 24, weapon: 30, ...SHIELD_UP, eyes: 'fierce', mouth: 'grit', tail: 2 }),
      F({ bob: 1, lean: -3, backThigh: -26, frontThigh: 30, frontUpper: -16, frontFore: 24, weapon: 30, ...SHIELD_UP, eyes: 'fierce', mouth: 'grit', tail: 1, fx: [sparks([[45, 32, true]], 'white')] }),
      F({ bob: 1, lean: -3, backThigh: -26, frontThigh: 30, frontUpper: -16, frontFore: 24, weapon: 30, ...SHIELD_UP, eyes: 'fierce', mouth: 'grit', tail: 2 }),
    ],
    dodge: [
      F({ x: 28, lift: 3, lean: -12, backThigh: -30, frontThigh: 40, frontShin: 20, eyes: 'fierce', ghosts: [[4, 0]] }),
      F({ x: 24, lift: 5, lean: -10, backThigh: -34, frontThigh: 44, frontShin: 24, eyes: 'fierce', ghosts: [[8, 0], [4, 0]] }),
      F({ x: 26, lean: -4, eyes: 'fierce', fx: [puff] }),
      F({ x: 30 }),
    ],
    hit: [
      F({ flash: true }),
      F({ x: 27, lean: -18, head: -10, backThigh: -8, frontThigh: 34, frontUpper: -30, frontFore: -40, weapon: 210, backUpper: -50, eyes: 'hurt', mouth: 'open', tail: 5 }),
      F({ x: 30, lean: -6, eyes: 'shut', mouth: 'grit', tail: 2 }),
    ],
    defeat: [
      F({ x: 27, lean: -18, head: -10, frontUpper: -30, frontFore: -40, weapon: 210, eyes: 'hurt', mouth: 'open', tail: 5 }),
      F({ x: 28, lean: -24, head: -12, backThigh: -4, frontThigh: 30, frontUpper: -10, frontFore: 0, weapon: 230, eyes: 'shut', mouth: 'open', tail: 4 }),
      F({ x: 30, lean: 16, head: 14, backThigh: 70, backShin: -84, frontThigh: 76, frontShin: -2, frontUpper: 40, frontFore: 18, weapon: 2, backUpper: 10, backFore: 20, eyes: 'shut', tail: 1 }),
      F({ x: 30, lean: 30, head: 22, ...KNEEL, frontUpper: 44, frontFore: 14, weapon: 0, backUpper: 20, backFore: 30, eyes: 'shut', mouth: 'line', tail: 0, fx: [sweat] }),
      F({ x: 30, lean: 34, head: 26, ...KNEEL, frontUpper: 46, frontFore: 12, weapon: 0, backUpper: 22, backFore: 30, eyes: 'shut', mouth: 'line', tail: 0, fx: [sweat] }),
    ],
    victory: [
      F({ frontUpper: 146, frontFore: 158, weapon: 160, eyes: 'happy', mouth: 'open', tail: 1, fx: [tipSpark(false)] }),
      F({ lift: 1, frontUpper: 146, frontFore: 158, weapon: 160, eyes: 'happy', mouth: 'open', tail: 3, fx: [tipSpark(true)] }),
      F({ frontUpper: 146, frontFore: 158, weapon: 160, eyes: 'happy', mouth: 'smile', tail: 2, fx: [tipSpark(false)] }),
      F({ lift: 1, frontUpper: 146, frontFore: 158, weapon: 160, eyes: 'happy', mouth: 'open', tail: 4, fx: [tipSpark(true, 'glow')] }),
    ],
    stumble: [
      F({ x: 29, lean: -10, head: -8, backThigh: -12, frontThigh: 30, eyes: 'open', mouth: 'open', tail: 3, fx: [oops] }),
      F({ x: 28, bob: 1, lean: -12, head: -10, backThigh: -12, frontThigh: 30, eyes: 'shut', mouth: 'line', tail: 4, fx: [oops, sweat] }),
      F({ x: 31, lean: -2, eyes: 'open', mouth: 'line', tail: 2, fx: [sweat] }),
    ],
    tired: [
      F({ lean: 30, head: 10, backThigh: -20, backShin: 4, frontThigh: 40, frontShin: -6, frontUpper: 34, frontFore: 12, weapon: 16, backUpper: 22, backFore: 18, eyes: 'shut', mouth: 'open', fx: [sweat] }),
      F({ bob: 1, lean: 32, head: 12, backThigh: -20, backShin: 4, frontThigh: 40, frontShin: -6, frontUpper: 34, frontFore: 12, weapon: 16, backUpper: 22, backFore: 18, eyes: 'shut', mouth: 'line', fx: [sweat] }),
    ],
    heal: [
      F({ head: -12, frontUpper: 96, frontFore: 196, weapon: 200, noSword: true, potion: true, eyes: 'shut' }),
      F({ head: -16, frontUpper: 100, frontFore: 200, weapon: 200, noSword: true, potion: true, eyes: 'shut', fx: [sparks([[24, 22], [44, 30]], 'green')] }),
      F({ eyes: 'happy', mouth: 'smile', fx: [sparks([[18, 40], [46, 26, true], [30, 16]], 'green')] }),
      F({ eyes: 'happy', mouth: 'smile', fx: [sparks([[22, 30, true], [48, 44]], 'green')] }),
    ],
    counter: [
      F({ bob: 1, lean: -3, backThigh: -26, frontThigh: 30, frontUpper: -16, frontFore: 24, weapon: 30, ...SHIELD_UP, eyes: 'fierce', mouth: 'grit', flashShield: true, fx: [sparks([[45, 32, true], [36, 26]], 'white')] }),
      F({ x: 40, lean: 16, ...LUNGE, frontUpper: 92, frontFore: 90, weapon: 90, eyes: 'fierce', mouth: 'open', tail: 4, fx: [streaks(36, 14, 26)] }),
      F({ x: 42, lean: 18, ...LUNGE, frontUpper: 92, frontFore: 90, weapon: 90, eyes: 'fierce', mouth: 'open', tail: 5, fx: [tipSpark(true, 'glow')] }),
      F({ x: 40, lean: 18, ...LUNGE, frontUpper: 58, frontFore: 28, weapon: 18, eyes: 'fierce', tail: 3, fx: [swing(-60, 60, 27, 3)] }),
      F({ x: 35, lean: 8, frontUpper: 30, frontFore: 70, weapon: 112, tail: 1 }),
    ],
  },
  mage: {
    idle: [M({ weapon: 176 }), M({ bob: 1, weapon: 176, hatTip: 1 }), M({ bob: 1, weapon: 176, hatTip: 2, fx: [tipSpark(false, 'cyan')] }), M({ weapon: 176, hatTip: 1 })],
    cast: [
      M({ lean: -4, frontUpper: 30, frontFore: 60, weapon: 150, eyes: 'fierce', hatTip: 1 }),
      M({ x: 34, lean: 10, frontUpper: 90, frontFore: 96, weapon: 100, eyes: 'fierce', mouth: 'open', hatTip: 3, fx: [tipSpark(true, 'cyan')] }),
      M({ x: 34, lean: 12, frontUpper: 94, frontFore: 100, weapon: 96, eyes: 'fierce', mouth: 'open', hatTip: 4, orbSize: 4, fx: [tipSpark(true, 'white')] }),
      M({ x: 33, lean: 8, frontUpper: 80, frontFore: 90, weapon: 110, eyes: 'open', hatTip: 2 }),
      M({ weapon: 170, hatTip: 1 }),
    ],
    special: [
      M({ lean: -8, backUpper: -40, backFore: -20, frontUpper: 160, frontFore: 172, weapon: 178, eyes: 'fierce', mouth: 'grit', orb: 'ember', hatTip: 2, fx: [sparks([[16, 20], [52, 18], [34, 6]], 'orange')] }),
      M({ lean: -10, lift: 1, backUpper: -50, backFore: -40, frontUpper: 166, frontFore: 176, weapon: 180, eyes: 'fierce', mouth: 'open', orb: 'ember', orbSize: 4.5, hatTip: 3, fx: [tipSpark(true, 'orange'), sparks([[12, 28, true], [56, 26, true], [24, 8], [46, 10]], 'orange')] }),
      M({ lean: -10, lift: 2, backUpper: -50, backFore: -40, frontUpper: 166, frontFore: 176, weapon: 180, eyes: 'fierce', mouth: 'open', orb: 'ember', orbSize: 5, hatTip: 4, flare: 2, fx: [tipSpark(true, 'glow'), ring('orange', 16)] }),
      M({ x: 36, lean: 16, frontUpper: 104, frontFore: 90, weapon: 80, eyes: 'fierce', mouth: 'open', orb: 'ember', hatTip: 5, flare: 3, fx: [streaks(30, 16, 24)] }),
      M({ x: 35, lean: 12, frontUpper: 96, frontFore: 96, weapon: 96, eyes: 'fierce', hatTip: 3, flare: 1 }),
      M({ weapon: 170, hatTip: 1 }),
    ],
    barrier: [
      M({ lean: -2, backUpper: 70, backFore: 96, frontUpper: 40, frontFore: 130, weapon: 172, eyes: 'fierce', fx: [ring('cyan', 12)] }),
      M({ lean: -2, backUpper: 76, backFore: 100, frontUpper: 40, frontFore: 134, weapon: 174, eyes: 'fierce', orbSize: 4, fx: [ring('cyan', 15), tipSpark(true, 'cyan')] }),
      M({ lean: -2, backUpper: 76, backFore: 100, frontUpper: 40, frontFore: 134, weapon: 174, eyes: 'open', fx: [ring('white', 17)] }),
    ],
    heal: [
      M({ backUpper: 40, backFore: 150, frontUpper: 150, frontFore: 170, weapon: 178, eyes: 'shut', orb: 'leaf', hatTip: 1 }),
      M({ lift: 1, backUpper: 40, backFore: 150, frontUpper: 156, frontFore: 172, weapon: 178, eyes: 'shut', orb: 'leaf', orbSize: 4, hatTip: 2, fx: [tipSpark(true, 'green'), sparks([[18, 36], [48, 40]], 'green')] }),
      M({ lift: 1, backUpper: 40, backFore: 150, frontUpper: 156, frontFore: 172, weapon: 178, eyes: 'happy', mouth: 'smile', orb: 'leaf', hatTip: 3, fx: [sparks([[14, 28, true], [50, 30, true], [30, 12]], 'green')] }),
      M({ weapon: 176, eyes: 'happy', mouth: 'smile', hatTip: 1, fx: [sparks([[20, 44], [46, 22]], 'green')] }),
    ],
    dodge: [
      M({ x: 28, lift: 3, lean: -10, weapon: 190, eyes: 'fierce', ghosts: [[4, 0]], flare: 2 }),
      M({ x: 24, lift: 5, lean: -8, weapon: 190, eyes: 'fierce', ghosts: [[8, 0], [4, 0]], flare: 3 }),
      M({ x: 26, weapon: 178, fx: [puff] }),
      M({ x: 30, weapon: 176 }),
    ],
    hit: [
      M({ flash: true, weapon: 176 }),
      M({ x: 27, lean: -18, head: -12, frontUpper: -20, frontFore: -30, weapon: 214, backUpper: -50, eyes: 'hurt', mouth: 'open', hatTip: 5, flare: 2 }),
      M({ x: 30, lean: -6, weapon: 180, eyes: 'shut', mouth: 'line', hatTip: 2 }),
    ],
    defeat: [
      M({ x: 27, lean: -18, head: -12, frontUpper: -20, frontFore: -30, weapon: 214, eyes: 'hurt', mouth: 'open', hatTip: 5 }),
      M({ x: 28, lean: -20, head: -12, weapon: 230, eyes: 'shut', mouth: 'open', hatTip: 4 }),
      M({ x: 30, lean: 18, head: 16, backThigh: 70, backShin: -84, frontThigh: 76, frontShin: -2, frontUpper: 50, frontFore: 20, weapon: 30, eyes: 'shut', hatTip: 6 }),
      M({ x: 30, lean: 30, head: 24, ...KNEEL, frontUpper: 56, frontFore: 16, weapon: 20, eyes: 'shut', mouth: 'line', hatTip: 8, fx: [sweat] }),
      M({ x: 30, lean: 34, head: 26, ...KNEEL, frontUpper: 58, frontFore: 14, weapon: 16, eyes: 'shut', mouth: 'line', hatTip: 8, fx: [sweat] }),
    ],
    victory: [
      M({ frontUpper: 160, frontFore: 170, weapon: 176, eyes: 'happy', mouth: 'open', hatTip: 2, fx: [tipSpark(false, 'cyan')] }),
      M({ lift: 2, frontUpper: 164, frontFore: 172, weapon: 178, eyes: 'happy', mouth: 'open', hatTip: 4, fx: [tipSpark(true, 'cyan'), sparks([[18, 20], [52, 24]], 'violet')] }),
      M({ frontUpper: 160, frontFore: 170, weapon: 176, eyes: 'happy', mouth: 'smile', hatTip: 2, fx: [tipSpark(false, 'cyan')] }),
      M({ lift: 2, frontUpper: 164, frontFore: 172, weapon: 178, eyes: 'happy', mouth: 'open', hatTip: 4, fx: [tipSpark(true, 'white'), sparks([[22, 14], [48, 30]], 'violet')] }),
    ],
    stumble: [
      M({ x: 29, lean: -10, head: -8, weapon: 186, eyes: 'open', mouth: 'open', hatTip: 3, fx: [oops] }),
      M({ x: 28, bob: 1, lean: -12, head: -10, weapon: 190, eyes: 'shut', mouth: 'line', hatTip: 5, fx: [oops, sweat] }),
      M({ x: 31, lean: -2, weapon: 178, eyes: 'open', mouth: 'line', hatTip: 2, fx: [sweat] }),
    ],
    tired: [
      M({ lean: 26, head: 12, frontUpper: 20, frontFore: 10, weapon: 186, backUpper: 20, backFore: 30, eyes: 'shut', mouth: 'open', hatTip: 6, fx: [sweat] }),
      M({ bob: 1, lean: 28, head: 14, frontUpper: 20, frontFore: 10, weapon: 186, backUpper: 20, backFore: 30, eyes: 'shut', mouth: 'line', hatTip: 7, fx: [sweat] }),
    ],
  },
  ninja: {
    idle: [N({ ...NS }), N({ ...NS, bob: 1, frontFore: 94, weapon: 22, scarf: 2 }), N({ ...NS, bob: 1, frontFore: 94, weapon: 22, scarf: 3 }), N({ ...NS, scarf: 1 })],
    attack: [
      N({ lean: 22, backThigh: -50, backShin: 20, frontThigh: 60, frontShin: -10, frontUpper: -30, frontFore: 20, weapon: 200, backUpper: -40, backFore: -20, eyes: 'fierce', scarf: 2 }),
      N({ x: 40, lean: 30, backThigh: -60, backShin: -30, frontThigh: 60, frontShin: 20, frontUpper: 100, frontFore: 110, weapon: 100, eyes: 'fierce', scarf: 5, fx: [streaks(34, 20, 24)], ghosts: [[-8, 0]] }),
      N({ x: 44, lean: 26, backThigh: -56, backShin: -20, frontThigh: 56, frontShin: 16, frontUpper: 80, frontFore: 40, weapon: 30, eyes: 'fierce', scarf: 6, fx: [swing(-70, 50, 24, 3)] }),
      N({ x: 42, lean: 22, backThigh: -50, backShin: -14, frontThigh: 54, frontShin: 12, frontUpper: 50, frontFore: 20, weapon: 10, eyes: 'fierce', scarf: 4, fx: [swing(10, 60, 23, 2, 'spark', 'white')] }),
      N({ ...NS, x: 36, lean: 16, scarf: 2 }),
    ],
    special: [
      N({ x: 40, lean: 28, backThigh: -60, backShin: -30, frontThigh: 60, frontShin: 20, frontUpper: 100, frontFore: 110, weapon: 100, eyes: 'fierce', scarf: 5, fx: [streaks(34, 22, 26)], ghosts: [[-10, 0], [-5, 0]] }),
      N({ x: 44, lean: 24, ...LUNGE, frontUpper: 150, frontFore: 170, weapon: 190, backBlade: 130, eyes: 'fierce', scarf: 6, fx: [swing(-110, -10, 24, 3)] }),
      N({ x: 44, lean: 26, ...LUNGE, frontUpper: 60, frontFore: 30, weapon: 20, backBlade: 100, eyes: 'fierce', scarf: 6, fx: [swing(-60, 30, 24, 3)] }),
      N({ x: 44, lean: 26, ...LUNGE, frontUpper: 40, frontFore: 10, weapon: 10, backUpper: 100, backFore: 60, backBlade: 50, eyes: 'fierce', scarf: 5, fx: [swing(10, 100, 22, 3)] }),
      N({ x: 42, lean: 22, ...LUNGE, frontUpper: 60, frontFore: 40, weapon: 30, eyes: 'fierce', scarf: 4 }),
      N({ ...NS, x: 36, lean: 16, scarf: 2 }),
    ],
    shadow: [
      N({ ...NS, eyes: 'fierce', shade: 0.35, scarf: 3 }),
      N({ ...NS, eyes: 'fierce', shade: 0.8, scarf: 4, fx: [sparks([[20, 30], [34, 18], [44, 44], [26, 56]], 'violet')] }),
      N({ x: 46, lean: 30, backThigh: -60, backShin: -30, frontThigh: 60, frontShin: 20, frontUpper: 100, frontFore: 110, weapon: 100, eyes: 'fierce', scarf: 6, shadowGhosts: true, ghosts: [[-20, 0], [-11, 0]] }),
      N({ x: 46, lean: 28, ...LUNGE, frontUpper: 150, frontFore: 170, weapon: 190, eyes: 'fierce', scarf: 6, fx: [swing(-120, 40, 25, 4, 'violet', 'white')] }),
      N({ x: 46, lean: 30, ...LUNGE, frontUpper: 50, frontFore: 20, weapon: 14, eyes: 'fierce', scarf: 5, fx: [swing(0, 80, 24, 3, 'violet', 'white')] }),
      N({ ...NS, x: 38, lean: 16, scarf: 2 }),
    ],
    dodge: [
      N({ ...NS, x: 28, lift: 4, lean: -10, backThigh: -40, frontThigh: 60, frontShin: 30, eyes: 'fierce', scarf: 5, ghosts: [[5, 0]] }),
      N({ ...NS, x: 22, lift: 7, lean: -14, backThigh: 20, backShin: -60, frontThigh: 70, frontShin: 10, frontUpper: 60, frontFore: 110, weapon: 30, eyes: 'fierce', scarf: 6, ghosts: [[10, -2], [5, -1]] }),
      N({ ...NS, x: 24, lean: 10, eyes: 'fierce', scarf: 3, fx: [puff] }),
      N({ ...NS, x: 30, scarf: 1 }),
    ],
    counter: [
      N({ ...NS, eyes: 'fierce', scarf: 2, fx: [sparks([[44, 24, true]], 'white')] }),
      N({ x: 42, lean: 30, backThigh: -60, backShin: -30, frontThigh: 60, frontShin: 20, frontUpper: 100, frontFore: 110, weapon: 100, eyes: 'fierce', scarf: 5, fx: [streaks(34, 22, 28)], ghosts: [[-9, 0]] }),
      N({ x: 44, lean: 26, ...LUNGE, frontUpper: 80, frontFore: 40, weapon: 30, eyes: 'fierce', scarf: 6, fx: [swing(-80, 50, 24, 4)] }),
      N({ x: 42, lean: 22, ...LUNGE, frontUpper: 50, frontFore: 20, weapon: 10, eyes: 'fierce', scarf: 4, fx: [swing(10, 70, 23, 2, 'spark', 'white')] }),
      N({ ...NS, x: 36, lean: 16, scarf: 2 }),
    ],
    hit: [
      N({ ...NS, flash: true }),
      N({ x: 27, lean: -16, head: -12, backThigh: -10, frontThigh: 30, frontUpper: -30, frontFore: -40, weapon: 230, backUpper: -50, eyes: 'hurt', scarf: 6 }),
      N({ ...NS, x: 30, lean: 4, eyes: 'shut', scarf: 3 }),
    ],
    defeat: [
      N({ x: 27, lean: -16, head: -12, frontUpper: -30, frontFore: -40, weapon: 230, eyes: 'hurt', scarf: 6 }),
      N({ x: 28, lean: -22, head: -12, frontUpper: -10, frontFore: 0, weapon: 240, eyes: 'shut', scarf: 5 }),
      N({ x: 30, lean: 20, head: 16, backThigh: 70, backShin: -84, frontThigh: 76, frontShin: -2, frontUpper: 44, frontFore: 18, weapon: 0, eyes: 'shut', scarf: 2 }),
      N({ x: 30, lean: 32, head: 24, ...KNEEL, frontUpper: 50, frontFore: 14, weapon: 0, eyes: 'shut', scarf: 1, fx: [sweat] }),
      N({ x: 30, lean: 36, head: 26, ...KNEEL, frontUpper: 52, frontFore: 12, weapon: 0, eyes: 'shut', scarf: 0, fx: [sweat] }),
    ],
    victory: [
      N({ lean: 2, backThigh: -16, frontThigh: 20, frontUpper: 150, frontFore: 170, weapon: 170, backUpper: -40, backFore: -60, eyes: 'happy', scarf: 3, fx: [tipSpark(false)] }),
      N({ lean: 2, lift: 1, backThigh: -16, frontThigh: 20, frontUpper: 150, frontFore: 170, weapon: 170, backUpper: -40, backFore: -60, eyes: 'happy', scarf: 5, fx: [tipSpark(true)] }),
      N({ lean: 2, backThigh: -16, frontThigh: 20, frontUpper: 150, frontFore: 170, weapon: 170, backUpper: -40, backFore: -60, eyes: 'happy', scarf: 6, fx: [tipSpark(false)] }),
      N({ lean: 2, lift: 1, backThigh: -16, frontThigh: 20, frontUpper: 150, frontFore: 170, weapon: 170, backUpper: -40, backFore: -60, eyes: 'happy', scarf: 4, fx: [tipSpark(true, 'glow')] }),
    ],
    stumble: [
      N({ ...NS, x: 29, lean: -4, head: -8, eyes: 'open', scarf: 4, fx: [oops] }),
      N({ ...NS, x: 28, bob: 1, lean: -6, head: -10, eyes: 'shut', scarf: 5, fx: [oops, sweat] }),
      N({ ...NS, x: 31, lean: 8, eyes: 'open', scarf: 2, fx: [sweat] }),
    ],
    tired: [
      N({ lean: 32, head: 12, backThigh: -24, backShin: 10, frontThigh: 44, frontShin: -8, frontUpper: 30, frontFore: 10, weapon: 10, backUpper: 24, backFore: 14, eyes: 'shut', scarf: 0, fx: [sweat] }),
      N({ bob: 1, lean: 34, head: 14, backThigh: -24, backShin: 10, frontThigh: 44, frontShin: -8, frontUpper: 30, frontFore: 10, weapon: 10, backUpper: 24, backFore: 14, eyes: 'shut', scarf: 1, fx: [sweat] }),
    ],
    heal: [
      N({ lean: 6, head: -10, frontUpper: 96, frontFore: 196, weapon: 200, noBlade: true, potion: true, eyes: 'shut', scarf: 2 }),
      N({ lean: 6, head: -14, frontUpper: 100, frontFore: 200, weapon: 200, noBlade: true, potion: true, eyes: 'shut', scarf: 3, fx: [sparks([[24, 22], [44, 30]], 'green')] }),
      N({ ...NS, lean: 12, eyes: 'happy', scarf: 4, fx: [sparks([[18, 40], [46, 26, true], [30, 16]], 'green')] }),
      N({ ...NS, lean: 12, eyes: 'happy', scarf: 2, fx: [sparks([[22, 30, true], [48, 44]], 'green')] }),
    ],
  },
};

// The guest ally only needs the states its battles use: idle, a spear thrust,
// protecting the hero, a knock-back and a cheer.
const D = (extra) => ({ id: 'osakaDefender', weapon: 168, ...extra });
POSES.osakaDefender = {
  idle: [D({}), D({ bob: 1, frontFore: 62 }), D({ bob: 1, frontFore: 62 }), D({})],
  attack: [
    D({ lean: -6, backThigh: -16, frontThigh: 20, frontUpper: 150, frontFore: 110, weapon: 100, eyes: 'fierce', mouth: 'grit' }),
    D({ x: 32, lean: 14, ...LUNGE, frontUpper: 96, frontFore: 90, weapon: 86, eyes: 'fierce', mouth: 'open', fx: [streaks(36, 14, 18)] }),
    D({ x: 35, lean: 20, ...LUNGE, frontUpper: 92, frontFore: 86, weapon: 82, eyes: 'fierce', mouth: 'open', fx: [sparks([[68, 34, true]], 'white')] }),
    D({ x: 33, lean: 12, ...LUNGE, frontUpper: 88, frontFore: 88, weapon: 86, eyes: 'fierce' }),
    D({ x: 34, lean: 4 }),
  ],
  guard: [
    D({ bob: 1, lean: -3, backThigh: -26, frontThigh: 30, ...SHIELD_UP, eyes: 'fierce', mouth: 'grit' }),
    D({ bob: 1, lean: -3, backThigh: -26, frontThigh: 30, ...SHIELD_UP, eyes: 'fierce', mouth: 'grit', flashShield: true, fx: [sparks([[46, 32, true]], 'white')] }),
    D({ bob: 1, lean: -3, backThigh: -26, frontThigh: 30, ...SHIELD_UP, eyes: 'fierce', mouth: 'grit' }),
  ],
  hit: [
    D({ flash: true }),
    D({ x: 27, lean: -16, head: -10, backThigh: -8, frontThigh: 34, weapon: 200, eyes: 'hurt', mouth: 'open' }),
    D({ x: 30, lean: -6, eyes: 'shut', mouth: 'grit' }),
  ],
  victory: [
    D({ frontUpper: 150, frontFore: 170, weapon: 178, eyes: 'happy', mouth: 'open' }),
    D({ lift: 1, frontUpper: 150, frontFore: 170, weapon: 178, eyes: 'happy', mouth: 'open', fx: [sparks([[48, 6, true]])] }),
    D({ frontUpper: 150, frontFore: 170, weapon: 178, eyes: 'happy', mouth: 'smile' }),
    D({ lift: 1, frontUpper: 150, frontFore: 170, weapon: 178, eyes: 'happy', mouth: 'open', fx: [sparks([[48, 6, true]], 'glow')] }),
  ],
};

// Kept so tools can preview the fighter's poses by name.
export const FIGHTER_POSES = POSES.fighter;

const DRAW = { fighter: drawFighter, mage: drawMage, ninja: drawNinja, osakaDefender: drawDefender };
/** Friendly guest characters drawn on the hero rig; never selectable heroes. */
export const ALLY_IDS = Object.freeze(['osakaDefender']);
const isOutline = (key) => /^[a-zA-Z]+0$/.test(key);
const FLASH = (key) => (isOutline(key) ? key : 'flash');
const GHOST = () => 'ghost';
const SHADE = (key) => (isOutline(key) ? 'shade1' : 'shade2');

/** One hero frame for a pose: flash, afterimage ghosts and the shadow fade are composed here. */
export function heroFrame(id, pose = {}) {
  const draw = DRAW[id];
  if (!draw) throw new Error(`Unknown hero ${id}`);
  const { ghosts, flash, shade, shadowGhosts, ...rest } = pose;
  let frame = draw(rest);
  if (flash) frame = recolor(frame, FLASH);
  if (shade) frame = dissolve(recolor(frame, SHADE), shade);
  if (ghosts?.length) {
    const base = grid(HERO_FRAME.w, HERO_FRAME.h);
    ghosts.forEach(([dx, dy]) => overlay(base, recolor(draw({ ...rest, fx: [] }), shadowGhosts ? SHADE : GHOST), dx, dy));
    frame = overlay(base, frame);
  }
  return frame;
}
