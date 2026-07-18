"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Copy,
  ExternalLink,
  Loader2,
  Package,
  PackagePlus,
  Search,
  SkipForward,
  Tag,
  Truck,
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
import { Input, InputWrapper } from "@nesy/metronic/components/ui/input";
import { ScrollArea } from "@nesy/metronic/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@nesy/metronic/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@nesy/metronic/components/ui/alert";
import { cn } from "@nesy/metronic/lib/utils";
import {
  fetchHappyPathPoolById,
  type HappyPathPoolDetail,
  type HappyPathPoolEntry,
  type HappyPathPoolListItem,
} from "@/services/happy-path";
import {
  HappyPathViewDialogHeaderShimmer,
  HappyPathViewDialogListShimmer,
} from "@/components/data-center/happy-path/happy-path-view-dialog-list-shimmer";
import { HappyPathBulkAssignPickupsDialog } from "@/components/data-center/happy-path/happy-path-bulk-assign-pickups-dialog";
import { useNesyAuth } from "@/contexts/nesy-auth-context";
import { getPickupNesyUrl } from "@/services/pickup";
import {
  base64PdfToObjectUrl,
  getBulkShipmentDisplayLabel,
  getShipmentNesyUrl,
} from "@/services/shipment";

type StatusFilter = "all" | "success" | "failed" | "skipped" | "issues";
type RouteFilter = "all" | "shipment" | "pickup" | "skip";

function formatAssignmentMode(mode: string | null | undefined): string {
  if (mode === "one") return "One customer";
  if (mode === "recommended") return "Recommended groups";
  if (mode === "custom") return "Per type";
  return mode?.trim() ? mode : "—";
}

function entryStatusVariant(
  status: string,
): "success" | "destructive" | "secondary" | "info" {
  if (status === "success") return "success";
  if (status === "failed") return "destructive";
  if (status === "skipped") return "secondary";
  if (status === "running") return "info";
  return "secondary";
}

function formatEntryStatus(status: string): string {
  if (status === "success") return "Created";
  if (status === "failed") return "Failed";
  if (status === "skipped") return "Skipped";
  if (status === "running") return "Running";
  return status;
}

function formatStatusFilterLabel(filter: StatusFilter): string {
  if (filter === "success") return "created";
  if (filter === "issues") return "needs attention";
  return filter;
}

function getEntryRecordId(entry: HappyPathPoolEntry): string | null {
  const id =
    entry.route === "pickup"
      ? entry.pickupId
      : entry.shipmentId ?? entry.pickupId;
  const trimmed = id?.trim();
  return trimmed || null;
}

function getEntryNesyShipmentDisplayId(entry: HappyPathPoolEntry): string | null {
  if (entry.route !== "shipment" && entry.route !== "pickup") return null;
  const fromApi = entry.nesyShipmentId?.trim();
  return fromApi || null;
}

function shortenId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function computeEntryStats(entries: HappyPathPoolEntry[]) {
  let success = 0;
  let failed = 0;
  let skipped = 0;
  let shipments = 0;
  let pickups = 0;
  let skipRoutes = 0;
  for (const entry of entries) {
    if (entry.route === "shipment") shipments += 1;
    else if (entry.route === "pickup") pickups += 1;
    else if (entry.route === "skip") skipRoutes += 1;
    if (entry.status === "success") success += 1;
    else if (entry.status === "failed") failed += 1;
    else if (entry.status === "skipped") skipped += 1;
  }
  return { success, failed, skipped, total: entries.length, shipments, pickups, skipRoutes };
}

function matchesStatusFilter(entry: HappyPathPoolEntry, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "issues") return entry.status === "failed" || entry.status === "skipped";
  return entry.status === filter;
}

function matchesRouteFilter(entry: HappyPathPoolEntry, filter: RouteFilter): boolean {
  if (filter === "all") return true;
  if (filter === "skip") return entry.route === "skip";
  return entry.route === filter;
}

function parsePoolDisplayName(
  name: string,
  pool: HappyPathPoolDetail | null,
): { title: string; subtitle: string; fullTitle: string } {
  const segments = name.split("·").map((segment) => segment.trim()).filter(Boolean);
  const envFromPool = pool
    ? `${pool.country} · ${pool.environment}`
    : null;

  if (segments.length >= 3) {
    const env = segments[1] ?? envFromPool ?? "";
    const when = segments.slice(2).join(" · ");
    return {
      title: segments[0] ?? "Happy Path",
      subtitle: [env, when].filter(Boolean).join(" · "),
      fullTitle: name,
    };
  }

  return {
    title: name,
    subtitle: [envFromPool, pool?.createdDate].filter(Boolean).join(" · "),
    fullTitle: name,
  };
}

