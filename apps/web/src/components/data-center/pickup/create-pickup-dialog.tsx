"use client";

import { useState, useCallback } from "react";
import { Building2, Package } from "lucide-react";
import { Button } from "@nesy/metronic/components/ui/button";
import { Input } from "@nesy/metronic/components/ui/input";
import { Label } from "@nesy/metronic/components/ui/label";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@nesy/metronic/components/ui/dialog";
import { ScrollArea } from "@nesy/metronic/components/ui/scroll-area";
import { Alert, AlertDescription } from "@nesy/metronic/components/ui/alert";
import { useNesyAuth } from "@/contexts/nesy-auth-context";
import { CustomerSearch } from "@/components/data-center/customer-search";
import { TypeChoiceCard, TypeChoiceGrid } from "@/components/data-center/type-choice-card";
import { getDefaultPickupSettings } from "@/lib/happy-path/shipment-group-settings";
import { createPickup } from "@/services/pickup";
import type { BffCustomerPayload } from "@/services/customer";

interface LogEntry {
  key: string;
  success: boolean;
  message: string;
}

const PICKUP_TYPES = [
  {
    value: "remote" as const,
    title: "Remote Pickup",
    description: "Pickup at a remote address",
    icon: Package,
  },
  {
    value: "customer" as const,
    title: "Pickup At Customer",
    description: "Pickup at customer (PAC)",
    icon: Building2,
  },
];

export function CreatePickupDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}) {
  const { token, country, environment, status: authStatus } = useNesyAuth();
  const defaults = getDefaultPickupSettings();

  const [pickupType, setPickupType] = useState<"remote" | "customer">("remote");
  const [shipmentCount, setShipmentCount] = useState(1);
  const [pickUpDateOffsetDays, setPickUpDateOffsetDays] = useState(
    defaults.pickUpDateOffsetDays,
  );
  const [pickupEndTime, setPickupEndTime] = useState(defaults.pickupEndTime);
  const [parcelWeight, setParcelWeight] = useState(defaults.parcelWeight);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [bffCustomer, setBffCustomer] = useState<BffCustomerPayload | null>(null);

  const isConnected = authStatus === "connected" && !!token;

  const resetForm = useCallback(() => {
    const nextDefaults = getDefaultPickupSettings();
    setPickupType("remote");
    setShipmentCount(1);
    setPickUpDateOffsetDays(nextDefaults.pickUpDateOffsetDays);
    setPickupEndTime(nextDefaults.pickupEndTime);
    setParcelWeight(nextDefaults.parcelWeight);
    setProgress(0);
    setStatusText("");
    setLogs([]);
    setIsProcessing(false);
    setBffCustomer(null);
  }, []);

  const addLog = useCallback((entry: LogEntry) => {
    setLogs((prev) => [...prev, entry]);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!token) return;

    setIsProcessing(true);
    setProgress(0);
    setLogs([]);
    setStatusText("Creating pickup shipment...");

    try {
      setProgress(20);
      addLog({ key: "create-start", success: true, message: "Sending ClientSaveShipment..." });

      const record = await createPickup({
        token,
        country,
        environment,
        pickupType,
        shipmentCount,
        pickUpDateOffsetDays,
        pickupEndTime,
        parcelWeight,
        ...(bffCustomer ? { customer: bffCustomer } : {}),
      });

      setProgress(100);
      setStatusText("Pickup created. Assign from the table when ready.");
      addLog({
        key: "result",
        success: true,
        message: `Shipment: ${record.shipmentId} | Status: ${record.assignStatus}`,
      });

      onCreated?.();
    } catch (error) {
      setProgress(100);
      setStatusText("Pickup creation failed.");
      addLog({
        key: "error",
        success: false,
        message: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [
    token,
    country,
    environment,
    pickupType,
    shipmentCount,
    pickUpDateOffsetDays,
    pickupEndTime,
    parcelWeight,
    bffCustomer,
    onCreated,
    addLog,
  ]);

  const handleClose = useCallback(() => {
    if (isProcessing) return;
    resetForm();
    onOpenChange(false);
  }, [isProcessing, resetForm, onOpenChange]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        handleClose();
      } else {
        onOpenChange(true);
      }
    },
    [handleClose, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Create Pickup</DialogTitle>
        </DialogHeader>

        <DialogBody>
          <ScrollArea className="max-h-[min(60dvh,520px)] pe-2">
            <div className="space-y-6 pe-1">
              {!isConnected && (
                <Alert variant="destructive">
                  <AlertDescription>
                    No Nesy connection found. Connect from the Data Center Connection page.
                  </AlertDescription>
                </Alert>
              )}

              <CustomerSearch
                locale="en"
                disabled={isProcessing}
                onSelect={setBffCustomer}
                onClear={() => setBffCustomer(null)}
              />

              <div className="space-y-2">
                <Label className="text-xs font-medium">Pickup Type</Label>
                <TypeChoiceGrid columns={2}>
                  {PICKUP_TYPES.map((type) => (
                    <TypeChoiceCard
                      key={type.value}
                      title={type.title}
                      description={type.description}
                      icon={type.icon}
                      selected={pickupType === type.value}
                      disabled={isProcessing}
                      onClick={() => setPickupType(type.value)}
                    />
                  ))}
                </TypeChoiceGrid>
              </div>

              <div className="space-y-3 rounded-lg border border-dashed border-border/80 bg-muted/15 p-3">
                <p className="text-xs font-semibold text-foreground">Pickup settings</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs font-medium">Shipment count</Label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={shipmentCount}
                      onChange={(e) =>
                        setShipmentCount(
                          Math.max(1, Number.parseInt(e.target.value, 10) || 1),
                        )
                      }
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Pickup date offset (days)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={pickUpDateOffsetDays}
                      onChange={(e) =>
                        setPickUpDateOffsetDays(
                          Math.max(0, Number.parseInt(e.target.value, 10) || 0),
                        )
                      }
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Pickup end time</Label>
                    <Input
                      type="time"
                      value={pickupEndTime}
                      onChange={(e) => setPickupEndTime(e.target.value || "21:00")}
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-xs font-medium">Parcel weight</Label>
                    <Input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={parcelWeight}
                      onChange={(e) =>
                        setParcelWeight(
                          Math.max(0.1, Number.parseFloat(e.target.value) || 0.1),
                        )
                      }
                      disabled={isProcessing}
                    />
                  </div>
                </div>
              </div>

              {(isProcessing || progress > 0) && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="truncate pe-2">{statusText}</span>
                      <span className="shrink-0 font-medium">{progress}%</span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {logs.length > 0 && (
                    <div className="max-h-[200px] space-y-1 overflow-y-auto rounded-md border bg-muted/30 p-3">
                      {logs.map((log) => (
                        <div
                          key={log.key}
                          className={`font-mono text-xs ${log.success ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
                        >
                          {log.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
            Close
          </Button>
          <Button
            variant="nesy"
            onClick={handleCreate}
            disabled={isProcessing || !isConnected}
          >
            {isProcessing ? `Creating... ${progress}%` : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
