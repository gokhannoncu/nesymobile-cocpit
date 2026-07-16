"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Calendar,
  CheckCircle2,
  Copy,
  MapPin,
  Package,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { Badge } from "@nesy/metronic/components/ui/badge";
import { Button } from "@nesy/metronic/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@nesy/metronic/components/ui/dialog";
import { cn } from "@nesy/metronic/lib/utils";
import type { PickupRecord } from "@/services/pickup";

const TABS = ["Overview", "Parcels"] as const;
type PickupDetailTab = (typeof TABS)[number];

const FULLSCREEN_DIALOG_CLASS =
  "!inset-0 flex h-dvh max-h-dvh w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:rounded-none";

function getValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return "-";
}

function getParcels(data: Record<string, unknown>) {
  const parcels = data.parcels;
  return Array.isArray(parcels) ? parcels : [];
}

function formatAssignStatus(status: string) {
  switch (status) {
    case "TaskNotFound":
      return "Task Not Found";
    case "AssignFailed":
      return "Assign Failed";
    case "PickupListFailed":
      return "List Failed";
    case "NoSchedule":
      return "No Schedule";
    case "UpdatePickupFailed":
      return "Update Failed";
    default:
      return status;
  }
}

function AssignStatusBadge({ status }: { status: string }) {
  const variant =
    status === "Assigned"
      ? "success"
      : status === "Pending"
        ? "secondary"
        : "destructive";

  return (
    <Badge variant={variant} appearance="light">
      {formatAssignStatus(status)}
    </Badge>
  );
}

function SummaryRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_1fr] gap-4 text-sm">
      <dt className="font-semibold text-foreground">{label}:</dt>
      <dd className={cn("text-muted-foreground", highlight && "font-semibold text-nesy")}>
        {value}
      </dd>
    </div>
  );
}

function PartyCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-md border border-nesy/30 bg-nesy-soft text-nesy">
          {icon}
        </span>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </div>
      <div className="space-y-3 text-sm">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="font-semibold text-foreground">{label}:</div>
      <div className="whitespace-pre-line break-words text-muted-foreground">{value}</div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-4 border-e px-5 py-4 last:border-e-0">
      <span className="flex size-10 shrink-0 items-center justify-center text-nesy">{icon}</span>
      <div className="min-w-0">
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="truncate text-base font-semibold text-foreground">{value}</div>
      </div>
    </div>
  );
}

