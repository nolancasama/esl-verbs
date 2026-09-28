import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE, ENCOUNTERS, ENEMIES, HEROES, ITEMS, SKILLS } from '../src/battle-data.js';
import {
  availableItems, availableSkills, battleXp, chooseEncounter, chooseEnemyIntent, createBattle, cycleTarget, getEnemyIntent,
  heroMaxHp, isDefeat, isVictory, mustRecover, potionHeal, recover, resolveEnemyPhase, selectTarget, skillBonus, skillTierForLevel, useItem,
  useSkill,
} from '../src/battle-engine.js';

const fixed = (value) => () => value;
const battle = (options = {}) => createBattle({ heroId: 'fighter', encounterId: 'slime', ap: 5, level: 1, rng: fixed(0.99), ...options });
const patchEnemy = (state, uid, changes) => ({
  ...state,
  enemies: state.enemies.map((enemy) => enemy.uid === uid ? { ...enemy, ...changes } : enemy),
});
const damageTo = (events, target) => events.filter((event) => event.type === 'damage' && event.target === target).reduce((sum, event) => sum + event.amount, 0);
const apGains = (events, reason) => events.filter((event) => event.type === 'ap' && (!reason || event.reason === reason)).reduce((sum, event) => sum + event.amount, 0);
const heavyOn = (state, uid = state.enemies[0].uid) => patchEnemy(state, uid, { intent: 'heavy', charging: true });

test('battle creation, level-derived hero values, targeting and skill gates', () => {
  const state = battle();
  assert.equal(state.turn, 'player');
  assert.equal(state.ap, 5);
  assert.equal(state.hero.hp, HEROES.fighter.maxHp);
  assert.deepEqual([1, 2, 3, 4, 5].map((level) => skillTierForLevel(level)), [0, 1, 2, 2, 2]);
  assert.equal(battle({ level: 3 }).hero.maxHp, heroMaxHp('fighter', 3));
  assert.equal(battle({ level: 3, heroHp: 7 }).hero.hp, 7);
  assert.equal(battle({ heroHp: 999 }).hero.hp, HEROES.fighter.maxHp);
  assert.equal(chooseEncounter(2, fixed(0)).id, 'goblin-slime');
  assert.equal(chooseEncounter(4, fixed(0.99)).id, 'vampire-lord');

  assert.equal(useSkill(state, 'powerSlash').events[0].reason, 'locked');
  assert.equal(useSkill(battle({ level: 2 }), 'powerSlash').events[0].type, 'attack');
  assert.equal(useSkill(battle({ level: 1, skillTier: 2 }), 'cleave').events[0].type, 'attack', 'debug skill tier override');
  const pair = battle({ encounterId: 'goblin-slime' });
  assert.equal(selectTarget(pair, pair.enemies[1].uid).selectedUid, pair.enemies[1].uid);
  assert.equal(cycleTarget(pair, 1).selectedUid, pair.enemies[1].uid);
});

test('stored intents exist, injected RNG is deterministic, and resolution uses the displayed intent', () => {
  const guard = battle({ encounterId: 'goblin-slime', rng: fixed(0) });
  const attack = battle({ encounterId: 'goblin-slime', rng: fixed(0.99) });
  assert.ok(guard.enemies.every((enemy) => getEnemyIntent(guard, enemy.uid)));
  assert.equal(guard.enemies[0].intent, 'guard');
  assert.equal(attack.enemies[0].intent, 'attack');
  assert.equal(chooseEnemyIntent(attack, attack.enemies[0], fixed(0)), 'guard');

  const acted = resolveEnemyPhase(useSkill(guard, 'slash').state, fixed(0.99));
  assert.equal(acted.state.enemies[0].guarding, true);
  assert.equal(acted.state.hero.hp, guard.hero.hp - ENEMIES.slime.attack);
  assert.ok(!acted.events.some((event) => event.type === 'attack' && event.source === guard.enemies[0].uid));
  assert.equal('rng' in acted.state, false);
});

