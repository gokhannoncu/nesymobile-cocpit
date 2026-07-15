import type {
  DbgCollection,
  DbgSchedule,
  DbgShipment,
  DbgShipmentItem,
  DbgStop,
  DbgTask,
} from '@/data/debug-view/types'

type UnknownRecord = Record<string, unknown>

export interface ParsedDeviceSchedule {
  schedule: DbgSchedule | null
  warnings: string[]
}

function record(value: unknown): UnknownRecord {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function pick(source: UnknownRecord, ...keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key]
  }
  return undefined
}

function text(value: unknown, fallback = ''): string {
  if (value == null) return fallback
  return typeof value === 'string' ? value : String(value)
}

function nullableText(value: unknown): string | null {
  const parsed = text(value).trim()
  return parsed ? parsed : null
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

function parseJson(value: unknown, label: string, warnings: string[]): unknown {
  if (value == null || value === '') return {}
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value) as unknown
  } catch (error) {
    warnings.push(`${label} could not be parsed: ${error instanceof Error ? error.message : 'invalid JSON'}`)
    return {}
  }
}

function normalizeCollection(value: unknown): DbgCollection {
  const source = record(value)
  return {
    collectionAmount: numberValue(pick(source, 'collectionAmount', 'amount')),
    collectionStatus: numberValue(pick(source, 'collectionStatus', 'status')),
    collectionType: numberValue(pick(source, 'collectionType', 'type')),
    currency: nullableText(pick(source, 'currency', 'currencyCode')),
    serviceType: numberValue(pick(source, 'serviceType')),
    paymentTimeStamp: text(pick(source, 'paymentTimeStamp', 'paymentTimestamp')),
  }
}

function normalizeShipmentItem(value: unknown): DbgShipmentItem {
  const source = record(value)
  return {
    barcode: text(pick(source, 'barcode', 'shipmentItemBarcode', 'id'), '-'),
    legacySystemShortBarcode: nullableText(pick(source, 'legacySystemShortBarcode', 'shortBarcode')),
    deci: numberValue(pick(source, 'deci', 'desi')),
    weight: numberValue(pick(source, 'weight')),
    itemCurrentLocation: numberValue(pick(source, 'itemCurrentLocation', 'currentLocation')),
    shipmentItemStatus: numberValue(pick(source, 'shipmentItemStatus', 'status')),
    deliveryFailureReason: numberValue(pick(source, 'deliveryFailureReason', 'failureReason')),
    isOverSize: booleanValue(pick(source, 'isOverSize', 'isOversize')),
    lastStatusUpdatedAt: nullableText(pick(source, 'lastStatusUpdatedAt', 'statusUpdatedAt')),
  }
}

function normalizeShipment(value: unknown): DbgShipment {
  const source = record(value)
  const shipmentItems = array(pick(source, 'shipmentItemList', 'shipmentItems', 'items'))
    .map(normalizeShipmentItem)
  return {
    waybillNumber: text(pick(source, 'waybillNumber', 'trackingNumber', 'id'), '-'),
    trackingNumber: text(pick(source, 'trackingNumber', 'waybillNumber')),
    deliveryCode: nullableText(pick(source, 'deliveryCode')),
    sender: nullableText(pick(source, 'sender', 'senderName')),
    marketPlace: nullableText(pick(source, 'marketPlace', 'marketplace')),
    packageType: numberValue(pick(source, 'packageType')),
    shipmentStatus: numberValue(pick(source, 'shipmentStatus', 'status')),
    shipmentType: numberValue(pick(source, 'shipmentType', 'type')),
    recipientType: numberValue(pick(source, 'recipientType')),
    customerTypeId: numberValue(pick(source, 'customerTypeId', 'customerType')),
    isDocumentCollection: booleanValue(pick(source, 'isDocumentCollection')),
    isRedirection: numberValue(pick(source, 'isRedirection')),
    shipmentItemCount: numberValue(pick(source, 'shipmentItemCount'), shipmentItems.length),
    activeShipmentItemCount: numberValue(pick(source, 'activeShipmentItemCount'), shipmentItems.length),
    deliveryRemark: nullableText(pick(source, 'deliveryRemark', 'remarkText')),
    consigneeGsm: nullableText(pick(source, 'consigneeGsm', 'gsm')),
    collections: array(pick(source, 'collections', 'collectionList')).map(normalizeCollection),
    shipmentItemList: shipmentItems,
  }
}

