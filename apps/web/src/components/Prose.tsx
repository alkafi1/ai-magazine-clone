import type { ReactNode } from 'react';

export function Prose({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-4xl font-extrabold">{title}</h1>
      {updated && <p className="mt-1 text-sm text-slate">Last updated {updated}</p>}
      <div className="mt-6 space-y-4 leading-relaxed text-ink/90 [&_a]:font-semibold [&_a]:text-wire-dark [&_a]:underline [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </div>
  );
}
