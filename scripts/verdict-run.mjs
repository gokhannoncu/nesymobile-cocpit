#!/usr/bin/env node
/**
 * ===========================================================================
 *  Verdict koşu runner'ı — cockpit'in "Run Test" yolunu komut satırından koşar
 *
 *  RUN_PLAY phase-10 §6.2'deki sırayı birebir izler:
 *    readiness → pack pin → workflow IR → compile → start → poll
 *  yani `apps/web/src/lib/verdict-runtime/start-pinned-run.ts` ile aynı sıra.
 *
 *  ### Neden bu dosya var
 *
 *  `scripts/diag-login-run.py` aynı işi yapıyordu ama iki yeri sabit yazılmıştı:
 *  tek iş akışı (`nesy.workflow.login`) ve macOS'e gömülü bir `adb` yolu. Faz
 *  boyunca kullanılan runner'lar ise oturuma özel geçici dizinlerde kaldı ve her
 *  oturumda yeniden yazıldı. Bu, her seferinde aynı üç hatayı yeniden yapma
 *  davetiydi — özellikle idempotent koşu başlatmayı (aşağıya bakın).
 *
 *  ### İki tuzak, ikisi de burada kapatıldı
 *
 *  1. **Koşu başlatma idempotent.** Aynı gövde aynı `runId`'yi döndürür; yeni
 *     koşu BAŞLAMAZ, eski koşunun sonucunu okursun. Bu yüzden her koşuya
 *     benzersiz bir `sessionCorrelationId` enjekte edilir — çağıran unutsa bile.
 *  2. **`profileKey` zorunlu sayılır.** Onsuz hiçbir şey uygulamayı soğuk
 *     başlatmaz ve ilk bekleme adımı yalnızca zaman aşımına uğrar. Bilinen iş
 *     akışları için varsayılan profil tablodan gelir.
 *
 *  ### Kullanım
 *
 *      node scripts/verdict-run.mjs <workflowRef> [--input k=v]... [seçenekler]
 *
 *      # login
 *      node scripts/verdict-run.mjs nesy.workflow.login --input pin=3680
 *
 *      # select-route
 *      node scripts/verdict-run.mjs nesy.workflow.select-route --input routeCode=31
 *
 *      # önce oturumu sıfırla (temiz önkoşul), sonra koş
 *      node scripts/verdict-run.mjs nesy.workflow.login --input pin=3680 --reset
 *
 *  Seçenekler:
 *      --device <serial>     varsayılan R6CW400BC8N ya da $VERDICT_DEVICE
 *      --app-id <pkg>        varsayılan com.arasdigital.nesymobile.rstest
 *      --profile <key>       launch profile; tablo varsayılanını ezer
 *      --input k=v           koşu girdisi (birden fazla kez verilebilir)
 *      --reset               koşudan ÖNCE reset_state (§6.6 ardışık koşu kalıbı)
 *      --timeout <sn>        yoklama bütçesi, varsayılan 180
 *      --json                ham koşu detayını da yaz
 *      --no-logcat           sonda logcat özetini atla
 *      --injected-fault ID   G90.9 input axis (omit = uninjected null)
 *      --injected-fault-host A|B   required when --injected-fault is set
 * ===========================================================================
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require_ = createRequire(import.meta.url)
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')

const API = process.env.VERDICT_API ?? 'http://127.0.0.1:4001/api'

/** Her iş akışının hangi önkoşulu kurduğunu bilen tek yer (RUN_PLAY §6.2). */
const DEFAULT_PROFILE = {
  'nesy.workflow.login': 'nesy.launch.cold-real-login',
  'nesy.workflow.login-rejected': 'nesy.launch.cold-real-login',
  'nesy.workflow.select-route': 'nesy.launch.reuse-session',
  // Zimmet: a route must already be selected, which is exactly what a
  // reuse-session profile installs. Loading into no schedule makes
  // `CreateInstantTask` answer "Schedule Not Found".
  'nesy.workflow.load-to-vehicle': 'nesy.launch.reuse-session',
  'nesy.workflow.open-stop': 'nesy.launch.reuse-session',
  'nesy.workflow.process-parcel': 'nesy.launch.direct-state',
  'nesy.workflow.complete-delivery': 'nesy.launch.direct-state',
  'nesy.workflow.tour-approval-lifecycle': 'nesy.launch.reuse-session',
}

