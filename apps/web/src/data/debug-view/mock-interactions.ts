// ============================================================================
// Debug View — User Interaction Timeline mock data
// ============================================================================
// User interaction history on the device: app open → login → click → screen
// opening → scan → network request. Screen names Constants.*Fragment, nav
// destinations navigation.xml, analytics events are real logEvent names.

import type { InteractionEvent, InteractionKind } from './types'
import type { Tone } from '@/components/product'

export const MOCK_INTERACTIONS: InteractionEvent[] = [
  { id: 'i-01', timestamp: '2026-07-15T09:11:48+02:00', offsetMs: 0, kind: 'app', screen: 'ArasApplication', label: 'App opened (cold start)', detail: 'onCreate → FirebaseMessaging token fetch', analyticsEvent: null },
  { id: 'i-02', timestamp: '2026-07-15T09:11:49+02:00', offsetMs: 1120, kind: 'screen', screen: 'LoginFragment', label: 'Login screen displayed', detail: 'navigate(loginFragment)', analyticsEvent: null },
  { id: 'i-03', timestamp: '2026-07-15T09:11:58+02:00', offsetMs: 10230, kind: 'input', screen: 'LoginFragment', label: 'Username entered', detail: 'etUserName = "ikrunic"', analyticsEvent: null },
  { id: 'i-04', timestamp: '2026-07-15T09:12:02+02:00', offsetMs: 14010, kind: 'input', screen: 'LoginFragment', label: 'Password entered', detail: 'etPassword = ••••••••', analyticsEvent: null },
  { id: 'i-05', timestamp: '2026-07-15T09:12:03+02:00', offsetMs: 15220, kind: 'click', screen: 'LoginFragment', label: 'Login button clicked', detail: 'btnLogin → loginMobile()', analyticsEvent: 'deletedRequestDao' },
  { id: 'i-06', timestamp: '2026-07-15T09:12:03+02:00', offsetMs: 15340, kind: 'network', screen: 'LoginFragment', label: 'Auth/LoginMobile', detail: 'POST → 200 OK (380ms)', analyticsEvent: null },
  { id: 'i-07', timestamp: '2026-07-15T09:12:04+02:00', offsetMs: 16880, kind: 'screen', screen: 'StopsFragment', label: 'Stops screen opened', detail: 'navigate(stopsFragment)', analyticsEvent: null },
  { id: 'i-08', timestamp: '2026-07-15T09:12:05+02:00', offsetMs: 17010, kind: 'network', screen: 'StopsFragment', label: 'Task/GetMyScheduleByZoneCode', detail: 'POST → 200 OK, 18 stops loaded', analyticsEvent: null },
  { id: 'i-09', timestamp: '2026-07-15T09:12:44+02:00', offsetMs: 56120, kind: 'click', screen: 'StopsFragment', label: 'STOP-001 stop clicked', detail: 'Konzum d.d. — Ulica grada Vukovara 269A', analyticsEvent: null },
  { id: 'i-10', timestamp: '2026-07-15T09:12:45+02:00', offsetMs: 57240, kind: 'screen', screen: 'TaskFragment', label: 'Task list screen opened', detail: 'navigate(tasksFragment), stopId=STOP-001', analyticsEvent: null },
  { id: 'i-11', timestamp: '2026-07-15T09:13:40+02:00', offsetMs: 112010, kind: 'click', screen: 'TaskFragment', label: 'TASK-1001 task clicked', detail: 'Delivery — HR304418872299', analyticsEvent: null },
  { id: 'i-12', timestamp: '2026-07-15T09:13:41+02:00', offsetMs: 113180, kind: 'screen', screen: 'DeliveryFragment', label: 'Delivery screen opened', detail: 'navigate(deliveryFragment), taskId=TASK-1001', analyticsEvent: null },
  { id: 'i-13', timestamp: '2026-07-15T09:13:42+02:00', offsetMs: 114300, kind: 'network', screen: 'DeliveryFragment', label: 'Shipment/GetShipmentDetails', detail: 'POST → 200 OK', analyticsEvent: null },
  { id: 'i-14', timestamp: '2026-07-15T09:13:58+02:00', offsetMs: 130220, kind: 'scan', screen: 'DeliveryFragment', label: 'Barcode scanned', detail: 'HR304418872299001', analyticsEvent: null },
  { id: 'i-15', timestamp: '2026-07-15T09:14:01+02:00', offsetMs: 133010, kind: 'scan', screen: 'DeliveryFragment', label: 'Barcode scanned', detail: 'HR304418872299002 (isTogether=true)', analyticsEvent: null },
  { id: 'i-16', timestamp: '2026-07-15T09:14:02+02:00', offsetMs: 134120, kind: 'click', screen: 'DeliveryFragment', label: '"Deliver" button clicked', detail: 'showDeliveryTypeDialog() → DELY selected', analyticsEvent: null },
  { id: 'i-17', timestamp: '2026-07-15T09:14:03+02:00', offsetMs: 135400, kind: 'click', screen: 'DeliveryFragment', label: 'Credit card payment selected', detail: 'collectionType = CreditCard (6), VPos', analyticsEvent: null },
  { id: 'i-18', timestamp: '2026-07-15T09:14:05+02:00', offsetMs: 137220, kind: 'network', screen: 'DeliveryFragment', label: 'Task/DeliverParcels', detail: 'POST → 200 OK, delivered', analyticsEvent: null },
  { id: 'i-19', timestamp: '2026-07-15T09:14:31+02:00', offsetMs: 163010, kind: 'network', screen: 'DeliveryFragment', label: 'Task/f/SaveImageFile', detail: 'signature uploaded → 200 OK', analyticsEvent: null },
  { id: 'i-20', timestamp: '2026-07-15T09:16:18+02:00', offsetMs: 270440, kind: 'error', screen: 'DeliveryFailedFragment', label: 'Task/DeliveryFailed failed', detail: 'HTTP 500 → added to offline queue', analyticsEvent: 'requestHttpStatusNot200' },
]

/** Interaction type metadata (icon matched on UI side). */
export const INTERACTION_KIND_META: Record<InteractionKind, { label: string; tone: Tone }> = {
  app: { label: 'App', tone: 'indigo' },
  screen: { label: 'Screen', tone: 'blue' },
  click: { label: 'Click', tone: 'teal' },
  input: { label: 'Input', tone: 'gray' },
  scan: { label: 'Scan', tone: 'purple' },
  network: { label: 'Network', tone: 'green' },
  system: { label: 'System', tone: 'amber' },
  error: { label: 'Error', tone: 'red' },
}
