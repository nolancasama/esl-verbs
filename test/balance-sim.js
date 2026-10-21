// Deterministic battle / campaign simulation shared by the balance tests and
// by manual tuning (node test/balance-report.mjs). Three player models:
//   naive     - presses the first button (basic attack) every turn.
//   competent - follows the on-screen hints: defends when a BIG ATTACK shows,
//               drinks a Potion when HP is low, uses the biggest affordable skill.
//   smart     - plays each class's mechanics and plans AP around shown intents.
import { ENCOUNTERS, ENEMIES, LEVELS, SKILLS } from '../src/battle-data.js';
import {
  availableItems, availableSkills, chooseEncounter, createBattle, heroMaxHp, mustRecover, recover,
  protectedUid, resolveEnemyPhase, useItem, useSkill,
} from '../src/battle-engine.js';
import { applyVictory, battleSetup, chapterRest, createCampaign, recordDefeat, recordStage } from '../src/campaign.js';

export function seeded(seed) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

const alive = (state) => state.enemies.filter((enemy) => enemy.hp > 0);
const supportRank = (enemy) => (ENEMIES[enemy.id].ai.support ? 0 : 1);
const skill = (state, id) => availableSkills(state).find((candidate) => candidate.id === id && candidate.affordable);
const potion = (state) => availableItems(state).find((item) => item.id === 'potion' && item.usable);
const defense = (state) => availableSkills(state).find((candidate) => candidate.kind === 'defense' && candidate.affordable);

function targetFor(state) {
  return alive(state).sort((a, b) => supportRank(a) - supportRank(b) || a.hp - b.hp || a.uid - b.uid)[0];
}


function skillValue(state, id, target) {
  const data = SKILLS[id];
  const count = alive(state).length;
  if (data.kind === 'damage') return data.target === 'all' ? data.damage * count : Math.min(data.damage, target.hp);
  if (data.kind === 'doubleDamage') return Math.min(2 * data.damage, target.hp);
  if (data.kind === 'splitDamage') return Math.min(data.damage, target.hp) + (target.hp <= data.damage && count > 1 ? data.splashDamage : 0);
  return 0;
}

// The strongest affordable attack; group attacks only when there is a group.
function biggestAttack(state, target, maxCost = Infinity) {
  const group = alive(state).length > 1;
  return availableSkills(state)
    .filter((candidate) => candidate.affordable && candidate.cost <= maxCost && ['damage', 'doubleDamage', 'splitDamage'].includes(candidate.kind))
    .filter((candidate) => group || candidate.target !== 'all')
    .sort((a, b) => skillValue(state, b.id, target) - skillValue(state, a.id, target) || a.cost - b.cost)[0];
}

// An affordable attack that defeats the last enemy (anyone can see a nearly empty HP bar).
function finisher(state) {
  const living = alive(state);
  if (living.length !== 1) return null;
  const [enemy] = living;
  const factor = (enemy.guarding ? 0.5 : 1) * (enemy.tired ? 1.5 : 1);
  const kill = availableSkills(state)
    .filter((candidate) => candidate.affordable && ['damage', 'doubleDamage', 'splitDamage'].includes(candidate.kind))
    .filter((candidate) => Math.ceil(skillValue({ ...state, enemies: [{ ...enemy, hp: 999 }] }, candidate.id, { ...enemy, hp: 999 }) * factor) >= enemy.hp)
    .sort((a, b) => a.cost - b.cost)[0];
  return kill ? { skillId: kill.id, target: enemy.uid } : null;
}

export function naive(state) {
  if (mustRecover(state)) return { recover: true };
  const [first] = availableSkills(state);
  return first.affordable ? { skillId: first.id, target: state.selectedUid } : { recover: true };
}

export function competent(state) {
  if (mustRecover(state)) return { recover: true };
  const finish = finisher(state);
  if (finish) return finish;
  const target = targetFor(state);
  if (alive(state).some((enemy) => enemy.intent === 'heavy') && defense(state)) return { skillId: defense(state).id, target: target.uid };
  if (state.hero.hp <= state.hero.maxHp * 0.35 && potion(state)) return { itemId: 'potion' };
  const heal = skill(state, 'heal');
  if (heal && state.hero.hp < state.hero.maxHp / 2) return { skillId: 'heal', target: target.uid };
  // The battle hint says "keep 1 AP" while an enemy is powering up.
  const keep = alive(state).some((enemy) => enemy.intent === 'charge') && state.ap >= 2 ? 1 : 0;
  return { skillId: (biggestAttack(state, target, state.ap - keep) || biggestAttack(state, target)).id, target: target.uid };
}

