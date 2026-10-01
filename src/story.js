// Adventure story scripts. The story text is Japanese for elementary students:
// short kana-heavy lines, common kanji only, harder words as {漢字|かな} (shown
// as furigana). Game terms stay English. The tone is deliberately grand and
// never winks at the player: Matsubara really is the strongest city in Japan.
//
// A script is a list of beats played in order. A beat may change the scene
// (mood, monsters, hero, ally), the music (cut, play, stop) or play an sfx,
// then shows its card for `ms`. `hold` cards do not drift upward.
//   card: { lines: [...], big: index of the line drawn large, en: small English line }

/** Reading time for a card: a base plus time per character, clamped. */
export function cardMs(card) {
  const chars = (card?.lines ?? []).join('').replace(/\{([^|}]+)\|[^}]+\}/g, '$1').replace(/\s/g, '').length;
  return Math.round(Math.max(1700, Math.min(3300, 1100 + chars * 55)));
}

/** Split `{漢字|かな}` markup into plain and ruby parts: [{ text }, { text, ruby }]. */
export function rubyParts(line) {
  const parts = [];
  let last = 0;
  for (const match of line.matchAll(/\{([^|}]+)\|([^}]+)\}/g)) {
    if (match.index > last) parts.push({ text: line.slice(last, match.index) });
    parts.push({ text: match[1], ruby: match[2] });
    last = match.index + match[0].length;
  }
  if (last < line.length) parts.push({ text: line.slice(last) });
  return parts;
}

const card = (lines, extra = {}) => ({ card: { lines, ...extra } });

// Matsubara opening: only the immediate threat, about ten seconds with no text
// to read through. The city, the danger, the chosen hero, then Stage 1. Why it
// is all happening is told after the student has saved the city (ENDING_STORY).
export const INTRO_STORY = Object.freeze([
  { mood: 'calm', music: 'field', title: { ja: 'まつばら市', en: 'MATSUBARA CITY' }, ms: 2400 },
  { mood: 'danger', monsters: 'near', cut: true, sfx: 'alarm', title: { ja: 'まつばら市が あぶない！', en: 'MATSUBARA CITY IS IN DANGER!' }, ms: 3000 },
  { hero: 'idle', sfx: 'fanfare', title: { ja: 'まつばら市を まもろう！', en: 'PROTECT THE CITY!' }, ms: 3000 },
  { title: { ja: 'STAGE 1', en: 'ステージ 1' }, ms: 1300 },
]);

// Matsubara ending, in three parts:
//  1. the victory, on its own: the darkness clears, the city celebrates;
//  2. the story reveal in five cards, looking back at what the student just
//     played through: Matsubara's Action Energy; the Black Star in Lake Biwa
//     and the Shadow Horde it released; why the Horde attacked; the Action Core
//     (charged with every verb) and, as a short second beat, the hero it chose;
//  3. only then the sequel threat: the Horde has spread across Osaka.
export const ENDING_STORY = Object.freeze([
  { mood: 'danger', monsters: 'near', hero: 'idle', cut: true, ms: 900 },
  { mood: 'safe', monsters: 'gone', sfx: 'barrier', hero: 'victory', citizens: true, music: 'victory', title: { ja: 'まつばら市を まもった！', en: 'MATSUBARA CITY IS SAFE!' }, ms: 3000 },
  { title: { ja: 'きみが 町を まもった！', en: 'YOU PROTECTED THE CITY!' }, ms: 2600 },

  { stop: true, hero: 'gone', citizens: false, ...card(['まつばらの 人々には', 'ふしぎな力が あった。', 'その名は――', 'アクション・エネルギー']) },
  { mood: 'danger', monsters: 'near', music: 'ominous', ...card(['ある日、びわ{湖|こ}に', '「ブラック・スター」が おちた。', 'そこから', 'シャドウ・ホードが あらわれた！']) },
  card(['シャドウ・ホードは まつばらの', 'アクション・エネルギーを', 'ねらっていた！']),
  { mood: 'safe', monsters: 'gone', music: 'awaken', core: true, ...card(['{科学者|かがくしゃ}たちは', 'アクション・コアを つくった。', 'どうしに こたえると', '力が たまる！'], { en: 'ACTION WORDS → ACTION ENERGY → BATTLE POWER' }) },
  { stop: true, hero: 'idle', sfx: 'heroSting', ...card(['コアが えらんだ ヒーローは――', 'きみだ！'], { big: 1, hold: true }), ms: 2400 },

  { cut: true, mood: 'danger', core: false, music: 'ominous', monsters: 'spread', ...card(['まつばら市は まもった。', 'でも シャドウ・ホードは', '大阪の ほかの町へ ひろがっている！']) },
  { stop: true, mood: 'safe', monsters: 'gone', hero: 'victory', sfx: 'heroSting', ...card(['大阪を まもれ！'], { big: 0, hold: true, en: 'SAVE OSAKA!' }), ms: 2000 },
]);

// Short intro and ending for each regional city campaign.
export const CITY_STORIES = Object.freeze({
  sakai: Object.freeze({
    intro: Object.freeze([
      { mood: 'danger', monsters: 'near', music: 'ominous', sfx: 'alarm', ...card(['さかいが あぶない！'], { big: 0, hold: true, en: 'SAKAI IS IN DANGER!' }), ms: 2000 },
      card(['さかいには、', '西日本で もっとも ゆうかんな', 'まもりびとたちが いる。']),
      { hero: 'idle', ...card(['しかし――', 'シャドウ・ホードの 大ぐんが せまっていた！']) },
    ]),
    ending: Object.freeze([
      { mood: 'danger', monsters: 'near', hero: 'idle', ally: 'idle', cut: true, ms: 800 },
      { mood: 'safe', monsters: 'gone', hero: 'victory', ally: 'victory', citizens: true, music: 'victory', title: { ja: 'さかいを まもった！', en: 'SAKAI IS SAFE!' }, ms: 3000 },
      card(['大阪の まもりびと：', '「さかいは オレに まかせろ！」']),
      card(['大阪の まもりびとは つよい。', 'でも、アクション・コアを', 'つかえるのは きみだけだ。']),
      { ally: 'gone', ...card(['まもりびとは さかいに のこった。', 'つぎの 町へ いこう！'], { en: 'ON TO THE NEXT CITY!' }) },
    ]),
  }),
});
