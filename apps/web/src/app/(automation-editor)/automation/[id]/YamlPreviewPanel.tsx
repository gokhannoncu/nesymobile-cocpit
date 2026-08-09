"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { ChevronDown, Play, X } from "lucide-react";
import { Button } from "@nesy/metronic/components/ui/button";
import { cn } from "@nesy/metronic/lib/utils";
import type { WorkflowNode } from "./workflow-types";
import {
  AuthLoginSchema,
  CheckRouteSchema,
  DEFAULT_LAUNCH_APP_COUNTRY,
  DEFAULT_LAUNCH_APP_ENVIRONMENT,
  DeliveryOperationSchema,
  IfLoginSchema,
  LaunchAppCountryOptions,
  LaunchAppEnvironmentOptions,
  LaunchAppSchema,
  LoadToVehicleSchema,
  OpenParcelSchema,
  OpenShipmentSchema,
  SelectRouteSchema,
  WaitSchema,
  coerceAuthLoginParams,
  coerceCheckRouteParams,
  coerceIfLoginParams,
  coerceLaunchAppParams,
  coerceLoadToVehicleParams,
  coerceOpenParcelParams,
  coerceOpenShipmentParams,
  coerceSelectRouteParams,
  parseDeliveryOperationParams,
  parseScanBarcodeParams,
  parseWaitParams,
  ScanBarcodeSchema,
} from "./node-config-registry";

type YamlPreviewPanelProps = {
  selectedNode: WorkflowNode | null;
  onClose: () => void;
  onRunTest: () => void;
  runTestDisabled?: boolean;
  onUpdateNodeConfig: (nodeId: string, patch: Record<string, unknown>) => void;
};

type FieldErrors = Record<string, string>;

function configFor(node: WorkflowNode | null): Record<string, unknown> {
  return node?.data.config ?? {};
}

function validationErrorsFor(node: WorkflowNode | null): FieldErrors {
  if (!node) return {};

  const config = configFor(node);
  const result =
    node.type === "LAUNCH_APP"
      ? LaunchAppSchema.safeParse(coerceLaunchAppParams(config))
      : node.type === "AUTH_LOGIN"
        ? AuthLoginSchema.safeParse(coerceAuthLoginParams(config))
        : node.type === "IF_LOGIN"
          ? IfLoginSchema.safeParse(coerceIfLoginParams(config))
          : node.type === "CHECK_ROUTE"
            ? CheckRouteSchema.safeParse(coerceCheckRouteParams(config))
            : node.type === "SELECT_ROUTE"
              ? SelectRouteSchema.safeParse(coerceSelectRouteParams(config))
              : node.type === "LOAD_TO_VEHICLE"
                ? LoadToVehicleSchema.safeParse(coerceLoadToVehicleParams(config))
                : node.type === "OPEN_SHIPMENT"
                  ? OpenShipmentSchema.safeParse(coerceOpenShipmentParams(config))
                  : node.type === "OPEN_PARCEL"
                    ? OpenParcelSchema.safeParse(coerceOpenParcelParams(config))
                      : node.type === "DELIVERY_OPERATION"
                        ? DeliveryOperationSchema.safeParse(config)
                        : node.type === "SCAN_BARCODE"
                          ? ScanBarcodeSchema.safeParse(config)
                          : node.type === "WAIT"
                            ? WaitSchema.safeParse(config)
                            : null;

  if (!result || result.success) return {};

  return result.error.issues.reduce<FieldErrors>((acc, issue) => {
    const key = String(issue.path[0] ?? "form");
    if (!acc[key]) acc[key] = issue.message;
    return acc;
  }, {});
}

function getLaunchAppDraft(config: Record<string, unknown>) {
  const parsed = LaunchAppSchema.safeParse(coerceLaunchAppParams(config));
  return parsed.success
    ? parsed.data
    : { country: DEFAULT_LAUNCH_APP_COUNTRY, environment: DEFAULT_LAUNCH_APP_ENVIRONMENT, clearState: false };
}

