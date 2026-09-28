import { BALANCE, ENCOUNTERS, ENEMIES, HEROES, ITEMS, LEVELS, SKILLS } from './battle-data.js';

const living = (enemy) => enemy.hp > 0;
const clampAp = (ap) => Math.max(0, Math.min(BALANCE.maxAp, ap));
const cloneState = (state, changes = {}) => ({
  ...state,
  ...changes,
  hero: changes.hero || { ...state.hero },
  enemies: changes.enemies || state.enemies.map((enemy) => ({ ...enemy })),
});
const damageAmount = (amount, target) => Math.ceil(amount * (target.guarding ? BALANCE.enemyGuardMultiplier : 1) * (target.tired ? BALANCE.tiredMultiplier : 1));
const firstLiving = (enemies) => enemies.find(living);
const rejected = (state, reason) => ({ state, events: [{ type: 'rejected', reason }] });

/* ------------------------------------------------------------ progression */

/** Level row (1-based); out-of-range levels clamp to the table. */
export function levelData(level = 1) {
  return LEVELS[Math.max(1, Math.min(LEVELS.length, Math.floor(level) || 1)) - 1];
}
export function levelForXp(xp) {
  return LEVELS.reduce((best, row) => (xp >= row.xp ? row.level : best), 1);
}
export function heroMaxHp(heroId, level = 1) {
  return HEROES[heroId].maxHp + levelData(level).maxHpBonus;
}
export function skillTierForLevel(level = 1) {
  return levelData(level).skillTier;
}
/** The hero's class passive once its level is reached, else null. */
export function heroPassive(heroId, level = 1) {
  const passive = HEROES[heroId]?.passive;
  return passive && level >= passive.level ? passive : null;
}
const passiveEffect = (state) => heroPassive(state.heroId, state.level)?.effect ?? {};

/* ---------------------------------------------------------------- enemies */

function enemyState(id, uid, summoned = false) {
  const enemy = ENEMIES[id];
  if (!enemy) throw new Error(`Unknown enemy: ${id}`);
  return {
    uid, id, hp: enemy.maxHp, maxHp: enemy.maxHp, phase: 1, intent: null, cadence: 0,
    guarding: false, tired: false, charging: false, summoned,
  };
}

function effectiveAi(enemy) {
  const base = ENEMIES[enemy.id].ai || {};
  return enemy.phase === 2 ? { ...base, ...base.phase2 } : base;
}

function canSummon(state, enemy, ai) {
  const data = ENEMIES[enemy.id];
  if (!data.summonId || state.enemies.filter(living).length >= BALANCE.maxLivingEnemies) return false;
  const maxSummons = ai.maxSummons ?? 1;
  return state.enemies.filter((candidate) => living(candidate) && candidate.id === data.summonId).length < maxSummons;
}

function chooseNormalIntent(state, enemy, ai, rng) {
  const data = ENEMIES[enemy.id];
  const alive = state.enemies.filter(living);
  if (ai.support === 'summon' && canSummon(state, enemy, ai)) return 'summon';
  if (ai.support === 'heal' && alive.length > 1 && alive.some((candidate) => candidate.hp < candidate.maxHp)) return 'heal';
  if (ai.support === 'summon' && data.heal && alive.length > 1 && alive.some((candidate) => candidate.hp < candidate.maxHp)) return 'heal';
  if (ai.normal) return ai.normal;
  if (ai.drainChance && rng() < ai.drainChance) return 'drain';
  if (ai.guardChance && rng() < ai.guardChance) return 'guard';
  return 'attack';
}

export function chooseEnemyIntent(state, enemy, rng = Math.random) {
  if (!enemy || !living(enemy)) return null;
  const ai = effectiveAi(enemy);
  if (enemy.intent === 'charge' || enemy.charging) return 'heavy';
  if (enemy.intent === 'heavy') return ai.rests ? 'rest' : chooseNormalIntent(state, enemy, ai, rng);
  if (enemy.intent === 'rest') return chooseNormalIntent(state, enemy, ai, rng);
  if (ai.heavyEvery && enemy.cadence >= ai.heavyEvery) return 'charge';
  return chooseNormalIntent(state, enemy, ai, rng);
}

export function getEnemyIntent(state, uid) {
  const enemy = state.enemies.find((candidate) => candidate.uid === uid && living(candidate));
  return enemy?.intent ?? null;
}