// ---------------------------------------------------------------------------
//  Argümanlar
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = {
    workflowRef: '',
    device: process.env.VERDICT_DEVICE ?? 'R6CW400BC8N',
    appId: process.env.VERDICT_APP_ID ?? 'com.arasdigital.nesymobile.rstest',
    profileKey: undefined,
    inputs: {},
    reset: false,
    timeoutSec: 180,
    json: false,
    logcat: true,
    injectedFault: null,
    injectedFaultHost: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const next = () => {
      const value = argv[++i]
      if (value === undefined) throw new Error(`${arg} bir değer bekliyor`)
      return value
    }
    switch (arg) {
      case '--device': opts.device = next(); break
      case '--app-id': opts.appId = next(); break
      case '--profile': opts.profileKey = next(); break
      case '--reset': opts.reset = true; break
      case '--json': opts.json = true; break
      case '--no-logcat': opts.logcat = false; break
      case '--timeout': opts.timeoutSec = Number(next()); break
      case '--injected-fault': opts.injectedFault = next(); break
      case '--injected-fault-host': opts.injectedFaultHost = next(); break
      case '--input': {
        const pair = next()
        const at = pair.indexOf('=')
        if (at < 0) throw new Error(`--input k=v biçiminde olmalı: ${pair}`)
        opts.inputs[pair.slice(0, at)] = pair.slice(at + 1)
        break
      }
      default:
        if (arg.startsWith('-')) throw new Error(`bilinmeyen seçenek: ${arg}`)
        if (opts.workflowRef) throw new Error('tek bir workflowRef verilebilir')
        opts.workflowRef = arg
    }
  }
  if (!opts.workflowRef) throw new Error('workflowRef zorunlu')
  if (opts.injectedFault && !opts.injectedFaultHost) {
    throw new Error('--injected-fault requires --injected-fault-host A|B')
  }
  return opts
}

// ---------------------------------------------------------------------------
//  HTTP — 422 bir SONUÇTUR, taşıma hatası değil: gövdesi sorunun kendisini taşır
// ---------------------------------------------------------------------------

async function req(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text.slice(0, 2000) }
  }
  return { status: res.status, body: json }
}

const step = (title) => console.log(`\n${'='.repeat(72)}\n${title}\n${'='.repeat(72)}`)
const canonicalDigest = (d) => /^sha256:[a-f0-9]{64}$/i.test(String(d ?? '').trim())
const versionKey = (v) => String(v ?? '').split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : -1))

function newerVersion(a, b) {
  const left = versionKey(a)
  const right = versionKey(b)
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const l = left[i] ?? -1
    const r = right[i] ?? -1
    if (l !== r) return l > r
  }
  return false
}

// ---------------------------------------------------------------------------
//  adb — yol macOS'e SABİTLENMEZ; repo çözücüsü, sonra $ADB_PATH, sonra PATH
// ---------------------------------------------------------------------------

function adbPath() {
  if (process.env.ADB_PATH) return process.env.ADB_PATH
  try {
    const { resolveAdbPath } = require_(join(REPO, 'packages/platform-paths/dist/index.js'))
    return resolveAdbPath() ?? 'adb'
  } catch {
    return 'adb'
  }
}

function adb(args, timeoutMs = 20_000) {
  return spawnSync(adbPath(), args, { encoding: 'utf8', timeout: timeoutMs })
}

// ---------------------------------------------------------------------------
//  Kontrol düzlemi — reset_state ve teşhis sondaları aynı executor'ı kullanır
// ---------------------------------------------------------------------------

async function controlExecutor(appId) {
  const mod = await import(
    new URL('../packages/control-channels/dist/node-executor.js', import.meta.url).href
  )
  return mod.createControlExecutor({ applicationId: appId, forceChannel: 'verdict' })
}

// ---------------------------------------------------------------------------
//  Ana akış
// ---------------------------------------------------------------------------

const opts = parseArgs(process.argv.slice(2))
const profileKey = opts.profileKey ?? DEFAULT_PROFILE[opts.workflowRef]
if (!profileKey) {
  console.error(
    `HATA: ${opts.workflowRef} için varsayılan launch profile bilinmiyor. --profile ver.\n` +
      'profileKey olmadan uygulamayı hiçbir şey soğuk başlatmaz ve ilk bekleme adımı zaman aşımına uğrar.',
  )
  process.exit(64)
}

step(`0. HEDEF — ${opts.workflowRef}`)
console.log(`device=${opts.device} appId=${opts.appId}`)
console.log(`profileKey=${profileKey}`)
console.log(`inputs=${JSON.stringify(opts.inputs)}`)
console.log(`adb=${adbPath()}`)

step('1. CİHAZ HAZIRLIĞI')
const readiness = await req(
  'GET',
  `/verdict/runtime/devices/${encodeURIComponent(opts.device)}/readiness?appId=${encodeURIComponent(opts.appId)}`,
)
console.log(`HTTP ${readiness.status} overall=${readiness.body.overall ?? '?'}`)
for (const lane of readiness.body.lanes ?? []) {
  if (lane.status !== 'UP') console.log(`  DOWN/BLOCKED: ${JSON.stringify(lane)}`)
}

