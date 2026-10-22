import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { VOCABULARY } from '../../src/vocab.js';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidenceDir = path.join(repoRoot, '.tmp', 'browser');
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
    const prompt = (await page.locator('.prompt:visible, .rpg-field__word:visible').first().innerText()).trim().toLowerCase();
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
  await page.setViewportSize({ width: 1024, height: 600 });
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
  // Stage Clear shows the earned AP on the meter under the hero, with no topbar.
  await page.locator('.stage-card > .rpg-stage-scene--clear + .ap-meter').waitFor();
  if (await page.locator('.stage-card .rpg-topbar').count()) throw new Error('Stage Clear should not show the menu / music topbar');
  if (await apMeterValue(page) !== 10) throw new Error('The AP meter should show the 10 AP earned in the quiz');
  await page.getByRole('button', { name: /BATTLE!/i }).click();
  await page.locator('.station-card').waitFor();
  if (await page.locator('.battle-view').count()) throw new Error('Stage Clear must show the station map before battle');
  await assertNoPageScroll(page, 'Station map');
  await page.screenshot({ path: path.join(evidenceDir, 'station-map.png') });
  await page.getByRole('button', { name: /DEFEND!/i }).click();
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

async function yaoBattleFlow(page, baseUrl) {
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.goto(`${baseUrl}/?debug=map&preset=sakai`);
  const yao = page.locator('.osaka-city[data-city="yao"]');
  await yao.waitFor();
  if (await yao.isDisabled() || !(await yao.getAttribute('class')).includes('osaka-city--danger')) throw new Error('Saving Sakai should make Yao playable and under attack');
  if (!(await page.locator('.osaka-city[data-city="higashiosaka"]').isDisabled())) throw new Error('Higashiosaka should remain locked');
  await page.getByRole('button', { name: /GO TO YAO/i }).click();
  await page.locator('.story--yao-intro').waitFor();
  await page.getByRole('button', { name: /^Skip/i }).click();
  await page.locator('.rpg-quiz.stage-1').waitFor();
  const checkpoint = await page.evaluate(() => JSON.parse(localStorage.getItem('esl-verbs-region-v1')).checkpoint);
  if (checkpoint?.cityId !== 'yao' || checkpoint.stage !== 1) throw new Error('Yao did not store its stage 1 checkpoint');

  await page.goto(`${baseUrl}/?debug=battle`);
  await page.getByRole('button', { name: /START BATTLE/i }).waitFor();
  await page.getByLabel(/^Hero/i).first().selectOption('fighter');
  await page.getByLabel(/^Encounter/i).first().selectOption('yao-1');
  await page.getByLabel(/^AP/i).first().fill('10');
  await page.getByRole('button', { name: /START BATTLE/i }).click();
  const horn = page.locator('[data-enemy-id="hornGoblin"]');
  if (await horn.locator('.battle-intent--call').count()) throw new Error('Three living enemies must block calls');
  await page.locator('[data-enemy-id="slime"] .battle-sprite').click();
  await page.locator('[data-skill-id="powerSlash"]').click();
  await horn.locator('.battle-intent--call').waitFor();
  if (!(await horn.locator('.battle-intent').innerText()).includes('CALLING HELP!')) throw new Error('The call was not telegraphed before the player action');
  if (await horn.locator('.battle-sprite').getAttribute('data-state') !== 'cast') throw new Error('The telegraphed caller should raise its horn');
  const lines = await horn.locator('.battle-intent--call > span').evaluateAll((nodes) => nodes.map((node) => ({ text: node.textContent, nowrap: getComputedStyle(node).whiteSpace, top: node.getBoundingClientRect().top })));
  if (lines.length !== 2 || lines.some((line) => line.nowrap !== 'nowrap') || lines[1].top <= lines[0].top) throw new Error('Call label must have two nowrap lines');
  const before = await page.locator('.battle-enemy').evaluateAll((nodes) => nodes.map((node) => node.dataset.enemyUid));
  if (before.length !== 3) throw new Error('Reinforcements arrived before the player had a turn');
  await assertNoPageScroll(page, 'Yao call telegraph');
  await page.screenshot({ path: path.join(evidenceDir, 'yao-call-telegraph.png') });
  await page.locator('[data-skill-id="guard"]').click();
  await page.locator('.battle-enemy').nth(3).waitFor({ state: 'visible' });
  await page.locator('[data-skill-id="guard"]:not(:disabled)').waitFor();
  const arrivals = await page.locator('.battle-enemy').evaluateAll((nodes, original) => nodes.filter((node) => !original.includes(node.dataset.enemyUid)).map((node) => node.dataset.enemyId), before);
  if (JSON.stringify(arrivals) !== JSON.stringify(['goblin'])) throw new Error(`Expected one summoned Goblin after the call: ${JSON.stringify(arrivals)}`);
  await assertNoPageScroll(page, 'Yao reinforcements');
  await page.screenshot({ path: path.join(evidenceDir, 'yao-reinforcement-arrival.png') });

  await page.goto(`${baseUrl}/?debug=battle`);
  await page.getByRole('button', { name: /START BATTLE/i }).waitFor();
  await page.getByLabel(/^Encounter/i).first().selectOption('yao-4');
  await page.getByLabel(/^Start wave/i).selectOption('2');
  await page.getByLabel(/^AP/i).first().fill('10');
  await page.getByRole('button', { name: /START BATTLE/i }).click();
  await page.locator('[data-enemy-id="warcaller"] .battle-sprite').waitFor();
  await page.locator('[data-enemy-id="armoredOrc"] .battle-sprite').waitFor();
  if (!(await page.locator('.battle-wave').innerText()).includes('2 / 2')) throw new Error('Yao final boss debug battle should start in wave 2');
  const protectedBoss = page.locator('[data-enemy-id="warcaller"] .battle-status--protected');
  if (!(await protectedBoss.innerText()).includes('まもられている')) throw new Error('The Warcaller should show Orc protection');
  if (!(await page.locator('[data-enemy-id="armoredOrc"] .battle-status--protected').innerText()).includes('まもっている')) throw new Error('The Orc should show its protection role');
  if (!(await page.locator('.battle-hint').innerText()).includes('オークを さきに たおそう！ BREAK THE GUARD!')) throw new Error('A protected caller must show the Orc hint');
  await assertNoPageScroll(page, 'Yao final boss');
  await page.screenshot({ path: path.join(evidenceDir, 'yao-protected-warcaller.png') });
}

