/**
 * Server-rendered SVG trend chart — zero client JavaScript, so it costs
 * nothing against the low-bandwidth budget. A data table follows it for
 * screen readers and for anyone who prefers numbers.
 */
export interface Point { label: string; short: string; gpa: number | null; cgpa: number | null }

export function GpaChart({ points, max = 5 }: { points: Point[]; max?: number }) {
  const W = 640, H = 220, L = 36, R = 16, T = 16, B = 34;
  const n = points.length;
  const x = (i: number) => (n === 1 ? L + (W - L - R) / 2 : L + (i * (W - L - R)) / (n - 1));
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const line = (key: "gpa" | "cgpa") =>
    points.map((p, i) => (p[key] == null ? null : `${x(i)},${y(p[key]!)}`)).filter(Boolean).join(" ");

  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby="gpa-chart-title">
        <title id="gpa-chart-title">Semester GPA and CGPA over time</title>
        {[0, 1, 2, 3, 4, 5].filter((v) => v <= max).map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#E2E8F0" strokeDasharray={v === 0 ? undefined : "3 4"} />
            <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#65758B">{v.toFixed(0)}</text>
          </g>
        ))}
        {points.map((p, i) => (
          <text key={p.label} x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill="#65758B">{p.short}</text>
        ))}
        <polyline points={line("cgpa")} fill="none" stroke="#C9A227" strokeWidth="2" strokeDasharray="6 5" strokeLinecap="round" />
        <polyline points={line("gpa")} fill="none" stroke="#1D5FA7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) =>
          p.gpa == null ? null : (
            <g key={p.label}>
              <circle cx={x(i)} cy={y(p.gpa)} r="4" fill="#fff" stroke="#1D5FA7" strokeWidth="2" />
              {i === n - 1 ? <text x={x(i)} y={y(p.gpa) - 10} textAnchor="middle" fontSize="12" fontWeight="600" fill="#123B68">{p.gpa.toFixed(2)}</text> : null}
            </g>
          ),
        )}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded bg-royal" /> Semester GPA</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 border-t-2 border-dashed border-gold" /> CGPA</span>
      </figcaption>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-medium text-royal">Show as table</summary>
        <table className="mt-2 w-full text-left text-sm">
          <thead><tr className="text-muted"><th className="py-1 font-medium">Semester</th><th className="table-num py-1 font-medium">GPA</th><th className="table-num py-1 font-medium">CGPA</th></tr></thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.label} className="border-t border-line"><td className="py-1.5">{p.label}</td><td className="table-num">{p.gpa?.toFixed(2) ?? "—"}</td><td className="table-num">{p.cgpa?.toFixed(2) ?? "—"}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
