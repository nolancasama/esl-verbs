import { VOCABULARY } from './vocab.js';
import { isJapaneseCorrect } from './normalize.js';
import { MODES, answer, createRound, makeChoices, practiceItems, viewModel } from './engine.js';
import { TapToTalk } from './speech.js';
import { speak } from './tts.js';
import { CAMPAIGN, ENCOUNTERS, ENEMIES, HEROES, LEVELS, SKILLS } from './battle-data.js';
import { battleXp, chooseEncounter, createBattle } from './battle-engine.js';
import {
  applyVictory, battleAp, battleSetup, campaignMaxHp, campaignSummary, createCampaign, recordDefeat, recordStage, xpProgress,
} from './campaign.js';
import { createBattleView } from './battle-ui.js';
import { ART_IDS, SPRITE_STATES, backdropClass, battleArt, getIcon } from './battle-art.js';
import { createApMeter } from './ap-meter.js';
import { createAudio } from './audio.js';

const app = document.querySelector('#app');
const MIC_FREE_KEY = 'esl-verbs-mic-free';
const MIC_MESSAGE = '音声認識を使えません。「マイクなし」を使ってください。';
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
let recognitionErrors = 0, speechDenied = false, tap = null, lastHeard = '';
let campaign = null, stageResult = null, battleView = null, screen = 'menu', debugConfig = null, screenTimers = [];

function readMicFree() { try { return localStorage.getItem(MIC_FREE_KEY) === 'true'; } catch { return false; } }
function saveMicFree(value) { try { localStorage.setItem(MIC_FREE_KEY, String(value)); } catch {} }
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
  const adventure = element('button', 'menu-choice adventure-choice px-button'); adventure.onclick = heroSelect;
  const trio = element('span', 'adventure-trio'); trio.setAttribute('aria-hidden', 'true'); trio.innerHTML = ART_IDS.heroes.map((id) => battleArt(id)).join('');
  adventure.append(trio, element('span', '', 'ADVENTURE'), element('small', '', 'ぼうけん'));
  const study = element('button', 'menu-choice', 'STUDY / れんしゅう'); study.onclick = levelSelect;
  const toggles = element('div', 'menu-toggles'); toggles.append(micToggle(), musicToggle());
  actions.append(adventure, study); card.append(actions, toggles); app.append(card);
}

function levelSelect() {
  clearScreen(); round = null; quizContext = null; screen = 'study-select';
  audio.stop();
  const card = element('section', 'card'); card.append(element('h1', '', 'Study / れんしゅう'));
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
  Object.values(HEROES).forEach((hero) => {
    const button = element('button', 'hero-card px-button'); button.dataset.hero = hero.id; const art = element('span', 'hero-card-art'); art.innerHTML = battleArt(hero.id);
    art.firstElementChild?.setAttribute('aria-hidden', 'true');
    button.append(art, element('strong', '', hero.name.toUpperCase()), element('span', 'hero-ja', hero.jaName), element('span', 'hero-kana', hero.kanaSummary), element('small', '', hero.summary));
    button.setAttribute('aria-label', `${hero.name} / ${hero.jaName}: ${hero.kanaSummary} ${hero.summary}`);
    button.onclick = () => startCampaign(hero.id); grid.append(button);
  }); card.append(grid); app.append(card);
}

/* ------------------------------------------------------------------- quiz */

function startCampaign(heroId) { campaign = createCampaign(heroId); startRound(1, createRound(VOCABULARY), 'adventure'); }
function startRound(mode, items = createRound(VOCABULARY), context = 'study') {
  round = { mode, items, currentIndex: 0, correctCount: 0, currentStreak: 0, bestStreak: 0, missedIds: new Set(), allItems: VOCABULARY };
  quizContext = context; feedback = ''; audioError = false; recognitionErrors = 0;
  if (mode >= 3 && !micFree && !speechRecognitionAvailable()) { micFree = true; saveMicFree(true); feedback = MIC_MESSAGE; }
  if (context === 'adventure') { apMeter?.set(0, { animate: false }); audio.play('field'); } else audio.stop();
  renderQuestion();
}

