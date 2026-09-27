import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { VOCABULARY } from '../../src/vocab.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const vocabularyByEnglish = new Map(VOCABULARY.map((item) => [item.en.toLowerCase(), item]));
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
};

function staticServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname === '/favicon.ico') {
        response.writeHead(204).end();
        return;
      }
      const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).replace(/^\/+/, '');
      const filename = path.resolve(repoRoot, relative);
      if (filename !== repoRoot && !filename.startsWith(`${repoRoot}${path.sep}`)) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const body = await readFile(filename);
      response.writeHead(200, {
        'content-type': contentTypes[path.extname(filename)] || 'application/octet-stream',
        'cache-control': 'no-store',
      });
      response.end(body);
    } catch (error) {
      response.writeHead(error?.code === 'ENOENT' ? 404 : 500).end('Not found');
    }
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return `http://127.0.0.1:${server.address().port}`;
}

async function close(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

function watchBrowserErrors(page, errors) {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.stack || error.message}`));
}

async function stubSpeech(page) {
  await page.addInitScript(() => {
    class FakeUtterance {
      constructor(text) {
        this.text = text;
        this.lang = '';
        this.onend = null;
        this.onerror = null;
      }
    }
    class FakeRecognition {
      start() { this.onstart?.(); }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance });
    Object.defineProperty(globalThis, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel() {},
        getVoices() { return []; },
        speak(utterance) {
          utterance.onstart?.();
          queueMicrotask(() => utterance.onend?.());
        },
      },
    });
    Object.defineProperty(globalThis, 'SpeechRecognition', { configurable: true, value: FakeRecognition });
    Object.defineProperty(globalThis, 'webkitSpeechRecognition', { configurable: true, value: FakeRecognition });
  });
}

async function answerTenTypedQuestions(page) {
  for (let index = 0; index < 10; index += 1) {
    const input = page.getByRole('textbox', { name: /Japanese answer/i });
    await input.waitFor({ state: 'visible' });
    const prompt = (await page.locator('.prompt:visible').first().innerText()).trim().toLowerCase();
    const item = vocabularyByEnglish.get(prompt);
    if (!item) throw new Error(`Typed quiz prompt was not found in src/vocab.js: ${JSON.stringify(prompt)}`);
    await input.fill(item.ja);
    await input.press('Enter');
    const next = page.getByRole('button', { name: /^Next$/i });
    await next.waitFor({ state: 'visible' });
    await next.click();
  }
}

async function winBattleWithKeyboard(page) {
  const victory = page.getByText(/VICTORY!/i).first();
  for (let attempt = 0; attempt < 160; attempt += 1) {
    if (await victory.isVisible().catch(() => false)) return;
    await page.keyboard.press('1');
    await page.waitForTimeout(35);
  }
  throw new Error('Battle did not reach VICTORY after 160 keyboard actions');
}

async function selectOption(control, value, labelPattern) {
  try {
    await control.selectOption(value);
    return;
  } catch {}
  const options = await control.locator('option').evaluateAll((nodes) => nodes.map((node) => ({
    value: node.value,
    label: node.textContent,
  })));
  for (const option of options) {
    if (!labelPattern.test(option.label)) continue;
    try {
      await control.selectOption(option.value);
      return;
    } catch {}
  }
  throw new Error(`Could not select ${value}`);
}

async function adventureFlow(page, baseUrl) {
  await page.goto(baseUrl);
  await page.getByRole('button', { name: /ADVENTURE/i }).click();
  await page.getByRole('button', { name: /Fighter/i }).click();
  await answerTenTypedQuestions(page);

  await page.getByText(/STAGE\s*1\s*COMPLETE/i).waitFor();
  await page.getByText(/Battle Power:\s*12|POWER\s*12/i).waitFor();
  await page.getByRole('button', { name: /BATTLE!/i }).click();
  await winBattleWithKeyboard(page);

  await page.getByText(/NEW SKILL!/i).waitFor();
  const nextStage = page.getByRole('button', { name: /NEXT STAGE/i });
  await nextStage.waitFor();
  await nextStage.click();
  await page.getByText(/STAGE\s*2/i).first().waitFor();
}

async function debugBattleFlow(page, baseUrl) {
  await page.goto(`${baseUrl}/?debug=battle`);
  await page.getByRole('button', { name: /START BATTLE/i }).waitFor();

  const selects = page.locator('select');
  const hero = page.getByLabel(/^Hero/i).or(selects.nth(0));
  const encounter = page.getByLabel(/^Encounter/i).or(selects.nth(1));
  const skillTier = page.getByLabel(/Skill tier/i).or(selects.nth(2));
  await selectOption(hero.first(), 'mage', /Mage/i);
  await selectOption(encounter.first(), 'goblin-slime', /goblin.*slime/i);
  await selectOption(skillTier.first(), '2', /2/);

  const numberInputs = page.locator('input[type="number"]');
  await page.getByLabel(/^Power/i).or(numberInputs.nth(0)).first().fill('0');
  const hp = page.getByLabel(/Hero HP/i).or(numberInputs.nth(1)).first();
  if (await hp.count()) await hp.fill('');
  await page.getByRole('button', { name: /START BATTLE/i }).click();
  await winBattleWithKeyboard(page);

  await page.getByRole('button', { name: /^Retry$/i }).waitFor();
  await page.getByRole('button', { name: /Random encounter/i }).waitFor();
  await page.getByRole('button', { name: /Back to debug/i }).waitFor();
}

async function studyFlow(page, baseUrl) {
  await page.goto(baseUrl);
  await page.getByRole('button', { name: /STUDY/i }).click();
  await page.getByRole('button', { name: /^1\.|English.*Japanese/i }).first().click();
  await answerTenTypedQuestions(page);
  await page.getByRole('heading', { name: /Score:\s*10\s*\/\s*10/i }).waitFor();
  await page.getByRole('button', { name: /^Again$/i }).waitFor();
  await page.getByRole('button', { name: /Next level/i }).waitFor();
  await page.getByRole('button', { name: /Level select/i }).waitFor();
}

const server = staticServer();
let browser;
const browserErrors = [];

try {
  const baseUrl = await listen(server);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  watchBrowserErrors(page, browserErrors);
  await stubSpeech(page);

  await adventureFlow(page, baseUrl);
  await debugBattleFlow(page, baseUrl);
  await studyFlow(page, baseUrl);

  if (browserErrors.length) throw new Error(`Browser errors:\n${browserErrors.join('\n')}`);
  console.log('Browser playthrough passed: Adventure, debug battle, and Study mode 1.');
} catch (error) {
  console.error(error?.stack || error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server.listening) await close(server);
}
