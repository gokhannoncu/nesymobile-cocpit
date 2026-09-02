-- aras_db: back-office dashboard admin tokens, per country/environment
--
-- Why this table exists
--
-- The token lived only in a process-local Map. Every API restart wiped it, and
-- `getDashboardAdminToken` deliberately never attempts a FIRST login (blind
-- attempts trip the dashboard captcha) — so after any restart every
-- back-office step failed until somebody signed in again by hand. Under
-- `tsx watch`, which restarts on each edit, that meant essentially always:
-- measured 2026-09-02, `auth-verify-backend-session` and
-- `permit-verify-request-record` had been failing in every run for that reason.
--
-- One row per (country, environment), because a token is only valid for the
-- dashboard that issued it: checking HR test must not reuse the RS staging
-- token, and vice versa.
--
-- Çalıştırma:
--   pnpm --filter @nesy/db exec prisma db execute --file prisma/manual-migrations/20260902_backoffice_admin_tokens.sql --schema prisma/schema.prisma

CREATE TABLE IF NOT EXISTS "verdict_backoffice_admin_token" (
    "country" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    -- When the token itself stops being valid, and where that instant came from
    -- (the JWT's own `exp`, or a conservative fallback window).
    "expires_at" TIMESTAMP(3) NOT NULL,
    "expiry_source" TEXT NOT NULL,
    -- The login response, kept for diagnosis. Token-bearing fields are stripped
    -- before this is written; see `withoutTokenFields`.
    "login_result" JSONB,
    "obtained_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verdict_backoffice_admin_token_pkey" PRIMARY KEY ("country", "environment")
);

-- Reading always addresses one dashboard, so the primary key is the only access
-- path this table needs.
