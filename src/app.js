import { VOCABULARY } from './vocab.js';
import { isJapaneseCorrect } from './normalize.js';
import { MODES, answer, createRound, makeChoices, practiceItems, viewModel } from './engine.js';
import { TapToTalk } from './speech.js';
import { speak } from './tts.js';

const app = document.querySelector('#app');
const MIC_FREE_KEY = 'esl-verbs-mic-free';
const MIC_MESSAGE = '音声認識を使えません。「マイクなし」を使ってください。';
const titles = {
  1: ['English → Japanese', 'See and hear English. Type Japanese.', 'えいごを見て聞いて、日本語を書こう'],
  2: ['Listen → Japanese', 'Hear English. Type Japanese.', 'えいごを聞いて、日本語を書こう'],
  3: ['Japanese → Speak English', 'See and hear Japanese. Say the English word.', '日本語を見て聞いて、えいごで言おう'],
  4: ['Listen → Speak English', 'Hear Japanese. Say the English word.', '日本語を聞いて、えいごで言おう'],
};
let micFree = readMicFree();
let round = null;
let feedback = '';
let audioError = false;
let recognitionErrors = 0;
let speechDenied = false;
let tap = null;
let lastHeard = '';

function readMicFree() { try { return localStorage.getItem(MIC_FREE_KEY) === 'true'; } catch { return false; } }
function saveMicFree(value) { try { localStorage.setItem(MIC_FREE_KEY, String(value)); } catch {} }
function currentItem() { return round.items[round.currentIndex]; }
function setMicFree(value) { micFree = value; saveMicFree(value); if (round) renderQuestion(false); }

function levelSelect() {
  tap?.cancel(); tap = null; round = null;
  app.replaceChildren();
  const card = element('section', 'card');
  card.append(element('h1', '', 'ESL Verbs'));
  const levels = element('div', 'levels');
  Object.entries(titles).forEach(([mode, title]) => {
    const button = element('button', 'level');
    button.append(element('strong', '', `${mode}. ${title[0]}`), element('small', '', `${title[1]} (${title[2]})`));
    button.onclick = () => startRound(Number(mode)); levels.append(button);
  });
  card.append(levels, micToggle()); app.append(card);
}

function startRound(mode, items = createRound(VOCABULARY)) {
  round = { mode, items, currentIndex: 0, correctCount: 0, currentStreak: 0, bestStreak: 0, missedIds: new Set(), allItems: VOCABULARY };
  feedback = ''; audioError = false; recognitionErrors = 0;
  if (mode >= 3 && !micFree && !speechRecognitionAvailable()) { micFree = true; saveMicFree(true); feedback = MIC_MESSAGE; }
  renderQuestion();
}

function renderQuestion(autoSpeak = true) {
  tap?.cancel(); tap = null;
  const item = currentItem();
  const vm = viewModel(round.mode, item, { micFree });
  app.replaceChildren();
  const card = element('section', 'card');
  const top = element('div', 'topline');
  const back = element('button', 'secondary', '← Level select'); back.onclick = levelSelect;
  const hud = element('div', 'hud', `${round.currentIndex + 1} / ${round.items.length}`);
  top.append(back, hud); card.append(top);
  if (round.currentStreak >= 2) card.append(element('div', 'streak', `${round.currentStreak} in a row!`));
  card.append(element('div', vm.promptText === null ? 'prompt audio-icon' : 'prompt', vm.promptText ?? '🔊'));
  const controls = element('div', 'actions');
  const replay = element('button', 'secondary', '🔊 Replay'); replay.onclick = () => playPrompt(vm); controls.append(replay);
  if (round.mode >= 3) controls.append(micToggle());
  if (audioError) controls.append(element('div', 'audio-error', MODES[round.mode].showPrompt ? '音が出ません（表示のことばを読んでください）' : '音が出ません'));
  card.append(controls, answerArea(vm, item)); app.append(card);
  if (autoSpeak) playPrompt(vm);
}

