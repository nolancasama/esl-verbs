import { ENEMIES, HEROES, SKILLS } from './battle-data.js';
import { cycleTarget, getEnemyIntent, resolveEnemyPhase, selectTarget, useSkill } from './battle-engine.js';
import { getBattleArt } from './battle-art.js';

const EVENT_MS = 400;
const REDUCED_EVENT_MS = 1;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const hpPercent = (hp, maxHp) => Math.max(0, Math.min(100, (hp / maxHp) * 100));

function costLabel(cost) {
  return cost ? '⚡'.repeat(cost) : 'FREE';
}

function hintDetails(hint, state) {
  const value = typeof hint === 'function' ? hint(state) : hint;
  if (!value) return null;
  if (typeof value === 'string') return { skill: 'basic', text: value };
  return value;
}

function hpBar(hp, maxHp, label) {
  return `<div class="battle-hp" aria-label="${esc(label)} HP ${hp} of ${maxHp}">
    <div class="battle-hp__track"><span style="width:${hpPercent(hp, maxHp)}%"></span></div>
    <strong>${hp} / ${maxHp}</strong>
  </div>`;
}

function statusBadges(enemy, openingUid) {
  const badges = [];
  if (enemy.guarding) badges.push('<span class="battle-status battle-status--guard">🛡 Guarding</span>');
  if (enemy.charging) badges.push('<span class="battle-status battle-status--charge">⚠️ Charging!</span>');
  if (enemy.tired) badges.push('<span class="battle-status battle-status--tired">💤 Tired!</span>');
  if (enemy.uid === openingUid) badges.push('<span class="battle-status battle-status--opening">👁 OPENING!</span>');
  return `<div class="battle-statuses">${badges.join('')}</div>`;
}

function intentMarkup(state, enemy) {
  if (state.turn !== 'player' || enemy.hp <= 0) return '';
  const intent = getEnemyIntent(state, enemy.uid);
  const data = ENEMIES[enemy.id];
  const labels = {
    attack: `⚔ ${data.attack} ATTACK`,
    guard: '🛡 GUARD',
    heal: '💚 HEAL',
    summon: '💀 SUMMON',
    charge: '⚡ POWERING UP',
    heavy: `🔥 ${data.heavy} BIG ATTACK · ${data.heavyName}`,
    rest: '💤 REST',
    drain: `🩸 ${data.attack} DRAIN`,
  };
  return `<span class="battle-intent${intent === 'heavy' ? ' battle-intent--heavy' : ''}">${esc(labels[intent] || intent)}</span>`;
}

function heroStatuses(hero) {
  const badges = [];
  if (hero.combo) badges.push('<span class="battle-status battle-status--combo">💥 COMBO READY</span>');
  if (hero.counter) badges.push('<span class="battle-status battle-status--counter">⚔ COUNTER READY</span>');
  if (hero.openingUid !== null) badges.push('<span class="battle-status battle-status--opening">👁 OPENING</span>');
  return `<div class="battle-statuses battle-statuses--hero">${badges.join('')}</div>`;
}

function eventMessage(event) {
  switch (event.type) {
    case 'attack': return event.source ? (event.action === 'heavy' ? 'A heavy attack!' : 'Enemy attacks!') : 'Attack!';
    case 'damage': return event.amount === 0 ? 'Dodged!' : `${event.amount} damage!`;
    case 'heal': return event.amount ? `Recovered ${event.amount} HP!` : 'HP is already full.';
    case 'defend': return event.defense === 'dodge' ? 'Ready to dodge!' : 'Defence ready!';
    case 'guard': return 'Enemy is guarding!';
    case 'charge': return `⚠️ ${event.heavyName || 'Heavy attack'} NEXT TURN!`;
    case 'rest': return 'The enemy is tired!';
    case 'summon': return 'Another enemy appeared!';
    case 'comboReady': return 'COMBO READY!';
    case 'combo': return 'COMBO!';
    case 'counterReady': return 'COUNTER READY!';
    case 'counter': return 'COUNTER!';
    case 'opening':
    case 'opening-hit': return 'OPENING!';
    case 'break': return 'BREAK!';
    case 'power': return `+${event.amount} POWER`;
    case 'barrierUp': return 'Barrier ready!';
    case 'chain': return 'CHAIN!';
    case 'enrage': return event.message;
    case 'defeat': return 'Enemy defeated!';
    case 'victory': return 'VICTORY!';
    case 'lost': return 'DEFEATED...';
    case 'rejected': return event.reason === 'unaffordable' ? 'Not enough Power!' : 'That action is unavailable.';
    default: return 'Battle!';
  }
}

