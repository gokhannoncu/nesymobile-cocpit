import {
  Box,
  Circle,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Database,
  GitFork,
  ListChecks,
  Package,
  PackageCheck,
  ArrowRightLeft,
  Play,
  Route,
  RotateCcw,
  Search,
  Smartphone,
  Sunset,
  Timer,
  UploadCloud,
  UserRound,
  Truck,
  ScanBarcode,
  Zap,
} from "lucide-react";
import {
  WorkflowNodeType,
  type CourierPaletteSubgroup,
  type PaletteItem,
  type WorkflowComponentDefinition,
  type WorkflowPhase,
} from "./workflow-types";
import { getNodeConfigSchema } from "./workflow-node-config";

/** Display order for Courier Actions sub-headings in the palette. */
export const courierPaletteSubgroupOrder: CourierPaletteSubgroup[] = [
  "App & session",
  "Route & stops",
  "Load",
  "Search",
  "Tour",
  "Open",
  "Delivery operations",
  "Pickup operations",
  "Documents & LOS",
];

export type WorkflowPaletteCategory = {
  title: string;
  items?: PaletteItem[];
  subsections?: { title: string; items: PaletteItem[] }[];
};

type NodeToneKey =
  | 'action'
  | 'condition'
  | 'assertion'
  | 'backend'
  | 'integration'
  | 'database'
  | 'terminal'

export const nodeToneByType: Record<NodeToneKey, string> = {
  action: "text-nesy-ink bg-nesy-soft border-nesy-muted",
  condition: "text-nesy-ink bg-nesy-soft border-nesy-muted",
  assertion: "text-emerald-600 bg-emerald-50 border-emerald-100",
  backend: "text-blue-600 bg-blue-50 border-blue-100",
  integration: "text-emerald-600 bg-emerald-50 border-emerald-100",
  database: "text-blue-600 bg-blue-50 border-blue-100",
  terminal: "text-slate-600 bg-slate-50 border-slate-200",
};

export function getWorkflowPhaseForType(type: WorkflowNodeType): WorkflowPhase | undefined {
  return workflowComponentRegistry[type]?.phase;
}

