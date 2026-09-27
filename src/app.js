import { VOCABULARY } from './vocab.js';
import { isJapaneseCorrect } from './normalize.js';
import { MODES, answer, createRound, makeChoices, practiceItems, viewModel } from './engine.js';
import { TapToTalk } from './speech.js';
import { speak } from './tts.js';
import { HEROES, ENCOUNTERS, SKILLS } from './battle-data.js';
import { chooseEncounter, createBattle, skillTierForStage } from './battle-engine.js';
import { battlePowerFor, campaignSummary, createCampaign, recordStage, retryPower } from './campaign.js';
import { createBattleView } from './battle-ui.js';
import { battleArt } from './battle-art.js';

const app = document.querySelector('#app');
const MIC_FREE_KEY = 'esl-verbs-mic-free';
const MIC_MESSAGE = '音声認識を使えません。「マイクなし」を使ってください。';
const titles = {
  1: ['English → Japanese', 'See and hear English. Type Japanese.', 'えいごを見て聞いて、日本語を書こう'],
  2: ['Listen → Japanese', 'Hear English. Type Japanese.', 'えいごを聞いて、日本語を書こう'],
  3: ['Japanese → Speak English', 'See and hear Japanese. Say the English word.', '日本語を見て聞いて、えいごで言おう'],
  4: ['Listen → Speak English', 'Hear Japanese. Say the English word.', '日本語を聞いて、えいごで言おう'],
};
let micFree = readMicFree(), round = null, quizContext = null, feedback = '', audioError = false;
let recognitionErrors = 0, speechDenied = false, tap = null, lastHeard = '';
let campaign = null, stageResult = null, battleView = null, screen = 'menu', debugConfig = null;

function readMicFree() { try { return localStorage.getItem(MIC_FREE_KEY) === 'true'; } catch { return false; } }
function saveMicFree(value) { try { localStorage.setItem(MIC_FREE_KEY, String(value)); } catch {} }
function currentItem() { return round?.items[round.currentIndex]; }
function setMicFree(value) { micFree = value; saveMicFree(value); if (round) renderQuestion(false); }
function element(tag, className = '', text = '') { const node = document.createElement(tag); node.className = className; node.textContent = text; return node; }
function speechRecognitionAvailable() { return Boolean(globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition); }
function stopMedia() { tap?.cancel(); tap = null; globalThis.speechSynthesis?.cancel?.(); }
function clearBattle() { battleView?.destroy?.(); battleView = null; }
function clearScreen() { stopMedia(); clearBattle(); app.replaceChildren(); app.className = 'app'; }

function mainMenu() {
  clearScreen(); round = null; quizContext = null; campaign = null; stageResult = null; screen = 'menu';
  const card = element('section', 'card menu-card'); card.append(element('h1', 'game-title', 'ESL VERBS'));
  const actions = element('div', 'menu-actions');
  const adventure = element('button', 'menu-choice adventure-choice', 'ADVENTURE / ぼうけん'); adventure.onclick = heroSelect;
  const study = element('button', 'menu-choice', 'STUDY / れんしゅう'); study.onclick = levelSelect;
  actions.append(adventure, study); card.append(actions, micToggle()); app.append(card);
}

function levelSelect() {
  clearScreen(); round = null; quizContext = null; screen = 'study-select';
  const card = element('section', 'card'); card.append(element('h1', '', 'Study / れんしゅう'));
  const back = element('button', 'secondary', '← Main Menu'); back.onclick = mainMenu; card.append(back);
  const levels = element('div', 'levels');
  Object.entries(titles).forEach(([mode, title]) => {
    const button = element('button', 'level'); button.append(element('strong', '', `${mode}. ${title[0]}`), element('small', '', `${title[1]} (${title[2]})`));
    button.onclick = () => startRound(Number(mode)); levels.append(button);
  });
  card.append(levels, micToggle()); app.append(card);
}

