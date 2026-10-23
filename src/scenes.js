// Where the Adventure happens: data for the neighbourhood scenes behind the
// quiz (training) and the battles. Each city stage has a small pool of battle
// scenes that match its station from src/battle-locations.js (the map the
// player just saw), and each city a pool of calmer training scenes. Danger
// grows with the campaign: a damage level 0-3 and a time of day per stage.
// Tone: kid-friendly danger. Smoke, cracks, broken windows and people getting
// away safely; never anyone hurt. src/pixel-scenes.js draws the descriptions.

import { battleLocation } from './battle-locations.js';

// Far skylines and landmarks per city ([name, options] for pixel-scenes FAR).
const FAR = {
  matsubara: [['hills', { base: 84, amp: 8, phase: 40 }], ['skyline', { y: 90, max: 7 }], ['harukas', { x: 322, h: 40, key: 'F1' }]],
  sakai: [['hills', { base: 86, amp: 6 }], ['skyline', { y: 89, max: 12 }], ['kofun', { x: 46, w: 92 }], ['tower', { x: 288, h: 50, w: 13 }]],
  yao: [['ikoma', { base: 80, amp: 22, x0: 250 }], ['skyline', { y: 90, max: 8 }]],
  higashiosaka: [['ikoma', { base: 76, amp: 30, x0: 300 }], ['skyline', { y: 89, max: 12 }]],
  osakaCity: [['skyline', { y: 86, max: 26, key: 'F0' }], ['skyline', { y: 90, max: 16 }]],
};

// A scene variant: [archetype, extra options]. Pools are per city stage
// (battles) or per city (training).
const v = (archetype, extra = {}) => ({ archetype, ...extra });

