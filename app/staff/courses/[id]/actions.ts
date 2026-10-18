"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, clientIp, STAFF_ROLES } from "@/lib/auth/session";
import { parseUpload } from "@/lib/import/parse";
import { commitImport, openCorrection, saveManualScores, transition, validateImport } from "@/lib/services/results";
import { ForbiddenError } from "@/lib/authz";
import type { ValidationResult } from "@/lib/import/validate";

const id = z.string().regex(/^[a-z0-9]{20,40}$/);

export type UploadState =
  | { phase: "idle" }
  | { phase: "preview"; result: ValidationResult; fileName: string }
  | { phase: "done"; accepted: number; rejected: number }
  | { phase: "error"; message: string };

function message(e: unknown) {
  if (e instanceof ForbiddenError) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong. Nothing was saved.";
}

/** Step 1 — parse and validate. Writes nothing. */
export async function previewUpload(offeringId: string, _: UploadState, form: FormData): Promise<UploadState> {
  const me = await requireUser(STAFF_ROLES);
  try {
    const file = form.get("file");
    if (!(file instanceof File)) return { phase: "error", message: "Choose a .csv or .xlsx file." };
    const parsed = await parseUpload(file);
    const result = await validateImport(me, id.parse(offeringId), parsed.rows);
    if (result.fileErrors.length) return { phase: "error", message: result.fileErrors.join(" ") };
    return { phase: "preview", result, fileName: parsed.fileName };
  } catch (e) {
    return { phase: "error", message: message(e) };
  }
}

/** Step 2 — re-parse the same file, re-validate on the server, commit atomically. */
export async function commitUpload(offeringId: string, _: UploadState, form: FormData): Promise<UploadState> {
  const me = await requireUser(STAFF_ROLES);
  try {
    if (form.get("confirm") !== "yes") return { phase: "error", message: "Confirm the preview before saving." };
    const file = form.get("file");
    if (!(file instanceof File)) return { phase: "error", message: "The file is missing. Choose it again." };
    const parsed = await parseUpload(file);
    const r = await commitImport(me, id.parse(offeringId), parsed, await clientIp());
    revalidatePath(`/staff/courses/${offeringId}`);
    return { phase: "done", accepted: r.accepted.length, rejected: r.rejected.length };
  } catch (e) {
    return { phase: "error", message: message(e) };
  }
}

export type GridState = { saved?: number; rejected?: Array<{ matricNo: string; errors: string[] }>; error?: string } | undefined;

export async function saveGrid(offeringId: string, _: GridState, form: FormData): Promise<GridState> {
  const me = await requireUser(STAFF_ROLES);
  try {
    const matrics = form.getAll("matric").map(String);
    const cas = form.getAll("ca").map(String);
    const exams = form.getAll("exam").map(String);
    if (matrics.length > 5000 || matrics.length !== cas.length || cas.length !== exams.length) return { error: "The form is malformed. Reload the page." };
    const entries = matrics.map((m, i) => ({ matricNo: m, ca: cas[i] ?? "", exam: exams[i] ?? "" }));
    const r = await saveManualScores(me, id.parse(offeringId), entries, await clientIp());
    revalidatePath(`/staff/courses/${offeringId}`);
    return { saved: r.accepted.length, rejected: r.rejected.map((x) => ({ matricNo: x.matricNo, errors: x.errors })) };
  } catch (e) {
    return { error: message(e) };
  }
}

export type FlowState = { error?: string; ok?: string } | undefined;

export async function moveSubmission(offeringId: string, _: FlowState, form: FormData): Promise<FlowState> {
  const me = await requireUser(STAFF_ROLES);
  try {
    const action = form.get("action") === "return" ? "return" : "forward";
    const reason = String(form.get("reason") ?? "").slice(0, 1000);
    const plan = await transition(me, id.parse(offeringId), action, reason || undefined, await clientIp());
    revalidatePath(`/staff/courses/${offeringId}`);
    revalidatePath("/staff");
    return { ok: plan.verb === "PUBLISH" ? "Published. Students have been notified." : plan.verb === "RETURN" ? "Returned to draft." : "Done." };
  } catch (e) {
    return { error: message(e) };
  }
}

export async function startCorrection(offeringId: string, _: FlowState, form: FormData): Promise<FlowState> {
  const me = await requireUser(["FACULTY_ADMIN"]);
  try {
    await openCorrection(me, id.parse(offeringId), String(form.get("reason") ?? "").slice(0, 2000), await clientIp());
    revalidatePath(`/staff/courses/${offeringId}`);
    return { ok: "Re-opened for correction. Students keep seeing the published result until the correction is published." };
  } catch (e) {
    return { error: message(e) };
  }
}
