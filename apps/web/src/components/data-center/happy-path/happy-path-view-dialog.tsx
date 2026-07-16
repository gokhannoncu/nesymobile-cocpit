"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  PackagePlus,
  Search,
  SkipForward,
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
import {
  fetchHappyPathPoolById,
  type HappyPathPoolDetail,
  type HappyPathPoolEntry,
  type HappyPathPoolListItem,
} from "@/services/happy-path";
import { getPickupNesyUrl } from "@/services/pickup";
import { getShipmentNesyUrl } from "@/services/shipment";

type StatusFilter = "all" | "success" | "failed" | "skipped" | "issues";

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
  if (status === "success") return "Success";
  if (status === "failed") return "Failed";
  if (status === "skipped") return "Skipped";
  if (status === "running") return "Running";
  return status;
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
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function computeEntryStats(entries: HappyPathPoolEntry[]) {
  let success = 0;
  let failed = 0;
  let skipped = 0;
  for (const entry of entries) {
    if (entry.status === "success") success += 1;
    else if (entry.status === "failed") failed += 1;
    else if (entry.status === "skipped") skipped += 1;
  }
  return { success, failed, skipped, total: entries.length };
}

function matchesStatusFilter(entry: HappyPathPoolEntry, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "issues") return entry.status === "failed" || entry.status === "skipped";
  return entry.status === filter;
}

function CompactRecordId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(id);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex max-w-full items-center gap-1 rounded-md px-1 py-0.5 font-mono text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          onClick={() => void handleCopy()}
        >
          <span className="truncate">{shortenId(id)}</span>
          <Copy className="size-3 shrink-0 opacity-60" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm break-all font-mono text-xs">
        {copied ? "Copied" : id}
      </TooltipContent>
    </Tooltip>
  );
}

function SummaryStrip({ pool }: { pool: HappyPathPoolDetail }) {
  const stats = computeEntryStats(pool.entries);
  const includedCount = Array.isArray(pool.meta?.includedTypeIds)
    ? (pool.meta.includedTypeIds as string[]).length
    : null;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Badge variant="outline" appearance="outline" size="sm" className="font-mono">
        {pool.country} · {pool.environment}
      </Badge>
      <Badge variant="success" appearance="light" size="sm">
        {stats.success} success
      </Badge>
      {stats.failed > 0 ? (
        <Badge variant="destructive" appearance="light" size="sm">
          {stats.failed} failed
        </Badge>
      ) : null}
      {stats.skipped > 0 ? (
        <Badge variant="secondary" appearance="light" size="sm">
          {stats.skipped} skipped
        </Badge>
      ) : null}
      <span className="text-muted-foreground">·</span>
      <span className="text-muted-foreground">
        {formatAssignmentMode(pool.assignmentMode)}
        {includedCount != null ? ` · ${includedCount} types` : ""}
      </span>
      <span className="hidden text-muted-foreground sm:inline">·</span>
      <span className="hidden text-xs text-muted-foreground sm:inline">{pool.createdDate}</span>
    </div>
  );
}

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "success", label: "Success" },
  { id: "failed", label: "Failed" },
  { id: "skipped", label: "Skipped" },
  { id: "issues", label: "Needs attention" },
];

