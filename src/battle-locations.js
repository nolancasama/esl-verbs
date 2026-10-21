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
});

/** The defence location for a city stage, or null when the city has none. */
export function battleLocation(cityId, stage) {
  return BATTLE_LOCATIONS[cityId]?.find((location) => location.stage === stage) ?? null;
}