export function smart(state) {
  if (mustRecover(state)) return { recover: true };
  const finish = finisher(state);
  if (finish) return finish;
  const { hero, heroId, ap } = state;
  const living = alive(state);
  const target = targetFor(state);
  const heavy = living.find((enemy) => enemy.intent === 'heavy');
  // Same AP plan as the on-screen hint: keep 1 AP while an enemy is powering up.
  const keep = living.some((enemy) => enemy.intent === 'charge') ? 1 : 0;
  const spare = (cost) => ap - cost >= keep;

  if (heavy) {
    // Fighter Break cancels the big attack outright; everyone else defends (AP-neutral).
    if (heroId === 'fighter' && skill(state, 'powerSlash')) return { skillId: 'powerSlash', target: heavy.uid };
    if (defense(state)) return { skillId: defense(state).id, target: heavy.uid };
  }
  if (hero.hp <= hero.maxHp * 0.35 && potion(state)) return { itemId: 'potion' };
  if (skill(state, 'heal') && hero.hp < hero.maxHp / 2) return { skillId: 'heal', target: target.uid };

  if (heroId === 'fighter') {
    if (living.length >= 2 && skill(state, 'cleave') && spare(3)) return { skillId: 'cleave', target: target.uid };
    if (hero.combo && skill(state, 'powerSlash') && spare(2)) return { skillId: 'powerSlash', target: target.uid };
    return { skillId: 'slash', target: target.uid };
  }
  if (heroId === 'mage') {
    const exploit = living.filter((enemy) => enemy.tired || enemy.charging).sort((a, b) => a.hp - b.hp)[0];
    if (exploit) return { skillId: 'magicBolt', target: exploit.uid };
    if (living.length >= 2 && skill(state, 'fireball') && spare(3)) return { skillId: 'fireball', target: target.uid };
    return { skillId: 'magicBolt', target: target.uid };
  }
  const opening = living.find((enemy) => enemy.uid === hero.openingUid);
  if (opening && skill(state, 'doubleStrike') && spare(2)) return { skillId: 'doubleStrike', target: opening.uid };
  const chain = living.filter((enemy) => enemy.hp <= SKILLS.shadowStrike.damage).sort((a, b) => supportRank(a) - supportRank(b) || b.hp - a.hp)[0];
  if (chain && living.length > 1 && skill(state, 'shadowStrike') && spare(3)) return { skillId: 'shadowStrike', target: chain.uid };
  const vulnerable = living.filter((enemy) => enemy.guarding || enemy.charging || enemy.tired || ['heal', 'summon'].includes(enemy.intent))
    .sort((a, b) => supportRank(a) - supportRank(b) || a.hp - b.hp)[0];
  if (vulnerable && skill(state, 'doubleStrike') && ap >= 3) return { skillId: 'strike', target: vulnerable.uid };
  const best = biggestAttack(state, target, ap - keep) || biggestAttack(state, target);
  return { skillId: best.id, target: target.uid };
}

export const POLICIES = Object.freeze({ naive, competent, smart });

/** Yao teaches visible threat priority; the comparison bot only changes its target. */
function yaoTarget(state) {
  const protectors = alive(state).filter((enemy) => ENEMIES[enemy.id].protector);
  const protectedCallers = protectors.map((enemy) => protectedUid(state, enemy.uid));
  const priority = (enemy) => {
    if (enemy.intent === 'boom') return 0;
    if (enemy.intent === 'call' && !protectedCallers.includes(enemy.uid)) return 1;
    if (protectors.includes(enemy) && alive(state).some((caller) => caller.intent === 'call' && caller.uid === protectedUid(state, enemy.uid))) return 2;
    if (enemy.id === 'shadowArcher' && enemy.intent === 'charge') return 3;
    return 4;
  };
  return alive(state).sort((a, b) => priority(a) - priority(b) || a.hp - b.hp || a.uid - b.uid)[0];
}