function heroSelect() {
  clearScreen(); screen = 'hero-select'; const card = element('section', 'card wide-card');
  const top = element('div', 'topline'); top.append(element('h1', '', 'Choose Hero / ヒーローをえらぼう'));
  const back = element('button', 'secondary', '← Main Menu'); back.onclick = mainMenu; top.append(back); card.append(top);
  const grid = element('div', 'hero-grid');
  Object.values(HEROES).forEach((hero) => {
    const button = element('button', 'hero-card'); button.dataset.hero = hero.id; const art = element('span', 'hero-card-art'); art.innerHTML = battleArt(hero.id);
    button.append(art, element('strong', '', `${hero.name} / ${hero.jaName}`), element('span', '', hero.kanaSummary), element('small', '', hero.summary));
    button.onclick = () => startCampaign(hero.id); grid.append(button);
  }); card.append(grid); app.append(card);
}

function startCampaign(heroId) { campaign = createCampaign(heroId); startRound(1, createRound(VOCABULARY), 'adventure'); }
function startRound(mode, items = createRound(VOCABULARY), context = 'study') {
  round = { mode, items, currentIndex: 0, correctCount: 0, currentStreak: 0, bestStreak: 0, missedIds: new Set(), allItems: VOCABULARY };
  quizContext = context; feedback = ''; audioError = false; recognitionErrors = 0;
  if (mode >= 3 && !micFree && !speechRecognitionAvailable()) { micFree = true; saveMicFree(true); feedback = MIC_MESSAGE; }
  renderQuestion();
}

function renderQuestion(autoSpeak = true) {
  tap?.cancel(); tap = null; clearBattle(); screen = quizContext === 'adventure' ? 'adventure-quiz' : 'study-quiz';
  const item = currentItem(); const vm = viewModel(round.mode, item, { micFree }); app.replaceChildren(); app.className = 'app';
  const card = element('section', 'card'); const top = element('div', 'topline');
  const back = element('button', 'secondary', quizContext === 'adventure' ? '← Menu' : '← Level select'); back.onclick = quizContext === 'adventure' ? confirmQuit : levelSelect;
  const hud = element('div', 'hud', `${round.currentIndex + 1} / ${round.items.length}`); top.append(back, hud); card.append(top);
  if (quizContext === 'adventure') card.append(element('div', 'stage-label', `STAGE ${campaign.stage} · MODE ${round.mode}`));
  if (round.currentStreak >= 2) card.append(element('div', 'streak', `${round.currentStreak} in a row!`));
  if (quizContext === 'adventure') card.append(element('div', `power-meter${feedback.includes('+1 POWER') ? ' power-pulse' : ''}`, `⚡ POWER ${battlePowerFor(round.correctCount)}`));
  card.append(element('div', vm.promptText === null ? 'prompt audio-icon' : 'prompt', vm.promptText ?? '🔊'));
  const controls = element('div', 'actions'); const replay = element('button', 'secondary', '🔊 Replay'); replay.onclick = () => playPrompt(vm); controls.append(replay);
  if (round.mode >= 3) controls.append(micToggle());
  if (audioError) controls.append(element('div', 'audio-error', MODES[round.mode].showPrompt ? '音が出ません（表示のことばを読んでください）' : '音が出ません'));
  card.append(controls, answerArea(vm, item)); app.append(card); if (autoSpeak) playPrompt(vm);
}

