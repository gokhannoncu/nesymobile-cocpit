/**
 * ===========================================================================
 *  Launch profiles, test profiles, campaigns  (Plan D.6B/D.6C · 4B.10)
 *
 *  A launch profile answers "how did the run get into this state?", and that
 *  answer decides what the run is allowed to CLAIM.
 *
 *  The failure being prevented is specific and common: the suite is slow, so
 *  someone adds a fixture that injects a session directly and skips the login
 *  screen. Every test gets faster. The login test also gets faster — and it now
 *  passes without ever logging in. Nobody notices until login breaks in
 *  production and the suite is still green.
 *
 *  So `sessionPreparation` and `producesProductVerdict` are validated against
 *  each other: only a real UI path may produce a product verdict about that
 *  path. A prepared session or a direct state write is SETUP, and setup does not
 *  get to be evidence.
 *
 *  Test profiles carry the release-gate axis with the same logic: a preview
 *  profile — reduced coverage, sampled evidence, faster feedback — is useful and
 *  must never be able to say GO.
 * ===========================================================================
 */

/** How the app process is started. */
export type LaunchStartMode = "COLD_START" | "WARM_START" | "REUSE_SESSION";

export const LAUNCH_START_MODES: readonly LaunchStartMode[] = ["COLD_START", "WARM_START", "REUSE_SESSION"];

/**
 * How the authenticated/business state is arrived at.
 *
 * `REAL_UI_LOGIN` drives the product's own screens. The other two are
 * shortcuts through the App Adapter, and both are automation-only seams.
 */
export type SessionPreparationMode = "REAL_UI_LOGIN" | "PREPARED_SESSION" | "DIRECT_STATE";

export const SESSION_PREPARATION_MODES: readonly SessionPreparationMode[] = [
  "REAL_UI_LOGIN",
  "PREPARED_SESSION",
  "DIRECT_STATE",
];

/** Preparation modes that are setup shortcuts and can never carry a verdict. */
export const SETUP_ONLY_SESSION_MODES: readonly SessionPreparationMode[] = ["PREPARED_SESSION", "DIRECT_STATE"];

/** How the run enters the first screen. */
export interface LaunchEntry {
  kind: "WORKFLOW_ENTRY" | "DEEP_LINK" | "TEST_GATEWAY";
  /** Opaque entry ref: a deep-link key or a gateway operation id. */
  entryRef: string;
  /** Screen expected to be ready afterwards. */
  expectedScreenRef: string;
  /** Surfaces expected/allowed during entry, e.g. a permission prompt. */
  expectedSurfaceRefs: readonly string[];
}

/**
 * What the profile tears down afterwards.
 *
 * A profile that prepares state and does not clean it up poisons the next run,
 * and the resulting flake gets blamed on the app. Cleanup results never touch
 * the product verdict (Phase 4A B.8.1).
 */
export interface LaunchCleanupContract {
  /** Cleanup macro/adapter operation refs, in order. */
  cleanupRefs: readonly string[];
  /** Cleanup runs even when the run failed — that is the point. */
  runOnFailure: boolean;
  /** Upper bound so a stuck teardown cannot hang the run. */
  deadlineMs: number;
}

/**
 * One launch profile.
 *
 * `releaseIsolation` is mandatory whenever a setup shortcut is used: the seam
 * that injects a session must not exist in a build a real user can install.
 */
export interface LaunchProfile {
  /** Namespaced profile key, e.g. "nesy.launch.cold-real-login". */
  profileKey: string;
  applicationRef: string;
  displayName: string;
  startMode: LaunchStartMode;
  sessionPreparation: SessionPreparationMode;
  /** Preconditions asserted before the run starts. */
  preconditionFactKeys: readonly string[];
  entry: LaunchEntry;
  /** Adapter operation refs used for preparation. Empty for REAL_UI_LOGIN. */
  preparationOperationRefs: readonly string[];
  cleanup: LaunchCleanupContract;
  /**
   * Whether a run launched this way may write a product verdict about the
   * prepared path.
   *
   * Must be false for PREPARED_SESSION and DIRECT_STATE. See the header.
   */
  producesProductVerdict: boolean;
  releaseIsolation: ReleaseIsolationContract;
  requiredCapabilityRefs: readonly string[];
}

