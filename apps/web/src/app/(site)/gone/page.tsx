import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchBox } from '@/components/SearchBox';

// Served with HTTP 410 by proxy.ts for taken-down stories, so search engines drop the URL for good.
export const metadata: Metadata = {
  title: 'Story removed',
  robots: { index: false, follow: true },
};

export default function Gone() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-display text-7xl font-extrabold text-signal">410</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold">This story has been removed</h1>
      <p className="mt-3 text-slate">
        It is no longer listed on Synthwire. Try a search, or head back to the front page.
      </p>
      <div className="mx-auto mt-6 max-w-sm">
        <SearchBox />
      </div>
      <Link href="/" className="mt-6 inline-block font-semibold text-wire-dark underline">
        Back to the front page
      </Link>
    </div>
  );
}
