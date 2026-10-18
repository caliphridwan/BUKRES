import Link from "next/link";
import { Badge } from "./ui";
import type { Stage } from "@/lib/workflow";

export interface OfferingRow {
  id: string; code: string; title: string; units: number; semesterLabel: string; students: number;
  stage: Stage; stageLabel: string; isCorrection: boolean;
}

const tone = (s: Stage) => (s === "PUBLISHED" ? "good" : s === "DRAFT" ? "neutral" : s === "SENATE_RATIFIED" ? "info" : "warn");

export function OfferingList({ rows, empty }: { rows: OfferingRow[]; empty: string }) {
  if (rows.length === 0) return <p className="card px-5 py-8 text-center text-sm text-muted">{empty}</p>;
  return (
    <ul className="card divide-y divide-line">
      {rows.map((o) => (
        <li key={o.id}>
          <Link href={`/staff/courses/${o.id}`} className="flex flex-col gap-2 px-5 py-4 hover:bg-canvas sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold">{o.code}</span>
                {o.isCorrection ? <Badge tone="bad">Correction</Badge> : null}
              </div>
              <div className="truncate text-sm text-muted">{o.title} · {o.units} units · {o.students} students</div>
            </div>
            <div className="flex items-center gap-3 sm:text-right">
              <span className="text-xs text-muted">{o.semesterLabel}</span>
              <Badge tone={tone(o.stage)}>{o.stageLabel}</Badge>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
