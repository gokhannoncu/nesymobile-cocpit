'use client'

// Debug View - Device Overview
// Live overview of the selected device over real ADB: WiFi, cellular, ping,
// OS, app process and Firebase credentials (with run-as).

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  BatteryCharging,
  Battery,
  Cpu,
  Flame,
  Gauge,
  HardDrive,
  Loader2,
  MemoryStick,
  MonitorSmartphone,
  Package,
  Radio,
  RefreshCw,
  ShieldCheck,
  Signal,
  Smartphone,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import {
  ProductPage,
  PageSection,
  StatCard,
  StatGrid,
  EASE,
  toneIcon,
  toneIconBox,
  toneText,
  type Tone,
} from '@/components/product'
import { DebugHeader, DebugCrossLinks, InfoRow, NoDeviceState, DebugOverviewShimmer } from '@/components/debug-view/shared'
import { useDebugView } from '@/components/debug-view/debug-context'
import { signalLabel } from '@/data/debug-view/mock-runtime'
import type { LiveDeviceRuntime } from '@/data/debug-view/live-types'

const DASH = '-'
const PANEL = 'rounded-xl border border-border bg-card p-4'
const PANEL_HEADER = 'flex items-center gap-2 border-b border-border/80 bg-muted/30 px-4 py-2.5'

function fmt(value: string | number | null | undefined, suffix = ''): string {
  if (value == null || value === '') return DASH
  return `${value}${suffix}`
}

function latencyTone(ms: number | null | undefined): Tone {
  if (ms == null) return 'gray'
  if (ms <= 80) return 'green'
  if (ms <= 200) return 'amber'
  return 'red'
}

function batteryTone(level: number | null | undefined): Tone {
  if (level == null) return 'gray'
  if (level <= 15) return 'red'
  if (level <= 50) return 'amber'
  return 'green'
}

function appTone(installed: boolean, processId: number | null | undefined): Tone {
  if (!installed) return 'red'
  if (processId) return 'green'
  return 'amber'
}

function usageBarClass(pct: number): string {
  if (pct >= 90) return 'bg-red-500'
  if (pct >= 85) return 'bg-amber-500'
  return 'bg-foreground/50'
}

export default function DeviceOverviewPage() {
  const { selectedDevice } = useDebugView()
  const [runtime, setRuntime] = useState<LiveDeviceRuntime | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const serial = selectedDevice?.serial ?? null

  const loadRuntime = useCallback(() => {
    if (!serial) {
      setRuntime(null)
      return
    }
    setLoading(true)
    setError(null)
    fetch(`/api/adb/runtime?serial=${encodeURIComponent(serial)}`)
      .then(async (r) => {
        const body = (await r.json()) as LiveDeviceRuntime & { error?: string }
        if (!r.ok || body.error) throw new Error(body.error ?? `HTTP ${r.status}`)
        setRuntime(body)
      })
      .catch((err: unknown) => {
        setRuntime(null)
        setError(err instanceof Error ? err.message : 'Failed to take snapshot')
      })
      .finally(() => setLoading(false))
  }, [serial])

  useEffect(() => {
    loadRuntime()
  }, [loadRuntime])

  return (
    <ProductPage path="/debug-view/overview">
      <DebugHeader
        icon={MonitorSmartphone}
        title="Device Overview"
        lead="Instant status of the selected device over ADB: network connection, ping, OS, application process and Firebase credentials on a single screen."
        tone="teal"
        badges={[
          { label: 'Live snapshot' },
          { label: 'ADB + dumpsys' },
          { label: 'run-as Firebase' },
        ]}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={loadRuntime} disabled={!serial || loading}>
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Refresh
            </Button>
            <DebugCrossLinks currentPath="/debug-view/overview" />
          </>
        }
      />

      {!selectedDevice ? (
        <NoDeviceState />
      ) : loading && !runtime ? (
        <DebugOverviewShimmer />
      ) : error ? (
        <ErrorState deviceName={selectedDevice.name} message={error} onRetry={loadRuntime} />
      ) : !runtime ? (
        <NoDeviceState />
      ) : (
        <OverviewBody deviceName={selectedDevice.name} serial={selectedDevice.serial} runtime={runtime} loading={loading} />
      )}
    </ProductPage>
  )
}