function answerArea(vm, item) {
  const area = element('div', 'answer');
  const tone = feedback.startsWith('Correct') ? ' correct' : feedback.startsWith('Wrong') || feedback.startsWith('Answer') ? ' wrong' : '';
  const status = element('div', `feedback${tone}`, feedback || (vm.input === 'enSpeech' ? 'Ready' : '')); area.append(status);
  if (feedback.startsWith('Correct') || feedback.startsWith('Wrong') || feedback.startsWith('Answer')) {
    const next = element('button', '', 'Next'); next.onclick = nextQuestion; area.append(next); queueMicrotask(() => next.focus()); return area;
  }
  if (vm.input === 'jaText') {
    const input = document.createElement('input'); input.lang = 'ja'; input.autofocus = true; input.setAttribute('aria-label', 'Japanese answer');
    const check = element('button', '', 'Check');
    const submit = () => { if (input.value.trim()) mark(isJapaneseCorrect(input.value, item.jaAccepted), item); };
    check.onclick = submit; // preventDefault stops this Enter from also clicking the Next button that takes focus after marking.
    input.onkeydown = (event) => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); submit(); } };
    area.append(input, check); queueMicrotask(() => input.focus());
  } else if (vm.input === 'choices') {
    const choices = element('div', 'choices');
    makeChoices(item, VOCABULARY).forEach((choice, index) => {
      const button = element('button', '', `${index + 1}. ${choice.en}`); button.onclick = () => mark(choice.id === item.id, item); choices.append(button);
    });
    const showAnswer = element('button', 'secondary', 'こたえを見る'); showAnswer.onclick = () => mark(false, item, true);
    area.append(choices, showAnswer);
  } else {
    const mic = element('button', 'mic', '🎤 Tap to talk');
    const showAnswer = element('button', 'secondary', 'こたえを見る'); showAnswer.onclick = () => mark(false, item, true);
    tap = new TapToTalk({
      onCorrect: () => mark(true, item), onHeard: (heard) => { recognitionErrors = 0; lastHeard = heard; status.textContent = `Heard: ${heard}`; },
      onStatus: (message) => {
        if (message === 'Listening...') lastHeard = '';
        status.textContent = message === 'Try again' && lastHeard ? `Heard: ${lastHeard} — Try again` : message;
      },
      onUnavailable: (reason) => fallback(reason),
      onError: () => { recognitionErrors += 1; if (recognitionErrors >= 3) fallback(); },
    });
    mic.onclick = () => tap.start(item.enAccepted); area.append(mic, showAnswer);
  }
  return area;
}

function mark(correct, item, shown = false) {
  tap?.cancel();
  round = answer(round, correct);
  feedback = correct ? 'Correct! / せいかい！' : shown ? `Answer: ${item.en}` : `Wrong. Answer: ${round.mode >= 3 ? item.en : round.mode === 2 ? `${item.ja} (${item.en})` : item.ja}`;
  renderQuestion(false);
}
function nextQuestion() { round = { ...round, currentIndex: round.currentIndex + 1 }; feedback = ''; audioError = false; if (round.currentIndex >= round.items.length) endScreen(); else renderQuestion(); }
function fallback(reason) { if (reason === 'denied') speechDenied = true; micFree = true; saveMicFree(true); feedback = MIC_MESSAGE; renderQuestion(false); }
function playPrompt(vm) { speak(vm.speak.text, vm.speak.lang, { onError: () => { audioError = true; renderQuestion(false); } }); }
function micToggle() { const label = element('label', 'toggle'); const input = document.createElement('input'); input.type = 'checkbox'; input.checked = micFree; input.onchange = () => setMicFree(speechDenied ? true : input.checked); label.append(input, document.createTextNode('マイクなし')); return label; }
function endScreen() {
  tap?.cancel(); tap = null; app.replaceChildren();
  const card = element('section', 'card'); card.append(element('h1', '', `Score: ${round.correctCount} / ${round.items.length}`), element('p', '', `Best streak: ${round.bestStreak}`));
  const missed = practiceItems(VOCABULARY, round.missedIds);
  if (missed.length) { const list = element('ul', 'missed'); missed.forEach((item) => list.append(element('li', '', `${item.en} — ${item.ja}`))); card.append(list); }
  else card.append(element('p', 'correct', 'Perfect!'));
  const actions = element('div', 'actions');
  if (missed.length) { const practice = element('button', '', 'Practice mistakes'); practice.onclick = () => startRound(round.mode, createRound(missed, Math.random, missed.length)); actions.append(practice); }
  const again = element('button', '', 'Again'); again.onclick = () => startRound(round.mode); actions.append(again);
  if (round.mode < 4) { const next = element('button', 'secondary', 'Next level'); next.onclick = () => startRound(round.mode + 1); actions.append(next); }
  const levels = element('button', 'secondary', 'Level select'); levels.onclick = levelSelect; actions.append(levels); card.append(actions); app.append(card);
}
function element(tag, className = '', text = '') { const node = document.createElement(tag); node.className = className; node.textContent = text; return node; }
function speechRecognitionAvailable() { return Boolean(globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition); }
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && round) levelSelect(); if (round && event.key >= '1' && event.key <= '4' && viewModel(round.mode, currentItem(), { micFree }).input === 'choices') document.querySelectorAll('.choices button')[Number(event.key) - 1]?.click(); });
levelSelect();
