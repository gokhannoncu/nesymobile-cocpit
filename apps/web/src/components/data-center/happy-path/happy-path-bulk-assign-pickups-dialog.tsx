"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Truck, XCircle } from "lucide-react";
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
import { assignPickup, fetchPickups, type PickupRecord } from "@/services/pickup";

export type HappyPathPickupAssignTarget = {
  pickupDbId: string;
  label: string;
};

type RowResult =
  | { pickupDbId: string; label: string; status: "pending" }
  | { pickupDbId: string; label: string; status: "running" }
  | { pickupDbId: string; label: string; status: "success"; taskId: string }
  | { pickupDbId: string; label: string; status: "failed"; error: string }
  | { pickupDbId: string; label: string; status: "skipped"; reason: string };

export function HappyPathBulkAssignPickupsDialog({
  open,
  onOpenChange,
  targets,
  country,
  environment,
  onFinished,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: HappyPathPickupAssignTarget[];
  country: string;
  environment: string;
  onFinished?: () => void;
}) {
  const { token } = useNesyAuth();
  const [branchId, setBranchId] = useState("");
  const [courierZoneCode, setCourierZoneCode] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<RowResult[]>([]);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const resetForOpen = useCallback(async () => {
    setBranchId("");
    setCourierZoneCode("");
    setFatalError(null);
    setDone(false);
    setRunning(false);
    setRows(
      targets.map((t) => ({
        pickupDbId: t.pickupDbId,
        label: t.label,
        status: "pending" as const,
      })),
    );

    if (targets.length === 0) return;

    setLoadingMeta(true);
    try {
      const pickups = await fetchPickups({ country, environment });
      const byId = new Map(pickups.map((p) => [p.id, p]));
      let prefill: PickupRecord | undefined;
      for (const t of targets) {
        const rec = byId.get(t.pickupDbId);
        if (rec) {
          prefill = rec;
          break;
        }
      }
      if (prefill) {
        setBranchId(prefill.branchId?.trim() ?? "");
        setCourierZoneCode(prefill.courierZoneCode?.trim() ?? "");
      }
    } catch {
      // Prefill optional
    } finally {
      setLoadingMeta(false);
    }
  }, [country, environment, targets]);

  useEffect(() => {
    if (open) {
      void resetForOpen();
    }
  }, [open, resetForOpen]);

  async function runBatch() {
    if (!token || targets.length === 0) return;
    const branch = branchId.trim();
    const zone = courierZoneCode.trim();
    if (!branch || !zone) return;

    setRunning(true);
    setDone(false);
    setFatalError(null);

    const pickups = await fetchPickups({ country, environment }).catch(() => [] as PickupRecord[]);
    const byId = new Map(pickups.map((p) => [p.id, p]));

    for (let i = 0; i < targets.length; i += 1) {
      const target = targets[i];
      if (!target) continue;
      const record = byId.get(target.pickupDbId);

      if (record?.assignStatus === "Assigned") {
        setRows((prev) =>
          prev.map((row, idx) =>
            idx === i
              ? {
                  pickupDbId: target.pickupDbId,
                  label: target.label,
                  status: "skipped",
                  reason: "Already assigned",
                }
              : row,
          ),
        );
        continue;
      }

      setRows((prev) =>
        prev.map((row, idx) =>
          idx === i ? { ...row, status: "running" as const } : row,
        ),
      );

      try {
        const result = await assignPickup({
          pickupDbId: target.pickupDbId,
          token,
          country,
          environment,
          branchId: branch,
          courierZoneCode: zone,
        });
        setRows((prev) =>
          prev.map((row, idx) =>
            idx === i
              ? {
                  pickupDbId: target.pickupDbId,
                  label: target.label,
                  status: "success",
                  taskId: result.taskId,
                }
              : row,
          ),
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : "Assign failed.";
        setRows((prev) =>
          prev.map((row, idx) =>
            idx === i
              ? {
                  pickupDbId: target.pickupDbId,
                  label: target.label,
                  status: "failed",
                  error: message,
                }
              : row,
          ),
        );
      }
    }

    setRunning(false);
    setDone(true);
    onFinished?.();
  }

  const successCount = rows.filter((r) => r.status === "success").length;
  const failedCount = rows.filter((r) => r.status === "failed").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,640px)] max-w-[480px] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-3 sm:px-5">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Truck className="size-5 text-nesy" />
            Assign pickups
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          <p className="text-xs text-muted-foreground">
            {targets.length} pickup{targets.length === 1 ? "" : "s"} in this set ·{" "}
            {country.toUpperCase()} / {environment}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 text-xs text-muted-foreground">Branch ID</Label>
              <Input
                placeholder="e.g. 10"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={running || done || loadingMeta}
              />
            </div>
            <div>
              <Label className="mb-1 text-xs text-muted-foreground">Courier Zone Code</Label>
              <Input
                placeholder="e.g. 17"
                value={courierZoneCode}
                onChange={(e) => setCourierZoneCode(e.target.value)}
                disabled={running || done || loadingMeta}
              />
            </div>
          </div>

          {fatalError ? (
            <Alert variant="destructive">
              <AlertDescription>{fatalError}</AlertDescription>
            </Alert>
          ) : null}

          {done ? (
            <Alert>
              <AlertDescription>
                {successCount} assigned
                {failedCount > 0 ? ` · ${failedCount} failed` : ""}.
              </AlertDescription>
            </Alert>
          ) : null}

          <ul className="divide-y rounded-lg border text-sm">
            {rows.map((row) => (
              <li
                key={row.pickupDbId}
                className="flex items-start gap-2 px-3 py-2"
              >
                <span className="mt-0.5 shrink-0">
                  {row.status === "running" ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : row.status === "success" ? (
                    <Check className="size-4 text-emerald-600" />
                  ) : row.status === "failed" ? (
                    <XCircle className="size-4 text-destructive" />
                  ) : row.status === "skipped" ? (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  ) : (
                    <span className="inline-block size-4 rounded-full border border-muted-foreground/30" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{row.label}</p>
                  {row.status === "failed" ? (
                    <p className="text-xs text-destructive">{row.error}</p>
                  ) : row.status === "skipped" ? (
                    <p className="text-xs text-muted-foreground">{row.reason}</p>
                  ) : row.status === "success" ? (
                    <p className="font-mono text-[10px] text-muted-foreground">{row.taskId}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </DialogBody>

        <DialogFooter className="border-t px-4 py-2 sm:px-5">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {done ? "Close" : "Cancel"}
          </Button>
          {!done ? (
            <Button
              type="button"
              size="sm"
              variant="nesy"
              disabled={
                running ||
                loadingMeta ||
                targets.length === 0 ||
                !branchId.trim() ||
                !courierZoneCode.trim() ||
                !token
              }
              onClick={() => {
                if (!token) {
                  setFatalError("Connect to Nesy before assigning pickups.");
                  return;
                }
                void runBatch();
              }}
            >
              {running ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Assigning…
                </>
              ) : (
                <>
                  <Truck className="size-4" />
                  Assign {targets.length} pickup{targets.length === 1 ? "" : "s"}
                </>
              )}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
