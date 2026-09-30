import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE, CAMPAIGN, ENCOUNTERS, ENEMIES, HEROES, LEVELS } from '../src/battle-data.js';
import { createBattle, heroMaxHp, levelForXp } from '../src/battle-engine.js';
import {
  applyVictory, battleAp, battleSetup, campaignSummary, chapterRest, createCampaign, levelUpReward, recordDefeat, recordStage, retryAssist,
  startingApFor, xpProgress,
} from '../src/campaign.js';

const round = (correctCount, mode = 1, total = 10) => ({
  mode, items: Array.from({ length: total }, (_, index) => ({ id: `q${index}` })), correctCount, bestStreak: correctCount, missedIds: new Set(correctCount < total ? ['q0'] : []),
});
// A finished battle as the engine would leave it: every enemy of the encounter defeated.
const wonBattle = (campaign, hp, potions = campaign.potions) => {
  const state = createBattle({ ...battleSetup(campaign), ap: 0 });
  return { ...state, turn: 'won', potions, hero: { ...state.hero, hp }, enemies: state.enemies.map((enemy) => ({ ...enemy, hp: 0 })) };
};
const encounterXp = (id) => ENCOUNTERS[id].enemyIds.reduce((sum, enemyId) => sum + ENEMIES[enemyId].xp, 0);

test('quiz score is exactly the starting AP', () => {
  assert.deepEqual([0, 1, 5, 6, 7, 8, 10].map(startingApFor), [0, 1, 5, 6, 7, 8, 10]);
  assert.equal(startingApFor(14), BALANCE.maxAp);
  let campaign = recordStage(createCampaign('fighter'), round(7), 'slime');
  assert.equal(campaign.stageResults[0].startingAp, 7);
  assert.equal(battleSetup(campaign).ap, 7);
  campaign = recordStage(createCampaign('fighter'), round(0), 'slime');
  assert.equal(battleSetup(campaign).ap, 0);
});

test('a new campaign starts at level 1, full HP, two potions', () => {
  const campaign = createCampaign('mage');
  assert.equal(campaign.cityId, 'matsubara');
  assert.deepEqual(
    { stage: campaign.stage, level: campaign.level, xp: campaign.xp, heroHp: campaign.heroHp, potions: campaign.potions, retries: campaign.retries, active: campaign.active },
    { stage: 1, level: 1, xp: 0, heroHp: HEROES.mage.maxHp, potions: CAMPAIGN.startingPotions, retries: 0, active: true },
  );
});

test('a city campaign starts at full HP for its carried level and XP', () => {
  const campaign = createCampaign('fighter', { cityId: 'sakai', level: 5, xp: 123 });
  assert.equal(campaign.cityId, 'sakai');
  assert.equal(campaign.level, 5);
  assert.equal(campaign.xp, 123);
  assert.equal(campaign.heroHp, heroMaxHp('fighter', 5));
  assert.equal(campaign.potions, CAMPAIGN.startingPotions);
});

test('chapter rest restores full HP, maximum potions, and clears retries', () => {
  const rested = chapterRest({ ...createCampaign('ninja', { cityId: 'sakai', level: 4, xp: 70 }), heroHp: 1, potions: 0, retries: 3 });
  assert.equal(rested.heroHp, heroMaxHp('ninja', 4));
  assert.equal(rested.potions, CAMPAIGN.maxPotions);
  assert.equal(rested.retries, 0);
});

test('HP carries over with a partial victory heal, a safety floor, and the max HP cap', () => {
  // Level 2 with 8 XP; a slime adds too little XP to level again, so only the heal rules apply.
  const start = { ...recordStage(createCampaign('fighter'), round(6), 'slime'), level: 2, xp: 8 };
  const healthy = applyVictory(start, wonBattle(start, 20));
  const max2 = heroMaxHp('fighter', 2);
  assert.equal(healthy.campaign.heroHp, Math.min(max2, 20 + Math.round(max2 * CAMPAIGN.victoryHealPercent)));

  const nearlyDead = applyVictory(start, wonBattle(start, 1));
  assert.equal(nearlyDead.campaign.heroHp, Math.ceil(max2 * CAMPAIGN.minimumNextBattleHpPercent), 'floor');
  assert.ok(nearlyDead.rewards.healed > 0);

  const topped = applyVictory(start, wonBattle(start, max2 - 1));
  assert.equal(topped.campaign.heroHp, max2, 'never above max HP');
});

test('level ups raise max HP (new HP arrives filled) and unlock the next skills', () => {
  const start = recordStage(createCampaign('fighter'), round(8), 'slime');
  const { campaign, rewards } = applyVictory(start, wonBattle(start, 10));
  assert.equal(campaign.level, 2);
  assert.equal(rewards.levelUps.length, 1);
  assert.deepEqual(rewards.levelUps[0].skills, ['powerSlash']);
  const gain = heroMaxHp('fighter', 2) - heroMaxHp('fighter', 1);
  assert.equal(rewards.levelUps[0].maxHpGain, gain);
  assert.equal(rewards.maxHp, heroMaxHp('fighter', 2));
  assert.ok(campaign.heroHp >= 10 + gain);
  assert.equal(campaign.heroHp, Math.min(rewards.maxHp, Math.max(10 + gain + Math.round(rewards.maxHp * CAMPAIGN.victoryHealPercent), Math.ceil(rewards.maxHp * CAMPAIGN.minimumNextBattleHpPercent))));

  assert.deepEqual(levelUpReward('mage', 3).skills, ['fireball']);
  assert.equal(levelUpReward('ninja', 4).passive, HEROES.ninja.passive);
  assert.equal(levelUpReward('ninja', 4).skills.length, 0);
  assert.equal(levelUpReward('fighter', 5).mastery, true);
});

