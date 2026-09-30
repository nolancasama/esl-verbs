import { ALLIES, BALANCE, ENCOUNTERS, ENEMIES, HEROES, SKILLS } from './battle-data.js';
import {
  availableItems, availableSkills, cycleTarget, getEnemyIntent, mustRecover, recover, resolveEnemyPhase, selectTarget, skillBonus,
  useItem, useSkill,
} from './battle-engine.js';
import {
  backdropClass, createEffectsPlayer, enemyRestState, eventSpriteStates, getBarrierArt, getBattleArt, getIcon, heroRestState,
} from './battle-art.js';
import { AP_SLOT } from './ap-meter.js';

// Minimum on-screen time per event type; the effects player can ask for longer.
const EVENT_MS = { default: 380, damage: 360, defeat: 620, ap: 320, recover: 760, item: 420, heal: 420, victory: 650, lost: 650, enrage: 700, summon: 480, waveClear: 700, waveStart: 1500, allyJoin: 1900, allyAttack: 320, allyProtect: 560 };
const REDUCED_EVENT_MS = 170;
const END_PAUSE_MS = 900;
const RECOVER_PAUSE_MS = 650;
const DANGER_HP = 0.35;
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const hpPercent = (hp, maxHp) => Math.max(0, Math.min(100, (hp / maxHp) * 100));

function costMarkup(skill, locked, affordable) {
  if (locked) return `<span class="battle-skill__cost battle-skill__cost--locked">${getIcon('lock')} LOCKED</span>`;
  return `<span class="battle-skill__cost${affordable ? '' : ' battle-skill__cost--short'}" aria-label="${skill.cost} AP">${'<i></i>'.repeat(skill.cost)}${skill.cost} AP</span>`;
}

function hpBar(hp, maxHp, label) {
  const ratio = hp / maxHp;
  const tone = ratio <= 0.25 ? ' battle-hp--danger' : ratio <= 0.5 ? ' battle-hp--low' : '';
  return `<div class="battle-hp${tone}" aria-label="${esc(label)} HP ${hp} of ${maxHp}">
    <span class="battle-hp__label" aria-hidden="true">HP</span>
    <div class="battle-hp__track"><span style="width:${hpPercent(hp, maxHp)}%"></span></div>
    <strong>${hp}/${maxHp}</strong>
  </div>`;
}

const status = (kind, icon, text) => `<span class="battle-status battle-status--${kind}">${getIcon(icon)}${text}</span>`;

// COMBO and OPENING only mean something once the skill that cashes them in is unlocked;
// before that (battle 1) their badges, floaters and messages stay hidden.
const PAYOFF_SKILL = { combo: 'powerSlash', opening: 'doubleStrike' };
const payoffUnlocked = (state, kind) => SKILLS[PAYOFF_SKILL[kind]].tier <= state.skillTier;
const HIDDEN_UNTIL_PAYOFF = { comboReady: 'combo', opening: 'opening' };
const eventShown = (state, event) => !HIDDEN_UNTIL_PAYOFF[event.type] || payoffUnlocked(state, HIDDEN_UNTIL_PAYOFF[event.type]);

function statusBadges(enemy, openingUid) {
  const badges = [];
  if (enemy.phase === 2) badges.push(status('angry', 'heavy', 'ANGRY!'));
  if (enemy.guarding) badges.push(status('guard', 'guard', 'Guarding'));
  if (enemy.charging) badges.push(status('charge', 'charge', 'Charging!'));
  if (enemy.tired) badges.push(status('tired', 'rest', 'Tired!'));
  if (enemy.uid === openingUid) badges.push(status('opening', 'opening', 'OPENING!'));
  return badges.join('');
}

const INTENT_ICON = { attack: 'attack', guard: 'guard', heal: 'heal', summon: 'summon', charge: 'charge', heavy: 'heavy', rest: 'rest', drain: 'drain' };
const INTENT_TONE = { heavy: ' battle-intent--heavy', charge: ' battle-intent--charge', heal: ' battle-intent--support', summon: ' battle-intent--support' };

function intentMarkup(state, enemy, hidden = false) {
  if (hidden || state.turn !== 'player' || enemy.hp <= 0) return '';
  const intent = getEnemyIntent(state, enemy.uid);
  const data = ENEMIES[enemy.id];
  const labels = {
    attack: `${data.attack} ATTACK`,
    guard: 'GUARD',
    heal: 'HEAL',
    summon: 'SUMMON',
    charge: 'POWERING UP',
    heavy: `${data.heavy} BIG ATTACK · ${data.heavyName}`,
    rest: 'REST',
    drain: `${data.attack} DRAIN`,
  };
  return `<span class="battle-intent${INTENT_TONE[intent] || ''}">${getIcon(INTENT_ICON[intent] || 'attack')}${esc(labels[intent] || intent)}</span>`;
}

