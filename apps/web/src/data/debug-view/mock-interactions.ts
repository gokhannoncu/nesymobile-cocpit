// ============================================================================
// Debug View — User Interaction Timeline mock data
// ============================================================================
// Cihazdaki kullanıcı etkileşim geçmişi: app open → login → tıklama → ekran
// açılışı → tarama → ağ isteği. Ekran adları Constants.*Fragment, nav
// hedefleri navigation.xml, analytics event'leri gerçek logEvent isimleri.

import type { InteractionEvent, InteractionKind } from './types'
import type { Tone } from '@/components/product'

export const MOCK_INTERACTIONS: InteractionEvent[] = [
  { id: 'i-01', timestamp: '2026-07-15T09:11:48+02:00', offsetMs: 0, kind: 'app', screen: 'ArasApplication', label: 'Uygulama açıldı (cold start)', detail: 'onCreate → FirebaseMessaging token fetch', analyticsEvent: null },
  { id: 'i-02', timestamp: '2026-07-15T09:11:49+02:00', offsetMs: 1120, kind: 'screen', screen: 'LoginFragment', label: 'Login ekranı gösterildi', detail: 'navigate(loginFragment)', analyticsEvent: null },
  { id: 'i-03', timestamp: '2026-07-15T09:11:58+02:00', offsetMs: 10230, kind: 'input', screen: 'LoginFragment', label: 'Kullanıcı adı girildi', detail: 'etUserName = "ikrunic"', analyticsEvent: null },
  { id: 'i-04', timestamp: '2026-07-15T09:12:02+02:00', offsetMs: 14010, kind: 'input', screen: 'LoginFragment', label: 'Parola girildi', detail: 'etPassword = ••••••••', analyticsEvent: null },
  { id: 'i-05', timestamp: '2026-07-15T09:12:03+02:00', offsetMs: 15220, kind: 'click', screen: 'LoginFragment', label: 'Giriş butonuna tıklandı', detail: 'btnLogin → loginMobile()', analyticsEvent: 'deletedRequestDao' },
  { id: 'i-06', timestamp: '2026-07-15T09:12:03+02:00', offsetMs: 15340, kind: 'network', screen: 'LoginFragment', label: 'Auth/LoginMobile', detail: 'POST → 200 OK (380ms)', analyticsEvent: null },
  { id: 'i-07', timestamp: '2026-07-15T09:12:04+02:00', offsetMs: 16880, kind: 'screen', screen: 'StopsFragment', label: 'Duraklar ekranı açıldı', detail: 'navigate(stopsFragment)', analyticsEvent: null },
  { id: 'i-08', timestamp: '2026-07-15T09:12:05+02:00', offsetMs: 17010, kind: 'network', screen: 'StopsFragment', label: 'Task/GetMyScheduleByZoneCode', detail: 'POST → 200 OK, 18 durak yüklendi', analyticsEvent: null },
  { id: 'i-09', timestamp: '2026-07-15T09:12:44+02:00', offsetMs: 56120, kind: 'click', screen: 'StopsFragment', label: 'STOP-001 durağına tıklandı', detail: 'Konzum d.d. — Ulica grada Vukovara 269A', analyticsEvent: null },
  { id: 'i-10', timestamp: '2026-07-15T09:12:45+02:00', offsetMs: 57240, kind: 'screen', screen: 'TaskFragment', label: 'Görev listesi ekranı açıldı', detail: 'navigate(tasksFragment), stopId=STOP-001', analyticsEvent: null },
  { id: 'i-11', timestamp: '2026-07-15T09:13:40+02:00', offsetMs: 112010, kind: 'click', screen: 'TaskFragment', label: 'TASK-1001 görevine tıklandı', detail: 'Delivery — HR304418872299', analyticsEvent: null },
  { id: 'i-12', timestamp: '2026-07-15T09:13:41+02:00', offsetMs: 113180, kind: 'screen', screen: 'DeliveryFragment', label: 'Teslimat ekranı açıldı', detail: 'navigate(deliveryFragment), taskId=TASK-1001', analyticsEvent: null },
  { id: 'i-13', timestamp: '2026-07-15T09:13:42+02:00', offsetMs: 114300, kind: 'network', screen: 'DeliveryFragment', label: 'Shipment/GetShipmentDetails', detail: 'POST → 200 OK', analyticsEvent: null },
  { id: 'i-14', timestamp: '2026-07-15T09:13:58+02:00', offsetMs: 130220, kind: 'scan', screen: 'DeliveryFragment', label: 'Barkod tarandı', detail: 'HR304418872299001', analyticsEvent: null },
  { id: 'i-15', timestamp: '2026-07-15T09:14:01+02:00', offsetMs: 133010, kind: 'scan', screen: 'DeliveryFragment', label: 'Barkod tarandı', detail: 'HR304418872299002 (isTogether=true)', analyticsEvent: null },
  { id: 'i-16', timestamp: '2026-07-15T09:14:02+02:00', offsetMs: 134120, kind: 'click', screen: 'DeliveryFragment', label: '"Teslim Et" butonuna tıklandı', detail: 'showDeliveryTypeDialog() → DELY seçildi', analyticsEvent: null },
  { id: 'i-17', timestamp: '2026-07-15T09:14:03+02:00', offsetMs: 135400, kind: 'click', screen: 'DeliveryFragment', label: 'Kredi kartı ödemesi seçildi', detail: 'collectionType = CreditCard (6), VPos', analyticsEvent: null },
  { id: 'i-18', timestamp: '2026-07-15T09:14:05+02:00', offsetMs: 137220, kind: 'network', screen: 'DeliveryFragment', label: 'Task/DeliverParcels', detail: 'POST → 200 OK, teslim edildi', analyticsEvent: null },
  { id: 'i-19', timestamp: '2026-07-15T09:14:31+02:00', offsetMs: 163010, kind: 'network', screen: 'DeliveryFragment', label: 'Task/f/SaveImageFile', detail: 'imza yüklendi → 200 OK', analyticsEvent: null },
  { id: 'i-20', timestamp: '2026-07-15T09:16:18+02:00', offsetMs: 270440, kind: 'error', screen: 'DeliveryFailedFragment', label: 'Task/DeliveryFailed başarısız', detail: 'HTTP 500 → offline kuyruğa alındı', analyticsEvent: 'requestHttpStatusNot200' },
]

/** Etkileşim türü meta bilgisi (ikon UI tarafında eşlenir). */
export const INTERACTION_KIND_META: Record<InteractionKind, { label: string; tone: Tone }> = {
  app: { label: 'Uygulama', tone: 'indigo' },
  screen: { label: 'Ekran', tone: 'blue' },
  click: { label: 'Tıklama', tone: 'teal' },
  input: { label: 'Giriş', tone: 'gray' },
  scan: { label: 'Tarama', tone: 'purple' },
  network: { label: 'Ağ', tone: 'green' },
  system: { label: 'Sistem', tone: 'amber' },
  error: { label: 'Hata', tone: 'red' },
}
