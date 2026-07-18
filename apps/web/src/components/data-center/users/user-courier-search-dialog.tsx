"use client";

import { Barcode, Loader2, Search, UserSearch, X } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nesy/metronic/components/ui/table";
import { Input, InputWrapper } from "@nesy/metronic/components/ui/input";
import type { TrackingSearchResult } from "@/services/nesy-dashboard";

export function UserCourierSearchDialog({
  open,
  onOpenChange,
  country,
  environment,
  legacyBarcodeQuery,
  onLegacyBarcodeChange,
  waybillQuery,
  onWaybillChange,
  loading,
  error,
  steps,
  result,
  onSearch,
  onUseCourier,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  country: string;
  environment: string;
  legacyBarcodeQuery: string;
  onLegacyBarcodeChange: (v: string) => void;
  waybillQuery: string;
  onWaybillChange: (v: string) => void;
  loading: boolean;
  error: string | null;
  steps: string[];
  result: TrackingSearchResult | null;
  onSearch: () => void;
  onUseCourier: (courierName: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="size-5 text-nesy" />
            Get User With Search
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Legacy short barcode
              </label>
              <InputWrapper>
                <Barcode className="size-4 text-muted-foreground" />
                <Input
                  value={legacyBarcodeQuery}
                  onChange={(e) => onLegacyBarcodeChange(e.target.value)}
                  placeholder="e.g. 1910051002061419"
                  onKeyDown={(e) => e.key === "Enter" && onSearch()}
                />
              </InputWrapper>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Waybill / tracking number
              </label>
              <InputWrapper>
                <Search className="size-4 text-muted-foreground" />
                <Input
                  value={waybillQuery}
                  onChange={(e) => onWaybillChange(e.target.value)}
                  placeholder="e.g. 57952343914584"
                  onKeyDown={(e) => e.key === "Enter" && onSearch()}
                />
              </InputWrapper>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="nesy"
                className="h-10"
                disabled={loading || (!legacyBarcodeQuery.trim() && !waybillQuery.trim())}
                onClick={onSearch}
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                Search
              </Button>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Env: <strong>{country.toUpperCase()}</strong> / <strong>{environment}</strong>
          </div>

          {steps.length > 0 ? (
            <div className="space-y-1 rounded-lg border bg-muted/20 px-3 py-2">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-nesy-soft text-[9px] font-bold text-nesy">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {result ? (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-4">
                {[
                  ["Schedule ID", result.scheduleId ?? "—"],
                  ["Courier", result.courierName ?? "—"],
                  ["Task type", result.taskType ?? "—"],
                  ["Task status", result.taskStatus ?? "—"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="mt-1 break-all text-sm font-semibold">{value}</div>
                  </div>
                ))}
              </div>

              {(result.shipmentList?.length ?? 0) > 0 ? (
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Waybill</TableHead>
                        <TableHead className="text-xs">Legacy barcode</TableHead>
                        <TableHead className="text-xs">Sender</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.shipmentList!.map((shipment, idx) => (
                        <TableRow key={shipment.waybillNumber ?? idx}>
                          <TableCell className="text-xs font-medium">
                            {shipment.waybillNumber ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {Array.isArray(shipment.legacyShortBarcode)
                              ? shipment.legacyShortBarcode.join(", ")
                              : (shipment.legacyShortBarcode ?? "—")}
                          </TableCell>
                          <TableCell className="text-xs">
                            {shipment.senderInfo?.name ?? shipment.sender ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            <Badge variant="secondary" appearance="light" size="sm">
                              {shipment.shipmentStatus ?? "—"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  No shipments in this tracking result.
                </p>
              )}
            </div>
          ) : !loading && !error ? (
            <p className="rounded-lg border border-dashed px-5 py-8 text-center text-sm text-muted-foreground">
              Enter a waybill or legacy barcode and search to find the courier.
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            type="button"
            variant="nesy"
            disabled={!result?.courierName}
            onClick={() => {
              const name = result?.courierName ?? "";
              if (name) onUseCourier(name);
              onOpenChange(false);
            }}
          >
            <UserSearch className="size-4" />
            Use this courier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
