/**
 * Phase 7.18–7.19 — capture policy + audit/redaction/purge selection + Act refuse.
 */

import { describe, expect, it } from 'vitest'
import {
  BridgeDeviceGate,
  type AdbFacade,
  type DeviceGatePolicy,
} from '../bridge-device-gate.js'
import { readWorkflowIrV2 } from '../workflow-ir-v2.js'
import {
  CapturePolicyEngine,
  DEFAULT_DIAGNOSTIC_CAPTURE_POLICY,
  type DiagnosticCaptureAudit,
  type DiagnosticHealthSnapshot,
  type DiagnosticOsExecutor,
  type MemoryPressureDetected,
} from './CapturePolicyEngine.js'
import { selectSensitiveCapturesForPurge } from './sensitive-capture-purge.js'

function policy(overrides?: { d3Enabled?: boolean }) {
  return {
    ...DEFAULT_DIAGNOSTIC_CAPTURE_POLICY,
    enabled: {
      ...DEFAULT_DIAGNOSTIC_CAPTURE_POLICY.enabled,
      D3_HEAPDUMP: overrides?.d3Enabled ?? DEFAULT_DIAGNOSTIC_CAPTURE_POLICY.enabled.D3_HEAPDUMP,
    },
  }
}

function context(overrides: Partial<MemoryPressureDetected> = {}): MemoryPressureDetected {
  return {
    event: 'MEMORY_PRESSURE_DETECTED',
    serial: 'emulator-5554',
    packageName: 'com.arasdigital.nesymobile.automation',
    runId: 'run-1',
    sessionId: 'session-1',
    screen: 'DeliveryScreen',
    operation: 'loadDeliveries',
    spanId: 'span-42',
    buildProfile: 'test',
    requestedBy: 'operator@nesy',
    memoryBeforeMb: 100,
    memoryPeakMb: 120,
    ...overrides,
  }
}

function fixture(options?: {
  health?: Partial<DiagnosticHealthSnapshot>
  capturePolicy?: ReturnType<typeof policy>
}) {
  let now = 1_000_000
  let captureSequence = 0
  let freeBytes = 1024 * 1024 * 1024
  const audits: DiagnosticCaptureAudit[] = []
  const osCalls: string[] = []
  const currentHealth: DiagnosticHealthSnapshot = {
    pid: 321,
    apiLevel: 35,
    profileable: true,
    inCriticalSpan: false,
    screen: 'DeliveryScreen',
    operation: 'loadDeliveries',
    spanId: 'span-42',
    ...options?.health,
  }

  const diagnostics: DiagnosticOsExecutor = {
    async captureMeminfo(input) {
      osCalls.push(`meminfo:${input.pid}`)
      return { artifactPath: `/artifacts/${input.captureId}/meminfo.txt` }
    },
    async capturePerfetto(input) {
      osCalls.push(`perfetto:${input.captureId}`)
      return { artifactPath: `/artifacts/${input.captureId}/trace.perfetto-trace` }
    },
    async captureHeapDump(input) {
      osCalls.push(`heap:${input.packageName}`)
      return { artifactPath: `/artifacts/${input.captureId}/heap.hprof` }
    },
    async deviceFreeBytes() {
      return freeBytes
    },
  }

  const engine = new CapturePolicyEngine({
    diagnostics,
    healthProbe: {
      async getHealth() {
        return { ...currentHealth }
      },
    },
    markerGateway: {
      async markDiagnostic() {
        return String(now)
      },
    },
    auditSink: {
      async record(audit) {
        audits.push(audit)
      },
    },
    policy: options?.capturePolicy,
    now: () => now,
    newCaptureId: () => {
      captureSequence += 1
      return `cap-${captureSequence}`
    },
  })

  return {
    engine,
    audits,
    osCalls,
    advance(ms: number) {
      now += ms
    },
  }
}

describe('Phase 7.18 capture policy', () => {
  it('happy path without pressure performs no OS dump', async () => {
    const f = fixture()
    expect(f.osCalls).toEqual([])
    expect(f.audits).toEqual([])
  })

  it('pressure captures scoped D1/D2 and never auto D3', async () => {
    const f = fixture()
    await f.engine.onMemoryPressure(context())
    f.advance(1)
    await f.engine.onMemoryPressure(context())
    expect(f.osCalls.some((c) => c.startsWith('meminfo'))).toBe(true)
    expect(f.audits.some((a) => a.level === 'D3_HEAPDUMP' && a.status === 'captured')).toBe(false)
  })

  it('D3 heap dump requires explicit opt-in approval', async () => {
    const f = fixture({ capturePolicy: policy({ d3Enabled: true }) })
    const denied = await f.engine.requestHeapDump(context())
    expect(denied).toMatchObject({ status: 'skipped', skippedReason: 'opt_in_missing' })
    expect(f.osCalls).toEqual([])
  })
})

