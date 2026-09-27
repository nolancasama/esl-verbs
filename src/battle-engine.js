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
  return { uid, id, hp: enemy.maxHp, maxHp: enemy.maxHp, step: 0, guarding: false, tired: false, charging: false };
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
    const won = { ...state, turn: 'won', selectedUid: null };
    return { state: won, events: [...events, { type: 'victory' }] };
  }
  if (state.hero.hp <= 0) return { state: { ...state, turn: 'lost' }, events: [...events, { type: 'lost' }] };
  return { state, events };
}

export function createBattle({ heroId, encounterId, power, skillTier, heroHp }) {
  const heroData = HEROES[heroId];
  const encounter = ENCOUNTERS[encounterId];
  if (!heroData) throw new Error(`Unknown hero: ${heroId}`);
  if (!encounter) throw new Error(`Unknown encounter: ${encounterId}`);
  const enemies = encounter.enemyIds.map((id, index) => enemyState(id, index + 1));
  const maxHp = heroData.maxHp;
  return {
    heroId, encounterId, skillTier, power: Math.max(0, power), turn: 'player', round: 1,
    hero: { hp: Math.max(0, Math.min(heroHp ?? maxHp, maxHp)), maxHp, defense: null },
    enemies, selectedUid: enemies[0]?.uid ?? null, nextUid: enemies.length + 1,
  };
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

function applyDamage(enemies, uid, amount, events) {
  return enemies.map((enemy) => {
    if (enemy.uid !== uid || !living(enemy)) return enemy;
    const damage = damageAmount(amount, enemy);
    const hp = Math.max(0, enemy.hp - damage);
    events.push({ type: 'damage', target: uid, amount: damage });
    if (hp === 0) events.push({ type: 'defeat', target: uid });
    return { ...enemy, hp };
  });
}

export function useSkill(state, skillId, targetUid = state.selectedUid) {
  if (state.turn !== 'player') return { state, events: [{ type: 'rejected', reason: 'not-player-turn' }] };
  const skill = SKILLS[skillId];
  if (!skill || !HEROES[state.heroId].skills.includes(skillId)) return { state, events: [{ type: 'rejected', reason: 'unknown-skill' }] };
  if (skill.tier > state.skillTier) return { state, events: [{ type: 'rejected', reason: 'locked' }] };
  if (state.power < skill.cost) return { state, events: [{ type: 'rejected', reason: 'unaffordable' }] };
  let next = cloneState(state, { power: state.power - skill.cost });
  const events = [{ type: 'attack', skillId, target: skill.target === 'self' ? 'hero' : targetUid }];
  if (skill.kind === 'defense') {
    next.hero = { ...next.hero, defense: skill.defense };
    events.push({ type: 'defend', defense: skill.defense });
  } else if (skill.kind === 'heal') {
    const amount = Math.min(skill.amount, next.hero.maxHp - next.hero.hp);
    next.hero = { ...next.hero, hp: next.hero.hp + amount };
    events.push({ type: 'heal', target: 'hero', amount });
  } else {
    const target = next.enemies.some((enemy) => enemy.uid === targetUid && living(enemy)) ? targetUid : firstLiving(next.enemies)?.uid;
    if (skill.kind === 'damage') {
      const targets = skill.target === 'all' ? next.enemies.filter(living).map((enemy) => enemy.uid) : [target];
      for (const uid of targets) next.enemies = applyDamage(next.enemies, uid, skill.damage, events);
    } else if (skill.kind === 'doubleDamage') {
      next.enemies = applyDamage(next.enemies, target, skill.damage, events);
      next.enemies = applyDamage(next.enemies, target, skill.damage, events);
    } else if (skill.kind === 'splitDamage') {
      next.enemies = applyDamage(next.enemies, target, skill.damage, events);
      const other = next.enemies.filter((enemy) => living(enemy) && enemy.uid !== target).sort((a, b) => a.hp - b.hp)[0];
      if (other) next.enemies = applyDamage(next.enemies, other.uid, skill.splashDamage, events);
    }
  }
  next.selectedUid = selectedAfter(next.enemies, state.selectedUid);
  const outcome = finish(next, events);
  return outcome.state.turn === 'won' ? outcome : { state: { ...outcome.state, turn: 'enemy' }, events: outcome.events };
}

export function resolveEnemyPhase(state) {
  if (state.turn !== 'enemy') return { state, events: [{ type: 'rejected', reason: 'not-enemy-turn' }] };
  let next = cloneState(state);
  let dodgeHit = false;
  const events = [];
  const defendedDamage = (amount) => {
    if (next.hero.defense === 'dodge') {
      const result = dodgeHit ? Math.ceil(amount * BALANCE.dodgeRestMultiplier) : 0;
      dodgeHit = true;
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
    if (!living(current)) continue;
    const data = ENEMIES[current.id];
    const action = data.pattern[current.step % data.pattern.length];
    let enemy = { ...current, step: current.step + 1, guarding: false, tired: false, charging: false };
    if (action === 'attack' || action === 'heavy' || action === 'drain') {
      const amount = defendedDamage(action === 'heavy' ? data.heavy : data.attack);
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
      events.push({ type: 'guard', target: enemy.uid });
    } else if (action === 'charge') {
      enemy.charging = true;
      events.push({ type: 'charge', target: enemy.uid, heavyName: data.heavyName });
    } else if (action === 'rest') {
      enemy.tired = true;
      events.push({ type: 'rest', target: enemy.uid });
    } else if (action === 'healAlly') {
      const ally = next.enemies.filter((candidate) => living(candidate) && candidate.uid !== enemy.uid && candidate.hp < candidate.maxHp).sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
      if (ally) {
        const amount = Math.min(data.heal, ally.maxHp - ally.hp);
        next.enemies = next.enemies.map((candidate) => candidate.uid === ally.uid ? { ...candidate, hp: candidate.hp + amount } : candidate);
        events.push({ type: 'heal', target: ally.uid, amount });
      } else {
        events.push({ type: 'attack', source: enemy.uid, action: 'attack' });
        const amount = defendedDamage(data.attack);
        next.hero = { ...next.hero, hp: Math.max(0, next.hero.hp - amount) };
        events.push({ type: 'damage', target: 'hero', source: enemy.uid, amount });
      }
    } else if (action === 'summon') {
      const summonedAlive = next.enemies.some((candidate) => candidate.id === data.summonId && living(candidate));
      if (!summonedAlive && next.enemies.filter(living).length < BALANCE.maxLivingEnemies) {
        const added = enemyState(data.summonId, next.nextUid);
        next.enemies = [...next.enemies, added];
        next.nextUid += 1;
        events.push({ type: 'summon', source: enemy.uid, target: added.uid });
      } else {
        events.push({ type: 'attack', source: enemy.uid, action: 'attack' });
        const amount = defendedDamage(data.attack);
        next.hero = { ...next.hero, hp: Math.max(0, next.hero.hp - amount) };
        events.push({ type: 'damage', target: 'hero', source: enemy.uid, amount });
      }
    }
    next.enemies = next.enemies.map((candidate) => candidate.uid === enemy.uid ? enemy : candidate);
  }
  next.hero = { ...next.hero, defense: null };
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
