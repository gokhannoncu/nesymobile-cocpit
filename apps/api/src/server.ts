import 'dotenv/config'
import { loadEnv } from './env.js'
import { buildApp } from './app.js'
import { printStartupBanner } from './lib/startup-banner.js'

async function main() {
  const env = loadEnv()
  const { app } = await buildApp(env)

  const shutdown = async (signal: string) => {
    console.log(`\n\x1b[33m${signal}\x1b[0m received, shutting down API…`)
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
