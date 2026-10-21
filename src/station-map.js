// The local station-defence map shown between Stage Clear and a city battle:
// where in the city the hero is fighting and what they defend. It is drawn in
// the Osaka campaign map's style and labelled the same way (pin + plate per
// place). Places come from src/battle-locations.js as latitude/longitude and are
// projected onto the map, so stations keep their true directions. The pixel
// map (land, water, town, rails, burning houses) is drawn once per location;
// pins, plates, the hero, the Horde and the flames are a light DOM overlay.
// stationMapScreen() returns the whole card; DEFEND! works at once (no forced
// wait) and takes Enter/Space when focused.
import { CITIES } from './region.js';
import { getBattleArt } from './battle-art.js';
import { ditherMask, grid, image, px, sheet, sheetClass } from './pixel-core.js';

export const STATION_MAP_W = 192;
export const STATION_MAP_H = 108;
const W = STATION_MAP_W, H = STATION_MAP_H;

// The Osaka campaign map's palette (pixel-effects.js MAP_PAL) and look: flat
// dithered green land, blue sea with dashed waves and a cream shore,
// dark-green lines, muted hills. Town lots and houses stay in quiet greens and
// creams so the station, the fires and the markers are the loud things.
const PAL = {
  g: '#8acb6c', G: '#74b75a', x: '#a2b186', z: '#e8d9a0', b: '#27402a',
  h: '#e8d9a0', H: '#8d9c7a', q: '#d7b98c', Q: '#8f7c5c', u: '#c4ccd2', U: '#7d8894',
  s: '#2f6fb8', w: '#8fc0ee', r: '#5b9be0',
  p: '#5fa64a', P: '#56993f', t: '#27402a', T: '#9ad67a',
  m: '#8d9c7a', M: '#6b7a5c',
  l: '#e8d9a0', a: '#6b7a5c', e: '#b3c197',
  o: '#d8413a', O: '#842538', c: '#eef0e6', k: '#2f6fb8',
  // burnt houses
  j: '#3b2a2a', J: '#5a3a30', f: '#ff8a2e',
};

const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const toPx = ([x, y]) => [(x / 100) * (W - 1), (y / 100) * (H - 1)];

/** [lat, lon] → percent of the map box for a location (x east, y south), at one scale on both axes. */
export function projector(map) {
  const [lat0, lon0] = map.center;
  const kmX = 111.32 * Math.cos((lat0 * Math.PI) / 180), kmY = 110.57;
  const kmH = (map.km * H) / W;
  return ([lat, lon]) => [50 + (((lon - lon0) * kmX) / map.km) * 100, 50 - (((lat - lat0) * kmY) / kmH) * 100];
}

/* ---------------------------------------------------------------- drawing */

function surface() {
  const g = grid(W, H);
  const used = new Uint8Array(W * H);
  const mark = (x, y) => { x = Math.round(x); y = Math.round(y); if (inside(x, y)) used[y * W + x] = 1; };
  const paint = (x, y, c, claim = true) => { x = Math.round(x); y = Math.round(y); if (!inside(x, y)) return; px(g, x, y, c); if (claim) used[y * W + x] = 1; };
  return { g, used, mark, paint };
}

/** Points along a polyline (map pixels) every `step` px, with the unit direction and distance. */
function walk(points, step = 0.5) {
  const out = [];
  let dist = 0;
  for (let i = 0; i + 1 < points.length; i += 1) {
    const [x0, y0] = points[i], [x1, y1] = points[i + 1];
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const dir = [(x1 - x0) / len, (y1 - y0) / len];
    for (let t = 0; t <= len; t += step) out.push({ x: x0 + dir[0] * t, y: y0 + dir[1] * t, dir, d: dist + t });
    dist += len;
  }
  return out;
}
function disc(s, cx, cy, r, c, claim = true) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
    if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) { if (c) s.paint(x, y, c, claim); else if (claim) s.mark(x, y); }
  }
}
function fillPoly(points, paint) {
  const ys = points.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y += 1) {
    const cy = y + 0.5, xs = [];
    for (let i = 0; i < points.length; i += 1) {
      const [ax, ay] = points[i], [bx, by] = points[(i + 1) % points.length];
      if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x += 1) paint(x, y);
  }
}
function box(s, x, y, w, h, c) { for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) s.paint(x + i, y + j, c); }