/**
 * The promise that a test-only seam is absent from shipped builds.
 *
 * `assertionFactKey` matters more than the flag: a claim of isolation that
 * nothing checks is a claim that decays. The fact is observed at run time, so a
 * build that shipped the seam fails the assertion instead of quietly using it.
 */
export interface ReleaseIsolationContract {
  automationOnly: boolean;
  /** Build gate that removes the seam, e.g. "automationRelease=false". */
  releaseGuard: string;
  /** Fact asserting the seam is absent in non-automation builds. */
  assertionFactKey?: string;
  /** Environments the seam may exist in at all. */
  allowedEnvironments: readonly string[];
}

// ───────────────────────────────────────────────────────────────────────────
//  Test profiles
// ───────────────────────────────────────────────────────────────────────────

/**
 * What the profile is FOR.
 *
 * `PREVIEW` trades coverage for speed, `RELEASE` is the gate, `DIAGNOSTIC` is
 * for investigation, `BAD_DAY` deliberately injects faults. Each has different
 * gate rights, which is why this is a union and not a boolean.
 */
export type TestProfileKind = "PREVIEW" | "RELEASE" | "DIAGNOSTIC" | "BAD_DAY" | "DIFFERENTIAL";

export const TEST_PROFILE_KINDS: readonly TestProfileKind[] = [
  "PREVIEW",
  "RELEASE",
  "DIAGNOSTIC",
  "BAD_DAY",
  "DIFFERENTIAL",
];

/** Profile kinds that may never gate a release. */
export const NON_GATING_PROFILE_KINDS: readonly TestProfileKind[] = ["PREVIEW", "DIAGNOSTIC"];

/**
 * A deliberately injected fault.
 *
 * `correlationFactKey` is required: an injected fault with no observable
 * correlation cannot be distinguished from a real failure that happened to occur
 * during the run, and a Bad Day suite that cannot tell those apart produces
 * noise instead of resilience evidence.
 */
export interface FaultInjection {
  /** Opaque fault id, e.g. "nesy.fault.network-drop". */
  faultRef: string;
  kind: "NETWORK" | "BACKEND_ERROR" | "LATENCY" | "PROCESS_DEATH" | "PERMISSION_REVOKED" | "STORAGE_FULL";
  /** Trigger point: a macro ref or fact key the injection is anchored to. */
  triggerRef: string;
  /** Fact proving the injection actually took effect. Required. */
  correlationFactKey: string;
  /** Expected recovery outcome, so "it broke" is not read as a pass. */
  expectedRecoveryFactKey: string;
}

export interface FaultPlan {
  injections: readonly FaultInjection[];
  /** Whether the run is expected to recover; false means "must fail cleanly". */
  expectRecovery: boolean;
}

/**
 * How much telemetry the profile collects.
 *
 * Sampling is legitimate for preview runs and disqualifying for release runs: a
 * gate decided on sampled evidence is a gate that sometimes does not look.
 */
export interface TelemetryPolicy {
  captureArtifacts: boolean;
  /** 1 means every occurrence. >1 means sampled. */
  evidenceSampleEveryN: number;
  retainRawEvidence: boolean;
}

/**
 * Comparison against a baseline build.
 *
 * Both fields are required by validation: a differential profile without a
 * baseline is just a normal run, and one without a critical-fact policy will
 * report every cosmetic difference at the same weight as a missing delivery
 * confirmation.
 */
