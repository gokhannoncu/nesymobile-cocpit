/**
 * ===========================================================================
 *  COURIER_LOGIN slice  (Plan D.6C · RUN_PLAY 4B.18)
 *
 *  THE DISTINCTION THIS SLICE EXISTS TO PROTECT
 *
 *  Almost every other slice needs an authenticated app, and driving the real
 *  login screens for each one is slow. So a `PREPARED_SESSION` launch profile
 *  exists and is used everywhere — correctly.
 *
 *  The failure mode is that the LOGIN test starts using it too. Every test gets
 *  faster, including the one that was supposed to prove login works, and it now
 *  passes without ever logging in. Nobody notices until login breaks in
 *  production and the suite is still green.
 *
 *  Two things stop that here:
 *
 *    1. This slice's launch profile is `nesy.launch.cold-real-login`
 *       (`sessionPreparation: REAL_UI_LOGIN`). `validateLaunchProfile` refuses a
 *       `PREPARED_SESSION` or `DIRECT_STATE` profile that claims
 *       `producesProductVerdict: true`, so a setup shortcut cannot be swapped in
 *       and keep the verdict.
 *
 *    2. The Final Oracle needs all THREE planes: the backend accepted the
 *       credentials, the app holds a session, and the device persisted one
 *       (`APP.LOGIN_SUCCEEDED`, a correlated derivation). A prepared session
 *       satisfies the app-plane fact and nothing else, so it cannot fake this.
 *
 *  PRODUCT PATH
 *
 *  NesyMobile couriers sign in with the PIN tab (`R.id.pinView` + `btn_login`),
 *  not the username/password tab. This macro drives that real PIN path.
 * ===========================================================================
 */

import type { BridgeFlowPlanSnapshot, MacroDefinition, MacroExpansionSnapshot } from "@nesy/domain-pack-contracts";
import type { WorkflowStepV2 } from "@nesy/workflow-contract";
import { NESY_BACKOFFICE_ADAPTER_REF, NESY_BACKOFFICE_OPERATIONS } from "../adapters/backoffice.js";
import { NESY_FACTS } from "../registries/facts.js";
import { NESY_ACTIONS, NESY_SCREENS } from "../registries/screens.js";
import { NESY_TARGETS } from "../registries/targets.js";
import type { NesyReferenceSlice } from "../slice.js";
import { NESY_DEFAULT_INTERRUPT_POLICY, NESY_UI_ONLY_RELEASE_ISOLATION } from "./common.js";
import { irDocument, requires, sourceMapEntry, stepBase } from "./ir-authoring.js";

export const NESY_LOGIN_MACRO_KEY = "nesy.macro.login";

