'use client';

import { useEffect, useState } from 'react';

export function ReadingProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = document.getElementById('article-body');
      if (!el) {
        setPct(0);
        return;
      }
      const rect = el.getBoundingClientRect();
      const start = window.scrollY + rect.top;
      const height = el.offsetHeight - window.innerHeight;
      if (height <= 0) {
        setPct(1);
        return;
      }
      const scrolled = window.scrollY - start + 120;
      setPct(Math.min(1, Math.max(0, scrolled / height)));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 h-1 bg-mist/50"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct * 100)}
      aria-label="Reading progress"
    >
      <div
        className="h-full bg-wire transition-[width] duration-100"
        style={{ width: `${Math.round(pct * 100)}%` }}
      />
    </div>
  );
}
