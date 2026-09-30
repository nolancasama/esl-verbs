import { VOCABULARY } from './vocab.js';
import { isJapaneseCorrect } from './normalize.js';
import { MODES, answer, choiceFallback, createRound, makeChoices, practiceItems, viewModel } from './engine.js';
import { TapToTalk } from './speech.js';
import { speak } from './tts.js';
import { BALANCE, CAMPAIGN, ENCOUNTERS, ENEMIES, HEROES, LEVELS, SKILLS } from './battle-data.js';
import { battleXp, chooseEncounter, createBattle } from './battle-engine.js';
import {
  applyVictory, battleAp, battleSetup, campaignMaxHp, campaignSummary, chapterRest, createCampaign, recordDefeat, recordStage, resumeCampaign, xpProgress,
} from './campaign.js';
import { createBattleView } from './battle-ui.js';
import { ART_IDS, SPRITE_STATES, backdropClass, battleArt, cityClass, effectArt, getIcon, groundClass, prewarmArt } from './battle-art.js';
import {
  ADVENTURE_RECORDS_KEY, FINAL_BOSSES, completedHeroes, heroTitle, nextHeroTitle, parseRecords, recordCompletion,
} from './records.js';
import { createApMeter } from './ap-meter.js';
import { CITY_STORIES, ENDING_STORY, INTRO_STORY, cardMs, rubyParts } from './story.js';
import {
  CITIES, CITY_CAMPAIGNS, REGION_KEY, markCitySaved, parseRegion, serializeRegion, stageCheckpoint, stageCount, stageEncounterId, stageMode,
} from './region.js';
import { cityPlayable, osakaMapView } from './osaka-map.js';
import { createAudio } from './audio.js';

const app = document.querySelector('#app');
const MIC_FREE_KEY = 'esl-verbs-mic-free';
const MIC_MESSAGE = '音声認識を使えません。「マイクなし」を使ってください。';
const ADVENTURE_MIC_MESSAGE = 'マイクが使えないので、えらんで答えよう！';
const titles = {
  1: ['English → Japanese', 'See and hear English. Type Japanese.', 'えいごを見て聞いて、日本語を書こう'],
  2: ['Listen → Japanese', 'Hear English. Type Japanese.', 'えいごを聞いて、日本語を書こう'],
  3: ['Japanese → Speak English', 'See and hear Japanese. Say the English word.', '日本語を見て聞いて、えいごで言おう'],
  4: ['Listen → Speak English', 'Hear Japanese. Say the English word.', '日本語を聞いて、えいごで言おう'],
};
const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const apMeter = createApMeter();
const audio = createAudio();
let micFree = readMicFree(), round = null, quizContext = null, feedback = '', audioError = false;
// speechFailed: recognition kept erroring during this Adventure stage, so it falls back to choices.
let recognitionErrors = 0, speechDenied = false, speechFailed = false, tap = null, lastHeard = '';
let campaign = null, stageResult = null, battleView = null, screen = 'menu', debugConfig = null, screenTimers = [], upcomingEncounter = null;
let campaignOutcome = null; // the finished campaign's saved record, for the results screen

function readMicFree() { try { return localStorage.getItem(MIC_FREE_KEY) === 'true'; } catch { return false; } }
function saveMicFree(value) { try { localStorage.setItem(MIC_FREE_KEY, String(value)); } catch {} }
function readRecords() { let raw = null; try { raw = localStorage.getItem(ADVENTURE_RECORDS_KEY); } catch {} return parseRecords(raw, ART_IDS.heroes); }
function saveRecords(records) { try { localStorage.setItem(ADVENTURE_RECORDS_KEY, JSON.stringify(records)); } catch {} }
function readRegion() { let raw = null; try { raw = localStorage.getItem(REGION_KEY); } catch {} return parseRegion(raw, ART_IDS.heroes); }
function saveRegion(region) { try { localStorage.setItem(REGION_KEY, serializeRegion(region)); } catch {} }
/** Speech questions become multiple choice: Study by the student's マイクなし choice, Adventure only when speech cannot work. */
function answerByChoices() {
  return choiceFallback({ context: isAdventure() ? 'adventure' : 'study', micFree, speechAvailable: speechRecognitionAvailable(), speechDenied, speechFailed });
}
function currentItem() { return round?.items[round.currentIndex]; }
function setMicFree(value) { micFree = value; saveMicFree(value); if (round) renderQuestion(false); }
function element(tag, className = '', text = '') { const node = document.createElement(tag); node.className = className; node.textContent = text; return node; }
function speechRecognitionAvailable() { return Boolean(globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition); }
function stopMedia() { tap?.cancel(); tap = null; globalThis.speechSynthesis?.cancel?.(); }
function clearBattle() { battleView?.destroy?.(); battleView = null; }
function clearTimers() { screenTimers.forEach((id) => clearTimeout(id)); screenTimers = []; }
function later(ms, fn) { screenTimers.push(setTimeout(fn, ms)); }
function clearScreen() { stopMedia(); clearBattle(); clearTimers(); apMeter?.hide(); app.replaceChildren(); app.className = 'app'; }
function isAdventure() { return quizContext === 'adventure' && campaign; }

/* ------------------------------------------------------------------ sound */

function musicToggle() {
  const button = element('button', 'music-toggle px-button secondary');
  button.type = 'button';
  button.dataset.musicToggle = '';
  paintMusicToggle(button);
  return button;
}
function paintMusicToggle(button) {
  button.textContent = `♫ MUSIC ${audio.enabled ? 'ON' : 'OFF'}`;
  button.setAttribute('aria-pressed', String(audio.enabled));
  button.classList.toggle('music-toggle--off', !audio.enabled);
}
const musicToggleMarkup = () => `<button type="button" class="music-toggle px-button secondary${audio.enabled ? '' : ' music-toggle--off'}" data-music-toggle data-topbar-extra aria-pressed="${audio.enabled}">♫ MUSIC ${audio.enabled ? 'ON' : 'OFF'}</button>`;
document.addEventListener('click', (event) => {
  const toggle = event.target instanceof Element ? event.target.closest('[data-music-toggle]') : null;
  if (!toggle) return;
  audio.setEnabled(!audio.enabled);
  document.querySelectorAll('[data-music-toggle]').forEach(paintMusicToggle);
});
['pointerdown', 'keydown'].forEach((type) => document.addEventListener(type, () => audio.unlock(), { capture: true, passive: true }));

/* ------------------------------------------------------------------ menus */

function mainMenu() {
  clearScreen(); round = null; quizContext = null; campaign = null; stageResult = null; screen = 'menu';
  audio.play('title');
  const card = element('section', 'card menu-card'); card.append(element('h1', 'game-title', 'ESL VERBS'));
  const actions = element('div', 'menu-actions');
  const region = readRegion(); const continuing = region.savedCities.length > 0;
  // Adventure is the game: one big framed button with a play arrow. Practice is the quiet last choice.
  const adventure = element('button', 'menu-choice adventure-choice px-button'); adventure.onclick = continuing ? osakaMapScreen : heroSelect;
  adventure.setAttribute('aria-label', continuing ? 'Continue adventure / 大阪を まもる' : 'Start adventure / ぼうけんを はじめる');
  // Hero sheets are slow to build on a Chromebook: paint the menu first, then add each hero as it is ready.
  const trio = element('span', 'adventure-trio'); trio.setAttribute('aria-hidden', 'true');
  const menuHeroes = continuing && region.heroId ? [region.heroId] : ART_IDS.heroes;
  prewarmArt(menuHeroes.map((id) => [id]), (id) => trio.insertAdjacentHTML('beforeend', battleArt(id)));
  const cta = element('span', 'adventure-cta'); cta.append(element('span', 'adventure-cta__arrow', '▶'), element('span', '', continuing ? 'CONTINUE ADVENTURE' : 'START ADVENTURE'));
  adventure.append(trio, cta, element('small', '', continuing ? '大阪を まもる' : 'ぼうけんを はじめる！'));
  if (continuing) {
    const restart = element('button', 'menu-choice new-adventure-choice px-button secondary'); restart.onclick = confirmNewAdventure;
    restart.append(element('span', '', 'START NEW ADVENTURE'), element('small', '', 'あたらしく はじめる'));
    actions.append(adventure, restart);
  } else actions.append(adventure);
  const study = element('button', 'menu-choice practice-choice secondary'); study.onclick = levelSelect;
  study.append(element('span', '', 'PRACTICE ONLY'), element('small', '', 'れんしゅうだけ'));
  const toggles = element('div', 'menu-toggles'); toggles.append(musicToggle());
  actions.append(study); card.append(actions, toggles); app.append(card);
}

function levelSelect() {
  clearScreen(); round = null; quizContext = null; screen = 'study-select';
  audio.stop();
  const card = element('section', 'card'); card.append(element('h1', '', 'Practice / れんしゅう'));
  const back = element('button', 'secondary', '← Main Menu'); back.onclick = mainMenu; card.append(back);
  const levels = element('div', 'levels');
  Object.entries(titles).forEach(([mode, title]) => {
    const button = element('button', 'level'); button.append(element('strong', '', `${mode}. ${title[0]}`), element('small', '', `${title[1]} (${title[2]})`));
    button.onclick = () => startRound(Number(mode)); levels.append(button);
  });
  card.append(levels, micToggle()); app.append(card);
}

