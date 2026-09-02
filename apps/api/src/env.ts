import { z } from 'zod'

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4001),
  CORS_ORIGIN: z.string().default('http://localhost:4002'),
  /** Web app base URL. */
  WEB_BASE_URL: z.string().default('http://localhost:4002'),
  /** Optional absolute path to Claude Code CLI binary. */
  CLAUDE_CLI_PATH: z.string().optional(),
  /** Claude model alias for Mongo query generation (default haiku). */
  CLAUDE_MONGO_QUERY_MODEL: z.string().default('haiku'),
  /** Claude CLI timeout in ms. */
  CLAUDE_MONGO_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
  /** Claude model alias for Graylog query generation (default haiku). */
  CLAUDE_GRAYLOG_QUERY_MODEL: z.string().default('haiku'),
  /** Claude CLI timeout in ms for Graylog generation. */
  CLAUDE_GRAYLOG_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
  /**
   * `verdict_inbox` retention sweep. On by default: a retention policy that has
   * to be switched on is a policy that quietly is not one, which is exactly how
   * this table ended up with no retention at all.
   */
  VERDICT_RETENTION_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  /** Captured HTTP body text lifetime, days. */
  VERDICT_RETENTION_BODY_DAYS: z.coerce.number().int().positive().default(14),
  /** Inbox row lifetime, days. Must not be shorter than the body window. */
  VERDICT_RETENTION_EVENT_DAYS: z.coerce.number().int().positive().default(90),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(): Env {
  return envSchema.parse(process.env)
}
