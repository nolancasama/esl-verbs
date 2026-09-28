// Only the most recent utterance may report its end, so a cancelled earlier
// prompt cannot un-duck the music while the new one is still speaking.
let latest = 0;
const END_GUARD_MS = 8000; // some voices never fire onend; never leave music ducked

export function speak(text, lang, { onError = () => {}, onStart = () => {}, onEnd = () => {} } = {}) {
  const synthesis = globalThis.speechSynthesis;
  const Utterance = globalThis.SpeechSynthesisUtterance;
  if (!synthesis || !Utterance) { onError(); return false; }
  const token = ++latest;
  let ended = false;
  let guard = null;
  const end = () => {
    if (ended) return;
    ended = true;
    clearTimeout(guard);
    if (token === latest) onEnd();
  };
  try {
    synthesis.cancel();
    const utterance = new Utterance(text);
    utterance.lang = lang; utterance.rate = 0.9;
    const voice = synthesis.getVoices?.().find((candidate) => candidate.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));
    if (voice) utterance.voice = voice;
    utterance.onend = end;
    // cancel() makes the previous utterance report interrupted/canceled; that is not a failure.
    utterance.onerror = (event) => { end(); if (event?.error !== 'interrupted' && event?.error !== 'canceled') onError(); };
    onStart();
    guard = setTimeout(end, END_GUARD_MS);
    synthesis.speak(utterance);
    return true;
  } catch { end(); onError(); return false; }
}