function rpgScreen() { app.className = 'app rpg-app'; }
function heroSelect() {
  clearScreen(); rpgScreen(); screen = 'hero-select'; const card = element('section', 'hero-select px-panel');
  audio.play('title');
  const top = element('div', 'topline'); const title = element('h1', '', 'CHOOSE YOUR HERO'); title.append(element('small', '', 'ヒーローをえらぼう'));
  const back = element('button', 'secondary px-button', '← Main Menu'); back.onclick = mainMenu;
  const right = element('div', 'topline-actions'); right.append(musicToggle(), back); top.append(title, right); card.append(top);
  const grid = element('div', 'hero-grid');
  // Replay progress appears only once some hero has finished a campaign.
  const records = readRecords(); const anyDone = completedHeroes(records).length > 0;
  Object.values(HEROES).forEach((hero) => {
    const button = element('button', 'hero-card px-button'); button.dataset.hero = hero.id; const art = element('span', 'hero-card-art'); art.innerHTML = battleArt(hero.id);
    art.firstElementChild?.setAttribute('aria-hidden', 'true');
    const record = records.heroes[hero.id];
    let progress = '';
    if (record?.completed) {
      button.classList.add('hero-card--done');
      const badge = element('span', 'hero-badge hero-badge--done'); badge.append(element('b', '', `★ ${record.bestCorrect}/40`), element('span', '', record.bestTitle));
      art.append(badge); progress = ` Completed. Best ${record.bestCorrect}/40, ${record.bestTitle}.`;
    } else if (anyDone) { art.append(element('span', 'hero-badge hero-badge--new', 'NEW!')); progress = ' New!'; }
    button.append(art, element('strong', '', hero.name.toUpperCase()), element('span', 'hero-ja', hero.jaName), element('span', 'hero-kana', hero.kanaSummary), element('small', '', hero.summary));
    button.setAttribute('aria-label', `${hero.name} / ${hero.jaName}: ${hero.kanaSummary} ${hero.summary}${progress}`);
    button.onclick = () => startCampaign(hero.id); grid.append(button);
  }); card.append(grid);
  if (completedHeroes(records).length === ART_IDS.heroes.length) card.append(element('p', 'all-heroes rpg-burst', 'ALL HEROES COMPLETE! ★★★'));
  app.append(card);
  // The intro cinematic's city is drawn now, so choosing a hero starts it without a stall.
  ['calm', 'danger', 'monsters'].forEach((mood) => cityClass(mood));
  prewarmArt([['trainingDummy']]);
}

/* ------------------------------------------------------------------- quiz */

function startCampaign(heroId) {
  campaign = createCampaign(heroId); campaignOutcome = null;
  introCinematic(() => startRound(stageMode(campaign), createRound(VOCABULARY), 'adventure'));
}
function startRound(mode, items = createRound(VOCABULARY), context = 'study') {
  round = { mode, items, currentIndex: 0, correctCount: 0, currentStreak: 0, bestStreak: 0, missedIds: new Set(), allItems: VOCABULARY };
  quizContext = context; feedback = ''; audioError = false; recognitionErrors = 0; speechFailed = false;
  if (context === 'study' && mode >= 3 && !micFree && !speechRecognitionAvailable()) { micFree = true; saveMicFree(true); feedback = MIC_MESSAGE; }
  if (context === 'adventure') {
    if (!CITY_CAMPAIGNS[campaign.cityId]?.origin) saveRegion(stageCheckpoint(readRegion(), campaign));
    apMeter?.set(0, { animate: false }); audio.play('field'); prepareEncounter();
  } else audio.stop();
  renderQuestion();
}

/** Pick this stage's encounter now and build its art while the student answers, so the battle opens without a stall. */
function prepareEncounter() {
  const encounterId = stageEncounterId(campaign);
  upcomingEncounter = ENCOUNTERS[encounterId];
  if (!upcomingEncounter) return;
  const art = [];
  const waves = upcomingEncounter.waves ?? [{ enemyIds: upcomingEncounter.enemyIds }];
  new Set(waves.flatMap((wave) => wave.enemyIds)).forEach((id) => {
    const enemy = ENEMIES[id];
    art.push([id]);
    if (enemy.summonId) art.push([enemy.summonId]);
    if (enemy.ai?.phase2) art.push([id, 'enraged']);
  });
  if (upcomingEncounter.ally) art.push([upcomingEncounter.ally.id ?? 'osakaDefender']);
  prewarmArt(art);
}

function renderQuestion(autoSpeak = true) {
  if (isAdventure()) { renderAdventureQuestion(autoSpeak); return; }
  tap?.cancel(); tap = null; clearBattle(); screen = 'study-quiz';
  const item = currentItem(); const vm = viewModel(round.mode, item, { micFree: answerByChoices() }); app.replaceChildren(); app.className = 'app';
  const card = element('section', 'card'); const top = element('div', 'topline');
  const back = element('button', 'secondary', '← Level select'); back.onclick = levelSelect;
  const hud = element('div', 'hud', `${round.currentIndex + 1} / ${round.items.length}`); top.append(back, hud); card.append(top);
  if (round.currentStreak >= 2) card.append(element('div', 'streak', `${round.currentStreak} in a row!`));
  card.append(element('div', vm.promptText === null ? 'prompt audio-icon' : 'prompt', vm.promptText ?? '🔊'));
  const controls = element('div', 'actions'); const replay = element('button', 'secondary', '🔊 Replay'); replay.onclick = () => playPrompt(vm); controls.append(replay);
  if (round.mode >= 3) controls.append(micToggle());
  if (audioError) controls.append(element('div', 'audio-error', MODES[round.mode].showPrompt ? '音が出ません（表示のことばを読んでください）' : '音が出ません'));
  card.append(controls, answerArea(vm, item)); app.append(card); if (autoSpeak) playPrompt(vm);
}

/** Quiz reactions never look like combat damage: a miss is a surprised stumble, and HP is untouched. */
function heroQuizPose(strike = false) {
  if (strike) return TRAINING_STRIKE[campaign.heroId]?.pose ?? 'attack';
  if (/^(Wrong|Answer)/.test(feedback)) return 'stumble';
  return 'idle';
}

// A correct Adventure answer is a quick class strike on the training dummy; the
// AP point lands when the hit does. Timings in ms from the answer.
const TRAINING_STRIKE = {
  fighter: { pose: 'attack', hit: 'slash', impact: 230 },
  mage: { pose: 'cast', projectile: 'boltProj', launch: 160, hit: 'boltHit', impact: 420 },
  ninja: { pose: 'attack', hit: 'strikeX', impact: 200 },
};
let quizStrike = false; // set by a correct Adventure answer; the next render plays it once

/** The Action Energy gauge: a mirror of the same AP value as the top meter, never its own state. */
function actionEnergy(value) {
  const box = element('div', 'rpg-energy'); box.setAttribute('aria-hidden', 'true');
  const label = element('span', 'rpg-energy__label'); label.append(element('b', '', 'ACTION ENERGY'), element('small', '', 'アクション・エネルギー'));
  const cells = element('span', 'rpg-energy__cells');
  for (let index = 0; index < BALANCE.maxAp; index += 1) cells.append(element('i', index < value ? 'is-on' : ''));
  box.append(element('span', 'rpg-energy__core'), label, cells);
  box.charge = (next) => {
    const cell = cells.children[next - 1];
    cell?.classList.add('is-on', 'is-new');
    box.classList.remove('is-charged'); void box.offsetWidth; box.classList.add('is-charged');
  };
  return box;
}

/** A one-shot pixel effect inside the quiz field, centred on (x, y). */
function fieldEffect(field, name, x, y, { dur = 360, travel = null } = {}) {
  const art = effectArt(name);
  if (!art) return null;
  const node = element('span', `px-fx ${art.className}${travel ? ' px-fx--loop px-proj' : ''}`);
  node.style.cssText = `left:${Math.round(x)}px;top:${Math.round(y)}px;--n:${art.frames};--dur:${dur}ms`
    + (travel ? `;--dx:${Math.round(travel.dx)}px;--dy:${Math.round(travel.dy)}px;--travel:${travel.ms}ms` : '');
  node.setAttribute('aria-hidden', 'true');
  field.append(node);
  later((travel?.ms ?? dur) + 40, () => node.remove());
  return node;
}

function trainingStrike({ field, heroNode, dummy, energy, value }) {
  const move = TRAINING_STRIKE[campaign.heroId] ?? TRAINING_STRIKE.fighter;
  const heroSprite = heroNode.querySelector('.battle-sprite'), dummySprite = dummy.querySelector('.battle-sprite');
  const land = () => { apMeter?.set(value); energy.charge(value); };
  if (reducedMotion()) { land(); return; }
  const box = field.getBoundingClientRect(), from = heroNode.getBoundingClientRect(), to = dummy.getBoundingClientRect();
  const at = { x: to.left - box.left + to.width * 0.5, y: to.top - box.top + to.height * 0.45 };
  if (move.projectile) {
    const start = { x: from.right - box.left - from.width * 0.15, y: from.top - box.top + from.height * 0.38 };
    later(move.launch, () => fieldEffect(field, move.projectile, start.x, start.y, { travel: { dx: at.x - start.x, dy: at.y - start.y, ms: move.impact - move.launch } }));
  }
  later(move.impact, () => {
    fieldEffect(field, move.hit, at.x, at.y);
    fieldEffect(field, 'impact', at.x, at.y, { dur: 300 });
    if (dummySprite) dummySprite.dataset.state = 'hit';
    dummy.classList.add('is-hit');
    audio.sfx('hit');
    land();
  });
  later(move.impact + 460, () => { dummy.classList.remove('is-hit'); if (dummySprite) dummySprite.dataset.state = 'idle'; });
  later(Math.max(700, move.impact + 300), () => { if (heroSprite) heroSprite.dataset.state = 'idle'; });
}

