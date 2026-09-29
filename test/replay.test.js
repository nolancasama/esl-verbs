import test from 'node:test';
import assert from 'node:assert/strict';
import { VOCAB_BY_ID } from '../src/vocab.js';
import { isJapaneseCorrect } from '../src/normalize.js';
import { answer, choiceFallback, viewModel } from '../src/engine.js';
import { createCampaign, recordStage } from '../src/campaign.js';
import { FINAL_BOSSES, HERO_TITLES, completedHeroes, heroTitle, nextHeroTitle, parseRecords, recordCompletion } from '../src/records.js';
import { ENCOUNTERS, ENEMIES } from '../src/battle-data.js';
import { SPRITE_STATES, eventSpriteStates } from '../src/battle-art.js';

const HEROES = ['fighter', 'mage', 'ninja'];

test('catch and feed accept the classroom Japanese answers, exactly', () => {
  for (const typed of ['つかむ', '掴む', 'うけとめる', '受け止める', 'tsukamu']) assert.ok(isJapaneseCorrect(typed, VOCAB_BY_ID.catch.jaAccepted), `catch: ${typed}`);
  for (const typed of ['えさをあたえる', '餌を与える', 'エサを与える', '食べさせる', 'たべさせる']) assert.ok(isJapaneseCorrect(typed, VOCAB_BY_ID.feed.jaAccepted), `feed: ${typed}`);
  // still exact: no substring or fuzzy acceptance
  for (const typed of ['つか', 'つかむこと', 'たべる']) assert.equal(isJapaneseCorrect(typed, VOCAB_BY_ID.catch.jaAccepted), false, `catch rejects ${typed}`);
  assert.equal(isJapaneseCorrect('たべる', VOCAB_BY_ID.feed.jaAccepted), false, 'feed is not eat');
});

test('hero titles follow the 40-answer thresholds and are all positive', () => {
  const expect = { 0: 'BRAVE ADVENTURER', 19: 'BRAVE ADVENTURER', 20: 'CITY GUARDIAN', 27: 'CITY GUARDIAN', 28: 'ELITE DEFENDER', 33: 'ELITE DEFENDER', 34: 'VERB MASTER', 37: 'VERB MASTER', 38: 'LEGEND OF MATSUBARA', 40: 'LEGEND OF MATSUBARA' };
  for (const [score, en] of Object.entries(expect)) assert.equal(heroTitle(Number(score)).en, en, `${score}/40`);
  for (const title of HERO_TITLES) assert.doesNotMatch(title.en, /BEGINNER|POOR|FAIL|WEAK/);
});

test('the next title names the next rank and how many answers it needs; the top has none', () => {
  assert.deepEqual({ ...nextHeroTitle(33) }, { min: 34, en: 'VERB MASTER', ja: 'どうしマスター', needed: 1 });
  assert.equal(nextHeroTitle(0).en, 'CITY GUARDIAN');
  assert.equal(nextHeroTitle(0).needed, 20);
  assert.equal(nextHeroTitle(38), null);
  assert.equal(nextHeroTitle(40), null);
});

test('records keep each hero best separately and never lower a best', () => {
  let records = parseRecords(null, HEROES);
  assert.deepEqual(completedHeroes(records), []);
  let step = recordCompletion(records, 'fighter', 33, 'dragon');
  assert.equal(step.firstClear, true);
  records = step.records;
  assert.deepEqual(records.heroes.fighter, { completed: true, bestCorrect: 33, bestTitle: 'ELITE DEFENDER' });
  assert.equal(records.heroes.mage.completed, false);

  step = recordCompletion(records, 'fighter', 25, 'dragon');
  assert.equal(step.newBest, false);
  assert.equal(step.records.heroes.fighter.bestCorrect, 33, 'a lower score does not overwrite');

  step = recordCompletion(step.records, 'fighter', 36, 'vampireLord');
  assert.equal(step.newBest, true);
  assert.deepEqual(step.records.heroes.fighter, { completed: true, bestCorrect: 36, bestTitle: 'VERB MASTER' });
  assert.deepEqual(step.records.discoveredBosses, ['dragon', 'vampireLord']);

  step = recordCompletion(step.records, 'ninja', 12, 'dragon');
  assert.equal(step.records.heroes.ninja.bestCorrect, 12);
  assert.equal(step.records.heroes.fighter.bestCorrect, 36, 'other heroes untouched');
  assert.deepEqual(completedHeroes(step.records), ['fighter', 'ninja']);
  assert.deepEqual(step.records.discoveredBosses, ['dragon', 'vampireLord'], 'bosses are not duplicated');

  // a round trip through JSON keeps everything
  assert.deepEqual(parseRecords(JSON.stringify(step.records), HEROES), step.records);
});