/**
 * Render and run a battle. The view owns the useSkill -> enemy phase loop.
 * onAction receives (settledState, { events }) after a complete player/enemy turn.
 * onSelect receives the newly selected state. onExit requests the Menu action.
 */
export function createBattleView(container, { state, onAction = () => {}, onSelect = () => {}, onExit = () => {}, hint = null } = {}) {
  if (!container) throw new Error('createBattleView needs a container');
  if (!state) throw new Error('createBattleView needs battle state');

  let currentState = state;
  let destroyed = false;
  let playing = false;
  let fastForward = false;
  let activeTimer = null;
  let finishDelay = null;
  const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function sprite(target) {
    const selector = target === 'hero' ? '[data-combatant="hero"]' : `[data-enemy-uid="${target}"]`;
    return container.querySelector(`${selector} .battle-sprite`);
  }

  function setSpriteState(target, value) {
    const node = sprite(target);
    if (node) node.dataset.state = value;
  }

  function skillsMarkup() {
    const hero = HEROES[currentState.heroId];
    const activeHint = hintDetails(hint, currentState);
    const danger = currentState.turn === 'player' && currentState.enemies.some((enemy) => enemy.hp > 0 && enemy.intent === 'heavy');
    return hero.skills.map((id, index) => {
      const skill = SKILLS[id];
      const locked = skill.tier > currentState.skillTier;
      const affordable = currentState.power >= skill.cost;
      const disabled = locked || !affordable || currentState.turn !== 'player' || playing;
      const reason = locked ? `Unlocks at skill tier ${skill.tier}` : !affordable ? `Need ${skill.cost} Power` : '';
      const highlighted = (danger && index === 1) || (activeHint && (activeHint.skillId === id || (activeHint.skill === 'basic' && index === 0) || (activeHint.skill === 'defense' && index === 1)));
      return `<button type="button" class="battle-skill${highlighted ? ' battle-skill--hint' : ''}" data-skill-id="${id}"
        ${disabled ? 'disabled' : ''} aria-describedby="${reason ? `skill-reason-${index}` : ''}" title="${esc(reason)}">
        <kbd>${index + 1}</kbd> <span>${esc(skill.name)} <small>${esc(skill.jaName)}</small></span>
        <span class="battle-skill__cost">${locked ? '🔒 LOCKED' : costLabel(skill.cost)}</span>
        ${reason ? `<span class="sr-only" id="skill-reason-${index}">${esc(reason)}</span>` : ''}
      </button>`;
    }).join('');
  }

  function enemyMarkup(enemy) {
    const data = ENEMIES[enemy.id];
    const alive = enemy.hp > 0;
    const selected = alive && enemy.uid === currentState.selectedUid;
    return `<button type="button" class="battle-enemy${selected ? ' battle-enemy--selected' : ''}${data.boss ? ' battle-enemy--boss' : ''}${enemy.phase === 2 ? ' battle-enemy--enraged' : ''}"
      data-select-uid="${enemy.uid}" data-enemy-uid="${enemy.uid}" aria-pressed="${selected}" ${alive ? '' : 'disabled'}>
      <span class="battle-target-marker" aria-hidden="true">▼</span>
      <span class="battle-enemy__name">${esc(data.name)} <small>${esc(data.jaName)}</small></span>
      ${intentMarkup(currentState, enemy)}
      <span class="battle-art-wrap">${getBattleArt(enemy.id, alive ? (enemy.charging ? 'charge' : enemy.guarding ? 'guard' : 'idle') : 'defeat')}</span>
      ${hpBar(enemy.hp, enemy.maxHp, data.name)}
      ${statusBadges(enemy, currentState.hero.openingUid)}
    </button>`;
  }

  function render(message) {
    if (destroyed) return;
    const hero = HEROES[currentState.heroId];
    const activeHint = hintDetails(hint, currentState);
    const danger = currentState.turn === 'player' && currentState.enemies.some((enemy) => enemy.hp > 0 && enemy.intent === 'heavy');
    const defaultMessage = currentState.turn === 'won' ? 'VICTORY!' : currentState.turn === 'lost' ? 'DEFEATED...' : currentState.turn === 'enemy' ? 'Enemy turn...' : 'Choose a skill.';
    container.innerHTML = `<section class="battle-view" aria-label="Battle">
      <div class="battle-topbar">
        <button type="button" class="secondary battle-exit" data-battle-exit>← Menu</button>
        <div class="battle-power" aria-label="Power ${currentState.power}">⚡ POWER <strong>${currentState.power}</strong></div>
        <div class="battle-round">TURN ${currentState.round}</div>
      </div>
      <div class="battle-field">
        <article class="battle-hero" data-combatant="hero">
          <h2>${esc(hero.name)} <small>${esc(hero.jaName)}</small></h2>
          <div class="battle-art-wrap">${getBattleArt(hero.id, currentState.turn === 'won' ? 'victory' : currentState.turn === 'lost' ? 'defeat' : currentState.hero.defense || 'idle')}</div>
          ${hpBar(currentState.hero.hp, currentState.hero.maxHp, hero.name)}
          ${currentState.hero.defense ? `<span class="battle-status battle-status--guard">${currentState.hero.defense === 'dodge' ? '💨 Dodge ready' : '🛡 Guarding'}</span>` : ''}
          ${heroStatuses(currentState.hero)}
        </article>
        <div class="battle-enemies">${currentState.enemies.map(enemyMarkup).join('')}</div>
      </div>
      <div class="battle-message" role="status" aria-live="polite">${esc(message || defaultMessage)}</div>
      ${danger || activeHint?.text ? `<div class="battle-hint">${esc(danger ? 'まもろう！' : activeHint.text)}</div>` : ''}
      <div class="battle-skills" aria-label="Skills">${skillsMarkup()}</div>
    </section>`;
  }

  function delay(ms) {
    return new Promise((resolve) => {
      finishDelay = resolve;
      activeTimer = setTimeout(() => {
        activeTimer = null;
        finishDelay = null;
        resolve();
      }, ms);
    });
  }

  function addFloater(target, textValue, className) {
    const selector = target === 'hero' ? '[data-combatant="hero"]' : `[data-enemy-uid="${target}"]`;
    const parent = container.querySelector(selector);
    if (!parent) return;
    const node = document.createElement('span');
    node.className = `battle-floater ${className}`;
    node.textContent = textValue;
    parent.append(node);
  }

  function applyEvent(event) {
    const message = container.querySelector('.battle-message');
    if (message) message.textContent = eventMessage(event);
    switch (event.type) {
      case 'attack': {
        const actor = event.source ?? 'hero';
        const skill = event.skillId && SKILLS[event.skillId];
        setSpriteState(actor, skill?.kind === 'heal' ? 'cast' : skill?.tier ? 'special' : 'attack');
        break;
      }
      case 'damage':
        setSpriteState(event.target, event.amount === 0 ? 'dodge' : 'hit');
        addFloater(event.target, event.amount === 0 ? 'DODGE!' : `−${event.amount}`, 'battle-floater--damage');
        break;
      case 'heal':
        setSpriteState(event.target, 'cast');
        addFloater(event.target, `+${event.amount} HP`, 'battle-floater--heal');
        break;
      case 'defend':
        setSpriteState('hero', event.defense === 'dodge' ? 'dodge' : 'guard');
        addFloater('hero', '🛡', 'battle-floater--shield');
        break;
      case 'guard':
        setSpriteState(event.target, 'guard');
        addFloater(event.target, '🛡', 'battle-floater--shield');
        break;
      case 'charge': setSpriteState(event.target, 'charge'); break;
      case 'rest': setSpriteState(event.target, 'idle'); break;
      case 'summon': setSpriteState(event.source, 'cast'); break;
      case 'comboReady': addFloater('hero', 'COMBO READY!', 'battle-floater--status'); break;
      case 'combo': addFloater('hero', 'COMBO!', 'battle-floater--status'); break;
      case 'counterReady': addFloater('hero', 'COUNTER READY!', 'battle-floater--status'); break;
      case 'counter': addFloater(event.target, 'COUNTER!', 'battle-floater--status'); break;
      case 'opening':
      case 'opening-hit': addFloater(event.target, 'OPENING!', 'battle-floater--status'); break;
      case 'break':
        setSpriteState(event.target, 'broken');
        addFloater(event.target, 'BREAK!', 'battle-floater--status');
        break;
      case 'power': addFloater('hero', `+${event.amount} POWER`, 'battle-floater--power'); break;
      case 'barrierUp':
        setSpriteState('hero', 'guard');
        addFloater('hero', 'BARRIER!', 'battle-floater--shield');
        break;
      case 'chain': addFloater(event.target, 'CHAIN!', 'battle-floater--status'); break;
      case 'enrage':
        setSpriteState(event.target, 'enraged');
        addFloater(event.target, event.message, 'battle-floater--status');
        break;
      case 'defeat': setSpriteState(event.target, 'defeat'); break;
      case 'victory': setSpriteState('hero', 'victory'); break;
      case 'lost': setSpriteState('hero', 'defeat'); break;
      default: break;
    }
  }

  async function replay(events) {
    if (!events?.length || destroyed) return;
    playing = true;
    fastForward = reducedMotion;
    container.querySelector('.battle-view')?.setAttribute('aria-busy', 'true');
    for (const event of events) {
      if (destroyed) break;
      container.querySelectorAll('.battle-floater').forEach((node) => node.remove());
      applyEvent(event);
      await delay(fastForward ? REDUCED_EVENT_MS : EVENT_MS);
      if (destroyed) break;
    }
    playing = false;
    fastForward = false;
    if (!destroyed) render(events.length ? eventMessage(events.at(-1)) : undefined);
  }

  function skipPlayback(event) {
    if (!playing) return false;
    fastForward = true;
    if (activeTimer !== null) clearTimeout(activeTimer);
    activeTimer = null;
    const resolve = finishDelay;
    finishDelay = null;
    resolve?.();
    event?.preventDefault?.();
    event?.stopPropagation?.();
    return true;
  }

  async function act(skillId) {
    if (destroyed || playing || currentState.turn !== 'player') return;
    const player = useSkill(currentState, skillId, currentState.selectedUid);
    if (player.events[0]?.type === 'rejected') {
      render(eventMessage(player.events[0]));
      return;
    }
    currentState = player.state;
    render();
    await replay(player.events);
    const allEvents = [...player.events];
    if (!destroyed && currentState.turn === 'enemy') {
      const enemy = resolveEnemyPhase(currentState);
      currentState = enemy.state;
      render();
      await replay(enemy.events);
      allEvents.push(...enemy.events);
    }
    if (!destroyed) onAction(currentState, { events: allEvents });
  }

  function chooseTarget(uid) {
    if (destroyed || playing || currentState.turn !== 'player') return;
    const next = selectTarget(currentState, uid);
    if (next === currentState) return;
    currentState = next;
    render();
    onSelect(currentState);
  }

  function moveTarget(direction) {
    if (destroyed || playing || currentState.turn !== 'player') return;
    currentState = cycleTarget(currentState, direction);
    render();
    onSelect(currentState);
  }

  function onClick(event) {
    if (skipPlayback(event)) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-battle-exit]')) { onExit(); return; }
    const enemy = target?.closest('[data-select-uid]');
    if (enemy) { chooseTarget(Number(enemy.dataset.selectUid)); return; }
    const skill = target?.closest('[data-skill-id]');
    if (skill && !skill.disabled) act(skill.dataset.skillId);
  }

  function onKeydown(event) {
    if (document.querySelector('.modal-backdrop')) return; // the quit dialog owns the keyboard
    if (playing) {
      if (event.key === 'Enter' || event.key === ' ') skipPlayback(event);
      return;
    }
    if (event.key === 'Escape') { event.preventDefault(); onExit(); return; }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      moveTarget(event.key === 'ArrowRight' ? 1 : -1);
      return;
    }
    if (/^[1-4]$/.test(event.key)) {
      const id = HEROES[currentState.heroId].skills[Number(event.key) - 1];
      if (id) { event.preventDefault(); act(id); }
    }
  }

  container.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeydown);
  render();

  return {
    get state() { return currentState; },
    get playing() { return playing; },
    update(nextState, message) {
      if (destroyed || !nextState) return;
      currentState = nextState;
      render(message);
    },
    playEvents: replay,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (activeTimer !== null) clearTimeout(activeTimer);
      activeTimer = null;
      const resolve = finishDelay;
      finishDelay = null;
      resolve?.();
      container.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeydown);
      container.replaceChildren();
    },
  };
}
