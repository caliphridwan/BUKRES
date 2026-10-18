import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  APP_URL: z.string().url(),
  SMTP_URL: z.string().optional().default(""),
  MAIL_FROM: z.string().optional().default(""),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

/** Validated at first import; the server refuses to start with bad config. */
export const env = schema.parse(process.env);
export const isProd = env.NODE_ENV === "production";
