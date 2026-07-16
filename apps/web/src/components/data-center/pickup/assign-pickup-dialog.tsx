"use client";

import { useState, useCallback } from "react";
import { Loader2, Truck } from "lucide-react";
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
import { Alert, AlertDescription } from "@nesy/metronic/components/ui/alert";
import { useNesyAuth } from "@/contexts/nesy-auth-context";
import { assignPickup, type PickupRecord } from "@/services/pickup";

export function AssignPickupDialog({
  open,
  onOpenChange,
  pickup,
  filterCountry,
  filterEnvironment,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pickup: PickupRecord | null;
  filterCountry: string;
  filterEnvironment: string;
  onAssigned?: () => void;
}) {
  const { token } = useNesyAuth();
  const [branchId, setBranchId] = useState("");
  const [courierZoneCode, setCourierZoneCode] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setBranchId(pickup?.branchId ?? "");
    setCourierZoneCode(pickup?.courierZoneCode ?? "");
    setError(null);
    setSuccess(null);
    setAssigning(false);
  }, [pickup]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next && pickup) {
        resetState();
      }
      if (!next) {
        setError(null);
        setSuccess(null);
      }
      onOpenChange(next);
    },
    [onOpenChange, pickup, resetState]
  );

  async function handleAssign() {
    if (!pickup || !token) return;
    setAssigning(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await assignPickup({
        pickupDbId: pickup.id,
        token,
        country: filterCountry,
        environment: filterEnvironment,
        branchId: branchId.trim() || undefined,
        courierZoneCode: courierZoneCode.trim() || undefined,
      });
      setSuccess(`Assigned successfully. Task ID: ${result.taskId}`);
      onAssigned?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assign failed.");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="size-5 text-[#ff7a1a]" />
            Assign Pickup
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {pickup ? (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Shipment: <strong className="text-foreground">{pickup.shipmentId}</strong>
              <span className="mx-2">|</span>
              Env: <strong>{filterCountry.toUpperCase()}</strong> /{" "}
              <strong>{filterEnvironment}</strong>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="mb-1 text-xs text-muted-foreground">Branch ID</Label>
              <Input
                placeholder="e.g. 10"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={assigning || !!success}
              />
            </div>
            <div>
              <Label className="mb-1 text-xs text-muted-foreground">Courier Zone Code</Label>
              <Input
                placeholder="e.g. 17"
                value={courierZoneCode}
                onChange={(e) => setCourierZoneCode(e.target.value)}
                disabled={assigning || !!success}
              />
            </div>
          </div>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {success ? (
            <Alert>
              <AlertDescription className="text-green-700">{success}</AlertDescription>
            </Alert>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            {success ? "Done" : "Cancel"}
          </Button>
          {!success ? (
            <Button
              size="sm"
              variant="nesy"
              disabled={assigning || !branchId.trim() || !courierZoneCode.trim()}
              onClick={() => void handleAssign()}
            >
              {assigning ? (
                <Loader2 className="size-4 animate-spin me-1" />
              ) : (
                <Truck className="size-4 me-1" />
              )}
              {assigning ? "Assigning..." : "Assign Pickup"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
