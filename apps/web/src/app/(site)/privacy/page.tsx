import type { Metadata } from 'next';
import { Prose } from '@/components/Prose';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: `How ${SITE.name} handles personal data.`,
  alternates: { canonical: '/privacy' },
};

export default function Privacy() {
  return (
    <Prose title="Privacy policy" updated="4 November 2026">
      <p>We collect as little personal data as possible.</p>
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Newsletter:</strong> if you subscribe, we store your email address and the date
          you subscribed. We use it only to send the newsletter, and you can ask us to delete it at
          any time.
        </li>
        <li>
          <strong>Server logs:</strong> our servers record technical request data (IP address, user
          agent, page requested) for security and troubleshooting, and delete it on a rolling basis.
        </li>
        <li>
          <strong>Page views:</strong> we count views of each story to show trending headlines. This
          count is not linked to you.
        </li>
      </ul>
      <h2>What we don’t do</h2>
      <p>We do not use advertising or tracking cookies, and we do not sell personal data.</p>
      <h2>Third-party links and images</h2>
      <p>
        Story images are loaded directly from the original publisher, and links lead to their site,
        which has its own privacy policy.
      </p>
      <h2>Your rights</h2>
      <p>
        You may request access to, correction or deletion of your data by emailing{' '}
        <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
      </p>
    </Prose>
  );
}
