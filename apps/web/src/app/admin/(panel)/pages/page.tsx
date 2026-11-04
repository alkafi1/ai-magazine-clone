import { ConfirmButton } from '@/components/admin/ConfirmDialog';
import { MarkdownEditor } from '@/components/admin/MarkdownEditor';
import { Modal } from '@/components/admin/Modal';
import {
  Badge,
  Card,
  Empty,
  Field,
  Flash,
  PageHeader,
  TableScroll,
  Td,
  Th,
  button,
  fmtRelative,
  inputCls,
} from '@/components/admin/ui';
import { adminApi, guard } from '@/lib/admin';
import { deletePage, savePage } from '../../actions-content';

type PageRow = {
  id: string;
  slug: string;
  title: string;
  body: string;
  status: 'draft' | 'published';
  updatedAt: string;
  seo: { metaTitle: string | null; metaDescription: string | null; noindex: boolean };
};
const BUILTIN = ['about', 'contact', 'privacy', 'terms', 'dmca'];

function PageForm({ page, openId }: { page?: PageRow; openId: string }) {
  const f = (n: string) => `${openId}-${n}`;
  return (
    <form action={savePage} className="space-y-4">
      <input type="hidden" name="_open" value={openId} />
      {page && <input type="hidden" name="target" value={page.id} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <Field label="Title" htmlFor={f('title')}>
            <input
              id={f('title')}
              name="title"
              required
              minLength={2}
              maxLength={160}
              defaultValue={page?.title}
              className={inputCls}
            />
          </Field>
        </div>
        <Field label="Status" htmlFor={f('status')}>
          <select
            id={f('status')}
            name="status"
            defaultValue={page?.status ?? 'draft'}
            className={inputCls}
          >
            <option value="draft">Draft (not public)</option>
            <option value="published">Published</option>
          </select>
        </Field>
      </div>
      <Field
        label="URL slug"
        htmlFor={f('slug')}
        hint={`The page lives at /p/<slug>. Use about, contact, privacy, terms or dmca to replace that built-in page.`}
      >
        <input
          id={f('slug')}
          name="slug"
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          maxLength={120}
          defaultValue={page?.slug}
          placeholder="auto from the title"
          className={`${inputCls} max-w-md font-mono`}
        />
      </Field>
      <div>
        <p className="mb-1 text-sm font-medium text-slate-800">Content</p>
        <MarkdownEditor name="body" id={f('body')} defaultValue={page?.body ?? ''} rows={14} />
      </div>
      <details className="rounded-lg border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          SEO overrides
        </summary>
        <div className="mt-3 space-y-3">
          <Field label="Meta title" htmlFor={f('mt')}>
            <input
              id={f('mt')}
              name="metaTitle"
              maxLength={70}
              defaultValue={page?.seo.metaTitle ?? ''}
              className={inputCls}
            />
          </Field>
          <Field label="Meta description" htmlFor={f('md')}>
            <input
              id={f('md')}
              name="metaDescription"
              maxLength={200}
              defaultValue={page?.seo.metaDescription ?? ''}
              className={inputCls}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="noindex"
              defaultChecked={page?.seo.noindex}
              className="h-4 w-4 rounded border-slate-300"
            />{' '}
            Hide from search engines
          </label>
        </div>
      </details>
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <button type="button" data-close className={button('secondary')}>
          Cancel
        </button>
        <button className={button('primary')}>{page ? 'Save page' : 'Create page'}</button>
      </div>
    </form>
  );
}

export default async function PagesAdmin({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string; open?: string }>;
}) {
  await guard('pages.manage');
  const sp = await searchParams;
  const { items } = await adminApi<{ items: PageRow[] }>('/pages');
  return (
    <>
      <PageHeader
        title="Pages"
        description="Your own pages (About us, a team page, a newsletter policy…). Add them to the menu under Appearance."
        actions={
          <Modal trigger="New page" title="New page" size="xl" defaultOpen={sp.open === 'page-new'}>
            <PageForm openId="page-new" />
          </Modal>
        }
      />
      <Flash ok={sp.ok} err={sp.err} />
      <Card padded={false}>
        <TableScroll label="Pages">
          <table className="w-full min-w-[640px]">
            <caption className="sr-only">Custom pages</caption>
            <thead className="bg-slate-50">
              <tr>
                <Th>Page</Th>
                <Th>Address</Th>
                <Th>Status</Th>
                <Th>Updated</Th>
                <Th />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((p) => {
                const path = BUILTIN.includes(p.slug) ? `/${p.slug}` : `/p/${p.slug}`;
                return (
                  <tr key={p.id}>
                    <Td className="font-semibold text-slate-900">
                      {p.title}
                      {BUILTIN.includes(p.slug) && (
                        <span className="ml-2">
                          <Badge tone="blue">Replaces built-in</Badge>
                        </span>
                      )}
                    </Td>
                    <Td>
                      {p.status === 'published' ? (
                        <a
                          href={path}
                          target="_blank"
                          rel="noopener"
                          className="font-mono text-xs text-wire-dark hover:underline"
                        >
                          {path}
                        </a>
                      ) : (
                        <span className="font-mono text-xs text-slate-500">{path}</span>
                      )}
                    </Td>
                    <Td>
                      {p.status === 'published' ? (
                        <Badge tone="green">Published</Badge>
                      ) : (
                        <Badge>Draft</Badge>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">{fmtRelative(p.updatedAt)}</Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Modal
                          trigger="Edit"
                          title={`Edit ${p.title}`}
                          size="xl"
                          triggerClassName={button('secondary', true)}
                          defaultOpen={sp.open === `page-${p.id}`}
                        >
                          <PageForm page={p} openId={`page-${p.id}`} />
                        </Modal>
                        <form action={deletePage}>
                          <input type="hidden" name="target" value={p.id} />
                          <ConfirmButton
                            label="Delete"
                            title={`Delete “${p.title}”?`}
                            message="The page disappears from the site. This cannot be undone."
                            confirmLabel="Delete"
                            className={button('dangerOutline', true)}
                            danger
                          />
                        </form>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {items.length === 0 && <Empty>No custom pages yet. Create one with “New page”.</Empty>}
        </TableScroll>
      </Card>
    </>
  );
}