test('corrupt or foreign stored records fail safe to a fresh record', () => {
  const fresh = parseRecords(null, HEROES);
  for (const raw of ['{not json', '[]', '42', 'null', JSON.stringify({ heroes: { fighter: { completed: 'yes', bestCorrect: 'lots' } }, discoveredBosses: ['slime', 7] })]) {
    assert.deepEqual(parseRecords(raw, HEROES), fresh, raw);
  }
  // a stored title is recomputed from the score, never trusted
  const tampered = parseRecords(JSON.stringify({ heroes: { mage: { completed: true, bestCorrect: 21, bestTitle: 'KING' } } }), HEROES);
  assert.equal(tampered.heroes.mage.bestTitle, 'CITY GUARDIAN');
});

test('every final-boss encounter id is a known boss for discovery', () => {
  const bosses = new Set(Object.values(ENCOUNTERS).filter((e) => e.tier === 4).flatMap((e) => e.enemyIds.filter((id) => ENEMIES[id].boss)));
  assert.deepEqual([...bosses].sort(), [...FINAL_BOSSES].sort());
});

test('mic policy: Study honours マイクなし, Adventure speaks unless speech technically fails', () => {
  const speech = (options) => viewModel(3, VOCAB_BY_ID.catch, { micFree: choiceFallback(options) }).input;
  assert.equal(speech({ context: 'study', micFree: true }), 'choices');
  assert.equal(speech({ context: 'study', micFree: false }), 'enSpeech');
  for (const mode of [3, 4]) {
    assert.equal(viewModel(mode, VOCAB_BY_ID.catch, { micFree: choiceFallback({ context: 'adventure', micFree: true }) }).input, 'enSpeech', `adventure mode ${mode} ignores the Study preference`);
  }
  assert.equal(speech({ context: 'adventure', speechAvailable: false }), 'choices');
  assert.equal(speech({ context: 'adventure', speechDenied: true }), 'choices');
  assert.equal(speech({ context: 'adventure', speechFailed: true }), 'choices');
  assert.equal(speech({ context: 'study', speechAvailable: false }), 'choices');
});

test('a wrong quiz answer never touches campaign HP', () => {
  const campaign = createCampaign('fighter');
  let round = { mode: 1, items: Array.from({ length: 10 }, (_, i) => ({ id: `w${i}` })), currentIndex: 0, correctCount: 0, currentStreak: 0, bestStreak: 0, missedIds: new Set() };
  for (let i = 0; i < 10; i += 1) round = answer({ ...round, currentIndex: i }, false);
  assert.equal('heroHp' in round, false);
  const next = recordStage(campaign, round, 'slimes');
  assert.equal(next.heroHp, campaign.heroHp);
  assert.equal(next.stageResults[0].startingAp, 0, 'the consequence is AP only');
});

test('the quiz stumble is a sprite state that no battle event uses', () => {
  assert.ok(SPRITE_STATES.includes('stumble'));
  const events = ['attack', 'damage', 'heal', 'item', 'recover', 'defend', 'guard', 'charge', 'rest', 'summon', 'counter', 'break', 'barrierUp', 'enrage', 'defeat', 'victory', 'lost'];
  for (const type of events) for (const [, state] of eventSpriteStates({ type, target: 'hero', amount: 3, defense: 'guard' })) assert.notEqual(state, 'stumble', type);
});