function drawWater(s, polygon) {
  fillPoly(polygon, (x, y) => s.paint(x, y, 's'));
  fillPoly(polygon, (x, y) => { if ((x * 5 + y * 9) % 29 === 0) { s.paint(x, y, 'w'); s.paint(x + 1, y, 'w'); } });
}
/** Cream shore on the land side of the sea, like the Osaka map's coastline. */
function drawShore(s) {
  const sea = (x, y) => inside(x, y) && (s.g.d[y * W + x] === 's' || s.g.d[y * W + x] === 'w');
  const edge = [];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!sea(x, y) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => sea(x + dx, y + dy))) edge.push([x, y]);
  }
  edge.forEach(([x, y]) => s.paint(x, y, 'z'));
}
function drawPark(s, polygon) {
  fillPoly(polygon, (x, y) => s.paint(x, y, ditherMask(x, y, 0.22) ? 'P' : 'p'));
  fillPoly(polygon, (x, y) => {
    if ((x * 7 + y * 11) % 23 !== 0) return;
    s.paint(x, y, 't'); s.paint(x + 1, y, 't'); s.paint(x, y - 1, 'T'); s.paint(x + 1, y - 1, 't'); s.paint(x, y + 1, 'P');
  });
}
function drawRiver(s, points, width) {
  const path = walk(points);
  path.forEach(({ x, y }) => disc(s, x, y, width / 2 + 1, 'b'));
  path.forEach(({ x, y }) => disc(s, x, y, width / 2, 'r'));
  path.forEach(({ x, y, d }) => { if (Math.round(d) % 11 === 0) { s.paint(x - 2, y - 1, 'w'); s.paint(x - 1, y - 1, 'w'); } });
}
/** The Osaka map's hill: a muted triangle with its east half in shade. */
function drawHill(s, [cx, cy]) {
  fillPoly([[cx - 10, cy + 6], [cx, cy - 7], [cx + 10, cy + 6]], (x, y) => s.paint(x, y, 'm'));
  fillPoly([[cx, cy - 7], [cx + 10, cy + 6], [cx + 3, cy + 6]], (x, y) => s.paint(x, y, 'M'));
}
function drawAirport(s, [cx, cy], lengthPx, widthPx) {
  const x0 = Math.round(cx - lengthPx / 2), y0 = Math.round(cy - widthPx / 2);
  box(s, x0, y0, Math.round(lengthPx), Math.round(widthPx), 'e');
  const mid = Math.round(cy);
  box(s, x0 + 2, mid - 2, Math.round(lengthPx) - 4, 5, 'a');
  for (let x = x0 + 5; x < x0 + lengthPx - 6; x += 6) { s.paint(x, mid, 'l'); s.paint(x + 1, mid, 'l'); s.paint(x + 2, mid, 'l'); }
  box(s, x0 + 3, y0 + 1, 3, 4, 'c'); box(s, x0 + 2, y0, 5, 1, 'U');
}
function drawDepot(s, a, b) {
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
  box(s, Math.round(x0), Math.round(y0), Math.round(x1 - x0), Math.round(y1 - y0), 'x');
  for (let y = Math.round(y0) + 2; y < y1 - 1; y += 4) track(s, [[x0 + 1, y], [x1 - 1, y]], 1.4);
}

