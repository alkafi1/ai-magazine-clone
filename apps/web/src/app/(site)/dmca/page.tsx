import type { Metadata } from 'next';
import { Prose } from '@/components/Prose';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'DMCA & takedown requests',
  description: `How to request removal of content from ${SITE.name}.`,
  alternates: { canonical: '/dmca' },
};

export default function Dmca() {
  return (
    <Prose title="DMCA & takedown requests" updated="4 November 2026">
      <p>
        {SITE.name} shows only headlines, short summaries, a thumbnail link, author name and date,
        always linking to the original. If you hold rights to material listed here and want it
        removed, we will act promptly.
      </p>
      <h2>How to submit a request</h2>
      <p>
        Email <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> with:
      </p>
      <ul>
        <li>the URL of the page on {SITE.name} you want removed;</li>
        <li>identification of the work you own and, if relevant, its original URL;</li>
        <li>
          your name, contact details and a statement that you are the rights holder or authorised to
          act for them;
        </li>
        <li>a statement, made in good faith, that the use is not authorised.</li>
      </ul>
      <h2>What happens next</h2>
      <p>
        We remove or hide valid listings within two business days. Removed pages return a “not
        found” response, and the item is not re-imported.
      </p>
    </Prose>
  );
}
