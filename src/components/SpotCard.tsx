import type { Spot } from '../data/spots';
import type { Collection } from '../hooks/useCollection';
import type { Position } from '../hooks/useGeolocation';
import {
  deleteSpotOverride,
  deleteStatueName,
  putSpotOverride,
  putSpotPhoto,
  putStatueName,
  putStatuePhoto,
} from '../lib/db';
import { errorText } from '../lib/errors';
import { formatDistance } from '../lib/geo';
import { shareOrDownload } from '../lib/share';
import { BlobImage } from './BlobImage';
import { PhotoButton } from './PhotoButton';
import { SpotMap } from './SpotMap';

type Props = { spot: Spot; distance: number | null; collection: Collection; here: Position | null };

export function SpotCard({ spot, distance, collection, here }: Props) {
  const overridden = collection.spotOverrides.has(spot.id);
  const spotPhoto = collection.spotPhotos.get(spot.id);

  async function fixLocation() {
    if (!here) {
      alert('現在地がまだ取得できていません');
      return;
    }
    const ok = confirm(
      `「${spot.facility} ${spot.floor} ${spot.place}」の位置を現在地（誤差 ±${Math.round(here.accuracy)}m）にしますか？`,
    );
    if (!ok) return;
    try {
      await putSpotOverride({ spotId: spot.id, lat: here.lat, lng: here.lng });
    } catch (e) {
      alert(`保存できませんでした: ${errorText(e)}`);
      return;
    }
    try {
      await collection.reload();
    } catch {
      alert('表示を更新できませんでした。アプリを開き直してください');
    }
  }

  async function resetLocation() {
    try {
      await deleteSpotOverride(spot.id);
    } catch (e) {
      alert(`削除できませんでした: ${errorText(e)}`);
      return;
    }
    try {
      await collection.reload();
    } catch {
      alert('表示を更新できませんでした。アプリを開き直してください');
    }
  }

  async function rename(statueId: string, current: string) {
    const next = prompt('ポケモンの名前（空にすると元に戻ります）', current);
    if (next === null) return;
    const name = next.trim();
    try {
      if (name) await putStatueName({ statueId, name });
      else await deleteStatueName(statueId);
    } catch (e) {
      alert(`${name ? '保存' : '削除'}できませんでした: ${errorText(e)}`);
      return;
    }
    try {
      await collection.reload();
    } catch {
      alert('表示を更新できませんでした。アプリを開き直してください');
    }
  }

  async function savePhoto(statueId: string, photo: { blob: Blob; thumb: Blob }) {
    try {
      await putStatuePhoto({ statueId, ...photo, takenAt: Date.now() });
    } catch (e) {
      alert(`保存できませんでした: ${errorText(e)}`);
      return;
    }
    try {
      await collection.reload();
    } catch {
      alert('表示を更新できませんでした。アプリを開き直してください');
    }
  }

  async function saveSpotPhoto(photo: { blob: Blob; thumb: Blob }) {
    try {
      await putSpotPhoto({ spotId: spot.id, ...photo, takenAt: Date.now() });
    } catch (e) {
      alert(`保存できませんでした: ${errorText(e)}`);
      return;
    }
    try {
      await collection.reload();
    } catch {
      alert('表示を更新できませんでした。アプリを開き直してください');
    }
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

      <SpotMap at={spot} label={`${spot.facility} ${spot.floor} ${spot.place}`} />

      <ul className="statues">
        {spot.statues.map((s) => {
          const photo = collection.statuePhotos.get(s.id);
          return (
            <li key={s.id} className={photo ? 'done' : ''}>
              {photo ? (
                <BlobImage blob={photo.thumb ?? photo.blob} alt={s.name} className="thumb" />
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
                  onPhotos={([photo]) => savePhoto(s.id, photo)}
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

        <li className={`overall ${spotPhoto ? 'done' : ''}`}>
          {spotPhoto ? (
            <BlobImage blob={spotPhoto.thumb ?? spotPhoto.blob} alt="全体写真" className="thumb" />
          ) : (
            <div className="thumb empty" aria-hidden="true">
              ?
            </div>
          )}
          <span className="name">全体写真</span>
          <div className="row-actions">
            <PhotoButton
              label={spotPhoto ? '撮り直す' : '撮影する'}
              className={spotPhoto ? '' : 'primary'}
              onPhotos={([photo]) => saveSpotPhoto(photo)}
            />
            {spotPhoto && (
              <button type="button" onClick={() => shareOrDownload(spotPhoto.blob, `${spot.id}-overall.jpg`)}>
                保存
              </button>
            )}
          </div>
        </li>
      </ul>

      <div className="actions">
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