function OverviewBody({
  deviceName,
  serial,
  runtime,
  loading,
}: {
  deviceName: string
  serial: string
  runtime: LiveDeviceRuntime
  loading: boolean
}) {
  const ramPct =
    runtime.os.totalRamMb > 0
      ? ((runtime.os.totalRamMb - runtime.os.availableRamMb) / runtime.os.totalRamMb) * 100
      : 0
  const storagePct =
    runtime.os.storageTotalGb > 0
      ? ((runtime.os.storageTotalGb - runtime.os.storageFreeGb) / runtime.os.storageTotalGb) * 100
      : 0
  const pingTone = latencyTone(runtime.ping.latencyMs)

  return (
    <>
      <RuntimeMetaStrip
        deviceName={deviceName}
        serial={serial}
        runtime={runtime}
        loading={loading}
      />

      {/* --- KPI bar --- */}
      <StatGrid cols={4}>
            <StatCard
              icon={runtime.network === 'wifi' ? Wifi : runtime.network === 'cellular' ? Radio : WifiOff}
              label="Connection"
              value={runtime.network === 'wifi' ? 'Wi-Fi' : runtime.network === 'cellular' ? 'Cellular' : 'Offline'}
              hint={runtime.network === 'wifi' ? runtime.wifi.ssid ?? '' : runtime.cellular.carrier ?? ''}
              tone={runtime.network === 'offline' ? 'red' : 'green'}
            />
            <StatCard
              icon={Activity}
              label="Latency (ping)"
              value={fmt(runtime.ping.latencyMs)}
              suffix={runtime.ping.latencyMs != null ? 'ms' : ''}
              hint={
                runtime.ping.latencyMs != null
                  ? `Jitter ${fmt(runtime.ping.jitterMs, ' ms')} · Loss ${fmt(runtime.ping.packetLossPct, '%')}`
                  : 'Ping could not be measured'
              }
              tone={pingTone}
            />
            <StatCard
              icon={runtime.battery.charging ? BatteryCharging : Battery}
              label="Battery"
              value={fmt(runtime.battery.level)}
              suffix={runtime.battery.level == null ? '' : '%'}
              hint={
                runtime.battery.level == null
                  ? 'Battery level could not be measured'
                  : `${runtime.battery.charging ? 'Charging' : 'Not charging'}${runtime.battery.temperatureC != null ? ` · ${runtime.battery.temperatureC.toFixed(1)}°C` : ''}`
              }
              tone={batteryTone(runtime.battery.level)}
            />
            <StatCard
              icon={Package}
              label="NesyMobile"
              value={runtime.app.installed ? runtime.app.versionName ?? '?' : 'Not installed'}
              hint={
                runtime.app.installed
                  ? runtime.app.processId
                    ? `PID ${runtime.app.processId} · ${runtime.app.foreground ? 'Foreground' : 'Background'}`
                    : 'Process is not running'
                  : ''
              }
              tone={appTone(runtime.app.installed, runtime.app.processId)}
            />
          </StatGrid>

          {/* --- Network detail --- */}
          <PageSection
            eyebrow="Network"
            title="Connection & Ping"
            description={`cmd wifi status + getprop + dumpsys telephony.registry · Snapshot: ${new Date(runtime.capturedAt).toLocaleTimeString('en-US')}`}
            icon={Signal}
            tone="blue"
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
              {/* WiFi */}
              <div className={PANEL}>
                <div className="flex items-center gap-2">
                  <Wifi className={cn('size-4', toneIcon[runtime.wifi.connected ? 'blue' : 'gray'])} />
                  <h3 className="text-sm font-bold text-foreground">Wi-Fi</h3>
                  <Badge
                    variant="secondary"
                    size="xs"
                    className={cn('ms-auto', runtime.wifi.connected ? toneText.green : toneText.gray)}
                  >
                    {runtime.wifi.connected ? signalLabel(runtime.wifi.signalLevel) : 'Not connected'}
                  </Badge>
                </div>
                <div className="mt-2 divide-y divide-border/50">
                  <InfoRow label="SSID" value={fmt(runtime.wifi.ssid)} />
                  <InfoRow label="BSSID" value={fmt(runtime.wifi.bssid)} mono />
                  <InfoRow label="IP address" value={fmt(runtime.wifi.ipAddress)} mono />
                  <InfoRow label="Gateway" value={fmt(runtime.wifi.gateway)} mono />
                  <InfoRow label="Link speed" value={fmt(runtime.wifi.linkSpeedMbps, ' Mbps')} />
                  <InfoRow label="Frequency" value={fmt(runtime.wifi.frequencyMhz, ' MHz')} />
                  <InfoRow label="RSSI" value={fmt(runtime.wifi.rssiDbm, ' dBm')} />
                  <InfoRow label="Security" value={fmt(runtime.wifi.security)} />
                </div>
              </div>

              {/* Cellular */}
              <div className={PANEL}>
                <div className="flex items-center gap-2">
                  <Radio className={cn('size-4', toneIcon[runtime.cellular.connected ? 'blue' : 'gray'])} />
                  <h3 className="text-sm font-bold text-foreground">Cellular</h3>
                  {runtime.cellular.generation ? (
                    <Badge variant="secondary" size="xs" className={cn('ms-auto', toneText.blue)}>
                      {runtime.cellular.generation}
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-2 divide-y divide-border/50">
                  <InfoRow label="Carrier" value={fmt(runtime.cellular.carrier)} />
                  <InfoRow label="Generation" value={fmt(runtime.cellular.generation)} />
                  <InfoRow label="Signal (RSRP)" value={fmt(runtime.cellular.signalDbm, ' dBm')} />
                  <InfoRow label="Data state" value={runtime.cellular.dataState} />
                  <InfoRow label="Roaming" value={runtime.cellular.roaming ? 'Yes' : 'No'} tone={runtime.cellular.roaming ? 'amber' : undefined} />
                </div>
              </div>

              {/* Ping */}
              <div className={PANEL}>
                <div className="flex items-center gap-2">
                  <Gauge className={cn('size-4', toneIcon[pingTone])} />
                  <h3 className="text-sm font-bold text-foreground">Ping Measurement</h3>
                </div>
                <div className="mt-3 flex items-end gap-4">
                  <div>
                    <div className={cn('text-2xl font-bold tabular-nums', toneText[pingTone])}>
                      {fmt(runtime.ping.latencyMs)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Latency ms</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold tabular-nums text-foreground">{fmt(runtime.ping.jitterMs)}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Jitter ms</div>
                  </div>
                </div>
                <div className="mt-3 divide-y divide-border/50">
                  <InfoRow label="Packet loss" value={fmt(runtime.ping.packetLossPct, '%')} />
                  <InfoRow label="Target" value={runtime.ping.endpoint} mono />
                  <InfoRow label="Measurement time" value={new Date(runtime.ping.measuredAt).toLocaleTimeString('en-US')} />
                </div>
                <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  The measurement is done via ICMP ping from the device. To measure throughput (Mbps), a speed
                  test application is required on the device - ADB alone cannot provide it.
                </div>
              </div>
            </div>
          </PageSection>

          {/* --- OS & hardware --- */}
          <PageSection eyebrow="System" title="Operating System & Hardware" icon={Cpu} tone="indigo">
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              <div className={PANEL}>
                <div className="flex items-center gap-2">
                  <Smartphone className={cn('size-4', toneIcon.indigo)} />
                  <h3 className="text-sm font-bold text-foreground">Device & OS</h3>
                </div>
                <div className="mt-2 divide-y divide-border/50">
                  <InfoRow label="Manufacturer / Model" value={`${runtime.os.manufacturer} ${runtime.os.model}`} />
                  <InfoRow label="Android" value={`${runtime.os.androidVersion} (API ${runtime.os.apiLevel})`} />
                  <InfoRow label="Security patch" value={runtime.os.securityPatch} />
                  <InfoRow label="Kernel" value={runtime.os.kernelVersion} mono />
                  <InfoRow label="CPU ABI" value={runtime.os.cpuAbi} mono />
                  <InfoRow label="Fingerprint" value={runtime.os.buildFingerprint} mono />
                  <InfoRow label="Locale / TZ" value={`${runtime.os.locale} · ${runtime.os.timezone}`} />
                  <InfoRow label="Uptime" value={runtime.os.uptime} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className={PANEL}>
                  <MemoryStick className={cn('size-4', toneIcon.indigo)} />
                  <div className="mt-2 text-xl font-bold tabular-nums text-foreground">
                    {((runtime.os.totalRamMb - runtime.os.availableRamMb) / 1024).toFixed(1)} / {(runtime.os.totalRamMb / 1024).toFixed(0)} GB
                  </div>
                  <div className="text-[11px] text-muted-foreground">RAM usage</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full', usageBarClass(ramPct))} style={{ width: `${ramPct}%` }} />
                  </div>
                </div>
                <div className={PANEL}>
                  <HardDrive className={cn('size-4', toneIcon.indigo)} />
                  <div className="mt-2 text-xl font-bold tabular-nums text-foreground">
                    {(runtime.os.storageTotalGb - runtime.os.storageFreeGb).toFixed(0)} / {runtime.os.storageTotalGb} GB
                  </div>
                  <div className="text-[11px] text-muted-foreground">Storage (/data)</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn('h-full rounded-full', usageBarClass(storagePct))} style={{ width: `${storagePct}%` }} />
                  </div>
                </div>
                <div className="overflow-hidden rounded-xl border border-border bg-card sm:col-span-2">
                  <div className={PANEL_HEADER}>
                    <span className={cn('flex size-7 items-center justify-center rounded-lg', toneIconBox.gray)}>
                      <Package className={cn('size-3.5', toneIcon.gray)} />
                    </span>
                    <h4 className="text-sm font-bold text-foreground">Application process</h4>
                    {runtime.app.installed && runtime.app.processId ? (
                      <Badge variant="secondary" appearance="outline" size="xs" className={cn('ms-auto font-mono', toneText.green)}>
                        PID {runtime.app.processId}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="p-4">
                    {!runtime.app.installed ? (
                      <p className="text-xs text-muted-foreground">NesyMobile is not installed on this device.</p>
                    ) : (
                      <div className="divide-y divide-border/50">
                        <InfoRow label="Package" value={fmt(runtime.app.packageName)} mono />
                        <InfoRow label="Version" value={`${fmt(runtime.app.versionName)} (${fmt(runtime.app.versionCode)})`} />
                        <InfoRow
                          label="Build"
                          value={runtime.app.debuggable ? 'debuggable' : 'release'}
                          tone={runtime.app.debuggable ? 'green' : undefined}
                        />
                        <InfoRow label="Installation" value={runtime.app.firstInstall ? new Date(runtime.app.firstInstall).toLocaleString('en-US') : DASH} />
                        <InfoRow label="Last update" value={runtime.app.lastUpdate ? new Date(runtime.app.lastUpdate).toLocaleString('en-US') : DASH} />
                        <InfoRow label="Installer" value={fmt(runtime.app.installer) === DASH ? 'adb / sideload' : fmt(runtime.app.installer)} mono />
                        <InfoRow
                          label="PID / Memory"
                          value={runtime.app.processId ? `${runtime.app.processId} · ${fmt(runtime.app.memoryUsageMb, ' MB')}` : 'Process is not running'}
                          tone={runtime.app.processId ? undefined : 'amber'}
                        />
                        <InfoRow
                          label="Battery optimization"
                          value={runtime.app.batteryOptimized == null ? DASH : runtime.app.batteryOptimized ? 'Enabled' : 'Disabled (whitelist)'}
                          tone={runtime.app.batteryOptimized ? 'amber' : 'green'}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </PageSection>

          {/* --- Firebase --- */}
          <PageSection
            eyebrow="Firebase"
            title="Firebase & Analytics"
            description="Real credentials read from shared_prefs on the device with run-as (debuggable build only)."
            icon={Flame}
            tone="teal"
          >
            {!runtime.firebase.available ? (
              <div className="flex items-start gap-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Failed to read Firebase data</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {runtime.firebase.reason ?? 'Unknown reason.'} A debuggable NesyMobile build must be
                    installed on the device to read Firebase credentials.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
                <div className={PANEL}>
                  <div className="flex items-center gap-2">
                    <Flame className={cn('size-4', toneIcon.teal)} />
                    <h3 className="text-sm font-bold text-foreground">Credentials & FCM</h3>
                  </div>
                  <div className="mt-2 divide-y divide-border/50">
                    <InfoRow label="App Instance ID" value={fmt(runtime.firebase.appInstanceId)} mono />
                    <InfoRow label="Session ID" value={fmt(runtime.firebase.sessionId)} mono />
                    <InfoRow label="GMP App ID" value={fmt(runtime.firebase.gmpAppId)} mono />
                    <InfoRow
                      label="Token record"
                      value={runtime.firebase.fcmTokenStoredAt ? new Date(runtime.firebase.fcmTokenStoredAt).toLocaleString('en-US') : DASH}
                    />
                    <InfoRow
                      label="Analytics"
                      value={
                        runtime.firebase.analyticsCollectionEnabled == null
                          ? DASH
                          : runtime.firebase.analyticsCollectionEnabled
                            ? 'Enabled'
                            : 'Disabled'
                      }
                      tone={runtime.firebase.analyticsCollectionEnabled ? 'green' : 'gray'}
                    />
                  </div>
                </div>

                <div className={PANEL}>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={cn('size-4', toneIcon.gray)} />
                    <h3 className="text-sm font-bold text-foreground">Crashlytics credentials</h3>
                  </div>
                  <div className="mt-2 divide-y divide-border/50">
                    <InfoRow label="Firebase Installation ID" value={fmt(runtime.firebase.firebaseInstallationId)} mono />
                    <InfoRow label="Crashlytics Installation ID" value={fmt(runtime.firebase.crashlyticsInstallationId)} mono />
                  </div>
                  <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                    Crashlytics user ID and custom keys are only sent to the Firebase console along with crash reports;
                    they are not permanently stored on the device.
                  </div>
                </div>

                <div className={PANEL}>
                  <div className="flex items-center gap-2">
                    <Activity className={cn('size-4', toneIcon.teal)} />
                    <h3 className="text-sm font-bold text-foreground">FCM Token</h3>
                  </div>
                  {runtime.firebase.fcmToken ? (
                    <code className="mt-2 block break-all rounded-md border border-border bg-muted/40 p-2.5 font-mono text-[10px] leading-relaxed text-foreground">
                      {runtime.firebase.fcmToken}
                    </code>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">FCM token not found.</p>
                  )}
                  <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                    NesyMobile only sends two custom events:{' '}
                    <code className="text-foreground">deletedRequestDao</code> and{' '}
                    <code className="text-foreground">requestHttpStatusNot200</code>. Screen views are logged as
                    Crashlytics breadcrumbs.
                  </div>
                </div>
              </div>
            )}

            {/* Permissions */}
            {runtime.permissions.length > 0 ? (
              <motion.div
                className="overflow-hidden rounded-xl border border-border bg-card"
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, ease: EASE }}
              >
                <div className={PANEL_HEADER}>
                  <ShieldCheck className={cn('size-4', toneIcon.gray)} />
                  <h3 className="text-sm font-bold text-foreground">Runtime permissions</h3>
                  <Badge variant="secondary" appearance="outline" size="xs" className="ms-auto text-muted-foreground">
                    {runtime.permissions.filter((p) => p.granted).length}/{runtime.permissions.length} granted
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5 p-4">
                  {runtime.permissions.map((p) => (
                    <Badge
                      key={p.name}
                      variant="secondary"
                      appearance="outline"
                      size="sm"
                      className={cn('font-mono text-[10px]', p.granted ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')}
                    >
                      {p.granted ? '✓' : '✗'} {p.name}
                    </Badge>
                  ))}
                </div>
              </motion.div>
            ) : null}
          </PageSection>
    </>
  )
}

function RuntimeMetaStrip({
  deviceName,
  serial,
  runtime,
  loading,
}: {
  deviceName: string
  serial: string
  runtime: LiveDeviceRuntime
  loading: boolean
}) {
  const items = [
    { icon: Smartphone, label: 'Device', value: deviceName },
    { icon: MonitorSmartphone, label: 'Model', value: `${runtime.os.manufacturer} ${runtime.os.model}` },
    { icon: Package, label: 'NesyMobile', value: runtime.app.installed ? runtime.app.versionName ?? '?' : 'Not installed' },
    { icon: Activity, label: 'Network', value: runtime.network === 'wifi' ? 'Wi-Fi' : runtime.network === 'cellular' ? 'Cellular' : 'Offline' },
    {
      icon: Battery,
      label: 'Battery',
      value: runtime.battery.level == null ? DASH : `${runtime.battery.level}%`,
    },
  ]

  return (
    <motion.div
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 bg-muted/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn('flex size-7 items-center justify-center rounded-lg', toneIconBox.gray)}>
            <MonitorSmartphone className={cn('size-3.5', toneIcon.gray)} />
          </span>
          <span className="text-[11px] font-semibold text-foreground">Live device snapshot</span>
        </div>
        {loading ? (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Refreshing
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground">
            Captured {new Date(runtime.capturedAt).toLocaleTimeString('en-US')}
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 xl:grid-cols-5">
        {items.map((item) => (
          <div key={item.label} className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2.5 transition-colors hover:border-border">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <item.icon className={cn('size-3', toneIcon.gray)} />
              {item.label}
            </div>
            <div className="mt-1 truncate text-sm font-semibold text-foreground">{item.value}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-4 py-3 text-[10px] text-muted-foreground">
        <Badge variant="secondary" appearance="outline" size="xs" className="font-mono text-muted-foreground">
          {serial}
        </Badge>
        <span>
          Android {runtime.os.androidVersion} · API {runtime.os.apiLevel}
        </span>
        {runtime.app.processId ? (
          <Badge variant="secondary" appearance="outline" size="xs" className={cn('ms-auto font-mono', toneText.green)}>
            PID {runtime.app.processId} · {runtime.app.foreground ? 'Foreground' : 'Background'}
          </Badge>
        ) : null}
      </div>
    </motion.div>
  )
}

/** Error state shown when snapshot fails. */
function ErrorState({ deviceName, message, onRetry }: { deviceName: string; message: string; onRetry: () => void }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-red-300 bg-red-50/40 py-14 text-center dark:border-red-900 dark:bg-red-950/20"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <AlertTriangle className="size-6 text-red-500" />
      <div>
        <h3 className="text-sm font-semibold text-foreground">Failed to take snapshot for {deviceName}</h3>
        <p className="mt-1 max-w-md break-all text-xs leading-relaxed text-muted-foreground">{message}</p>
      </div>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="size-3.5" />
        Try again
      </Button>
    </motion.div>
  )
}
