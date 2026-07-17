"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  Save,
  Search,
  Trash2,
  Wallet,
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
import { Label } from "@nesy/metronic/components/ui/label";
import { ScrollArea } from "@nesy/metronic/components/ui/scroll-area";
import { Skeleton } from "@nesy/metronic/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@nesy/metronic/components/ui/alert-dialog";
import { cn } from "@nesy/metronic/lib/utils";
import { useNesyAuth } from "@/contexts/nesy-auth-context";
import {
  createOrUpdateCourierWallet,
  deleteCourierWallet,
  fetchCourierWalletById,
  fetchCourierWalletList,
  type CourierWalletDetail,
  type CourierWalletListItem,
} from "@/services/courier-wallets";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function CourierWalletsDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}) {
  const { country, environment } = useNesyAuth();

  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [wallets, setWallets] = useState<CourierWalletListItem[]>([]);
  const [search, setSearch] = useState("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [hubName, setHubName] = useState("");
  const [hubId, setHubId] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [pinVisible, setPinVisible] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CourierWalletListItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const rows = await fetchCourierWalletList(country, environment);
      setWallets(rows);
    } catch (e) {
      setWallets([]);
      setListError(e instanceof Error ? e.message : "Could not load wallets.");
    } finally {
      setListLoading(false);
    }
  }, [country, environment]);

  const resetEditor = useCallback(() => {
    setSelectedId(null);
    setDetailError(null);
    setHubName("");
    setHubId("");
    setUsername("");
    setPin("");
    setPinVisible(false);
    setUpdatedAt(null);
    setSaveMessage(null);
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetailError(null);
    setSaveMessage(null);
    try {
      const d: CourierWalletDetail = await fetchCourierWalletById(id);
      setUsername(d.username);
      setHubName(d.hubName);
      setHubId(d.hubId);
      setPin(d.password);
      setUpdatedAt(d.updatedAt);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Could not load wallet.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      resetEditor();
      setSearch("");
      return;
    }
    void loadList();
  }, [open, loadList, resetEditor]);

  useEffect(() => {
    if (!open || wallets.length === 0) return;
    if (selectedId && wallets.some((w) => w.id === selectedId)) return;
    void loadDetail(wallets[0]!.id);
  }, [open, wallets, selectedId, loadDetail]);

  const filteredWallets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return wallets;
    return wallets.filter((w) => w.username.toLowerCase().includes(q));
  }, [wallets, search]);

  async function handleSave() {
    setSaveMessage(null);
    if (!/^\d{4}$/.test(pin)) {
      setSaveMessage("PIN must be exactly 4 digits.");
      return;
    }
    if (!username.trim() || !hubName.trim()) {
      setSaveMessage("Username and hub name are required.");
      return;
    }
    setSaving(true);
    try {
      await createOrUpdateCourierWallet({
        username: username.trim(),
        password: pin,
        hubName: hubName.trim(),
        hubId: hubId.trim(),
        country,
        environment,
      });
      setSaveMessage("Saved.");
      await loadList();
      if (selectedId) await loadDetail(selectedId);
      onSaved?.();
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCourierWallet(deleteTarget.id);
      if (selectedId === deleteTarget.id) resetEditor();
      setDeleteTarget(null);
      await loadList();
      onSaved?.();
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : "Delete failed.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete courier wallet?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deleteTarget?.username}</strong> from{" "}
              <span className="font-mono text-xs">
                {country}/{environment}
              </span>
              . Auth flows using this wallet will need another entry.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[min(90vh,720px)] max-w-3xl flex-col gap-0 p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Wallet className="size-5 text-nesy" />
              Courier wallets
            </DialogTitle>
            <p className="text-sm font-normal text-muted-foreground">
              Stored in <span className="font-mono text-xs">aras_db</span> for{" "}
              <Badge variant="secondary" appearance="outline" size="sm">
                {country}/{environment}
              </Badge>
            </p>
          </DialogHeader>

          <DialogBody className="flex min-h-0 flex-1 flex-col gap-0 p-0 sm:flex-row">
            <div className="flex min-h-[220px] w-full flex-col border-b sm:max-w-[240px] sm:border-b-0 sm:border-r">
              <div className="p-3 pb-2">
                <InputWrapper>
                  <Search className="size-4 text-muted-foreground" />
                  <Input
                    placeholder="Search username…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </InputWrapper>
              </div>
              <ScrollArea className="min-h-0 flex-1 px-2 pb-3">
                {listLoading ? (
                  <div className="space-y-2 p-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : listError ? (
                  <p className="px-2 py-4 text-sm text-destructive">{listError}</p>
                ) : filteredWallets.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                    {wallets.length === 0
                      ? "No wallets yet. Save one from the user table (Wallet action) or edit fields here after adding via API."
                      : "No matches for search."}
                  </p>
                ) : (
                  <ul className="space-y-0.5">
                    {filteredWallets.map((w) => {
                      const active = w.id === selectedId;
                      return (
                        <li key={w.id}>
                          <button
                            type="button"
                            className={cn(
                              "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                              active
                                ? "bg-nesy-soft text-foreground ring-1 ring-nesy/25"
                                : "hover:bg-muted/80",
                            )}
                            onClick={() => void loadDetail(w.id)}
                          >
                            <span className="truncate font-medium">{w.username}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ScrollArea>
            </div>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col p-5">
              {!selectedId && !detailLoading ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <Wallet className="size-8 opacity-40" />
                  Select a wallet to view and edit PIN / hub details.
                </div>
              ) : detailLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-8 w-2/3" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-1/2" />
                </div>
              ) : detailError ? (
                <p className="text-sm text-destructive">{detailError}</p>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{username}</h3>
                      {updatedAt ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Updated {formatWhen(updatedAt)}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      mode="icon"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete wallet"
                      onClick={() => {
                        const row = wallets.find((w) => w.id === selectedId);
                        if (row) setDeleteTarget(row);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="wallet-username">Username</Label>
                      <Input id="wallet-username" value={username} readOnly className="bg-muted/40" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wallet-hub-id">Hub ID</Label>
                      <Input
                        id="wallet-hub-id"
                        value={hubId}
                        onChange={(e) => setHubId(e.target.value)}
                        className="font-mono text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wallet-hub-name">Hub name</Label>
                      <Input
                        id="wallet-hub-name"
                        value={hubName}
                        onChange={(e) => setHubName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="wallet-pin">PIN (4 digits)</Label>
                      <div className="flex max-w-xs items-center gap-2">
                        <Input
                          id="wallet-pin"
                          type={pinVisible ? "text" : "password"}
                          inputMode="numeric"
                          maxLength={4}
                          autoComplete="off"
                          className="font-mono tracking-[0.35em]"
                          value={pin}
                          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          mode="icon"
                          aria-label={pinVisible ? "Hide PIN" : "Show PIN"}
                          onClick={() => setPinVisible((v) => !v)}
                        >
                          {pinVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Changing hub ID creates a new unique row (username + hub + env). Same key upserts
                        password and hub name.
                      </p>
                    </div>
                  </div>

                  {saveMessage ? (
                    <p
                      className={cn(
                        "text-sm",
                        saveMessage === "Saved." ? "text-nesy" : "text-destructive",
                      )}
                    >
                      {saveMessage}
                    </p>
                  ) : null}

                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Button type="button" variant="nesy" disabled={saving} onClick={() => void handleSave()}>
                      {saving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      Save changes
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void loadList()}>
                      Reload list
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogBody>

          <DialogFooter className="border-t px-5 py-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