export function YamlPreviewPanel({
  selectedNode,
  onClose,
  onRunTest,
  runTestDisabled = false,
  onUpdateNodeConfig,
}: YamlPreviewPanelProps) {
  const selectedConfig = configFor(selectedNode);
  const validationErrors = useMemo(() => validationErrorsFor(selectedNode), [selectedNode]);

  const updateConfig = useCallback(
    (patch: Record<string, unknown>) => {
      if (!selectedNode) return;
      onUpdateNodeConfig(selectedNode.id, patch);
    },
    [onUpdateNodeConfig, selectedNode],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-50">
      <div className="flex items-center justify-between border-b border-gray-200 bg-white p-4">
        <div>
          <h2 className="text-sm font-bold tracking-wide text-gray-800">Selected Node Settings</h2>
          <p className="mt-1 text-xs font-medium text-gray-500">
            {selectedNode ? `${selectedNode.data.title} / ${selectedNode.type}` : "No node selected"}
          </p>
        </div>
        <Button
          variant="ghost"
          mode="icon"
          size="sm"
          type="button"
          className="rounded-md"
          onClick={onClose}
          aria-label="Close properties panel"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-white p-4">
        {selectedNode ? (
          <SelectedNodeForm
            node={selectedNode}
            config={selectedConfig}
            errors={validationErrors}
            onChange={updateConfig}
          />
        ) : (
          <p className="text-xs text-gray-500">Select a node on the canvas.</p>
        )}
      </div>

      <div className="border-t border-slate-200 bg-white p-4">
        <Button
          type="button"
          size="lg"
          disabled={runTestDisabled}
          className="min-h-10 w-full rounded-md bg-nesy font-semibold text-white hover:bg-nesy-hover"
          onClick={onRunTest}
        >
          <Play className="size-4" />
          Run Test
        </Button>
      </div>
    </div>
  );
}