test('AP: every skill and item costs AP, and nothing is free', () => {
  for (const skill of Object.values(SKILLS)) assert.ok(skill.cost >= 1, `${skill.id} costs AP`);
  for (const item of Object.values(ITEMS)) assert.ok(item.cost >= 1, `${item.id} costs AP`);
  for (const [heroId, hero] of Object.entries(HEROES)) {
    for (const skillId of hero.skills) {
      const state = createBattle({ heroId, encounterId: 'golem', ap: 10, level: 5, rng: fixed(0.99) });
      const result = useSkill(state, skillId);
      assert.equal(result.state.ap, 10 - SKILLS[skillId].cost + apGains(result.events), `${heroId} ${skillId}`);
    }
  }
  const hurt = battle({ ap: 3, heroHp: 10, potions: 1 });
  const drink = useItem(hurt, 'potion');
  assert.equal(drink.state.ap, 3 - ITEMS.potion.cost);
});

test('AP: unaffordable actions reject cleanly and AP never goes negative', () => {
  const broke = battle({ ap: 0, level: 2 });
  for (const skillId of HEROES.fighter.skills.slice(0, 3)) {
    const result = useSkill(broke, skillId);
    assert.equal(result.events[0].reason, 'unaffordable', skillId);
    assert.equal(result.state, broke);
  }
  const one = useSkill(battle({ ap: 1, level: 2 }), 'powerSlash');
  assert.equal(one.events[0].reason, 'unaffordable');
  assert.equal(one.state.ap, 1);
  assert.equal(createBattle({ heroId: 'mage', encounterId: 'slime', ap: -4 }).ap, 0);
  assert.equal(createBattle({ heroId: 'mage', encounterId: 'slime', ap: 25 }).ap, BALANCE.maxAp);
  assert.ok(availableSkills(battle({ ap: 0 })).every((skill) => !skill.affordable));
});

test('AP recovery: only an exhausted turn recovers, the enemies still act, and waiting cannot farm AP', () => {
  const ready = battle({ ap: 1 });
  assert.equal(mustRecover(ready), false);
  assert.equal(recover(ready).events[0].reason, 'not-exhausted');

  const empty = battle({ ap: 0, encounterId: 'goblin-slime' });
  assert.equal(mustRecover(empty), true);
  const rested = recover(empty);
  assert.equal(rested.state.ap, BALANCE.recoveryAp);
  assert.equal(rested.state.turn, 'enemy');
  assert.deepEqual(rested.events.map((event) => event.type), ['recover', 'ap']);
  const phase = resolveEnemyPhase(rested.state, fixed(0.99));
  assert.ok(phase.events.some((event) => event.type === 'damage' && event.target === 'hero'), 'enemies act during recovery');
  assert.equal(phase.state.turn, 'player');
  assert.equal(phase.state.ap, BALANCE.recoveryAp);
  assert.equal(recover(phase.state).events[0].reason, 'not-exhausted', 'recovered AP must be spent before recovering again');

  // A zero-AP battle always ends: recovery never soft-locks, even against the toughest foe.
  for (const heroId of Object.keys(HEROES)) {
    let state = createBattle({ heroId, encounterId: 'giant-golem', ap: 0, level: 4, rng: fixed(0.99) });
    let maxSeen = 0;
    for (let turn = 0; turn < 200 && state.turn === 'player'; turn += 1) {
      const step = mustRecover(state) ? recover(state) : useSkill(state, HEROES[heroId].skills[0]);
      assert.notEqual(step.events[0].type, 'rejected');
      maxSeen = Math.max(maxSeen, step.state.ap);
      state = step.state.turn === 'enemy' ? resolveEnemyPhase(step.state, fixed(0.99)).state : step.state;
    }
    assert.ok(['won', 'lost'].includes(state.turn), `${heroId} battle ended`);
    assert.ok(maxSeen <= BALANCE.recoveryAp + BALANCE.defenseAp, `${heroId} never banked AP by recovering (${maxSeen})`);
  }
});