export const workflowComponentRegistry: Partial<Record<WorkflowNodeType, WorkflowComponentDefinition>> = {
  [WorkflowNodeType.LAUNCH_APP]: {
    type: WorkflowNodeType.LAUNCH_APP,
    label: "Launch App",
    title: "Launch App",
    subtitle: "App session start",
    phase: "bootstrap",
    category: "Courier Actions",
    courierPaletteSubgroup: "App & session",
    kind: "action",
    icon: Smartphone,
    iconName: "Smartphone",
    color: "orange",
    tone: nodeToneByType.action,
    defaultConfig: { country: "HR", environment: "stage", clearState: false },
  },
  [WorkflowNodeType.GRANT_PERMISSIONS]: {
    type: WorkflowNodeType.GRANT_PERMISSIONS,
    label: "Grant Permissions",
    title: "Grant Permissions",
    subtitle: "Android startup permissions",
    phase: "bootstrap",
    category: "Courier Actions",
    courierPaletteSubgroup: "App & session",
    kind: "action",
    icon: ClipboardCheck,
    iconName: "ClipboardCheck",
    color: "orange",
    tone: nodeToneByType.action,
  },
  [WorkflowNodeType.SEMANTIC_ACTION]: {
    type: WorkflowNodeType.SEMANTIC_ACTION,
    label: "Semantic Action",
    title: "Semantic Action",
    subtitle: "Domain Pack action",
    phase: "operation",
    category: "Courier Actions",
    // No courierPaletteSubgroup — pack palette is the source; keep out of legacy subgroups.
    kind: "action",
    icon: Zap,
    iconName: "Zap",
    color: "orange",
    tone: nodeToneByType.action,
    defaultConfig: { actionKey: "" },
  },
  [WorkflowNodeType.IF_LOGIN]: {
    type: WorkflowNodeType.IF_LOGIN,
    label: "If Login",
    title: "If Login",
    subtitle: "Login validation",
    phase: "precheck",
    category: "System Controls",
    kind: "condition",
    icon: GitFork,
    iconName: "GitFork",
    color: "orange",
    tone: nodeToneByType.condition,
    branches: ["true", "false"],
    defaultConfig: { loginButtonId: "com.arasdigital.nesymobile:id/btn_login" },
  },
  [WorkflowNodeType.AUTH_LOGIN]: {
    type: WorkflowNodeType.AUTH_LOGIN,
    label: "Auth / Login",
    title: "Auth / Login",
    subtitle: "Login Action",
    phase: "precheck",
    category: "Courier Actions",
    courierPaletteSubgroup: "App & session",
    kind: "action",
    icon: UserRound,
    iconName: "UserRound",
    color: "orange",
    tone: nodeToneByType.action,
  },
  [WorkflowNodeType.CHECK_ROUTE]: {
    type: WorkflowNodeType.CHECK_ROUTE,
    label: "Check Route",
    title: "Check Route",
    subtitle: "Route validation",
    phase: "precheck",
    category: "System Controls",
    kind: "condition",
    icon: Route,
    iconName: "Route",
    color: "orange",
    tone: nodeToneByType.condition,
    branches: ["true", "false"],
    defaultConfig: { expectedRoute: "" },
  },
  [WorkflowNodeType.SELECT_ROUTE]: {
    type: WorkflowNodeType.SELECT_ROUTE,
    label: "Select Route",
    title: "Select Route",
    subtitle: "Courier Action",
    phase: "precheck",
    category: "Courier Actions",
    courierPaletteSubgroup: "Route & stops",
    kind: "action",
    icon: Route,
    iconName: "Route",
    color: "orange",
    tone: nodeToneByType.action,
    defaultConfig: { routeNumber: "" },
  },
  [WorkflowNodeType.CHANGE_ROUTE]: {
    type: WorkflowNodeType.CHANGE_ROUTE,
    label: "Change Route",
    title: "Change Route",
    subtitle: "Courier Action",
    phase: "precheck",
    category: "Courier Actions",
    courierPaletteSubgroup: "Route & stops",
    kind: "action",
    icon: ArrowRightLeft,
    iconName: "ArrowRightLeft",
    color: "orange",
    tone: nodeToneByType.action,
    defaultConfig: { routeNumber: "" },
  },
  [WorkflowNodeType.VALIDATE_STOPLIST]: {
    type: WorkflowNodeType.VALIDATE_STOPLIST,
    label: "Validate StopList",
    title: "Validate StopList",
    subtitle: "UI · Server API",
    phase: "precheck_boundary",
    category: "Courier Actions",
    courierPaletteSubgroup: "Route & stops",
    kind: "action",
    icon: ListChecks,
    iconName: "ListChecks",
    color: "orange",
    tone: nodeToneByType.action,
  },
  [WorkflowNodeType.LOAD_TO_VEHICLE]: {
    type: WorkflowNodeType.LOAD_TO_VEHICLE,
    label: "Load to Vehicle",
    title: "Load to Vehicle",
    subtitle: "Courier Action",
    phase: "operation",
    category: "Courier Actions",
    courierPaletteSubgroup: "Load",
    kind: "action",
    icon: Truck,
    iconName: "Truck",
    color: "orange",
    tone: nodeToneByType.action,
    defaultConfig: { barcode: "" },
  },
  [WorkflowNodeType.SEARCH_SHIPMENT]: {
    type: WorkflowNodeType.SEARCH_SHIPMENT,
    label: "Search Shipment",
    title: "Search Shipment",
    subtitle: "Courier Action",
    phase: "operation",
    category: "Courier Actions",
    kind: "action",
    icon: Search,
    iconName: "Search",
    color: "orange",
    tone: nodeToneByType.action,
  },
  [WorkflowNodeType.SEARCH_PARCEL]: {
    type: WorkflowNodeType.SEARCH_PARCEL,
    label: "Search Parcel",
    title: "Search Parcel",
    subtitle: "Courier Action",
    phase: "operation",
    category: "Courier Actions",
    kind: "action",
    icon: Search,
    iconName: "Search",
    color: "orange",
    tone: nodeToneByType.action,
  },
  [WorkflowNodeType.SEARCH_STOP]: {
    type: WorkflowNodeType.SEARCH_STOP,
    label: "Search Stop",
    title: "Search Stop",
    subtitle: "Courier Action",
    phase: "operation",
    category: "Courier Actions",
    kind: "action",
    icon: Search,
    iconName: "Search",
    color: "orange",
    tone: nodeToneByType.action,
  },
  [WorkflowNodeType.REQUEST_TOUR_START]: {
    type: WorkflowNodeType.REQUEST_TOUR_START,
    label: "Request Tour Start",
    title: "Request Tour Start",
    subtitle: "Courier Action",
    phase: "operation",
    category: "Courier Actions",
    courierPaletteSubgroup: "Tour",
    kind: "action",
    icon: Play,
    iconName: "Play",
    color: "orange",
    tone: nodeToneByType.action,
  },
  [WorkflowNodeType.END_OF_DAY]: {
    type: WorkflowNodeType.END_OF_DAY,
    label: "End Of Day",
    title: "End Of Day",
    subtitle: "Courier Action",
    phase: "operation",
    category: "Courier Actions",
    courierPaletteSubgroup: "Tour",
    kind: "action",
    icon: Sunset,
    iconName: "Sunset",
    color: "orange",
    tone: nodeToneByType.action,
  },
  [WorkflowNodeType.RESTART_TOUR]: {
    type: WorkflowNodeType.RESTART_TOUR,
    label: "Restart Tour",
    title: "Restart Tour",
    subtitle: "Courier Action",
    phase: "operation",
    category: "Courier Actions",
    courierPaletteSubgroup: "Tour",
    kind: "action",
    icon: RotateCcw,
    iconName: "RotateCcw",
    color: "orange",
    tone: nodeToneByType.action,
  },
  [WorkflowNodeType.OPEN_SHIPMENT]: {
    type: WorkflowNodeType.OPEN_SHIPMENT,
    label: "Open Shipment",
    title: "Open Shipment",
    subtitle: "Courier Action",
    phase: "operation",
    category: "Courier Actions",
    courierPaletteSubgroup: "Open",
    kind: "action",
    icon: PackageCheck,
    iconName: "PackageCheck",
    color: "orange",
    tone: nodeToneByType.action,
    defaultConfig: { barcode: "" },
  },
  [WorkflowNodeType.OPEN_PARCEL]: {
    type: WorkflowNodeType.OPEN_PARCEL,
    label: "Open Parcel",
    title: "Open Parcel",
    subtitle: "Courier Action",
    phase: "operation",
    category: "Courier Actions",
    courierPaletteSubgroup: "Open",
    kind: "action",
    icon: Package,
    iconName: "Package",
    color: "orange",
    tone: nodeToneByType.action,
    defaultConfig: { trackingNumber: "" },
  },
  [WorkflowNodeType.OPEN_STOP]: {
    type: WorkflowNodeType.OPEN_STOP,
    label: "Open Stop",
    title: "Open Stop",
    subtitle: "Courier Action",
    phase: "operation",
    category: "Courier Actions",
    kind: "action",
    icon: CircleCheck,
    iconName: "CircleCheck",
    color: "orange",
    tone: nodeToneByType.action,
  },
  [WorkflowNodeType.SCAN_BARCODE]: {
    type: WorkflowNodeType.SCAN_BARCODE,
    label: "Scan Barcode",
    title: "Scan Barcode",
    subtitle: "Courier Action",
    phase: "operation",
    category: "Courier Actions",
    courierPaletteSubgroup: "Delivery operations",
    kind: "action",
    icon: ScanBarcode,
    iconName: "ScanBarcode",
    color: "orange",
    tone: nodeToneByType.action,
    defaultConfig: { barcode: "" },
  },
  [WorkflowNodeType.DELIVERY_OPERATION]: {
    type: WorkflowNodeType.DELIVERY_OPERATION,
    label: "Delivery Operation",
    title: "Delivery Operation",
    subtitle: "Courier Action",
    phase: "operation",
    category: "Courier Actions",
    courierPaletteSubgroup: "Delivery operations",
    kind: "action",
    icon: Box,
    iconName: "Box",
    color: "orange",
    tone: nodeToneByType.action,
    defaultConfig: { stopId: "", taskId: "", shipmentId: "", signatureRequired: true },
  },
  [WorkflowNodeType.PICKUP_OPERATION]: {
    type: WorkflowNodeType.PICKUP_OPERATION,
    label: "Pickup Operation",
    title: "Pickup Operation",
    subtitle: "Courier Action",
    phase: "operation",
    category: "Courier Actions",
    courierPaletteSubgroup: "Pickup operations",
    kind: "action",
    icon: Package,
    iconName: "Package",
    color: "orange",
    tone: nodeToneByType.action,
    defaultConfig: { stopId: "", pickupId: "", shipmentId: "" },
  },
  [WorkflowNodeType.DEPS_OPERATION]: {
    type: WorkflowNodeType.DEPS_OPERATION,
    label: "DEPS Operation",
    title: "DEPS Operation",
    subtitle: "Courier Action",
    phase: "operation",
    category: "Courier Actions",
    courierPaletteSubgroup: "Delivery operations",
    kind: "action",
    icon: PackageCheck,
    iconName: "PackageCheck",
    color: "orange",
    tone: nodeToneByType.action,
  },
  [WorkflowNodeType.REMOTE_PICKUP_OPERATION]: {
    type: WorkflowNodeType.REMOTE_PICKUP_OPERATION,
    label: "Remote Pickup Operation",
    title: "Remote Pickup Operation",
    subtitle: "Courier Action",
    phase: "operation",
    category: "Courier Actions",
    courierPaletteSubgroup: "Pickup operations",
    kind: "action",
    icon: UploadCloud,
    iconName: "UploadCloud",
    color: "orange",
    tone: nodeToneByType.action,
  },
  [WorkflowNodeType.PICKUP_AT_CUSTOMER_OPERATION]: {
    type: WorkflowNodeType.PICKUP_AT_CUSTOMER_OPERATION,
    label: "Pickup At Customer Operation",
    title: "Pickup At Customer Operation",
    subtitle: "Courier Action",
    phase: "operation",
    category: "Courier Actions",
    courierPaletteSubgroup: "Pickup operations",
    kind: "action",
    icon: Package,
    iconName: "Package",
    color: "orange",
    tone: nodeToneByType.action,
  },
  [WorkflowNodeType.RDOC_OPERATION]: {
    type: WorkflowNodeType.RDOC_OPERATION,
    label: "RDOC Operation",
    title: "RDOC Operation",
    subtitle: "Courier Action",
    phase: "operation",
    category: "Courier Actions",
    courierPaletteSubgroup: "Documents & LOS",
    kind: "action",
    icon: ClipboardCheck,
    iconName: "ClipboardCheck",
    color: "orange",
    tone: nodeToneByType.action,
  },
  [WorkflowNodeType.LOS_OPERATION]: {
    type: WorkflowNodeType.LOS_OPERATION,
    label: "LOS Operation",
    title: "LOS Operation",
    subtitle: "Courier Action",
    phase: "operation",
    category: "Courier Actions",
    courierPaletteSubgroup: "Documents & LOS",
    kind: "action",
    icon: Circle,
    iconName: "Circle",
    color: "orange",
    tone: nodeToneByType.action,
  },
  [WorkflowNodeType.DELIVERY_FAIL_OPERATION]: {
    type: WorkflowNodeType.DELIVERY_FAIL_OPERATION,
    label: "Delivery Fail Operation",
    title: "Delivery Fail Operation",
    subtitle: "Courier Action",
    phase: "operation",
    category: "Courier Actions",
    courierPaletteSubgroup: "Delivery operations",
    kind: "action",
    icon: CircleX,
    iconName: "CircleX",
    color: "orange",
    tone: nodeToneByType.action,
  },
  [WorkflowNodeType.PICKUP_FAIL_OPERATION]: {
    type: WorkflowNodeType.PICKUP_FAIL_OPERATION,
    label: "Pickup Fail Operation",
    title: "Pickup Fail Operation",
    subtitle: "Courier Action",
    phase: "operation",
    category: "Courier Actions",
    courierPaletteSubgroup: "Pickup operations",
    kind: "action",
    icon: CircleX,
    iconName: "CircleX",
    color: "orange",
    tone: nodeToneByType.action,
  },
  [WorkflowNodeType.CANCEL_DELIVERY_OPERATION]: {
    type: WorkflowNodeType.CANCEL_DELIVERY_OPERATION,
    label: "Cancel Delivery Operation",
    title: "Cancel Delivery Operation",
    subtitle: "Courier Action",
    phase: "operation",
    category: "Courier Actions",
    courierPaletteSubgroup: "Delivery operations",
    kind: "action",
    icon: ClipboardCheck,
    iconName: "ClipboardCheck",
    color: "orange",
    tone: nodeToneByType.action,
  },
  [WorkflowNodeType.CONDITION]: {
    type: WorkflowNodeType.CONDITION,
    label: "Condition (If / Else)",
    title: "Condition (If / Else)",
    subtitle: "Condition",
    phase: "utility",
    category: "System Controls",
    kind: "condition",
    icon: GitFork,
    iconName: "GitFork",
    color: "orange",
    tone: nodeToneByType.condition,
    branches: ["true", "false"],
    defaultConfig: { expression: "task.type == 'delivery'" },
  },
  [WorkflowNodeType.WAIT]: {
    type: WorkflowNodeType.WAIT,
    label: "Wait",
    title: "Wait",
    subtitle: "System Control",
    phase: "utility",
    category: "System Controls",
    kind: "action",
    icon: Timer,
    iconName: "Timer",
    color: "orange",
    tone: nodeToneByType.action,
    defaultConfig: { duration: 2, unit: "seconds" },
  },
  [WorkflowNodeType.ASSERT_VISIBLE]: {
    type: WorkflowNodeType.ASSERT_VISIBLE,
    label: "Assert Visible",
    title: "Assert Visible",
    subtitle: "Assertion",
    phase: "operation",
    category: "Assertions",
    kind: "assertion",
    icon: CircleCheck,
    iconName: "CircleCheck",
    color: "emerald",
    tone: nodeToneByType.assertion,
    defaultConfig: { selector: "" },
  },
  [WorkflowNodeType.VERIFY_BACKEND_STATE]: {
    type: WorkflowNodeType.VERIFY_BACKEND_STATE,
    label: "Verify Backend State",
    title: "Verify Backend State",
    subtitle: "Assertion",
    phase: "operation",
    category: "Assertions",
    kind: "assertion",
    icon: Database,
    iconName: "Database",
    color: "blue",
    tone: nodeToneByType.backend,
    defaultConfig: { expectedState: "DELIVERED" },
  },
  [WorkflowNodeType.HTTP_REQUEST]: {
    type: WorkflowNodeType.HTTP_REQUEST,
    label: "HTTP Request",
    title: "HTTP Request",
    subtitle: "Integration",
    phase: "utility",
    category: "Integrations",
    kind: "integration",
    icon: UploadCloud,
    iconName: "UploadCloud",
    color: "emerald",
    tone: nodeToneByType.integration,
    defaultConfig: { method: "POST", url: "" },
  },
  [WorkflowNodeType.DATABASE_QUERY]: {
    type: WorkflowNodeType.DATABASE_QUERY,
    label: "Database Query",
    title: "Database Query",
    subtitle: "Integration",
    phase: "utility",
    category: "Integrations",
    kind: "integration",
    icon: Database,
    iconName: "Database",
    color: "blue",
    tone: nodeToneByType.database,
    defaultConfig: { query: "" },
  },
};