function selectedAfter(enemies, priorUid) {
  const alive = enemies.filter(living);
  if (!alive.length) return null;
  const prior = enemies.findIndex((enemy) => enemy.uid === priorUid);
  if (prior >= 0 && living(enemies[prior])) return priorUid;
  for (let offset = 1; offset <= enemies.length; offset += 1) {
    const candidate = enemies[(Math.max(prior, 0) + offset) % enemies.length];
    if (living(candidate)) return candidate.uid;
  }
  return alive[0].uid;
}

function finish(state, events) {
  if (state.enemies.every((enemy) => !living(enemy))) {
    return { state: { ...state, turn: 'won', selectedUid: null }, events: [...events, { type: 'victory' }] };
  }
  if (state.hero.hp <= 0) return { state: { ...state, turn: 'lost' }, events: [...events, { type: 'lost' }] };
  return { state, events };
}

/** Add AP (capped) and record it; returns the new state. */
function gainAp(state, amount, reason, events) {
  const gained = clampAp(state.ap + amount) - state.ap;
  if (gained <= 0) return state;
  const ap = state.ap + gained;
  events.push({ type: 'ap', amount: gained, reason, ap });
  return { ...state, ap };
}

function damageEnemy(state, uid, amount, events) {
  let hero = state.hero;
  const enemies = state.enemies.map((enemy) => {
    if (enemy.uid !== uid || !living(enemy)) return enemy;
    const damage = damageAmount(amount, enemy);
    const hp = Math.max(0, enemy.hp - damage);
    let nextEnemy = { ...enemy, hp };
    events.push({ type: 'damage', target: uid, amount: damage });
    if (hp === 0) {
      events.push({ type: 'defeat', target: uid });
      if (hero.openingUid === uid) hero = { ...hero, openingUid: null };
    }
    const phase2 = ENEMIES[enemy.id].ai?.phase2;
    if (enemy.phase === 1 && phase2 && hp > 0 && hp <= enemy.maxHp * phase2.at) {
      nextEnemy = { ...nextEnemy, phase: 2 };
      events.push({ type: 'enrage', target: uid, message: phase2.message });
    }
    return nextEnemy;
  });
  return { ...state, hero, enemies };
}

/* ----------------------------------------------------------------- battle */

/**
 * ap: starting Action Points (clamped to 0..BALANCE.maxAp).
 * level drives max HP, the skill tier and the class passive; skillTier overrides the tier (debug).
 * heroHp defaults to full; potions defaults to 0.
 */
export function createBattle({ heroId, encounterId, ap = 0, level = 1, skillTier, heroHp, potions = 0, rng = Math.random }) {
  const heroData = HEROES[heroId];
  const encounter = ENCOUNTERS[encounterId];
  if (!heroData) throw new Error(`Unknown hero: ${heroId}`);
  if (!encounter) throw new Error(`Unknown encounter: ${encounterId}`);
  const safeLevel = levelData(level).level;
  const enemies = encounter.enemyIds.map((id, index) => enemyState(id, index + 1));
  const maxHp = heroMaxHp(heroId, safeLevel);
  let state = {
    heroId, encounterId, level: safeLevel, skillTier: skillTier ?? skillTierForLevel(safeLevel),
    ap: clampAp(Math.floor(ap) || 0), potions: Math.max(0, Math.floor(potions) || 0), turn: 'player', round: 1,
    hero: {
      hp: Math.max(0, Math.min(heroHp ?? maxHp, maxHp)), maxHp, defense: null,
      combo: false, counter: false, openingUid: null, exhausted: false,
    },
    enemies, selectedUid: enemies[0]?.uid ?? null, nextUid: enemies.length + 1,
  };
  state = { ...state, enemies: state.enemies.map((enemy) => ({ ...enemy, intent: chooseEnemyIntent(state, enemy, rng) })) };
  return state;
}

export function availableSkills(state) {
  return HEROES[state.heroId].skills
    .map((id) => SKILLS[id])
    .filter((skill) => skill.tier <= state.skillTier)
    .map(({ id, name, jaName, cost, kind, target }) => ({ id, name, jaName, cost, kind, target, affordable: state.ap >= cost }));
}

export function potionHeal(state) {
  return Math.ceil(state.hero.maxHp * ITEMS.potion.healPercent);
}

function itemBlocker(state, item) {
  if (state.potions <= 0) return 'no-items';
  if (state.ap < item.cost) return 'unaffordable';
  if (state.hero.hp >= state.hero.maxHp) return 'full-hp';
  return null;
}

