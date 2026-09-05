import { getNodeConfigSchema } from "./workflow-node-config";
import { WorkflowNodeType } from "./workflow-types";

/**
 * Canvas node config → `run.input.<name>`, the run's business inputs.
 *
 * ## Why this table exists
 *
 * It used to be two inline spreads in `workflow-editor.tsx`:
 *
 * ```ts
 * inputs: {
 *   ...(authLogin ? { pin: pinCode, sessionCorrelationId } : {}),
 *   ...(routeCode ? { routeCode } : {}),
 * }
 * ```
 *
 * Every other node's settings were collected, validated, stored in the payload,
 * and then silently dropped. Measured on run_d5bae2af: a barcode typed into the
 * Load to Vehicle node never reached the run, `run.input.scanValue` resolved to
 * nothing, and the step that types it reported SUCCESS against an empty dialog.
 * The run failed four steps later with no mention of a missing input. Supplying
 * `scanValue` by hand made the same workflow pass end to end on the first try.
 *
 * A table cannot fix that class of bug by itself, but it moves the mapping to one
 * reviewable place and makes "this node's setting goes nowhere" visible instead
 * of invisible — which is what [collectMissingRunInputs] then reports.
 *
 * ## Where the names come from
 *
 * Read out of the pack, not guessed: each macro's `run.input.*` references were
 * enumerated from `domain-packs/nesy-courier/src/macros/`.
 *
 * | Macro | Inputs it addresses |
 * |---|---|
 * | `login` | `pin` |
 * | `select-route` | `routeCode` |
 * | `load-to-vehicle` | `scanValue`, `alternateKey` |
 * | `open-stop` | `rowKey`, `searchTerm` |
 * | `process-parcel` | `scanPayload` |
 * | `complete-delivery` | `consignmentNumber`, `proofLookupId` |
 * | `tour-approval-lifecycle` | `scheduleId` |
 *
 * A node absent from this table contributes no run input. That is a statement,
 * not an omission: adding a row means claiming a macro reads that name, and a
 * wrong claim is worse than none — it would send a value the pack never asked
 * for while the one it wants stays missing.
 */
export interface RunInputBinding {
  /** Key inside the node's `data.config`. */
  readonly configKey: string;
  /** Name the pack addresses as `run.input.<runInputName>`. */
  readonly runInputName: string;
}

/**
 * Whether the field is required, read from the NODE's own schema.
 *
 * Deliberately not repeated in the table below. A second `required` flag here
 * was wrong within a day: `stopOrder` is optional in the node schema — the
 * journey resolves the stop the loading just created — and a duplicated `true`
 * made Run Test refuse a perfectly valid canvas with "Open Stop requires
 * stopOrder". One field, one source.
 */
function isRequiredField(nodeType: WorkflowNodeType, configKey: string): boolean {
  return (
    getNodeConfigSchema(nodeType).find((field) => field.key === configKey)?.required === true
  );
}

export const WORKFLOW_RUN_INPUT_BINDINGS: Partial<
  Record<WorkflowNodeType, readonly RunInputBinding[]>
> = {
  [WorkflowNodeType.AUTH_LOGIN]: [{ configKey: "pinCode", runInputName: "pin" }],
  [WorkflowNodeType.SELECT_ROUTE]: [{ configKey: "routeNumber", runInputName: "routeCode" }],
  [WorkflowNodeType.CHANGE_ROUTE]: [{ configKey: "routeNumber", runInputName: "routeCode" }],
  [WorkflowNodeType.LOAD_TO_VEHICLE]: [{ configKey: "barcode", runInputName: "scanValue" }],
  // `process-parcel` reads `scanPayload`; the Scan Barcode node is that macro's
  // entry ("Process parcel — opens the delivery flow").
  [WorkflowNodeType.SCAN_BARCODE]: [{ configKey: "barcode", runInputName: "scanPayload" }],
  // Both of `open-stop`'s inputs are SHIPMENT keys, and the macro requires them
  // to differ: the waybill is typed into the search box and stays there, so the
  // row must be recognised by the short barcode it displays.
  [WorkflowNodeType.OPEN_STOP]: [
    { configKey: "waybill", runInputName: "searchTerm" },
    { configKey: "shortBarcode", runInputName: "rowKey" },
  ],
  // `complete-delivery` reads BOTH, and requires both. The barcode is typed on
  // the delivery screen; the proof id is what the back office is asked about.
  [WorkflowNodeType.DELIVERY_OPERATION]: [
    { configKey: "barcode", runInputName: "consignmentNumber" },
    { configKey: "proofLookupId", runInputName: "proofLookupId" },
  ],
};

/** The minimal node shape this module needs; the editor's node satisfies it. */
export interface RunInputNode {
  readonly type: WorkflowNodeType;
  readonly id: string;
  readonly data: { readonly config?: Record<string, unknown> };
}

export interface MissingRunInput {
  readonly nodeId: string;
  readonly nodeType: WorkflowNodeType;
  readonly configKey: string;
  readonly runInputName: string;
}

function readConfigValue(node: RunInputNode, configKey: string): string {
  const config = node.data.config ?? {};
  const raw = config[configKey];
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  return "";
}

/**
 * Collects `run.input.*` values from the nodes actually on the canvas.
 *
 * Empty values are omitted rather than sent as `""`: an empty string resolves
 * fine and then gets typed into a field, which is how a missing barcode became
 * a successful-looking step. Absent is honest; blank is a lie the executor
 * cannot detect.
 */
export function collectRunInputs(
  nodes: readonly RunInputNode[],
): Record<string, string> {
  const inputs: Record<string, string> = {};
  for (const node of nodes) {
    for (const binding of WORKFLOW_RUN_INPUT_BINDINGS[node.type] ?? []) {
      const value = readConfigValue(node, binding.configKey);
      if (value !== "") inputs[binding.runInputName] = value;
    }
  }
  return inputs;
}

/**
 * Reports every required input a node on the canvas left unset.
 *
 * The editor blocks Run Test on these. Starting a run that is already missing a
 * value the pack will ask for wastes a device slot and produces a run record
 * whose failure points at the wrong step.
 */
export function collectMissingRunInputs(
  nodes: readonly RunInputNode[],
): MissingRunInput[] {
  const missing: MissingRunInput[] = [];
  for (const node of nodes) {
    for (const binding of WORKFLOW_RUN_INPUT_BINDINGS[node.type] ?? []) {
      if (!isRequiredField(node.type, binding.configKey)) continue;
      if (readConfigValue(node, binding.configKey) !== "") continue;
      missing.push({
        nodeId: node.id,
        nodeType: node.type,
        configKey: binding.configKey,
        runInputName: binding.runInputName,
      });
    }
  }
  return missing;
}