/** A railway in the map's line style: a dark-green line with cream ties. */
function track(s, points, r = 2.2) {
  const path = walk(points, 0.5);
  path.forEach(({ x, y }) => disc(s, x, y, r * 0.6, 'b'));
  path.forEach(({ x, y, dir, d }) => {
    const n = [-dir[1], dir[0]];
    if (Math.round(d * 2) % 8 === 0) for (let k = -r; k <= r; k += 0.5) s.paint(x + n[0] * k, y + n[1] * k, Math.abs(k) > r * 0.6 ? 'b' : 'l');
  });
}
function drawLine(s, points, kind) {
  if (kind === 'subway') { walk(points, 0.5).forEach(({ x, y, d }) => { if (Math.floor(d / 3) % 2 === 0) disc(s, x, y, 1, 'k'); }); return; }
  track(s, points, kind === 'tram' ? 1.5 : 2.2);
  if (kind === 'terminus' || kind === 'tram') {
    const end = walk(points).at(-1); const n = [-end.dir[1], end.dir[0]];
    for (let k = -3; k <= 3; k += 0.5) s.paint(end.x + n[0] * k + end.dir[0] * 2, end.y + n[1] * k + end.dir[1] * 2, 'o');
  }
}
/** Platform and a red-roofed station house beside the track. */
function drawStationHouse(s, [cx, cy], dir) {
  const n = [-dir[1], dir[0]];
  for (let t = -9; t <= 9; t += 0.5) for (let k = 3; k <= 4.5; k += 0.5) s.paint(cx + dir[0] * t + n[0] * k, cy + dir[1] * t + n[1] * k, 'z');
  for (let t = -6; t <= 6; t += 0.5) for (let k = 5.5; k <= 9.5; k += 0.5) s.paint(cx + dir[0] * t + n[0] * k, cy + dir[1] * t + n[1] * k, k > 8.5 ? 'O' : 'o');
}
function drawLandmark(s, kind, [cx, cy]) {
  cx = Math.round(cx); cy = Math.round(cy);
  if (kind === 'cityHall') {
    box(s, cx - 4, cy - 13, 9, 15, 'c'); box(s, cx + 2, cy - 13, 3, 15, 'H');
    for (let y = cy - 11; y < cy; y += 3) for (let x = cx - 3; x < cx + 2; x += 2) s.paint(x, y, 'k');
  } else if (kind === 'university') {
    box(s, cx - 9, cy - 5, 18, 8, 'h'); box(s, cx - 9, cy - 7, 18, 2, 'q'); box(s, cx - 9, cy + 3, 18, 1, 'H');
    box(s, cx - 2, cy - 11, 5, 6, 'h'); box(s, cx - 2, cy - 12, 5, 1, 'q'); s.paint(cx, cy - 9, 'k');
  } else if (kind === 'lighthouse') {
    box(s, cx - 1, cy - 9, 3, 10, 'c'); box(s, cx - 1, cy - 6, 3, 1, 'o'); box(s, cx - 2, cy - 11, 5, 2, 'O'); s.paint(cx, cy - 12, 'z');
  } else if (kind === 'shrine') {
    box(s, cx - 5, cy - 7, 11, 2, 'o'); box(s, cx - 4, cy - 5, 9, 1, 'o'); box(s, cx - 3, cy - 5, 1, 7, 'o'); box(s, cx + 3, cy - 5, 1, 7, 'o');
    disc(s, cx - 7, cy + 1, 2.4, 't'); disc(s, cx + 7, cy, 2.4, 't');
  }
}

// City blocks: a pale lot with up to four houses (or a garden); a block that
// would touch a rail, the water, a landmark or the station plaza is left out.
const ROOFS = [['h', 'H'], ['h', 'H'], ['h', 'H'], ['u', 'U'], ['u', 'U'], ['q', 'Q']];
function drawBlocks(s, seed) {
  const houses = [];
  const BW = 15, BH = 11;
  for (let row = 0, by = 2; by + BH - 3 <= H; row += 1, by += BH) for (let bx = 2 - (row % 2) * 7; bx < W; bx += BW) {
    const x0 = Math.max(0, bx), x1 = Math.min(W, bx + BW - 3), y0 = by, y1 = Math.min(H, by + BH - 3);
    if (x1 - x0 < 6) continue;
    let free = true;
    for (let y = y0 - 1; y <= y1 && free; y += 1) for (let x = x0 - 1; x <= x1 && free; x += 1) if (inside(x, y) && s.used[y * W + x]) free = false;
    if (!free) continue;
    const hash = Math.abs((bx * 73 + by * 151 + seed * 37) % 101);
    if (hash % 11 === 0) {
      box(s, x0, y0, x1 - x0, y1 - y0, 'p');
      for (let x = x0 + 1; x < x1 - 1; x += 4) { s.paint(x, y0 + 2, 't'); s.paint(x + 1, y0 + 2, 't'); s.paint(x, y0 + 1, 'T'); }
      continue;
    }
    box(s, x0, y0, x1 - x0, y1 - y0, 'x');
    const hw = Math.floor((x1 - x0 - 1) / 2), hh = Math.floor((y1 - y0 - 1) / 2);
    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([i, j], n) => {
      const h2 = (hash + n * 17) % 13;
      const hx = x0 + i * (hw + 1), hy = y0 + j * (hh + 1);
      if (h2 === 0) { s.paint(hx + 1, hy + 1, 't'); s.paint(hx + 2, hy + 1, 't'); s.paint(hx + 1, hy, 'T'); return; }
      const [roof, shade] = ROOFS[h2 % ROOFS.length];
      box(s, hx, hy, hw, hh - 1, roof); box(s, hx, hy + hh - 1, hw, 1, shade);
      houses.push({ x: hx, y: hy, w: hw, h: hh });
    });
  }
  return houses;
}

