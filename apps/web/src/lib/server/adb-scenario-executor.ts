// ============================================================================
// Allowlisted ADB Scenario Executor
// ============================================================================
// Maps scenario IDs to typed steps — never runs free-form shell from the client.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolveAdbPath } from '@/lib/server/adb-path'
import { newRequestId } from '@nesy/control-contract'
import { parseBroadcastPayload } from '@nesy/control-channels'
import type { ControlOperation } from '@nesy/control-contract'
import { createControlExecutor, createNodeAdbRunner } from '@nesy/control-channels/node'
import { getAppIdentity } from '@/lib/server/adb'
import type { ScenarioStepEvent } from '@/data/engineering/device-lab/device-lab-types'

export type { ScenarioStepEvent }

const execFileAsync = promisify(execFile)

const SERIAL_RE = /^[\w.:-]+$/

const CHAOS_RECEIVER = 'com.arasdigital.nesymobile.adb.ChaosReceiver'
// PROTECTED_RECEIVER moved to `@nesy/control-channels` (C.9).
const SPLASH_ACTIVITY = 'com.arasdigital.nesymobile.SplashActivity'

type StepFn = (ctx: ExecContext) => Promise<string>

type ExecContext = {
  serial: string
  pkg: string
  params: Record<string, unknown>
}

async function adb(args: string[], timeoutMs = 30_000): Promise<string> {
  const bin = resolveAdbPath()
  if (!bin) throw new Error('adb binary not found (set ADB_PATH)')
  const { stdout, stderr } = await execFileAsync(bin, args, {
    timeout: timeoutMs,
    maxBuffer: 8 * 1024 * 1024,
  })
  return `${stdout ?? ''}${stderr ? `\n${stderr}` : ''}`.trim()
}

function shell(serial: string, cmd: string, timeoutMs = 30_000): Promise<string> {
  return adb(['-s', serial, 'shell', cmd], timeoutMs)
}

/**
 * Control-plane call for the Debug View (C.9).
 *
 * These steps render a human-readable log line, not a typed value, so the
 * contract result is formatted back into text. The receiver class name and
 * action string are no longer hardcoded here — Faz 4 deletes both receivers on
 * the mobile side and this file would otherwise break silently.
 *
 * `broadcast()` below stays for the CHAOS receiver: those actions are not part
 * of the control-plane contract (and `ChaosReceiver` does not currently exist in
 * the app — every `requiresChaos` scenario is gated for that reason).
 */
async function control(
  ctx: ExecContext,
  op: ControlOperation['op'] & ('get_device_id' | 'get_request_key'),
): Promise<string> {
  const executor = createControlExecutor({
    applicationId: ctx.pkg,
    adb: createNodeAdbRunner({ defaultTimeoutMs: 20_000 }),
  })
  const envelope = { requestId: newRequestId(op), scope: `debug-view:${ctx.serial}` }
  const res =
    op === 'get_device_id'
      ? await executor.run(ctx.serial, { ...envelope, op: 'get_device_id' })
      : await executor.run(ctx.serial, { ...envelope, op: 'get_request_key' })

  if (!res.ok) {
    // `raw` carries the device's own words (`ERROR:NO_USERNAME`); `detail`
    // explains a channel-level failure. Both are useful in the Debug View.
    return `${op} FAILED: ${res.code}${res.raw ? ` → ${res.raw}` : ''}${
      res.detail ? ` (${res.detail})` : ''
    }`
  }
  const value = 'deviceId' in res.data ? res.data.deviceId : res.data.key
  return `${op} OK\n→ data=${value}`
}

async function broadcast(
  serial: string,
  pkg: string,
  receiverClass: string,
  action: string,
  extras: string[] = [],
): Promise<string> {
  const component = `${pkg}/${receiverClass}`
  const args = ['-s', serial, 'shell', 'am', 'broadcast', '-n', component, '-a', action, ...extras]
  const out = await adb(args, 20_000)
  const data = parseBroadcastPayload(out)
  return data ? `${out}\n→ data=${data}` : out
}

async function chaos(
  ctx: ExecContext,
  action: string,
  extras: string[] = [],
): Promise<string> {
  return broadcast(ctx.serial, ctx.pkg, CHAOS_RECEIVER, action, extras)
}

