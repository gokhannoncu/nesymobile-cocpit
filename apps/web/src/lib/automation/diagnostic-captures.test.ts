import { describe, expect, it } from 'vitest'
import type { DiagnosticCaptureRecord } from '@/services/automation-api'
import {
  groupDiagnosticCaptures,
  needsMappingFile,
  reportableDiagnosticCaptures,
} from './diagnostic-captures'

function capture(
  overrides: Partial<DiagnosticCaptureRecord> = {},
): DiagnosticCaptureRecord {
  return {
    id: 'row-1',
    captureId: 'cap-1',
    runId: 'run-1',
    sessionId: 'session-1',
    level: 'D1_MEMINFO',
    triggerEvent: 'MEMORY_PRESSURE_DETECTED',
    status: 'captured',
    screen: 'DeliveryScreen',
    operation: 'loadDeliveries',
    spanId: 'span-42',
    pid: 321,
    markerPreMonoTs: '100',
    markerPostMonoTs: '101',
    artifactRef: '/captures/cap-1/meminfo.txt',
    mappingFileRef: null,
    sensitive: false,
    skippedReason: null,
    errorMessage: null,
    buildProfile: 'test',
    requestedBy: 'tester',
    optInApprovedBy: null,
    optInApprovedAt: null,
    createdAt: '2026-07-30T10:00:00.000Z',
    completedAt: '2026-07-30T10:00:01.000Z',
    ...overrides,
  }
}

describe('diagnostic capture UI projection', () => {
  it('groups artefacts beneath screen, operation, and spanId', () => {
    const groups = groupDiagnosticCaptures([
      capture(),
      capture({
        id: 'row-2',
        captureId: 'cap-2',
        level: 'D2_PERFETTO',
        createdAt: '2026-07-30T10:00:02.000Z',
      }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.screen).toBe('DeliveryScreen')
    expect(groups[0]?.operations[0]?.operation).toBe('loadDeliveries')
    expect(groups[0]?.operations[0]?.spans[0]?.spanId).toBe('span-42')
    expect(groups[0]?.operations[0]?.spans[0]?.captures.map((item) => item.captureId)).toEqual([
      'cap-1',
      'cap-2',
    ])
  })

  it('excludes sensitive heap artefacts from report data by default', () => {
    const safe = capture()
    const heap = capture({
      id: 'row-heap',
      captureId: 'cap-heap',
      level: 'D3_HEAPDUMP',
      sensitive: true,
      artifactRef: '/captures/cap-heap/heap.hprof',
    })

    expect(reportableDiagnosticCaptures([safe, heap])).toEqual([safe])
    expect(reportableDiagnosticCaptures([safe, heap], true)).toEqual([safe, heap])
  })

  it('flags unsymbolicated automationRelease D2 captures', () => {
    expect(
      needsMappingFile(
        capture({
          level: 'D2_PERFETTO',
          buildProfile: 'automationRelease',
        }),
      ),
    ).toBe(true)
    expect(
      needsMappingFile(
        capture({
          level: 'D2_PERFETTO',
          buildProfile: 'automationRelease',
          mappingFileRef: '/captures/cap-1/mapping.txt',
        }),
      ),
    ).toBe(false)
  })
})
