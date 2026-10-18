import { z } from "zod";
import { assertValidPolicy, type GradingPolicy } from "./engine";

const band = z.object({
  min: z.number().min(0),
  max: z.number().min(0),
  grade: z.string().min(1).max(3),
  point: z.number().int().min(0).max(10),
  pass: z.boolean(),
});
const threshold = z.object({ name: z.string().min(1), min: z.number().min(0) });

/** Shape of a GradeScale row as read from the database. */
export interface GradeScaleRow {
  bands: unknown;
  classes: unknown;
  standing: unknown;
  decimals: number;
  rounding: "HALF_UP" | "TRUNCATE";
  repeatPolicy: "ALL_ATTEMPTS_COUNT" | "LATEST_ATTEMPT_ONLY" | "BEST_ATTEMPT_ONLY";
  maxScore: number;
}

/** Parse and validate a stored grade scale into an engine policy. */
export function policyFromRow(row: GradeScaleRow): GradingPolicy {
  const policy: GradingPolicy = {
    bands: z.array(band).min(1).parse(row.bands),
    classes: z.array(threshold).parse(row.classes),
    standing: z.array(threshold).parse(row.standing),
    decimals: row.decimals,
    rounding: row.rounding,
    repeatPolicy: row.repeatPolicy,
    maxScore: row.maxScore,
  };
  assertValidPolicy(policy);
  return policy;
}