test('tactical AP: Guard/Barrier vs a big attack refund 1, Mage Bolt exploits, Dodge avoids instead; all capped', () => {
  for (const [heroId, defense] of [['fighter', 'guard'], ['mage', 'barrier']]) {
    const state = heavyOn(createBattle({ heroId, encounterId: 'golem', ap: 1, level: 3, rng: fixed(0.99) }));
    const phase = resolveEnemyPhase(useSkill(state, defense).state, fixed(0.99));
    assert.equal(phase.state.ap, 1, `${heroId} ${defense} is AP-neutral against a big attack`);
    assert.equal(apGains(phase.events, 'defense'), BALANCE.defenseAp);
  }
  const quiet = createBattle({ heroId: 'fighter', encounterId: 'golem', ap: 1, rng: fixed(0.99) });
  assert.equal(apGains(resolveEnemyPhase(useSkill(quiet, 'guard').state, fixed(0.99)).events), 0, 'no refund without a big attack');

  const ninja = heavyOn(createBattle({ heroId: 'ninja', encounterId: 'golem', ap: 1, level: 3, rng: fixed(0.99) }));
  const dodged = resolveEnemyPhase(useSkill(ninja, 'dodge').state, fixed(0.99));
  assert.equal(dodged.state.hero.hp, ninja.hero.hp);
  assert.equal(dodged.state.hero.counter, true);
  assert.equal(dodged.state.ap, 0);

  for (const status of ['charging', 'tired']) {
    let state = createBattle({ heroId: 'mage', encounterId: 'golem', ap: 1, rng: fixed(0.99) });
    state = patchEnemy(state, state.enemies[0].uid, { [status]: true });
    const result = useSkill(state, 'magicBolt');
    assert.equal(result.state.ap, 1, status);
    assert.equal(apGains(result.events, 'exploit'), BALANCE.exploitAp);
  }
  assert.equal(useSkill(createBattle({ heroId: 'mage', encounterId: 'golem', ap: 1 }), 'magicBolt').state.ap, 0);

  const full = heavyOn(createBattle({ heroId: 'fighter', encounterId: 'golem', ap: 10, rng: fixed(0.99) }));
  const capped = resolveEnemyPhase({ ...useSkill(full, 'guard').state, ap: BALANCE.maxAp }, fixed(0.99));
  assert.equal(capped.state.ap, BALANCE.maxAp);
  assert.equal(apGains(capped.events), 0);
});

test('Mage AP recovery stays bounded by enemy-created opportunities', () => {
  let state = createBattle({ heroId: 'mage', encounterId: 'giant-golem', ap: 1, level: 4, rng: fixed(0.99) });
  let gained = 0;
  let opportunities = 0;
  for (let turn = 0; turn < 40 && state.turn === 'player'; turn += 1) {
    const enemy = state.enemies.find((candidate) => candidate.hp > 0);
    state = { ...patchEnemy(state, enemy.uid, { hp: enemy.maxHp }), hero: { ...state.hero, hp: state.hero.maxHp } };
    if (enemy.intent === 'heavy' || enemy.charging || enemy.tired) opportunities += 1;
    let step;
    if (mustRecover(state)) step = recover(state);
    else step = useSkill(state, enemy.intent === 'heavy' ? 'barrier' : 'magicBolt', enemy.uid);
    gained += apGains(step.events.filter((event) => event.reason !== 'recover'));
    const phase = resolveEnemyPhase(step.state, fixed(0.99));
    gained += apGains(phase.events);
    state = phase.state;
  }
  assert.ok(gained > 0);
  assert.ok(gained <= opportunities, `${gained} AP from ${opportunities} enemy-created opportunities`);
});

test('Fighter combo, Cleave, Break and Guard counter', () => {
  let state = createBattle({ heroId: 'fighter', encounterId: 'golem', ap: 5, level: 3, rng: fixed(0.99) });
  const slash = useSkill(state, 'slash');
  assert.equal(slash.state.hero.combo, true);
  state = resolveEnemyPhase(slash.state, fixed(0.99)).state;
  const power = useSkill(state, 'powerSlash');
  assert.equal(damageTo(power.events, state.enemies[0].uid), SKILLS.powerSlash.damage + BALANCE.comboBonus);
  assert.equal(power.state.hero.combo, false);

  const group = createBattle({ heroId: 'fighter', encounterId: 'goblin-slime', ap: 3, level: 3 });
  assert.deepEqual(useSkill(group, 'cleave').state.enemies.map((enemy) => enemy.hp),
    group.enemies.map((enemy) => Math.max(0, enemy.hp - SKILLS.cleave.damage)));

  const charging = heavyOn(createBattle({ heroId: 'fighter', encounterId: 'golem', ap: 2, level: 3, rng: fixed(0.99) }));
  const broken = useSkill(charging, 'powerSlash');
  assert.equal(broken.state.enemies[0].intent, 'rest');
  assert.ok(broken.events.some((event) => event.type === 'break'));
  assert.equal(resolveEnemyPhase(broken.state, fixed(0.99)).state.hero.hp, charging.hero.hp);

  const guarded = resolveEnemyPhase(useSkill(heavyOn(createBattle({ heroId: 'fighter', encounterId: 'golem', ap: 2, rng: fixed(0.99) })), 'guard').state, fixed(0.99));
  assert.equal(guarded.state.hero.counter, true);
  const counter = useSkill(guarded.state, 'slash');
  assert.equal(damageTo(counter.events, 1), SKILLS.slash.damage + BALANCE.counterBonus);
});

