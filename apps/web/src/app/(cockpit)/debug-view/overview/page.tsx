'use client'

// Debug View — Device Overview
// Gerçek ADB üzerinden seçilen cihazın canlı özeti: WiFi, hücresel, ping,
// işletim sistemi, uygulama süreci ve Firebase kimlikleri (run-as ile).

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
import { ProductPage, PageSection, StatCard, StatGrid, EASE, toneCard, toneIcon } from '@/components/product'
import { DebugHeader, DebugCrossLinks, InfoRow, NoDeviceState } from '@/components/debug-view/shared'
import { useDebugView } from '@/components/debug-view/debug-context'
import { signalLabel } from '@/data/debug-view/mock-runtime'
import type { LiveDeviceRuntime } from '@/data/debug-view/live-types'

const DASH = '—'

function fmt(value: string | number | null | undefined, suffix = ''): string {
  if (value == null || value === '') return DASH
  return `${value}${suffix}`
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
        setError(err instanceof Error ? err.message : 'Snapshot alınamadı')
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
        lead="ADB üzerinden seçili cihazın anlık durumu: ağ bağlantısı, ping, işletim sistemi, uygulama süreci ve Firebase kimlikleri tek ekranda."
        tone="teal"
        badges={[{ label: 'Canlı snapshot' }, { label: 'ADB + dumpsys' }, { label: 'run-as Firebase' }]}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={loadRuntime} disabled={!serial || loading}>
              {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Yenile
            </Button>
            <DebugCrossLinks currentPath="/debug-view/overview" />
          </>
        }
      />

      {!selectedDevice ? (
        <NoDeviceState />
      ) : loading && !runtime ? (
        <LoadingState deviceName={selectedDevice.name} />
      ) : error ? (
        <ErrorState deviceName={selectedDevice.name} message={error} onRetry={loadRuntime} />
      ) : !runtime ? (
        <NoDeviceState />
      ) : (
        <>
          {/* ─── KPI şeridi ─── */}
          <StatGrid cols={4}>
            <StatCard
              icon={runtime.network === 'wifi' ? Wifi : runtime.network === 'cellular' ? Radio : WifiOff}
              label="Bağlantı"
              value={runtime.network === 'wifi' ? 'Wi-Fi' : runtime.network === 'cellular' ? 'Hücresel' : 'Çevrimdışı'}
              hint={runtime.network === 'wifi' ? runtime.wifi.ssid ?? '' : runtime.cellular.carrier ?? ''}
              tone={runtime.network === 'offline' ? 'red' : 'green'}
            />
            <StatCard
              icon={Activity}
              label="Gecikme (ping)"
              value={runtime.ping.latencyMs ?? DASH}
              suffix={runtime.ping.latencyMs != null ? 'ms' : ''}
              hint={
                runtime.ping.latencyMs != null
                  ? `Jitter ${fmt(runtime.ping.jitterMs, ' ms')} · Kayıp ${fmt(runtime.ping.packetLossPct, '%')}`
                  : 'Ping ölçülemedi'
              }
              tone="purple"
            />
            <StatCard
              icon={runtime.battery.charging ? BatteryCharging : Battery}
              label="Batarya"
              value={runtime.battery.level}
              suffix="%"
              hint={`${runtime.battery.charging ? 'Şarj oluyor' : 'Şarjda değil'}${runtime.battery.temperatureC != null ? ` · ${runtime.battery.temperatureC.toFixed(1)}°C` : ''}`}
              tone={runtime.battery.level <= 15 ? 'red' : runtime.battery.level <= 50 ? 'amber' : 'green'}
            />
            <StatCard
              icon={Package}
              label="NesyMobile"
              value={runtime.app.installed ? runtime.app.versionName ?? '?' : 'Kurulu değil'}
              hint={
                runtime.app.installed
                  ? runtime.app.processId
                    ? `PID ${runtime.app.processId} · ${runtime.app.foreground ? 'Ön planda' : 'Arka planda'}`
                    : 'Süreç çalışmıyor'
                  : ''
              }
              tone={runtime.app.installed ? (runtime.app.processId ? 'green' : 'amber') : 'red'}
            />
          </StatGrid>

          {/* ─── Ağ detayı ─── */}
          <PageSection
            eyebrow="Ağ"
            title="Bağlantı & Ping"
            description={`cmd wifi status + getprop + dumpsys telephony.registry · Snapshot: ${new Date(runtime.capturedAt).toLocaleTimeString('tr-TR')}`}
            icon={Signal}
            tone="blue"
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
              {/* WiFi */}
              <div className={cn('rounded-xl border p-4', toneCard[runtime.wifi.connected ? 'green' : 'gray'])}>
                <div className="flex items-center gap-2">
                  <Wifi className={cn('size-4', toneIcon[runtime.wifi.connected ? 'green' : 'gray'])} />
                  <h3 className="text-sm font-bold text-foreground">Wi-Fi</h3>
                  <Badge variant="secondary" size="xs" className="ms-auto">
                    {runtime.wifi.connected ? signalLabel(runtime.wifi.signalLevel) : 'Bağlı değil'}
                  </Badge>
                </div>
                <div className="mt-2 divide-y divide-border/50">
                  <InfoRow label="SSID" value={fmt(runtime.wifi.ssid)} />
                  <InfoRow label="BSSID" value={fmt(runtime.wifi.bssid)} mono />
                  <InfoRow label="IP adresi" value={fmt(runtime.wifi.ipAddress)} mono />
                  <InfoRow label="Gateway" value={fmt(runtime.wifi.gateway)} mono />
                  <InfoRow label="Link hızı" value={fmt(runtime.wifi.linkSpeedMbps, ' Mbps')} />
                  <InfoRow label="Frekans" value={fmt(runtime.wifi.frequencyMhz, ' MHz')} />
                  <InfoRow label="RSSI" value={fmt(runtime.wifi.rssiDbm, ' dBm')} />
                  <InfoRow label="Güvenlik" value={fmt(runtime.wifi.security)} />
                </div>
              </div>

              {/* Hücresel */}
              <div className={cn('rounded-xl border p-4', toneCard[runtime.cellular.connected ? 'teal' : 'gray'])}>
                <div className="flex items-center gap-2">
                  <Radio className={cn('size-4', toneIcon[runtime.cellular.connected ? 'teal' : 'gray'])} />
                  <h3 className="text-sm font-bold text-foreground">Hücresel</h3>
                  {runtime.cellular.generation && (
                    <Badge variant="secondary" size="xs" className="ms-auto">{runtime.cellular.generation}</Badge>
                  )}
                </div>
                <div className="mt-2 divide-y divide-border/50">
                  <InfoRow label="Operatör" value={fmt(runtime.cellular.carrier)} />
                  <InfoRow label="Nesil" value={fmt(runtime.cellular.generation)} />
                  <InfoRow label="Sinyal (RSRP)" value={fmt(runtime.cellular.signalDbm, ' dBm')} />
                  <InfoRow label="Veri durumu" value={runtime.cellular.dataState} />
                  <InfoRow label="Roaming" value={runtime.cellular.roaming ? 'Evet' : 'Hayır'} tone={runtime.cellular.roaming ? 'amber' : undefined} />
                </div>
              </div>

              {/* Ping */}
              <div className={cn('rounded-xl border p-4', toneCard.purple)}>
                <div className="flex items-center gap-2">
                  <Gauge className={cn('size-4', toneIcon.purple)} />
                  <h3 className="text-sm font-bold text-foreground">Ping Ölçümü</h3>
                </div>
                <div className="mt-3 flex items-end gap-4">
                  <div>
                    <div className="text-2xl font-bold tabular-nums text-foreground">{fmt(runtime.ping.latencyMs)}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Gecikme ms</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold tabular-nums text-foreground">{fmt(runtime.ping.jitterMs)}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Jitter ms</div>
                  </div>
                </div>
                <div className="mt-3 divide-y divide-border/50">
                  <InfoRow label="Paket kaybı" value={fmt(runtime.ping.packetLossPct, '%')} />
                  <InfoRow label="Hedef" value={runtime.ping.endpoint} mono />
                  <InfoRow label="Ölçüm zamanı" value={new Date(runtime.ping.measuredAt).toLocaleTimeString('tr-TR')} />
                </div>
                <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  Ölçüm cihaz üzerinden ICMP ping ile yapılır. Throughput (Mbps) ölçümü için cihazda hız
                  testi uygulaması gerekir — ADB tek başına sağlayamaz.
                </div>
              </div>
            </div>
          </PageSection>

          {/* ─── İşletim sistemi & donanım ─── */}
          <PageSection eyebrow="Sistem" title="İşletim Sistemi & Donanım" icon={Cpu} tone="indigo">
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2">
                  <Smartphone className={cn('size-4', toneIcon.indigo)} />
                  <h3 className="text-sm font-bold text-foreground">Cihaz & OS</h3>
                </div>
                <div className="mt-2 divide-y divide-border/50">
                  <InfoRow label="Üretici / Model" value={`${runtime.os.manufacturer} ${runtime.os.model}`} />
                  <InfoRow label="Android" value={`${runtime.os.androidVersion} (API ${runtime.os.apiLevel})`} />
                  <InfoRow label="Güvenlik yaması" value={runtime.os.securityPatch} />
                  <InfoRow label="Kernel" value={runtime.os.kernelVersion} mono />
                  <InfoRow label="CPU ABI" value={runtime.os.cpuAbi} mono />
                  <InfoRow label="Fingerprint" value={runtime.os.buildFingerprint} mono />
                  <InfoRow label="Locale / TZ" value={`${runtime.os.locale} · ${runtime.os.timezone}`} />
                  <InfoRow label="Uptime" value={runtime.os.uptime} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className={cn('rounded-xl border p-4', toneCard.blue)}>
                  <MemoryStick className={cn('size-4', toneIcon.blue)} />
                  <div className="mt-2 text-xl font-bold tabular-nums text-foreground">
                    {((runtime.os.totalRamMb - runtime.os.availableRamMb) / 1024).toFixed(1)} / {(runtime.os.totalRamMb / 1024).toFixed(0)} GB
                  </div>
                  <div className="text-[11px] text-muted-foreground">RAM kullanımı</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${runtime.os.totalRamMb > 0 ? ((runtime.os.totalRamMb - runtime.os.availableRamMb) / runtime.os.totalRamMb) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div className={cn('rounded-xl border p-4', toneCard.teal)}>
                  <HardDrive className={cn('size-4', toneIcon.teal)} />
                  <div className="mt-2 text-xl font-bold tabular-nums text-foreground">
                    {(runtime.os.storageTotalGb - runtime.os.storageFreeGb).toFixed(0)} / {runtime.os.storageTotalGb} GB
                  </div>
                  <div className="text-[11px] text-muted-foreground">Depolama (/data)</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-teal-500"
                      style={{ width: `${runtime.os.storageTotalGb > 0 ? ((runtime.os.storageTotalGb - runtime.os.storageFreeGb) / runtime.os.storageTotalGb) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-xl border bg-card p-4 sm:col-span-2">
                  <h4 className="text-xs font-bold text-foreground">Uygulama süreci</h4>
                  {!runtime.app.installed ? (
                    <p className="mt-2 text-xs text-muted-foreground">NesyMobile bu cihazda kurulu değil.</p>
                  ) : (
                    <div className="mt-1 divide-y divide-border/50">
                      <InfoRow label="Paket" value={fmt(runtime.app.packageName)} mono />
                      <InfoRow label="Sürüm" value={`${fmt(runtime.app.versionName)} (${fmt(runtime.app.versionCode)})`} />
                      <InfoRow
                        label="Build"
                        value={runtime.app.debuggable ? 'debuggable' : 'release'}
                        tone={runtime.app.debuggable ? 'green' : undefined}
                      />
                      <InfoRow label="Kurulum" value={runtime.app.firstInstall ? new Date(runtime.app.firstInstall).toLocaleString('tr-TR') : DASH} />
                      <InfoRow label="Son güncelleme" value={runtime.app.lastUpdate ? new Date(runtime.app.lastUpdate).toLocaleString('tr-TR') : DASH} />
                      <InfoRow label="Yükleyici" value={fmt(runtime.app.installer) === DASH ? 'adb / sideload' : fmt(runtime.app.installer)} mono />
                      <InfoRow
                        label="PID / Bellek"
                        value={runtime.app.processId ? `${runtime.app.processId} · ${fmt(runtime.app.memoryUsageMb, ' MB')}` : 'Süreç çalışmıyor'}
                        tone={runtime.app.processId ? undefined : 'amber'}
                      />
                      <InfoRow
                        label="Batarya optimizasyonu"
                        value={runtime.app.batteryOptimized == null ? DASH : runtime.app.batteryOptimized ? 'Açık' : 'Kapalı (whitelist)'}
                        tone={runtime.app.batteryOptimized ? 'amber' : 'green'}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </PageSection>

          {/* ─── Firebase ─── */}
          <PageSection
            eyebrow="Firebase"
            title="Firebase & Analytics"
            description="run-as ile cihazdaki shared_prefs'ten okunan gerçek kimlikler (yalnızca debuggable build)."
            icon={Flame}
            tone="orange"
          >
            {!runtime.firebase.available ? (
              <div className="flex items-start gap-3 rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Firebase verisi okunamadı</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {runtime.firebase.reason ?? 'Bilinmeyen neden.'} Firebase kimliklerini okumak için cihazda
                    debuggable bir NesyMobile build'i kurulu olmalıdır.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
                <div className={cn('rounded-xl border p-4', toneCard.orange)}>
                  <div className="flex items-center gap-2">
                    <Flame className={cn('size-4', toneIcon.orange)} />
                    <h3 className="text-sm font-bold text-foreground">Kimlik & FCM</h3>
                  </div>
                  <div className="mt-2 divide-y divide-border/50">
                    <InfoRow label="App Instance ID" value={fmt(runtime.firebase.appInstanceId)} mono />
                    <InfoRow label="Session ID" value={fmt(runtime.firebase.sessionId)} mono />
                    <InfoRow label="GMP App ID" value={fmt(runtime.firebase.gmpAppId)} mono />
                    <InfoRow
                      label="Token kaydı"
                      value={runtime.firebase.fcmTokenStoredAt ? new Date(runtime.firebase.fcmTokenStoredAt).toLocaleString('tr-TR') : DASH}
                    />
                    <InfoRow
                      label="Analytics"
                      value={
                        runtime.firebase.analyticsCollectionEnabled == null
                          ? DASH
                          : runtime.firebase.analyticsCollectionEnabled
                            ? 'Açık'
                            : 'Kapalı'
                      }
                      tone={runtime.firebase.analyticsCollectionEnabled ? 'green' : 'gray'}
                    />
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={cn('size-4', toneIcon.red)} />
                    <h3 className="text-sm font-bold text-foreground">Crashlytics kimlikleri</h3>
                  </div>
                  <div className="mt-2 divide-y divide-border/50">
                    <InfoRow label="Firebase Installation ID" value={fmt(runtime.firebase.firebaseInstallationId)} mono />
                    <InfoRow label="Crashlytics Installation ID" value={fmt(runtime.firebase.crashlyticsInstallationId)} mono />
                  </div>
                  <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                    Crashlytics user ID ve custom key'ler yalnızca crash raporlarıyla birlikte Firebase
                    konsoluna gönderilir; cihaz üzerinde kalıcı olarak saklanmaz.
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-4">
                  <div className="flex items-center gap-2">
                    <Activity className={cn('size-4', toneIcon.purple)} />
                    <h3 className="text-sm font-bold text-foreground">FCM Token</h3>
                  </div>
                  {runtime.firebase.fcmToken ? (
                    <code className="mt-2 block break-all rounded-md bg-muted/40 p-2.5 font-mono text-[10px] leading-relaxed text-foreground">
                      {runtime.firebase.fcmToken}
                    </code>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">FCM token bulunamadı.</p>
                  )}
                  <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                    NesyMobile yalnızca iki özel event gönderir: <code className="text-foreground">deletedRequestDao</code> ve{' '}
                    <code className="text-foreground">requestHttpStatusNot200</code>. Ekran görünümleri Crashlytics breadcrumb olarak loglanır.
                  </div>
                </div>
              </div>
            )}

            {/* İzinler */}
            {runtime.permissions.length > 0 && (
              <motion.div
                className="rounded-xl border bg-card p-4"
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, ease: EASE }}
              >
                <h3 className="text-sm font-bold text-foreground">Çalışma zamanı izinleri</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {runtime.permissions.map((p) => (
                    <Badge
                      key={p.name}
                      variant="secondary"
                      appearance="outline"
                      size="sm"
                      className={cn('font-mono text-[10px]', p.granted ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')}
                    >
                      {p.granted ? '✓' : '✕'} {p.name}
                    </Badge>
                  ))}
                </div>
              </motion.div>
            )}
          </PageSection>
        </>
      )}
    </ProductPage>
  )
}

/** Snapshot toplanırken gösterilen bekleme durumu. */
function LoadingState({ deviceName }: { deviceName: string }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <Loader2 className="size-6 animate-spin text-teal-500" />
      <div>
        <h3 className="text-sm font-semibold text-foreground">{deviceName} sorgulanıyor…</h3>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          ADB üzerinden ağ, sistem, uygulama ve Firebase bilgileri toplanıyor. Ping ölçümü nedeniyle
          birkaç saniye sürebilir.
        </p>
      </div>
    </motion.div>
  )
}

/** Snapshot alınamadığında gösterilen hata durumu. */
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
        <h3 className="text-sm font-semibold text-foreground">{deviceName} için snapshot alınamadı</h3>
        <p className="mt-1 max-w-md break-all text-xs leading-relaxed text-muted-foreground">{message}</p>
      </div>
      <Button size="sm" variant="outline" onClick={onRetry}>
        <RefreshCw className="size-3.5" />
        Tekrar dene
      </Button>
    </motion.div>
  )
}