async function assertNoPageScroll(page, label) {
  const scrolling = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, viewportWidth: innerWidth, viewportHeight: innerHeight }));
  if (scrolling.width > scrolling.viewportWidth || scrolling.height > scrolling.viewportHeight) throw new Error(`${label} scrolls at 1024×600: ${JSON.stringify(scrolling)}`);
}

async function higashiosakaBattleFlow(page, baseUrl) {
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.goto(`${baseUrl}/?debug=map&preset=yao`);
  const city = page.locator('.osaka-city[data-city="higashiosaka"]');
  await city.waitFor();
  if (await city.isDisabled() || !(await city.getAttribute('class')).includes('osaka-city--danger')) throw new Error('Saving Yao should make Higashiosaka playable and under attack');
  if (!(await page.locator('.osaka-city[data-city="osakaCity"]').isDisabled())) throw new Error('Osaka City should remain locked after Yao');
  await page.keyboard.press('Control+Alt+Shift+KeyD');
  await page.locator('.dev-panel [title="Higashiosaka stage 1 battle"]').waitFor();
  await page.getByRole('button', { name: /^Close$/ }).click();
  await page.getByRole('button', { name: /GO TO HIGASHIOSAKA/i }).click();
  await page.locator('.story--higashiosaka-intro').waitFor();
  await page.getByRole('button', { name: /^Skip/i }).click();
  await page.locator('.rpg-quiz.stage-1').waitFor();
  const region = await page.evaluate(() => JSON.parse(localStorage.getItem('esl-verbs-region-v1')));
  if (region.checkpoint?.cityId !== 'higashiosaka' || region.checkpoint.stage !== 1 || region.checkpoint.stageResults?.length !== 0) throw new Error('Higashiosaka did not store its stage 1 checkpoint');
  if (JSON.stringify(region.savedCities) !== JSON.stringify(['matsubara', 'sakai', 'yao'])) throw new Error('Starting Higashiosaka changed the saved cities');
  await assertNoPageScroll(page, 'Higashiosaka quiz');
  await answerTenTypedQuestions(page);
  await page.getByText(/STAGE\s*1\s*CLEAR/i).waitFor();
  await assertNoPageScroll(page, 'Higashiosaka Stage Clear');
  await page.getByRole('button', { name: /BATTLE!/i }).click();
  await page.locator('.station-card').waitFor();
  if (!(await page.locator('.station-card').innerText()).includes('石切')) throw new Error('Higashiosaka stage 1 must defend Ishikiri');
  if (await page.locator('.battle-view').count()) throw new Error('Higashiosaka must show Ishikiri before battle');
  await assertNoPageScroll(page, 'Higashiosaka Ishikiri map');
  await page.screenshot({ path: path.join(evidenceDir, 'higashiosaka-ishikiri.png') });
  await page.getByRole('button', { name: /DEFEND!/i }).click();
  await page.locator('.battle-field--core .battle-core').waitFor();
  if (!(await page.locator('.battle-core__plate').innerText()).includes('アクション・コア')) throw new Error('The Action Core plate must be visible in Higashiosaka');
  await page.locator('[data-enemy-id="saboteur"] .battle-intent__aim').waitFor();
  await assertNoPageScroll(page, 'Higashiosaka Core battle');
  await page.screenshot({ path: path.join(evidenceDir, 'higashiosaka-core-battle.png') });

  await page.goto(`${baseUrl}/?debug=battle`);
  await page.getByRole('button', { name: /START BATTLE/i }).waitFor();
  await page.getByLabel(/^Hero/i).first().selectOption('fighter');
  await page.getByLabel(/^Encounter/i).first().selectOption('hig-4');
  await page.getByLabel(/^Start wave/i).selectOption('2');
  await page.getByLabel(/^Level/i).selectOption('5');
  await page.getByLabel(/^AP/i).first().fill('10');
  await page.getByRole('button', { name: /START BATTLE/i }).click();
  const golem = page.locator('[data-enemy-id="siegeGolem"]');
  await golem.locator('.battle-sprite').waitFor();
  await page.locator('[data-enemy-id="engineerGoblin"]').waitFor();
  if (!(await page.locator('.battle-wave').innerText()).includes('2 / 2')) throw new Error('Higashiosaka final boss debug battle should start in wave 2');
  const guard = page.locator('[data-skill-id="guard"]:not(:disabled)');
  for (let turn = 0; turn < 10; turn += 1) {
    await guard.waitFor();
    if (await golem.locator('.battle-intent--heavy').count()) break;
    await guard.click();
  }
  await golem.locator('.battle-intent--heavy .battle-intent__aim').waitFor();
  if (!(await golem.locator('.battle-intent--heavy').innerText()).includes('Siege Blast')) throw new Error('The Siege Golem must telegraph Siege Blast before attacking');
  if (!(await page.locator('.battle-hint').innerText()).includes('GUARD THE CORE!')) throw new Error('A Core-aimed Siege Blast must show GUARD THE CORE');
  const coreHp = page.locator('.battle-core .battle-hp strong');
  const before = Number((await coreHp.innerText()).split('/')[0]);
  const expectedDamage = await page.evaluate(async () => {
    const { ENEMIES, HEROES } = await import('/src/battle-data.js');
    return Math.ceil(ENEMIES.siegeGolem.heavy * HEROES.fighter.passive.effect.guardMultiplier);
  });
  await assertNoPageScroll(page, 'Higashiosaka Siege Blast telegraph');
  await page.screenshot({ path: path.join(evidenceDir, 'higashiosaka-siege-telegraph.png') });
  await guard.click();
  await guard.waitFor();
  const after = Number((await coreHp.innerText()).split('/')[0]);
  if (before - after !== expectedDamage) throw new Error(`Guard did not reduce Siege Blast on the Core: ${before} -> ${after}, expected ${expectedDamage} damage`);
  await assertNoPageScroll(page, 'Higashiosaka guarded Core');
  await page.screenshot({ path: path.join(evidenceDir, 'higashiosaka-guarded-core.png') });
}

