"use client";

import { useMemo } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nesy/metronic/components/ui/select";
import type { SavedMobileDevice } from "@/services/mobile-devices";

export function UserSavedDeviceDialog({
  open,
  onOpenChange,
  devices,
  loading,
  selectedId,
  onSelectedIdChange,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  devices: SavedMobileDevice[];
  loading: boolean;
  selectedId: string;
  onSelectedIdChange: (id: string) => void;
  onApply: () => void;
}) {
  const selected = useMemo(
    () => devices.find((d) => d.id === selectedId) ?? null,
    [devices, selectedId],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select saved device</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Select
            value={selectedId}
            onValueChange={onSelectedIdChange}
            disabled={loading || devices.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder={loading ? "Loading…" : "Select device"} />
            </SelectTrigger>
            <SelectContent>
              {devices.map((device) => (
                <SelectItem key={device.id} value={device.id}>
                  {device.deviceId} | {device.modelName}
                  {device.adbDeviceId ? ` | ${device.adbDeviceId}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-xs">
              <p className="font-mono text-foreground">{selected.deviceId}</p>
              <p className="mt-1 text-muted-foreground">
                {selected.modelName}
                {selected.adbDeviceId ? ` | ${selected.adbDeviceId}` : ""}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {loading ? "Loading saved devices…" : "No device selected."}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="nesy" disabled={!selected} onClick={onApply}>
            Use device
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
