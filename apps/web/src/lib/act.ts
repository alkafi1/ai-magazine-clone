import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AdminApiError, COOKIE } from './admin';

const SESSION_HOURS = 12;

export async function setSession(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/admin',
    maxAge: SESSION_HOURS * 3600, // matches the API token lifetime
  });
}

/**
 * Run an admin action, then redirect back with ?ok= or ?err=. API errors become messages the user can
 * read; anything unexpected is rethrown. (redirect() throws, so it must be called outside the try.)
 * `reopen`: on failure, re-open that modal (?open=<id>) so the person sees the error next to their input.
 */
export async function act(
  back: string,
  ok: string,
  fn: () => Promise<unknown>,
  reopen?: string,
): Promise<never> {
  let error: string | null = null;
  try {
    await fn();
  } catch (e) {
    if (e instanceof AdminApiError) error = e.message;
    else throw e;
  }
  const url = new URL(back, 'http://x');
  for (const k of ['ok', 'err', 'open']) url.searchParams.delete(k);
  url.searchParams.set(error ? 'err' : 'ok', error ?? ok);
  if (error && reopen) url.searchParams.set('open', reopen);
  redirect(url.pathname + url.search);
}
