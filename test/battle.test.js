import test from 'node:test';
import assert from 'node:assert/strict';
import { ENCOUNTERS, ENEMIES, SKILLS } from '../src/battle-data.js';
import { availableSkills, chooseEncounter, createBattle, cycleTarget, isDefeat, isVictory, resolveEnemyPhase, selectTarget, skillTierForStage, useSkill } from '../src/battle-engine.js';
import { battlePowerFor, campaignSummary, createCampaign, recordStage, retryPower } from '../src/campaign.js';

const enemyPhase = (state) => resolveEnemyPhase(state).state;
const battle = (options = {}) => createBattle({ heroId: 'fighter', encounterId: 'slime', power: 2, skillTier: 0, ...options });

test('battle creation and campaign power calculations', () => {
  const state = battle();
  assert.equal(state.turn, 'player');
  assert.equal(state.hero.hp, 32);
  assert.equal(state.enemies[0].id, 'slime');
  assert.equal(battlePowerFor(0), 2);
  assert.equal(battlePowerFor(5), 7);
  assert.equal(battlePowerFor(10), 12);
});

test('basic attack is free, specials reject cleanly, and power cannot go below zero', () => {
  const zero = battle({ power: 0 });
  const basic = useSkill(zero, 'slash');
  assert.equal(basic.state.power, 0);
  assert.equal(basic.state.enemies[0].hp, 4);
  const before = battle({ skillTier: 1, power: 1 });
  const rejected = useSkill(before, 'powerSlash');
  assert.equal(rejected.state, before);
  assert.equal(rejected.events[0].reason, 'unaffordable');
  assert.equal(useSkill(battle({ skillTier: 1, power: 2 }), 'powerSlash').state.power, 0);
});

test('single, area, heal, defense and dodge skills resolve deterministically', () => {
  let state = battle({ heroId: 'mage', encounterId: 'goblin-slime', power: 5, skillTier: 2, heroHp: 20 });
  state = useSkill(state, 'fireball').state;
  assert.deepEqual(state.enemies.map((enemy) => enemy.hp), [4, 1]);
  state = enemyPhase(state);
  assert.equal(state.hero.hp, 16);
  state = useSkill(state, 'heal').state;
  assert.equal(state.hero.hp, 25); // 16 + 12 is capped at max HP
  assert.equal(state.power, 0);
  state = enemyPhase(state);
  state = useSkill(state, 'barrier').state;
  state = enemyPhase(state);
  assert.equal(state.hero.defense, null);

  let ninja = battle({ heroId: 'ninja', encounterId: 'goblin-goblin', power: 0 });
  ninja = useSkill(ninja, 'dodge').state;
  ninja = enemyPhase(ninja);
  assert.equal(ninja.hero.hp, 26); // first 2 is dodged, second 2 is halved.
});

test('defense multipliers and statuses apply for exactly one enemy phase', () => {
  let guard = useSkill(battle(), 'guard').state;
  guard = enemyPhase(guard);
  assert.equal(guard.hero.hp, 31);
  guard = useSkill(guard, 'slash').state;
  guard = enemyPhase(guard);
  assert.equal(guard.hero.hp, 29);

  let shield = battle({ encounterId: 'shield-goblin-healer', power: 0 });
  shield = enemyPhase(useSkill(shield, 'guard').state); // shield goblin attacks
  assert.equal(shield.enemies[0].guarding, false);
  shield = enemyPhase(useSkill(shield, 'guard').state); // shield goblin raises its shield
  assert.equal(shield.enemies[0].guarding, true);
  const hit = useSkill(shield, 'slash').state;
  assert.equal(hit.enemies[0].hp, 14); // 16 - ceil(4 * .5)
});