function heroStatuses(hero, recovering, state) {
  const badges = [];
  if (recovering) badges.push(status('tired', 'rest', 'RECOVERING'));
  if (hero.defense) badges.push(hero.defense === 'dodge' ? status('guard', 'dodge', 'Dodge ready') : hero.defense === 'barrier' ? status('guard', 'barrier', 'Barrier') : status('guard', 'guard', 'Guarding'));
  if (hero.combo && payoffUnlocked(state, 'combo')) badges.push(status('combo', 'combo', 'COMBO READY'));
  if (hero.counter) badges.push(status('counter', 'counter', 'COUNTER READY'));
  if (hero.openingUid !== null && payoffUnlocked(state, 'opening')) badges.push(status('opening', 'opening', 'OPENING'));
  return `<div class="battle-statuses battle-statuses--hero">${badges.join('')}</div>`;
}

const REJECTED = {
  unaffordable: 'Not enough AP!',
  'no-items': 'No potions left!',
  'full-hp': 'HP is already full!',
  locked: 'That skill is locked.',
};

export function eventMessage(event) {
  switch (event.type) {
    case 'attack': return event.source ? (event.action === 'heavy' ? 'A BIG ATTACK!' : event.action === 'drain' ? 'Drain!' : 'Enemy attacks!') : `${SKILLS[event.skillId]?.name ?? 'Attack'}!`;
    case 'damage': return event.amount === 0 ? 'Dodged!' : `${event.amount} damage!`;
    case 'heal': return event.amount ? `Recovered ${event.amount} HP!` : 'HP is already full.';
    case 'item': return 'Potion!';
    case 'defend': return event.defense === 'dodge' ? 'Ready to dodge!' : event.defense === 'barrier' ? 'Barrier up!' : 'Guard up!';
    case 'guard': return 'Enemy is guarding!';
    case 'charge': return `⚠️ ${event.heavyName || 'Big attack'} NEXT TURN!`;
    case 'rest': return 'The enemy is tired!';
    case 'summon': return event.target == null ? 'Nothing happened.' : 'Another enemy appeared!';
    case 'comboReady': return 'COMBO READY!';
    case 'combo': return 'COMBO!';
    case 'counterReady': return 'COUNTER READY!';
    case 'counter': return 'COUNTER!';
    case 'opening':
    case 'opening-hit': return 'OPENING!';
    case 'break': return 'BREAK!';
    case 'ap': return event.reason === 'recover' ? `RECOVERING… +${event.amount} AP` : `+${event.amount} AP!`;
    case 'recover': return 'RECOVERING… / ひとやすみ…';
    case 'barrierUp': return 'Barrier up!';
    case 'chain': return 'CHAIN!';
    case 'enrage': return event.message;
    case 'defeat': return 'Enemy defeated!';
    case 'victory': return 'VICTORY!';
    case 'lost': return 'DEFEATED...';
    case 'rejected': return REJECTED[event.reason] || 'That action is unavailable.';
    case 'waveClear': return 'WAVE CLEAR!';
    case 'waveStart': return `WAVE ${event.wave}! まだ くる！`;
    case 'allyJoin': return 'なかまが きた！ 大阪の まもりびと！';
    case 'allyAttack': return 'ALLY! なかまの こうげき！';
    case 'allyProtect': return 'まもりびとが まもってくれる！';
    default: return 'Battle!';
  }
}

/** The one hint shown this turn (the danger hint outranks onboarding). Pure, for tests. */
export function battleHint(state, onboarding = null) {
  if (state.turn !== 'player') return null;
  const living = state.enemies.filter((enemy) => enemy.hp > 0);
  if (living.some((enemy) => enemy.intent === 'heavy')) return { skill: 'defense', text: '🔥 BIG ATTACK NEXT! まもろう！' };
  const potion = availableItems(state)[0];
  if (potion?.usable && state.hero.hp <= state.hero.maxHp * DANGER_HP) return { item: true, text: 'HP がピンチ！ ポーションをつかおう' };
  if (living.some((enemy) => enemy.intent === 'charge') && state.ap >= 1) return { keep: true, text: '⚡ BIG ATTACK SOON — AP を 1 のこそう！' };
  return payoffHint(state) || onboarding;
}

