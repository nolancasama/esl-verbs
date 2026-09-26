export function speak(text, lang, { onError = () => {} } = {}) {
  const synthesis = globalThis.speechSynthesis;
  const Utterance = globalThis.SpeechSynthesisUtterance;
  if (!synthesis || !Utterance) { onError(); return false; }
  try {
    synthesis.cancel();
    const utterance = new Utterance(text);
    utterance.lang = lang; utterance.rate = 0.9;
    const voice = synthesis.getVoices?.().find((candidate) => candidate.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
    if (voice) utterance.voice = voice;
    // cancel() makes the previous utterance report interrupted/canceled; that is not a failure.
    utterance.onerror = (event) => { if (event?.error !== 'interrupted' && event?.error !== 'canceled') onError(); };
    synthesis.speak(utterance);
    return true;
  } catch { onError(); return false; }
}
