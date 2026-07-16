"use client";

import { useState, useCallback } from "react";
import { Button } from "@nesy/metronic/components/ui/button";
import { Input } from "@nesy/metronic/components/ui/input";
import { Label } from "@nesy/metronic/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nesy/metronic/components/ui/select";
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
import { createPickup } from "@/services/pickup";
import type { BffCustomerPayload } from "@/services/customer";

interface LogEntry {
  key: string;
  success: boolean;
  message: string;
}

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

  const [pickupType, setPickupType] = useState<"remote" | "customer">("remote");
  const [shipmentCount, setShipmentCount] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [bffCustomer, setBffCustomer] = useState<BffCustomerPayload | null>(null);

  const isConnected = authStatus === "connected" && !!token;

  const resetForm = useCallback(() => {
    setPickupType("remote");
    setShipmentCount(1);
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
  }, [token, country, environment, pickupType, shipmentCount, bffCustomer, onCreated, addLog]);

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
    [handleClose, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[520px]">
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
                <Select
                  value={pickupType}
                  onValueChange={(v) => setPickupType(v as "remote" | "customer")}
                  disabled={isProcessing}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Pickup Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="remote">Remote Pickup</SelectItem>
                    <SelectItem value="customer">Pickup At Customer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">Shipment Count</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={shipmentCount}
                  onChange={(e) =>
                    setShipmentCount(
                      Math.max(1, Number.parseInt(e.target.value, 10) || 1)
                    )
                  }
                  disabled={isProcessing}
                />
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
