import { type ChangeEvent, useRef, useState } from 'react';
import { toResizedJpeg, toThumbnailJpeg } from '../lib/image';

type Props = {
  label: string;
  onPhoto: (photo: { blob: Blob; thumb: Blob }) => void | Promise<void>;
  className?: string;
};

export function PhotoButton({ label, onPhoto, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const blob = await toResizedJpeg(file);
      const thumb = await toThumbnailJpeg(blob);
      await onPhoto({ blob, thumb });
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={className} disabled={busy} onClick={() => inputRef.current?.click()}>
        {busy ? '処理中…' : label}
      </button>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleChange} />
    </>
  );
}