describe('Phase 7.19 security / retention / fail-fast', () => {
  it('audit rows carry actor/device/run fields without secret payloads', async () => {
    const f = fixture()
    await f.engine.onMemoryPressure(context())
    const audit = f.audits[0]
    expect(audit).toMatchObject({
      runId: 'run-1',
      sessionId: 'session-1',
      requestedBy: 'operator@nesy',
      level: 'D1_MEMINFO',
    })
    const keys = Object.keys(audit ?? {})
    expect(keys).not.toEqual(expect.arrayContaining(['password', 'pin', 'token', 'authorization']))
    expect(JSON.stringify(audit)).not.toMatch(/"password"|"pin"|"token"|"authorization"/i)
  })

  it('selects only sensitive captures older than retention SLA', () => {
    const now = Date.parse('2026-08-09T12:00:00.000Z')
    const ids = selectSensitiveCapturesForPurge(
      [
        { captureId: 'keep-fresh', sensitive: true, createdAt: now - 60_000 },
        { captureId: 'purge-old', sensitive: true, createdAt: now - 3_600_000 },
        { captureId: 'keep-nonsensitive', sensitive: false, createdAt: now - 3_600_000 },
      ],
      30 * 60_000,
      now,
    )
    expect(ids).toEqual(['purge-old'])
  })

  it('refuses Act Mode preflight on production user builds', async () => {
    const adb: AdbFacade = {
      async listDevices() {
        return ['PROD1']
      },
      async getProp(_deviceId, name) {
        const props: Record<string, string> = {
          'ro.build.type': 'user',
          'ro.debuggable': '0',
          'ro.product.model': 'SM-A346E',
          'ro.build.version.sdk': '34',
        }
        return props[name] ?? ''
      },
      async getPackageInfo() {
        return { installed: true, versionName: '1.0.0', versionCode: '1' }
      },
      async getEnabledAccessibilityServices() {
        return ''
      },
      async forward() {
        return
      },
      async listForwards() {
        return []
      },
      async removeForward() {
        return
      },
      async getDiagnostics() {
        return {
          batteryLevel: 50,
          charging: false,
          backgroundRestricted: false,
          foregroundPackage: null,
        }
      },
    }
    const gatePolicy: DeviceGatePolicy = {
      labAllowlist: ['PROD1'],
      denyProductionBuilds: true,
    }
    const result = await new BridgeDeviceGate(adb, gatePolicy).preflight('PROD1')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.failure.check).toBe('PRODUCTION_DENY')
  })

  it('compile/preflight fail-fast on missing required capability', () => {
    const result = readWorkflowIrV2(
      {
        schemaVersion: 2,
        workflowId: 'phase7.cap-fail',
        workflowVersion: 1,
        name: 'cap fail',
        source: { kind: 'FIXTURE', ref: 'phase7.cap-fail' },
        inputs: [],
        variables: [],
        entryStepId: 'noop',
        steps: [
          {
            planStepId: 'noop',
            kind: 'NOOP',
            next: null,
            sourceMapRef: 'sm-1',
            timeoutMs: 1_000,
            retryPolicy: { maxAttempts: 1, effectClass: 'READ_ONLY' },
            capabilityRequirements: [],
          },
        ],
        sourceMap: [{ ref: 'sm-1', planStepId: 'noop', domainSourceRef: 'phase7.cap-fail' }],
        policies: {
          runDeadlineMs: 60_000,
          cleanupDeadlineMs: 5_000,
          defaultRetry: { maxAttempts: 1, effectClass: 'READ_ONLY' },
          artifactPolicy: { captureOnSuccess: false, captureOnFailure: true, kinds: ['SCREENSHOT'] },
          redactionPolicy: {},
        },
        capabilityRequirements: [{ capability: 'bridge.wait_any', optional: false }],
      },
      ['bridge.tap'],
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues.map((i) => i.code)).toContain('UNSUPPORTED_CAPABILITY')
  })
})