/**
 * Adventure quiz: one training field under a thin top strip (menu, AP, music).
 * The word, the answer, the hero and a training dummy share the scene; a
 * correct answer is a strike on the dummy that charges the Action Energy.
 */
function renderAdventureQuestion(autoSpeak = true) {
  tap?.cancel(); tap = null; clearBattle(); clearTimers(); screen = 'adventure-quiz';
  const item = currentItem(); const vm = viewModel(round.mode, item, { micFree: answerByChoices() });
  const stage = campaign.stage; const hero = HEROES[campaign.heroId];
  const strike = quizStrike; quizStrike = false;
  app.replaceChildren(); app.className = 'app rpg-app rpg-quiz-app';
  const root = element('section', `rpg-quiz stage-${stage}`);
  const { top, slot } = rpgTopbar();

  const field = element('div', `rpg-field rpg-field--${vm.input}`);
  field.append(element('div', `rpg-field__sky ${backdropClass(stage)}`), element('div', `rpg-field__ground ${groundClass(stage)}`));

  const hud = element('div', 'rpg-field__hud');
  hud.append(element('span', 'rpg-field__stage', `STAGE ${stage}`), element('span', 'rpg-field__mode', titles[round.mode][2]), element('span', 'rpg-field__count', `${round.currentIndex + 1} / ${round.items.length}`));
  const energy = actionEnergy(round.correctCount - (strike ? 1 : 0));

  const arena = element('div', 'rpg-field__arena');
  const prompt = element('div', 'rpg-field__prompt');
  const speaker = element('button', 'rpg-speaker px-button secondary', '🔊'); speaker.type = 'button';
  speaker.setAttribute('aria-label', 'Listen again / もういちど きく'); speaker.onclick = () => playPrompt(vm);
  if (vm.promptText === null) {
    // Listening modes have no word to show: the speaker itself is the prompt.
    prompt.classList.add('rpg-field__prompt--audio'); speaker.classList.add('rpg-speaker--big');
    prompt.append(speaker, element('span', 'rpg-field__listen', 'きいて こたえよう！'));
  } else prompt.append(element('span', 'rpg-field__word', vm.promptText), speaker);
  const heroNode = element('span', 'rpg-field__hero'); heroNode.innerHTML = battleArt(hero.id, heroQuizPose(strike));
  const dummy = element('span', 'rpg-field__dummy'); dummy.innerHTML = battleArt('trainingDummy');
  [heroNode, dummy].forEach((node) => node.firstElementChild?.setAttribute('aria-hidden', 'true'));
  arena.append(prompt, heroNode, dummy);
  if (round.currentStreak >= 2) arena.append(element('div', 'rpg-field__streak', `${round.currentStreak} in a row!`));

  const bottom = element('div', 'rpg-field__bottom');
  const mini = element('div', 'rpg-field__mini');
  const potions = element('span', 'rpg-field__potions'); potions.innerHTML = getIcon('potion'); potions.append(`×${campaign.potions}`);
  potions.setAttribute('aria-label', `ポーション ×${campaign.potions}`);
  mini.append(element('strong', '', `${hero.name.toUpperCase()} LV ${campaign.level}`), hpLine(campaign.heroHp, campaignMaxHp(campaign)), potions);
  const answer = answerArea(vm, item, true); answer.classList.add('rpg-field__answer');
  answer.classList.toggle('is-answered', /^(Correct|Wrong|Answer)/.test(feedback));
  // Adventure speech stages have no マイクなし: choices appear only when the mic cannot work.
  if (round.mode >= 3 && vm.input === 'choices') answer.append(element('span', 'rpg-field__note', ADVENTURE_MIC_MESSAGE));
  if (audioError) answer.append(element('div', 'audio-error', MODES[round.mode].showPrompt ? '音が出ません（表示のことばを読んでください）' : '音が出ません'));
  bottom.append(mini, answer, element('span', 'rpg-field__balance'));

  field.append(hud, energy, arena, bottom);
  root.append(top, field); app.append(root);
  apMeter?.mount(slot);
  if (strike) trainingStrike({ field, heroNode, dummy, energy, value: round.correctCount });
  else apMeter?.set(round.correctCount);
  if (autoSpeak) playPrompt(vm);
}

function hpLine(hp, maxHp) {
  const line = element('span', 'rpg-hp');
  const ratio = hp / maxHp;
  line.classList.toggle('rpg-hp--low', ratio <= 0.5); line.classList.toggle('rpg-hp--danger', ratio <= 0.25);
  const track = element('span', 'rpg-hp__track'); const fill = element('span', 'rpg-hp__fill'); fill.style.width = `${Math.max(0, Math.min(100, ratio * 100))}%`; track.append(fill);
  line.append(element('b', '', 'HP'), track, element('span', '', `${hp}/${maxHp}`));
  return line;
}

function answerArea(vm, item, rpg = false) {
  const btn = (className, text) => element('button', `${className}${rpg ? ' px-button' : ''}`.trim(), text);
  const area = element('div', `answer${rpg ? ' rpg-answer' : ''}`); const tone = feedback.startsWith('Correct') ? ' correct' : feedback.startsWith('Wrong') || feedback.startsWith('Answer') ? ' wrong' : '';
  const status = element('div', `feedback${tone}`, feedback || (vm.input === 'enSpeech' ? 'Ready' : '')); area.append(status);
  if (/^(Correct|Wrong|Answer)/.test(feedback)) { const next = btn('', 'Next'); next.onclick = nextQuestion; area.append(next); queueMicrotask(() => next.focus()); return area; }
  if (vm.input === 'jaText') {
    const input = document.createElement('input'); input.lang = 'ja'; input.autofocus = true; input.setAttribute('aria-label', 'Japanese answer');
    const check = btn('', 'Check'); const submit = () => { if (input.value.trim()) mark(isJapaneseCorrect(input.value, item.jaAccepted), item); };
    check.onclick = submit; input.onkeydown = (event) => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); submit(); } };
    area.append(input, check); queueMicrotask(() => input.focus());
  } else if (vm.input === 'choices') {
    const choices = element('div', 'choices'); makeChoices(item, VOCABULARY).forEach((choice, index) => {
      const button = btn('', `${index + 1}. ${choice.en}`); button.onclick = () => mark(choice.id === item.id, item); choices.append(button);
    });
    const showAnswer = btn('secondary', 'こたえを見る'); showAnswer.onclick = () => mark(false, item, true); area.append(choices, showAnswer);
  } else {
    const mic = btn('mic', '🎤 Tap to talk'); const showAnswer = btn('secondary', 'こたえを見る'); showAnswer.onclick = () => mark(false, item, true);
    tap = new TapToTalk({ onCorrect: () => mark(true, item), onHeard: (heard) => { recognitionErrors = 0; lastHeard = heard; status.textContent = `Heard: ${heard}`; },
      onStatus: (message) => { if (message === 'Listening...') lastHeard = ''; status.textContent = message === 'Try again' && lastHeard ? `Heard: ${lastHeard} — Try again` : message; },
      onListenChange: (listening) => audio.duck('stt', listening),
      onUnavailable: (reason) => fallback(reason), onError: () => { recognitionErrors += 1; if (recognitionErrors >= 3) fallback(); } });
    mic.onclick = () => tap.start(item.enAccepted); area.append(mic, showAnswer);
  } return area;
}

function mark(correct, item, shown = false) {
  tap?.cancel(); round = answer(round, correct);
  feedback = correct ? `Correct! / せいかい！${isAdventure() ? '  +1 AP' : ''}` : shown ? `Answer: ${item.en}` : `Wrong. Answer: ${round.mode >= 3 ? item.en : round.mode === 2 ? `${item.ja} (${item.en})` : item.ja}`;
  if (isAdventure()) { audio.sfx(correct ? 'correct' : 'wrong'); quizStrike = correct; }
  renderQuestion(false);
}
function nextQuestion() { round = { ...round, currentIndex: round.currentIndex + 1 }; feedback = ''; audioError = false; if (round.currentIndex >= round.items.length) isAdventure() ? finishAdventureStage() : endScreen(); else renderQuestion(); }
function fallback(reason) {
  if (reason === 'denied') speechDenied = true;
  // Adventure keeps the Study マイクなし preference untouched and explains the fallback beside the choices.
  if (isAdventure()) { speechFailed = true; feedback = ''; } else { micFree = true; saveMicFree(true); feedback = MIC_MESSAGE; }
  renderQuestion(false);
}
function playPrompt(vm) {
  speak(vm.speak.text, vm.speak.lang, {
    onStart: () => audio.duck('tts', true), onEnd: () => audio.duck('tts', false),
    onError: () => { audioError = true; renderQuestion(false); },
  });
}
function micToggle() { const label = element('label', 'toggle'); const input = document.createElement('input'); input.type = 'checkbox'; input.checked = micFree; input.onchange = () => setMicFree(speechDenied ? true : input.checked); label.append(input, document.createTextNode('マイクなし')); return label; }

