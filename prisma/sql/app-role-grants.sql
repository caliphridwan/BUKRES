-- Run once after `prisma migrate deploy`, as the database owner.
-- The application connects as `buk_app`, which cannot rewrite history.

CREATE ROLE buk_app LOGIN PASSWORD 'change-me';
GRANT CONNECT ON DATABASE buk_results TO buk_app;
GRANT USAGE ON SCHEMA public TO buk_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO buk_app;

-- Append-only tables: no UPDATE or DELETE for the app.
REVOKE UPDATE, DELETE ON "AuditLog", "ApprovalAction" FROM buk_app;

-- Results are versioned, never deleted.
REVOKE DELETE ON "Result", "GpaSnapshot", "Statement" FROM buk_app;