test('Mage Barrier, low-HP Heal barrier, level-4 Great Heal and Fireball', () => {
  const state = heavyOn(createBattle({ heroId: 'mage', encounterId: 'golem', ap: 1, rng: fixed(0.99) }));
  const barrier = resolveEnemyPhase(useSkill(state, 'barrier').state, fixed(0.99));
  assert.equal(state.hero.hp - barrier.state.hero.hp, Math.ceil(ENEMIES.golem.heavy * BALANCE.barrierMultiplier));

  const low = useSkill(createBattle({ heroId: 'mage', encounterId: 'slime', ap: 2, level: 2, heroHp: 5 }), 'heal');
  assert.equal(low.state.hero.hp, 5 + SKILLS.heal.amount);
  assert.equal(low.state.hero.defense, 'barrier');
  const great = useSkill(createBattle({ heroId: 'mage', encounterId: 'slime', ap: 2, level: 4, heroHp: 5 }), 'heal');
  assert.equal(great.state.hero.hp, 5 + SKILLS.heal.amount + HEROES.mage.passive.effect.healBonus);

  const group = createBattle({ heroId: 'mage', encounterId: 'goblin-slime', ap: 3, level: 3 });
  assert.deepEqual(useSkill(group, 'fireball').state.enemies.map((enemy) => enemy.hp),
    group.enemies.map((enemy) => Math.max(0, enemy.hp - SKILLS.fireball.damage)));
});

test('Ninja Opening, Double Strike, Keen Eye and chaining Shadow Strike', () => {
  let state = createBattle({ heroId: 'ninja', encounterId: 'golem', ap: 3, level: 2, rng: fixed(0.99) });
  state = patchEnemy(state, 1, { guarding: true });
  const strike = useSkill(state, 'strike');
  assert.equal(strike.state.hero.openingUid, 1);

  const opened = { ...createBattle({ heroId: 'ninja', encounterId: 'golem', ap: 2, level: 2 }), hero: { ...state.hero, openingUid: 1 } };
  assert.equal(damageTo(useSkill(opened, 'doubleStrike').events, 1), 2 * (SKILLS.doubleStrike.damage + BALANCE.openingBonus));
  const keen = { ...createBattle({ heroId: 'ninja', encounterId: 'golem', ap: 2, level: 4 }), hero: { ...state.hero, openingUid: 1 } };
  assert.equal(damageTo(useSkill(keen, 'doubleStrike').events, 1), 2 * (SKILLS.doubleStrike.damage + BALANCE.openingBonus + HEROES.ninja.passive.effect.openingBonus));

  const trio = createBattle({ heroId: 'ninja', encounterId: 'necromancer-skeletons', ap: 3, level: 3 });
  const chained = useSkill(trio, 'shadowStrike', trio.enemies[1].uid);
  const chains = chained.events.filter((event) => event.type === 'chain');
  assert.ok(chains.length >= 2, 'a kill that kills again keeps streaking');
  assert.ok(chains.length <= BALANCE.maxChain);
  assert.equal(chained.state.enemies[2].hp, 0);
  assert.ok(chains.every((event) => event.from !== undefined));

  const boss = createBattle({ heroId: 'ninja', encounterId: 'golem', ap: 3, level: 3 });
  const single = useSkill(boss, 'shadowStrike');
  assert.equal(single.state.enemies[0].hp, ENEMIES.golem.maxHp - SKILLS.shadowStrike.damage);
  assert.ok(!single.events.some((event) => event.type === 'chain'));
});