/** Houses the Horde has set alight: the ones nearest the attack routes, away from the station. Painted burnt; flames are DOM. */
function burnHouses(s, houses, routes, station, count = 5) {
  const near = (h) => {
    const cx = h.x + h.w / 2, cy = h.y + h.h / 2;
    return Math.min(...routes.map(([a, b]) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((cx - a[0]) * dx + (cy - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(cx - (a[0] + dx * t), cy - (a[1] + dy * t));
    }));
  };
  const chosen = houses
    .filter((h) => Math.hypot(h.x + h.w / 2 - station[0], h.y + h.h / 2 - station[1]) > 24)
    .map((h, i) => ({ h, score: near(h) + ((i * 7) % 5) }))
    .sort((a, b) => a.score - b.score);
  const fires = [];
  for (const { h } of chosen) {
    if (fires.length >= count) break;
    if (fires.some((f) => Math.hypot(f.x - h.x, f.y - h.y) < 16)) continue;
    box(s, h.x, h.y, h.w, h.h - 1, 'j'); box(s, h.x, h.y + h.h - 1, h.w, 1, 'J');
    s.paint(h.x + 1, h.y + 1, 'f'); s.paint(h.x + h.w - 2, h.y + h.h - 2, 'f');
    fires.push({ x: h.x, y: h.y, cx: h.x + h.w / 2, cy: h.y });
  }
  return fires.map((f) => [(f.cx / (W - 1)) * 100, (f.cy / (H - 1)) * 100]);
}

/** Each line's stops as map percent points, extended past the frame where the real line goes on. */
function linePaths(location) {
  const project = projector(location.map);
  const station = location.station.place;
  return location.map.lines.map((line) => {
    const pts = line.stops.map((stop) => project(stop.at));
    const extend = (a, b) => [b[0] + (b[0] - a[0]) * 6, b[1] + (b[1] - a[1]) * 6];
    const startIsStation = line.stops[0].at === station;
    const ends = line.kind === 'terminus' || line.kind === 'tram';
    const path = [...(startIsStation ? [] : [extend(pts[1], pts[0])]), ...pts, ...(ends ? [] : [extend(pts.at(-2), pts.at(-1))])];
    return { line, pts, path };
  });
}

function drawLocation(location) {
  const s = surface();
  const map = location.map;
  const project = projector(map);
  const P = (at) => toPx(project(at));
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) px(s.g, x, y, ditherMask(x, y, 0.22) ? 'G' : 'g');
  (map.water ?? []).forEach((polygon) => drawWater(s, polygon.map(P)));
  if (map.water) drawShore(s);
  (map.parks ?? []).forEach((polygon) => drawPark(s, polygon.map(P)));
  (map.rivers ?? []).forEach((river) => drawRiver(s, river.points.map(P), river.width));
  (map.mountains ?? []).forEach((at) => drawHill(s, P(at)));
  const kmPerPx = map.km / W;
  if (map.airport) drawAirport(s, P(map.airport.at), map.airport.length / kmPerPx, map.airport.width / kmPerPx);
  if (map.depot) drawDepot(s, P(map.depot[0]), P(map.depot[1]));
  const paths = linePaths(location);
  paths.forEach(({ path }) => walk(path.map(toPx)).forEach(({ x, y }) => disc(s, x, y, 4.5, null)));
  const station = P(location.station.place);
  disc(s, station[0], station[1], 14, null);
  (map.landmarks ?? []).forEach(({ kind, at }) => { if (kind !== 'park' && kind !== 'mountain' && kind !== 'airport') { const [lx, ly] = P(at); disc(s, lx, ly - 4, 12, null); } });
  const houses = drawBlocks(s, location.stage * 13 + location.station.name.length);
  const routes = map.threats.map((from) => [toPx(from), station]);
  const fires = burnHouses(s, houses, routes, station);
  paths.forEach(({ path, line }) => drawLine(s, path.map(toPx), line.kind));
  const main = walk(paths[0].path.map(toPx)).reduce((best, p) => (Math.hypot(p.x - station[0], p.y - station[1]) < Math.hypot(best.x - station[0], best.y - station[1]) ? p : best));
  drawStationHouse(s, station, main.dir);
  (map.landmarks ?? []).forEach(({ kind, at }) => drawLandmark(s, kind, P(at)));
  return { g: s.g, fires };
}

