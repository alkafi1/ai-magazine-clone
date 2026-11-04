import type { ComponentProps } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders markdown we wrote ourselves (original articles, custom pages). react-markdown never emits raw
 * HTML, so a body cannot inject script or markup; link and image URLs are restricted to safe schemes.
 * Headings are shifted down one level because the page's own title is already the single <h1>.
 */
const safeUrl = (url: string) => {
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  if (url.startsWith('#')) return url;
  try {
    const u = new URL(url);
    if (u.protocol === 'https:' || u.protocol === 'mailto:') return url;
    // http is only tolerated for local development, e.g. images served by the dev API
    if (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)) return url;
  } catch {
    /* not a URL */
  }
  return '';
};

type Components = NonNullable<ComponentProps<typeof ReactMarkdown>['components']>;
const components: Components = {
  h1: ({ children }) => <h2>{children}</h2>,
  h2: ({ children }) => <h3>{children}</h3>,
  h3: ({ children }) => <h4>{children}</h4>,
  h4: ({ children }) => <h5>{children}</h5>,
  h5: ({ children }) => <h6>{children}</h6>,
  a: ({ href, children }) => {
    const external = !!href && /^https?:/.test(href);
    return (
      <a
        href={href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow ugc' } : {})}
      >
        {children}
      </a>
    );
  },
  img: ({ src, alt }) =>
    typeof src === 'string' && src ? (
      <img src={src} alt={alt ?? ''} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
    ) : null,
};

export function Markdown({ children }: { children: string }) {
  return (
    <div className="md-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={safeUrl} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
