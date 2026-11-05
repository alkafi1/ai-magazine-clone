'use client';

import { useEffect, useState } from 'react';

type Bookmark = {
  slug: string;
  title: string;
  url: string;
  savedAt: number;
};

const KEY = 'sw_saved_articles';

function read(): Bookmark[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(list: Bookmark[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
  } catch {
    /* ignore */
  }
}

export function BookmarkButton({ slug, title }: { slug: string; title: string }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setSaved(read().some((b) => b.slug === slug));
  }, [slug]);

  function toggle() {
    const list = read();
    const exists = list.some((b) => b.slug === slug);
    if (exists) {
      write(list.filter((b) => b.slug !== slug));
      setSaved(false);
    } else {
      write([{ slug, title, url: `/article/${slug}`, savedAt: Date.now() }, ...list]);
      setSaved(true);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      className={`rounded border px-2.5 py-1 text-sm font-semibold ${
        saved ? 'border-wire bg-wire text-on-wire' : 'border-mist hover:bg-mist/60'
      }`}
    >
      {saved ? '★ Saved' : '☆ Save'}
    </button>
  );
}

export function SavedList() {
  const [items, setItems] = useState<Bookmark[]>([]);
  useEffect(() => {
    setItems(read());
  }, []);

  if (items.length === 0) {
    return (
      <p className="mt-8 text-slate">
        No saved articles yet. Tap “☆ Save” on any story to read it later.
      </p>
    );
  }

  return (
    <ul className="mt-6 space-y-3">
      {items.map((b) => (
        <li key={b.slug} className="rounded-xl border border-mist bg-card p-4">
          <a href={b.url} className="font-semibold hover:text-wire-dark hover:underline">
            {b.title}
          </a>
          <p className="mt-1 text-xs text-slate">
            Saved {new Date(b.savedAt).toLocaleDateString()}
          </p>
          <button
            type="button"
            onClick={(e) => {
              const btn = e.currentTarget;
              const list = read().filter((x) => x.slug !== b.slug);
              write(list);
              setItems(list);
              btn.closest('li')?.remove();
            }}
            className="mt-2 text-xs font-semibold text-wire-dark hover:underline"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  );
}
