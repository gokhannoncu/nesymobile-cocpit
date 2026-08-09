/**
 * Domain macro input validation and expansion  (Plan D.7.4 · Phase 4C)
 *
 * The compiler validates that domain pack macros, actions, and registry refs
 * are all known and that macro expansion stays within the generic WorkflowIR v2
 * step union. Any domain concept that tries to become a Core step kind is
 * rejected here.
 *
 * Key rules:
 *   UNKNOWN MACRO/ACTION → FAIL FAST
 *   UNKNOWN REGISTRY REF → FAIL FAST
 *   MACRO OUTSIDE GENERIC IR → COMPILE FAIL
 *   COMPILER NEVER EXTENDS CORE UNION
 */

import type {
  MacroDefinition,
  MacroExpansionSnapshot,
  SemanticActionDefinition,
  DomainPackRegistries,
  KnownRegistryKeys,
} from "@nesy/domain-pack-contracts";
import { WORKFLOW_STEP_KINDS, validateWorkflowIrV2 } from "@nesy/workflow-contract";
import type { WorkflowIrV2 } from "@nesy/workflow-contract";
import type { CompileIssue } from "./compile-issues.js";
import { createIssue } from "./compile-issues.js";

/**
 * Build the set of known registry keys from a registries document.
 */
export function buildKnownRegistryKeys(registries: DomainPackRegistries): KnownRegistryKeys {
  return {
    screenKeys: new Set(registries.screens.map((s) => s.screenKey)),
    surfaceKeys: new Set(registries.surfaces.map((s) => s.surfaceKey)),
    entityTypes: new Set(registries.entities.map((e) => e.entityType)),
    targetKeys: new Set(registries.targets.map((t) => t.targetKey)),
    factKeys: new Set([
      ...registries.evidenceSources.filter((s) => s.factKey).map((s) => s.factKey!),
      ...registries.derivedFacts.facts.map((f) => f.factKey),
      // Remote adapter operations declare facts too — a back-office VALIDATION
      // operation exists precisely to produce one. Omitting this lane made every
      // macro that references a remotely-produced fact fail to compile with
      // UNKNOWN_REGISTRY_REF, even though the pack declares the fact properly.
      ...registries.remoteAdapters.flatMap((adapter) =>
        adapter.operations.flatMap((operation) => operation.outputs.map((output) => output.factKey)),
      ),
    ]),
  };
}

/**
 * Validate all macros in a domain pack against the registries.
 * Returns compile issues for any unknown refs, untyped entity inputs,
 * or expansions that go outside generic IR.
 */
export function validateDomainMacros(
  macros: readonly MacroDefinition[],
  actions: readonly SemanticActionDefinition[],
  registries: DomainPackRegistries,
  issues: CompileIssue[],
): void {
  const known = buildKnownRegistryKeys(registries);
  const actionKeys = new Set(actions.map((a) => a.actionKey));

  for (const macro of macros) {
    const path = `macro[${macro.macroKey}]`;

    // Validate action ref exists
    if (!actionKeys.has(macro.actionRef)) {
      issues.push(
        createIssue("UNKNOWN_ACTION", `Macro "${macro.macroKey}" references unknown action "${macro.actionRef}"`, {
          path: `${path}.actionRef`,
          sourceRef: macro.macroKey,
        }),
      );
    }

    // Validate registry refs
    validateRegistryRefs(macro, known, path, issues);

    // Validate entity input typing
    for (const [index, field] of macro.input.fields.entries()) {
      if (field.type === "entityRef" && (!field.entityTypeRef || field.entityTypeRef === "")) {
        issues.push(
          createIssue(
            "MACRO_ENTITY_INPUT_UNTYPED",
            `Macro "${macro.macroKey}" input[${index}] "${field.name}" is entityRef without entityTypeRef`,
            { path: `${path}.input.fields[${index}]`, sourceRef: macro.macroKey },
          ),
        );
      }
    }

    // Validate expansion snapshot if present
    if (macro.expansionSnapshot) {
      validateExpansionGenericIr(macro.expansionSnapshot, macro.macroKey, path, issues);
    }
  }
}

