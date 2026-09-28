// Low-resolution pixel grids. Every sprite, icon, effect and backdrop is drawn
// here on a small integer grid of palette keys, then rasterized once to a PNG
// sheet and scaled up by whole numbers with nearest-neighbour CSS.

export function grid(w, h) {
  return { w, h, d: new Array(w * h).fill('') };
}

export function clone(g) {
  return { w: g.w, h: g.h, d: g.d.slice() };
}

export function get(g, x, y) {
  return x < 0 || y < 0 || x >= g.w || y >= g.h ? '' : g.d[y * g.w + x];
}

export function px(g, x, y, c) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return;
  g.d[y * g.w + x] = c;
}

export function rect(g, x, y, w, h, c) {
  for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) px(g, x + i, y + j, c);
}

/** Filled ellipse sampled at pixel centres; (x, y, w, h) is its bounding box. */
export function oval(g, x, y, w, h, c) {
  const rx = w / 2, ry = h / 2, cx = x + rx, cy = y + ry;
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      const dx = (x + i + 0.5 - cx) / rx, dy = (y + j + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1.0001) px(g, x + i, y + j, c);
    }
  }
}

export function line(g, x0, y0, x1, y1, c, thick = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (thick === 1) px(g, x0, y0, c); else rect(g, x0 - (thick >> 1), y0 - (thick >> 1), thick, thick, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Scanline polygon fill; points are [x, y] pairs in grid units. */
export function poly(g, points, c) {
  const ys = points.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y += 1) {
    const cy = y + 0.5, xs = [];
    for (let i = 0; i < points.length; i += 1) {
      const [ax, ay] = points[i], [bx, by] = points[(i + 1) % points.length];
      if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x += 1) px(g, x, y, c);
    }
  }
}

/**
 * Stamp ASCII rows. '.' and ' ' are transparent; every other character is a
 * palette key. `map` can rename keys so one stamp serves several palettes.
 */
export function stamp(g, rows, x = 0, y = 0, { flip = false, map = null } = {}) {
  rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i += 1) {
      const ch = row[i];
      if (ch === '.' || ch === ' ') continue;
      px(g, flip ? x + row.length - 1 - i : x + i, y + j, map?.[ch] ?? ch);
    }
  });
}

/** Copy the left half onto the right half, mirrored (for front-facing sprites). */
export function mirror(g) {
  const half = Math.floor(g.w / 2);
  for (let y = 0; y < g.h; y += 1) for (let x = 0; x < half; x += 1) g.d[y * g.w + (g.w - 1 - x)] = g.d[y * g.w + x];
  return g;
}

/** Add a one-pixel outline around every filled region (4-neighbour). */
export function outline(g, c = 'k') {
  const src = g.d.slice();
  const at = (x, y) => (x < 0 || y < 0 || x >= g.w || y >= g.h ? '' : src[y * g.w + x]);
  for (let y = 0; y < g.h; y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      if (src[y * g.w + x]) continue;
      if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) g.d[y * g.w + x] = c;
    }
  }
  return g;
}

export function overlay(g, top, dx = 0, dy = 0) {
  for (let y = 0; y < top.h; y += 1) for (let x = 0; x < top.w; x += 1) {
    const c = top.d[y * top.w + x];
    if (c) px(g, x + dx, y + dy, c);
  }
  return g;
}

export function shift(g, dx, dy) {
  const out = grid(g.w, g.h);
  return overlay(out, g, dx, dy);
}

export function flipX(g) {
  const out = grid(g.w, g.h);
  for (let y = 0; y < g.h; y += 1) for (let x = 0; x < g.w; x += 1) out.d[y * g.w + x] = g.d[y * g.w + (g.w - 1 - x)];
  return out;
}

/** Shift only the rows above `splitY` down by `dy` (a breathing squash). */
export function squash(g, splitY, dy = 1) {
  const out = clone(g);
  for (let y = 0; y < Math.min(g.h, splitY + dy); y += 1) {
    for (let x = 0; x < g.w; x += 1) {
      const moved = y - dy >= 0 && y - dy < splitY ? g.d[(y - dy) * g.w + x] : '';
      out.d[y * g.w + x] = moved || (y >= splitY ? g.d[y * g.w + x] : '');
    }
  }
  return out;
}