function PickupParcelTable({
  parcels,
}: {
  parcels: Array<Record<string, unknown>>;
}) {
  if (parcels.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No parcel information available.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-muted/40 text-left text-muted-foreground">
          <tr>
            <th className="px-5 py-3 font-semibold">#</th>
            <th className="px-5 py-3 font-semibold">Barcode</th>
            <th className="px-5 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {parcels.map((parcel, index) => {
            const barcode = getValue(parcel.barcode);
            return (
              <tr key={`${barcode}-${index}`} className="border-t">
                <td className="px-5 py-4">{index + 1}</td>
                <td className="max-w-[360px] break-all px-5 py-4">
                  <span>{barcode}</span>
                  {barcode !== "-" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="ms-2 size-6 align-middle"
                      aria-label="Copy barcode"
                      onClick={() => void navigator.clipboard.writeText(barcode)}
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  )}
                </td>
                <td className="px-5 py-4">
                  <Badge variant="success" appearance="light">
                    {getValue(parcel.status)}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PickupViewDialog({
  open,
  onOpenChange,
  pickup,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickup: PickupRecord | null;
}) {
  const [activeTab, setActiveTab] = useState<PickupDetailTab>("Overview");

  const data = (pickup?.data ?? {}) as Record<string, unknown>;
  const shipper = data.shipper as Record<string, unknown> | undefined;
  const consignee = data.consignee as Record<string, unknown> | undefined;
  const declaredPickupInfo = data.declaredPickupInfo as Record<string, unknown> | undefined;

  const parcels = useMemo(() => getParcels(data) as Array<Record<string, unknown>>, [data]);
  const assignStatus = pickup?.assignStatus ?? "Pending";
  const pickupTypeLabel =
    pickup?.pickupType === "remote" ? "Remote Pickup" : "Pickup At Customer";

  const plannedPickupDate =
    declaredPickupInfo?.pickupFromDate != null
      ? new Date(declaredPickupInfo.pickupFromDate as string).toLocaleString("tr-TR")
      : getValue(data.declaredPickupDate);

  const pickupTimeWindow = declaredPickupInfo
    ? `${getValue(declaredPickupInfo.pickupFromTime)} - ${getValue(declaredPickupInfo.pickupToTime)}`
    : "-";

  const shipperName = getValue(data.shipperName ?? shipper?.name);
  const consigneeName = getValue(data.consigneeName ?? consignee?.name);
  const shipperAddress = getValue(
    shipper?.address ?? shipper?.Address ?? data.shipperAddress,
  );
  const consigneeAddress = getValue(
    consignee?.address ?? consignee?.Address ?? data.consigneeAddress,
  );

  if (!open || !pickup) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="fullscreen"
        showCloseButton={false}
        className={FULLSCREEN_DIALOG_CLASS}
      >
        <DialogHeader className="mb-0 shrink-0 border-b px-5 py-5">
          <div className="flex items-center justify-between gap-5">
            <div className="flex min-w-0 items-center gap-5">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border-2 border-nesy bg-nesy-soft text-nesy">
                <Calendar className="size-8" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-medium text-muted-foreground">
                  Pickup Details
                </DialogTitle>
                <div className="mt-0.5 break-all text-base font-semibold tracking-normal text-foreground">
                  {pickup.shipmentId}
                </div>
                <div className="mt-2">
                  <AssignStatusBadge status={assignStatus} />
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 rounded-full bg-muted text-muted-foreground hover:bg-muted/70"
              aria-label="Close pickup details"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        <DialogBody className="min-h-0 flex-1 overflow-y-auto bg-background px-5 py-5">
          <div className="space-y-5">
            <div className="grid overflow-hidden rounded-lg border bg-background lg:grid-cols-6">
              <Metric icon={<Truck className="size-9" />} label="Pickup Type" value={pickupTypeLabel} />
              <Metric
                icon={<CheckCircle2 className="size-9 text-emerald-600" />}
                label="Assign Status"
                value={formatAssignStatus(assignStatus)}
              />
              <Metric icon={<Package className="size-9" />} label="Parcel Count" value={String(parcels.length)} />
              <Metric icon={<MapPin className="size-9" />} label="Task Id" value={getValue(pickup.taskId)} />
              <Metric icon={<MapPin className="size-9" />} label="Branch Id" value={getValue(pickup.branchId)} />
              <Metric
                icon={<Calendar className="size-9" />}
                label="Courier Zone"
                value={getValue(pickup.courierZoneCode)}
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
              <div className="overflow-hidden rounded-lg border bg-background">
                <div className="flex h-12 items-end border-b px-2">
                  {TABS.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "h-full px-5 text-sm font-semibold text-muted-foreground",
                        activeTab === tab && "border-b-2 border-nesy text-nesy",
                      )}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="space-y-4 p-4">
                  {activeTab === "Overview" && (
                    <>
                      <div className="grid gap-4 lg:grid-cols-3">
                        <PartyCard icon={<Truck className="size-6" />} title="Shipper">
                          <Field label="Shipper Name-Surname" value={shipperName} />
                          <Field label="Address" value={shipperAddress} />
                        </PartyCard>

                        <PartyCard icon={<UserRound className="size-6" />} title="Consignee">
                          <Field label="Consignee Name-Surname" value={consigneeName} />
                          <Field label="Address" value={consigneeAddress} />
                        </PartyCard>

                        <PartyCard icon={<Calendar className="size-6" />} title="Pickup Schedule">
                          <Field label="Planned Pickup Date" value={plannedPickupDate} />
                          <Field label="Pickup Time" value={pickupTimeWindow} />
                        </PartyCard>
                      </div>

                      <div className="overflow-hidden rounded-lg border">
                        <div className="border-b px-4 py-3 text-base font-semibold">Parcel Details</div>
                        <PickupParcelTable parcels={parcels} />
                      </div>
                    </>
                  )}

                  {activeTab === "Parcels" && (
                    <div className="overflow-hidden rounded-lg border">
                      <div className="border-b px-4 py-3 text-base font-semibold">All Parcels</div>
                      <PickupParcelTable parcels={parcels} />
                    </div>
                  )}
                </div>
              </div>

              <aside className="space-y-4">
                <section className="rounded-lg border bg-background p-5">
                  <h3 className="mb-5 text-base font-semibold">Pickup Summary</h3>
                  <dl className="space-y-3">
                    <SummaryRow label="Shipment Id" value={pickup.shipmentId} highlight />
                    <SummaryRow label="Pickup Type" value={pickupTypeLabel} />
                    <SummaryRow label="Assign Status" value={formatAssignStatus(assignStatus)} />
                    <SummaryRow label="Task Id" value={getValue(pickup.taskId)} />
                    <SummaryRow label="Branch Id" value={getValue(pickup.branchId)} />
                    <SummaryRow label="Courier Zone Code" value={getValue(pickup.courierZoneCode)} />
                  </dl>
                  <div className="my-4 border-t" />
                  <dl className="space-y-3">
                    <SummaryRow label="Planned Pickup Date" value={plannedPickupDate} />
                    <SummaryRow label="Pickup Time" value={pickupTimeWindow} />
                    <SummaryRow
                      label="Created At"
                      value={
                        pickup.createdAt
                          ? new Date(pickup.createdAt).toLocaleString("tr-TR")
                          : "-"
                      }
                    />
                  </dl>
                </section>
              </aside>
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="shrink-0 border-t px-5 py-4">
          <div className="flex w-full justify-end">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="px-12"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