function endScreen() {
  stopMedia(); screen = 'study-end'; app.replaceChildren(); const card = element('section', 'card');
  card.append(element('h1', '', `Score: ${round.correctCount} / ${round.items.length}`), element('p', '', `Best streak: ${round.bestStreak}`));
  const missed = practiceItems(VOCABULARY, round.missedIds);
  if (missed.length) { const list = element('ul', 'missed'); missed.forEach((item) => list.append(element('li', '', `${item.en} — ${item.ja}`))); card.append(list); } else card.append(element('p', 'correct', 'Perfect!'));
  const actions = element('div', 'actions');
  if (missed.length) { const practice = element('button', '', 'Practice mistakes'); practice.onclick = () => startRound(round.mode, createRound(missed, Math.random, missed.length)); actions.append(practice); }
  const again = element('button', '', 'Again'); again.onclick = () => startRound(round.mode); actions.append(again);
  if (round.mode < 4) { const next = element('button', 'secondary', 'Next level'); next.onclick = () => startRound(round.mode + 1); actions.append(next); }
  const levels = element('button', 'secondary', 'Level select'); levels.onclick = levelSelect; actions.append(levels); card.append(actions); app.append(card);
}

/* ---------------------------------------------------------------- battle */

function rpgTopbar(menuAction = confirmQuit) {
  const top = element('div', 'rpg-topbar');
  const back = element('button', 'secondary px-button rpg-topbar__menu', '← Menu'); back.onclick = menuAction;
  const slot = element('span', 'ap-slot'); const right = element('div', 'rpg-topbar__right'); right.append(musicToggle());
  top.append(back, slot, right);
  return { top, slot };
}

function finishAdventureStage() {
  stopMedia(); const stage = campaign.stage; const encounter = upcomingEncounter ?? ENCOUNTERS[stageEncounterId(campaign)]; upcomingEncounter = null;
  campaign = recordStage(campaign, round, encounter.id); stageResult = campaign.stageResults.at(-1);
  screen = 'stage-complete'; app.replaceChildren(); rpgScreen(); clearTimers();
  const card = element('section', 'rpg-card px-panel stage-card'); const { top, slot } = rpgTopbar(); card.append(top);
  const scene = element('div', `rpg-stage-scene ${backdropClass(stage)}`); scene.innerHTML = battleArt(campaign.heroId, 'victory'); scene.firstElementChild?.setAttribute('aria-hidden', 'true');
  const waves = encounter.waves ?? [{ enemyIds: encounter.enemyIds }];
  const foes = element('div', 'rpg-foes'); new Set(waves.flatMap((wave) => wave.enemyIds)).forEach((id) => foes.append(element('span', 'rpg-foe', ENEMIES[id].name)));
  const earned = element('div', 'rpg-earned');
  earned.append(element('div', 'rpg-score', `${stageResult.correct} / ${stageResult.total}`), element('div', 'rpg-earned__ap', `= ${stageResult.startingAp} AP`));
  const party = element('div', 'rpg-party px-panel');
  party.append(element('strong', '', `LV ${campaign.level}`), hpLine(campaign.heroHp, campaignMaxHp(campaign)), element('span', '', `ポーション ×${campaign.potions}`));
  const apNote = element('p', 'rpg-note', stageResult.startingAp > 0 ? 'Every action costs AP. / こうどうに AP をつかうよ！' : '0 AP… you will rest to recover AP. / AP 0 … やすんで かいふく！');
  const battle = element('button', 'battle-start px-button', 'BATTLE!'); battle.onclick = () => startAdventureBattle();
  const encounterLabel = encounter.name
    ? element('p', 'rpg-foes-label', `${encounter.name.toUpperCase()} / ${encounter.jaName ?? ''}${waves.length > 1 ? ` · WAVES ×${waves.length}` : ''}`)
    : element('p', 'rpg-foes-label', 'ENEMY / てき');
  card.append(element('h1', 'rpg-title', `STAGE ${stage} CLEAR!`), scene, earned, party, encounterLabel, foes, apNote, battle);
  app.append(card); apMeter?.mount(slot); apMeter?.set(stageResult.startingAp, { quiet: true });
  audio.sfx('fanfare');
  queueMicrotask(() => battle.focus());
}

function startAdventureBattle() {
  const stage = campaign.stageResults.length;
  const state = createBattle(battleSetup(campaign, stageResult));
  showBattle(state, { kind: 'adventure', stage, cityId: campaign.cityId });
}

function showBattle(initialState, options) {
  clearScreen(); screen = options.kind === 'debug' ? 'debug-battle' : 'battle'; app.className = 'app battle-app'; const host = element('section', 'battle-host'); app.append(host);
  const encounter = ENCOUNTERS[initialState.encounterId ?? options.config?.encounterId ?? stageResult?.encounterId];
  const boss = initialState.enemies.some((enemy) => ENEMIES[enemy.id].boss);
  audio.play(encounter?.music ?? (boss ? 'boss' : 'battle'));
  let defenceHintRound = null;
  const onboardingHint = options.kind === 'adventure' && options.cityId === 'matsubara' && options.stage === 1 ? (state) => {
    if (state.round === 1) return { skill: 'basic', text: 'こうげきしてみよう！' };
    if (defenceHintRound === null && state.hero.hp < state.hero.maxHp / 2) defenceHintRound = state.round;
    return defenceHintRound === state.round ? { skill: 'defense', text: 'まもろう！' } : null;
  } : null;
  apMeter?.set(initialState.ap, { quiet: true, animate: options.kind === 'adventure' });
  battleView = createBattleView(host, {
    state: initialState, hint: onboardingHint, apMeter, sound: audio, topRight: musicToggleMarkup(),
    onExit: options.kind === 'adventure' ? confirmQuit : debugLauncher,
    onAction: (nextState) => { if (nextState?.turn === 'won' || nextState?.turn === 'lost') battleEnded(nextState, options); }, onSelect: () => {},
  });
}
function battleEnded(state, options) {
  if (options.kind === 'debug') { debugBattleEnd(state, options); return; }
  if (state.turn === 'won') {
    const { campaign: next, rewards } = applyVictory(campaign, state);
    campaign = next;
    const final = options.stage === stageCount(campaign.cityId);
    if (final) {
      saveRegion(markCitySaved(readRegion(), campaign.cityId, campaign));
      if (campaign.cityId === 'matsubara') saveCampaignOutcome();
    }
    adventureVictory(options.stage, rewards);
  } else {
    campaign = recordDefeat(campaign);
    adventureDefeat();
  }
}
function heroPose(pose, stage) {
  const scene = element('div', `rpg-stage-scene rpg-hero-pose ${backdropClass(stage)}`); scene.innerHTML = battleArt(campaign.heroId, pose);
  scene.firstElementChild?.setAttribute('aria-hidden', 'true'); return scene;
}

/* --------------------------------------------------------- victory / XP */

function rewardLine(icon, textValue, className = '') {
  const line = element('li', `rpg-reward-line ${className}`.trim()); line.innerHTML = icon ? getIcon(icon) : ''; line.append(element('span', '', textValue)); return line;
}

function adventureVictory(stage, rewards) {
  clearScreen(); rpgScreen(); screen = 'battle-result';
  const final = stage === stageCount(campaign.cityId);
  audio.play(final ? 'finale' : 'victory');
  const card = element('section', `rpg-card px-panel result-card victory-card${final ? ' victory-card--final' : ''}`);
  const title = element('h1', `rpg-title${final ? ' rpg-burst' : ''}`, 'VICTORY!'); card.append(title, heroPose('victory', stage));
  if (final) card.append(element('h2', 'rpg-title rpg-master', 'BOSS DEFEATED!'));
  // The ending's city art is drawn while this screen is up.
  if (final) cityClass('safe');

  const xpBox = element('div', 'rpg-xp px-panel');
  const gained = element('div', 'rpg-xp__gain', `+${rewards.xpGained} XP`);
  if (rewards.perfectXp) gained.append(element('small', '', ` (PERFECT +${rewards.perfectXp})`));
  const levelLabel = element('div', 'rpg-xp__level', `LV ${rewards.levelBefore}`);
  const bar = element('div', 'rpg-xp__bar'); const fill = element('span', 'rpg-xp__fill'); bar.append(fill);
  const levelUps = element('ul', 'rpg-levelups');
  xpBox.append(gained, levelLabel, bar, levelUps);
  card.append(xpBox);

  const rest = element('ul', 'rpg-rest');
  if (!final) {
    rest.append(rewardLine('heart', `HP ${rewards.hpBefore} → ${rewards.hp} / ${rewards.maxHp}  (+${rewards.healed})`));
    if (rewards.potions > rewards.potionsBefore) rest.append(rewardLine('potion', `ポーション ×${rewards.potionsBefore} → ×${rewards.potions}`));
    card.append(rest);
  }

  const next = element('button', 'px-button', final ? 'NEXT ▶  つぎへ' : 'NEXT STAGE');
  next.onclick = final
    ? (campaign.cityId === 'matsubara'
      ? () => endingCinematic(campaignResults)
      : () => cityEndingCinematic(campaign.cityId, cityResults))
    : () => startRound(stageMode(campaign), createRound(VOCABULARY), 'adventure');
  card.append(next); app.append(card); queueMicrotask(() => next.focus());
  playXpSequence(rewards, { fill, levelLabel, levelUps, rest, card });
}

