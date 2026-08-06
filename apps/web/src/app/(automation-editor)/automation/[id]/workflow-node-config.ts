import { WorkflowNodeType, type NodeConfigField, type WorkflowNode } from "./workflow-types";
import {
  AuthLoginSchema,
  CheckRouteSchema,
  IfLoginSchema,
  LaunchAppCountryOptions,
  LaunchAppEnvironmentOptions,
  LaunchAppSchema,
  LoadToVehicleSchema,
  OpenParcelSchema,
  OpenShipmentSchema,
  SelectRouteSchema,
  coerceAuthLoginParams,
  coerceCheckRouteParams,
  coerceIfLoginParams,
  coerceLaunchAppParams,
  coerceLoadToVehicleParams,
  coerceOpenParcelParams,
  coerceOpenShipmentParams,
  coerceSelectRouteParams,
} from "./yaml-registry";

export type NodeConfigValidationError = {
  key?: string;
  message: string;
};

const launchAppCountryOptions = LaunchAppCountryOptions.map((option) => ({
  label: option.label,
  value: option.value,
}));

const launchAppEnvironmentOptions = LaunchAppEnvironmentOptions.map((option) => ({
  label: option.label,
  value: option.value,
}));

const deliveryFailReasonOptions = [
  "ADDRESS_NOT_FOUND",
  "CUSTOMER_NOT_AVAILABLE",
  "DAMAGED",
  "REFUSED",
  "OTHER",
].map((value) => ({ label: value, value }));

const pickupFailReasonOptions = [
  "CUSTOMER_NOT_AVAILABLE",
  "PACKAGE_NOT_READY",
  "ADDRESS_NOT_FOUND",
  "CANCELLED_BY_CUSTOMER",
  "OTHER",
].map((value) => ({ label: value, value }));

const rdocFailReasonOptions = ["DOCUMENT_MISSING", "CUSTOMER_REJECTED", "INVALID_DOCUMENT", "OTHER"].map((value) => ({
  label: value,
  value,
}));

