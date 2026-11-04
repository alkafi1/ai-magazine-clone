import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | Synthwire admin' },
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="force-light min-h-screen bg-slate-50 text-slate-900">{children}</div>;
}
