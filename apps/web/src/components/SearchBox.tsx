export function SearchBox({ defaultValue = '' }: { defaultValue?: string }) {
  return (
    <form action="/search" role="search" className="flex w-full">
      <label htmlFor="q" className="sr-only">
        Search stories
      </label>
      <input
        id="q"
        name="q"
        type="search"
        minLength={2}
        maxLength={100}
        required
        defaultValue={defaultValue}
        placeholder="Search AI news…"
        className="w-full rounded-l-md border border-mist bg-card px-3 py-2 text-sm placeholder:text-slate"
      />
      <button
        type="submit"
        className="rounded-r-md bg-ink px-3 py-2 text-sm font-semibold text-paper hover:bg-wire-dark"
      >
        Search
      </button>
    </form>
  );
}
