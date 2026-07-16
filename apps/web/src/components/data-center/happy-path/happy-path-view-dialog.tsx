"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Package,
  PackagePlus,
  Search,
  SkipForward,
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
import { ScrollArea, ScrollBar } from "@nesy/metronic/components/ui/scroll-area";
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
import { getPickupNesyUrl } from "@/services/pickup";
import { getShipmentNesyUrl } from "@/services/shipment";

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

function HeaderStats({
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
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
            statusFilter === "all"
              ? "border-nesy/35 bg-nesy-soft text-nesy-ink ring-2 ring-nesy/25 ring-offset-1"
              : "border-border bg-background text-muted-foreground hover:bg-muted",
          )}
          onClick={() => onStatusFilter("all")}
        >
          All {stats.total}
        </button>
        {stats.success > 0 ? (
          <button
            type="button"
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
              "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
              statusFilter === "success" && "ring-2 ring-nesy/40 ring-offset-1",
            )}
            onClick={() => onStatusFilter(statusFilter === "success" ? "all" : "success")}
          >
            {stats.success} created
          </button>
        ) : null}
        {stats.failed > 0 ? (
          <button
            type="button"
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
              "border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15",
              statusFilter === "failed" && "ring-2 ring-nesy/40 ring-offset-1",
            )}
            onClick={() => onStatusFilter(statusFilter === "failed" ? "all" : "failed")}
          >
            {stats.failed} failed
          </button>
        ) : null}
        {stats.skipped > 0 ? (
          <button
            type="button"
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
              "border-border bg-muted/60 text-muted-foreground hover:bg-muted",
              statusFilter === "skipped" && "ring-2 ring-nesy/40 ring-offset-1",
            )}
            onClick={() => onStatusFilter(statusFilter === "skipped" ? "all" : "skipped")}
          >
            {stats.skipped} skipped
          </button>
        ) : null}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {formatAssignmentMode(assignmentMode)}
        {typeCount != null ? ` · ${typeCount} types` : ""}
        {stats.skipRoutes > 0 ? ` · ${stats.skipRoutes} not generated` : ""}
      </p>
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

function ProgressStrip({ entries }: { entries: HappyPathPoolEntry[] }) {
  const stats = computeEntryStats(entries);
  if (stats.total === 0) return null;

  const successPct = (stats.success / stats.total) * 100;
  const failedPct = (stats.failed / stats.total) * 100;
  const skippedPct = (stats.skipped / stats.total) * 100;

  return (
    <div
      className="flex h-1 overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`${stats.success} created, ${stats.failed} failed, ${stats.skipped} skipped`}
    >
      {successPct > 0 ? (
        <span className="bg-emerald-500 transition-all" style={{ width: `${successPct}%` }} />
      ) : null}
      {failedPct > 0 ? (
        <span className="bg-destructive transition-all" style={{ width: `${failedPct}%` }} />
      ) : null}
      {skippedPct > 0 ? (
        <span className="bg-muted-foreground/35 transition-all" style={{ width: `${skippedPct}%` }} />
      ) : null}
    </div>
  );
}

function CompactRecordId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex max-w-[88px] items-center gap-0.5 rounded px-1 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-muted"
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
  openingNesy,
  onOpenNesy,
}: {
  index: number;
  entry: HappyPathPoolEntry;
  openingNesy: boolean;
  onOpenNesy: (entry: HappyPathPoolEntry) => void;
}) {
  const recordId = getEntryRecordId(entry);
  const hasRecord = !!recordId;
  const isUnloaded =
    entry.route === "shipment" &&
    entry.unloadStatus?.trim() === "unloaded";

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
            {isUnloaded ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-700">
                    <Check className="size-3" strokeWidth={2.5} />
                  </span>
                </TooltipTrigger>
                <TooltipContent>Unloaded</TooltipContent>
              </Tooltip>
            ) : null}
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
          {recordId ? <CompactRecordId id={recordId} /> : (
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
    <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-muted/80 px-5 py-2 backdrop-blur-sm sm:px-6">
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
  const [pool, setPool] = useState<HappyPathPoolDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingNesyKey, setOpeningNesyKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [routeFilter, setRouteFilter] = useState<RouteFilter>("all");

  useEffect(() => {
    if (!open || !poolId) {
      setPool(null);
      setError(null);
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
      return (
        entry.label.toLowerCase().includes(normalized) ||
        entry.typeId.toLowerCase().includes(normalized) ||
        entry.route.toLowerCase().includes(normalized) ||
        recordId.toLowerCase().includes(normalized) ||
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

  const clearListFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setRouteFilter("all");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex h-[min(92vh,900px)] max-h-[92vh] w-[min(96vw,52rem)] max-w-none flex-col gap-0 overflow-hidden p-0"
      >
        <DialogHeader className="shrink-0 space-y-0 border-b px-4 py-3 sm:px-5">
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
              {pool && stats ? (
                <>
                  <div className="mt-3">
                    <ProgressStrip entries={pool.entries} />
                  </div>
                  <HeaderStats
                    stats={stats}
                    assignmentMode={pool.assignmentMode}
                    typeCount={includedTypeCount}
                    statusFilter={statusFilter}
                    onStatusFilter={setStatusFilter}
                  />
                </>
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

          {loading ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading…
            </div>
          ) : pool && stats ? (
            <>
              <div className="shrink-0 border-b bg-muted/10 px-5 py-2.5 sm:px-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="inline-flex max-w-full flex-wrap rounded-lg border bg-background p-0.5">
                    {routeTabs.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={cn(
                          "whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                          routeFilter === tab.id
                            ? "bg-nesy text-white shadow-sm"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                        onClick={() => setRouteFilter(tab.id)}
                      >
                        {tab.label}
                        <span
                          className={cn(
                            "ms-1.5 inline-flex size-5 min-w-5 items-center justify-center rounded-full tabular-nums text-[10px] font-semibold leading-none",
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

                  <InputWrapper className="min-w-0 flex-1 sm:min-w-[12rem]" variant="sm">
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
                                openingNesy={openingNesyKey === entry.id}
                                onOpenNesy={handleOpenNesy}
                              />
                            );
                          })}
                        </ul>
                      </div>
                    ));
                  })()}
                  <ScrollBar orientation="vertical" />
                </ScrollArea>
              )}
            </>
          ) : !error ? (
            <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              No details available.
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter className="shrink-0 border-t px-4 py-2 sm:px-5">
          <p className="me-auto hidden text-[11px] text-muted-foreground sm:block">
            Row click opens Nesy · Copy id from record chip
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
