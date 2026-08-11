// ============================================================================
// Install latest NesyMobile APK for a country × test|prod onto the sole USB/adb device.
// Flow: GetLatestVersion → download SAS APK → adb install -r
// ============================================================================

import { execFile } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { promisify } from 'node:util'
import { finished } from 'node:stream/promises'
import { listConnectedDevices, resolveAdbPath } from './adb'
import { getAdbResolutionHint } from './adb-path'
import {
  InstallLatestError,
  type InstallLatestEnvironment,
  type InstallLatestErrorCode,
} from './adb-install-latest-input'
import {
  resolveInstallEnvironment,
  resolveNesyMobileAppName,
  resolveNesyMobileApplicationId,
  resolveNesyMobileBaseUrl,
  type NesyMobileCountry,
  type NesyMobileEnvironment,
} from '../../services/nesy-mobile-env'

export {
  InstallLatestError,
  parseInstallLatestInput,
  type InstallLatestEnvironment,
  type InstallLatestErrorCode,
} from './adb-install-latest-input'

const execFileAsync = promisify(execFile)

export type InstallStep = 'device' | 'version' | 'download' | 'install' | 'done'

export type InstallLatestResult = {
  ok: true
  deviceSerial: string
  country: NesyMobileCountry
  environment: InstallLatestEnvironment
  mobileEnvironment: NesyMobileEnvironment
  appName: string
  applicationId: string
  versionNumber: number | null
  buildNumber: string | null
  downloadUrlHost: string | null
  installOutput: string
}

export type InstallProgressEvent = {
  type: 'progress'
  step: InstallStep
  percent: number
  message: string
  detail?: string
}

type GetLatestVersionPayload = {
  versionNumber?: number
  downloadUrl?: string
  appName?: string
  minimumRequiredVersionNumber?: number
  buildNumber?: string
}

type GetLatestVersionResponse = {
  payload?: GetLatestVersionPayload | null
  resultMessage?: string
  resultCode?: number
}

function isReadyDevice(status: string): boolean {
  return status === 'connected' || status === 'app-not-installed'
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).host
  } catch {
    return null
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export async function requireExactlyOneReadyDevice(): Promise<string> {
  const adbPath = resolveAdbPath()
  if (!adbPath) {
    throw new InstallLatestError(
      'NO_ADB',
      `adb binary not found. ${getAdbResolutionHint()}.`,
    )
  }

  const devices = await listConnectedDevices()
  const ready = devices.filter((d) => isReadyDevice(d.status))

  if (ready.length === 0) {
    throw new InstallLatestError('NO_DEVICE', 'USB ile bağlı cihaz bulunamadı')
  }
  if (ready.length > 1) {
    throw new InstallLatestError(
      'MULTIPLE_DEVICES',
      'Birden fazla cihaz bağlı; yalnızca bir cihaz bırakın',
    )
  }

  return ready[0]!.serial
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new InstallLatestError('CANCELLED', 'Kurulum iptal edildi')
  }
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof Error && err.name === 'AbortError') ||
    (typeof DOMException !== 'undefined' &&
      err instanceof DOMException &&
      err.name === 'AbortError')
  )
}