/** Fill the XP bar (through each level up) and reveal rewards. Any key or click finishes it at once. */
function playXpSequence(rewards, { fill, levelLabel, levelUps, rest, card }) {
  const steps = [];
  const setBar = (ratio, instant = false) => {
    fill.classList.toggle('rpg-xp__fill--instant', instant);
    void fill.offsetWidth;
    fill.style.width = `${Math.round(ratio * 100)}%`;
  };
  // Every reward line is laid out from the start and only revealed later, so the
  // card never changes size under the pointer: a click that ends the sequence early
  // still lands on the button it pressed.
  const groups = rewards.levelUps.map((reward) => {
    const lines = [rewardLine('combo', `LEVEL UP!  LV ${reward.level}`, 'rpg-reward-line--levelup')];
    if (reward.maxHpGain) lines.push(rewardLine('heart', `MAX HP +${reward.maxHpGain}`));
    reward.skills.forEach((id) => {
      const line = rewardLine(id, `NEW SKILL!  ${SKILLS[id].name.toUpperCase()} / ${SKILLS[id].jaName} · ${SKILLS[id].cost} AP`, 'rpg-reward-line--skill');
      if (SKILLS[id].tip) line.lastElementChild.append(element('small', 'rpg-reward-tip', SKILLS[id].tip));
      lines.push(line);
    });
    if (reward.passive) lines.push(rewardLine('counter', `POWER UP!  ${reward.passive.name.toUpperCase()} — ${reward.passive.kanaText}`, 'rpg-reward-line--skill'));
    if (reward.mastery) lines.push(rewardLine('power', 'VERB MASTER! / マスター！', 'rpg-reward-line--skill'));
    lines.forEach((line) => line.classList.add('rpg-pending'));
    levelUps.append(...lines);
    return lines;
  });
  rest?.classList.add('rpg-pending');
  const showLevel = (reward, index) => {
    levelLabel.textContent = `LV ${reward.level}${reward.mastery ? ' · MASTER' : ''}`;
    groups[index].forEach((line) => line.classList.remove('rpg-pending'));
    audio.sfx('levelup');
  };
  const start = xpProgress(rewards.xpBefore);
  setBar(start.ratio, true);
  let at = 450;
  rewards.levelUps.forEach((reward, index) => {
    steps.push([at, () => setBar(1)]);
    at += 750;
    steps.push([at, () => { showLevel(reward, index); setBar(0, true); }]);
    at += 350;
  });
  const end = xpProgress(rewards.xp);
  steps.push([at, () => setBar(end.ratio)]);
  at += 700;
  steps.push([at, () => rest?.classList.remove('rpg-pending')]);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimers();
    const pending = rewards.levelUps.some((_, index) => groups[index][0].classList.contains('rpg-pending'));
    levelUps.querySelectorAll('.rpg-pending').forEach((line) => line.classList.remove('rpg-pending'));
    if (pending) audio.sfx('levelup');
    levelLabel.textContent = `LV ${rewards.level}${rewards.level === LEVELS.length ? ' · MASTER' : ''}`;
    setBar(end.ratio, true);
    rest?.classList.remove('rpg-pending');
    card.removeEventListener('pointerdown', finish);
    document.removeEventListener('keydown', finish, true);
  };
  if (reducedMotion()) { finish(); return; }
  audio.sfx('xp');
  steps.forEach(([ms, fn]) => later(ms, () => { if (!done) fn(); }));
  later(at + 10, () => { done = true; card.removeEventListener('pointerdown', finish); document.removeEventListener('keydown', finish, true); });
  card.addEventListener('pointerdown', finish);
  document.addEventListener('keydown', finish, true);
}

function adventureDefeat() {
  clearScreen(); rpgScreen(); screen = 'battle-result'; audio.play('defeat');
  const card = element('section', 'rpg-card px-panel result-card defeat-card'); const { top, slot } = rpgTopbar(); card.append(top);
  const title = element('h1', 'rpg-title', 'DEFEATED... '); title.append(element('span', 'rpg-ja', 'もういちど！'));
  const ap = battleAp(campaign, stageResult);
  const help = ap - stageResult.startingAp;
  card.append(title, heroPose('defeat', campaign.stageResults.length));
  const info = element('ul', 'rpg-rest');
  info.append(rewardLine('power', help > 0 ? `RETRY: ${stageResult.startingAp} AP + ${help} HELP = ${ap} AP` : `RETRY: ${ap} AP`));
  info.append(rewardLine('heart', `HP ${campaign.heroHp}/${campaignMaxHp(campaign)} · ポーション ×${campaign.potions}  (もとどおり)`));
  card.append(info);
  if (campaign.retries >= 2) card.append(element('p', 'rpg-tip', 'TIP: 🔥 BIG ATTACK → 2 (Guard / Barrier / Dodge)!  まもろう！'));
  const retry = element('button', 'px-button', `RETRY BATTLE (${ap} AP)`); retry.onclick = () => startAdventureBattle();
  const menu = element('button', 'secondary px-button', 'MAIN MENU'); menu.onclick = mainMenu; card.append(retry, menu); app.append(card);
  apMeter?.mount(slot); apMeter?.set(stageResult.startingAp, { animate: false });
  later(500, () => apMeter?.set(ap));
  queueMicrotask(() => retry.focus());
}

/** The final boss of this campaign, if any. */
function campaignBoss(from = campaign) {
  const encounterId = from.stageResults.at(-1)?.encounterId;
  const encounter = ENCOUNTERS[encounterId];
  const waves = encounter?.waves ?? (encounter ? [{ enemyIds: encounter.enemyIds }] : []);
  return waves.flatMap((wave) => wave.enemyIds).find((id) => ENEMIES[id].boss) ?? null;
}

/** Store the finished campaign's result once, when the final boss falls. */
function saveCampaignOutcome() {
  const { totalCorrect } = campaignSummary(campaign);
  const result = recordCompletion(readRecords(), campaign.heroId, totalCorrect, campaignBoss());
  saveRecords(result.records);
  campaignOutcome = { ...result, heroId: campaign.heroId };
}

function scoreLine(summary) {
  const score = element('div', 'rpg-score', `${summary.totalCorrect} / ${summary.totalQuestions}`);
  score.append(element('small', 'rpg-score__unit', ' VERBS'));
  return score;
}

function campaignResults() {
  clearScreen(); rpgScreen(); screen = 'campaign-results'; audio.play('title');
  const summary = campaignSummary(campaign); const hero = HEROES[campaign.heroId];
  // Debug previews reach this screen without finishing a campaign: show the stored records, save nothing.
  const outcome = campaignOutcome?.heroId === campaign.heroId ? campaignOutcome : { records: readRecords(), newBest: false, firstClear: false };
  const title = heroTitle(summary.totalCorrect); const next = nextHeroTitle(summary.totalCorrect);
  const card = element('section', 'rpg-card px-panel results-card');
  const heading = element('h1', 'rpg-title', 'MATSUBARA CITY IS SAFE!'); heading.append(element('span', 'rpg-ja', 'まつばら市を まもった！')); card.append(heading);

  const heroLine = element('div', 'results-hero'); const art = element('span', 'mini-art'); art.innerHTML = battleArt(hero.id, 'victory'); art.firstElementChild?.setAttribute('aria-hidden', 'true');
  const heroText = element('div', 'results-hero__text'); heroText.append(element('strong', '', `${hero.name.toUpperCase()} / ${hero.jaName} · LV ${summary.level}`), scoreLine(summary), element('p', '', `Best streak: ${summary.bestStreak}`));
  heroLine.append(art, heroText);

  // The hero title is the campaign's main reward; the score stays beside it.
  const rank = element('div', 'results-title px-panel');
  if (outcome.firstClear || outcome.newBest) rank.append(element('span', 'results-title__flag', outcome.firstClear ? 'FIRST CLEAR!' : 'NEW BEST!'));
  rank.append(element('strong', 'results-title__en', title.en), element('span', 'results-title__ja', title.ja));
  rank.append(next
    ? element('span', 'results-title__next', `NEXT TITLE: ${next.en} — ${next.min} / 40  ·  あと ${next.needed} もん！`)
    : element('span', 'results-title__next results-title__next--max', 'MAX TITLE! ★'));
  const top = element('div', 'results-top'); top.append(heroLine, rank); card.append(top);

  // Which heroes have protected the city, and which final bosses were met.
  const done = completedHeroes(outcome.records);
  const roster = element('div', 'results-roster');
  roster.append(element('span', 'results-roster__label', 'HEROES / ヒーロー'));
  ART_IDS.heroes.forEach((id) => roster.append(element('span', `results-roster__hero${done.includes(id) ? ' is-done' : ''}`, `${done.includes(id) ? '★' : '☆'} ${HEROES[id].name.toUpperCase()}`)));
  roster.append(element('span', 'results-roster__bosses', `BOSSES ${outcome.records.discoveredBosses.length} / ${FINAL_BOSSES.length}`));
  if (done.length === ART_IDS.heroes.length) roster.append(element('span', 'results-roster__all rpg-burst', 'ALL HEROES COMPLETE!'));
  card.append(roster);

  const scores = element('div', 'stage-results'); campaign.stageResults.forEach((result, index) => scores.append(element('span', '', `Stage ${index + 1}: ${result.correct} / ${result.total}`))); card.append(scores);
  const missed = practiceItems(VOCABULARY, summary.missedIds);
  if (missed.length) {
    const list = element('ul', 'missed'); list.setAttribute('aria-labelledby', 'missed-label'); missed.forEach((item) => list.append(element('li', '', `${item.en} — ${item.ja}`)));
    const label = element('p', 'results-missed-label', `Review: ${missed.length} word${missed.length === 1 ? '' : 's'} / ふくしゅう：${missed.length}こ`); label.id = 'missed-label'; card.append(label, list);
  } else card.append(element('p', 'correct', 'PERFECT!'));

  // Two replay paths: beat your own score, or protect the city as a hero who has not yet.
  const actions = element('div', 'actions results-actions');
  const continueAdventure = element('button', 'px-button results-map');
  continueAdventure.append(element('span', '', 'つづける つぎの まちへ！'), element('small', '', 'CONTINUE ADVENTURE'));
  continueAdventure.onclick = () => osakaMapScreen({ justSaved: 'matsubara' }); actions.append(continueAdventure);
  const again = element('button', 'secondary px-button results-again'); again.append(element('span', '', 'TRY AGAIN — BEAT YOUR SCORE'), element('small', '', 'もういちど！'));
  again.onclick = () => startCampaign(campaign.heroId); actions.append(again);
  const newHero = ART_IDS.heroes.find((id) => id !== hero.id && !done.includes(id));
  if (newHero) {
    const other = element('button', 'secondary px-button results-new-hero'); other.append(element('span', '', `NEW ADVENTURE: PLAY AS ${HEROES[newHero].name.toUpperCase()}`), element('small', '', `${HEROES[newHero].jaName}で ぼうけん！`));
    other.onclick = () => startCampaign(newHero); actions.append(other);
  }
  if (missed.length) { const practice = element('button', 'secondary px-button results-practice', 'Practice mistakes'); practice.onclick = () => practiceModePicker(missed); actions.append(practice); }
  const choose = element('button', 'secondary px-button', 'Choose Hero'); choose.onclick = heroSelect; const menu = element('button', 'secondary px-button', 'Main Menu'); menu.onclick = mainMenu;
  actions.append(choose, menu); card.append(actions); app.append(card);
  queueMicrotask(() => continueAdventure.focus());
}