/** COMBO / OPENING point at the skill that cashes the bonus in; COUNTER applies to any attack. */
function payoffHint(state) {
  const best = availableSkills(state)
    .filter((skill) => skill.affordable)
    .map((skill) => ({ skill, bonus: skillBonus(state, skill.id) }))
    .filter((entry) => entry.bonus > 0)
    .sort((a, b) => b.bonus - a.bonus)[0];
  if (!best) return null;
  const { skill, bonus } = best;
  const setUp = bonus - (state.hero.counter ? BALANCE.counterBonus : 0);
  if (setUp > 0 && skill.id === 'powerSlash') return { skillId: skill.id, text: `COMBO！ ${skill.jaName}で +${bonus}！` };
  if (setUp > 0 && skill.kind === 'doubleDamage') return { skillId: skill.id, text: `OPENING！ ${skill.jaName}で +${bonus}！` };
  return { counter: true, text: `COUNTER！ つぎの こうげき +${BALANCE.counterBonus}！` };
}

/**
 * Render and run a battle. The view owns the player -> enemy -> (recovery) loop.
 * onAction receives (settledState, { events }) after a complete turn.
 * apMeter is the shared Adventure AP meter (optional); onExit requests the Menu action.
 */
export function createBattleView(container, {
  state, apMeter = null, onAction = () => {}, onSelect = () => {}, onExit = () => {}, hint = null, sound = null, topRight = '',
} = {}) {
  if (!container) throw new Error('createBattleView needs a container');
  if (!state) throw new Error('createBattleView needs battle state');

  let currentState = state;
  let destroyed = false;
  let playing = false;
  let fastForward = false;
  let recovering = false;
  let itemMenu = false;
  let activeTimer = null;
  let finishDelay = null;
  let shownAp = state.ap;
  // While events play, the view shows this snapshot (HP, statuses, stance) and updates it per event,
  // so bars drop as hits land instead of jumping to the end-of-turn values.
  let display = null;
  let fitPx = null; // integer pixel scale chosen so the tallest sprite and its plate fit the field
  const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const effects = createEffectsPlayer(container, { reducedMotion, sound });
  const stage = ENCOUNTERS[state.encounterId]?.tier ?? ENCOUNTERS[state.encounterId]?.stage ?? 1;
  const boss = state.enemies.some((enemy) => ENEMIES[enemy.id].boss);

  const onboarding = () => (typeof hint === 'function' ? hint(currentState) : hint) || null;
  const currentHint = () => (playing ? null : battleHint(currentState, onboarding()));

  function setAp(value, options) {
    shownAp = value;
    apMeter?.set(value, options);
  }

  const slotSelector = (target) => (target === 'hero' || target === 'ally' ? `[data-combatant="${target}"]` : `[data-enemy-uid="${target}"]`);
  function sprite(target) {
    return container.querySelector(`${slotSelector(target)} .battle-sprite`);
  }

  function setSpriteState(target, value) {
    const node = sprite(target);
    if (!node) return;
    if (node.dataset.state === value) { node.dataset.state = ''; void node.offsetWidth; } // restart the same row
    node.dataset.state = value;
  }

  function skillsMarkup(activeHint) {
    const hero = HEROES[currentState.heroId];
    const busy = currentState.turn !== 'player' || playing;
    if (itemMenu) {
      const potion = availableItems(currentState)[0];
      const reason = potion.reason === 'no-items' ? 'None left' : potion.reason === 'full-hp' ? 'HP is full' : potion.reason === 'unaffordable' ? `Need ${potion.cost} AP` : '';
      return `<button type="button" class="battle-skill battle-skill--item px-button" data-item-id="potion" ${potion.usable && !busy ? '' : 'disabled'} title="${esc(reason)}">
          <kbd>1</kbd>${getIcon('potion')}<span class="battle-skill__name">Potion ×${potion.count} <small>${esc(potion.jaName)} · HP +${potion.heal}</small></span>
          ${costMarkup(potion, false, currentState.ap >= potion.cost)}
          ${reason ? `<span class="battle-skill__why">${esc(reason)}</span>` : ''}
        </button>
        <button type="button" class="battle-skill battle-skill--back px-button secondary" data-item-back><kbd>5</kbd><span class="battle-skill__name">Back <small>もどる</small></span></button>`;
    }
    const buttons = hero.skills.map((id, index) => {
      const skill = SKILLS[id];
      const locked = skill.tier > currentState.skillTier;
      const affordable = currentState.ap >= skill.cost;
      const disabled = locked || !affordable || busy;
      const reason = locked ? 'Unlocks later' : !affordable ? `Need ${skill.cost} AP` : '';
      const highlighted = !busy && ((activeHint?.skill === 'defense' && skill.kind === 'defense' && affordable)
        || (activeHint?.skill === 'basic' && index === 0) || activeHint?.skillId === id);
      const bonus = locked || busy ? 0 : skillBonus(currentState, id);
      return `<button type="button" class="battle-skill px-button battle-skill--${skill.kind}${highlighted ? ' battle-skill--hint' : ''}" data-skill-id="${id}"
        ${disabled ? 'disabled' : ''} aria-describedby="${reason ? `skill-reason-${index}` : ''}" title="${esc(reason)}">
        <kbd>${index + 1}</kbd>${getIcon(id)}<span class="battle-skill__name">${esc(skill.name)} <small>${esc(skill.jaName)}</small></span>
        ${bonus ? `<span class="battle-skill__bonus">+${bonus}<span class="sr-only"> damage</span></span>` : ''}
        ${costMarkup(skill, locked, affordable)}
        ${reason ? `<span class="battle-skill__why" id="skill-reason-${index}">${esc(reason)}</span>` : ''}
      </button>`;
    });
    const potion = availableItems(currentState)[0];
    const itemHint = !busy && activeHint?.item;
    buttons.push(`<button type="button" class="battle-skill battle-skill--items px-button${itemHint ? ' battle-skill--hint' : ''}" data-item-menu ${busy ? 'disabled' : ''}>
      <kbd>5</kbd>${getIcon('potion')}<span class="battle-skill__name">Item <small>×${potion.count}</small></span>
    </button>`);
    return buttons.join('');
  }

  // The wave and ally are part of the snapshot: a turn that clears a wave already
  // holds the next wave (and maybe the ally), but they appear only when their event plays.
  function snapshot(source) {
    return {
      hero: { ...source.hero }, enemies: new Map(source.enemies.map((enemy) => [enemy.uid, { ...enemy }])),
      wave: source.wave ?? 1, ally: source.ally ? { ...source.ally } : null,
    };
  }

  /** Enemies to draw: during playback the shown wave first, then the next wave's enemies (hidden until waveStart). */
  function shownEnemies() {
    if (!display) return currentState.enemies;
    const earlier = [...display.enemies.values()].filter((enemy) => !currentState.enemies.some((current) => current.uid === enemy.uid));
    return [...earlier, ...currentState.enemies];
  }

  /** Background silhouettes for the Horde: later waves' enemies plus the encounter's extra reserve. */
  function reserveMarkup() {
    const encounter = ENCOUNTERS[currentState.encounterId];
    const waves = encounter?.waves;
    if (!waves || waves.length < 2 && !encounter.reserve) return '';
    const wave = display?.wave ?? currentState.wave ?? 1;
    const later = waves.slice(wave).flatMap((next) => next.enemyIds);
    // Extra silhouettes are the watching army: shown in a one-wave city battle, spent by a multi-wave battle's last wave.
    const extra = wave < waves.length || waves.length === 1 ? Array.from({ length: encounter.reserve ?? 0 }, (_, index) => waves[0].enemyIds[index % waves[0].enemyIds.length]) : [];
    const ids = [...later, ...extra].slice(0, 9);
    if (!ids.length) return '';
    return `<div class="battle-reserve" aria-hidden="true">${ids.map((id, index) => `<span class="battle-reserve__unit" style="--i:${index}">${getBattleArt(id, 'idle')}</span>`).join('')}</div>`;
  }

  function allyMarkup(ally, entering = false) {
    if (!ally) return '';
    const data = ALLIES[ally.id];
    const pose = currentState.turn === 'won' && !display ? 'victory' : 'idle';
    return `<article class="battle-ally${entering ? ' battle-ally--enter' : ''}" data-combatant="ally" aria-label="${esc(data.name)} / ${esc(data.jaName)}">
      <div class="battle-art-wrap">${getBattleArt(ally.id, pose)}</div>
      <span class="battle-ally__tag px-panel">なかま</span>
    </article>`;
  }

  function enemyMarkup(current) {
    const data = ENEMIES[current.id];
    const incoming = Boolean(display) && !display.enemies.has(current.uid) && (currentState.wave ?? 1) !== display.wave;
    const pending = Boolean(display) && !display.enemies.has(current.uid) && !incoming;
    const enemy = display?.enemies.get(current.uid) ?? current;
    const gone = enemy.hp <= 0;
    const selected = !gone && !display && enemy.uid === currentState.selectedUid;
    const art = gone ? '' : getBattleArt(enemy.id, enemyRestState(enemy), { variant: enemy.phase === 2 ? 'enraged' : '' });
    return `<button type="button" class="battle-enemy${selected ? ' battle-enemy--selected' : ''}${data.boss ? ' battle-enemy--boss' : ''}${enemy.phase === 2 ? ' battle-enemy--enraged' : ''}${gone ? ' battle-enemy--gone' : ''}${pending ? ' battle-enemy--pending' : ''}${incoming ? ' battle-enemy--incoming' : ''}"
      data-select-uid="${enemy.uid}" data-enemy-uid="${enemy.uid}" data-enemy-id="${enemy.id}" aria-pressed="${selected}" ${gone ? 'disabled aria-hidden="true" tabindex="-1"' : ''}>
      <span class="battle-target-marker" aria-hidden="true">${getIcon('cursor')}</span>
      <span class="battle-enemy__plate px-panel">
        <span class="battle-enemy__name">${esc(data.name)}<small>${esc(data.jaName)}</small></span>
        ${hpBar(enemy.hp, enemy.maxHp, data.name)}
      </span>
      <span class="battle-cues">${intentMarkup(currentState, current, playing)}${statusBadges(enemy, payoffUnlocked(currentState, 'opening') ? (display?.hero ?? currentState.hero).openingUid : null)}</span>
      <span class="battle-art-wrap">${art}</span>
    </button>`;
  }

  function render(message) {
    if (destroyed) return;
    effects.clear();
    const hero = HEROES[currentState.heroId];
    const activeHint = currentHint();
    const defaultMessage = currentState.turn === 'won' ? 'VICTORY!' : currentState.turn === 'lost' ? 'DEFEATED...'
      : recovering ? 'RECOVERING… / ひとやすみ…' : currentState.turn === 'enemy' ? 'Enemy turn...' : itemMenu ? 'Use an item? / アイテムをつかう？' : 'Choose an action.';
    const heroShown = display?.hero ?? currentState.hero;
    const heroState = recovering ? 'tired' : display ? heroShown.defense || 'idle' : heroRestState(currentState);
    const allyShown = display ? display.ally : currentState.ally;
    const waveCount = currentState.waveCount ?? 1;
    const waveShown = display?.wave ?? currentState.wave ?? 1;
    container.innerHTML = `<section class="battle-view stage-${stage}${boss ? ' battle-view--boss' : ''}${recovering ? ' battle-view--recovering' : ''}" aria-label="Battle">
      <div class="battle-topbar">
        <button type="button" class="secondary battle-exit px-button" data-battle-exit>← Menu</button>
        ${AP_SLOT}
        <div class="battle-topbar__right">${waveCount > 1 ? `<div class="battle-round battle-wave px-panel">WAVE ${waveShown} / ${waveCount}</div>` : ''}<div class="battle-round px-panel">TURN ${currentState.round}</div>${topRight}</div>
      </div>
      <div class="battle-field ${backdropClass(stage)}${allyShown ? ' battle-field--ally' : ''}">
        <div class="battle-light" aria-hidden="true"></div>
        ${reserveMarkup()}
        ${allyMarkup(allyShown)}
        <article class="battle-hero" data-combatant="hero" aria-label="${esc(hero.name)}">
          <div class="battle-art-wrap">${getBattleArt(hero.id, heroState)}${heroShown.defense === 'barrier' ? getBarrierArt() : ''}</div>
        </article>
        <div class="battle-enemies">${shownEnemies().map(enemyMarkup).join('')}</div>
        <div class="battle-banner" aria-hidden="true"></div>
      </div>
      <div class="battle-lower">
        <div class="battle-message-box px-panel">
          <div class="battle-message" role="status" aria-live="polite">${esc(message || defaultMessage)}</div>
          ${activeHint?.text ? `<div class="battle-hint${activeHint.skill === 'defense' ? ' battle-hint--danger' : ''}">${esc(activeHint.text)}</div>` : ''}
        </div>
        <div class="battle-hero-panel px-panel">
          <h2>${esc(hero.name)} <small>${esc(hero.jaName)}</small><span class="battle-level">LV ${currentState.level}</span></h2>
          ${hpBar(heroShown.hp, heroShown.maxHp, hero.name)}
          ${heroStatuses(heroShown, recovering, currentState)}
        </div>
        <div class="battle-skills${itemMenu ? ' battle-skills--items' : ''}" aria-label="${itemMenu ? 'Items' : 'Skills'}">${skillsMarkup(activeHint)}</div>
      </div>
    </section>`;
    if (fitPx) container.querySelector('.battle-view')?.style.setProperty('--px', fitPx);
    else fit();
    if (apMeter) {
      apMeter.mount(container.querySelector('[data-ap-slot]'));
      apMeter.setRecovering(recovering);
      if (apMeter.value !== shownAp) apMeter.set(shownAp, { quiet: true });
    }
  }

  /** Pick the largest whole-pixel scale (2-4) at which every sprite, its name plate and intents fit;
      1 only when even 2 would clip a boss (a very short window), since a clipped floor line is worse than small art. */
  function fit() {
    const view = container.querySelector('.battle-view');
    const field = view?.querySelector('.battle-field');
    if (!field || typeof getComputedStyle !== 'function' || !field.clientHeight) return;
    if (matchMedia?.('(max-width: 700px)').matches) return; // phones stack the field and use the CSS scale
    const read = (node, name) => Number(getComputedStyle(node).getPropertyValue(name)) || 0;
    const enemyH = Math.max(1, ...[...field.querySelectorAll('.battle-enemy .px-sprite')].map((node) => read(node, '--fh') - read(node, '--top')));
    const heroNode = field.querySelector('.battle-hero .px-sprite');
    const heroH = heroNode ? read(heroNode, '--fh') : 72;
    const room = field.clientHeight - 12;
    let px = Math.max(1, Math.min(4, Math.floor(Math.min((room - 118) / enemyH, room / heroH))));
    view.style.setProperty('--px', px);
    // The estimate assumes one-line name plates; step down while anything still spills below the field.
    while (px > 1 && field.scrollHeight > field.clientHeight + 1) view.style.setProperty('--px', --px);
    fitPx = px;
  }
  const onResize = () => { fitPx = null; if (!playing) render(); };

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

  /** A big announcement across the field (WAVE 2 / なかまが きた！). */
  function showBanner(title, subtitle, tone = '') {
    const banner = container.querySelector('.battle-banner');
    if (!banner) return;
    banner.className = `battle-banner battle-banner--show${tone ? ` battle-banner--${tone}` : ''}`;
    banner.innerHTML = `<strong>${esc(title)}</strong><span>${esc(subtitle)}</span>`;
  }

  /** The next wave replaces the cleared one: defeated enemies leave, the reserve steps forward. */
  function beginWave(event) {
    display.wave = event.wave;
    display.enemies = new Map(currentState.enemies.filter((enemy) => event.targets.includes(enemy.uid)).map((enemy) => [enemy.uid, { ...enemy }]));
    container.querySelectorAll('.battle-enemy').forEach((node) => {
      if (!event.targets.includes(Number(node.dataset.enemyUid))) { node.remove(); return; }
      node.classList.remove('battle-enemy--incoming');
      node.classList.add('battle-enemy--enter');
    });
    const reserve = container.querySelector('.battle-reserve');
    const fresh = document.createElement('div');
    fresh.innerHTML = reserveMarkup();
    if (reserve) reserve.replaceWith(...(fresh.firstElementChild ? [fresh.firstElementChild] : []));
    const chip = container.querySelector('.battle-wave');
    if (chip) chip.textContent = `WAVE ${event.wave} / ${event.waveCount}`;
    fitPx = null; // the new wave may need a different scale; the settled render refits
    showBanner(`WAVE ${event.wave} / ${event.waveCount}`, event.wave === event.waveCount ? 'さいごの なみ！' : 'まだ くる！', event.wave === event.waveCount ? 'final' : '');
  }

  function allyJoins(event) {
    display.ally = { id: event.allyId };
    const hero = container.querySelector('[data-combatant="hero"]');
    hero?.insertAdjacentHTML('beforebegin', allyMarkup(display.ally, true));
    container.querySelector('.battle-field')?.classList.add('battle-field--ally');
    showBanner('なかまが きた！', `${ALLIES[event.allyId].jaName} / AN ALLY JOINS!`, 'ally');
  }

  function addFloater(target, textValue, className) {
    const parent = container.querySelector(`${slotSelector(target)} .battle-art-wrap`);
    if (!parent) return;
    const node = document.createElement('span');
    node.className = `battle-floater ${className}`;
    node.textContent = textValue;
    parent.append(node);
  }

  /** Move a displayed HP value during playback and redraw just that bar. */
  function shiftHp(target, delta) {
    if (!display) return;
    const unit = target === 'hero' ? display.hero : display.enemies.get(target);
    if (!unit) return;
    unit.hp = Math.max(0, Math.min(unit.maxHp, unit.hp + delta));
    const bar = container.querySelector(target === 'hero' ? '.battle-hero-panel .battle-hp' : `[data-enemy-uid="${target}"] .battle-hp`);
    if (bar) bar.outerHTML = hpBar(unit.hp, unit.maxHp, target === 'hero' ? HEROES[currentState.heroId].name : ENEMIES[unit.id].name);
  }

  function applyEvent(event) {
    if (display) {
      if (event.type === 'damage') shiftHp(event.target, -event.amount);
      if (event.type === 'heal') shiftHp(event.target, event.amount);
      if (event.type === 'defend' || event.type === 'barrierUp') display.hero.defense = event.defense;
      if (event.type === 'summon' && event.target != null) {
        const added = currentState.enemies.find((enemy) => enemy.uid === event.target);
        if (added) display.enemies.set(added.uid, { ...added });
        container.querySelector(`[data-enemy-uid="${event.target}"]`)?.classList.remove('battle-enemy--pending');
      }
    }
    const message = container.querySelector('.battle-message');
    if (message) message.textContent = eventMessage(event);
    for (const [target, spriteState] of eventSpriteStates(event)) setSpriteState(target, spriteState);
    const wanted = effects.play(event, currentState);
    switch (event.type) {
      case 'damage': addFloater(event.target, event.amount === 0 ? 'DODGE!' : `-${event.amount}`, event.target === 'hero' ? 'battle-floater--hurt' : 'battle-floater--damage'); break;
      case 'heal': addFloater(event.target, `+${event.amount} HP`, 'battle-floater--heal'); break;
      case 'defend': addFloater('hero', event.defense === 'dodge' ? 'READY!' : event.defense === 'barrier' ? 'BARRIER!' : 'GUARD!', 'battle-floater--shield'); break;
      case 'guard': addFloater(event.target, 'GUARD!', 'battle-floater--shield'); break;
      case 'comboReady': addFloater('hero', 'COMBO READY!', 'battle-floater--status'); break;
      case 'combo': addFloater('hero', 'COMBO!', 'battle-floater--status'); break;
      case 'counterReady': addFloater('hero', 'COUNTER READY!', 'battle-floater--status'); break;
      case 'counter': addFloater(event.target, 'COUNTER!', 'battle-floater--status'); break;
      case 'opening':
      case 'opening-hit': addFloater(event.target, 'OPENING!', 'battle-floater--status'); break;
      case 'break': addFloater(event.target, 'BREAK!', 'battle-floater--break'); break;
      case 'ap': addFloater('hero', `+${event.amount} AP`, 'battle-floater--power'); setAp(event.ap); break;
      case 'barrierUp': addFloater('hero', 'BARRIER!', 'battle-floater--shield'); break;
      case 'chain': addFloater(event.target, 'CHAIN!', 'battle-floater--status'); break;
      case 'enrage': addFloater(event.target, 'ENRAGED!', 'battle-floater--status'); break;
      case 'waveClear': showBanner('WAVE CLEAR!', 'やった！', 'clear'); break;
      case 'waveStart': if (display) beginWave(event); break;
      case 'allyJoin': if (display) allyJoins(event); break;
      case 'allyAttack': setSpriteState('ally', 'attack'); addFloater('ally', 'なかま！', 'battle-floater--ally'); break;
      case 'allyProtect': setSpriteState('ally', 'guard'); addFloater('hero', 'まもる！', 'battle-floater--shield'); break;
      case 'defeat': {
        const node = container.querySelector(`[data-enemy-uid="${event.target}"]`);
        node?.classList.add('battle-enemy--defeated');
        break;
      }
      default: break;
    }
    return wanted;
  }

  async function replay(events) {
    if (!events?.length || destroyed) return;
    playing = true;
    container.querySelector('.battle-view')?.setAttribute('aria-busy', 'true');
    for (const event of events) {
      if (destroyed) break;
      if (!eventShown(currentState, event)) continue;
      container.querySelectorAll('.battle-floater').forEach((node) => node.remove());
      const wanted = applyEvent(event);
      // The effects player knows how long its sequence needs; otherwise use the per-type default.
      const base = reducedMotion ? REDUCED_EVENT_MS : (wanted ?? EVENT_MS[event.type] ?? EVENT_MS.default);
      if (!fastForward) await delay(base);
      if (destroyed) break;
    }
    playing = false;
  }

  // Run a player step (skill, item or recovery), then the enemy phase, then any forced recovery.
  async function runTurn(player) {
    if (player.events[0]?.type === 'rejected') {
      if (player.events[0].reason === 'unaffordable') apMeter?.deny();
      render(eventMessage(player.events[0]));
      return;
    }
    const gains = player.events.filter((event) => event.type === 'ap').reduce((sum, event) => sum + event.amount, 0);
    display = snapshot(currentState);
    currentState = player.state;
    itemMenu = false;
    fastForward = false;
    playing = true;
    render();
    setAp(currentState.ap - gains);
    const allEvents = [...player.events];
    await replay(player.events);
    if (!destroyed && currentState.turn === 'enemy') {
      display = snapshot(currentState);
      const enemy = resolveEnemyPhase(currentState);
      currentState = enemy.state;
      playing = true; // keep next turn's intents and hints hidden until the enemy phase has played
      render();
      await replay(enemy.events);
      allEvents.push(...enemy.events);
    }
    recovering = false;
    display = null;
    if (!destroyed && mustRecover(currentState)) {
      await runRecovery(allEvents);
      return;
    }
    await settle(allEvents);
  }

  // An exhausted turn: show RECOVERING, fill +AP, then the enemies act while the hero rests.
  async function runRecovery() {
    recovering = true;
    playing = true;
    fastForward = false;
    render();
    sound?.sfx('recover');
    if (!reducedMotion) await delay(RECOVER_PAUSE_MS);
    if (destroyed) return;
    const rest = recover(currentState);
    display = snapshot(currentState);
    currentState = rest.state;
    await replay(rest.events);
    if (destroyed) return;
    // The recovery turn has no player action; runTurn plays the enemies' phase against the resting hero.
    await runTurn({ state: currentState, events: [] });
  }

  async function settle(allEvents) {
    fastForward = false;
    if (destroyed) return;
    const done = currentState.turn === 'won' || currentState.turn === 'lost';
    render(allEvents.length ? eventMessage(allEvents.at(-1)) : undefined);
    if (done) {
      playing = true;
      if (!reducedMotion) await delay(END_PAUSE_MS);
      playing = false;
    }
    if (!destroyed) onAction(currentState, { events: allEvents });
  }

  async function act(skillId) {
    if (destroyed || playing || currentState.turn !== 'player') return;
    sound?.sfx('select');
    await runTurn(useSkill(currentState, skillId, currentState.selectedUid));
  }

  async function actItem(itemId) {
    if (destroyed || playing || currentState.turn !== 'player') return;
    await runTurn(useItem(currentState, itemId));
  }

  function toggleItems(open) {
    if (destroyed || playing || currentState.turn !== 'player') return;
    itemMenu = open ?? !itemMenu;
    sound?.sfx('cursor');
    render();
    container.querySelector(itemMenu ? '[data-item-id]:not(:disabled), [data-item-back]' : '[data-item-menu]')?.focus();
  }

  function chooseTarget(uid) {
    if (destroyed || playing || currentState.turn !== 'player') return;
    const next = selectTarget(currentState, uid);
    if (next === currentState) return;
    currentState = next;
    sound?.sfx('cursor');
    render();
    onSelect(currentState);
  }

  function moveTarget(direction) {
    if (destroyed || playing || currentState.turn !== 'player') return;
    currentState = cycleTarget(currentState, direction);
    sound?.sfx('cursor');
    render();
    onSelect(currentState);
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

  function onClick(event) {
    if (skipPlayback(event)) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-battle-exit]')) { onExit(); return; }
    if (target?.closest('[data-topbar-extra]')) return;
    const enemy = target?.closest('[data-select-uid]');
    if (enemy) { chooseTarget(Number(enemy.dataset.selectUid)); return; }
    if (target?.closest('[data-item-menu]')) { toggleItems(true); return; }
    if (target?.closest('[data-item-back]')) { toggleItems(false); return; }
    const item = target?.closest('[data-item-id]');
    if (item && !item.disabled) { actItem(item.dataset.itemId); return; }
    const skill = target?.closest('[data-skill-id]');
    if (skill && !skill.disabled) act(skill.dataset.skillId);
  }

  function onKeydown(event) {
    if (document.querySelector('.modal-backdrop')) return; // the quit dialog owns the keyboard
    if (playing) {
      if (event.key === 'Enter' || event.key === ' ') skipPlayback(event);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      if (itemMenu) toggleItems(false); else onExit();
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      moveTarget(event.key === 'ArrowRight' ? 1 : -1);
      return;
    }
    if (itemMenu) {
      if (event.key === '1') { event.preventDefault(); actItem('potion'); }
      if (event.key === '5' || event.key === 'Backspace') { event.preventDefault(); toggleItems(false); }
      return;
    }
    if (event.key === '5' || event.key.toLowerCase() === 'i') { event.preventDefault(); toggleItems(true); return; }
    if (/^[1-4]$/.test(event.key)) {
      const id = HEROES[currentState.heroId].skills[Number(event.key) - 1];
      if (id) { event.preventDefault(); act(id); }
    }
  }

  container.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeydown);
  globalThis.addEventListener?.('resize', onResize);
  render();
  apMeter?.set(shownAp, { quiet: true });
  if (mustRecover(currentState)) queueMicrotask(() => runRecovery());

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
      effects.destroy();
      container.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeydown);
      globalThis.removeEventListener?.('resize', onResize);
      container.replaceChildren();
    },
  };
}