test('dead enemies cannot act or be targeted and selection advances on defeat', () => {
  let state = battle({ encounterId: 'goblin-slime', power: 2, skillTier: 1 });
  const goblin = state.enemies[0].uid;
  const slime = state.enemies[1].uid;
  state = useSkill(state, 'powerSlash', goblin).state;
  state = enemyPhase(state);
  state = useSkill(state, 'slash', goblin).state;
  assert.equal(state.selectedUid, slime);
  assert.equal(selectTarget(state, goblin), state);
  assert.equal(state.hero.hp, 28); // both attacked once; the dead goblin never acts again
  assert.equal(enemyPhase(state).hero.hp, 26);
  assert.equal(cycleTarget(state, -1).selectedUid, slime);
});

test('victory, defeat, target fallback, locked skills, and turn rejection', () => {
  const won = useSkill(battle({ power: 2, skillTier: 1 }), 'powerSlash');
  assert.ok(isVictory(won.state));
  assert.equal(won.state.turn, 'won');
  const locked = useSkill(battle(), 'powerSlash');
  assert.equal(locked.events[0].reason, 'locked');
  const fallback = useSkill(battle({ encounterId: 'goblin-slime', skillTier: 1 }), 'slash', 999);
  assert.equal(fallback.state.enemies[0].hp, 7);
  assert.equal(useSkill(fallback.state, 'slash').events[0].reason, 'not-player-turn');
  const lost = enemyPhase(useSkill(battle({ heroHp: 1 }), 'slash').state);
  assert.ok(isDefeat(lost));
});

test('encounter choice, skill tiers, heavy telegraph, healer, summon, drain and rest work', () => {
  assert.equal(chooseEncounter(2, () => 0).id, 'goblin-slime');
  assert.equal(chooseEncounter(4, () => 0.99).id, 'vampire-lord');
  assert.deepEqual([1, 2, 3, 4].map(skillTierForStage), [0, 1, 2, 2]);
  let golem = battle({ encounterId: 'golem' });
  golem = enemyPhase(useSkill(golem, 'slash').state);
  golem = enemyPhase(useSkill(golem, 'slash').state);
  assert.equal(golem.enemies[0].charging, true);
  const hp = golem.hero.hp;
  golem = enemyPhase(useSkill(golem, 'slash').state);
  assert.equal(golem.hero.hp, hp - 9);
  golem = enemyPhase(useSkill(golem, 'slash').state);
  assert.equal(golem.enemies[0].tired, true);

  let healer = battle({ encounterId: 'shield-goblin-healer' });
  healer = useSkill(healer, 'slash', healer.enemies[0].uid).state;
  healer = enemyPhase(healer);
  assert.equal(healer.enemies[0].hp, 16);
  let necro = battle({ encounterId: 'necromancer-skeletons' });
  necro = enemyPhase(useSkill(necro, 'slash').state);
  assert.equal(necro.enemies.filter((enemy) => enemy.hp > 0).length, 3); // skeletons alive: no summon
  let lonely = battle({ encounterId: 'necromancer-skeletons' });
  lonely = { ...lonely, enemies: lonely.enemies.map((enemy) => (enemy.id === 'skeleton' ? { ...enemy, hp: 0 } : enemy)) };
  lonely = enemyPhase(useSkill(lonely, 'guard').state);
  assert.equal(lonely.enemies.filter((enemy) => enemy.hp > 0).length, 2);
  assert.equal(lonely.hero.hp, 32); // the new skeleton waits a phase before acting
  let vampire = battle({ encounterId: 'vampire-lord' });
  vampire = useSkill(vampire, 'slash').state;
  vampire = enemyPhase(vampire);
  assert.equal(vampire.enemies[0].hp, vampire.enemies[0].maxHp - 2);
});

test('zero Power never soft-locks: every hero always has a free damaging skill', () => {
  for (const heroId of ['fighter', 'mage', 'ninja']) for (const skillTier of [0, 1, 2]) {
    const skills = availableSkills(battle({ heroId, skillTier, power: 0 }));
    assert.ok(skills.some((skill) => skill.affordable && skill.cost === 0 && skill.kind === 'damage'), `${heroId} tier ${skillTier}`);
    assert.ok(skills.every((skill) => skill.affordable === (skill.cost === 0)));
  }
});

