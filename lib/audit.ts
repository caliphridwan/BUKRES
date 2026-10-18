import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

type Tx = Prisma.TransactionClient;

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
  ip?: string | null;
}

/**
 * Append an audit record. Pass the transaction client when the audited change
 * is transactional so the log and the change commit (or roll back) together.
 * Never log passwords, codes, tokens or full result sheets.
 */
export async function audit(entry: AuditEntry, tx: Tx = db) {
  await tx.auditLog.create({ data: { ...entry, actorId: entry.actorId ?? null } });
}
