// Station-centred defence locations shown before each Adventure city battle
// (src/station-map.js draws them). Every station, line and landmark is real and
// placed from its latitude/longitude (Wikipedia / OpenStreetMap, checked
// 2026-10-22), so stations keep their true directions from each other just as
// the cities do on the Osaka map. The maps are schematic: the town texture,
// parks inside blocks, fires and monsters are decoration, and nothing is to
// scale beyond the projection. A landmark is drawn only where its position was
// verified; anything else is said in the `note` line.

/** Real places, [lat, lon]. */
const P = Object.freeze({
  yata: [34.60527, 135.53272], kawachiAmami: [34.58614, 135.53543], nunose: [34.57717, 135.53969],
  takaminosato: [34.57523, 135.54631], kawachiMatsubara: [34.57569, 135.55659], eganosho: [34.57355, 135.57286],
  hannanUniversity: [34.59279, 135.53654], nunoseShrine: [34.57885, 135.5363],
  asakayama: [34.58908, 135.49089], sakaiHigashi: [34.5755, 135.48484], mikunigaoka: [34.56526, 135.49279],
  mozuhachiman: [34.5606, 135.49855], nakamozu: [34.55623, 135.50446], shirasagi: [34.55017, 135.51339],
  fukai: [34.53025, 135.49744], shinkanaoka: [34.5672, 135.5148], sakaiCityHall: [34.57369, 135.48287],
  omuNakamozu: [34.547, 135.5095],
  shichido: [34.59235, 135.48058], sakai: [34.58169, 135.46896], minato: [34.57058, 135.46],
  sakaiLighthouse: [34.58349, 135.45896], ohamaPark: [34.58045, 135.46085],
  hamaderakoen: [34.54093, 135.44441], suwanomori: [34.55047, 135.44846], hagoromo: [34.53447, 135.44181],
  hamaderaEkimae: [34.54129, 135.44486], hamaderaPark: [34.5399, 135.4395],
  yaominami: [34.59739, 135.58257], nagahara: [34.60291, 135.57367], yaoAirport: [34.58556, 135.60056],
  yao: [34.61756, 135.59675], kyuhoji: [34.62235, 135.58433], shiki: [34.60058, 135.61572],
  kintetsuYao: [34.6297, 135.60387], kyuhojiguchi: [34.6348, 135.59034], kawachiYamamoto: [34.62796, 135.61962],
  takayasu: [34.6189, 135.6246], hattorigawa: [34.62626, 135.64148], mtTakayasu: [34.61689, 135.65755],
  ishikiri: [34.68523, 135.65544], nukata: [34.67539, 135.65108], shinIshikiri: [34.68015, 135.64087],
  ishikiriShrine: [34.68199, 135.64617],
  higashiHanazono: [34.66252, 135.62646], kawachiHanazono: [34.66284, 135.61799], hyotanyama: [34.66211, 135.63975],
  hanazonoRugby: [34.6693, 135.62657],
  aramoto: [34.67861, 135.6049], nagata: [34.67844, 135.59302], yoshita: [34.68029, 135.62414],
  higashiosakaCityHall: [34.67942, 135.60064],
  fuse: [34.66412, 135.56321], imazato: [34.66468, 135.54966], kawachiEiwa: [34.66429, 135.57321], shuntokumichi: [34.6583, 135.57184],
  tennoji: [34.64732, 135.51394], teradacho: [34.64788, 135.52337], shinImamiya: [34.65017, 135.50069],
  abenoHarukas: [34.64577, 135.51401], tsutenkaku: [34.65254, 135.50631],
  namba: [34.66341, 135.50191], shinsaibashi: [34.67501, 135.50033], daikokucho: [34.65607, 135.4978],
  osaka: [34.70251, 135.49618], fukushima: [34.69689, 135.48722], tenma: [34.70492, 135.51232], umedaSky: [34.70529, 135.49053],
  osakajokoen: [34.68776, 135.5344], kyobashi: [34.696, 135.5347], morinomiya: [34.6811, 135.53384], osakaCastle: [34.68718, 135.5254],
});

const stop = (place, ja, en) => Object.freeze({ at: P[place], ja, en });
const line = (stops, kind = 'rail') => Object.freeze({ stops: Object.freeze(stops), kind });
const loc = (stage, data) => Object.freeze({ stage, ...data });