step('2. PACK PİNLE')
const packs = await req('GET', '/verdict/runtime/domain-packs')
const published = (packs.body.items ?? []).filter(
  (p) => p.publicationState === 'PUBLISHED' && canonicalDigest(p.bundleDigest),
)
const compileReady = published.filter((p) => p.compileReady === true)
const base = compileReady.length > 0 ? compileReady : published
const preferred = base.filter((p) => p.packKey === 'nesy.courier')
const candidates = preferred.length > 0 ? preferred : base
let pack = null
for (const candidate of candidates) {
  if (pack === null || newerVersion(candidate.version, pack.version)) pack = candidate
}
if (!pack) {
  console.error('HATA: pinlenebilir published pack yok — cockpit de aynı yerde durur.')
  process.exit(2)
}
console.log(
  `katalog=${(packs.body.items ?? []).length} published=${published.length} compileReady=${compileReady.length}`,
)
console.log(`pinlendi: ${pack.packKey}@${pack.version} digest=${pack.bundleDigest.slice(0, 24)}…`)

step('3. WORKFLOW IR')
const wf = await req('GET', `/workflows/${encodeURIComponent(opts.workflowRef)}`)
const currentVersion = wf.body?.data?.currentVersion ?? {}
const nodes = currentVersion.nodes ?? []
const connections = currentVersion.connections ?? []
console.log(`HTTP ${wf.status} version=${currentVersion.version ?? '?'} nodes=${nodes.length} connections=${connections.length}`)
// Boş kanvas kasıtlı olarak geçerli: derleyici pack'in makro anlık görüntüsünden
// materyalize eder. Bu YALNIZCA tek makrolu iş akışlarında çalışır (§3.4).
if (nodes.length === 0) console.log('  (boş kanvas — pack anlık görüntüsünden materyalize edilecek)')

step('4. DERLE')
const compiled = await req('POST', '/verdict/runtime/compile', {
  workflowRef: opts.workflowRef,
  workflowIr: { nodes, connections },
  domainPackKey: pack.packKey,
  domainPackVersion: pack.version,
  domainPackDigest: pack.bundleDigest,
})
console.log(`HTTP ${compiled.status} ok=${compiled.body.ok} planRef=${compiled.body.compiledPlanRef ?? '-'}`)
for (const issue of compiled.body.issues ?? []) {
  console.log(`  [${issue.severity}] ${issue.code}: ${issue.message}`)
}
if (!compiled.body.ok) {
  console.error('\nDERLEMEDE DURDU — koşu hiç başlamazdı.')
  process.exit(3)
}

if (opts.reset) {
  step('4b. RESET_STATE (koşudan ÖNCE)')
  // Kasıtlı olarak koşudan önce: hem önkoşulu geri kurar (login ekranı), hem de
  // eskiden bir sonraki koşuyu stale_run'a düşüren kanal müdahalesini tekrarlar.
  const exec = await controlExecutor(opts.appId)
  const res = await exec.run(opts.device, {
    op: 'reset_state',
    requestId: `runner-reset-${Date.now()}`,
    scope: 'probe',
  })
  console.log(res.ok ? 'reset_state OK' : `reset_state HATA ${res.code} ${res.detail ?? ''}`)
}

step('5. KOŞUYU BAŞLAT')
adb(['-s', opts.device, 'logcat', '-c'])
// Benzersiz korelasyon HER ZAMAN enjekte edilir: koşu başlatma idempotent olduğu
// için aynı gövde aynı runId'yi döndürür ve "düzelttim ama değişmedi" sanılır.
const inputs = {
  ...opts.inputs,
  sessionCorrelationId:
    opts.inputs.sessionCorrelationId ?? `runner-${Date.now()}-${process.pid}`,
}
const started = await req('POST', '/verdict/runtime/runs', {
  workflowRef: opts.workflowRef,
  deviceId: opts.device,
  appId: opts.appId,
  compiledPlanRef: compiled.body.compiledPlanRef,
  compiledPlanHash: compiled.body.compiledPlanHash,
  domainPackKey: pack.packKey,
  domainPackVersion: pack.version,
  domainPackDigest: pack.bundleDigest,
  profileKey,
  inputs,
  ...(opts.injectedFault
    ? { injectedFault: opts.injectedFault, injectedFaultHost: opts.injectedFaultHost }
    : {}),
})
const runId = started.body?.run?.runId ?? started.body?.runId
console.log(`HTTP ${started.status} runId=${runId ?? '-'}`)
if (!runId) {
  console.error(JSON.stringify(started.body, null, 2).slice(0, 2000))
  console.error('\nBAŞLATMADA DURDU — runId dönmedi.')
  process.exit(4)
}

