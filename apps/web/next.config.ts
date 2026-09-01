import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sonnerPath = path.join(__dirname, 'node_modules/sonner')

const nextConfig: NextConfig = {
  transpilePackages: ['@nesy/metronic', '@nesy/types'],
  // Monorepo: trace files from repo root (avoids stale/missing chunk errors in dev)
  outputFileTracingRoot: path.join(__dirname, '../..'),
  webpack: (config) => {
    // Resolve app-owned UI peers when bundling @nesy/metronic source (pnpm layout).
    config.resolve.alias = {
      ...config.resolve.alias,
      sonner: sonnerPath,
    }
    return config
  },
  // Turbopack ignores webpack.resolve.alias and rejects absolute filesystem
  // paths ("server relative imports are not implemented yet"). Pin the same
  // app-owned sonner copy with a project-relative path.
  turbopack: {
    resolveAlias: {
      sonner: './node_modules/sonner',
    },
  },
  // PDF export — tarayıcıya özel paketler SSR'da bundle'lanmaz
  serverExternalPackages: ['html2canvas-pro', 'jspdf'],
  async rewrites() {
    const automationApi = process.env.AUTOMATION_API_ORIGIN ?? 'http://localhost:4001'
    return [
      {
        source: '/automation-api/:path*',
        destination: `${automationApi}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
