import { useEffect, useRef, useState } from 'react';

// 要素が画面に近づいたら true になり、以後 false には戻らない。
// 一度読み込んだ地図を再読み込みさせないため、あえて戻さない。
export function useInView<T extends Element>(rootMargin = '200px') {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;
    // 非対応環境（古い Safari やテスト）では最初から表示しておく
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setInView(true);
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView, rootMargin]);

  return { ref, inView };
}
