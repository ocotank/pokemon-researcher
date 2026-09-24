// 公式サイト（https://mitsui-shopping-park.com/urban/legend-research/）の会場 MAP より。
// 座標は建物位置からの概算。tentative: true はシルエットからの推測で、アプリ内で名前を編集できる。

export type Statue = { id: string; name: string; tentative: boolean };

export type Spot = {
  id: string;
  facility: string;
  floor: string;
  place: string;
  lat: number;
  lng: number;
  statues: Statue[];
};

export const SPOTS: readonly Spot[] = [
  {
    id: 'terrace-b1f',
    facility: 'COREDO室町テラス',
    floor: 'B1F',
    place: '郵便局前',
    lat: 35.6884,
    lng: 139.7737,
    statues: [
      { id: 'terrace-b1f-1', name: 'ホウオウ', tentative: true },
      { id: 'terrace-b1f-2', name: 'ルギア', tentative: true },
    ],
  },
  {
    id: 'terrace-1f',
    facility: 'COREDO室町テラス',
    floor: '1F',
    place: 'エスカレーターピロティ',
    lat: 35.6884,
    lng: 139.7737,
    statues: [
      { id: 'terrace-1f-1', name: 'グラードン', tentative: true },
      { id: 'terrace-1f-2', name: 'カイオーガ', tentative: true },
    ],
  },
  {
    id: 'muromachi12-b1f',
    facility: 'COREDO室町1・2',
    floor: 'B1F',
    place: 'COREDO室町1・2 地下歩道',
    lat: 35.6872,
    lng: 139.7744,
    statues: [
      { id: 'muromachi12-b1f-1', name: 'ディアルガ', tentative: true },
      { id: 'muromachi12-b1f-2', name: 'パルキア', tentative: true },
    ],
  },
  {
    id: 'mitsui-tower-1f',
    facility: '日本橋三井タワー',
    floor: '1F',
    place: 'アトリウム',
    lat: 35.6866,
    lng: 139.7731,
    statues: [
      { id: 'mitsui-tower-1f-1', name: 'フシギバナ', tentative: false },
      { id: 'mitsui-tower-1f-2', name: 'リザードン', tentative: false },
      { id: 'mitsui-tower-1f-3', name: 'カメックス', tentative: false },
    ],
  },
  {
    id: 'annaisho-b1f',
    facility: 'COREDO室町3付近',
    floor: 'B1F',
    place: '日本橋案内所／わくわく広場前',
    lat: 35.6866,
    lng: 139.7744,
    statues: [
      { id: 'annaisho-b1f-1', name: 'レシラム', tentative: true },
      { id: 'annaisho-b1f-2', name: 'ゼクロム', tentative: true },
    ],
  },
  {
    id: 'midtown-b1f',
    facility: '東京ミッドタウン八重洲',
    floor: 'B1F',
    place: 'YAESU BASE',
    lat: 35.6793,
    lng: 139.769,
    statues: [
      { id: 'midtown-b1f-1', name: 'ザシアン', tentative: true },
      { id: 'midtown-b1f-2', name: 'ザマゼンタ', tentative: true },
    ],
  },
  {
    id: 'midtown-1f',
    facility: '東京ミッドタウン八重洲',
    floor: '1F',
    place: 'アトリウム',
    lat: 35.6793,
    lng: 139.769,
    statues: [
      { id: 'midtown-1f-1', name: 'ゼルネアス', tentative: false },
      { id: 'midtown-1f-2', name: 'イベルタル', tentative: false },
    ],
  },
  {
    id: 'midtown-2f',
    facility: '東京ミッドタウン八重洲',
    floor: '2F',
    place: 'Hacoa DIRECT STORE横スペース',
    lat: 35.6793,
    lng: 139.769,
    statues: [
      { id: 'midtown-2f-1', name: 'ミライドン', tentative: true },
      { id: 'midtown-2f-2', name: 'コライドン', tentative: true },
    ],
  },
  {
    id: 'midtown-3f',
    facility: '東京ミッドタウン八重洲',
    floor: '3F',
    place: 'エスカレーター下',
    lat: 35.6793,
    lng: 139.769,
    statues: [
      { id: 'midtown-3f-1', name: 'ソルガレオ', tentative: true },
      { id: 'midtown-3f-2', name: 'ルナアーラ', tentative: true },
    ],
  },
];

export const ALL_STATUES: readonly Statue[] = SPOTS.flatMap((s) => s.statues);

export function applyOverrides(
  spots: readonly Spot[],
  overrides: ReadonlyMap<string, { lat: number; lng: number }>,
  names: ReadonlyMap<string, string>,
): Spot[] {
  return spots.map((spot) => {
    const o = overrides.get(spot.id);
    return {
      ...spot,
      ...(o ? { lat: o.lat, lng: o.lng } : {}),
      statues: spot.statues.map((st) => {
        const name = names.get(st.id);
        return name ? { ...st, name, tentative: false } : st;
      }),
    };
  });
}
