// All combat numbers are deliberately kept in this module.
export const BALANCE = Object.freeze({
  basePower: 2,
  retryBonusPower: 2,
  guardMultiplier: 0.4,
  barrierMultiplier: 0.5,
  enemyGuardMultiplier: 0.5,
  tiredMultiplier: 1.5,
  dodgeRestMultiplier: 0.5,
  comboBonus: 4,
  counterBonus: 4,
  openingBonus: 3,
  skillTierByStage: Object.freeze([0, 1, 2, 2]),
  maxLivingEnemies: 4,
});

export const SKILLS = Object.freeze({
  slash: { id: 'slash', name: 'Slash', jaName: 'スラッシュ', cost: 0, kind: 'damage', target: 'one', damage: 4, tier: 0 },
  guard: { id: 'guard', name: 'Guard', jaName: 'ガード', cost: 0, kind: 'defense', target: 'self', defense: 'guard', tier: 0 },
  powerSlash: { id: 'powerSlash', name: 'Power Slash', jaName: 'パワースラッシュ', cost: 2, kind: 'damage', target: 'one', damage: 10, tier: 1 },
  cleave: { id: 'cleave', name: 'Cleave', jaName: 'なぎはらい', cost: 3, kind: 'damage', target: 'all', damage: 6, tier: 2 },
  magicBolt: { id: 'magicBolt', name: 'Magic Bolt', jaName: 'まほうだま', cost: 0, kind: 'damage', target: 'one', damage: 5, tier: 0 },
  barrier: { id: 'barrier', name: 'Barrier', jaName: 'バリア', cost: 0, kind: 'defense', target: 'self', defense: 'barrier', tier: 0 },
  heal: { id: 'heal', name: 'Heal', jaName: 'かいふく', cost: 2, kind: 'heal', target: 'self', amount: 12, tier: 1 },
  fireball: { id: 'fireball', name: 'Fireball', jaName: 'ファイアボール', cost: 3, kind: 'damage', target: 'all', damage: 7, tier: 2 },
  strike: { id: 'strike', name: 'Strike', jaName: 'うつ', cost: 0, kind: 'damage', target: 'one', damage: 4, tier: 0 },
  dodge: { id: 'dodge', name: 'Dodge', jaName: 'よける', cost: 0, kind: 'defense', target: 'self', defense: 'dodge', tier: 0 },
  doubleStrike: { id: 'doubleStrike', name: 'Double Strike', jaName: 'にれんだ', cost: 2, kind: 'doubleDamage', target: 'one', damage: 4, tier: 1 },
  shadowStrike: { id: 'shadowStrike', name: 'Shadow Strike', jaName: 'かげうち', cost: 3, kind: 'splitDamage', target: 'one', damage: 11, splashDamage: 4, tier: 2 },
});

export const HEROES = Object.freeze({
  fighter: { id: 'fighter', name: 'Fighter', jaName: 'せんし', summary: 'Strong and tough.', kanaSummary: 'わかりやすい！', maxHp: 32, skills: Object.freeze(['slash', 'guard', 'powerSlash', 'cleave']) },
  mage: { id: 'mage', name: 'Mage', jaName: 'まほうつかい', summary: 'Magic and healing.', kanaSummary: 'まほうと かいふく', maxHp: 25, skills: Object.freeze(['magicBolt', 'barrier', 'heal', 'fireball']) },
  ninja: { id: 'ninja', name: 'Ninja', jaName: 'にんじゃ', summary: 'Fast and elusive.', kanaSummary: 'タイミングが だいじ！', maxHp: 27, skills: Object.freeze(['strike', 'dodge', 'doubleStrike', 'shadowStrike']) },
});

