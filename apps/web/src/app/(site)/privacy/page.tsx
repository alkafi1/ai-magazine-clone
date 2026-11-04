import { Prose } from '@/components/Prose';
import { builtinMetadata, builtinPage } from '@/lib/builtin-pages';

export const revalidate = 300;
export const generateMetadata = () =>
  builtinMetadata('privacy', 'Privacy policy', (b) => `How ${b.name} handles personal data.`);

export default function Privacy() {
  return builtinPage('privacy', (b) => (
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
        <li>
          <strong>Cookies for advertising and analytics:</strong> if the site shows ads or uses
          analytics, they load only after you accept the cookie notice. You can change your choice
          at any time with “Cookie settings” in the footer.
        </li>
      </ul>
      <h2>What we don’t do</h2>
      <p>We do not sell personal data.</p>
      <h2>Third-party links and images</h2>
      <p>
        Story images may be loaded directly from the original publisher, and links lead to their
        site, which has its own privacy policy.
      </p>
      <h2>Your rights</h2>
      <p>
        You may request access to, correction or deletion of your data by emailing{' '}
        <a href={`mailto:${b.contactEmail}`}>{b.contactEmail}</a>.
      </p>
    </Prose>
  ));
}
