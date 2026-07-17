"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  RefreshCw,
  Search,
  UserSearch,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@nesy/metronic/components/ui/badge";
import { Button } from "@nesy/metronic/components/ui/button";
import { Card, CardContent } from "@nesy/metronic/components/ui/card";
import { Input, InputWrapper } from "@nesy/metronic/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nesy/metronic/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nesy/metronic/components/ui/table";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@nesy/metronic/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@nesy/metronic/components/ui/dialog";
import {
  Alert,
  AlertDescription,
} from "@nesy/metronic/components/ui/alert";
import { cn } from "@nesy/metronic/lib/utils";
import { useNesyAuth } from "@/contexts/nesy-auth-context";
import { createOrUpdateCourierWallet } from "@/services/courier-wallets";
import { fetchMobileDevices, type SavedMobileDevice } from "@/services/mobile-devices";
import { loginNesyMobileDevice } from "@/services/nesy-mobile-auth";
import type { NesyMobileCountry } from "@/services/nesy-mobile-env";
import {
  buildCourierHubManageUserPayload,
  dashboardManageUser,
  fetchCourierDeviceInfo,
  fetchDashboardHubs,
  fetchDashboardMyPin,
  fetchDashboardRoles,
  fetchDashboardUserDevicePin,
  fetchDashboardUsers,
  fetchUserDevices,
  normalizeDashboardUser,
  searchShipmentByLegacyBarcode,
  searchTrackingByWaybill,
  setUserDevicesOnNesy,
  type NesyDashboardAuth,
  type NesyHubOption,
  type NesyRoleOption,
  type TrackingSearchResult,
} from "@/services/nesy-dashboard";
import { UserCourierSearchDialog } from "./user-courier-search-dialog";
import { UserDetailPanel } from "./user-detail-panel";
import { UserSavedDeviceDialog } from "./user-saved-device-dialog";
import type { DashboardUserRow } from "./types";

const MOBILE_SIM_COUNTRIES = new Set<string>(["HR", "SI", "RS", "BA", "ME"]);

function isMobileSimCountry(code: string): code is NesyMobileCountry {
  return MOBILE_SIM_COUNTRIES.has(code);
}

type FlashNotice = { variant: "success" | "destructive" | "warning"; message: string };

function useFlashNotice() {
  const [flash, setFlash] = useState<FlashNotice | null>(null);
  const toast = useMemo(
    () => ({
      success: (message: string) => setFlash({ variant: "success", message }),
      error: (message: string) => setFlash({ variant: "destructive", message }),
      warning: (message: string) => setFlash({ variant: "warning", message }),
    }),
    [],
  );

  useEffect(() => {
    if (!flash) return;
    const timerId = window.setTimeout(() => setFlash(null), 2000);
    return () => window.clearTimeout(timerId);
  }, [flash]);

  return { flash, setFlash, toast };
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={status === "Active" ? "success" : "warning"} appearance="light" size="sm">
      {status}
    </Badge>
  );
}

