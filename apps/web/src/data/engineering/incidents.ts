// Nesy Mobile incident playbooks — single source of truth.
// Source: Nesy ticket analysis (48 tickets) + incident triage matrix.
// Each group: first checks (with code locations), quick actions, and related screens.

export interface IncidentGroup {
  id: string
  name: string
  tone: 'red' | 'orange' | 'amber' | 'purple' | 'blue' | 'teal' | 'indigo' | 'gray'
  tickets: number
  open: number
  highRisk: number
  /** Code locations to check in the first 15 minutes. */
  firstChecks: { location: string; why: string }[]
  quickActions: string[]
  relatedScreens: string[]
}

export const SEVERITY_PROTOCOL = [
  {
    level: 'SEV-1',
    label: 'Field halted',
    tone: 'red' as const,
    examples: 'Double charge, mass silent logout, migration data loss, fiscal receipt cannot be printed (RS)',
    response: 'Intervention within 15 min · operations + backend + mobile together · country operations is notified',
  },
  {
    level: 'SEV-2',
    label: 'Flow broken, workaround available',
    tone: 'orange' as const,
    examples: 'Scan mismatch (manual entry possible), notification routing broken, D4Me reservation error',
    response: 'Same-day intervention · workaround announced to field · root cause within 48 hours',
  },
  {
    level: 'SEV-3',
    label: 'Limited impact',
    tone: 'amber' as const,
    examples: 'Single device issue, UI defect, low-volume endpoint regression',
    response: 'Prioritized in backlog · reviewed in weekly triage',
  },
]

export const FIRST_15_MINUTES = [
  'Determine impact scope: which country(ies), which version, how many couriers? (Crashlytics + version distribution)',
  'Classify: which playbook group? (one of the groups below) — if the group is unknown, search for the trigger in the Edge Case Map.',
  'Check offline queue status: is RequestSenderService locked (E8), is isOfflineMode stuck (E7)?',
  'Check the last deploy/version change: version-prod.json counters and recent CI runs.',
  'If there is financial impact (charge/fiscal), declare SEV-1; announce "do not retry the operation" to country operations.',
  'Collect evidence: device logs, Crashlytics events, related shipment IDs — record before applying any fix.',
]

