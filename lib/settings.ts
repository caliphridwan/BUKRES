import "server-only";
import { z } from "zod";
import { db } from "./db";
import { DEFAULT_POLICY, type GradingPolicy } from "./grading/engine";
import { policyFromRow } from "./grading/policy";
import { OPTIONAL_STAGES, activeStages, type Stage } from "./workflow";

const defaults = {
  SHOW_RAW_SCORES: true,
  WORKFLOW_OPTIONAL_STAGES: OPTIONAL_STAGES as string[],
  MAINTENANCE_BANNER: "",
};
type Settings = typeof defaults;

export async function getSetting<K extends keyof Settings>(key: K): Promise<Settings[K]> {
  const row = await db.setting.findUnique({ where: { key } });
  return (row?.value as unknown as Settings[K] | undefined) ?? defaults[key];
}

export async function workflowStages(): Promise<Stage[]> {
  const enabled = z.array(z.string()).parse(await getSetting("WORKFLOW_OPTIONAL_STAGES"));
  return activeStages(enabled as Stage[]);
}

/** The active grade scale: id (stored on new results) + parsed policy. */
export async function activePolicy(): Promise<{ id: string; policy: GradingPolicy; confirmed: boolean }> {
  const row = await db.gradeScale.findFirst({ where: { isActive: true }, orderBy: { version: "desc" } });
  if (!row) throw new Error("No active grade scale. Run the seed or configure one in Admin → Grading.");
  return { id: row.id, policy: policyFromRow(row), confirmed: row.confirmed };
}

export { DEFAULT_POLICY };