function GenerationTrack({
  stats,
  assignmentMode,
  typeCount,
  statusFilter,
  onStatusFilter,
}: {
  stats: ReturnType<typeof computeEntryStats>;
  assignmentMode: string | null | undefined;
  typeCount: number | null;
  statusFilter: StatusFilter;
  onStatusFilter: (filter: StatusFilter) => void;
}) {
  if (stats.total === 0) return null;

  const accounted = stats.success + stats.failed + stats.skipped;
  const other = Math.max(0, stats.total - accounted);

  type SegmentDef = {
    id: StatusFilter;
    count: number;
    label: string;
    trackClass: string;
  };

  const segments: SegmentDef[] = (
    [
      {
        id: "success",
        count: stats.success,
        label: "created",
        trackClass: "bg-emerald-500 hover:bg-emerald-600",
      },
      {
        id: "failed",
        count: stats.failed,
        label: "failed",
        trackClass: "bg-destructive hover:bg-destructive/90",
      },
      {
        id: "skipped",
        count: stats.skipped,
        label: "skipped",
        trackClass: "bg-zinc-400/90 hover:bg-zinc-500/90",
      },
    ] satisfies SegmentDef[]
  ).filter((s) => s.count > 0);

  const createdPct = Math.round((stats.success / stats.total) * 100);
  const summaryInTrack =
    stats.failed > 0
      ? `${stats.success} created · ${stats.failed} failed${stats.skipped ? ` · ${stats.skipped} skipped` : ""}`
      : stats.skipped > 0
        ? `${stats.success} created · ${stats.skipped} skipped`
        : `${stats.success} of ${stats.total} created`;

  const toggleFilter = (id: StatusFilter) => {
    onStatusFilter(statusFilter === id ? "all" : id);
  };

  return (
    <div className="mt-3 space-y-2">
      <div
        className={cn(
          "rounded-xl border bg-muted/25 p-1 transition-shadow",
          statusFilter !== "all" && "ring-2 ring-nesy/25 ring-offset-1 ring-offset-background",
        )}
      >
        <div
          className="relative flex h-10 overflow-hidden rounded-lg bg-muted/60 shadow-inner"
          role="group"
          aria-label={`Generation summary: ${stats.success} created, ${stats.failed} failed, ${stats.skipped} skipped`}
        >
          {segments.length > 0 ? (
            <div className="absolute inset-0 flex">
              {segments.map((segment) => {
                const pct = (segment.count / stats.total) * 100;
                const isActive = statusFilter === segment.id;
                const dimmed = statusFilter !== "all" && !isActive;
                return (
                  <button
                    key={segment.id}
                    type="button"
                    title={`Filter: ${segment.count} ${segment.label}`}
                    className={cn(
                      "relative flex min-w-[2rem] items-center justify-center border-e border-white/15 transition-[flex,opacity,filter] last:border-e-0",
                      segment.trackClass,
                      dimmed && "opacity-45 saturate-75",
                      isActive && "ring-2 ring-inset ring-white/70",
                    )}
                    style={{ width: `${pct}%` }}
                    onClick={() => toggleFilter(segment.id)}
                  >
                    <span className="sr-only">
                      {segment.count} {segment.label}
                    </span>
                  </button>
                );
              })}
              {other > 0 ? (
                <span
                  className="bg-muted-foreground/25"
                  style={{ width: `${(other / stats.total) * 100}%` }}
                  aria-hidden
                />
              ) : null}
            </div>
          ) : null}

          <div className="pointer-events-none relative z-[1] flex h-full w-full items-center justify-between gap-2 px-3">
            <span className="max-w-[70%] truncate rounded-md bg-background/80 px-2 py-1 text-[11px] font-medium text-foreground shadow-sm backdrop-blur-sm">
              {summaryInTrack}
            </span>
            <span className="shrink-0 rounded-md bg-background/80 px-2 py-1 text-[11px] font-semibold tabular-nums text-foreground shadow-sm backdrop-blur-sm">
              {createdPct}%
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1 pt-2">
          <p className="text-[11px] text-muted-foreground">
            {formatAssignmentMode(assignmentMode)}
            {typeCount != null ? ` · ${typeCount} types` : ""}
            {stats.skipRoutes > 0 ? ` · ${stats.skipRoutes} not generated` : ""}
          </p>
          <div className="flex items-center gap-1.5">
            {statusFilter !== "all" ? (
              <button
                type="button"
                className="rounded-full px-2 py-0.5 text-[11px] font-medium text-nesy hover:bg-nesy-soft"
                onClick={() => onStatusFilter("all")}
              >
                Clear filter
              </button>
            ) : null}
            <button
              type="button"
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                statusFilter === "all"
                  ? "border-nesy/35 bg-nesy-soft text-nesy-ink"
                  : "border-border bg-background text-muted-foreground hover:bg-muted",
              )}
              onClick={() => onStatusFilter("all")}
            >
              All {stats.total}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RouteIcon({ route }: { route: string }) {
  if (route === "pickup") {
    return <Truck className="size-3.5 shrink-0 text-violet-600" aria-hidden />;
  }
  if (route === "shipment") {
    return <Package className="size-3.5 shrink-0 text-nesy" aria-hidden />;
  }
  return <SkipForward className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />;
}

