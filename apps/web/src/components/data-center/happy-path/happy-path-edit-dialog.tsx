"use client";

import { useEffect, useState } from "react";
import { Loader2, PenLine } from "lucide-react";
import { Button } from "@nesy/metronic/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@nesy/metronic/components/ui/dialog";
import { Input } from "@nesy/metronic/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@nesy/metronic/components/ui/alert";
import {
  fetchHappyPathPoolById,
  updateHappyPathPool,
  type HappyPathPoolListItem,
} from "@/services/happy-path";
import type { CreateSetReconfigureSeed } from "./create-set-dialog";

export function HappyPathEditDialog({
  open,
  onOpenChange,
  pool,
  onSaved,
  onReconfigure,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pool: HappyPathPoolListItem | null;
  onSaved?: () => void;
  onReconfigure?: (seed: CreateSetReconfigureSeed) => void;
}) {
  const [name, setName] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeCount, setTypeCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !pool) {
      setName("");
      setTypeCount(null);
      setError(null);
      setLoadingMeta(false);
      return;
    }

    setName(pool.name);
    let cancelled = false;
    setLoadingMeta(true);

    fetchHappyPathPoolById(pool.id)
      .then((detail) => {
        if (cancelled) return;
        const ids = detail.meta?.includedTypeIds;
        setTypeCount(Array.isArray(ids) ? ids.length : null);
      })
      .catch(() => {
        if (!cancelled) setTypeCount(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, pool]);

  async function handleSave() {
    if (!pool) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Set name is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await updateHappyPathPool(pool.id, { name: trimmed });
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReconfigure() {
    if (!pool || !onReconfigure) return;

    setSaving(true);
    setError(null);
    try {
      const detail = await fetchHappyPathPoolById(pool.id);
      const includedTypeIds = Array.isArray(detail.meta?.includedTypeIds)
        ? (detail.meta.includedTypeIds as string[])
        : [];
      const modeRaw = detail.assignmentMode ?? detail.meta?.assignmentMode;
      const assignmentMode =
        modeRaw === "recommended" || modeRaw === "custom" || modeRaw === "one"
          ? modeRaw
          : "one";

      onReconfigure({ includedTypeIds, assignmentMode });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load set configuration.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenLine className="size-4 text-nesy" />
            Edit happy path set
          </DialogTitle>
          <DialogDescription>
            Update the display name or reconfigure shipment types in a new generation flow.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Edit set</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="happy-path-set-name">
            Set name
          </label>
          <Input
            id="happy-path-set-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving || !pool}
            placeholder="Happy Path · HR/STAGE · …"
          />
        </div>

        {loadingMeta ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Loading configuration…
          </p>
        ) : typeCount != null ? (
          <p className="text-xs text-muted-foreground">
            This set includes {typeCount} shipment type{typeCount === 1 ? "" : "s"} in its saved
            configuration.
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          {onReconfigure ? (
            <Button
              type="button"
              variant="outline"
              disabled={saving || !pool}
              onClick={() => void handleReconfigure()}
            >
              Reconfigure types
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="nesy"
              disabled={saving || !pool}
              onClick={() => void handleSave()}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