async function osakaCityFlow(page, baseUrl) {
  await page.setViewportSize({ width: 1024, height: 600 });
  await page.goto(`${baseUrl}/?debug=map&preset=higashiosaka`);
  const city = page.locator('.osaka-city[data-city="osakaCity"]');
  await city.waitFor();
  if (await city.isDisabled() || !(await city.getAttribute('class')).includes('osaka-city--danger')) throw new Error('Saving Higashiosaka should unlock Osaka City');
  await page.getByRole('button', { name: /GO TO OSAKA CITY/i }).click();
  await page.locator('.story--osakaCity-intro').waitFor();
  await page.getByRole('button', { name: /^Skip/i }).click();
  await page.locator('.rpg-quiz.stage-1').waitFor();
  const checkpoint = await page.evaluate(() => JSON.parse(localStorage.getItem('esl-verbs-region-v1')).checkpoint);
  if (checkpoint?.cityId !== 'osakaCity' || checkpoint.stage !== 1) throw new Error('Osaka City should checkpoint stage 1');
  await assertNoPageScroll(page, 'Osaka City quiz');
  await answerTenTypedQuestions(page);
  await page.getByText(/STAGE\s*1\s*CLEAR/i).waitFor();
  await assertNoPageScroll(page, 'Osaka City Stage Clear');
  await page.getByRole('button', { name: /BATTLE!/i }).click();
  await page.locator('.station-card').waitFor();
  if (!(await page.locator('.station-card').innerText()).includes('天王寺')) throw new Error('Osaka City stage 1 must defend Tennoji');
  if (await page.locator('.battle-view').count()) throw new Error('Osaka City must show Tennoji before battle');
  await assertNoPageScroll(page, 'Osaka City Tennoji map');
  await page.screenshot({ path: path.join(evidenceDir, 'osaka-city-tennoji.png') });
  await page.getByRole('button', { name: /DEFEND!/i }).click();
  await page.locator('.battle-view').waitFor();
  await page.locator('[data-enemy-id="hornGoblin"]').waitFor();
  if (await page.locator('.battle-core').count()) throw new Error('The Invasion should have no Core');
  await assertNoPageScroll(page, 'Osaka City Invasion battle');
  await page.screenshot({ path: path.join(evidenceDir, 'osaka-city-invasion.png') });

  for (const wave of [2, 3]) {
    await page.goto(`${baseUrl}/?debug=battle`);
    await page.getByRole('button', { name: /START BATTLE/i }).waitFor();
    await page.getByLabel(/^Hero/i).first().selectOption('fighter');
    await page.getByLabel(/^Encounter/i).first().selectOption('osk-4');
    await page.getByLabel(/^Start wave/i).selectOption(String(wave));
    await page.getByLabel(/^Level/i).selectOption('5');
    await page.getByLabel(/^AP/i).first().fill('10');
    await page.getByRole('button', { name: /START BATTLE/i }).click();
    await page.locator('.battle-core').waitFor({ state: 'visible' });
    await page.locator(`[data-enemy-id="${wave === 2 ? 'blackStarAvatar' : 'blackStarTrue'}"]`).waitFor();
    if (!(await page.locator('.battle-wave').innerText()).includes(`${wave} / 3`)) throw new Error(`Osaka finale debug should start at wave ${wave}`);
    if (wave === 2 && await page.locator('.battle-ally').count()) throw new Error('The ally should wait until the true form');
    if (wave === 3) {
      await page.locator('.battle-ally').waitFor({ state: 'visible' });
      const boxes = await page.evaluate(() => {
        const box = (selector) => {
          const { x, y, width, height } = document.querySelector(selector).getBoundingClientRect();
          return { x, y, width, height };
        };
        return { core: box('.battle-core'), ally: box('.battle-ally') };
      });
      const { core, ally } = boxes;
      if (core.x < ally.x + ally.width && core.x + core.width > ally.x && core.y < ally.y + ally.height && core.y + core.height > ally.y) {
        throw new Error(`Osaka finale Core and ally boxes overlap: ${JSON.stringify(boxes)}`);
      }
      for (const box of [core, ally]) if (box.x < 0 || box.y < 0 || box.x + box.width > 1024 || box.y + box.height > 600) throw new Error('Osaka finale Core or ally is outside the viewport');
    }
    await assertNoPageScroll(page, `Osaka finale wave ${wave}`);
    await page.screenshot({ path: path.join(evidenceDir, `osaka-city-finale-wave-${wave}.png`) });
  }

  // The dev jump starts an ordinary Adventure finale. Replay the deterministic
  // priority bot's decisions through actual controls to exercise the save flow.
  await page.keyboard.press('Control+Alt+Shift+KeyD');
  await page.locator('.dev-panel [title="Higashiosaka stage 1 battle"]').waitFor();
  await page.locator('.dev-panel [title="Osaka City stage 4 battle"]').waitFor();
  await page.evaluate(() => { Math.random = () => .99; });
  await page.locator('.dev-panel [title="Osaka City stage 4 battle"]').click();
  await page.getByText(/STAGE\s*4\s*CLEAR/i).waitFor();
  await page.getByRole('button', { name: /BATTLE!/i }).click();
  await page.locator('.station-card').waitFor();
  if (!(await page.locator('.station-card').innerText()).includes('大阪城公園')) throw new Error('The dev jump must reach the Osaka Castle finale');
  await page.getByRole('button', { name: /DEFEND!/i }).click();
  await page.locator('[data-enemy-id="shadowGuard"]').waitFor();
  const actions = await page.evaluate(async () => {
    globalThis.osakaTransformationSeen = false;
    globalThis.osakaBannerObserver = new MutationObserver(() => {
      if (document.querySelector('.battle-banner strong')?.textContent === 'しんの すがた！ TRUE FORM!') globalThis.osakaTransformationSeen = true;
    });
    // Observe the body: the battle view re-renders and replaces .battle-view between turns.
    globalThis.osakaBannerObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    const { createBattle, resolveEnemyPhase } = await import('/src/battle-engine.js');
    const { OSAKA_CITY_POLICIES, step } = await import('/test/balance-sim.js');
    const rng = () => .99;
    let state = createBattle({ heroId: 'fighter', encounterId: 'osk-4', level: 5, ap: 10, potions: 2, rng });
    const plan = [];
    for (let turn = 0; state.turn === 'player' && turn < 200; turn += 1) {
      const choice = OSAKA_CITY_POLICIES.priority(state);
      if (!choice.recover) plan.push({ ...choice, wave: state.wave, round: state.round, ap: state.ap });
      state = step(state, choice, rng).state;
      if (state.turn === 'enemy') state = resolveEnemyPhase(state, rng).state;
    }
    if (state.turn !== 'won') throw new Error('The deterministic Osaka browser plan did not win');
    return plan;
  });
  for (const action of actions) {
    await page.locator('.battle-skill:not(:disabled)').first().waitFor();
    const turn = (await page.locator('.battle-round').last().innerText()).trim();
    if (turn !== `TURN ${action.round}` || await apMeterValue(page) !== action.ap) throw new Error(`Osaka browser battle diverged at wave ${action.wave}, ${turn}, AP ${await apMeterValue(page)}; expected turn ${action.round}, AP ${action.ap}`);
    if (action.itemId) {
      await page.locator('[data-item-menu]:not(:disabled)').click();
      await page.locator(`[data-item-id="${action.itemId}"]:not(:disabled)`).click();
    } else {
      if (action.target != null) await page.locator(`[data-select-uid="${action.target}"]`).click();
      await page.locator(`[data-skill-id="${action.skillId}"]:not(:disabled)`).click();
    }
  }
  await page.locator('.victory-card--final').waitFor();
  if (!(await page.evaluate(() => {
    globalThis.osakaBannerObserver.disconnect();
    return globalThis.osakaTransformationSeen;
  }))) throw new Error('The finale did not display its transformation banner');
  const saved = await page.evaluate(() => ({
    region: JSON.parse(localStorage.getItem('esl-verbs-region-v1')),
    records: JSON.parse(localStorage.getItem('esl-verbs-adventure-records-v1')),
  }));
  if (JSON.stringify(saved.region.savedCities) !== JSON.stringify(['matsubara', 'sakai', 'yao', 'higashiosaka', 'osakaCity']) || saved.region.checkpoint !== null) throw new Error('The Osaka finale did not save all five cities');
  if (!saved.records?.heroes?.fighter?.fullCampaignCompleted) throw new Error('The Osaka finale did not record full campaign completion');
  await page.getByRole('button', { name: /^NEXT/i }).click();
  await page.locator('.story--osakaCity-ending').waitFor();
  await assertNoPageScroll(page, 'Osaka City ending');
  await page.getByRole('button', { name: /^Skip/i }).click();
  await page.locator('.city-results').waitFor();
  await assertNoPageScroll(page, 'Osaka City results');
  await page.getByRole('button', { name: /BACK TO OSAKA MAP/i }).click();
  await page.locator('.osaka-map__final').waitFor();
  if (await page.locator('.osaka-city--saved').count() !== 5) throw new Error('The final map must show five saved cities');
  if (!(await page.locator('.osaka-map__final').innerText()).includes('OSAKA IS SAFE!')) throw new Error('The final map must show the Osaka victory banner');
  await assertNoPageScroll(page, 'Osaka five cities saved');
  await page.screenshot({ path: path.join(evidenceDir, 'osaka-city-all-saved.png') });
  await page.getByRole('button', { name: /Main Menu/i }).click();
  await page.getByRole('button', { name: /CONTINUE ADVENTURE/i }).waitFor();
  await page.getByRole('button', { name: /START NEW ADVENTURE/i }).waitFor();
  await assertNoPageScroll(page, 'Completed campaign menu');
  await page.getByRole('button', { name: /CONTINUE ADVENTURE/i }).click();
  await page.locator('.osaka-city[data-city="osakaCity"]').click();
  await page.locator('.story--osakaCity-intro').waitFor();
  await page.getByRole('button', { name: /^Skip/i }).click();
  await page.locator('.rpg-quiz.stage-1').waitFor();
  if (!(await page.evaluate(() => JSON.parse(localStorage.getItem('esl-verbs-adventure-records-v1')).heroes.fighter.fullCampaignCompleted))) throw new Error('Replaying a saved city lost the full completion record');
}