const drawn = new Map();
function drawnLocation(cityId, location) {
  const key = `station-${cityId}-${location.stage}`;
  if (!drawn.has(key)) { const { g, fires } = drawLocation(location); drawn.set(key, { sheet: image(key, g, PAL), fires }); }
  return drawn.get(key);
}
/** The location's pixel map as a one-frame sheet (cached). */
export function stationMapImage(cityId, location) { return drawnLocation(cityId, location).sheet; }

// A three-frame flickering flame for the burning houses.
let flameSheet = null;
function flameArt() {
  if (!flameSheet) {
    const frames = [
      ['...o....', '..ooo...', '..oyo.o.', '.ooyyoo.', '.oyyyyo.', 'ooyWWyoo', '.oyWWyo.', '..oooo..'],
      ['....o...', '...ooo..', '.o.oyo..', '.ooyyoo.', '.oyyyyo.', 'ooyWWyoo', '.oyWWyo.', '..oooo..'],
      ['..o..o..', '..oooo..', '..oyyo..', '.ooyyoo.', 'ooyyyyo.', '.oyWWyoo', '.oyWWyo.', '..oooo..'],
    ].map((rows) => { const g = grid(8, 8); rows.forEach((row, y) => [...row].forEach((c, x) => { if (c !== '.') px(g, x, y, c); })); return g; });
    flameSheet = sheet('station-flame', 8, 8, [frames], { o: '#e8501e', y: '#ffb52e', W: '#fff4b0' });
  }
  return flameSheet;
}

/* ----------------------------------------------------------------- the card */

const el = (tag, className = '', text = '') => { const node = document.createElement(tag); node.className = className; node.textContent = text; return node; };
const pct = (value) => `${value}%`;
const ROAMERS = { yao: ['hornGoblin', 'bombSlime', 'goblin', 'bat'], sakai: ['goblin', 'wolf', 'bat', 'slime'], matsubara: ['slime', 'bat', 'goblin', 'mushroom'] };

function ruby(base, reading) {
  const r = document.createElement('ruby'); r.append(base);
  const rt = document.createElement('rt'); rt.textContent = reading; r.append(rt);
  return r;
}
// Room for a pin with its plate underneath; nearer the edge a station gets an edge plate instead.
const onMap = ([x, y]) => x >= 8 && x <= 92 && y >= 6 && y <= 82;

/** An Osaka-map marker (pin + plate). state: 'danger' (the station), 'locked' (a neighbouring station) or 'place'. */
function marker(state, [x, y], name, sub, extra = '') {
  const node = el('span', `osaka-city osaka-city--${state} station-map__marker${extra}`);
  node.style.left = pct(x); node.style.top = pct(y);
  const plate = el('span', 'osaka-city__plate');
  plate.append(el('b', 'osaka-city__name', name), el('span', 'osaka-city__state', sub));
  const pin = el('span', 'osaka-city__pin', state === 'danger' ? '!' : '');
  node.append(...(state === 'place' ? [plate] : [pin, plate]));
  node.setAttribute('aria-hidden', 'true');
  return node;
}

/** Where the segment from an on-map point toward an off-map point leaves the inner frame. */
function edgePoint(from, to) {
  const [x0, y0] = from, [x1, y1] = to;
  let t = 1;
  if (x1 < 11) t = Math.min(t, (11 - x0) / (x1 - x0)); if (x1 > 89) t = Math.min(t, (89 - x0) / (x1 - x0));
  if (y1 < 9) t = Math.min(t, (9 - y0) / (y1 - y0)); if (y1 > 91) t = Math.min(t, (91 - y0) / (y1 - y0));
  return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
}
const ARROWS = [[-1, 0, '◀'], [1, 0, '▶'], [0, -1, '▲'], [0, 1, '▼']];
const arrowFor = (dx, dy) => ARROWS.reduce((best, a) => (a[0] * dx + a[1] * dy > best[0] * dx + best[1] * dy ? a : best))[2];

