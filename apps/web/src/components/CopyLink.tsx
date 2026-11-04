'use client';

import { useState } from 'react';

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt('Copy this link:', url);
        }
      }}
      className="rounded border border-mist px-2.5 py-1 font-semibold hover:bg-mist/60"
    >
      {copied ? 'Copied ✓' : 'Copy link'}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'Link copied to clipboard' : ''}
      </span>
    </button>
  );
}
