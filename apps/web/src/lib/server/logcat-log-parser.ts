// Stateful parser for `adb logcat -v epoch,uid` output.
//
// Line format (one physical log line):
//   <epoch> <uid> <pid> <tid> <level> <tag>: <message>
// e.g. "  1784183401.246  1000  1429  2069 I SurfaceFlinger: Current= 120"
//
// The `uid` column is either numeric (1000, 10723) or symbolic (gps, radio,
// shell, u0_aNNN). It classifies each line into a LogSource, extracts
// shipment/request/fiscal/correlation identifiers, coalesces multi-line crash
// stack traces into a single event, and filters by the requested sources and
// levels before emitting. It never mutates the device — parsing only.

import type {
  LogBuffer,
  LogEvent,
  LogLevel,
  LogSource,
} from '@/data/engineering/device-lab/device-lab-types'

/** logcat single-letter level → LogLevel. */
const LEVEL_BY_LETTER: Record<string, LogLevel> = {
  V: 'verbose',
  D: 'debug',
  I: 'info',
  W: 'warn',
  E: 'error',
  F: 'fatal',
}

/** LogLevel → logcat filter letter (for `*:<L>` volume threshold). */
export const LEVEL_LETTER: Record<LogLevel, string> = {
  verbose: 'V',
  debug: 'D',
  info: 'I',
  warn: 'W',
  error: 'E',
  fatal: 'F',
}

const LEVEL_RANK: Record<LogLevel, number> = {
  verbose: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
}

/** Lowest (most verbose) level among the requested set — used as the logcat threshold. */
export function minLevelLetter(levels: LogLevel[]): string {
  if (levels.length === 0) return 'V'
  const lowest = levels.reduce((a, b) => (LEVEL_RANK[b] < LEVEL_RANK[a] ? b : a))
  return LEVEL_LETTER[lowest]
}

// ── Source classification ───────────────────────────────────────────
//
// Exact NesyMobile tags (from the Android source) mapped to a LogSource.
// Order of resolution: crash → known app tag → network → app uid → system.

const TAG_SOURCE: Record<string, LogSource> = {
  // network
  OkHttpLog: 'okhttp',
  NetworkCheck: 'network',
  NetworkChange: 'network',
  PakHeaderStatus: 'network',
  // offline queue / request pipeline
  RequestSenderService: 'offline-queue',
  ARAS_REQUEST_SERVICE: 'offline-queue',
  RetryPolicy: 'offline-queue',
  RequestDelete: 'offline-queue',
  createRequest: 'offline-queue',
  parseRequestJson: 'offline-queue',
  // room / db
  RoomQuery: 'room',
  // payment
  RaiPay: 'payment',
  SoftPOS: 'payment',
  PrinterManager: 'payment',
  CPCL: 'payment',
  // scanner
  ScanProcessor: 'scanner',
  ScannerDialogFragment: 'scanner',
  BarcodeReject: 'scanner',
  // location
  ARAS_LOCATION_SERVICE: 'location',
  // health/perf → app
  CHECK_HEALTH_SERVICE_TAG: 'app',
  PerfTrace: 'app',
  // delivery / UI → app
  DeliveryFragment: 'app',
  Pickup: 'app',
  TaskListFragment: 'app',
  StopListFragment: 'app',
  StopsFragment: 'app',
  CollectionsPolling: 'app',
  MockCollections: 'app',
  NavDebug: 'app',
  GrayLabel: 'app',
  TwoDelayFlow: 'app',
  CreateScheduleGuard: 'app',
  ScheduleRepo: 'app',
  SignaturePad: 'app',
  ShowInfoDialog: 'app',
  showLoadErrorDialog: 'app',
  RestartDebug: 'app',
  NESY_TEST_EVENT: 'app',
  InteractionEvent: 'app',
  ArasApplication: 'app',
  CallLog: 'app',
}

/** Tags that indicate a crash/native-fatal context regardless of level. */
const CRASH_TAGS = new Set([
  'AndroidRuntime',
  'DEBUG',
  'libc',
  'OOM',
  'ForceLogout',
])

const RADIO_TAG_RE = /telephony|telecom|radio|gsm|ril\b/i

