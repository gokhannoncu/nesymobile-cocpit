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
 *    2. The Final Oracle requires the app plane AND the local plane, each read
 *       from its own source: `nesy.sessionState` (SharedPreferences + SDK state)
 *       and `nesy.db.session` (the persisted Room record). A prepared session
 *       that only sets the in-memory flag satisfies one and not the other.
 *
 *  WHAT THIS MACRO DOES NOT PROVE (read before trusting a green run)
 *
 *  The BACKEND plane is not required. `nesy.backoffice.read-session` runs with
 *  the dashboard admin token and resolves the admin's identity, so it cannot
 *  distinguish a courier who signed in from one who did not. It is kept as an
 *  OPTIONAL observation and does not vote. See the requirement block below.
 *
 *  The three planes are also no longer CORRELATED with each other: the derived
 *  fact that carried that property (`APP.LOGIN_SUCCEEDED`) has no host reducer,
 *  so requiring it made every run unsatisfiable rather than strict.
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
import { NESY_ADAPTER_QUERY_REFS } from "../registries/application.js";
import { NESY_FACTS } from "../registries/facts.js";
import { NESY_ACTIONS, NESY_SCREENS } from "../registries/screens.js";
import { NESY_TARGETS } from "../registries/targets.js";
import type { NesyReferenceSlice } from "../slice.js";
import { NESY_DEFAULT_INTERRUPT_POLICY, NESY_UI_ONLY_RELEASE_ISOLATION } from "./common.js";
import { irDocument, requires, sourceMapEntry, stepBase } from "./ir-authoring.js";

export const NESY_LOGIN_MACRO_KEY = "nesy.macro.login";
export const NESY_LOGIN_REJECTED_MACRO_KEY = "nesy.macro.login-rejected";

