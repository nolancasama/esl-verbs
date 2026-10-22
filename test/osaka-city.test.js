import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE, ENCOUNTERS, ENEMIES, HEROES, SKILLS } from '../src/battle-data.js';
import { battleXp, chooseEnemyIntent, createBattle, protectedUid, resolveEnemyPhase, useSkill } from '../src/battle-engine.js';
import { eventMessage } from '../src/battle-ui.js';
import { battleSetup, createCampaign, recordDefeat, recordStage, resumeCampaign } from '../src/campaign.js';
import { cityPlayable } from '../src/osaka-map.js';
import { ADVENTURE_RECORDS_KEY, parseRecords, recordCompletion } from '../src/records.js';
import { CITIES, CITY_CAMPAIGNS, cityStatus, markCitySaved, parseRegion, serializeRegion, stageCheckpoint, stageCount, stageEncounterId, stageMode } from '../src/region.js';
import { CITY_STORIES } from '../src/story.js';

const rng = () => .99;
const heroIds = Object.keys(HEROES);
const priorCities = ['matsubara', 'sakai', 'yao', 'higashiosaka'];
const entryRegion = () => ({ heroId: 'fighter', level: 5, xp: 900, savedCities: [...priorCities], checkpoint: null });
const battle = (id = 'osk-4', options = {}) => createBattle({ heroId: 'mage', encounterId: id, level: 5, ap: 10, rng, ...options });
const patch = (state, uid, changes) => ({ ...state, enemies: state.enemies.map((enemy) => enemy.uid === uid ? { ...enemy, ...changes } : enemy) });
const damage = (events, target) => events.filter((event) => event.type === 'damage' && event.target === target).reduce((sum, event) => sum + event.amount, 0);
// Clear the actual wave through a player action, isolating arrival rules from combat balance.
const clearWave = (state) => useSkill({
  ...state, turn: 'player', ap: 5,
  enemies: state.enemies.map((enemy) => ({ ...enemy, hp: 1, guarding: false, tired: false })),
}, 'fireball', state.selectedUid, rng);

test('Osaka City unlocks after Higashiosaka in old saves and maps quiz modes to all four battles', () => {
  const before = { ...entryRegion(), savedCities: priorCities.slice(0, -1) };
  assert.equal(cityStatus(before, 'osakaCity'), 'locked');
  assert.equal(cityPlayable(before, 'osakaCity'), false);
  const region = parseRegion(JSON.stringify(entryRegion()), heroIds);
  assert.deepEqual(region, entryRegion());
  assert.equal(cityStatus(region, 'osakaCity'), 'danger');
  assert.equal(cityPlayable(region, 'osakaCity'), true);
  assert.deepEqual(CITIES.higashiosaka.unlocks, ['osakaCity']);
  assert.deepEqual(CITIES.osakaCity.requires, ['higashiosaka']);
  assert.equal(CITIES.osakaCity.campaignId, 'osakaCity');
  assert.equal(CITY_CAMPAIGNS.osakaCity.cityId, 'osakaCity');
  assert.equal(stageCount('osakaCity'), 4);
  for (let stage = 1; stage <= 4; stage += 1) {
    assert.equal(stageMode({ cityId: 'osakaCity', stage }), stage);
    assert.equal(stageEncounterId({ cityId: 'osakaCity', stage }), `osk-${stage}`);
    const encounter = ENCOUNTERS[`osk-${stage}`];
    assert.equal(encounter.city, 'osakaCity');
    assert.equal(encounter.stage, stage);
    assert.deepEqual(encounter.enemyIds, encounter.waves[0].enemyIds);
    assert.equal(encounter.music, stage < 3 ? 'battle' : 'boss');
    for (const wave of encounter.waves) {
      assert.ok(wave.enemyIds.length <= BALANCE.maxLivingEnemies);
      assert.ok(wave.enemyIds.every((id) => ENEMIES[id]));
      assert.ok(Number.isInteger(wave.callBudget ?? 3) && (wave.callBudget ?? 3) >= 0);
    }
  }
  assert.equal(ENCOUNTERS['osk-1'].waves.length, 3);
  assert.equal(ENCOUNTERS['osk-2'].waves.length, 2);
  assert.equal(ENCOUNTERS['osk-3'].waves.length, 2);
  assert.equal(ENCOUNTERS['osk-4'].waves.length, 3);
  assert.equal(battle('osk-1').core, null);
  assert.equal(battle('osk-3').core, null);
  assert.ok(battle('osk-2').core.hp > 0);
  assert.deepEqual(ENCOUNTERS['osk-4'].waves[2].enemyIds, ['blackStarTrue']);
});