export interface DifferentialPolicy {
  /** Build the run is compared against. */
  baselineBuildRef: string;
  /** Facts whose difference is a genuine regression signal. */
  criticalFactKeys: readonly string[];
  /** What a difference in a critical fact means. */
  onCriticalDiff: "FAIL" | "OPERATOR_ATTENTION";
}

/** Pointer at a performance budget defined outside the pack. */
export interface PerformanceBudgetRef {
  budgetRef: string;
  /** Which macro/slice the budget applies to. */
  appliesToRef: string;
}

/**
 * One versioned test profile.
 *
 * `version` is part of the identity because a gate decision must be
 * reproducible: "the release profile" changed last Tuesday is not an answer.
 */
export interface TestProfileDefinition {
  profileKey: string;
  version: number;
  kind: TestProfileKind;
  displayName: string;
  applicationRef: string;
  launchProfileRef: string;
  /** Slices/workflows included. */
  includedWorkflowRefs: readonly string[];
  /** Whether this profile's result can decide release GO/NO_GO. */
  releaseGate: boolean;
  telemetry: TelemetryPolicy;
  faultPlan?: FaultPlan;
  differential?: DifferentialPolicy;
  performanceBudgetRefs: readonly PerformanceBudgetRef[];
  requiredCapabilityRefs: readonly string[];
}

/**
 * A campaign: an ordered set of profiles run together.
 *
 * Minimal on purpose — scheduling, queueing and lease handling are Phase 5
 * execution concerns and are deliberately absent. A campaign here declares
 * INTENT, not a running job.
 */
export interface TestCampaignDefinition {
  campaignKey: string;
  version: number;
  displayName: string;
  /** Profiles in declared order. */
  profileRefs: readonly string[];
  /** Whether the campaign as a whole gates a release. */
  releaseGate: boolean;
  /** What a single profile failure means for the campaign. */
  onProfileFailure: "STOP" | "CONTINUE" | "OPERATOR_ATTENTION";
}

// ───────────────────────────────────────────────────────────────────────────
//  Validation
// ───────────────────────────────────────────────────────────────────────────

export interface ProfileViolation {
  code:
    | "MISSING_FIELD"
    | "SETUP_LAUNCH_PRODUCES_VERDICT"
    | "SETUP_LAUNCH_WITHOUT_ISOLATION"
    | "REAL_LOGIN_WITH_PREPARATION_OPS"
    | "PREVIEW_PROFILE_GATES_RELEASE"
    | "GATING_PROFILE_SAMPLES_EVIDENCE"
    | "FAULT_WITHOUT_CORRELATION"
    | "FAULT_WITHOUT_EXPECTED_RECOVERY"
    | "DIFFERENTIAL_WITHOUT_BASELINE"
    | "DIFFERENTIAL_WITHOUT_CRITICAL_FACTS"
    | "MISSING_CLEANUP_DEADLINE";

  message: string;
}

/**
 * Validates one launch profile.
 *
 * The first two checks are the whole reason this file exists; the rest keep a
 * profile from being subtly unusable.
 */
