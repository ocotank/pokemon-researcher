import type { Spot } from '../data/spots';
import type { Collection } from '../hooks/useCollection';
import type { Position } from '../hooks/useGeolocation';
import { deleteSpotOverride, deleteStatueName, putSpotOverride, putStatueName, putStatuePhoto } from '../lib/db';
import { directionsUrl, formatDistance } from '../lib/geo';
import { shareOrDownload } from '../lib/share';
import { BlobImage } from './BlobImage';
import { PhotoButton } from './PhotoButton';

type Props = { spot: Spot; distance: number | null; collection: Collection; here: Position | null };

export function SpotCard({ spot, distance, collection, here }: Props) {
  const overridden = collection.spotOverrides.has(spot.id);

  async function fixLocation() {
    if (!here) {
      alert('現在地がまだ取得できていません');
      return;
    }
    const ok = confirm(
      `「${spot.facility} ${spot.floor} ${spot.place}」の位置を現在地（誤差 ±${Math.round(here.accuracy)}m）にしますか？`,
    );
    if (!ok) return;
    await putSpotOverride({ spotId: spot.id, lat: here.lat, lng: here.lng });
    await collection.reload();
  }

  async function resetLocation() {
    await deleteSpotOverride(spot.id);
    await collection.reload();
  }

  async function rename(statueId: string, current: string) {
    const next = prompt('ポケモンの名前（空にすると元に戻ります）', current);
    if (next === null) return;
    const name = next.trim();
    if (name) await putStatueName({ statueId, name });
    else await deleteStatueName(statueId);
    await collection.reload();
  }

  async function savePhoto(statueId: string, blob: Blob) {
    await putStatuePhoto({ statueId, blob, takenAt: Date.now() });
    await collection.reload();
  }

  return (
    <article className="card">
      <div className="spot-head">
        <div>
          <p className="facility">{spot.facility}</p>
          <h2>
            <span className="floor">{spot.floor}</span>
            {spot.place}
          </h2>
        </div>
        {distance !== null && <p className="distance">{formatDistance(distance)}</p>}
      </div>

      <ul className="statues">
        {spot.statues.map((s) => {
          const photo = collection.statuePhotos.get(s.id);
          return (
            <li key={s.id} className={photo ? 'done' : ''}>
              {photo ? (
                <BlobImage blob={photo.blob} alt={s.name} className="thumb" />
              ) : (
                <div className="thumb empty" aria-hidden="true">
                  ?
                </div>
              )}
              <button type="button" className="name" onClick={() => rename(s.id, s.name)}>
                {s.name}
                {s.tentative && <span className="badge">仮</span>}
              </button>
              <div className="row-actions">
                <PhotoButton
                  label={photo ? '撮り直す' : '撮影する'}
                  className={photo ? '' : 'primary'}
                  onPhoto={(b) => savePhoto(s.id, b)}
                />
                {photo && (
                  <button type="button" onClick={() => shareOrDownload(photo.blob, `${s.id}.jpg`)}>
                    保存
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="actions">
        <a className="button" href={directionsUrl(spot)} target="_blank" rel="noopener noreferrer">
          Googleマップで道順
        </a>
        <button type="button" className="link" onClick={fixLocation}>
          ここを正しい位置にする
        </button>
        {overridden && (
          <button type="button" className="link" onClick={resetLocation}>
            位置を元に戻す
          </button>
        )}
      </div>
    </article>
  );
}
