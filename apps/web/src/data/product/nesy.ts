// Nesy Mobile product data — single source of truth.
// Source: NesyMobileTBD country-based feature matrix (courier app).
// Country IDs match field names in Feature records.

import { FEATURE_DETAILS } from './feature-details'

// Type definitions come from nesy-types.ts — avoids circular dependency.
export type { CountryId, Country, FeatureDetail, Feature, Module } from './nesy-types'
import type { Country, Feature, Module, CountryId } from './nesy-types'


export const COUNTRIES: Country[] = [
  { id: 'core', name: 'CORE', subtitle: 'Standard Infrastructure', price: 'Default', status: 'Global' },
  { id: 'hr', name: 'Scale HR', subtitle: 'Croatia', price: '€299/mo', status: 'Active', isPopular: true },
  { id: 'si', name: 'Scale SI', subtitle: 'Slovenia', price: '€249/mo', status: 'Active' },
  { id: 'rs', name: 'Scale Plus RS', subtitle: 'Serbia', price: '€399/mo', status: 'Advanced' },
  { id: 'ba', name: 'Start BA', subtitle: 'Bosnia', price: '€149/mo', status: 'Limited' },
  { id: 'me', name: 'Start ME', subtitle: 'Montenegro', price: '€149/mo', status: 'Limited' },
  { id: 'sk', name: 'Scale SK', subtitle: 'Slovakia', price: '€249/mo', status: 'Limited' },
]