/** Results for a non-origin city: regional progress, without Matsubara's hero titles or records. */
function cityResults() {
  clearScreen(); rpgScreen(); screen = 'city-results'; audio.play('title');
  const summary = campaignSummary(campaign); const hero = HEROES[campaign.heroId]; const city = CITIES[campaign.cityId];
  const card = element('section', 'rpg-card px-panel results-card city-results');
  const heading = element('h1', 'rpg-title', `${city.jaName}を まもった！`); heading.append(element('small', 'rpg-ja', `${city.name.toUpperCase()} IS SAFE!`)); card.append(heading);

  const heroLine = element('div', 'results-hero'); const art = element('span', 'mini-art'); art.innerHTML = battleArt(hero.id, 'victory'); art.firstElementChild?.setAttribute('aria-hidden', 'true');
  const heroText = element('div', 'results-hero__text'); heroText.append(element('strong', '', `${hero.name.toUpperCase()} / ${hero.jaName} · LV ${summary.level}`));
  const score = element('div', 'rpg-score', `${summary.totalCorrect} / 40`); score.append(element('small', 'rpg-score__unit', ' TOTAL SCORE')); heroText.append(score, element('p', '', `Best streak: ${summary.bestStreak}`));
  heroLine.append(art, heroText); card.append(heroLine);

  const scores = element('div', 'stage-results'); campaign.stageResults.forEach((result, index) => scores.append(element('span', '', `Stage ${index + 1}: ${result.correct} / ${result.total}`))); card.append(scores);
  const missed = practiceItems(VOCABULARY, summary.missedIds);
  if (missed.length) {
    const list = element('ul', 'missed'); list.setAttribute('aria-labelledby', 'city-missed-label'); missed.forEach((item) => list.append(element('li', '', `${item.en} — ${item.ja}`)));
    const label = element('p', 'results-missed-label', `Review: ${missed.length} word${missed.length === 1 ? '' : 's'} / ふくしゅう：${missed.length}こ`); label.id = 'city-missed-label'; card.append(label, list);
  } else card.append(element('p', 'correct', 'PERFECT!'));

  const actions = element('div', 'actions results-actions');
  const map = element('button', 'px-button results-map'); map.append(element('span', '', '大阪マップへ ▶'), element('small', '', 'BACK TO OSAKA MAP'));
  map.onclick = () => osakaMapScreen({ justSaved: campaign.cityId }); actions.append(map);
  if (missed.length) { const practice = element('button', 'secondary px-button results-practice', 'Practice mistakes'); practice.onclick = () => practiceModePicker(missed); actions.append(practice); }
  const menu = element('button', 'secondary px-button', 'Main Menu'); menu.onclick = mainMenu; actions.append(menu);
  card.append(actions); app.append(card); queueMicrotask(() => map.focus());
}

/* ------------------------------------------------------------- Osaka map */

/** The city the map's big button leads to: a city in progress first, then the first one under attack. */
function nextMapCity(region) {
  if (region.checkpoint && CITIES[region.checkpoint.cityId]) return region.checkpoint.cityId;
  return Object.keys(CITIES).find((id) => cityPlayable(region, id) && !region.savedCities.includes(id)) ?? null;
}

/**
 * The regional map. `justSaved` plays that city's change to SAVED. Progress is
 * already stored when this shows, so leaving needs no confirmation.
 */
function osakaMapScreen({ justSaved = null } = {}) {
  clearScreen(); rpgScreen(); screen = 'osaka-map'; campaign = null; round = null; quizContext = null;
  audio.play('title');
  const region = readRegion();
  const card = element('section', 'rpg-card px-panel map-card');
  const { top } = rpgTopbar(mainMenu);
  const heading = element('h1', 'rpg-title map-title', '大阪を まもれ！'); heading.append(element('small', '', 'SAVE OSAKA!'));
  const status = element('div', 'map-status');
  const count = element('span', 'map-count', `まもった町: ${region.savedCities.length - (justSaved && region.savedCities.includes(justSaved) ? 1 : 0)}`);
  status.append(count);
  if (region.heroId) {
    const heroLine = element('span', 'map-hero'); const art = element('span', 'mini-art'); art.innerHTML = battleArt(region.heroId, 'idle'); art.firstElementChild?.setAttribute('aria-hidden', 'true');
    heroLine.append(art, element('b', '', `${HEROES[region.heroId].name.toUpperCase()} LV ${region.level}`));
    status.prepend(heroLine);
  }
  const view = osakaMapView({ region, justSaved, onSelect: startCityCampaign });
  const target = nextMapCity(region);
  const actions = element('div', 'map-actions');
  if (target) {
    const city = CITIES[target]; const resume = region.checkpoint?.cityId === target;
    const go = element('button', 'px-button map-go');
    go.append(element('span', '', resume ? `▶ ${city.jaName}の つづき！  STAGE ${region.checkpoint.stage}` : `▶ ${city.jaName}へ いく！`), element('small', '', resume ? `CONTINUE ${city.name.toUpperCase()}` : `GO TO ${city.name.toUpperCase()}`));
    go.onclick = () => startCityCampaign(target); actions.append(go);
    queueMicrotask(() => go.focus());
  } else actions.append(element('p', 'map-soon', 'つぎの 町は じゅんびちゅう…  MORE CITIES COMING SOON'));
  card.append(top, heading, status, view.node, actions); app.append(card);
  if (justSaved) {
    const reveal = () => { view.reveal(); count.textContent = `まもった町: ${region.savedCities.length}`; audio.sfx('levelup'); };
    if (reducedMotion()) reveal(); else later(900, reveal);
  }
}

function startCityCampaign(cityId) {
  const region = readRegion(); const cityCampaign = CITY_CAMPAIGNS[cityId];
  if (!cityCampaign) return;
  if (cityCampaign.origin) {
    if (region.heroId) startCampaign(region.heroId); else heroSelect();
    return;
  }
  if (!region.heroId) { heroSelect(); return; }
  campaignOutcome = null;
  if (region.checkpoint?.cityId === cityId) {
    campaign = resumeCampaign(region);
    startRound(stageMode(campaign), createRound(VOCABULARY), 'adventure');
    return;
  }
  campaign = chapterRest(createCampaign(region.heroId, { cityId, level: region.level, xp: region.xp }));
  cityIntroCinematic(cityId, () => startRound(stageMode(campaign), createRound(VOCABULARY), 'adventure'));
}

/* ------------------------------------------------------------- cinematics */

// Story scenes (src/story.js): the Matsubara opening and ending, and a short
// intro and ending per regional city. Beats run on the screen timers, so
// leaving the screen cancels them; SKIP finishes exactly once, and a tap on
// the scene moves a text card on for students who read quickly.
function introCinematic(onDone) { playStory('intro', INTRO_STORY, onDone); }
function endingCinematic(onDone) { playStory('ending', ENDING_STORY, onDone); }
function cityIntroCinematic(cityId, onDone) { playStory(`${cityId}-intro`, CITY_STORIES[cityId]?.intro ?? [], onDone); }
function cityEndingCinematic(cityId, onDone) { playStory(`${cityId}-ending`, CITY_STORIES[cityId]?.ending ?? [], onDone); }

/** One story line, with {漢字|かな} shown as furigana. */
function storyLine(line, big) {
  const node = element('p', `story__line${big ? ' story__line--big' : ''}`);
  rubyParts(line).forEach((part) => {
    if (!part.ruby) { node.append(part.text); return; }
    const ruby = document.createElement('ruby');
    ruby.append(part.text, element('rt', '', part.ruby));
    node.append(ruby);
  });
  return node;
}

