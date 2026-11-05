'use client';

import { useEffect, useState } from 'react';

type Comment = { name: string; body: string; at: number };

const KEY = (slug: string) => `sw_comments_${slug}`;

function read(slug: string): Comment[] {
  try {
    const raw = localStorage.getItem(KEY(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function Comments({ slug }: { slug: string }) {
  const [items, setItems] = useState<Comment[]>([]);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    setItems(read(slug));
  }, [slug]);

  function post(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const b = body.trim();
    if (!n || !b) return;
    const next = [{ name: n, body: b, at: Date.now() }, ...items].slice(0, 100);
    setItems(next);
    try {
      localStorage.setItem(KEY(slug), JSON.stringify(next));
    } catch {
      /* ignore */
    }
    // Fire-and-forget to the API so the article is validated as live.
    const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    fetch(`${api}/api/articles/${slug}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: n, body: b }),
    }).catch(() => {});
    setBody('');
  }

  return (
    <section aria-labelledby="comments-h" className="mt-10 border-t border-mist pt-6">
      <h2 id="comments-h" className="font-display text-xl font-extrabold">
        Comments {items.length > 0 ? `(${items.length})` : ''}
      </h2>
      <p className="mt-1 text-xs text-slate">Saved in this browser only. Be kind.</p>

      <form onSubmit={post} className="mt-4 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          required
          placeholder="Your name"
          className="block w-full rounded-md border border-mist bg-card px-3 py-2 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          required
          rows={3}
          placeholder="Add a comment…"
          className="block w-full rounded-md border border-mist bg-card px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-md bg-wire px-4 py-2 text-sm font-bold text-on-wire hover:brightness-110"
        >
          Post comment
        </button>
      </form>

      {items.length > 0 && (
        <ul className="mt-6 space-y-4">
          {items.map((c, i) => (
            <li key={`${c.at}-${i}`} className="rounded-xl border border-mist bg-card p-4">
              <p className="text-sm font-semibold">{c.name}</p>
              <p className="mt-1 text-sm">{c.body}</p>
              <p className="mt-1 text-xs text-slate">{new Date(c.at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
