// Shaded pixel painting for the Adventure sprites.
//
// A sprite is built from parts (limbs, torso, hair, armour, weapons...). Each
// part has a material: a hue-shifted ramp of six colours
//   0 outline · 1 dark · 2 shadow · 3 base · 4 light · 5 highlight
// Parts are shaded automatically with light from the top-left: the lower-right
// edge of each part gets dark and shadow bands, the upper-left edge a light
// rim, glossy materials a highlight band. Where a part overlaps an earlier one
// an interior line is drawn, and the silhouette gets a dark outline. Faces and
// small details are placed by hand on top. The result is ordinary palette-key
// grids for pixel-core.js, so sheets rasterize exactly as before.
import { grid } from './pixel-core.js';

// Ramps are hue-shifted: shadows lean cool/purple, lights lean warm.
export const MATERIALS = Object.freeze({
  skin: ['#3e1c22', '#8e4438', '#cc7658', '#f2b690', '#ffd8bc', '#fff0e2'],
  skinPale: ['#241c34', '#5e5474', '#9890b0', '#d0cadc', '#eeeaf4', '#ffffff'],
  auburn: ['#240c0c', '#561e16', '#8a341c', '#c05426', '#e88440', '#ffbe78'],
  blond: ['#2e1a0c', '#6e4a1a', '#a87828', '#dcaa3c', '#f6d470', '#fff2b4'],
  silver: ['#1a1c34', '#444a70', '#727ca4', '#aeb8d6', '#dde4f4', '#ffffff'],
  red: ['#2a0814', '#621224', '#9c1e2c', '#d23c38', '#f27052', '#ffaa80'],
  blue: ['#0a1030', '#182862', '#28469c', '#3a6cce', '#6ca0ee', '#bcd8ff'],
  navy: ['#070918', '#121836', '#1e2a56', '#2e4282', '#4a66ae', '#84a0d8'],
  violet: ['#120826', '#2a1652', '#442884', '#6440b2', '#9272dc', '#c4aeff'],
  indigo: ['#0a0a24', '#1a1c4a', '#2a3276', '#3c4ea4', '#5e78cc', '#9cb4f0'],
  steel: ['#141a2c', '#36425c', '#5c6e8a', '#93a6be', '#cddbea', '#ffffff'],
  gold: ['#361e06', '#72440c', '#b07a18', '#e4ae30', '#ffdc78', '#fff8d8'],
  leather: ['#1c0e08', '#402416', '#663a20', '#8e5c36', '#b88656', '#dcb484'],
  wood: ['#201004', '#462a10', '#6c421c', '#94622e', '#be8a4e', '#e4b478'],
  cream: ['#2a2230', '#645a6c', '#a2969e', '#d8cec8', '#f4eee6', '#ffffff'],
  white: ['#262838', '#5e6278', '#9ca2b8', '#d8dcea', '#f6f8ff', '#ffffff'],
  goblin: ['#0a1c0e', '#1a4420', '#2a7030', '#46a046', '#78cc62', '#b8ee98'],
  slime: ['#082418', '#106034', '#1e9a4c', '#40c862', '#86ec8e', '#e2ffe4'],
  fur: ['#121420', '#30364a', '#525a74', '#838ca4', '#b6bed0', '#eaeef6'],
  bone: ['#261e16', '#62523a', '#a08c64', '#d4c49a', '#f2eace', '#ffffff'],
  stone: ['#101220', '#2a3044', '#465068', '#6c7890', '#9ca8ba', '#d2d8e4'],
  moss: ['#0c1a0a', '#1c3a16', '#2e6222', '#488c30', '#76b84c', '#b0e084'],
  scale: ['#200406', '#520c12', '#86181a', '#bc2e28', '#e86438', '#ffaa6a'],
  belly: ['#361e0c', '#745224', '#b08c3a', '#e2c25c', '#f8e296', '#fffadc'],
  membrane: ['#1a0610', '#3a0c1c', '#5e1426', '#862234', '#b23e48', '#dc6e6e'],
  demon: ['#16081e', '#361248', '#56206e', '#80369a', '#ac62c6', '#dca4ee'],
  shadowCloth: ['#050509', '#12121c', '#20203a', '#343654', '#52567c', '#8488b0'],
  crimson: ['#1c030e', '#440920', '#700e2c', '#a0163a', '#d23654', '#ff7888'],
  crystal: ['#06242e', '#0c5264', '#168ca0', '#36c4d8', '#86ecf6', '#ffffff'],
  ember: ['#2a0a04', '#6a1a06', '#b0380a', '#ec6a14', '#ffae3a', '#fff0a0'],
  leaf: ['#0a1e0a', '#18461a', '#28742a', '#40a23a', '#76d05a', '#c2f29a'],
  mushroom: ['#2a0610', '#62101e', '#9e1c28', '#d8323a', '#f66a5e', '#ffb09a'],
  shade: ['#0c0414', '#22103a', '#3e1c64', '#62309a', '#9458cc', '#caa0f4'],
});

