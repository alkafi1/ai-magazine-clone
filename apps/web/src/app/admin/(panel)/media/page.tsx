import { ConfirmButton } from '@/components/admin/ConfirmDialog';
import { Card, Empty, Flash, PageHeader, button, fmtRelative } from '@/components/admin/ui';
import { adminApi, guard } from '@/lib/admin';
import { deleteMedia, uploadMedia } from '../../actions-content';

type Item = { id: string; filename: string; mime: string; size: number; createdAt: string };
const API = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const kb = (n: number) =>
  n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;

export default async function MediaAdmin({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await guard('media.manage');
  const sp = await searchParams;
  const { items } = await adminApi<{ items: Item[] }>('/media');
  return (
    <>
      <PageHeader
        title="Media library"
        description="Images for your logo, favicon and article covers. PNG, JPEG, WebP or SVG, up to 2 MB."
      />
      <Flash ok={sp.ok} err={sp.err} />
      <Card title="Upload an image" className="mb-6">
        <form action={uploadMedia} className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="file" className="block text-sm font-medium text-slate-800">
              Choose a file
            </label>
            <input
              id="file"
              name="file"
              type="file"
              required
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="mt-1 block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold hover:file:bg-slate-200"
            />
          </div>
          <button className={button('primary')}>Upload</button>
        </form>
      </Card>
      {items.length === 0 ? (
        <Card>
          <Empty>No images yet.</Empty>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((m) => (
            <li
              key={m.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex aspect-video items-center justify-center bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]">
                <img
                  src={`${API}/api/media/${m.id}`}
                  alt={m.filename}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="space-y-2 p-3">
                <p className="truncate text-sm font-semibold text-slate-900" title={m.filename}>
                  {m.filename}
                </p>
                <p className="text-xs text-slate-500">
                  {kb(m.size)} · {m.mime.replace('image/', '')} · {fmtRelative(m.createdAt)}
                </p>
                <input
                  readOnly
                  aria-label={`URL of ${m.filename}`}
                  value={`${API}/api/media/${m.id}`}
                  className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-600"
                />
                <form action={deleteMedia}>
                  <input type="hidden" name="target" value={m.id} />
                  <ConfirmButton
                    label="Delete"
                    title="Delete this image?"
                    message="If it is used as a cover, logo or favicon the delete is refused."
                    confirmLabel="Delete"
                    className={button('dangerOutline', true)}
                    danger
                  />
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
