import { SITE, safeHttpsUrl } from '@/lib/site';

export function SourceAttribution({ url, author }: { url: string; author?: string | null }) {
  const href = safeHttpsUrl(url);
  return (
    <aside aria-label="Original source" className="rounded-xl border-2 border-ink bg-card p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-slate">Original reporting</p>
      <p className="mt-2 text-ink">
        This is a short summary. The full story{author ? ` by ${author}` : ''} was published by{' '}
        <strong>{SITE.sourceName}</strong>.
      </p>
      <a
        href={href ?? SITE.sourceUrl}
        target="_blank"
        rel="noopener nofollow"
        className="mt-4 inline-block rounded-md bg-wire px-5 py-3 font-bold text-on-wire hover:brightness-110"
      >
        Read the full story at {SITE.sourceName} ↗
      </a>
    </aside>
  );
}
