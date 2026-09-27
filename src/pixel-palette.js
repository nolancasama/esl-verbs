// The one shared RPG palette. Sprites, icons and effects use only these keys,
// so the whole Adventure layer stays palette-driven and swaps are key remaps.
export const PAL = Object.freeze({
  k: '#1a1c2c', // outline
  K: '#33254d', // deep shadow purple
  W: '#ffffff',
  w: '#f4f1ea',
  j: '#e9dcb4', // bone / parchment
  f: '#f7c9a1', // skin
  F: '#d98f68', // skin shade
  q: '#ff8e72', // coral / blush
  r: '#d8413a',
  R: '#842538',
  o: '#f28a2e',
  y: '#ffd35a',
  Y: '#fff4b0',
  n: '#c98f58', // tan
  b: '#8a5634', // brown
  B: '#553425', // dark brown
  l: '#9be26a', // lime
  e: '#3f9e56', // green
  G: '#1f6448', // dark green
  c: '#9ff3ee', // pale cyan
  t: '#3aa9cc', // teal
  T: '#1f5f84',
  U: '#86b8ff',
  u: '#4270d6',
  D: '#26367d', // navy
  V: '#bd92f2',
  v: '#7a4cc0',
  P: '#43287a',
  M: '#ff8ad4',
  m: '#c23d8c',
  i: '#d9e6f2', // steel light
  s: '#93aac4', // steel
  S: '#546a88', // steel dark
  X: '#aeb0b8', // stone light
  x: '#76798a', // stone
  z: '#474a5c', // stone dark
  '~': '#3a4f9c80', // afterimage
  '=': '#9ff3ee88', // barrier glass
  '_': '#1a1c2c50', // ground shadow
  '*': '#ffffffc0', // soft flash
});

/** Key remaps for palette-swapped states. */
export const DIM = Object.freeze({
  W: 'X', w: 'X', j: 'n', f: 'F', q: 'r', r: 'R', o: 'b', y: 'n', Y: 'y', n: 'b', b: 'B', l: 'e', e: 'G',
  c: 't', t: 'T', U: 'u', u: 'D', V: 'v', v: 'P', M: 'm', m: 'R', i: 's', s: 'S', X: 'x', x: 'z', z: 'K',
});

export const FLASH = (c) => (c === 'k' ? 'k' : 'W');
