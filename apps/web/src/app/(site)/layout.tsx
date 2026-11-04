import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { JsonLd } from '@/components/JsonLd';
import { organizationLd, websiteLd } from '@/lib/jsonld';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={organizationLd()} />
      <JsonLd data={websiteLd()} />
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
