import { Card, Field, button, inputCls } from './ui';
import { MarkdownEditor } from './MarkdownEditor';
import { ConfirmButton } from './ConfirmDialog';
import { deleteOriginalArticle, saveArticle } from '@/app/admin/actions-content';
import type { Me } from '@/lib/admin';

export type EditableArticle = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  categoryId: string;
  tags: string[];
  status: string;
  publishedAt: string;
  isFeatured: boolean;
  coverMediaId: string | null;
  coverUrl: string | null;
  imageAlt: string;
  seo: { metaTitle: string | null; metaDescription: string | null; noindex: boolean };
  author?: string | null;
};
export type MediaItem = { id: string; filename: string };

const API = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const toLocal = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

/** Create / edit one of OUR articles (the only kind with a body). */
export function ArticleEditor({
  article,
  categories,
  media,
  me,
  canFeature,
}: {
  article?: EditableArticle;
  categories: { id: string; name: string }[];
  media: MediaItem[];
  me: Me;
  canFeature: boolean;
}) {
  return (
    <form action={saveArticle} className="grid gap-6 lg:grid-cols-3">
      {article && <input type="hidden" name="target" value={article.id} />}
      <div className="space-y-5 lg:col-span-2">
        <Card>
          <div className="space-y-4">
            <Field label="Title" htmlFor="title">
              <input
                id="title"
                name="title"
                required
                minLength={3}
                maxLength={160}
                defaultValue={article?.title}
                className={`${inputCls} text-lg font-semibold`}
              />
            </Field>
            <Field
              label="Summary"
              htmlFor="excerpt"
              hint="Up to 300 characters. Shown on cards, in search results and as the standfirst."
            >
              <textarea
                id="excerpt"
                name="excerpt"
                required
                maxLength={300}
                rows={2}
                defaultValue={article?.excerpt}
                className={inputCls}
              />
            </Field>
            <div>
              <p className="mb-1 text-sm font-medium text-slate-800">Body</p>
              <MarkdownEditor name="body" defaultValue={article?.body ?? ''} rows={22} />
            </div>
          </div>
        </Card>
        <Card
          title="SEO overrides"
          description="Optional. Leave empty to use the title and summary."
        >
          <div className="space-y-3">
            <Field label="Meta title (max 70)" htmlFor="metaTitle">
              <input
                id="metaTitle"
                name="metaTitle"
                maxLength={70}
                defaultValue={article?.seo.metaTitle ?? ''}
                className={inputCls}
              />
            </Field>
            <Field label="Meta description (max 200)" htmlFor="metaDescription">
              <textarea
                id="metaDescription"
                name="metaDescription"
                maxLength={200}
                rows={2}
                defaultValue={article?.seo.metaDescription ?? ''}
                className={inputCls}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="noindex"
                defaultChecked={article?.seo.noindex}
                className="h-4 w-4 rounded border-slate-300"
              />{' '}
              Hide from search engines
            </label>
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card title="Publish">
          <div className="space-y-4">
            <Field label="Status" htmlFor="status">
              <select
                id="status"
                name="status"
                defaultValue={
                  article?.status === 'hidden' ? 'published' : (article?.status ?? 'draft')
                }
                className={inputCls}
              >
                <option value="draft">Draft (not public)</option>
                <option value="published">Published</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </Field>
            <Field
              label="Publish date (UTC)"
              htmlFor="publishedAt"
              hint="Needed for “Scheduled” (must be in the future). Empty = now."
            >
              <input
                id="publishedAt"
                name="publishedAt"
                type="datetime-local"
                defaultValue={toLocal(article?.publishedAt)}
                className={inputCls}
              />
            </Field>
            {canFeature && (
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  name="isFeatured"
                  defaultChecked={article?.isFeatured}
                  className="h-4 w-4 rounded border-slate-300"
                />{' '}
                Feature on the home page
              </label>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <button className={button('primary')}>
                {article ? 'Save changes' : 'Create article'}
              </button>
              {article && article.status === 'published' && (
                <a
                  href={`/article/${article.slug}`}
                  target="_blank"
                  rel="noopener"
                  className={button('secondary')}
                >
                  View page
                </a>
              )}
            </div>
          </div>
        </Card>
        <Card title="Organise">
          <div className="space-y-4">
            <Field label="Category" htmlFor="category">
              <select
                id="category"
                name="category"
                required
                defaultValue={article?.categoryId ?? ''}
                className={inputCls}
              >
                <option value="" disabled>
                  Choose…
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tags" htmlFor="tags" hint="Comma-separated, up to 10.">
              <input
                id="tags"
                name="tags"
                defaultValue={article?.tags.join(', ')}
                className={inputCls}
              />
            </Field>
            <Field
              label="Author name"
              htmlFor="authorName"
              hint={`Empty = ${me.name || me.email.split('@')[0]}`}
            >
              <input
                id="authorName"
                name="authorName"
                maxLength={100}
                defaultValue={article?.author ?? ''}
                className={inputCls}
              />
            </Field>
            <Field
              label="URL slug"
              htmlFor="slug"
              hint={
                article
                  ? 'Changing it changes the article’s address.'
                  : 'Empty = generated from the title.'
              }
            >
              <input
                id="slug"
                name="slug"
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={120}
                defaultValue={article?.slug}
                className={`${inputCls} font-mono`}
              />
            </Field>
          </div>
        </Card>
        <Card title="Cover image">
          <div className="space-y-4">
            {article?.coverMediaId && (
              <img
                src={`${API}/api/media/${article.coverMediaId}`}
                alt="Current cover"
                className="aspect-video w-full rounded-lg object-cover"
              />
            )}
            <Field
              label="Upload a new image"
              htmlFor="coverFile"
              hint="PNG, JPEG, WebP or SVG up to 2 MB."
            >
              <input
                id="coverFile"
                name="coverFile"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold hover:file:bg-slate-200"
              />
            </Field>
            {media.length > 0 && (
              <Field label="…or pick from the library" htmlFor="coverMediaId">
                <select
                  id="coverMediaId"
                  name="coverMediaId"
                  defaultValue={article?.coverMediaId ?? ''}
                  className={inputCls}
                >
                  <option value="">No library image</option>
                  {media.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.filename}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field
              label="…or an image URL"
              htmlFor="coverUrl"
              hint="https only. Ignored if you chose an upload or library image."
            >
              <input
                id="coverUrl"
                name="coverUrl"
                type="url"
                defaultValue={article?.coverUrl ?? ''}
                className={inputCls}
              />
            </Field>
            <Field label="Image description (alt text)" htmlFor="imageAlt">
              <input
                id="imageAlt"
                name="imageAlt"
                maxLength={300}
                defaultValue={article?.imageAlt}
                className={inputCls}
              />
            </Field>
          </div>
        </Card>
      </div>
    </form>
  );
}

/** Separate form (forms cannot nest) so deleting does not submit the editor. */
export function DeleteArticleForm({ id }: { id: string }) {
  return (
    <form action={deleteOriginalArticle}>
      <input type="hidden" name="target" value={id} />
      <ConfirmButton
        label="Delete article"
        title="Delete this article?"
        message="Our own articles are deleted for good. This cannot be undone."
        confirmLabel="Delete"
        className={button('dangerOutline')}
        danger
      />
    </form>
  );
}
