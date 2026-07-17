import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  transpilePackages: ['@nesy/metronic', '@nesy/types'],
  // Monorepo: trace files from repo root (avoids stale/missing chunk errors in dev)
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // PDF export — tarayıcıya özel paketler SSR'da bundle'lanmaz
  serverExternalPackages: ['html2canvas-pro', 'jspdf'],
  async rewrites() {
    const automationApi = process.env.AUTOMATION_API_ORIGIN ?? 'http://localhost:3008'
    return [
      {
        source: '/automation-api/:path*',
        destination: `${automationApi}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