export const ENEMIES = Object.freeze({
  slime: { id: 'slime', name: 'Slime', jaName: 'スライム', maxHp: 8, attack: 2, ai: Object.freeze({}) },
  bat: { id: 'bat', name: 'Bat', jaName: 'コウモリ', maxHp: 5, attack: 2, ai: Object.freeze({}) },
  mushroom: { id: 'mushroom', name: 'Mushroom', jaName: 'キノコ', maxHp: 10, attack: 1, ai: Object.freeze({}) },
  goblin: { id: 'goblin', name: 'Goblin', jaName: 'ゴブリン', maxHp: 11, attack: 2, ai: Object.freeze({ guardChance: 0.25 }) },
  wolf: { id: 'wolf', name: 'Wolf', jaName: 'オオカミ', maxHp: 10, attack: 3, ai: Object.freeze({}) },
  skeleton: { id: 'skeleton', name: 'Skeleton', jaName: 'スケルトン', maxHp: 8, attack: 2, ai: Object.freeze({}) },
  shieldGoblin: { id: 'shieldGoblin', name: 'Shield Goblin', jaName: 'たてゴブリン', maxHp: 16, attack: 2, ai: Object.freeze({ guardChance: 0.5 }) },
  healer: { id: 'healer', name: 'Healer', jaName: 'ヒーラー', maxHp: 12, attack: 2, heal: 4, ai: Object.freeze({ support: 'heal' }) },
  golem: { id: 'golem', name: 'Golem', jaName: 'ゴーレム', maxHp: 24, attack: 2, heavy: 9, heavyName: 'Rock Smash', ai: Object.freeze({ heavyEvery: 2, rests: true }) },
  goblinCaptain: { id: 'goblinCaptain', name: 'Goblin Captain', jaName: 'ゴブリンたいちょう', maxHp: 16, attack: 3, heavy: 8, heavyName: 'Captain Slash', ai: Object.freeze({ heavyEvery: 2, guardChance: 0.2 }) },
  necromancer: { id: 'necromancer', name: 'Necromancer', jaName: 'ネクロマンサー', maxHp: 13, attack: 2, heal: 2, summonId: 'skeleton', ai: Object.freeze({ support: 'summon', maxSummons: 1 }) },
  dragon: { id: 'dragon', name: 'Dragon', jaName: 'ドラゴン', maxHp: 34, attack: 2, heavy: 11, heavyName: 'Fire Breath', boss: true, ai: Object.freeze({ heavyEvery: 3, rests: true, phase2: Object.freeze({ at: 0.6, message: '🔥 DRAGON IS ANGRY!', heavyEvery: 1, rests: false }) }) },
  demonKing: { id: 'demonKing', name: 'Demon King', jaName: 'まおう', maxHp: 30, attack: 2, heavy: 10, heavyName: 'Dark Blast', summonId: 'bat', boss: true, ai: Object.freeze({ heavyEvery: 3, guardChance: 0.2, support: 'summon', maxSummons: 1, phase2: Object.freeze({ at: 0.6, message: '😈 DEMON KING IS ANGRY!', heavyEvery: 2, maxSummons: 2 }) }) },
  giantGolem: { id: 'giantGolem', name: 'Giant Golem', jaName: 'きょだいゴーレム', maxHp: 38, attack: 2, heavy: 12, heavyName: 'Earthquake', boss: true, ai: Object.freeze({ heavyEvery: 3, rests: true, phase2: Object.freeze({ at: 0.6, message: '💢 GIANT GOLEM IS ANGRY!', heavyEvery: 1, rests: true }) }) },
  vampireLord: { id: 'vampireLord', name: 'Vampire Lord', jaName: 'きゅうけつきおう', maxHp: 32, attack: 2, heavy: 9, heavyName: 'Blood Moon', boss: true, ai: Object.freeze({ heavyEvery: 3, drainChance: 0.5, phase2: Object.freeze({ at: 0.6, message: '🩸 VAMPIRE LORD IS ANGRY!', heavyEvery: 2, normal: 'drain' }) }) },
});

export const ENCOUNTERS = Object.freeze({
  slime: { id: 'slime', tier: 1, enemyIds: Object.freeze(['slime']) },
  bat: { id: 'bat', tier: 1, enemyIds: Object.freeze(['bat']) },
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
});