function answerArea(vm, item) {
  const area = element('div', 'answer'); const tone = feedback.startsWith('Correct') ? ' correct' : feedback.startsWith('Wrong') || feedback.startsWith('Answer') ? ' wrong' : '';
  const status = element('div', `feedback${tone}`, feedback || (vm.input === 'enSpeech' ? 'Ready' : '')); area.append(status);
  if (/^(Correct|Wrong|Answer)/.test(feedback)) { const next = element('button', '', 'Next'); next.onclick = nextQuestion; area.append(next); queueMicrotask(() => next.focus()); return area; }
  if (vm.input === 'jaText') {
    const input = document.createElement('input'); input.lang = 'ja'; input.autofocus = true; input.setAttribute('aria-label', 'Japanese answer');
    const check = element('button', '', 'Check'); const submit = () => { if (input.value.trim()) mark(isJapaneseCorrect(input.value, item.jaAccepted), item); };
    check.onclick = submit; input.onkeydown = (event) => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); submit(); } };
    area.append(input, check); queueMicrotask(() => input.focus());
  } else if (vm.input === 'choices') {
    const choices = element('div', 'choices'); makeChoices(item, VOCABULARY).forEach((choice, index) => {
      const button = element('button', '', `${index + 1}. ${choice.en}`); button.onclick = () => mark(choice.id === item.id, item); choices.append(button);
    });
    const showAnswer = element('button', 'secondary', 'こたえを見る'); showAnswer.onclick = () => mark(false, item, true); area.append(choices, showAnswer);
  } else {
    const mic = element('button', 'mic', '🎤 Tap to talk'); const showAnswer = element('button', 'secondary', 'こたえを見る'); showAnswer.onclick = () => mark(false, item, true);
    tap = new TapToTalk({ onCorrect: () => mark(true, item), onHeard: (heard) => { recognitionErrors = 0; lastHeard = heard; status.textContent = `Heard: ${heard}`; },
      onStatus: (message) => { if (message === 'Listening...') lastHeard = ''; status.textContent = message === 'Try again' && lastHeard ? `Heard: ${lastHeard} — Try again` : message; },
      onUnavailable: (reason) => fallback(reason), onError: () => { recognitionErrors += 1; if (recognitionErrors >= 3) fallback(); } });
    mic.onclick = () => tap.start(item.enAccepted); area.append(mic, showAnswer);
  } return area;
}

function mark(correct, item, shown = false) {
  tap?.cancel(); round = answer(round, correct);
  feedback = correct ? `Correct! / せいかい！${quizContext === 'adventure' ? '  ⚡ +1 POWER' : ''}` : shown ? `Answer: ${item.en}` : `Wrong. Answer: ${round.mode >= 3 ? item.en : round.mode === 2 ? `${item.ja} (${item.en})` : item.ja}`;
  renderQuestion(false);
}
function nextQuestion() { round = { ...round, currentIndex: round.currentIndex + 1 }; feedback = ''; audioError = false; if (round.currentIndex >= round.items.length) quizContext === 'adventure' ? finishAdventureStage() : endScreen(); else renderQuestion(); }
function fallback(reason) { if (reason === 'denied') speechDenied = true; micFree = true; saveMicFree(true); feedback = MIC_MESSAGE; renderQuestion(false); }
function playPrompt(vm) { speak(vm.speak.text, vm.speak.lang, { onError: () => { audioError = true; renderQuestion(false); } }); }
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

