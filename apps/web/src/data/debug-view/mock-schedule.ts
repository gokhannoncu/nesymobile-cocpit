// ============================================================================
// Debug View — Schedule Explorer mock data
// ============================================================================
// Cihaz Room DB'sindeki Schedule → Stop → Task → Shipment → ShipmentItem
// ağacı. Alan adları NesyMobile database.schedule / database.stop
// entity'leriyle birebir. HR (Zagreb) rotası örneği.

import type { DbgSchedule } from './types'

export const MOCK_SCHEDULE: DbgSchedule = {
  id: 1,
  scheduleId: 'SCH-HR-2026-07-15-3391',
  timeStamp: '2026-07-15T06:05:12+02:00',
  status: 1, // Active
  courierName: 'Ivan Krunić',
  courierId: 'D4M-HR-8842',
  vehiclePlate: 'ZG-1842-KM',
  branchCode: 'HR-ZAG-01',
  stops: [
    {
      stopId: 'STOP-001',
      stopOrder: 1,
      timeWindow: { startTime: '08:00', endTime: '12:00' },
      estimatedTimeOfArrival: '2026-07-15T08:35:00+02:00',
      latitude: 45.815399,
      longitude: 15.966568,
      orderChanged: false,
      taskList: [
        {
          taskId: 'TASK-1001',
          lastStopId: 'STOP-001',
          taskStatus: 2, // Completed
          taskType: 2, // Delivery
          taskParty: 'Konzum d.d.',
          taskAddress: 'Ulica grada Vukovara 269A, 10000 Zagreb',
          streetTag: 'Ulica grada Vukovara',
          gsm: '+385 91 234 5678',
          consigneeEmail: 'reception@konzum.hr',
          isConsigneeAtTheAddress: true,
          isDropAtTheDoor: false,
          waveNumber: 1,
          remarkText: 'Leave at reception desk',
          shipmentList: [
            {
              waybillNumber: 'HR304418872299',
              trackingNumber: '304418872299',
              deliveryCode: '4471',
              sender: 'Zara Home HR',
              marketPlace: 'Zalando',
              packageType: 1,
              shipmentStatus: 2, // Delivered
              shipmentType: 0,
              recipientType: 1,
              customerTypeId: 2,
              isDocumentCollection: false,
              isRedirection: 0,
              shipmentItemCount: 2,
              activeShipmentItemCount: 2,
              deliveryRemark: 'Delivered to reception',
              consigneeGsm: '+385 91 234 5678',
              collections: [
                {
                  collectionAmount: 249.9,
                  collectionStatus: 1, // Collected
                  collectionType: 6, // CreditCard
                  currency: 'EUR',
                  serviceType: 20, // COD
                  paymentTimeStamp: '2026-07-15T09:14:02+02:00',
                },
              ],
              shipmentItemList: [
                {
                  barcode: 'HR304418872299001',
                  legacySystemShortBarcode: '8872299001',
                  deci: 3.5,
                  weight: 1.2,
                  itemCurrentLocation: 2,
                  shipmentItemStatus: 6, // Delivered
                  deliveryFailureReason: 0,
                  isOverSize: false,
                  lastStatusUpdatedAt: '2026-07-15T09:14:02+02:00',
                },
                {
                  barcode: 'HR304418872299002',
                  legacySystemShortBarcode: '8872299002',
                  deci: 5.0,
                  weight: 2.4,
                  itemCurrentLocation: 2,
                  shipmentItemStatus: 6,
                  deliveryFailureReason: 0,
                  isOverSize: false,
                  lastStatusUpdatedAt: '2026-07-15T09:14:02+02:00',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      stopId: 'STOP-002',
      stopOrder: 2,
      timeWindow: { startTime: '09:00', endTime: '13:00' },
      estimatedTimeOfArrival: '2026-07-15T09:50:00+02:00',
      latitude: 45.807123,
      longitude: 15.978212,
      orderChanged: true,
      taskList: [
        {
          taskId: 'TASK-1002',
          lastStopId: 'STOP-002',
          taskStatus: 4, // CallAgain
          taskType: 2, // Delivery
          taskParty: 'Marko Horvat',
          taskAddress: 'Savska cesta 41, 10000 Zagreb',
          streetTag: 'Savska cesta',
          gsm: '+385 98 765 4321',
          consigneeEmail: null,
          isConsigneeAtTheAddress: false,
          isDropAtTheDoor: false,
          waveNumber: 1,
          remarkText: 'Call before arrival',
          shipmentList: [
            {
              waybillNumber: 'HR304418000112',
              trackingNumber: '304418000112',
              deliveryCode: null,
              sender: 'eMAG HR',
              marketPlace: 'eMAG',
              packageType: 1,
              shipmentStatus: 11, // ConsigneeWasNotAtTheAddress
              shipmentType: 0,
              recipientType: 1,
              customerTypeId: 1,
              isDocumentCollection: false,
              isRedirection: 0,
              shipmentItemCount: 1,
              activeShipmentItemCount: 1,
              deliveryRemark: 'No answer, second attempt scheduled',
              consigneeGsm: '+385 98 765 4321',
              collections: [
                {
                  collectionAmount: 89.0,
                  collectionStatus: 2, // NotCollected
                  collectionType: 1, // Cash
                  currency: 'EUR',
                  serviceType: 20,
                  paymentTimeStamp: '',
                },
              ],
              shipmentItemList: [
                {
                  barcode: 'HR304418000112001',
                  legacySystemShortBarcode: '8000112001',
                  deci: 2.0,
                  weight: 0.8,
                  itemCurrentLocation: 1,
                  shipmentItemStatus: 4, // Loaded
                  deliveryFailureReason: 11,
                  isOverSize: false,
                  lastStatusUpdatedAt: '2026-07-15T09:16:48+02:00',
                },
              ],
            },
          ],
        },
        {
          taskId: 'TASK-1003',
          lastStopId: 'STOP-002',
          taskStatus: 1, // Assigned
          taskType: 1, // Pickup
          taskParty: 'Tehnomobil d.o.o.',
          taskAddress: 'Savska cesta 41, 10000 Zagreb',
          streetTag: 'Savska cesta',
          gsm: '+385 1 611 2233',
          consigneeEmail: 'logistika@tehnomobil.hr',
          isConsigneeAtTheAddress: true,
          isDropAtTheDoor: false,
          waveNumber: 2,
          remarkText: null,
          shipmentList: [
            {
              waybillNumber: 'HR304419500777',
              trackingNumber: '304419500777',
              deliveryCode: null,
              sender: 'Tehnomobil d.o.o.',
              marketPlace: null,
              packageType: 3, // Pallet
              shipmentStatus: 0, // Created
              shipmentType: 0,
              recipientType: 2,
              customerTypeId: 2,
              isDocumentCollection: false,
              isRedirection: 0,
              shipmentItemCount: 4,
              activeShipmentItemCount: 4,
              deliveryRemark: null,
              consigneeGsm: '+385 1 611 2233',
              collections: [],
              shipmentItemList: [
                { barcode: 'HR304419500777001', legacySystemShortBarcode: '9500777001', deci: 40, weight: 18.5, itemCurrentLocation: 0, shipmentItemStatus: 0, deliveryFailureReason: 0, isOverSize: true, lastStatusUpdatedAt: null },
                { barcode: 'HR304419500777002', legacySystemShortBarcode: '9500777002', deci: 40, weight: 17.2, itemCurrentLocation: 0, shipmentItemStatus: 0, deliveryFailureReason: 0, isOverSize: true, lastStatusUpdatedAt: null },
                { barcode: 'HR304419500777003', legacySystemShortBarcode: '9500777003', deci: 35, weight: 15.0, itemCurrentLocation: 0, shipmentItemStatus: 0, deliveryFailureReason: 0, isOverSize: false, lastStatusUpdatedAt: null },
                { barcode: 'HR304419500777004', legacySystemShortBarcode: '9500777004', deci: 35, weight: 15.8, itemCurrentLocation: 0, shipmentItemStatus: 0, deliveryFailureReason: 0, isOverSize: false, lastStatusUpdatedAt: null },
              ],
            },
          ],
        },
      ],
    },
    {
      stopId: 'STOP-003',
      stopOrder: 3,
      timeWindow: { startTime: '10:00', endTime: '16:00' },
      estimatedTimeOfArrival: '2026-07-15T11:20:00+02:00',
      latitude: 45.792341,
      longitude: 15.951002,
      orderChanged: false,
      taskList: [
        {
          taskId: 'TASK-1004',
          lastStopId: 'STOP-003',
          taskStatus: 1, // Assigned
          taskType: 2, // Delivery
          taskParty: 'Ana Novak',
          taskAddress: 'Ilica 242, 10000 Zagreb',
          streetTag: 'Ilica',
          gsm: '+385 95 111 2222',
          consigneeEmail: 'ana.novak@example.hr',
          isConsigneeAtTheAddress: true,
          isDropAtTheDoor: true,
          waveNumber: 1,
          remarkText: 'Drop at the door if not home',
          shipmentList: [
            {
              waybillNumber: 'HR304418872301',
              trackingNumber: '304418872301',
              deliveryCode: '9920',
              sender: 'Notino HR',
              marketPlace: 'Notino',
              packageType: 1,
              shipmentStatus: 0, // Created
              shipmentType: 0,
              recipientType: 1,
              customerTypeId: 1,
              isDocumentCollection: false,
              isRedirection: 0,
              shipmentItemCount: 1,
              activeShipmentItemCount: 1,
              deliveryRemark: null,
              consigneeGsm: '+385 95 111 2222',
              collections: [
                {
                  collectionAmount: 249.9,
                  collectionStatus: 0, // None
                  collectionType: 8, // OnInvoice
                  currency: 'EUR',
                  serviceType: 22, // Exwork
                  paymentTimeStamp: '',
                },
              ],
              shipmentItemList: [
                {
                  barcode: 'HR304418872301001',
                  legacySystemShortBarcode: '8872301001',
                  deci: 1.5,
                  weight: 0.5,
                  itemCurrentLocation: 1,
                  shipmentItemStatus: 4, // Loaded
                  deliveryFailureReason: 0,
                  isOverSize: false,
                  lastStatusUpdatedAt: '2026-07-15T06:40:00+02:00',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
