/** Small dependency-free SVG charts, rendered on the server. */

export function BarChart({
  data,
  height = 140,
  label,
}: {
  data: { label: string; value: number }[];
  height?: number;
  label: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 600;
  const gap = 3;
  const bw = (w - gap * (data.length - 1)) / data.length;
  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${height + 18}`} role="img" aria-label={label} className="w-full">
        {[0.5, 1].map((f) => (
          <line
            key={f}
            x1="0"
            x2={w}
            y1={height - height * f}
            y2={height - height * f}
            stroke="#e2e8f0"
            strokeDasharray="3 4"
          />
        ))}
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 4);
          return (
            <g key={d.label}>
              <title>{`${d.label}: ${d.value}`}</title>
              <rect
                x={i * (bw + gap)}
                y={height - h}
                width={bw}
                height={Math.max(h, d.value ? 2 : 0)}
                rx="2"
                className="fill-wire/80 hover:fill-wire-dark"
              />
            </g>
          );
        })}
        <text x="0" y={height + 14} fontSize="10" fill="#64748b">
          {data[0]?.label.slice(5)}
        </text>
        <text x={w} y={height + 14} fontSize="10" fill="#64748b" textAnchor="end">
          {data.at(-1)?.label.slice(5)}
        </text>
        <text x={w} y="10" fontSize="10" fill="#64748b" textAnchor="end">
          max {max}
        </text>
      </svg>
    </figure>
  );
}

const statusColor: Record<string, string> = {
  success: 'fill-emerald-500',
  partial: 'fill-amber-400',
  running: 'fill-sky-400',
  failed: 'fill-red-500',
  blocked: 'fill-red-700',
};

/** One coloured block per recent scrape run, oldest on the left. */
export function RunStrip({
  runs,
}: {
  runs: { startedAt: string; status: string; created: number; warnings?: string[] }[];
}) {
  if (runs.length === 0) return <p className="text-sm text-slate-500">No runs yet.</p>;
  const w = 14;
  return (
    <svg
      viewBox={`0 0 ${runs.length * (w + 3)} 34`}
      role="img"
      aria-label="Status of the most recent scrape runs"
      className="w-full max-w-md"
    >
      {runs.map((r, i) => (
        <g key={r.startedAt}>
          <title>{`${r.startedAt.slice(0, 16).replace('T', ' ')} UTC: ${r.status}, ${r.created} new${r.warnings?.length ? ', with warnings' : ''}`}</title>
          <rect
            x={i * (w + 3)}
            y="0"
            width={w}
            height="28"
            rx="3"
            className={statusColor[r.status] ?? 'fill-slate-300'}
          />
          {r.warnings && r.warnings.length > 0 && (
            <circle cx={i * (w + 3) + w / 2} cy="32" r="2" className="fill-amber-500" />
          )}
        </g>
      ))}
    </svg>
  );
}

export function HBars({ data }: { data: { name: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.name}>
          <div className="flex justify-between text-sm">
            <span className="text-slate-700">{d.name}</span>
            <span className="font-semibold text-slate-900">{d.count}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-wire"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
