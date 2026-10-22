import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN, ENCOUNTERS, HEROES } from '../src/battle-data.js';
import { chapterRest, createCampaign, resumeCampaign } from '../src/campaign.js';
import { cityPlayable } from '../src/osaka-map.js';
import { CITY_STORIES } from '../src/story.js';
import {
  CITIES, CITY_CAMPAIGNS, REGION_KEY, cityStatus, markCitySaved, parseRegion, serializeRegion,
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

test('all five saved cities remain saved and playable', () => {
  const region = { ...fresh(), savedCities: Object.keys(CITIES) };
  assert.equal(cityStatus(region, 'osakaCity'), 'saved');
  assert.ok(cityPlayable(region, 'osakaCity'));
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

test('every city stage points at a real encounter; city encounters never appear in the Matsubara tiers', () => {
  for (const campaign of Object.values(CITY_CAMPAIGNS)) {
    campaign.stages.forEach((stage, index) => {
      const id = stageEncounterId({ cityId: campaign.cityId, stage: index + 1 }, () => 0);
      assert.ok(ENCOUNTERS[id], `${campaign.id} stage ${index + 1} -> ${id}`);
      if (!campaign.origin) assert.equal(ENCOUNTERS[id].city, campaign.cityId);
      else assert.equal(ENCOUNTERS[id].city, undefined);
    });
  }
});

test('old Matsubara and Sakai saves unlock playable Yao without changing the save shape', () => {
  const beforeSakai = { ...fresh(), heroId: 'fighter', savedCities: ['matsubara'] };
  assert.equal(cityStatus(beforeSakai, 'yao'), 'locked');
  assert.equal(cityPlayable(beforeSakai, 'yao'), false);
  const oldSave = JSON.stringify({ heroId: 'fighter', level: 5, xp: 400, savedCities: ['matsubara', 'sakai'] });
  const region = parseRegion(oldSave, HERO_IDS);
  assert.deepEqual(region, { ...fresh(), heroId: 'fighter', level: 5, xp: 400, savedCities: ['matsubara', 'sakai'] });
  assert.equal(cityStatus(region, 'yao'), 'danger');
  assert.equal(cityPlayable(region, 'yao'), true);
  assert.deepEqual(CITIES.sakai.unlocks, ['yao']);
  assert.deepEqual(CITIES.higashiosaka.requires, ['yao']);
  assert.deepEqual(CITIES.osakaCity.requires, ['higashiosaka']);
});

test('Yao checkpoints round-trip and resume with the correct stage and progression', () => {
  const campaign = {
    ...createCampaign('mage', { cityId: 'yao', level: 5, xp: 450 }),
    stage: 3, heroHp: 19, potions: 1,
    stageResults: [1, 2].map((mode) => ({ ...stageResult(mode), encounterId: `yao-${mode}` })),
  };
  const checkpoint = stageCheckpoint({ ...fresh(), savedCities: ['matsubara', 'sakai'] }, campaign);
  const region = parseRegion(serializeRegion(checkpoint), HERO_IDS);
  assert.deepEqual(region, checkpoint);
  assert.deepEqual(resumeCampaign(region), campaign);
  assert.equal(cityStatus(region, 'yao'), 'danger');
  const saved = markCitySaved(region, 'yao', campaign);
  assert.equal(saved.checkpoint, null);
  assert.equal(cityStatus(saved, 'yao'), 'saved');
  assert.equal(cityPlayable(saved, 'yao'), true, 'saved Yao can be replayed');
  assert.equal(cityStatus(saved, 'higashiosaka'), 'danger');
  assert.equal(cityStatus(saved, 'osakaCity'), 'locked');
});

test('Yao has four mode-matched battles and no Osaka Defender ally', () => {
  assert.equal(stageCount('yao'), 4);
  for (let stage = 1; stage <= 4; stage += 1) {
    assert.equal(stageMode({ cityId: 'yao', stage }), stage);
    const id = stageEncounterId({ cityId: 'yao', stage });
    assert.equal(id, `yao-${stage}`);
    assert.equal(ENCOUNTERS[id].ally, null);
  }
});

test('old Yao saves unlock Higashiosaka while Osaka City stays locked', () => {
  const beforeYao = { ...fresh(), heroId: 'ninja', savedCities: ['matsubara', 'sakai'] };
  assert.equal(cityStatus(beforeYao, 'higashiosaka'), 'locked');
  assert.equal(cityPlayable(beforeYao, 'higashiosaka'), false);
  const region = parseRegion(JSON.stringify({ ...beforeYao, level: 5, xp: 700, savedCities: [...beforeYao.savedCities, 'yao'] }), HERO_IDS);
  assert.equal(region.checkpoint, null);
  assert.equal(cityStatus(region, 'higashiosaka'), 'danger');
  assert.equal(cityPlayable(region, 'higashiosaka'), true);
  assert.deepEqual(CITIES.yao.unlocks, ['higashiosaka']);
  assert.equal(CITIES.higashiosaka.campaignId, 'higashiosaka');
  assert.equal(cityStatus(region, 'osakaCity'), 'locked');
});

test('Higashiosaka checkpoints resume every stage and victory saves the city', () => {
  for (let stage = 1; stage <= 4; stage += 1) {
    const campaign = {
      ...createCampaign('mage', { cityId: 'higashiosaka', level: 5, xp: 700 }),
      stage, heroHp: 19, potions: 1,
      stageResults: Array.from({ length: stage - 1 }, (_, index) => ({ ...stageResult(index + 1), encounterId: `hig-${index + 1}` })),
    };
    const checkpoint = stageCheckpoint({ ...fresh(), savedCities: ['matsubara', 'sakai', 'yao'] }, campaign);
    const region = parseRegion(serializeRegion(checkpoint), HERO_IDS);
    assert.deepEqual(region, checkpoint);
    assert.deepEqual(resumeCampaign(region), campaign);
    assert.equal(cityStatus(region, 'higashiosaka'), 'danger');
    const saved = markCitySaved(region, 'higashiosaka', campaign);
    assert.equal(saved.checkpoint, null);
    assert.equal(cityStatus(saved, 'higashiosaka'), 'saved');
    assert.equal(cityPlayable(saved, 'higashiosaka'), true, 'saved Higashiosaka can be replayed');
    assert.equal(cityStatus(saved, 'osakaCity'), 'danger');
  }
});

test('Higashiosaka has four mode-matched Core battles without an ally', () => {
  assert.equal(stageCount('higashiosaka'), 4);
  for (let stage = 1; stage <= 4; stage += 1) {
    const campaign = { cityId: 'higashiosaka', stage };
    assert.equal(stageMode(campaign), stage);
    const id = stageEncounterId(campaign);
    assert.equal(id, `hig-${stage}`);
    assert.equal(ENCOUNTERS[id].ally, null);
    assert.ok(ENCOUNTERS[id].core.hp > 0);
  }
});

test('Higashiosaka story uses the specified danger, protection and Osaka City beats', () => {
  const { intro, ending } = CITY_STORIES.higashiosaka;
  assert.deepEqual(intro[0].card.lines, ['ひがしおおさかが あぶない！']);
  assert.equal(intro[0].card.en, 'HIGASHIOSAKA IS IN DANGER!');
  assert.deepEqual([intro[0].mood, intro[0].music, intro[0].sfx], ['danger', 'ominous', 'alarm']);
  assert.deepEqual(intro[1].card.lines, ['ものづくりの まちに きかいの てきが きた！']);
  assert.equal(intro[2].hero, 'idle');
  assert.deepEqual(intro[2].card.lines, ['アクション・コアが ねらわれている！ まもりぬけ！']);
  assert.deepEqual(ending[1].title, { ja: 'ひがしおおさかを まもった！', en: 'HIGASHIOSAKA IS SAFE!' });
  assert.deepEqual(ending[2].card.lines, ['コアの ひかりが まちを てらす。']);
  assert.deepEqual(ending[3].card.lines, ['さいごは おおさか市だ！']);
  assert.equal(ending[3].card.en, 'ON TO OSAKA CITY!');
});
