/**
 * G90.9 — injected fault vs observed class.
 *
 * These are two scientific axes, not two names for the same enum.
 *
 *   injectedFault   what we planned to break (input; null on every uninjected run)
 *   observedClass   what the system classified (output; null while uninjected)
 *
 * D60 data is `injectedFault != null`. D30/D90 reliability data is
 * `injectedFault == null`. The two sets must not be mixed. D60 histogram
 * codes (`PROCESS_DEATH`, `NETWORK_PARTITION`, …) are forbidden on an
 * uninjected row — a spontaneous USB drop stays `ENV_FAILURE`.
 *
 * `BACKEND_TIMEOUT` is the same token on both axes on purpose. The field
 * still decides the question: input vs observation.
 */

export const INJECTED_FAULT_IDS = [
  "PROCESS_KILL",
  "NETWORK_DISCONNECT",
  "BACKEND_TIMEOUT",
  "DIALOG_OVERLAY",
  "DUPLICATE_CALLBACK",
  "OFFLINE_QUEUE",
] as const;

export type InjectedFaultId = (typeof INJECTED_FAULT_IDS)[number];

export const D60_OBSERVED_CLASSES = [
  "PROCESS_DEATH",
  "NETWORK_PARTITION",
  "BACKEND_TIMEOUT",
  "DIALOG_INTERRUPT",
  "DUPLICATE_SUPPRESSED",
  "OFFLINE_QUEUED",
] as const;

export type D60ObservedClass = (typeof D60_OBSERVED_CLASSES)[number];

/**
 * Classes that may appear as an observation on an injected row.
 * Diagonal cells are the six D60 codes. Off-diagonal cells are still
 * classified — including D30 histogram leftovers and `UNCLASSIFIED`.
 */
export const D30_HISTOGRAM_CLASSES = [
  "PRODUCT_PASS",
  "PRODUCT_FAIL",
  "ENV_FAILURE",
  "FORCE_STOP_NOT_CONFIRMED",
  "PROCESS_NOT_STARTED",
  "COLD_START_OS_SUSPEND",
  "APP_NOT_READY",
  "A11Y_SYNC_PENDING",
  "UI_NOT_ACTIONABLE",
  "SDK_NOT_READY",
  "AUTH_PENDING",
  "BACKEND_BOOTSTRAP_PENDING",
  "EVIDENCE_TIMEOUT",
  "TEST_DATA_CONTAMINATION",
  "UNCLASSIFIED",
] as const;

export type D30HistogramClass = (typeof D30_HISTOGRAM_CLASSES)[number];

export const OBSERVED_CLASSES = [...D60_OBSERVED_CLASSES, ...D30_HISTOGRAM_CLASSES] as const;

export type ObservedClass = (typeof OBSERVED_CLASSES)[number];

export const INJECTED_FAULT_HOSTS = ["A", "B"] as const;

export type InjectedFaultHost = (typeof INJECTED_FAULT_HOSTS)[number];

export const DEATH_PROVENANCES = [
  "PROCESS_DEATH_FORCE_STOP",
  "PROCESS_DEATH_KILL",
  "PROCESS_DEATH_OEM",
] as const;

export type DeathProvenance = (typeof DEATH_PROVENANCES)[number];

export const EXPECTED_CLASS_BY_INJECTED_FAULT = {
  PROCESS_KILL: "PROCESS_DEATH",
  NETWORK_DISCONNECT: "NETWORK_PARTITION",
  BACKEND_TIMEOUT: "BACKEND_TIMEOUT",
  DIALOG_OVERLAY: "DIALOG_INTERRUPT",
  DUPLICATE_CALLBACK: "DUPLICATE_SUPPRESSED",
  OFFLINE_QUEUE: "OFFLINE_QUEUED",
} as const satisfies Record<InjectedFaultId, D60ObservedClass>;

export type ExpectedClassFor<T extends InjectedFaultId> = (typeof EXPECTED_CLASS_BY_INJECTED_FAULT)[T];

