// Plays pixel effects for battle events. Effects are cosmetic: battle logic
// never waits on them, the view only asks how long to show each event, and
// every node is removed when it finishes or when the view re-renders.
//
// Intensity tiers:
//   1 basic   (Slash, Strike, Magic Bolt, normal enemy hits): quick cut + small burst, no shake
//   2 special (Power Slash, Double Strike, Cleave, Heal, Barrier, Break, Counter): bigger art, short flash, small/medium shake
//   3 major   (Fireball, Shadow Strike, boss big attacks): a short cinematic — lighting shift,
//             travelling effect, large impact, medium shake, a zoom punch
import { effectSheet } from './pixel-effects.js';
import { sheetClass } from './pixel-core.js';
import { ENEMIES } from './battle-data.js';

const BOSS_STYLE = { dragon: 'breath', giantGolem: 'quake', demonKing: 'dark', vampireLord: 'blood' };
// Where each boss's big attack comes from, as fractions of its sprite box (sprites face left).
const BOSS_MOUTH = { dragon: [0.06, 0.3], demonKing: [0.3, 0.52], vampireLord: [0.32, 0.46], giantGolem: [0.2, 0.86] };

/** Duration in ms the view should show an event for, given effects; undefined = the view's default. */
export function createEffectsPlayer(root, { reducedMotion = false, sound = null } = {}) {
  const timers = new Set();
  let skill = null, hits = 0, enemyAction = null, enemyId = null, lastTarget = null;

  const field = () => root.querySelector('.battle-field');
  const spriteOf = (target) => root.querySelector(target === 'hero' ? '[data-combatant="hero"] .battle-sprite' : `[data-enemy-uid="${target}"] .battle-sprite`);
  const wrapOf = (target) => root.querySelector(target === 'hero' ? '[data-combatant="hero"] .battle-art-wrap' : `[data-enemy-uid="${target}"] .battle-art-wrap`);
  const sfx = (name) => sound?.sfx?.(name);

  function later(ms, fn) {
    const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
    timers.add(id);
  }

  /** Point inside a sprite's box as fractions (fx, fy), relative to the battle field. */
  function anchor(target, fx = 0.5, fy = 0.5) {
    const host = field(), node = spriteOf(target);
    if (!host || !node) return null;
    const a = host.getBoundingClientRect(), b = node.getBoundingClientRect();
    return { x: b.left - a.left + b.width * fx, y: b.top - a.top + b.height * fy, w: b.width, h: b.height };
  }
  const centre = (target, lift = 0.5) => anchor(target, 0.5, lift);

  // Centre of the enemies still drawn on the field (the state may already have them defeated).
  function formationCentre() {
    const uids = [...root.querySelectorAll('.battle-enemy:not(.battle-enemy--gone):not(.battle-enemy--pending)')].map((node) => Number(node.dataset.enemyUid));
    const points = uids.map((uid) => centre(uid, 0.55)).filter(Boolean);
    if (!points.length) return null;
    return { x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length };
  }
  function groundUnder(target) {
    const host = field(), node = spriteOf(target);
    if (!host || !node) return null;
    const a = host.getBoundingClientRect(), b = node.getBoundingClientRect();
    return { x: b.left - a.left + b.width / 2, y: b.bottom - a.top - 6 };
  }

  function spawn(name, at, { dur = 360, flip = false, loop = false, className = '', scale = 1, delay = 0 } = {}) {
    if (!at) return null;
    const run = () => {
      const host = field();
      const s = effectSheet(name);
      if (!host || !s) return null;
      const node = document.createElement('span');
      node.className = `px-fx ${sheetClass('pxe', name, s)}${loop ? ' px-fx--loop' : ''}${flip ? ' px-fx--flip' : ''}${reducedMotion ? ' px-fx--static' : ''} ${className}`;
      node.style.cssText = `left:${Math.round(at.x)}px;top:${Math.round(at.y)}px;--n:${s.frames};--dur:${dur}ms;--scale:${scale}`;
      node.setAttribute('aria-hidden', 'true');
      if (!loop) later(dur + 40, () => node.remove());
      host.append(node);
      return node;
    };
    if (delay) { later(delay, run); return null; }
    return run();
  }

  function projectile(name, from, to, dur, { delay = 0, then } = {}) {
    if (!from || !to || reducedMotion) { if (then) later(delay + dur, then); return; }
    later(delay, () => {
      const node = spawn(name, from, { loop: true, className: 'px-proj', flip: to.x < from.x });
      if (node) node.style.cssText += `;--dx:${Math.round(to.x - from.x)}px;--dy:${Math.round(to.y - from.y)}px;--travel:${dur}ms`;
      later(dur, () => { node?.remove(); then?.(); });
    });
  }

  function streak(from, to, kind = 'gold', delay = 0) {
    if (!from || !to || reducedMotion) return;
    later(delay, () => {
      const host = field();
      if (!host) return;
      const node = document.createElement('span');
      const dx = to.x - from.x, dy = to.y - from.y;
      node.className = `px-streak px-streak--${kind}`;
      node.style.cssText = `left:${Math.round(from.x)}px;top:${Math.round(from.y)}px;width:${Math.round(Math.hypot(dx, dy))}px;transform:rotate(${Math.atan2(dy, dx)}rad)`;
      node.setAttribute('aria-hidden', 'true');
      host.append(node);
      later(340, () => node.remove());
    });
  }

  /** Classes on the field: shake (s/m/l), punch (zoom); on the light layer: fire/shadow/blood/white/red/dark. */
  function fieldFx(kind, dur = 420, delay = 0) {
    if (reducedMotion) return;
    later(delay, () => {
      const host = field();
      if (!host) return;
      host.classList.remove(kind);
      void host.offsetWidth;
      host.classList.add(kind);
      later(dur, () => host.classList.remove(kind));
    });
  }
  const shake = (size, delay = 0) => fieldFx(`fx-shake-${size}`, size === 'l' ? 520 : 380, delay);
  const punch = (delay = 0) => fieldFx('fx-punch', 380, delay);
  function light(kind, dur = 700, delay = 0) {
    if (reducedMotion) return;
    later(delay, () => {
      const layer = root.querySelector('.battle-light');
      if (!layer) return;
      layer.className = 'battle-light';
      void layer.offsetWidth;
      layer.className = `battle-light fx-light--${kind}`;
      layer.style.setProperty('--light-dur', `${dur}ms`);
      later(dur, () => { if (layer.classList.contains(`fx-light--${kind}`)) layer.className = 'battle-light'; });
    });
  }

  /** Step the attacker toward its target and back (a fraction of the distance). */
  function dash(who, target, fraction, dur) {
    if (reducedMotion) return;
    const wrap = wrapOf(who), from = centre(who), to = centre(target);
    if (!wrap || !from || !to) return;
    wrap.style.setProperty('--dash-x', `${Math.round((to.x - from.x) * fraction)}px`);
    wrap.style.setProperty('--dash-dur', `${dur}ms`);
    wrap.classList.remove('fx-dash');
    void wrap.offsetWidth;
    wrap.classList.add('fx-dash');
    later(dur, () => wrap.classList.remove('fx-dash'));
  }

  /* -------------------------------------------------------------- events */

  function heroAttack(event, state) {
    skill = event.skillId; hits = 0;
    const target = event.target === 'hero' ? null : event.target;
    const hero = anchor('hero', 0.62, 0.42);
    switch (skill) {
      case 'slash':
      case 'strike':
        dash('hero', target, 0.42, 420); sfx('slash');
        return 300;
      case 'magicBolt':
        sfx('magic');
        projectile('boltProj', anchor('hero', 0.78, 0.32), centre(target, 0.45), 240, { delay: 120 });
        return 380;
      case 'powerSlash':
        dash('hero', target, 0.55, 640); sfx('charge');
        later(330, () => sfx('slash'));
        fieldFx('fx-flash-soft', 200, 360);
        return 520;
      case 'cleave': {
        dash('hero', target, 0.3, 560); sfx('charge');
        const mid = formationCentre();
        if (mid) spawn('cleaveSweep', { x: mid.x, y: mid.y + 6 }, { dur: 420, delay: 250 });
        later(260, () => sfx('slash'));
        shake('s', 340);
        return 560;
      }
      case 'doubleStrike':
        dash('hero', target, 0.6, 640); sfx('slash');
        return 260;
      case 'fireball': {
        const mid = formationCentre();
        sfx('magic');
        light('fire', 1150);
        spawn('runeCircle', groundUnder('hero'), { dur: 700 });
        projectile('fireProj', anchor('hero', 0.72, 0.18), mid, 320, { delay: 360 });
        later(360, () => sfx('fire'));
        if (mid) {
          spawn('fireBlast', mid, { dur: 620, delay: 680, scale: 1.1 });
          spawn('embers', { x: mid.x, y: mid.y - 10 }, { dur: 600, delay: 820 });
        }
        later(680, () => sfx('bigHit'));
        shake('m', 690); punch(680); light('white', 160, 680);
        return 980;
      }
      case 'shadowStrike': {
        const to = centre(target, 0.5);
        sfx('shadow');
        light('shadow', 900);
        spawn('shadowPuff', centre('hero', 0.55), { dur: 420 });
        streak(anchor('hero', 0.6, 0.5), to, 'shadow', 260);
        dash('hero', target, 0.85, 700);
        if (to) spawn('shadowPuff', to, { dur: 380, delay: 330 });
        later(520, () => sfx('slash'));
        shake('s', 540);
        return 620;
      }
      default:
        return 220;
    }
  }

  function enemyAttack(event, state) {
    enemyAction = event.action;
    const enemy = state.enemies.find((candidate) => candidate.uid === event.source);
    enemyId = enemy?.id ?? null;
    const heavy = event.action === 'heavy';
    const hero = centre('hero', 0.45);
    if (!heavy) {
      if (!ENEMIES[enemyId]?.boss) dash(event.source, 'hero', 0.18, 380);
      if (event.action === 'drain') { sfx('drain'); light('blood', 500); }
      return 300;
    }
    const style = BOSS_STYLE[enemyId];
    const [mx, my] = BOSS_MOUTH[enemyId] || [0.3, 0.5];
    const mouth = anchor(event.source, mx, my);
    if (style === 'breath') {
      sfx('charge');
      spawn('chargeGather', mouth, { dur: 320 });
      light('fire', 1150);
      fieldFx('fx-warn', 260, 120);
      if (mouth && hero) {
        for (let i = 0; i < 8; i += 1) {
          const t = (i + 1) / 8;
          spawn('breath', { x: mouth.x + (hero.x - mouth.x) * t, y: mouth.y + (hero.y - mouth.y) * t + Math.sin(t * Math.PI) * -6 }, { dur: 360, delay: 330 + i * 55, flip: true, scale: 0.8 + t * 0.6 });
        }
      }
      later(330, () => sfx('fire'));
      light('white', 200, 780); shake('m', 780);
      return 1000;
    }
    if (style === 'quake') {
      sfx('charge');
      later(260, () => sfx('quake'));
      spawn('quakeCrack', groundUnder('hero'), { dur: 700, delay: 260, scale: 1.2 });
      spawn('debris', groundUnder('hero'), { dur: 560, delay: 300 });
      spawn('debris', groundUnder(event.source), { dur: 560, delay: 260 });
      shake('l', 260); punch(260);
      return 900;
    }
    if (style === 'dark') {
      sfx('dark');
      light('shadow', 1100);
      spawn('darkGather', mouth, { dur: 420 });
      projectile('darkOrb', mouth, hero, 300, { delay: 400 });
      spawn('darkBurst', hero, { dur: 560, delay: 700 });
      later(700, () => sfx('bigHit'));
      shake('m', 700); light('white', 180, 700);
      return 980;
    }
    if (style === 'blood') {
      sfx('dark');
      light('blood', 1000);
      spawn('bloodMoon', anchor(event.source, 0.5, 0.05), { dur: 700 });
      spawn('bloodSlash', hero, { dur: 420, delay: 480, flip: true });
      later(480, () => sfx('slash'));
      shake('m', 500);
      return 820;
    }
    // Tier-2 enemy heavies (Rock Smash, Captain Slash)
    dash(event.source, 'hero', 0.25, 460);
    sfx('charge');
    return 420;
  }

  function damage(event, state) {
    const at = centre(event.target, event.target === 'hero' ? 0.45 : 0.5);
    if (event.amount === 0) { spawn('poof', at, { dur: 300 }); sfx('guard'); return 320; }
    if (event.target === 'hero') {
      const heavy = enemyAction === 'heavy';
      if (!BOSS_STYLE[enemyId] || !heavy) spawn(heavy ? 'bigImpact' : 'impact', at, { dur: heavy ? 420 : 320 });
      if (enemyAction === 'drain') {
        projectile('drainOrb', at, centre(event.source ?? lastTarget, 0.4), 320);
        spawn('bloodSlash', at, { dur: 360, flip: true });
      }
      sfx(heavy ? 'bigHit' : 'hit');
      if (heavy) { light('red', 260); if (!BOSS_STYLE[enemyId]) shake('m'); }
      return heavy ? 460 : 320;
    }
    lastTarget = event.target;
    hits += 1;
    switch (skill) {
      case 'slash': spawn('slash', at, { dur: 300 }); spawn('impact', at, { dur: 280, delay: 80 }); sfx('hit'); return 320;
      case 'strike': spawn('strikeX', at, { dur: 280 }); spawn('impact', at, { dur: 260, delay: 60 }); sfx('hit'); return 300;
      case 'magicBolt': spawn('boltHit', at, { dur: 320 }); sfx('hit'); return 320;
      case 'powerSlash':
        spawn('bigSlash', at, { dur: 460 }); spawn('bigImpact', at, { dur: 420, delay: 120 });
        sfx('bigHit'); shake('m', 100); punch(100);
        return 480;
      case 'cleave': spawn('slash', at, { dur: 260, flip: hits % 2 === 0 }); spawn('impact', at, { dur: 240 }); sfx('hit'); return 200;
      case 'doubleStrike':
        spawn(hits % 2 ? 'quickA' : 'quickB', at, { dur: 280 }); spawn('impact', at, { dur: 220, delay: 60 });
        sfx('slash'); if (hits % 2 === 0) shake('s');
        return hits % 2 ? 230 : 320;
      case 'fireball': spawn('fireHit', at, { dur: 300 }); sfx('hit'); return 220;
      case 'shadowStrike':
        spawn('darkSlash', at, { dur: 380, scale: hits === 1 ? 1.4 : 1 }); spawn('impact', at, { dur: 260, delay: 100 });
        sfx('bigHit'); if (hits === 1) { shake('m'); punch(); }
        return hits === 1 ? 420 : 300;
      default: spawn('impact', at, { dur: 300 }); sfx('hit'); return 320;
    }
  }

  function play(event, state) {
    if (reducedMotion) {
      // Keep essential feedback only: a static hit flash, no motion, no shake.
      if (event.type === 'damage' && event.amount > 0) spawn('impact', centre(event.target, 0.45), { dur: 200 });
      return undefined;
    }
    switch (event.type) {
      case 'attack': return event.source ? enemyAttack(event, state) : heroAttack(event, state);
      case 'damage': return damage(event, state);
      case 'heal': {
        const at = centre(event.target, 0.5);
        if (event.target === 'hero') { spawn(skill === 'heal' ? 'healPillar' : 'potionFx', centre('hero', 0.45), { dur: 560 }); sfx('heal'); return 520; }
        if (event.source && event.source !== event.target) {
          projectile('healOrb', centre(event.source, 0.3), at, 260, { then: () => spawn('potionFx', centre(event.target, 0.5), { dur: 380 }) });
          sfx('heal'); return 500;
        }
        spawn(enemyAction === 'drain' ? 'drainHeal' : 'potionFx', at, { dur: 420 }); sfx('heal');
        return 420;
      }
      case 'item': skill = 'potion'; spawn('potionFx', centre('hero', 0.4), { dur: 520 }); sfx('potion'); return 460;
      case 'defend':
        if (event.defense === 'barrier') { spawn('barrierForm', centre('hero', 0.55), { dur: 520 }); sfx('barrier'); return 520; }
        if (event.defense === 'guard') { spawn('guardFx', centre('hero', 0.45), { dur: 360 }); sfx('guard'); return 360; }
        sfx('cursor'); return 320;
      case 'barrierUp': spawn('barrierForm', centre('hero', 0.55), { dur: 520 }); sfx('barrier'); return 480;
      case 'guard': spawn('guardFx', centre(event.target, 0.45), { dur: 320 }); sfx('guard'); return 320;
      case 'charge': {
        const boss = ENEMIES[state.enemies.find((enemy) => enemy.uid === event.target)?.id]?.boss;
        spawn('chargeGather', centre(event.target, 0.45), { dur: 480, scale: boss ? 1.6 : 1 });
        sfx('charge');
        if (boss) light('warn', 420);
        return 520;
      }
      case 'summon':
        if (event.target != null) {
          spawn('summon', centre(event.target, 0.7), { dur: 480 });
          spriteOf(event.target)?.classList.add('px-summoned');
          sfx('summon');
        }
        return 480;
      case 'comboReady':
      case 'counterReady': spawn('status', centre('hero', 0.1), { dur: 320 }); sfx('ap'); return 320;
      case 'combo':
      case 'counter': spawn('counterX', centre(event.target, 0.5), { dur: 360 }); sfx('guard'); return 340;
      case 'opening':
      case 'opening-hit': spawn('eyeFx', centre(event.target, 0.2), { dur: 300 }); return 320;
      case 'break': spawn('breakFx', centre(event.target, 0.5), { dur: 520 }); sfx('break'); shake('m'); light('white', 200); return 560;
      case 'ap': spawn('sparkle', centre('hero', 0.2), { dur: 300 }); sfx('ap'); return 320;
      case 'recover': spawn('recoverFx', centre('hero', 0.5), { dur: 620 }); sfx('recover'); return 700;
      case 'chain': {
        const from = centre(lastTarget, 0.5), to = centre(event.target, 0.5);
        streak(from, to, 'shadow');
        lastTarget = event.target;
        sfx('shadow');
        return 260;
      }
      case 'enrage': spawn('enrage', centre(event.target, 0.5), { dur: 520, scale: 1.5 }); sfx('charge'); light('red', 420); shake('s'); return 720;
      case 'defeat': {
        const foe = state.enemies.find((enemy) => enemy.uid === event.target);
        const boss = ENEMIES[foe?.id]?.boss;
        spawn(boss ? 'bossBurst' : 'poof', centre(event.target, 0.55), { dur: boss ? 700 : 400, scale: boss ? 1.4 : 1 });
        sfx('defeat');
        if (boss) { light('white', 300); shake('m'); }
        return boss ? 760 : 620;
      }
      case 'victory': spawn('sparkle', centre('hero', 0.2), { dur: 300 }); spawn('sparkle', centre('hero', 0.6), { dur: 300, delay: 150 }); return 650;
      default: return undefined;
    }
  }

  function clear() {
    root.querySelectorAll('.px-fx, .px-streak').forEach((node) => node.remove());
  }

  function destroy() {
    timers.forEach((id) => clearTimeout(id));
    timers.clear();
    clear();
  }

  return { play, clear, destroy };
}