function playStory(kind, beats, onDone) {
  clearScreen(); rpgScreen(); screen = 'cinematic';
  const heroId = campaign.heroId;
  const root = element('section', `cinematic story story--${kind}`); root.setAttribute('aria-label', 'Story / ものがたり');
  const scene = element('div', 'cinematic__scene');
  // One layer per city mood; a beat fades the wanted one in over the others.
  const layers = Object.fromEntries(['calm', 'danger', 'safe'].map((mood) => [mood, element('div', `cinematic__city ${cityClass(mood)}`)]));
  const monsters = element('div', `cinematic__monsters ${cityClass('monsters')}`);
  const citizens = element('div', 'cinematic__citizens'); for (let i = 0; i < 5; i += 1) citizens.append(element('span', 'cinematic__citizen'));
  const core = element('div', 'story__core');
  const allySlot = element('div', 'cinematic__hero cinematic__ally');
  const heroSlot = element('div', 'cinematic__hero');
  const veil = element('div', 'story__veil');
  const title = element('div', 'story__title px-panel'); title.hidden = true;
  const crawl = element('div', 'story__crawl'); crawl.setAttribute('aria-live', 'polite');
  const tapHint = element('span', 'story__tap', 'タップで つぎへ ▶'); tapHint.setAttribute('aria-hidden', 'true');
  scene.append(...Object.values(layers), monsters, citizens, core, allySlot, heroSlot, veil, title, crawl, tapHint);
  const skip = element('button', 'cinematic__skip px-button secondary', 'SKIP ▶ スキップ'); skip.setAttribute('aria-label', 'Skip / スキップ');
  root.append(scene, skip); app.append(root);

  const actor = (slot, id, pose) => {
    if (pose === 'gone') { slot.classList.remove('is-on'); return; }
    slot.innerHTML = battleArt(id, pose); slot.firstElementChild?.setAttribute('aria-hidden', 'true'); slot.classList.add('is-on');
  };
  const apply = (beat) => {
    if (beat.mood) Object.entries(layers).forEach(([mood, layer]) => layer.classList.toggle('is-on', mood === beat.mood));
    if (beat.monsters) ['near', 'gone', 'spread'].forEach((state) => monsters.classList.toggle(`is-${state}`, beat.monsters === state));
    if ('citizens' in beat) citizens.classList.toggle('is-on', Boolean(beat.citizens));
    if ('core' in beat) core.classList.toggle('is-on', Boolean(beat.core));
    if (beat.hero) actor(heroSlot, heroId, beat.hero);
    if (beat.ally) actor(allySlot, 'osakaDefender', beat.ally);
    // Music: a cut is instant silence (the Horde arrives), stop fades, play switches track.
    if (beat.cut) audio.cut(); else if (beat.stop) audio.stop();
    if (beat.music) audio.play(beat.music);
    if (beat.sfx) audio.sfx(beat.sfx);
    title.hidden = !beat.title;
    if (beat.title) title.replaceChildren(element('strong', '', beat.title.ja), element('span', '', beat.title.en));
    veil.classList.toggle('is-on', Boolean(beat.card));
    tapHint.classList.toggle('is-on', Boolean(beat.card));
    crawl.replaceChildren();
    if (beat.card) {
      const card = element('div', `story__card${beat.card.hold ? ' story__card--hold' : ''}`);
      card.style.setProperty('--dur', `${beat.ms ?? cardMs(beat.card)}ms`);
      beat.card.lines.forEach((line, index) => card.append(storyLine(line, index === beat.card.big)));
      if (beat.card.en) card.append(element('p', 'story__en', beat.card.en));
      crawl.append(card);
    }
  };

  let finished = false, index = -1;
  const finish = () => { if (finished) return; finished = true; clearTimers(); onDone(); };
  const next = () => {
    if (finished) return;
    clearTimers();
    index += 1;
    if (index >= beats.length) { finish(); return; }
    const beat = beats[index];
    apply(beat);
    later(beat.ms ?? cardMs(beat.card), next);
  };
  skip.onclick = finish;
  scene.onclick = () => { if (beats[index]?.card) next(); };
  root.addEventListener('keydown', (event) => { if (event.key === 'ArrowRight' && beats[index]?.card) { event.preventDefault(); next(); } });
  if (reducedMotion()) root.classList.add('cinematic--still');
  next();
  queueMicrotask(() => skip.focus());
}
function practiceModePicker(items) {
  clearScreen(); screen = 'practice-picker'; const card = element('section', 'card'); card.append(element('h1', '', 'Practice mode / れんしゅうモード')); const levels = element('div', 'levels');
  Object.entries(titles).forEach(([mode, title]) => { const button = element('button', 'level', `${mode}. ${title[0]}`); button.onclick = () => { campaign = null; startRound(Number(mode), createRound(items, Math.random, items.length)); }; levels.append(button); }); card.append(levels); app.append(card);
}

function confirmQuit() {
  if (!campaign) return mainMenu(); if (document.querySelector('.modal-backdrop')) return;
  const dialog = element('div', 'modal-backdrop'); const panel = element('section', 'quit-dialog'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'quit-title');
  const title = element('h2', '', 'Quit adventure? / やめる？'); title.id = 'quit-title'; const actions = element('div', 'actions');
  const quit = element('button', 'danger', 'Quit'); quit.onclick = () => { stopMedia(); clearBattle(); campaign = null; dialog.remove(); mainMenu(); }; const keep = element('button', 'secondary', 'Keep playing'); keep.onclick = () => dialog.remove();
  actions.append(quit, keep); panel.append(title, actions); dialog.append(panel); document.body.append(dialog); queueMicrotask(() => keep.focus());
}

function confirmNewAdventure() {
  if (document.querySelector('.modal-backdrop')) return;
  const dialog = element('div', 'modal-backdrop'); const panel = element('section', 'quit-dialog'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'new-adventure-title');
  const title = element('h2', '', 'あたらしく はじめる？'); title.id = 'new-adventure-title';
  const warning = element('p', '', '大阪の きろくは きえます。'); const actions = element('div', 'actions');
  const reset = element('button', 'danger', 'START NEW ADVENTURE'); reset.onclick = () => { saveRegion(parseRegion(null, ART_IDS.heroes)); dialog.remove(); heroSelect(); };
  const keep = element('button', 'secondary', 'もどる'); keep.onclick = () => dialog.remove();
  actions.append(reset, keep); panel.append(title, warning, actions); dialog.append(panel); document.body.append(dialog); queueMicrotask(() => keep.focus());
}

/* ------------------------------------------------------------------ debug */

function debugLauncher() {
  clearScreen(); screen = 'debug'; audio.stop(); const card = element('section', 'card wide-card'); card.append(element('h1', '', 'Battle Debug')); const form = element('form', 'debug-form');
  const hero = selectField('Hero', Object.values(HEROES).map((x) => [x.id, x.name])); const encounterWrap = element('label', '', 'Encounter'); const encounter = document.createElement('select');
  for (let tier = 1; tier <= 4; tier += 1) { const group = document.createElement('optgroup'); group.label = `Tier ${tier}`; Object.values(ENCOUNTERS).filter((x) => !x.city && x.tier === tier).forEach((x) => { const option = element('option', '', x.id); option.value = x.id; group.append(option); }); encounter.append(group); }
  const cityEncounters = Object.values(ENCOUNTERS).filter((x) => x.city);
  if (cityEncounters.length) { const group = document.createElement('optgroup'); group.label = 'City campaigns'; cityEncounters.forEach((x) => { const option = element('option', '', `${x.id}${x.name ? ` · ${x.name}` : ''}`); option.value = x.id; group.append(option); }); encounter.append(group); }
  encounterWrap.append(encounter);
  const ap = numberField('AP (starting)', 0, 10, 7);
  const presets = element('div', 'debug-presets'); [0, 5, 6, 7, 8, 10].forEach((value) => { const button = element('button', 'secondary', `${value} AP`); button.type = 'button'; button.onclick = () => { ap.input.value = value; }; presets.append(button); });
  const level = selectField('Level (HP, skills, passive)', LEVELS.map((row) => [row.level, `LV ${row.level} · tier ${row.skillTier} · +${row.maxHpBonus} HP`]));
  const skill = selectField('Skill tier', [['', 'auto (from level)'], [0, '0'], [1, '1'], [2, '2']]);
  const startWave = selectField('Start wave', [[1, '1']]);
  const hp = numberField('Hero HP (blank = full)', 0, 99, ''); hp.input.value = '';
  const potions = numberField('Potions', 0, CAMPAIGN.maxPotions, CAMPAIGN.startingPotions);
  const start = element('button', '', 'START BATTLE'); form.append(hero.label, encounterWrap, ap.label, presets, level.label, skill.label, startWave.label, hp.label, potions.label, start);
  // Encounter tier suggests the campaign level; the level select stays editable.
  const syncEncounter = (selectedWave = 1) => {
    const data = ENCOUNTERS[encounter.value]; const waves = data.waves ?? [{ enemyIds: data.enemyIds }];
    startWave.select.replaceChildren(...waves.map((_, index) => { const option = element('option', '', String(index + 1)); option.value = String(index + 1); return option; }));
    startWave.select.value = String(Math.max(1, Math.min(waves.length, selectedWave)));
    level.select.value = String(data.tier ?? LEVELS.length);
  };
  encounter.onchange = () => syncEncounter();
  level.select.value = '1';
  if (debugConfig) {
    hero.select.value = debugConfig.heroId; encounter.value = debugConfig.encounterId; ap.input.value = debugConfig.ap; level.select.value = String(debugConfig.level);
    skill.select.value = debugConfig.skillTier ?? ''; potions.input.value = debugConfig.potions; if (debugConfig.heroHp !== undefined) hp.input.value = debugConfig.heroHp;
  }
  syncEncounter(debugConfig?.startWave ?? 1);
  if (debugConfig) level.select.value = String(debugConfig.level);
  form.onsubmit = (event) => {
    event.preventDefault();
    debugConfig = {
      heroId: hero.select.value, encounterId: encounter.value, ap: Number(ap.input.value), level: Number(level.select.value),
      skillTier: skill.select.value === '' ? undefined : Number(skill.select.value), potions: Number(potions.input.value),
      heroHp: hp.input.value === '' ? undefined : Number(hp.input.value), startWave: Number(startWave.select.value),
    };
    startDebugBattle(debugConfig);
  };
  const gallery = element('button', 'secondary', 'SPRITE GALLERY'); gallery.type = 'button'; gallery.onclick = artGallery;
  card.append(form, gallery); app.append(card);
}