function yaoAction(state, target) {
  if (mustRecover(state)) return { recover: true };
  // Set up Ninja's chain on the chosen target without spending the AP needed
  // for Shadow Strike. A nonlethal Shadow Strike has no area damage.
  if (state.heroId === 'ninja' && alive(state).length >= 2 && state.ap >= 4
    && useSkill(state, 'shadowStrike', target.uid, () => .9).state.enemies.some((enemy) => enemy.uid === target.uid && enemy.hp > 0)) {
    const setup = useSkill(state, 'strike', target.uid, () => .9).state;
    const remaining = setup.enemies.find((enemy) => enemy.uid === target.uid);
    if (remaining?.hp > 0 && setup.turn === 'enemy') {
      const chain = useSkill({ ...setup, turn: 'player' }, 'shadowStrike', target.uid, () => .9);
      if (chain.events.filter((event) => event.type === 'defeat').length >= 2) return { skillId: 'strike', target: target.uid };
    }
  }
  // Finish the chosen enemy efficiently, including useful splash damage. Use
  // the pure combat rules for protection, openings and guard damage values.
  const attacks = availableSkills(state)
    .filter((candidate) => candidate.affordable && ['damage', 'doubleDamage', 'splitDamage'].includes(candidate.kind))
    .map((candidate) => {
      const next = useSkill(state, candidate.id, target.uid, () => 0.9).state;
      const damage = state.enemies.reduce((sum, enemy) => sum + enemy.hp - (next.enemies.find((other) => other.uid === enemy.uid)?.hp ?? 0), 0);
      return { ...candidate, damage, lethal: !next.enemies.some((enemy) => enemy.uid === target.uid && enemy.hp > 0) };
    })
    .sort((a, b) => b.damage / b.cost - a.damage / a.cost || b.damage - a.damage || a.cost - b.cost);
  const lethal = attacks.filter((candidate) => candidate.lethal)
    .sort((a, b) => b.damage / b.cost - a.damage / a.cost || a.cost - b.cost)[0];
  const finish = lethal ? { skillId: lethal.id, target: target.uid } : null;
  if (finish && (alive(state).length < 3 || !attacks.some((candidate) => candidate.target === 'all') || ['boom', 'heavy'].includes(target.intent))) return finish;
  if (state.hero.hp <= state.hero.maxHp * 0.35 && potion(state)) return { itemId: 'potion' };
  // Dodge has no AP refund: take a survivable hit to make progress, or cash
  // in a counter, rather than spending every recovered AP on another Dodge.
  const incoming = alive(state).reduce((sum, enemy) => sum + (enemy.intent === 'boom' ? ENEMIES[enemy.id].boom
    : enemy.intent === 'heavy' ? ENEMIES[enemy.id].heavy : enemy.intent === 'attack' ? ENEMIES[enemy.id].attack : 0), 0);
  if (alive(state).some((enemy) => ['heavy', 'boom'].includes(enemy.intent)) && defense(state)
    && (state.heroId !== 'ninja' || (!state.hero.counter && state.hero.hp <= incoming + 4))) {
    return { skillId: defense(state).id, target: target.uid };
  }
  if (skill(state, 'heal') && state.hero.hp < state.hero.maxHp / 2) return { skillId: 'heal', target: target.uid };
  const area = attacks.find((candidate) => candidate.target === 'all');
  if (alive(state).length >= 3 && area) return { skillId: area.id, target: target.uid };
  if (finish) return finish;
  const keep = alive(state).some((enemy) => enemy.intent === 'charge') && state.ap >= 2 ? 1 : 0;
  const attack = attacks.find((candidate) => candidate.cost <= state.ap - keep) || attacks[0];
  return { skillId: attack.id, target: target.uid };
}

export const YAO_POLICIES = Object.freeze({
  naive: (state) => yaoAction(state, alive(state)[0]),
  competent: (state) => yaoAction(state, yaoTarget(state)),
});

