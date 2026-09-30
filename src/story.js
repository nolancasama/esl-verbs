// Adventure story scripts. The exposition is Japanese for elementary students:
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
  return Math.round(Math.max(1800, Math.min(3800, 1300 + chars * 70)));
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

// Matsubara opening: peaceful city → the Horde appears (happy music cuts) →
// Japanese crawl over ominous music → the Action Core → the chosen hero.
export const INTRO_STORY = Object.freeze([
  { mood: 'calm', music: 'field', title: { ja: 'まつばら市', en: 'MATSUBARA CITY' }, ms: 2600 },
  { monsters: 'near', mood: 'danger', cut: true, sfx: 'alarm', ms: 550 },
  { music: 'ominous', ...card(['{西暦|せいれき}2199年。'], { big: 0 }), ms: 2200 },
  card(['日本で もっとも', 'つよい 人々が くらす 町。', 'その名は…… まつばら市。']),
  card(['まつばらの 人々は、', 'だれよりも つよく、だれよりも 元気だった。', '{科学者|かがくしゃ}たちは その なぞの力を', '「アクション・エネルギー」と よんだ。']),
  card(['しかし ある夜――', '{巨大|きょだい}な いんせき「ブラック・スター」が', 'びわ{湖|こ}に おちた。']),
  card(['いんせきから あらわれたのは、', '{地球|ちきゅう}で もっとも きけんな まものの ぐんだん――', '「シャドウ・ホード」'], { big: 2 }),
  card(['その数は かぞえきれない。', 'その力は すさまじい。', 'だれにも とめられなかった。']),
  card(['シャドウ・ホードは かんじとった。', '日本で もっとも 大きな アクション・エネルギー。', 'その場所は…… まつばら市！']),
  card(['まつばらの 力を うばって、', 'せかい さいきょうの ぐんだんに なるために！']),
  { music: 'awaken', ...card(['まつばらの {科学者|かがくしゃ}たちは、', 'さいごの きぼうを うごかした。', '「アクション・コア」'], { big: 2 }) },
  { core: true, ...card(['うごきを あらわす ことば（どうし）を こたえると、', 'アクション・コアに エネルギーが たまり、', 'たたかう力に なる！'], { en: 'ACTION WORDS → ACTION ENERGY → BATTLE POWER' }) },
  card(['これまで {何百万人|なんびゃくまんにん}もの 人が ためした。', 'しかし―― だれにも うごかせなかった。']),
  card(['そして 今。', 'アクション・コアが', 'ひとりの ヒーローを えらんだ。']),
  { stop: true, ...card(['それは――'], { big: 0, hold: true }), ms: 1500 },
  { hero: 'idle', core: true, sfx: 'heroSting', ...card(['きみだ。'], { big: 0, hold: true }), ms: 1900 },
  { hero: 'victory', mood: 'calm', monsters: 'near', ...card(['日本で いちばん つよい 町には、', '日本で いちばん つよい ヒーローが ひつようだ。']) },
  { sfx: 'fanfare', ...card(['まつばら市を まもれ！'], { big: 0, hold: true, en: 'PROTECT MATSUBARA!' }), ms: 2200 },
]);

// Matsubara ending: the Horde retreats, the city celebrates, then the wider
// conflict is revealed and the Osaka campaign begins.
export const ENDING_STORY = Object.freeze([
  { mood: 'danger', monsters: 'near', hero: 'idle', cut: true, ms: 900 },
  { mood: 'safe', monsters: 'gone', sfx: 'barrier', title: { ja: 'やみが きえた！', en: 'THE DARKNESS IS GONE!' }, ms: 2600 },
  { hero: 'victory', citizens: true, music: 'victory', title: { ja: 'まつばら市を まもった！', en: 'MATSUBARA CITY IS SAFE!' }, ms: 3000 },
  card(['シャドウ・ホードは', 'まつばらから しりぞいた。']),
  { cut: true, mood: 'danger', citizens: false, ...card(['しかし――', 'たたかいは まだ おわっていなかった。']) },
  { music: 'ominous', monsters: 'spread', ...card(['シャドウ・ホードは、', '大阪の ほかの 町へ ひろがっていた。']) },
  { stop: true, ...card(['まつばらは まもった。', 'つぎは――'], { hold: true }), ms: 2000 },
  { mood: 'safe', monsters: 'gone', sfx: 'heroSting', ...card(['大阪を まもれ！'], { big: 0, hold: true, en: 'SAVE OSAKA!' }), ms: 2400 },
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
      card(['「さかいは オレに まかせろ！」'], { big: 0 }),
      card(['大阪の まもりびとは つよい。', 'でも、アクション・コアを', 'つかえるのは きみだけだ。']),
      { ally: 'gone', ...card(['まもりびとは さかいに のこった。', 'つぎの 町へ いこう！'], { en: 'ON TO THE NEXT CITY!' }) },
    ]),
  }),
});