async function targetDiscovery(page, baseUrl) {
  await page.goto(`${baseUrl}/?debug=battle`);
  await page.getByRole('button', { name: /START BATTLE/i }).waitFor();
  await page.locator('select').nth(1).selectOption('goblin-slime');
  await page.getByLabel(/^AP/i).first().fill('5');
  await page.getByRole('button', { name: /START BATTLE/i }).click();
  await page.locator('.battle-target-hint').waitFor();
  const selected = () => page.locator('.battle-enemy[aria-pressed="true"]').getAttribute('data-select-uid');
  const initial = await selected();
  const ap = await page.locator('.ap-meter').innerText();
  const turn = await page.locator('.battle-round').last().innerText();
  await page.keyboard.press('ArrowRight');
  if (await selected() === initial) throw new Error('ArrowRight did not select another enemy');
  const otherSprite = page.locator('.battle-enemy[aria-pressed="false"] .battle-sprite').first();
  await otherSprite.click();
  if (await selected() !== initial) throw new Error('Clicking the sprite did not select its enemy');
  if (await page.locator('.ap-meter').innerText() !== ap || await page.locator('.battle-round').last().innerText() !== turn) {
    throw new Error('Target selection spent AP or advanced the turn');
  }
  await page.locator('[data-sound-button]').first().click();
  await page.locator('[data-sound-popover]').waitFor();
  const beforeSound = await selected();
  await page.evaluate(() => window.dispatchEvent(new Event('resize')));
  if (await page.locator('[data-sound-popover]').count() !== 1 || await page.locator('[data-sound-button]').getAttribute('aria-expanded') !== 'true') {
    throw new Error('Battle re-render lost the open sound popover');
  }
  await page.locator('[data-sound-popover] input[type="range"]').first().focus();
  await page.keyboard.press('ArrowRight');
  if (await selected() !== beforeSound) throw new Error('Sound slider arrows changed the battle target');
  await page.keyboard.press('Escape');
  await page.locator('[data-sound-popover]').waitFor({ state: 'detached' });
  await page.keyboard.press('ArrowRight');
  if (await selected() === beforeSound) throw new Error('Battle keys did not resume after closing sound');

  // Exercise the introductory view option and an already defeated slot without
  // depending on damage rolls or event playback timings.
  await page.goto(baseUrl);
  await page.evaluate(async () => {
    const { createBattle } = await import('/src/battle-engine.js');
    const { createBattleView } = await import('/src/battle-ui.js');
    const state = createBattle({ heroId: 'fighter', encounterId: 'goblin-slime', ap: 5, rng: () => .99 });
    state.enemies.splice(1, 0, { ...state.enemies[0], uid: 999, hp: 0 });
    const host = document.createElement('div');
    host.id = 'target-hint-fixture';
    document.body.append(host);
    globalThis.targetHintFixture = createBattleView(host, { state, targetHint: 'intro' });
  });
  await page.locator('.battle-target-hint--intro').waitFor();
  await page.keyboard.press('ArrowRight');
  await page.locator('.battle-target-hint--quiet').waitFor();
  if (await page.locator('[data-select-uid="999"]').getAttribute('aria-pressed') !== 'false') throw new Error('A defeated enemy was selected');
  await page.keyboard.press('ArrowRight');
  if (await page.locator('[data-select-uid="999"]').getAttribute('aria-pressed') !== 'false') throw new Error('Target cycling did not skip the defeated slot');
  await page.evaluate(() => { globalThis.targetHintFixture.destroy(); document.querySelector('#target-hint-fixture').remove(); delete globalThis.targetHintFixture; });
}

