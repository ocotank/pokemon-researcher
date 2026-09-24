import { useEffect, useState } from 'react';
import type { Position } from '../hooks/useGeolocation';
import { putPanel } from '../lib/db';
import { errorText } from '../lib/errors';
import { BlobImage } from './BlobImage';
import { Sheet } from './Sheet';

export type PanelDraft = { blob: Blob; position: Promise<Position | null> };

type Props = { draft: PanelDraft; onClose: () => void; onSaved: () => Promise<void> };

export function PanelForm({ draft, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [memo, setMemo] = useState('');
  const [pos, setPos] = useState<Position | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    void draft.position.then((p) => alive && setPos(p));
    return () => {
      alive = false;
    };
  }, [draft]);

  async function save() {
    setSaving(true);
    let saved = false;
    try {
      await putPanel({
        id: crypto.randomUUID(),
        blob: draft.blob,
        name: name.trim(),
        memo: memo.trim(),
        takenAt: Date.now(),
        ...(pos ? { lat: pos.lat, lng: pos.lng, accuracy: pos.accuracy } : {}),
      });
      await onSaved();
      saved = true;
    } catch (e) {
      alert(`保存できませんでした: ${errorText(e)}`);
    } finally {
      if (!saved) setSaving(false);
    }
  }

  return (
    <Sheet title="パネルを登録" onClose={onClose}>
      <BlobImage blob={draft.blob} alt="撮影した写真" className="preview" />
      <label>
        ポケモン名（任意）
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label>
        メモ（任意）
        <textarea value={memo} onChange={(e) => setMemo(e.target.value)} />
      </label>
      <p className="muted">
        {pos === undefined
          ? '📍 現在地を取得中…'
          : pos
            ? `📍 現在地を記録します（誤差 ±${Math.round(pos.accuracy)}m）`
            : '📍 現在地は記録されません'}
      </p>
      <button type="button" className="primary big" disabled={saving} onClick={save}>
        {saving ? '保存中…' : '保存する'}
      </button>
    </Sheet>
  );
}