const MINAMI_OSAKA = [stop('yata', 'やた', 'Yata'), stop('kawachiAmami', 'かわちあまみ', 'Kawachi-Amami'), stop('nunose', 'ぬのせ', 'Nunose'),
  stop('takaminosato', 'たかみのさと', 'Takaminosato'), stop('kawachiMatsubara', 'かわちまつばら', 'Kawachi-Matsubara'), stop('eganosho', 'えがのしょう', 'Eganosho')];
const KOYA = [stop('asakayama', 'あさかやま', 'Asakayama'), stop('sakaiHigashi', 'さかいひがし', 'Sakai-Higashi'), stop('mikunigaoka', 'みくにがおか', 'Mikunigaoka'),
  stop('mozuhachiman', 'もずはちまん', 'Mozuhachiman'), stop('nakamozu', 'なかもず', 'Nakamozu'), stop('shirasagi', 'しらさぎ', 'Shirasagi')];
const NANKAI_MAIN = [stop('shichido', 'しちどう', 'Shichido'), stop('sakai', 'さかい', 'Sakai'), stop('minato', 'みなと', 'Minato')];
const NANKAI_SOUTH = [stop('suwanomori', 'すわのもり', 'Suwanomori'), stop('hamaderakoen', 'はまでらこうえん', 'Hamadera-koen'), stop('hagoromo', 'はごろも', 'Hagoromo')];
const KINTETSU_OSAKA = [stop('kyuhojiguchi', 'きゅうほうじぐち', 'Kyuhojiguchi'), stop('kintetsuYao', 'きんてつやお', 'Kintetsu-Yao'),
  stop('kawachiYamamoto', 'かわちやまもと', 'Kawachi-Yamamoto'), stop('takayasu', 'たかやす', 'Takayasu')];

const KINTETSU_NARA_EAST = [stop('kawachiHanazono', 'かわちはなぞの', 'Kawachi-Hanazono'), stop('higashiHanazono', 'ひがしはなぞの', 'Higashi-Hanazono'),
  stop('hyotanyama', 'ひょうたんやま', 'Hyotan-yama')];