/** Apply one policy decision. Returns the result of that player step. */
export function step(state, choice, rng = Math.random) {
  if (choice.recover) return recover(state);
  if (choice.itemId) return useItem(state, choice.itemId);
  return useSkill(state, choice.skillId, choice.target ?? state.selectedUid, rng);
}

/** One battle to the end. Options mirror createBattle plus a policy and seed. */
export function simulateBattle({ policy = competent, seed = 1, rng = seeded(seed), maxTurns = 200, ...options }) {
  let state = createBattle({ ...options, rng });
  let turns = 0;
  let recoveries = 0;
  let potionsUsed = 0;
  let heroDamage = 0;
  let allyDamage = 0;
  let reinforcements = 0;
  while (state.turn === 'player' && turns < maxTurns) {
    const choice = policy(state);
    const result = step(state, choice, rng);
    if (result.events[0]?.type === 'rejected') throw new Error(`${options.heroId} ${options.encounterId}: rejected ${JSON.stringify(choice)} (${result.events[0].reason})`);
    if (choice.recover) recoveries += 1;
    if (choice.itemId) potionsUsed += 1;
    heroDamage += result.events.filter((event) => event.type === 'damage' && event.target !== 'hero').reduce((sum, event) => sum + event.amount, 0);
    state = result.state;
    turns += 1;
    if (state.turn === 'enemy') {
      const enemyPhase = resolveEnemyPhase(state, rng);
      reinforcements += enemyPhase.events.filter((event) => event.type === 'call').reduce((sum, event) => sum + event.targets.length, 0);
      if (enemyPhase.events.some((event) => event.type === 'allyAttack')) {
        allyDamage += enemyPhase.events.filter((event) => event.type === 'damage' && event.target !== 'hero').reduce((sum, event) => sum + event.amount, 0);
      }
      state = enemyPhase.state;
    }
  }
  return { state, won: state.turn === 'won', turns, recoveries, potionsUsed, hp: state.hero.hp, heroDamage, allyDamage, reinforcements };
}

/**
 * A full four-stage campaign at a fixed quiz score. Losses retry with the
 * normal retry assist. Returns per-stage attempts and whether every battle
 * was won within maxRetries.
 */
export function simulateCampaign({ heroId, ap, policy = competent, seed = 1, maxRetries = 10 }) {
  const rng = seeded(seed);
  let campaign = createCampaign(heroId);
  const stages = [];
  for (let stage = 1; stage <= 4; stage += 1) {
    const encounter = chooseEncounter(stage, rng);
    const correct = typeof ap === 'function' ? ap(stage) : Array.isArray(ap) ? ap[stage - 1] : ap;
    const round = { mode: stage, items: Array.from({ length: 10 }, (_, index) => ({ id: `q${index}` })), correctCount: correct, bestStreak: correct, missedIds: new Set() };
    campaign = recordStage(campaign, round, encounter.id);
    let attempts = 0;
    let result = null;
    const entryHp = campaign.heroHp;
    while (attempts <= maxRetries) {
      attempts += 1;
      result = simulateBattle({ ...battleSetup(campaign), policy, rng });
      if (result.won) break;
      campaign = recordDefeat(campaign);
    }
    stages.push({ stage, encounterId: encounter.id, attempts, won: result.won, entryHp, level: campaign.level, maxHp: result.state.hero.maxHp, hpLeft: result.hp, recoveries: result.recoveries });
    if (!result.won) return { campaign, stages, completed: false };
    campaign = applyVictory(campaign, result.state).campaign;
  }
  return { campaign, stages, completed: true };
}

export const SAKAI_ENCOUNTER_IDS = Object.freeze(['sakai-1', 'sakai-2', 'sakai-3', 'sakai-4']);

export function sakaiEncounters() {
  return SAKAI_ENCOUNTER_IDS.map((id) => ENCOUNTERS[id]);
}

