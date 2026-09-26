const JAPANESE_PUNCTUATION = /[、。・！？!?.,「」『』~〜]/g;

export function romajiToHiragana(value) {
  const text = value.toLowerCase();
  const table = {
    kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ', sha: 'しゃ', shu: 'しゅ', sho: 'しょ',
    sya: 'しゃ', syu: 'しゅ', syo: 'しょ', cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ',
    tya: 'ちゃ', tyu: 'ちゅ', tyo: 'ちょ', nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
    hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ', mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
    rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ', gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
    ja: 'じゃ', ju: 'じゅ', jo: 'じょ', jya: 'じゃ', jyu: 'じゅ', jyo: 'じょ',
    zya: 'じゃ', zyu: 'じゅ', zyo: 'じょ', bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
    pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ', shi: 'し', chi: 'ち', tsu: 'つ',
    fu: 'ふ', ji: 'じ', si: 'し', ti: 'ち', tu: 'つ', hu: 'ふ', zi: 'じ',
    ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ', sa: 'さ', su: 'す', se: 'せ', so: 'そ',
    ta: 'た', te: 'て', to: 'と', na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
    ha: 'は', hi: 'ひ', he: 'へ', ho: 'ほ', ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
    ya: 'や', yu: 'ゆ', yo: 'よ', ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
    wa: 'わ', wo: 'を', ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
    za: 'ざ', ze: 'ぜ', zo: 'ぞ', da: 'だ', de: 'で', do: 'ど', ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
    pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ', a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お', '-': 'ー'
  };
  let result = '';
  for (let index = 0; index < text.length;) {
    const current = text[index];
    const next = text[index + 1];
    if (current === next && /[bcdfghjklmpqrstvwxyz]/.test(current) && current !== 'n') {
      result += 'っ'; index += 1; continue;
    }
    if (current === 'n' && (next === 'n' || !next || !/[aiueoy]/.test(next))) {
      result += 'ん'; index += next === 'n' ? 2 : 1; continue;
    }
    const key = [3, 2, 1].map((length) => text.slice(index, index + length)).find((part) => table[part]);
    if (!key) return text;
    result += table[key];
    index += key.length;
  }
  return result;
}

export function normalizeJapanese(value) {
  const cleaned = String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, '')
    .replace(/[\u30a1-\u30f6]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0x60))
    .replace(JAPANESE_PUNCTUATION, '');
  return /^[A-Za-z][A-Za-z-]*$/.test(cleaned) ? romajiToHiragana(cleaned) : cleaned;
}

export function normalizeEnglish(value) {
  return String(value ?? '').toLowerCase().trim().replace(/[.,!?]/g, '').replace(/\s+/g, ' ').replace(/^to\s+/, '');
}

export function isJapaneseCorrect(value, accepted) {
  const normalized = normalizeJapanese(value);
  return accepted.some((answer) => normalizeJapanese(answer) === normalized);
}

export function isEnglishMatch(value, accepted) {
  const normalized = normalizeEnglish(value);
  return accepted.some((answer) => normalizeEnglish(answer) === normalized);
}