/** A campaign played up to `stage` (earlier stages scored `earlierCorrect`/10, longest words missed first), for previews. */
function previewRewards(heroId, stage, earlierCorrect = 7, cityId = 'matsubara') {
  let preview = cityId === 'matsubara'
    ? createCampaign(heroId)
    : chapterRest(createCampaign(heroId, { cityId, level: LEVELS.length, xp: LEVELS.at(-1).xp }));
  const longestFirst = [...VOCABULARY].sort((a, b) => (b.en + b.ja).length - (a.en + a.ja).length);
  for (let index = 1; index <= stage; index += 1) {
    const encounterId = stageEncounterId(preview, () => 0);
    const correctCount = index === stage ? 10 : earlierCorrect;
    const missed = longestFirst.slice((index - 1) * (10 - earlierCorrect), index * (10 - earlierCorrect)).map((item) => item.id);
    preview = recordStage(preview, { mode: stageMode(preview), items: new Array(10).fill({ id: 'x' }), correctCount, bestStreak: 7, missedIds: new Set(index === stage ? [] : missed) }, encounterId);
    const state = createBattle({ ...battleSetup(preview), ap: 0 });
    const won = { ...state, potions: 0, hero: { ...state.hero, hp: Math.ceil(state.hero.maxHp * 0.3) }, enemies: state.enemies.map((enemy) => ({ ...enemy, hp: 0 })) };
    const result = applyVictory(preview, won);
    if (index === stage) return { campaign: result.campaign, rewards: result.rewards, stageResult: preview.stageResults.at(-1) };
    preview = result.campaign;
  }
  return null;
}

/** ?debug=art: every character in any state, for reviewing the pixel art. */
function artGallery() {
  clearScreen(); screen = 'debug-art'; app.className = 'app rpg-app'; const page = element('section', 'art-gallery'); page.append(element('h1', '', 'SPRITE GALLERY'));
  const controls = element('div', 'art-controls'); const state = selectField('State', SPRITE_STATES.map((x) => [x, x])); const who = selectField('Character', [['', 'all characters'], ...[...ART_IDS.heroes, ...ART_IDS.enemies].map((x) => [x, x])]);
  const variant = selectField('Variant', [['', 'normal'], ['enraged', 'boss phase 2']]); const back = element('button', 'secondary', 'Back to debug'); back.onclick = debugLauncher;
  const heroFor = () => (who.select.value && HEROES[who.select.value] ? who.select.value : 'fighter');
  const preview = (label, show) => { const button = element('button', 'secondary', label); button.onclick = show; return button; };
  const victory = (stage) => () => { const result = previewRewards(heroFor(), stage); campaign = result.campaign; stageResult = result.stageResult; adventureVictory(stage, result.rewards); };
  const defeat = () => { const result = previewRewards(heroFor(), 2); campaign = recordDefeat(recordDefeat({ ...result.campaign, stageResults: [...result.campaign.stageResults, { ...result.stageResult, startingAp: 5, mode: 3 }] })); stageResult = campaign.stageResults.at(-1); adventureDefeat(); };
  const results = () => { campaign = previewRewards(heroFor(), 4, 4).campaign; campaignResults(); };
  const intro = () => { campaign = createCampaign(heroFor()); introCinematic(artGallery); };
  const ending = () => { campaign = previewRewards(heroFor(), 4, 4).campaign; endingCinematic(campaignResults); };
  const sakaiCampaign = () => previewRewards(heroFor(), 4, 4, 'sakai').campaign;
  const sakaiIntro = () => { campaign = chapterRest(createCampaign(heroFor(), { cityId: 'sakai', level: LEVELS.length, xp: LEVELS.at(-1).xp })); cityIntroCinematic('sakai', artGallery); };
  const sakaiEnding = () => { campaign = sakaiCampaign(); cityEndingCinematic('sakai', cityResults); };
  const sakaiResults = () => { campaign = sakaiCampaign(); cityResults(); };
  controls.append(state.label, who.label, variant.label, preview('Victory (level up)', victory(1)), preview('Victory (new skill)', victory(2)), preview('Victory (passive)', victory(3)), preview('Final victory', victory(4)), preview('Defeat', defeat), preview('Campaign results (18 missed)', results), preview('Intro story', intro), preview('Ending story', ending), preview('Sakai intro', sakaiIntro), preview('Sakai ending', sakaiEnding), preview('City results (Sakai)', sakaiResults), back);
  const rows = element('div'); page.append(controls, rows);
  const cell = (id, row) => `<div class="art-cell">${battleArt(id, row, { variant: variant.select.value })}<span>${id} · ${row}</span></div>`;
  const draw = () => {
    const id = who.select.value;
    rows.innerHTML = id
      ? `<div class="art-row">${SPRITE_STATES.map((row) => cell(id, row)).join('')}</div>`
      : `<h2>HEROES</h2><div class="art-row">${ART_IDS.heroes.map((x) => cell(x, state.select.value)).join('')}</div><h2>ENEMIES</h2><div class="art-row">${ART_IDS.enemies.map((x) => cell(x, state.select.value)).join('')}</div>`;
    rows.insertAdjacentHTML('beforeend', `<h2>BACKDROPS</h2><div class="art-row">${[1, 2, 3, 4].map((s) => `<div class="rpg-stage-scene ${backdropClass(s)}" style="width:384px"></div>`).join('')}</div>`);
  };
  [state.select, who.select, variant.select].forEach((control) => { control.onchange = draw; }); draw(); app.append(page);
}
function selectField(name, options) { const label = element('label', '', name); const select = document.createElement('select'); options.forEach(([value, textValue]) => { const option = element('option', '', textValue); option.value = value; select.append(option); }); label.append(select); return { label, select }; }
function numberField(name, min, max, value) { const label = element('label', '', name); const input = document.createElement('input'); input.type = 'number'; input.min = min; input.max = max; input.value = value; label.append(input); return { label, input }; }
function startDebugBattle(config) { showBattle(createBattle(config), { kind: 'debug', tier: ENCOUNTERS[config.encounterId].tier, config }); }
function debugBattleEnd(state, options) {
  clearScreen(); screen = 'debug-result'; audio.play(state.turn === 'won' ? 'victory' : 'defeat'); const card = element('section', 'card centered'); card.append(element('h1', '', state.turn === 'won' ? 'VICTORY!' : 'DEFEATED'));
  card.append(element('p', '', `Turns: ${state.round} · HP left: ${state.hero.hp}/${state.hero.maxHp} · AP left: ${state.ap} · Potions left: ${state.potions}${state.turn === 'won' ? ` · XP: ${battleXp(state)}` : ''}`));
  const retry = element('button', '', 'Retry'); retry.onclick = () => startDebugBattle(options.config); const random = element('button', '', 'Random encounter (same tier)'); random.onclick = () => { const current = ENCOUNTERS[options.config.encounterId]; const config = current.city ? options.config : { ...options.config, encounterId: chooseEncounter(options.tier).id, startWave: 1 }; debugConfig = config; startDebugBattle(config); };
  const back = element('button', 'secondary', 'Back to debug'); back.onclick = debugLauncher; card.append(retry, random, back); app.append(card);
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { if (screen === 'study-quiz' || screen === 'study-end') levelSelect(); else if (['adventure-quiz', 'stage-complete', 'battle'].includes(screen) && !(screen === 'battle' && battleView?.playing)) confirmQuit(); }
  if (round && event.key >= '1' && event.key <= '4' && document.querySelector('.choices') && viewModel(round.mode, currentItem(), { micFree: answerByChoices() }).input === 'choices') document.querySelectorAll('.choices button')[Number(event.key) - 1]?.click();
});

const debugMode = new URLSearchParams(location.search).get('debug');
/** ?debug=quiz&stage=3&hero=mage: an Adventure quiz stage straight away, for layout review. */
function debugQuiz(params) {
  const heroId = HEROES[params.get('hero')] ? params.get('hero') : 'fighter';
  const stage = Math.max(1, Math.min(4, Number(params.get('stage')) || 1));
  campaign = { ...createCampaign(heroId), stage };
  startRound(stage, createRound(VOCABULARY), 'adventure');
}

// ?debug=map&preset=fresh|matsubara|sakai[&hero=ninja][&justSaved=sakai]: write that
// regional save (it replaces this browser's save) and open the Osaka map.
const MAP_PRESETS = { fresh: [], matsubara: ['matsubara'], sakai: ['matsubara', 'sakai'] };
function debugMap(params) {
  const saved = MAP_PRESETS[params.get('preset')] ?? MAP_PRESETS.matsubara;
  const heroId = HEROES[params.get('hero')] ? params.get('hero') : 'fighter';
  saveRegion({ heroId: saved.length ? heroId : null, level: saved.length ? LEVELS.length : 1, xp: saved.length ? 300 : 0, savedCities: saved, checkpoint: null });
  const justSaved = params.get('justSaved');
  osakaMapScreen({ justSaved: saved.includes(justSaved) ? justSaved : null });
}

const debugParams = new URLSearchParams(location.search);
if (debugMode === 'battle') debugLauncher(); else if (debugMode === 'art') artGallery(); else if (debugMode === 'quiz') debugQuiz(debugParams); else if (debugMode === 'map') debugMap(debugParams); else mainMenu();