export async function fetchLatestVersion(
  country: NesyMobileCountry,
  mobileEnvironment: NesyMobileEnvironment,
  signal?: AbortSignal,
): Promise<{
  appName: string
  applicationId: string
  versionNumber: number | null
  buildNumber: string | null
  downloadUrl: string
}> {
  const appName = resolveNesyMobileAppName(country, mobileEnvironment)
  const applicationId = resolveNesyMobileApplicationId(country, mobileEnvironment)
  const baseUrl = resolveNesyMobileBaseUrl(country, mobileEnvironment)
  const url = `${baseUrl}/Version/GetLatestVersion/`

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ AppName: appName }),
      cache: 'no-store',
      signal,
    })
  } catch (err) {
    if (signal?.aborted || isAbortError(err)) {
      throw new InstallLatestError('CANCELLED', 'Kurulum iptal edildi')
    }
    throw new InstallLatestError(
      'VERSION_FETCH_FAILED',
      `Versiyon bilgisi alınamadı: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new InstallLatestError(
      'VERSION_FETCH_FAILED',
      `Versiyon bilgisi alınamadı (HTTP ${response.status})${body ? `: ${body.slice(0, 200)}` : ''}`,
    )
  }

  let json: GetLatestVersionResponse
  try {
    json = (await response.json()) as GetLatestVersionResponse
  } catch {
    throw new InstallLatestError('VERSION_FETCH_FAILED', 'Versiyon bilgisi alınamadı: geçersiz JSON')
  }

  const downloadUrl = json.payload?.downloadUrl?.trim()
  if (!downloadUrl) {
    throw new InstallLatestError(
      'NO_DOWNLOAD_URL',
      'Versiyon bilgisi alınamadı: downloadUrl boş',
    )
  }

  return {
    appName,
    applicationId,
    versionNumber:
      typeof json.payload?.versionNumber === 'number' ? json.payload.versionNumber : null,
    buildNumber:
      typeof json.payload?.buildNumber === 'string' ? json.payload.buildNumber : null,
    downloadUrl,
  }
}

export async function downloadApkToTemp(
  downloadUrl: string,
  onBytes?: (received: number, total: number | null) => void,
  signal?: AbortSignal,
): Promise<string> {
  throwIfAborted(signal)
  const dir = await mkdtemp(join(tmpdir(), 'nesy-apk-'))
  const apkPath = join(dir, 'latest.apk')

  let response: Response
  try {
    response = await fetch(downloadUrl, {
      cache: 'no-store',
      redirect: 'follow',
      signal,
    })
  } catch (err) {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
    if (signal?.aborted || isAbortError(err)) {
      throw new InstallLatestError('CANCELLED', 'Kurulum iptal edildi')
    }
    throw new InstallLatestError(
      'DOWNLOAD_FAILED',
      `APK indirilemedi: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (!response.ok || !response.body) {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
    throw new InstallLatestError(
      'DOWNLOAD_FAILED',
      `APK indirilemedi (HTTP ${response.status})`,
    )
  }

  const totalHeader = response.headers.get('content-length')
  const totalRaw = totalHeader ? Number(totalHeader) : null
  const totalOk = totalRaw != null && Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : null

  try {
    const nodeStream = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream)
    const file = createWriteStream(apkPath)
    let received = 0
    let lastEmit = 0

    const onAbort = () => {
      nodeStream.destroy()
      file.destroy()
    }
    if (signal) {
      if (signal.aborted) onAbort()
      else signal.addEventListener('abort', onAbort, { once: true })
    }

    try {
      nodeStream.on('data', (chunk: Buffer | string) => {
        const size = typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length
        received += size
        if (!onBytes) return
        const now = Date.now()
        if (now - lastEmit < 100 && totalOk != null && received < totalOk) return
        lastEmit = now
        onBytes(received, totalOk)
      })

      nodeStream.pipe(file)
      await finished(file)
      onBytes?.(received, totalOk ?? received)
    } finally {
      signal?.removeEventListener('abort', onAbort)
    }
  } catch (err) {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined)
    if (signal?.aborted || isAbortError(err)) {
      throw new InstallLatestError('CANCELLED', 'Kurulum iptal edildi')
    }
    throw new InstallLatestError(
      'DOWNLOAD_FAILED',
      `APK yazılamadı: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  throwIfAborted(signal)
  return apkPath
}

export async function adbInstallApk(
  serial: string,
  apkPath: string,
  signal?: AbortSignal,
): Promise<string> {
  throwIfAborted(signal)
  const bin = resolveAdbPath()
  if (!bin) {
    throw new InstallLatestError('NO_ADB', `adb binary not found. ${getAdbResolutionHint()}.`)
  }

  try {
    const { stdout, stderr } = await execFileAsync(
      bin,
      ['-s', serial, 'install', '-r', apkPath],
      { timeout: 180_000, maxBuffer: 4 * 1024 * 1024, signal },
    )
    const output = `${stdout ?? ''}${stderr ?? ''}`.trim()
    if (/Failure\b/i.test(output)) {
      throw new InstallLatestError(
        'INSTALL_FAILED',
        `Kurulum başarısız: ${output.slice(0, 500) || 'adb install hatası'}`,
      )
    }
    return output || 'Success'
  } catch (err) {
    if (err instanceof InstallLatestError) throw err
    if (signal?.aborted || isAbortError(err)) {
      throw new InstallLatestError('CANCELLED', 'Kurulum iptal edildi')
    }
    const message = err instanceof Error ? err.message : String(err)
    throw new InstallLatestError('INSTALL_FAILED', `Kurulum başarısız: ${message.slice(0, 500)}`)
  }
}

/**
 * A freshly sideloaded APK is only verified, not compiled, so every cold start
 * pays ~400ms opening and verifying dex before `Application.onCreate` even runs.
 * Measured on SM-A346E: splash first frame 1286ms -> 858ms after this step.
 *
 * Best effort: a device that refuses the command still has a working install.
 */
export async function adbCompileAot(
  serial: string,
  applicationId: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const bin = resolveAdbPath()
  if (!bin) return null

  try {
    const { stdout, stderr } = await execFileAsync(
      bin,
      ['-s', serial, 'shell', 'cmd', 'package', 'compile', '-m', 'speed', '-f', applicationId],
      { timeout: 300_000, maxBuffer: 1024 * 1024, signal },
    )
    return `${stdout ?? ''}${stderr ?? ''}`.trim() || null
  } catch {
    return null
  }
}

export async function installLatestForCountry(
  input: {
    country: NesyMobileCountry
    environment: InstallLatestEnvironment
  },
  onProgress?: (event: InstallProgressEvent) => void,
  signal?: AbortSignal,
): Promise<InstallLatestResult> {
  const report = (event: InstallProgressEvent) => onProgress?.(event)
  const mobileEnvironment = resolveInstallEnvironment(input.environment)
  let apkPath: string | null = null

  try {
    throwIfAborted(signal)
    report({
      type: 'progress',
      step: 'device',
      percent: 4,
      message: 'Cihaz kontrol ediliyor…',
      detail: 'Tek USB / adb cihazı aranıyor',
    })

    const deviceSerial = await requireExactlyOneReadyDevice()
    throwIfAborted(signal)
    report({
      type: 'progress',
      step: 'device',
      percent: 12,
      message: 'Cihaz hazır',
      detail: deviceSerial,
    })

    report({
      type: 'progress',
      step: 'version',
      percent: 18,
      message: 'GetLatestVersion çağrılıyor…',
      detail: `${input.country} · ${input.environment}`,
    })

    const version = await fetchLatestVersion(input.country, mobileEnvironment, signal)
    throwIfAborted(signal)
    report({
      type: 'progress',
      step: 'version',
      percent: 28,
      message: 'Versiyon alındı',
      detail:
        version.versionNumber != null
          ? `v${version.versionNumber} · ${version.appName}`
          : version.appName,
    })

    report({
      type: 'progress',
      step: 'download',
      percent: 30,
      message: 'APK indiriliyor…',
      detail: hostOf(version.downloadUrl) ?? 'SAS URL',
    })

    apkPath = await downloadApkToTemp(
      version.downloadUrl,
      (received, total) => {
        const ratio =
          total != null && total > 0
            ? received / total
            : Math.min(received / (40 * 1024 * 1024), 0.95)
        const percent = Math.min(78, 30 + Math.round(ratio * 48))
        report({
          type: 'progress',
          step: 'download',
          percent,
          message: 'APK indiriliyor…',
          detail:
            total != null
              ? `${formatBytes(received)} / ${formatBytes(total)}`
              : formatBytes(received),
        })
      },
      signal,
    )

    throwIfAborted(signal)
    report({
      type: 'progress',
      step: 'download',
      percent: 80,
      message: 'APK indirildi',
    })

    report({
      type: 'progress',
      step: 'install',
      percent: 84,
      message: 'adb install çalışıyor…',
      detail: `${deviceSerial} · install -r`,
    })

    const installOutput = await adbInstallApk(deviceSerial, apkPath, signal)

    throwIfAborted(signal)
    report({
      type: 'progress',
      step: 'install',
      percent: 92,
      message: 'AOT derleniyor…',
      detail: `${deviceSerial} · compile -m speed`,
    })
    await adbCompileAot(deviceSerial, version.applicationId, signal)

    const result: InstallLatestResult = {
      ok: true,
      deviceSerial,
      country: input.country,
      environment: input.environment,
      mobileEnvironment,
      appName: version.appName,
      applicationId: version.applicationId,
      versionNumber: version.versionNumber,
      buildNumber: version.buildNumber,
      downloadUrlHost: hostOf(version.downloadUrl),
      installOutput,
    }

    report({
      type: 'progress',
      step: 'done',
      percent: 100,
      message: 'Kurulum tamamlandı',
      detail:
        result.versionNumber != null
          ? `v${result.versionNumber} · ${result.applicationId}`
          : result.applicationId,
    })

    return result
  } finally {
    if (apkPath) {
      const dir = join(apkPath, '..')
      await rm(dir, { recursive: true, force: true }).catch(() => undefined)
    }
  }
}

export function isInstallLatestErrorCode(value: string): value is InstallLatestErrorCode {
  return (
    value === 'NO_ADB' ||
    value === 'NO_DEVICE' ||
    value === 'MULTIPLE_DEVICES' ||
    value === 'INVALID_INPUT' ||
    value === 'VERSION_FETCH_FAILED' ||
    value === 'NO_DOWNLOAD_URL' ||
    value === 'DOWNLOAD_FAILED' ||
    value === 'INSTALL_FAILED' ||
    value === 'CANCELLED'
  )
}