function EntriesToolbar({
  total,
  shown,
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
}: {
  total: number;
  shown: number;
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
}) {
  return (
    <div className="shrink-0 space-y-3 border-b bg-muted/20 px-3 py-3 sm:px-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Generated items</h3>
          <p className="text-xs text-muted-foreground">
            {shown === total
              ? `${total} item${total === 1 ? "" : "s"}`
              : `Showing ${shown} of ${total}`}
          </p>
        </div>
        <InputWrapper className="w-full sm:max-w-xs" variant="sm">
          <Search className="size-4" />
          <Input
            placeholder="Filter by type or id…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
          {query ? (
            <Button
              type="button"
              variant="dim"
              size="sm"
              className="-me-2"
              aria-label="Clear filter"
              onClick={() => onQueryChange("")}
            >
              <X className="size-3.5" />
            </Button>
          ) : null}
        </InputWrapper>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={statusFilter === item.id ? "nesy" : "outline"}
            className="h-7 px-2.5 text-xs"
            onClick={() => onStatusFilterChange(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

function EntryRow({
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
  const showUnload =
    entry.unloadStatus?.trim() &&
    entry.unloadStatus !== "none" &&
    entry.route === "shipment";

  return (
    <tr className="border-b border-border/60 last:border-b-0 hover:bg-muted/25">
      <td className="w-10 px-2 py-2 text-center text-xs tabular-nums text-muted-foreground">
        {index + 1}
      </td>
      <td className="min-w-[140px] max-w-[220px] px-2 py-2">
        <div className="truncate text-sm font-medium text-foreground" title={entry.label}>
          {entry.label}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          <Badge variant="outline" appearance="outline" size="sm" className="h-5 px-1.5 text-[10px] capitalize">
            {entry.route}
          </Badge>
          <span className="truncate text-[10px] text-muted-foreground" title={entry.typeId}>
            {entry.typeId}
          </span>
        </div>
      </td>
      <td className="whitespace-nowrap px-2 py-2">
        <Badge variant={entryStatusVariant(entry.status)} appearance="light" size="sm">
          {formatEntryStatus(entry.status)}
        </Badge>
      </td>
      <td className="min-w-[100px] max-w-[140px] px-2 py-2">
        {recordId ? <CompactRecordId id={recordId} /> : <span className="text-xs text-muted-foreground">—</span>}
      </td>
      <td className="hidden whitespace-nowrap px-2 py-2 text-xs text-muted-foreground md:table-cell">
        {showUnload ? entry.unloadStatus : "—"}
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-end">
        <div className="flex items-center justify-end gap-0.5">
          {entry.error ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex size-8 items-center justify-center text-destructive">
                  <AlertCircle className="size-4" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs text-xs">
                {entry.error}
              </TooltipContent>
            </Tooltip>
          ) : null}
          {hasRecord ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={openingNesy}
                  aria-label="Open in Nesy Dashboard"
                  onClick={() => onOpenNesy(entry)}
                >
                  {openingNesy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ExternalLink className="size-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open in Nesy</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </td>
    </tr>
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

  useEffect(() => {
    if (!open || !poolId) {
      setPool(null);
      setError(null);
      setLoading(false);
      setQuery("");
      setStatusFilter("all");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setQuery("");
    setStatusFilter("all");

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

  const filteredEntries = useMemo(() => {
    if (!pool) return [];
    const normalized = query.trim().toLowerCase();

    return pool.entries.filter((entry) => {
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
  }, [pool, query, statusFilter]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(92vh,880px)] max-h-[92vh] w-[min(96vw,56rem)] max-w-none flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-nesy-soft text-nesy sm:size-10 sm:rounded-xl">
                <PackagePlus className="size-4 sm:size-5" />
              </span>
              <div className="min-w-0 space-y-1">
                <DialogTitle className="line-clamp-2 text-sm font-semibold leading-snug sm:text-base">
                  {title}
                </DialogTitle>
                {pool ? <SummaryStrip pool={pool} /> : (
                  <p className="text-xs text-muted-foreground sm:text-sm">
                    Generated scenarios and linked records
                  </p>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 rounded-full"
              aria-label="Close"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        <DialogBody className="flex min-h-0 flex-1 flex-col overflow-hidden px-0 py-0">
          {error ? (
            <Alert variant="destructive" className="mx-4 mt-3 shrink-0 sm:mx-5">
              <AlertTitle>Happy path set</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {loading ? (
            <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading set details…
            </div>
          ) : pool ? (
            <section className="flex min-h-0 flex-1 flex-col border-t">
              <EntriesToolbar
                total={pool.entries.length}
                shown={filteredEntries.length}
                query={query}
                onQueryChange={setQuery}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
              />

              {filteredEntries.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-12 text-center">
                  <Search className="size-8 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-foreground">No items match your filters</p>
                  <p className="text-xs text-muted-foreground">
                    Try another status tab or clear the search field.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQuery("");
                      setStatusFilter("all");
                    }}
                  >
                    Reset filters
                  </Button>
                </div>
              ) : (
                <ScrollArea className="min-h-0 flex-1">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 border-b bg-background/95 text-left text-xs font-medium text-muted-foreground backdrop-blur-sm">
                      <tr>
                        <th className="w-10 px-2 py-2.5">#</th>
                        <th className="px-2 py-2.5">Type</th>
                        <th className="px-2 py-2.5">Status</th>
                        <th className="px-2 py-2.5">Record</th>
                        <th className="hidden px-2 py-2.5 md:table-cell">Unload</th>
                        <th className="w-16 px-2 py-2.5 text-end" aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((entry, index) => (
                        <EntryRow
                          key={entry.id}
                          index={index}
                          entry={entry}
                          openingNesy={openingNesyKey === entry.id}
                          onOpenNesy={handleOpenNesy}
                        />
                      ))}
                    </tbody>
                  </table>
                  <ScrollBar orientation="horizontal" />
                </ScrollArea>
              )}
            </section>
          ) : !error ? (
            <p className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              No details available for this set.
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter className="shrink-0 border-t px-4 py-2.5 sm:px-5">
          {pool ? (
            <p className="me-auto hidden text-xs text-muted-foreground sm:block">
              {computeEntryStats(pool.entries).success > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  {pool.shipmentCount} successful shipment
                  {pool.shipmentCount === 1 ? "" : "s"} in set
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <SkipForward className="size-3.5" />
                  No successful shipments in this set
                </span>
              )}
            </p>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
