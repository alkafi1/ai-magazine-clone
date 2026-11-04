import Link from 'next/link';
import { SearchBox } from '@/components/SearchBox';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="font-display text-7xl font-extrabold text-signal">404</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold">This page has gone off the wire</h1>
      <p className="mt-3 text-slate">
        The story may have been removed, or the link is wrong. Try a search or head back home.
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
