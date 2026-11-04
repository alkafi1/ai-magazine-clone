'use client';

/** "Select all" for checkboxes that belong to another form (matched by the `form` attribute). */
export function SelectAll({ form, label = 'Select all rows' }: { form: string; label?: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      className="h-4 w-4 rounded border-slate-300"
      onChange={(e) => {
        document
          .querySelectorAll<HTMLInputElement>(`input[type=checkbox][name=ids][form="${form}"]`)
          .forEach((c) => (c.checked = e.currentTarget.checked));
      }}
    />
  );
}
