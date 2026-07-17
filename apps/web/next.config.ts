import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  transpilePackages: ['@nesy/metronic', '@nesy/types'],
  // Monorepo: trace files from repo root (avoids stale/missing chunk errors in dev)
  outputFileTracingRoot: path.join(__dirname, '../..'),
  webpack: (config) => {
    // Resolve sonner from the web app when bundling @nesy/metronic source (pnpm layout)
    config.resolve.alias = {
      ...config.resolve.alias,
      sonner: path.join(__dirname, 'node_modules/sonner'),
    }
    return config
  },
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
