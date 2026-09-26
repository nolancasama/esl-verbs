export const QUESTIONS_PER_ROUND = 10;

export const MODES = Object.freeze({
  1: Object.freeze({ prompt: 'en', showPrompt: true, speakLang: 'en-US', answer: 'jaText' }),
  2: Object.freeze({ prompt: 'en', showPrompt: false, speakLang: 'en-US', answer: 'jaText' }),
  3: Object.freeze({ prompt: 'ja', showPrompt: true, speakLang: 'ja-JP', answer: 'enSpeech' }),
  4: Object.freeze({ prompt: 'ja', showPrompt: false, speakLang: 'ja-JP', answer: 'enSpeech' }),
});

function shuffled(items, rng) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function createRound(pool, rng = Math.random, count = QUESTIONS_PER_ROUND) {
  return shuffled(pool, rng).slice(0, Math.min(count, pool.length));
}

export function answer(state, correct) {
  const item = state.items[state.currentIndex];
  const missedIds = new Set(state.missedIds);
  const currentStreak = correct ? state.currentStreak + 1 : 0;
  if (!correct && item) missedIds.add(item.id);
  return {
    ...state,
    correctCount: state.correctCount + (correct ? 1 : 0),
    currentStreak,
    bestStreak: Math.max(state.bestStreak, currentStreak),
    missedIds,
  };
}

export function practiceItems(items, missedIds) {
  const ids = missedIds instanceof Set ? missedIds : new Set(missedIds);
  return items.filter((item) => ids.has(item.id));
}

export function makeChoices(item, vocab, rng = Math.random) {
  const distractors = shuffled(vocab.filter((candidate) => candidate.id !== item.id), rng).slice(0, 3);
  return shuffled([item, ...distractors], rng);
}

export function viewModel(mode, item, { micFree = false } = {}) {
  const config = MODES[mode];
  if (!config) throw new Error(`Unknown mode: ${mode}`);
  return {
    promptText: config.showPrompt ? item[config.prompt] : null,
    speak: { text: item[config.prompt], lang: config.speakLang },
    input: config.answer === 'enSpeech' && micFree ? 'choices' : config.answer,
  };
}
