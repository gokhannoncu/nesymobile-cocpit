"use client";

import {
  Building2,
  Copy,
  FileJson,
  Loader2,
  LockKeyhole,
  Maximize2,
  Plus,
  RefreshCw,
  Smartphone,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { Badge } from "@nesy/metronic/components/ui/badge";
import { Button } from "@nesy/metronic/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardHeading,
  CardToolbar,
} from "@nesy/metronic/components/ui/card";
import { Input } from "@nesy/metronic/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nesy/metronic/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@nesy/metronic/components/ui/tabs";
import { cn } from "@nesy/metronic/lib/utils";
import type { CourierDeviceInfo } from "@/services/nesy-dashboard";
import type { DashboardUserRow } from "./types";

function StatusBadge({ status }: { status: string }) {
  const active = status === "Active";
  return (
    <Badge variant={active ? "success" : "warning"} appearance="light" size="sm" className="shrink-0">
      {status}
    </Badge>
  );
}

/** Nesy often returns FULL CAPS names; soften for cockpit readability */
function formatDisplayName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const lettersOnly = trimmed.replace(/[^a-zA-ZÀ-ž]/g, "");
  if (lettersOnly.length >= 2 && trimmed === trimmed.toUpperCase()) {
    return trimmed
      .toLowerCase()
      .split(/\s+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  return trimmed;
}

export function UserDetailPanel({
  connected,
  selectedUser,
  onClearSelection,
  authUserLabel,
  sessionUserId,
  country,
  environment,
  panelPin,
  pinLoading,
  isPanelSelf,
  panelDevices,
  panelDevicesLoading,
  panelDeviceInfo,
  panelDeviceInfoLoading,
  newDeviceId,
  onNewDeviceIdChange,
  deviceMutationLoading,
  onRefreshDevices,
  onOpenSavedDeviceDialog,
  onAddDevice,
  onRemoveDevice,
  onSetCourierHub,
  hubSwitchOpen,
  simDeviceId,
  onSimDeviceIdChange,
  simPin,
  onSimPinChange,
  authSimLoading,
  authSimEnabled,
  onExecuteAuthSim,
  pinsJsonText,
  pinsJsonExpanded,
  onTogglePinsJsonExpanded,
  onCopyPinsJson,
}: {
  connected: boolean;
  selectedUser: DashboardUserRow | null;
  onClearSelection: () => void;
  authUserLabel: string | null;
  sessionUserId: string | null;
  country: string;
  environment: string;
  panelPin: string;
  pinLoading: boolean;
  isPanelSelf: boolean;
  panelDevices: string[];
  panelDevicesLoading: boolean;
  panelDeviceInfo: CourierDeviceInfo | null;
  panelDeviceInfoLoading: boolean;
  newDeviceId: string;
  onNewDeviceIdChange: (v: string) => void;
  deviceMutationLoading: boolean;
  onRefreshDevices: () => void;
  onOpenSavedDeviceDialog: () => void;
  onAddDevice: () => void;
  onRemoveDevice: (deviceId: string) => void;
  onSetCourierHub: () => void;
  hubSwitchOpen: boolean;
  simDeviceId: string;
  onSimDeviceIdChange: (v: string) => void;
  simPin: string;
  onSimPinChange: (v: string) => void;
  authSimLoading: boolean;
  authSimEnabled: boolean;
  onExecuteAuthSim: () => void;
  pinsJsonText: string;
  pinsJsonExpanded: boolean;
  onTogglePinsJsonExpanded: () => void;
  onCopyPinsJson: () => void;
}) {
  return (
    <Card className="h-fit overflow-hidden">
      <CardHeader className="min-h-0 items-start gap-3 py-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-nesy text-white">
            <UserRound className="size-5" strokeWidth={1.75} />
          </span>
          <CardHeading className="min-w-0 flex-1 space-y-1.5 pt-0.5">
            {selectedUser ? (
              <>
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <h2 className="text-base font-semibold leading-snug text-foreground">
                    {formatDisplayName(selectedUser.fullName || selectedUser.username)}
                  </h2>
                  <StatusBadge status={selectedUser.status} />
                </div>
                <p className="text-sm leading-snug text-muted-foreground">
                  <span className="text-foreground/80">{selectedUser.role || "—"}</span>
                  {selectedUser.hubName ? (
                    <>
                      <span className="mx-1.5 text-border">·</span>
                      {selectedUser.hubName}
                    </>
                  ) : null}
                </p>
                <p
                  className="truncate font-mono text-[11px] leading-relaxed text-muted-foreground/90"
                  title={selectedUser.userId}
                >
                  User ID: {selectedUser.userId}
                </p>
              </>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Select a user from the table to view profile, devices, and PIN tools.
              </p>
            )}
          </CardHeading>
        </div>
        <CardToolbar className="shrink-0 self-start">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            mode="icon"
            className="size-8 text-muted-foreground hover:text-foreground"
            aria-label="Clear selection"
            disabled={!selectedUser}
            onClick={onClearSelection}
          >
            <X className="size-4" />
          </Button>
        </CardToolbar>
      </CardHeader>

      <CardContent className="pt-0">
        {!selectedUser ? (
          <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">
            Overview, devices, PIN, and auth tools appear here after you select a user.
          </div>
        ) : (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList
            variant="line"
            size="md"
            className="mb-4 h-auto w-full justify-start gap-6 bg-transparent p-0"
          >
            <TabsTrigger
              value="overview"
              className="rounded-none px-0 data-[state=active]:border-foreground data-[state=active]:text-foreground"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="devices"
              className="rounded-none px-0 data-[state=active]:border-foreground data-[state=active]:text-foreground"
            >
              Devices
            </TabsTrigger>
            <TabsTrigger
              value="pins"
              className="rounded-none px-0 data-[state=active]:border-foreground data-[state=active]:text-foreground"
            >
              PINs &amp; Auth
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="rounded-none px-0 data-[state=active]:border-foreground data-[state=active]:text-foreground"
            >
              Activity Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-0">
            <section className="rounded-lg border p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">User Information</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!connected || !selectedUser?.hubId || !selectedUser?.hubName || hubSwitchOpen}
                  onClick={onSetCourierHub}
                >
                  <Building2 className={cn("size-3.5", hubSwitchOpen && "animate-pulse")} />
                  Set Courier Hub to Me
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Email</p>
                  <p className="mt-1 font-medium break-all">{selectedUser?.email || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="mt-1 font-medium">{selectedUser?.phoneNumber || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Version</p>
                  <p className="mt-1 flex min-h-5 items-center gap-1 font-medium">
                    {panelDeviceInfoLoading ? (
                      <>
                        <Loader2 className="size-3 animate-spin" />
                        Loading…
                      </>
                    ) : (
                      panelDeviceInfo?.appVersion || "—"
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Role</p>
                  <p className="mt-1 font-medium">{selectedUser?.role || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="mt-1">
                    {selectedUser ? <StatusBadge status={selectedUser.status} /> : "—"}
                  </p>
                </div>
              </div>
              {authUserLabel ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Session: {authUserLabel} ({country}/{environment})
                  {isPanelSelf ? " · viewing self" : ""}
                </p>
              ) : null}
              {sessionUserId ? (
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  Your user id: {sessionUserId}
                </p>
              ) : null}
            </section>
          </TabsContent>

          <TabsContent value="devices" className="mt-0">
            <section className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold">
                  Registered devices
                  {selectedUser ? ` (${panelDevicesLoading ? "…" : panelDevices.length})` : ""}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!selectedUser || !connected || panelDevicesLoading || deviceMutationLoading}
                  onClick={onRefreshDevices}
                >
                  <RefreshCw className={cn("size-4", panelDevicesLoading && "animate-spin")} />
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={newDeviceId}
                  onChange={(e) => onNewDeviceIdChange(e.target.value)}
                  placeholder="New device ID (hex)"
                  className="h-9 min-w-[200px] flex-1 font-mono text-xs"
                  disabled={!connected || !selectedUser || deviceMutationLoading}
                  onKeyDown={(e) => e.key === "Enter" && onAddDevice()}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!selectedUser || deviceMutationLoading}
                  onClick={onOpenSavedDeviceDialog}
                >
                  <Smartphone className="size-4" />
                  Select
                </Button>
                <Button
                  type="button"
                  variant="nesy"
                  size="sm"
                  disabled={!connected || !selectedUser || deviceMutationLoading || !newDeviceId.trim()}
                  onClick={onAddDevice}
                >
                  <Plus className="size-4" />
                  Add
                </Button>
              </div>
              <div className="space-y-2">
                {panelDevicesLoading && (
                  <p className="text-xs text-muted-foreground">Loading devices…</p>
                )}
                {!panelDevicesLoading &&
                  panelDevices.map((device) => (
                    <div
                      key={device}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-xs"
                    >
                      <span className="font-mono">{device}</span>
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                        disabled={!selectedUser || deviceMutationLoading}
                        aria-label={`Remove device ${device}`}
                        onClick={() => onRemoveDevice(device)}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  ))}
                {!panelDevicesLoading && selectedUser && panelDevices.length === 0 && (
                  <p className="text-xs text-muted-foreground">No devices registered.</p>
                )}
              </div>
            </section>
          </TabsContent>

          <TabsContent value="pins" className="mt-0 space-y-4">
            <section className="rounded-lg border p-3">
              <h3 className="text-xs font-semibold">PIN codes</h3>
              {!selectedUser ? (
                <p className="mt-2 text-sm text-muted-foreground">Select a user to view PIN.</p>
              ) : pinLoading ? (
                <p className="mt-2 text-sm text-muted-foreground">Loading PIN…</p>
              ) : !panelPin ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  PIN is only visible in the same hub context; you may need to switch hub first.
                </p>
              ) : (
                <p className="mt-2 text-sm">
                  Current PIN:{" "}
                  <Badge variant="primary" appearance="light" className="font-mono tracking-[0.2em]">
                    {panelPin}
                  </Badge>
                </p>
              )}
            </section>

            <section className="space-y-2 rounded-lg border p-3">
              <h3 className="text-xs font-semibold">Quick auth simulation</h3>
              <p className="text-xs text-muted-foreground">
                Nesy Auth/LoginDevice via automation API (skipAdb).
              </p>
              <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                <Select
                  value={simDeviceId || undefined}
                  onValueChange={onSimDeviceIdChange}
                  disabled={!selectedUser || panelDevices.length === 0 || !connected}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder={panelDevices.length ? "Select device" : "No devices"} />
                  </SelectTrigger>
                  <SelectContent>
                    {panelDevices.map((d) => (
                      <SelectItem key={d} value={d}>
                        <span className="font-mono text-xs">{d}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="h-9 w-24 text-center font-mono text-xs tracking-[0.4em]"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  value={simPin}
                  onChange={(e) => onSimPinChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  disabled={!connected}
                />
                <Button
                  type="button"
                  variant="nesy"
                  size="sm"
                  className="h-9"
                  disabled={!authSimEnabled || authSimLoading}
                  onClick={onExecuteAuthSim}
                >
                  <LockKeyhole className={cn("size-4", authSimLoading && "animate-pulse")} />
                  Execute
                </Button>
              </div>
            </section>

            <section className="overflow-hidden rounded-lg border bg-slate-950 text-slate-100">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs">
                <span className="font-medium">Response (JSON)</span>
                <div className="flex items-center gap-2">
                  <button type="button" className="inline-flex items-center gap-1 hover:text-white" onClick={onCopyPinsJson}>
                    <Copy className="size-3" />
                    Copy
                  </button>
                  <button type="button" aria-label="Expand" onClick={onTogglePinsJsonExpanded}>
                    <Maximize2 className="size-3" />
                  </button>
                  <FileJson className="size-3 opacity-70" />
                </div>
              </div>
              <pre
                className={cn(
                  "overflow-auto p-4 text-xs leading-relaxed",
                  pinsJsonExpanded ? "max-h-[min(70vh,28rem)]" : "max-h-40",
                )}
              >
                {pinsJsonText}
              </pre>
            </section>
          </TabsContent>

          <TabsContent value="activity" className="mt-0">
            <section className="rounded-lg border p-4">
              <h3 className="text-xs font-semibold">Activity Log</h3>
              <p className="mt-2 text-xs text-muted-foreground">
                User update / device / password logs can be wired to Nesy User/GetUserUpdateLogs.
              </p>
            </section>
          </TabsContent>
        </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
