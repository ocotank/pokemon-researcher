import { useInView } from '../hooks/useInView';
import { directionsUrl, embedMapUrl } from '../lib/geo';
import type { LatLng } from '../lib/geo';

type Props = { at: LatLng; label: string };

// 地図はプレビュー表示のみ。クロスオリジンの iframe 内のクリックは拾えないため、
// 透明なリンクを重ねて「地図をタップ＝道順を開く」に一本化している。
// iframe は画面に近づいたカードだけに置き、スクロールに応じて順次読み込む。
export function SpotMap({ at, label }: Props) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div className="spot-map" ref={ref}>
      {inView && (
        <iframe
          src={embedMapUrl(at)}
          title={`${label}の地図`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          tabIndex={-1}
          aria-hidden="true"
        />
      )}
      <a
        className="spot-map-link"
        href={directionsUrl(at)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${label}への道順をGoogleマップで開く`}
      >
        <span className="spot-map-cta">道順を見る</span>
      </a>
    </div>
  );
}