// Flat colours for hand-placed details.
export const DETAIL = Object.freeze({
  ink: '#0e1024', eye: '#1a1428', white: '#ffffff', blush: '#ff8e8e', glow: '#fff4a0', fang: '#fffaf0',
  red: '#e0303a', green: '#6aff7a', cyan: '#8ff6ff', violet: '#d69cff', orange: '#ffb040', shadow: '#1a1c2c50',
  ghost: '#4a5aa880', flash: '#ffffff', speed: '#e8f0ffc0', zzz: '#9fc8ff', spark: '#fff8c8',
});

/** Palette for pixel-core: every material level becomes key `${name}${level}`. */
export const RIG_PALETTE = Object.freeze(Object.fromEntries([
  ...Object.entries(MATERIALS).flatMap(([name, ramp]) => ramp.map((hex, level) => [`${name}${level}`, hex])),
  ...Object.entries(DETAIL),
]));

// Loose detail pixels (effects, afterimages) that should not get an ink outline.
const SOFT_DETAIL = new Set(['ghost', 'speed', 'shadow', 'zzz', 'spark']);

const rad = (deg) => (deg * Math.PI) / 180;
/** Unit vector for an angle measured from straight down, positive toward the facing side (+x). */
export const along = (deg) => [Math.sin(rad(deg)), Math.cos(rad(deg))];

export class Painter {
  /** lightDir [-1,-1] lights from the top-left; enemies are drawn facing right with [1,-1] and then mirrored. */
  constructor(w, h, { lightDir = [-1, -1] } = {}) {
    this.w = w; this.h = h; this.lightDir = lightDir;
    this.pid = new Int16Array(w * h).fill(-1);
    this.parts = [];
    this.over = new Map();
  }

  /** Start a part. opts: dark/shadow/light band widths, gloss, dither, line (interior line), flat (no shading), level (fixed level). */
  part(material, opts = {}) {
    if (!MATERIALS[material]) throw new Error(`Unknown material ${material}`);
    const id = this.parts.length;
    this.parts.push({ material, mask: new Uint8Array(this.w * this.h), opts });
    return id;
  }

