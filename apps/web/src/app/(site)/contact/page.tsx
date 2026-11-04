import { Prose } from '@/components/Prose';
import { builtinMetadata, builtinPage } from '@/lib/builtin-pages';

export const revalidate = 300;
export const generateMetadata = () =>
  builtinMetadata('contact', 'Contact', (b) => `Contact the ${b.name} team.`);

export default function Contact() {
  return builtinPage('contact', (b) => (
    <Prose title="Contact">
      <p>
        Email us at <a href={`mailto:${b.contactEmail}`}>{b.contactEmail}</a>.
      </p>
      <ul>
        <li>Corrections, feedback and partnership ideas are welcome.</li>
        <li>
          Rights holders: to request removal of a listing, see our{' '}
          <a href="/dmca">DMCA &amp; takedown page</a>.
        </li>
      </ul>
    </Prose>
  ));
}
