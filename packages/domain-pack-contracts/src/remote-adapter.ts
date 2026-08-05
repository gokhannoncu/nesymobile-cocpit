/**
 * ===========================================================================
 *  Remote (back-office) adapter registry  (Plan D.6C · 4B.16)
 *
 *  Some business truths only exist on the other side of the network: a
 *  dispatcher approves a request, a supervisor releases a hold. A test that
 *  covers such a flow has to act as that second actor.
 *
 *  The tempting implementation is "let the workflow POST somewhere". Phase 4A
 *  already refused that in Core (`remote-action.ts`), and this registry is the
 *  Domain-Pack half of the same refusal:
 *
 *    ALLOWLISTED. An operation exists here or it cannot be called. There is no
 *    url, method, header, body or script field for an endpoint to hide in — the
 *    same absence Core enforces, for the same reason: a URL in an authored row
 *    is an SSRF primitive with a UI in front of it.
 *
 *    TYPED. Inputs and outputs are declared, and an output is bound to a
 *    normalized fact key. Untyped responses are how "HTTP 2xx" becomes the
 *    evidence.
 *
 *    AUDITED. Every mutation records its request. An unlogged back-office
 *    mutation performed by a test harness is indistinguishable from an incident.
 *
 *  And the rule that keeps setup honest: an operation whose role is `SETUP` may
 *  not bind business facts. A test that seeds its own precondition and then reads
 *  the seed back as evidence is validating its fixture.
 * ===========================================================================
 */

import type { EffectClass, IdempotencyClass } from "@nesy/workflow-contract";

/** What role a remote operation plays in the verdict. */
export type RemoteOperationRole = "SETUP" | "VALIDATION" | "ACTOR_ACTION" | "TEARDOWN";

export const REMOTE_OPERATION_ROLES: readonly RemoteOperationRole[] = [
  "SETUP",
  "VALIDATION",
  "ACTOR_ACTION",
  "TEARDOWN",
];

/**
 * Who the operation acts as.
 *
 * Present because a multi-actor flow's whole point is that a DIFFERENT person
 * does the second half. An operation with no declared actor makes a two-actor
 * test indistinguishable from a one-actor test with extra steps.
 */
export type RemoteActorRole = "DISPATCHER" | "SUPERVISOR" | "BACK_OFFICE_SYSTEM" | "SERVICE_ACCOUNT";

export interface RemoteOperationInputField {
  name: string;
  type: "string" | "number" | "boolean" | "entityRef";
  required: boolean;
  /** Required when `type` is `entityRef`. */
  entityTypeRef?: string;
  secret?: boolean;
}

/**
 * Binds a typed response field to a normalized fact.
 *
 * `entityStatusPath` is what makes the fact a business fact rather than a
 * transport one: the operation must be able to say WHICH record reached WHICH
 * status, not merely that a call succeeded.
 */
export interface RemoteOperationOutputBinding {
  factKey: string;
  /** Path into the adapter's normalized response. Opaque to Core. */
  responsePath: string;
  /** Path to the business status of the affected record, when applicable. */
  entityStatusPath?: string;
  /** Path to the correlation id tying the response to the request. */
  correlationPath?: string;
}

export interface RemoteOperationAuditPolicy {
  recordRequest: boolean;
  recordResponse: boolean;
  redactFields: readonly string[];
}

/**
 * One allowlisted back-office operation.
 *
 * Note the absent fields — url, method, headers, body, host, path, query,
 * script. There is deliberately nowhere for an endpoint to live.
 */
export interface RemoteAdapterOperation {
  /** Allowlisted operation id, e.g. "nesy.backoffice.approve-tour-request". */
  operationRef: string;
  displayName: string;
  businessMeaning: string;
  role: RemoteOperationRole;
  actorRole: RemoteActorRole;
  effectClass: EffectClass;
  idempotencyClass: IdempotencyClass;
  inputs: readonly RemoteOperationInputField[];
  outputs: readonly RemoteOperationOutputBinding[];
  audit: RemoteOperationAuditPolicy;
  /** Environments the operation may run in. Empty means "none declared". */
  allowedEnvironments: readonly string[];
  /**
   * Whether the operation can only report transport success.
   *
   * Declaring this true is honest and makes the operation unusable as
   * VALIDATION — which is the correct consequence.
   */
  transportSuccessOnly?: boolean;
}

