import "server-only";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { createHash } from "node:crypto";
import type { RawRow } from "./validate";

export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export interface ParsedFile {
  rows: RawRow[];
  sha256: string;
  fileName: string;
}

/**
 * Parse an uploaded CSV or XLSX into plain row objects. Formulas are not
 * evaluated (cached values only), macros are ignored, and only the first sheet
 * is read. Cells are read as text so "040" style matric numbers survive.
 */
export async function parseUpload(file: File): Promise<ParsedFile> {
  if (file.size === 0) throw new Error("The file is empty.");
  if (file.size > MAX_FILE_BYTES) throw new Error("The file is larger than 5 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const name = file.name.toLowerCase();

  let rows: RawRow[];
  if (name.endsWith(".csv")) {
    const text = buf.toString("utf8").replace(/^﻿/, "");
    const out = Papa.parse<RawRow>(text, { header: true, skipEmptyLines: "greedy", dynamicTyping: false });
    if (out.errors.length) throw new Error(`CSV error on row ${(out.errors[0]!.row ?? 0) + 2}: ${out.errors[0]!.message}`);
    rows = out.data;
  } else if (name.endsWith(".xlsx")) {
    // ZIP magic number check before handing the buffer to the parser.
    if (buf[0] !== 0x50 || buf[1] !== 0x4b) throw new Error("This is not a valid .xlsx file.");
    const wb = XLSX.read(buf, { type: "buffer", cellFormula: false, cellHTML: false, raw: false });
    const sheet = wb.Sheets[wb.SheetNames[0]!];
    if (!sheet) throw new Error("The workbook has no sheets.");
    rows = XLSX.utils.sheet_to_json<RawRow>(sheet, { raw: false, defval: "" });
  } else {
    throw new Error("Upload a .csv or .xlsx file.");
  }
  return { rows, sha256, fileName: file.name.slice(0, 200) };
}

/** Template with the class list pre-filled, as CSV text. */
export function templateCsv(courseCode: string, sessionName: string, semester: number, matricNos: string[]): string {
  return Papa.unparse({
    fields: ["matric_no", "course_code", "session", "semester", "ca_score", "exam_score"],
    data: matricNos.map((m) => [m, courseCode, sessionName, String(semester), "", ""]),
  });
}
