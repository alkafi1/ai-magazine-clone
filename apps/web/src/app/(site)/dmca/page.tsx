import { Prose } from '@/components/Prose';
import { builtinMetadata, builtinPage } from '@/lib/builtin-pages';

export const revalidate = 300;
export const generateMetadata = () =>
  builtinMetadata(
    'dmca',
    'DMCA & takedown requests',
    (b) => `How to request removal of content from ${b.name}.`,
  );

export default function Dmca() {
  return builtinPage('dmca', (b) => (
    <Prose title="DMCA & takedown requests" updated="4 November 2026">
      <p>
        {b.name} shows aggregated headlines only as short summaries with a thumbnail link, author
        name and date, always linking to the original. If you hold rights to material listed here
        and want it removed, we will act promptly.
      </p>
      <h2>How to submit a request</h2>
      <p>
        Email <a href={`mailto:${b.contactEmail}`}>{b.contactEmail}</a> with:
      </p>
      <ul>
        <li>the URL of the page on {b.name} you want removed;</li>
        <li>identification of the work you own and, if relevant, its original URL;</li>
        <li>
          your name, contact details and a statement that you are the rights holder or authorised to
          act for them;
        </li>
        <li>a statement, made in good faith, that the use is not authorised.</li>
      </ul>
      <h2>What happens next</h2>
      <p>
        We remove or hide valid listings within two business days. Removed pages return a “gone”
        response, and the item is not re-imported.
      </p>
    </Prose>
  ));
}
