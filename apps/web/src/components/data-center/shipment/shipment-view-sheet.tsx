"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Box,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Euro,
  ExternalLink,
  History,
  Loader2,
  MapPin,
  Package,
  Printer,
  Truck,
  UserRound,
  WalletCards,
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
import {
  extractNesyShipmentId,
  mapShipmentDetailView,
  type ShipmentDetailView,
} from "@/lib/nesy-shipment-detail";
import { cn } from "@nesy/metronic/lib/utils";
import { getCustomerDetails } from "@/services/customer";
import {
  getShipmentDetails,
  getShipmentDisplayLabel,
  getShipmentEvents,
  getShipmentNesyUrl,
  getShipmentPricing,
  type ShipmentRecord,
} from "@/services/shipment";
import { ShipmentHistoryDialog } from "./shipment-history-dialog";

const TABS = ["Overview", "Parcels", "Pricing & Services", "Events"] as const;
type DetailTab = (typeof TABS)[number];

const FULLSCREEN_DIALOG_CLASS =
  "!inset-0 flex h-dvh max-h-dvh w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:rounded-none";

function base64ToPdfObjectUrl(base64: string): string {
  const byteCharacters = atob(base64);
  const byteArrays: BlobPart[] = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Uint8Array(slice.length);
    for (let i = 0; i < slice.length; i += 1) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(byteNumbers);
  }
  return URL.createObjectURL(new Blob(byteArrays, { type: "application/pdf" }));
}

function ShimmerBlock({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block animate-[shimmer_1.45s_linear_infinite] rounded-md bg-[linear-gradient(110deg,var(--muted)_8%,var(--background)_18%,var(--muted)_33%)] bg-[length:200%_100%]",
        className,
      )}
    />
  );
}

function ShipmentDetailShimmer({ onClose }: { onClose: () => void }) {
  return (
    <>
      <DialogHeader className="mb-0 shrink-0 border-b px-5 py-5">
        <DialogTitle className="sr-only">Loading shipment details</DialogTitle>
        <div className="flex items-center justify-between gap-5">
          <div className="flex min-w-0 flex-1 items-center gap-5">
            <ShimmerBlock className="size-14 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-3">
              <ShimmerBlock className="h-5 w-36" />
              <ShimmerBlock className="h-9 w-72 max-w-full" />
              <ShimmerBlock className="h-4 w-48" />
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 rounded-full bg-muted text-muted-foreground hover:bg-muted/70"
            aria-label="Close shipment details"
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <ShimmerBlock key={index} className="h-10 w-28" />
          ))}
        </div>
      </DialogHeader>

      <DialogBody
        className="min-h-0 flex-1 overflow-y-auto bg-background px-5 py-5"
        aria-busy="true"
        aria-label="Loading shipment details"
      >
        <div className="space-y-5">
          <div className="grid overflow-hidden rounded-lg border lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4 border-e px-5 py-4 last:border-e-0">
                <ShimmerBlock className="size-10 shrink-0 rounded-md" />
                <div className="min-w-0 flex-1 space-y-2">
                  <ShimmerBlock className="h-3 w-20" />
                  <ShimmerBlock className="h-5 w-16" />
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
            <div className="overflow-hidden rounded-lg border">
              <div className="flex h-12 items-end border-b px-2">
                {TABS.map((tab) => (
                  <div key={tab} className="px-5 py-3">
                    <ShimmerBlock className="h-4 w-20" />
                  </div>
                ))}
              </div>
              <div className="space-y-4 p-4">
                <div className="grid gap-4 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <ShimmerBlock className="size-10 rounded-md" />
                        <ShimmerBlock className="h-5 w-24" />
                      </div>
                      {Array.from({ length: 6 }).map((__, row) => (
                        <div key={row} className="space-y-2">
                          <ShimmerBlock className="h-3 w-28" />
                          <ShimmerBlock className="h-4 w-full" />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="overflow-hidden rounded-lg border p-4">
                  <ShimmerBlock className="mb-4 h-5 w-32" />
                  {Array.from({ length: 3 }).map((_, index) => (
                    <ShimmerBlock key={index} className="mb-2 h-10 w-full" />
                  ))}
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="space-y-3 rounded-lg border p-5">
                <ShimmerBlock className="h-5 w-40" />
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="grid grid-cols-2 gap-4">
                    <ShimmerBlock className="h-4 w-full" />
                    <ShimmerBlock className="h-4 w-full" />
                  </div>
                ))}
              </div>
              <div className="space-y-3 rounded-lg border p-5">
                <ShimmerBlock className="h-5 w-32" />
                {Array.from({ length: 4 }).map((_, index) => (
                  <ShimmerBlock key={index} className="h-8 w-full" />
                ))}
              </div>
            </aside>
          </div>
        </div>
      </DialogBody>

      <DialogFooter className="shrink-0 border-t px-5 py-4">
        <div className="flex w-full justify-end gap-3">
          <ShimmerBlock className="h-10 w-40" />
          <ShimmerBlock className="h-10 w-24" />
          <ShimmerBlock className="h-10 w-24" />
        </div>
      </DialogFooter>
    </>
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