/** Neighbouring stations: on the map they get a grey pin + plate; off it, an edge plate pointing the true way. */
function neighbourMarkers(location) {
  const project = projector(location.map);
  const station = location.station.place;
  const seen = new Set([location.station.name]);
  const out = [];
  for (const { line, pts } of linePaths(location)) {
    const at = line.stops.findIndex((stop) => stop.at === station);
    const runs = at < 0 ? [line.stops.map((_, i) => i)] : [Array.from({ length: at }, (_, i) => at - 1 - i), Array.from({ length: line.stops.length - at - 1 }, (_, i) => at + 1 + i)];
    for (const run of runs) {
      let last = at < 0 ? null : pts[at];
      for (const i of run) {
        const stop = line.stops[i];
        if (!stop.ja || seen.has(stop.en)) { last = pts[i]; continue; }
        seen.add(stop.en);
        if (onMap(pts[i])) { out.push(marker('locked', pts[i], stop.ja, `${stop.en}`, ' station-map__marker--next')); last = pts[i]; continue; }
        if (!last) break;
        const [ex, ey] = edgePoint(last, pts[i]);
        if (Math.hypot(ex - last[0], (ey - last[1]) * (H / W)) < 14) break; // it would cover the nearer station's plate
        out.push(marker('place', [ex, ey], `${arrowFor(pts[i][0] - last[0], pts[i][1] - last[1])} ${stop.ja}`, stop.en, ' station-map__marker--edge'));
        break;
      }
    }
  }
  return out;
}

/** An arrow from a threat (percent point) toward the station that stops short of it. */
function threatArrow(from, to) {
  const aspect = H / W;
  const dx = to[0] - from[0], dy = (to[1] - from[1]) * aspect;
  const arrow = el('span', 'station-threat__arrow');
  arrow.style.left = pct(from[0]); arrow.style.top = pct(from[1]);
  arrow.style.width = pct(Math.max(6, Math.hypot(dx, dy) - 12));
  arrow.style.rotate = `${Math.atan2(dy, dx)}rad`;
  return arrow;
}

function sprite(id) { const span = el('span', 'station-map__sprite'); span.innerHTML = getBattleArt(id, 'idle'); return span; }

/**
 * The station-defence card: stage + city, the station name (kanji with kana),
 * the map, the goal and DEFEND!. onDefend runs once.
 */
