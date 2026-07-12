import { z } from 'zod'

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4001),
  CORS_ORIGIN: z.string().default('http://localhost:3001'),
  /** Web app base URL. */
  WEB_BASE_URL: z.string().default('http://localhost:3001'),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(): Env {
  return envSchema.parse(process.env)
}
