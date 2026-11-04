import { Ad } from '@/components/ads/Ad';
import { AutoAds, GoogleAnalytics } from '@/components/ads/Scripts';
import { AnnouncementBar } from '@/components/AnnouncementBar';
import { ConsentBanner } from '@/components/ConsentBanner';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { JsonLd } from '@/components/JsonLd';
import { THEME_INIT } from '@/components/ThemeToggle';
import { getSiteConfig } from '@/lib/api';
import { organizationLd, websiteLd } from '@/lib/jsonld';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const cfg = await getSiteConfig();
  // The consent banner only appears when something on the site actually needs consent.
  const needsConsent = (cfg.ads.enabled && cfg.ads.consentRequired) || cfg.ga4Id !== '';
  return (
    <>
      {/* Sets the saved theme before first paint, so there is no light-to-dark flash. */}
      <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      <JsonLd data={organizationLd()} />
      <JsonLd data={websiteLd()} />
      <AnnouncementBar a={cfg.announcement} />
      <Header />
      <Ad slot="headerBanner" className="mx-auto max-w-7xl px-4 pt-4" />
      <main id="main">{children}</main>
      <Footer />
      <ConsentBanner needed={needsConsent} />
      {cfg.ga4Id && <GoogleAnalytics id={cfg.ga4Id} />}
      {cfg.ads.autoAds && cfg.ads.clientId && (
        <AutoAds clientId={cfg.ads.clientId} consentRequired={cfg.ads.consentRequired} />
      )}
    </>
  );
}
