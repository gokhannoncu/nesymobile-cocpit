/**
 * Durable home for back-office dashboard admin tokens.
 *
 * ## Why this exists
 *
 * The token used to live only in a process-local `Map`. Every API restart wiped
 * it, and `getDashboardAdminToken` deliberately never attempts a FIRST login —
 * blind attempts trip the dashboard's captcha — so after a restart every
 * back-office step failed until somebody signed in by hand. Under `tsx watch`,
 * which restarts on each edit, that was effectively always: measured
 * 2026-09-02, `auth-verify-backend-session` and `permit-verify-request-record`
 * had been failing in every run for exactly that reason, reporting a message
 * that read like a configuration gap.
 *
 * ## One row per dashboard
 *
 * Keyed by `(country, environment)`, because a token is only valid for the
 * dashboard that issued it. Checking HR test must not reuse the RS staging
 * token; the key makes that impossible rather than merely unlikely.
 *
 * ## Failure policy
 *
 * Every function here degrades to the in-memory behaviour instead of throwing.
 * The store is a convenience — it saves a manual login after a restart — and a
 * database hiccup must not be able to fail a run that has a perfectly good
 * token in memory. Failures are logged, never swallowed silently.
 */
import { prisma } from "@nesy/db";

export interface StoredAdminToken {
  token: string;
  expiresAtMs: number;
  expirySource: "jwt" | "fallback-ttl";
  loginResult: unknown;
  obtainedAtMs: number;
}

function log(message: string, error: unknown): void {
  console.warn(
    `[NesyAdminTokenStore] ${message}: ${error instanceof Error ? error.message : String(error)}`,
  );
}

/** The stored token for one dashboard, or null when there is none to read. */
export async function readStoredAdminToken(
  country: string,
  environment: string,
): Promise<StoredAdminToken | null> {
  try {
    const row = await prisma.verdictBackofficeAdminToken.findUnique({
      where: { country_environment: { country, environment } },
    });
    if (!row) return null;
    return {
      token: row.token,
      expiresAtMs: row.expiresAt.getTime(),
      expirySource: row.expirySource === "jwt" ? "jwt" : "fallback-ttl",
      loginResult: row.loginResult ?? null,
      obtainedAtMs: row.obtainedAt.getTime(),
    };
  } catch (error) {
    log(`could not read ${country}/${environment}`, error);
    return null;
  }
}

/**
 * Writes the token for one dashboard, replacing whatever was there.
 *
 * `loginResult` is expected to have had its token-bearing fields stripped by the
 * caller already — this row is read for diagnosis, and a second copy of the
 * credential inside it would outlive the deliberate expiry of the first.
 */
export async function writeStoredAdminToken(
  country: string,
  environment: string,
  entry: StoredAdminToken,
): Promise<void> {
  try {
    const data = {
      token: entry.token,
      expiresAt: new Date(entry.expiresAtMs),
      expirySource: entry.expirySource,
      loginResult: (entry.loginResult ?? null) as never,
      obtainedAt: new Date(entry.obtainedAtMs),
      updatedAt: new Date(),
    };
    await prisma.verdictBackofficeAdminToken.upsert({
      where: { country_environment: { country, environment } },
      create: { country, environment, ...data },
      update: data,
    });
  } catch (error) {
    log(`could not write ${country}/${environment}`, error);
  }
}

/**
 * Removes the stored token for one dashboard.
 *
 * Called when the back office answers 401: the token we hold is no longer
 * accepted, so keeping it would make every later call fail the same way. It has
 * to leave the DURABLE copy too — otherwise the next restart would hydrate the
 * rejected token straight back into memory.
 */
export async function deleteStoredAdminToken(
  country: string,
  environment: string,
): Promise<void> {
  try {
    await prisma.verdictBackofficeAdminToken.deleteMany({
      where: { country, environment },
    });
  } catch (error) {
    log(`could not delete ${country}/${environment}`, error);
  }
}
