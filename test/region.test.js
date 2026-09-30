import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN, HEROES } from '../src/battle-data.js';
import { chapterRest, createCampaign, resumeCampaign } from '../src/campaign.js';
import {
  CITIES, REGION_KEY, cityStatus, markCitySaved, parseRegion, serializeRegion,
  stageCheckpoint, stageCount, stageEncounterId, stageMode,
} from '../src/region.js';

const HERO_IDS = Object.keys(HEROES);
const fresh = () => ({ heroId: null, level: 1, xp: 0, savedCities: [], checkpoint: null });
const stageResult = (mode = 1) => ({ mode, correct: 8, total: 10, bestStreak: 5, missedIds: ['jump'], startingAp: 8, perfect: false, encounterId: `sakai-${mode}` });

test('fresh regional state uses the versioned key and valid defaults', () => {
  assert.equal(REGION_KEY, 'esl-verbs-region-v1');
  assert.deepEqual(parseRegion(null, HERO_IDS), fresh());
});

test('Sakai is locked before Matsubara is saved', () => {
  assert.equal(cityStatus(fresh(), 'matsubara'), 'danger');
  assert.equal(cityStatus(fresh(), 'sakai'), 'locked');
});

test('saving Matsubara puts Sakai in danger', () => {
  const campaign = createCampaign('fighter');
  const region = markCitySaved(fresh(), 'matsubara', { ...campaign, level: 5, xp: 100 });
  assert.equal(cityStatus(region, 'matsubara'), 'saved');
  assert.equal(cityStatus(region, 'sakai'), 'danger');
});

test('Sakai is saved after markCitySaved', () => {
  const region = markCitySaved({ ...fresh(), savedCities: ['matsubara'] }, 'sakai', createCampaign('mage', { cityId: 'sakai', level: 5, xp: 120 }));
  assert.equal(cityStatus(region, 'sakai'), 'saved');
  assert.equal(region.checkpoint, null);
});

test('a checkpoint alone never marks a city saved', () => {
  const campaign = { ...createCampaign('fighter', { cityId: 'sakai' }), stage: 2 };
  const region = stageCheckpoint({ ...fresh(), heroId: 'fighter', savedCities: ['matsubara'] }, campaign);
  assert.equal(cityStatus(region, 'sakai'), 'danger');
  assert.deepEqual(region.savedCities, ['matsubara']);
});

test('future cities with no campaign are always locked', () => {
  const region = { ...fresh(), savedCities: Object.keys(CITIES) };
  for (const id of ['yao', 'higashiosaka', 'osakaCity']) assert.equal(cityStatus(region, id), 'locked', id);
});

test('saved cities are de-duplicated and restored in CITIES order', () => {
  const raw = JSON.stringify({ ...fresh(), savedCities: ['sakai', 'unknown', 'matsubara', 'sakai'] });
  assert.deepEqual(parseRegion(raw, HERO_IDS).savedCities, ['matsubara', 'sakai']);
});

test('corrupt JSON and invalid stored values recover to valid values', () => {
  assert.deepEqual(parseRegion('{oops', HERO_IDS), fresh());
  const invalid = JSON.stringify({ heroId: 'alien', level: Number.NaN, xp: 'many', savedCities: 'sakai', checkpoint: { cityId: 'sakai', stage: '2', heroHp: 8, potions: 1, stageResults: [] } });
  assert.deepEqual(parseRegion(invalid, HERO_IDS), fresh());
  const unknownCity = JSON.stringify({ heroId: 'fighter', level: 3, xp: 20, savedCities: ['unknown'], checkpoint: { cityId: 'unknown', stage: 2, heroHp: 8, potions: 1, stageResults: [stageResult()] } });
  assert.deepEqual(parseRegion(unknownCity, HERO_IDS), { ...fresh(), heroId: 'fighter', level: 3, xp: 20 });
  const malformedCheckpoint = JSON.stringify({ ...fresh(), heroId: 'mage', checkpoint: { cityId: 'sakai', stage: 2, heroHp: 'low', potions: 1, stageResults: [stageResult()] } });
  assert.equal(parseRegion(malformedCheckpoint, HERO_IDS).checkpoint, null);
});

test('serialize and parse round-trip the regional save shape', () => {
  const campaign = { ...createCampaign('ninja', { cityId: 'sakai', level: 5, xp: 140 }), stage: 2, heroHp: 17, potions: 1, stageResults: [stageResult()] };
  const region = stageCheckpoint({ ...fresh(), heroId: 'ninja', level: 5, xp: 140, savedCities: ['matsubara'] }, campaign);
  assert.deepEqual(parseRegion(serializeRegion(region), HERO_IDS), region);
});

test('stageCheckpoint is a no-op for the origin campaign', () => {
  const region = { ...fresh(), heroId: 'fighter' };
  assert.equal(stageCheckpoint(region, createCampaign('fighter')), region);
});

test('resumeCampaign restores stage, HP, potions, and stage results', () => {
  const results = [stageResult()];
  const region = { heroId: 'mage', level: 4, xp: 77, savedCities: ['matsubara'], checkpoint: { cityId: 'sakai', stage: 2, heroHp: 13, potions: 1, stageResults: results } };
  const campaign = resumeCampaign(region);
  assert.deepEqual({ cityId: campaign.cityId, stage: campaign.stage, heroHp: campaign.heroHp, potions: campaign.potions, stageResults: campaign.stageResults }, { cityId: 'sakai', stage: 2, heroHp: 13, potions: 1, stageResults: results });
  assert.equal(campaign.level, 4);
  assert.equal(campaign.xp, 77);
});

test('chapterRest restores full HP and maximum potions for the next city', () => {
  const campaign = { ...createCampaign('fighter', { cityId: 'sakai', level: 5, xp: 100 }), heroHp: 2, potions: 0, retries: 2 };
  const rested = chapterRest(campaign);
  assert.ok(rested.heroHp > campaign.heroHp);
  assert.equal(rested.potions, CAMPAIGN.maxPotions);
  assert.equal(rested.retries, 0);
});

test('stage helpers expose modes 1 through 4 and fixed Sakai encounter ids', () => {
  assert.equal(stageCount('sakai'), 4);
  assert.deepEqual([1, 2, 3, 4].map((stage) => stageMode({ cityId: 'sakai', stage })), [1, 2, 3, 4]);
  assert.deepEqual([1, 2, 3, 4].map((stage) => stageEncounterId({ cityId: 'sakai', stage }, () => 0)), ['sakai-1', 'sakai-2', 'sakai-3', 'sakai-4']);
});
