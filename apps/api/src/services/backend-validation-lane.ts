/**
 * Backend Validation Lane — shared helpers for derived post-BridgeFlow checks.
 *
 * Lane nodes are ephemeral on the canvas (not persisted). Matching
 * WorkflowStepResult rows use nodeId prefix `__bv__` so the UI can show
 * progress after BridgeFlow and the Run Result Backend tab can list them.
 */

export const BACKEND_VALIDATION_STEP_PREFIX = "__bv__";

/** Node types whose completion policy (or server-step role) requires backend. */
const BACKEND_REQUIRED_TYPES = new Set([
  "DELIVERY_OPERATION",
  "VALIDATE_STOPLIST",
  "VERIFY_BACKEND_STATE",
  "TOUR_APPROVE",
  "PICKUP_ASSIGN",
  "EOD_APPROVE",
]);

export type BackendValidationKind = "event_tower" | "server_step" | "logcat_backend";

export interface BackendValidationSourceNode {
  id: string;
  type: string;
  data?: {
    title?: string;
    subtitle?: string;
    config?: Record<string, unknown>;
  };
}

export interface DerivedBackendValidation {
  sourceNodeId: string;
  sourceNodeType: string;
  sourceTitle: string;
  stepNodeId: string;
  kind: BackendValidationKind;
  title: string;
  subtitle: string;
}

export function backendValidationStepId(sourceNodeId: string): string {
  return `${BACKEND_VALIDATION_STEP_PREFIX}${sourceNodeId}`;
}

export function isBackendValidationStepId(nodeId: string): boolean {
  return nodeId.startsWith(BACKEND_VALIDATION_STEP_PREFIX);
}

export function sourceNodeIdFromBackendStep(stepNodeId: string): string {
  return stepNodeId.slice(BACKEND_VALIDATION_STEP_PREFIX.length);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function nodeNeedsBackendValidation(node: BackendValidationSourceNode): boolean {
  const config = asRecord(node.data?.config);
  if (config.verifyBackend === true) return true;

  const policy = config.completionPolicy;
  if (policy && typeof policy === "object" && !Array.isArray(policy)) {
    const required = (policy as Record<string, unknown>).required;
    if (Array.isArray(required) && required.includes("backend")) return true;
  }

  return BACKEND_REQUIRED_TYPES.has(node.type);
}

function kindForType(type: string): BackendValidationKind {
  if (
    type === "VALIDATE_STOPLIST" ||
    type === "TOUR_APPROVE" ||
    type === "PICKUP_ASSIGN" ||
    type === "EOD_APPROVE"
  ) {
    return "server_step";
  }
  if (type === "VERIFY_BACKEND_STATE") return "logcat_backend";
  return "event_tower";
}

function humanizeType(type: string): string {
  return type
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

const TYPE_LABELS: Record<string, string> = {
  VALIDATE_STOPLIST: "Validate StopList",
  DELIVERY_OPERATION: "Delivery Operation",
  VERIFY_BACKEND_STATE: "Verify Backend State",
  TOUR_APPROVE: "Tour Approve",
  PICKUP_ASSIGN: "Pickup Assign",
  EOD_APPROVE: "EOD Approve",
};

function resolveSourceLabel(sourceNodeType: string, sourceTitle: string): string {
  if (sourceTitle && sourceTitle !== sourceNodeType) return sourceTitle;
  return TYPE_LABELS[sourceNodeType] ?? humanizeType(sourceNodeType);
}

function descriptionForValidation(sourceNodeType: string, kind: BackendValidationKind): string {
  switch (sourceNodeType) {
    case "VALIDATE_STOPLIST":
      return "GetMyScheduleByZoneCode — zone, courier, schedule & stop list";
    case "DELIVERY_OPERATION":
      return "EventTower GetEvents confirms delivery status on backend";
    case "VERIFY_BACKEND_STATE":
      return "Logcat backend state matches expected assertion";
    case "TOUR_APPROVE":
      return "GetWaitingLeavingRequests → ApproveLeavingPermission";
    case "PICKUP_ASSIGN":
      return "Device hub/branch/zone → AssignPickupToCourier";
    case "EOD_APPROVE":
      return "End-of-day approval confirmed on server";
    default:
      if (kind === "server_step") return "Server-side API validation after BridgeFlow";
      if (kind === "logcat_backend") return "Backend state verified via app logcat";
      return "EventTower GetEvents confirms operation on backend";
  }
}

function titleForValidation(sourceNodeType: string, sourceTitle: string): string {
  return resolveSourceLabel(sourceNodeType, sourceTitle);
}

function subtitleForValidation(sourceNodeType: string, kind: BackendValidationKind): string {
  return descriptionForValidation(sourceNodeType, kind);
}

/** Derive ordered backend validations from a courier workflow graph. */
export function deriveBackendValidations(
  nodes: BackendValidationSourceNode[],
): DerivedBackendValidation[] {
  const derived: DerivedBackendValidation[] = [];
  for (const node of nodes) {
    if (!node?.id || !node.type) continue;
    if ((node as { parentNode?: unknown }).parentNode) continue;
    if (!nodeNeedsBackendValidation(node)) continue;

    const sourceTitle = node.data?.title?.trim() || node.type;
    const kind = kindForType(node.type);
    derived.push({
      sourceNodeId: node.id,
      sourceNodeType: node.type,
      sourceTitle,
      stepNodeId: backendValidationStepId(node.id),
      kind,
      title: titleForValidation(node.type, sourceTitle),
      subtitle: subtitleForValidation(node.type, kind),
    });
  }
  return derived;
}

export interface BackendHttpCapture {
  method: string;
  url: string;
  headers?: Record<string, string>;
  requestBody?: unknown;
  status?: number;
  responseBody?: unknown;
  error?: string;
}

export interface BackendValidationStepOutput {
  kind: "backend_validation";
  sourceNodeId: string;
  sourceNodeType: string;
  sourceTitle: string;
  validationKind: BackendValidationKind;
  verdict: "passed" | "failed" | "pending";
  detail: string;
  requests: BackendHttpCapture[];
}

export function buildBackendValidationOutput(
  partial: Omit<BackendValidationStepOutput, "kind">,
): string {
  return JSON.stringify({ kind: "backend_validation", ...partial } satisfies BackendValidationStepOutput);
}

export function parseBackendValidationOutput(raw: string | null | undefined): BackendValidationStepOutput | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BackendValidationStepOutput>;
    if (parsed.kind !== "backend_validation") return null;
    return parsed as BackendValidationStepOutput;
  } catch {
    return null;
  }
}

/** Mask auth-like header values for Run Result display / persistence. */
export function maskSensitiveHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!headers) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (/authorization|token|cookie|x-protected-request-key/i.test(key)) {
      out[key] = value ? "***" : "";
    } else {
      out[key] = value;
    }
  }
  return out;
}
