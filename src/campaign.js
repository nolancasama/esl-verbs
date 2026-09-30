// Adventure campaign state between battles: stage results, carried HP, XP,
// level and potions. Pure functions; the UI only stores the returned object.
import { BALANCE, CAMPAIGN, HEROES, LEVELS, SKILLS } from './battle-data.js';
import { battleXp, heroMaxHp, levelData, levelForXp } from './battle-engine.js';

export function createCampaign(heroId, { cityId = 'matsubara', level = 1, xp = 0 } = {}) {
  return {
    heroId, cityId, stage: 1, stageResults: [], active: true,
    heroHp: heroMaxHp(heroId, level), level, xp, potions: CAMPAIGN.startingPotions, retries: 0,
  };
}

/** Start a new city chapter with restored resources and the same hero progression. */
export function chapterRest(campaign) {
  return {
    ...campaign,
    heroHp: campaignMaxHp(campaign),
    potions: CAMPAIGN.maxPotions,
    retries: 0,
  };
}

/** Rebuild a campaign from a validated regional checkpoint. */
export function resumeCampaign(region) {
  const checkpoint = region.checkpoint;
  if (!checkpoint) return null;
  return {
    ...createCampaign(region.heroId, { cityId: checkpoint.cityId, level: region.level, xp: region.xp }),
    stage: checkpoint.stage,
    heroHp: checkpoint.heroHp,
    potions: checkpoint.potions,
    stageResults: checkpoint.stageResults.map((result) => ({ ...result })),
  };
}

export function campaignMaxHp(campaign) {
  return heroMaxHp(campaign.heroId, campaign.level);
}

/** The quiz score is the starting AP: 7/10 correct = 7 AP. */
export function startingApFor(correctCount) {
  return Math.max(0, Math.min(BALANCE.maxAp, correctCount));
}

export function recordStage(campaign, round, encounterId) {
  const total = round.items.length;
  const result = {
    mode: round.mode,
    correct: round.correctCount,
    total,
    bestStreak: round.bestStreak,
    missedIds: [...round.missedIds],
    startingAp: startingApFor(round.correctCount),
    perfect: total > 0 && round.correctCount === total,
    encounterId,
  };
  return { ...campaign, stage: campaign.stage + 1, retries: 0, stageResults: [...campaign.stageResults, result] };
}

/** Extra starting AP after `retries` consecutive defeats: +1, +3, +6, +10 (grows gently, then fast). */
export function retryAssist(retries) {
  return BALANCE.retryApBonus * ((retries * (retries + 1)) / 2);
}

/** AP for the current battle attempt: quiz AP plus the retry assist. */
export function battleAp(campaign, stageResult = campaign.stageResults.at(-1)) {
  return Math.min(BALANCE.maxAp, (stageResult?.startingAp ?? 0) + retryAssist(campaign.retries));
}

/**
 * Everything createBattle needs from the campaign. HP and potions only change
 * on victory, so a retry always restarts from the state the battle began with.
 */
export function battleSetup(campaign, stageResult = campaign.stageResults.at(-1)) {
  return {
    heroId: campaign.heroId,
    encounterId: stageResult?.encounterId,
    level: campaign.level,
    heroHp: campaign.heroHp,
    potions: campaign.potions,
    ap: battleAp(campaign, stageResult),
  };
}

/** A lost battle: the retry gets +retryApBonus AP per consecutive defeat. */
export function recordDefeat(campaign) {
  return { ...campaign, retries: campaign.retries + 1 };
}

/** What reaching `level` gives: max HP, newly unlocked skills, the class passive. */
export function levelUpReward(heroId, level) {
  const row = levelData(level);
  const previous = levelData(level - 1);
  return {
    level,
    maxHpGain: row.maxHpBonus - previous.maxHpBonus,
    skills: HEROES[heroId].skills.filter((id) => SKILLS[id].tier > previous.skillTier && SKILLS[id].tier <= row.skillTier),
    passive: HEROES[heroId].passive?.level === level ? HEROES[heroId].passive : null,
    mastery: level === LEVELS.length,
  };
}

/** XP bar position within the current level; ratio is 1 at the top level. */
export function xpProgress(xp) {
  const level = levelForXp(xp);
  const row = levelData(level);
  const next = LEVELS[level];
  if (!next) return { level, current: xp - row.xp, needed: 0, ratio: 1, max: true };
  const needed = next.xp - row.xp;
  return { level, current: xp - row.xp, needed, ratio: Math.max(0, Math.min(1, (xp - row.xp) / needed)), max: false };
}

/**
 * A won battle: XP from defeated enemies (+ a small perfect-quiz bonus), level
 * ups, then HP carries forward with a partial heal and a safety floor, and one
 * potion is restocked. Returns the new campaign plus a rewards summary for the
 * victory screen.
 */
export function applyVictory(campaign, battleState) {
  const stageResult = campaign.stageResults.at(-1);
  const enemyXp = battleXp(battleState);
  const perfectXp = stageResult?.perfect ? CAMPAIGN.perfectQuizXp : 0;
  const xpBefore = campaign.xp;
  const xp = xpBefore + enemyXp + perfectXp;
  const levelBefore = campaign.level;
  const level = Math.max(levelBefore, levelForXp(xp));
  const levelUps = [];
  for (let next = levelBefore + 1; next <= level; next += 1) levelUps.push(levelUpReward(campaign.heroId, next));

  const maxHpBefore = heroMaxHp(campaign.heroId, levelBefore);
  const maxHp = heroMaxHp(campaign.heroId, level);
  const hpBefore = Math.max(0, Math.min(battleState.hero.hp, maxHpBefore));
  let hp = hpBefore + (maxHp - maxHpBefore); // new max HP arrives filled
  hp += Math.round(maxHp * CAMPAIGN.victoryHealPercent);
  hp = Math.max(hp, Math.ceil(maxHp * CAMPAIGN.minimumNextBattleHpPercent));
  hp = Math.min(hp, maxHp);

  const potionsBefore = battleState.potions ?? campaign.potions;
  const potions = Math.min(CAMPAIGN.maxPotions, potionsBefore + CAMPAIGN.potionsPerVictory);
  return {
    campaign: { ...campaign, xp, level, heroHp: hp, potions, retries: 0 },
    rewards: {
      enemyXp, perfectXp, xpGained: enemyXp + perfectXp, xpBefore, xp, levelBefore, level, levelUps,
      hpBefore, hp, healed: hp - hpBefore, maxHpBefore, maxHp, potionsBefore, potions,
    },
  };
}

export function campaignSummary(campaign) {
  const missedIds = new Set();
  let totalCorrect = 0;
  let totalQuestions = 0;
  let bestStreak = 0;
  for (const result of campaign.stageResults) {
    totalCorrect += result.correct;
    totalQuestions += result.total;
    bestStreak = Math.max(bestStreak, result.bestStreak);
    for (const id of result.missedIds) missedIds.add(id);
  }
  return { totalCorrect, totalQuestions, bestStreak, missedIds: [...missedIds], level: campaign.level };
}
