import type { LucideIcon } from "lucide-react";

/** Workflow step phase for rule engine (e.g. post–Validate StopList constraints). */
export type WorkflowPhase = "bootstrap" | "precheck" | "precheck_boundary" | "operation" | "utility";

export type BranchType = "true" | "false";
export type NodeKind = "action" | "condition" | "assertion" | "integration" | "end";
export type SourceHandle = "default" | BranchType;
export type TargetHandle = "top";

export enum WorkflowNodeType {
  LAUNCH_APP = "LAUNCH_APP",
  GRANT_PERMISSIONS = "GRANT_PERMISSIONS",
  IF_LOGIN = "IF_LOGIN",
  AUTH_LOGIN = "AUTH_LOGIN",
  CHECK_ROUTE = "CHECK_ROUTE",
  SELECT_ROUTE = "SELECT_ROUTE",
  CHANGE_ROUTE = "CHANGE_ROUTE",
  VALIDATE_STOPLIST = "VALIDATE_STOPLIST",
  SEARCH_SHIPMENT = "SEARCH_SHIPMENT",
  SEARCH_PARCEL = "SEARCH_PARCEL",
  SEARCH_STOP = "SEARCH_STOP",
  LOAD_TO_VEHICLE = "LOAD_TO_VEHICLE",
  REQUEST_TOUR_START = "REQUEST_TOUR_START",
  END_OF_DAY = "END_OF_DAY",
  RESTART_TOUR = "RESTART_TOUR",
  OPEN_SHIPMENT = "OPEN_SHIPMENT",
  OPEN_PARCEL = "OPEN_PARCEL",
  SCAN_BARCODE = "SCAN_BARCODE",
  OPEN_STOP = "OPEN_STOP",
  DELIVERY_OPERATION = "DELIVERY_OPERATION",
  PICKUP_OPERATION = "PICKUP_OPERATION",
  DEPS_OPERATION = "DEPS_OPERATION",
  REMOTE_PICKUP_OPERATION = "REMOTE_PICKUP_OPERATION",
  PICKUP_AT_CUSTOMER_OPERATION = "PICKUP_AT_CUSTOMER_OPERATION",
  RDOC_OPERATION = "RDOC_OPERATION",
  LOS_OPERATION = "LOS_OPERATION",
  DELIVERY_FAIL_OPERATION = "DELIVERY_FAIL_OPERATION",
  PICKUP_FAIL_OPERATION = "PICKUP_FAIL_OPERATION",
  CANCEL_DELIVERY_OPERATION = "CANCEL_DELIVERY_OPERATION",
  CONDITION = "CONDITION",
  WAIT = "WAIT",
  ASSERT_VISIBLE = "ASSERT_VISIBLE",
  VERIFY_BACKEND_STATE = "VERIFY_BACKEND_STATE",
  HTTP_REQUEST = "HTTP_REQUEST",
  DATABASE_QUERY = "DATABASE_QUERY",
  /** Pack-authored semantic action (primary left-palette source after 6D.1f). */
  SEMANTIC_ACTION = "SEMANTIC_ACTION",
  DEPRECATED_LEGACY = "DEPRECATED_LEGACY",
}

export type NodeData = {
  title: string;
  subtitle?: string;
  icon?: string;
  config?: Record<string, unknown>;
};

export type WorkflowNode = {
  id: string;
  type: WorkflowNodeType;
  kind: NodeKind;
  position: {
    x: number;
    y: number;
  };
  data: NodeData;
  parentId?: string | null;
  children?: string[];
  branchType?: BranchType | null;
  nextNodeId?: string | null;
  connections?: Connection[];
};

export type Connection = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string | null;
  sourceHandle: SourceHandle;
  targetHandle: TargetHandle | null;
  label?: "True" | "False";
  branchLabel?: string;
  isPlaceholder?: boolean;
};

export type CourierPaletteSubgroup =
  | "App & session"
  | "Route & stops"
  | "Load"
  | "Search"
  | "Tour"
  | "Open"
  | "Delivery operations"
  | "Pickup operations"
  | "Documents & LOS";

export type WorkflowComponentDefinition = {
  type: WorkflowNodeType;
  label: string;
  title: string;
  subtitle: string;
  phase: WorkflowPhase;
  category: "Courier Actions" | "System Controls" | "Assertions" | "Integrations";
  /** Used to cluster Courier Actions in the palette sidebar. */
  courierPaletteSubgroup?: CourierPaletteSubgroup;
  kind: NodeKind;
  icon: LucideIcon;
  iconName: string;
  color: string;
  tone: string;
  branches?: BranchType[];
  defaultConfig?: Record<string, unknown>;
  configSchema?: NodeConfigField[];
};

export type FieldType = "text" | "number" | "select" | "multiBarcodeChips" | "toggle";

export type NodeConfigField = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  visibleIf?: {
    field: string;
    equals: string | boolean;
  };
  helperText?: string;
};

export type PaletteItem = {
  type: WorkflowNodeType;
  title: string;
  subtitle: string;
  icon: string;
  tone: string;
  kind: NodeKind;
  defaultConfig?: Record<string, unknown>;
  /** Stable key for pack-sourced items (multiple SEMANTIC_ACTION rows). */
  paletteKey?: string;
  actionKey?: string;
  businessMeaning?: string;
  notResponsibleFor?: readonly string[];
  /** When true, item stays visible but cannot be dragged onto the canvas. */
  paletteDisabled?: boolean;
  paletteDisabledReason?: string;
};
