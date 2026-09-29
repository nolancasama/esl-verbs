// Adventure replay rewards: the hero title earned from a campaign's 40 answers,
// and each hero's best result kept in localStorage. Pure functions; app.js does
// the storage reads and writes. No combat power is ever stored here.

export const ADVENTURE_RECORDS_KEY = 'esl-verbs-adventure-records-v1';
export const FINAL_BOSSES = Object.freeze(['dragon', 'demonKing', 'giantGolem', 'vampireLord']);

/** Highest first. Every title is positive: the lowest still saved the city. */
export const HERO_TITLES = Object.freeze([
  Object.freeze({ min: 38, en: 'LEGEND OF MATSUBARA', ja: 'まつばらの でんせつ' }),
  Object.freeze({ min: 34, en: 'VERB MASTER', ja: 'どうしマスター' }),
  Object.freeze({ min: 28, en: 'ELITE DEFENDER', ja: 'エリートディフェンダー' }),
  Object.freeze({ min: 20, en: 'CITY GUARDIAN', ja: 'まちの ガーディアン' }),
  Object.freeze({ min: 0, en: 'BRAVE ADVENTURER', ja: 'ゆうかんな ぼうけんしゃ' }),
]);

export function heroTitle(totalCorrect) {
  return HERO_TITLES.find((title) => totalCorrect >= title.min) ?? HERO_TITLES.at(-1);
}

/** The next title up and how many more answers it needs, or null at the top. */
export function nextHeroTitle(totalCorrect) {
  const index = HERO_TITLES.indexOf(heroTitle(totalCorrect));
  if (index === 0) return null;
  const title = HERO_TITLES[index - 1];
  return { ...title, needed: title.min - totalCorrect };
}

const emptyHero = () => ({ completed: false, bestCorrect: 0, bestTitle: null });

/** Records from stored JSON; anything missing or corrupt becomes a fresh record. */
export function parseRecords(raw, heroIds) {
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
  const records = { heroes: {}, discoveredBosses: [] };
  for (const id of heroIds) {
    const entry = data.heroes?.[id];
    const best = Number.isFinite(entry?.bestCorrect) ? Math.max(0, Math.floor(entry.bestCorrect)) : 0;
    records.heroes[id] = entry?.completed === true ? { completed: true, bestCorrect: best, bestTitle: heroTitle(best).en } : emptyHero();
  }
  if (Array.isArray(data.discoveredBosses)) records.discoveredBosses = FINAL_BOSSES.filter((id) => data.discoveredBosses.includes(id));
  return records;
}

/** A finished campaign. Returns the new records and whether this was a new best. */
export function recordCompletion(records, heroId, totalCorrect, bossId) {
  const previous = records.heroes[heroId] ?? emptyHero();
  const improved = !previous.completed || totalCorrect > previous.bestCorrect;
  const hero = improved ? { completed: true, bestCorrect: totalCorrect, bestTitle: heroTitle(totalCorrect).en } : previous;
  const discoveredBosses = FINAL_BOSSES.includes(bossId) && !records.discoveredBosses.includes(bossId)
    ? FINAL_BOSSES.filter((id) => id === bossId || records.discoveredBosses.includes(id))
    : records.discoveredBosses;
  return {
    records: { heroes: { ...records.heroes, [heroId]: hero }, discoveredBosses },
    newBest: improved && previous.completed,
    firstClear: !previous.completed,
  };
}

export function completedHeroes(records) {
  return Object.keys(records.heroes).filter((id) => records.heroes[id].completed);
}