test('campaign records without mutating round and aggregates results', () => {
  const round = { mode: 1, items: [{ id: 'run' }, { id: 'jump' }], correctCount: 1, bestStreak: 1, missedIds: new Set(['jump']) };
  const campaign = recordStage(createCampaign('mage'), round, 'slime');
  assert.equal(round.missedIds instanceof Set, true);
  assert.equal(retryPower(campaign.stageResults[0]), 5);
  const second = recordStage(campaign, { ...round, mode: 2, correctCount: 2, bestStreak: 2, missedIds: new Set(['run']) }, 'bat');
  assert.deepEqual(campaignSummary(second), { totalCorrect: 3, totalQuestions: 4, bestStreak: 2, missedIds: ['jump', 'run'] });
});

// Estimated damage a skill deals this turn, used by the scripted balance policy.
function skillValue(skill, state, target) {
  const data = SKILLS[skill.id];
  const alive = state.enemies.filter((enemy) => enemy.hp > 0);
  if (data.kind === 'damage') return data.target === 'all' ? data.damage * alive.length : Math.min(data.damage, target.hp);
  if (data.kind === 'doubleDamage') return Math.min(2 * data.damage, target.hp);
  if (data.kind === 'splitDamage') return Math.min(data.damage, target.hp) + (alive.length > 1 ? data.splashDamage : 0);
  return 0;
}

// A plain player: defend against telegraphed attacks, Mage heals when low,
// hit summoners/healers first, otherwise the weakest enemy with the best affordable attack.
function simulate(heroId, encounter, power) {
  let state = createBattle({ heroId, encounterId: encounter.id, power, skillTier: skillTierForStage(encounter.tier) });
  let turns = 0;
  const support = (enemy) => (['summon', 'healAlly'].some((action) => ENEMIES[enemy.id].pattern.includes(action)) ? 0 : 1);
  while (state.turn === 'player' && turns < 100) {
    const charging = state.enemies.some((enemy) => enemy.hp > 0 && enemy.charging);
    const skills = availableSkills(state);
    const hero = state.hero;
    const target = state.enemies.filter((enemy) => enemy.hp > 0).sort((a, b) => support(a) - support(b) || a.hp - b.hp)[0];
    let skill = charging ? skills.find((candidate) => candidate.kind === 'defense') : null;
    if (!skill && heroId === 'mage' && hero.hp < hero.maxHp / 2) skill = skills.find((candidate) => candidate.id === 'heal' && candidate.affordable);
    if (!skill) skill = skills.filter((candidate) => candidate.affordable && ['damage', 'doubleDamage', 'splitDamage'].includes(candidate.kind))
      .sort((a, b) => skillValue(b, state, target) - skillValue(a, state, target) || a.cost - b.cost)[0];
    state = useSkill(state, skill.id, target.uid).state;
    turns += 1;
    if (state.turn === 'enemy') state = resolveEnemyPhase(state).state;
  }
  return { state, turns };
}

test('balance acceptance: every hero and encounter is finishable and scales with Power', () => {
  // SPEC target lengths are approximate; Power 7 must never drag past the tier maximum + 1.
  const ranges = { 1: [2, 4], 2: [3, 6], 3: [4, 7], 4: [5, 9] };
  for (const heroId of ['fighter', 'mage', 'ninja']) for (const encounter of Object.values(ENCOUNTERS)) {
    const low = simulate(heroId, encounter, 2);
    const middle = simulate(heroId, encounter, 7);
    const high = simulate(heroId, encounter, 12);
    assert.equal(low.state.turn, 'won', `${heroId} ${encounter.id} at 2`);
    assert.equal(middle.state.turn, 'won', `${heroId} ${encounter.id} at 7`);
    assert.ok(middle.turns <= ranges[encounter.tier][1] + 1, `${heroId} ${encounter.id} at 7: ${middle.turns}`);
    assert.ok(high.turns <= low.turns, `${heroId} ${encounter.id} at 12`);
    if (encounter.tier >= 3) assert.ok(high.turns < low.turns, `${heroId} ${encounter.id} needs a 12 Power improvement`);
  }
});
