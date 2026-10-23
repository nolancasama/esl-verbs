import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPILED, TRACKS, createAudio, musicGain, noteFrequency, parseSeq, readVolumes } from '../src/audio.js';

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
  for (const name of ['ominous', 'awaken', 'title', 'field', 'battle', 'boss', 'victory', 'defeat', 'finale']) assert.ok(COMPILED[name], name);
  for (const name of ['ominous', 'awaken']) assert.equal(COMPILED[name].loop, true, `${name} loops`);
  for (const name of ['victory', 'defeat', 'finale']) assert.equal(COMPILED[name].loop, false, `${name} plays once`);
});

test('without Web Audio the engine is a silent no-op that never throws', () => {
  const audio = createAudio();
  assert.equal(typeof audio.enabled, 'boolean');
  assert.doesNotThrow(() => {
    audio.unlock(); audio.play('ominous'); audio.play('awaken'); audio.duck('tts', true); audio.sfx('hit'); audio.duck('tts', false);
    for (const name of ['heroSting', 'allySting', 'wave']) audio.sfx(name);
    audio.setMusicVolume(0); audio.setSfxVolume(0.4); audio.stop(); audio.cut();
  });
  assert.equal(audio.enabled, false);
  assert.equal(audio.musicVolume, 0);
  assert.equal(audio.sfxVolume, 0.4);
});

const MUSIC_KEY = 'esl-verbs-music-volume';
const SFX_KEY = 'esl-verbs-sfx-volume';
function memoryStorage(values = {}) {
  const data = new Map(Object.entries(values));
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('sound volumes default to twelve percent and persist independently', () => {
  const storage = memoryStorage();
  assert.deepEqual(readVolumes(storage), { musicVolume: 0.12, sfxVolume: 0.12 });
  const audio = createAudio({ storage });
  audio.setMusicVolume(0);
  assert.equal(audio.sfxVolume, 0.12);
  audio.setSfxVolume(0.65);
  assert.equal(audio.musicVolume, 0);
  assert.equal(storage.getItem(MUSIC_KEY), '0');
  assert.equal(storage.getItem(SFX_KEY), '0.65');
  assert.deepEqual(readVolumes(storage), { musicVolume: 0, sfxVolume: 0.65 });
});

test('invalid stored volumes default and finite out-of-range volumes clamp', () => {
  for (const [stored, expected] of [['abc', 0.12], ['-1', 0], ['7', 1], ['', 0.12], ['Infinity', 0.12]]) {
    assert.deepEqual(readVolumes(memoryStorage({ [MUSIC_KEY]: stored, [SFX_KEY]: stored })),
      { musicVolume: expected, sfxVolume: expected }, stored);
  }
});

test('legacy music setting migrates once without changing independent SFX', () => {
  for (const [old, expected] of [['off', 0], ['on', 0.12], [null, 0.12]]) {
    const storage = memoryStorage(old === null ? {} : { 'esl-verbs-music': old });
    assert.deepEqual(readVolumes(storage), { musicVolume: expected, sfxVolume: 0.12 });
    assert.equal(storage.getItem(MUSIC_KEY), String(expected));
    assert.equal(storage.getItem('esl-verbs-music'), old);
    storage.setItem('esl-verbs-music', 'off');
    assert.equal(readVolumes(storage).musicVolume, expected);
  }
  assert.equal(readVolumes(memoryStorage({ 'esl-verbs-music': 'off', [MUSIC_KEY]: '0.7' })).musicVolume, 0.7);
  assert.equal(readVolumes(memoryStorage({ 'esl-verbs-music': 'off', [MUSIC_KEY]: '' })).musicVolume, 0.12);
});

test('ducked music gain is proportional to the chosen music volume', () => {
  assert.equal(musicGain(0.5), 0.5);
  assert.equal(musicGain(0.5, ['tts']), 0.06);
  assert.equal(musicGain(0.12, ['tts']), 0.0144);
  assert.equal(musicGain(0.8, ['tts', 'stt']), 0);
  assert.equal(musicGain(0, ['tts']), 0);
});

test('live music gain keeps the track and SFX remains independent of music and ducking', (t) => {
  const gains = [];
  let soundStarts = 0;
  const parameter = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}, cancelScheduledValues() {},
    setTargetAtTime(value) { this.value = value; } });
  const node = () => ({ connect() {}, disconnect() {}, start() { soundStarts += 1; }, stop() {},
    setPeriodicWave() {}, frequency: parameter(), detune: parameter(), Q: parameter() });
  class FakeContext {
    state = 'running'; currentTime = 0; sampleRate = 8; destination = {};
    createDynamicsCompressor() { return { ...node(), threshold: parameter(), ratio: parameter() }; }
    createGain() { const gain = { ...node(), gain: parameter() }; gains.push(gain); return gain; }
    createDelay() { return { ...node(), delayTime: parameter() }; }
    createBiquadFilter() { return node(); }
    createBuffer() { return { getChannelData: () => new Float32Array(8) }; }
    createBufferSource() { return node(); }
    createOscillator() { return node(); }
    createPeriodicWave() { return {}; }
  }
  t.mock.method(globalThis, 'setInterval', () => 1);
  t.mock.method(globalThis, 'clearInterval', () => {});
  const previousContext = globalThis.AudioContext;
  globalThis.AudioContext = FakeContext;
  let audio;
  try {
    audio = createAudio({ storage: memoryStorage() });
    audio.play('field');
    audio.unlock();
    const gainCount = gains.length;
    audio.setMusicVolume(0.5);
    assert.equal(gains.length, gainCount, 'changing gain does not create another track');
    assert.equal(gains[0].gain.value, 0.5);
    audio.duck('tts', true);
    assert.equal(gains[0].gain.value, 0.06);
    audio.setMusicVolume(0);
    const beforeSfx = soundStarts;
    audio.sfx('cursor');
    assert.ok(soundStarts > beforeSfx, 'music off still allows SFX while TTS ducks');
    audio.setSfxVolume(0);
    const muted = soundStarts;
    audio.sfx('cursor');
    assert.equal(soundStarts, muted);
    audio.setSfxVolume(0.12);
    audio.duck('stt', true);
    audio.sfx('cursor');
    assert.equal(soundStarts, muted, 'microphone listening still suppresses SFX');
    audio.duck('stt', false);
    for (const name of ['swordSwing', 'swordHit', 'magicCast', 'boltTravel', 'magicHit', 'ninjaSlash', 'ninjaHit', 'shurikenThrow', 'shurikenHit', 'ninjaDash', 'titleSting', 'apGain']) {
      const before = soundStarts;
      audio.sfx(name);
      assert.ok(soundStarts > before, `${name} synthesizes a sound`);
    }
    const beforeResume = gains.length;
    audio.setMusicVolume(0.2);
    assert.equal(gains.length, beforeResume, 'unmuting keeps the current track');
  } finally {
    audio?.cut();
    if (previousContext === undefined) delete globalThis.AudioContext;
    else globalThis.AudioContext = previousContext;
  }
});