const CITIES = {
  matsubara: {
    line: 'kintetsu', lineColor: 'trK',
    damage: [1, 1, 1, 2], time: ['day', 'day', 'evening', 'dusk'],
    training: { damage: 0, times: ['day', 'day', 'evening'], pool: [v('lot'), v('school'), v('paddies'), v('plaza', { store: 'familymart' })] },
    stages: {
      1: [v('station', { store: 'familymart', tags: ['station', 'shopping'] }), v('shotengai', { tags: ['shopping'] }), v('residential', { tags: ['neighbourhood'] })],
      2: [v('residential', { tags: ['neighbourhood'] }), v('park', { tags: ['park', 'city-hall'] }), v('paddies', { tags: ['rice-paddies'] })],
      3: [v('shrine', { tags: ['shrine'] }), v('residential', { tags: ['neighbourhood'] }), v('paddies', { tags: ['rice-paddies'] })],
      // boss: the Yamato River embankment or the station by Hannan University
      4: [v('river', { tags: ['river', 'yamato-river'] }), v('station', { store: 'lawson', tags: ['station', 'university'] })],
    },
  },
  sakai: {
    line: 'nankai', lineColor: 'trO',
    damage: [1, 2, 2, 2], time: ['day', 'evening', 'smoke', 'dusk'],
    training: { damage: 0, times: ['day', 'evening'], pool: [v('plaza', { store: 'lawson' }), v('park'), v('lot'), v('shotengai')] },
    stages: {
      1: [v('station', { store: 'lawson', tags: ['station', 'junction'] }), v('school', { university: true, tags: ['university'] }), v('downtown', { tags: ['city'] })],
      2: [v('station', { tags: ['station', 'city-hall'] }), v('shotengai', { tags: ['shopping'] }), v('downtown', { tags: ['city', 'city-hall'] })],
      3: [v('river', { lighthouse: true, far: [['hills', { base: 88, amp: 4 }], ['cranes', { x: 300 }], ['skyline', { y: 90, max: 8 }]], tags: ['port', 'lighthouse'] }), v('industrial', { tags: ['port'] }), v('residential', { tags: ['old-town'] })],
      // boss: Hamadera Park's pines and the old wooden station
      4: [v('park', { pines: true, oldStation: true, signName: '浜寺公園', far: [['hills', { base: 88, amp: 4 }], ['pines', { y: 90 }]], tags: ['park', 'pines', 'historic-station'] })],
    },
  },
  yao: {
    line: 'kintetsu', lineColor: 'trK',
    damage: [2, 2, 2, 3], time: ['smoke', 'day', 'evening', 'dusk'],
    training: { damage: 1, times: ['day', 'evening'], pool: [v('paddies', { far: [...FAR.yao, ['plane', { x: 92, y: 26 }]] }), v('school'), v('lot'), v('plaza', { store: 'familymart' })] },
    stages: {
      1: [v('paddies', { far: [...FAR.yao, ['plane', { x: 240, y: 28 }]], tags: ['airport', 'rice-paddies'] }), v('residential', { far: [...FAR.yao, ['plane', { x: 150, y: 22 }]], tags: ['neighbourhood'] }), v('station', { line: 'metro', lineColor: 'trM', tags: ['station', 'terminus'] })],
      2: [v('station', { line: 'jr', lineColor: 'trO', store: 'lawson', tags: ['station'] }), v('residential', { tags: ['neighbourhood'] }), v('shotengai', { tags: ['shopping'] })],
      3: [v('shotengai', { tags: ['shopping', 'downtown'] }), v('downtown', { tags: ['downtown'] }), v('station', { store: 'familymart', tags: ['station', 'downtown'] })],
      // boss: under the Ikoma hills where two lines split
      4: [v('residential', { far: [['ikoma', { base: 74, amp: 34, x0: 230 }], ['skyline', { y: 90, max: 6 }]], tags: ['neighbourhood', 'mountains'] }), v('station', { far: [['ikoma', { base: 74, amp: 34, x0: 230 }]], tags: ['station', 'junction'] })],
    },
  },
  higashiosaka: {
    line: 'kintetsu', lineColor: 'trK',
    damage: [2, 2, 3, 3], time: ['smoke', 'evening', 'dusk', 'night'],
    training: { damage: 1, times: ['day', 'evening'], pool: [v('industrial'), v('school', { rugby: true }), v('shrine', { sando: true }), v('lot')] },
    stages: {
      1: [v('shrine', { sando: true, tags: ['shrine', 'mountains'] }), v('residential', { tags: ['neighbourhood', 'mountains'] }), v('industrial', { tags: ['factories'] })],
      2: [v('park', { far: [...FAR.higashiosaka, ['stadium', { x: 250 }]], tags: ['rugby-stadium'] }), v('industrial', { tags: ['factories'] }), v('residential', { tags: ['neighbourhood'] })],
      3: [v('downtown', { highway: true, far: [...FAR.higashiosaka, ['tower', { x: 60, h: 56, w: 16 }]], tags: ['city-hall', 'expressway'] }), v('industrial', { tags: ['factories'] })],
      // boss: Fuse, the gateway to Osaka City, at night
      4: [v('shotengai', { tags: ['shopping-arcade'] }), v('industrial', { tags: ['factories'] })],
    },
  },
  osakaCity: {
    line: 'jr', lineColor: 'trO',
    damage: [2, 3, 3, 3], time: ['smoke', 'dusk', 'dusk', 'night'],
    training: { damage: 1, times: ['evening', 'day'], pool: [v('river', { far: [...FAR.osakaCity, ['castle', { x: 296 }]] }), v('park', { far: [...FAR.osakaCity, ['castle', { x: 60 }]] }), v('plaza', { store: 'lawson' }), v('downtown')] },
    stages: {
      1: [v('downtown', { far: [['skyline', { y: 88, max: 18, key: 'F0' }], ['harukas', { x: 300, h: 72 }], ['tsutenkaku', { x: 70 }]], tags: ['abeno-harukas', 'tsutenkaku'] }),
        v('station', { far: [['skyline', { y: 88, max: 16, key: 'F0' }], ['harukas', { x: 316, h: 72 }]], tags: ['station'] }),
        v('park', { far: [['skyline', { y: 88, max: 16, key: 'F0' }], ['harukas', { x: 300, h: 72 }], ['tsutenkaku', { x: 120 }]], tags: ['park', 'tsutenkaku'] })],
      2: [v('canal', { tags: ['dotonbori'] }), v('downtown', { octopus: true, tags: ['namba'] }), v('shotengai', { tags: ['shopping-arcade'] })],
      3: [v('downtown', { highway: true, far: [['skyline', { y: 86, max: 24, key: 'F0' }], ['umedaSky', { x: 286 }], ['ferris', { x: 84 }]], tags: ['umeda', 'expressway'] }),
        v('station', { far: [['skyline', { y: 86, max: 24, key: 'F0' }], ['umedaSky', { x: 300 }]], tags: ['station', 'umeda'] }),
        v('river', { far: [['skyline', { y: 86, max: 22, key: 'F0' }], ['umedaSky', { x: 90 }]], tags: ['river', 'yodo-river'] })],
      // boss: Osaka Castle itself
      4: [v('castle', { far: [['skyline', { y: 88, max: 14, key: 'F0' }]], tags: ['osaka-castle'] })],
    },
  },
};
export const SCENE_CITY_IDS = Object.freeze(Object.keys(CITIES));

// Which scenes may show a station-name sign, and what it says.
const SIGN_ARCHETYPES = new Set(['station', 'plaza']);

function describe(cityId, kind, stage, variant, index) {
  const city = CITIES[cityId];
  const training = kind === 'training';
  const location = training ? battleLocation(cityId, 1) : battleLocation(cityId, stage);
  const damage = training ? city.training.damage : city.damage[stage - 1];
  const time = training ? city.training.times[index % city.training.times.length] : city.time[stage - 1];
  const { archetype, far, tags = [], signName, ...options } = variant;
  const id = `${cityId}-${training ? 'training' : `s${stage}`}-${index + 1}-${archetype}`;
  return Object.freeze({
    id, kind, cityId, stage: training ? null : stage, archetype, time, damage,
    boss: !training && stage === 4,
    far: Object.freeze(far ?? FAR[cityId]),
    line: options.line ?? city.line, lineColor: options.lineColor ?? city.lineColor,
    sign: signName ?? (SIGN_ARCHETYPES.has(archetype) ? location?.station.jaName ?? null : null),
    station: location?.station.name ?? null,
    tags: Object.freeze([cityId, archetype, ...tags]),
    ...options,
  });
}

