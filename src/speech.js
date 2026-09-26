import { isEnglishMatch } from './normalize.js';

export function findMatch(results, accepted) {
  for (const result of results || []) {
    for (let index = 0; index < result.length; index += 1) {
      const transcript = result[index]?.transcript;
      if (transcript && isEnglishMatch(transcript, accepted)) return transcript;
    }
  }
  return null;
}

export class TapToTalk {
  constructor({ SpeechRecognition, onCorrect = () => {}, onHeard = () => {}, onStatus = () => {}, onUnavailable = () => {}, onError = () => {}, timeoutMs = 6000 } = {}) {
    this.Recognition = SpeechRecognition || globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
    this.onCorrect = onCorrect; this.onHeard = onHeard; this.onStatus = onStatus;
    this.onUnavailable = onUnavailable; this.onError = onError; this.timeoutMs = timeoutMs;
    this.recognition = null; this.listening = false; this.matched = false; this.timer = null; this.accepted = [];
  }

  start(accepted) {
    if (this.listening) return this.stop();
    if (!this.Recognition) return this.onUnavailable('unsupported');
    this.accepted = accepted; this.matched = false;
    const recognition = this.recognition = new this.Recognition();
    recognition.lang = 'en-US'; recognition.interimResults = true; recognition.continuous = false; recognition.maxAlternatives = 5;
    recognition.onresult = (event) => {
      const matched = findMatch(event.results, this.accepted);
      if (matched) { this.matched = true; this.onCorrect(matched); this.stop(); return; }
      const last = event.results?.[event.results.length - 1];
      const transcript = last?.[0]?.transcript;
      if (transcript) this.onHeard(transcript);
    };
    recognition.onerror = (event) => {
      const reason = event?.error || 'other';
      if (reason === 'not-allowed' || reason === 'service-not-allowed') this.onUnavailable('denied');
      else if (reason !== 'no-speech' && reason !== 'aborted') this.onError(reason);
    };
    recognition.onend = () => this.finish();
    this.listening = true; this.onStatus('Listening...');
    this.timer = setTimeout(() => this.stop(), this.timeoutMs);
    try { recognition.start(); } catch { this.onError('start'); this.finish(); }
  }

  stop() {
    if (!this.recognition) return;
    clearTimeout(this.timer); this.timer = null;
    try { this.recognition.stop(); } catch { this.finish(); }
  }

  finish() {
    if (!this.listening) return;
    this.listening = false; clearTimeout(this.timer); this.timer = null;
    this.recognition = null;
    if (!this.matched) this.onStatus('Try again');
  }

  cancel() {
    clearTimeout(this.timer); this.timer = null; this.listening = false;
    if (this.recognition) { this.recognition.onend = null; try { this.recognition.abort(); } catch {} }
    this.recognition = null;
  }
}
