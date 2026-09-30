// All combat, item and progression numbers are deliberately kept in this module.
export const BALANCE = Object.freeze({
  maxAp: 10,               // quiz score is starting AP, so 10 is the meter's capacity
  recoveryAp: 1,           // AP regained on an exhausted (0 AP) turn; the enemies still act
  retryApBonus: 1,         // retry assist unit: +1, +3, +6, +10 AP after 1-4 defeats
  exploitAp: 1,            // Mage: Magic Bolt on a charging or tired enemy
  defenseAp: 1,            // Guard or Barrier up when a big attack lands (Dodge avoids it instead)
  guardMultiplier: 0.4,
  barrierMultiplier: 0.25,
  enemyGuardMultiplier: 0.5,
  tiredMultiplier: 1.5,
  exhaustedMultiplier: 1, // damage the hero takes during a recovery turn
  dodgeRestMultiplier: 0.5,
  comboBonus: 4,
  counterBonus: 4,
  openingBonus: 3,
  maxChain: 3,             // Shadow Strike: follow-up streaks after each defeat
  maxLivingEnemies: 4,
});

// Campaign resources between battles.
export const CAMPAIGN = Object.freeze({
  startingPotions: 2,
  maxPotions: 2,
  potionsPerVictory: 1,
  victoryHealPercent: 0.28,
  minimumNextBattleHpPercent: 0.4,
  perfectQuizXp: 5,
});

export const ITEMS = Object.freeze({
  potion: { id: 'potion', name: 'Potion', jaName: 'ポーション', cost: 1, healPercent: 0.35 },
});

// Cumulative XP per level. Thresholds sit at the minimum XP a stage can give,
// so every hero reaches L2/L3/L4/L5 after battles 1/2/3/4 whatever the encounter.
export const LEVELS = Object.freeze([
  Object.freeze({ level: 1, xp: 0, maxHpBonus: 0, skillTier: 0 }),
  Object.freeze({ level: 2, xp: 8, maxHpBonus: 3, skillTier: 1 }),
  Object.freeze({ level: 3, xp: 30, maxHpBonus: 6, skillTier: 2 }),
  Object.freeze({ level: 4, xp: 70, maxHpBonus: 10, skillTier: 2 }),
  Object.freeze({ level: 5, xp: 140, maxHpBonus: 14, skillTier: 2 }),
]);

// `tip` (kana) explains an unlocked skill's twist on the victory screen that unlocks it.
export const SKILLS = Object.freeze({
  slash: { id: 'slash', name: 'Slash', jaName: 'スラッシュ', cost: 1, kind: 'damage', target: 'one', damage: 4, tier: 0 },
  guard: { id: 'guard', name: 'Guard', jaName: 'ガード', cost: 1, kind: 'defense', target: 'self', defense: 'guard', tier: 0 },
  powerSlash: { id: 'powerSlash', name: 'Power Slash', jaName: 'パワースラッシュ', cost: 2, kind: 'damage', target: 'one', damage: 10, tier: 1, tip: `スラッシュの つぎに つかうと COMBO で +${BALANCE.comboBonus}！` },
  cleave: { id: 'cleave', name: 'Cleave', jaName: 'なぎはらい', cost: 3, kind: 'damage', target: 'all', damage: 10, tier: 2, tip: 'てき ぜんいんに 10 ダメージ！' },
  magicBolt: { id: 'magicBolt', name: 'Magic Bolt', jaName: 'まほうだま', cost: 1, kind: 'damage', target: 'one', damage: 7, tier: 0 },
  barrier: { id: 'barrier', name: 'Barrier', jaName: 'バリア', cost: 1, kind: 'defense', target: 'self', defense: 'barrier', tier: 0 },
  heal: { id: 'heal', name: 'Heal', jaName: 'かいふく', cost: 2, kind: 'heal', target: 'self', amount: 12, tier: 1, tip: 'HP +12！ HP が はんぶんより すくないと バリアも！' },
  fireball: { id: 'fireball', name: 'Fireball', jaName: 'ファイアボール', cost: 3, kind: 'damage', target: 'all', damage: 10, tier: 2, tip: 'てき ぜんいんに 10 ダメージ！' },
  strike: { id: 'strike', name: 'Strike', jaName: 'うつ', cost: 1, kind: 'damage', target: 'one', damage: 4, tier: 0 },
  dodge: { id: 'dodge', name: 'Dodge', jaName: 'よける', cost: 1, kind: 'defense', target: 'self', defense: 'dodge', tier: 0 },
  doubleStrike: { id: 'doubleStrike', name: 'Double Strike', jaName: 'にれんだ', cost: 2, kind: 'doubleDamage', target: 'one', damage: 5, tier: 1, tip: `うつ で OPENING を つくり、にれんだで +${BALANCE.openingBonus}×2！` },
  shadowStrike: { id: 'shadowStrike', name: 'Shadow Strike', jaName: 'かげうち', cost: 3, kind: 'splitDamage', target: 'one', damage: 14, splashDamage: 9, tier: 2, tip: 'たおしたら つぎの てきにも 9 ダメージ！' },
});

