// Feature Detail data — extracted from mobile project source code analysis + issue reports + architecture analysis documents.
// Source: NesyMobile Android project (com.arasdigital.nesymobile.*)
// Source: PLAN5-Enterprise-Architecture-Decision.md (37 edge cases, 162 tickets)
// Source: nesy_mobile_issue_raporu.md, nesy_mobile_mimari_onceliklendirme.md

import type { FeatureDetail } from './nesy-types'

export const FEATURE_DETAILS: Record<string, FeatureDetail> = {
  /* ═══════════════════════════════════════════════════════
   * DELIVERY PROCESS MODULE
   * ═══════════════════════════════════════════════════════ */

  collect_cod: {
    whatIs:
      'Cash on Delivery (COD) collection. The courier collects payment from the receiver at the time of delivery via cash or credit card. The payment amount is determined from the COD field on the shipment. Cash collection is processed directly, while credit card collection is handled through different payment systems (RaiPay, SoftPos, WSPay) depending on the country.',
    howItWorks: [
      'Courier selects the shipment on the stop screen',
      'If the shipment has a COD amount, the collection screen opens',
      'Payment method is selected: Cash or Credit Card',
      'If cash is selected, the amount is entered and confirmed',
      'If credit card is selected, the relevant payment app (RaiPay/SoftPos) is triggered',
      'If payment succeeds, the shipment continues through the delivery flow',
      'If payment fails, the delivery can be marked as failed',
    ],
    screens: [
      'DeliveryFragment — Main delivery screen',
      'PaymentFragment — Payment method selection',
      'RaiPayActivity — RaiPay credit card integration (HR)',
      'SoftPosActivity — SoftPos credit card integration (SI, RS)',
    ],
    parameters: [
      { name: 'shipment.collectionAmount', desc: 'COD amount to be collected', type: 'decimal' },
      { name: 'shipment.collectionCurrency', desc: 'Currency (EUR, RSD, BAM)', type: 'string' },
      { name: 'shipment.paymentType', desc: 'Payment type (CASH, CC)', type: 'enum' },
      { name: 'country.paymentProvider', desc: 'Payment provider by country', type: 'enum' },
    ],
    diagram: [
      { type: 'node', label: 'Courier selects shipment', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Has COD?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Yes',
          steps: [
            { type: 'node', label: 'Collection screen opens', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Payment method?', variant: 'decision' },
            {
              type: 'branch',
              yes: {
                label: 'Cash',
                steps: [
                  { type: 'node', label: 'Amount is entered', variant: 'process' },
                ],
              },
              no: {
                label: 'Credit Card',
                steps: [
                  { type: 'node', label: 'Payment app opens', variant: 'external' },
                  { type: 'arrow' },
                  { type: 'node', label: 'Successful?', variant: 'decision' },
                  {
                    type: 'branch',
                    yes: {
                      label: 'Yes',
                      steps: [
                        { type: 'node', label: 'Continue', variant: 'process' },
                      ],
                    },
                    no: {
                      label: 'No',
                      steps: [
                        { type: 'node', label: 'Retry', variant: 'error' },
                      ],
                    },
                  },
                ],
              },
            },
            { type: 'arrow' },
            { type: 'node', label: 'Collection is confirmed', variant: 'process' },
          ],
        },
        no: {
          label: 'No',
          steps: [
            { type: 'node', label: 'Direct delivery', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Delivery continues', variant: 'end' },
    ],
    tips: [
      'In HR, credit card payments are processed through RaiPay — the RaiPay app must be installed and connected on the device',
      'SoftPos is used in SI and RS — integration in RS is not yet completed',
      'Only cash collection is supported in BA and ME; there is no credit card infrastructure',
      'Collection can be performed in offline mode but is validated after synchronization',
      'If COD amount is 0, the collection screen is skipped',
      'Multiple shipments in the same status can be collected in bulk',
    ],
    tickets: [
      { id: 'NESY-142', title: 'Amount mismatch after COD collection', status: 'open' },
      { id: 'NESY-87', title: 'RaiPay connection error fails on retry', status: 'closed' },
      { id: 'NESY-201', title: 'Race condition in offline COD collection', status: 'open' },
    ],
    experts: [
      { name: 'Finance Team', role: 'Payment Integrations' },
      { name: 'Mobile Developer', role: 'Android Payment Flow' },
    ],
    score: { bugProneness: 4, boilerplate: 3, complexity: 4, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/GetShipmentCollectionStatus', desc: 'Query shipment collection status' },
      { method: 'POST', endpoint: 'Shipment/GetPaymentId', desc: 'Generate payment ID' },
      { method: 'POST', endpoint: 'Shipment/RaipayBindMobilDeviceToPaymentTerminal', desc: 'Bind device to RaiPay terminal' },
      { method: 'POST', endpoint: 'Shipment/RaiPayAuthToken', desc: 'Obtain RaiPay authorization token' },
      { method: 'POST', endpoint: 'Shipment/GetRaiPayPaymentToken', desc: 'Obtain RaiPay payment token' },
      { method: 'POST', endpoint: 'Shipment/GetRaiPayPaymentStatus', desc: 'Query RaiPay payment status' },
      { method: 'POST', endpoint: 'Shipment/SaveCollectedShipmentListToCashDesk', desc: 'Save collections to cash desk' },
    ],
  },

  collect_exw: {
    whatIs:
      'Ex-works collection at the pickup point. The courier collects payment from the sender at the pickup location. For ExW (Ex Works) shipments, payment is made at the time of pickup, not at delivery.',
    howItWorks: [
      'Courier selects the pickup task',
      'If the shipment is ExW, the collection screen opens',
      'Payment method is selected (Cash / Credit Card)',
      'Collection is completed',
      'The shipment pickup process continues',
      'If a fiscal receipt is required, it is triggered automatically (RS)',
    ],
    screens: [
      'PickupFragment — Pickup screen',
      'PaymentFragment — Payment selection screen',
    ],
    parameters: [
      { name: 'shipment.exwAmount', desc: 'ExW collection amount', type: 'decimal' },
      { name: 'shipment.isExW', desc: 'Is the shipment ExW?', type: 'boolean' },
      { name: 'country.paymentProvider', desc: 'Payment provider', type: 'enum' },
    ],
    diagram: [
      { type: 'node', label: 'Pickup task is selected', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Is it an ExW shipment?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Yes',
          steps: [
            { type: 'node', label: 'Collection screen opens', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Payment method is selected', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Collection is saved', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Is fiscal receipt required?', variant: 'decision' },
            {
              type: 'branch',
              yes: {
                label: 'Yes',
                steps: [
                  { type: 'node', label: 'VPFR is triggered', variant: 'external' },
                ],
              },
              no: {
                label: 'No',
                steps: [
                  { type: 'node', label: 'Continue', variant: 'process' },
                ],
              },
            },
          ],
        },
        no: {
          label: 'No',
          steps: [
            { type: 'node', label: 'Normal pickup', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Continue', variant: 'end' },
    ],
    tips: [
      'ExW and COD collection use the same payment infrastructure but trigger different events',
      'ExW fiscalization is mandatory only in RS',
      'ExW collection can be skipped (see skip_exwork feature)',
    ],
    tickets: [
      { id: 'NESY-156', title: 'Fiscal receipt not generated after ExW collection', status: 'closed' },
    ],
    experts: [
      { name: 'Finance Team', role: 'Collection Flows' },
    ],
    score: { bugProneness: 3, boilerplate: 3, complexity: 3, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/GetShipmentCollectionStatus', desc: 'Query ExW collection status' },
      { method: 'POST', endpoint: 'Shipment/GetCollectionsFromShipment', desc: 'Shipment collection details' },
    ],
  },

  skip_exwork: {
    whatIs:
      'The courier can skip the expected ExW amount. In this case, the shipment is updated and invoiced to the customer. This feature is active only in RS; ExW cannot be skipped in other countries.',
    howItWorks: [
      'Courier presses the "Skip" button on the ExW collection screen',
      'System shows a confirmation dialog',
      'After confirmation, the shipment ExW amount is reset to zero',
      'The shipment is updated and customer invoicing is handled on the backend',
      'The pickup flow continues',
    ],
    screens: [
      'PickupFragment — ExW skip button',
    ],
    parameters: [
      { name: 'country.canSkipExW', desc: 'Whether ExW skip permission exists', type: 'boolean' },
      { name: 'shipment.exwAmount', desc: 'Skipped ExW amount', type: 'decimal' },
    ],
    diagram: [
      { type: 'node', label: 'ExW collection screen', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Skip button is pressed', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Confirmed?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Yes',
          steps: [
            { type: 'node', label: 'Amount is reset to zero', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Shipment is updated', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Continue', variant: 'process' },
          ],
        },
        no: {
          label: 'No',
          steps: [
            { type: 'node', label: 'Go back', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Flow is completed', variant: 'end' },
    ],
    tips: [
      'Active only in RS — this button is not visible in other countries',
      'Shipment status changes after skip, cannot be undone',
      'Tracked separately as "skipped ExW" in financial reporting',
    ],
    tickets: [],
    experts: [
      { name: 'RS Operations Team', role: 'Serbia-Specific Rules' },
    ],
    score: { bugProneness: 2, boilerplate: 1, complexity: 2, testCoverage: 1 },
  },

  fiscalization_dp: {
    whatIs:
      'VPFR (Virtual Fiscal Printer) is triggered during delivery and a fiscal receipt is printed. Fiscalization is a state-mandated financial document issuance process. A fiscal receipt must be generated for every COD/ExW payment. Mandatory in RS; not yet active in other countries.',
    howItWorks: [
      'Payment is received during delivery or pickup',
      'After successful payment, VPFR is triggered',
      'Receipt data is sent to the backend (CreateFiscalInvoice)',
      'Backend receives the response from VPFR and returns the receipt number',
      'Receipt is printed (Bluetooth printer or digital)',
      'In case of fiscal cancellation, an SSC (Status Change) event is triggered',
    ],
    screens: [
      'FiscalPrintFragment — Receipt printing screen',
      'PrinterSettingsFragment — Printer settings',
      'DeliveryFragment — Main delivery screen (fiscal trigger)',
    ],
    parameters: [
      { name: 'country.fiscalizationEnabled', desc: 'Is fiscalization active?', type: 'boolean' },
      { name: 'printer.bluetoothAddress', desc: 'Bluetooth printer MAC address', type: 'string' },
      { name: 'fiscal.vpfrUrl', desc: 'VPFR endpoint URL', type: 'string' },
    ],
    diagram: [
      { type: 'node', label: 'Payment is completed', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Fiscal required?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Yes',
          steps: [
            { type: 'node', label: 'CreateFiscalInvoice API', variant: 'external' },
            { type: 'arrow' },
            { type: 'node', label: 'Successful?', variant: 'decision' },
            {
              type: 'branch',
              yes: {
                label: 'Yes',
                steps: [
                  { type: 'node', label: 'Receipt is printed', variant: 'process' },
                ],
              },
              no: {
                label: 'No',
                steps: [
                  { type: 'node', label: 'Retry', variant: 'error' },
                ],
              },
            },
          ],
        },
        no: {
          label: 'No',
          steps: [
            { type: 'node', label: 'Continue', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Flow is completed', variant: 'end' },
    ],
    tips: [
      'VPFR connection may timeout — retry mechanism exists (RetryFiscalInvoice)',
      'If a fiscal receipt is cancelled after creation, RefundFiscalInvoice is called and an SSC event is triggered',
      'Fiscalization is currently mandatory only in RS, planned for BA (with Bulgaria expansion)',
      'Bluetooth printer connection frequently drops — device pairing check is important',
      'Fiscal receipts cannot be created in offline mode; they wait in queue',
    ],
    tickets: [
      { id: 'NESY-103', title: 'Infinite loop during fiscal receipt retry', status: 'open' },
      { id: 'NESY-178', title: 'Receipt number lost after VPFR timeout', status: 'open' },
      { id: 'NESY-45', title: 'Crash on Bluetooth printer connection loss', status: 'closed' },
    ],
    experts: [
      { name: 'Finance Team', role: 'Fiscal Integration' },
      { name: 'RS Operations', role: 'VPFR Processes' },
    ],
    score: { bugProneness: 5, boilerplate: 4, complexity: 5, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/CreateFiscalInvoice', desc: 'Create fiscal receipt' },
      { method: 'POST', endpoint: 'Shipment/RetryFiscalInvoice', desc: 'Retry failed fiscal receipt' },
      { method: 'POST', endpoint: 'Shipment/RefundFiscalInvoice', desc: 'Cancel fiscal receipt' },
      { method: 'POST', endpoint: 'Shipment/UpdateFiscalInvoice', desc: 'Update fiscal receipt' },
      { method: 'POST', endpoint: 'Shipment/GetFiscalInvoiceDetail', desc: 'Query fiscal receipt details' },
    ],
  },

  failed_reasons: {
    whatIs:
      'When a delivery fails, the courier selects a reason and in some cases takes photo evidence. Failed delivery reasons are customized by country. Photo requirement also depends on the reason code and country.',
    howItWorks: [
      'Courier presses the "Delivery Failed" button',
      'Reason list opens (filtered by country)',
      'Courier selects a reason',
      'Depending on the selected reason, a photo may be required',
      'If a photo is taken, CameraFragment opens',
      'Photo is uploaded to the server (SaveImageFile)',
      'DeliveryFailed API is called and the shipment status is updated',
    ],
    screens: [
      'DeliveryFailedFragment — Failed reason selection screen',
      'CameraFragment — Photo capture screen',
    ],
    parameters: [
      { name: 'country.failedReasons', desc: 'Country-specific failed reason codes list', type: 'string[]' },
      { name: 'failedReason.requiresPhoto', desc: 'Does this reason require a photo?', type: 'boolean' },
      { name: 'country.photoMandatory', desc: 'Is photo mandatory?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Delivery failed', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Reason list opens', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Reason is selected', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Photo required?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Yes',
          steps: [
            { type: 'node', label: 'Camera opens', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Photo is uploaded', variant: 'process' },
          ],
        },
        no: {
          label: 'No',
          steps: [
            { type: 'node', label: 'Continue directly', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'DeliveryFailed API', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Shipment status is updated', variant: 'end' },
    ],
    tips: [
      'A limited reason list is used in SI — fewer options compared to CORE',
      'In BA, photos cannot be taken — photo step is skipped despite camera permission',
      'In RS and ME, photos are optional — couriers can skip if they choose',
      'CameraFragment ~35K lines — largest fragment, high refactoring need',
      'Photo upload stays in queue in offline mode',
    ],
    tickets: [
      { id: 'NESY-89', title: 'Out of memory during photo upload', status: 'open' },
      { id: 'NESY-134', title: 'Failed reason list filtering by country not working', status: 'closed' },
    ],
    experts: [
      { name: 'Mobile Developer', role: 'Camera & Photo Flow' },
    ],
    score: { bugProneness: 4, boilerplate: 3, complexity: 3, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/DeliveryFailed', desc: 'Failed delivery notification' },
      { method: 'POST', endpoint: 'Task/f/SaveImageFile', desc: 'Photo upload (multipart)' },
    ],
  },

  consignee_info: {
    whatIs:
      'Displaying and editability of the consignee name at the time of delivery. In CORE behavior, the consignee name comes pre-filled from shipment data and is editable. In HR, the name is not pre-filled; it is communicated externally (via SMS/phone).',
    howItWorks: [
      'Courier navigates to the delivery screen',
      'Consignee name field comes filled or empty from shipment data (by country)',
      'Courier can edit the name if needed',
      'Consignee name is saved when the delivery is completed',
    ],
    screens: [
      'DeliveryFragment — Consignee info field',
    ],
    parameters: [
      { name: 'country.consigneePreFilled', desc: 'Is consignee name pre-filled?', type: 'boolean' },
      { name: 'country.consigneeEditable', desc: 'Is consignee name editable?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Delivery screen opens', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Pre-filled?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Yes',
          steps: [
            { type: 'node', label: 'Displayed as filled', variant: 'process' },
          ],
        },
        no: {
          label: 'No',
          steps: [
            { type: 'node', label: 'Courier enters it', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Edited', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Saved', variant: 'end' },
    ],
    tips: [
      'In HR, consignee name is not pre-filled — courier asks and enters it at the time of delivery',
      'This behavior is specific to HR; all other countries follow CORE behavior',
    ],
    tickets: [],
    experts: [
      { name: 'HR Operations', role: 'Croatia-Specific Rules' },
    ],
    score: { bugProneness: 1, boilerplate: 1, complexity: 1, testCoverage: 1 },
  },

  signature_dp: {
    whatIs:
      'Digital (on-screen) and physical (printed document) signature collection at the time of delivery. Digital signature is captured on the courier device screen. For physical signature, the delivery list (dely list) is downloaded, printed, and signed by the customer.',
    howItWorks: [
      'Signature screen opens at the delivery confirmation step',
      'Receiver signs digitally using their finger',
      'Signature image is saved as base64 (SaveSignature API)',
      'Delivery list (dely list) can be downloaded and physically signed',
      'Signature requirement varies by country',
    ],
    screens: [
      'SignaturePadFragment — Digital signature screen',
      'DeliveryFragment — Signature trigger',
    ],
    parameters: [
      { name: 'country.signatureMandatory', desc: 'Is digital signature mandatory?', type: 'boolean' },
      { name: 'country.delyListEnabled', desc: 'Is dely list download active?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Delivery confirmation', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Mandatory?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Yes',
          steps: [
            { type: 'node', label: 'Signature screen opens', variant: 'process' },
          ],
        },
        no: {
          label: 'Optional',
          steps: [
            { type: 'node', label: 'Does courier want to?', variant: 'decision' },
            {
              type: 'branch',
              yes: {
                label: 'Yes',
                steps: [
                  { type: 'node', label: 'Signature screen opens', variant: 'process' },
                ],
              },
              no: {
                label: 'No',
                steps: [
                  { type: 'node', label: 'Continue', variant: 'process' },
                ],
              },
            },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Receiver signs', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'SaveSignature API', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Continue', variant: 'end' },
    ],
    tips: [
      'In RS, BA, and ME, digital signature is optional — courier can skip',
      'Dely list became active in HR after code merge',
      'Signature pad touch sensitivity varies by device — issues may occur on some Zebra devices',
    ],
    tickets: [
      { id: 'NESY-67', title: 'Very thin line issue on signature pad', status: 'closed' },
    ],
    experts: [
      { name: 'Mobile Developer', role: 'UI Components' },
    ],
    score: { bugProneness: 2, boilerplate: 2, complexity: 2, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/SaveSignature', desc: 'Save signature' },
    ],
  },

  delivery_parcelshop: {
    whatIs:
      'Delivery of shipments to a parcel shop (pick-up point) or branch. The courier delivers to a parcel shop location instead of the receiver. RDOC and OVSZ (oversized) shipments cannot be delivered to parcel shops.',
    howItWorks: [
      'Delivery task is assigned to a parcel shop address',
      'Courier arrives at the parcel shop',
      'Shipments are delivered (ReleaseParcel API)',
      'RDOC and OVSZ check is performed — these types are blocked',
      'DEPT event is created for delivered shipments',
    ],
    screens: [
      'ParcelReleaseFragment — Parcel release screen',
      'StopListFragment — Stop list (with parcel shop stops)',
    ],
    parameters: [
      { name: 'shipment.isRDOC', desc: 'Is the shipment RDOC type?', type: 'boolean' },
      { name: 'shipment.isOVSZ', desc: 'Is the shipment oversized?', type: 'boolean' },
      { name: 'counterLocation.type', desc: 'Delivery point type (parcelshop/locker)', type: 'enum' },
    ],
    diagram: [
      { type: 'node', label: 'Task is assigned', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Arrives at PS', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'RDOC/OVSZ?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Blocked',
          steps: [
            { type: 'node', label: 'Cannot be delivered', variant: 'error' },
          ],
        },
        no: {
          label: 'Normal',
          steps: [
            { type: 'node', label: 'ReleaseParcel API', variant: 'external' },
            { type: 'arrow' },
            { type: 'node', label: 'DEPT event is created', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Completed', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Flow ends', variant: 'end' },
    ],
    tips: [
      'RDOC shipments cannot be delivered to parcel shops in any country',
      'OVSZ shipments are also blocked — size check is performed on the frontend',
      'Parcel shop infrastructure does not exist in BA and ME (N/A)',
    ],
    tickets: [],
    experts: [
      { name: 'Operations Team', role: 'Parcel Shop Processes' },
    ],
    score: { bugProneness: 2, boilerplate: 2, complexity: 2, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/ReleaseParcel', desc: 'Parcel release operation' },
      { method: 'POST', endpoint: 'Integration/ProcessHandOverParcelsToCounterLocation', desc: 'Hand over parcels to counter location' },
    ],
  },

  delivery_locker: {
    whatIs:
      'Locker delivery via D4ME (Direct4Me) smart locker integration. The courier places the shipment in a smart locker and the receiver picks it up. Integrates with the D4ME application.',
    howItWorks: [
      'Courier arrives at locker location',
      'D4ME application opens (via intent)',
      'Locker reservation is checked or created',
      'Courier places parcel in the locker',
      'DEPT event is sent via D4MeCallback',
      'If receiver picks up → DELY; otherwise Locker Pickup task is created',
    ],
    screens: [
      'LeanLockerFragment — Locker interaction screen',
      'D4ME External App — External D4ME application',
    ],
    parameters: [
      { name: 'd4me.packageName', desc: 'D4ME app package name', type: 'string' },
      { name: 'shipment.lockerReservationId', desc: 'Locker reservation ID', type: 'string' },
      { name: 'shipment.isRDOC', desc: 'RDOC shipments cannot be placed in lockers', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Arrives at locker location', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'D4ME opens', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Reservation exists?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Yes',
          steps: [
            { type: 'node', label: 'Door opens', variant: 'process' },
          ],
        },
        no: {
          label: 'No',
          steps: [
            { type: 'node', label: 'CreateD4MReservation', variant: 'external' },
            { type: 'arrow' },
            { type: 'node', label: 'Door opens', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Parcel is placed', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'DEPT callback is sent', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Receiver picked up?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Yes',
          steps: [
            { type: 'node', label: 'DELY callback', variant: 'process' },
          ],
        },
        no: {
          label: 'No',
          steps: [
            { type: 'node', label: 'Locker Pickup task is created', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Flow is completed', variant: 'end' },
    ],
    tips: [
      'D4ME application must be installed on the device — otherwise redirected to Google Play',
      'RDOC and OVSZ shipments cannot be placed in lockers',
      'In RS, matching is done with the first 14 digits of the Legacy ID — a truncated ID is sent instead of the full ID',
      'D4ME callbacks arrive asynchronously — may take multiple days',
      'Locker may be full — capacity check is performed on the D4ME side',
    ],
    tickets: [
      { id: 'NESY-112', title: 'Shipment status not updated after D4ME callback', status: 'open' },
      { id: 'NESY-198', title: '14-digit ID matching error in RS', status: 'open' },
      { id: 'NESY-76', title: 'D4ME app version incompatibility', status: 'closed' },
    ],
    experts: [
      { name: 'D4ME Integration Team', role: 'Locker Integration' },
    ],
    score: { bugProneness: 5, boilerplate: 4, complexity: 5, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/CreateD4MReservation', desc: 'Create D4ME locker reservation' },
      { method: 'POST', endpoint: 'Task/DeleteD4MReservation', desc: 'Cancel D4ME reservation' },
      { method: 'POST', endpoint: 'Task/CompleteD4MShipments', desc: 'Complete D4ME delivery' },
      { method: 'POST', endpoint: 'Shipment/ActiveD4MCounterLocations', desc: 'Active D4ME locker locations' },
      { method: 'POST', endpoint: 'Shipment/ActiveLockerCounterLocations', desc: 'Active locker locations list' },
    ],
  },

  /* ═══════════════════════════════════════════════════════
   * PICKUP PROCESS MODULE
   * ═══════════════════════════════════════════════════════ */

  pickup_assignment: {
    whatIs:
      'Mechanism for assigning pickup tasks to couriers. In CORE behavior, pickup tasks are automatically assigned by a job that runs every 3 minutes. In some countries, assignments are made manually by the dispatcher.',
    howItWorks: [
      'GeneratePickupTaskJob runs every 3 minutes on the backend (CORE)',
      'Or the dispatcher manually assigns by selecting a courier from the backoffice',
      'The assigned task is added to the courier\'s schedule',
      'Courier sees the new task in their task list',
      'Courier is notified via push notification',
    ],
    screens: [
      'TaskListFragment — Task list',
      'StopListFragment — Stop list (pickup stops)',
    ],
    parameters: [
      { name: 'country.pickupAutoAssign', desc: 'Is auto-assignment active?', type: 'boolean' },
      { name: 'job.interval', desc: 'Auto-assignment job run interval (min)', type: 'number' },
    ],
    diagram: [
      { type: 'node', label: 'Assignment type is determined', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Assignment type?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Automatic',
          steps: [
            { type: 'node', label: 'Job runs', variant: 'process', desc: 'GeneratePickupTaskJob' },
          ],
        },
        no: {
          label: 'Manuel',
          steps: [
            { type: 'node', label: 'Dispatcher selects', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Added to schedule', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Notification is sent', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Appears in list', variant: 'end' },
    ],
    tips: [
      'In HR, RS, and BA, the dispatcher assigns manually — auto-assignment is disabled',
      'In SI and ME, same as CORE — auto-assignment is active',
      'In manual assignment, the dispatcher can view the courier\'s current workload',
    ],
    tickets: [],
    experts: [
      { name: 'Backend Team', role: 'Task Assignment Engine' },
    ],
    score: { bugProneness: 2, boilerplate: 1, complexity: 2, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/GeneratePickupTaskJobNew', desc: 'Trigger pickup task job' },
    ],
  },

  collect_cpp: {
    whatIs:
      'Collection for CPP (Cash Pre-Paid) shipments at the pickup point. Payment is collected from the sender at the time of pickup via cash or credit card. Unlike COD, payment occurs during pickup, not delivery.',
    howItWorks: [
      'Courier selects the pickup task',
      'If the shipment is CPP, the collection screen opens',
      'Payment method is selected',
      'Collection is completed',
      'If a fiscal receipt is required, it is triggered (RS)',
      'Pickup process continues',
    ],
    screens: [
      'PickupFragment — Pickup screen',
      'PaymentFragment — Payment selection screen',
    ],
    parameters: [
      { name: 'shipment.isCPP', desc: 'Is the shipment CPP type?', type: 'boolean' },
      { name: 'shipment.cppAmount', desc: 'CPP collection amount', type: 'decimal' },
    ],
    diagram: [
      { type: 'node', label: 'Pickup task is selected', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'CPP shipment?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Yes',
          steps: [
            { type: 'node', label: 'Collection screen opens', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Payment method is selected', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Collection is completed', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Fiscal receipt required?', variant: 'decision' },
            {
              type: 'branch',
              yes: {
                label: 'Yes',
                steps: [
                  { type: 'node', label: 'VPFR is triggered', variant: 'external' },
                ],
              },
              no: {
                label: 'No',
                steps: [
                  { type: 'node', label: 'Continue', variant: 'process' },
                ],
              },
            },
          ],
        },
        no: {
          label: 'No',
          steps: [
            { type: 'node', label: 'Normal pickup', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Continue', variant: 'end' },
    ],
    tips: [
      'CPP collection is not supported in SI, BA, and ME (N/A)',
      'In HR, credit card collection is processed through RaiPay',
      'In RS, SoftPos integration is planned but not yet integrated',
    ],
    tickets: [
      { id: 'NESY-167', title: 'Incorrect amount on fiscal receipt after CPP pickup', status: 'open' },
    ],
    experts: [
      { name: 'Finance Team', role: 'Collection Flows' },
    ],
    score: { bugProneness: 3, boilerplate: 3, complexity: 3, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/GetShipmentCollectionStatus', desc: 'CPP collection status' },
      { method: 'POST', endpoint: 'Shipment/GetCollectionsFromShipment', desc: 'Shipment collection details' },
    ],
  },

  pickup_fiscalization: {
    whatIs:
      'Fiscal receipt generation during pickup for CPP shipments. Uses the same VPFR infrastructure as delivery fiscalization but is triggered only for CPP shipments. Currently active only in RS.',
    howItWorks: [
      'CPP pickup is completed',
      'If payment is successful, VPFR is triggered',
      'CreateFiscalInvoice API is called',
      'Receipt number is obtained and printed',
    ],
    screens: [
      'FiscalPrintFragment — Receipt printing',
      'PickupFragment — Pickup screen (trigger)',
    ],
    parameters: [
      { name: 'country.pickupFiscalEnabled', desc: 'Is pickup fiscalization active?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'CPP pickup is completed', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Payment successful', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'VPFR is triggered', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'CreateFiscalInvoice API', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Successful?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Yes',
          steps: [
            { type: 'node', label: 'Receipt is printed', variant: 'process' },
          ],
        },
        no: {
          label: 'No',
          steps: [
            { type: 'node', label: 'Retry', variant: 'error' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Continue', variant: 'end' },
    ],
    tips: [
      'Active only in RS — N/A in all other countries',
      'Uses the same APIs as delivery fiscalization',
      'Not triggered for non-CPP shipments',
    ],
    tickets: [],
    experts: [
      { name: 'RS Operations', role: 'VPFR Processes' },
    ],
    score: { bugProneness: 3, boilerplate: 4, complexity: 4, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/CreateFiscalInvoice', desc: 'Create fiscal receipt' },
      { method: 'POST', endpoint: 'Shipment/RetryFiscalInvoice', desc: 'Fiscal retry' },
    ],
  },

  pickup_at_customer: {
    whatIs:
      'PAC (Pickup at Customer) task behavior. Parcel pickup task from customer location. An unactioned PAC task blocks end of day (CORE) or does not block it (SI). This rule directly affects the End of Day flow.',
    howItWorks: [
      'PAC task is assigned to the courier\'s schedule',
      'Courier goes to the customer location',
      'Collects parcels and confirms them by scanning in the vehicle',
      'If the PAC task is left unactioned:',
      '  - CORE/HR/RS/BA/ME: Blocks end of day',
      '  - SI: Does NOT block end of day',
    ],
    screens: [
      'PickupFragment — Pickup screen',
      'TaskListFragment — Task list',
    ],
    parameters: [
      { name: 'country.pacBlocksEod', desc: 'Does PAC task block end of day?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'PAC task is assigned', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Goes to location', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Parcels are collected', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Scanning is performed', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Unactioned?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Yes',
          steps: [
            { type: 'node', label: 'Does it block EOD?', variant: 'decision' },
            {
              type: 'branch',
              yes: {
                label: 'CORE',
                steps: [
                  { type: 'node', label: 'Blocks', variant: 'error' },
                ],
              },
              no: {
                label: 'SI',
                steps: [
                  { type: 'node', label: 'Does not block', variant: 'process' },
                ],
              },
            },
          ],
        },
        no: {
          label: 'No',
          steps: [
            { type: 'node', label: 'Completed', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Flow ends', variant: 'end' },
    ],
    tips: [
      'In SI, an unactioned PAC task does not block end of day — courier can leave it for the next day',
      'In all other countries, end of day cannot proceed until PAC is completed',
      'Difference between PAC and PickupAtCustomer: PAC depends on customer request, Pickup depends on schedule',
    ],
    tickets: [],
    experts: [
      { name: 'Operations Team', role: 'Task Management' },
    ],
    score: { bugProneness: 2, boilerplate: 1, complexity: 2, testCoverage: 1 },
  },

  remote_pickup: {
    whatIs:
      'Display of sender and receiver information in the mobile app. In the remote pickup scenario, sender information is displayed in the courier app. In BA, receiver information is also displayed.',
    howItWorks: [
      'Pickup task is assigned',
      'Courier opens the task details',
      'Sender information (name, address, phone) is displayed',
      'In BA, receiver information is also visible',
    ],
    screens: [
      'PickupFragment — Pickup detail screen',
      'TaskListFragment — Task list',
    ],
    parameters: [
      { name: 'country.showReceiverInPickup', desc: 'Show receiver info in pickup?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Task is assigned', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Details are opened', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Sender information is displayed', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Is it BA?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Yes',
          steps: [
            { type: 'node', label: 'Receiver info is also displayed', variant: 'process' },
          ],
        },
        no: {
          label: 'No',
          steps: [
            { type: 'node', label: 'Only sender is displayed', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Pickup begins', variant: 'end' },
    ],
    tips: [
      'In BA, receiver information is also displayed — courier can route the parcel to the correct address',
      'In other countries, only sender information is visible',
    ],
    tickets: [],
    experts: [
      { name: 'BA Operations', role: 'Bosnia-Specific Rules' },
    ],
    score: { bugProneness: 1, boilerplate: 1, complexity: 1, testCoverage: 1 },
  },

  red_label: {
    whatIs:
      'Pickup of red label (red-tagged) shipments via the mobile app. Red label is used for shipments with missing label information. The courier collects the parcel, drops it off at the Npoint, the shipment is created, and the backoffice completes the missing data.',
    howItWorks: [
      'Pickup at customer task is created (red label)',
      'Courier goes to the customer and collects the parcel',
      'Parcel is dropped off at the Npoint (hub)',
      'CreateRedGreyLabelShipmentWithoutDetails API is called',
      'Shipment is created in the system (with missing details)',
      'Backoffice operator completes the missing information',
    ],
    screens: [
      'GrayLabelFragment — Red/gray label pickup screen',
      'PickupFragment — Pickup flow',
    ],
    parameters: [
      { name: 'shipment.isRedLabel', desc: 'Is the shipment red label?', type: 'boolean' },
      { name: 'country.redLabelEnabled', desc: 'Is red label pickup active?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'PAC task is created', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Goes to customer', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Parcel is collected', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Dropped off at Npoint', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'CreateRedGreyLabel API', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Shipment is created', variant: 'process', desc: 'With missing details' },
      { type: 'arrow' },
      { type: 'node', label: 'Backoffice completes', variant: 'end' },
    ],
    tips: [
      'Red label pickup is not supported in SI and ME (N/A)',
      'Red label and gray label use the same fragment (GrayLabelFragment)',
      'Delivery cannot be made until the shipment is completed in the backoffice',
    ],
    tickets: [
      { id: 'NESY-155', title: 'Timeout during red label shipment creation', status: 'open' },
    ],
    experts: [
      { name: 'Operations Team', role: 'Red Label Processes' },
    ],
    score: { bugProneness: 3, boilerplate: 2, complexity: 3, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/CreateRedGreyLabelShipmentWithoutDetails', desc: 'Create red/gray label shipment' },
    ],
  },

  pickup_failed_non_rdoc: {
    whatIs:
      'Failed reason codes for non-RDOC pickup tasks. When a courier cannot complete a pickup, they select an appropriate reason code. Reason codes: NOPC, NPNP, NRDY, NSYS, PABS, PADU, PTIM.',
    howItWorks: [
      'Courier selects "Pickup Failed"',
      'Reason code list opens',
      'Appropriate code is selected',
      'PickupFailed API is called',
      'Depending on the selected code, automatic reassignment may be triggered',
    ],
    screens: [
      'PickupFailedFragment — Failed pickup reason screen',
    ],
    parameters: [
      { name: 'failedReason.code', desc: 'Failed reason code (NOPC/NPNP/NRDY/NSYS/PABS/PADU/PTIM)', type: 'enum' },
    ],
    diagram: [
      { type: 'node', label: 'Failed is selected', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Reason list opens', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Code is selected', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'PickupFailed API', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Automatic reassignment?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Yes',
          steps: [
            { type: 'node', label: 'Assigned for next day', variant: 'process' },
          ],
        },
        no: {
          label: 'No',
          steps: [
            { type: 'node', label: 'Closed', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Flow is completed', variant: 'end' },
    ],
    tips: [
      'All countries use the same reason codes as CORE',
      'Some reason codes trigger automatic reassignment (see auto_reassignment)',
      'NOPC: No Parcel / NPNP: Not at Pickup Point / NRDY: Not Ready / NSYS: System / PABS: Absent / PADU: Address Unknown / PTIM: Past Time',
    ],
    tickets: [],
    experts: [
      { name: 'Operations Team', role: 'Pickup Processes' },
    ],
    score: { bugProneness: 1, boilerplate: 1, complexity: 1, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/PickupFailed', desc: 'Pickup failed notification' },
    ],
  },

  rdoc_failed_reasons: {
    whatIs:
      'Failed reason codes for RDOC (Return Document) pickup tasks. RDOC tasks can only be failed with the NOPC reason code — other codes cannot be used.',
    howItWorks: [
      'Courier marks the RDOC pickup task as failed',
      'Only NOPC is shown as an option',
      'PickupFailed API is called',
    ],
    screens: [
      'PickupFailedFragment — Failed RDOC screen',
    ],
    parameters: [
      { name: 'task.isRDOC', desc: 'Is the task RDOC type?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'RDOC failed', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Single option: NOPC', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'NOPC is selected', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'PickupFailed API', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Closed', variant: 'end' },
    ],
    tips: [
      'Only NOPC can be used for RDOC tasks — UI shows a single option',
      'Same behavior in all countries',
    ],
    tickets: [],
    experts: [
      { name: 'Operations Team', role: 'RDOC Processes' },
    ],
    score: { bugProneness: 1, boilerplate: 1, complexity: 1, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/PickupFailed', desc: 'RDOC failed notification' },
    ],
  },

  auto_reassignment: {
    whatIs:
      'Automatic reassignment after a failed pickup. Certain failed reason codes trigger automatic reassignment to the next business day. Triggering codes vary by country.',
    howItWorks: [
      'Pickup fails',
      'Selected reason code is checked',
      'If the code is in the triggering list, automatic reassignment is scheduled',
      'The task is reassigned to the courier on the next business day',
    ],
    screens: [
      'Background Service — Automatic reassignment (backend side)',
    ],
    parameters: [
      { name: 'country.autoReassignCodes', desc: 'Codes that trigger automatic reassignment', type: 'string[]' },
    ],
    diagram: [
      { type: 'node', label: 'Pickup fails', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Code is checked', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Is it a trigger?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Yes',
          steps: [
            { type: 'node', label: 'Reassignment is scheduled', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Assigned for next day', variant: 'process' },
          ],
        },
        no: {
          label: 'No',
          steps: [
            { type: 'node', label: 'Closed', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Flow is completed', variant: 'end' },
    ],
    tips: [
      'CORE: NPNP, NRDY, PABS, PTIM',
      'SI: NPNP, NRDY, PABS, PADU, PTIM (+PADU)',
      'RS: NPNP, NRDY, NSYS, PABS, PADU, PTIM (+NSYS, +PADU)',
      'BA and ME do not have automatic reassignment',
    ],
    tickets: [],
    experts: [
      { name: 'Backend Team', role: 'Task Management' },
    ],
    score: { bugProneness: 2, boilerplate: 1, complexity: 2, testCoverage: 1 },
  },

  /* ═══════════════════════════════════════════════════════
   * TOUR & STOP MANAGEMENT MODULE
   * ═══════════════════════════════════════════════════════ */

  creation_of_stops: {
    whatIs:
      'Otomatik ve manuel durak oluşturma ile gönderi birleştirme kuralları. Aynı alıcı adı ve adresine sahip gönderiler otomatik olarak aynı durakta birleşir. Tur başlamadan önce kurye durakları manuel birleştirebilir.',
    howItWorks: [
      'Schedule yüklendiğinde gönderiler adreslere göre gruplandırılır',
      'Aynı alıcı + adres → aynı durakta birleşir (delivery)',
      'Aynı gönderici + adres → aynı durakta birleşir (pickup)',
      'Tur onayından sonra yeni gelen gönderiler, eşleşen durak yoksa yeni durak oluşturur',
      'Tur başlangıcından önce kurye durakları manuel birleştirebilir',
    ],
    screens: [
      'StopListFragment — Durak listesi ve yönetimi',
    ],
    parameters: [
      { name: 'stop.mergeKey', desc: 'Birleştirme anahtarı (ad+adres hash)', type: 'string' },
      { name: 'schedule.isApproved', desc: 'Tur onaylandı mı?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Schedule yüklenir', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Adrese göre gruplama yapılır', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Aynı alıcı+adres mi?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Birleşir', variant: 'process' },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Yeni durak oluşur', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Sonradan gelen gönderi?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Eşleşen var',
          steps: [
            { type: 'node', label: 'Mevcut durağa eklenir', variant: 'process' },
          ],
        },
        no: {
          label: 'Eşleşen yok',
          steps: [
            { type: 'node', label: 'Yeni durak oluşur', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Duraklar hazır', variant: 'end' },
    ],
    tips: [
      'Tüm ülkelerde CORE ile aynı davranış',
      'Adres eşleşmesi case-insensitive yapılır',
      'Tur onayından sonra otomatik birleştirme devam eder ama manuel birleştirme yapılamaz',
    ],
    tickets: [
      { id: 'NESY-91', title: 'Farklı adreslerin yanlışlıkla birleşmesi', status: 'closed' },
    ],
    experts: [
      { name: 'Backend Ekibi', role: 'Durak Yönetimi' },
    ],
    score: { bugProneness: 3, boilerplate: 2, complexity: 3, testCoverage: 1 },
  },

  merge_stops_manual: {
    whatIs:
      'Kurye\'nin durakları manuel olarak birleştirmesi. Bir ana durak seçilir ve diğer duraklar onun altına alınır. Bu işlem yalnızca tur başlamadan önce yapılabilir.',
    howItWorks: [
      'Kurye durak listesinde "Birleştir" modunu açar',
      'Ana durak seçilir',
      'Birleştirilecek alt duraklar seçilir',
      'ManuelMergeStopsInSchedule API çağrılır',
      'Duraklar tek durak altında birleşir',
    ],
    screens: [
      'MergeStopsFragment — Durak birleştirme ekranı',
      'StopListFragment — Durak listesi',
    ],
    parameters: [
      { name: 'mainStop.id', desc: 'Ana durak ID\'si', type: 'string' },
      { name: 'subStops', desc: 'Birleştirilecek alt durak ID listesi', type: 'string[]' },
    ],
    diagram: [
      { type: 'node', label: 'Birleştir modu açılır', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Ana durak seçilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Alt duraklar seçilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'ManuelMergeStopsInSchedule API', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Duraklar birleşir', variant: 'end' },
    ],
    tips: [
      'Tur başladıktan sonra birleştirme yapılamaz',
      'Split (ayırma) da aynı ekrandan yapılabilir (ManuelSplitStopsInSchedule)',
      'Tüm ülkelerde aynı davranış',
    ],
    tickets: [],
    experts: [
      { name: 'Mobile Geliştirici', role: 'Durak Yönetimi UI' },
    ],
    score: { bugProneness: 2, boilerplate: 2, complexity: 2, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/ManuelMergeStopsInSchedule', desc: 'Manuel durak birleştirme' },
      { method: 'POST', endpoint: 'Task/ManuelSplitStopsInSchedule', desc: 'Manuel durak ayırma' },
    ],
  },

  tour_start_approval: {
    whatIs:
      'Gün başında koli okutma ve tur başlangıç onay akışı. Kurye rota seçer, kolileri barkod okutarak araçta onaylar ve tur başlangıcı için onay talebi gönderir. HR ve SI\'da ilk tur onayından sonra ek okutulan koliler otomatik onaylanır.',
    howItWorks: [
      'Kurye schedule\'den rota seçer',
      'Kolileri barkod okutarak yükler (LoadParcelToCourierVehicle)',
      'Tur onay talebi gönderir',
      'Dispatcher onaylar (veya CORE\'da otomatik onay)',
      'Tur başlar ve kurye durak listesine yönlendirilir',
    ],
    screens: [
      'ScanFragment — Barkod okutma ekranı',
      'ScheduleFragment — Rota seçim ekranı',
      'StopListFragment — Tur başladıktan sonra durak listesi',
    ],
    parameters: [
      { name: 'schedule.routeCode', desc: 'Seçilen rota kodu', type: 'string' },
      { name: 'country.autoApproveAfterFirst', desc: 'İlk onay sonrası otomatik mı?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Rota seçilir', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Koli okutma', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'LoadParcelToCourierVehicle API', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Tur onay talebi gönderilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Onay türü?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Manuel',
          steps: [
            { type: 'node', label: 'Dispatcher onaylar', variant: 'process' },
          ],
        },
        no: {
          label: 'Otomatik',
          steps: [
            { type: 'node', label: 'Auto onay', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Tur başlar', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Durak listesi gösterilir', variant: 'end' },
    ],
    tips: [
      'HR ve SI\'da ilk tur onayından sonra ek gelen koliler otomatik onaylanır — ikinci onay gerekmez',
      'CORE, RS, BA, ME\'de her tur başlangıcı onay gerektirir',
      'Barkod okutma Zebra DataWedge, Honeywell ve kamera (MLKit) ile desteklenir',
      'Scan fragment barkod routing mantığı oldukça karmaşık — farklı barkod formatları farklı akışlar tetikler',
    ],
    tickets: [
      { id: 'NESY-203', title: 'Tur onayı bekleme sırasında schedule kaybolması', status: 'open' },
      { id: 'NESY-58', title: 'Barkod okutma sırasında çift okutma sorunu', status: 'open' },
    ],
    experts: [
      { name: 'Mobile Geliştirici', role: 'Barkod/Scan Akışları' },
      { name: 'Operasyon Ekibi', role: 'Tur Yönetimi' },
    ],
    score: { bugProneness: 4, boilerplate: 4, complexity: 4, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/LoadParcelToCourierVehicle', desc: 'Koli araçta okutma' },
      { method: 'POST', endpoint: 'Task/GetMyScheduleByZoneCode', desc: 'Schedule sorgulama' },
      { method: 'POST', endpoint: 'Task/AddUserIdToSchedule', desc: 'Kullanıcıyı schedule\'e ekleme' },
      { method: 'POST', endpoint: 'Task/ScheduleStatusChange', desc: 'Schedule durum değişikliği' },
    ],
  },

  app_hc_event_list: {
    whatIs:
      'Mobil uygulama event listesi — uygulamadaki mevcut event tipleri. Event\'ler gönderilerin hayat döngüsündeki aşamaları temsil eder. Bazı ülkelerde ek event\'ler mevcuttur.',
    howItWorks: [
      'EventTower/GetEvents API\'dan event tipi listesi çekilir',
      'Kurye gönderi üzerinde event seçebilir',
      'Seçilen event gönderi durumunu günceller',
    ],
    screens: [
      'EventListFragment — Event listesi ekranı',
      'MainActivity — Ana uygulama (event tetikleme)',
    ],
    parameters: [
      { name: 'country.additionalEvents', desc: 'Ülkeye özel ek event\'ler', type: 'string[]' },
    ],
    diagram: [
      { type: 'node', label: 'GetEvents API çağrılır', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Event listesi çekilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Kurye event seçer', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Durum güncellenir', variant: 'end' },
    ],
    tips: [
      'BA\'da CORE event\'lerine ek olarak PICK event\'i var',
      'ME\'de RETS (Return to Sender) event\'i eklenmiş',
      'Event listesi dinamik olarak backend\'den çekilir',
    ],
    tickets: [],
    experts: [
      { name: 'Backend Ekibi', role: 'Event Yönetimi' },
    ],
    score: { bugProneness: 1, boilerplate: 1, complexity: 1, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'EventTower/GetEvents', desc: 'Event tipi listesi sorgulama' },
    ],
  },

  /* ═══════════════════════════════════════════════════════
   * SHIPMENT TRACKING MODULE
   * ═══════════════════════════════════════════════════════ */

  shipment_tracking_screen: {
    whatIs:
      'Gönderi takip ekranı — ShipmentID, güncel konum, son event, gönderici ve alıcı bilgilerini gösterir. ExW/CPP gönderilerde fiskal detaylar da görünür. Fiskalizasyonu olan ülkelerde fiskal iptal edilirse SSC tetiklenir.',
    howItWorks: [
      'Kurye barkod okutarak veya listeden gönderi seçer',
      'GetShipmentDetails API çağrılır',
      'Takip ekranı gösterilir: ID, konum, son event, taraflar',
      'ExW/CPP ise fiskal detaylar da gösterilir',
      'Gönderi geçmişi GetShipmentHistory ile çekilir',
    ],
    screens: [
      'ShipmentTrackingFragment — Gönderi takip ekranı',
    ],
    parameters: [
      { name: 'shipment.id', desc: 'Gönderi ID', type: 'string' },
      { name: 'country.fiscalizationVisible', desc: 'Fiskal detaylar görünür mü?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Barkod okutma', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'GetShipmentDetails API', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Takip ekranı gösterilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'ExW/CPP mi?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Fiskal detaylar gösterilir', variant: 'process' },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Standart görünüm', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Geçmiş çekilir', variant: 'process', desc: 'GetShipmentHistory' },
      { type: 'arrow' },
      { type: 'node', label: 'Takip tamamlanır', variant: 'end' },
    ],
    tips: [
      'HR, SI, BA, ME\'de fiskalizasyon detayları görünmez — yalnızca RS\'de aktif',
      'Fiskal iptal edilirse SSC (Status Change) event\'i otomatik tetiklenir',
      'Tracking ekranı hem teslimat hem pickup gönderileri için kullanılır',
    ],
    tickets: [
      { id: 'NESY-129', title: 'Takip ekranında eski event verisi gösterilmesi', status: 'closed' },
    ],
    experts: [
      { name: 'Mobile Geliştirici', role: 'Takip Ekranı' },
    ],
    score: { bugProneness: 2, boilerplate: 2, complexity: 2, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/GetShipmentDetails', desc: 'Gönderi detay sorgulama' },
      { method: 'POST', endpoint: 'Integration/GetShipmentHistory', desc: 'Gönderi hareket geçmişi' },
      { method: 'POST', endpoint: 'Integration/GetShipmentDetailByWaybillNumber', desc: 'İrsaliye ile sorgulama' },
      { method: 'POST', endpoint: 'Shipment/GetShipments', desc: 'Toplu gönderi sorgulama' },
    ],
  },

  /* ═══════════════════════════════════════════════════════
   * EBRANCH & DELIVERY OPTIONS MODULE
   * ═══════════════════════════════════════════════════════ */

  ebranch_tracking_link: {
    whatIs:
      'Alıcıya giden takip linki (Branch Link) ve self-servis teslimat seçenekleri. Gönderi oluşturulduktan sonra alıcıya bir link gönderilir. Alıcı bu link üzerinden tur öncesi ve sonrası çeşitli teslimat tercihleri yapabilir.',
    howItWorks: [
      'Gönderi oluşturulduğunda branch linki otomatik üretilir',
      'Alıcı linke tıklayarak ebranch sayfasını açar',
      'TUR öncesi: Parcel Shop, D4Me Locker, Private Locker seçimi',
      'DSSA (otomatik yönlendirme) durumunda: Şubeden al, Teslimatı reddet',
      'TUR sonrası: Evde, Tarih değiştir, Adres değiştir, Şubeden al, Reddet, PS/Locker',
      'COD/ExW ise "Pay with Link" seçeneği görünür',
      'Branch linki DELY/RETS/STOR/DELR sonrası geçersizleşir',
    ],
    screens: [
      'Ebranch Web Sayfası — Mobil uygulamada değil, web üzerinde',
    ],
    parameters: [
      { name: 'shipment.branchLink', desc: 'Alıcıya gönderilen tracking linki', type: 'string' },
      { name: 'shipment.isDSSA', desc: 'Gönderi DSSA ile otomatik yönlendirilmiş mi?', type: 'boolean' },
      { name: 'country.payWithLinkEnabled', desc: 'Pay with Link aktif mi?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Gönderi oluşur', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Link üretilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Alıcı tıklar', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Durum?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'TUR öncesi',
          steps: [
            { type: 'node', label: 'PS/Locker seçimi', variant: 'process' },
          ],
        },
        no: {
          label: 'TUR sonrası',
          steps: [
            { type: 'node', label: 'Evde/Tarih/Adres/Reddet seçenekleri', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Tercih kaydedilir', variant: 'end' },
    ],
    tips: [
      'RS, BA, ME\'de ebranch desteklenmez (N/A)',
      'HR\'de "D4Me Private Locker\'a teslim" TUR öncesi görünmez',
      'SI\'da "Şubeden al" ve "Teslimatı reddet" seçenekleri görünmez',
      'COD/ExW TUR öncesi ödendiyse Cashdesk\'te ilgili ülke altında görünür',
      'Bu özellik backend-driven — mobil uygulamada doğrudan bir ekranı yoktur',
    ],
    tickets: [],
    experts: [
      { name: 'Web Ekibi', role: 'Ebranch Sayfası' },
      { name: 'Backend Ekibi', role: 'Branch Link Üretimi' },
    ],
    score: { bugProneness: 3, boilerplate: 2, complexity: 4, testCoverage: 1 },
  },

  /* ═══════════════════════════════════════════════════════
   * D4ME LOCKER MODULE
   * ═══════════════════════════════════════════════════════ */

  d4me_locker_delivery: {
    whatIs:
      'D4Me entegrasyonu üzerinden tam dolap teslimat süreci. Kurye veya alıcı dolap rezervasyonu yapabilir. Kurye koliyi dolaba bırakır, alıcı alır veya süre aşımında Locker Pickup görevi oluşur. RS\'de Legacy ID\'nin ilk 14 hanesi ile eşleme yapılır.',
    howItWorks: [
      'Kurye: Nesy Mobile üzerinden D4Me Locker rezervasyonu (LCR) oluşturur',
      'VEYA: Alıcı Ebranch üzerinden rezervasyon oluşturur (LCR + DDP)',
      'Rezervasyonda legacy ID D4Me\'ye gönderilir',
      'Kurye koliyi dolaba bırakır',
      'DEPT event\'i D4MeCallback ile gönderilir',
      'Alıcı zamanında alırsa → callback ile DELY alınır',
      'Alınmazsa → Locker Pickup görevi oluşturulur',
      'Kurye süresi geçen koliyi alırsa → COPT event\'i atanır',
    ],
    screens: [
      'LeanLockerFragment — D4Me dolap etkileşim ekranı',
      'D4Me External App — D4Me Android uygulaması (intent ile açılır)',
    ],
    parameters: [
      { name: 'd4me.legacyId', desc: 'Gönderi legacy ID (RS: ilk 14 hane)', type: 'string' },
      { name: 'd4me.reservationId', desc: 'Dolap rezervasyon ID', type: 'string' },
      { name: 'd4me.timeoutHours', desc: 'Alıcı için bekleme süresi (saat)', type: 'number' },
    ],
    diagram: [
      { type: 'node', label: 'Rezervasyon başlar', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Kim oluşturuyor?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Kurye',
          steps: [
            { type: 'node', label: 'LCR via NesyMobile', variant: 'process' },
          ],
        },
        no: {
          label: 'Alıcı',
          steps: [
            { type: 'node', label: 'LCR via Ebranch', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Legacy ID gönderilir', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Dolaba bırakılır', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'DEPT callback gönderilir', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Alıcı aldı mı?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'DELY callback', variant: 'process' },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Locker Pickup görevi', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Kurye alır → COPT', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Akış tamamlanır', variant: 'end' },
    ],
    tips: [
      'RS\'de Legacy ID\'nin ilk 14 hanesi gönderilir — tam ID yerine kısaltılmış ID',
      'DEPT event D4MeCallback ile gelir — async, birkaç gün sürebilir',
      'BA ve ME\'de D4Me entegrasyonu yoktur (N/A)',
      'D4Me uygulamasının test ve prod versiyonları ayrı paket adlarına sahip',
      'Dolap dolu olabilir — kapasite kontrolü D4Me API\'sinde yapılır',
      'LeanLocker (LOS) entegrasyonu da ayrıca mevcut — D4Me\'den farklı bir dolap sistemi',
    ],
    tickets: [
      { id: 'NESY-112', title: 'D4Me callback sonrası gönderi durumu güncellenmemesi', status: 'open' },
      { id: 'NESY-198', title: 'RS 14 haneli ID eşleme hatası', status: 'open' },
      { id: 'NESY-76', title: 'D4Me uygulama versiyonu uyumsuzluğu', status: 'closed' },
      { id: 'NESY-221', title: 'Locker Pickup görevi timeout hesaplama hatası', status: 'open' },
    ],
    experts: [
      { name: 'D4Me Entegrasyon Ekibi', role: 'Dolap Entegrasyonu' },
      { name: 'RS Operasyon', role: 'Legacy ID Eşleme' },
    ],
    score: { bugProneness: 5, boilerplate: 4, complexity: 5, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/CreateD4MReservation', desc: 'D4Me dolap rezervasyonu' },
      { method: 'POST', endpoint: 'Task/DeleteD4MReservation', desc: 'D4Me rezervasyon iptali' },
      { method: 'POST', endpoint: 'Task/CompleteD4MShipments', desc: 'D4Me teslimat tamamlama' },
      { method: 'POST', endpoint: 'Shipment/ActiveD4MCounterLocations', desc: 'Aktif D4Me konumları' },
      { method: 'POST', endpoint: 'Shipment/ActiveLockerCounterLocations', desc: 'Aktif dolap konumları' },
      { method: 'POST', endpoint: 'Task/MakeLockerReservation', desc: 'LOS dolap rezervasyonu' },
      { method: 'POST', endpoint: 'Task/CancelLockerReservation', desc: 'LOS rezervasyon iptali' },
      { method: 'POST', endpoint: 'Task/ManuelLockerCompleteReservation', desc: 'LOS manuel tamamlama' },
    ],
  },
}
