import test from 'node:test';
import assert from 'node:assert/strict';
import { VOCABULARY, VOCAB_BY_ID } from '../src/vocab.js';
import { isJapaneseCorrect, normalizeEnglish, normalizeJapanese } from '../src/normalize.js';
import { MODES, answer, createRound, makeChoices, practiceItems, viewModel } from '../src/engine.js';
import { findMatch, TapToTalk } from '../src/speech.js';

const climb = VOCABULARY.find((item) => item.id === 'climb');

test('all four mode view models use the frozen configuration', () => {
  for (const [mode, config] of Object.entries(MODES)) {
    const model = viewModel(Number(mode), climb);
    assert.equal(model.promptText, config.showPrompt ? climb[config.prompt] : null);
    assert.deepEqual(model.speak, { text: climb[config.prompt], lang: config.speakLang });
    assert.equal(model.input, config.answer);
  }
  assert.equal(viewModel(3, climb, { micFree: true }).input, 'choices');
  assert.equal(viewModel(4, climb, { micFree: true }).input, 'choices');
});

test('Japanese checking accepts primary, alternatives, kana forms and romaji', () => {
  assert.ok(isJapaneseCorrect('のぼる', climb.jaAccepted));
  assert.ok(isJapaneseCorrect('登る', climb.jaAccepted));
  assert.equal(normalizeJapanese('スキー'), normalizeJapanese('すきー'));
  assert.ok(isJapaneseCorrect('noboru', climb.jaAccepted));
  assert.ok(isJapaneseCorrect(' のぼる ', climb.jaAccepted));
  assert.ok(!isJapaneseCorrect('あるく', climb.jaAccepted));
});

test('English normalization ignores capitalization, punctuation and one leading to', () => {
  assert.equal(normalizeEnglish(' To   CLIMB! '), 'climb');
});

test('findMatch accepts an interim alternative immediately', () => {
  const results = [[{ transcript: 'Climb.' }]];
  results[0].isFinal = false;
  assert.equal(findMatch(results, climb.enAccepted), 'Climb.');
});

test('TapToTalk stops immediately for an interim correct result and reports denial', () => {
  let instance;
  class FakeRecognition {
    constructor() { instance = this; this.stopCount = 0; }
    start() {}
    stop() { this.stopCount += 1; }
    abort() {}
  }
  let correct = 0;
  const tap = new TapToTalk({ SpeechRecognition: FakeRecognition, onCorrect: () => { correct += 1; } });
  tap.start(climb.enAccepted);
  const results = [[{ transcript: 'climb' }]]; results[0].isFinal = false;
  instance.onresult({ results });
  assert.equal(correct, 1);
  assert.equal(instance.stopCount, 1);

  let unavailable = '';
  const denied = new TapToTalk({ SpeechRecognition: FakeRecognition, onUnavailable: (reason) => { unavailable = reason; } });
  denied.start(climb.enAccepted);
  instance.onerror({ error: 'not-allowed' });
  assert.equal(unavailable, 'denied');
});

test('scoring increments correct answers and maintains streaks and missed ids', () => {
  const state = { items: [climb], currentIndex: 0, correctCount: 2, currentStreak: 2, bestStreak: 3, missedIds: new Set() };
  const right = answer(state, true);
  assert.deepEqual({ correct: right.correctCount, streak: right.currentStreak, best: right.bestStreak }, { correct: 3, streak: 3, best: 3 });
  const wrong = answer(right, false);
  assert.equal(wrong.correctCount, 3);
  assert.equal(wrong.currentStreak, 0);
  assert.equal(wrong.bestStreak, 3);
  assert.ok(wrong.missedIds.has('climb'));
});

test('rounds are unique, practice contains only misses, and choices are distinct', () => {
  const round = createRound(VOCABULARY, () => 0.4);
  assert.equal(round.length, 10);
  assert.equal(new Set(round.map((item) => item.id)).size, 10);
  assert.deepEqual(practiceItems(VOCABULARY, new Set(['climb'])).map((item) => item.id), ['climb']);
  const choices = makeChoices(climb, VOCABULARY, () => 0.4);
  assert.equal(choices.length, 4);
  assert.equal(new Set(choices.map((item) => item.id)).size, 4);
  assert.equal(choices.filter((item) => item.id === 'climb').length, 1);
});

test('vocabulary Japanese data is unique and all accepted answers normalize', () => {
  assert.equal(new Set(VOCABULARY.map((item) => item.ja)).size, VOCABULARY.length);
  for (const item of VOCABULARY) for (const accepted of item.jaAccepted) assert.notEqual(normalizeJapanese(accepted), '');
});

test('romaji long-vowel dash matches katakana answers', () => {
  assert.equal(isJapaneseCorrect('suki-', VOCAB_BY_ID.ski.jaAccepted), true);
  assert.equal(isJapaneseCorrect('sukii', VOCAB_BY_ID.ski.jaAccepted), false);
});
