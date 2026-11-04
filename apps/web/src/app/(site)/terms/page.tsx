import { Prose } from '@/components/Prose';
import { builtinMetadata, builtinPage } from '@/lib/builtin-pages';
import { SITE } from '@/lib/site';

export const revalidate = 300;
export const generateMetadata = () =>
  builtinMetadata('terms', 'Terms of use', (b) => `Terms of use for ${b.name}.`);

export default function Terms() {
  return builtinPage('terms', (b) => (
    <Prose title="Terms of use" updated="4 November 2026">
      <p>By using {b.name} you agree to these terms.</p>
      <h2>Content</h2>
      <p>
        Aggregated headlines, summaries and images come from third-party publishers, mainly{' '}
        <a href={SITE.sourceUrl} rel="noopener nofollow">
          {SITE.sourceName}
        </a>
        , and belong to them. {b.name} provides links and short summaries for discovery only.
        Articles marked as ours are © {b.name}.
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
  ));
}
