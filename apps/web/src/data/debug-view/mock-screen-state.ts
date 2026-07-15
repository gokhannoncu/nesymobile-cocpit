// ============================================================================
// Debug View — Screen State (live screen state) mock data
// ============================================================================
// What is on the screen right now? DeliveryFragment example. Field names are real
// DeliveryFragment properties and activity-scoped SharedViewModel
// exact matches with states. collectionType = CollectionType enum.

import type { ScreenSnapshot } from './types'

export const MOCK_SCREEN_STATE: ScreenSnapshot = {
  fragmentName: 'DeliveryFragment',
  activityName: 'MainActivity',
  viewModelName: 'SharedViewModel (activityViewModels)',
  navGraphDestination: 'deliveryFragment',
  lifecycleState: 'RESUMED',
  enteredAt: '2026-07-15T09:13:41+02:00',
  timeOnScreenSec: 138,
  collectionType: 'CreditCard',
  collectionTypeRaw: 6,
  fields: [
    // ── Lifecycle ──
    { name: 'lifecycleState', type: 'Lifecycle.State', value: 'RESUMED', group: 'lifecycle' },
    { name: 'binding', type: 'FragmentDeliveryBinding?', value: 'attached', group: 'lifecycle' },
    { name: 'isAllDataLoaded', type: 'Boolean', value: 'true', group: 'lifecycle' },

    // ── SharedViewModel (activity-scoped) ──
    { name: 'viewModel.currentTask', type: 'StateFlow<Task?>', value: 'TASK-1001', group: 'viewmodel' },
    { name: 'viewModel.lastFetchedCollections', type: 'LiveData<List<Collection>>', value: '1 collection (EUR 249.90)', group: 'viewmodel' },
    { name: 'viewModel.stopListPageEntity.currentStopList', type: 'List<Stop>?', value: '3 stops', group: 'viewmodel' },
    { name: 'viewModel.mergeStopsUiState', type: 'MergeStopsUiState', value: 'NotActive', group: 'viewmodel' },
    { name: 'viewModel.postponeScheduleUiState', type: 'PostponeTourUiState', value: 'NotActive', group: 'viewmodel' },

    // ── Selection / current context ──
    { name: 'stop', type: 'Stop?', value: 'STOP-001', group: 'selection' },
    { name: 'currentTask', type: 'Task?', value: 'TASK-1001', group: 'selection' },
    { name: 'task', type: 'Task (lateinit)', value: 'TASK-1001 (Delivery)', group: 'selection' },
    { name: 'selectedShipmentId', type: 'String', value: 'HR304418872299', group: 'selection' },
    { name: 'barcodeList', type: 'ArrayList<String>', value: '["HR304418872299001","HR304418872299002"]', group: 'selection' },
    { name: 'selectedBarcodeList', type: 'MutableList<String>', value: '["HR304418872299001","HR304418872299002"]', group: 'selection' },
    { name: 'initialBarcode', type: 'String', value: 'HR304418872299001', group: 'selection' },
    { name: 'allShipments', type: 'MutableList<Shipment>', value: '1 shipment', group: 'selection' },

    // ── UI state ──
    { name: 'collectionType', type: 'CollectionType', value: 'CreditCard (6)', group: 'ui-state' },
    { name: 'totalPayment', type: 'Double', value: '249.90', group: 'ui-state' },
    { name: 'totalCod', type: 'Double', value: '249.90', group: 'ui-state' },
    { name: 'totalExw', type: 'Double', value: '0.00', group: 'ui-state' },
    { name: 'currency', type: 'String', value: '€', group: 'ui-state' },
    { name: 'shipmentModelList', type: 'ArrayList<ShipmentDeliveryModel>', value: '1 row', group: 'ui-state' },

    // ── Flags ──
    { name: 'isDeliveryInProgress', type: 'Boolean', value: 'false', group: 'flags' },
    { name: 'isTogether', type: 'Boolean', value: 'true', group: 'flags' },
    { name: 'hasSignImage', type: 'Boolean', value: 'true', group: 'flags' },
    { name: 'fiscalCreated', type: 'Boolean', value: 'true', group: 'flags' },
    { name: 'currentFiscalInvoiceId', type: 'String?', value: 'FIS-HR-88213', group: 'flags' },
    { name: 'taskIsPudoOrLocker', type: 'Boolean', value: 'false', group: 'flags' },
    { name: 'exwSkipForCurrentDelivery', type: 'Boolean', value: 'false', group: 'flags' },
    { name: 'countryCode', type: 'String (BuildConfig)', value: 'HR', group: 'flags' },
  ],
  recentEvents: [
    { id: 'ev-1', timestamp: '2026-07-15T09:13:41+02:00', type: 'navigation', label: 'navigate(deliveryFragment)', detail: 'from tasksFragment, bundle: taskId=TASK-1001' },
    { id: 'ev-2', timestamp: '2026-07-15T09:13:41+02:00', type: 'lifecycle', label: 'onCreateView', detail: 'setFirebaseCrashlyticsLogs(DeliveryFragment)' },
    { id: 'ev-3', timestamp: '2026-07-15T09:13:42+02:00', type: 'network', label: 'GetShipmentDetails', detail: 'waybill HR304418872299 → 200 OK' },
    { id: 'ev-4', timestamp: '2026-07-15T09:13:45+02:00', type: 'state', label: 'isAllDataLoaded = true', detail: 'shipmentModelList populated (1 row)' },
    { id: 'ev-5', timestamp: '2026-07-15T09:13:58+02:00', type: 'user', label: 'scan barcode', detail: 'HR304418872299001 → added to selectedBarcodeList' },
    { id: 'ev-6', timestamp: '2026-07-15T09:14:01+02:00', type: 'user', label: 'scan barcode', detail: 'HR304418872299002 → isTogether = true' },
    { id: 'ev-7', timestamp: '2026-07-15T09:14:02+02:00', type: 'user', label: 'tap "Deliver"', detail: 'showDeliveryTypeDialog() → DELY' },
    { id: 'ev-8', timestamp: '2026-07-15T09:14:02+02:00', type: 'state', label: 'collectionType = CreditCard', detail: 'VPos payment confirmed, collectionTypeSnapshot=6' },
    { id: 'ev-9', timestamp: '2026-07-15T09:14:05+02:00', type: 'network', label: 'DeliverParcels', detail: 'collectiveDelivery(deliveryReq) → queued + 200 OK' },
    { id: 'ev-10', timestamp: '2026-07-15T09:14:31+02:00', type: 'network', label: 'SaveImageFile', detail: 'signature upload → 200 OK' },
  ],
}

/** Secondary screen examples — for "past screens" selection on the Screen State page. */
export const SCREEN_HISTORY: { fragmentName: string; enteredAt: string; timeOnScreenSec: number; destination: string }[] = [
  { fragmentName: 'StopsFragment', enteredAt: '2026-07-15T09:12:04+02:00', timeOnScreenSec: 41, destination: 'stopsFragment' },
  { fragmentName: 'TaskFragment', enteredAt: '2026-07-15T09:12:45+02:00', timeOnScreenSec: 56, destination: 'tasksFragment' },
  { fragmentName: 'DeliveryFragment', enteredAt: '2026-07-15T09:13:41+02:00', timeOnScreenSec: 138, destination: 'deliveryFragment' },
]
