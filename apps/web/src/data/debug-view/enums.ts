// ============================================================================
// Debug View — NesyMobile enum mappings (exact matches with schedule/model/*.kt)
// ============================================================================

import type { Tone } from '@/components/product'

export const TASK_STATUS: Record<number, { label: string; tone: Tone }> = {
  1: { label: 'Assigned', tone: 'blue' },
  2: { label: 'Completed', tone: 'green' },
  3: { label: 'Cancelled', tone: 'gray' },
  4: { label: 'CallAgain', tone: 'amber' },
  5: { label: 'WaitingForApproval', tone: 'purple' },
  6: { label: 'AllLoaded', tone: 'teal' },
}

export const TASK_TYPE: Record<number, { label: string; tone: Tone }> = {
  1: { label: 'Pickup', tone: 'amber' },
  2: { label: 'Delivery', tone: 'blue' },
  3: { label: 'PickupAA', tone: 'purple' },
}

export const SHIPMENT_STATUS: Record<number, { label: string; tone: Tone }> = {
  0: { label: 'Created', tone: 'gray' },
  1: { label: 'PickedUp', tone: 'teal' },
  2: { label: 'Delivered', tone: 'green' },
  6: { label: 'WrongAddress', tone: 'red' },
  8: { label: 'ConsigneeRefusedDelivery', tone: 'red' },
  11: { label: 'ConsigneeWasNotAtTheAddress', tone: 'amber' },
  24: { label: 'DeliveredToCounterLocation', tone: 'green' },
  34: { label: 'ConsigneeMadeRedirection', tone: 'purple' },
}

export const SHIPMENT_ITEM_STATUS: Record<number, { label: string; tone: Tone }> = {
  0: { label: 'SaveShipment', tone: 'gray' },
  1: { label: 'Preorder', tone: 'gray' },
  2: { label: 'Cancelled', tone: 'gray' },
  3: { label: 'PickedUp', tone: 'teal' },
  4: { label: 'Loaded', tone: 'blue' },
  5: { label: 'UnloadedForApprove', tone: 'amber' },
  6: { label: 'Delivered', tone: 'green' },
  7: { label: 'Damaged', tone: 'red' },
  8: { label: 'Lost', tone: 'red' },
  9: { label: 'Recalled', tone: 'orange' },
  10: { label: 'Unloaded', tone: 'indigo' },
  11: { label: 'Redirected', tone: 'purple' },
  14: { label: 'NotPickedUp', tone: 'amber' },
}

export const COLLECTION_TYPE: Record<number, { label: string; tone: Tone }> = {
  0: { label: 'None', tone: 'gray' },
  1: { label: 'Cash', tone: 'green' },
  6: { label: 'CreditCard', tone: 'blue' },
  7: { label: 'VPos', tone: 'purple' },
  8: { label: 'OnInvoice', tone: 'amber' },
}

export const COLLECTION_STATUS: Record<number, { label: string; tone: Tone }> = {
  0: { label: 'None', tone: 'gray' },
  1: { label: 'Collected', tone: 'green' },
  2: { label: 'NotCollected', tone: 'red' },
}

export const SERVICE_TYPE: Record<number, { label: string; tone: Tone }> = {
  20: { label: 'COD', tone: 'blue' },
  22: { label: 'Exwork', tone: 'purple' },
  39: { label: 'CashPrepayed', tone: 'teal' },
}

export const PACKAGE_TYPE: Record<number, string> = {
  1: 'Parcel',
  2: 'Document',
  3: 'Pallet',
}

export const SCHEDULE_STATUS: Record<number, { label: string; tone: Tone }> = {
  0: { label: 'Draft', tone: 'gray' },
  1: { label: 'Active', tone: 'green' },
  2: { label: 'Completed', tone: 'blue' },
  3: { label: 'EndOfDayRequested', tone: 'amber' },
}

/** Helper — safe label for unknown int. */
export function enumLabel(
  map: Record<number, { label: string; tone: Tone }>,
  value: number,
): { label: string; tone: Tone } {
  return map[value] ?? { label: `#${value}`, tone: 'gray' }
}
