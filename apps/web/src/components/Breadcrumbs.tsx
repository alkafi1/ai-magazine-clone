import Link from 'next/link';
import { JsonLd } from './JsonLd';
import { breadcrumbLd } from '@/lib/jsonld';

export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-slate">
      <JsonLd data={breadcrumbLd(items)} />
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <li key={it.path} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {i === items.length - 1 ? (
              <span aria-current="page" className="font-semibold text-ink">
                {it.name}
              </span>
            ) : (
              <Link href={it.path} className="hover:text-wire-dark hover:underline">
                {it.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
