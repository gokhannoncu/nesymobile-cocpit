import type { CustomerAssignmentSelection } from "@/components/data-center/happy-path/select-customer-address-dialog";
import {
  HAPPY_PATH_TYPE_CONFIG,
  HAPPY_PATH_TYPE_ORDER,
  type GenerationRoute,
  type HappyPathTypeId,
} from "./happy-path-types";
import {
  resolveSettingsForType,
  type ShipmentSettings,
} from "./shipment-group-settings";

export type AssignmentMode = "one" | "recommended" | "custom";

export type GenerationJobStatus =
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "skipped";

export type UnloadPhase =
  | "none"
  | "pending"
  | "running"
  | "success"
  | "failed"
  | "skipped";

export interface GenerationJob {
  typeId: HappyPathTypeId;
  label: string;
  route: GenerationRoute;
  assignment: CustomerAssignmentSelection;
  settings: Record<string, unknown>;
  status: GenerationJobStatus;
  requiresUnload?: boolean;
  unloadPhase?: UnloadPhase;
  parcelsUnloaded?: number;
  parcelsTotal?: number;
  unloadError?: string;
  currentUnloadParcel?: number;
  resultId?: string;
  error?: string;
}

export function countExecutableJobs(includedTypeIds: Set<string>): number {
  return HAPPY_PATH_TYPE_ORDER.filter((typeId) => {
    if (!includedTypeIds.has(typeId)) return false;
    return HAPPY_PATH_TYPE_CONFIG[typeId].route !== "skip";
  }).length;
}

function resolveAssignmentForType(
  typeId: HappyPathTypeId,
  mode: AssignmentMode,
  oneCustomerSelection: CustomerAssignmentSelection | null,
  customerAssignments: Record<string, CustomerAssignmentSelection>,
): CustomerAssignmentSelection | null {
  if (mode === "one") return oneCustomerSelection;
  if (mode === "custom") return customerAssignments[typeId] ?? null;

  const groupIds: Record<string, string> = {
    "standard-delivery": "delivery",
    "exw-delivery": "delivery",
    "mono-multicolli": "delivery",
    deps: "delivery",
    "cod-delivery": "cod",
    "remote-pickup": "pickup",
    "ddef-shipment-1": "pickup",
    "ddef-shipment-2": "pickup",
    "ddef-shipment-3": "pickup",
    "pickup-at-customer": "pickup",
    rdoc: "return",
    "delivery-pick": "return",
    "red-label": "return",
    doco: "return",
  };
  const groupId = groupIds[typeId];
  return groupId ? (customerAssignments[groupId] ?? null) : null;
}

function resolveSettingsForJob(
  typeId: HappyPathTypeId,
  mode: AssignmentMode,
  settingsMap: Record<string, ShipmentSettings>,
): ShipmentSettings | undefined {
  if (mode === "one") return settingsMap.all;
  if (mode === "custom") return settingsMap[typeId];

  const groupIds: Record<string, string> = {
    "standard-delivery": "delivery",
    "exw-delivery": "delivery",
    "mono-multicolli": "delivery",
    deps: "delivery",
    "cod-delivery": "cod",
    "remote-pickup": "pickup",
    "ddef-shipment-1": "pickup",
    "ddef-shipment-2": "pickup",
    "ddef-shipment-3": "pickup",
    "pickup-at-customer": "pickup",
    rdoc: "return",
    "delivery-pick": "return",
    "red-label": "return",
    doco: "return",
  };
  const groupId = groupIds[typeId];
  return groupId ? settingsMap[groupId] : undefined;
}

export function buildGenerationQueue(params: {
  includedTypeIds: Set<string>;
  mode: AssignmentMode;
  oneCustomerSelection: CustomerAssignmentSelection | null;
  customerAssignments: Record<string, CustomerAssignmentSelection>;
  settingsMap: Record<string, ShipmentSettings>;
}): GenerationJob[] {
  const { includedTypeIds, mode, oneCustomerSelection, customerAssignments, settingsMap } =
    params;

  const jobs: GenerationJob[] = [];

  for (const typeId of HAPPY_PATH_TYPE_ORDER) {
    if (!includedTypeIds.has(typeId)) continue;

    const config = HAPPY_PATH_TYPE_CONFIG[typeId];
    const assignment = resolveAssignmentForType(
      typeId,
      mode,
      oneCustomerSelection,
      customerAssignments,
    );
    if (!assignment) continue;

    const rawSettings =
      resolveSettingsForJob(typeId, mode, settingsMap) ?? assignment.settings;
    const contextId =
      mode === "one"
        ? "all"
        : mode === "custom"
          ? typeId
          : (Object.entries({
              delivery: ["standard-delivery", "exw-delivery", "mono-multicolli", "deps"],
              cod: ["cod-delivery"],
              pickup: ["remote-pickup", "pickup-at-customer"],
              return: ["rdoc", "delivery-pick", "red-label", "doco"],
            }).find(([, ids]) => ids.includes(typeId))?.[0] ?? typeId);

    const settings = resolveSettingsForType(
      typeId,
      rawSettings,
      mode,
      contextId,
    );

    const requiresUnload = config.requiresUnloadAfterCreate;
    jobs.push({
      typeId,
      label: config.label,
      route: config.route,
      assignment,
      settings,
      status: config.route === "skip" ? "skipped" : "pending",
      requiresUnload,
      unloadPhase: requiresUnload ? "pending" : "none",
    });
  }

  return jobs;
}