/** Every scene description, by id. */
export const SCENES = Object.freeze(Object.fromEntries(Object.entries(CITIES).flatMap(([cityId, city]) => [
  ...city.training.pool.map((variant, i) => describe(cityId, 'training', null, variant, i)),
  ...Object.entries(city.stages).flatMap(([stage, pool]) => pool.map((variant, i) => describe(cityId, 'battle', Number(stage), variant, i))),
]).map((scene) => [scene.id, scene])));

const all = Object.values(SCENES);
/** The battle scene pool for a city stage (empty for unknown places). */
export function battleScenePool(cityId, stage) { return all.filter((s) => s.kind === 'battle' && s.cityId === cityId && s.stage === stage); }
/** The training scene pool for a city. */
export function trainingScenePool(cityId) { return all.filter((s) => s.kind === 'training' && s.cityId === cityId); }

function choose(pool, random, avoid) {
  if (!pool.length) return null;
  const options = pool.length > 1 && avoid ? pool.filter((s) => s.id !== avoid) : pool;
  return options[Math.floor(random() * options.length) % options.length];
}
/**
 * One battle scene for a city stage. The first scene in each pool is the
 * stage's signature (the station with its name sign, or the landmark the
 * station map points at), shown half the time so the map and the fight agree;
 * the others add variety. `avoid` skips the scene just shown (retries) when
 * there is a choice. Unknown cities fall back to Matsubara.
 */
export function pickBattleScene(cityId, stage, { random = Math.random, avoid = null } = {}) {
  const s = Math.max(1, Math.min(4, Number(stage) || 1));
  const pool = battleScenePool(CITIES[cityId] ? cityId : 'matsubara', s);
  if (pool.length > 1 && pool[0].id !== avoid && random() < 0.5) return pool[0];
  return choose(pool.length > 1 && pool[0].id !== avoid ? pool.slice(1) : pool, random, avoid);
}
/** One training scene for a city. */
export function pickTrainingScene(cityId, { random = Math.random, avoid = null } = {}) {
  return choose(trainingScenePool(CITIES[cityId] ? cityId : 'matsubara'), random, avoid);
}

/* ---------------------------------------------------------------- actors */

// Small background people and effects. Battle scenes show people getting away
// (to the left, away from the Horde) in proportion to the danger; training
// scenes only have calm passers-by, plus a police officer once danger is near.
// At most four people per scene so they stay accents, never a crowd.
function seeded(text) {
  let h = 2166136261;
  for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return () => { h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return h / 4294967296; };
}

/**
 * Actors for a scene from its anchors: [{ kind, variant, x, y, dx, dur, still, flip }]
 * in scene pixels (x = left edge, y = feet row; dx = distance moved per loop).
 */
export function sceneActors(scene, anchors) {
  const rnd = seeded(`${scene.id}-actors`); const out = [];
  const lane = anchors.lane ?? { y: 99, x0: 40, x1: 340 };
  const variant = () => Math.floor(rnd() * 6);
  if (scene.kind === 'training') {
    out.push({ kind: 'walker', variant: variant(), x: lane.x0, y: lane.y, dx: lane.x1 - lane.x0, dur: 38, flip: true });
    if (rnd() < 0.6) out.push({ kind: 'cyclist', variant: variant(), x: lane.x1 - 14, y: lane.y + 1, dx: -(lane.x1 - lane.x0 - 14), dur: 16 });
    if (scene.damage >= 1) out.push({ kind: 'police', variant: 0, x: 54, y: lane.y, still: true });
  } else {
    const d = scene.damage;
    if (d >= 1) out.push({ kind: 'runner', variant: variant(), x: 300, y: lane.y, dx: -150, dur: 9 });
    if (d >= 1) out.push(d >= 3 ? { kind: 'police', variant: 0, x: 60, y: lane.y, still: true } : { kind: 'waver', variant: variant(), x: 58, y: lane.y, still: true });
    if (d >= 2) out.push({ kind: 'family', variant: variant(), x: 250, y: lane.y, dx: -140, dur: 13 });
    if (d >= 2 && anchors.shutters.length) { const s = anchors.shutters[Math.floor(rnd() * anchors.shutters.length)]; out.push({ kind: 'shopkeeper', variant: variant(), x: s.x - 5, y: Math.min(lane.y, 97), still: true }); }
    else if (d >= 3) out.push({ kind: 'runner', variant: variant(), x: 340, y: lane.y + 1, dx: -170, dur: 11 });
    anchors.fires.slice(0, d >= 3 ? 3 : 1).forEach((f) => out.push({ kind: 'flame', variant: 0, x: f.x - 3, y: f.y, still: true }));
    anchors.smoke.slice(0, 2).forEach((s) => out.push({ kind: 'smoke', variant: 0, x: s.x - 5, y: s.y, still: true }));
  }
  if (anchors.crossing) out.push({ kind: 'blink', variant: 0, x: anchors.crossing.x, y: anchors.crossing.y + 3, still: true });
  return out;
}