test('skillBonus is exactly the extra damage COMBO, COUNTER and OPENING add', () => {
  const calm = (state) => ({ ...state, enemies: state.enemies.map((enemy) => ({ ...enemy, guarding: false, tired: false })) });
  const withHero = (state, hero) => ({ ...state, hero: { ...state.hero, ...hero } });
  const extra = (state, skillId, target = state.selectedUid) => {
    const plain = withHero(state, { combo: false, counter: false, openingUid: null });
    return damageTo(useSkill(state, skillId, target).events, target) - damageTo(useSkill(plain, skillId, target).events, target);
  };
  const fighter = calm(createBattle({ heroId: 'fighter', encounterId: 'golem', ap: 5, level: 3, rng: fixed(0.99) }));
  const ninja = calm(createBattle({ heroId: 'ninja', encounterId: 'captain-goblins', ap: 5, level: 3, rng: fixed(0.99) }));
  const keen = calm(createBattle({ heroId: 'ninja', encounterId: 'golem', ap: 5, level: 4, rng: fixed(0.99) }));
  const cases = [
    [withHero(fighter, { combo: true }), ['slash', 'powerSlash', 'cleave']],
    [withHero(fighter, { counter: true }), ['slash', 'powerSlash', 'cleave']],
    [withHero(fighter, { combo: true, counter: true }), ['powerSlash']],
    [withHero(ninja, { openingUid: 1 }), ['strike', 'doubleStrike', 'shadowStrike']],
    [withHero(ninja, { openingUid: 2 }), ['doubleStrike']],   // the OPENING is on another enemy
    [withHero(ninja, { openingUid: 1, counter: true }), ['doubleStrike']],
    [withHero(keen, { openingUid: 1 }), ['doubleStrike']],
  ];
  for (const [state, skills] of cases) {
    for (const skillId of skills) assert.equal(skillBonus(state, skillId), extra(state, skillId), `${state.heroId} ${skillId} ${JSON.stringify(state.hero)}`);
  }
  assert.equal(skillBonus(withHero(fighter, { combo: true }), 'powerSlash'), BALANCE.comboBonus);
  assert.equal(skillBonus(withHero(keen, { openingUid: 1 }), 'doubleStrike'), 2 * (BALANCE.openingBonus + HEROES.ninja.passive.effect.openingBonus));
  assert.equal(skillBonus(withHero(fighter, { counter: true }), 'guard'), 0);
});

test('Fighter level-4 Iron Guard reduces guarded damage', () => {
  const plain = heavyOn(createBattle({ heroId: 'fighter', encounterId: 'golem', ap: 1, level: 3, rng: fixed(0.99) }));
  const iron = heavyOn(createBattle({ heroId: 'fighter', encounterId: 'golem', ap: 1, level: 4, rng: fixed(0.99) }));
  const taken = (state) => state.hero.hp - resolveEnemyPhase(useSkill(state, 'guard').state, fixed(0.99)).state.hero.hp;
  assert.equal(taken(plain), Math.ceil(ENEMIES.golem.heavy * BALANCE.guardMultiplier));
  assert.equal(taken(iron), Math.ceil(ENEMIES.golem.heavy * HEROES.fighter.passive.effect.guardMultiplier));
});

test('boss phase 2 triggers once and deterministically changes cadence', () => {
  let state = createBattle({ heroId: 'fighter', encounterId: 'dragon', ap: 6, level: 4, rng: fixed(0.99) });
  state = patchEnemy(state, 1, { hp: Math.floor(ENEMIES.dragon.maxHp * 0.6) + 5 });
  const enraged = useSkill(state, 'powerSlash', 1);
  assert.equal(enraged.state.enemies[0].phase, 2);
  assert.equal(enraged.events.filter((event) => event.type === 'enrage').length, 1);
  const next = resolveEnemyPhase(enraged.state, fixed(0.99)).state;
  assert.equal(useSkill(next, 'slash', 1).events.filter((event) => event.type === 'enrage').length, 0);

  const baseEnemy = { ...state.enemies[0], hp: state.enemies[0].maxHp, intent: 'attack', cadence: 1 };
  assert.equal(chooseEnemyIntent(state, { ...baseEnemy, phase: 1 }, fixed(0.99)), 'attack');
  assert.equal(chooseEnemyIntent(state, { ...baseEnemy, phase: 2 }, fixed(0.99)), 'charge');
});