async function forceStop(ctx: ExecContext): Promise<string> {
  return shell(ctx.serial, `am force-stop ${ctx.pkg}`)
}

async function startSplash(ctx: ExecContext): Promise<string> {
  return shell(ctx.serial, `am start -n ${ctx.pkg}/${SPLASH_ACTIVITY}`)
}

async function sleep(ms: number): Promise<string> {
  await new Promise((r) => setTimeout(r, ms))
  return `slept ${ms}ms`
}

function boolParam(params: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const v = params[key]
  if (typeof v === 'boolean') return v
  if (v === 'true' || v === '1') return true
  if (v === 'false' || v === '0') return false
  return fallback
}

function strParam(params: Record<string, unknown>, key: string, fallback = ''): string {
  const v = params[key]
  return typeof v === 'string' ? v : v != null ? String(v) : fallback
}

type ScenarioDef = {
  id: string
  steps: { label: string; run: StepFn }[]
  /** When true, requires chaos receiver (test/dev build) */
  requiresChaos?: boolean
}

const SCENARIOS: Record<string, ScenarioDef> = {
  'scn-mid-delivery-offline': {
    id: 'scn-mid-delivery-offline',
    steps: [
      { label: 'Disable Wi-Fi', run: (c) => shell(c.serial, 'svc wifi disable') },
      { label: 'Disable mobile data', run: (c) => shell(c.serial, 'svc data disable') },
      {
        label: 'Verify connectivity',
        run: (c) => shell(c.serial, 'dumpsys connectivity | head -n 20'),
      },
    ],
  },
  'scn-force-offline-flag': {
    id: 'scn-force-offline-flag',
    requiresChaos: true,
    steps: [
      {
        label: 'Force offlineMode=true',
        run: (c) =>
          chaos(c, 'com.arasdigital.nesymobile.SET_OFFLINE', [
            '--ez',
            'offline',
            String(boolParam(c.params, 'offline', true)),
          ]),
      },
    ],
  },
  'scn-restore-network': {
    id: 'scn-restore-network',
    steps: [
      { label: 'Enable Wi-Fi', run: (c) => shell(c.serial, 'svc wifi enable') },
      { label: 'Enable mobile data', run: (c) => shell(c.serial, 'svc data enable') },
      {
        label: 'Clear airplane mode',
        run: async (c) => {
          await shell(c.serial, 'settings put global airplane_mode_on 0')
          return shell(
            c.serial,
            'am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false',
          )
        },
      },
    ],
  },
  'scn-airplane-mode': {
    id: 'scn-airplane-mode',
    steps: [
      {
        label: 'Toggle airplane mode',
        run: async (c) => {
          const on = boolParam(c.params, 'enabled', true)
          await shell(c.serial, `settings put global airplane_mode_on ${on ? 1 : 0}`)
          return shell(
            c.serial,
            `am broadcast -a android.intent.action.AIRPLANE_MODE --ez state ${on}`,
          )
        },
      },
    ],
  },
  'scn-network-flap': {
    id: 'scn-network-flap',
    steps: [
      {
        label: 'Wi-Fi flap ×3',
        run: async (c) => {
          const lines: string[] = []
          for (let i = 0; i < 3; i++) {
            lines.push(await shell(c.serial, 'svc wifi disable'))
            await sleep(800)
            lines.push(await shell(c.serial, 'svc wifi enable'))
            await sleep(1200)
          }
          return lines.filter(Boolean).join('\n') || 'flap complete'
        },
      },
    ],
  },
  'scn-clear-token': {
    id: 'scn-clear-token',
    requiresChaos: true,
    steps: [
      {
        label: 'Clear token',
        run: (c) => chaos(c, 'com.arasdigital.nesymobile.CLEAR_TOKEN'),
      },
      { label: 'Force-stop app', run: forceStop },
      { label: 'Relaunch Splash', run: startSplash },
    ],
  },
  'scn-corrupt-token': {
    id: 'scn-corrupt-token',
    requiresChaos: true,
    steps: [
      {
        label: 'Corrupt token',
        run: (c) => chaos(c, 'com.arasdigital.nesymobile.CORRUPT_TOKEN'),
      },
    ],
  },
  'scn-expire-token-foreground': {
    id: 'scn-expire-token-foreground',
    requiresChaos: true,
    steps: [
      {
        label: 'Inject expired JWT',
        run: (c) => chaos(c, 'com.arasdigital.nesymobile.SET_TOKEN_EXPIRY_HINT'),
      },
      { label: 'Force-stop app', run: forceStop },
      { label: 'Relaunch Splash', run: startSplash },
    ],
  },
  'scn-schedule-yesterday': {
    id: 'scn-schedule-yesterday',
    requiresChaos: true,
    steps: [
      {
        label: 'Set scheduleDate=yesterday',
        run: (c) =>
          chaos(c, 'com.arasdigital.nesymobile.SET_SCHEDULE_DATE', [
            '--es',
            'date_offset',
            'yesterday',
          ]),
      },
      { label: 'Force-stop app', run: forceStop },
      { label: 'Relaunch Splash', run: startSplash },
    ],
  },
  'scn-schedule-tomorrow': {
    id: 'scn-schedule-tomorrow',
    requiresChaos: true,
    steps: [
      {
        label: 'Set scheduleDate=tomorrow',
        run: (c) =>
          chaos(c, 'com.arasdigital.nesymobile.SET_SCHEDULE_DATE', [
            '--es',
            'date_offset',
            'tomorrow',
          ]),
      },
      { label: 'Force-stop app', run: forceStop },
      { label: 'Relaunch Splash', run: startSplash },
    ],
  },
  'scn-clear-schedule': {
    id: 'scn-clear-schedule',
    requiresChaos: true,
    steps: [
      {
        label: 'Clear schedule tables',
        run: (c) =>
          chaos(c, 'com.arasdigital.nesymobile.CLEAR_SCHEDULE', [
            '--ez',
            'clear_queue',
            String(boolParam(c.params, 'clearQueue', false)),
          ]),
      },
      { label: 'Force-stop app', run: forceStop },
      { label: 'Relaunch Splash', run: startSplash },
    ],
  },
  'scn-restart-shipment': {
    id: 'scn-restart-shipment',
    requiresChaos: true,
    steps: [
      {
        label: 'Restart shipment by waybill',
        run: (c) => {
          const waybill = strParam(c.params, 'waybill')
          if (!waybill) throw new Error('waybill parameter is required')
          return chaos(c, 'com.arasdigital.nesymobile.RESTART_SHIPMENT', [
            '--es',
            'waybill',
            waybill,
          ])
        },
      },
    ],
  },
  'scn-alt-api-endpoint': {
    id: 'scn-alt-api-endpoint',
    requiresChaos: true,
    steps: [
      {
        label: 'Set alternative API host',
        run: (c) => {
          const host = strParam(c.params, 'host')
          if (!host) throw new Error('host parameter is required')
          const scheme = strParam(c.params, 'scheme', 'https')
          const port = Number(c.params.port ?? 0) || 0
          return chaos(c, 'com.arasdigital.nesymobile.SET_ALT_URL', [
            '--es',
            'host',
            host,
            '--es',
            'scheme',
            scheme,
            '--ei',
            'port',
            String(port),
          ])
        },
      },
      { label: 'Force-stop app', run: forceStop },
      { label: 'Relaunch Splash', run: startSplash },
    ],
  },
  'scn-force-stop-mid-tour': {
    id: 'scn-force-stop-mid-tour',
    steps: [
      { label: 'Force-stop app', run: forceStop },
      {
        label: 'Wait',
        run: async (c) => {
          const sec = Math.min(30, Math.max(1, Number(c.params.waitSec ?? 2) || 2))
          return sleep(sec * 1000)
        },
      },
      { label: 'Relaunch Splash', run: startSplash },
    ],
  },
  'scn-pm-clear-cold': {
    id: 'scn-pm-clear-cold',
    steps: [
      {
        label: 'pm clear (destructive)',
        run: (c) => shell(c.serial, `pm clear ${c.pkg}`, 60_000),
      },
      { label: 'Relaunch Splash', run: startSplash },
    ],
  },
  'scn-revoke-location': {
    id: 'scn-revoke-location',
    steps: [
      {
        label: 'Revoke ACCESS_FINE_LOCATION',
        run: (c) =>
          shell(c.serial, `pm revoke ${c.pkg} android.permission.ACCESS_FINE_LOCATION`),
      },
      {
        label: 'Revoke ACCESS_COARSE_LOCATION',
        run: (c) =>
          shell(c.serial, `pm revoke ${c.pkg} android.permission.ACCESS_COARSE_LOCATION`),
      },
    ],
  },
  'scn-revoke-camera': {
    id: 'scn-revoke-camera',
    steps: [
      {
        label: 'Revoke CAMERA',
        run: (c) => shell(c.serial, `pm revoke ${c.pkg} android.permission.CAMERA`),
      },
    ],
  },
  'scn-dump-courier-state': {
    id: 'scn-dump-courier-state',
    requiresChaos: true,
    steps: [
      {
        label: 'DUMP_STATE',
        run: (c) => chaos(c, 'com.arasdigital.nesymobile.DUMP_STATE'),
      },
    ],
  },
  'scn-get-protected-key': {
    id: 'scn-get-protected-key',
    requiresChaos: true,
    steps: [
      {
        label: 'GET_DEVICE_ID',
        run: (c) => control(c, 'get_device_id'),
      },
      {
        label: 'GET_KEY',
        run: (c) => control(c, 'get_request_key'),
      },
    ],
  },
  'scn-capture-bugreport': {
    id: 'scn-capture-bugreport',
    steps: [
      {
        label: 'Collect device props',
        run: (c) =>
          shell(
            c.serial,
            'getprop ro.product.model; getprop ro.build.version.release; getprop ro.build.version.sdk; dumpsys battery | grep -E "level|status"',
          ),
      },
      {
        label: 'Package dump',
        run: (c) =>
          shell(
            c.serial,
            `dumpsys package ${c.pkg} | grep -E "versionName|versionCode|DEBUGGABLE|userId"`,
          ),
      },
      {
        label: 'Recent logcat (app)',
        run: (c) =>
          shell(c.serial, 'logcat -d -t 80 -s ChaosReceiver:I ProtectedKeyReceiver:I RestartDebug:D', 20_000),
      },
    ],
  },
}

