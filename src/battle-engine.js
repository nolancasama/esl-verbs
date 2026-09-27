import { BALANCE, ENCOUNTERS, ENEMIES, HEROES, SKILLS } from './battle-data.js';

const living = (enemy) => enemy.hp > 0;
const cloneState = (state, changes = {}) => ({
  ...state,
  ...changes,
  hero: changes.hero || { ...state.hero },
  enemies: changes.enemies || state.enemies.map((enemy) => ({ ...enemy })),
});
const damageAmount = (amount, target) => Math.ceil(amount * (target.guarding ? BALANCE.enemyGuardMultiplier : 1) * (target.tired ? BALANCE.tiredMultiplier : 1));
const firstLiving = (enemies) => enemies.find(living);

function enemyState(id, uid) {
  const enemy = ENEMIES[id];
  if (!enemy) throw new Error(`Unknown enemy: ${id}`);
  return {
    uid, id, hp: enemy.maxHp, maxHp: enemy.maxHp, phase: 1, intent: null, cadence: 0,
    guarding: false, tired: false, charging: false,
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

export function createBattle({ heroId, encounterId, power, skillTier, heroHp, rng = Math.random }) {
  const heroData = HEROES[heroId];
  const encounter = ENCOUNTERS[encounterId];
  if (!heroData) throw new Error(`Unknown hero: ${heroId}`);
  if (!encounter) throw new Error(`Unknown encounter: ${encounterId}`);
  const enemies = encounter.enemyIds.map((id, index) => enemyState(id, index + 1));
  const maxHp = heroData.maxHp;
  let state = {
    heroId, encounterId, skillTier, power: Math.max(0, power), turn: 'player', round: 1,
    hero: {
      hp: Math.max(0, Math.min(heroHp ?? maxHp, maxHp)), maxHp, defense: null,
      combo: false, counter: false, openingUid: null,
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
    .map(({ id, name, jaName, cost, kind, target }) => ({ id, name, jaName, cost, kind, target, affordable: state.power >= cost }));
}

export function isVictory(state) { return state.enemies.every((enemy) => !living(enemy)); }
export function isDefeat(state) { return state.hero.hp <= 0; }

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
  if (state.turn !== 'player') return { state, events: [{ type: 'rejected', reason: 'not-player-turn' }] };
  const skill = SKILLS[skillId];
  if (!skill || !HEROES[state.heroId].skills.includes(skillId)) return { state, events: [{ type: 'rejected', reason: 'unknown-skill' }] };
  if (skill.tier > state.skillTier) return { state, events: [{ type: 'rejected', reason: 'locked' }] };
  if (state.power < skill.cost) return { state, events: [{ type: 'rejected', reason: 'unaffordable' }] };

  let next = cloneState(state, { power: state.power - skill.cost });
  const events = [{ type: 'attack', skillId, target: skill.target === 'self' ? 'hero' : targetUid }];
  const target = next.enemies.some((enemy) => enemy.uid === targetUid && living(enemy)) ? targetUid : firstLiving(next.enemies)?.uid;
  const targetBefore = next.enemies.find((enemy) => enemy.uid === target);
  const damaging = ['damage', 'doubleDamage', 'splitDamage'].includes(skill.kind);
  const counter = damaging && next.hero.counter;
  const combo = skillId === 'powerSlash' && next.hero.combo;
  const opening = damaging && next.hero.openingUid === target;

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
    const amount = Math.min(skill.amount, next.hero.maxHp - next.hero.hp);
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
      next = damageEnemy(next, target, skill.damage + (opening ? BALANCE.openingBonus : 0) + (counter ? BALANCE.counterBonus : 0), events);
      next = damageEnemy(next, target, skill.damage + (opening ? BALANCE.openingBonus : 0), events);
    } else if (skill.kind === 'splitDamage') {
      const hpBefore = targetBefore?.hp ?? 0;
      next = damageEnemy(next, target, skill.damage + (counter ? BALANCE.counterBonus : 0), events);
      const primary = next.enemies.find((enemy) => enemy.uid === target);
      if (hpBefore > 0 && primary?.hp === 0) {
        const other = next.enemies.filter((enemy) => living(enemy) && enemy.uid !== target).sort((a, b) => a.hp - b.hp || a.uid - b.uid)[0];
        if (other) {
          events.push({ type: 'chain', target: other.uid });
          next = damageEnemy(next, other.uid, skill.splashDamage, events);
        }
      }
    }

    if (skillId === 'powerSlash' && targetBefore?.intent === 'heavy') {
      next.enemies = next.enemies.map((enemy) => enemy.uid === target ? { ...enemy, intent: 'rest', charging: false, cadence: 0 } : enemy);
      events.push({ type: 'break', target });
    }
    if (skillId === 'magicBolt' && (targetBefore?.charging || targetBefore?.tired)) {
      next = { ...next, power: next.power + 1 };
      events.push({ type: 'power', amount: 1, reason: 'exploit' });
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

export function resolveEnemyPhase(state, rng = Math.random) {
  if (state.turn !== 'enemy') return { state, events: [{ type: 'rejected', reason: 'not-enemy-turn' }] };
  let next = cloneState(state);
  let dodgedNormal = false;
  let heavyResolved = false;
  const events = [];

  const defendedDamage = (amount, action) => {
    if (next.hero.defense === 'dodge') {
      if (action === 'heavy') return 0;
      const result = dodgedNormal ? Math.ceil(amount * BALANCE.dodgeRestMultiplier) : 0;
      dodgedNormal = true;
      return result;
    }
    if (next.hero.defense === 'guard') return Math.ceil(amount * BALANCE.guardMultiplier);
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
      if (action === 'heavy') {
        heavyResolved = true;
        enemy.cadence = 0;
      } else enemy.cadence += 1;
      const amount = defendedDamage(action === 'heavy' ? data.heavy : data.attack, action);
      events.push({ type: 'attack', source: enemy.uid, action });
      next.hero = { ...next.hero, hp: Math.max(0, next.hero.hp - amount) };
      events.push({ type: 'damage', target: 'hero', source: enemy.uid, amount });
      if (action === 'drain') {
        const healed = Math.min(amount, enemy.maxHp - enemy.hp);
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
        const added = enemyState(data.summonId, next.nextUid);
        next.enemies = [...next.enemies, added];
        next.nextUid += 1;
        enemy.cadence += 1;
        events.push({ type: 'summon', source: enemy.uid, target: added.uid, amount: 1 });
      } else events.push({ type: 'summon', source: enemy.uid, target: null, amount: 0 });
    }

    next.enemies = next.enemies.map((candidate) => candidate.uid === enemy.uid ? enemy : candidate);
    if (action === 'heavy' && ['guard', 'dodge'].includes(next.hero.defense) && !next.hero.counter) {
      next.hero = { ...next.hero, counter: true };
      events.push({ type: 'counterReady' });
    }
  }

  if (heavyResolved && state.heroId === 'mage' && next.hero.defense === 'barrier') {
    next.power += 1;
    events.push({ type: 'power', amount: 1, reason: 'barrier' });
  }
  next.hero = { ...next.hero, defense: null };
  next.enemies = next.enemies.map((enemy) => living(enemy) ? { ...enemy, intent: chooseEnemyIntent(next, enemy, rng) } : { ...enemy, intent: null });

  const outcome = finish(next, events);
  return outcome.state.turn === 'lost' ? outcome : { state: { ...outcome.state, turn: 'player', round: outcome.state.round + 1 }, events: outcome.events };
}

export function chooseEncounter(tier, rng = Math.random) {
  const choices = Object.values(ENCOUNTERS).filter((encounter) => encounter.tier === tier);
  return choices[Math.floor(rng() * choices.length)];
}

export function skillTierForStage(stage) {
  return BALANCE.skillTierByStage[stage - 1] ?? 2;
}
