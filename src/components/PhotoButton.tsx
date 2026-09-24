import { useRef, useState, type ChangeEvent } from 'react';
import { toResizedJpeg } from '../lib/image';

type Props = { label: string; onPhoto: (jpeg: Blob) => void | Promise<void>; className?: string };

export function PhotoButton({ label, onPhoto, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      await onPhoto(await toResizedJpeg(file));
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
