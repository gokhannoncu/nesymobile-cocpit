import type { DiagnosticCaptureRecord } from '@/services/automation-api'

export interface DiagnosticSpanGroup {
  spanId: string
  captures: DiagnosticCaptureRecord[]
}

export interface DiagnosticOperationGroup {
  operation: string
  spans: DiagnosticSpanGroup[]
}

export interface DiagnosticScreenGroup {
  screen: string
  operations: DiagnosticOperationGroup[]
}

/**
 * Stable `screen → operation → spanId` projection used by the run detail UI.
 * Missing SDK context remains visible under an explicit "(unscoped)" label.
 */
export function groupDiagnosticCaptures(
  captures: readonly DiagnosticCaptureRecord[],
): DiagnosticScreenGroup[] {
  const screens = new Map<string, Map<string, Map<string, DiagnosticCaptureRecord[]>>>()

  for (const capture of captures) {
    const screen = capture.screen.trim() || '(unknown screen)'
    const operation = capture.operation?.trim() || '(unscoped operation)'
    const spanId = capture.spanId?.trim() || '(unscoped span)'
    const operations = screens.get(screen) ?? new Map()
    const spans = operations.get(operation) ?? new Map()
    const entries = spans.get(spanId) ?? []
    entries.push(capture)
    spans.set(spanId, entries)
    operations.set(operation, spans)
    screens.set(screen, operations)
  }

  return [...screens.entries()].map(([screen, operations]) => ({
    screen,
    operations: [...operations.entries()].map(([operation, spans]) => ({
      operation,
      spans: [...spans.entries()].map(([spanId, entries]) => ({
        spanId,
        captures: [...entries].sort(
          (left, right) =>
            new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
        ),
      })),
    })),
  }))
}

/**
 * Heap dumps and any future sensitive capture class are report-excluded unless
 * a caller makes an explicit includeSensitive choice.
 */
export function reportableDiagnosticCaptures(
  captures: readonly DiagnosticCaptureRecord[],
  includeSensitive = false,
): DiagnosticCaptureRecord[] {
  return captures.filter((capture) => includeSensitive || !capture.sensitive)
}

/** Minified automationRelease D2/D3 artefacts need their exact mapping.txt. */
export function needsMappingFile(capture: DiagnosticCaptureRecord): boolean {
  return (
    capture.status === 'captured' &&
    capture.buildProfile === 'automationRelease' &&
    capture.level !== 'D1_MEMINFO' &&
    !capture.mappingFileRef
  )
}
