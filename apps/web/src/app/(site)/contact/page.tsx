import type { Metadata } from 'next';
import { Prose } from '@/components/Prose';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Contact the ${SITE.name} team.`,
  alternates: { canonical: '/contact' },
};

export default function Contact() {
  return (
    <Prose title="Contact">
      <p>
        Email us at <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
      </p>
      <ul>
        <li>Corrections, feedback and partnership ideas are welcome.</li>
        <li>
          Rights holders: to request removal of a listing, see our{' '}
          <a href="/dmca">DMCA & takedown page</a>.
        </li>
      </ul>
    </Prose>
  );
}
