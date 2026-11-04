import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminApiError, adminApi } from '@/lib/admin';
import { saveSeo } from '../../actions';

type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string | null;
  author: string | null;
  publishedAt: string;
  sourceUrl: string;
  isHidden: boolean;
  viewCount: number;
  seo: {
    metaTitle: string | null;
    metaDescription: string | null;
    ogImage: string | null;
    noindex: boolean;
  };
};

const input = 'mt-1 w-full rounded border border-mist px-3 py-2';

export default async function EditArticle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[a-f0-9]{24}$/.test(id)) notFound();
  const a = await adminApi<Article>(`/articles/${id}`).catch((e) => {
    if (e instanceof AdminApiError && e.status === 404) notFound();
    throw e;
  });

  return (
    <>
      <Link href="/admin/articles" className="text-sm font-semibold text-wire-dark hover:underline">
        ← All articles
      </Link>
      <h1 className="mt-2 font-display text-3xl font-extrabold">{a.title}</h1>
      <p className="mt-1 text-sm text-slate">
        {a.category} · {a.author ?? 'no author'} · {a.publishedAt.slice(0, 10)} · {a.viewCount}{' '}
        views ·{' '}
        <a href={`/article/${a.slug}`} className="text-wire-dark underline">
          view page
        </a>
      </p>
      <p className="mt-3 max-w-2xl text-sm">{a.excerpt}</p>

      <form
        action={saveSeo}
        className="mt-8 max-w-xl space-y-4 rounded-xl border border-mist bg-card p-5"
      >
        <h2 className="font-display text-xl font-bold">SEO overrides</h2>
        {sp.saved && (
          <p role="status" className="rounded bg-green-50 p-3 text-sm text-green-800">
            Saved. The public page will refresh shortly.
          </p>
        )}
        {sp.error && (
          <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">
            Check the values: title ≤ 70 chars, description ≤ 200, image must be a full URL.
          </p>
        )}
        <input type="hidden" name="id" value={a.id} />
        <div>
          <label htmlFor="metaTitle" className="text-sm font-semibold">
            Meta title (max 70)
          </label>
          <input
            id="metaTitle"
            name="metaTitle"
            maxLength={70}
            defaultValue={a.seo.metaTitle ?? ''}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="metaDescription" className="text-sm font-semibold">
            Meta description (max 200)
          </label>
          <textarea
            id="metaDescription"
            name="metaDescription"
            maxLength={200}
            rows={3}
            defaultValue={a.seo.metaDescription ?? ''}
            className={input}
          />
        </div>
        <div>
          <label htmlFor="ogImage" className="text-sm font-semibold">
            OG image URL (optional)
          </label>
          <input
            id="ogImage"
            name="ogImage"
            type="url"
            defaultValue={a.seo.ogImage ?? ''}
            className={input}
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="noindex"
            defaultChecked={a.seo.noindex}
            className="h-4 w-4"
          />{' '}
          Hide from search engines (noindex)
        </label>
        <button className="rounded bg-ink px-5 py-2 font-bold text-paper hover:bg-wire-dark">
          Save
        </button>
      </form>
    </>
  );
}