const STEPS: readonly WorkflowStepV2[] = [
  {
    ...stepBase({ planStepId: "wait-login-ready", sourceMapRef: "sm-login-1", next: "resolve-pin-field", timeoutMs: 30_000 }),
    kind: "WAIT_EVENT",
    factKey: NESY_FACTS.LOGIN_SCREEN_READY,
    sourceLane: "UI",
    stableForMs: 300,
    // The login screen is not entity-scoped, so requiring an entity match would
    // leave this permanently unresolved.
    requireCorrelation: false,
    onTimeout: "FAIL",
  },
  // NO "select the PIN tab" STEP, deliberately.
  //
  // There used to be a `resolve-pin-tab` + `select-pin-tab` pair whose identity was
  // the tab's visible label. On the device that label is not unique: the tab is a
  // LinearLayout carrying `content-desc="PIN"` wrapping a TextView carrying
  // `text="PIN"`, and NEITHER node has a resource id. A lookup for "PIN" therefore
  // matched two nodes, and with `ambiguityPolicy: FAIL` the step failed — sometimes.
  // Measured on a real device: the same plan gave SUCCEEDED, REJECTED and FAILED on
  // three consecutive runs, which reads as flakiness in the product rather than as
  // an unresolvable target in the pack.
  //
  // The tap was never on the happy path to begin with: this slice's launch profile
  // is `nesy.launch.cold-real-login` (`startMode: COLD_START`), and a freshly
  // started process always opens with the PIN tab selected and `pinView` present.
  // So the recovery it provided was for a state a cold start cannot be in, bought at
  // the cost of an ambiguous mutation on every run.
  //
  // A conditional tap ("only if the PIN field is absent") is NOT expressible today:
  // `bridge.node` operands resolve from evidence facts, not from a live node query,
  // so the condition would be UNKNOWN on every run. If that changes, this is where
  // the recovery branch belongs.
  {
    ...stepBase({
      planStepId: "resolve-pin-field",
      sourceMapRef: "sm-login-4",
      next: "enter-pin",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.loginPinField,
    outputVariable: "pinFieldHandle",
  },
  {
    ...stepBase({
      planStepId: "enter-pin",
      sourceMapRef: "sm-login-5",
      next: "resolve-submit",
      capabilityRequirements: [requires("verdict.core.bridge.set-text")],
    }),
    kind: "BRIDGE_ACTION",
    action: "setText",
    targetVariable: "pinFieldHandle",
    args: { valueRef: "run.input.pin" },
    // PIN digits are a declared secret; restate redaction at the step because
    // this is the artifact most likely to be attached to a bug report.
    redactionPolicy: { redactAllInputs: true },
  },
  {
    ...stepBase({
      planStepId: "resolve-submit",
      sourceMapRef: "sm-login-6",
      next: "tap-submit",
      capabilityRequirements: [requires("verdict.core.bridge.resolve-target")],
    }),
    kind: "RESOLVE_TARGET",
    targetRef: NESY_TARGETS.loginSubmit,
    outputVariable: "submitHandle",
  },
  {
    ...stepBase({
      planStepId: "tap-submit",
      sourceMapRef: "sm-login-7",
      next: "verify-backend-session",
      timeoutMs: 30_000,
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "submitHandle",
    // Readiness only. Leaving the login screen is not proof of authentication —
    // that is what the Final Oracle below is for.
    continueGate: {
      allOf: [NESY_FACTS.ROUTE_LIST_READY],
      noneOf: [NESY_FACTS.SESSION_EXPIRED_DIALOG_PRESENT],
      deadlineMs: 30_000,
      unknownPolicy: "RETRY",
    },
  },
  {
    ...stepBase({
      planStepId: "verify-backend-session",
      sourceMapRef: "sm-login-8",
      next: "assert-login",
      timeoutMs: 30_000,
      capabilityRequirements: [requires("verdict.core.remote.allowlisted-operation")],
    }),
    kind: "REMOTE_ACTION",
    spec: {
      adapterRef: NESY_BACKOFFICE_ADAPTER_REF,
      operationRef: NESY_BACKOFFICE_OPERATIONS.readSession,
      role: "VALIDATION",
      effectClass: "READ_ONLY",
      idempotencyClass: "NATURALLY_IDEMPOTENT",
      inputBindings: [{ name: "sessionCorrelationId", source: { kind: "runInput", path: "sessionCorrelationId" } }],
      outputFactBindings: [{ factKey: NESY_FACTS.AUTH_ACCEPTED, responsePath: "session.accepted" }],
      timeoutPolicy: { timeoutMs: 20_000, maxAttempts: 2, backoffMs: 1_000 },
      reconciliationPolicy: "NONE",
      auditPolicy: { recordRequest: true, recordResponse: true, redactFields: ["session.tokenHint"] },
      allowedEnvironments: ["qa", "staging"],
    },
  },
  {
    ...stepBase({ planStepId: "assert-login", sourceMapRef: "sm-login-9", next: null }),
    kind: "ASSERT_FACT",
    factKey: NESY_FACTS.LOGIN_SUCCEEDED,
    expected: true,
    unknownPolicy: "FAIL",
    finalOraclePolicy: {
      requirements: [
        { factKey: NESY_FACTS.LOGIN_SUCCEEDED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        { factKey: NESY_FACTS.AUTH_ACCEPTED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        {
          factKey: NESY_FACTS.USER_SESSION_AVAILABLE_LOCAL,
          obligation: "REQUIRED",
          timing: "EVENTUAL",
          deadlineMs: 30_000,
          onTimeout: "INCONCLUSIVE",
        },
        {
          factKey: NESY_FACTS.USER_SESSION_AVAILABLE_APP,
          obligation: "REQUIRED",
          timing: "IMMEDIATE",
          onTimeout: "FAIL",
        },
      ],
    },
  },
  {
    ...stepBase({ planStepId: "clear-session", sourceMapRef: "sm-login-10", next: null, timeoutMs: 30_000 }),
    kind: "CLEANUP",
    compensatesStepIds: ["tap-submit"],
    runOnFailure: true,
  },
];

const GENERIC_IR = irDocument({
  workflowId: "nesy.reference.login",
  name: "Courier PIN login through the real UI",
  sourceRef: NESY_LOGIN_MACRO_KEY,
  inputs: [
    { name: "pin", type: "string", required: true, secret: true },
    { name: "sessionCorrelationId", type: "string", required: true },
  ],
  variables: [
    { name: "pinFieldHandle", type: "string" },
    { name: "submitHandle", type: "string" },
  ],
  steps: STEPS,
  entryStepId: "wait-login-ready",
  capabilityRequirements: [
    requires("verdict.core.bridge.tap"),
    requires("verdict.core.bridge.set-text"),
    requires("verdict.core.bridge.watch-fact"),
  ],
  sourceMap: [
    sourceMapEntry("sm-login-1", "wait-login-ready", NESY_LOGIN_MACRO_KEY, "login screen readiness"),
    sourceMapEntry("sm-login-4", "resolve-pin-field", NESY_LOGIN_MACRO_KEY),
    sourceMapEntry("sm-login-5", "enter-pin", NESY_LOGIN_MACRO_KEY),
    sourceMapEntry("sm-login-6", "resolve-submit", NESY_LOGIN_MACRO_KEY),
    sourceMapEntry("sm-login-7", "tap-submit", NESY_LOGIN_MACRO_KEY),
    sourceMapEntry("sm-login-8", "verify-backend-session", NESY_LOGIN_MACRO_KEY, "backend fact, not a screen transition"),
    sourceMapEntry("sm-login-9", "assert-login", NESY_LOGIN_MACRO_KEY),
    sourceMapEntry("sm-login-10", "clear-session", NESY_LOGIN_MACRO_KEY),
  ],
});

const EXPANSION: MacroExpansionSnapshot = {
  macroRef: NESY_LOGIN_MACRO_KEY,
  authoredBy: "COMPILER",
  genericIr: GENERIC_IR,
  irSourceMap: GENERIC_IR.sourceMap,
  domainSourceMap: [
    {
      ref: "ds-login-1",
      macroRef: NESY_LOGIN_MACRO_KEY,
      planStepIds: STEPS.map((step) => step.planStepId),
      sliceRef: "COURIER_LOGIN",
      note: "Whole macro expands into one linear PIN-login leg plus a backend validation and a cleanup.",
    },
  ],
};

const BRIDGE_PLAN: BridgeFlowPlanSnapshot = {
  macroRef: NESY_LOGIN_MACRO_KEY,
  authoredBy: "COMPILER",
  requiredCapabilityRefs: ["verdict.core.bridge.tap", "verdict.core.bridge.set-text"],
  legs: [
    { planStepId: "wait-login-ready", bridgeVerb: "watch", awaitFactKey: NESY_FACTS.LOGIN_SCREEN_READY },
    { planStepId: "enter-pin", bridgeVerb: "setText", targetRef: NESY_TARGETS.loginPinField },
    {
      planStepId: "tap-submit",
      bridgeVerb: "tap",
      targetRef: NESY_TARGETS.loginSubmit,
      awaitFactKey: NESY_FACTS.ROUTE_LIST_READY,
    },
  ],
};

export const NESY_LOGIN_MACRO: MacroDefinition = {
  macroKey: NESY_LOGIN_MACRO_KEY,
  actionRef: NESY_ACTIONS.login,
  displayName: "Courier PIN login",
  businessMeaning:
    "A courier signs in with their device PIN through the product's own login screens and ends up with a session that exists on the backend, in the app and on the device.",
  notResponsibleFor: [
    "username/password tab login",
    "password reset and account recovery",
    "biometric re-authentication",
    "session refresh after expiry (the expired-session dialog is FATAL here on purpose)",
    "multi-device session eviction",
  ],
  input: {
    fields: [
      {
        name: "pin",
        type: "string",
        required: true,
        secret: true,
        description: "Courier device PIN (NesyMobile PIN tab / loginDevice).",
      },
      {
        name: "sessionCorrelationId",
        type: "string",
        required: true,
        description: "Correlates the app sign-in with the backend session record.",
      },
    ],
  },
  output: {
    fields: [
      { name: "sessionEstablished", type: "boolean", factKey: NESY_FACTS.LOGIN_SUCCEEDED },
      { name: "sessionCorrelationId", type: "string" },
    ],
  },
  preconditions: [
    { kind: "SCREEN_READY", ref: NESY_SCREENS.login, deadlineMs: 30_000, onUnmet: "FAIL" },
    { kind: "FACT_FALSE", ref: NESY_FACTS.USER_SESSION_AVAILABLE_APP, deadlineMs: 5_000, onUnmet: "FAIL" },
  ],
  allowedRegistryRefs: {
    screenRefs: [NESY_SCREENS.login, NESY_SCREENS.routeStopList],
    surfaceRefs: [],
    entityTypeRefs: [],
    targetRefs: [NESY_TARGETS.loginPinTab, NESY_TARGETS.loginPinField, NESY_TARGETS.loginSubmit],
    factKeys: [
      NESY_FACTS.LOGIN_SCREEN_READY,
      NESY_FACTS.ROUTE_LIST_READY,
      NESY_FACTS.SESSION_EXPIRED_DIALOG_PRESENT,
      NESY_FACTS.AUTH_ACCEPTED,
      NESY_FACTS.USER_SESSION_AVAILABLE_APP,
      NESY_FACTS.USER_SESSION_AVAILABLE_LOCAL,
      NESY_FACTS.LOGIN_SUCCEEDED,
    ],
    queryRefs: ["nesy.sessionState"],
    adapterOperationRefs: [NESY_BACKOFFICE_OPERATIONS.readSession],
  },
  oracleTemplate: {
    continueGate: {
      allOf: [NESY_FACTS.ROUTE_LIST_READY],
      noneOf: [NESY_FACTS.SESSION_EXPIRED_DIALOG_PRESENT],
      deadlineMs: 30_000,
      unknownPolicy: "RETRY",
    },
    finalOracle: {
      requirements: [
        { factKey: NESY_FACTS.LOGIN_SUCCEEDED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        { factKey: NESY_FACTS.AUTH_ACCEPTED, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        {
          factKey: NESY_FACTS.USER_SESSION_AVAILABLE_LOCAL,
          obligation: "REQUIRED",
          timing: "EVENTUAL",
          deadlineMs: 30_000,
          onTimeout: "INCONCLUSIVE",
        },
      ],
    },
    notResponsibleFor: ["whether the route list content is correct — only that it became ready"],
  },
  interruptPolicy: NESY_DEFAULT_INTERRUPT_POLICY,
  requiredCapabilityRefs: [
    "verdict.core.bridge.tap",
    "verdict.core.bridge.set-text",
    "verdict.core.bridge.resolve-target",
    "verdict.core.bridge.watch-fact",
    "verdict.core.remote.allowlisted-operation",
  ],
  expansionSnapshot: EXPANSION,
  bridgeFlowPlanSnapshot: BRIDGE_PLAN,
};

export const COURIER_LOGIN_SLICE: NesyReferenceSlice = {
  sliceKey: "COURIER_LOGIN",
  displayName: "Courier PIN login",
  businessMeaning: NESY_LOGIN_MACRO.businessMeaning,
  notResponsibleFor: NESY_LOGIN_MACRO.notResponsibleFor,
  inputSchema: NESY_LOGIN_MACRO.input,
  outputSchema: NESY_LOGIN_MACRO.output,
  preconditions: NESY_LOGIN_MACRO.preconditions,
  screenRefs: [NESY_SCREENS.login, NESY_SCREENS.routeStopList],
  surfaceRefs: [],
  entityBindings: [],
  targetResolutionRefs: [NESY_TARGETS.loginPinTab, NESY_TARGETS.loginPinField, NESY_TARGETS.loginSubmit],
  semanticMacroRef: NESY_LOGIN_MACRO_KEY,
  macroExpansion: EXPANSION,
  genericIrSnapshot: GENERIC_IR,
  bridgeFlowPlanSnapshot: BRIDGE_PLAN,
  oracle: NESY_LOGIN_MACRO.oracleTemplate,
  interruptPolicy: NESY_LOGIN_MACRO.interruptPolicy,
  requiredCapabilityRefs: NESY_LOGIN_MACRO.requiredCapabilityRefs,
  releaseIsolation: NESY_UI_ONLY_RELEASE_ISOLATION,
  negativeCases: [
    {
      caseKey: "PREPARED_SESSION_CLAIMS_LOGIN_PASS",
      scenario:
        "Someone speeds the suite up by running this slice under nesy.launch.prepared-session. The app is already signed in, the route list is ready, and the slice reports PASS without any login having happened.",
      refusedBy:
        "validateLaunchProfile: PREPARED_SESSION/DIRECT_STATE cannot declare producesProductVerdict:true. Additionally APP.LOGIN_SUCCEEDED is a CORRELATED_ALL_OF over the backend, app and local planes, which a session injection cannot satisfy.",
    },
    {
      caseKey: "SCREEN_TRANSITION_AS_AUTHENTICATION",
      scenario:
        "The app navigates away from the login screen on a cached session while the backend rejected the credentials. A UI-only oracle would call that a pass.",
      refusedBy:
        "REMOTE.AUTH_ACCEPTED is a REQUIRED IMMEDIATE oracle requirement, sourced from an allowlisted back-office read with an entity status and a correlation id.",
    },
    {
      caseKey: "SESSION_EXPIRY_SILENTLY_HANDLED",
      scenario:
        "A session-expired dialog appears and an interrupt handler dismisses it by signing in again, converting a real session regression into a slower green run.",
      refusedBy:
        "nesy.session-expired-dialog has defaultPolicy FAIL and blocksProductVerdict true, and it is listed in fatalSurfaceRefs rather than handledSurfaceRefs.",
    },
  ],
};
