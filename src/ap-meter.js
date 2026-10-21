// The one horizontal ACTION POINTS meter that connects the Adventure quiz and
// battle. It is a single persistent DOM node: each screen mounts it into its
// own top-centre slot, so the fill keeps its width across re-renders and every
// change animates as a smooth fill or drain instead of a jump.
const MAX = 10;

export function createApMeter() {
  if (typeof document === 'undefined') return null;
  const el = document.createElement('div');
  el.className = 'ap-meter';
  el.setAttribute('role', 'meter');
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', String(MAX));
  el.innerHTML = `
    <div class="ap-meter__label"><span class="ap-meter__title">ACTION POINTS</span><span class="ap-meter__ja">こうどうポイント</span></div>
    <div class="ap-meter__row">
      <div class="ap-meter__track">
        <span class="ap-meter__trail"></span>
        <span class="ap-meter__fill"></span>
        <span class="ap-meter__notches"></span>
      </div>
      <strong class="ap-meter__value"><b class="ap-meter__now">0</b><span> / ${MAX}</span></strong>
      <span class="ap-meter__delta" aria-hidden="true"></span>
    </div>`;
  const fill = el.querySelector('.ap-meter__fill');
  const trail = el.querySelector('.ap-meter__trail');
  const now = el.querySelector('.ap-meter__now');
  const delta = el.querySelector('.ap-meter__delta');
  const track = el.querySelector('.ap-meter__track');
  let value = 0;
  let deltaTimer = null;

  const width = (ap) => `${Math.max(0, Math.min(MAX, ap)) * (100 / MAX)}%`;

  function paint(next, animate) {
    el.classList.toggle('ap-meter--instant', !animate);
    // Force layout so a freshly mounted node transitions from its previous width.
    void fill.offsetWidth;
    fill.style.width = width(next);
    trail.style.width = width(next);
    now.textContent = String(next);
    el.classList.toggle('ap-meter--empty', next <= 0);
    el.setAttribute('aria-valuenow', String(next));
    el.setAttribute('aria-label', `Action points ${next} of ${MAX}`);
  }

  function showDelta(amount) {
    if (!amount) return;
    clearTimeout(deltaTimer);
    delta.textContent = `${amount > 0 ? '+' : '−'}${Math.abs(amount)} AP`;
    delta.className = `ap-meter__delta ap-meter__delta--${amount > 0 ? 'gain' : 'spend'}`;
    void delta.offsetWidth;
    delta.classList.add('ap-meter__delta--show');
    el.classList.remove('ap-meter--gain', 'ap-meter--spend');
    void el.offsetWidth;
    el.classList.add(amount > 0 ? 'ap-meter--gain' : 'ap-meter--spend');
    deltaTimer = setTimeout(() => {
      delta.classList.remove('ap-meter__delta--show');
      el.classList.remove('ap-meter--gain', 'ap-meter--spend');
    }, 900);
  }

  paint(0, false);

  return {
    el,
    get value() { return value; },
    /** Zero-based segment bounds in viewport coordinates for the quiz mote. */
    segmentRect(index) {
      const rect = track.getBoundingClientRect();
      const left = rect.left + track.clientLeft;
      const width = track.clientWidth / MAX;
      return { left: left + Math.max(0, Math.min(MAX - 1, index)) * width, top: rect.top + track.clientTop, width, height: track.clientHeight };
    },
    /** Place the meter into a screen's slot (moving it from wherever it was). */
    mount(slot) {
      if (!slot) return;
      if (slot !== el) slot.replaceWith(el);
      el.hidden = false;
    },
    /** Set AP; animates by default and shows a +N / −N chip for the change. */
    set(next, { animate = true, quiet = false } = {}) {
      const target = Math.max(0, Math.min(MAX, Math.round(next)));
      const previous = value;
      const change = target - previous;
      value = target;
      paint(target, animate);
      if (animate && !quiet) showDelta(change);
      if (animate && !quiet && change > 0) {
        for (let index = previous; index < target; index += 1) {
          const pop = document.createElement('span');
          pop.className = 'ap-meter__pop'; pop.setAttribute('aria-hidden', 'true');
          pop.style.left = `${index * 10}%`; track.append(pop);
          setTimeout(() => pop.remove(), 200);
        }
        el.classList.remove('ap-meter--pulse'); void el.offsetWidth;
        el.classList.add('ap-meter--pulse');
        setTimeout(() => el.classList.remove('ap-meter--pulse'), 200);
      }
    },
    /** A short "not enough AP" shake. */
    deny() {
      el.classList.remove('ap-meter--deny');
      void el.offsetWidth;
      el.classList.add('ap-meter--deny');
    },
    setRecovering(on) { el.classList.toggle('ap-meter--recovering', Boolean(on)); },
    hide() { el.hidden = true; el.remove(); },
  };
}

/** Placeholder a screen renders where the meter should sit. */
export const AP_SLOT = '<span class="ap-slot" data-ap-slot></span>';
