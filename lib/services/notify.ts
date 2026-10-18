import "server-only";
import { db } from "../db";

export interface NotificationInput {
  title: string;
  body: string;
  href?: string;
}

/**
 * In-app notifications. Bodies never contain grades or GPAs, so the optional
 * email channel can reuse them safely — and email only goes to verified
 * addresses (wire an SMTP transport in `sendEmail` when SMTP_URL is set).
 */
export async function notifyMany(userIds: string[], n: NotificationInput) {
  if (userIds.length === 0) return;
  await db.notification.createMany({ data: userIds.map((userId) => ({ userId, ...n })) });
  if (process.env.SMTP_URL) {
    const users = await db.user.findMany({
      where: { id: { in: userIds }, emailVerifiedAt: { not: null }, email: { not: null } },
      select: { email: true },
    });
    await Promise.allSettled(users.map((u) => sendEmail(u.email!, n.title, `${n.body}\n\nSign in to the portal to view details.`)));
  }
}

async function sendEmail(_to: string, _subject: string, _text: string) {
  // Intentionally left to the deployment: plug in nodemailer/Resend here.
  // Keep the content generic — never include results in email.
}

export async function unreadCount(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}

export async function listNotifications(userId: string) {
  return db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 30 });
}
