// Pronunciation hints for spoken-English answers, from the shared
// esl-pronunciation-coach (vendored in vendor/esl-pronunciation-coach/ and
// loaded by index.html before the app). Everything here fails soft: if the
// bundle is missing or throws, the game plays exactly as before.
export const PRONUNCIATION_COACH_ENABLED = true;

const NOTE = '🎤 をタップして、もう一回言ってみよう。';
const THEME = {
  primary: '#4056cc', background: '#f4f1ea', text: '#0e1024', radius: '6px',
  fontFamily: '"Hiragino Sans", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif', fontSize: '15px',
};
const words = (text) => String(text).toLowerCase().replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter(Boolean);

/**
 * @param {{ answerSet: string[], pauseListening: () => void }} options
 * answerSet: every English answer in the game, so saying another verb is a
 * different answer rather than a pronunciation problem.
 */
export function createPronunciationHints({ answerSet, pauseListening }) {
  let coach = null;
  let host = null;
  const init = () => {
    if (coach || !PRONUNCIATION_COACH_ENABLED || !globalThis.EslPronunciationCoach?.createGameCoach) return;
    try {
      host = document.createElement('div');
      host.className = 'pronunciation-hints';
      coach = globalThis.EslPronunciationCoach.createGameCoach({
        coach: { hintLanguage: 'ja', accent: 'en-US', useTranscriptRanking: false },
        ui: { container: host, placement: 'inline', showTryAgain: false, note: NOTE, theme: THEME },
        // The student taps the mic again themselves after listening.
        pauseListening,
      });
      if (!coach.enabled) { coach = null; host = null; }
    } catch { coach = null; host = null; }
  };
  const attempt = (item, details) => {
    try {
      return coach?.attempt({
        // Coach the verb itself; enAccepted only adds recogniser homophones.
        exerciseId: `verb:${item.id}`, target: item.en, focus: words(item.en),
        answerSet: answerSet.filter((answer) => answer !== item.en), ...details,
      });
    } catch { return undefined; }
  };
  return {
    /** Put the (possibly empty) hint card under the mic button of a speech question. */
    mount(parent) { init(); if (host) parent.append(host); },
    /** A finished listening session heard speech that did not match. */
    miss(item, heard) {
      attempt(item, { correct: false, transcript: heard.transcript, alternatives: heard.alternatives.map((transcript) => ({ transcript })) });
    },
    /** The game accepted the answer: hide the card and reset this verb's hints. */
    hit(item) { attempt(item, { correct: true, transcript: '' }); },
    /** Hide the card; a revisited verb keeps its progression this session. */
    clear() { try { coach?.clear(); } catch {} },
  };
}