test('dead enemies never act, summons give no XP, and a heal intent fizzles instead of attacking', () => {
  let state = battle({ encounterId: 'goblin-slime', ap: 1 });
  const [goblin, slime] = state.enemies;
  state = patchEnemy(state, goblin.uid, { hp: 0, intent: null });
  const phase = resolveEnemyPhase(useSkill(state, 'guard').state, fixed(0.99));
  assert.ok(!phase.events.some((event) => event.source === goblin.uid));
  assert.ok(phase.events.some((event) => event.type === 'attack' && event.source === slime.uid));

  state = battle({ encounterId: 'shield-goblin-healer', ap: 1 });
  const healer = state.enemies.find((enemy) => enemy.id === 'healer');
  state = { ...state, enemies: state.enemies.map((enemy) => ({ ...enemy, intent: enemy.id === 'healer' ? 'heal' : 'guard' })) };
  const fizzle = resolveEnemyPhase(useSkill(state, 'guard').state, fixed(0.99));
  assert.equal(fizzle.state.hero.hp, state.hero.hp);
  assert.ok(fizzle.events.some((event) => event.type === 'heal' && event.source === healer.uid && event.amount === 0));

  let necro = createBattle({ heroId: 'fighter', encounterId: 'necromancer-skeletons', ap: 1, level: 3, rng: fixed(0.99) });
  necro = { ...necro, enemies: necro.enemies.map((enemy) => ({ ...enemy, hp: enemy.id === 'skeleton' ? 0 : enemy.hp, intent: enemy.id === 'skeleton' ? null : 'summon' })) };
  const summoned = resolveEnemyPhase(useSkill(necro, 'guard').state, fixed(0.99));
  const added = summoned.state.enemies.find((enemy) => enemy.summoned);
  assert.ok(added, 'necromancer summoned');
  const allDead = { ...summoned.state, enemies: summoned.state.enemies.map((enemy) => ({ ...enemy, hp: 0 })) };
  assert.equal(battleXp(allDead), ENEMIES.necromancer.xp + 2 * ENEMIES.skeleton.xp);
});

test('Potion: costs AP, uses one, heals ~35%, caps at max HP, and is disabled at zero or full HP', () => {
  const state = createBattle({ heroId: 'ninja', encounterId: 'slime', ap: 2, level: 3, heroHp: 4, potions: 2 });
  const [item] = availableItems(state);
  assert.deepEqual({ id: item.id, count: item.count, usable: item.usable, cost: item.cost }, { id: 'potion', count: 2, usable: true, cost: ITEMS.potion.cost });
  assert.equal(potionHeal(state), Math.ceil(state.hero.maxHp * ITEMS.potion.healPercent));
  const drink = useItem(state, 'potion');
  assert.equal(drink.state.hero.hp, 4 + potionHeal(state));
  assert.equal(drink.state.potions, 1);
  assert.equal(drink.state.ap, 2 - ITEMS.potion.cost);
  assert.equal(drink.state.turn, 'enemy');
  assert.deepEqual(drink.events.map((event) => event.type), ['item', 'heal']);

  const nearly = useItem({ ...state, hero: { ...state.hero, hp: state.hero.maxHp - 2 } }, 'potion');
  assert.equal(nearly.state.hero.hp, state.hero.maxHp);
  assert.equal(useItem({ ...state, potions: 0 }, 'potion').events[0].reason, 'no-items');
  assert.equal(availableItems({ ...state, potions: 0 })[0].usable, false);
  assert.equal(useItem({ ...state, hero: { ...state.hero, hp: state.hero.maxHp } }, 'potion').events[0].reason, 'full-hp');
  assert.equal(useItem({ ...state, ap: 0 }, 'potion').events[0].reason, 'unaffordable');
});

test('victory and defeat are detected; XP counts only defeated enemies', () => {
  const won = useSkill(battle({ ap: 2, level: 2 }), 'powerSlash');
  assert.ok(isVictory(won.state));
  assert.equal(battleXp(won.state), ENEMIES.slime.xp);
  const fallback = useSkill(battle({ encounterId: 'goblin-slime' }), 'slash', 999);
  assert.equal(fallback.state.enemies[0].hp, ENEMIES.goblin.maxHp - SKILLS.slash.damage);
  const lostStart = patchEnemy(battle({ heroHp: 1 }), 1, { intent: 'attack' });
  assert.ok(isDefeat(resolveEnemyPhase(useSkill(lostStart, 'slash').state, fixed(0.99)).state));
  assert.equal(battleXp(battle()), 0);
  assert.ok(Object.values(ENCOUNTERS).every((encounter) => encounter.enemyIds.every((id) => ENEMIES[id].xp > 0)));
});