for (const definition of Object.values(workflowComponentRegistry)) {
  if (!definition) continue;
  definition.configSchema = getNodeConfigSchema(definition.type);
}

export const iconRegistry = Object.fromEntries(
  Object.values(workflowComponentRegistry)
    .filter((definition): definition is WorkflowComponentDefinition => Boolean(definition))
    .map((definition) => [definition.iconName, definition.icon]),
);

export const workflowComponentGroups: WorkflowPaletteCategory[] = [
  { title: "Courier Actions", subsections: courierPaletteSubsections() },
  { title: "System Controls", items: registryItemsFor("System Controls") },
  { title: "Assertions", items: registryItemsFor("Assertions") },
  { title: "Integrations", items: registryItemsFor("Integrations") },
];

export const allPaletteItems = workflowComponentGroups.flatMap((group) =>
  group.subsections ? group.subsections.flatMap((sub) => sub.items) : group.items ?? [],
);

export function paletteItemFromType(type: WorkflowNodeType): PaletteItem {
  const definition = workflowComponentRegistry[type];
  if (!definition) {
    return {
      type: WorkflowNodeType.DEPRECATED_LEGACY,
      title: "Deprecated Node",
      subtitle: "Legacy node type",
      icon: "Box",
      tone: nodeToneByType.terminal,
      kind: "action",
      defaultConfig: { __deprecated: true },
    };
  }
  return {
    type: definition.type,
    title: definition.title,
    subtitle: definition.subtitle,
    icon: definition.iconName,
    tone: definition.tone,
    kind: definition.kind,
    defaultConfig: definition.defaultConfig,
  };
}