function finishAdventureStage() {
  stopMedia(); const stage = campaign.stage; const encounter = chooseEncounter(stage); campaign = recordStage(campaign, round, encounter.id); stageResult = campaign.stageResults.at(-1);
  screen = 'stage-complete'; app.replaceChildren(); const card = element('section', 'card centered'); const menu = element('button', 'secondary corner-button', '← Menu'); menu.onclick = confirmQuit; card.append(menu);
  card.append(element('h1', '', `STAGE ${stage} COMPLETE`), element('div', 'stage-score', `${stageResult.correct} / ${stageResult.total}`), element('div', 'power-meter large', `⚡ Battle Power: ${stageResult.battlePower}`));
  const battle = element('button', 'battle-start', 'BATTLE!'); battle.onclick = () => startAdventureBattle(false); card.append(battle); app.append(card); queueMicrotask(() => battle.focus());
}
function startAdventureBattle(retry) {
  const stage = stageResult.mode; const state = createBattle({ heroId: campaign.heroId, encounterId: stageResult.encounterId, power: retry ? retryPower(stageResult) : stageResult.battlePower, skillTier: skillTierForStage(stage) });
  showBattle(state, { kind: 'adventure', stage });
}
function showBattle(initialState, options) {
  clearScreen(); screen = options.kind === 'debug' ? 'debug-battle' : 'battle'; app.className = 'app battle-app'; const host = element('section', 'battle-host'); app.append(host);
  let defenceHintRound = null;
  const onboardingHint = options.kind === 'adventure' && options.stage === 1 ? (state) => {
    if (state.round === 1) return { skill: 'basic', text: 'こうげきしてみよう！' };
    if (defenceHintRound === null && state.hero.hp < state.hero.maxHp / 2) defenceHintRound = state.round;
    return defenceHintRound === state.round ? { skill: 'defense', text: 'まもろう！' } : null;
  } : null;
  battleView = createBattleView(host, { state: initialState, hint: onboardingHint,
    onExit: options.kind === 'adventure' ? confirmQuit : debugLauncher,
    onAction: (nextState) => { if (nextState?.turn === 'won' || nextState?.turn === 'lost') battleEnded(nextState, options); }, onSelect: () => {} });
}
function battleEnded(state, options) { if (options.kind === 'debug') debugBattleEnd(state, options); else if (state.turn === 'won') adventureVictory(options.stage); else adventureDefeat(); }
function adventureVictory(stage) {
  clearScreen(); screen = 'battle-result'; const card = element('section', 'card centered result-card'); card.append(element('h1', 'victory-title', 'VICTORY!'));
  if (stage <= 2) { const skill = SKILLS[HEROES[campaign.heroId].skills[stage + 1]]; card.append(element('h2', 'unlock', 'NEW SKILL!'), element('p', '', `${skill.name} / ${skill.jaName} · ${'⚡'.repeat(skill.cost)}`)); }
  const next = element('button', '', stage === 4 ? 'CAMPAIGN RESULTS' : 'NEXT STAGE'); next.onclick = stage === 4 ? campaignResults : () => startRound(campaign.stage, createRound(VOCABULARY), 'adventure'); card.append(next); app.append(card); queueMicrotask(() => next.focus());
}
function adventureDefeat() {
  clearScreen(); screen = 'battle-result'; const card = element('section', 'card centered result-card'); card.append(element('h1', 'defeat-title', 'DEFEATED... もういちど！'));
  const retry = element('button', '', `RETRY BATTLE (⚡ ${retryPower(stageResult)})`); retry.onclick = () => startAdventureBattle(true); const menu = element('button', 'secondary', 'MAIN MENU'); menu.onclick = mainMenu; card.append(retry, menu); app.append(card);
}

