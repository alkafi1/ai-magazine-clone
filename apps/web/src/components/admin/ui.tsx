import type { ReactNode } from 'react';

/** Class strings shared by all admin screens. */
export const btn = {
  base: 'inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wire disabled:cursor-not-allowed disabled:opacity-50',
  primary: 'bg-wire text-white shadow-sm hover:bg-wire-dark',
  secondary: 'border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700',
  dangerOutline: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
  small: '!px-2.5 !py-1 text-xs',
} as const;
export const button = (kind: keyof Omit<typeof btn, 'base' | 'small'>, small = false) =>
  `${btn.base} ${btn[kind]} ${small ? btn.small : ''}`;

export const inputCls =
  'mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-wire focus:outline-none focus:ring-2 focus:ring-wire/30 disabled:bg-slate-100';

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className = '',
  padded = true,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}

const tones = {
  gray: 'bg-slate-100 text-slate-700 ring-slate-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  yellow: 'bg-amber-50 text-amber-800 ring-amber-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
} as const;
export type Tone = keyof typeof tones;
export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/** Success / error banner driven by ?ok= and ?err= (set by server actions after a redirect). */
export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  return err ? (
    <p
      role="alert"
      className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      {err}
    </p>
  ) : (
    <p
      role="status"
      className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
    >
      {ok}
    </p>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
        {typeof value === 'number' ? value.toLocaleString('en-GB') : value}
      </p>
      {hint && (
        <div className="mt-1 text-xs text-slate-500">
          {tone ? <Badge tone={tone}>{hint}</Badge> : hint}
        </div>
      )}
    </div>
  );
}

export const Th = ({ children, className = '' }: { children?: ReactNode; className?: string }) => (
  <th
    scope="col"
    className={`whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${className}`}
  >
    {children}
  </th>
);
export const Td = ({ children, className = '' }: { children?: ReactNode; className?: string }) => (
  <td className={`px-4 py-3 align-top text-sm text-slate-700 ${className}`}>{children}</td>
);

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-4 py-10 text-center text-sm text-slate-500">{children}</p>;
}

export const fmtDateTime = (iso: string | Date | null | undefined) =>
  iso ? new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '—';
export const fmtRelative = (iso: string | Date | null | undefined) => {
  if (!iso) return 'never';
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};