/** The hero's items with counts and whether each can be used right now. */
export function availableItems(state) {
  return Object.values(ITEMS).map(({ id, name, jaName, cost }) => {
    const reason = itemBlocker(state, ITEMS[id]);
    return { id, name, jaName, cost, count: state.potions, heal: potionHeal(state), usable: !reason, reason };
  });
}

/** True when the player's turn has no affordable action: the turn becomes a recovery. */
export function mustRecover(state) {
  return state.turn === 'player'
    && !availableSkills(state).some((skill) => skill.affordable)
    && !availableItems(state).some((item) => item.usable);
}

export function isVictory(state) { return state.enemies.every((enemy) => !living(enemy)); }
export function isDefeat(state) { return state.hero.hp <= 0; }

/** XP for a battle: every non-summoned enemy that has been defeated. */
export function battleXp(state) {
  return state.enemies.filter((enemy) => !living(enemy) && !enemy.summoned).reduce((sum, enemy) => sum + (ENEMIES[enemy.id].xp ?? 0), 0);
}

export function selectTarget(state, uid) {
  return state.enemies.some((enemy) => enemy.uid === uid && living(enemy)) ? { ...state, selectedUid: uid } : state;
}

export function cycleTarget(state, direction) {
  const alive = state.enemies.filter(living);
  if (!alive.length) return { ...state, selectedUid: null };
  const index = alive.findIndex((enemy) => enemy.uid === state.selectedUid);
  const next = (Math.max(index, 0) + (direction >= 0 ? 1 : -1) + alive.length) % alive.length;
  return { ...state, selectedUid: alive[next].uid };
}

export function useSkill(state, skillId, targetUid = state.selectedUid) {
  if (state.turn !== 'player') return rejected(state, 'not-player-turn');
  const skill = SKILLS[skillId];
  if (!skill || !HEROES[state.heroId].skills.includes(skillId)) return rejected(state, 'unknown-skill');
  if (skill.tier > state.skillTier) return rejected(state, 'locked');
  if (state.ap < skill.cost) return rejected(state, 'unaffordable');

  const passive = passiveEffect(state);
  let next = cloneState(state, { ap: state.ap - skill.cost });
  const events = [{ type: 'attack', skillId, target: skill.target === 'self' ? 'hero' : targetUid }];
  const target = next.enemies.some((enemy) => enemy.uid === targetUid && living(enemy)) ? targetUid : firstLiving(next.enemies)?.uid;
  const targetBefore = next.enemies.find((enemy) => enemy.uid === target);
  const damaging = ['damage', 'doubleDamage', 'splitDamage'].includes(skill.kind);
  const counter = damaging && next.hero.counter;
  const combo = skillId === 'powerSlash' && next.hero.combo;
  const opening = damaging && next.hero.openingUid === target;
  const openingBonus = BALANCE.openingBonus + (passive.openingBonus ?? 0);

  if (state.heroId === 'fighter' && skillId !== 'slash') next.hero = { ...next.hero, combo: false };
  if (counter) {
    next.hero = { ...next.hero, counter: false };
    events.push({ type: 'counter', target });
  }
  if (state.heroId === 'ninja' && damaging) next.hero = { ...next.hero, openingUid: null };

  if (skill.kind === 'defense') {
    next.hero = { ...next.hero, defense: skill.defense };
    events.push({ type: 'defend', defense: skill.defense });
  } else if (skill.kind === 'heal') {
    const barrier = state.heroId === 'mage' && next.hero.hp < next.hero.maxHp / 2;
    const amount = Math.min(skill.amount + (passive.healBonus ?? 0), next.hero.maxHp - next.hero.hp);
    next.hero = { ...next.hero, hp: next.hero.hp + amount, defense: barrier ? 'barrier' : next.hero.defense };
    events.push({ type: 'heal', target: 'hero', amount });
    if (barrier) events.push({ type: 'barrierUp', defense: 'barrier' });
  } else if (damaging) {
    if (skillId === 'slash') {
      next.hero = { ...next.hero, combo: true };
      events.push({ type: 'comboReady' });
    }
    if (combo) events.push({ type: 'combo', target });
    if (skill.kind === 'damage') {
      const targets = skill.target === 'all' ? next.enemies.filter(living).map((enemy) => enemy.uid) : [target];
      for (const uid of targets) {
        let amount = skill.damage;
        if (uid === target && counter) amount += BALANCE.counterBonus;
        if (uid === target && combo) amount += BALANCE.comboBonus;
        next = damageEnemy(next, uid, amount, events);
      }
    } else if (skill.kind === 'doubleDamage') {
      if (opening) events.push({ type: 'opening-hit', target });
      next = damageEnemy(next, target, skill.damage + (opening ? openingBonus : 0) + (counter ? BALANCE.counterBonus : 0), events);
      next = damageEnemy(next, target, skill.damage + (opening ? openingBonus : 0), events);
    } else if (skill.kind === 'splitDamage') {
      // Each defeat streaks on to the weakest remaining enemy, up to maxChain times.
      next = damageEnemy(next, target, skill.damage + (counter ? BALANCE.counterBonus : 0), events);
      let last = target;
      for (let chain = 0; chain < BALANCE.maxChain; chain += 1) {
        if (next.enemies.find((enemy) => enemy.uid === last)?.hp !== 0) break;
        const other = next.enemies.filter(living).sort((a, b) => a.hp - b.hp || a.uid - b.uid)[0];
        if (!other) break;
        events.push({ type: 'chain', target: other.uid, from: last });
        next = damageEnemy(next, other.uid, skill.splashDamage, events);
        last = other.uid;
      }
    }

    if (skillId === 'powerSlash' && targetBefore?.intent === 'heavy') {
      next.enemies = next.enemies.map((enemy) => enemy.uid === target ? { ...enemy, intent: 'rest', charging: false, cadence: 0 } : enemy);
      events.push({ type: 'break', target });
    }
    if (skillId === 'magicBolt' && (targetBefore?.charging || targetBefore?.tired)) {
      next = gainAp(next, BALANCE.exploitAp, 'exploit', events);
    }
    if (skillId === 'strike' && targetBefore && (targetBefore.charging || targetBefore.guarding || targetBefore.tired || ['heal', 'summon'].includes(targetBefore.intent))) {
      if (next.enemies.some((enemy) => enemy.uid === target && living(enemy))) {
        next.hero = { ...next.hero, openingUid: target };
        events.push({ type: 'opening', target });
      }
    }
  }

  next.selectedUid = selectedAfter(next.enemies, state.selectedUid);
  const outcome = finish(next, events);
  return outcome.state.turn === 'won' ? outcome : { state: { ...outcome.state, turn: 'enemy' }, events: outcome.events };
}

