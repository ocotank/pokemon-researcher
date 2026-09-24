import { type ChangeEvent, useRef, useState } from 'react';
import { toResizedJpeg, toThumbnailJpeg } from '../lib/image';

export type Photo = { blob: Blob; thumb: Blob };

type Props = {
  label: string;
  onPhotos: (photos: Photo[]) => void | Promise<void>;
  className?: string;
  multiple?: boolean;
};

export function PhotoButton({ label, onPhotos, className, multiple }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (files.length === 0) return;
    setProgress({ done: 0, total: files.length });
    try {
      const photos: Photo[] = [];
      for (const file of files) {
        const blob = await toResizedJpeg(file);
        const thumb = await toThumbnailJpeg(blob);
        photos.push({ blob, thumb });
        setProgress({ done: photos.length, total: files.length });
      }
      await onPhotos(photos);
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setProgress(null);
    }
  }

  const busyLabel = progress && (progress.total > 1 ? `処理中… ${progress.done}/${progress.total}` : '処理中…');

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={progress !== null}
        onClick={() => inputRef.current?.click()}
      >
        {busyLabel ?? label}
      </button>
      {/* capture を付けるとカメラが直接起動してしまうため、付けずに写真アプリからも選べるようにする */}
      <input ref={inputRef} type="file" accept="image/*" multiple={multiple} hidden onChange={handleChange} />
    </>
  );
}