/** Planned input written at run start. `observedClass` stays null until classification. */
export interface InjectedFaultPlan {
  injectedFault: InjectedFaultId | null;
  expectedClass: D60ObservedClass | null;
  observedClass: ObservedClass | null;
  injectedFaultHost: InjectedFaultHost | null;
  deathProvenance: DeathProvenance | null;
}

export interface InjectedFaultRecord extends InjectedFaultPlan {
  observedClass: ObservedClass | null;
}

export interface InjectedFaultViolation {
  invariant: string;
  message: string;
}

const INJECTED_FAULT_SET = new Set<string>(INJECTED_FAULT_IDS);
const D60_OBSERVED_SET = new Set<string>(D60_OBSERVED_CLASSES);
const OBSERVED_SET = new Set<string>(OBSERVED_CLASSES);
const HOST_SET = new Set<string>(INJECTED_FAULT_HOSTS);
const DEATH_SET = new Set<string>(DEATH_PROVENANCES);

export function isInjectedFaultId(value: unknown): value is InjectedFaultId {
  return typeof value === "string" && INJECTED_FAULT_SET.has(value);
}

export function isD60ObservedClass(value: unknown): value is D60ObservedClass {
  return typeof value === "string" && D60_OBSERVED_SET.has(value);
}

export function isObservedClass(value: unknown): value is ObservedClass {
  return typeof value === "string" && OBSERVED_SET.has(value);
}

export function isInjectedFaultHost(value: unknown): value is InjectedFaultHost {
  return typeof value === "string" && HOST_SET.has(value);
}

export function isDeathProvenance(value: unknown): value is DeathProvenance {
  return typeof value === "string" && DEATH_SET.has(value);
}

export function expectedClassForInjectedFault(fault: InjectedFaultId): D60ObservedClass {
  return EXPECTED_CLASS_BY_INJECTED_FAULT[fault];
}

/**
 * Accept a start-time fault plan. Observation fields are forced null —
 * callers cannot pre-write the answer they hope to measure.
 */
export function planInjectedFault(input: {
  injectedFault?: InjectedFaultId | null;
  injectedFaultHost?: InjectedFaultHost | null;
}): InjectedFaultPlan {
  const injectedFault = input.injectedFault ?? null;
  if (injectedFault === null) {
    if (input.injectedFaultHost != null) {
      throw new Error("injectedFaultHost requires injectedFault");
    }
    return emptyInjectedFaultPlan();
  }
  if (!isInjectedFaultId(injectedFault)) {
    throw new Error(`unknown injectedFault "${String(injectedFault)}"`);
  }
  const injectedFaultHost = input.injectedFaultHost ?? null;
  if (!isInjectedFaultHost(injectedFaultHost)) {
    throw new Error(`injectedFault ${injectedFault} requires injectedFaultHost A|B`);
  }
  return {
    injectedFault,
    expectedClass: expectedClassForInjectedFault(injectedFault),
    observedClass: null,
    injectedFaultHost,
    deathProvenance: null,
  };
}

export function emptyInjectedFaultPlan(): InjectedFaultPlan {
  return {
    injectedFault: null,
    expectedClass: null,
    observedClass: null,
    injectedFaultHost: null,
    deathProvenance: null,
  };
}