/** Use an item (Potion). Costs AP and ends the turn like a skill. */
export function useItem(state, itemId = 'potion') {
  if (state.turn !== 'player') return rejected(state, 'not-player-turn');
  const item = ITEMS[itemId];
  if (!item) return rejected(state, 'unknown-item');
  const blocker = itemBlocker(state, item);
  if (blocker) return rejected(state, blocker);
  const amount = Math.min(potionHeal(state), state.hero.maxHp - state.hero.hp);
  const hero = { ...state.hero, hp: state.hero.hp + amount, combo: state.heroId === 'fighter' ? false : state.hero.combo };
  const next = cloneState(state, { ap: state.ap - item.cost, potions: state.potions - 1, hero, turn: 'enemy' });
  return { state: next, events: [{ type: 'item', itemId, target: 'hero' }, { type: 'heal', target: 'hero', amount }] };
}

/**
 * An exhausted turn: with no affordable action the hero recovers AP instead of
 * acting, and the enemies still take their phase against a tired hero (the
 * same x1.5 damage a resting enemy takes). Waiting can never create AP because
 * this is rejected whenever any action is affordable.
 */
export function recover(state) {
  if (!mustRecover(state)) return rejected(state, 'not-exhausted');
  const events = [{ type: 'recover', amount: BALANCE.recoveryAp }];
  const next = gainAp(cloneState(state), BALANCE.recoveryAp, 'recover', events);
  return { state: { ...next, hero: { ...next.hero, exhausted: true }, turn: 'enemy' }, events };
}

