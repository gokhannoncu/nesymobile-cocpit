export interface DeviceDisplayParts {
  manufacturer?: string | null
  marketName?: string | null
  modelName?: string | null
}

export interface DeviceDisplayIdentity {
  serial: string
  modelName: string
  label: string
  product?: string | null
}

export function normalizeDeviceText(value: string | null | undefined): string {
  return value?.trim().replace(/_/g, ' ') || ''
}

function titleCaseWord(value: string): string {
  if (!value) return ''
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

/** Same shape as the editor picker: "Samsung SM-A346E". */
export function formatDeviceModelLabel(parts: DeviceDisplayParts): string | null {
  const model =
    normalizeDeviceText(parts.marketName) || normalizeDeviceText(parts.modelName)
  if (!model) return null
  const manufacturer = normalizeDeviceText(parts.manufacturer)
  if (!manufacturer) return model
  const titled = titleCaseWord(manufacturer)
  return model.toLowerCase().startsWith(manufacturer.toLowerCase())
    ? model
    : `${titled} ${model}`
}

export function identityFromAdbDevice(device: {
  id: string
  modelName?: string | null
  manufacturer?: string | null
  marketName?: string | null
  product?: string | null
}): DeviceDisplayIdentity | null {
  const serial = device.id.trim()
  if (!serial) return null
  const label = formatDeviceModelLabel({
    manufacturer: device.manufacturer,
    marketName: device.marketName,
    modelName: device.modelName,
  })
  const modelName =
    normalizeDeviceText(device.marketName) ||
    normalizeDeviceText(device.modelName) ||
    label
  if (!modelName && !label) return null
  return {
    serial,
    modelName: modelName || label || serial,
    label: label || modelName || serial,
    product: device.product ?? null,
  }
}

export function applyDeviceDisplay(
  run: Record<string, unknown>,
  displays: ReadonlyMap<string, Pick<DeviceDisplayIdentity, 'modelName' | 'label'>>,
): Record<string, unknown> {
  const serial = textOrNull(run.deviceId)
  if (!serial) return run
  if (textOrNull(run.deviceLabel) || textOrNull(run.deviceModelName)) return run
  const found = displays.get(serial)
  if (!found) return run
  return {
    ...run,
    deviceModelName: found.modelName,
    deviceLabel: found.label,
  }
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}