function validateRegistryRefs(
  macro: MacroDefinition,
  known: KnownRegistryKeys,
  path: string,
  issues: CompileIssue[],
): void {
  const refs = macro.allowedRegistryRefs;
  const checks: [readonly string[], ReadonlySet<string>, string][] = [
    [refs.screenRefs, known.screenKeys, "screenRefs"],
    [refs.surfaceRefs, known.surfaceKeys, "surfaceRefs"],
    [refs.entityTypeRefs, known.entityTypes, "entityTypeRefs"],
    [refs.targetRefs, known.targetKeys, "targetRefs"],
    [refs.factKeys, known.factKeys, "factKeys"],
  ];

  for (const [refList, pool, field] of checks) {
    for (const ref of refList) {
      if (!pool.has(ref)) {
        issues.push(
          createIssue(
            "UNKNOWN_REGISTRY_REF",
            `Macro "${macro.macroKey}" references unknown ${field} "${ref}"`,
            { path: `${path}.allowedRegistryRefs.${field}`, sourceRef: macro.macroKey },
          ),
        );
      }
    }
  }
}

/**
 * Validate that a macro expansion snapshot stays within the generic IR v2 union.
 * A snapshot containing a business step kind would mean someone is trying to
 * extend Core, which is the debt Phase 4A/4B exist to prevent.
 */
export function validateExpansionGenericIr(
  snapshot: MacroExpansionSnapshot,
  macroKey: string,
  path: string,
  issues: CompileIssue[],
): void {
  // Schema version must be 2
  if (snapshot.genericIr.schemaVersion !== 2) {
    issues.push(
      createIssue(
        "MACRO_OUTSIDE_GENERIC_IR",
        `Expansion for macro "${macroKey}" uses schema version ${snapshot.genericIr.schemaVersion}; must be WorkflowIR v2`,
        { path: `${path}.expansionSnapshot.genericIr.schemaVersion`, sourceRef: macroKey },
      ),
    );
    return;
  }

  // Validate all step kinds are in the generic union
  const allowedKinds = new Set<string>(WORKFLOW_STEP_KINDS);
  for (const step of snapshot.genericIr.steps) {
    if (!allowedKinds.has(step.kind)) {
      issues.push(
        createIssue(
          "MACRO_OUTSIDE_GENERIC_IR",
          `Expansion for macro "${macroKey}" contains step kind "${step.kind}" which is not in the generic WorkflowIR v2 union`,
          { path: `${path}.expansionSnapshot.genericIr.steps[${step.planStepId}]`, sourceRef: macroKey },
        ),
      );
    }
  }

  // Validate via workflow-contract's own validator
  const irIssues = validateWorkflowIrV2(snapshot.genericIr);
  for (const irIssue of irIssues) {
    issues.push(
      createIssue(
        "MACRO_EXPANSION_MISMATCH",
        `IR validation issue in expansion for "${macroKey}": [${irIssue.code}] ${irIssue.message}`,
        { path: `${path}.expansionSnapshot`, sourceRef: macroKey },
      ),
    );
  }
}

/**
 * Validate that a workflow IR is valid input for compilation.
 */
export function validateCompileInputIr(
  ir: WorkflowIrV2,
  issues: CompileIssue[],
): void {
  if (ir.schemaVersion !== 2) {
    issues.push(
      createIssue("UNKNOWN_STEP_KIND", `Workflow IR schema version ${ir.schemaVersion} not supported; must be 2`),
    );
    return;
  }

  const irIssues = validateWorkflowIrV2(ir);
  for (const irIssue of irIssues) {
    // Map IR issue codes to compiler issue codes
    if (irIssue.code === "UNKNOWN_STEP_KIND") {
      issues.push(createIssue("UNKNOWN_STEP_KIND", irIssue.message, { path: irIssue.path }));
    } else if (irIssue.code === "MISSING_STEP_REFERENCE" || irIssue.code === "UNREACHABLE_STEP") {
      issues.push(createIssue("INVALID_STEP_REFERENCE", irIssue.message, { path: irIssue.path }));
    } else if (irIssue.code === "UNBOUNDED_LOOP") {
      issues.push(createIssue("UNBOUNDED_FOR_EACH", irIssue.message, { path: irIssue.path }));
    } else if (irIssue.code === "FIXED_WAIT_FORBIDDEN") {
      issues.push(createIssue("FIXED_WAIT_FORBIDDEN", irIssue.message, { path: irIssue.path }));
    } else if (irIssue.code === "UNSAFE_RETRY") {
      issues.push(createIssue("UNSAFE_NON_IDEMPOTENT_RETRY", irIssue.message, { path: irIssue.path }));
    } else if (irIssue.code === "MISSING_SOURCE_MAP_ENTRY") {
      issues.push(createIssue("MISSING_SOURCE_MAP_ENTRY", irIssue.message, { path: irIssue.path }));
    } else if (irIssue.code === "ORACLE_PARALLEL_LISTS") {
      issues.push(createIssue("PARALLEL_ORACLE_LISTS", irIssue.message, { path: irIssue.path }));
    }
  }
}