export function validateLaunchProfile(profile: LaunchProfile, path: string): ProfileViolation[] {
  const violations: ProfileViolation[] = [];

  // Shape first: builders send partial drafts. Missing required objects must
  // become structured MISSING_FIELD violations, never thrown TypeErrors.
  if (profile.releaseIsolation === undefined || profile.releaseIsolation === null) {
    violations.push({
      code: "MISSING_FIELD",
      message: `${path}.releaseIsolation is required`,
    });
  }
  if (profile.cleanup === undefined || profile.cleanup === null) {
    violations.push({
      code: "MISSING_FIELD",
      message: `${path}.cleanup is required`,
    });
  }
  if (profile.entry === undefined || profile.entry === null) {
    violations.push({
      code: "MISSING_FIELD",
      message: `${path}.entry is required`,
    });
  }
  if (violations.some((v) => v.code === "MISSING_FIELD")) {
    return violations;
  }

  const isSetupShortcut = SETUP_ONLY_SESSION_MODES.includes(profile.sessionPreparation);

  if (isSetupShortcut && profile.producesProductVerdict) {
    violations.push({
      code: "SETUP_LAUNCH_PRODUCES_VERDICT",
      message: `${path}: sessionPreparation ${profile.sessionPreparation} is a setup shortcut and cannot produce a product verdict about the path it skipped`,
    });
  }

  if (isSetupShortcut && !profile.releaseIsolation.automationOnly) {
    violations.push({
      code: "SETUP_LAUNCH_WITHOUT_ISOLATION",
      message: `${path}.releaseIsolation.automationOnly must be true for ${profile.sessionPreparation}; a session-injection seam in a shippable build is a production vulnerability, not a test convenience`,
    });
  }

  if (
    profile.sessionPreparation === "REAL_UI_LOGIN" &&
    (profile.preparationOperationRefs?.length ?? 0) > 0
  ) {
    violations.push({
      code: "REAL_LOGIN_WITH_PREPARATION_OPS",
      message: `${path}: a REAL_UI_LOGIN profile declares ${profile.preparationOperationRefs.length} preparation operation(s); it would then be claiming to test a path it partly shortcut`,
    });
  }

  if (!Number.isFinite(profile.cleanup.deadlineMs) || profile.cleanup.deadlineMs <= 0) {
    violations.push({
      code: "MISSING_CLEANUP_DEADLINE",
      message: `${path}.cleanup.deadlineMs must be a positive number`,
    });
  }

  return violations;
}

/** Validates one test profile. */
export function validateTestProfile(profile: TestProfileDefinition, path: string): ProfileViolation[] {
  const violations: ProfileViolation[] = [];

  if (NON_GATING_PROFILE_KINDS.includes(profile.kind) && profile.releaseGate) {
    violations.push({
      code: "PREVIEW_PROFILE_GATES_RELEASE",
      message: `${path}: a ${profile.kind} profile trades coverage for speed and cannot decide release GO/NO_GO`,
    });
  }

  // A gate that looks at every third occurrence is a gate that sometimes does
  // not look at the one that broke.
  if (profile.releaseGate && profile.telemetry.evidenceSampleEveryN > 1) {
    violations.push({
      code: "GATING_PROFILE_SAMPLES_EVIDENCE",
      message: `${path}.telemetry.evidenceSampleEveryN is ${profile.telemetry.evidenceSampleEveryN}; a release-gating profile must observe every occurrence`,
    });
  }

  for (const [index, injection] of profile.faultPlan?.injections.entries() ?? []) {
    const injectionPath = `${path}.faultPlan.injections[${index}]`;
    if (injection.correlationFactKey.trim() === "") {
      violations.push({
        code: "FAULT_WITHOUT_CORRELATION",
        message: `${injectionPath}: fault "${injection.faultRef}" carries no correlation fact; an injected fault indistinguishable from a real one produces noise, not resilience evidence`,
      });
    }
    if (injection.expectedRecoveryFactKey.trim() === "") {
      violations.push({
        code: "FAULT_WITHOUT_EXPECTED_RECOVERY",
        message: `${injectionPath}: fault "${injection.faultRef}" declares no expected recovery fact; "it broke" would then read as a pass`,
      });
    }
  }

  if (profile.kind === "DIFFERENTIAL") {
    if (profile.differential === undefined || profile.differential.baselineBuildRef.trim() === "") {
      violations.push({
        code: "DIFFERENTIAL_WITHOUT_BASELINE",
        message: `${path}: a DIFFERENTIAL profile without a baseline build is an ordinary run`,
      });
    } else if (profile.differential.criticalFactKeys.length === 0) {
      violations.push({
        code: "DIFFERENTIAL_WITHOUT_CRITICAL_FACTS",
        message: `${path}.differential.criticalFactKeys is empty; every cosmetic diff would then weigh as much as a missing business confirmation`,
      });
    }
  }

  return violations;
}