function CompactRecordId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex max-w-[7.5rem] items-center gap-0.5 rounded px-1 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-muted"
          onClick={(e) => {
            e.stopPropagation();
            void navigator.clipboard.writeText(id);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
        >
          <span className="truncate">{shortenId(id)}</span>
          <Copy className="size-2.5 shrink-0 opacity-50" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm break-all font-mono text-xs">
        {copied ? "Copied" : id}
      </TooltipContent>
    </Tooltip>
  );
}

function EntryListItem({
  index,
  entry,
  displayShipmentId,
  openingNesy,
  onOpenNesy,
}: {
  index: number;
  entry: HappyPathPoolEntry;
  displayShipmentId: string | null;
  openingNesy: boolean;
  onOpenNesy: (entry: HappyPathPoolEntry) => void;
}) {
  const recordId = getEntryRecordId(entry);
  const hasRecord = !!recordId;
  const showShipmentIdColumn =
    entry.route === "shipment" || entry.route === "pickup";

  return (
    <li>
      <div
        role={hasRecord ? "button" : undefined}
        tabIndex={hasRecord ? 0 : undefined}
        className={cn(
          "flex items-center gap-2 border-b border-border/50 px-5 py-2.5 sm:gap-3 sm:px-6",
          hasRecord && "cursor-pointer hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none",
          entry.status === "failed" && "bg-destructive/[0.03]",
        )}
        onClick={() => {
          if (hasRecord && !openingNesy) onOpenNesy(entry);
        }}
        onKeyDown={(e) => {
          if (!hasRecord) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!openingNesy) onOpenNesy(entry);
          }
        }}
      >
        <span className="w-5 shrink-0 text-center text-[11px] tabular-nums text-muted-foreground">
          {index + 1}
        </span>

        <RouteIcon route={entry.route} />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground" title={entry.label}>
              {entry.label}
            </span>
            <Badge
              variant={entryStatusVariant(entry.status)}
              appearance="light"
              size="sm"
              className="h-5 shrink-0 px-1.5 text-[10px]"
            >
              {formatEntryStatus(entry.status)}
            </Badge>
          </div>
          {entry.error ? (
            <p className="mt-0.5 line-clamp-1 text-[11px] text-destructive" title={entry.error}>
              {entry.error}
            </p>
          ) : (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{entry.typeId}</p>
          )}
        </div>

        <div className="hidden shrink-0 sm:block">
          {!showShipmentIdColumn ? (
            <span className="text-[11px] text-muted-foreground">—</span>
          ) : displayShipmentId ? (
            <CompactRecordId id={displayShipmentId} />
          ) : (
            <span className="text-[11px] text-muted-foreground">—</span>
          )}
        </div>

        <div className="flex w-8 shrink-0 justify-end">
          {entry.error && !hasRecord ? (
            <AlertCircle className="size-4 text-destructive" aria-label={entry.error} />
          ) : hasRecord ? (
            openingNesy ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : (
              <ExternalLink className="size-4 text-muted-foreground" aria-hidden />
            )
          ) : null}
        </div>
      </div>
    </li>
  );
}

function GroupHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="sticky top-0 z-[1] flex items-center justify-between border-b bg-muted/80 px-5 py-2 backdrop-blur-sm sm:px-6">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </span>
      <span className="text-[11px] tabular-nums text-muted-foreground">{count}</span>
    </div>
  );
}

export function HappyPathViewDialog({
  open,
  onOpenChange,
  poolId,
  listItem,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poolId: string | null;
  listItem?: HappyPathPoolListItem | null;
}) {
  const { token, status: authStatus } = useNesyAuth();
  const [pool, setPool] = useState<HappyPathPoolDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [bulkDisplayingLabels, setBulkDisplayingLabels] = useState(false);
  const [assignPickupsOpen, setAssignPickupsOpen] = useState(false);
  const [openingNesyKey, setOpeningNesyKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [routeFilter, setRouteFilter] = useState<RouteFilter>("all");

  useEffect(() => {
    if (!open || !poolId) {
      setPool(null);
      setError(null);
      setActionError(null);
      setBulkDisplayingLabels(false);
      setAssignPickupsOpen(false);
      setLoading(false);
      setQuery("");
      setStatusFilter("all");
      setRouteFilter("all");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setQuery("");
    setStatusFilter("all");
    setRouteFilter("all");

    fetchHappyPathPoolById(poolId)
      .then((data) => {
        if (!cancelled) setPool(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setPool(null);
          setError(err instanceof Error ? err.message : "Could not load set details.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, poolId]);

  const stats = useMemo(
    () => (pool ? computeEntryStats(pool.entries) : null),
    [pool],
  );

  const routeScopedEntries = useMemo(() => {
    if (!pool) return [];
    return pool.entries.filter((entry) => matchesRouteFilter(entry, routeFilter));
  }, [pool, routeFilter]);

  const filteredEntries = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return routeScopedEntries.filter((entry) => {
      if (!matchesStatusFilter(entry, statusFilter)) return false;
      if (!normalized) return true;

      const recordId = getEntryRecordId(entry) ?? "";
      const nesyShipmentId = getEntryNesyShipmentDisplayId(entry) ?? "";
      return (
        entry.label.toLowerCase().includes(normalized) ||
        entry.typeId.toLowerCase().includes(normalized) ||
        entry.route.toLowerCase().includes(normalized) ||
        recordId.toLowerCase().includes(normalized) ||
        nesyShipmentId.toLowerCase().includes(normalized) ||
        (entry.error?.toLowerCase().includes(normalized) ?? false)
      );
    });
  }, [routeScopedEntries, query, statusFilter]);

  const groupedLists = useMemo(() => {
    if (routeFilter !== "all") {
      return [{ key: "flat", title: null as string | null, items: filteredEntries }];
    }

    const shipments = filteredEntries.filter((e) => e.route === "shipment");
    const pickups = filteredEntries.filter((e) => e.route === "pickup");
    const other = filteredEntries.filter(
      (e) => e.route !== "shipment" && e.route !== "pickup",
    );

    const groups: { key: string; title: string | null; items: HappyPathPoolEntry[] }[] = [];
    if (shipments.length) groups.push({ key: "shipment", title: "Shipments", items: shipments });
    if (pickups.length) groups.push({ key: "pickup", title: "Pickups", items: pickups });
    if (other.length) groups.push({ key: "other", title: "Not generated", items: other });
    return groups.length ? groups : [{ key: "empty", title: null, items: [] }];
  }, [filteredEntries, routeFilter]);

  const handleOpenNesy = useCallback(async (entry: HappyPathPoolEntry) => {
    const recordId = getEntryRecordId(entry);
    if (!recordId) return;

    setOpeningNesyKey(entry.id);
    try {
      const url =
        entry.route === "pickup"
          ? await getPickupNesyUrl(recordId)
          : await getShipmentNesyUrl(recordId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open Nesy Dashboard.");
    } finally {
      setOpeningNesyKey(null);
    }
  }, []);

  const title = pool?.name ?? listItem?.name ?? "Happy path set";
  const display = parsePoolDisplayName(title, pool);
  const includedTypeCount = Array.isArray(pool?.meta?.includedTypeIds)
    ? (pool.meta.includedTypeIds as string[]).length
    : null;

  const routeTabs = useMemo(() => {
    if (!stats) return [];
    const tabs: { id: RouteFilter; label: string; count: number }[] = [
      { id: "all", label: "All", count: stats.total },
      { id: "shipment", label: "Shipments", count: stats.shipments },
      { id: "pickup", label: "Pickups", count: stats.pickups },
    ];
    if (stats.skipRoutes > 0) {
      tabs.push({ id: "skip", label: "Not generated", count: stats.skipRoutes });
    }
    return tabs;
  }, [stats]);

  const hasListFilters =
    query.trim().length > 0 || statusFilter !== "all" || routeFilter !== "all";

  const shipmentDbIdsForLabels = useMemo(() => {
    if (!pool) return [];
    const ids = pool.entries
      .filter(
        (entry) =>
          entry.route === "shipment" &&
          entry.status === "success" &&
          entry.shipmentId?.trim(),
      )
      .map((entry) => entry.shipmentId!.trim());
    return [...new Set(ids)];
  }, [pool]);

  const pickupAssignTargets = useMemo(() => {
    if (!pool) return [];
    return pool.entries
      .filter(
        (entry) =>
          entry.route === "pickup" &&
          entry.status === "success" &&
          entry.pickupId?.trim(),
      )
      .map((entry) => ({
        pickupDbId: entry.pickupId!.trim(),
        label: entry.label,
      }));
  }, [pool]);

  const scopeCountry = pool?.country ?? listItem?.country ?? "";
  const scopeEnvironment = (
    pool?.environment ??
    listItem?.environment ??
    ""
  ).toLowerCase();

  const handleBulkDisplayLabels = useCallback(async () => {
    if (shipmentDbIdsForLabels.length === 0) return;
    if (authStatus !== "connected" || !token) {
      setActionError("Connect to Nesy before displaying labels.");
      return;
    }
    if (!scopeCountry || !scopeEnvironment) {
      setActionError("Missing country or environment for this set.");
      return;
    }

    setBulkDisplayingLabels(true);
    setActionError(null);
    const labelWindow = window.open(
      "about:blank",
      "pdfLabel",
      "width=900,height=700,menubar=no,toolbar=no,location=no,scrollbars=yes,resizable=yes",
    );

    try {
      const { content } = await getBulkShipmentDisplayLabel({
        shipmentDbIds: shipmentDbIdsForLabels,
        token,
        country: scopeCountry,
        environment: scopeEnvironment,
      });
      const url = base64PdfToObjectUrl(content);
      if (labelWindow) {
        labelWindow.opener = null;
        labelWindow.onload = () => labelWindow.print();
        labelWindow.location.href = url;
      } else {
        window.open(url, "pdfLabel", "noopener,noreferrer,width=900,height=700");
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      labelWindow?.close();
      setActionError(
        err instanceof Error ? err.message : "Could not display shipment labels.",
      );
    } finally {
      setBulkDisplayingLabels(false);
    }
  }, [
    authStatus,
    token,
    scopeCountry,
    scopeEnvironment,
    shipmentDbIdsForLabels,
  ]);

  const clearListFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setRouteFilter("all");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
        showCloseButton={false}
        className="flex h-[min(92vh,900px)] max-h-[92vh] w-[min(96vw,52rem)] max-w-none flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="mb-0 shrink-0 space-y-0 border-b px-4 py-3 sm:px-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-nesy-soft text-nesy">
              <PackagePlus className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <DialogTitle className="text-base font-semibold leading-tight" title={display.fullTitle}>
                    {display.title}
                  </DialogTitle>
                  {display.subtitle ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{display.subtitle}</p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0 rounded-full text-muted-foreground"
                  aria-label="Close"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="size-4" />
                </Button>
              </div>
              {loading ? (
                <HappyPathViewDialogHeaderShimmer />
              ) : pool && stats ? (
                <GenerationTrack
                  stats={stats}
                  assignmentMode={pool.assignmentMode}
                  typeCount={includedTypeCount}
                  statusFilter={statusFilter}
                  onStatusFilter={setStatusFilter}
                />
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
          {error ? (
            <Alert variant="destructive" className="mx-4 mt-3 shrink-0 sm:mx-5">
              <AlertTitle>Happy path set</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {actionError ? (
            <Alert variant="destructive" className="mx-4 mt-3 shrink-0 sm:mx-5">
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}

          {loading ? (
            <HappyPathViewDialogListShimmer />
          ) : pool && stats ? (
            <>
              <div
                className={cn(
                  "shrink-0 border-b bg-muted/10 px-5 sm:px-6",
                  hasListFilters ? "py-2.5" : "flex min-h-14 items-center py-0",
                )}
              >
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-stretch">
                  <div className="inline-flex h-9 max-w-full flex-wrap items-center rounded-lg border bg-background p-0.5">
                    {routeTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={cn(
                          "inline-flex h-full items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium leading-none transition-colors",
                          routeFilter === tab.id
                            ? "bg-nesy text-white shadow-sm"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                        onClick={() => setRouteFilter(tab.id)}
                      >
                        <span className="leading-none">{tab.label}</span>
                        <span
                          className={cn(
                            "inline-flex size-5 min-w-5 shrink-0 items-center justify-center rounded-full tabular-nums text-[10px] font-semibold leading-none",
                            routeFilter === tab.id
                              ? "bg-white text-zinc-950"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  <InputWrapper
                    className="h-9 min-w-0 flex-1 sm:min-w-[12rem]"
                    variant="sm"
                  >
                    <Search className="size-3.5 shrink-0" />
                    <Input
                      placeholder="Search type or record id…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query ? (
                      <Button
                        type="button"
                        variant="dim"
                        size="sm"
                        className="-me-1.5 size-7 shrink-0"
                        aria-label="Clear search"
                        onClick={() => setQuery("")}
                      >
                        <X className="size-3" />
                      </Button>
                    ) : null}
                  </InputWrapper>
                </div>

                {hasListFilters ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      Showing {filteredEntries.length} of {pool.entries.length}
                      {routeFilter !== "all" ? ` · ${routeTabs.find((t) => t.id === routeFilter)?.label}` : ""}
                      {statusFilter !== "all" ? ` · ${formatStatusFilterLabel(statusFilter)}` : ""}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={clearListFilters}
                    >
                      Clear filters
                    </Button>
                  </div>
                ) : null}
              </div>

              {filteredEntries.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                  <Search className="size-7 text-muted-foreground/40" />
                  <p className="text-sm font-medium">No matching items</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      clearListFilters();
                    }}
                  >
                    Reset filters
                  </Button>
                </div>
              ) : (
                <ScrollArea className="min-h-0 flex-1">
                  {(() => {
                    let rowCounter = 0;
                    return groupedLists.map((group) => (
                      <div key={group.key}>
                        {group.title ? (
                          <GroupHeader title={group.title} count={group.items.length} />
                        ) : null}
                        <ul>
                          {group.items.map((entry) => {
                            const displayIndex = rowCounter;
                            rowCounter += 1;
                            return (
                              <EntryListItem
                                key={entry.id}
                                index={displayIndex}
                                entry={entry}
                                displayShipmentId={getEntryNesyShipmentDisplayId(entry)}
                                openingNesy={openingNesyKey === entry.id}
                                onOpenNesy={handleOpenNesy}
                              />
                            );
                          })}
                        </ul>
                      </div>
                    ));
                  })()}
                </ScrollArea>
              )}
            </>
          ) : !error ? (
            <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              No details available.
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter className="shrink-0 flex-row flex-wrap items-center gap-2 border-t px-4 py-2 sm:justify-between sm:px-5">
          <p className="me-auto hidden text-[11px] text-muted-foreground sm:block">
            Row click opens Nesy · Copy Nesy shipment id from chip
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="mono"
              size="sm"
              disabled={
                bulkDisplayingLabels ||
                loading ||
                !pool ||
                shipmentDbIdsForLabels.length === 0
              }
              onClick={() => void handleBulkDisplayLabels()}
            >
              {bulkDisplayingLabels ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Tag className="size-3.5" />
              )}
              Display Labels
              {shipmentDbIdsForLabels.length > 0 ? (
                <span className="tabular-nums opacity-80">({shipmentDbIdsForLabels.length})</span>
              ) : null}
            </Button>
            <Button
              type="button"
              variant="nesy"
              size="sm"
              disabled={loading || !pool || pickupAssignTargets.length === 0}
              onClick={() => {
                setActionError(null);
                setAssignPickupsOpen(true);
              }}
            >
              <Truck className="size-3.5" />
              Assign Pickups
              {pickupAssignTargets.length > 0 ? (
                <span className="tabular-nums opacity-90">({pickupAssignTargets.length})</span>
              ) : null}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

      <HappyPathBulkAssignPickupsDialog
        open={assignPickupsOpen}
        onOpenChange={setAssignPickupsOpen}
        targets={pickupAssignTargets}
        country={scopeCountry}
        environment={scopeEnvironment}
      />
    </>
  );
}
