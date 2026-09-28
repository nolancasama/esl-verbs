import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPILED, TRACKS, createAudio, noteFrequency, parseSeq } from '../src/audio.js';

const BAR = 16;

/** Step count at each `|` in a hand-written sequence (where the writer believed a bar ended). */
function barMarks(seq) {
  const marks = [];
  let step = 0;
  for (const token of seq.trim().split(/\s+/)) {
    if (token === '|') marks.push(step);
    else step += Number(token.split(':')[1]);
  }
  return marks;
}

test('note names map to equal-tempered frequencies', () => {
  assert.equal(noteFrequency('A4'), 440);
  assert.equal(noteFrequency('A5'), 880);
  assert.ok(Math.abs(noteFrequency('C4') - 261.63) < 0.01);
  assert.equal(noteFrequency('C#4'), noteFrequency('Db4'));
  assert.throws(() => noteFrequency('H4'));
  assert.throws(() => parseSeq('A4:0'));
});

test('every track parses into audible notes', () => {
  for (const [name, track] of Object.entries(COMPILED)) {
    assert.ok(track.bpm >= 60 && track.bpm <= 200, `${name} tempo`);
    for (const channel of track.channels) {
      assert.ok(channel.events.length > 0, `${name}/${channel.inst} is empty`);
      for (const event of channel.events) {
        for (const freq of event.notes) assert.ok(freq >= 40 && freq <= 4200, `${name}/${channel.inst} note ${freq.toFixed(1)} Hz`);
        assert.ok(event.step + event.len <= channel.length, `${name}/${channel.inst} note runs past the end`);
      }
    }
  }
});

test('every bar line in a written melody falls on a whole bar', () => {
  for (const [name, track] of Object.entries(TRACKS)) {
    track.channels.forEach((channel, index) => {
      for (const step of barMarks(channel.seq)) {
        assert.equal(step % BAR, 0, `${name} channel ${index} (${channel.inst}): bar line after ${step} steps`);
      }
    });
  }
});

test('looping tracks loop on a whole bar, with every channel and the drums the same length', () => {
  for (const [name, track] of Object.entries(COMPILED)) {
    if (!track.loop) continue;
    assert.equal(track.length % BAR, 0, `${name} loops mid-bar`);
    for (const channel of track.channels) assert.equal(channel.length, track.length, `${name}/${channel.inst} drifts out of the loop`);
    if (track.drums) assert.equal(track.drums.bars * BAR, track.length, `${name} drums`);
  }
});

test('drum patterns are one bar of 16 steps', () => {
  for (const [name, track] of Object.entries(TRACKS)) {
    if (!track.drums) continue;
    const patterns = { ...track.drums, ...Object.fromEntries(Object.entries(track.drums.fill ?? {}).map(([k, v]) => [`fill.${k}`, v])) };
    for (const [part, pattern] of Object.entries(patterns)) {
      if (typeof pattern !== 'string' || pattern === '') continue;
      assert.match(pattern, /^[x.]{16}$/, `${name} ${part}`);
    }
  }
});

test('the game has music for every phase it asks for', () => {
  for (const name of ['title', 'field', 'battle', 'boss', 'victory', 'defeat', 'finale']) assert.ok(COMPILED[name], name);
  for (const name of ['victory', 'defeat', 'finale']) assert.equal(COMPILED[name].loop, false, `${name} plays once`);
});

test('without Web Audio the engine is a silent no-op that never throws', () => {
  const audio = createAudio();
  assert.equal(typeof audio.enabled, 'boolean');
  assert.doesNotThrow(() => {
    audio.unlock(); audio.play('battle'); audio.duck('tts', true); audio.sfx('hit'); audio.duck('tts', false);
    audio.setEnabled(false); audio.stop();
  });
  assert.equal(audio.enabled, false);
});