function classifySource(
  tag: string,
  level: LogLevel,
  uid: number | null,
  appUid: number | null,
  message: string,
): LogSource {
  // 1. crash
  if (
    level === 'fatal' ||
    CRASH_TAGS.has(tag) ||
    /FATAL EXCEPTION|ANR in |Process crash|beginning of crash/i.test(message)
  ) {
    return 'crash'
  }
  // 2. known app-specific tag
  const mapped = TAG_SOURCE[tag]
  if (mapped) return mapped
  // 3. network by tag keyword
  if (/okhttp|retrofit|http/i.test(tag)) return 'okhttp'
  if (/network|connectivity/i.test(tag)) return 'network'
  // keyword heuristics for the remaining categories
  if (/fiscal/i.test(tag)) return 'fiscal'
  if (/payment|pos\b|printer/i.test(tag)) return 'payment'
  if (/scan|barcode/i.test(tag)) return 'scanner'
  if (/location|gps|geofence/i.test(tag)) return 'location'
  if (/room|sqlite|dao\b/i.test(tag)) return 'room'
  if (/firebase|fcm|messaging/i.test(tag)) return 'firebase'
  if (/work(er|manager)/i.test(tag)) return 'workmanager'
  // 4. app uid
  if (appUid != null && uid === appUid) return 'app'
  // 5. system
  return 'system'
}

function deriveBuffer(source: LogSource, tag: string): LogBuffer {
  if (source === 'crash') return 'crash'
  if (RADIO_TAG_RE.test(tag)) return 'radio'
  return 'main'
}

// ── Correlation extraction ──────────────────────────────────────────

/** Returns the first capture group of the first matching regex, or undefined. */
function firstCapture(text: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = text.match(re)
    if (m?.[1]) return m[1]
  }
  return undefined
}

