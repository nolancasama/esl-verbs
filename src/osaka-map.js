// The Osaka campaign map: the pixel prefecture with one marker per city from
// src/region.js. Markers are buttons: a city under attack (or a saved city
// with a replayable campaign) can be chosen; locked cities cannot. The view
// owns no progress: app.js passes the region and handles the choice.
import { CITIES, CITY_CAMPAIGNS, cityStatus } from './region.js';
import { osakaMapClass } from './battle-art.js';

const STATE_LABEL = {
  saved: { mark: '★', ja: 'まもった！', en: 'SAVED' },
  danger: { mark: '!', ja: 'きけん！', en: 'UNDER ATTACK' },
  locked: { mark: '', ja: 'ロック', en: 'LOCKED' },
};

const el = (tag, className = '', text = '') => { const node = document.createElement(tag); node.className = className; node.textContent = text; return node; };

/** Whether a city in `status` can be chosen: under attack, or saved with a replayable (non-origin) campaign. */
function playable(cityId, status) {
  const campaign = CITY_CAMPAIGNS[CITIES[cityId]?.campaignId];
  return status === 'danger' || (status === 'saved' && Boolean(campaign) && !campaign.origin);
}
export function cityPlayable(region, cityId) { return playable(cityId, cityStatus(region, cityId)); }

function paintMarker(marker, status, cityId) {
  const label = STATE_LABEL[status];
  marker.className = `osaka-city osaka-city--${status}`;
  marker.querySelector('.osaka-city__pin').textContent = label.mark;
  marker.querySelector('.osaka-city__state').textContent = label.ja;
  marker.disabled = !playable(cityId, status);
  const city = CITIES[cityId];
  marker.setAttribute('aria-label', `${city.jaName} / ${city.name}: ${label.ja} ${label.en}`);
}

/**
 * Build the map. `justSaved` is a city that was just saved: it is drawn under
 * attack first and `reveal()` plays its change to saved. Returns { node, reveal }.
 */
export function osakaMapView({ region, justSaved = null, onSelect = () => {} }) {
  const node = el('div', `osaka-map ${osakaMapClass()}`);
  node.setAttribute('role', 'group'); node.setAttribute('aria-label', 'Osaka map / 大阪マップ');
  const biwa = el('span', 'osaka-map__biwa'); biwa.append(el('b', '', 'びわ湖'), el('small', '', '？'));
  biwa.setAttribute('aria-hidden', 'true');
  node.append(biwa);
  const markers = {};
  for (const city of Object.values(CITIES)) {
    const marker = el('button', 'osaka-city'); marker.type = 'button'; marker.dataset.city = city.id;
    marker.style.left = `${city.map.x}%`; marker.style.top = `${city.map.y}%`;
    const plate = el('span', 'osaka-city__plate');
    plate.append(el('b', 'osaka-city__name', city.jaName), el('span', 'osaka-city__state'));
    marker.append(el('span', 'osaka-city__pin'), plate);
    if (region.checkpoint?.cityId === city.id) marker.append(el('span', 'osaka-city__resume', `つづき STAGE ${region.checkpoint.stage}`));
    const status = city.id === justSaved ? 'danger' : cityStatus(region, city.id);
    paintMarker(marker, status, city.id);
    marker.onclick = () => { if (!marker.disabled) onSelect(city.id); };
    markers[city.id] = marker;
    node.append(marker);
  }

  let revealed = !justSaved;
  /** Flip the just-saved city to SAVED with a burst of light. */
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    const marker = markers[justSaved];
    if (!marker) return;
    paintMarker(marker, 'saved', justSaved);
    marker.classList.add('osaka-city--just-saved');
    const burst = el('span', 'osaka-city__burst'); burst.setAttribute('aria-hidden', 'true');
    marker.append(burst);
  };
  return { node, reveal };
}