const baseSchemas: Partial<Record<WorkflowNodeType, NodeConfigField[]>> = {
  [WorkflowNodeType.LAUNCH_APP]: [
    {
      key: "country",
      label: "Country",
      type: "select",
      required: true,
      options: launchAppCountryOptions,
      helperText: "Used to resolve the Maestro appId.",
    },
    {
      key: "environment",
      label: "Environment",
      type: "select",
      required: true,
      options: launchAppEnvironmentOptions,
      helperText: "Stage or prod target for the selected country.",
    },
    { key: "clearState", label: "Clear app state before launch", type: "toggle" },
  ],
  [WorkflowNodeType.AUTH_LOGIN]: [
    {
      key: "pinCode",
      label: "PIN Code",
      type: "text",
      required: true,
      placeholder: "e.g. 1234",
      helperText: "Required when PIN screen is shown",
    },
  ],
  [WorkflowNodeType.CHECK_ROUTE]: [],
  [WorkflowNodeType.SELECT_ROUTE]: [
    {
      key: "routeNumber",
      label: "Route Number",
      type: "text",
      required: true,
      placeholder: "e.g. 01",
      helperText: "Route number or text in the Android dropdown list",
    },
  ],
  [WorkflowNodeType.CHANGE_ROUTE]: [
    {
      key: "routeNumber",
      label: "Route Number",
      type: "text",
      required: true,
      placeholder: "e.g. 01",
      helperText: "Target route number or text to change to",
    },
  ],
  [WorkflowNodeType.LOAD_TO_VEHICLE]: [
    {
      key: "barcode",
      label: "Barcode",
      type: "text",
      required: true,
      placeholder: "e.g. 1111111111111",
      helperText: "Manual barcode number of the shipment to be loaded",
    },
  ],
  [WorkflowNodeType.SEARCH_SHIPMENT]: [
    { key: "trackingNumber", label: "Tracking Number", type: "text", required: true, placeholder: "e.g. 1234567890" },
  ],
  [WorkflowNodeType.SEARCH_PARCEL]: [
    { key: "barcode", label: "Barcode", type: "text" },
    { key: "legacySystemShortBarcode", label: "Legacy Short Barcode", type: "text" },
    { key: "legacySystemShortBarcodeTrim", label: "Trimmed Legacy Short Barcode", type: "text" },
  ],
  [WorkflowNodeType.SEARCH_STOP]: [
    { key: "stopOrder", label: "Stop Order", type: "number", required: true, placeholder: "e.g. 12" },
  ],
  [WorkflowNodeType.REQUEST_TOUR_START]: [],
  [WorkflowNodeType.END_OF_DAY]: [],
  [WorkflowNodeType.RESTART_TOUR]: [],
  [WorkflowNodeType.OPEN_SHIPMENT]: [
    {
      key: "barcode",
      label: "Tracking / Barcode",
      type: "text",
      required: true,
      placeholder: "e.g. 1910051002121815",
      helperText: "Shipment barcode number to search (waybill / tracking no)",
    },
  ],
  [WorkflowNodeType.OPEN_PARCEL]: [
    {
      key: "trackingNumber",
      label: "Tracking Number",
      type: "text",
      required: true,
      placeholder: "e.g. 1910051002121815",
      helperText: "Parcel tracking number to search",
    },
  ],
  [WorkflowNodeType.OPEN_STOP]: [{ key: "stopOrder", label: "Stop Order", type: "number", required: true }],
  [WorkflowNodeType.SCAN_BARCODE]: [
    {
      key: "barcode",
      label: "Barcode",
      type: "text",
      required: true,
      placeholder: "e.g. 1910051002121816",
      helperText: "Barcode number to be scanned via manual input on TaskList screen",
    },
  ],
  [WorkflowNodeType.DELIVERY_OPERATION]: [
    {
      key: "personDelivered",
      label: "Person Delivered",
      type: "text",
      required: false,
      placeholder: "e.g. John Doe",
      helperText: "Name of the person delivered to (if left blank, read from logcat)",
    },
    {
      key: "waitBeforeDelivery",
      label: "Wait Before Delivery",
      type: "select",
      required: false,
      options: [
        { label: "No wait", value: "0" },
        { label: "30 seconds", value: "30000" },
        { label: "1 minute", value: "60000" },
        { label: "2 minutes", value: "120000" },
      ],
      helperText: "Waiting time before pressing the Delivery button (for the screen to load)",
    },
  ],
  [WorkflowNodeType.DEPS_OPERATION]: [
    {
      key: "barcodes",
      label: "Shipments / Barcodes",
      type: "multiBarcodeChips",
      required: true,
      placeholder: "Add barcode and press Enter",
    },
  ],
  [WorkflowNodeType.DELIVERY_FAIL_OPERATION]: [
    { key: "failureReason", label: "Failure Reason", type: "select", required: true, options: deliveryFailReasonOptions },
    { key: "barcodes", label: "Shipments / Barcodes", type: "multiBarcodeChips", required: true },
  ],
  [WorkflowNodeType.CANCEL_DELIVERY_OPERATION]: [{ key: "barcode", label: "Target Barcode", type: "text", required: true }],
  [WorkflowNodeType.PICKUP_OPERATION]: [{ key: "barcode", label: "Barcode", type: "text", required: true }],
  [WorkflowNodeType.REMOTE_PICKUP_OPERATION]: [{ key: "barcode", label: "Barcode", type: "text", required: true }],
  [WorkflowNodeType.PICKUP_AT_CUSTOMER_OPERATION]: [{ key: "barcode", label: "Barcode", type: "text", required: true }],
  [WorkflowNodeType.PICKUP_FAIL_OPERATION]: [
    { key: "failureReason", label: "Failure Reason", type: "select", required: true, options: pickupFailReasonOptions },
    { key: "barcode", label: "Barcode", type: "text", required: true },
  ],
  [WorkflowNodeType.LOS_OPERATION]: [
    { key: "lockerName", label: "Locker Name", type: "text", required: true, placeholder: "e.g. Locker A-12" },
    { key: "barcode", label: "Barcode", type: "text", required: true },
  ],
  [WorkflowNodeType.RDOC_OPERATION]: [
    {
      key: "rdocStatus",
      label: "RDOC Status",
      type: "select",
      required: true,
      options: [
        { label: "Success", value: "Success" },
        { label: "Fail", value: "Fail" },
      ],
    },
    {
      key: "failReason",
      label: "Fail Reason",
      type: "select",
      required: true,
      visibleIf: { field: "rdocStatus", equals: "Fail" },
      options: rdocFailReasonOptions,
    },
    { key: "deliveryBarcode", label: "Delivery Barcode", type: "text" },
    { key: "pickupBarcode", label: "Pickup Barcode", type: "text" },
  ],
  [WorkflowNodeType.WAIT]: [
    {
      key: "timeout",
      label: "Wait Duration",
      type: "select",
      required: true,
      options: [
        { label: "5 seconds", value: "5000" },
        { label: "10 seconds", value: "10000" },
        { label: "30 seconds", value: "30000" },
        { label: "1 minute", value: "60000" },
        { label: "2 minutes", value: "120000" },
        { label: "5 minutes", value: "300000" },
      ],
      helperText: "Time Maestro will wait before proceeding to the next step",
    },
  ],
  [WorkflowNodeType.SEMANTIC_ACTION]: [
    {
      key: "actionKey",
      label: "Semantic Action Key",
      type: "text",
      required: true,
      helperText: "Domain Pack semantic actionKey (nesy.action.*)",
    },
  ],
};

