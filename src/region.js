// Pure regional campaign data and persistence helpers. Storage reads/writes
// stay in the application layer; this module only validates plain data.
import { CAMPAIGN, LEVELS } from './battle-data.js';
import { chooseEncounter } from './battle-engine.js';

export const REGION_KEY = 'esl-verbs-region-v1';

export const CITIES = Object.freeze({
  matsubara: { id: 'matsubara', name: 'Matsubara', jaName: 'まつばら', map: { x: 52, y: 60 }, campaignId: 'matsubara', unlocks: ['sakai'] },
  sakai: { id: 'sakai', name: 'Sakai', jaName: 'さかい', map: { x: 34, y: 64 }, campaignId: 'sakai', requires: ['matsubara'] },
  yao: { id: 'yao', name: 'Yao', jaName: 'やお', map: { x: 62, y: 48 }, campaignId: null, requires: ['sakai'] },
  higashiosaka: { id: 'higashiosaka', name: 'Higashiosaka', jaName: 'ひがしおおさか', map: { x: 58, y: 34 }, campaignId: null, requires: ['sakai'] },
  osakaCity: { id: 'osakaCity', name: 'Osaka City', jaName: 'おおさか市', map: { x: 40, y: 30 }, campaignId: null, requires: ['sakai'] },
});

export const CITY_CAMPAIGNS = Object.freeze({
  matsubara: {
    id: 'matsubara', cityId: 'matsubara', origin: true,
    stages: [{ mode: 1, tier: 1 }, { mode: 2, tier: 2 }, { mode: 3, tier: 3 }, { mode: 4, tier: 4 }],
  },
  sakai: {
    id: 'sakai', cityId: 'sakai',
    stages: [
      { mode: 1, encounterId: 'sakai-1' }, { mode: 2, encounterId: 'sakai-2' },
      { mode: 3, encounterId: 'sakai-3' }, { mode: 4, encounterId: 'sakai-4' },
    ],
  },
});

const freshRegion = () => ({ heroId: null, level: 1, xp: 0, savedCities: [], checkpoint: null });
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

export function cityStatus(region, cityId) {
  const city = CITIES[cityId];
  if (!city) return 'locked';
  if (city.campaignId === null) return 'locked';
  if (region.savedCities.includes(cityId)) return 'saved';
  return (city.requires ?? []).every((id) => region.savedCities.includes(id)) ? 'danger' : 'locked';
}

function validCheckpoint(value, heroId) {
  if (!heroId || !isObject(value)) return null;
  const cityCampaign = CITY_CAMPAIGNS[value.cityId];
  if (!cityCampaign || cityCampaign.origin) return null;
  if (!Number.isInteger(value.stage) || value.stage < 1 || value.stage > cityCampaign.stages.length) return null;
  if (!Number.isFinite(value.heroHp) || value.heroHp < 0) return null;
  if (!Number.isInteger(value.potions) || value.potions < 0 || value.potions > CAMPAIGN.maxPotions) return null;
  if (!Array.isArray(value.stageResults) || value.stageResults.length !== value.stage - 1 || !value.stageResults.every(isObject)) return null;
  return {
    cityId: value.cityId,
    stage: value.stage,
    heroHp: value.heroHp,
    potions: value.potions,
    stageResults: value.stageResults.map((result) => ({ ...result, missedIds: Array.isArray(result.missedIds) ? [...result.missedIds] : result.missedIds })),
  };
}

export function parseRegion(raw, heroIds) {
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { return freshRegion(); }
  if (!isObject(data)) return freshRegion();

  const heroId = heroIds.includes(data.heroId) ? data.heroId : null;
  const level = Number.isFinite(data.level) ? Math.max(1, Math.min(LEVELS.length, Math.floor(data.level))) : 1;
  const xp = Number.isFinite(data.xp) ? Math.max(0, Math.floor(data.xp)) : 0;
  const storedCities = Array.isArray(data.savedCities) ? data.savedCities : [];
  const savedCities = Object.keys(CITIES).filter((id) => storedCities.includes(id));
  return { heroId, level, xp, savedCities, checkpoint: validCheckpoint(data.checkpoint, heroId) };
}

export function markCitySaved(region, cityId, campaign) {
  const saved = new Set(region.savedCities);
  if (CITIES[cityId]) saved.add(cityId);
  return {
    heroId: campaign.heroId,
    level: campaign.level,
    xp: campaign.xp,
    savedCities: Object.keys(CITIES).filter((id) => saved.has(id)),
    checkpoint: null,
  };
}

export function stageCheckpoint(region, campaign) {
  if (CITY_CAMPAIGNS[campaign.cityId]?.origin) return region;
  return {
    ...region,
    checkpoint: {
      cityId: campaign.cityId,
      stage: campaign.stage,
      heroHp: campaign.heroHp,
      potions: campaign.potions,
      stageResults: campaign.stageResults.map((result) => ({ ...result, missedIds: Array.isArray(result.missedIds) ? [...result.missedIds] : result.missedIds })),
    },
  };
}

export function serializeRegion(region) {
  return JSON.stringify({
    heroId: region.heroId,
    level: region.level,
    xp: region.xp,
    savedCities: [...region.savedCities],
    checkpoint: region.checkpoint ? {
      cityId: region.checkpoint.cityId,
      stage: region.checkpoint.stage,
      heroHp: region.checkpoint.heroHp,
      potions: region.checkpoint.potions,
      stageResults: region.checkpoint.stageResults.map((result) => ({ ...result })),
    } : null,
  });
}

export function stageCount(cityId) {
  return CITY_CAMPAIGNS[cityId]?.stages.length ?? 0;
}

export function stageMode(campaign) {
  return CITY_CAMPAIGNS[campaign.cityId]?.stages[campaign.stage - 1]?.mode;
}

export function stageEncounterId(campaign, rng = Math.random) {
  const cityCampaign = CITY_CAMPAIGNS[campaign.cityId];
  const stage = cityCampaign?.stages[campaign.stage - 1];
  if (!stage) return undefined;
  return cityCampaign.origin ? chooseEncounter(stage.tier, rng).id : stage.encounterId;
}