/** Replace palette keys; `fn(key)` or a map. */
export function recolor(g, mapping) {
  const out = clone(g);
  out.d = out.d.map((c) => (!c ? c : typeof mapping === 'function' ? mapping(c) : mapping[c] ?? c));
  return out;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Ordered-dither dissolve: level 0 keeps everything, 1 removes everything. */
export function dissolve(g, level) {
  const out = clone(g);
  for (let y = 0; y < g.h; y += 1) for (let x = 0; x < g.w; x += 1) {
    if (BAYER[(y % 4) * 4 + (x % 4)] < level * 16) out.d[y * g.w + x] = '';
  }
  return out;
}

/** Keep only pixels passing the dither threshold (for translucent-looking fills). */
export function ditherMask(x, y, level) {
  return BAYER[(y % 4) * 4 + (x % 4)] < level * 16;
}

/**
 * Rasterize rows of frames into one PNG sheet: sheet[row][col] is a grid.
 * Returns { url, w, h, fw, fh }. Cached by key. Returns an empty url outside a
 * browser so pure-logic tests can import the art modules.
 */
const sheetCache = new Map();
export function sheet(key, fw, fh, rows, palette) {
  if (sheetCache.has(key)) return sheetCache.get(key);
  const cols = Math.max(...rows.map((row) => row.length));
  const result = { url: '', w: cols * fw, h: rows.length * fh, fw, fh };
  if (typeof document === 'undefined') {
    // No canvas in Node: keep the grids so tools/render-sprites.mjs can write PNGs for review.
    Object.defineProperties(result, { grids: { value: rows }, palette: { value: palette } });
    sheetCache.set(key, result);
    return result;
  }
  const canvas = document.createElement('canvas');
  canvas.width = result.w;
  canvas.height = result.h;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(result.w, result.h);
  const rgba = {};
  const parse = (c) => {
    if (rgba[c]) return rgba[c];
    const hex = palette[c];
    if (!hex) throw new Error(`Missing palette key "${c}" in sheet ${key}`);
    const v = hex.replace('#', '');
    rgba[c] = [0, 2, 4, 6].map((i) => (i < v.length ? parseInt(v.slice(i, i + 2), 16) : 255));
    return rgba[c];
  };
  rows.forEach((row, r) => row.forEach((g, col) => {
    for (let y = 0; y < fh; y += 1) for (let x = 0; x < fw; x += 1) {
      const c = get(g, x, y);
      if (!c) continue;
      const [cr, cg, cb, ca] = parse(c);
      const o = ((r * fh + y) * result.w + col * fw + x) * 4;
      image.data[o] = cr; image.data[o + 1] = cg; image.data[o + 2] = cb; image.data[o + 3] = ca;
    }
  }));
  ctx.putImageData(image, 0, 0);
  result.url = canvas.toDataURL('image/png');
  sheetCache.set(key, result);
  return result;
}

/** One-frame image helper (icons, backdrops). */
export function image(key, g, palette) {
  return sheet(key, g.w, g.h, [[g]], palette);
}

const registered = new Set();
let styleSheet = null;

/**
 * Put a sheet's data URL and logical size into one CSS rule and return its
 * class name, so each re-render only writes a short class instead of the image.
 */
export function sheetClass(prefix, key, s) {
  const className = `${prefix}-${key.replace(/[^a-z0-9]/gi, '-')}`;
  if (!s?.url || registered.has(className) || typeof document === 'undefined') return className;
  registered.add(className);
  if (!styleSheet) {
    const style = document.createElement('style');
    style.id = 'pixel-art-sheets';
    document.head.append(style);
    styleSheet = style.sheet;
  }
  styleSheet.insertRule(`.${className}{--fw:${s.fw};--fh:${s.fh};--sw:${s.w};--sh:${s.h};--top:${s.top ?? 0};background-image:url("${s.url}")}`, styleSheet.cssRules.length);
  return className;
}
