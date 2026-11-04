import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  Badge,
  Card,
  Field,
  Flash,
  PageHeader,
  button,
  fmtDateTime,
  inputCls,
} from '@/components/admin/ui';
import { AdminApiError, adminApi, can, guard } from '@/lib/admin';
import { saveSeo } from '../../../actions';

type Article = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string | null;
  author: string | null;
  publishedAt: string;
  scrapedAt: string;
  sourceUrl: string;
  isHidden: boolean;
  isFeatured: boolean;
  viewCount: number;
  seo: {
    metaTitle: string | null;
    metaDescription: string | null;
    ogImage: string | null;
    noindex: boolean;
  };
};

export default async function EditArticle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const me = await guard('articles.view');
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[a-f0-9]{24}$/.test(id)) notFound();
  const a = await adminApi<Article>(`/articles/${id}`).catch((e) => {
    if (e instanceof AdminApiError && e.status === 404) notFound();
    throw e;
  });
  const editable = can(me, 'articles.seo');

  return (
    <>
      <Link href="/admin/articles" className="text-sm font-semibold text-wire-dark hover:underline">
        ← All articles
      </Link>
      <div className="mt-2" />
      <PageHeader
        title={a.title}
        description={`${a.category ?? 'No category'} · ${a.author ?? 'no author'} · published ${fmtDateTime(a.publishedAt)}`}
        actions={
          <>
            <a
              href={`/article/${a.slug}`}
              target="_blank"
              rel="noopener"
              className={button('secondary')}
            >
              View page
            </a>
            <a
              href={a.sourceUrl}
              target="_blank"
              rel="noopener nofollow"
              className={button('secondary')}
            >
              Original
            </a>
          </>
        }
      />
      <Flash ok={sp.ok} err={sp.err} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card
          title="SEO overrides"
          description={
            editable
              ? 'Leave a field empty to use the automatic value.'
              : 'You can view but not change these (requires the SEO permission).'
          }
          className="lg:col-span-2"
        >
          <form action={saveSeo} className="space-y-4">
            <input type="hidden" name="target" value={a.id} />
            <Field
              label="Meta title"
              htmlFor="metaTitle"
              hint="Up to 70 characters. Shown in search results and the browser tab."
            >
              <input
                id="metaTitle"
                name="metaTitle"
                maxLength={70}
                defaultValue={a.seo.metaTitle ?? ''}
                disabled={!editable}
                className={inputCls}
              />
            </Field>
            <Field label="Meta description" htmlFor="metaDescription" hint="Up to 200 characters.">
              <textarea
                id="metaDescription"
                name="metaDescription"
                maxLength={200}
                rows={3}
                defaultValue={a.seo.metaDescription ?? ''}
                disabled={!editable}
                className={inputCls}
              />
            </Field>
            <Field
              label="OG image URL"
              htmlFor="ogImage"
              hint="Optional. Overrides the generated social card."
            >
              <input
                id="ogImage"
                name="ogImage"
                type="url"
                defaultValue={a.seo.ogImage ?? ''}
                disabled={!editable}
                className={inputCls}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                name="noindex"
                defaultChecked={a.seo.noindex}
                disabled={!editable}
                className="h-4 w-4 rounded border-slate-300"
              />{' '}
              Hide from search engines (noindex, also removed from the sitemap)
            </label>
            {editable && <button className={button('primary')}>Save SEO settings</button>}
          </form>
        </Card>
        <Card title="Details">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">State</dt>
              <dd>
                {a.isHidden ? <Badge tone="red">Hidden</Badge> : <Badge tone="green">Live</Badge>}{' '}
                {a.isFeatured && <Badge tone="yellow">Featured</Badge>}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Views</dt>
              <dd className="font-medium">{a.viewCount}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Imported</dt>
              <dd>{fmtDateTime(a.scrapedAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Slug</dt>
              <dd className="mt-0.5 break-all font-mono text-xs">{a.slug}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-slate-600">{a.excerpt}</p>
        </Card>
      </div>
    </>
  );
}
