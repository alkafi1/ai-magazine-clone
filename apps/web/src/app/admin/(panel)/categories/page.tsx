import { ConfirmButton } from '@/components/admin/ConfirmDialog';
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
  inputCls,
} from '@/components/admin/ui';
import { adminApi, guard, can, type Me } from '@/lib/admin';
import { deleteCategory, saveCategory } from '../../actions-content';

type Cat = {
  id: string;
  name: string;
  slug: string;
  description: string;
  order: number;
  showInMenu: boolean;
  articleCount: number;
  seo: { metaTitle: string | null; metaDescription: string | null; noindex: boolean };
};

function CategoryForm({ cat, openId }: { cat?: Cat; openId: string }) {
  const f = (n: string) => `${openId}-${n}`;
  return (
    <form action={saveCategory} className="space-y-4">
      <input type="hidden" name="_open" value={openId} />
      {cat && <input type="hidden" name="target" value={cat.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={f('name')}>
          <input
            id={f('name')}
            name="name"
            required
            minLength={2}
            maxLength={60}
            defaultValue={cat?.name}
            className={inputCls}
          />
        </Field>
        <Field
          label="URL slug"
          htmlFor={f('slug')}
          hint={
            cat
              ? 'Changing this changes the category’s address.'
              : 'Leave empty to generate from the name.'
          }
        >
          <input
            id={f('slug')}
            name="slug"
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={120}
            defaultValue={cat?.slug}
            className={inputCls}
          />
        </Field>
      </div>
      <Field
        label="Description"
        htmlFor={f('desc')}
        hint="Shown at the top of the category page and in search results."
      >
        <textarea
          id={f('desc')}
          name="description"
          rows={2}
          maxLength={300}
          defaultValue={cat?.description}
          className={inputCls}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Menu order" htmlFor={f('order')} hint="Lower numbers come first.">
          <input
            id={f('order')}
            name="order"
            type="number"
            min={0}
            max={10000}
            defaultValue={cat?.order ?? 100}
            className={inputCls}
          />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
          <input
            type="checkbox"
            name="showInMenu"
            defaultChecked={cat?.showInMenu ?? true}
            className="h-4 w-4 rounded border-slate-300"
          />{' '}
          Show in the site menu
        </label>
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
              defaultValue={cat?.seo.metaTitle ?? ''}
              className={inputCls}
            />
          </Field>
          <Field label="Meta description" htmlFor={f('md')}>
            <input
              id={f('md')}
              name="metaDescription"
              maxLength={200}
              defaultValue={cat?.seo.metaDescription ?? ''}
              className={inputCls}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="noindex"
              defaultChecked={cat?.seo.noindex}
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
        <button className={button('primary')}>{cat ? 'Save category' : 'Create category'}</button>
      </div>
    </form>
  );
}

export default async function CategoriesAdmin({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string; open?: string }>;
}) {
  const me: Me = await guard('articles.view');
  const sp = await searchParams;
  const { items } = await adminApi<{ items: Cat[] }>('/categories');
  const manage = can(me, 'categories.manage');
  return (
    <>
      <PageHeader
        title="Categories"
        description="Every story is filed under one category. Aggregated stories create their own categories automatically; you can rename or hide them here."
        actions={
          manage && (
            <Modal trigger="New category" title="New category" defaultOpen={sp.open === 'cat-new'}>
              <CategoryForm openId="cat-new" />
            </Modal>
          )
        }
      />
      <Flash ok={sp.ok} err={sp.err} />
      <Card padded={false}>
        <TableScroll label="Categories">
          <table className="w-full min-w-[640px]">
            <caption className="sr-only">Categories</caption>
            <thead className="bg-slate-50">
              <tr>
                <Th>Category</Th>
                <Th>URL</Th>
                <Th>Order</Th>
                <Th>Stories</Th>
                <Th>Menu</Th>
                {manage && <Th />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <p className="font-semibold text-slate-900">{c.name}</p>
                    {c.description && (
                      <p className="max-w-xs truncate text-xs text-slate-500">{c.description}</p>
                    )}
                  </Td>
                  <Td>
                    <a
                      href={`/category/${c.slug}`}
                      target="_blank"
                      rel="noopener"
                      className="font-mono text-xs text-wire-dark hover:underline"
                    >
                      /category/{c.slug}
                    </a>
                  </Td>
                  <Td>{c.order}</Td>
                  <Td>{c.articleCount}</Td>
                  <Td>
                    {c.showInMenu ? <Badge tone="green">Shown</Badge> : <Badge>Hidden</Badge>}
                  </Td>
                  {manage && (
                    <Td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Modal
                          trigger="Edit"
                          title={`Edit ${c.name}`}
                          triggerClassName={button('secondary', true)}
                          defaultOpen={sp.open === `cat-${c.id}`}
                        >
                          <CategoryForm cat={c} openId={`cat-${c.id}`} />
                        </Modal>
                        <form action={deleteCategory}>
                          <input type="hidden" name="target" value={c.id} />
                          <ConfirmButton
                            label="Delete"
                            title={`Delete “${c.name}”?`}
                            message={
                              c.articleCount
                                ? `${c.articleCount} stories are filed here, so it cannot be deleted. Move them to another category first.`
                                : 'This cannot be undone.'
                            }
                            confirmLabel="Delete"
                            className={button('dangerOutline', true)}
                            danger
                          />
                        </form>
                      </div>
                    </Td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <Empty>No categories yet.</Empty>}
        </TableScroll>
      </Card>
    </>
  );
}