export function validateInjectedFaultRecord(record: InjectedFaultPlan): InjectedFaultViolation[] {
  const violations: InjectedFaultViolation[] = [];
  const { injectedFault, expectedClass, observedClass, injectedFaultHost, deathProvenance } = record;

  if (injectedFault === null) {
    if (expectedClass !== null) {
      violations.push({
        invariant: "G90.9.UNINJECTED",
        message: "uninjected run cannot carry expectedClass",
      });
    }
    if (observedClass !== null) {
      violations.push({
        invariant: "G90.9.UNINJECTED",
        message: "uninjected run cannot carry observedClass — D60 data must not mix with D30/D90",
      });
    }
    if (injectedFaultHost !== null) {
      violations.push({
        invariant: "G90.9.UNINJECTED",
        message: "uninjected run cannot carry injectedFaultHost",
      });
    }
    if (deathProvenance !== null) {
      violations.push({
        invariant: "G90.9.UNINJECTED",
        message: "uninjected run cannot carry deathProvenance",
      });
    }
    return violations;
  }

  if (!isInjectedFaultId(injectedFault)) {
    violations.push({
      invariant: "G90.9.VOCAB",
      message: `injectedFault "${String(injectedFault)}" is not in the locked six-ID vocabulary`,
    });
    return violations;
  }

  if (!isInjectedFaultHost(injectedFaultHost)) {
    violations.push({
      invariant: "G90.9.HOST",
      message: `injectedFault ${injectedFault} requires injectedFaultHost A|B`,
    });
  }

  const expected = expectedClassForInjectedFault(injectedFault);
  if (expectedClass !== expected) {
    violations.push({
      invariant: "G90.9.EXPECTED",
      message: `injectedFault ${injectedFault} requires expectedClass ${expected}, got ${String(expectedClass)}`,
    });
  }

  if (observedClass !== null && !isObservedClass(observedClass)) {
    violations.push({
      invariant: "G90.9.VOCAB",
      message: `observedClass "${String(observedClass)}" is not in the locked histogram`,
    });
  }

  if (deathProvenance !== null && !isDeathProvenance(deathProvenance)) {
    violations.push({
      invariant: "G90.9.VOCAB",
      message: `deathProvenance "${String(deathProvenance)}" is not locked`,
    });
  }

  if (deathProvenance !== null && injectedFault !== "PROCESS_KILL") {
    violations.push({
      invariant: "G90.9.PROVENANCE",
      message: "deathProvenance is only meaningful for injectedFault PROCESS_KILL",
    });
  }

  if (observedClass === "PROCESS_DEATH" && deathProvenance === null) {
    violations.push({
      invariant: "G90.9.PROVENANCE",
      message: "observedClass PROCESS_DEATH requires deathProvenance",
    });
  }

  return violations;
}

export function assertInjectedFaultRecord(record: InjectedFaultPlan): void {
  const violations = validateInjectedFaultRecord(record);
  if (violations.length > 0) {
    throw new Error(
      `invalid injected-fault record:\n${violations.map((item) => `  [${item.invariant}] ${item.message}`).join("\n")}`,
    );
  }
}

export interface D60ConfusionMatrixCell {
  injectedFault: InjectedFaultId;
  observedClass: ObservedClass | "MISSING";
  n: number;
}

export interface D60ConfusionMatrix {
  cells: readonly D60ConfusionMatrixCell[];
  byInjected: Record<InjectedFaultId, Record<string, number>>;
  unclassified: number;
  offDiagonal: number;
  uninjectedExcluded: number;
}

/**
 * Build the D60 confusion matrix. Uninjected rows are counted then dropped —
 * they are D30/D90 data, not a matrix cell.
 */
export function buildD60ConfusionMatrix(
  rows: readonly Pick<InjectedFaultPlan, "injectedFault" | "expectedClass" | "observedClass">[],
): D60ConfusionMatrix {
  const byInjected = Object.fromEntries(INJECTED_FAULT_IDS.map((id) => [id, {} as Record<string, number>])) as Record<
    InjectedFaultId,
    Record<string, number>
  >;
  let unclassified = 0;
  let offDiagonal = 0;
  let uninjectedExcluded = 0;

  for (const row of rows) {
    if (row.injectedFault === null) {
      uninjectedExcluded += 1;
      continue;
    }
    const observed = row.observedClass ?? "MISSING";
    byInjected[row.injectedFault][observed] = (byInjected[row.injectedFault][observed] ?? 0) + 1;
    if (observed === "UNCLASSIFIED" || observed === "MISSING") unclassified += 1;
    const expected = row.expectedClass ?? expectedClassForInjectedFault(row.injectedFault);
    if (observed !== expected) offDiagonal += 1;
  }

  const cells: D60ConfusionMatrixCell[] = [];
  for (const injectedFault of INJECTED_FAULT_IDS) {
    for (const [observedClass, n] of Object.entries(byInjected[injectedFault])) {
      cells.push({
        injectedFault,
        observedClass: observedClass as ObservedClass | "MISSING",
        n,
      });
    }
  }

  return { cells, byInjected, unclassified, offDiagonal, uninjectedExcluded };
}