function renderQuestion(autoSpeak = true) {
  if (isAdventure()) { renderAdventureQuestion(autoSpeak); return; }
  tap?.cancel(); tap = null; clearBattle(); screen = 'study-quiz';
  const item = currentItem(); const vm = viewModel(round.mode, item, { micFree }); app.replaceChildren(); app.className = 'app';
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

function heroQuizPose() {
  if (feedback.startsWith('Correct')) return 'victory';
  if (/^(Wrong|Answer)/.test(feedback)) return 'hit';
  return 'idle';
}

/** Adventure quiz: the same question flow inside an RPG frame, with the AP meter on top. */
function renderAdventureQuestion(autoSpeak = true) {
  tap?.cancel(); tap = null; clearBattle(); clearTimers(); screen = 'adventure-quiz';
  const item = currentItem(); const vm = viewModel(round.mode, item, { micFree });
  const stage = campaign.stage; const hero = HEROES[campaign.heroId];
  app.replaceChildren(); app.className = 'app rpg-app rpg-quiz-app';
  const root = element('section', `rpg-quiz stage-${stage}`);

  const top = element('div', 'rpg-topbar');
  const back = element('button', 'secondary px-button rpg-topbar__menu', '← Menu'); back.onclick = confirmQuit;
  const slot = element('span', 'ap-slot'); const right = element('div', 'rpg-topbar__right'); right.append(musicToggle());
  top.append(back, slot, right);

  const status = element('div', 'rpg-quiz__status px-panel');
  status.append(element('span', 'rpg-quiz__stage', `STAGE ${stage}`), element('span', 'rpg-quiz__mode', titles[round.mode][2]), element('span', 'rpg-quiz__count', `${round.currentIndex + 1} / ${round.items.length}`));

  const scene = element('div', `rpg-quiz__scene ${backdropClass(stage)}`);
  const pose = element('span', 'rpg-quiz__hero'); pose.innerHTML = battleArt(hero.id, heroQuizPose()); pose.firstElementChild?.setAttribute('aria-hidden', 'true');
  const party = element('div', 'rpg-quiz__party px-panel');
  party.append(element('strong', '', `${hero.name.toUpperCase()} LV ${campaign.level}`), hpLine(campaign.heroHp, campaignMaxHp(campaign)), element('span', 'rpg-quiz__potions', `ポーション ×${campaign.potions}`));
  scene.append(pose, party);
  if (round.currentStreak >= 2) scene.append(element('div', 'rpg-quiz__streak', `${round.currentStreak} in a row!`));

  const win = element('div', 'rpg-quiz__window px-panel');
  const promptRow = element('div', 'rpg-quiz__prompt-row');
  promptRow.append(element('div', vm.promptText === null ? 'rpg-quiz__prompt rpg-quiz__prompt--audio' : 'rpg-quiz__prompt', vm.promptText ?? '🔊'));
  const controls = element('div', 'rpg-quiz__controls');
  const replay = element('button', 'secondary px-button', '🔊 Replay'); replay.onclick = () => playPrompt(vm); controls.append(replay);
  if (round.mode >= 3) controls.append(micToggle());
  win.append(promptRow, controls);
  if (audioError) win.append(element('div', 'audio-error', MODES[round.mode].showPrompt ? '音が出ません（表示のことばを読んでください）' : '音が出ません'));
  win.append(answerArea(vm, item, true));

  const body = element('div', 'rpg-quiz__body'); body.append(scene, win);
  root.append(top, status, body); app.append(root);
  apMeter?.mount(slot); apMeter?.set(round.correctCount);
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
  if (isAdventure()) audio.sfx(correct ? 'correct' : 'wrong');
  renderQuestion(false);
}
function nextQuestion() { round = { ...round, currentIndex: round.currentIndex + 1 }; feedback = ''; audioError = false; if (round.currentIndex >= round.items.length) isAdventure() ? finishAdventureStage() : endScreen(); else renderQuestion(); }
function fallback(reason) { if (reason === 'denied') speechDenied = true; micFree = true; saveMicFree(true); feedback = MIC_MESSAGE; renderQuestion(false); }
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
  stopMedia(); const stage = campaign.stage; const encounter = chooseEncounter(stage); campaign = recordStage(campaign, round, encounter.id); stageResult = campaign.stageResults.at(-1);
  screen = 'stage-complete'; app.replaceChildren(); rpgScreen(); clearTimers();
  const card = element('section', 'rpg-card px-panel stage-card'); const { top, slot } = rpgTopbar(); card.append(top);
  const scene = element('div', `rpg-stage-scene ${backdropClass(stage)}`); scene.innerHTML = battleArt(campaign.heroId, 'victory'); scene.firstElementChild?.setAttribute('aria-hidden', 'true');
  const foes = element('div', 'rpg-foes'); ENCOUNTERS[encounter.id].enemyIds.forEach((id) => foes.append(element('span', 'rpg-foe', ENEMIES[id].name)));
  const earned = element('div', 'rpg-earned');
  earned.append(element('div', 'rpg-score', `${stageResult.correct} / ${stageResult.total}`), element('div', 'rpg-earned__ap', `= ${stageResult.startingAp} AP`));
  const party = element('div', 'rpg-party px-panel');
  party.append(element('strong', '', `LV ${campaign.level}`), hpLine(campaign.heroHp, campaignMaxHp(campaign)), element('span', '', `ポーション ×${campaign.potions}`));
  const apNote = element('p', 'rpg-note', stageResult.startingAp > 0 ? 'Every action costs AP. / こうどうに AP をつかうよ！' : '0 AP… you will rest to recover AP. / AP 0 … やすんで かいふく！');
  const battle = element('button', 'battle-start px-button', 'BATTLE!'); battle.onclick = () => startAdventureBattle();
  card.append(element('h1', 'rpg-title', `STAGE ${stage} CLEAR!`), scene, earned, party, element('p', 'rpg-foes-label', 'ENEMY / てき'), foes, apNote, battle);
  app.append(card); apMeter?.mount(slot); apMeter?.set(stageResult.startingAp, { quiet: true });
  audio.sfx('fanfare');
  queueMicrotask(() => battle.focus());
}

