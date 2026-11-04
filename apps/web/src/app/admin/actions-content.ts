'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { AdminApiError, adminApi, adminUpload } from '@/lib/admin';
import { act } from '@/lib/act';

const text = (f: FormData, name: string) => String(f.get(name) ?? '').trim();
const checked = (f: FormData, name: string) => f.get(name) === 'on';
const reopen = (f: FormData) => text(f, '_open') || undefined;
const idSchema = z.string().regex(/^[a-f0-9]{24}$/);
const nullable = (v: string) => (v === '' ? null : v);
/** <input type=datetime-local> values are shown and entered in UTC here; parse them as UTC, not as the server's local time. */
const utcIso = (v: string) =>
  new Date(/(Z|[+-]\d\d:?\d\d)$/.test(v) ? v : `${v}:00Z`).toISOString();
const file = (f: FormData, name: string): File | null => {
  const v = f.get(name);
  return v instanceof File && v.size > 0 ? v : null;
};

// ---- roles -----------------------------------------------------------------------------------
export async function saveRole(formData: FormData) {
  const key = text(formData, 'key'); // present when editing
  const body = {
    name: text(formData, 'name'),
    description: text(formData, 'description'),
    rank: Number(text(formData, 'rank')),
    permissions: formData.getAll('perm').map(String),
  };
  await act(
    '/admin/roles',
    key
      ? `Role “${body.name}” updated. Everyone holding it has the new permissions now.`
      : `Role “${body.name}” created.`,
    () =>
      key
        ? adminApi(`/roles/${encodeURIComponent(key)}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : adminApi('/roles', { method: 'POST', body: JSON.stringify(body) }),
    reopen(formData),
  );
}

export async function deleteRole(formData: FormData) {
  const key = text(formData, 'key');
  await act('/admin/roles', 'Role deleted.', () =>
    adminApi(`/roles/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  );
}

// ---- categories ------------------------------------------------------------------------------
export async function saveCategory(formData: FormData) {
  const target = text(formData, 'target');
  const body = {
    name: text(formData, 'name'),
    ...(text(formData, 'slug') ? { slug: text(formData, 'slug') } : {}),
    description: text(formData, 'description'),
    order: Number(text(formData, 'order')) || 100,
    showInMenu: checked(formData, 'showInMenu'),
    seo: {
      metaTitle: nullable(text(formData, 'metaTitle')),
      metaDescription: nullable(text(formData, 'metaDescription')),
      noindex: checked(formData, 'noindex'),
    },
  };
  await act(
    '/admin/categories',
    target ? 'Category updated.' : 'Category created.',
    () =>
      target
        ? adminApi(`/categories/${idSchema.parse(target)}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : adminApi('/categories', { method: 'POST', body: JSON.stringify(body) }),
    reopen(formData),
  );
}

export async function deleteCategory(formData: FormData) {
  const id = idSchema.parse(text(formData, 'target'));
  await act('/admin/categories', 'Category deleted.', () =>
    adminApi(`/categories/${id}`, { method: 'DELETE' }),
  );
}

// ---- pages -----------------------------------------------------------------------------------
export async function savePage(formData: FormData) {
  const target = text(formData, 'target');
  const body = {
    ...(text(formData, 'slug') ? { slug: text(formData, 'slug') } : {}),
    title: text(formData, 'title'),
    body: String(formData.get('body') ?? ''),
    status: text(formData, 'status') || 'draft',
    seo: {
      metaTitle: nullable(text(formData, 'metaTitle')),
      metaDescription: nullable(text(formData, 'metaDescription')),
      noindex: checked(formData, 'noindex'),
    },
  };
  await act(
    '/admin/pages',
    target ? 'Page saved.' : 'Page created.',
    () =>
      target
        ? adminApi(`/pages/${idSchema.parse(target)}`, {
            method: 'PUT',
            body: JSON.stringify(body),
          })
        : adminApi('/pages', { method: 'POST', body: JSON.stringify(body) }),
    reopen(formData),
  );
}

export async function deletePage(formData: FormData) {
  const id = idSchema.parse(text(formData, 'target'));
  await act('/admin/pages', 'Page deleted.', () => adminApi(`/pages/${id}`, { method: 'DELETE' }));
}

// ---- media -----------------------------------------------------------------------------------
export async function uploadMedia(formData: FormData) {
  const f = file(formData, 'file');
  await act('/admin/media', 'Image uploaded.', async () => {
    if (!f) throw new AdminApiError(400, 'Choose an image first.');
    await adminUpload(f);
  });
}

export async function deleteMedia(formData: FormData) {
  const id = idSchema.parse(text(formData, 'target'));
  await act('/admin/media', 'Image deleted.', () => adminApi(`/media/${id}`, { method: 'DELETE' }));
}

// ---- original articles -----------------------------------------------------------------------
export async function saveArticle(formData: FormData) {
  const target = text(formData, 'target');
  const publishedAt = text(formData, 'publishedAt');
  const upload = file(formData, 'coverFile');
  let id = target;
  let error: string | null = null;
  try {
    const coverMediaId = upload
      ? await adminUpload(upload)
      : nullable(text(formData, 'coverMediaId'));
    const body = {
      title: text(formData, 'title'),
      ...(text(formData, 'slug') ? { slug: text(formData, 'slug') } : {}),
      excerpt: text(formData, 'excerpt'),
      body: String(formData.get('body') ?? ''),
      category: text(formData, 'category'),
      tags: text(formData, 'tags')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      authorName: text(formData, 'authorName') || undefined,
      coverMediaId,
      coverUrl: coverMediaId ? null : nullable(text(formData, 'coverUrl')),
      imageAlt: text(formData, 'imageAlt'),
      status: text(formData, 'status') || 'draft',
      publishedAt: publishedAt ? utcIso(publishedAt) : null,
      isFeatured: checked(formData, 'isFeatured'),
      seo: {
        metaTitle: nullable(text(formData, 'metaTitle')),
        metaDescription: nullable(text(formData, 'metaDescription')),
        noindex: checked(formData, 'noindex'),
      },
    };
    const res = await (target
      ? adminApi<{ id: string }>(`/articles/${idSchema.parse(target)}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        })
      : adminApi<{ id: string }>('/articles', { method: 'POST', body: JSON.stringify(body) }));
    id = res.id;
  } catch (e) {
    if (e instanceof AdminApiError) error = e.message;
    else throw e;
  }
  const here = target ? `/admin/articles/${target}` : '/admin/articles/new';
  if (error) redirect(`${here}?err=${encodeURIComponent(error)}`);
  redirect(
    `/admin/articles/${id}?ok=${encodeURIComponent(target ? 'Article saved.' : 'Article created.')}`,
  );
}

