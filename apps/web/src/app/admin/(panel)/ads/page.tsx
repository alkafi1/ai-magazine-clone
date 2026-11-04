import { PLACEMENT_KEYS, PLACEMENT_LABELS, type AdsSettings } from '@aimag/shared';
import { Badge, Card, Field, Flash, PageHeader, button, inputCls } from '@/components/admin/ui';
import { adminApi, guard } from '@/lib/admin';
import { saveAdsSettings } from '../../actions';

export default async function AdsAdmin({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await guard('ads.manage');
  const sp = await searchParams;
  const ads = await adminApi<AdsSettings>('/settings/ads');
  const adsLine = ads.adsenseClientId
    ? `google.com, ${ads.adsenseClientId.replace('ca-', '')}, DIRECT, f08c47fec0942fa0`
    : null;
  const problems: string[] = [];
  if (ads.enabled && ads.provider === 'adsense' && !ads.adsenseClientId)
    problems.push('Ads are on but no AdSense publisher ID is set, so nothing will show.');
  if (ads.enabled && !Object.values(ads.placements).some((p) => p.enabled) && !ads.autoAds)
    problems.push('Ads are on but no placement is enabled (and Auto ads is off).');

  return (
    <>
      <PageHeader
        title="Ads"
        description="Google AdSense or any other network. Ads load only after the visitor accepts cookies (unless you turn that off), and never in the admin."
        actions={
          <Badge tone={ads.enabled ? 'green' : 'gray'}>{ads.enabled ? 'Ads on' : 'Ads off'}</Badge>
        }
      />
      <Flash ok={sp.ok} err={sp.err} />
      {problems.length > 0 && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {problems.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      )}

      <form action={saveAdsSettings} className="space-y-6">
        <Card title="Provider" description="Master switch and which network supplies the ads.">
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="enabled"
                defaultChecked={ads.enabled}
                className="h-4 w-4 rounded border-slate-300"
              />{' '}
              Show ads on the public site
            </label>
            <fieldset>
              <legend className="text-sm font-medium text-slate-800">Network</legend>
              <div className="mt-2 flex flex-wrap gap-5 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="provider"
                    value="adsense"
                    defaultChecked={ads.provider === 'adsense'}
                  />{' '}
                  Google AdSense
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="provider"
                    value="custom"
                    defaultChecked={ads.provider === 'custom'}
                  />{' '}
                  Other network (paste ad code)
                </label>
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="AdSense publisher ID"
                htmlFor="adsenseClientId"
                hint="From AdSense → Account → Settings. Looks like ca-pub-1234567890123456."
              >
                <input
                  id="adsenseClientId"
                  name="adsenseClientId"
                  defaultValue={ads.adsenseClientId}
                  placeholder="ca-pub-…"
                  className={inputCls}
                />
              </Field>
              <Field
                label="In-feed frequency"
                htmlFor="inFeedEvery"
                hint="Insert an in-feed ad after every N stories (3–20)."
              >
                <input
                  id="inFeedEvery"
                  name="inFeedEvery"
                  type="number"
                  min={3}
                  max={20}
                  defaultValue={ads.inFeedEvery}
                  className={inputCls}
                />
              </Field>
            </div>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="autoAds"
                defaultChecked={ads.autoAds}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                <strong>Auto ads</strong> (AdSense only): let Google place ads itself, in addition
                to the placements below.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="consentRequired"
                defaultChecked={ads.consentRequired}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                <strong>Ask for consent first</strong> and load ads only if the visitor accepts.
                Keep this on if you have visitors from the EU, UK or Switzerland. Google also
                requires a certified consent platform for personalised ads there; the built-in
                banner is a basic one.
              </span>
            </label>
          </div>
        </Card>

        <Card
          title="Placements"
          description="Enable the slots you want. AdSense needs the ad unit's slot ID (digits); other networks use the pasted code."
        >
          <div className="space-y-5">
            {PLACEMENT_KEYS.map((k) => (
              <fieldset key={k} className="rounded-lg border border-slate-200 p-4">
                <legend className="px-1 text-sm font-semibold text-slate-900">
                  {PLACEMENT_LABELS[k]}
                </legend>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    name={`p_${k}_enabled`}
                    defaultChecked={ads.placements[k].enabled}
                    className="h-4 w-4 rounded border-slate-300"
                  />{' '}
                  Enabled
                </label>
                <div className="mt-3 grid gap-4 md:grid-cols-2">
                  <Field label="AdSense slot ID" htmlFor={`p_${k}_slotId`}>
                    <input
                      id={`p_${k}_slotId`}
                      name={`p_${k}_slotId`}
                      inputMode="numeric"
                      defaultValue={ads.placements[k].slotId}
                      placeholder="1234567890"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Custom ad code" htmlFor={`p_${k}_html`}>
                    <textarea
                      id={`p_${k}_html`}
                      name={`p_${k}_html`}
                      rows={3}
                      defaultValue={ads.placements[k].html}
                      placeholder="<ins …></ins><script>…</script>"
                      className={`${inputCls} font-mono text-xs`}
                    />
                  </Field>
                </div>
              </fieldset>
            ))}
          </div>
        </Card>

        <Card
          title="Other networks &amp; ads.txt"
          description="Only needed for non-Google networks and for ads.txt."
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Allowed ad domains"
              htmlFor="scriptHosts"
              hint="One https origin per line, e.g. https://cdn.adnetwork.com. Added to the site's Content-Security-Policy so the network's scripts can run. Google's domains are always allowed when ads are on."
            >
              <textarea
                id="scriptHosts"
                name="scriptHosts"
                rows={4}
                defaultValue={ads.scriptHosts.join('\n')}
                className={`${inputCls} font-mono text-xs`}
              />
            </Field>
            <Field
              label="Extra ads.txt lines"
              htmlFor="adsTxt"
              hint="One per line, as given by your network."
            >
              <textarea
                id="adsTxt"
                name="adsTxt"
                rows={4}
                defaultValue={ads.adsTxt}
                className={`${inputCls} font-mono text-xs`}
              />
            </Field>
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">Your /ads.txt will contain:</p>
            <pre className="mt-1 whitespace-pre-wrap font-mono">
              {[adsLine, ads.adsTxt].filter(Boolean).join('\n') || '(nothing yet)'}
            </pre>
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <button className={button('primary')}>Save ad settings</button>
          <p className="text-xs text-slate-500">
            Custom ad code runs on every visitor&apos;s browser: only paste code from networks you
            trust.
          </p>
        </div>
      </form>
    </>
  );
}