function campaignResults() {
  clearScreen(); screen = 'campaign-results'; const summary = campaignSummary(campaign); const hero = HEROES[campaign.heroId]; const card = element('section', 'card wide-card'); card.append(element('h1', 'victory-title', 'VICTORY! VERB MASTER!'));
  const heroLine = element('div', 'results-hero'); const art = element('span', 'mini-art'); art.innerHTML = battleArt(hero.id); heroLine.append(art, element('strong', '', `${hero.name} / ${hero.jaName}`)); card.append(heroLine);
  card.append(element('div', 'stage-score', `${summary.totalCorrect} / ${summary.totalQuestions}`), element('p', '', `Best streak: ${summary.bestStreak}`));
  const scores = element('div', 'stage-results'); campaign.stageResults.forEach((result, index) => scores.append(element('span', '', `Stage ${index + 1}: ${result.correct} / ${result.total}`))); card.append(scores);
  const missed = practiceItems(VOCABULARY, summary.missedIds);
  if (missed.length) { const list = element('ul', 'missed'); missed.forEach((item) => list.append(element('li', '', `${item.en} — ${item.ja}`))); card.append(list); } else card.append(element('p', 'correct', 'PERFECT!'));
  const actions = element('div', 'actions'); if (missed.length) { const practice = element('button', '', 'Practice mistakes'); practice.onclick = () => practiceModePicker(missed); actions.append(practice); }
  const again = element('button', '', 'Play Again'); again.onclick = () => startCampaign(campaign.heroId); const choose = element('button', 'secondary', 'Choose Hero'); choose.onclick = heroSelect; const menu = element('button', 'secondary', 'Main Menu'); menu.onclick = mainMenu;
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

function debugLauncher() {
  clearScreen(); screen = 'debug'; const card = element('section', 'card wide-card'); card.append(element('h1', '', 'Battle Debug')); const form = element('form', 'debug-form');
  const hero = selectField('Hero', Object.values(HEROES).map((x) => [x.id, x.name])); const encounterWrap = element('label', '', 'Encounter'); const encounter = document.createElement('select');
  for (let tier = 1; tier <= 4; tier += 1) { const group = document.createElement('optgroup'); group.label = `Tier ${tier}`; Object.values(ENCOUNTERS).filter((x) => x.tier === tier).forEach((x) => { const option = element('option', '', x.id); option.value = x.id; group.append(option); }); encounter.append(group); } encounterWrap.append(encounter);
  const power = numberField('Power', 0, 99, 0); const skill = selectField('Skill tier', [[0, '0'], [1, '1'], [2, '2']]); const hp = numberField('Hero HP (blank = full)', 0, 99, ''); hp.input.value = '';
  const start = element('button', '', 'START BATTLE'); form.append(hero.label, encounterWrap, power.label, skill.label, hp.label, start);
  form.onsubmit = (event) => { event.preventDefault(); debugConfig = { heroId: hero.select.value, encounterId: encounter.value, power: Number(power.input.value), skillTier: Number(skill.select.value), heroHp: hp.input.value === '' ? undefined : Number(hp.input.value) }; startDebugBattle(debugConfig); };
  card.append(form); app.append(card);
}
function selectField(name, options) { const label = element('label', '', name); const select = document.createElement('select'); options.forEach(([value, textValue]) => { const option = element('option', '', textValue); option.value = value; select.append(option); }); label.append(select); return { label, select }; }
function numberField(name, min, max, value) { const label = element('label', '', name); const input = document.createElement('input'); input.type = 'number'; input.min = min; input.max = max; input.value = value; label.append(input); return { label, input }; }
function startDebugBattle(config) { showBattle(createBattle(config), { kind: 'debug', tier: ENCOUNTERS[config.encounterId].tier, config }); }
function debugBattleEnd(state, options) {
  clearScreen(); screen = 'debug-result'; const card = element('section', 'card centered'); card.append(element('h1', '', state.turn === 'won' ? 'VICTORY!' : 'DEFEATED'));
  const retry = element('button', '', 'Retry'); retry.onclick = () => startDebugBattle(options.config); const random = element('button', '', 'Random encounter (same tier)'); random.onclick = () => { const config = { ...options.config, encounterId: chooseEncounter(options.tier).id }; debugConfig = config; startDebugBattle(config); };
  const back = element('button', 'secondary', 'Back to debug'); back.onclick = debugLauncher; card.append(retry, random, back); app.append(card);
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') { if (screen === 'study-quiz' || screen === 'study-end') levelSelect(); else if (['adventure-quiz', 'stage-complete', 'battle'].includes(screen) && !(screen === 'battle' && battleView?.playing)) confirmQuit(); }
  if (round && event.key >= '1' && event.key <= '4' && document.querySelector('.choices') && viewModel(round.mode, currentItem(), { micFree }).input === 'choices') document.querySelectorAll('.choices button')[Number(event.key) - 1]?.click();
});

if (new URLSearchParams(location.search).get('debug') === 'battle') debugLauncher(); else mainMenu();
