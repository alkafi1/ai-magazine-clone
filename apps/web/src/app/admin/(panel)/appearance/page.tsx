import { THEMES, THEME_INFO, type AppearanceSettings } from '@aimag/shared';
import { Card, Field, Flash, PageHeader, button, inputCls } from '@/components/admin/ui';
import { adminApi, can, guard } from '@/lib/admin';
import { THEME_PREVIEW } from '@/lib/themes';
import { saveAppearance } from '../../actions-content';

const API = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const toLines = (links: { label: string; href: string }[]) =>
  links.map((l) => `${l.label} | ${l.href}`).join('\n');
const fileCls =
  'mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold hover:file:bg-slate-200';

function ImageField({
  name,
  label,
  hint,
  current,
}: {
  name: string;
  label: string;
  hint: string;
  current: string;
}) {
  return (
    <fieldset className="rounded-lg border border-slate-200 p-4">
      <legend className="px-1 text-sm font-semibold text-slate-900">{label}</legend>
      <p className="text-xs text-slate-500">{hint}</p>
      {current && (
        <div className="mt-3 flex items-center gap-3">
          <img
            src={`${API}/api/media/${current}`}
            alt={`Current ${label.toLowerCase()}`}
            className="h-12 max-w-40 rounded border border-slate-200 bg-[repeating-conic-gradient(#f1f5f9_0%_25%,#fff_0%_50%)] bg-[length:12px_12px] object-contain p-1"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={`${name}Remove`}
              className="h-4 w-4 rounded border-slate-300"
            />{' '}
            Remove
          </label>
        </div>
      )}
      <input type="hidden" name={name} value={current} />
      <label htmlFor={`${name}File`} className="mt-3 block text-sm font-medium text-slate-800">
        Upload a new image
      </label>
      <input
        id={`${name}File`}
        name={`${name}File`}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className={fileCls}
      />
    </fieldset>
  );
}

