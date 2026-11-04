import type { Metadata } from 'next';
import { login } from '../../actions';

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
      ? 'Your session ended. Please sign in again.'
      : null;
  return (
    <main
      id="main"
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-900 to-wire-dark px-4"
    >
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-3">
          <svg width="36" height="36" viewBox="0 0 64 64" aria-hidden="true">
            <rect width="64" height="64" rx="14" fill="#faf8f3" />
            <path
              d="M8 38h10l6-18 10 28 8-22 4 12h10"
              fill="none"
              stroke="#5b3df5"
              strokeWidth="5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="54" cy="38" r="4.5" fill="#ffb703" />
          </svg>
          <span className="font-display text-2xl font-extrabold text-white">Synthwire admin</span>
        </div>
        <div className="rounded-xl bg-white p-6 shadow-2xl">
          <h1 className="text-lg font-bold text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">Authorised staff only. Activity is logged.</p>
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {error}
            </p>
          )}
          <form action={login} className="mt-5 space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-800">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="username"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-wire focus:outline-none focus:ring-2 focus:ring-wire/30"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-800">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-wire focus:outline-none focus:ring-2 focus:ring-wire/30"
              />
            </div>
            <button className="w-full rounded-md bg-wire px-4 py-2.5 text-sm font-semibold text-white hover:bg-wire-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wire">
              Sign in
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
