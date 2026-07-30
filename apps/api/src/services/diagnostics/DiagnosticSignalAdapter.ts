import type { TestBridgeEvent } from "../test-event-bridge.js";
import type {
  DiagnosticHealthSnapshot,
  DiagnosticRequestContext,
  MemoryPressureDetected,
} from "./CapturePolicyEngine.js";

/**
 * Adapts the existing SDK event; it does not define or publish a new wire name.
 */
export function toMemoryPressureDetected(
  event: TestBridgeEvent,
  hostContext: Omit<
    DiagnosticRequestContext,
    "runId" | "sessionId" | "screen" | "operation" | "spanId"
  >,
): MemoryPressureDetected | null {
  if (event.event !== "MEMORY_PRESSURE_DETECTED") return null;

  return {
    ...hostContext,
    event: "MEMORY_PRESSURE_DETECTED",
    runId: event.runId,
    sessionId: event.sessionId,
    screen: event.screen,
    operation: stringValue(event.data?.operation),
    spanId: event.spanId ?? null,
    memoryBeforeMb: numberValue(event.data?.memoryBeforeMb),
    memoryPeakMb: numberValue(event.data?.memoryPeakMb),
  };
}

export interface DiagnosticMarker {
  event: "DIAGNOSTIC_MARKER";
  captureId: string;
  label: string;
  monoTs: string;
  spanId: string | null;
}

/** Extracts the existing marker emitted by mark_diagnostic for CP5 correlation. */
export function toDiagnosticMarker(event: TestBridgeEvent): DiagnosticMarker | null {
  if (event.event !== "DIAGNOSTIC_MARKER") return null;
  const captureId = stringValue(event.data?.captureId);
  const label = stringValue(event.data?.label);
  const markerMonoTs = stringValue(event.data?.markerMonoTs) ?? String(event.monoTs);
  if (!captureId || !label || !/^\d+$/.test(markerMonoTs)) return null;
  return {
    event: "DIAGNOSTIC_MARKER",
    captureId,
    label,
    monoTs: markerMonoTs,
    spanId: event.spanId ?? null,
  };
}

/** Validates the existing get_health fields used by the policy. */
export function toDiagnosticHealthSnapshot(value: unknown): DiagnosticHealthSnapshot | null {
  if (!isRecord(value)) return null;
  const pid = integerValue(value.pid);
  const apiLevel = integerValue(value.apiLevel);
  if (
    pid === null ||
    pid <= 0 ||
    apiLevel === null ||
    apiLevel <= 0 ||
    typeof value.profileable !== "boolean" ||
    typeof value.inCriticalSpan !== "boolean"
  ) {
    return null;
  }
  return {
    pid,
    apiLevel,
    profileable: value.profileable,
    inCriticalSpan: value.inCriticalSpan,
    screen: stringValue(value.screen) ?? "",
    operation: stringValue(value.operation),
    spanId: stringValue(value.spanId),
  };
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function integerValue(value: unknown): number | null {
  const number = numberValue(value);
  return number !== undefined && Number.isSafeInteger(number) ? number : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
