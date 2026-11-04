import type { Metadata } from 'next';
import { Prose } from '@/components/Prose';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Terms of use',
  description: `Terms of use for ${SITE.name}.`,
  alternates: { canonical: '/terms' },
};

export default function Terms() {
  return (
    <Prose title="Terms of use" updated="4 November 2026">
      <p>By using {SITE.name} you agree to these terms.</p>
      <h2>Content</h2>
      <p>
        Headlines, summaries and images shown here come from third-party publishers, mainly{' '}
        <a href={SITE.sourceUrl} rel="noopener nofollow">
          {SITE.sourceName}
        </a>
        , and belong to them. {SITE.name} provides links and short summaries for discovery only.
      </p>
      <h2>Acceptable use</h2>
      <p>
        Do not attempt to disrupt the service, scrape it at high volume, or use it to infringe
        anyone’s rights. Automated access should respect our robots.txt.
      </p>
      <h2>No warranty</h2>
      <p>
        The service is provided “as is”. Summaries may be incomplete or out of date; always check
        the original article.
      </p>
      <h2>Changes</h2>
      <p>We may update these terms; continued use means you accept the new version.</p>
    </Prose>
  );
}