function SelectedNodeForm({
  node,
  config,
  errors,
  onChange,
}: {
  node: WorkflowNode;
  config: Record<string, unknown>;
  errors: FieldErrors;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  if (node.type === "LAUNCH_APP") {
    const draft = getLaunchAppDraft(config);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Country" required error={errors.country}>
            <div className="relative">
              <select
                className={cn(getFieldControlClassName(Boolean(errors.country)), "appearance-none pr-10")}
                value={draft.country}
                onChange={(event) => onChange({ country: event.target.value })}
              >
                {LaunchAppCountryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            </div>
          </FormField>
          <FormField label="Environment" required error={errors.environment}>
            <div className="relative">
              <select
                className={cn(getFieldControlClassName(Boolean(errors.environment)), "appearance-none pr-10")}
                value={draft.environment}
                onChange={(event) => onChange({ environment: event.target.value })}
              >
                {LaunchAppEnvironmentOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            </div>
          </FormField>
        </div>
        <FormField label="Clear state">
          <ToggleField
            checked={draft.clearState}
            onChange={(checked) => onChange({ clearState: checked })}
          />
        </FormField>
      </div>
    );
  }

  if (node.type === "AUTH_LOGIN") {
    const pinCode = coerceAuthLoginParams(config).pinCode ?? "";

    return (
      <FormField label="PIN Code" required helperText="4-digit numeric courier PIN." error={errors.pinCode}>
        <input
          type="text"
          inputMode="numeric"
          maxLength={4}
          className={getFieldControlClassName(Boolean(errors.pinCode))}
          placeholder="4618"
          value={pinCode}
          onChange={(event) => onChange({ pinCode: event.target.value.replace(/\D/g, "").slice(0, 4) })}
        />
      </FormField>
    );
  }

  if (node.type === "IF_LOGIN") {
    return (
      <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-700">
        <strong>Bridge:</strong> CHECK_LOGIN logu is_logged_in değerini belirler.
        <br />
        <span className="text-emerald-500">CHECK_LOGIN → LOGIN_STATUS</span>
      </div>
    );
  }

  if (node.type === "CHECK_ROUTE") {
    return (
      <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-700">
        <strong>Bridge:</strong> CHECK_ROUTE logu route_required değerini belirler.
        <br />
        <span className="text-emerald-500">CHECK_ROUTE → ROUTE_STATUS</span>
      </div>
    );
  }

  if (node.type === "SELECT_ROUTE") {
    const draft = SelectRouteSchema.safeParse(coerceSelectRouteParams(config));
    const routeNumber = draft.success ? draft.data.routeNumber : (coerceSelectRouteParams(config).routeNumber ?? "");

    return (
      <div className="space-y-4">
        <FormField
          label="Route Number"
          required
          helperText="Route number or label in the Android dropdown (e.g. 01, Route 1)"
          error={errors.routeNumber}
        >
          <input
            type="text"
            className={getFieldControlClassName(Boolean(errors.routeNumber))}
            placeholder="e.g. 01"
            value={routeNumber}
            onChange={(event) => onChange({ routeNumber: event.target.value })}
          />
        </FormField>
      </div>
    );
  }

  if (node.type === "LOAD_TO_VEHICLE") {
    const barcode = coerceLoadToVehicleParams(config).barcode ?? "";

    return (
      <div className="space-y-4">
        <FormField
          label="Barcode"
          required
          helperText="Manual barcode number of the parcel to be loaded to the vehicle."
          error={errors.barcode}
        >
          <input
            type="text"
            className={getFieldControlClassName(Boolean(errors.barcode))}
            placeholder="e.g. 1111111111111"
            value={barcode}
            onChange={(event) => onChange({ barcode: event.target.value })}
          />
        </FormField>
        <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2.5 text-xs leading-5 text-blue-700">
          <strong>Flow:</strong> Manual Barcode icon → Dialog opens → Enter barcode → OK → Wait for bridge
          <br />
          <span className="text-blue-500">FETCH_SHIPMENT → CREATE_TASK → FETCH_SCHEDULE</span>
        </div>
      </div>
    );
  }

  if (node.type === "OPEN_SHIPMENT") {
    const barcode = coerceOpenShipmentParams(config).barcode ?? "";

    return (
      <div className="space-y-4">
        <FormField
          label="Tracking / Barcode"
          required
          helperText="Shipment barcode to search for (waybill / tracking no.)."
          error={errors.barcode}
        >
          <input
            type="text"
            className={getFieldControlClassName(Boolean(errors.barcode))}
            placeholder="e.g. 1910051002121815"
            value={barcode}
            onChange={(event) => onChange({ barcode: event.target.value })}
          />
        </FormField>
        <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-700">
          <strong>Flow:</strong> Search box → Enter barcode → Search → Tap first stop card
          <br />
          <span className="text-emerald-500">SEARCH_STOP → OPEN_STOP</span>
        </div>
      </div>
    );
  }

  if (node.type === "OPEN_PARCEL") {
    const trackingNumber = coerceOpenParcelParams(config).trackingNumber ?? "";

    return (
      <div className="space-y-4">
        <FormField
          label="Tracking Number"
          required
          helperText="Parcel tracking number to search for."
          error={errors.trackingNumber}
        >
          <input
            type="text"
            className={getFieldControlClassName(Boolean(errors.trackingNumber))}
            placeholder="e.g. 1910051002121815"
            value={trackingNumber}
            onChange={(event) => onChange({ trackingNumber: event.target.value })}
          />
        </FormField>
        <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-700">
          <strong>Flow:</strong> Search box → Enter tracking no. → Search → Tap first stop card
          <br />
          <span className="text-emerald-500">SEARCH_STOP → OPEN_STOP</span>
        </div>
      </div>
    );
  }

  if (node.type === "SCAN_BARCODE") {
    const barcode = (config.barcode as string) ?? "";

    return (
      <div className="space-y-4">
        <FormField
          label="Barcode"
          required
          helperText="Barcode number to be scanned via manual input on TaskList screen"
          error={errors.barcode}
        >
          <input
            type="text"
            className={getFieldControlClassName(Boolean(errors.barcode))}
            placeholder="e.g. 1910051002121816"
            value={barcode}
            onChange={(event) => onChange({ barcode: event.target.value })}
          />
        </FormField>
        <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-700">
          <strong>Flow:</strong> Manual input icon → Barcode dialog → Write barcode → OK → DeliveryFragment
          <br />
          <span className="text-emerald-500">AWAIT_BRIDGE::SCAN_PARCEL</span>
        </div>
      </div>
    );
  }

  if (node.type === "DELIVERY_OPERATION") {
    const personDelivered = (config.personDelivered as string) ?? "";
    const waitBeforeDelivery = String(config.waitBeforeDelivery ?? "0");

    return (
      <div className="space-y-4">
        <FormField
          label="Person Delivered"
          helperText="Name of the person delivered to (if left blank, read from logcat)"
          error={errors.personDelivered}
        >
          <input
            type="text"
            className={getFieldControlClassName(Boolean(errors.personDelivered))}
            placeholder="e.g. John Doe"
            value={personDelivered}
            onChange={(event) => onChange({ personDelivered: event.target.value })}
          />
        </FormField>
        <FormField
          label="Wait Before Delivery"
          helperText="Waiting time before pressing the Delivery button (for the screen to load)"
        >
          <div className="relative">
            <select
              className={cn(getFieldControlClassName(), "appearance-none pr-10")}
              value={waitBeforeDelivery}
              onChange={(event) => onChange({ waitBeforeDelivery: event.target.value })}
            >
              <option value="0">No wait</option>
              <option value="30000">30 seconds</option>
              <option value="60000">1 minute</option>
              <option value="120000">2 minutes</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          </div>
        </FormField>
        <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-700">
          <strong>Flow:</strong> Wait for screen → Fill name → Sign → Deliver → DELY dialog → Confirm
          <br />
          <span className="text-emerald-500">AWAIT_BRIDGE::DELIVER_PARCEL</span>
        </div>
      </div>
    );
  }

  if (node.type === "WAIT") {
    const timeout = String(config.timeout ?? "5000");

    return (
      <div className="space-y-4">
        <FormField
          label="Wait Duration"
          required
          helperText="Maximum wait duration before the executor proceeds or fails"
          error={errors.timeout}
        >
          <div className="relative">
            <select
              className={cn(getFieldControlClassName(Boolean(errors.timeout)), "appearance-none pr-10")}
              value={timeout}
              onChange={(event) => onChange({ timeout: event.target.value })}
            >
              <option value="5000">5 seconds</option>
              <option value="10000">10 seconds</option>
              <option value="30000">30 seconds</option>
              <option value="60000">1 minute</option>
              <option value="120000">2 minutes</option>
              <option value="300000">5 minutes</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          </div>
        </FormField>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-500">
      No editable properties form is defined for this node type yet.
    </div>
  );
}

function FormField({
  label,
  required,
  helperText,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  helperText?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[12px] font-semibold text-slate-700">
        {label}
        {required ? <span className="ml-1 text-[11px] font-semibold text-orange-500">*</span> : null}
      </label>
      {children}
      {helperText ? <p className="mt-1.5 text-[12px] leading-[1.35] text-slate-500">{helperText}</p> : null}
      {error ? <p className="mt-1.5 text-[12px] font-medium leading-[1.35] text-rose-600">{error}</p> : null}
    </div>
  );
}

function ToggleField({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <div className="flex min-h-10 items-center rounded-[6px] border border-[#DDE5F0] bg-white px-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-all duration-200",
          checked ? "justify-end bg-orange-500 shadow-[0_6px_16px_rgba(249,115,22,0.22)]" : "justify-start bg-slate-300",
        )}
      >
        <span className="size-5 rounded-full bg-white shadow-sm" />
      </button>
      <span className="ml-3 text-[13px] font-medium text-slate-600">{checked ? "Enabled" : "Disabled"}</span>
    </div>
  );
}

function getFieldControlClassName(hasError = false) {
  return cn(
    "h-10 w-full rounded-[6px] border bg-white px-3 text-[14px] text-slate-900 transition-[border-color,box-shadow,background-color,color]",
    "border-[#DDE5F0] placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-4 focus:ring-orange-500/10",
    hasError && "border-rose-500 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10",
  );
}
