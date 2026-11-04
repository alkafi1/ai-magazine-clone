import type { CustomPage } from '@/lib/api';
import { Breadcrumbs } from './Breadcrumbs';
import { Markdown } from './Markdown';

export function CustomPageView({ page, path }: { page: CustomPage; path: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Breadcrumbs
        items={[
          { name: 'Home', path: '/' },
          { name: page.title, path },
        ]}
      />
      <h1 className="font-display text-4xl font-extrabold">{page.title}</h1>
      <div className="mt-6">
        <Markdown>{page.body}</Markdown>
      </div>
    </div>
  );
}
