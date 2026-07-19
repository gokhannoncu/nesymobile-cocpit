// @ts-nocheck
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import {
  Building2,
  Check,
  CircleCheck,
  DollarSign,
  Loader2,
  Minus,
  Package,
  Plus,
  RefreshCcw,
  Search,
} from "lucide-react";
import { Button } from "@nesy/metronic/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@nesy/metronic/components/ui/dialog";
import { Input } from "@nesy/metronic/components/ui/input";
import { Label } from "@nesy/metronic/components/ui/label";
import { Switch, SwitchWrapper } from "@nesy/metronic/components/ui/switch";
import { useNesyAuth } from "@/contexts/nesy-auth-context";
import {
  buildInitialPartySelection,
  buildPartiesFromDetails,
  isPartySectionFilled,
  isPartySelectionValid,
  mapNesyCustomerDetails,
  type NormalizedCustomerDetails,
} from "@/lib/nesy-customer-details";
import {
  buildSearchParams,
  extractSearchRows,
  pickRowCenter,
  pickRowId,
  pickRowIdString,
  rowDisplayCity,
  rowDisplayName,
} from "@/lib/customer-search-helpers";
import { mapNesyDetailsToBffPayload } from "@/lib/nesy-customer-mapper";
import type { ShipmentPartySelection } from "@/lib/nesy-shipment-parties";
import { cn } from "@nesy/metronic/lib/utils";
import { buildPartiesWithDistinctConsignee } from "@/lib/multi-stop-addresses";
import { ShipmentAddressSection } from "./address-selection/shipment-address-section";
import {
  getCustomerDetails,
  searchCustomers,
  type BffCustomerPayload,
} from "@/services/customer";
import { createSingleShipment, unloadParcel } from "@/services/shipment";

const MIN_SEARCH_LENGTH = 3;
const DEBOUNCE_MS = 3000;
const MAX_RESULTS = 3;

type ShipmentType = "standard" | "cod" | "rdoc";

interface LogEntry {
  key: string;
  success: boolean;
  message: string;
  time: string;
}

interface ParcelInfo {
  barcode: string;
  order: number;
}

function extractBarcodes(data: Record<string, unknown>): ParcelInfo[] {
  const parcels = data.parcels as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(parcels)) return [];
  return parcels
    .filter((p) => typeof p.barcode === "string" && p.barcode.length > 0)
    .map((p) => ({
      barcode: p.barcode as string,
      order: (p.order as number) ?? 0,
    }));
}

function mapShipmentType(type: ShipmentType): string {
  if (type === "rdoc") return "return-document";
  return type;
}

function formatLogTime(): string {
  return new Date().toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const shipmentTypes: Array<{
  value: ShipmentType;
  title: string;
  icon: typeof Package;
}> = [
  {
    value: "standard",
    title: "Standard",
    icon: Package,
  },
  {
    value: "cod",
    title: "COD",
    icon: DollarSign,
  },
  {
    value: "rdoc",
    title: "RDOC",
    icon: RefreshCcw,
  },
];

function StepNumber({ value }: { value: number }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      {value}
    </span>
  );
}

