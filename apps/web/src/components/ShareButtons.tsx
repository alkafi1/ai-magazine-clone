import { abs } from '@/lib/site';
import { CopyLink } from './CopyLink';

export function ShareButtons({ path, title }: { path: string; title: string }) {
  const url = encodeURIComponent(abs(path));
  const text = encodeURIComponent(title);
  const items = [
    ['X', `https://twitter.com/intent/tweet?url=${url}&text=${text}`],
    ['LinkedIn', `https://www.linkedin.com/sharing/share-offsite/?url=${url}`],
    ['Email', `mailto:?subject=${text}&body=${url}`],
  ] as const;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold text-slate">Share:</span>
      {items.map(([label, href]) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded border border-mist px-2.5 py-1 font-semibold hover:bg-mist/60"
        >
          {label}
        </a>
      ))}
      <CopyLink url={abs(path)} />
    </div>
  );
}
