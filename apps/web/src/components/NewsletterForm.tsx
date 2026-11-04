'use client';

import { useState } from 'react';

type State = 'idle' | 'sending' | 'done' | 'error';

export function NewsletterForm() {
  const [state, setState] = useState<State>('idle');
  const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get('email');
    setState('sending');
    try {
      const res = await fetch(`${api}/api/newsletter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  }

  if (state === 'done')
    return (
      <p role="status" className="mt-4 font-semibold text-signal">
        Thanks — you’re on the list.
      </p>
    );
  return (
    <form onSubmit={onSubmit} className="mt-4 flex max-w-md gap-2">
      <label htmlFor="nl-email" className="sr-only">
        Email address
      </label>
      <input
        id="nl-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        className="min-w-0 flex-1 rounded-md bg-paper px-3 py-2 text-ink placeholder:text-slate"
      />
      <button
        type="submit"
        disabled={state === 'sending'}
        className="rounded-md bg-signal px-4 py-2 font-bold text-ink hover:brightness-95 disabled:opacity-60"
      >
        Subscribe
      </button>
      {state === 'error' && (
        <p role="alert" className="sr-only">
          Something went wrong. Please try again.
        </p>
      )}
    </form>
  );
}