export const INCIDENT_GROUPS: IncidentGroup[] = [
  {
    id: 'payment',
    name: 'Finance & Payment',
    tone: 'red',
    tickets: 15,
    open: 3,
    highRisk: 8,
    firstChecks: [
      { location: 'TaskListFragment.kt (~6,044 lines)', why: '5 payment methods (Cash/CreditCard/RaiPay/SoftPOS/WPOS) in a single fragment — which path was triggered?' },
      { location: 'SharedViewModel.revertShipmentFiscalCreated()', why: 'Fiscal status rollback — first place to check in double-receipt cases.' },
      { location: 'PrinterManager.kt (245) · printTextWithQrCode()', why: 'Zebra printer flow — "receipt cannot be printed" cases.' },
      { location: 'RequestSenderService (offline queue)', why: 'Payment event may have been written to the queue but never sent (E8/E9).' },
      { location: 'FiscalInvoiceData (Room)', why: 'Verify the match between fiscal record and delivery record (E28).' },
    ],
    quickActions: [
      'Compare the shipment payment/fiscal status on the device with the back-office record.',
      'If double charge is suspected, pull POS provider logs (RaiPay/SoftPos/WSPay).',
      'If receipt cannot be printed: printer connection → fiscal service (VPFR) → SSC compensation flow, in that order.',
    ],
    relatedScreens: ['Delivery', 'Delivery Failed', 'End of Day', 'Pick Up', 'Shipment Detail'],
  },
  {
    id: 'scan',
    name: 'Barcode & Scan',
    tone: 'orange',
    tickets: 10,
    open: 3,
    highRisk: 5,
    firstChecks: [
      { location: 'MainActivity.onBarcodeRead() (L1575)', why: 'Dispatches to 18 fragments via is-check — scan may have routed to the wrong screen (E31).' },
      { location: 'StopListFragment.whenBarcodeDetect()', why: 'O(n4) matching + barcode utils duplicated across 5 files — trim/variant inconsistency (E32).' },
      { location: 'ScanProcessor.kt (427) · 5 sec cooldown', why: 'Cooldown StateFlow may have swallowed a valid scan.' },
      { location: 'sp.forceLoadedBarcodeList (SharedPreferences)', why: 'Stale dedup list may flag a valid package as "duplicate" (E33).' },
    ],
    quickActions: [
      'Try the same barcode separately on TaskList and Delivery screens — if behavior differs, it is a matching duplication issue.',
      'If dedup is suspected, try clearing forceLoadedBarcodeList (restart session).',
      'Compare hardware scanner (Honeywell/Urovo/Zebra) behavior with camera scan.',
    ],
    relatedScreens: ['Stop List', 'Task List', 'Delivery Failed', 'Pick Up', 'Shipment Tracking'],
  },
  {
    id: 'tour',
    name: 'Tour & Delivery',
    tone: 'indigo',
    tickets: 6,
    open: 1,
    highRisk: 3,
    firstChecks: [
      { location: 'DeliveryFragment.deliverShipment() (160 lines, 5 levels deep)', why: 'Main path of the delivery flow — branching errors originate here.' },
      { location: 'DeliveryFragment.offlineDelivery() (165 lines)', why: 'Offline delivery path — secondary route for queue/sync issues.' },
      { location: 'DeliveryFailedFragment.showDeliveryFailedMenu() (240 lines)', why: 'Failed delivery reason list is duplicated in 5 places by country code.' },
    ],
    quickActions: [
      'Pull the shipment event chain (TOUR → DELY/RETS) — is there a sequence violation (E10)?',
      'If merged stop: verify the statuses of sub-shipments individually.',
      'Check TOUR retrieval errors for DDSP/DEPS redirected shipments.',
    ],
    relatedScreens: ['Delivery', 'Delivery Failed', 'Route Selection', 'Stop List'],
  },
  {
    id: 'state',
    name: 'State & Race',
    tone: 'purple',
    tickets: 4,
    open: 2,
    highRisk: 3,
    firstChecks: [
      { location: 'SharedViewModel (3,602 lines, ~100+ functions)', why: 'God object — currentTask may not have been cleared (E17).' },
      { location: 'StopListFragment (30+ mutable fields)', why: 'No state machine — race conditions originate here.' },
      { location: 'DeliveryFragment 5 sec Handler polling', why: 'Not lifecycle-aware — UI may update with stale state.' },
    ],
    quickActions: [
      'Restart device and retry the same flow — if issue disappears, it is a memory-state problem (permanent fix required).',
      'If double TOUR event is suspected, search for duplicate timestamps in the event chain.',
      'Identify the operation being performed when push (FCM) arrived — E15 push race pattern.',
    ],
    relatedScreens: ['Route Selection', 'Shipment Tracking', 'Pick Up', 'Stop List'],
  },
  {
    id: 'notification',
    name: 'Notification',
    tone: 'blue',
    tickets: 4,
    open: 2,
    highRisk: 0,
    firstChecks: [
      { location: 'MainActivity BroadcastReceiver (L266)', why: 'Notification tap routing is dispatched from here.' },
      { location: 'StopListFragment.showSavedNotification()', why: 'Saved notification display — missing/incorrect content cases.' },
      { location: 'NotificationInfo (Room)', why: 'Persistent form of the notification record — is the payload correct?' },
    ],
    quickActions: [
      'Verify the FCM payload from the Firebase console.',
      'Test notification → stop detail routing in three states: app open/closed/background.',
    ],
    relatedScreens: ['Stop List', 'Delivery', 'End of Day'],
  },
  {
    id: 'locker',
    name: 'D4Me & Locker',
    tone: 'teal',
    tickets: 4,
    open: 1,
    highRisk: 2,
    firstChecks: [
      { location: 'LeanLockerTaskListFragment (882 lines)', why: 'Locker task list — logs may be misleading due to incorrect Crashlytics constant.' },
      { location: 'SharedViewModel D4Me reservation flow', why: 'LCR creation and callback matching (14-digit ID rule in RS).' },
      { location: 'PudoLockerParcelReleaseFragment', why: 'Locker parcel release — existing observeForever leak.' },
    ],
    quickActions: [
      'Verify D4MeCallback events (DEPT/DELY/COPT) in sequence on the shipment.',
      'For RS cases, check the Legacy ID first 14 digits matching.',
      'If a multicolli shipment was placed in the locker, this is a known limitation — instruct operations to recall.',
    ],
    relatedScreens: ['D4Me/Locker', 'Delivery Failed', 'Route Selection'],
  },
  {
    id: 'location',
    name: 'Location & GPS',
    tone: 'amber',
    tickets: 2,
    open: 1,
    highRisk: 1,
    firstChecks: [
      { location: 'LocationService.kt (399 lines)', why: '1 sec sampling + 10 record batch — black hole pattern (E24).' },
      { location: 'MapFragment.kt (409)', why: 'WebView Leaflet map — CSS injection not working due to getElementsById typo.' },
      { location: 'LiveLocation (Room)', why: 'No retention — table bloat may cause ANR (E23).' },
    ],
    quickActions: [
      'Verify location permission status on the device — permission may have been revoked mid-day (E25).',
      'If dispatch says "courier disappeared," check whether there is a pending batch in the upload queue.',
    ],
    relatedScreens: ['Map/Navigation', 'Login/Settings'],
  },
  {
    id: 'crash',
    name: 'UI & Crash',
    tone: 'gray',
    tickets: 3,
    open: 2,
    highRisk: 2,
    firstChecks: [
      { location: 'MainActivity.onBackPressed() (150 lines, 20+ branches)', why: 'Deprecated + complex — state corruption from back button.' },
      { location: 'CameraFragment (787) · observeForever (L735)', why: 'Known memory leak — crash during long sessions.' },
      { location: 'Crashlytics console', why: 'Check country/version distribution of the same stack; manual recordException is scattered across ~30 files.' },
    ],
    quickActions: [
      'On crash spike, first check version correlation: single version? single country?',
      'For post-notification scan crash (ticket 4484) pattern, repro: notification → immediately scan barcode.',
    ],
    relatedScreens: ['Stop List', 'Task List', 'Camera'],
  },
]

export const INCIDENT_STATS = {
  totalTickets: 48,
  openTickets: 15,
  bySeverity: { critical: 2, high: 26, medium: 20 },
  byCountry: { HR: 21, RS: 12, General: 11, CEE: 4 },
  riskiestGroup: 'Finance & Payment (15 tickets · 8 high risk)',
  riskiestScreens: 'Delivery + Delivery Failed (16 tickets)',
}
