// Browser check for the pronunciation hints in the spoken-English modes.
// Drives the real page with a scripted SpeechRecognition: a near miss shows
// the ranked hints in order, silence and other verbs never advance them, a
// correct answer still scores, and ?coach=off leaves the game untouched.
// Screenshots: .tmp/coach-screens/ (gitignored).
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { VOCABULARY } from '../../src/vocab.js';
import { PronunciationCoach } from '../../vendor/esl-pronunciation-coach/pronunciation-coach.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/nolan/ui-verify/node_modules/playwright');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const shots = path.join(repoRoot, '.tmp', 'coach-screens');
const byJapanese = new Map(VOCABULARY.map((item) => [item.ja, item]));
const types = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

function serve() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const file = path.resolve(repoRoot, decodeURIComponent(url.pathname === '/' ? 'index.html' : url.pathname.slice(1)));
      if (!file.startsWith(repoRoot)) return response.writeHead(403).end();
      const body = await readFile(file);
      response.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      response.end(body);
    } catch { response.writeHead(404).end(); }
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// One scripted recogniser: the test decides what each listening session hears.
async function stubSpeech(page) {
  await page.addInitScript(() => {
    class FakeUtterance { constructor(text) { this.text = text; this.lang = ''; } }
    globalThis.__spoken = [];
    Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance });
    Object.defineProperty(globalThis, 'speechSynthesis', { configurable: true, value: {
      cancel() {}, getVoices() { return [{ lang: 'en-US', name: 'English' }, { lang: 'ja-JP', name: 'Japanese' }]; },
      speak(utterance) { globalThis.__spoken.push({ text: utterance.text, lang: utterance.lang }); utterance.onstart?.(); setTimeout(() => utterance.onend?.(), 10); },
      addEventListener() {}, removeEventListener() {},
    } });
    class FakeRecognition {
      start() { globalThis.__recognition = this; this.onstart?.(); }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    // hear(['best', 'alt']) delivers one final result then ends; hear([]) is silence.
    globalThis.__hear = (alternatives) => {
      const recognition = globalThis.__recognition;
      if (!recognition) throw new Error('not listening');
      globalThis.__recognition = null;
      if (alternatives.length) {
        const result = alternatives.map((transcript) => ({ transcript, confidence: 0.6 }));
        result.isFinal = true;
        recognition.onresult?.({ results: [result] });
      } else recognition.onerror?.({ error: 'no-speech' });
      recognition.onend?.();
    };
    Object.defineProperty(globalThis, 'SpeechRecognition', { configurable: true, value: FakeRecognition });
    Object.defineProperty(globalThis, 'webkitSpeechRecognition', { configurable: true, value: FakeRecognition });
  });
}

const check = (condition, message) => { if (!condition) throw new Error(message); };

// A transcript a recogniser might return for a Japanese learner's attempt:
// the first classic substitution the coach itself rates as a near miss.
const SWAPS = [[/r/, 'l'], [/l/, 'r'], [/v/, 'b'], [/b/, 'v'], [/th/, 's'], [/f/, 'h'], [/w/, ''], [/(.)$/, '$1o'], [/$/, 's'], [/e/, 'a'], [/$/, 'es'], [/$/, 'ed'], [/$/, 'ing'], [/^c(.*)tch$/, 'k$1ch'], [/^(.)/, 's']];
function nearMissFor(item) {
  const coach = new PronunciationCoach();
  const english = new Set(VOCABULARY.flatMap((other) => other.enAccepted));
  for (const [pattern, replacement] of SWAPS) {
    const candidate = item.en.replace(pattern, replacement);
    if (candidate === item.en || english.has(candidate)) continue;
    const { classification } = coach.handleAttempt({ target: item.en, exerciseId: candidate, correct: false, transcript: candidate });
    if (classification === 'possible-pronunciation') return candidate;
  }
  throw new Error(`no near miss found for ${item.en}`);
}
const hintText = (page) => page.locator('.pronunciation-hints .epc-card:visible').innerText().catch(() => '');

async function currentItem(page) {
  const prompt = (await page.locator('.prompt:visible, .rpg-field__word:visible').first().innerText()).trim();
  const item = byJapanese.get(prompt);
  check(item, `prompt not in vocabulary: ${prompt}`);
  return item;
}

async function say(page, alternatives) {
  await page.locator('button.mic').click();
  await page.evaluate((list) => globalThis.__hear(list), alternatives);
  await page.waitForTimeout(80);
}

