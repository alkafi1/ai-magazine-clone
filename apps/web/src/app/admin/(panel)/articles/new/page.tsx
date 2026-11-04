import Link from 'next/link';
import { ArticleEditor, type MediaItem } from '@/components/admin/ArticleEditor';
import { Flash, PageHeader } from '@/components/admin/ui';
import { adminApi, can, guard } from '@/lib/admin';

export const metadata = { title: 'New article' };

export default async function NewArticle({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  const me = await guard('articles.write');
  const sp = await searchParams;
  const [cats, media] = await Promise.all([
    adminApi<{ items: { id: string; name: string }[] }>('/categories'),
    can(me, 'media.manage')
      ? adminApi<{ items: MediaItem[] }>('/media').catch(() => ({ items: [] }))
      : Promise.resolve({ items: [] as MediaItem[] }),
  ]);
  return (
    <>
      <Link href="/admin/articles" className="text-sm font-semibold text-wire-dark hover:underline">
        ← All articles
      </Link>
      <div className="mt-2" />
      <PageHeader
        title="New article"
        description="Written by you: it has its own page with the full text and no source link."
      />
      <Flash err={sp.err} />
      <ArticleEditor
        categories={cats.items}
        media={media.items}
        me={me}
        canFeature={can(me, 'articles.feature')}
      />
    </>
  );
}