export const HEROES = Object.freeze({
  fighter: {
    id: 'fighter', name: 'Fighter', jaName: 'せんし', summary: 'Strong and tough.', kanaSummary: 'わかりやすい！', maxHp: 32,
    skills: Object.freeze(['slash', 'guard', 'powerSlash', 'cleave']),
    passive: Object.freeze({ level: 4, name: 'Iron Guard', jaName: 'てっぺき', text: 'Guard blocks more!', kanaText: 'ガードが もっと つよい！', effect: Object.freeze({ guardMultiplier: 0.25 }) }),
  },
  mage: {
    id: 'mage', name: 'Mage', jaName: 'まほうつかい', summary: 'Magic and healing.', kanaSummary: 'まほうと かいふく', maxHp: 27,
    skills: Object.freeze(['magicBolt', 'barrier', 'heal', 'fireball']),
    passive: Object.freeze({ level: 4, name: 'Great Heal', jaName: 'だいかいふく', text: 'Heal +4 HP!', kanaText: 'かいふくが もっと つよい！', effect: Object.freeze({ healBonus: 4 }) }),
  },
  ninja: {
    id: 'ninja', name: 'Ninja', jaName: 'にんじゃ', summary: 'Fast and elusive.', kanaSummary: 'タイミングが だいじ！', maxHp: 28,
    skills: Object.freeze(['strike', 'dodge', 'doubleStrike', 'shadowStrike']),
    passive: Object.freeze({ level: 4, name: 'Keen Eye', jaName: 'みきり', text: 'OPENING hits harder!', kanaText: 'オープニングが もっと つよい！', effect: Object.freeze({ openingBonus: 2 }) }),
  },
});

export const ALLIES = Object.freeze({
  osakaDefender: Object.freeze({
    id: 'osakaDefender', name: 'Osaka Defender', jaName: '大阪の まもりびと',
    damage: 3, protectBelow: 0.3, protectMultiplier: 0.5,
  }),
});