let activeRunId: string | null = null

export function listExecutableScenarioIds(): string[] {
  return Object.keys(SCENARIOS)
}

export async function* executeScenario(opts: {
  scenarioId: string
  serial: string
  params?: Record<string, unknown>
}): AsyncGenerator<ScenarioStepEvent> {
  const { scenarioId, serial } = opts
  const params = opts.params ?? {}

  if (!SERIAL_RE.test(serial)) {
    yield { type: 'error', message: 'Invalid serial' }
    return
  }
  if (!resolveAdbPath()) {
    yield { type: 'error', message: 'adb binary not found' }
    return
  }

  const def = SCENARIOS[scenarioId]
  if (!def) {
    yield { type: 'error', message: `Unknown scenario: ${scenarioId}` }
    return
  }

  if (activeRunId) {
    yield { type: 'error', message: `Another run is active: ${activeRunId}` }
    return
  }

  const runId = `RUN-${Date.now()}`
  activeRunId = runId

  try {
    const identity = await getAppIdentity(serial)
    if (!identity.packageName) {
      yield { type: 'error', message: 'NesyMobile package not installed on device', runId }
      return
    }

    const ctx: ExecContext = { serial, pkg: identity.packageName, params }
    yield {
      type: 'step',
      step: 0,
      label: 'Resolve package',
      status: 'completed',
      output: `package=${ctx.pkg}`,
      runId,
    }

    let failed = false
    for (let i = 0; i < def.steps.length; i++) {
      const step = def.steps[i]!
      const stepNum = i + 1
      yield { type: 'step', step: stepNum, label: step.label, status: 'running', runId }
      try {
        const output = await step.run(ctx)
        yield {
          type: 'step',
          step: stepNum,
          label: step.label,
          status: 'completed',
          output: output || 'OK',
          runId,
        }
      } catch (err) {
        failed = true
        yield {
          type: 'step',
          step: stepNum,
          label: step.label,
          status: 'failed',
          output: err instanceof Error ? err.message : String(err),
          runId,
        }
        break
      }
    }

    yield {
      type: 'done',
      runStatus: failed ? 'failed' : 'success',
      runId,
    }
  } finally {
    activeRunId = null
  }
}

export function isScenarioExecutable(id: string): boolean {
  return id in SCENARIOS
}
