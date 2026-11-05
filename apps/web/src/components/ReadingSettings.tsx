'use client';

import { useEffect, useRef, useState } from 'react';

const KEY = 'sw_reading_font';

export function ReadingSettings() {
  const [font, setFont] = useState<'base' | 'lg' | 'xl'>('base');
  const [speaking, setSpeaking] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v === 'lg' || v === 'xl') setFont(v);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const el = document.getElementById('article-body');
    if (!el) return;
    el.style.fontSize = font === 'base' ? '' : font === 'lg' ? '1.2rem' : '1.35rem';
    el.style.lineHeight = font === 'base' ? '' : '1.8';
    try {
      localStorage.setItem(KEY, font);
    } catch {
      /* ignore */
    }
  }, [font]);

  function speak() {
    if (!('speechSynthesis' in window)) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const el = document.getElementById('article-body');
    const text = el?.innerText ?? '';
    if (!text.trim()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.slice(0, 8000));
    u.rate = 0.95;
    utterRef.current = u;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-slate">Reading:</span>
      <div className="flex rounded border border-mist" role="group" aria-label="Text size">
        {(['base', 'lg', 'xl'] as const).map((size, i) => (
          <button
            key={size}
            type="button"
            onClick={() => setFont(size)}
            aria-pressed={font === size}
            className={`px-2.5 py-1 text-sm font-semibold ${
              font === size ? 'bg-wire text-on-wire' : 'hover:bg-mist/60'
            } ${i > 0 ? 'border-l border-mist' : ''}`}
          >
            {size === 'base' ? 'A' : size === 'lg' ? 'A+' : 'A++'}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={speak}
        className="rounded border border-mist px-2.5 py-1 text-sm font-semibold hover:bg-mist/60"
      >
        {speaking ? '■ Stop listen' : '▶ Listen'}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded border border-mist px-2.5 py-1 text-sm font-semibold hover:bg-mist/60"
      >
        Print
      </button>
    </div>
  );
}
