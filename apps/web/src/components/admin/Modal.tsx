'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' } as const;

/**
 * A button that opens a dialog. The dialog body is rendered on the server (usually a <form action=...>),
 * so nothing here knows about the form. Anything inside with `data-close` closes it (e.g. a Cancel button).
 * `defaultOpen` re-opens it after a failed submit so the error appears next to the person's input.
 */
export function Modal({
  trigger,
  title,
  description,
  children,
  size = 'md',
  defaultOpen = false,
  triggerClassName = 'rounded-md bg-wire px-3 py-2 text-sm font-semibold text-white hover:brightness-110',
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  size?: keyof typeof SIZES;
  defaultOpen?: boolean;
  triggerClassName?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (defaultOpen && ref.current && !ref.current.open) ref.current.showModal();
  }, [defaultOpen]);
  const titleId = useId();

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => ref.current?.showModal()}>
        {trigger}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onClick={(e) => {
          // click on the backdrop (the dialog element itself) or on anything marked data-close
          const t = e.target as HTMLElement;
          if (t === ref.current || t.closest('[data-close]')) ref.current?.close();
        }}
        className={`m-auto max-h-[90vh] w-[calc(100%-2rem)] ${SIZES[size]} overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-900/50`}
      >
        <div className="flex max-h-[90vh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold text-slate-900">
                {title}
              </h2>
              {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
            </div>
            <button
              type="button"
              data-close
              aria-label="Close"
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <svg
                viewBox="0 0 24 24"
                width="20"
                height="20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </header>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
        </div>
      </dialog>
    </>
  );
}