function extractCorrelation(text: string): {
  shipmentId?: string
  requestId?: string
  fiscalId?: string
  correlationId?: string
} {
  const shipmentId = firstCapture(text, [
    /shipment(?:Id)?["'\s:=]+"?([A-Za-z0-9_-]{2,})/i,
    /waybill(?:Number)?["'\s:=]+"?(\d{6,})/i,
    /\b(SHP-\d+)\b/,
  ])
  const requestId = firstCapture(text, [
    /request(?:Id)?["'\s:=]+"?([A-Za-z0-9_-]{2,})/i,
    /\b(req-[A-Za-z0-9]+)\b/,
    /uniqueKey["'\s:=]+"?([A-Za-z0-9_-]{2,})/i,
  ])
  const fiscalId = firstCapture(text, [
    /fiscal(?:invoice)?id["'\s:=]+"?([A-Za-z0-9_-]{2,})/i,
    /\b(FSC-\d+)\b/,
  ])
  const correlationId = firstCapture(text, [
    /correlation(?:Id)?["'\s:=]+"?([A-Za-z0-9_-]{2,})/i,
    /x-correlation-id["'\s:=]+"?([A-Za-z0-9_-]{2,})/i,
    /\b(corr-[A-Za-z0-9-]+)\b/,
  ])
  return { shipmentId, requestId, fiscalId, correlationId }
}

// ── Stack-frame detection ───────────────────────────────────────────

function isStackFrame(message: string): boolean {
  const t = message.trimStart()
  return (
    /^at\s+[\w$.<>]+\(/.test(t) ||
    /^Caused by:/.test(t) ||
    /^\.\.\.\s+\d+\s+more/.test(t) ||
    /^Suppressed:/.test(t)
  )
}

// ── Hashing (deterministic id for reconnect dedup) ──────────────────

function fnv1a(str: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

// ── Line regex ──────────────────────────────────────────────────────

const LINE_RE =
  /^\s*(\d+\.\d+)\s+(\S+)\s+(\d+)\s+(\d+)\s+([VDIWEF])\s+(.*?):\s?(.*)$/

interface ParsedLine {
  epochMs: number
  uid: number | null
  pid: number
  tid: number
  level: LogLevel
  tag: string
  message: string
  raw: string
}

/** Parses one physical logcat line. Returns null for non-log lines. */
export function parseLogcatLine(line: string): ParsedLine | null {
  if (line.length > 32_768) return null
  const m = LINE_RE.exec(line)
  if (!m) return null
  const [, epoch, uidRaw, pid, tid, letter, tag, message] = m
  const level = LEVEL_BY_LETTER[letter ?? ''] ?? 'info'
  const uidNum = Number(uidRaw)
  return {
    epochMs: Math.round(Number(epoch) * 1000),
    uid: Number.isFinite(uidNum) ? uidNum : null,
    pid: Number(pid),
    tid: Number(tid),
    level,
    tag: (tag ?? '').trim(),
    message: message ?? '',
    raw: line,
  }
}

export interface LogcatParserOptions {
  /** Numeric uid of the NesyMobile app, used for `app` classification. */
  appUid: number | null
  /** Package name attached to app-owned events (null when unknown). */
  packageName: string | null
  /** Only emit events whose source is in this set (empty = all). */
  sources: LogSource[]
  /** Only emit events whose level is in this set (empty = all). */
  levels: LogLevel[]
}

export interface LogcatParser {
  feed(line: string): void
  /** Emits any buffered crash event. Call when the stream ends. */
  flush(): void
}

/**
 * Creates a stateful parser. `onEvent` is called once per emitted LogEvent,
 * already filtered by the requested sources/levels.
 */
export function createLogcatParser(
  opts: LogcatParserOptions,
  onEvent: (event: LogEvent) => void,
): LogcatParser {
  const sourceSet = new Set(opts.sources)
  const levelSet = new Set(opts.levels)
  const passes = (source: LogSource, level: LogLevel) =>
    (sourceSet.size === 0 || sourceSet.has(source)) &&
    (levelSet.size === 0 || levelSet.has(level))

  // Pending crash event being assembled from a header + stack frames.
  let pending: { event: LogEvent; frames: string[]; tid: number; tag: string } | null = null

  const emitPending = () => {
    if (!pending) return
    const { event, frames } = pending
    if (frames.length > 0) event.stackTrace = frames.join('\n')
    if (passes(event.source, event.level)) onEvent(event)
    pending = null
  }

  const build = (p: ParsedLine): LogEvent => {
    const source = classifySource(p.tag, p.level, p.uid, opts.appUid, p.message)
    const correlation = extractCorrelation(`${p.tag} ${p.message}`)
    const id = `${p.epochMs}:${p.pid}:${p.tid}:${fnv1a(`${p.tag}|${p.message}`)}`
    return {
      id,
      timestamp: new Date(p.epochMs).toISOString(),
      epochMs: p.epochMs,
      source,
      level: p.level,
      tag: p.tag,
      message: p.message,
      processId: p.pid,
      threadId: p.tid,
      uid: p.uid,
      packageName:
        opts.appUid != null && p.uid === opts.appUid ? opts.packageName : null,
      buffer: deriveBuffer(source, p.tag),
      raw: p.raw,
      ...correlation,
    }
  }

  return {
    feed(line: string) {
      const p = parseLogcatLine(line)
      if (!p) {
        // A stack frame can arrive with a metadata prefix (parses fine) — but a
        // rare bare continuation line won't. Attach it to the pending crash.
        if (pending && isStackFrame(line)) {
          pending.frames.push(line.trimEnd())
          pending.event.raw += `\n${line}`
        }
        return
      }

      // Attach continuation lines to an in-progress crash on the same thread:
      // either an explicit stack frame, or another line from the same crash tag
      // (AndroidRuntime/DEBUG/libc emit the exception type and frames as
      // separate consecutive lines).
      if (
        pending &&
        p.tid === pending.tid &&
        (isStackFrame(p.message) ||
          (p.tag === pending.tag && CRASH_TAGS.has(p.tag)))
      ) {
        pending.frames.push(p.message.trimEnd())
        pending.event.raw += `\n${p.raw}`
        return
      }

      // Any unrelated line closes an open crash group.
      emitPending()

      const event = build(p)

      // Start buffering a crash whose header should collect following frames.
      if (
        event.source === 'crash' &&
        (/FATAL EXCEPTION|Exception|Error:|ANR in /i.test(p.message) ||
          CRASH_TAGS.has(p.tag))
      ) {
        pending = { event, frames: [], tid: p.tid, tag: p.tag }
        return
      }

      if (passes(event.source, event.level)) onEvent(event)
    },
    flush() {
      emitPending()
    },
  }
}