function StepSection({
  number,
  title,
  children,
  className,
}: {
  number: number;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border bg-background p-3 shadow-xs", className)}>
      <div className="mb-2 flex items-center gap-3">
        <StepNumber value={number} />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function CounterControl({
  label,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const setClamped = (nextValue: number) => {
    onChange(Math.min(max, Math.max(min, nextValue)));
  };

  return (
    <div className="space-y-2">
      <Label className="text-[13px] font-semibold">{label}</Label>
      <div className="grid h-10 w-full grid-cols-[40px_1fr_40px] overflow-hidden rounded-md border bg-background">
        <button
          type="button"
          className="flex items-center justify-center border-e text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => setClamped(value - 1)}
          disabled={disabled || value <= min}
          aria-label={`Decrease ${label}`}
        >
          <Minus className="size-4" />
        </button>
        <input
          className="min-w-0 bg-transparent px-3 text-center text-sm font-medium outline-none"
          inputMode="numeric"
          value={value}
          onChange={(event) => setClamped(Number.parseInt(event.target.value, 10) || min)}
          aria-label={label}
          disabled={disabled}
        />
        <button
          type="button"
          className="flex items-center justify-center border-s text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => setClamped(value + 1)}
          disabled={disabled || value >= max}
          aria-label={`Increase ${label}`}
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function CreateShipmentDialog({
  open,
  onOpenChange,
  onCreated,
  onCloseAfterCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  onCloseAfterCreate?: () => void;
}) {
  const { token, country, environment, status: authStatus } = useNesyAuth();
  const isConnected = authStatus === "connected" && !!token;

  const [selectedType, setSelectedType] = useState<ShipmentType | null>(null);
  const [codAmount, setCodAmount] = useState("10.99");
  const [parcelCount, setParcelCount] = useState(1);
  const [shipmentCount, setShipmentCount] = useState(1);
  const [unloadParcels, setUnloadParcels] = useState(false);
  const [distinctStops, setDistinctStops] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const [createdShipmentIds, setCreatedShipmentIds] = useState<string[]>([]);

  const [searchValue, setSearchValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<Record<string, unknown>>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<BffCustomerPayload | null>(null);
  const [customerDetails, setCustomerDetails] = useState<NormalizedCustomerDetails | null>(null);
  const [shipperSelection, setShipperSelection] = useState<ShipmentPartySelection | null>(null);
  const [consigneeSelection, setConsigneeSelection] = useState<ShipmentPartySelection | null>(null);
  const [loadDetailId, setLoadDetailId] = useState<string | null>(null);
  const [showProgressResult, setShowProgressResult] = useState(false);
  const quantitySectionRef = useRef<HTMLDivElement>(null);
  const progressEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const prevSelectedTypeRef = useRef<ShipmentType | null>(null);

  const isWaitingDebounce =
    searchValue.trim().length >= MIN_SEARCH_LENGTH &&
    searchValue.trim() !== debouncedQuery;

  const isCreationDone = createdShipmentIds.length > 0 && !isProcessing;

  const shipperFilled = isPartySectionFilled(shipperSelection);
  const consigneeFilled = isPartySectionFilled(consigneeSelection);
  const shipperValid = isPartySelectionValid(shipperSelection);
  const consigneeValid = isPartySelectionValid(consigneeSelection);

  const addressesReady =
    !!customerDetails &&
    shipperValid &&
    (distinctStops || consigneeValid) &&
    selectedType !== null;

  const showConsigneeSection = !distinctStops;
  const showBatchOptions = distinctStops ? shipperFilled : consigneeFilled;

  const clearCustomerSelection = useCallback(() => {
    setSelectedCustomer(null);
    setCustomerDetails(null);
    setShipperSelection(null);
    setConsigneeSelection(null);
    setSelectedType(null);
    setShowProgressResult(false);
  }, []);

  const resetForm = useCallback(() => {
    setSearchValue("");
    setDebouncedQuery("");
    setSearchResults([]);
    setSearchLoading(false);
    setSearchError(null);
    setHasSearched(false);
    setSelectedCustomer(null);
    setCustomerDetails(null);
    setShipperSelection(null);
    setConsigneeSelection(null);
    setLoadDetailId(null);
    setShowProgressResult(false);
    setIsProcessing(false);
    setProgress(0);
    setStatusText("");
    setLogs([]);
    setSuccessCount(0);
    setCreatedShipmentIds([]);
    setSelectedType(null);
    setCodAmount("10.99");
    setParcelCount(1);
    setShipmentCount(1);
    setUnloadParcels(false);
    setDistinctStops(false);
    prevSelectedTypeRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open, resetForm]);

  useEffect(() => {
    if (!open) return;

    if (!shipperFilled || distinctStops) {
      if (!shipperFilled) {
        setConsigneeSelection(null);
        setSelectedType(null);
      }
      return;
    }

    if (customerDetails && !consigneeSelection) {
      setConsigneeSelection(
        buildInitialPartySelection(customerDetails, { selectFirstStandardAddress: true }),
      );
    }
  }, [open, shipperFilled, distinctStops, customerDetails, consigneeSelection]);

  useEffect(() => {
    if (!open) return;
    if (distinctStops) return;
    if (!consigneeFilled) {
      setSelectedType(null);
    }
  }, [open, distinctStops, consigneeFilled]);

  useEffect(() => {
    if (!open || selectedType === null) {
      prevSelectedTypeRef.current = selectedType;
      return;
    }

    if (prevSelectedTypeRef.current !== null) {
      prevSelectedTypeRef.current = selectedType;
      return;
    }

    prevSelectedTypeRef.current = selectedType;

    const timer = window.setTimeout(() => {
      quantitySectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 150);

    return () => window.clearTimeout(timer);
  }, [open, selectedType]);

  useEffect(() => {
    if (!open || !showProgressResult) return;

    const timer = window.setTimeout(() => {
      const logsEl = logsContainerRef.current;
      if (logsEl) {
        logsEl.scrollTop = logsEl.scrollHeight;
      }

      progressEndRef.current?.scrollIntoView({
        behavior: logs.length <= 1 ? "smooth" : "auto",
        block: "end",
      });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [open, showProgressResult, logs, progress, statusText]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchValue.trim());
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => {
    if (!open || !isConnected || !token) return;

    if (debouncedQuery.length < MIN_SEARCH_LENGTH) {
      setSearchResults([]);
      setSearchError(null);
      setHasSearched(false);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    const searchParams: Parameters<typeof searchCustomers>[0] = {
      token,
      country,
      environment,
      sorting: "undefined desc",
      ...buildSearchParams(debouncedQuery),
    };

    setSearchLoading(true);
    setSearchError(null);

    searchCustomers(searchParams)
      .then((data) => {
        if (cancelled) return;
        const list = extractSearchRows(data).slice(0, MAX_RESULTS);
        setSearchResults(list);
        setHasSearched(true);
        if (list.length === 0) {
          setSearchError("No results found. Try different criteria.");
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setSearchResults([]);
        setHasSearched(true);
        setSearchError(
          error instanceof Error ? error.message : "Search failed",
        );
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open, isConnected, token, country, environment]);

  const handleSelectCustomer = useCallback(
    async (row: Record<string, unknown>) => {
      if (!token) return;

      const idStr = pickRowIdString(row);

      if (!idStr) {
        setSearchError("No valid customer number on this row.");
        return;
      }

      const center = pickRowCenter(row);
      setSearchError(null);
      setLoadDetailId(idStr);

      try {
        const raw = await getCustomerDetails({
          token,
          country,
          environment,
          customerId: idStr,
          customerCenter: center,
        });
        const bff = mapNesyDetailsToBffPayload(raw, row);
        const details = mapNesyCustomerDetails(raw);
        setSelectedCustomer(bff);
        setCustomerDetails(details);
        setShipperSelection(
          buildInitialPartySelection(details, { selectFirstStandardAddress: true }),
        );
        setConsigneeSelection(
          buildInitialPartySelection(details, { selectFirstStandardAddress: true }),
        );
        setSelectedType(null);
        setSearchResults([]);
        setHasSearched(false);
        setSearchValue("");
        setDebouncedQuery("");
        setShowProgressResult(false);
      } catch (error) {
        setSearchError(
          error instanceof Error ? error.message : "Could not load customer details",
        );
      } finally {
        setLoadDetailId(null);
      }
    },
    [token, country, environment],
  );

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [...prev, entry]);
  }, []);

  const handleCreate = useCallback(async () => {
    if (
      !token ||
      !customerDetails ||
      !shipperSelection ||
      (!distinctStops && !consigneeSelection) ||
      !selectedType ||
      !addressesReady ||
      isProcessing
    ) {
      return;
    }

    const buildPartiesForIndex = (index: number) =>
      distinctStops
        ? buildPartiesWithDistinctConsignee(customerDetails, shipperSelection, index)
        : buildPartiesFromDetails(customerDetails, shipperSelection, consigneeSelection!);

    const apiShipmentType = mapShipmentType(selectedType);
    const effectiveParcelCount = distinctStops ? 1 : parcelCount;
    const unloadSteps = unloadParcels ? effectiveParcelCount : 0;
    const totalSteps = shipmentCount * (1 + unloadSteps);
    let completedSteps = 0;
    let createdCount = 0;
    const createdIds: string[] = [];

    setShowProgressResult(true);
    setIsProcessing(true);
    setProgress(0);
    setStatusText("");
    setLogs([]);
    setSuccessCount(0);
    setCreatedShipmentIds([]);

    const updateProgress = (text: string) => {
      completedSteps++;
      setProgress(Math.round((completedSteps / totalSteps) * 100));
      setStatusText(text);
    };

    for (let i = 0; i < shipmentCount; i++) {
      const shipNum = i + 1;
      setStatusText(`Shipment ${shipNum}/${shipmentCount} creating...`);

      let record: Awaited<ReturnType<typeof createSingleShipment>> | null = null;

      try {
        record = await createSingleShipment({
          token,
          country,
          environment,
          parcelCount: effectiveParcelCount,
          shipmentType: apiShipmentType,
          ...(apiShipmentType === "cod"
            ? { codAmount: Number.parseFloat(codAmount) || 0 }
            : {}),
          parties: buildPartiesForIndex(i),
        });

        createdCount++;
        setSuccessCount(createdCount);
        createdIds.push(record.id);
        setCreatedShipmentIds([...createdIds]);

        const nesyShipmentId =
          (record.data as Record<string, unknown>).shipmentId as string | undefined;

        updateProgress(`Shipment ${shipNum} created (${nesyShipmentId ?? record.id})`);
        addLog({
          key: `s${shipNum}-create`,
          success: true,
          message: `Shipment #${shipNum} created (${nesyShipmentId ?? record.id})`,
          time: formatLogTime(),
        });
      } catch (error) {
        updateProgress(`Shipment ${shipNum} create failed`);
        addLog({
          key: `s${shipNum}-create`,
          success: false,
          message: `Shipment #${shipNum} create failed: ${error instanceof Error ? error.message : "Unknown"}`,
          time: formatLogTime(),
        });
        if (unloadParcels) {
          completedSteps += effectiveParcelCount;
          setProgress(Math.round((completedSteps / totalSteps) * 100));
        }
        continue;
      }

      if (!unloadParcels || !record) continue;

      const barcodes = extractBarcodes(record.data as Record<string, unknown>);

      if (barcodes.length === 0) {
        addLog({
          key: `s${shipNum}-nobarcodes`,
          success: false,
          message: `Shipment #${shipNum}: no barcodes found, skipping unload`,
          time: formatLogTime(),
        });
        completedSteps += effectiveParcelCount;
        setProgress(Math.round((completedSteps / totalSteps) * 100));
        continue;
      }

      for (let j = 0; j < barcodes.length; j++) {
        const parcelNum = j + 1;
        const isLast = j === barcodes.length - 1;

        setStatusText(
          `Shipment ${shipNum}/${shipmentCount} - Unloading parcel ${parcelNum}/${barcodes.length}...`,
        );

        try {
          await unloadParcel({
            shipmentDbId: record.id,
            token,
            country,
            environment,
            barcode: barcodes[j].barcode,
            isLastParcel: isLast,
          });

          updateProgress(`Shipment ${shipNum} parcel ${parcelNum} unloaded`);
          addLog({
            key: `s${shipNum}-u${parcelNum}`,
            success: true,
            message: `Parcel ${parcelNum}/${barcodes.length} unloaded`,
            time: formatLogTime(),
          });
        } catch (error) {
          updateProgress(`Shipment ${shipNum} parcel ${parcelNum} unload failed`);
          addLog({
            key: `s${shipNum}-u${parcelNum}`,
            success: false,
            message: `Parcel ${parcelNum}/${barcodes.length} unload failed: ${error instanceof Error ? error.message : "Unknown"}`,
            time: formatLogTime(),
          });
        }
      }

      if (barcodes.length < effectiveParcelCount) {
        const remaining = effectiveParcelCount - barcodes.length;
        completedSteps += remaining;
        setProgress(Math.round((completedSteps / totalSteps) * 100));
      }
    }

    setStatusText("Completed");
    setIsProcessing(false);
    onCreated?.();
  }, [
    token,
    country,
    environment,
    customerDetails,
    shipperSelection,
    consigneeSelection,
    distinctStops,
    addressesReady,
    isProcessing,
    selectedType,
    codAmount,
    parcelCount,
    shipmentCount,
    unloadParcels,
    addLog,
    onCreated,
  ]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isProcessing) return;
      onOpenChange(nextOpen);
    },
    [isProcessing, onOpenChange],
  );

  const showEmptyView =
    !selectedCustomer &&
    (searchValue.trim().length < MIN_SEARCH_LENGTH ||
      (!hasSearched && !searchLoading && !isWaitingDebounce));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-[620px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="mb-0 space-y-0.5 border-b px-5 py-4">
          <DialogTitle className="text-lg font-semibold">Create Shipments</DialogTitle>
          <DialogDescription>
            Create one or multiple test shipments for courier scenarios.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="overflow-y-auto px-5 py-4">
          <div className="space-y-4">
            <StepSection number={1} title="Customer Search & Selection">
              <div className="space-y-3">
                {!isConnected && (
                  <p className="text-xs text-muted-foreground">
                    Connect to Nesy from the header before searching.
                  </p>
                )}

                <div className="relative">
                  <Input
                    className="h-11 w-full pe-10 ps-3 text-sm"
                    value={searchValue}
                    onChange={(event) => {
                      const next = event.target.value;
                      setSearchValue(next);
                      if (selectedCustomer) {
                        clearCustomerSelection();
                      }
                    }}
                    placeholder="Search by customer no, name, or account..."
                    disabled={!isConnected || !!loadDetailId || isProcessing || isCreationDone}
                  />
                  {searchLoading || isWaitingDebounce ? (
                    <Loader2 className="pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 animate-spin text-muted-foreground" />
                  ) : (
                    <Search className="pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  )}
                </div>

                {showEmptyView && (
                  <div className="flex items-center justify-center gap-2 rounded-md border border-dashed bg-muted/20 px-3 py-2 text-center">
                    <Search className="size-3.5 shrink-0 text-muted-foreground/60" />
                    <p className="text-xs text-muted-foreground">
                      {searchValue.trim().length > 0 &&
                      searchValue.trim().length < MIN_SEARCH_LENGTH
                        ? `Enter at least ${MIN_SEARCH_LENGTH} characters to start searching.`
                        : "Your search results will appear here."}
                    </p>
                  </div>
                )}

                {(searchLoading || isWaitingDebounce) &&
                  searchValue.trim().length >= MIN_SEARCH_LENGTH && (
                    <div className="flex items-center justify-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
                      <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Searching...</span>
                    </div>
                  )}

                {searchError && !searchLoading && !isWaitingDebounce && (
                  <p className="text-xs text-destructive">{searchError}</p>
                )}

                {searchResults.length > 0 && (
                  <div className="space-y-2">
                    {searchResults.map((row, index) => {
                      const id = pickRowId(row);
                      const idStr = Number.isFinite(id) ? String(id) : "?";
                      const name = rowDisplayName(row);
                      const city = rowDisplayCity(row);
                      const busy = loadDetailId === idStr;

                      return (
                        <button
                          key={`${idStr}-${index}`}
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg border bg-background p-2 text-left transition-colors hover:bg-muted/30 disabled:opacity-50"
                          onClick={() => void handleSelectCustomer(row)}
                          disabled={!!loadDetailId}
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-nesy-soft text-nesy">
                            <Building2 className="size-4" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-foreground">
                              {idStr} - {name}
                            </span>
                            {city && (
                              <span className="block text-xs text-muted-foreground">
                                {city}
                              </span>
                            )}
                          </span>
                          {busy && (
                            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedCustomer && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg border border-nesy bg-background p-2 text-left shadow-[0_0_0_1px_var(--nesy-orange)]"
                    onClick={() => {
                      if (isProcessing || isCreationDone) return;
                      clearCustomerSelection();
                    }}
                    disabled={isProcessing || isCreationDone}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-nesy-soft text-nesy">
                      <Building2 className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">
                        {selectedCustomer.customerId} - {selectedCustomer.name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {selectedCustomer.addressCity}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        Selected
                      </span>
                    </span>
                  </button>
                )}
              </div>
            </StepSection>

            {customerDetails && shipperSelection && token && (
              <StepSection number={2} title="Shipper Address">
                <ShipmentAddressSection
                  title="Shipper"
                  details={customerDetails}
                  value={shipperSelection}
                  onChange={setShipperSelection}
                  disabled={isProcessing || isCreationDone}
                  showParcelShop={parcelCount === 1}
                  token={token}
                  country={country}
                  environment={environment}
                />
              </StepSection>
            )}

            {shipperFilled && showConsigneeSection && consigneeSelection && customerDetails && token && (
              <StepSection number={3} title="Consignee Address">
                <ShipmentAddressSection
                  title="Consignee"
                  details={customerDetails}
                  value={consigneeSelection}
                  onChange={setConsigneeSelection}
                  disabled={isProcessing || isCreationDone}
                  showParcelShop={parcelCount === 1 && !distinctStops}
                  token={token}
                  country={country}
                  environment={environment}
                />
              </StepSection>
            )}

            {shipperFilled && distinctStops && customerDetails && (
              <StepSection number={3} title="Consignee Address">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Each shipment gets a unique auto-generated consignee address (name, street,
                  city, phone, coordinates) so loads merge into separate stops on the courier
                  route. Parcel count is fixed to 1 per shipment.
                </p>
              </StepSection>
            )}

            {showBatchOptions && (
              <StepSection number={4} title="Shipment Type">
              <div className="grid grid-cols-3 gap-2">
                {shipmentTypes.map((type) => {
                  const Icon = type.icon;
                  const selected = selectedType === type.value;

                  return (
                    <button
                      key={type.value}
                      type="button"
                      className={cn(
                        "flex items-center gap-2 rounded-lg border bg-background px-2 py-1.5 text-left transition-all hover:border-nesy/70 hover:bg-nesy-soft/40",
                        selected && "border-nesy bg-nesy-soft/60 shadow-[0_0_0_1px_var(--nesy-orange)]",
                      )}
                      onClick={() => setSelectedType(type.value)}
                      disabled={isProcessing || isCreationDone}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-nesy-soft text-nesy">
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">
                          {type.title}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "flex size-4 shrink-0 items-center justify-center rounded-full border",
                          selected
                            ? "border-nesy bg-nesy text-white"
                            : "border-input bg-background",
                        )}
                      >
                        {selected && <Check className="size-2.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedType === "cod" && (
                <div className="mt-3 space-y-2">
                  <Label className="text-[13px] font-semibold">COD Amount</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={codAmount}
                    onChange={(event) => setCodAmount(event.target.value)}
                    placeholder="10.99"
                    disabled={isProcessing || isCreationDone}
                    className="h-10"
                  />
                </div>
              )}
            </StepSection>
            )}

            {showBatchOptions && selectedType !== null && (
              <>
            <div ref={quantitySectionRef}>
            <StepSection number={5} title="Quantity / Batch Setup">
              <div className="mb-3 flex items-center gap-2 rounded-md border border-dashed bg-muted/20 px-3 py-2">
                <SwitchWrapper>
                  <Switch
                    checked={distinctStops}
                    onCheckedChange={(checked) => {
                      const enabled = checked === true;
                      setDistinctStops(enabled);
                      if (enabled) {
                        setParcelCount(1);
                        if (shipmentCount === 1) setShipmentCount(20);
                        setConsigneeSelection(null);
                      }
                    }}
                    className="data-[state=checked]:bg-nesy"
                    disabled={isProcessing || isCreationDone}
                  />
                </SwitchWrapper>
                <div className="min-w-0">
                  <Label className="text-[13px] font-semibold">Distinct stops</Label>
                  <p className="text-[11px] text-muted-foreground">
                    1 parcel per shipment, unique consignee address each (for multi-stop load tests)
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 items-end gap-3">
                <CounterControl
                  label="Parcel Count"
                  value={distinctStops ? 1 : parcelCount}
                  min={1}
                  max={50}
                  onChange={setParcelCount}
                  disabled={isProcessing || isCreationDone || distinctStops}
                />
                <CounterControl
                  label="Shipment Count"
                  value={shipmentCount}
                  min={1}
                  max={100}
                  onChange={setShipmentCount}
                  disabled={isProcessing || isCreationDone}
                />
                <div className="flex h-10 items-center gap-2">
                  <SwitchWrapper>
                    <Switch
                      checked={unloadParcels}
                      onCheckedChange={setUnloadParcels}
                      className="data-[state=checked]:bg-nesy"
                      disabled={isProcessing || isCreationDone}
                    />
                  </SwitchWrapper>
                  <Label className="text-[13px] font-semibold">Unload Parcels</Label>
                </div>
              </div>
            </StepSection>
            </div>

            {showProgressResult && (
              <div>
              <StepSection number={6} title="Progress / Result">
                <div className="grid grid-cols-[40px_1fr] items-start gap-3">
                  <div
                    className={cn(
                      "flex size-10 items-center justify-center rounded-full ring-4",
                      isProcessing
                        ? "bg-muted text-muted-foreground ring-muted/50"
                        : successCount === shipmentCount
                          ? "bg-emerald-100 text-emerald-600 ring-emerald-50"
                          : "bg-amber-100 text-amber-600 ring-amber-50",
                    )}
                  >
                    {isProcessing ? (
                      <Loader2 className="size-5 animate-spin" />
                    ) : (
                      <CircleCheck className="size-5" />
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-3 text-[13px]">
                        <span className="font-medium text-foreground">
                          {isProcessing
                            ? statusText
                            : `${successCount} of ${shipmentCount} shipments created successfully`}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 font-semibold",
                            isProcessing
                              ? "text-muted-foreground"
                              : successCount === shipmentCount
                                ? "text-emerald-600"
                                : "text-amber-600",
                          )}
                        >
                          {progress}%
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            isProcessing
                              ? "bg-nesy"
                              : successCount === shipmentCount
                                ? "bg-emerald-500"
                                : "bg-amber-500",
                          )}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    {logs.length > 0 && (
                      <div
                        ref={logsContainerRef}
                        className="grid max-h-40 gap-1.5 overflow-y-auto"
                      >
                        {logs.map((log) => (
                          <div
                            key={log.key}
                            className="flex items-center justify-between gap-3 text-xs"
                          >
                            <span
                              className={cn(
                                "flex min-w-0 items-center gap-2 font-medium",
                                log.success ? "text-foreground" : "text-destructive",
                              )}
                            >
                              <span
                                className={cn(
                                  "flex size-[14px] shrink-0 items-center justify-center rounded-full text-white",
                                  log.success ? "bg-emerald-500" : "bg-destructive",
                                )}
                              >
                                {log.success ? (
                                  <Check className="size-2.5" />
                                ) : (
                                  <span className="text-[10px] font-bold">!</span>
                                )}
                              </span>
                              {log.message}
                            </span>
                            <span className="shrink-0 text-end text-muted-foreground">
                              {log.time}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </StepSection>
              <div ref={progressEndRef} aria-hidden className="h-0" />
              </div>
            )}
              </>
            )}
          </div>
        </DialogBody>

        <DialogFooter className="border-t px-5 py-4">
          {isCreationDone ? (
            <div className="grid w-full grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-10"
                onClick={resetForm}
              >
                Reset Form
              </Button>
              <Button
                type="button"
                variant="nesy"
                size="lg"
                className="h-10"
                onClick={() => onCloseAfterCreate?.()}
              >
                View Shipments
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="nesy"
              size="lg"
              className="h-10 w-full"
              disabled={!addressesReady || !isConnected || isProcessing}
              onClick={() => void handleCreate()}
            >
              {isProcessing
                ? `Creating... ${progress}%`
                : shipmentCount > 1
                  ? "Create Shipments"
                  : "Create Shipment"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