export const BATTLE_LOCATIONS = Object.freeze({
  matsubara: Object.freeze([
    loc(1, {
      station: { place: P.kawachiMatsubara, name: 'Kawachi-Matsubara', jaName: '河内松原', kana: 'かわちまつばら', line: 'Kintetsu Minami-Osaka Line' },
      note: { ja: 'まつばらの まちの えき', en: 'The station in the heart of Matsubara' },
      map: { center: [34.5755, 135.5545], km: 3.4, lines: [line(MINAMI_OSAKA)], threats: [[52, 6], [8, 94], [94, 92]] },
    }),
    loc(2, {
      station: { place: P.takaminosato, name: 'Takaminosato', jaName: '高見ノ里', kana: 'たかみのさと', line: 'Kintetsu Minami-Osaka Line' },
      note: { ja: 'まつばら しやくしょの ちかくの えき', en: 'The station near Matsubara City Hall' },
      map: { center: [34.5762, 135.5463], km: 3, lines: [line(MINAMI_OSAKA)], threats: [[6, 8], [94, 8], [50, 94]] },
    }),
    loc(3, {
      station: { place: P.nunose, name: 'Nunose', jaName: '布忍', kana: 'ぬのせ', line: 'Kintetsu Minami-Osaka Line' },
      note: { ja: 'ぬのせじんじゃの ちかくの えき', en: 'The station near Nunose Shrine' },
      map: {
        center: [34.5795, 135.5405], km: 3, lines: [line(MINAMI_OSAKA)],
        landmarks: [{ kind: 'shrine', at: P.nunoseShrine, ja: 'ぬのせじんじゃ', en: 'Nunose Shrine' }],
        threats: [[94, 10], [6, 60], [70, 94]],
      },
    }),
    loc(4, {
      station: { place: P.kawachiAmami, name: 'Kawachi-Amami', jaName: '河内天美', kana: 'かわちあまみ', line: 'Kintetsu Minami-Osaka Line' },
      note: { ja: 'はんなんだいがくの ちかくの えき', en: 'The station by Hannan University' },
      map: {
        center: [34.5925, 135.5365], km: 5, lines: [line(MINAMI_OSAKA)],
        // The Yamato River: Matsubara's northern edge, between Kawachi-Amami and Yata.
        rivers: [{ points: [[34.6005, 135.50], [34.5996, 135.52], [34.6002, 135.54], [34.5992, 135.56], [34.5998, 135.58]], width: 7, ja: 'やまとがわ', en: 'Yamato River', label: [34.6008, 135.5515] }],
        landmarks: [{ kind: 'university', at: P.hannanUniversity, ja: 'はんなんだいがく', en: 'Hannan University' }],
        threats: [[20, 8], [94, 50], [70, 94]],
      },
    }),
  ]),

  sakai: Object.freeze([
    loc(1, {
      station: { place: P.nakamozu, name: 'Nakamozu', jaName: '中百舌鳥', kana: 'なかもず', line: 'Nankai Koya Line' },
      note: { ja: '3つの せんが あつまる えき', en: 'Three lines meet here' },
      map: {
        center: [34.5525, 135.5065], km: 3.8,
        lines: [line(KOYA), line([stop('nakamozu', 'なかもず', 'Nakamozu'), stop('fukai', 'ふかい', 'Fukai')]),
          line([stop('nakamozu', 'なかもず', 'Nakamozu'), stop('shinkanaoka', 'しんかなおか', 'Shinkanaoka')], 'subway')],
        landmarks: [{ kind: 'university', at: P.omuNakamozu, ja: 'だいがく', en: 'University' }],
        threats: [[6, 10], [94, 30], [20, 94]],
      },
    }),
    loc(2, {
      station: { place: P.sakaiHigashi, name: 'Sakai-Higashi', jaName: '堺東', kana: 'さかいひがし', line: 'Nankai Koya Line' },
      note: { ja: 'さかい しやくしょの ちかくの えき', en: 'The station by Sakai City Hall' },
      map: {
        center: [34.5755, 135.4870], km: 3, lines: [line(KOYA)],
        landmarks: [{ kind: 'cityHall', at: P.sakaiCityHall, ja: 'しやくしょ', en: 'City Hall' }],
        threats: [[94, 8], [94, 90], [6, 40]],
      },
    }),
    loc(3, {
      station: { place: P.sakai, name: 'Sakai', jaName: '堺', kana: 'さかい', line: 'Nankai Main Line' },
      note: { ja: 'むかしの みなとの ちかくの えき', en: 'The station by the old port' },
      map: {
        center: [34.5810, 135.4655], km: 3,
        // The bay west of the old port (堺旧港), whose mouth has the old lighthouse.
        water: [[[34.60, 135.44], [34.60, 135.4567], [34.5852, 135.4567], [34.5852, 135.4625], [34.5838, 135.4625], [34.5838, 135.4567], [34.56, 135.4567], [34.56, 135.44]]],
        parks: [[[34.5818, 135.4590], [34.5818, 135.4630], [34.5790, 135.4630], [34.5790, 135.4590]]],
        lines: [line(NANKAI_MAIN)],
        landmarks: [
          { kind: 'lighthouse', at: P.sakaiLighthouse, ja: 'きゅう さかいとうだい', en: 'Old Sakai Lighthouse' },
          { kind: 'park', at: P.ohamaPark, ja: 'おおはまこうえん', en: 'Ohama Park' },
        ],
        threats: [[94, 8], [94, 70], [60, 94]],
      },
    }),
    loc(4, {
      station: { place: P.hamaderakoen, name: 'Hamadera-koen', jaName: '浜寺公園', kana: 'はまでらこうえん', line: 'Nankai Main Line' },
      note: { ja: 'ひろい はまでらこうえんの えき', en: 'The station by big Hamadera Park' },
      map: {
        center: [34.5410, 135.4400], km: 3,
        water: [[[34.56, 135.40], [34.56, 135.4305], [34.52, 135.4295], [34.52, 135.40]]],
        parks: [[[34.5478, 135.4322], [34.5478, 135.4428], [34.5322, 135.4418], [34.5322, 135.4320]]],
        lines: [line(NANKAI_SOUTH),
          // The Hankai tram ends at Hamadera-ekimae, beside the station (track only: its plate would sit on the station's).
          line([{ at: [34.5600, 135.4520], ja: '', en: '' }, { at: P.hamaderaEkimae, ja: '', en: '' }], 'tram')],
        landmarks: [{ kind: 'park', at: P.hamaderaPark, ja: 'はまでらこうえん', en: 'Hamadera Park' }],
        threats: [[94, 10], [94, 90], [70, 6]],
      },
    }),
  ]),

  yao: Object.freeze([
    loc(1, {
      station: { place: P.yaominami, name: 'Yao-minami', jaName: '八尾南', kana: 'やおみなみ', line: 'Osaka Metro Tanimachi Line' },
      note: { ja: 'たにまちせんの さいごの えき', en: 'The last stop of the Tanimachi Line' },
      map: {
        center: [34.5920, 135.5905], km: 4.4,
        lines: [line([stop('nagahara', 'ながはら', 'Nagahara'), stop('yaominami', 'やおみなみ', 'Yao-minami')], 'terminus')],
        depot: [[34.6028, 135.5772], [34.5992, 135.5868]],
        airport: { at: P.yaoAirport, length: 1.5, width: 0.32 },
        landmarks: [{ kind: 'airport', at: P.yaoAirport, ja: 'やおくうこう', en: 'Yao Airport' }],
        threats: [[6, 94], [40, 94], [6, 50]],
      },
    }),
    loc(2, {
      station: { place: P.yao, name: 'Yao', jaName: 'JR八尾', kana: 'ジェイアール やお', line: 'JR Yamatoji Line' },
      note: { ja: 'JRの やおの えき', en: 'JR Yao Station' },
      map: {
        center: [34.6150, 135.5980], km: 3.6,
        lines: [line([stop('kyuhoji', 'きゅうほうじ', 'Kyuhoji'), stop('yao', 'やお', 'Yao'), stop('shiki', 'しき', 'Shiki')])],
        threats: [[10, 94], [60, 94], [94, 8]],
      },
    }),
    loc(3, {
      station: { place: P.kintetsuYao, name: 'Kintetsu-Yao', jaName: '近鉄八尾', kana: 'きんてつやお', line: 'Kintetsu Osaka Line' },
      note: { ja: 'やおの まちの まんなか', en: 'Downtown Yao' },
      map: { center: [34.6305, 135.6045], km: 3.6, lines: [line(KINTETSU_OSAKA)], threats: [[6, 8], [50, 94], [94, 92]] },
    }),
    loc(4, {
      station: { place: P.kawachiYamamoto, name: 'Kawachi-Yamamoto', jaName: '河内山本', kana: 'かわちやまもと', line: 'Kintetsu Osaka Line' },
      note: { ja: '2つの せんが わかれる えき', en: 'Where two lines split' },
      map: {
        center: [34.6220, 135.6335], km: 5.6,
        lines: [line(KINTETSU_OSAKA), line([stop('kawachiYamamoto', 'かわちやまもと', 'Kawachi-Yamamoto'), stop('hattorigawa', 'はっとりがわ', 'Hattorigawa')])],
        // The Ikoma hills rise east of Hattorigawa; Mt. Takayasu is their peak above Yao.
        mountains: [[34.6330, 135.6520], [34.6280, 135.6600], [34.6215, 135.6540], [34.6168, 135.6575], [34.6120, 135.6640], [34.6100, 135.6500]],
        landmarks: [{ kind: 'mountain', at: P.mtTakayasu, ja: 'たかやすやま', en: 'Mt. Takayasu' }],
        threats: [[94, 30], [70, 6], [6, 94]],
      },
    }),
  ]),

  // The Horde pushes west from the Ikoma hills toward Osaka City. Higashiosaka
  // is a town of small factories, so its lots show sawtooth factory roofs.
  higashiosaka: Object.freeze([
    loc(1, {
      station: { place: P.ishikiri, name: 'Ishikiri', jaName: '石切', kana: 'いしきり', line: 'Kintetsu Nara Line' },
      note: { ja: 'いこまの やまの ふもとの えき', en: 'The station at the foot of the Ikoma hills' },
      map: {
        center: [34.6815, 135.6500], km: 3, factories: true,
        // Both lines climb the hillside, then tunnel east under the Ikoma hills to Nara.
        lines: [line([stop('nukata', 'ぬかた', 'Nukata'), stop('ishikiri', 'いしきり', 'Ishikiri')], 'tunnel'),
          line([stop('yoshita', '', ''), stop('shinIshikiri', 'しんいしきり', 'Shin-Ishikiri')], 'tunnel')],
        mountains: [[34.6880, 135.6610], [34.6830, 135.6640], [34.6775, 135.6615], [34.6752, 135.6650], [34.6860, 135.6655]],
        landmarks: [{ kind: 'shrine', at: P.ishikiriShrine, ja: 'いしきりじんじゃ', en: 'Ishikiri Shrine' }],
        threats: [[94, 20], [94, 75], [70, 6]],
      },
    }),
    loc(2, {
      station: { place: P.higashiHanazono, name: 'Higashi-Hanazono', jaName: '東花園', kana: 'ひがしはなぞの', line: 'Kintetsu Nara Line' },
      note: { ja: 'ラグビーじょうの ちかくの えき', en: 'The station near the rugby stadium' },
      map: {
        center: [34.6655, 135.6280], km: 3, factories: true, lines: [line(KINTETSU_NARA_EAST)],
        landmarks: [{ kind: 'stadium', at: P.hanazonoRugby, ja: 'はなぞの ラグビーじょう', en: 'Hanazono Rugby Stadium' }],
        threats: [[94, 20], [94, 90], [60, 6]],
      },
    }),
    loc(3, {
      station: { place: P.aramoto, name: 'Aramoto', jaName: '荒本', kana: 'あらもと', line: 'Kintetsu Keihanna Line' },
      note: { ja: 'ひがしおおさか しやくしょの ちかくの えき', en: 'The station by Higashiosaka City Hall' },
      map: {
        center: [34.6790, 135.6086], km: 3.6, factories: true,
        lines: [line([stop('nagata', 'ながた', 'Nagata'), stop('aramoto', 'あらもと', 'Aramoto'), stop('yoshita', 'よした', 'Yoshita')])],
        landmarks: [{ kind: 'cityHall', at: P.higashiosakaCityHall, ja: 'しやくしょ', en: 'City Hall' }],
        threats: [[94, 12], [94, 88], [52, 6]],
      },
    }),
    loc(4, {
      station: { place: P.fuse, name: 'Fuse', jaName: '布施', kana: 'ふせ', line: 'Kintetsu Nara / Osaka Line' },
      note: { ja: 'おおさか市への いりぐち', en: 'The gateway to Osaka City' },
      map: {
        center: [34.6625, 135.5610], km: 3.4, factories: true,
        // Fuse is the junction: the Osaka Line turns south-east, the Nara Line runs on east.
        lines: [line([stop('imazato', 'いまざと', 'Imazato'), stop('fuse', 'ふせ', 'Fuse'), stop('shuntokumichi', 'しゅんとくみち', 'Shuntokumichi')]),
          line([stop('fuse', 'ふせ', 'Fuse'), stop('kawachiEiwa', 'かわちえいわ', 'Kawachi-Eiwa')])],
        threats: [[94, 20], [94, 70], [70, 94]],
      },
    }),
  ]),

  // The whole Horde drives from the south through the city centre to the
  // castle. Park and river outlines are OpenStreetMap ways traced 2026-10-22
  // (Tennoji Park 170693374, Osaka Castle Park 35457792, Dotonbori 82725202,
  // Yodo 82726880 + 135754702, Okawa 82729504 and its Tosabori branch 82720517), simplified for the 192px map.
  osakaCity: Object.freeze([
    loc(1, {
      station: { place: P.tennoji, name: 'Tennoji', jaName: '天王寺', kana: 'てんのうじ', line: 'JR Osaka Loop Line' },
      note: { ja: 'あべのハルカスの ちかくの えき', en: 'The station by Abeno Harukas' },
      map: {
        center: [34.6500, 135.5120], km: 3,
        parks: [[[34.65362, 135.50964], [34.65385, 135.50825], [34.64902, 135.50666], [34.64783, 135.51204], [34.6479, 135.51281], [34.64854, 135.51307],
          [34.64885, 135.512], [34.65015, 135.51234], [34.6503, 135.51144], [34.65091, 135.51161], [34.65079, 135.51271], [34.65113, 135.51285],
          [34.65232, 135.51236], [34.65244, 135.51118], [34.6517, 135.51001], [34.65188, 135.50959]]],
        lines: [line([stop('shinImamiya', 'しんいまみや', 'Shin-Imamiya'), stop('tennoji', 'てんのうじ', 'Tennoji'), stop('teradacho', 'てらだちょう', 'Teradacho')])],
        landmarks: [
          { kind: 'skyscraper', at: P.abenoHarukas, ja: 'あべのハルカス', en: 'Abeno Harukas' },
          { kind: 'tower', at: P.tsutenkaku, ja: 'つうてんかく', en: 'Tsutenkaku' },
        ],
        threats: [[20, 94], [62, 94], [94, 60]],
      },
    }),
    loc(2, {
      station: { place: P.namba, name: 'Namba', jaName: '難波', kana: 'なんば', line: 'Nankai Main Line / Osaka Metro Midosuji Line' },
      note: { ja: 'どうとんぼりの ちかくの えき', en: 'The station near Dotonbori' },
      map: {
        center: [34.6660, 135.5010], km: 3,
        // Nankai ends at Namba; the Midosuji subway runs north-south past it.
        lines: [line([stop('shinImamiya', 'しんいまみや', 'Shin-Imamiya'), stop('namba', 'なんば', 'Namba')], 'terminus'),
          line([stop('daikokucho', 'だいこくちょう', 'Daikokucho'), stop('shinsaibashi', 'しんさいばし', 'Shinsaibashi')], 'subway')],
        rivers: [{ points: [[34.66898, 135.51044], [34.66899, 135.49726], [34.66999, 135.48644]], width: 4, ja: 'どうとんぼりがわ', en: 'Dotonbori', label: [34.6704, 135.5080] }],
        threats: [[10, 94], [58, 94], [94, 80]],
      },
    }),
    loc(3, {
      station: { place: P.osaka, name: 'Osaka', jaName: '大阪', kana: 'おおさか', line: 'JR Osaka Loop Line' },
      note: { ja: 'おおさかで いちばん おおきい えき', en: "Osaka's biggest station" },
      map: {
        center: [34.7070, 135.4990], km: 4.6,
        lines: [line([stop('fukushima', 'ふくしま', 'Fukushima'), stop('osaka', 'おおさか', 'Osaka'), stop('tenma', 'てんま', 'Tenma')])],
        rivers: [{ points: [[34.72304, 135.51359], [34.7197, 135.50764], [34.71888, 135.50371], [34.71626, 135.49013], [34.69805, 135.45992]], width: 16, ja: 'よどがわ', en: 'Yodo River', label: [34.7095, 135.4770] }],
        landmarks: [{ kind: 'skyscraper', at: P.umedaSky, ja: 'うめだスカイビル', en: 'Umeda Sky Building' }],
        threats: [[20, 94], [80, 94], [94, 60]],
      },
    }),
    loc(4, {
      station: { place: P.osakajokoen, name: 'Osakajokoen', jaName: '大阪城公園', kana: 'おおさかじょうこうえん', line: 'JR Osaka Loop Line' },
      note: { ja: 'おおさかじょうを まもれ！', en: 'Defend Osaka Castle!' },
      map: {
        center: [34.6880, 135.5285], km: 4,
        parks: [[[34.68808, 135.52022], [34.68338, 135.52162], [34.68245, 135.52325], [34.68163, 135.53337], [34.68904, 135.53415], [34.68956, 135.53429],
          [34.69152, 135.52542], [34.69077, 135.52273], [34.68936, 135.52266]]],
        rivers: [{ points: [[34.70407, 135.5184], [34.69967, 135.52204], [34.69578, 135.52293], [34.69411, 135.52234], [34.69176, 135.52019], [34.69112, 135.51486], [34.69085, 135.5104], [34.69239, 135.50624]], width: 6, ja: 'おおかわ', en: 'Okawa River', label: [34.6975, 135.5150] }],
        lines: [line([stop('morinomiya', 'もりのみや', 'Morinomiya'), stop('osakajokoen', 'おおさかじょうこうえん', 'Osakajokoen'), stop('kyobashi', 'きょうばし', 'Kyobashi')])],
        landmarks: [{ kind: 'castle', at: P.osakaCastle, ja: 'おおさかじょう', en: 'Osaka Castle' }],
        threats: [[28, 94], [72, 94], [6, 70]],
      },
    }),
  ]),
});

/** The defence location for a city stage, or null when the city has none. */
export function battleLocation(cityId, stage) {
  return BATTLE_LOCATIONS[cityId]?.find((location) => location.stage === stage) ?? null;
}
