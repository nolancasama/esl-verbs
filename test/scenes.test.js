import test from 'node:test';
import assert from 'node:assert/strict';
import { BATTLE_LOCATIONS } from '../src/battle-locations.js';
import { CITY_CAMPAIGNS } from '../src/region.js';
import { ACTOR_KINDS, ARCHETYPE_IDS, GROUND_TILE_H, GROUND_TYPES, SCENE_H, SCENE_W, actorSheet, buildScene, sceneGroundImage, sceneImage } from '../src/pixel-scenes.js';
import { SCENES, battleScenePool, pickBattleScene, pickTrainingScene, sceneActors, trainingScenePool } from '../src/scenes.js';

const scenes = Object.values(SCENES);
const PEOPLE = new Set(['runner', 'family', 'cyclist', 'walker', 'waver', 'police', 'shopkeeper']);
const usedKeys = (g) => new Set(g.d.filter(Boolean));

test('every city stage with a station map has a battle scene pool of 1-4, and every city a training pool', () => {
  for (const cityId of Object.keys(CITY_CAMPAIGNS)) {
    assert.ok(trainingScenePool(cityId).length >= 3, `${cityId} training pool`);
    for (const location of BATTLE_LOCATIONS[cityId] ?? []) {
      const pool = battleScenePool(cityId, location.stage);
      assert.ok(pool.length >= 1 && pool.length <= 4, `${cityId} stage ${location.stage}`);
      assert.ok(pool.every((s) => s.cityId === cityId && s.kind === 'battle'));
    }
  }
});

test('station scenes carry the name of the station on the map before the battle', () => {
  for (const scene of scenes.filter((s) => s.kind === 'battle' && s.archetype === 'station')) {
    const location = BATTLE_LOCATIONS[scene.cityId].find((l) => l.stage === scene.stage);
    assert.equal(scene.sign, location.station.jaName, scene.id);
    assert.ok(sceneImage(scene).anchors.sign, `${scene.id} has a sign board`);
  }
});

test('the stage signature scene is chosen about half the time; retries avoid the scene just shown', () => {
  let n = 0; const seq = (() => { let i = 0; return () => ((i += 0.618) % 1); })();
  for (let i = 0; i < 400; i += 1) if (pickBattleScene('matsubara', 1, { random: seq }).id === battleScenePool('matsubara', 1)[0].id) n += 1;
  assert.ok(n > 150 && n < 260, `signature picked ${n}/400`);
  for (const [cityId, stage] of [['matsubara', 1], ['sakai', 3], ['osakaCity', 2]]) {
    for (const previous of battleScenePool(cityId, stage)) {
      for (let i = 0; i < 20; i += 1) assert.notEqual(pickBattleScene(cityId, stage, { avoid: previous.id, random: Math.random }).id, previous.id);
    }
  }
  assert.equal(pickBattleScene('nowhere', 9).cityId, 'matsubara');
  assert.equal(pickTrainingScene('yao').kind, 'training');
});

test('danger escalates: damage never falls within a city, bosses are the worst, early Matsubara stays mild', () => {
  for (const cityId of Object.keys(CITY_CAMPAIGNS)) {
    const byStage = [1, 2, 3, 4].map((stage) => battleScenePool(cityId, stage)[0]?.damage ?? 0);
    byStage.forEach((d, i) => { if (i) assert.ok(d >= byStage[i - 1], `${cityId} ${byStage}`); });
    for (const scene of trainingScenePool(cityId)) assert.ok(scene.damage <= Math.min(...byStage), `${scene.id} training is calmer than battle`);
  }
  assert.ok(scenes.filter((s) => s.cityId === 'matsubara').every((s) => s.damage <= 2));
  assert.ok(scenes.filter((s) => s.cityId === 'osakaCity' && s.boss).every((s) => s.damage === 3));
});

test('every scene draws deterministically with every palette key defined', () => {
  assert.deepEqual([...new Set(scenes.map((s) => s.archetype))].sort(), ARCHETYPE_IDS.filter((a) => scenes.some((s) => s.archetype === a)).sort());
  for (const scene of scenes) {
    const built = sceneImage(scene);
    assert.equal(built.image.w, SCENE_W); assert.equal(built.image.h, SCENE_H);
    assert.ok(built.grid.d.every(Boolean), `${scene.id} has no transparent pixels`);
    for (const key of usedKeys(built.grid)) assert.ok(built.image.palette[key], `${scene.id} uses undefined key ${key}`);
    assert.deepEqual(buildScene(scene).grid.d, built.grid.d, `${scene.id} is deterministic`);
    assert.ok(built.anchors.lane, `${scene.id} has an actor lane`);
  }
  for (const type of GROUND_TYPES) assert.equal(sceneGroundImage(type, 'day').h, GROUND_TILE_H);
  for (const kind of ACTOR_KINDS) { const s = actorSheet(kind, 3, 'night'); assert.equal(s.grids[0].length, s.frames); }
});

test('background people stay accents: at most four, nobody flees in training, more danger brings more movement', () => {
  for (const scene of scenes) {
    const actors = sceneActors(scene, sceneImage(scene).anchors);
    const people = actors.filter((a) => PEOPLE.has(a.kind));
    assert.ok(people.length <= 4, `${scene.id}: ${people.length} people`);
    assert.ok(actors.length <= 9, `${scene.id}: ${actors.length} actors`);
    if (scene.kind === 'training') assert.ok(!actors.some((a) => ['runner', 'family', 'flame'].includes(a.kind)), `${scene.id} is calm`);
    for (const a of actors) {
      assert.ok(ACTOR_KINDS.includes(a.kind));
      if (!a.still) { assert.ok(a.x >= 20 && a.x + a.dx >= 20 && a.x + a.dx <= 364, `${scene.id} ${a.kind} stays inside the 1024x600 crop`); assert.ok(a.dur >= 8); }
    }
  }
  const calm = sceneActors(SCENES['matsubara-s1-1-station'], sceneImage(SCENES['matsubara-s1-1-station']).anchors).filter((a) => a.kind === 'runner' || a.kind === 'family').length;
  const finale = sceneActors(SCENES['osakaCity-s3-1-downtown'], sceneImage(SCENES['osakaCity-s3-1-downtown']).anchors).filter((a) => a.kind === 'runner' || a.kind === 'family').length;
  assert.ok(finale > calm);
});

test('recognisable stores appear only in a few station-front / commercial scenes', () => {
  const withStore = scenes.filter((s) => s.store);
  assert.ok(withStore.length >= 3 && withStore.length <= scenes.length / 4, `${withStore.length} store scenes`);
  assert.ok(withStore.every((s) => ['station', 'plaza'].includes(s.archetype)));
  assert.ok(withStore.some((s) => s.store === 'familymart') && withStore.some((s) => s.store === 'lawson'));
});