function humanizeWorkflowType(type: string): string {
  return type
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

/** Split compound palette subtitles into compact canvas tags (e.g. "UI · Server API"). */
export function parseWorkflowSubtitleTags(subtitle: string): string[] {
  if (!subtitle) return [];
  for (const separator of [" · ", " + ", " | "]) {
    if (!subtitle.includes(separator)) continue;
    const parts = subtitle.split(separator).map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2 && parts.every((part) => part.length <= 28)) return parts;
  }
  return [];
}

export function getWorkflowNodeDisplay(node: {
  type: string;
  data?: { title?: string; subtitle?: string };
}): { title: string; subtitle: string; subtitleTags: string[] } {
  const definition = workflowComponentRegistry[node.type as WorkflowNodeType];
  const rawTitle = node.data?.title?.trim() || definition?.title || node.type;
  const looksLikeTypeId = rawTitle === node.type || /^[A-Z0-9_]+$/.test(rawTitle);
  const title = looksLikeTypeId
    ? (definition?.label ?? definition?.title ?? humanizeWorkflowType(node.type))
    : rawTitle;
  const subtitle = node.data?.subtitle?.trim() || definition?.subtitle || "";
  return { title, subtitle, subtitleTags: parseWorkflowSubtitleTags(subtitle) };
}

function courierPaletteSubsections(): { title: string; items: PaletteItem[] }[] {
  const buckets = new Map<CourierPaletteSubgroup, PaletteItem[]>();
  for (const title of courierPaletteSubgroupOrder) {
    buckets.set(title, []);
  }
  for (const definition of Object.values(workflowComponentRegistry)) {
    if (!definition || definition.category !== "Courier Actions") continue;
    const subgroup = definition.courierPaletteSubgroup;
    if (!subgroup) continue;
    buckets.get(subgroup)?.push(paletteItemFromType(definition.type));
  }
  return courierPaletteSubgroupOrder.map((title) => ({ title, items: buckets.get(title) ?? [] })).filter((s) => s.items.length > 0);
}

function registryItemsFor(category: WorkflowComponentDefinition["category"]) {
  return Object.values(workflowComponentRegistry)
    .filter((definition): definition is WorkflowComponentDefinition => Boolean(definition))
    .filter((definition) => definition.category === category)
    .map((definition) => paletteItemFromType(definition.type));
}
