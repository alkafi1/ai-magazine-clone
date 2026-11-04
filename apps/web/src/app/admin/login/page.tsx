import type { Metadata } from 'next';
import { login } from '../actions';

export const metadata: Metadata = { title: 'Sign in' };

const messages: Record<string, string> = {
  '1': 'Invalid email or password.',
  rate: 'Too many attempts. Please wait a few minutes.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; expired?: string }>;
}) {
  const sp = await searchParams;
  const error = sp.error
    ? (messages[sp.error] ?? messages['1'])
    : sp.expired
      ? 'Your session expired. Please sign in again.'
      : null;
  return (
    <div className="mx-auto max-w-sm rounded-xl border border-mist bg-card p-6">
      <h1 className="font-display text-2xl font-extrabold">Sign in</h1>
      {error && (
        <p role="alert" className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      <form action={login} className="mt-4 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-semibold">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            className="mt-1 w-full rounded border border-mist px-3 py-2"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-semibold">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded border border-mist px-3 py-2"
          />
        </div>
        <button className="w-full rounded bg-ink px-4 py-2 font-bold text-paper hover:bg-wire-dark">
          Sign in
        </button>
      </form>
    </div>
  );
}
