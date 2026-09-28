// Original chiptune-style music and sound effects, synthesized in the browser
// with Web Audio (no audio files, nothing remote). A tiny step sequencer plays
// looped tracks through a SNES-style echo; spoken prompts duck the music and
// speech recognition silences it. Everything degrades to a silent no-op when
// Web Audio is missing or blocked, and nothing here ever throws.

const STORAGE_KEY = 'esl-verbs-music';
const MUSIC_VOLUME = 0.3;
const SFX_VOLUME = 0.42;
const DUCK = { tts: 0.12, stt: 0 };

/* ------------------------------------------------------------- notation */

const SEMITONE = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 };
export function noteFrequency(name) {
  const match = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!match) throw new Error(`Bad note ${name}`);
  const [, letter, accidental, octave] = match;
  const semis = SEMITONE[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0) + (Number(octave) - 4) * 12;
  return 440 * 2 ** (semis / 12);
}

/**
 * Parse "A4:2 D5:2 F#5:6 | r:4 D4+F#4+A4:16" into [{ step, len, notes: [freq] }].
 * Lengths are 16th-note steps; `r` is a rest; `+` joins a chord; `|` marks bars for readability.
 */
export function parseSeq(text) {
  const events = [];
  let step = 0;
  for (const token of text.trim().split(/\s+/)) {
    if (!token || token === '|') continue;
    const [head, lenText] = token.split(':');
    const len = Number(lenText);
    if (!Number.isFinite(len) || len <= 0) throw new Error(`Bad length in ${token}`);
    if (head !== 'r') events.push({ step, len, notes: head.split('+').map(noteFrequency) });
    step += len;
  }
  return { events, length: step };
}

// Chord symbol -> root/third/fifth note names (octave 3/4) for bass and pads.
const CHORDS = {
  C: ['C', 'E', 'G'], Cm: ['C', 'Eb', 'G'], D: ['D', 'F#', 'A'], Dm: ['D', 'F', 'A'], E: ['E', 'G#', 'B'], Em: ['E', 'G', 'B'],
  F: ['F', 'A', 'C'], 'F#m': ['F#', 'A', 'C#'], G: ['G', 'B', 'D'], Gm: ['G', 'Bb', 'D'], A: ['A', 'C#', 'E'], Am: ['A', 'C', 'E'],
  Bb: ['Bb', 'D', 'F'], Bm: ['B', 'D', 'F#'], Edim: ['E', 'G', 'Bb'],
};
const up = (name, octave) => `${name}${octave}`;
const bar = 16;

/** Bass line from a chord list: styles 'octave' (8th-note octave bounce), 'drive' (16ths) or 'half'. */
function bassLine(chords, style) {
  return chords.map((chord) => {
    const [root, , fifth] = CHORDS[chord];
    if (style === 'half') return `${up(root, 2)}:8 ${up(fifth, 2)}:8`;
    if (style === 'drive') return Array.from({ length: 8 }, (_, i) => `${up(root, i % 4 === 2 ? 3 : 2)}:2`).join(' ');
    if (style === 'boss') return [2, 2, 3, 2, 2, 3, 2, 3].map((octave) => `${up(root, octave)}:2`).join(' ');
    return Array.from({ length: 8 }, (_, i) => `${up(root, i % 2 ? 3 : 2)}:2`).join(' ');
  }).join(' | ');
}
/** Sustained chords (one per bar). */
function padLine(chords, octave = 4) {
  return chords.map((chord) => `${CHORDS[chord].map((name) => up(name, octave)).join('+')}:16`).join(' | ');
}
/** 16th-note arpeggio: root, third, fifth, octave. */
function arpLine(chords, octave = 5, rate = 1) {
  return chords.map((chord) => {
    const [root, third, fifth] = CHORDS[chord];
    const cycle = [up(root, octave), up(third, octave), up(fifth, octave), up(root, octave + 1)];
    return Array.from({ length: bar / rate }, (_, i) => `${cycle[i % 4]}:${rate}`).join(' ');
  }).join(' | ');
}