export const MODULES: Module[] = [
  {
    id: 'delivery-process',
    title: 'Delivery Process',
    desc: 'Doorstep delivery flow: collection, fiscalization, signature, failed delivery, and alternative delivery points.',
    features: [
      {
        id: 'collect_cod',
        title: 'Collect COD',
        desc: 'Cash and credit card collection at the door (cash on delivery).',
        values: {
          core: 'Cash and credit card payments supported',
          hr: 'Cash available\nCredit card via Raipay',
          si: 'Cash available\nCredit card via Softpos',
          rs: 'Cash available\nCredit card via Softpos (to be integrated)',
          ba: 'Cash only collection',
          me: 'Cash only collection',
          sk: '—',
        },
      },
      {
        id: 'collect_exw',
        title: 'Collect ExW',
        desc: 'Ex-works collection at the pickup point.',
        values: {
          core: 'Cash and credit card payments supported',
          hr: 'Cash available\nCredit card via Raipay',
          si: 'Cash available\nCredit card via Softpos',
          rs: 'Cash available\nCredit card via Softpos (to be integrated)',
          ba: 'Cash only collection',
          me: 'Cash only collection',
          sk: '—',
        },
      },
      {
        id: 'skip_exwork',
        title: 'Skip Exwork',
        desc: 'Courier can skip the expected exwork amount.',
        values: {
          core: 'Expected exwork amount can be skipped by courier; shipment is updated and invoiced to customer.',
          hr: 'N/A',
          si: 'N/A',
          rs: 'Same as Core',
          ba: 'N/A',
          me: 'N/A',
          sk: '—',
        },
      },
      {
        id: 'fiscalization_dp',
        title: 'Fiscalization',
        desc: 'Fiscal receipt is triggered and printed on delivery.',
        values: {
          core: 'VPFR is triggered on delivery and receipt is printed',
          hr: 'N/A',
          si: 'N/A',
          rs: 'Same as Core',
          ba: 'N/A',
          me: 'N/A',
          sk: '—',
        },
      },
      {
        id: 'failed_reasons',
        title: 'Delivery Failed Reasons / Photo',
        desc: 'Failed delivery reason selection and mandatory photo evidence.',
        values: {
          core: 'Full failed reason list + mandatory photo in some cases',
          hr: 'Same as Core',
          si: 'Limited list (photo same as Core)',
          rs: 'Same as Core, photo optional',
          ba: 'Same as Core, photo not available',
          me: 'Same as Core, photo optional',
          sk: '—',
        },
      },
      {
        id: 'consignee_info',
        title: 'Consignee Information',
        desc: 'Pre-fill and edit behavior of consignee name on delivery.',
        values: {
          core: 'Name pre-filled, editable',
          hr: 'Name not pre-filled, sent manually externally',
          si: 'Same as Core',
          rs: 'Same as Core',
          ba: 'Same as Core',
          me: 'Same as Core',
          sk: '—',
        },
      },
      {
        id: 'signature_dp',
        title: 'Signature',
        desc: 'Digital and physical signature collection on delivery.',
        values: {
          core: 'Digital signature mandatory\nPhysical document downloadable and signed',
          hr: 'Digital signature same as Core\nDely list same as Core (after code merge)',
          si: 'Same as Core',
          rs: 'Digital signature optional\nDely list same as Core',
          ba: 'Digital signature optional\nDely list same as Core',
          me: 'Digital signature optional\nDely list same as Core',
          sk: '—',
        },
      },
      {
        id: 'delivery_parcelshop',
        title: 'Delivery to Parcelshop',
        desc: 'Delivery of shipments to parcel shop / pick-up point.',
        values: {
          core: 'RDOC and OVSZ shipments cannot be delivered',
          hr: 'Same as Core',
          si: 'Same as Core',
          rs: 'Same as Core',
          ba: 'N/A',
          me: 'N/A',
          sk: '—',
        },
      },
      {
        id: 'delivery_locker',
        title: 'Delivery to Locker',
        desc: 'D4ME integration for smart locker deliveries.',
        values: {
          core: 'D4ME integration\nRDOC and OVSZ shipments cannot be delivered',
          hr: 'Same as Core',
          si: 'Same as Core',
          rs: 'Same as Core',
          ba: 'N/A',
          me: 'N/A',
          sk: '—',
        },
      },
    ],
  },
  {
    id: 'pickup-process',
    title: 'Pickup Process',
    desc: 'Pickup flow: task assignment, CPP collection, failed pickup reasons, and auto re-assignment.',
    features: [
      {
        id: 'pickup_assignment',
        title: 'Pickup Assignment',
        desc: 'How pickup tasks are assigned to couriers.',
        values: {
          core: 'Pickup tasks auto-assigned via job (every 3 minutes)',
          hr: 'Manually assigned by dispatcher',
          si: 'Same as Core',
          rs: 'Manually assigned by dispatcher',
          ba: 'Manually assigned by dispatcher',
          me: 'Same as Core',
          sk: '—',
        },
      },
      {
        id: 'collect_cpp',
        title: 'Collect CPP',
        desc: 'Cash and credit card collection at the pickup point.',
        values: {
          core: 'Cash and credit card payments supported',
          hr: 'Cash available\nCredit card via Raipay',
          si: 'N/A',
          rs: 'Cash available\nCredit card via Softpos (to be integrated)',
          ba: 'N/A',
          me: 'N/A',
          sk: '—',
        },
      },
      {
        id: 'pickup_fiscalization',
        title: 'Pickup Fiscalization (Print Fiscal)',
        desc: 'Fiscal receipt is triggered and printed on pickup for CPP shipments.',
        values: {
          core: 'VPFR is triggered on pickup for CPP shipments and receipt is printed',
          hr: 'N/A',
          si: 'N/A',
          rs: 'N/A',
          ba: 'N/A',
          me: 'N/A',
          sk: '—',
        },
      },
      {
        id: 'pickup_at_customer',
        title: 'Pickup at Customer',
        desc: 'PAC task behavior and end-of-day blocking rules.',
        values: {
          core: 'Unactioned PAC task blocks end of day',
          hr: 'Same as Core',
          si: 'Unactioned PAC task does NOT block end of day',
          rs: 'Same as Core',
          ba: 'Same as Core',
          me: 'Same as Core',
          sk: '—',
        },
      },
      {
        id: 'remote_pickup',
        title: 'Remote Pickup',
        desc: 'Display of sender and receiver information in the mobile app.',
        values: {
          core: 'Sender information displayed in mobile app',
          hr: 'Same as Core',
          si: 'Same as Core',
          rs: 'Same as Core',
          ba: 'Receiver information also displayed alongside sender',
          me: 'Same as Core',
          sk: '—',
        },
      },
      {
        id: 'red_label',
        title: 'Red Label',
        desc: 'Red label shipment pickup flow via mobile app.',
        values: {
          core: 'Red label shipments are picked up via mobile app\n\nProcess flow:\n- Pickup at Customer task is created\n- Courier picks up the parcel\n- Parcel is dropped off at Npoint\n- Shipment is created\n- Backoffice completes missing data',
          hr: 'Same as Core',
          si: 'N/A',
          rs: 'Same as Core flow',
          ba: 'Same as Core',
          me: 'N/A',
          sk: '—',
        },
      },
      {
        id: 'pickup_failed_non_rdoc',
        title: 'Pickup Failed Reason (Non-RDOC)',
        desc: 'Failed reason codes for non-RDOC pickup tasks.',
        values: {
          core: 'NOPC, NPNP, NRDY, NSYS, PABS, PADU, PTIM',
          hr: 'Same as Core',
          si: 'Same as Core',
          rs: 'Same as Core',
          ba: 'Same as Core',
          me: 'Same as Core',
          sk: '—',
        },
      },
      {
        id: 'rdoc_failed_reasons',
        title: 'RDOC Failed Reasons',
        desc: 'Failed reason codes for RDOC pickup tasks.',
        values: {
          core: 'NOPC',
          hr: 'Same as Core',
          si: 'Same as Core',
          rs: 'Same as Core',
          ba: 'Same as Core',
          me: 'Same as Core',
          sk: '—',
        },
      },
      {
        id: 'auto_reassignment',
        title: 'Auto Reassignment to Next Working Day',
        desc: 'Trigger codes for auto re-assignment after failed pickup.',
        values: {
          core: 'After failed reasons (NPNP, NRDY, PABS, PTIM)',
          hr: 'Same as Core',
          si: 'NPNP, NRDY, PABS, PADU, PTIM',
          rs: 'NPNP, NRDY, NSYS, PABS, PADU, PTIM',
          ba: '—',
          me: '—',
          sk: '—',
        },
      },
    ],
  },
  {
    id: 'tour-stop-management',
    title: 'Tour & Stop Management',
    desc: 'Tour and stop management: stop creation/merge rules, beginning-of-day tour approval, and event list.',
    features: [
      {
        id: 'creation_of_stops',
        title: 'Creation of Stops (Merge Shipments)',
        desc: 'Automatic and manual stop creation with shipment merge rules.',
        values: {
          core: '- If receiver name and address match → shipments auto-merge under same stop (dely)\n- If sender name and address match → auto-merge (pickup)\n- After tour approval, new shipments are added as new stops if no matching stop exists\n- Before tour start approval, courier can manually merge stops',
          hr: 'Same as Core',
          si: 'Same as Core',
          rs: 'Same as Core',
          ba: 'Same as Core',
          me: 'Same as Core',
          sk: '—',
        },
      },
      {
        id: 'merge_stops_manual',
        title: 'Merge Stops (Manual)',
        desc: 'Select a main stop and manually merge sub-stops under it.',
        values: {
          core: 'User selects a main stop and merges different stops under it by selecting sub-stops',
          hr: 'Same as Core',
          si: 'Same as Core',
          rs: 'Same as Core',
          ba: 'Same as Core',
          me: 'Same as Core',
          sk: '—',
        },
      },
      {
        id: 'tour_start_approval',
        title: 'Tour Start Approval (Beginning of Day)',
        desc: 'Beginning-of-day parcel scan and tour approval flow.',
        values: {
          core: 'Courier selects route, scans parcels, and sends approval request\nTour start approval is mandatory in all cases',
          hr: 'After first tour start, additionally scanned parcels are auto-approved',
          si: 'After first tour start, additionally scanned parcels are auto-approved',
          rs: 'Same as Core',
          ba: 'Same as Core',
          me: 'Same as Core',
          sk: '—',
        },
      },
      {
        id: 'app_hc_event_list',
        title: 'Application HC – Event List',
        desc: 'Available events in the mobile app event list.',
        values: {
          core: 'Core event list',
          hr: 'Same as Core',
          si: 'Same as Core',
          rs: 'Same as Core',
          ba: 'Core events + PICK event',
          me: 'Core events + RETS (Return to Sender)',
          sk: '—',
        },
      },
    ],
  },
  {
    id: 'shipment-tracking',
    title: 'Shipment Tracking',
    desc: 'Shipment tracking screen: ID, location, last event, party information, and fiscal details.',
    features: [
      {
        id: 'shipment_tracking_screen',
        title: 'Shipment Tracking Screen',
        desc: 'Information displayed on the shipment tracking screen and fiscal details.',
        values: {
          core: 'Tracking screen shows ShipmentID, Current Location, Last Event, Sender and Receiver\n\nFiscal details visible on ExW / CPP shipments. If fiscal is cancelled, SSC is triggered',
          hr: 'Same as Core (except fiscalization)',
          si: 'Same as Core (except fiscalization)',
          rs: 'Same as Core',
          ba: 'Same as Core (except fiscalization)',
          me: 'Same as Core (except fiscalization)',
          sk: '—',
        },
      },
    ],
  },
  {
    id: 'ebranch-delivery-options',
    title: 'Ebranch & Delivery Options',
    desc: 'Tracking link sent to receiver and pre/post-tour self-service delivery options.',
    features: [
      {
        id: 'ebranch_tracking_link',
        title: 'Ebranch Tracking Link & Delivery Options',
        desc: 'Tracking link generation and pre/post-tour delivery options.',
        values: {
          core: '• Branch link is generated after shipment creation\n\nPre-TOUR:\n• Deliver to Parcel Shop\n• Deliver to D4Me Locker\n• Deliver to D4Me Private Locker\n\nIf shipment is auto-redirected (DSSA):\n• Pick up from branch\n• Reject delivery\n\nPost-TOUR:\n• At home\n• Change delivery date\n• Change address\n• Pick up from branch\n• Reject delivery\n• Deliver to Parcel Shop / D4Me Locker / Private Locker\n\n• If COD/ExW → "Pay with Link" appears after INIT\n• Branch link expires after DELY / RETS / STOR / DELR',
          hr: '"Deliver to D4Me Private Locker" not visible pre-TOUR\nIf COD/ExW paid pre-TOUR → appears in Cashdesk under "CC Overseas"',
          si: 'Following options not visible in Ebranch:\n• Pick up from branch\n• Reject delivery\n\nIf COD/ExW paid pre-TOUR → appears in Cashdesk under "CC ExpressOne"',
          rs: 'N/A',
          ba: 'N/A',
          me: 'N/A',
          sk: '—',
        },
      },
    ],
  },
  {
    id: 'd4me-locker',
    title: 'D4Me Locker',
    desc: 'D4Me integration for locker reservation, delivery, and timeout management.',
    features: [
      {
        id: 'd4me_locker_delivery',
        title: 'D4Me Locker Delivery Process',
        desc: 'Locker reservation, delivery, and timeout management via D4Me integration.',
        values: {
          core: '• Courier can create D4Me Locker reservation (LCR) via Nesy Mobile\n• OR receiver can create reservation via Ebranch (LCR + DDP)\n• Legacy ID is sent to D4Me at the reservation step\n• Courier drops parcel into locker → DEPT event is sent via D4MeCallback\n• If receiver picks up on time → DELY is received via callback\n• If not picked up → Locker Pickup task is created\n• If courier picks up expired parcel → COPT event is assigned',
          hr: 'Same as Core',
          si: 'Same as Core',
          rs: '• Integration managed via first 14 digits of Legacy ID\n• 14-digit ID sent instead of full Legacy ID\n• DEPT processed with 14-digit matching\n• DELY from callback matched to stored full Legacy ID',
          ba: 'N/A',
          me: 'N/A',
          sk: '—',
        },
      },
    ],
  },
]

/** Is a feature value "supported" in that country? */
export function isSupported(value: string): boolean {
  return value !== '—' && value !== 'N/A'
}

/** Supported feature count per country. */
export function supportedCount(countryId: CountryId): number {
  return MODULES.flatMap((m) => m.features).filter((f) => isSupported(f.values[countryId])).length
}

export const TOTAL_FEATURES = MODULES.reduce((acc, m) => acc + m.features.length, 0)

// Bind feature detail data — auto-match by feature IDs.
for (const mod of MODULES) {
  for (const feat of mod.features) {
    if (!feat.detail && FEATURE_DETAILS[feat.id]) {
      feat.detail = FEATURE_DETAILS[feat.id]
    }
  }
}