async function soundSettings(page, baseUrl) {
  await page.goto(baseUrl);
  const button = page.locator('[data-sound-button]').first();
  await button.waitFor();
  await button.click();
  const popover = page.locator('[data-sound-popover]');
  await popover.waitFor();
  const sliders = popover.locator('input[type="range"]');
  await sliders.nth(0).fill('37');
  await sliders.nth(0).dispatchEvent('input');
  await sliders.nth(1).fill('21');
  await sliders.nth(1).dispatchEvent('input');
  await sliders.nth(1).dispatchEvent('change');
  const values = await popover.innerText();
  if (!values.includes('37%') || !values.includes('21%')) throw new Error('Sound percentages did not update live');
  await page.keyboard.press('Escape');
  await popover.waitFor({ state: 'detached' });
  if (await button.getAttribute('aria-expanded') !== 'false') throw new Error('Sound button stayed expanded');
  await page.reload();
  await page.locator('[data-sound-button]').first().click();
  const restored = page.locator('[data-sound-popover] input[type="range"]');
  if (await restored.nth(0).inputValue() !== '37' || await restored.nth(1).inputValue() !== '21') throw new Error('Independent sound preferences were not remembered');
  await page.keyboard.press('Escape');
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
  await mkdir(evidenceDir, { recursive: true });
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
  await yaoBattleFlow(page, baseUrl);
  await higashiosakaBattleFlow(page, baseUrl);
  await osakaCityFlow(page, baseUrl);
  await targetDiscovery(page, baseUrl);
  await soundSettings(page, baseUrl);
  await studyFlow(page, baseUrl);

  if (browserErrors.length) throw new Error(`Browser errors:\n${browserErrors.join('\n')}`);
  console.log('Browser playthrough passed: Adventure station defence, Osaka regional continuation/checkpoint, 0-AP recovery battle, Yao call telegraph/reinforcements and final boss, Higashiosaka unlock/checkpoint and Ishikiri/Core flow, guarded Siege Blast, Osaka City unlock/Tennoji, finale Core/ally layout, dev jump, ending/completion/five saved cities and menu/replay, target discovery, sound settings, and Study mode 1.');
} catch (error) {
  console.error(error?.stack || error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server.listening) await close(server);
}