/* ----------------------------------------------------------------- tracks */

// All melodies below are original compositions for this game.
const TITLE_CHORDS = ['D', 'G', 'Bm', 'A', 'D', 'G', 'Em', 'A', 'G', 'A', 'F#m', 'Bm', 'G', 'A', 'D', 'D'];
const FIELD_CHORDS = ['F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Bb', 'C', 'F', 'Dm', 'Bb', 'C', 'F', 'Am', 'Bb', 'C'];
const BATTLE_CHORDS = ['Am', 'F', 'G', 'Am', 'Am', 'F', 'G', 'E', 'Dm', 'Am', 'Bb', 'E', 'Dm', 'Am', 'F', 'E'];
const BOSS_CHORDS = ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'Gm', 'A', 'Gm', 'Dm', 'Bb', 'A', 'Gm', 'Dm', 'Edim', 'A'];

export const TRACKS = {
  title: {
    bpm: 132, loop: true,
    channels: [
      { inst: 'lead', vol: 0.5, seq: `A4:2 D5:2 F#5:6 E5:2 D5:2 E5:2 | B4:2 D5:2 G5:6 F#5:2 E5:2 D5:2 | F#5:4 D5:2 B4:2 F#5:4 E5:2 D5:2 | E5:6 C#5:2 A4:8
        | A4:2 D5:2 F#5:6 E5:2 D5:2 F#5:2 | G5:4 A5:2 G5:2 F#5:4 E5:2 D5:2 | E5:4 G5:2 F#5:2 E5:4 D5:2 C#5:2 | C#5:4 E5:2 A5:2 A5:8
        | B5:6 A5:2 G5:4 D5:4 | A5:6 G5:2 F#5:4 E5:4 | F#5:6 E5:2 C#5:4 A4:4 | B4:4 D5:4 F#5:4 B5:4
        | B5:4 A5:2 G5:2 A5:4 B5:4 | C#6:4 B5:2 A5:2 E5:4 C#5:4 | D5:4 F#5:2 A5:2 D6:8 | D6:4 r:4 A5:2 G5:2 F#5:2 E5:2` },
      { inst: 'bass', vol: 0.55, seq: bassLine(TITLE_CHORDS, 'octave') },
      { inst: 'pad', vol: 0.22, seq: padLine(TITLE_CHORDS, 4) },
      { inst: 'arp', vol: 0.16, seq: `r:128 ${arpLine(TITLE_CHORDS.slice(8), 5, 1)}` },
    ],
    drums: { bars: 16, kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', fill: { kick: 'x.......x.x.x...', snare: '....x.....xxxxxx' } },
  },
  field: {
    bpm: 96, loop: true,
    channels: [
      { inst: 'bell', vol: 0.42, seq: `C5:4 F5:4 A5:6 G5:2 | F5:8 D5:4 E5:4 | F5:4 D5:4 Bb4:6 C5:2 | C5:12 r:4
        | A4:4 C5:4 F5:6 E5:2 | E5:8 C5:4 A4:4 | D5:4 F5:4 Bb5:4 A5:2 G5:2 | G5:8 E5:4 C5:4
        | F5:4 A5:4 C6:6 Bb5:2 | A5:8 F5:4 D5:4 | D5:4 F5:4 Bb5:6 A5:2 | G5:12 r:4
        | A5:4 G5:2 F5:2 C5:8 | E5:4 D5:2 C5:2 A4:8 | Bb4:4 D5:4 G5:4 F5:2 E5:2 | F5:12 r:4` },
      { inst: 'bass', vol: 0.45, seq: bassLine(FIELD_CHORDS, 'half') },
      { inst: 'pad', vol: 0.16, seq: padLine(FIELD_CHORDS, 4) },
      { inst: 'pluck', vol: 0.14, seq: arpLine(FIELD_CHORDS, 4, 2) },
    ],
    drums: { bars: 16, kick: 'x...............', snare: '................', hat: '....x.......x...' },
  },
  battle: {
    bpm: 152, loop: true,
    channels: [
      { inst: 'lead', vol: 0.46, seq: `A4:2 C5:2 E5:4 D5:2 C5:2 B4:2 C5:2 | A4:4 F4:2 A4:2 C5:4 A4:4 | B4:2 D5:2 G5:4 F5:2 E5:2 D5:4 | E5:12 r:2 E5:2
        | A5:4 G5:2 E5:2 A5:4 G5:2 E5:2 | F5:4 E5:2 C5:2 F5:4 E5:2 C5:2 | D5:2 E5:2 F5:2 G5:2 A5:2 B5:2 C6:2 D6:2 | E6:8 B5:4 G#5:4
        | D5:4 F5:4 A5:6 G5:2 | E5:8 C5:4 A4:4 | F5:4 D5:4 Bb4:4 D5:4 | E5:6 G#5:2 B5:8
        | A5:4 F5:2 D5:2 A5:4 F5:2 D5:2 | C6:4 B5:2 A5:2 E5:8 | F5:4 A5:4 G5:4 B5:4 | A5:8 G#5:4 E5:4` },
      { inst: 'bass', vol: 0.6, seq: bassLine(BATTLE_CHORDS, 'drive') },
      { inst: 'pad', vol: 0.15, seq: padLine(BATTLE_CHORDS, 4) },
      { inst: 'arp', vol: 0.11, seq: arpLine(BATTLE_CHORDS, 5, 1) },
    ],
    drums: { bars: 16, kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx', fill: { kick: 'x.....x.x.x.x...', snare: '....x...x.xxxxxx' } },
  },
  boss: {
    bpm: 136, loop: true,
    channels: [
      { inst: 'brass', vol: 0.42, seq: `D5:8 A4:4 D5:4 | F5:8 E5:4 D5:4 | E5:8 C5:4 G5:4 | A5:12 C#5:4
        | D5:4 F5:4 A5:4 D6:4 | C6:4 Bb5:4 A5:4 F5:4 | G5:4 Bb5:4 A5:4 G5:4 | A5:8 E5:4 C#5:4
        | D6:8 C6:4 Bb5:4 | A5:8 F5:4 D5:4 | F5:4 G5:4 A5:4 Bb5:4 | C#6:8 A5:8
        | Bb5:6 A5:2 G5:4 D5:4 | F5:6 E5:2 D5:4 A4:4 | G#5:4 Bb5:4 D6:4 E6:4 | E6:8 C#6:4 A5:4` },
      { inst: 'bass', vol: 0.62, seq: bassLine(BOSS_CHORDS, 'boss') },
      { inst: 'organ', vol: 0.2, seq: padLine(BOSS_CHORDS, 4) },
      { inst: 'arp', vol: 0.1, seq: arpLine(BOSS_CHORDS, 4, 1) },
    ],
    drums: { bars: 16, kick: 'x..x....x..x....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', fill: { kick: 'x..x....x.x.x.x.', snare: '....x...xxxxxxxx' } },
  },
  victory: {
    bpm: 144, loop: false,
    channels: [
      { inst: 'brass', vol: 0.5, seq: 'G4:2 C5:2 E5:2 G5:6 E5:2 G5:2 | A5:4 F5:2 A5:2 B5:4 G5:2 B5:2 | C6:12 r:4' },
      { inst: 'lead', vol: 0.3, seq: 'E4:2 G4:2 C5:2 E5:6 C5:2 E5:2 | F5:4 C5:2 F5:2 G5:4 D5:2 G5:2 | E5:12 r:4' },
      { inst: 'bass', vol: 0.55, seq: 'C3:4 C3:4 C3:4 C3:4 | F2:4 F2:4 G2:4 G2:4 | C3:12 r:4' },
      { inst: 'pad', vol: 0.2, seq: 'C4+E4+G4:16 | F4+A4+C5:8 G4+B4+D5:8 | C4+E4+G4+C5:12 r:4' },
    ],
    drums: { bars: 3, kick: 'x...x...x...x...', snare: '..............xx', hat: '' },
  },
  defeat: {
    bpm: 76, loop: false,
    channels: [
      { inst: 'bell', vol: 0.4, seq: 'E5:4 C5:4 D5:4 B4:4 | C5:4 A4:4 G#4:4 A4:4 | r:8' },
      { inst: 'pad', vol: 0.2, seq: 'A3+C4+E4:8 G3+B3+D4:8 | F3+A3+C4:8 E3+G#3+B3:4 A3+C4+E4:4 | r:8' },
      { inst: 'bass', vol: 0.35, seq: 'A2:8 G2:8 | F2:8 E2:4 A2:4 | r:8' },
    ],
  },
  finale: {
    bpm: 120, loop: false,
    channels: [
      { inst: 'brass', vol: 0.5, seq: 'A4:2 D5:2 F#5:2 A5:2 D6:8 | B5:4 A5:2 G5:2 A5:4 C#6:4 | D6:4 A5:2 F#5:2 A5:4 D6:4 | B5:8 D6:8 | E6:8 C#6:4 A5:4 | D6:16 | r:8' },
      { inst: 'lead', vol: 0.28, seq: 'F#4:2 A4:2 D5:2 F#5:2 A5:8 | G5:4 F#5:2 E5:2 F#5:4 A5:4 | A5:4 F#5:2 D5:2 F#5:4 A5:4 | G5:8 B5:8 | C#6:8 A5:4 E5:4 | F#5:16 | r:8' },
      { inst: 'bass', vol: 0.55, seq: 'D3:4 D3:4 D3:4 D3:4 | G2:8 A2:8 | D3:4 D3:4 F#2:4 A2:4 | G2:8 G2:8 | A2:8 A2:8 | D2:16 | r:8' },
      { inst: 'pad', vol: 0.22, seq: 'D4+F#4+A4:16 | G4+B4+D5:8 A4+C#5+E5:8 | D4+F#4+A4:16 | G4+B4+D5:16 | A4+C#5+E5:16 | D4+F#4+A4+D5:16 | r:8' },
      { inst: 'arp', vol: 0.12, seq: `${arpLine(['D', 'G', 'D', 'G', 'A', 'D'], 5, 1)} | r:8` },
    ],
    drums: { bars: 7, kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', fill: { kick: 'x.x.x.x.x.x.x.x.', snare: 'xxxxxxxxxxxxxxxx' } },
  },
};

/** Build per-step lookup tables once. */
function compile(track) {
  const channels = track.channels.map((channel) => ({ ...channel, ...parseSeq(channel.seq) }));
  const length = Math.max(...channels.map((channel) => channel.length), (track.drums?.bars ?? 0) * bar);
  const byStep = new Map();
  for (const channel of channels) for (const event of channel.events) {
    if (!byStep.has(event.step)) byStep.set(event.step, []);
    byStep.get(event.step).push({ ...event, inst: channel.inst, vol: channel.vol });
  }
  return { ...track, channels, length, byStep };
}
export const COMPILED = Object.fromEntries(Object.entries(TRACKS).map(([name, track]) => [name, compile(track)]));

/* ------------------------------------------------------------------ engine */

function silentAudio(enabled) {
  return { enabled, setEnabled() {}, unlock() {}, play() {}, stop() {}, duck() {}, sfx() {} };
}

export function createAudio() {
  let enabled = true;
  try { enabled = localStorage.getItem(STORAGE_KEY) !== 'off'; } catch {}
  const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Context) {
    const silent = silentAudio(enabled);
    silent.setEnabled = (value) => { silent.enabled = Boolean(value); try { localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off'); } catch {} };
    return silent;
  }

  let ctx = null, master = null, musicBus = null, sfxBus = null, noise = null, pulse = null;
  let wanted = null;       // track name the current screen asked for
  let current = null;      // { name, gain, step, nextTime }
  let timer = null;
  const ducks = new Set();

  function build() {
    if (ctx) return true;
    try {
      ctx = new Context();
      master = ctx.createDynamicsCompressor();
      master.threshold.value = -18; master.ratio.value = 4;
      master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0;
      sfxBus = ctx.createGain(); sfxBus.gain.value = SFX_VOLUME;
      // SNES-style echo: a filtered feedback delay on the music.
      const delay = ctx.createDelay(1); delay.delayTime.value = 0.24;
      const feedback = ctx.createGain(); feedback.gain.value = 0.3;
      const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2600;
      const wet = ctx.createGain(); wet.gain.value = 0.24;
      musicBus.connect(master); musicBus.connect(delay); delay.connect(tone); tone.connect(feedback); feedback.connect(delay); tone.connect(wet); wet.connect(master);
      sfxBus.connect(master);
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      noise = buffer;
      const harmonics = 32, real = new Float32Array(harmonics), imag = new Float32Array(harmonics);
      for (let n = 1; n < harmonics; n += 1) imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * 0.25);
      pulse = ctx.createPeriodicWave(real, imag);
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function musicLevel() {
    if (!enabled) return 0;
    let level = MUSIC_VOLUME;
    for (const reason of ducks) level = Math.min(level, MUSIC_VOLUME * (DUCK[reason] ?? 1));
    return level;
  }
  function applyLevel(fast = false) {
    if (!ctx) return;
    try { musicBus.gain.setTargetAtTime(musicLevel(), ctx.currentTime, fast ? 0.03 : 0.12); } catch {}
  }

  /* ---- instruments ---- */
  function envelope(gain, start, len, { attack = 0.005, decay = 0.08, sustain = 0.6, release = 0.06, peak = 1 } = {}) {
    const g = gain.gain;
    g.setValueAtTime(0, start);
    g.linearRampToValueAtTime(peak, start + attack);
    g.linearRampToValueAtTime(peak * sustain, start + attack + decay);
    g.setValueAtTime(peak * sustain, Math.max(start + attack + decay, start + len));
    g.linearRampToValueAtTime(0, start + len + release);
    return start + len + release;
  }
  function osc(type, freq, start, end, destination, detune = 0) {
    const node = ctx.createOscillator();
    if (type === 'pulse') node.setPeriodicWave(pulse); else node.type = type;
    node.frequency.setValueAtTime(freq, start);
    if (detune) node.detune.setValueAtTime(detune, start);
    node.connect(destination);
    node.start(start); node.stop(end + 0.02);
    return node;
  }
  function voice(inst, freq, start, len, vol, bus) {
    const gain = ctx.createGain(); gain.connect(bus);
    let end;
    switch (inst) {
      case 'lead': {
        end = envelope(gain, start, len, { sustain: 0.7, peak: vol * 0.55, release: 0.08 });
        const node = osc('pulse', freq, start, end, gain);
        if (len > 0.3) { // delayed vibrato on held notes
          const lfo = ctx.createOscillator(); const depth = ctx.createGain();
          lfo.frequency.value = 5.5; depth.gain.setValueAtTime(0, start); depth.gain.linearRampToValueAtTime(freq * 0.012, start + 0.25);
          lfo.connect(depth); depth.connect(node.frequency); lfo.start(start); lfo.stop(end);
        }
        break;
      }
      case 'brass': {
        const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = 2;
        filter.frequency.setValueAtTime(freq * 1.5, start); filter.frequency.linearRampToValueAtTime(freq * 6, start + 0.06); filter.frequency.linearRampToValueAtTime(freq * 3, start + 0.25);
        filter.connect(gain);
        end = envelope(gain, start, len, { attack: 0.03, sustain: 0.8, peak: vol * 0.45, release: 0.1 });
        osc('sawtooth', freq, start, end, filter); osc('sawtooth', freq, start, end, filter, 7);
        break;
      }
      case 'bass': {
        const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 900; filter.connect(gain);
        end = envelope(gain, start, Math.min(len, 0.5), { decay: 0.1, sustain: 0.55, peak: vol * 0.8, release: 0.05 });
        osc('triangle', freq, start, end, filter); osc('square', freq, start, end, filter);
        break;
      }
      case 'pad':
      case 'organ': {
        const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = inst === 'organ' ? 2200 : 1400; filter.connect(gain);
        end = envelope(gain, start, len, { attack: inst === 'organ' ? 0.02 : 0.18, decay: 0.2, sustain: 0.8, peak: vol * 0.35, release: 0.25 });
        osc(inst === 'organ' ? 'square' : 'sawtooth', freq, start, end, filter, -6);
        osc(inst === 'organ' ? 'triangle' : 'sawtooth', freq * (inst === 'organ' ? 2 : 1), start, end, filter, 6);
        break;
      }
      case 'bell': {
        end = envelope(gain, start, Math.min(len, 0.9), { attack: 0.004, decay: 0.3, sustain: 0.25, peak: vol * 0.6, release: 0.4 });
        osc('sine', freq, start, end, gain); osc('sine', freq * 2, start, end, gain, 3); osc('triangle', freq * 3.01, start, Math.min(end, start + 0.15), gain);
        break;
      }
      case 'pluck':
      case 'arp': {
        end = envelope(gain, start, Math.min(len, 0.12), { attack: 0.002, decay: 0.06, sustain: 0.3, peak: vol * 0.5, release: 0.04 });
        osc(inst === 'arp' ? 'pulse' : 'triangle', freq, start, end, gain);
        break;
      }
      default:
        end = envelope(gain, start, len, { peak: vol * 0.4 });
        osc('square', freq, start, end, gain);
    }
    return end;
  }
  function drum(kind, start, bus, vol = 1) {
    const gain = ctx.createGain(); gain.connect(bus);
    if (kind === 'kick') {
      gain.gain.setValueAtTime(0.9 * vol, start); gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      const node = osc('sine', 150, start, start + 0.22, gain); node.frequency.exponentialRampToValueAtTime(42, start + 0.18);
      return;
    }
    const src = ctx.createBufferSource(); src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = kind === 'hat' ? 'highpass' : 'bandpass'; filter.frequency.value = kind === 'hat' ? 7000 : 1800;
    src.connect(filter); filter.connect(gain);
    const len = kind === 'hat' ? 0.04 : 0.16;
    gain.gain.setValueAtTime((kind === 'hat' ? 0.18 : 0.5) * vol, start); gain.gain.exponentialRampToValueAtTime(0.001, start + len);
    src.start(start); src.stop(start + len + 0.02);
    if (kind === 'snare') { const body = ctx.createGain(); body.connect(bus); body.gain.setValueAtTime(0.25 * vol, start); body.gain.exponentialRampToValueAtTime(0.001, start + 0.1); osc('triangle', 190, start, start + 0.1, body); }
  }

  /* ---- sequencer ---- */
  function scheduleStep(track, step, time, bus) {
    const stepDur = 60 / track.bpm / 4;
    for (const event of track.byStep.get(step) || []) {
      for (const freq of event.notes) voice(event.inst, freq, time, event.len * stepDur * 0.95, event.vol, bus);
    }
    if (track.drums) {
      const barIndex = Math.floor(step / bar), pos = step % bar;
      const lastBar = barIndex === (track.drums.bars ?? 1) - 1 || (barIndex % 8 === 7);
      const pattern = lastBar && track.drums.fill ? { ...track.drums, ...track.drums.fill } : track.drums;
      if (pattern.kick?.[pos] === 'x') drum('kick', time, bus);
      if (pattern.snare?.[pos] === 'x') drum('snare', time, bus);
      if (pattern.hat?.[pos] === 'x') drum('hat', time, bus, 0.8);
    }
  }
  function pump() {
    if (!ctx || !current) return;
    const track = COMPILED[current.name];
    const stepDur = 60 / track.bpm / 4;
    const horizon = ctx.currentTime + 0.14;
    try {
      while (current && current.nextTime < horizon) {
        if (current.step >= track.length) {
          if (!track.loop) { const done = current; setTimeout(() => { if (current === done) current = null; }, 1500); stopTimer(); return; }
          current.step = 0;
        }
        scheduleStep(track, current.step, current.nextTime, current.gain);
        current.step += 1;
        current.nextTime += stepDur;
      }
    } catch { /* a scheduling error must never break the game */ }
  }
  function startTimer() { if (!timer) timer = setInterval(pump, 30); }
  function stopTimer() { clearInterval(timer); timer = null; }

  function fadeOut(entry) {
    if (!entry || !ctx) return;
    try {
      entry.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      setTimeout(() => { try { entry.gain.disconnect(); } catch {} }, 900);
    } catch {}
  }

  function start(name) {
    if (!ctx || !enabled || !COMPILED[name]) return;
    if (current?.name === name) return;
    fadeOut(current);
    const gain = ctx.createGain(); gain.gain.value = 1; gain.connect(musicBus);
    current = { name, gain, step: 0, nextTime: ctx.currentTime + 0.08 };
    applyLevel();
    startTimer();
    pump();
  }

  const api = {
    get enabled() { return enabled; },
    setEnabled(value) {
      enabled = Boolean(value);
      try { localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off'); } catch {}
      if (!enabled) { fadeOut(current); current = null; stopTimer(); applyLevel(true); return; }
      api.unlock();
      if (wanted && COMPILED[wanted].loop) start(wanted);
    },
    /** Call from a user gesture; creates/resumes the AudioContext and starts the wanted track. */
    unlock() {
      if (!enabled && ctx) return;
      if (!build()) return;
      try { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); } catch {}
      if (enabled && wanted && !current && COMPILED[wanted]?.loop) start(wanted);
    },
    /** Switch music by game phase: title, field, battle, boss, victory, defeat, finale. */
    play(name) {
      wanted = name;
      if (!ctx || ctx.state !== 'running') return; // starts on unlock
      if (!COMPILED[name].loop) { fadeOut(current); current = null; stopTimer(); if (enabled) { const gain = ctx.createGain(); gain.connect(musicBus); current = { name, gain, step: 0, nextTime: ctx.currentTime + 0.1 }; applyLevel(); startTimer(); pump(); } return; }
      start(name);
    },
    stop() { wanted = null; fadeOut(current); current = null; stopTimer(); },
    /** Lower the music while speech plays ('tts') or silence it while the mic listens ('stt'). */
    duck(reason, on) {
      if (on) ducks.add(reason); else ducks.delete(reason);
      applyLevel(true);
    },
    sfx(name) {
      if (!enabled || !ctx || ctx.state !== 'running' || ducks.has('stt')) return;
      try { playSfx(name); } catch {}
    },
  };

  /* ---- sound effects ---- */
  function tone(type, freq, start, len, vol, endFreq) {
    const gain = ctx.createGain(); gain.connect(sfxBus);
    gain.gain.setValueAtTime(vol, start); gain.gain.exponentialRampToValueAtTime(0.001, start + len);
    const node = osc(type, freq, start, start + len, gain);
    if (endFreq) node.frequency.exponentialRampToValueAtTime(endFreq, start + len);
  }
  function hiss(start, len, vol, from = 3000, to = 400, type = 'lowpass') {
    const src = ctx.createBufferSource(); src.buffer = noise;
    const filter = ctx.createBiquadFilter(); filter.type = type; filter.frequency.setValueAtTime(from, start); filter.frequency.exponentialRampToValueAtTime(to, start + len);
    const gain = ctx.createGain(); gain.gain.setValueAtTime(vol, start); gain.gain.exponentialRampToValueAtTime(0.001, start + len);
    src.connect(filter); filter.connect(gain); gain.connect(sfxBus); src.start(start); src.stop(start + len + 0.02);
  }
  const notes = (list, start, step, type = 'square', vol = 0.18, len = 0.12) => list.forEach((name, i) => tone(type, noteFrequency(name), start + i * step, len, vol));
  function playSfx(name) {
    const t = ctx.currentTime + 0.01;
    switch (name) {
      case 'cursor': tone('pulse', 1320, t, 0.035, 0.12); break;
      case 'select': notes(['E6', 'B6'], t, 0.04, 'square', 0.12, 0.05); break;
      case 'correct': notes(['C6', 'E6', 'G6', 'C7'], t, 0.055, 'triangle', 0.3, 0.14); break;
      case 'wrong': tone('square', 220, t, 0.22, 0.12, 110); break;
      case 'slash': hiss(t, 0.12, 0.35, 6000, 1200, 'bandpass'); break;
      case 'hit': hiss(t, 0.09, 0.45, 2500, 300); tone('square', 160, t, 0.08, 0.2, 70); break;
      case 'bigHit': hiss(t, 0.28, 0.6, 1800, 120); tone('square', 110, t, 0.3, 0.28, 35); break;
      case 'magic': tone('sine', 700, t, 0.3, 0.2, 1800); tone('sine', 1400, t + 0.05, 0.25, 0.12, 2600); break;
      case 'fire': hiss(t, 0.5, 0.55, 900, 150); tone('sawtooth', 90, t, 0.45, 0.14, 45); break;
      case 'dark': tone('sawtooth', 300, t, 0.45, 0.12, 60); hiss(t, 0.4, 0.3, 700, 100); break;
      case 'shadow': tone('sine', 1600, t, 0.18, 0.15, 200); hiss(t + 0.12, 0.14, 0.35, 5000, 800, 'bandpass'); break;
      case 'quake': hiss(t, 0.7, 0.7, 400, 40); tone('sine', 55, t, 0.7, 0.4, 30); break;
      case 'drain': tone('sine', 900, t, 0.45, 0.16, 200); tone('triangle', 450, t + 0.05, 0.4, 0.1, 150); break;
      case 'guard': tone('square', 520, t, 0.08, 0.14); tone('square', 780, t + 0.06, 0.12, 0.12); break;
      case 'barrier': notes(['G5', 'D6', 'G6', 'B6'], t, 0.045, 'sine', 0.18, 0.3); break;
      case 'heal': notes(['C6', 'E6', 'G6', 'E6', 'G6', 'C7'], t, 0.06, 'sine', 0.2, 0.2); break;
      case 'ap': notes(['B5', 'E6'], t, 0.07, 'pulse', 0.16, 0.12); break;
      case 'recover': tone('triangle', 300, t, 0.5, 0.14, 600); break;
      case 'break': hiss(t, 0.35, 0.55, 8000, 600, 'highpass'); notes(['C7', 'G6', 'E6'], t, 0.05, 'square', 0.14, 0.08); break;
      case 'defeat': hiss(t, 0.5, 0.3, 4000, 200); tone('square', 600, t, 0.4, 0.08, 80); break;
      case 'charge': tone('sawtooth', 110, t, 0.5, 0.1, 440); break;
      case 'summon': tone('sine', 200, t, 0.4, 0.14, 700); break;
      case 'levelup': notes(['C5', 'E5', 'G5', 'C6', 'E6', 'G6'], t, 0.06, 'pulse', 0.18, 0.2); tone('triangle', noteFrequency('C6'), t + 0.36, 0.5, 0.2); break;
      case 'xp': for (let i = 0; i < 8; i += 1) tone('pulse', 1500 + i * 60, t + i * 0.05, 0.03, 0.07); break;
      case 'fanfare': notes(['G5', 'C6', 'E6', 'G6'], t, 0.08, 'square', 0.14, 0.16); break;
      case 'potion': notes(['E6', 'G#6', 'B6'], t, 0.05, 'sine', 0.2, 0.18); hiss(t, 0.2, 0.12, 5000, 2000, 'highpass'); break;
      default: break;
    }
  }

  return api;
}
