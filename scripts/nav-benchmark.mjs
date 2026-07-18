// Ad-hoc navigation benchmark for the running dev server.
// Simulates App Router client-side navigation (RSC requests) and measures timing.
const BASE = process.env.BASE ?? 'http://localhost:4002'

const routes = [
  '/',
  '/automation/list',
  '/automation/field-login',
  '/data-center/connection',
  '/data-center/users',
  '/data-center/shipment',
  '/debug-view/overview',
  '/engineering/overview',
  '/pm/overview',
  '/product',
]

async function timeGet(path, { rsc }) {
  const headers = rsc ? { RSC: '1' } : {}
  const start = performance.now()
  const res = await fetch(BASE + path, { headers })
  await res.arrayBuffer()
  const ms = performance.now() - start
  return { ms, status: res.status }
}

function fmt(ms) {
  return `${ms.toFixed(0)}ms`.padStart(8)
}

async function main() {
  const mode = process.argv[2] ?? 'rsc' // 'rsc' | 'html'
  const rsc = mode === 'rsc'
  console.log(`\nNavigation benchmark (${rsc ? 'RSC client-nav' : 'full HTML'}) -> ${BASE}\n`)
  console.log('route'.padEnd(42) + 'pass1 (cold)'.padStart(14) + 'pass2 (warm)'.padStart(14) + 'pass3 (warm)'.padStart(14))
  console.log('-'.repeat(84))

  const warm2 = []
  for (const path of routes) {
    const a = await timeGet(path, { rsc })
    const b = await timeGet(path, { rsc })
    const c = await timeGet(path, { rsc })
    warm2.push(c.ms)
    console.log(path.padEnd(42) + fmt(a.ms).padStart(14) + fmt(b.ms).padStart(14) + fmt(c.ms).padStart(14))
  }

  const avgWarm = warm2.reduce((s, x) => s + x, 0) / warm2.length
  const maxWarm = Math.max(...warm2)
  console.log('-'.repeat(84))
  console.log(`warm avg: ${avgWarm.toFixed(0)}ms   warm max: ${maxWarm.toFixed(0)}ms`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