const SERVICE_BADGE_STYLES = [
  "bg-blue-100 text-blue-800",
  "bg-emerald-100 text-emerald-800",
  "bg-amber-100 text-amber-900",
  "bg-violet-100 text-violet-800",
  "bg-rose-100 text-rose-800",
  "bg-cyan-100 text-cyan-800",
  "bg-orange-100 text-orange-800",
  "bg-indigo-100 text-indigo-800",
  "bg-fuchsia-100 text-fuchsia-800",
  "bg-lime-100 text-lime-900",
] as const;

function ProductAndServicesGrid({
  services,
}: {
  services: ShipmentDetailView["services"];
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-sm font-semibold text-foreground">
        Product and Services: {services.length}
      </p>
      {services.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {services.map((service, index) => (
            <span
              key={`${service.legacySystemServiceId}-${service.name}-${index}`}
              className={cn(
                "inline-flex items-center rounded-[8px] px-3 py-1.5 text-sm font-semibold",
                SERVICE_BADGE_STYLES[index % SERVICE_BADGE_STYLES.length],
              )}
            >
              {service.name}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">—</p>
      )}
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

function EventItem({
  label,
  date,
  description,
  done,
  last,
  showDate = true,
}: {
  label: string;
  date: string;
  description?: string;
  done?: boolean;
  last?: boolean;
  showDate?: boolean;
}) {
  return (
    <div className={cn("grid gap-3 text-sm", showDate ? "grid-cols-[24px_1fr_auto]" : "grid-cols-[24px_1fr]")}>
      <div className="flex flex-col items-center">
        {done ? (
          <span className="flex size-5 items-center justify-center rounded-full bg-foreground text-background">
            <Check className="size-3" />
          </span>
        ) : (
          <Circle className="size-5 text-muted-foreground" />
        )}
        {!last && <span className="mt-1 h-6 border-s border-dashed border-muted-foreground" />}
      </div>
      <div>
        <span className={cn("text-muted-foreground", done && "font-medium text-foreground")}>
          {label}
        </span>
        {description && description !== "—" && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {showDate && <span className="shrink-0 text-muted-foreground">{date}</span>}
    </div>
  );
}

function ParcelTable({
  parcels,
  showWeight = false,
}: {
  parcels: ShipmentDetailView["parcels"];
  showWeight?: boolean;
}) {
  if (parcels.length === 0) {
    return <p className="p-4 text-sm text-muted-foreground">No parcels found.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-muted/40 text-left text-muted-foreground">
          <tr>
            <th className="px-5 py-3 font-semibold">Parcel</th>
            <th className="px-5 py-3 font-semibold">Barcode</th>
            <th className="px-5 py-3 font-semibold">Legacy Cargo Id</th>
            {showWeight && <th className="px-5 py-3 font-semibold">Weight</th>}
            <th className="px-5 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {parcels.map((parcel) => (
            <tr key={`${parcel.barcode}-${parcel.index}`} className="border-t">
              <td className="px-5 py-4">{parcel.index}</td>
              <td className="max-w-[360px] break-all px-5 py-4">
                <span>{parcel.barcode}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="ms-2 size-6 align-middle"
                  aria-label="Copy barcode"
                  onClick={() => void navigator.clipboard.writeText(parcel.barcode)}
                >
                  <Copy className="size-3.5" />
                </Button>
              </td>
              <td className="break-all px-5 py-4">{parcel.legacyCargoId}</td>
              {showWeight && <td className="px-5 py-4">{parcel.weight}</td>}
              <td className="px-5 py-4">
                <Badge variant="success" appearance="light">
                  {parcel.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ShipmentViewSheet({
  open,
  onOpenChange,
  shipment,
  token,
  country,
  environment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipment: ShipmentRecord | null;
  token: string | null;
  country: string;
  environment: string;
}) {
  const [activeTab, setActiveTab] = useState<DetailTab>("Overview");
  const [detail, setDetail] = useState<ShipmentDetailView | null>(null);
  const [eventsRaw, setEventsRaw] = useState<Record<string, unknown> | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [openingNesy, setOpeningNesy] = useState(false);
  const [printingLabel, setPrintingLabel] = useState(false);
  const [usingCache, setUsingCache] = useState(false);

  const handleManageShipment = useCallback(async () => {
    if (!shipment) return;

    setOpeningNesy(true);
    setActionError(null);
    const nesyWindow = window.open("about:blank", "_blank");

    try {
      const url = await getShipmentNesyUrl(shipment.id);
      if (nesyWindow) {
        nesyWindow.opener = null;
        nesyWindow.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      nesyWindow?.close();
      setActionError(
        error instanceof Error ? error.message : "Could not open shipment in Nesy.",
      );
    } finally {
      setOpeningNesy(false);
    }
  }, [shipment]);

  const handlePrintLabel = useCallback(async () => {
    if (!shipment) return;
    if (!token) {
      setActionError("Connect to Nesy before printing the label.");
      return;
    }

    setPrintingLabel(true);
    setActionError(null);
    const labelWindow = window.open(
      "about:blank",
      "pdfLabel",
      "width=900,height=700,menubar=no,toolbar=no,location=no,scrollbars=yes,resizable=yes",
    );

    try {
      const { content } = await getShipmentDisplayLabel({
        shipmentDbId: shipment.id,
        token,
        country: shipment.country ?? country,
        environment: shipment.environment ?? environment,
      });
      const url = base64ToPdfObjectUrl(content);
      if (labelWindow) {
        labelWindow.opener = null;
        labelWindow.onload = () => labelWindow.print();
        labelWindow.location.href = url;
      } else {
        window.open(url, "pdfLabel", "noopener,noreferrer,width=900,height=700");
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      labelWindow?.close();
      setActionError(
        error instanceof Error ? error.message : "Could not print shipment label.",
      );
    } finally {
      setPrintingLabel(false);
    }
  }, [shipment, token, country, environment]);

  useEffect(() => {
    if (!open) {
      setActiveTab("Overview");
      setDetail(null);
      setEventsRaw(null);
      setHistoryOpen(false);
      setLoading(false);
      setLoadError(null);
      setActionError(null);
      setOpeningNesy(false);
      setPrintingLabel(false);
      setUsingCache(false);
      return;
    }

    if (!shipment) return;

    const cached = shipment.data as Record<string, unknown>;
    const nesyId = extractNesyShipmentId(cached);

    if (!token || !nesyId) {
      setDetail(
        mapShipmentDetailView({
          search: cached,
          unloadStatus: shipment.unloadStatus,
          createdAt: shipment.createdAt,
        }),
      );
      setUsingCache(true);
      setLoadError(token ? null : "Connect to Nesy to load live shipment details.");
      return;
    }

    let cancelled = false;
    setDetail(null);
    setLoading(true);
    setLoadError(null);
    setUsingCache(false);

    const scope = { token, country, environment, shipmentId: nesyId };

    void (async () => {
      try {
        const [searchResult, pricingResult, eventsResult] = await Promise.all([
          getShipmentDetails(scope),
          getShipmentPricing(scope).catch(() => null),
          getShipmentEvents(scope).catch(() => null),
        ]);

        const search = searchResult as Record<string, unknown>;
        const customer = (search.customer ?? search.Customer) as
          | Record<string, unknown>
          | undefined;

        let customerDetails: unknown = null;
        const customerId = customer?.customerId ?? customer?.CustomerId;
        const customerCenter = customer?.customerCenter ?? customer?.CustomerCenter ?? "1";

        if (customerId != null) {
          try {
            customerDetails = await getCustomerDetails({
              token,
              country,
              environment,
              customerId: String(customerId),
              customerCenter: String(customerCenter),
            });
          } catch {
            /* optional enrichment */
          }
        }

        if (cancelled) return;

        setEventsRaw(eventsResult);
        setDetail(
          mapShipmentDetailView({
            search,
            pricing: pricingResult,
            events: eventsResult,
            customerDetails,
            unloadStatus: shipment.unloadStatus,
            createdAt: shipment.createdAt,
          }),
        );
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Failed to load shipment details.");
        setDetail(
          mapShipmentDetailView({
            search: cached,
            unloadStatus: shipment.unloadStatus,
            createdAt: shipment.createdAt,
          }),
        );
        setUsingCache(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, shipment, token, country, environment]);

  if (!open || !shipment) return null;

  const showShimmer = loading || !detail;

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="fullscreen"
        showCloseButton={false}
        className={FULLSCREEN_DIALOG_CLASS}
      >
        {showShimmer ? (
          <ShipmentDetailShimmer onClose={() => onOpenChange(false)} />
        ) : (
          <>
        <DialogHeader className="mb-0 shrink-0 border-b px-5 py-5">
          <div className="flex items-center justify-between gap-5">
            <div className="flex min-w-0 items-center gap-5">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-lg border-2 border-nesy bg-nesy-soft text-nesy">
                <Box className="size-8" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="text-sm font-medium text-muted-foreground">Shipment Details</DialogTitle>
                <div className="mt-0.5 break-all text-base font-semibold tracking-normal text-foreground">
                  {detail.shipmentId}
                </div>
                {(loadError || actionError || usingCache) && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    {loadError && <span className="text-amber-600">{loadError}</span>}
                    {actionError && !loadError && (
                      <span className="text-amber-600">{actionError}</span>
                    )}
                    {usingCache && !loadError && !actionError && (
                      <span>Showing cached snapshot.</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 rounded-full bg-muted text-muted-foreground hover:bg-muted/70"
              aria-label="Close shipment details"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        <DialogBody className="min-h-0 flex-1 overflow-y-auto bg-background px-5 py-5">
          <div className="space-y-5">
            <div className="grid overflow-hidden rounded-lg border bg-background lg:grid-cols-6">
              <Metric icon={<Box className="size-9" />} label="Shipment Type" value={detail.shipmentType} />
              <Metric icon={<Package className="size-9" />} label="Parcel Count" value={detail.parcelCount} />
              <Metric icon={<Euro className="size-9" />} label="Total Cost" value={detail.totalCost} />
              <Metric icon={<WalletCards className="size-9" />} label="COD" value={detail.codAmount} />
              <Metric icon={<MapPin className="size-9" />} label="Delivery Code" value={detail.deliveryCode} />
              <Metric icon={<CheckCircle2 className="size-9 text-emerald-600" />} label="Last Status" value={detail.lastStatus} />
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
                  <div className="ml-auto flex items-center pb-1.5 pe-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-2"
                      onClick={() => setHistoryOpen(true)}
                    >
                      <History className="size-4" />
                      History
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 p-4">
                  {activeTab === "Overview" && (
                    <>
                      <div className="grid gap-4 lg:grid-cols-3">
                        <PartyCard icon={<UserRound className="size-6" />} title="Customer">
                          <Field label="Id" value={detail.customer.id} />
                          <Field label="Customer Name-Surname" value={detail.customer.name} />
                          <Field label="Address" value={detail.customer.address} />
                          <Field label="Phone" value={detail.customer.phone} />
                          <Field label="E-Mail" value={detail.customer.email} />
                          <Field label="Billing Option" value={detail.customer.billingOption} />
                          <Field label="Payer" value={detail.customer.payer} />
                        </PartyCard>

                        <PartyCard icon={<Truck className="size-6" />} title="Shipper">
                          <Field label="Shipper Name-Surname" value={detail.shipper.name} />
                          <Field label="Origin Center" value={detail.shipper.originCenter} />
                          <Field label="Address" value={detail.shipper.address} />
                          <Field label="Planned Pickup Date" value={detail.shipper.plannedPickupDate} />
                          <Field label="Actual Pickup Date" value={detail.shipper.actualPickupDate} />
                          <Field label="Phone / GSM" value={detail.shipper.phone} />
                          <Field label="Counter Location Type" value={detail.shipper.counterLocationType} />
                        </PartyCard>

                        <PartyCard icon={<UserRound className="size-6" />} title="Consignee">
                          <Field label="Consignee Name-Surname" value={detail.consignee.name} />
                          <Field label="Destination Center" value={detail.consignee.destinationCenter} />
                          <Field label="Address" value={detail.consignee.address} />
                          <Field label="Declared Delivery Date" value={detail.consignee.declaredDeliveryDate} />
                          <Field label="Planned Delivery Date" value={detail.consignee.plannedDeliveryDate} />
                          <Field label="Actual Delivery Date" value={detail.consignee.actualDeliveryDate} />
                          <Field label="Phone / GSM" value={detail.consignee.phone} />
                          <Field label="Counter Location Type" value={detail.consignee.counterLocationType} />
                        </PartyCard>
                      </div>

                      <div className="overflow-hidden rounded-lg border">
                        <div className="border-b px-4 py-3 text-base font-semibold">Parcel Details</div>
                        <ParcelTable parcels={detail.parcels} />
                      </div>
                    </>
                  )}

                  {activeTab === "Parcels" && (
                    <div className="overflow-hidden rounded-lg border">
                      <div className="border-b px-4 py-3 text-base font-semibold">All Parcels</div>
                      <ParcelTable parcels={detail.parcels} showWeight />
                    </div>
                  )}

                  {activeTab === "Pricing & Services" && (
                    <div className="space-y-4">
                      <div className="overflow-hidden rounded-lg border">
                        <div className="border-b px-4 py-3 text-base font-semibold">Pricing Breakdown</div>
                        {detail.pricingLines.length > 0 ? (
                          <table className="w-full text-sm">
                            <tbody>
                              {detail.pricingLines.map((line, index) => (
                                <tr key={`pricing-line-${index}`} className="border-t">
                                  <td className="px-5 py-3 font-medium">{line.label}</td>
                                  <td className="px-5 py-3 text-end text-muted-foreground">{line.amount}</td>
                                </tr>
                              ))}
                              <tr className="border-t bg-muted/20">
                                <td className="px-5 py-3 font-semibold">Total Cost</td>
                                <td className="px-5 py-3 text-end font-semibold text-nesy">{detail.totalCost}</td>
                              </tr>
                            </tbody>
                          </table>
                        ) : (
                          <p className="p-4 text-sm text-muted-foreground">No pricing breakdown available.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {activeTab === "Events" && (
                    <div className="rounded-lg border p-4">
                      <h4 className="mb-4 text-base font-semibold">Event Timeline</h4>
                      {detail.events.length > 0 ? (
                        <div className="space-y-1">
                          {detail.events.map((event, index) => (
                            <EventItem
                              key={`${event.label}-${event.date}-${index}`}
                              label={event.label}
                              date={event.date}
                              description={event.description}
                              done
                              last={index === detail.events.length - 1}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No events found for this shipment.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <aside className="space-y-4">
                <section className="rounded-lg border bg-background p-5">
                  <h3 className="mb-5 text-base font-semibold">Shipment Summary</h3>
                  <dl className="space-y-3">
                    <SummaryRow label="Nesy Shipment Id" value={detail.shipmentId} />
                    <SummaryRow label="Shipment Type" value={detail.shipmentType} />
                    <SummaryRow label="Legacy System Cargo Id" value={detail.legacyCargoId} />
                    <SummaryRow label="Channel / Source" value={detail.channel} />
                    <SummaryRow label="International" value={detail.international} />
                    <SummaryRow label="Pricing Unit" value={detail.pricingUnit} />
                  </dl>
                  <div className="my-4 border-t" />
                  <dl className="space-y-3">
                    <SummaryRow label="Freight Cost" value={detail.freightCost} />
                    <SummaryRow label="Total Cost" value={detail.totalCost} highlight />
                  </dl>
                  <div className="my-4 border-t" />
                  <dl className="space-y-3">
                    <SummaryRow label="Actual Total Weight" value={detail.actualTotalWeight} />
                    <SummaryRow label="Declared Total Weight" value={detail.declaredTotalWeight} />
                    <SummaryRow label="Last Measured Total Weight" value={detail.lastMeasuredTotalWeight} />
                  </dl>
                </section>

                <ProductAndServicesGrid services={detail.services} />
              </aside>
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="shrink-0 border-t px-5 py-4">
          <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="nesy"
              className="px-9"
              size="lg"
              disabled={!shipment || openingNesy}
              onClick={() => void handleManageShipment()}
            >
              Manage Shipment
              {openingNesy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ExternalLink className="size-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="px-10"
              disabled={!shipment || !token || printingLabel}
              onClick={() => void handlePrintLabel()}
            >
              {printingLabel ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Printer className="size-4" />
              )}
              Print
            </Button>
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
          </>
        )}
      </DialogContent>
    </Dialog>

    <ShipmentHistoryDialog
      open={historyOpen}
      onOpenChange={setHistoryOpen}
      shipmentId={detail?.shipmentId ?? extractNesyShipmentId(shipment.data as Record<string, unknown>)}
      eventsRaw={eventsRaw}
      parcels={detail?.parcels ?? []}
    />
    </>
  );
}
