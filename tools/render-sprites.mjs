// Writes every sprite sheet (and backdrops/effects) as scaled PNGs for art review,
// without a browser: node tools/render-sprites.mjs [outDir] [scale] [ids...]
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import path from 'node:path';
import { ENEMY_IDS, HERO_IDS, ROWS, spriteSheet } from '../src/pixel-sprites.js';
import { EFFECT_NAMES, backdropImage, cityImage, effectSheet , osakaMapImage } from '../src/pixel-effects.js';

const out = process.argv[2] || 'art-review';
const scale = Number(process.argv[3] || 4);
const only = process.argv.slice(4);
mkdirSync(out, { recursive: true });

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const hex = (value) => { const v = value.replace('#', ''); return [0, 2, 4, 6].map((i) => (i < v.length ? parseInt(v.slice(i, i + 2), 16) : 255)); };

/** Draw a sheet's grids onto a checker background, scaled, with 1px gutters between frames. */
function renderSheet(sheet, name, background = [120, 170, 200]) {
  const { grids, palette, fw, fh } = sheet;
  const cols = Math.max(...grids.map((row) => row.length));
  const width = (cols * (fw + 2)) * scale, height = (grids.length * (fh + 2)) * scale;
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const x = Math.floor(i % width / scale), y = Math.floor(i / width / scale);
    const checker = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 ? 0 : 10;
    rgba.set([background[0] + checker, background[1] + checker, background[2] + checker, 255], i * 4);
  }
  grids.forEach((row, r) => row.forEach((g, c) => {
    for (let y = 0; y < fh; y += 1) for (let x = 0; x < fw; x += 1) {
      const key = g.d[y * g.w + x];
      if (!key) continue;
      const [cr, cg, cb, ca] = hex(palette[key]);
      for (let sy = 0; sy < scale; sy += 1) for (let sx = 0; sx < scale; sx += 1) {
        const px = ((c * (fw + 2) + 1 + x) * scale + sx), py = ((r * (fh + 2) + 1 + y) * scale + sy);
        const o = (py * width + px) * 4, a = ca / 255;
        rgba[o] = Math.round(cr * a + rgba[o] * (1 - a)); rgba[o + 1] = Math.round(cg * a + rgba[o + 1] * (1 - a)); rgba[o + 2] = Math.round(cb * a + rgba[o + 2] * (1 - a));
      }
    }
  }));
  writeFileSync(path.join(out, `${name}.png`), png(width, height, rgba));
  console.log(`${name}.png  ${fw}x${fh}  rows ${grids.length}`);
}

const ids = only.length ? only : [...HERO_IDS, ...ENEMY_IDS, 'backdrops', 'city', 'effects'];
for (const id of ids) {
  if (id === 'map') { renderSheet(osakaMapImage(), 'osaka-map'); continue; }
  if (id === 'city') { for (const mood of ['calm', 'danger', 'safe', 'monsters']) renderSheet(cityImage(mood), `city-${mood}`); continue; }
  if (id === 'backdrops') { for (const stage of [1, 2, 3, 4]) renderSheet(backdropImage(stage), `backdrop-${stage}`); continue; }
  if (id === 'effects') { for (const name of EFFECT_NAMES) renderSheet(effectSheet(name), `fx-${name}`, [40, 44, 70]); continue; }
  renderSheet(spriteSheet(id), id);
  if (spriteSheet(id, 'enraged') && ['dragon', 'demonKing', 'giantGolem', 'vampireLord'].includes(id)) renderSheet(spriteSheet(id, 'enraged'), `${id}-enraged`);
}
console.log(`rows: ${ROWS.join(', ')}`);