export async function deleteOriginalArticle(formData: FormData) {
  const id = idSchema.parse(text(formData, 'target'));
  await act('/admin/articles', 'Article deleted.', () =>
    adminApi(`/articles/${id}`, { method: 'DELETE' }),
  );
}

// ---- appearance: branding, theme, navigation ---------------------------------------------------
const parseLinks = (raw: string) =>
  raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [label, ...rest] = l.split('|');
      return { label: (label ?? '').trim(), href: rest.join('|').trim() };
    });

export async function saveAppearance(formData: FormData) {
  await act(
    '/admin/appearance',
    'Appearance saved. The public site updates within a minute.',
    async () => {
      // new uploads win over the library choice; "remove" clears it
      const pick = async (field: string) => {
        const up = file(formData, `${field}File`);
        if (up) return adminUpload(up);
        if (checked(formData, `${field}Remove`)) return '';
        return text(formData, field);
      };
      const body = {
        theme: text(formData, 'theme'),
        branding: {
          name: text(formData, 'name'),
          tagline: text(formData, 'tagline'),
          description: text(formData, 'description'),
          logoMediaId: await pick('logoMediaId'),
          logoDarkMediaId: await pick('logoDarkMediaId'),
          faviconMediaId: await pick('faviconMediaId'),
          showName: checked(formData, 'showName'),
          contactEmail: text(formData, 'contactEmail'),
        },
        navigation: {
          header: {
            mode: text(formData, 'headerMode') === 'custom' ? 'custom' : 'auto',
            items: parseLinks(String(formData.get('headerItems') ?? '')),
          },
          footer: parseLinks(String(formData.get('footerItems') ?? '')),
        },
      };
      await adminApi('/settings/appearance', { method: 'PUT', body: JSON.stringify(body) });
    },
  );
}