function startAdventureBattle() {
  const stage = stageResult.mode;
  const state = createBattle(battleSetup(campaign, stageResult));
  showBattle(state, { kind: 'adventure', stage });
}

function showBattle(initialState, options) {
  clearScreen(); screen = options.kind === 'debug' ? 'debug-battle' : 'battle'; app.className = 'app battle-app'; const host = element('section', 'battle-host'); app.append(host);
  const boss = initialState.enemies.some((enemy) => ENEMIES[enemy.id].boss);
  audio.play(boss ? 'boss' : 'battle');
  let defenceHintRound = null;
  const onboardingHint = options.kind === 'adventure' && options.stage === 1 ? (state) => {
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
  const final = stage === 4;
  audio.play(final ? 'finale' : 'victory');
  const card = element('section', `rpg-card px-panel result-card victory-card${final ? ' victory-card--final' : ''}`);
  const title = element('h1', `rpg-title${final ? ' rpg-burst' : ''}`, 'VICTORY!'); card.append(title, heroPose('victory', stage));
  if (final) card.append(element('h2', 'rpg-title rpg-master', 'VERB MASTER!'));

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
    rest.hidden = true;
    card.append(rest);
  }

  const next = element('button', 'px-button', final ? 'CAMPAIGN RESULTS' : 'NEXT STAGE');
  next.onclick = final ? campaignResults : () => startRound(campaign.stage, createRound(VOCABULARY), 'adventure');
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
  const showLevel = (reward) => {
    levelLabel.textContent = `LV ${reward.level}${reward.mastery ? ' · MASTER' : ''}`;
    levelUps.append(rewardLine('combo', `LEVEL UP!  LV ${reward.level}`, 'rpg-reward-line--levelup'));
    if (reward.maxHpGain) levelUps.append(rewardLine('heart', `MAX HP +${reward.maxHpGain}`));
    reward.skills.forEach((id) => levelUps.append(rewardLine(id, `NEW SKILL!  ${SKILLS[id].name.toUpperCase()} / ${SKILLS[id].jaName} · ${SKILLS[id].cost} AP`, 'rpg-reward-line--skill')));
    if (reward.passive) levelUps.append(rewardLine('counter', `POWER UP!  ${reward.passive.name.toUpperCase()} — ${reward.passive.kanaText}`, 'rpg-reward-line--skill'));
    if (reward.mastery) levelUps.append(rewardLine('power', 'VERB MASTER! / マスター！', 'rpg-reward-line--skill'));
    audio.sfx('levelup');
  };
  const start = xpProgress(rewards.xpBefore);
  setBar(start.ratio, true);
  let at = 450;
  rewards.levelUps.forEach((reward) => {
    steps.push([at, () => setBar(1)]);
    at += 750;
    steps.push([at, () => { showLevel(reward); setBar(0, true); }]);
    at += 350;
  });
  const end = xpProgress(rewards.xp);
  steps.push([at, () => setBar(end.ratio)]);
  at += 700;
  steps.push([at, () => { if (rest) rest.hidden = false; }]);

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimers();
    levelUps.replaceChildren();
    rewards.levelUps.forEach(showLevel);
    levelLabel.textContent = `LV ${rewards.level}${rewards.level === LEVELS.length ? ' · MASTER' : ''}`;
    setBar(end.ratio, true);
    if (rest) rest.hidden = false;
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
  card.append(title, heroPose('defeat', stageResult.mode));
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

function campaignResults() {
  clearScreen(); rpgScreen(); screen = 'campaign-results'; audio.play('title');
  const summary = campaignSummary(campaign); const hero = HEROES[campaign.heroId];
  const card = element('section', 'rpg-card px-panel results-card'); card.append(element('h1', 'rpg-title', 'VICTORY! VERB MASTER!'));
  const heroLine = element('div', 'results-hero'); const art = element('span', 'mini-art'); art.innerHTML = battleArt(hero.id, 'victory'); art.firstElementChild?.setAttribute('aria-hidden', 'true');
  heroLine.append(art, element('strong', '', `${hero.name} / ${hero.jaName} · LV ${summary.level}`)); card.append(heroLine);
  card.append(element('div', 'rpg-score', `${summary.totalCorrect} / ${summary.totalQuestions}`), element('p', '', `Best streak: ${summary.bestStreak}`));
  const scores = element('div', 'stage-results'); campaign.stageResults.forEach((result, index) => scores.append(element('span', '', `Stage ${index + 1}: ${result.correct} / ${result.total}`))); card.append(scores);
  const missed = practiceItems(VOCABULARY, summary.missedIds);
  if (missed.length) { const list = element('ul', 'missed'); missed.forEach((item) => list.append(element('li', '', `${item.en} — ${item.ja}`))); card.append(list); } else card.append(element('p', 'correct', 'PERFECT!'));
  const actions = element('div', 'actions'); if (missed.length) { const practice = element('button', 'px-button', 'Practice mistakes'); practice.onclick = () => practiceModePicker(missed); actions.append(practice); }
  const again = element('button', 'px-button', 'Play Again'); again.onclick = () => startCampaign(campaign.heroId); const choose = element('button', 'secondary px-button', 'Choose Hero'); choose.onclick = heroSelect; const menu = element('button', 'secondary px-button', 'Main Menu'); menu.onclick = mainMenu;
  actions.append(again, choose, menu); card.append(actions); app.append(card);
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

/* ------------------------------------------------------------------ debug */

function debugLauncher() {
  clearScreen(); screen = 'debug'; audio.stop(); const card = element('section', 'card wide-card'); card.append(element('h1', '', 'Battle Debug')); const form = element('form', 'debug-form');
  const hero = selectField('Hero', Object.values(HEROES).map((x) => [x.id, x.name])); const encounterWrap = element('label', '', 'Encounter'); const encounter = document.createElement('select');
  for (let tier = 1; tier <= 4; tier += 1) { const group = document.createElement('optgroup'); group.label = `Tier ${tier}`; Object.values(ENCOUNTERS).filter((x) => x.tier === tier).forEach((x) => { const option = element('option', '', x.id); option.value = x.id; group.append(option); }); encounter.append(group); } encounterWrap.append(encounter);
  const ap = numberField('AP (starting)', 0, 10, 7);
  const presets = element('div', 'debug-presets'); [0, 5, 6, 7, 8, 10].forEach((value) => { const button = element('button', 'secondary', `${value} AP`); button.type = 'button'; button.onclick = () => { ap.input.value = value; }; presets.append(button); });
  const level = selectField('Level (HP, skills, passive)', LEVELS.map((row) => [row.level, `LV ${row.level} · tier ${row.skillTier} · +${row.maxHpBonus} HP`]));
  const skill = selectField('Skill tier', [['', 'auto (from level)'], [0, '0'], [1, '1'], [2, '2']]);
  const hp = numberField('Hero HP (blank = full)', 0, 99, ''); hp.input.value = '';
  const potions = numberField('Potions', 0, CAMPAIGN.maxPotions, CAMPAIGN.startingPotions);
  const start = element('button', '', 'START BATTLE'); form.append(hero.label, encounterWrap, ap.label, presets, level.label, skill.label, hp.label, potions.label, start);
  // Encounter tier suggests the campaign level; the level select stays editable.
  encounter.onchange = () => { level.select.value = String(ENCOUNTERS[encounter.value].tier); };
  level.select.value = '1';
  if (debugConfig) {
    hero.select.value = debugConfig.heroId; encounter.value = debugConfig.encounterId; ap.input.value = debugConfig.ap; level.select.value = String(debugConfig.level);
    skill.select.value = debugConfig.skillTier ?? ''; potions.input.value = debugConfig.potions; if (debugConfig.heroHp !== undefined) hp.input.value = debugConfig.heroHp;
  }
  form.onsubmit = (event) => {
    event.preventDefault();
    debugConfig = {
      heroId: hero.select.value, encounterId: encounter.value, ap: Number(ap.input.value), level: Number(level.select.value),
      skillTier: skill.select.value === '' ? undefined : Number(skill.select.value), potions: Number(potions.input.value),
      heroHp: hp.input.value === '' ? undefined : Number(hp.input.value),
    };
    startDebugBattle(debugConfig);
  };
  const gallery = element('button', 'secondary', 'SPRITE GALLERY'); gallery.type = 'button'; gallery.onclick = artGallery;
  card.append(form, gallery); app.append(card);
}

function previewRewards(heroId, stage) {
  let preview = createCampaign(heroId);
  for (let index = 1; index <= stage; index += 1) {
    const encounterId = chooseEncounter(index, () => 0).id;
    preview = recordStage(preview, { mode: index, items: new Array(10).fill({ id: 'x' }), correctCount: index === stage ? 10 : 7, bestStreak: 7, missedIds: new Set() }, encounterId);
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
  controls.append(state.label, who.label, variant.label, preview('Victory (level up)', victory(1)), preview('Victory (new skill)', victory(2)), preview('Victory (passive)', victory(3)), preview('Final victory', victory(4)), preview('Defeat', defeat), back);
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
  const retry = element('button', '', 'Retry'); retry.onclick = () => startDebugBattle(options.config); const random = element('button', '', 'Random encounter (same tier)'); random.onclick = () => { const config = { ...options.config, encounterId: chooseEncounter(options.tier).id }; debugConfig = config; startDebugBattle(config); };
  const back = element('button', 'secondary', 'Back to debug'); back.onclick = debugLauncher; card.append(retry, random, back); app.append(card);
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { if (screen === 'study-quiz' || screen === 'study-end') levelSelect(); else if (['adventure-quiz', 'stage-complete', 'battle'].includes(screen) && !(screen === 'battle' && battleView?.playing)) confirmQuit(); }
  if (round && event.key >= '1' && event.key <= '4' && document.querySelector('.choices') && viewModel(round.mode, currentItem(), { micFree }).input === 'choices') document.querySelectorAll('.choices button')[Number(event.key) - 1]?.click();
});

const debugMode = new URLSearchParams(location.search).get('debug');
if (debugMode === 'battle') debugLauncher(); else if (debugMode === 'art') artGallery(); else mainMenu();