  plot(id, x, y) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.parts[id].mask[i] = 1;
    this.pid[i] = id;
    this.over.delete(i);
  }

  /** Filled ellipse centred at (cx, cy). */
  ellipse(id, cx, cy, rx, ry) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
      const dx = (x + 0.5 - cx - 0.5) / (rx + 0.25), dy = (y + 0.5 - cy - 0.5) / (ry + 0.25);
      if (dx * dx + dy * dy <= 1) this.plot(id, x, y);
    }
    return id;
  }

  /** Tapered capsule from (x0,y0) radius r0 to (x1,y1) radius r1 — limbs, blades, tails. */
  capsule(id, x0, y0, x1, y1, r0, r1 = r0) {
    const minX = Math.floor(Math.min(x0 - r0, x1 - r1)), maxX = Math.ceil(Math.max(x0 + r0, x1 + r1));
    const minY = Math.floor(Math.min(y0 - r0, y1 - r1)), maxY = Math.ceil(Math.max(y0 + r0, y1 + r1));
    const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy || 1;
    for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / len2));
      const px = x0 + dx * t, py = y0 + dy * t, r = r0 + (r1 - r0) * t;
      if ((x - px) ** 2 + (y - py) ** 2 <= r * r + 0.3) this.plot(id, x, y);
    }
    return id;
  }

  /** Scanline polygon; points are [x, y]. */
  poly(id, points) {
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y += 1) {
      const cy = y + 0.5, xs = [];
      for (let i = 0; i < points.length; i += 1) {
        const [ax, ay] = points[i], [bx, by] = points[(i + 1) % points.length];
        if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x += 1) this.plot(id, x, y);
    }
    return id;
  }

  rect(id, x, y, w, h) {
    for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) this.plot(id, x + i, y + j);
    return id;
  }

  /** Thick line made of a capsule with constant radius. */
  line(id, x0, y0, x1, y1, width = 1) { return this.capsule(id, x0, y0, x1, y1, width / 2, width / 2); }

  /** A shaded shape in one call: shape(material, (id) => painter.ellipse(id, ...), opts). */
  shape(material, draw, opts) { const id = this.part(material, opts); draw(id); return id; }

  /** Hand-placed pixel drawn after shading (eyes, trims, sparkles). key is a palette key. */
  dot(x, y, key) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.over.set(y * this.w + x, key);
  }
  dots(list, key) { list.forEach(([x, y]) => this.dot(x, y, key)); }
  /** ASCII stamp of detail keys: map maps characters to palette keys; '.' is skipped. */
  stamp(rows, x, y, map, { flip = false } = {}) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '.' || ch === ' ' || !map[ch]) return;
      this.dot(flip ? x + row.length - 1 - i : x + i, y + j, map[ch]);
    }));
  }
  /** Clear pixels (e.g. cut a mouth or eye socket out of a shape). */
  clear(x, y) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.pid[i] = -1; this.over.delete(i);
  }

  /** Shade level (0-5) for pixel (x, y) of a part, from distances to the part's lit and unlit edges. */
  level(part, x, y) {
    const { mask, opts } = part;
    if (opts.level !== undefined) return opts.level;
    const { w, h } = this;
    const [ldx, ldy] = opts.lightDir || this.lightDir;
    let toShadow = 0;
    for (let xx = x - ldx, yy = y - ldy; toShadow < 6 && xx >= 0 && yy >= 0 && xx < w && yy < h && mask[yy * w + xx] === 1; xx -= ldx, yy -= ldy) toShadow += 1;
    let toLight = 0;
    for (let xx = x + ldx, yy = y + ldy; toLight < 6 && xx >= 0 && yy >= 0 && xx < w && yy < h && mask[yy * w + xx] === 1; xx += ldx, yy += ldy) toLight += 1;
    const dark = opts.dark ?? 1, shadow = opts.shadow ?? 1, light = opts.light ?? 1;
    const checker = (x + y) % 2 === 0;
    if (toShadow < dark) return 1;
    if (toShadow < dark + shadow) return opts.dither && toShadow === dark + shadow - 1 && checker ? 3 : 2;
    if (opts.dither && toShadow === dark + shadow && checker) return 2;
    if (toLight < light) return opts.gloss && toLight === 0 && toShadow > dark + shadow + 1 ? 5 : 4;
    if (opts.gloss && toLight === light && toShadow > dark + shadow + 1) return 5;
    return 3;
  }

  /** Flatten to a pixel-core grid of palette keys. */
  render({ outline = true } = {}) {
    const { w, h, pid, parts, over } = this;
    const g = grid(w, h);
    const keys = parts.map((part) => [0, 1, 2, 3, 4, 5].map((level) => `${part.material}${level}`));
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      const id = pid[i];
      if (id < 0) continue;
      const part = parts[id];
      let level = this.level(part, x, y);
      if (part.opts.line !== false) {
        // Interior line where this part overlaps one drawn earlier.
        const other = x + 1 < w && pid[i + 1] >= 0 && pid[i + 1] < id ? pid[i + 1]
          : x > 0 && pid[i - 1] >= 0 && pid[i - 1] < id ? pid[i - 1]
            : y + 1 < h && pid[i + w] >= 0 && pid[i + w] < id ? pid[i + w]
              : y > 0 && pid[i - w] >= 0 && pid[i - w] < id ? pid[i - w] : -1;
        if (other >= 0) level = parts[other].material === part.material ? Math.min(level, 1) : 0;
      }
      g.d[i] = keys[id][level];
    }
    if (outline) {
      const src = g.d.slice();
      const soft = (key) => SOFT_DETAIL.has(key);
      for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
        const i = y * w + x;
        if (pid[i] >= 0 || over.has(i)) continue;
        let outlineKey = '';
        for (let n = 0; n < 4 && !outlineKey; n += 1) {
          const nx = x + (n === 1 ? -1 : n === 2 ? 1 : 0), ny = y + (n === 0 ? 1 : n === 3 ? -1 : 0);
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (pid[j] >= 0) outlineKey = keys[pid[j]][0];
          else if (over.has(j) && !soft(over.get(j))) outlineKey = 'ink';
        }
        if (outlineKey) src[i] = outlineKey;
      }
      g.d = src;
    }
    for (const [i, key] of over) g.d[i] = key;
    return g;
  }
}

