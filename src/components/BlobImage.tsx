import { useEffect, useState } from 'react';

type Props = { blob: Blob; alt: string; className?: string };

export function BlobImage({ blob, alt, className }: Props) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  if (!url) return null;
  return <img src={url} alt={alt} className={className} loading="lazy" decoding="async" />;
}
