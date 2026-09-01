import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

import { prisma } from '@nesy/db'

import {
  applyDeviceDisplay,
  formatDeviceModelLabel,
  identityFromAdbDevice,
  type DeviceDisplayIdentity,
} from './device-display-identity.js'

const execFileAsync = promisify(execFile)

export async function persistAdbDeviceIdentities(
  devices: ReadonlyArray<{
    id: string
    modelName?: string | null
    manufacturer?: string | null
    marketName?: string | null
    product?: string | null
  }>,
): Promise<void> {
  for (const device of devices) {
    const identity = identityFromAdbDevice(device)
    if (!identity) continue
    await upsertMobileDevice(identity)
    await stampRunsWithDeviceIdentity(identity)
  }
}

export async function lookupStoredDeviceDisplay(serial: string): Promise<{
  modelName: string
  label: string
} | null> {
  const trimmed = serial.trim()
  if (!trimmed) return null
  const row = await prisma.mobileDevice.findFirst({
    where: { OR: [{ deviceId: trimmed }, { adbDeviceId: trimmed }] },
    select: { modelName: true, label: true },
  })
  if (!row) return null
  const label =
    row.label?.trim() || formatDeviceModelLabel({ modelName: row.modelName }) || row.modelName
  return { modelName: row.modelName, label }
}

export async function attachDeviceDisplays(
  items: ReadonlyArray<{ run: Record<string, unknown> }>,
): Promise<void> {
  const serials = [
    ...new Set(
      items
        .filter(
          (item) =>
            textOrNull(item.run.deviceId) !== null &&
            textOrNull(item.run.deviceLabel) === null &&
            textOrNull(item.run.deviceModelName) === null,
        )
        .map((item) => textOrNull(item.run.deviceId))
        .filter((serial): serial is string => serial !== null),
    ),
  ]
  if (serials.length === 0) {
    await persistResolvedDisplaysOntoRuns(items)
    return
  }
  const displays = await resolveDeviceDisplays(serials)
  for (const item of items) {
    item.run = applyDeviceDisplay(item.run, displays)
  }
  await persistResolvedDisplaysOntoRuns(items)
}

async function resolveDeviceDisplays(
  serials: readonly string[],
): Promise<Map<string, Pick<DeviceDisplayIdentity, 'modelName' | 'label'>>> {
  const displays = new Map<string, Pick<DeviceDisplayIdentity, 'modelName' | 'label'>>()
  if (serials.length === 0) return displays

  const stored = await prisma.mobileDevice.findMany({
    where: {
      OR: serials.flatMap((serial) => [{ deviceId: serial }, { adbDeviceId: serial }]),
    },
    select: { deviceId: true, adbDeviceId: true, modelName: true, label: true },
  })
  for (const row of stored) {
    const label =
      row.label?.trim() || formatDeviceModelLabel({ modelName: row.modelName }) || row.modelName
    const identity = { modelName: row.modelName, label }
    displays.set(row.deviceId, identity)
    if (row.adbDeviceId) displays.set(row.adbDeviceId, identity)
  }

  const missing = serials.filter((serial) => !displays.has(serial))
  await Promise.all(
    missing.map(async (serial) => {
      try {
        const peeked = await peekAdbDeviceIdentity(serial)
        if (!peeked) return
        displays.set(serial, { modelName: peeked.modelName, label: peeked.label })
        await upsertMobileDevice(peeked)
      } catch (error) {
        console.warn('[adb-device-identity] live lookup failed', {
          serial,
          error: error instanceof Error ? error.message : error,
        })
      }
    }),
  )
  return displays
}

async function peekAdbDeviceIdentity(serial: string): Promise<DeviceDisplayIdentity | null> {
  const adbCommand = resolveAdbCommand()
  const [manufacturer, marketName, odmMarketName, vendorMarketName, modelName] = await Promise.all([
    readAdbProp(adbCommand, serial, 'ro.product.manufacturer'),
    readAdbProp(adbCommand, serial, 'ro.product.marketname'),
    readAdbProp(adbCommand, serial, 'ro.product.odm.marketname'),
    readAdbProp(adbCommand, serial, 'ro.product.vendor.marketname'),
    readAdbProp(adbCommand, serial, 'ro.product.model'),
  ])
  return identityFromAdbDevice({
    id: serial,
    manufacturer,
    marketName: marketName || odmMarketName || vendorMarketName,
    modelName,
  })
}

async function persistResolvedDisplaysOntoRuns(
  items: ReadonlyArray<{ run: Record<string, unknown> }>,
): Promise<void> {
  const bySerial = new Map<string, Pick<DeviceDisplayIdentity, 'modelName' | 'label'>>()
  for (const item of items) {
    const serial = textOrNull(item.run.deviceId)
    const modelName = textOrNull(item.run.deviceModelName)
    const label = textOrNull(item.run.deviceLabel)
    if (!serial || (!modelName && !label)) continue
    bySerial.set(serial, {
      modelName: modelName || label || serial,
      label: label || modelName || serial,
    })
  }
  await Promise.all(
    [...bySerial.entries()].map(([serial, identity]) =>
      stampRunsWithDeviceIdentity({ serial, ...identity }),
    ),
  )
}

export async function stampRunsWithDeviceIdentity(
  identity: Pick<DeviceDisplayIdentity, 'serial' | 'modelName' | 'label'>,
): Promise<void> {
  await prisma.workflowRun.updateMany({
    where: {
      deviceId: identity.serial,
      OR: [{ deviceModelName: null }, { deviceLabel: null }],
    },
    data: {
      deviceModelName: identity.modelName,
      deviceLabel: identity.label,
    },
  })
}

async function upsertMobileDevice(identity: DeviceDisplayIdentity): Promise<void> {
  await prisma.mobileDevice.upsert({
    where: { deviceId: identity.serial },
    create: {
      deviceId: identity.serial,
      adbDeviceId: identity.serial,
      modelName: identity.modelName,
      product: identity.product ?? null,
      label: identity.label,
    },
    update: {
      adbDeviceId: identity.serial,
      modelName: identity.modelName,
      product: identity.product ?? null,
      label: identity.label,
    },
  })
}

function resolveAdbCommand(): string {
  const candidates = [
    process.env.NESY_MOBILE_ADB_PATH?.trim(),
    process.env.ANDROID_HOME ? join(process.env.ANDROID_HOME, 'platform-tools', 'adb') : null,
    process.env.ANDROID_SDK_ROOT
      ? join(process.env.ANDROID_SDK_ROOT, 'platform-tools', 'adb')
      : null,
    join(homedir(), 'Library', 'Android', 'sdk', 'platform-tools', 'adb'),
  ].filter((candidate): candidate is string => Boolean(candidate))

  return candidates.find((candidate) => existsSync(candidate)) ?? 'adb'
}

async function readAdbProp(adbCommand: string, serial: string, prop: string): Promise<string> {
  try {
    const result = await execFileAsync(adbCommand, ['-s', serial, 'shell', 'getprop', prop], {
      timeout: 5_000,
      maxBuffer: 64 * 1024,
    })
    return String(result.stdout).trim()
  } catch {
    return ''
  }
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}
