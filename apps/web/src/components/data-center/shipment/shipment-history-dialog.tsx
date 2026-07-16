"use client";

import { X } from "lucide-react";
import { Button } from "@nesy/metronic/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
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
import {
  mapShipmentEventHistory,
  type ShipmentDetailParcel,
  type ShipmentHistoryEvent,
} from "@/lib/nesy-shipment-detail";

function ParcelCellValue({ value }: { value: string }) {
  if (!value || value === "—") {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span className="break-all font-medium">{value}</span>;
}

function CellValue({ value }: { value: string }) {
  if (!value || value === "—") {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span className="whitespace-nowrap">{value}</span>;
}

function HistoryTable({ rows }: { rows: ShipmentHistoryEvent[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No event history found for this shipment.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="min-w-[72px] whitespace-nowrap">Parcel</TableHead>
          <TableHead className="min-w-[90px]">Event Code</TableHead>
          <TableHead className="min-w-[80px]">Weight</TableHead>
          <TableHead className="min-w-[160px]">Event Name</TableHead>
          <TableHead className="min-w-[180px]">Event Description</TableHead>
          <TableHead className="min-w-[180px]">Event Detail</TableHead>
          <TableHead className="min-w-[150px]">Date / Time</TableHead>
          <TableHead className="min-w-[120px]">Hub Name</TableHead>
          <TableHead className="min-w-[120px]">User</TableHead>
          <TableHead className="min-w-[100px]">Channel</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={`${row.eventCode}-${row.timestamp}-${index}`}>
            <TableCell className="align-top">
              <ParcelCellValue value={row.parcelInfo} />
            </TableCell>
            <TableCell>
              <CellValue value={row.eventCode} />
            </TableCell>
            <TableCell>
              <CellValue value={row.weight} />
            </TableCell>
            <TableCell>
              <CellValue value={row.eventName} />
            </TableCell>
            <TableCell className="max-w-[240px] truncate" title={row.eventDescription}>
              <CellValue value={row.eventDescription} />
            </TableCell>
            <TableCell className="max-w-[240px] truncate" title={row.eventDetail}>
              <CellValue value={row.eventDetail} />
            </TableCell>
            <TableCell>
              <CellValue value={row.timestamp} />
            </TableCell>
            <TableCell>
              <CellValue value={row.hubName} />
            </TableCell>
            <TableCell>
              <CellValue value={row.user} />
            </TableCell>
            <TableCell>
              <CellValue value={row.channel} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function ShipmentHistoryDialog({
  open,
  onOpenChange,
  shipmentId,
  eventsRaw,
  parcels = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shipmentId: string;
  eventsRaw: Record<string, unknown> | null;
  parcels?: ShipmentDetailParcel[];
}) {
  const rows = mapShipmentEventHistory(eventsRaw, parcels);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        variant="fullscreen"
        showCloseButton={false}
        className="z-[120] !inset-0 flex h-dvh max-h-dvh w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:rounded-none"
      >
        <DialogHeader className="mb-0 shrink-0 border-b px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold">Event History</DialogTitle>
              <p className="text-sm text-muted-foreground">{shipmentId}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 rounded-full bg-muted text-muted-foreground hover:bg-muted/70"
              aria-label="Close event history"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        <DialogBody className="min-h-0 flex-1 overflow-auto px-5 py-4">
          <HistoryTable rows={rows} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