test('the Osaka Defender arrives only at osk-3 wave 2 and osk-4 wave 3, including debug starts', () => {
  for (const [id, joiningWave] of [['osk-3', 2], ['osk-4', 3]]) {
    assert.deepEqual(ENCOUNTERS[id].ally, { id: 'osakaDefender', joinsAtWave: joiningWave });
    let state = battle(id);
    assert.equal(state.ally, null);
    for (let wave = 2; wave <= joiningWave; wave += 1) {
      const result = clearWave(state);
      state = result.state;
      assert.equal(state.wave, wave);
      assert.deepEqual(state.ally, wave === joiningWave ? { id: 'osakaDefender' } : null);
      assert.equal(result.events.filter((event) => event.type === 'allyJoin').length, wave === joiningWave ? 1 : 0);
      assert.deepEqual(battle(id, { startWave: wave }).ally, state.ally);
    }
  }
});

test('the finale keeps Core HP across its three phases, charges wave clears and transforms with the exact banner', () => {
  const initial = battle();
  const maxHp = ENCOUNTERS['osk-4'].core.hp;
  const hp = Math.ceil(maxHp * .7);
  let state = { ...initial, core: { hp, maxHp } };
  for (const wave of [2, 3]) {
    const result = clearWave(state);
    state = result.state;
    assert.equal(state.wave, wave);
    assert.deepEqual(state.core, { hp, maxHp });
    assert.ok(result.events.some((event) => event.type === 'ap' && event.reason === 'wave' && event.amount === 2));
    const arrival = result.events.find((event) => event.type === 'waveStart');
    if (wave === 3) {
      assert.equal(ENCOUNTERS['osk-4'].waves[2].banner, 'しんの すがた！ TRUE FORM!');
      assert.equal(arrival.banner, 'しんの すがた！ TRUE FORM!');
      assert.equal(eventMessage(arrival), 'しんの すがた！ TRUE FORM!');
    } else assert.equal(eventMessage(arrival), 'WAVE 2! まだ くる！');
  }
  assert.deepEqual(initial.core, { hp: maxHp, maxHp }, 'wave transitions leave their input untouched');
});

test('a defeated Osaka finale retries from wave 1 with a full Core and existing assistance', () => {
  const campaign = recordStage(createCampaign('mage', { cityId: 'osakaCity', level: 5, xp: 900 }), {
    mode: 4, items: Array(10).fill({}), correctCount: 7, bestStreak: 7, missedIds: new Set(),
  }, 'osk-4');
  const initial = createBattle({ ...battleSetup(campaign), rng });
  const damaged = { ...initial, wave: 3, core: { ...initial.core, hp: 1 } };
  const retry = createBattle({ ...battleSetup(recordDefeat(campaign)), rng });
  assert.equal(damaged.core.hp, 1);
  assert.equal(retry.wave, 1);
  assert.deepEqual(retry.core, initial.core);
  assert.equal(retry.ally, null);
  assert.equal(retry.ap, initial.ap + BALANCE.retryApBonus);
  assert.ok(!Object.hasOwn(battleSetup(campaign), 'core'));
});

test('Shadow Guard protects the caller and protection ends when the guard falls', () => {
  const state = battle();
  const guard = state.enemies.find((enemy) => enemy.id === 'shadowGuard');
  const caller = state.enemies.find((enemy) => ENEMIES[enemy.id].ai.support === 'call');
  assert.equal(ENEMIES.shadowGuard.name, 'Shadow Guard');
  assert.equal(ENEMIES.shadowGuard.jaName, 'シャドウガード');
  assert.equal(ENEMIES.shadowGuard.protector, true);
  assert.equal(ENEMIES.shadowGuard.protects, 'callers');
  assert.equal(protectedUid(state, guard.uid), caller.uid);
  const hit = useSkill(state, 'magicBolt', caller.uid, rng);
  assert.equal(damage(hit.events, caller.uid), Math.ceil(SKILLS.magicBolt.damage / 2));
  assert.ok(hit.events.some((event) => event.type === 'protected' && event.by === guard.uid));
  const unguarded = patch(state, guard.uid, { hp: 0 });
  assert.equal(protectedUid(unguarded, guard.uid), null);
  assert.equal(damage(useSkill(unguarded, 'magicBolt', caller.uid, rng).events, caller.uid), SKILLS.magicBolt.damage);
});