export function stationMapScreen(location, { cityId, heroId, stage = location.stage, onDefend = () => {} } = {}) {
  const city = CITIES[cityId];
  const project = projector(location.map);
  const stationAt = project(location.station.place);
  const card = el('section', 'rpg-card px-panel station-card');
  card.setAttribute('aria-label', `Stage ${stage}: defend ${location.station.name} Station`);

  const head = el('header', 'station-card__head');
  head.append(el('span', 'station-card__stage', `STAGE ${stage}${city ? ` · ${city.jaName}` : ''}`));
  const name = el('h1', 'station-card__name');
  const ja = el('span', 'station-card__ja'); ja.lang = 'ja';
  ja.append(ruby(location.station.jaName, location.station.kana), ruby('駅', 'えき'));
  name.append(ja, el('small', 'station-card__en', `${location.station.name.toUpperCase()} STATION`));
  head.append(name);

  const { sheet: mapSheet, fires } = drawnLocation(cityId, location);
  const map = el('div', `station-map ${sheetClass('pxst', `${cityId}-${location.stage}`, mapSheet)}`);
  map.setAttribute('role', 'img');
  map.setAttribute('aria-label', `Map of ${location.station.name} Station (${location.station.line}). The Horde is coming from ${location.map.threats.length} directions and houses are on fire.`);

  const flame = flameArt();
  const flameClass = sheetClass('pxfl', 'station-flame', flame);
  fires.forEach(([x, y], i) => {
    const fire = el('span', `station-fire px-sprite ${flameClass}`);
    fire.style.left = pct(x); fire.style.top = pct(y); fire.style.setProperty('--i', i);
    fire.setAttribute('aria-hidden', 'true');
    map.append(fire);
  });
  for (const river of location.map.rivers ?? []) {
    if (!river.label) continue;
    const label = el('span', 'station-map__water-label');
    label.append(el('b', '', river.ja), el('small', '', river.en));
    const [x, y] = project(river.label); label.style.left = pct(x); label.style.top = pct(y);
    label.setAttribute('aria-hidden', 'true');
    map.append(label);
  }
  for (const landmark of location.map.landmarks ?? []) {
    const at = project(landmark.at);
    if (landmark.kind === 'mountain') {
      const label = el('span', 'station-map__water-label station-map__water-label--hill');
      label.append(el('b', '', landmark.ja), el('small', '', landmark.en));
      label.style.left = pct(Math.min(90, at[0])); label.style.top = pct(Math.max(8, at[1] - 12));
      label.setAttribute('aria-hidden', 'true');
      map.append(label);
    } else {
      // A plate close to the station moves away from it so the two never overlap.
      const dx = at[0] - stationAt[0], dy = (at[1] - stationAt[1]) * (H / W), d = Math.hypot(dx, dy) || 1;
      const push = d < 18 ? 12 : 0;
      const plateAt = [Math.max(10, Math.min(90, at[0] + (dx / d) * push)), Math.max(8, Math.min(92, at[1] + 5 + ((dy / d) * push) / (H / W)))];
      map.append(marker('place', plateAt, landmark.ja, landmark.en, ' station-map__marker--landmark'));
    }
  }
  map.append(...neighbourMarkers(location));

  // The Horde: one marching unit per approach, plus small monsters roaming by the fires.
  const roamers = ROAMERS[cityId] ?? ROAMERS.matsubara;
  location.map.threats.forEach((from, index) => {
    const threat = el('span', 'station-threat');
    threat.style.setProperty('--i', index);
    threat.setAttribute('aria-hidden', 'true');
    threat.append(threatArrow(from, stationAt));
    const unit = sprite(roamers[index % roamers.length]);
    unit.classList.add('station-threat__unit');
    unit.style.left = pct(from[0]); unit.style.top = pct(from[1]);
    threat.append(unit);
    map.append(threat);
  });
  fires.forEach(([x, y], i) => {
    if (i % 2) return;
    const monster = sprite(roamers[(i + 1) % roamers.length]);
    monster.classList.add('station-roamer');
    monster.style.left = pct(Math.max(5, Math.min(95, x + (i % 4 ? 4 : -4)))); monster.style.top = pct(Math.min(92, y + 6));
    monster.style.setProperty('--i', i);
    monster.setAttribute('aria-hidden', 'true');
    map.append(monster);
  });

  // The station under attack, with the hero standing guard beside it.
  const hero = sprite(heroId);
  hero.classList.add('station-map__hero');
  hero.style.left = pct(stationAt[0]); hero.style.top = pct(stationAt[1]);
  if (stationAt[0] < 35) hero.classList.add('station-map__hero--east'); // keep clear of the west edge plates
  hero.setAttribute('aria-hidden', 'true');
  map.append(hero, marker('danger', stationAt, `${location.station.jaName}駅`, 'きけん！', ' station-map__marker--station'));

  const goal = el('p', 'station-card__goal');
  const goalJa = el('b', ''); goalJa.lang = 'ja';
  goalJa.append(ruby('駅', 'えき'), 'を まもれ！');
  goal.append(goalJa, el('span', '', 'DEFEND THE STATION!'));
  const note = el('p', 'station-card__note');
  note.append(el('span', '', location.note.ja), el('small', '', location.note.en));

  const defend = el('button', 'px-button station-defend');
  defend.type = 'button';
  defend.append(el('span', '', 'まもる！'), el('small', '', 'DEFEND!'));
  let done = false;
  defend.addEventListener('click', () => { if (done) return; done = true; onDefend(); });

  const words = el('div', 'station-card__words');
  words.append(goal, note);
  const foot = el('div', 'station-card__foot');
  foot.append(words, defend);
  card.append(head, map, foot);
  queueMicrotask(() => defend.focus());
  return card;
}
