'use client';

import { useId, useRef } from 'react';

/**
 * A button that asks "are you sure?" in a modal before submitting the surrounding <form>.
 * Put it INSIDE the form: the dialog's confirm button is a normal submit button of that form.
 */
export function ConfirmButton({
  label,
  title,
  message,
  confirmLabel = 'Confirm',
  className,
  danger = false,
}: {
  label: string;
  title: string;
  message: string;
  confirmLabel?: string;
  className: string;
  danger?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.showModal()}>
        {label}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        className="m-auto w-full max-w-md rounded-xl border border-slate-200 p-0 shadow-2xl backdrop:bg-slate-900/50"
      >
        <div className="p-6">
          <h2 id={titleId} className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <p className="mt-2 text-sm text-slate-600">{message}</p>
        </div>
        <div className="flex justify-end gap-2 rounded-b-xl bg-slate-50 px-6 py-3">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`rounded-md px-3 py-2 text-sm font-semibold text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-wire hover:bg-wire-dark'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}