test('Black Star Avatar enrages once, changes call line-up and telegraphs Star Fall at the Core', () => {
  let state = battle('osk-4', { startWave: 2 });
  const avatar = state.enemies.find((enemy) => enemy.id === 'blackStarAvatar');
  const data = ENEMIES.blackStarAvatar;
  assert.deepEqual([data.name, data.jaName], ['Black Star', 'ブラックスター']);
  assert.equal(data.boss, true);
  assert.equal(data.ai.support, 'call');
  assert.deepEqual(data.ai.callIds, ['goblin']);
  assert.equal(data.ai.callEvery, 3);
  assert.equal(data.heavyAim, 'core');
  assert.equal(data.heavyName, 'Star Fall');
  assert.equal(data.ai.phase2.at, .5);
  assert.deepEqual(data.ai.phase2.callIds, ['wolf', 'bat']);
  assert.equal(data.ai.phase2.heavyEvery, 2);
  state = patch(state, avatar.uid, { hp: Math.floor(avatar.maxHp / 2) + 1 });
  const result = useSkill(state, 'magicBolt', avatar.uid, rng);
  const angry = result.state.enemies.find((enemy) => enemy.uid === avatar.uid);
  assert.equal(angry.phase, 2);
  assert.equal(result.events.filter((event) => event.type === 'enrage').length, 1);
  assert.equal(chooseEnemyIntent(result.state, { ...angry, intent: 'attack', cadence: 2 }, rng), 'charge');
  const charge = resolveEnemyPhase({ ...patch(result.state, avatar.uid, { intent: 'attack', cadence: 2 }), turn: 'enemy' }, rng);
  const charging = charge.state.enemies.find((enemy) => enemy.uid === avatar.uid);
  assert.deepEqual([charging.intent, charging.aim], ['charge', 'core']);
  assert.equal(chooseEnemyIntent(charge.state, { ...charging, intent: 'heavy', charging: false }, rng), 'rest');
  const called = resolveEnemyPhase({ ...patch(result.state, avatar.uid, { intent: 'call', callWait: 0 }), turn: 'enemy' }, rng);
  const call = called.events.find((event) => event.type === 'call' && event.source === avatar.uid);
  assert.ok(call.targets.length > 0);
  assert.ok(called.state.enemies.filter((enemy) => call.targets.includes(enemy.uid)).every((enemy) => ['wolf', 'bat'].includes(enemy.id)));
  assert.ok(!useSkill({ ...result.state, turn: 'player' }, 'magicBolt', avatar.uid, rng).events.some((event) => event.type === 'enrage'));
});

test('Black Star True Form fades once and alternates telegraphed hero heavies with rests', () => {
  let state = battle('osk-4', { startWave: 3 });
  const boss = state.enemies[0];
  const data = ENEMIES.blackStarTrue;
  assert.deepEqual([data.name, data.jaName], ['Black Star — True Form', 'ブラックスター しんの すがた']);
  assert.equal(data.boss, true);
  assert.equal(data.heavyName, 'Black Nova');
  assert.equal(data.ai.heavyEvery, 2);
  assert.equal(data.ai.rests, false);
  assert.equal(data.ai.phase2.at, .5);
  assert.equal(data.ai.phase2.heavyEvery, 1);
  assert.equal(data.ai.phase2.rests, true);
  assert.equal(data.ai.phase2.message, '★ THE BLACK STAR IS FADING!');
  state = patch(state, boss.uid, { hp: Math.floor(boss.maxHp / 2) + 1 });
  const hit = useSkill(state, 'magicBolt', boss.uid, rng);
  const faded = hit.state.enemies[0];
  assert.equal(faded.phase, 2);
  assert.deepEqual(hit.events.filter((event) => event.type === 'enrage'), [{ type: 'enrage', target: boss.uid, message: data.ai.phase2.message }]);
  assert.equal(chooseEnemyIntent(hit.state, { ...faded, intent: 'attack', cadence: 1 }, rng), 'charge');
  assert.equal(chooseEnemyIntent(hit.state, { ...faded, intent: 'heavy' }, rng), 'rest');
  const charge = resolveEnemyPhase({ ...patch(hit.state, boss.uid, { intent: 'attack', cadence: 1 }), turn: 'enemy' }, rng);
  assert.deepEqual([charge.state.enemies[0].intent, charge.state.enemies[0].aim], ['charge', 'hero']);
  assert.ok(!useSkill({ ...hit.state, turn: 'player' }, 'magicBolt', boss.uid, rng).events.some((event) => event.type === 'enrage'));
});

test('the separate Black Star forms each award their boss XP once across the finale', () => {
  let state = battle();
  state = clearWave(state).state;
  state = clearWave(state).state;
  state = clearWave(state).state;
  assert.equal(state.turn, 'won');
  const expected = ENCOUNTERS['osk-4'].waves.flatMap((wave) => wave.enemyIds).reduce((sum, id) => sum + ENEMIES[id].xp, 0);
  assert.equal(battleXp(state), expected);
  assert.ok(ENEMIES.blackStarAvatar.xp > 0 && ENEMIES.blackStarTrue.xp > 0);
});

