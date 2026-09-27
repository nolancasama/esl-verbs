import { BALANCE } from './battle-data.js';

export function createCampaign(heroId) {
  return { heroId, stage: 1, stageResults: [], active: true };
}

export function battlePowerFor(correctCount) {
  return BALANCE.basePower + correctCount;
}

export function retryPower(stageResult) {
  return stageResult.battlePower + BALANCE.retryBonusPower;
}

export function recordStage(campaign, round, encounterId) {
  const result = {
    mode: round.mode,
    correct: round.correctCount,
    total: round.items.length,
    bestStreak: round.bestStreak,
    missedIds: [...round.missedIds],
    battlePower: battlePowerFor(round.correctCount),
    encounterId,
  };
  return { ...campaign, stage: campaign.stage + 1, stageResults: [...campaign.stageResults, result] };
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
  return { totalCorrect, totalQuestions, bestStreak, missedIds: [...missedIds] };
}