// Heavy-attack cycles are odd lengths (e.g. attack, attack, charge, heavy, rest)
// so that a low-AP rest/act rhythm does not always meet the big attack the same way.
export const ENEMIES = Object.freeze({
  slime: { id: 'slime', name: 'Slime', jaName: 'スライム', maxHp: 8, attack: 2, xp: 10, ai: Object.freeze({}) },
  bat: { id: 'bat', name: 'Bat', jaName: 'コウモリ', maxHp: 6, attack: 2, xp: 8, ai: Object.freeze({}) },
  mushroom: { id: 'mushroom', name: 'Mushroom', jaName: 'キノコ', maxHp: 10, attack: 1, xp: 12, ai: Object.freeze({}) },
  goblin: { id: 'goblin', name: 'Goblin', jaName: 'ゴブリン', maxHp: 12, attack: 2, xp: 12, ai: Object.freeze({ guardChance: 0.25 }) },
  wolf: { id: 'wolf', name: 'Wolf', jaName: 'オオカミ', maxHp: 11, attack: 3, xp: 14, ai: Object.freeze({}) },
  skeleton: { id: 'skeleton', name: 'Skeleton', jaName: 'スケルトン', maxHp: 9, attack: 4, xp: 10, ai: Object.freeze({}) },
  shieldGoblin: { id: 'shieldGoblin', name: 'Shield Goblin', jaName: 'たてゴブリン', maxHp: 25, attack: 6, xp: 22, ai: Object.freeze({ guardChance: 0.5 }) },
  healer: { id: 'healer', name: 'Healer', jaName: 'ヒーラー', maxHp: 14, attack: 4, heal: 4, xp: 18, ai: Object.freeze({ support: 'heal' }) },
  golem: { id: 'golem', name: 'Golem', jaName: 'ゴーレム', maxHp: 48, attack: 7, heavy: 16, heavyName: 'Rock Smash', xp: 40, ai: Object.freeze({ heavyEvery: 2, rests: true }) },
  goblinCaptain: { id: 'goblinCaptain', name: 'Goblin Captain', jaName: 'ゴブリンたいちょう', maxHp: 32, attack: 6, heavy: 15, heavyName: 'Captain Slash', xp: 28, ai: Object.freeze({ heavyEvery: 3, guardChance: 0.2 }) },
  hordeCommander: { id: 'hordeCommander', name: 'Shadow Commander', jaName: 'シャドウたいちょう', maxHp: 34, attack: 4, heavy: 12, heavyName: 'Shadow Break', xp: 45, ai: Object.freeze({ heavyEvery: 3, guardChance: 0.2, phase2: Object.freeze({ at: 0.5, message: '⚔ SHADOW COMMANDER IS ANGRY!', heavyEvery: 2 }) }) },
  necromancer: { id: 'necromancer', name: 'Necromancer', jaName: 'ネクロマンサー', maxHp: 23, attack: 5, heal: 3, summonId: 'skeleton', xp: 20, ai: Object.freeze({ support: 'summon', maxSummons: 1 }) },
  dragon: { id: 'dragon', name: 'Dragon', jaName: 'ドラゴン', maxHp: 44, attack: 6, heavy: 17, heavyName: 'Fire Breath', boss: true, xp: 70, ai: Object.freeze({ heavyEvery: 2, rests: true, phase2: Object.freeze({ at: 0.6, message: '🔥 DRAGON IS ANGRY!', heavyEvery: 1, rests: false }) }) },
  demonKing: { id: 'demonKing', name: 'Demon King', jaName: 'まおう', maxHp: 38, attack: 4, heavy: 15, heavyName: 'Dark Blast', summonId: 'bat', boss: true, xp: 70, ai: Object.freeze({ heavyEvery: 3, guardChance: 0.2, support: 'summon', maxSummons: 1, phase2: Object.freeze({ at: 0.6, message: '😈 DEMON KING IS ANGRY!', heavyEvery: 1, maxSummons: 2 }) }) },
  giantGolem: { id: 'giantGolem', name: 'Giant Golem', jaName: 'きょだいゴーレム', maxHp: 42, attack: 6, heavy: 18, heavyName: 'Earthquake', boss: true, xp: 70, ai: Object.freeze({ heavyEvery: 2, rests: true, phase2: Object.freeze({ at: 0.6, message: '💢 GIANT GOLEM IS ANGRY!', heavyEvery: 1, rests: false }) }) },
  vampireLord: { id: 'vampireLord', name: 'Vampire Lord', jaName: 'きゅうけつきおう', maxHp: 42, attack: 5, heavy: 14, heavyName: 'Blood Moon', drainHeal: 2, boss: true, xp: 70, ai: Object.freeze({ heavyEvery: 3, drainChance: 0.5, phase2: Object.freeze({ at: 0.6, message: '🩸 VAMPIRE LORD IS ANGRY!', heavyEvery: 1, normal: 'drain' }) }) },
});

