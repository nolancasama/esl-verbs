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
    const prompt = (await page.locator('.prompt:visible, .rpg-quiz__prompt:visible').first().innerText()).trim().toLowerCase();
    const item = vocabularyByEnglish.get(prompt);
    if (!item) throw new Error(`Typed quiz prompt was not found in src/vocab.js: ${JSON.stringify(prompt)}`);
    await input.fill(item.ja);
    await input.press('Enter');
    const next = page.getByRole('button', { name: /^Next$/i });
    await next.waitFor({ state: 'visible' });
    await next.click();
  }
}

// Presses the basic attack whenever it is enabled; recovery turns (0 AP) run by themselves.
async function winBattleWithKeyboard(page) {
  const victory = page.getByText(/VICTORY!/i).first();
  const defeated = page.getByRole('heading', { name: /^DEFEATED/ }).first();
  for (let attempt = 0; attempt < 600; attempt += 1) {
    if (await victory.isVisible().catch(() => false)) return;
    if (await defeated.isVisible().catch(() => false)) throw new Error('The hero was defeated');
    if (await page.locator('.battle-skill:not(:disabled)').first().isVisible().catch(() => false)) await page.keyboard.press('1');
    await page.waitForTimeout(60);
  }
  throw new Error('Battle did not reach VICTORY');
}

async function apMeterValue(page) {
  return Number((await page.locator('.ap-meter__now').first().innerText()).trim());
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
  await page.getByRole('button', { name: /START ADVENTURE/i }).click();
  await page.getByRole('button', { name: /Fighter/i }).click();
  // The intro story plays first; SKIP goes straight to Stage 1, exactly once.
  await page.locator('.cinematic--intro').waitFor();
  await page.getByRole('button', { name: /Skip/i }).click();
  await page.locator('.rpg-quiz').waitFor();
  await page.waitForTimeout(3000); // past the reduced-motion intro's own timer
  if (await page.locator('.rpg-quiz').count() !== 1 || !(await page.getByText(/^1 \/ 10$/).count())) throw new Error('Stage 1 should start exactly once after skipping the intro');
  await answerTenTypedQuestions(page);

  await page.getByText(/STAGE\s*1\s*CLEAR/i).waitFor();
  await page.getByText(/=\s*10\s*AP/i).waitFor();
  if (await apMeterValue(page) !== 10) throw new Error('The AP meter should show the 10 AP earned in the quiz');
  await page.getByRole('button', { name: /BATTLE!/i }).click();
  await page.locator('.battle-view').waitFor();
  if (await apMeterValue(page) !== 10) throw new Error('The same AP meter should carry into battle');
  await page.locator('.battle-skill__cost').first().getByText(/1 AP/).waitFor();
  await winBattleWithKeyboard(page);

  await page.getByText(/XP/).first().waitFor();
  await page.getByText(/LEVEL UP!/i).first().waitFor();
  await page.getByText(/NEW SKILL!/i).first().waitFor();
  const nextStage = page.getByRole('button', { name: /NEXT STAGE/i });
  await nextStage.waitFor();
  await nextStage.click();
  await page.getByText(/STAGE\s*2/i).first().waitFor();
}

async function regionalFlow(page, baseUrl) {
  await page.goto(baseUrl);
  await page.evaluate(() => localStorage.setItem('esl-verbs-region-v1', JSON.stringify({
    heroId: 'fighter', level: 5, xp: 300, savedCities: ['matsubara'], checkpoint: null,
  })));
  await page.reload();
  const continueAdventure = page.getByRole('button', { name: /CONTINUE ADVENTURE/i });
  await continueAdventure.waitFor();
  await continueAdventure.click();
  await page.getByRole('group', { name: /Osaka map/i }).waitFor();
  await page.getByRole('button', { name: /GO TO SAKAI/i }).click();
  await page.locator('.story--sakai-intro').waitFor();
  await page.getByRole('button', { name: /^Skip/i }).click();
  await page.locator('.rpg-quiz.stage-1').waitFor();
  await page.getByRole('textbox', { name: /Japanese answer/i }).waitFor();
  const region = await page.evaluate(() => JSON.parse(localStorage.getItem('esl-verbs-region-v1')));
  if (region.checkpoint?.cityId !== 'sakai' || region.checkpoint.stage !== 1 || region.checkpoint.stageResults?.length !== 0) {
    throw new Error(`Sakai stage 1 checkpoint was not stored: ${JSON.stringify(region.checkpoint)}`);
  }
  if (JSON.stringify(region.savedCities) !== JSON.stringify(['matsubara'])) throw new Error('Starting Sakai changed the saved cities');
}

async function debugBattleFlow(page, baseUrl) {
  await page.goto(`${baseUrl}/?debug=battle`);
  await page.getByRole('button', { name: /START BATTLE/i }).waitFor();

  const selects = page.locator('select');
  const hero = page.getByLabel(/^Hero/i).or(selects.nth(0));
  const encounter = page.getByLabel(/^Encounter/i).or(selects.nth(1));
  const skillTier = selects.nth(3);
  await selectOption(hero.first(), 'mage', /Mage/i);
  await selectOption(encounter.first(), 'goblin-slime', /goblin.*slime/i);
  await selectOption(skillTier.first(), '2', /2/);

  const numberInputs = page.locator('input[type="number"]');
  await page.getByLabel(/^AP/i).or(numberInputs.nth(0)).first().fill('0');
  const hp = page.getByLabel(/Hero HP/i).or(numberInputs.nth(1)).first();
  if (await hp.count()) await hp.fill('');
  await page.getByRole('button', { name: /START BATTLE/i }).click();
  // 0 AP: the first turn is a recovery turn, then every action spends AP.
  await page.getByText(/RECOVERING/i).first().waitFor();
  await winBattleWithKeyboard(page);

  await page.getByRole('button', { name: /^Retry$/i }).waitFor();
  await page.getByRole('button', { name: /Random encounter/i }).waitFor();
  await page.getByRole('button', { name: /Back to debug/i }).waitFor();
}

async function musicToggle(page, baseUrl) {
  await page.goto(baseUrl);
  const toggle = page.locator('[data-music-toggle]').first();
  await toggle.waitFor();
  const before = await toggle.innerText();
  await toggle.click();
  const after = await toggle.innerText();
  if (before === after) throw new Error('Music toggle did not change');
  await page.reload();
  if ((await page.locator('[data-music-toggle]').first().innerText()) !== after) throw new Error('Music preference was not remembered');
  await page.locator('[data-music-toggle]').first().click();
}

async function studyFlow(page, baseUrl) {
  await page.goto(baseUrl);
  await page.getByRole('button', { name: /PRACTICE ONLY/i }).click();
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
  await regionalFlow(page, baseUrl);
  await debugBattleFlow(page, baseUrl);
  await musicToggle(page, baseUrl);
  await studyFlow(page, baseUrl);

  if (browserErrors.length) throw new Error(`Browser errors:\n${browserErrors.join('\n')}`);
  console.log('Browser playthrough passed: Adventure, Osaka regional continuation/checkpoint, 0-AP recovery battle, music toggle, and Study mode 1.');
} catch (error) {
  console.error(error?.stack || error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server.listening) await close(server);
}