/* ------------------------------------------------------------ humanoid rig */

const DEFAULT_POSE = Object.freeze({
  x: 32, ground: 68, // hip x, ground line
  lean: 4,           // torso tilt (degrees, + leans toward the enemy)
  lift: 0, bob: 0,   // lift raises the whole body (jumps); bob lowers the upper body (breathing)
  head: 0,           // head tilt
  // limb angles, degrees from straight down; + swings toward the facing side
  backThigh: -18, backShin: -4, frontThigh: 24, frontShin: 4,
  backUpper: -26, backFore: -4, frontUpper: 14, frontFore: 58,
  weapon: 128,       // weapon angle for the front hand (135 = up and forward)
  eyes: 'open', mouth: 'none',
});

/** Forward kinematics: joint positions for a pose on a body with the given proportions. */
export function skeleton(pose, body) {
  const p = { ...DEFAULT_POSE, ...pose };
  // Bent knees lower the hip so the lower foot stays on the ground; lift jumps, bob breathes.
  const drop = (thigh, shin) => body.thigh * Math.cos(rad(thigh)) + body.shin * Math.cos(rad(shin));
  const hip = [p.x, p.ground - Math.max(drop(p.backThigh, p.backShin), drop(p.frontThigh, p.frontShin)) - (p.lift ?? 0)];
  const legJoints = (thigh, shin, dx) => {
    const [tx, ty] = along(thigh), [sx, sy] = along(shin);
    const start = [hip[0] + dx, hip[1]];
    const knee = [start[0] + tx * body.thigh, start[1] + ty * body.thigh];
    const foot = [knee[0] + sx * body.shin, knee[1] + sy * body.shin];
    return { start, knee, foot };
  };
  const [lx, ly] = along(180 - p.lean);
  const neck = [hip[0] + lx * body.torso, hip[1] + ly * body.torso + (p.bob ?? 0)];
  const shoulderFront = [neck[0] + 1.5, neck[1] + 2.5];
  const shoulderBack = [neck[0] - 2.5, neck[1] + 2];
  const armJoints = (upper, fore, shoulder) => {
    const [ux, uy] = along(upper), [fx, fy] = along(fore);
    const elbow = [shoulder[0] + ux * body.upperArm, shoulder[1] + uy * body.upperArm];
    const hand = [elbow[0] + fx * body.foreArm, elbow[1] + fy * body.foreArm];
    return { shoulder, elbow, hand };
  };
  const [hx, hy] = along(180 - p.lean - p.head);
  const headCenter = [neck[0] + hx * body.headLift, neck[1] + hy * body.headLift];
  return {
    pose: p, hip, neck, head: headCenter,
    backLeg: legJoints(p.backThigh, p.backShin, -2), frontLeg: legJoints(p.frontThigh, p.frontShin, 2),
    backArm: armJoints(p.backUpper, p.backFore, shoulderBack), frontArm: armJoints(p.frontUpper, p.frontFore, shoulderFront),
  };
}