export const ENCOUNTERS = Object.freeze({
  slime: { id: 'slime', tier: 1, enemyIds: Object.freeze(['slime']) },
  bat: { id: 'bat', tier: 1, enemyIds: Object.freeze(['bat', 'bat']) },
  mushroom: { id: 'mushroom', tier: 1, enemyIds: Object.freeze(['mushroom']) },
  'goblin-slime': { id: 'goblin-slime', tier: 2, enemyIds: Object.freeze(['goblin', 'slime']) },
  'bat-bat-mushroom': { id: 'bat-bat-mushroom', tier: 2, enemyIds: Object.freeze(['bat', 'bat', 'mushroom']) },
  'wolf-slime': { id: 'wolf-slime', tier: 2, enemyIds: Object.freeze(['wolf', 'slime']) },
  'goblin-goblin': { id: 'goblin-goblin', tier: 2, enemyIds: Object.freeze(['goblin', 'goblin']) },
  golem: { id: 'golem', tier: 3, enemyIds: Object.freeze(['golem']) },
  'captain-goblins': { id: 'captain-goblins', tier: 3, enemyIds: Object.freeze(['goblinCaptain', 'goblin']) },
  'necromancer-skeletons': { id: 'necromancer-skeletons', tier: 3, enemyIds: Object.freeze(['necromancer', 'skeleton', 'skeleton']) },
  'shield-goblin-healer': { id: 'shield-goblin-healer', tier: 3, enemyIds: Object.freeze(['shieldGoblin', 'healer']) },
  dragon: { id: 'dragon', tier: 4, enemyIds: Object.freeze(['dragon']) },
  'demon-king': { id: 'demon-king', tier: 4, enemyIds: Object.freeze(['demonKing']) },
  'giant-golem': { id: 'giant-golem', tier: 4, enemyIds: Object.freeze(['giantGolem']) },
  'vampire-lord': { id: 'vampire-lord', tier: 4, enemyIds: Object.freeze(['vampireLord']) },
  'sakai-1': Object.freeze({
    id: 'sakai-1', city: 'sakai', stage: 1,
    name: 'First Assault', jaName: 'さいしょの こうげき', music: 'battle',
    enemyIds: Object.freeze(['goblin', 'wolf', 'goblin', 'wolf']),
    waves: Object.freeze([
      Object.freeze({ enemyIds: Object.freeze(['goblin', 'wolf', 'goblin', 'wolf']) }),
    ]),
    ally: null, reserve: 0,
  }),
  'sakai-2': Object.freeze({
    id: 'sakai-2', city: 'sakai', stage: 2,
    name: 'Horde Battle', jaName: 'ホードの なみ', music: 'battle',
    enemyIds: Object.freeze(['slime', 'goblin', 'bat']),
    waves: Object.freeze([
      Object.freeze({ enemyIds: Object.freeze(['slime', 'goblin', 'bat']) }),
      Object.freeze({ enemyIds: Object.freeze(['goblin', 'wolf', 'bat']) }),
    ]),
    ally: null, reserve: 3,
  }),
  'sakai-3': Object.freeze({
    id: 'sakai-3', city: 'sakai', stage: 3,
    name: 'Defenders Overwhelmed', jaName: 'まもりびとの ピンチ', music: 'battle',
    enemyIds: Object.freeze(['goblin', 'wolf', 'goblin', 'bat']),
    waves: Object.freeze([
      Object.freeze({ enemyIds: Object.freeze(['goblin', 'wolf', 'goblin', 'bat']) }),
      Object.freeze({ enemyIds: Object.freeze(['shieldGoblin', 'healer']) }),
    ]),
    ally: Object.freeze({ id: 'osakaDefender', joinsAtWave: 2 }), reserve: 2,
  }),
  'sakai-4': Object.freeze({
    id: 'sakai-4', city: 'sakai', stage: 4,
    name: 'Final Sakai Defense', jaName: 'さかい さいごの たたかい', music: 'boss',
    enemyIds: Object.freeze(['goblin', 'wolf', 'bat']),
    waves: Object.freeze([
      Object.freeze({ enemyIds: Object.freeze(['goblin', 'wolf', 'bat']) }),
      Object.freeze({ enemyIds: Object.freeze(['shieldGoblin', 'healer']) }),
      Object.freeze({ enemyIds: Object.freeze(['hordeCommander']) }),
    ]),
    ally: Object.freeze({ id: 'osakaDefender', joinsAtWave: 1 }), reserve: 3,
  }),
});