const STEPS: readonly WorkflowStepV2[] = [
  // G90.2b owns pre-action readiness. The queue proves PROCESS_TERMINATED →
  // INTERACTION_READY (including this PIN target's actionability) before the
  // executor receives the plan, so a second `wait-login-ready` fact here would
  // reintroduce the old 20s single-wait model and blur its canonical class.
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
      next: "read-app-session",
      timeoutMs: 30_000,
      capabilityRequirements: [requires("verdict.core.bridge.tap")],
    }),
    kind: "BRIDGE_ACTION",
    action: "tap",
    targetVariable: "submitHandle",
    // Readiness only — "the login attempt has RESOLVED", either way. Leaving the
    // login screen is not proof of authentication; that is what the Final Oracle
    // below is for.
    //
    // `anyOf` and not `allOf`, and this is the whole point: a gate that waits only
    // for the route list cannot close when the product refuses the credentials, so
    // it times out, the executor stops the run, and the oracle never evaluates. A
    // wrong PIN then reported EVIDENCE_INSUFFICIENT — "the harness could not tell"
    // — for a run in which the product had answered perfectly clearly. Admitting
    // the refusal as a closing condition lets the run reach its oracle and be
    // judged on what happened.
    continueGate: {
      anyOf: [NESY_FACTS.ROUTE_LIST_READY, NESY_FACTS.LOGIN_REJECTED],
      noneOf: [NESY_FACTS.SESSION_EXPIRED_DIALOG_PRESENT],
      deadlineMs: 30_000,
      unknownPolicy: "RETRY",
    },
  },
  // The app and local planes are OBSERVED here, not inferred from the screen
  // transition. Before these two steps existed the login macro drove the UI and
  // then asked the Final Oracle for three planes it had never observed, so
  // APP.USER_SESSION_AVAILABLE and LOCAL.USER_SESSION_AVAILABLE could only ever
  // time out — the run reported EVIDENCE_INSUFFICIENT for facts that had no
  // producer anywhere in the plan.
  {
    ...stepBase({
      planStepId: "read-app-session",
      sourceMapRef: "sm-login-8a",
      next: "read-local-session",
      timeoutMs: 15_000,
      capabilityRequirements: [requires("domain.nesy.adapter.state-projection")],
    }),
    kind: "SDK_QUERY",
    queryRef: NESY_ADAPTER_QUERY_REFS.sessionState,
    maxRows: 1,
    outputVariable: "appSessionRows",
    outputFactBindings: [
      { factKey: NESY_FACTS.USER_SESSION_AVAILABLE_APP, from: { kind: "COLUMN", column: "is_logged_in" } },
    ],
  },
  {
    ...stepBase({
      planStepId: "read-local-session",
      sourceMapRef: "sm-login-8b",
      next: "verify-backend-session",
      timeoutMs: 15_000,
      capabilityRequirements: [requires("domain.nesy.adapter.named-query")],
    }),
    kind: "SDK_QUERY",
    queryRef: NESY_ADAPTER_QUERY_REFS.dbSession,
    maxRows: 1,
    outputVariable: "localSessionRows",
    outputFactBindings: [
      {
        factKey: NESY_FACTS.USER_SESSION_AVAILABLE_LOCAL,
        from: { kind: "COLUMN", column: "session_persisted" },
      },
    ],
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
      // This read does not vote (see the requirement block below), so an
      // unreachable back office must not abort a run that observed the app and
      // local planes perfectly well. Measured: a VPN whose TLS path changed
      // mid-session turned a decidable login run into AUTOMATION_FAILURE.
      // READ_ONLY, so continuing past it cannot leave an unconfirmed mutation.
      onUnavailable: "RECORD_UNMEASURED",
      reconciliationPolicy: "NONE",
      auditPolicy: { recordRequest: true, recordResponse: true, redactFields: ["session.tokenHint"] },
      allowedEnvironments: ["qa", "staging"],
    },
  },
  {
    ...stepBase({ planStepId: "assert-login", sourceMapRef: "sm-login-9", next: "clear-session" }),
    kind: "ASSERT_FACT",
    // ── Asserts the APP plane, not APP.LOGIN_SUCCEEDED ──────────────────────
    //
    // `APP.LOGIN_SUCCEEDED` is a DERIVED fact (see `evidence/derived.ts`), and no
    // host runtime reads `DerivedFactGraph` today — nothing anywhere computes it.
    // Asserting it meant asserting a fact with no producer, which is not a strict
    // test but an unsatisfiable one: the run reported EVIDENCE_INSUFFICIENT no
    // matter how well login worked.
    //
    // The three planes it derives from are each REQUIRED below, so the planes are
    // still covered. What is LOST is the correlation the derivation carried —
    // that the backend, app and local observations describe the SAME session
    // rather than three unrelated truths. Restoring it needs the reducer engine
    // AND a correlatable payload on published facts; both are tracked, and until
    // then this macro must not claim the property.
    factKey: NESY_FACTS.USER_SESSION_AVAILABLE_APP,
    expected: true,
    unknownPolicy: "FAIL",
    finalOraclePolicy: {
      requirements: [
        // ── REMOTE.AUTH_ACCEPTED is DELIBERATELY not REQUIRED ────────────────
        //
        // `nesy.backoffice.read-session` maps to `User/GetMyInfo`, and the host
        // calls it with the DASHBOARD ADMIN token. It therefore resolves the
        // admin's identity, not the courier who just signed in: it would answer
        // true on a run where the courier never authenticated at all.
        //
        // Requiring it would not make login stricter, it would make it FALSELY
        // strict — a green REQUIRED tick standing for a check that cannot fail
        // for the reason it claims. Keeping it OPTIONAL records the observation
        // without letting it vote.
        //
        // To close this properly the backend needs a read for the courier login
        // record. `UserWebAPI` writes `UserLoginLog` on every attempt
        // (AuthOperation) but exposes no read for it, so the honest fix is a
        // backend change, not a pack change. Until then this macro does not
        // prove the backend plane, and `notResponsibleFor` says so.
        {
          factKey: NESY_FACTS.AUTH_ACCEPTED,
          obligation: "OPTIONAL",
          timing: "EVENTUAL",
          deadlineMs: 20_000,
          onTimeout: "WARNING",
        },
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
    { name: "appSessionRows", type: "stringList" },
    { name: "localSessionRows", type: "stringList" },
  ],
  steps: STEPS,
  entryStepId: "resolve-pin-field",
  capabilityRequirements: [
    requires("verdict.core.bridge.tap"),
    requires("verdict.core.bridge.set-text"),
    requires("verdict.core.bridge.watch-fact"),
  ],
  sourceMap: [
    sourceMapEntry("sm-login-4", "resolve-pin-field", NESY_LOGIN_MACRO_KEY),
    sourceMapEntry("sm-login-5", "enter-pin", NESY_LOGIN_MACRO_KEY),
    sourceMapEntry("sm-login-6", "resolve-submit", NESY_LOGIN_MACRO_KEY),
    sourceMapEntry("sm-login-7", "tap-submit", NESY_LOGIN_MACRO_KEY),
    sourceMapEntry("sm-login-8a", "read-app-session", NESY_LOGIN_MACRO_KEY, "app plane observed, not inferred"),
    sourceMapEntry("sm-login-8b", "read-local-session", NESY_LOGIN_MACRO_KEY, "local plane observed, not inferred"),
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
    { planStepId: "enter-pin", bridgeVerb: "setText", targetRef: NESY_TARGETS.loginPinField },
    {
      planStepId: "tap-submit",
      bridgeVerb: "tap",
      targetRef: NESY_TARGETS.loginSubmit,
      awaitFactKey: NESY_FACTS.ROUTE_LIST_READY,
    },
  ],
};

const LOGIN_REJECTED_STEPS: readonly WorkflowStepV2[] = STEPS.map((step) => {
  if (step.planStepId === "tap-submit") {
    return {
      ...step,
      next: "assert-login-rejected",
    };
  }
  if (step.planStepId === "assert-login") {
    return {
      ...stepBase({ planStepId: "assert-login-rejected", sourceMapRef: "sm-login-rejected-9", next: "clear-session" }),
      kind: "ASSERT_FACT",
      factKey: NESY_FACTS.LOGIN_REJECTED,
      expected: true,
      unknownPolicy: "FAIL",
      finalOraclePolicy: {
        requirements: [
          {
            factKey: NESY_FACTS.LOGIN_REJECTED,
            obligation: "REQUIRED",
            timing: "IMMEDIATE",
            onTimeout: "FAIL",
          },
        ],
      },
    } satisfies WorkflowStepV2;
  }
  return step;
}).filter((step) => !["read-app-session", "read-local-session", "verify-backend-session"].includes(step.planStepId));

const LOGIN_REJECTED_GENERIC_IR = irDocument({
  workflowId: "nesy.reference.login-rejected",
  name: "Courier PIN login rejection through the real UI",
  sourceRef: NESY_LOGIN_REJECTED_MACRO_KEY,
  inputs: [{ name: "pin", type: "string", required: true, secret: true }],
  variables: [
    { name: "pinFieldHandle", type: "string" },
    { name: "submitHandle", type: "string" },
  ],
  steps: LOGIN_REJECTED_STEPS,
  entryStepId: "resolve-pin-field",
  capabilityRequirements: [
    requires("verdict.core.bridge.tap"),
    requires("verdict.core.bridge.set-text"),
    requires("verdict.core.bridge.watch-fact"),
  ],
  sourceMap: [
    sourceMapEntry("sm-login-4", "resolve-pin-field", NESY_LOGIN_REJECTED_MACRO_KEY),
    sourceMapEntry("sm-login-5", "enter-pin", NESY_LOGIN_REJECTED_MACRO_KEY),
    sourceMapEntry("sm-login-6", "resolve-submit", NESY_LOGIN_REJECTED_MACRO_KEY),
    sourceMapEntry("sm-login-7", "tap-submit", NESY_LOGIN_REJECTED_MACRO_KEY),
    sourceMapEntry("sm-login-rejected-9", "assert-login-rejected", NESY_LOGIN_REJECTED_MACRO_KEY),
    sourceMapEntry("sm-login-10", "clear-session", NESY_LOGIN_REJECTED_MACRO_KEY),
  ],
});

const LOGIN_REJECTED_EXPANSION: MacroExpansionSnapshot = {
  macroRef: NESY_LOGIN_REJECTED_MACRO_KEY,
  authoredBy: "COMPILER",
  genericIr: LOGIN_REJECTED_GENERIC_IR,
  irSourceMap: LOGIN_REJECTED_GENERIC_IR.sourceMap,
  domainSourceMap: [
    {
      ref: "ds-login-rejected-1",
      macroRef: NESY_LOGIN_REJECTED_MACRO_KEY,
      planStepIds: LOGIN_REJECTED_STEPS.map((step) => step.planStepId),
      sliceRef: "COURIER_LOGIN_REJECTED",
      note: "Same real PIN-submit path as login, but the product claim is the expected refusal of invalid credentials.",
    },
  ],
};

const LOGIN_REJECTED_BRIDGE_PLAN: BridgeFlowPlanSnapshot = {
  ...BRIDGE_PLAN,
  macroRef: NESY_LOGIN_REJECTED_MACRO_KEY,
  legs: BRIDGE_PLAN.legs.map((leg) =>
    leg.planStepId === "tap-submit" ? { ...leg, awaitFactKey: NESY_FACTS.LOGIN_REJECTED } : leg,
  ),
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
    "whether the BACKEND authenticated this courier — the only available back-office read resolves the dashboard admin token, so REMOTE.AUTH_ACCEPTED is observed but does not vote",
    "whether the backend, app and local sessions are the SAME session — the correlated derivation has no host reducer, so the three planes are asserted individually",
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
      NESY_FACTS.LOGIN_REJECTED,
      NESY_FACTS.AUTH_ACCEPTED,
      NESY_FACTS.USER_SESSION_AVAILABLE_APP,
      NESY_FACTS.USER_SESSION_AVAILABLE_LOCAL,
      NESY_FACTS.LOGIN_SUCCEEDED,
    ],
    queryRefs: [NESY_ADAPTER_QUERY_REFS.sessionState, NESY_ADAPTER_QUERY_REFS.dbSession],
    adapterOperationRefs: [NESY_BACKOFFICE_OPERATIONS.readSession],
  },
  oracleTemplate: {
    // Mirrors `tap-submit`'s gate; change both together.
    continueGate: {
      anyOf: [NESY_FACTS.ROUTE_LIST_READY, NESY_FACTS.LOGIN_REJECTED],
      noneOf: [NESY_FACTS.SESSION_EXPIRED_DIALOG_PRESENT],
      deadlineMs: 30_000,
      unknownPolicy: "RETRY",
    },
    // Kept identical to `assert-login`'s `finalOraclePolicy`. Two copies of the
    // same policy that drift are worse than one, so change both together.
    finalOracle: {
      requirements: [
        {
          factKey: NESY_FACTS.USER_SESSION_AVAILABLE_APP,
          obligation: "REQUIRED",
          timing: "IMMEDIATE",
          onTimeout: "FAIL",
        },
        {
          factKey: NESY_FACTS.USER_SESSION_AVAILABLE_LOCAL,
          obligation: "REQUIRED",
          timing: "EVENTUAL",
          deadlineMs: 30_000,
          onTimeout: "INCONCLUSIVE",
        },
        {
          factKey: NESY_FACTS.AUTH_ACCEPTED,
          obligation: "OPTIONAL",
          timing: "EVENTUAL",
          deadlineMs: 20_000,
          onTimeout: "WARNING",
        },
      ],
    },
    notResponsibleFor: [
      "whether the route list content is correct — only that it became ready",
      "whether the backend authenticated this courier — see the macro header",
    ],
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

export const NESY_LOGIN_REJECTED_MACRO: MacroDefinition = {
  macroKey: NESY_LOGIN_REJECTED_MACRO_KEY,
  actionRef: NESY_ACTIONS.login,
  displayName: "Courier PIN login is rejected",
  businessMeaning:
    "A courier attempts to sign in through the real PIN login path with credentials that should be refused, and the product emits its own login-rejected state.",
  notResponsibleFor: [
    "proving successful authentication",
    "username/password tab login",
    "password reset and account recovery",
    "biometric re-authentication",
    "classifying the rejection reason text — this workflow proves the rejected business state, not copy or localization",
  ],
  input: {
    fields: [
      {
        name: "pin",
        type: "string",
        required: true,
        secret: true,
        description: "Courier device PIN expected to be rejected by NesyMobile PIN tab / loginDevice.",
      },
    ],
  },
  output: {
    fields: [{ name: "loginRejected", type: "boolean", factKey: NESY_FACTS.LOGIN_REJECTED }],
  },
  preconditions: [
    { kind: "SCREEN_READY", ref: NESY_SCREENS.login, deadlineMs: 30_000, onUnmet: "FAIL" },
    { kind: "FACT_FALSE", ref: NESY_FACTS.USER_SESSION_AVAILABLE_APP, deadlineMs: 5_000, onUnmet: "FAIL" },
  ],
  allowedRegistryRefs: {
    screenRefs: [NESY_SCREENS.login],
    surfaceRefs: [],
    entityTypeRefs: [],
    targetRefs: [NESY_TARGETS.loginPinField, NESY_TARGETS.loginSubmit],
    factKeys: [
      NESY_FACTS.LOGIN_SCREEN_READY,
      NESY_FACTS.LOGIN_REJECTED,
      NESY_FACTS.SESSION_EXPIRED_DIALOG_PRESENT,
      NESY_FACTS.USER_SESSION_AVAILABLE_APP,
    ],
    queryRefs: [],
    adapterOperationRefs: [],
  },
  oracleTemplate: {
    continueGate: {
      anyOf: [NESY_FACTS.LOGIN_REJECTED],
      noneOf: [NESY_FACTS.SESSION_EXPIRED_DIALOG_PRESENT],
      deadlineMs: 30_000,
      unknownPolicy: "RETRY",
    },
    finalOracle: {
      requirements: [
        {
          factKey: NESY_FACTS.LOGIN_REJECTED,
          obligation: "REQUIRED",
          timing: "IMMEDIATE",
          onTimeout: "FAIL",
        },
      ],
    },
    notResponsibleFor: [
      "whether a valid PIN can authenticate — that remains nesy.workflow.login",
      "whether the rejection text is translated correctly",
    ],
  },
  interruptPolicy: NESY_DEFAULT_INTERRUPT_POLICY,
  requiredCapabilityRefs: [
    "verdict.core.bridge.tap",
    "verdict.core.bridge.set-text",
    "verdict.core.bridge.resolve-target",
    "verdict.core.bridge.watch-fact",
  ],
  expansionSnapshot: LOGIN_REJECTED_EXPANSION,
  bridgeFlowPlanSnapshot: LOGIN_REJECTED_BRIDGE_PLAN,
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
        "validateLaunchProfile: PREPARED_SESSION/DIRECT_STATE cannot declare producesProductVerdict:true. The oracle additionally requires the LOCAL plane (nesy.db.session, the persisted Room record) alongside the APP plane, so an injection that only flips the in-memory session flag still fails.",
    },
    {
      caseKey: "SCREEN_TRANSITION_AS_AUTHENTICATION",
      scenario:
        "The app navigates away from the login screen on a cached session while the backend rejected the credentials. A UI-only oracle would call that a pass.",
      refusedBy:
        "NOT CURRENTLY REFUSED. This case is the reason REMOTE.AUTH_ACCEPTED exists, but the only mapped back-office read resolves the dashboard admin token rather than the courier's, so it cannot tell the two apart and is OPTIONAL. A cached-session pass would be caught only if the app or local plane also failed. Closing this needs a backend read for the courier login record.",
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
