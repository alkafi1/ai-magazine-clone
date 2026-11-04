import type { SiteSettings } from '@aimag/shared';
import { Card, Field, Flash, PageHeader, button, inputCls } from '@/components/admin/ui';
import { adminApi, guard } from '@/lib/admin';
import { saveSiteSettings } from '../../actions';

const toLocalInput = (iso: string) => (iso ? new Date(iso).toISOString().slice(0, 16) : '');

export default async function SettingsAdmin({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await guard('settings.manage');
  const sp = await searchParams;
  const s = await adminApi<SiteSettings>('/settings/site');
  const social: [keyof SiteSettings['social'], string][] = [
    ['x', 'X / Twitter'],
    ['linkedin', 'LinkedIn'],
    ['youtube', 'YouTube'],
    ['facebook', 'Facebook'],
    ['instagram', 'Instagram'],
  ];

  return (
    <>
      <PageHeader
        title="Site settings"
        description="Everything here changes the public site without a redeploy."
      />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveSiteSettings} className="space-y-6">
        <Card
          title="Announcement bar"
          description="A slim banner above the header, for breaking news or notices."
        >
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="ann_enabled"
                defaultChecked={s.announcement.enabled}
                className="h-4 w-4 rounded border-slate-300"
              />{' '}
              Show the announcement
            </label>
            <Field label="Text" htmlFor="ann_text" hint="Up to 200 characters.">
              <input
                id="ann_text"
                name="ann_text"
                maxLength={200}
                defaultValue={s.announcement.text}
                className={inputCls}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Link (optional)" htmlFor="ann_href" hint="/latest or https://…">
                <input
                  id="ann_href"
                  name="ann_href"
                  defaultValue={s.announcement.href}
                  className={inputCls}
                />
              </Field>
              <Field label="Style" htmlFor="ann_tone">
                <select
                  id="ann_tone"
                  name="ann_tone"
                  defaultValue={s.announcement.tone}
                  className={inputCls}
                >
                  <option value="info">Info (violet)</option>
                  <option value="success">Success (green)</option>
                  <option value="warning">Notice (amber)</option>
                  <option value="breaking">Breaking (red)</option>
                </select>
              </Field>
              <Field
                label="Hide after (UTC)"
                htmlFor="ann_expires"
                hint="Empty = until you turn it off."
              >
                <input
                  id="ann_expires"
                  name="ann_expires"
                  type="datetime-local"
                  defaultValue={toLocalInput(s.announcement.expiresAt)}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        </Card>

        <Card title="Social links" description="Shown in the footer. Leave empty to hide.">
          <div className="grid gap-4 sm:grid-cols-2">
            {social.map(([k, label]) => (
              <Field key={k} label={label} htmlFor={`social_${k}`}>
                <input
                  id={`social_${k}`}
                  name={`social_${k}`}
                  type="url"
                  placeholder="https://…"
                  defaultValue={s.social[k]}
                  className={inputCls}
                />
              </Field>
            ))}
          </div>
        </Card>

        <Card
          title="Analytics"
          description="Google Analytics 4. Loaded only after the visitor accepts cookies."
        >
          <Field
            label="GA4 measurement ID"
            htmlFor="ga4Id"
            hint="Looks like G-ABCDEF1234. Empty = no analytics."
          >
            <input
              id="ga4Id"
              name="ga4Id"
              defaultValue={s.analytics.ga4Id}
              placeholder="G-…"
              className={`${inputCls} max-w-xs`}
            />
          </Field>
        </Card>

        <Card title="Features &amp; footer">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="feat_newsletter"
                defaultChecked={s.features.newsletter}
                className="h-4 w-4 rounded border-slate-300"
              />{' '}
              Newsletter sign-up form in the footer
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="feat_dark"
                defaultChecked={s.features.darkModeToggle}
                className="h-4 w-4 rounded border-slate-300"
              />{' '}
              Dark-mode toggle in the header
            </label>
            <Field
              label="Footer note"
              htmlFor="footerNote"
              hint="Optional extra line in the footer, up to 300 characters."
            >
              <textarea
                id="footerNote"
                name="footerNote"
                rows={2}
                maxLength={300}
                defaultValue={s.footerNote}
                className={inputCls}
              />
            </Field>
          </div>
        </Card>
        <button className={button('primary')}>Save settings</button>
      </form>
    </>
  );
}
