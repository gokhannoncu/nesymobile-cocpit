import 'dotenv/config'
import { liveProfilingEnabled } from './services/diagnostics/live-profile-flags.js'
import { loadEnv } from './env.js'
import { buildApp } from './app.js'
import { installNesyProxyDispatcher } from './lib/nesy-lan-proxy.js'
import { printStartupBanner } from './lib/startup-banner.js'
import { startInboxRetentionSchedule } from './services/verdict-inbox-retention.js'

async function main() {
  // Prototypes are patched before the first run is queued, never at import.
  if (liveProfilingEnabled()) {
    await import('./services/diagnostics/live-run-profiler.js')
    console.log('[live-profile] profiler hooks installed (NESY_LIVE_PROFILE)')
  }

  const env = loadEnv()

  const proxy = await installNesyProxyDispatcher()
  console.log(
    proxy.enabled
      ? `[nesy-lan-proxy] Nesy hosts via ${proxy.proxyAddr}${proxy.reason ? ` (${proxy.reason})` : ''}`
      : `[nesy-lan-proxy] direct — ${proxy.reason}`,
  )

  const { app } = await buildApp(env)

  // Started here rather than inside `buildApp` so the test suite, which builds
  // the app directly, never starts a timer that outlives a test file.
  const stopRetention = startInboxRetentionSchedule({
    enabled: env.VERDICT_RETENTION_ENABLED,
    bodyRetentionDays: env.VERDICT_RETENTION_BODY_DAYS,
    eventRetentionDays: env.VERDICT_RETENTION_EVENT_DAYS,
  })

  const shutdown = async (signal: string) => {
    console.log(`\n\x1b[33m${signal}\x1b[0m received, shutting down API…`)
    stopRetention()
    await app.close()
    process.exit(0)
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))

  try {
    await app.listen({ port: env.PORT, host: '0.0.0.0' })
    printStartupBanner(env)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EADDRINUSE') {
      console.error(
        `\n\x1b[31m✖ Port ${env.PORT} is in use.\x1b[0m Another API process may be running.\n` +
          `  → lsof -nP -iTCP:${env.PORT} -sTCP:LISTEN\n` +
          `  → kill <PID>\n`,
      )
      process.exit(1)
    }

    app.log.error(error)
    process.exit(1)
  }
}

main()
