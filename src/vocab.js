// The single vocabulary source. `ja` is the prompt shown/spoken in modes 3-4,
// so every `ja` must be unique. `jaAccepted` lists every typed answer that
// counts in modes 1-2 (kana, kanji, common alternatives), compared after
// normalizeJapanese. `enAccepted` lists spoken forms for modes 3-4: the verb
// plus true homophones a recogniser returns for the isolated word.
// Glosses for jump/run/walk/dance/swim/fly/climb/catch/drink/eat/cut/wash/stop
// follow esl-gestures/src/config/vocab.js.

const v = (en, ja, jaAccepted, enAccepted = [en]) =>
  Object.freeze({ id: en, en, enAccepted: Object.freeze(enAccepted), ja, jaAccepted: Object.freeze([ja, ...jaAccepted]) });

export const VOCABULARY = Object.freeze([
  v('bake', 'やく', ['焼く', 'パンをやく', 'パンを焼く']),
  v('buy', 'かう', ['買う'], ['buy', 'by', 'bye']),
  v('catch', 'キャッチする', ['キャッチ', 'つかまえる', '捕まえる', 'つかむ', '掴む', 'とる', '取る', 'うけとる', '受け取る', 'うけとめる', '受け止める']),
  v('clean', 'そうじする', ['掃除する', 'そうじをする', '掃除をする', 'そうじ', '掃除', 'きれいにする', '綺麗にする']),
  v('climb', 'のぼる', ['登る', 'よじのぼる', 'よじ登る']),
  v('come', 'くる', ['来る']),
  v('cook', 'りょうりする', ['料理する', 'りょうりをする', '料理をする', 'りょうり', '料理']),
  v('cut', 'きる', ['切る']),
  v('dance', 'おどる', ['踊る', 'ダンスする', 'ダンスをする', 'ダンス']),
  v('draw', 'えをかく', ['絵をかく', '絵を描く', 'えをえがく', 'かく', '描く', 'えがく']),
  v('drink', 'のむ', ['飲む']),
  v('eat', 'たべる', ['食べる']),
  v('enjoy', 'たのしむ', ['楽しむ']),
  v('feed', 'えさをやる', ['えさをあげる', '餌をやる', '餌をあげる', 'エサをやる', 'エサをあげる', 'えさをあたえる', '餌を与える', 'エサを与える', 'たべものをあたえる', '食べ物を与える', 'たべさせる', '食べさせる', 'あたえる', '与える']),
  v('fly', 'そらをとぶ', ['空を飛ぶ', 'とぶ', '飛ぶ']),
  v('get', 'てにいれる', ['手に入れる', 'もらう', 'える', '得る']),
  v('go', 'いく', ['行く', 'ゆく']),
  v('have', 'もっている', ['持っている', 'もつ', '持つ']),
  v('help', 'てつだう', ['手伝う', 'たすける', '助ける']),
  v('jog', 'ジョギングする', ['ジョギングをする', 'ジョギング']),
  v('join', 'さんかする', ['参加する', 'さんか', '参加', 'くわわる', '加わる']),
  v('jump', 'ジャンプする', ['ジャンプ', 'とぶ', '跳ぶ', 'とびはねる', '跳びはねる']),
  v('like', 'すき', ['好き', 'すきだ', '好きだ', 'このむ', '好む']),
  v('listen', 'きく', ['聞く', '聴く']),
  v('look', 'みる', ['見る', 'ながめる', '眺める']),
  v('love', 'あいする', ['愛する', 'だいすき', '大好き']),
  v('make', 'つくる', ['作る', '造る']),
  v('play', 'あそぶ', ['遊ぶ', 'する', 'プレーする', 'プレイする', 'えんそうする', '演奏する']),
  v('practice', 'れんしゅうする', ['練習する', 'れんしゅうをする', '練習をする', 'れんしゅう', '練習'], ['practice', 'practise']),
  v('read', 'よむ', ['読む'], ['read', 'reed']),
  v('ride', 'のる', ['乗る']),
  v('run', 'はしる', ['走る']),
  v('see', 'みえる', ['見える', 'みる', '見る', 'あう', '会う'], ['see', 'sea', 'c']),
  v('sing', 'うたう', ['歌う', 'うたをうたう', '歌を歌う']),
  v('skateboard', 'スケートボードをする', ['スケートボードする', 'スケートボード', 'スケボーをする', 'スケボーする', 'スケボー'], ['skateboard', 'skate board', 'skate-board']),
  v('ski', 'スキーをする', ['スキーする', 'スキー'], ['ski', 'skee']),
  v('speak', 'はなす', ['話す', 'しゃべる', '喋る']),
  v('stop', 'とまる', ['止まる', 'とめる', '止める', 'やめる']),
  v('study', 'べんきょうする', ['勉強する', 'べんきょうをする', '勉強をする', 'べんきょう', '勉強']),
  v('swim', 'およぐ', ['泳ぐ']),
  v('talk', 'しゃべる', ['喋る', 'はなす', '話す', 'おしゃべりする', 'はなしあう', '話し合う']),
  v('think', 'かんがえる', ['考える', 'おもう', '思う']),
  v('touch', 'さわる', ['触る', 'ふれる', '触れる', 'タッチする', 'タッチ']),
  v('turn', 'まがる', ['曲がる', 'まわる', '回る', 'まわす', '回す']),
  v('walk', 'あるく', ['歩く']),
  v('want', 'ほしい', ['欲しい', 'ほしがる', '欲しがる']),
  v('wash', 'あらう', ['洗う']),
  v('water', 'みずをやる', ['水をやる', 'みずをあげる', '水をあげる', 'みずやりをする', '水やりをする']),
  v('wear', 'みにつける', ['身につける', '身に付ける', 'きる', '着る', 'はく', '履く', 'かぶる'], ['wear', 'where', 'ware']),
  v('write', 'かく', ['書く'], ['write', 'right', 'rite']),
]);

export const VOCAB_BY_ID = Object.freeze(Object.fromEntries(VOCABULARY.map((item) => [item.id, item])));