test('Osaka checkpoints round-trip every stage and victory leaves all five cities saved and replayable', () => {
  for (let stage = 1; stage <= 4; stage += 1) {
    const campaign = {
      ...createCampaign('fighter', { cityId: 'osakaCity', level: 5, xp: 900 }), stage, heroHp: 23, potions: 1,
      stageResults: Array.from({ length: stage - 1 }, (_, index) => ({ mode: index + 1, correct: 8, total: 10, bestStreak: 5, missedIds: ['jump'], startingAp: 8, perfect: false, encounterId: `osk-${index + 1}` })),
    };
    const checkpoint = stageCheckpoint(entryRegion(), campaign);
    const region = parseRegion(serializeRegion(checkpoint), heroIds);
    assert.deepEqual(region, checkpoint);
    assert.deepEqual(resumeCampaign(region), campaign);
    assert.deepEqual(region.savedCities, priorCities);
    assert.equal(cityStatus(region, 'osakaCity'), 'danger');
    const saved = markCitySaved(region, 'osakaCity', campaign);
    assert.equal(saved.checkpoint, null);
    assert.deepEqual(saved.savedCities, Object.keys(CITIES));
    for (const cityId of Object.keys(CITIES)) assert.equal(cityStatus(saved, cityId), 'saved');
    for (const cityId of ['sakai', 'yao', 'higashiosaka', 'osakaCity']) assert.equal(cityPlayable(saved, cityId), true);
    assert.deepEqual(parseRegion(serializeRegion(saved), heroIds), saved);
  }
});

test('the final city records full completion in the existing records key without lowering a Matsubara best', () => {
  assert.equal(ADVENTURE_RECORDS_KEY, 'esl-verbs-adventure-records-v1');
  const old = recordCompletion(parseRecords(null, heroIds), 'fighter', 39, 'dragon').records;
  assert.equal(old.heroes.fighter.fullCampaignCompleted, undefined);
  const final = recordCompletion(old, 'fighter', 28, 'blackStarTrue', { fullCampaign: true }).records;
  assert.equal(final.heroes.fighter.completed, true);
  assert.equal(final.heroes.fighter.fullCampaignCompleted, true);
  assert.equal(final.heroes.fighter.bestCorrect, 39);
  assert.deepEqual(parseRecords(JSON.stringify(final), heroIds), final);
  const replay = recordCompletion(final, 'fighter', 40, 'demonKing').records;
  assert.equal(replay.heroes.fighter.fullCampaignCompleted, true);
  assert.equal(replay.heroes.fighter.bestCorrect, 40);
  assert.deepEqual(parseRecords(JSON.stringify(old), heroIds), old, 'old records still parse');
  assert.equal(recordCompletion(parseRecords(null, heroIds), 'mage', 31, 'blackStarTrue', { fullCampaign: true }).records.heroes.mage.fullCampaignCompleted, true);
});

test('Osaka story uses the exact O0 split cards and existing finale music', () => {
  const { intro, ending } = CITY_STORIES.osakaCity;
  assert.deepEqual(intro.map((beat) => beat.card.lines), [
    ['{大阪|おおさか}{市|し}に ホードの {大|だい}ぐん！'],
    ['ブラックスターが あらわれた！'],
    ['いままでの ちからを', 'ぜんぶ つかおう！'],
  ]);
  assert.equal(intro[0].card.en, 'THE INVASION!');
  assert.deepEqual([intro[0].mood, intro[0].music, intro[0].sfx], ['danger', 'ominous', 'alarm']);
  assert.equal(intro[2].hero, 'idle');
  const title = ending.find((beat) => beat.title);
  assert.deepEqual(title.title, { ja: 'おおさかを まもった！', en: 'OSAKA IS SAFE!' });
  assert.equal(title.music, 'finale');
  const cards = ending.filter((beat) => beat.card);
  assert.deepEqual(cards.map((beat) => beat.card.lines), [
    ['大阪の まもりびと：', '「やったな！」'],
    ['ブラックスターの やみは きえた。'],
    ['まつばら、さかい、やお、', 'ひがしおおさか…', 'みんなの まちが ひかっている。'],
    ['きみは おおさかの ヒーローだ！'],
  ]);
  assert.ok(cards[0].ally && cards[0].ally !== 'gone');
  assert.equal(cards.at(-1).card.en, "YOU ARE OSAKA'S HERO!");
});