// Spoken-mode checks shared by Study and Adventure.
async function exercise(page, label) {
  const item = await currentItem(page);
  const other = VOCABULARY.find((candidate) => candidate.en !== item.en && !item.enAccepted.includes(candidate.en));
  const nearMiss = nearMissFor(item);

  await say(page, []);
  check(!(await hintText(page)), `${label}: silence must not show a hint`);
  await say(page, [other.en]);
  check(!(await hintText(page)), `${label}: another verb (${other.en}) must not show a hint`);

  // The coach's own ranking for this verb, in Japanese (support hints follow when it runs out).
  const plan = new PronunciationCoach({ hintLanguage: 'ja' }).getHints(item.en);
  const ranked = [...plan.hints, ...plan.support].map((hint) => hint.text);

  await say(page, [nearMiss]);
  const first = await hintText(page);
  check(first.includes(item.en), `${label}: near miss should show a hint for ${item.en}; got ${JSON.stringify(first)}`);
  check(first.includes(ranked[0]), `${label}: first hint should be rank 1 (${ranked[0]}); got ${JSON.stringify(first)}`);
  check(/[\u3040-\u30ff]/.test(first), `${label}: hint should be Japanese`);
  await page.screenshot({ path: path.join(shots, `${label}-hint1.png`) });

  // Another verb is a content mistake: the card hides and progression stays put,
  // so the next near miss shows rank 2, not rank 3.
  await say(page, [other.en]);
  check(!(await hintText(page)), `${label}: another verb should hide the card, not show a hint`);
  await say(page, [nearMiss]);
  const second = await hintText(page);
  check(second.includes(ranked[1]), `${label}: second near miss should show rank 2 (${ranked[1]}); got ${JSON.stringify(second)}`);

  await page.locator('.pronunciation-hints .epc-card button').first().click();
  await page.waitForTimeout(60);
  const spoken = await page.evaluate(() => globalThis.__spoken.at(-1));
  check(spoken?.text?.toLowerCase().includes(item.en) && /^en/i.test(spoken.lang), `${label}: Listen should speak ${item.en} in English, got ${JSON.stringify(spoken)}`);

  await say(page, [item.enAccepted[0]]);
  await page.getByText(/Correct! \/ せいかい！/).first().waitFor();
  check(!(await hintText(page)), `${label}: hint must clear after a correct answer`);
  return item;
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}`;
await mkdir(shots, { recursive: true });
// Same browser as test/browser/playthrough.mjs, but a fresh one per page: on 2026-10-17 the
// second or third page in one headless browser crashed ("Target crashed") on this machine,
// with or without the coach and with or without GPU.
const browsers = [];
const errors = [];
try {
  const open = async (width, height) => {
    const browser = await chromium.launch({ headless: true });
    browsers.push(browser);
    const page = await browser.newPage({ viewport: { width, height }, reducedMotion: 'reduce' });
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(error.message));
    await stubSpeech(page);
    return page;
  };
  // Study, mode 3 (see Japanese, say English): a responsive card, phone to desktop.
  for (const [width, height] of [[360, 780], [1280, 800]]) {
    const page = await open(width, height);
    await page.goto(base);
    await page.getByRole('button', { name: /PRACTICE|れんしゅう/i }).first().click();
    await page.getByRole('button', { name: /^3\. Japanese → Speak English/ }).click();
    const item = await exercise(page, `study-${width}`);
    console.log(`study ${width}px: ranked hints, no advance on silence/other verb, Listen in English, reset on correct (${item.en})`);
    await page.close();
  }
  // Adventure (landscape Chromebooks, DESIGN_DECISIONS: 1024×600, 1366×635) uses the same
  // answerArea code path. Opt-in only: on 2026-10-17 headless Chromium's renderer crashed in
  // a resumed spoken stage even with ?coach=off, so this needs its own diagnosis first.
  for (const [width, height] of process.env.COACH_ADVENTURE ? [[1024, 600], [1366, 635]] : []) {
    const page = await open(width, height);
    await page.goto(base);
    // Sakai stage 3 (a spoken stage), resumed from a checkpoint.
    await page.evaluate(() => localStorage.setItem('esl-verbs-region-v1', JSON.stringify({
      heroId: 'fighter', level: 5, xp: 300, savedCities: ['matsubara'],
      checkpoint: { cityId: 'sakai', stage: 3, heroHp: 40, potions: 0, stageResults: [{ correctCount: 10, missedIds: [] }, { correctCount: 10, missedIds: [] }] },
    })));
    await page.goto(base);
    await page.getByRole('button', { name: /CONTINUE ADVENTURE/i }).click();
    await page.getByRole('button', { name: /CONTINUE SAKAI/i }).click();
    const skip = page.getByRole('button', { name: /^Skip/i });
    await page.locator('.rpg-quiz.stage-3, .story').first().waitFor();
    if (await skip.isVisible().catch(() => false)) await skip.click();
    await page.locator('.rpg-quiz.stage-3 button.mic').waitFor();
    await exercise(page, `adventure-${width}`);
    await page.close();
  }

  // Disabled: no coach DOM, the game still accepts the answer.
  const page = await open(1280, 800);
  console.log('coach=off: opening');
  await page.goto(`${base}/?coach=off`);
  console.log('coach=off: loaded');
  await page.getByRole('button', { name: /PRACTICE|れんしゅう/i }).first().click();
  await page.getByRole('button', { name: /^3\. Japanese → Speak English/ }).click();
  const item = await currentItem(page);
  await say(page, [nearMissFor(item)]);
  check(await page.locator('.pronunciation-hints .epc-card').count() === 0, 'coach=off must not render a hint card');
  await say(page, [item.enAccepted[0]]);
  await page.getByText(/Correct! \/ せいかい！/).first().waitFor();
  check(!errors.length, `browser errors:\n${errors.join('\n')}`);
  console.log(`Coach browser checks passed (study 360/1280${process.env.COACH_ADVENTURE ? ', adventure 1024x600/1366x635' : ''}, coach=off); screenshots in ${path.relative(repoRoot, shots)}`);
} finally {
  await Promise.all(browsers.map((browser) => browser.close().catch(() => {})));
  server.close();
}