/** One remote adapter and its complete allowlist. */
export interface RemoteAdapterDefinition {
  /** Adapter id, e.g. "nesy.backoffice". */
  adapterRef: string;
  displayName: string;
  /** Which system it talks to, for operators. Not a URL. */
  systemName: string;
  operations: readonly RemoteAdapterOperation[];
  /** Capability ids the adapter needs. */
  requiredCapabilityRefs: readonly string[];
}

/** Field names that would smuggle a raw HTTP call into an operation. */
export const FORBIDDEN_REMOTE_OPERATION_FIELDS: readonly string[] = [
  "url",
  "endpoint",
  "method",
  "headers",
  "body",
  "host",
  "port",
  "path",
  "query",
  "script",
  "curl",
];

export interface RemoteAdapterViolation {
  code:
    | "RAW_HTTP_FIELD"
    | "SETUP_BINDS_BUSINESS_FACT"
    | "VALIDATION_WITHOUT_OUTPUT_FACT"
    | "TRANSPORT_SUCCESS_AS_VALIDATION"
    | "BUSINESS_FACT_WITHOUT_ENTITY_STATUS"
    | "UNAUDITED_MUTATION"
    | "MUTATION_WITHOUT_ENVIRONMENT_ALLOWLIST"
    | "ENTITY_INPUT_UNTYPED";
  message: string;
}

const MUTATING_EFFECTS: readonly EffectClass[] = ["IDEMPOTENT_MUTATION", "NON_IDEMPOTENT_MUTATION", "UNKNOWN"];

/**
 * Validates one operation.
 *
 * Every check here corresponds to a way a real suite has gone green while
 * proving nothing, or has mutated a real system without a trace.
 */
export function validateRemoteAdapterOperation(
  operation: RemoteAdapterOperation,
  path: string,
): RemoteAdapterViolation[] {
  const violations: RemoteAdapterViolation[] = [];
  const raw = operation as unknown as Record<string, unknown>;

  for (const field of FORBIDDEN_REMOTE_OPERATION_FIELDS) {
    if (raw[field] !== undefined) {
      violations.push({
        code: "RAW_HTTP_FIELD",
        message: `${path}.${field}: a remote operation names an allowlisted adapter operation; it never carries transport detail`,
      });
    }
  }

  if (operation.role === "SETUP" && operation.outputs.length > 0) {
    violations.push({
      code: "SETUP_BINDS_BUSINESS_FACT",
      message: `${path}: SETUP operation "${operation.operationRef}" binds ${operation.outputs.length} output fact(s); a test would then be validating its own fixture`,
    });
  }

  if (operation.role === "VALIDATION") {
    if (operation.outputs.length === 0) {
      violations.push({
        code: "VALIDATION_WITHOUT_OUTPUT_FACT",
        message: `${path}: VALIDATION operation "${operation.operationRef}" binds no output fact; a transport-level success is not business evidence`,
      });
    }
    if (operation.transportSuccessOnly === true) {
      violations.push({
        code: "TRANSPORT_SUCCESS_AS_VALIDATION",
        message: `${path}: "${operation.operationRef}" can only observe transport success and cannot serve as VALIDATION`,
      });
    }
    for (const [index, output] of operation.outputs.entries()) {
      // HTTP 2xx is not a business fact. A validation output must be able to
      // say which record reached which status, and that it belongs to us.
      if (output.entityStatusPath === undefined || output.correlationPath === undefined) {
        violations.push({
          code: "BUSINESS_FACT_WITHOUT_ENTITY_STATUS",
          message: `${path}.outputs[${index}]: fact "${output.factKey}" needs both an entityStatusPath and a correlationPath; a 2xx response alone is not a business fact`,
        });
      }
    }
  }

  if (MUTATING_EFFECTS.includes(operation.effectClass)) {
    if (!operation.audit.recordRequest) {
      violations.push({
        code: "UNAUDITED_MUTATION",
        message: `${path}: mutating operation "${operation.operationRef}" must record its request; an untraced harness mutation is indistinguishable from an incident`,
      });
    }
    if (operation.allowedEnvironments.length === 0) {
      violations.push({
        code: "MUTATION_WITHOUT_ENVIRONMENT_ALLOWLIST",
        message: `${path}: mutating operation "${operation.operationRef}" declares no allowedEnvironments; nothing then stops it running against production`,
      });
    }
  }

  for (const [index, input] of operation.inputs.entries()) {
    if (input.type === "entityRef" && (input.entityTypeRef === undefined || input.entityTypeRef === "")) {
      violations.push({
        code: "ENTITY_INPUT_UNTYPED",
        message: `${path}.inputs[${index}]: entityRef input "${input.name}" must name an entityTypeRef`,
      });
    }
  }

  return violations;
}