/** Four fixed Sakai battles at level 5, carrying victory resources and using the real retry assist. */
export function simulateSakaiCampaign({ heroId, ap, policy = smart, seed = 1, maxAttempts = 1 }) {
  const rng = seeded(seed);
  let campaign = chapterRest(createCampaign(heroId, { cityId: 'sakai', level: 5, xp: LEVELS.at(-1).xp }));
  const stages = [];
  for (let index = 0; index < SAKAI_ENCOUNTER_IDS.length; index += 1) {
    const encounterId = SAKAI_ENCOUNTER_IDS[index];
    const correct = typeof ap === 'function' ? ap(index + 1) : Array.isArray(ap) ? ap[index] : ap;
    const round = {
      mode: index + 1,
      items: Array.from({ length: 10 }, (_, question) => ({ id: `sakai-${index + 1}-q${question}` })),
      correctCount: correct,
      bestStreak: correct,
      missedIds: new Set(),
    };
    campaign = recordStage(campaign, round, encounterId);
    const entryHp = campaign.heroHp;
    const entryPotions = campaign.potions;
    let attempts = 0;
    let result = null;
    while (attempts < maxAttempts) {
      attempts += 1;
      result = simulateBattle({ ...battleSetup(campaign), policy, rng });
      if (result.won) break;
      campaign = recordDefeat(campaign);
    }
    stages.push({
      stage: index + 1, encounterId, attempts, won: result.won, entryHp, entryPotions,
      hpLeft: result.hp, potionsLeft: result.state.potions, turns: result.turns, recoveries: result.recoveries,
    });
    if (!result.won) return { campaign, stages, completed: false };
    campaign = applyVictory(campaign, result.state).campaign;
  }
  return { campaign, stages, completed: true };
}

export const YAO_ENCOUNTER_IDS = Object.freeze(['yao-1', 'yao-2', 'yao-3', 'yao-4']);

export function yaoEncounters() {
  return YAO_ENCOUNTER_IDS.map((id) => ENCOUNTERS[id]);
}

/** Real Sakai completion supplies progression; starting the next city restores resources. */
export function yaoEntryCampaign({ heroId, ap, seed = 1 }) {
  const sakai = simulateSakaiCampaign({ heroId, ap, policy: competent, seed, maxAttempts: 20 });
  if (!sakai.completed) throw new Error(`${heroId} AP${ap}: could not reach Yao from Sakai`);
  return chapterRest(createCampaign(heroId, { cityId: 'yao', level: sakai.campaign.level, xp: sakai.campaign.xp }));
}

/** Four fixed Yao battles, carrying HP/potions and using the unchanged city retry assist. */
export function simulateYaoCampaign({ heroId, ap, policy = YAO_POLICIES.competent, seed = 1, maxAttempts = 6 }) {
  const rng = seeded(seed);
  let campaign = yaoEntryCampaign({ heroId, ap, seed });
  const entryCampaign = campaign;
  const stages = [];
  for (let index = 0; index < YAO_ENCOUNTER_IDS.length; index += 1) {
    const encounterId = YAO_ENCOUNTER_IDS[index];
    const correct = typeof ap === 'function' ? ap(index + 1) : Array.isArray(ap) ? ap[index] : ap;
    campaign = recordStage(campaign, {
      mode: index + 1,
      items: Array.from({ length: 10 }, (_, question) => ({ id: `yao-${index + 1}-q${question}` })),
      correctCount: correct, bestStreak: correct, missedIds: new Set(),
    }, encounterId);
    const entryHp = campaign.heroHp;
    const entryPotions = campaign.potions;
    let attempts = 0;
    let result;
    while (attempts < maxAttempts) {
      attempts += 1;
      result = simulateBattle({ ...battleSetup(campaign), policy, rng });
      if (result.won) break;
      campaign = recordDefeat(campaign);
    }
    stages.push({
      stage: index + 1, encounterId, attempts, won: result.won, entryHp, entryPotions,
      hpLeft: result.hp, potionsLeft: result.state.potions, turns: result.turns, recoveries: result.recoveries,
    });
    if (!result.won) return { campaign, entryCampaign, stages, completed: false };
    campaign = applyVictory(campaign, result.state).campaign;
  }
  return { campaign, entryCampaign, stages, completed: true };
}

/** Level at which each stage is fought in a normal campaign. */
export const STAGE_LEVEL = Object.freeze({ 1: 1, 2: 2, 3: 3, 4: 4 });

export function encountersForTier(tier) {
  return Object.values(ENCOUNTERS).filter((encounter) => !encounter.city && encounter.tier === tier);
}