function normalizeTask(value: unknown): DbgTask {
  const source = record(value)
  return {
    taskId: text(pick(source, 'taskId', 'id'), '-'),
    lastStopId: nullableText(pick(source, 'lastStopId')),
    taskStatus: numberValue(pick(source, 'taskStatus', 'status')),
    taskType: numberValue(pick(source, 'taskType', 'type')),
    taskParty: nullableText(pick(source, 'taskParty', 'party', 'consigneeName')),
    taskAddress: nullableText(pick(source, 'taskAddress', 'address')),
    streetTag: nullableText(pick(source, 'streetTag')),
    gsm: nullableText(pick(source, 'gsm', 'phone', 'consigneeGsm')),
    consigneeEmail: nullableText(pick(source, 'consigneeEmail', 'email')),
    isConsigneeAtTheAddress: booleanValue(pick(source, 'isConsigneeAtTheAddress')),
    isDropAtTheDoor: booleanValue(pick(source, 'isDropAtTheDoor')),
    waveNumber: numberValue(pick(source, 'waveNumber')),
    remarkText: nullableText(pick(source, 'remarkText', 'remark')),
    shipmentList: array(pick(source, 'shipmentList', 'shipments')).map(normalizeShipment),
  }
}

function normalizeStop(value: unknown, fallbackIndex: number, fallbackStopId: string): DbgStop {
  const outer = record(value)
  const source = Object.keys(record(outer.stop)).length > 0 ? record(outer.stop) : outer
  const timeWindow = record(pick(source, 'timeWindow'))
  return {
    stopId: text(pick(source, 'stopId', 'id'), fallbackStopId || `stop-${fallbackIndex + 1}`),
    stopOrder: numberValue(pick(source, 'stopOrder', 'order'), fallbackIndex + 1),
    timeWindow: {
      startTime: text(pick(timeWindow, 'startTime', 'start') ?? pick(source, 'timeWindowStart', 'startTime'), '-'),
      endTime: text(pick(timeWindow, 'endTime', 'end') ?? pick(source, 'timeWindowEnd', 'endTime'), '-'),
    },
    estimatedTimeOfArrival: text(pick(source, 'estimatedTimeOfArrival', 'estimatedArrivalTime', 'eta')),
    latitude: numberValue(pick(source, 'latitude', 'lat')),
    longitude: numberValue(pick(source, 'longitude', 'lng', 'lon')),
    orderChanged: booleanValue(pick(source, 'orderChanged', 'isOrderChanged')),
    taskList: array(pick(source, 'taskList', 'tasks')).map(normalizeTask),
  }
}

/** Converts Room rows into the exact model consumed by Schedule Explorer. */
export function parseDeviceSchedule(
  scheduleRow: UnknownRecord | null,
  chunkRows: UnknownRecord[],
): ParsedDeviceSchedule {
  if (!scheduleRow) return { schedule: null, warnings: [] }

  const warnings: string[] = []
  const meta = record(parseJson(scheduleRow.scheduleMetaJson, 'Schedule.scheduleMetaJson', warnings))
  const body = record(parseJson(scheduleRow.body, 'Schedule.body', warnings))
  const scheduleId = text(pick(scheduleRow, 'scheduleId') ?? pick(meta, 'scheduleId') ?? pick(body, 'scheduleId'))

  const stopsFromChunks = chunkRows
    .map((chunk, index) => ({
      index: numberValue(pick(chunk, 'stopIndex'), index),
      stopId: text(pick(chunk, 'stopId')),
      value: parseJson(pick(chunk, 'stopJson'), `ScheduleStopChunk[${index}].stopJson`, warnings),
    }))
    .sort((a, b) => a.index - b.index)
    .map((chunk) => normalizeStop(chunk.value, chunk.index, chunk.stopId))
  const bodyStops = array(pick(body, 'stops', 'stopList')).map((stop, index) => normalizeStop(stop, index, ''))

  return {
    schedule: {
      id: numberValue(pick(scheduleRow, 'id')),
      scheduleId,
      timeStamp: text(pick(scheduleRow, 'timeStamp', 'timestamp') ?? pick(meta, 'modifiedAt', 'createdAt')),
      status: numberValue(pick(meta, 'scheduleStatus', 'status') ?? pick(body, 'scheduleStatus', 'status')),
      courierName: text(pick(meta, 'courierName') ?? pick(body, 'courierName'), '-'),
      courierId: text(pick(meta, 'courierUserId', 'courierId') ?? pick(body, 'courierUserId', 'courierId'), '-'),
      vehiclePlate: text(pick(meta, 'vehiclePlate', 'vehicleLicensePlate') ?? pick(body, 'vehiclePlate', 'vehicleLicensePlate'), '-'),
      branchCode: text(pick(meta, 'branchCode', 'branchId') ?? pick(body, 'branchCode', 'branchId'), '-'),
      stops: stopsFromChunks.length > 0 ? stopsFromChunks : bodyStops,
    },
    warnings,
  }
}
