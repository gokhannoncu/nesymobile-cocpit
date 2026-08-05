/**
 * Domain leakage and no-executor guards  (Plan D.7 · Phase 4C)
 *
 * Ensures the compiler package:
 *   1. Does not export business domain tokens (STOP, PARCEL, COURIER, etc.)
 *   2. Does not export executor/runtime types (BridgeFlowExecutor, etc.)
 *
 * These are test-bound guards, not review conventions.
 */

import { scanExportSurface, findDomainLeakage } from "@nesy/workflow-contract";
import type { CompileIssue } from "./compile-issues.js";
import { createIssue } from "./compile-issues.js";

/**
 * Forbidden executor/runtime exports.
 * The compiler produces plans; it never executes them.
 */
const FORBIDDEN_EXECUTOR_EXPORTS: readonly string[] = [
  "BridgeFlowExecutor",
  "executePlan",
  "dispatchBridgeCommand",
  "dispatchSdkCommand",
  "DeviceWorker",
  "RunLease",
  "TestExecutionQueue",
  "TestDataBroker",
  "WorkerHeartbeat",
];

/**
 * Scan a module's exports for domain business token leakage.
 */
export function scanForDomainLeakage(
  moduleName: string,
  moduleExports: Record<string, unknown>,
  issues: CompileIssue[],
): void {
  const hits = scanExportSurface(moduleName, moduleExports);
  for (const hit of hits) {
    issues.push(
      createIssue(
        "DOMAIN_BUSINESS_TOKEN_IN_EXPORT",
        `Compiler export "${hit.token}" at ${hit.location} contains a forbidden domain business token`,
        { path: hit.location, sourceRef: moduleName },
      ),
    );
  }
}

/**
 * Scan a module's exports for executor/runtime type leakage.
 */
export function scanForExecutorLeakage(
  moduleName: string,
  moduleExports: Record<string, unknown>,
  issues: CompileIssue[],
): void {
  const exportNames = Object.keys(moduleExports);
  for (const name of exportNames) {
    if (FORBIDDEN_EXECUTOR_EXPORTS.includes(name)) {
      issues.push(
        createIssue(
          "COMPILER_EXECUTOR_EXPORT",
          `Compiler package exports forbidden executor type "${name}"`,
          { path: `${moduleName}.${name}`, sourceRef: moduleName },
        ),
      );
    }
  }
}

/**
 * Scan arbitrary text for domain leakage.
 */
export function scanTextForDomainLeakage(
  text: string,
  location: string,
): { token: string; location: string }[] {
  return findDomainLeakage(text, location);
}