test('a multi-level XP jump reports every level once, in order, and HP stays valid', () => {
  const start = recordStage(createCampaign('ninja'), round(10), 'slime');
  const battleState = wonBattle(start, 3);
  const jumped = applyVictory({ ...start, xp: 0 }, { ...battleState, enemies: [...battleState.enemies, { ...battleState.enemies[0], uid: 99, id: 'dragon', hp: 0, summoned: false }, { ...battleState.enemies[0], uid: 98, id: 'giantGolem', hp: 0, summoned: false }] });
  assert.equal(jumped.campaign.level, levelForXp(jumped.campaign.xp));
  assert.deepEqual(jumped.rewards.levelUps.map((reward) => reward.level), Array.from({ length: jumped.campaign.level - 1 }, (_, index) => index + 2));
  assert.ok(jumped.campaign.level >= 4);
  assert.ok(jumped.campaign.heroHp <= heroMaxHp('ninja', jumped.campaign.level));
  assert.equal(levelForXp(1e6), LEVELS.length, 'level caps at the table');
  assert.equal(xpProgress(1e6).max, true);
});

test('XP: enemies award it, a perfect quiz adds a small bonus, and XP carries forward', () => {
  const start = recordStage(createCampaign('mage'), round(9), 'mushroom');
  const first = applyVictory(start, wonBattle(start, 20));
  assert.equal(first.rewards.enemyXp, ENEMIES.mushroom.xp);
  assert.equal(first.rewards.perfectXp, 0);
  const second = recordStage(first.campaign, round(10, 2), 'goblin-slime');
  const after = applyVictory(second, wonBattle(second, 20));
  assert.equal(after.rewards.perfectXp, CAMPAIGN.perfectQuizXp);
  assert.equal(after.campaign.xp, ENEMIES.mushroom.xp + encounterXp('goblin-slime') + CAMPAIGN.perfectQuizXp);
  assert.ok(CAMPAIGN.perfectQuizXp < Math.min(...Object.values(ENEMIES).map((enemy) => enemy.xp)), 'perfect bonus is modest');
  const boss = Math.min(...Object.values(ENEMIES).filter((enemy) => enemy.boss).map((enemy) => enemy.xp));
  const tier3 = Math.max(...Object.values(ENCOUNTERS).filter((encounter) => encounter.tier === 3).map((encounter) => encounterXp(encounter.id)));
  assert.ok(boss > tier3, 'the final boss is a noticeably larger XP burst');
});

test('every encounter path levels up exactly once per battle: L2, L3, L4, then L5 at the end', () => {
  const tiers = [1, 2, 3, 4].map((tier) => Object.values(ENCOUNTERS).filter((encounter) => encounter.tier === tier).map((encounter) => encounter.id));
  for (const a of tiers[0]) for (const b of tiers[1]) for (const c of tiers[2]) for (const d of tiers[3]) for (const perfect of [false, true]) {
    let campaign = createCampaign('fighter');
    [a, b, c, d].forEach((encounterId, index) => {
      campaign = recordStage(campaign, round(perfect ? 10 : 7, index + 1), encounterId);
      campaign = applyVictory(campaign, wonBattle(campaign, 5)).campaign;
      assert.equal(campaign.level, index + 2, `${[a, b, c, d].join(' > ')} perfect=${perfect} after battle ${index + 1}`);
    });
  }
});

test('potions persist, restock by one after a victory, and cap at two', () => {
  let campaign = recordStage(createCampaign('fighter'), round(5), 'slime');
  let result = applyVictory(campaign, wonBattle(campaign, 20, 0));
  assert.equal(result.campaign.potions, 1);
  campaign = recordStage(result.campaign, round(5, 2), 'bat');
  assert.equal(battleSetup(campaign).potions, 1, 'potions carry into the next battle');
  result = applyVictory(campaign, wonBattle(campaign, 20, 1));
  assert.equal(result.campaign.potions, CAMPAIGN.maxPotions);
  campaign = recordStage(result.campaign, round(5, 3), 'golem');
  result = applyVictory(campaign, wonBattle(campaign, 20, 2));
  assert.equal(result.campaign.potions, CAMPAIGN.maxPotions);
});

test('retry restarts from the entry HP and potions with a gradually growing AP assist', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(retryAssist), [0, 1, 3, 6, 10]);
  let campaign = recordStage({ ...createCampaign('ninja'), heroHp: 17, potions: 1 }, round(5, 3), 'golem');
  const entry = battleSetup(campaign);
  campaign = recordDefeat(campaign);
  assert.deepEqual({ ...battleSetup(campaign), ap: entry.ap }, entry);
  assert.equal(battleAp(campaign), 6);
  campaign = recordDefeat(campaign);
  assert.equal(battleAp(campaign), 5 + 3);
  campaign = recordDefeat(campaign);
  assert.equal(battleAp(campaign), BALANCE.maxAp, 'the assist never exceeds the meter');
  const won = applyVictory(campaign, wonBattle(campaign, 9));
  assert.equal(won.campaign.retries, 0, 'assist resets after a victory');
  assert.equal(recordStage(won.campaign, round(4, 4), 'dragon').retries, 0);
});

test('campaign summary aggregates quiz results and reports the level', () => {
  const first = recordStage(createCampaign('mage'), { ...round(1, 1, 2), missedIds: new Set(['jump']) }, 'slime');
  const second = recordStage(first, { ...round(2, 2, 2), missedIds: new Set(['run']) }, 'bat');
  assert.deepEqual(campaignSummary(second), { totalCorrect: 3, totalQuestions: 4, bestStreak: 2, missedIds: ['jump', 'run'], level: 1 });
});
