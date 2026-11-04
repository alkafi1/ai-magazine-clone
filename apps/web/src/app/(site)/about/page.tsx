import type { Metadata } from 'next';
import { Prose } from '@/components/Prose';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'About',
  description: `What ${SITE.name} is, where its headlines come from, and how it works.`,
  alternates: { canonical: '/about' },
};

export default function About() {
  return (
    <Prose title={`About ${SITE.name}`}>
      <p>
        {SITE.name} is a news index for artificial intelligence. We bring the day’s most important
        AI headlines — models, chips, startups, policy and people — into one fast, readable front
        page.
      </p>
      <h2>Where the stories come from</h2>
      <p>
        Headlines, short summaries and publication details are aggregated automatically, every six
        hours, from{' '}
        <a href={SITE.sourceUrl} rel="noopener nofollow">
          {SITE.sourceName}
        </a>
        . We do not copy articles. Each story on {SITE.name} shows only the headline, a brief
        summary, the category, the author’s name and the publication date, and links straight to the
        original so you can read the full reporting where it was published.
      </p>
      <h2>How the crawler behaves</h2>
      <p>
        Our crawler identifies itself with a descriptive user agent, obeys the publisher’s
        robots.txt, waits between requests and backs off when asked. It is deliberately low-volume.
      </p>
      <h2>Independence</h2>
      <p>
        {SITE.name} is an independent project and is not affiliated with, endorsed by or sponsored
        by {SITE.sourceName}. Their name and content belong to them.
      </p>
      <p>
        Questions or corrections? <a href="/contact">Get in touch</a>.
      </p>
    </Prose>
  );
}