step('6. YOKLA')
const deadline = Date.now() + opts.timeoutSec * 1000
const terminal = new Set(['completed', 'failed', 'cancelled', 'error', 'blocked'])
let detail = {}
let lastLine = ''
while (Date.now() < deadline) {
  const polled = await req('GET', `/verdict/runtime/runs/${encodeURIComponent(runId)}`)
  detail = polled.body
  const run = detail.run ?? {}
  const steps = detail.steps ?? []
  const line = `status=${run.status} lifecycle=${run.lifecycle ?? '-'} verdict=${run.product_verdict ?? '-'} steps=${steps.length}`
  if (line !== lastLine) {
    console.log(`[${String(Math.round((opts.timeoutSec * 1000 - (deadline - Date.now())) / 1000)).padStart(3)}s] ${line}`)
    lastLine = line
  }
  if (terminal.has(String(run.status))) break
  await new Promise((r) => setTimeout(r, 2000))
}

step('7. SONUÇ')
const run = detail.run ?? {}
console.log(`verdict          = ${run.product_verdict ?? '-'}`)
console.log(`failureClass     = ${run.evaluation_failure_class ?? '-'}`)
console.log(`termination      = ${run.termination_reason ?? '-'}`)
console.log(`lifecycle        = ${run.lifecycle ?? '-'}`)
if (run.failure_detail) console.log(`failureDetail    = ${JSON.stringify(run.failure_detail).slice(0, 500)}`)
const runtime = detail.runtime ?? {}
console.log(`injectedFault    = ${runtime.injectedFault ?? started.body?.injectedFault ?? 'null'}`)
console.log(`expectedClass    = ${runtime.expectedClass ?? started.body?.expectedClass ?? 'null'}`)
console.log(`observedClass    = ${runtime.observedClass ?? 'null'}`)
console.log(`cleanup          = ${runtime.cleanupResult ?? run.cleanup_result ?? '-'}`)

const steps = detail.steps ?? []
console.log(`\nADIMLAR (${steps.length})`)
for (const s of steps) {
  const id = s.plan_step_id ?? s.planStepId ?? '?'
  const action = s.action_result ?? s.actionResult ?? '-'
  const gate = s.continue_gate_result ?? s.continueGateResult ?? '-'
  const oracle = s.final_oracle_result ?? s.finalOracleResult ?? '-'
  console.log(`  ${String(id).padEnd(24)} action=${String(action).padEnd(12)} gate=${String(gate).padEnd(12)} oracle=${oracle}`)
}

const evaluations = detail.oracleEvaluations ?? []
const unmet = evaluations.filter((e) => {
  const status = String(e.status ?? e.requirement_status ?? '')
  return status !== '' && status !== 'MET' && status !== 'SATISFIED'
})
if (unmet.length > 0) {
  console.log(`\nKARŞILANMAYAN GEREKSİNİMLER (${unmet.length}/${evaluations.length})`)
  for (const e of unmet.slice(0, 25)) {
    console.log(`  ${e.fact_key ?? e.factKey ?? '?'} → ${e.status ?? e.requirement_status} ${e.evidence_refs ? JSON.stringify(e.evidence_refs).slice(0, 120) : ''}`)
  }
}

const transitions = detail.actionTransitions ?? []
if (transitions.length > 0) {
  // Cihazın REDDETME SEBEBİ burada — bir adım düştüğünde ilk bakılacak yer.
  console.log(`\nSON AKSİYON GEÇİŞLERİ`)
  for (const t of transitions.slice(-8)) {
    console.log(`  ${t.plan_step_id ?? t.planStepId ?? '?'} → ${t.outcome ?? t.action_result ?? '?'} ${t.evidence_ref ?? ''}`)
  }
}

if (opts.logcat) {
  step('8. LOGCAT (cihaz tarafı)')
  const out = adb(['-s', opts.device, 'logcat', '-d', '-v', 'brief']).stdout ?? ''
  const keep = out
    .split(/\r?\n/)
    .filter((l) => /verdict|nesy|websocket|bridge|auth|cleartext/i.test(l))
  console.log(keep.slice(-60).join('\n') || '(eşleşen logcat satırı yok)')
}

if (opts.json) {
  step('9. HAM DETAY')
  console.log(JSON.stringify(detail, null, 2).slice(0, 20000))
}

console.log(`\nrunId=${runId}`)
process.exit(run.product_verdict === 'PASS_ONLINE' ? 0 : 1)
