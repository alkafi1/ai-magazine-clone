import { SavedList } from '@/components/BookmarkButton';
import { Breadcrumbs } from '@/components/Breadcrumbs';

export const metadata = {
  title: 'Saved articles',
  description: 'Your bookmarked stories (stored in this browser).',
  alternates: { canonical: '/saved' },
  robots: { index: false, follow: false },
};

export default function SavedPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Breadcrumbs
        items={[
          { name: 'Home', path: '/' },
          { name: 'Saved', path: '/saved' },
        ]}
      />
      <h1 className="mt-4 font-display text-4xl font-extrabold">Saved articles</h1>
      <p className="mt-2 text-slate">Stored only in this browser. No account needed.</p>
      <SavedList />
    </div>
  );
}