export function resolveEnemyPhase(state, rng = Math.random) {
  if (state.turn !== 'enemy') return rejected(state, 'not-enemy-turn');
  const passive = passiveEffect(state);
  let next = cloneState(state);
  let dodgedNormal = false;
  let refunded = false;
  const events = [];

  const defendedDamage = (amount, action) => {
    if (next.hero.exhausted) return Math.ceil(amount * BALANCE.exhaustedMultiplier);
    if (next.hero.defense === 'dodge') {
      if (action === 'heavy') return 0;
      const result = dodgedNormal ? Math.ceil(amount * BALANCE.dodgeRestMultiplier) : 0;
      dodgedNormal = true;
      return result;
    }
    if (next.hero.defense === 'guard') return Math.ceil(amount * (passive.guardMultiplier ?? BALANCE.guardMultiplier));
    if (next.hero.defense === 'barrier') return Math.ceil(amount * BALANCE.barrierMultiplier);
    return amount;
  };

  // Only enemies present when the phase starts act; a summon waits until the next phase.
  for (const uid of state.enemies.map((enemy) => enemy.uid)) {
    if (next.hero.hp <= 0) break;
    const current = next.enemies.find((enemy) => enemy.uid === uid);
    if (!current || !living(current)) continue;
    const data = ENEMIES[current.id];
    const action = current.intent;
    let enemy = { ...current, guarding: false, tired: false, charging: false };

    if (['attack', 'heavy', 'drain'].includes(action)) {
      if (action === 'heavy') enemy.cadence = 0;
      else enemy.cadence += 1;
      const amount = defendedDamage(action === 'heavy' ? data.heavy : data.attack, action);
      events.push({ type: 'attack', source: enemy.uid, action });
      next.hero = { ...next.hero, hp: Math.max(0, next.hero.hp - amount) };
      events.push({ type: 'damage', target: 'hero', source: enemy.uid, amount });
      if (action === 'drain') {
        const healed = Math.min(amount, data.drainHeal ?? amount, enemy.maxHp - enemy.hp);
        enemy.hp += healed;
        events.push({ type: 'heal', target: enemy.uid, amount: healed });
      }
    } else if (action === 'guard') {
      enemy.guarding = true;
      enemy.cadence += 1;
      events.push({ type: 'guard', target: enemy.uid });
    } else if (action === 'charge') {
      enemy.charging = true;
      events.push({ type: 'charge', target: enemy.uid, heavyName: data.heavyName });
    } else if (action === 'rest') {
      enemy.tired = true;
      events.push({ type: 'rest', target: enemy.uid });
    } else if (action === 'heal') {
      const hurt = next.enemies.filter((candidate) => living(candidate) && candidate.hp < candidate.maxHp)
        .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp) || a.uid - b.uid)[0];
      const amount = hurt ? Math.min(data.heal, hurt.maxHp - hurt.hp) : 0;
      if (hurt?.uid === enemy.uid) enemy.hp += amount;
      else if (hurt) next.enemies = next.enemies.map((candidate) => candidate.uid === hurt.uid ? { ...candidate, hp: candidate.hp + amount } : candidate);
      events.push({ type: 'heal', source: enemy.uid, target: hurt?.uid ?? enemy.uid, amount });
    } else if (action === 'summon') {
      const ai = effectiveAi(enemy);
      if (canSummon(next, enemy, ai)) {
        const added = enemyState(data.summonId, next.nextUid, true);
        next.enemies = [...next.enemies, added];
        next.nextUid += 1;
        enemy.cadence += 1;
        events.push({ type: 'summon', source: enemy.uid, target: added.uid, amount: 1 });
      } else events.push({ type: 'summon', source: enemy.uid, target: null, amount: 0 });
    }

    next.enemies = next.enemies.map((candidate) => candidate.uid === enemy.uid ? enemy : candidate);
    if (action === 'heavy' && next.hero.defense && next.hero.hp > 0) {
      if (['guard', 'dodge'].includes(next.hero.defense) && !next.hero.counter) {
        next.hero = { ...next.hero, counter: true };
        events.push({ type: 'counterReady' });
      }
      // Guard and Barrier soak the hit and refund AP; Dodge avoids it completely instead.
      if (!refunded && next.hero.defense !== 'dodge') {
        refunded = true;
        next = gainAp(next, BALANCE.defenseAp, 'defense', events);
      }
    }
  }

  next.hero = { ...next.hero, defense: null, exhausted: false };
  next.enemies = next.enemies.map((enemy) => living(enemy) ? { ...enemy, intent: chooseEnemyIntent(next, enemy, rng) } : { ...enemy, intent: null });

  const outcome = finish(next, events);
  return outcome.state.turn === 'lost' ? outcome : { state: { ...outcome.state, turn: 'player', round: outcome.state.round + 1 }, events: outcome.events };
}

export function chooseEncounter(tier, rng = Math.random) {
  const choices = Object.values(ENCOUNTERS).filter((encounter) => encounter.tier === tier);
  return choices[Math.floor(rng() * choices.length)];
}