export function getNodeConfigSchema(type: WorkflowNodeType): NodeConfigField[] {
  return baseSchemas[type] ?? [];
}

function isEmptyValue(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function isFieldRequired(field: NodeConfigField, config: Record<string, unknown>) {
  if (!field.required) return false;
  if (!field.visibleIf) return true;
  return config[field.visibleIf.field] === field.visibleIf.equals;
}

export function validateNodeConfig(node: WorkflowNode): NodeConfigValidationError[] {
  const schema = getNodeConfigSchema(node.type);
  const config = (node.data.config ?? {}) as Record<string, unknown>;
  const errors: NodeConfigValidationError[] = [];

  for (const field of schema) {
    const required = isFieldRequired(field, config);
    if (!required) continue;
    const value = config[field.key];
    if (field.type === "multiBarcodeChips") {
      if (!Array.isArray(value) || value.length === 0) {
        errors.push({ key: field.key, message: `${field.label} is required.` });
      }
      continue;
    }
    if (isEmptyValue(value)) errors.push({ key: field.key, message: `${field.label} is required.` });
  }

  const zodResult =
    node.type === WorkflowNodeType.LAUNCH_APP
      ? LaunchAppSchema.safeParse(coerceLaunchAppParams(config))
      : node.type === WorkflowNodeType.AUTH_LOGIN
        ? AuthLoginSchema.safeParse(coerceAuthLoginParams(config))
        : node.type === WorkflowNodeType.IF_LOGIN
          ? IfLoginSchema.safeParse(coerceIfLoginParams(config))
          : node.type === WorkflowNodeType.CHECK_ROUTE
            ? CheckRouteSchema.safeParse(coerceCheckRouteParams(config))
            : node.type === WorkflowNodeType.SELECT_ROUTE
              ? SelectRouteSchema.safeParse(coerceSelectRouteParams(config))
              : node.type === WorkflowNodeType.LOAD_TO_VEHICLE
                ? LoadToVehicleSchema.safeParse(coerceLoadToVehicleParams(config))
                : node.type === WorkflowNodeType.OPEN_SHIPMENT
                  ? OpenShipmentSchema.safeParse(coerceOpenShipmentParams(config))
                  : node.type === WorkflowNodeType.OPEN_PARCEL
                    ? OpenParcelSchema.safeParse(coerceOpenParcelParams(config))
                    : null;

  if (zodResult && !zodResult.success) {
    for (const issue of zodResult.error.issues) {
      const key = issue.path[0] ? String(issue.path[0]) : undefined;
      if (key && errors.some((error) => error.key === key)) continue;
      errors.push({ key, message: issue.message });
    }
  }

  if (node.type === WorkflowNodeType.SEARCH_PARCEL) {
    const hasAny = [config.barcode, config.legacySystemShortBarcode, config.legacySystemShortBarcodeTrim].some(
      (v) => !isEmptyValue(v),
    );
    if (!hasAny) {
      errors.push({
        message: "Provide barcode, legacy short barcode or trimmed legacy short barcode.",
      });
    }
  }

  if (node.type === WorkflowNodeType.RDOC_OPERATION) {
    const hasAny = [config.deliveryBarcode, config.pickupBarcode].some((v) => !isEmptyValue(v));
    if (!hasAny) errors.push({ message: "Provide at least one delivery or pickup barcode." });
  }

  return errors;
}

function cleanConfig(config: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(config).filter(([, value]) => !isEmptyValue(value)));
}

function formatScalar(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function createNodeYamlPreview(node: WorkflowNode): string[] {
  const config = cleanConfig((node.data.config ?? {}) as Record<string, unknown>);
  const lines = [`type: ${node.type}`, `title: ${node.data.title}`];
  if (Object.keys(config).length === 0) return lines;
  lines.push("config:");
  for (const [key, value] of Object.entries(config)) {
    if (Array.isArray(value)) {
      lines.push(`  ${key}:`);
      for (const item of value) lines.push(`    - ${formatScalar(item)}`);
      continue;
    }
    lines.push(`  ${key}: ${formatScalar(value)}`);
  }
  return lines;
}
