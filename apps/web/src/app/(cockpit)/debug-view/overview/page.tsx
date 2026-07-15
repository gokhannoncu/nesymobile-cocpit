'use client'

// Debug View — Device Overview
// ADB ile seçilen cihaz hakkında canlı özet: WiFi, network, internet hızı/bant
// genişliği, işletim sistemi ve Firebase verisi. Güzel bir UX ile.

import { motion } from 'framer-motion'
import {
  Activity,
  Cpu,
  Flame,
  Gauge,
  HardDrive,
  MemoryStick,
  MonitorSmartphone,
  Radio,
  ShieldCheck,
  Signal,
  Smartphone,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { ProductPage, PageSection, StatCard, StatGrid, EASE, toneCard, toneIcon } from '@/components/product'
import { DebugHeader, DebugCrossLinks, InfoRow, NoDeviceState, NoRuntimeState } from '@/components/debug-view/shared'
import { useDebugView } from '@/components/debug-view/debug-context'
import { MOCK_RUNTIME, signalLabel } from '@/data/debug-view/mock-runtime'

export default function DeviceOverviewPage() {
  const { selectedDevice } = useDebugView()
  const runtime = selectedDevice ? MOCK_RUNTIME[selectedDevice.id] : undefined

  return (
    <ProductPage path="/debug-view/overview">
      <DebugHeader
        icon={MonitorSmartphone}
        title="Device Overview"
        lead="ADB / Nesy Device Bridge üzerinden seçili cihazın anlık durumu: ağ bağlantısı, internet hızı, işletim sistemi ve Firebase verisi tek ekranda."
        tone="teal"
        badges={[{ label: 'Canlı snapshot' }, { label: 'ADB + dumpsys' }, { label: 'Firebase' }]}
        actions={<DebugCrossLinks currentPath="/debug-view/overview" />}
      />

      {!selectedDevice ? (
        <NoDeviceState />
      ) : !runtime ? (
        <NoRuntimeState deviceName={selectedDevice.name} />
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
              icon={Gauge}
              label="İndirme"
              value={runtime.throughput.downloadMbps}
              suffix="Mbps"
              format={(v) => v.toFixed(1)}
              hint={`Yükleme ${runtime.throughput.uploadMbps.toFixed(1)} Mbps`}
              tone="blue"
            />
            <StatCard
              icon={Activity}
              label="Gecikme"
              value={runtime.throughput.latencyMs}
              suffix="ms"
              hint={`Jitter ${runtime.throughput.jitterMs} ms · Kayıp %${runtime.throughput.packetLossPct}`}
              tone="purple"
            />
            <StatCard
              icon={Flame}
              label="Crash-free oturum"
              value={runtime.firebase.crashFreeSessionsPct}
              suffix="%"
              format={(v) => v.toFixed(1)}
              hint={runtime.firebase.lastCrashAt ? 'Son crash kaydı var' : 'Son crash yok'}
              tone={runtime.firebase.crashFreeSessionsPct >= 99 ? 'green' : 'amber'}
            />
          </StatGrid>

          {/* ─── Ağ detayı ─── */}
          <PageSection
            eyebrow="Ağ"
            title="Bağlantı & Bant Genişliği"
            description="ConnectivityManager + TelephonyManager + throughput ölçümü."
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
                  <InfoRow label="SSID" value={runtime.wifi.ssid ?? '—'} />
                  <InfoRow label="BSSID" value={runtime.wifi.bssid ?? '—'} mono />
                  <InfoRow label="IP adresi" value={runtime.wifi.ipAddress ?? '—'} mono />
                  <InfoRow label="Gateway" value={runtime.wifi.gateway ?? '—'} mono />
                  <InfoRow label="Link hızı" value={runtime.wifi.linkSpeedMbps ? `${runtime.wifi.linkSpeedMbps} Mbps` : '—'} />
                  <InfoRow label="Frekans" value={runtime.wifi.frequencyMhz ? `${runtime.wifi.frequencyMhz} MHz` : '—'} />
                  <InfoRow label="RSSI" value={runtime.wifi.rssiDbm != null ? `${runtime.wifi.rssiDbm} dBm` : '—'} />
                  <InfoRow label="Güvenlik" value={runtime.wifi.security ?? '—'} />
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
                  <InfoRow label="Operatör" value={runtime.cellular.carrier ?? '—'} />
                  <InfoRow label="Nesil" value={runtime.cellular.generation ?? '—'} />
                  <InfoRow label="Sinyal" value={runtime.cellular.signalDbm != null ? `${runtime.cellular.signalDbm} dBm` : '—'} />
                  <InfoRow label="Veri durumu" value={runtime.cellular.dataState} />
                  <InfoRow label="Roaming" value={runtime.cellular.roaming ? 'Evet' : 'Hayır'} tone={runtime.cellular.roaming ? 'amber' : undefined} />
                </div>
              </div>

              {/* Throughput */}
              <div className={cn('rounded-xl border p-4', toneCard.purple)}>
                <div className="flex items-center gap-2">
                  <Gauge className={cn('size-4', toneIcon.purple)} />
                  <h3 className="text-sm font-bold text-foreground">Hız Testi</h3>
                </div>
                <div className="mt-3 flex items-end gap-4">
                  <div>
                    <div className="text-2xl font-bold tabular-nums text-foreground">{runtime.throughput.downloadMbps.toFixed(1)}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">↓ İndirme Mbps</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold tabular-nums text-foreground">{runtime.throughput.uploadMbps.toFixed(1)}</div>
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">↑ Yükleme Mbps</div>
                  </div>
                </div>
                <div className="mt-3 divide-y divide-border/50">
                  <InfoRow label="Gecikme" value={`${runtime.throughput.latencyMs} ms`} />
                  <InfoRow label="Jitter" value={`${runtime.throughput.jitterMs} ms`} />
                  <InfoRow label="Paket kaybı" value={`%${runtime.throughput.packetLossPct}`} />
                  <InfoRow label="Hedef" value={runtime.throughput.endpoint} mono />
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
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${((runtime.os.totalRamMb - runtime.os.availableRamMb) / runtime.os.totalRamMb) * 100}%` }} />
                  </div>
                </div>
                <div className={cn('rounded-xl border p-4', toneCard.teal)}>
                  <HardDrive className={cn('size-4', toneIcon.teal)} />
                  <div className="mt-2 text-xl font-bold tabular-nums text-foreground">
                    {(runtime.os.storageTotalGb - runtime.os.storageFreeGb).toFixed(0)} / {runtime.os.storageTotalGb} GB
                  </div>
                  <div className="text-[11px] text-muted-foreground">Depolama</div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-teal-500" style={{ width: `${((runtime.os.storageTotalGb - runtime.os.storageFreeGb) / runtime.os.storageTotalGb) * 100}%` }} />
                  </div>
                </div>
                <div className="rounded-xl border bg-card p-4 sm:col-span-2">
                  <h4 className="text-xs font-bold text-foreground">Uygulama süreci</h4>
                  <div className="mt-1 divide-y divide-border/50">
                    <InfoRow label="Paket" value={runtime.app.packageName} mono />
                    <InfoRow label="Sürüm" value={`${runtime.app.versionName} (${runtime.app.versionCode})`} />
                    <InfoRow label="Build / Flavor" value={`${runtime.app.buildType} · ${runtime.app.flavor}`} />
                    <InfoRow label="PID / Bellek" value={`${runtime.app.processId} · ${runtime.app.memoryUsageMb} MB`} />
                    <InfoRow label="Batarya optimizasyonu" value={runtime.app.batteryOptimized ? 'Açık' : 'Kapalı'} tone={runtime.app.batteryOptimized ? 'amber' : 'green'} />
                  </div>
                </div>
              </div>
            </div>
          </PageSection>

          {/* ─── Firebase ─── */}
          <PageSection
            eyebrow="Firebase"
            title="Firebase & Analytics"
            description="NesyMobile'da kullanılan servisler: Analytics, Crashlytics, FCM. (Remote Config entegre değil.)"
            icon={Flame}
            tone="orange"
          >
            <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
              <div className={cn('rounded-xl border p-4', toneCard.orange)}>
                <div className="flex items-center gap-2">
                  <Flame className={cn('size-4', toneIcon.orange)} />
                  <h3 className="text-sm font-bold text-foreground">Kimlik & FCM</h3>
                </div>
                <div className="mt-2 divide-y divide-border/50">
                  <InfoRow label="App Instance ID" value={runtime.firebase.appInstanceId} mono />
                  <InfoRow label="Session ID" value={runtime.firebase.sessionId} mono />
                  <InfoRow label="FCM Token" value={runtime.firebase.fcmToken} mono />
                  <InfoRow label="Token kaydı" value={new Date(runtime.firebase.fcmTokenStoredAt).toLocaleString('tr-TR')} />
                  <InfoRow label="Analytics" value={runtime.firebase.analyticsCollectionEnabled ? 'Açık' : 'Kapalı'} tone={runtime.firebase.analyticsCollectionEnabled ? 'green' : 'gray'} />
                  <InfoRow label="Remote Config" value="Entegre değil" tone="gray" />
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className={cn('size-4', toneIcon.red)} />
                  <h3 className="text-sm font-bold text-foreground">Crashlytics anahtarları</h3>
                </div>
                <div className="mt-2 divide-y divide-border/50">
                  <InfoRow label="User ID" value={runtime.firebase.crashlyticsUserId ?? '—'} mono />
                  {runtime.firebase.crashlyticsCustomKeys.map((k) => (
                    <InfoRow key={k.key} label={k.key} value={k.value} />
                  ))}
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2">
                  <Activity className={cn('size-4', toneIcon.purple)} />
                  <h3 className="text-sm font-bold text-foreground">Son analytics olayları</h3>
                </div>
                {runtime.firebase.lastAnalyticsEvents.length === 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">Bu oturumda kayıtlı olay yok.</p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {runtime.firebase.lastAnalyticsEvents.map((e, i) => (
                      <div key={i} className="flex items-center justify-between rounded-md bg-muted/40 px-2.5 py-1.5">
                        <code className="text-[11px] font-semibold text-foreground">{e.name}</code>
                        <span className="text-[10px] text-muted-foreground">{new Date(e.at).toLocaleTimeString('tr-TR')}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 p-2.5 text-[11px] leading-relaxed text-muted-foreground">
                  NesyMobile yalnızca iki özel event gönderir: <code className="text-foreground">deletedRequestDao</code> ve{' '}
                  <code className="text-foreground">requestHttpStatusNot200</code>. Ekran görünümleri Crashlytics breadcrumb olarak loglanır.
                </div>
              </div>
            </div>

            {/* İzinler */}
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
          </PageSection>
        </>
      )}
    </ProductPage>
  )
}
