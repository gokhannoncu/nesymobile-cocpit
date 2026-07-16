"use client";

import { useMemo } from "react";
import { Label } from "@nesy/metronic/components/ui/label";
import { Input } from "@nesy/metronic/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nesy/metronic/components/ui/select";
import {
  getDefaultExwBillingOption,
  type NesyCountryCode,
  type ShipmentSettings,
  type ValidationError,
} from "@/lib/happy-path/shipment-group-settings";
import { OohPointPicker } from "./ooh-point-picker";

interface ShipmentSettingsPanelProps {
  contextId: string;
  includedTypeIds: Set<string>;
  country: NesyCountryCode;
  settings: ShipmentSettings;
  errors: ValidationError[];
  onChange: (settings: ShipmentSettings) => void;
}

function fieldError(errors: ValidationError[], field: string): string | undefined {
  return errors.find((e) => e.field === field && e.severity === "error")?.message;
}

export function ShipmentSettingsPanel({
  contextId,
  includedTypeIds,
  country,
  settings,
  errors,
  onChange,
}: ShipmentSettingsPanelProps) {
  const showMulticolli = useMemo(
    () =>
      contextId === "delivery" ||
      contextId === "mono-multicolli" ||
      contextId === "all",
    [contextId],
  );

  const showCod =
    contextId === "cod" ||
    contextId === "cod-delivery" ||
    (contextId === "all" && includedTypeIds.has("cod-delivery"));

  const showPickup =
    contextId === "pickup" ||
    ["remote-pickup", "pickup-at-customer"].includes(contextId) ||
    (contextId === "all" &&
      (includedTypeIds.has("remote-pickup") ||
        includedTypeIds.has("pickup-at-customer")));

  const showDeps =
    (contextId === "delivery" || contextId === "deps" || contextId === "all") &&
    (contextId === "deps" || contextId === "all"
      ? includedTypeIds.has("deps")
      : includedTypeIds.has("deps"));

  const showExw =
    contextId === "exw-delivery" ||
    (contextId === "delivery" && includedTypeIds.has("exw-delivery")) ||
    (contextId === "all" && includedTypeIds.has("exw-delivery"));

  const showDeliveryPick =
    contextId === "delivery-pick" ||
    (contextId === "return" && includedTypeIds.has("delivery-pick")) ||
    (contextId === "all" && includedTypeIds.has("delivery-pick"));

  const showRedLabel =
    contextId === "red-label" ||
    (contextId === "return" && includedTypeIds.has("red-label")) ||
    (contextId === "all" && includedTypeIds.has("red-label"));

  const showRdoc = contextId === "rdoc" || (contextId === "return" && includedTypeIds.has("rdoc"));
  const showDoco = contextId === "doco" || (contextId === "return" && includedTypeIds.has("doco"));

  const cod = "cod" in settings ? settings.cod : "codAmount" in settings ? settings : null;
  const multicolli = "multicolli" in settings ? settings.multicolli : undefined;
  const pickup = "pickUpDateOffsetDays" in settings ? settings : "pickup" in settings ? settings.pickup : null;
  const exw = "exw" in settings ? settings.exw : undefined;
  const deps = "deps" in settings ? settings.deps : undefined;

  return (
    <div className="space-y-5">
      {(contextId === "delivery" ||
        contextId === "standard-delivery" ||
        contextId === "all") && (
        <div className="space-y-2">
          <Label htmlFor="parcelCount">Parcel count</Label>
          <Input
            id="parcelCount"
            type="number"
            min={1}
            max={10}
            value={"parcelCount" in settings ? settings.parcelCount : 1}
            onChange={(e) =>
              onChange({
                ...settings,
                parcelCount: Number.parseInt(e.target.value, 10) || 1,
              } as ShipmentSettings)
            }
          />
        </div>
      )}

      {showCod && cod && (
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h4 className="text-sm font-semibold text-foreground">COD settings</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="codAmount">Amount</Label>
              <Input
                id="codAmount"
                type="number"
                min={0}
                step="0.01"
                value={"codAmount" in cod ? cod.codAmount : 10}
                onChange={(e) => {
                  const amount = Number.parseFloat(e.target.value) || 0;
                  if ("codAmount" in cod) {
                    onChange({ ...cod, codAmount: amount } as ShipmentSettings);
                  } else if ("cod" in settings) {
                    onChange({
                      ...settings,
                      cod: { ...settings.cod!, codAmount: amount },
                    } as ShipmentSettings);
                  }
                }}
              />
              {fieldError(errors, "codAmount") && (
                <p className="text-xs text-destructive">{fieldError(errors, "codAmount")}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select
                value={"codCurrency" in cod ? cod.codCurrency : country === "RS" ? "RSD" : "EUR"}
                onValueChange={(v) => {
                  const currency = v as "EUR" | "RSD";
                  if ("codAmount" in cod) {
                    onChange({ ...cod, codCurrency: currency } as ShipmentSettings);
                  } else if ("cod" in settings) {
                    onChange({
                      ...settings,
                      cod: { ...settings.cod!, codCurrency: currency },
                    } as ShipmentSettings);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="RSD">RSD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="iban">IBAN</Label>
              <Input
                id="iban"
                value={"iban" in cod ? cod.iban : ""}
                onChange={(e) => {
                  if ("codAmount" in cod) {
                    onChange({ ...cod, iban: e.target.value } as ShipmentSettings);
                  } else if ("cod" in settings) {
                    onChange({
                      ...settings,
                      cod: { ...settings.cod!, iban: e.target.value },
                    } as ShipmentSettings);
                  }
                }}
              />
              {fieldError(errors, "iban") && (
                <p className="text-xs text-destructive">{fieldError(errors, "iban")}</p>
              )}
            </div>
          </div>
        </section>
      )}

      {showMulticolli &&
        (contextId === "mono-multicolli" ||
          includedTypeIds.has("mono-multicolli")) && (
          <section className="space-y-3 rounded-lg border border-border p-4">
            <h4 className="text-sm font-semibold text-foreground">Multicolli</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Parcel count (2–10)</Label>
                <Input
                  type="number"
                  min={2}
                  max={10}
                  value={multicolli?.parcelCount ?? 3}
                  onChange={(e) => {
                    const parcelCount = Number.parseInt(e.target.value, 10) || 2;
                    const mc = {
                      parcelCount,
                      integrationCode1: multicolli?.integrationCode1 ?? "HAPPY-PATH-MC-001",
                      weight: multicolli?.weight ?? 1,
                    };
                    onChange({ ...settings, multicolli: mc } as ShipmentSettings);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Weight per parcel (kg)</Label>
                <Input
                  type="number"
                  min={1}
                  value={multicolli?.weight ?? 1}
                  onChange={(e) => {
                    const weight = Number.parseInt(e.target.value, 10) || 1;
                    onChange({
                      ...settings,
                      multicolli: {
                        parcelCount: multicolli?.parcelCount ?? 3,
                        integrationCode1:
                          multicolli?.integrationCode1 ?? "HAPPY-PATH-MC-001",
                        weight,
                      },
                    } as ShipmentSettings);
                  }}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Integration code 1</Label>
                <Input
                  value={multicolli?.integrationCode1 ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...settings,
                      multicolli: {
                        parcelCount: multicolli?.parcelCount ?? 3,
                        integrationCode1: e.target.value,
                        weight: multicolli?.weight ?? 1,
                      },
                    } as ShipmentSettings)
                  }
                />
              </div>
            </div>
          </section>
        )}

      {showExw && (
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h4 className="text-sm font-semibold text-foreground">EXW billing</h4>
          <p className="text-xs text-muted-foreground">
            {country === "RS"
              ? "Default: EXWORKS in cash (mobile Cash events)."
              : "EXW delivery is only available for RS."}
          </p>
          <Select
            value={exw?.billingOption ?? getDefaultExwBillingOption(country)}
            onValueChange={(v) =>
              onChange({
                ...settings,
                exw: { billingOption: v as "EXWORKS on invoice" | "EXWORKS in cash" },
              } as ShipmentSettings)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EXWORKS on invoice">EXWORKS on invoice</SelectItem>
              <SelectItem value="EXWORKS in cash">EXWORKS in cash</SelectItem>
            </SelectContent>
          </Select>
        </section>
      )}

      {showDeps && (
        <OohPointPicker
          label="Parcel Shop (DEPS)"
          value={deps}
          oohKind="parcelshop"
          onChange={(selection) =>
            onChange({ ...settings, deps: selection } as ShipmentSettings)
          }
          error={fieldError(errors, "deps.oohPoint")}
        />
      )}

      {showPickup && pickup && (
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h4 className="text-sm font-semibold text-foreground">Pickup settings</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Pickup date offset (days)</Label>
              <Input
                type="number"
                min={0}
                value={
                  "pickUpDateOffsetDays" in pickup ? pickup.pickUpDateOffsetDays : 3
                }
                onChange={(e) => {
                  const days = Number.parseInt(e.target.value, 10) || 0;
                  if ("pickUpDateOffsetDays" in pickup) {
                    onChange({ ...pickup, pickUpDateOffsetDays: days } as ShipmentSettings);
                  } else if ("pickup" in settings && settings.pickup) {
                    onChange({
                      ...settings,
                      pickup: { ...settings.pickup, pickUpDateOffsetDays: days },
                    } as ShipmentSettings);
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>End time</Label>
              <Input
                type="time"
                value={"pickupEndTime" in pickup ? pickup.pickupEndTime : "21:00"}
                onChange={(e) => {
                  if ("pickUpDateOffsetDays" in pickup) {
                    onChange({ ...pickup, pickupEndTime: e.target.value } as ShipmentSettings);
                  } else if ("pickup" in settings && settings.pickup) {
                    onChange({
                      ...settings,
                      pickup: { ...settings.pickup, pickupEndTime: e.target.value },
                    } as ShipmentSettings);
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Parcel weight (kg)</Label>
              <Input
                type="number"
                min={1}
                value={"parcelWeight" in pickup ? pickup.parcelWeight : 5}
                onChange={(e) => {
                  const w = Number.parseInt(e.target.value, 10) || 5;
                  if ("pickUpDateOffsetDays" in pickup) {
                    onChange({ ...pickup, parcelWeight: w } as ShipmentSettings);
                  } else if ("pickup" in settings && settings.pickup) {
                    onChange({
                      ...settings,
                      pickup: { ...settings.pickup, parcelWeight: w },
                    } as ShipmentSettings);
                  }
                }}
              />
            </div>
          </div>
          {contextId === "remote-pickup" && (
            <p className="text-xs text-muted-foreground">
              Remote pickup: display label cannot be generated in Nesy.
            </p>
          )}
          {contextId === "pickup-at-customer" && (
            <p className="text-xs text-muted-foreground">
              PAC: pickup at customer address with special assignment rules.
            </p>
          )}
        </section>
      )}

      {showDeliveryPick && (
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h4 className="text-sm font-semibold text-foreground">Delivery &amp; Pick</h4>
          <div className="space-y-1.5">
            <Label>Receiver name</Label>
            <Input
              value={
                "receiverName" in settings ? (settings.receiverName ?? "") : ""
              }
              onChange={(e) =>
                onChange({ ...settings, receiverName: e.target.value } as ShipmentSettings)
              }
            />
            {fieldError(errors, "receiverName") && (
              <p className="text-xs text-destructive">{fieldError(errors, "receiverName")}</p>
            )}
          </div>
        </section>
      )}

      {showRedLabel && (
        <section className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
          <h4 className="text-sm font-semibold text-amber-800">Red Label</h4>
          <p className="mt-1 text-xs leading-relaxed text-amber-700">
            Red Label shipments are created during hub unload via the no-data flow.
            This type will be skipped during generation.
          </p>
        </section>
      )}

      {(showRdoc || showDoco) && (
        <section className="space-y-2 rounded-lg border border-border bg-muted/20 p-4">
          {showRdoc && (
            <p className="text-xs text-muted-foreground">
              <strong>RDOC:</strong> Return document shipment — documents returned to
              shipper.
            </p>
          )}
          {showDoco && (
            <p className="text-xs text-muted-foreground">
              <strong>DOCO:</strong> Document collection during standard delivery.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