export default async function AppearanceAdmin({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const me = await guard('appearance.manage');
  const sp = await searchParams;
  const a = await adminApi<AppearanceSettings>('/settings/appearance');
  const canUpload = can(me, 'media.manage');

  return (
    <>
      <PageHeader
        title="Appearance"
        description="Your logo and name, the look of the whole public site, and its menus. Saved changes go live within a minute, without a redeploy."
      />
      <Flash ok={sp.ok} err={sp.err} />
      <form action={saveAppearance} encType="multipart/form-data" className="space-y-6">
        <Card
          title="Theme"
          description="Switch the whole public site between designs. Visitors can still toggle dark mode."
        >
          <fieldset>
            <legend className="sr-only">Theme</legend>
            <div className="grid gap-4 md:grid-cols-3">
              {THEMES.map((t) => {
                const p = THEME_PREVIEW[t];
                return (
                  <label
                    key={t}
                    className="group relative block cursor-pointer rounded-xl border-2 border-slate-200 p-3 transition has-[:checked]:border-wire has-[:checked]:ring-2 has-[:checked]:ring-wire/30 hover:border-slate-300"
                  >
                    <input
                      type="radio"
                      name="theme"
                      value={t}
                      defaultChecked={a.theme === t}
                      className="peer sr-only"
                    />
                    <div
                      aria-hidden="true"
                      className="overflow-hidden border"
                      style={{ background: p.bg, borderColor: p.mute, borderRadius: p.radius }}
                    >
                      <div
                        className="flex items-center justify-between px-3 py-2"
                        style={{
                          background: p.dark ? p.card : p.ink,
                          color: p.dark ? p.ink : p.bg,
                        }}
                      >
                        <span style={{ fontFamily: p.font, fontWeight: 800, fontSize: 13 }}>
                          {THEME_INFO[t].name}
                        </span>
                        <span
                          style={{
                            background: p.accent,
                            width: 28,
                            height: 6,
                            borderRadius: p.radius === '0px' ? 0 : 3,
                          }}
                        />
                      </div>
                      <div className="space-y-2 p-3">
                        <div
                          style={{
                            background: p.card,
                            border: `1px solid ${p.mute}`,
                            borderRadius: p.radius,
                            padding: 8,
                          }}
                        >
                          <div
                            style={{
                              background: p.accent,
                              height: 38,
                              borderRadius: p.radius === '0px' ? 0 : 6,
                              opacity: 0.9,
                            }}
                          />
                          <div
                            style={{
                              color: p.ink,
                              fontFamily: p.font,
                              fontWeight: 800,
                              fontSize: 13,
                              marginTop: 6,
                            }}
                          >
                            Headline of the day
                          </div>
                          <div
                            style={{ background: p.mute, height: 5, width: '80%', marginTop: 5 }}
                          />
                          <div
                            style={{ background: p.mute, height: 5, width: '55%', marginTop: 4 }}
                          />
                        </div>
                        <div className="flex gap-1.5">
                          <span style={{ background: p.highlight, height: 6, width: 30 }} />
                          <span style={{ background: p.mute, height: 6, flex: 1 }} />
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-900">
                      {THEME_INFO[t].name}
                      {a.theme === t && (
                        <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                          Current
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{THEME_INFO[t].description}</p>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </Card>

        <Card
          title="Branding"
          description="Name, tagline and logo appear in the header, footer, browser tab, search results and social cards."
        >
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Site name" htmlFor="name">
                <input
                  id="name"
                  name="name"
                  required
                  maxLength={40}
                  defaultValue={a.branding.name}
                  className={inputCls}
                />
              </Field>
              <Field
                label="Contact email"
                htmlFor="contactEmail"
                hint="Shown on the Contact and DMCA pages."
              >
                <input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  defaultValue={a.branding.contactEmail}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Tagline" htmlFor="tagline">
              <input
                id="tagline"
                name="tagline"
                maxLength={120}
                defaultValue={a.branding.tagline}
                className={inputCls}
              />
            </Field>
            <Field
              label="Description"
              htmlFor="description"
              hint="Used for search results and social sharing of the home page."
            >
              <textarea
                id="description"
                name="description"
                rows={2}
                maxLength={300}
                defaultValue={a.branding.description}
                className={inputCls}
              />
            </Field>
            {canUpload ? (
              <div className="grid gap-4 lg:grid-cols-3">
                <ImageField
                  name="logoMediaId"
                  label="Logo"
                  hint="Shown on light backgrounds. A wide image about 40 px tall works best."
                  current={a.branding.logoMediaId}
                />
                <ImageField
                  name="logoDarkMediaId"
                  label="Logo for dark backgrounds"
                  hint="Optional: used in dark mode and on the dark footer. Falls back to the main logo."
                  current={a.branding.logoDarkMediaId}
                />
                <ImageField
                  name="faviconMediaId"
                  label="Favicon"
                  hint="The small icon in the browser tab. Square PNG or SVG."
                  current={a.branding.faviconMediaId}
                />
              </div>
            ) : (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                Your role cannot upload images, so the logo and favicon stay as they are.
              </p>
            )}
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="showName"
                defaultChecked={a.branding.showName}
                className="h-4 w-4 rounded border-slate-300"
              />{' '}
              Show the site name next to the logo image
            </label>
          </div>
        </Card>

        <Card
          title="Menus"
          description="One link per line, written as: Label | /path  (or Label | https://…). Create pages under Pages, then link them here, e.g. “About us | /p/about-us”."
        >
          <div className="space-y-5">
            <fieldset>
              <legend className="text-sm font-medium text-slate-800">Header menu</legend>
              <div className="mt-2 flex flex-wrap gap-5 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="headerMode"
                    value="auto"
                    defaultChecked={a.navigation.header.mode === 'auto'}
                  />{' '}
                  Automatic (Latest + your first categories + a Topics menu)
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="headerMode"
                    value="custom"
                    defaultChecked={a.navigation.header.mode === 'custom'}
                  />{' '}
                  My own links
                </label>
              </div>
              <label
                htmlFor="headerItems"
                className="mt-3 block text-sm font-medium text-slate-800"
              >
                My own header links (used when “My own links” is chosen)
              </label>
              <textarea
                id="headerItems"
                name="headerItems"
                rows={5}
                defaultValue={toLines(a.navigation.header.items)}
                placeholder={'Latest | /latest\nRobotics | /category/robotics\nAbout | /about'}
                className={`${inputCls} font-mono text-xs`}
              />
            </fieldset>
            <Field
              label="Footer links"
              htmlFor="footerItems"
              hint="Empty = the standard footer links (Topics, About, Contact, Privacy, Terms, DMCA, RSS)."
            >
              <textarea
                id="footerItems"
                name="footerItems"
                rows={5}
                defaultValue={toLines(a.navigation.footer)}
                placeholder={'About us | /p/about-us\nPrivacy | /privacy'}
                className={`${inputCls} font-mono text-xs`}
              />
            </Field>
          </div>
        </Card>
        <button className={button('primary')}>Save appearance</button>
      </form>
    </>
  );
}
