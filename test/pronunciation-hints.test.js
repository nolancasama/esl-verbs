import test from 'node:test';
import assert from 'node:assert/strict';

import { TapToTalk } from '../src/speech.js';
import { createPronunciationHints } from '../src/pronunciation-hints.js';
import { VOCABULARY } from '../src/vocab.js';

const climb = VOCABULARY.find((item) => item.id === 'climb');

function fakeRecognition() {
  const state = {};
  class FakeRecognition {
    constructor() { state.instance = this; }
    start() {}
    stop() { this.onend?.(); }
    abort() {}
  }
  return { FakeRecognition, state };
}
const result = (alternatives) => { const list = alternatives.map((transcript) => ({ transcript })); list.isFinal = true; return { results: [list] }; };

test('onMiss fires once with the top transcript and alternatives when heard speech did not match', () => {
  const { FakeRecognition, state } = fakeRecognition();
  const misses = [];
  const tap = new TapToTalk({ SpeechRecognition: FakeRecognition, onMiss: (heard) => misses.push(heard) });
  tap.start(climb.enAccepted);
  state.instance.onresult(result(['crime', 'climbing up']));
  state.instance.onend();
  assert.deepEqual(misses, [{ transcript: 'crime', alternatives: ['crime', 'climbing up'] }]);
});

test('onMiss does not fire on a match, on silence, or on cancel', () => {
  const { FakeRecognition, state } = fakeRecognition();
  const misses = [];
  const tap = new TapToTalk({ SpeechRecognition: FakeRecognition, onMiss: (heard) => misses.push(heard) });

  tap.start(climb.enAccepted);
  state.instance.onresult(result(['climb']));
  tap.start(climb.enAccepted); // silence: the session ends without any result
  state.instance.onerror({ error: 'no-speech' });
  state.instance.onend();
  tap.start(climb.enAccepted); // the game cancels (next question / Listen)
  state.instance.onresult(result(['crime']));
  tap.cancel();
  assert.deepEqual(misses, []);
});

test('the hints glue is inert when the vendored bundle is missing', () => {
  assert.equal(globalThis.EslPronunciationCoach, undefined);
  const hints = createPronunciationHints({ answerSet: VOCABULARY.map((item) => item.en), pauseListening() {} });
  const parent = { appended: 0, append() { this.appended += 1; } };
  hints.mount(parent);
  hints.miss(climb, { transcript: 'crime', alternatives: ['crime'] });
  hints.hit(climb);
  hints.clear();
  assert.equal(parent.appended, 0);
});

test('the hints glue survives a coach factory that throws', () => {
  globalThis.EslPronunciationCoach = { createGameCoach() { throw new Error('broken bundle'); } };
  globalThis.document = { createElement: () => ({}) };
  try {
    const hints = createPronunciationHints({ answerSet: [], pauseListening() {} });
    const parent = { appended: 0, append() { this.appended += 1; } };
    assert.doesNotThrow(() => { hints.mount(parent); hints.miss(climb, { transcript: 'crime', alternatives: [] }); hints.clear(); });
    assert.equal(parent.appended, 0);
  } finally {
    delete globalThis.EslPronunciationCoach;
    delete globalThis.document;
  }
});
