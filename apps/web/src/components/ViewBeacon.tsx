'use client';

import { useEffect } from 'react';

/** Counts one view per page load (pages are cached, so this has to happen in the browser). */
export function ViewBeacon({ slug }: { slug: string }) {
  useEffect(() => {
    const api = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
    navigator.sendBeacon?.(`${api}/api/articles/${slug}/view`);
  }, [slug]);
  return null;
}
