import type { GeoState } from '../hooks/useGeolocation';

export function GeoBanner({ geo }: { geo: GeoState }) {
  if (geo.status === 'ok' && geo.position) {
    return <p className="banner ok">📍 現在地を取得済み（誤差 ±{Math.round(geo.position.accuracy)}m）</p>;
  }
  if (geo.status === 'locating') {
    return <p className="banner">📍 現在地を取得中…</p>;
  }
  return (
    <p className="banner">
      ⚠️ {geo.message}
      {!geo.position && '。距離なしで表示しています'}
    </p>
  );
}
