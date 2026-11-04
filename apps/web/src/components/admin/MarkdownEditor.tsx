'use client';

import { useRef, useState } from 'react';
import { Markdown } from '../Markdown';

type Tool = {
  label: string;
  title: string;
  run: (sel: string) => { text: string; select?: [number, number] };
};

const wrap =
  (before: string, after = before, placeholder = 'text'): Tool['run'] =>
  (sel) => {
    const inner = sel || placeholder;
    return {
      text: `${before}${inner}${after}`,
      select: [before.length, before.length + inner.length],
    };
  };
const line =
  (prefix: string, placeholder: string): Tool['run'] =>
  (sel) => ({
    text: (sel || placeholder)
      .split('\n')
      .map((l) => `${prefix}${l}`)
      .join('\n'),
  });

const TOOLS: Tool[] = [
  { label: 'B', title: 'Bold', run: wrap('**') },
  { label: 'I', title: 'Italic', run: wrap('*') },
  { label: 'H2', title: 'Heading', run: line('## ', 'Heading') },
  { label: '“”', title: 'Quote', run: line('> ', 'Quote') },
  { label: '• List', title: 'Bulleted list', run: line('- ', 'Item') },
  {
    label: '1. List',
    title: 'Numbered list',
    run: (sel) => ({
      text: (sel || 'Item')
        .split('\n')
        .map((l, i) => `${i + 1}. ${l}`)
        .join('\n'),
    }),
  },
  {
    label: 'Link',
    title: 'Link',
    run: (sel) => ({
      text: `[${sel || 'link text'}](https://)`,
      select: [sel ? sel.length + 3 : 12, sel ? sel.length + 11 : 20],
    }),
  },
  {
    label: 'Image',
    title: 'Image from a URL',
    run: (sel) => ({ text: `![${sel || 'description'}](https://)` }),
  },
  { label: '</>', title: 'Code', run: wrap('`', '`', 'code') },
];

/** Plain textarea + toolbar + live preview. The value is submitted with the surrounding form. */
export function MarkdownEditor({
  name,
  defaultValue = '',
  rows = 18,
  id = name,
  required = true,
  label = 'Content',
}: {
  name: string;
  defaultValue?: string;
  rows?: number;
  id?: string;
  label?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const ta = useRef<HTMLTextAreaElement>(null);

  function apply(tool: Tool) {
    const el = ta.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const out = tool.run(value.slice(s, e));
    const next = value.slice(0, s) + out.text + value.slice(e);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      const [a, b] = out.select ?? [out.text.length, out.text.length];
      el.setSelectionRange(s + a, s + b);
    });
  }

  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const tabCls = (t: string) =>
    `rounded-md px-3 py-1.5 text-sm font-semibold ${tab === t ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`;

  return (
    <div className="rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-wire focus-within:ring-2 focus-within:ring-wire/30">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
        <div role="tablist" aria-label="Editor mode" className="mr-2 flex gap-1">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'write'}
            className={tabCls('write')}
            onClick={() => setTab('write')}
          >
            Write
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'preview'}
            className={tabCls('preview')}
            onClick={() => setTab('preview')}
          >
            Preview
          </button>
        </div>
        {tab === 'write' &&
          TOOLS.map((t) => (
            <button
              key={t.title}
              type="button"
              title={t.title}
              onClick={() => apply(t)}
              className="rounded px-2 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              {/* the visible text is part of the accessible name (WCAG 2.5.3); the hidden text says what it does */}
              <span aria-hidden="true">{t.label}</span>
              <span className="sr-only">{t.title}</span>
            </button>
          ))}
        <span className="ml-auto text-xs text-slate-500">{words} words · Markdown</span>
      </div>
      {/* keep the textarea mounted (hidden) in preview mode so its value is always submitted */}
      <textarea
        ref={ta}
        id={id}
        name={name}
        aria-label={label}
        required={required}
        rows={rows}
        value={value}
        maxLength={100000}
        onChange={(e) => setValue(e.target.value)}
        className={`block w-full resize-y rounded-b-lg border-0 bg-white p-4 font-mono text-sm leading-relaxed text-slate-900 focus:outline-none ${tab === 'write' ? '' : 'hidden'}`}
      />
      {tab === 'preview' && (
        <div className="min-h-48 p-4">
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <p className="text-sm text-slate-500">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