export function UserOperationsWorkspace({ refreshKey }: { refreshKey?: number }) {
  const {
    status,
    token,
    country,
    environment,
    user: authUser,
    sessionUserId,
    connect,
  } = useNesyAuth();

  const { flash, setFlash, toast } = useFlashNotice();

  const [roles, setRoles] = useState<NesyRoleOption[]>([]);
  const [hubs, setHubs] = useState<NesyHubOption[]>([]);
  const [users, setUsers] = useState<DashboardUserRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [hubFilter, setHubFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "passive">("active");

  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [selectedUser, setSelectedUser] = useState<DashboardUserRow | null>(null);
  const [deviceByUserId, setDeviceByUserId] = useState<Record<string, number>>({});
  const [panelDevices, setPanelDevices] = useState<string[]>([]);
  const [panelDevicesLoading, setPanelDevicesLoading] = useState(false);
  const [panelDeviceInfo, setPanelDeviceInfo] = useState<Awaited<
    ReturnType<typeof fetchCourierDeviceInfo>
  > | null>(null);
  const [panelDeviceInfoLoading, setPanelDeviceInfoLoading] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState("");
  const [deviceMutationLoading, setDeviceMutationLoading] = useState(false);
  const [devicePendingRemoval, setDevicePendingRemoval] = useState<string | null>(null);

  const [savedDeviceDialogOpen, setSavedDeviceDialogOpen] = useState(false);
  const [savedDevices, setSavedDevices] = useState<SavedMobileDevice[]>([]);
  const [savedDevicesLoading, setSavedDevicesLoading] = useState(false);
  const [selectedSavedDeviceId, setSelectedSavedDeviceId] = useState("__none__");

  const [panelPin, setPanelPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [simDeviceId, setSimDeviceId] = useState("");
  const [simPin, setSimPin] = useState("");
  const [authSimLoading, setAuthSimLoading] = useState(false);
  const [authSimResult, setAuthSimResult] = useState<unknown>(null);
  const [pinsJsonExpanded, setPinsJsonExpanded] = useState(false);

  const [hubSwitchOpen, setHubSwitchOpen] = useState(false);
  const [hubSwitchMessage, setHubSwitchMessage] = useState("");

  const [trackingModalOpen, setTrackingModalOpen] = useState(false);
  const [legacyBarcodeQuery, setLegacyBarcodeQuery] = useState("");
  const [waybillQuery, setWaybillQuery] = useState("");
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingResult, setTrackingResult] = useState<TrackingSearchResult | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [trackingSteps, setTrackingSteps] = useState<string[]>([]);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(searchText.trim()), 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchText]);

  useEffect(() => {
    setPageIndex(0);
  }, [debouncedSearch]);

  const auth = useMemo((): NesyDashboardAuth | null => {
    if (!token) return null;
    return { token, country, environment };
  }, [token, country, environment]);

  const hubIdsPayload = useMemo(() => {
    if (hubFilter === "all") return [];
    const hub = hubs.find((h) => h.hubId === hubFilter);
    if (!hub) return [];
    const idNum = Number(hub.hubId);
    return [{ Id: Number.isFinite(idNum) ? idNum : 0, Value: hub.hubName }];
  }, [hubFilter, hubs]);

  const rolesPayload = useMemo(() => (roleFilter === "all" ? [] : [roleFilter]), [roleFilter]);

  const loadMeta = useCallback(
    async (sessionAuth?: NesyDashboardAuth) => {
      const a = sessionAuth ?? auth;
      if (!a) return;
      setMetaLoading(true);
      try {
        const [r, h] = await Promise.all([fetchDashboardRoles(a), fetchDashboardHubs(a)]);
        setRoles(r);
        setHubs(h);
      } catch {
        setRoles([]);
        setHubs([]);
      } finally {
        setMetaLoading(false);
      }
    },
    [auth],
  );

  const loadUsers = useCallback(
    async (sessionAuth?: NesyDashboardAuth) => {
      const a = sessionAuth ?? auth;
      if (!a) return;
      setListLoading(true);
      setListError(null);
      try {
        const { items, totalCount: tc } = await fetchDashboardUsers(a, {
          includePassiveUsers: statusFilter === "passive",
          fullName: debouncedSearch,
          roles: rolesPayload,
          hubIds: hubIdsPayload,
          skipCount: pageIndex * pageSize,
          maxResultCount: pageSize,
        });
        const mapped = items.map((row) => normalizeDashboardUser(row));
        setUsers(mapped);
        setTotalCount(tc);
        setDeviceByUserId({});
        setSelectedUser((prev) => {
          if (!prev) return mapped[0] ?? null;
          const still = mapped.find((u) => u.userId === prev.userId);
          return still ?? mapped[0] ?? null;
        });
      } catch (e) {
        setUsers([]);
        setTotalCount(0);
        setListError(e instanceof Error ? e.message : "Could not load users.");
      } finally {
        setListLoading(false);
      }
    },
    [auth, debouncedSearch, rolesPayload, hubIdsPayload, statusFilter, pageIndex, pageSize],
  );

  useEffect(() => {
    if (status === "connected" && auth) void loadMeta();
  }, [status, auth, loadMeta]);

  useEffect(() => {
    if (status === "connected" && auth) void loadUsers();
  }, [status, auth, loadUsers]);

  useEffect(() => {
    if (!refreshKey || !auth) return;
    void loadMeta();
    void loadUsers();
  }, [refreshKey, auth, loadMeta, loadUsers]);

  useEffect(() => {
    if (status !== "connected" || !auth || users.length === 0) return;
    let cancelled = false;
    void (async () => {
      const next: Record<string, number> = {};
      await Promise.all(
        users.map(async (u) => {
          try {
            const { devices } = await fetchUserDevices(auth, u.userId);
            next[u.userId] = devices.length;
          } catch {
            next[u.userId] = 0;
          }
        }),
      );
      if (!cancelled) setDeviceByUserId(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [status, auth, users]);

  useEffect(() => {
    if (!auth || !selectedUser) {
      setPanelDevices([]);
      return;
    }
    let cancelled = false;
    setPanelDevicesLoading(true);
    void (async () => {
      try {
        const { devices } = await fetchUserDevices(auth, selectedUser.userId);
        if (!cancelled) setPanelDevices(devices);
      } catch {
        if (!cancelled) setPanelDevices([]);
      } finally {
        if (!cancelled) setPanelDevicesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, selectedUser]);

  useEffect(() => {
    if (!auth || !selectedUser) {
      setPanelDeviceInfo(null);
      setPanelDeviceInfoLoading(false);
      return;
    }
    let cancelled = false;
    setPanelDeviceInfoLoading(true);
    void (async () => {
      try {
        const info = await fetchCourierDeviceInfo(auth, selectedUser.userId);
        if (!cancelled) setPanelDeviceInfo(info);
      } catch {
        if (!cancelled) setPanelDeviceInfo(null);
      } finally {
        if (!cancelled) setPanelDeviceInfoLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [auth, selectedUser]);

  useEffect(() => {
    setNewDeviceId("");
  }, [selectedUser?.userId]);

  const isPanelSelf = useMemo(() => {
    const a = authUser?.username?.trim().toLowerCase();
    const b = selectedUser?.username?.trim().toLowerCase();
    return Boolean(a && b && a === b);
  }, [authUser?.username, selectedUser?.username]);

  const loadPanelPin = useCallback(
    async (sessionAuth?: NesyDashboardAuth) => {
      const a = sessionAuth ?? auth;
      if (!a || !selectedUser) {
        setPanelPin("");
        return;
      }
      setPinLoading(true);
      try {
        const { pin } = isPanelSelf
          ? await fetchDashboardMyPin(a)
          : await fetchDashboardUserDevicePin(a, selectedUser.userId);
        setPanelPin(pin);
      } catch {
        setPanelPin("");
        toast.error("PIN could not be loaded.");
      } finally {
        setPinLoading(false);
      }
    },
    [auth, selectedUser, isPanelSelf],
  );

  useEffect(() => {
    void loadPanelPin();
  }, [loadPanelPin]);

  useEffect(() => {
    if (panelDevices.length === 0) {
      setSimDeviceId("");
      return;
    }
    setSimDeviceId((prev) => (prev && panelDevices.includes(prev) ? prev : panelDevices[0]!));
  }, [panelDevices]);

  useEffect(() => {
    setSimPin("");
    setAuthSimResult(null);
    setPinsJsonExpanded(false);
  }, [selectedUser?.userId]);

  const refreshPanelDevices = useCallback(async () => {
    if (!auth || !selectedUser) return;
    const { devices } = await fetchUserDevices(auth, selectedUser.userId);
    setPanelDevices(devices);
    setDeviceByUserId((prev) => ({ ...prev, [selectedUser.userId]: devices.length }));
  }, [auth, selectedUser]);

  const handleAddDevice = useCallback(async () => {
    if (!auth || !selectedUser) {
      toast.error("Select a user first.");
      return;
    }
    const id = newDeviceId.trim();
    if (!id) {
      toast.error("Enter a device ID.");
      return;
    }
    if (panelDevices.includes(id)) {
      toast.warning("Device already registered.");
      return;
    }
    setDeviceMutationLoading(true);
    try {
      await setUserDevicesOnNesy(auth, {
        userId: selectedUser.userId,
        devices: [...panelDevices, id],
        addedDeviceId: id,
      });
      toast.success("Device added.");
      setNewDeviceId("");
      await refreshPanelDevices();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add device.");
    } finally {
      setDeviceMutationLoading(false);
    }
  }, [auth, selectedUser, newDeviceId, panelDevices, refreshPanelDevices]);

  const executeRemoveDevice = useCallback(
    async (deviceId: string) => {
      if (!auth || !selectedUser) return;
      setDeviceMutationLoading(true);
      try {
        const next = panelDevices.filter((d) => d !== deviceId);
        await setUserDevicesOnNesy(auth, { userId: selectedUser.userId, devices: next });
        toast.success("Device removed.");
        await refreshPanelDevices();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not remove device.");
      } finally {
        setDeviceMutationLoading(false);
      }
    },
    [auth, selectedUser, panelDevices, refreshPanelDevices],
  );

  async function openSavedDeviceDialog() {
    setSavedDeviceDialogOpen(true);
    setSavedDevicesLoading(true);
    try {
      const devices = await fetchMobileDevices();
      setSavedDevices(devices);
      setSelectedSavedDeviceId(devices[0]?.id ?? "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load saved devices.");
      setSavedDevices([]);
    } finally {
      setSavedDevicesLoading(false);
    }
  }

  function applySavedDeviceSelection() {
    const device = savedDevices.find((d) => d.id === selectedSavedDeviceId);
    if (!device) {
      toast.error("Select a saved device.");
      return;
    }
    setNewDeviceId(device.deviceId);
    setSavedDeviceDialogOpen(false);
  }

  const handleExecuteAuthSim = useCallback(async () => {
    if (!isMobileSimCountry(country)) {
      toast.error("Quick auth needs HR, SI, RS, BA, or ME.");
      return;
    }
    if (!simDeviceId.trim() || simPin.length !== 4) {
      toast.error("Select device and enter 4-digit PIN.");
      return;
    }
    setAuthSimLoading(true);
    try {
      const response = await loginNesyMobileDevice({
        country,
        environment,
        deviceCode: simDeviceId.trim(),
        pinCode: simPin.replace(/\D/g, "").slice(0, 4),
        pushRegistrationId: "",
        skipAdb: true,
      });
      setAuthSimResult(response);
      toast.success("Auth/LoginDevice completed.");
    } catch (e) {
      setAuthSimResult({ error: e instanceof Error ? e.message : "Login failed" });
      toast.error(e instanceof Error ? e.message : "Login failed.");
    } finally {
      setAuthSimLoading(false);
    }
  }, [country, environment, simDeviceId, simPin]);

  const handleAddCourierWallet = useCallback(
    async (u: DashboardUserRow) => {
      if (selectedUser?.userId !== u.userId) {
        toast.error("Select this user in the table first.");
        return;
      }
      if (!/^\d{4}$/.test(panelPin)) {
        toast.error("PIN must be loaded in the detail panel (4 digits).");
        return;
      }
      try {
        await createOrUpdateCourierWallet({
          username: u.username,
          password: panelPin,
          hubName: u.hubName.trim() || "—",
          hubId: u.hubId.trim(),
          country,
          environment,
        });
        toast.success(`Courier wallet saved (${country}/${environment}).`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Wallet save failed.");
      }
    },
    [selectedUser?.userId, panelPin, country, environment],
  );

  const handleSetCourierHubToMe = useCallback(async () => {
    if (!auth || !token || !selectedUser?.hubId?.trim() || !selectedUser.hubName?.trim()) {
      toast.error("Connection and selected user hub are required.");
      return;
    }
    const dashRecord =
      authUser && typeof authUser === "object" && authUser !== null && !Array.isArray(authUser)
        ? ({ ...authUser } as Record<string, unknown>)
        : {};
    const myBranch =
      typeof dashRecord.branchId === "string"
        ? dashRecord.branchId.trim()
        : String(dashRecord.BranchId ?? "").trim();
    const hubKey = selectedUser.hubId.trim();
    if (myBranch && myBranch === hubKey) {
      toast.success("Your hub already matches this user.");
      return;
    }
    setHubSwitchOpen(true);
    setHubSwitchMessage("Updating hub…");
    try {
      const payload = await buildCourierHubManageUserPayload(auth, hubKey, selectedUser.hubName.trim(), {
        dashboardUserSnapshot: dashRecord,
        bearerToken: token,
        sessionUserId,
      });
      await dashboardManageUser(auth, payload);
      setHubSwitchMessage("Reconnecting…");
      const newToken = await connect();
      if (!newToken) throw new Error("Reconnect failed.");
      const fresh: NesyDashboardAuth = { token: newToken, country, environment };
      await loadMeta(fresh);
      await loadUsers(fresh);
      await loadPanelPin(fresh);
      toast.success("Hub updated and session refreshed.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Hub update failed.");
    } finally {
      setHubSwitchMessage("");
      setHubSwitchOpen(false);
    }
  }, [
    auth,
    token,
    selectedUser,
    authUser,
    sessionUserId,
    country,
    environment,
    connect,
    loadMeta,
    loadUsers,
    loadPanelPin,
  ]);

  const handleTrackingSearch = useCallback(async () => {
    if (!auth) return;
    const hasLegacy = legacyBarcodeQuery.trim().length > 0;
    const hasWaybill = waybillQuery.trim().length > 0;
    if (!hasLegacy && !hasWaybill) return;
    setTrackingLoading(true);
    setTrackingError(null);
    setTrackingResult(null);
    setTrackingSteps([]);
    try {
      let waybill = waybillQuery.trim();
      if (hasLegacy && !hasWaybill) {
        setTrackingSteps((s) => [...s, `Legacy barcode: ${legacyBarcodeQuery.trim()}…`]);
        const shipmentResult = await searchShipmentByLegacyBarcode(auth, legacyBarcodeQuery.trim());
        const found = shipmentResult.waybillNumber ?? shipmentResult.shipmentId;
        if (!found) {
          setTrackingSteps((s) => [...s, "No shipment found."]);
          setTrackingResult({ raw: shipmentResult.raw as Record<string, unknown> });
          return;
        }
        waybill = found;
        setWaybillQuery(waybill);
        setTrackingSteps((s) => [...s, `Waybill: ${waybill}`]);
      }
      if (!waybill) {
        setTrackingError("Could not determine waybill.");
        return;
      }
      setTrackingSteps((s) => [...s, `Tracking: ${waybill}…`]);
      const result = await searchTrackingByWaybill(auth, waybill);
      setTrackingResult(result);
    } catch (e) {
      setTrackingError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      setTrackingLoading(false);
    }
  }, [auth, legacyBarcodeQuery, waybillQuery]);

  const connected = status === "connected" && !!token;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize) || 1);

  const pinsJsonText = useMemo(() => {
    if (authSimResult !== null) return JSON.stringify(authSimResult, null, 2);
    if (selectedUser) {
      return JSON.stringify(
        { userId: selectedUser.userId, username: selectedUser.username, devices: panelDevices },
        null,
        2,
      );
    }
    return "{}";
  }, [authSimResult, selectedUser, panelDevices]);

  const handleSearchMe = useCallback(() => {
    const u = authUser?.username?.trim();
    if (!u || !connected) {
      toast.error("Connect to Nesy first.");
      return;
    }
    setSearchText(u);
    setDebouncedSearch(u);
    setPageIndex(0);
  }, [authUser?.username, connected]);

  return (
    <>
      {flash ? (
        <Alert variant={flash.variant === "destructive" ? "destructive" : flash.variant === "warning" ? "warning" : "success"}>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{flash.message}</span>
            <button type="button" className="text-xs underline" onClick={() => setFlash(null)}>
              Dismiss
            </button>
          </AlertDescription>
        </Alert>
      ) : null}

      {listError ? (
        <p className="text-sm text-destructive">{listError}</p>
      ) : null}

      <AlertDialog
        open={devicePendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) setDevicePendingRemoval(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove device?</AlertDialogTitle>
            <AlertDialogDescription>
              Remove this device from the user? You can add it again later.
              {devicePendingRemoval ? (
                <span className="mt-2 block font-mono text-xs">{devicePendingRemoval}</span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deviceMutationLoading}>Cancel</AlertDialogCancel>
            <Button
              variant="nesy"
              disabled={deviceMutationLoading || !devicePendingRemoval}
              onClick={() => {
                const id = devicePendingRemoval;
                if (!id) return;
                setDevicePendingRemoval(null);
                void executeRemoveDevice(id);
              }}
            >
              Remove
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={hubSwitchOpen}>
        <DialogContent showCloseButton={false} onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Updating hub</DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <Loader2 className="size-5 animate-spin text-nesy" />
              {hubSwitchMessage || "Please wait…"}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>

      <UserSavedDeviceDialog
        open={savedDeviceDialogOpen}
        onOpenChange={setSavedDeviceDialogOpen}
        devices={savedDevices}
        loading={savedDevicesLoading}
        selectedId={selectedSavedDeviceId}
        onSelectedIdChange={setSelectedSavedDeviceId}
        onApply={applySavedDeviceSelection}
      />

      <UserCourierSearchDialog
        open={trackingModalOpen}
        onOpenChange={setTrackingModalOpen}
        country={country}
        environment={environment}
        legacyBarcodeQuery={legacyBarcodeQuery}
        onLegacyBarcodeChange={setLegacyBarcodeQuery}
        waybillQuery={waybillQuery}
        onWaybillChange={setWaybillQuery}
        loading={trackingLoading}
        error={trackingError}
        steps={trackingSteps}
        result={trackingResult}
        onSearch={() => void handleTrackingSearch()}
        onUseCourier={(name) => {
          setSearchText(name);
          setDebouncedSearch(name);
          setPageIndex(0);
        }}
      />

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card>
          <CardContent className="space-y-4 p-4 pt-5">
            <div className="grid gap-3 xl:grid-cols-[minmax(240px,1fr)_140px_160px_130px]">
              <InputWrapper>
                <Search className="size-4 text-muted-foreground" />
                <Input
                  placeholder="Search username or full name…"
                  value={searchText}
                  disabled={!connected}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                {searchText ? (
                  <button type="button" onClick={() => setSearchText("")} aria-label="Clear">
                    <X className="size-4 text-muted-foreground" />
                  </button>
                ) : null}
              </InputWrapper>

              <Select
                value={roleFilter}
                onValueChange={(v) => {
                  setRoleFilter(v);
                  setPageIndex(0);
                }}
                disabled={!connected || metaLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.uniqueName} value={r.uniqueName}>
                      {r.displayName || r.uniqueName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={hubFilter}
                onValueChange={(v) => {
                  setHubFilter(v);
                  setPageIndex(0);
                }}
                disabled={!connected || metaLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Hub" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All hubs</SelectItem>
                  {hubs.map((h) => (
                    <SelectItem key={h.hubId} value={h.hubId}>
                      {h.hubName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v as "active" | "passive");
                  setPageIndex(0);
                }}
                disabled={!connected}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="passive">Passive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {listLoading ? "Loading…" : `${totalCount} user(s)`}
              </span>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="nesy" size="sm" disabled={!connected || !authUser?.username} onClick={handleSearchMe}>
                  <UserSearch className="size-4" />
                  Search me
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!connected}
                  onClick={() => {
                    setLegacyBarcodeQuery("");
                    setWaybillQuery("");
                    setTrackingResult(null);
                    setTrackingError(null);
                    setTrackingSteps([]);
                    setTrackingModalOpen(true);
                  }}
                >
                  <Search className="size-4" />
                  Courier search
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={!connected || listLoading} onClick={() => void loadUsers()}>
                  <RefreshCw className={cn("size-4", listLoading && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Username</TableHead>
                    <TableHead className="text-xs">Full name</TableHead>
                    <TableHead className="text-xs">Role</TableHead>
                    <TableHead className="text-xs">Hub</TableHead>
                    <TableHead className="text-center text-xs">Devices</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-right text-xs">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!connected && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                        Connect from Data Center → Connection.
                      </TableCell>
                    </TableRow>
                  )}
                  {connected && !listLoading && users.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                        No users for current filters.
                      </TableCell>
                    </TableRow>
                  )}
                  {users.map((u) => (
                    <TableRow
                      key={u.userId}
                      className={cn(
                        "cursor-pointer",
                        selectedUser?.userId === u.userId && "bg-nesy-soft/80",
                      )}
                      onClick={() => setSelectedUser(u)}
                    >
                      <TableCell className="text-xs font-medium">{u.username}</TableCell>
                      <TableCell className="text-xs">{u.fullName}</TableCell>
                      <TableCell className="text-xs">{u.role}</TableCell>
                      <TableCell className="text-xs">{u.hubName}</TableCell>
                      <TableCell className="text-center text-xs">{deviceByUserId[u.userId] ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        <StatusBadge status={u.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          disabled={
                            listLoading || selectedUser?.userId !== u.userId || !/^\d{4}$/.test(panelPin)
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleAddCourierWallet(u);
                          }}
                        >
                          <Wallet className="size-3.5 text-nesy" />
                          Wallet
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
              <Button variant="ghost" size="sm" disabled={pageIndex <= 0 || listLoading} onClick={() => setPageIndex(0)}>
                <ChevronsLeft className="size-4" />
              </Button>
              <Button variant="ghost" size="sm" disabled={pageIndex <= 0 || listLoading} onClick={() => setPageIndex((p) => Math.max(0, p - 1))}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="tabular-nums text-muted-foreground">
                Page {pageIndex + 1} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={pageIndex >= totalPages - 1 || listLoading}
                onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pageIndex >= totalPages - 1 || listLoading}
                onClick={() => setPageIndex(totalPages - 1)}
              >
                <ChevronsRight className="size-4" />
              </Button>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPageIndex(0);
                }}
                disabled={listLoading}
              >
                <SelectTrigger className="h-8 w-[7rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / page</SelectItem>
                  <SelectItem value="25">25 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <UserDetailPanel
          connected={connected}
          selectedUser={selectedUser}
          onClearSelection={() => setSelectedUser(null)}
          authUserLabel={authUser?.username ?? null}
          sessionUserId={sessionUserId}
          country={country}
          environment={environment}
          panelPin={panelPin}
          pinLoading={pinLoading}
          isPanelSelf={isPanelSelf}
          panelDevices={panelDevices}
          panelDevicesLoading={panelDevicesLoading}
          panelDeviceInfo={panelDeviceInfo}
          panelDeviceInfoLoading={panelDeviceInfoLoading}
          newDeviceId={newDeviceId}
          onNewDeviceIdChange={setNewDeviceId}
          deviceMutationLoading={deviceMutationLoading}
          onRefreshDevices={() => void refreshPanelDevices()}
          onOpenSavedDeviceDialog={() => void openSavedDeviceDialog()}
          onAddDevice={() => void handleAddDevice()}
          onRemoveDevice={setDevicePendingRemoval}
          onSetCourierHub={() => void handleSetCourierHubToMe()}
          hubSwitchOpen={hubSwitchOpen}
          simDeviceId={simDeviceId}
          onSimDeviceIdChange={setSimDeviceId}
          simPin={simPin}
          onSimPinChange={setSimPin}
          authSimLoading={authSimLoading}
          authSimEnabled={
            connected &&
            Boolean(simDeviceId.trim()) &&
            simPin.length === 4 &&
            !authSimLoading &&
            isMobileSimCountry(country)
          }
          onExecuteAuthSim={() => void handleExecuteAuthSim()}
          pinsJsonText={pinsJsonText}
          pinsJsonExpanded={pinsJsonExpanded}
          onTogglePinsJsonExpanded={() => setPinsJsonExpanded((e) => !e)}
          onCopyPinsJson={() => {
            void navigator.clipboard.writeText(pinsJsonText).then(
              () => toast.success("Copied."),
              () => toast.error("Copy failed."),
            );
          }}
        />
      </div>
    </>
  );
}
