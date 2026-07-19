// Curated mapping: product feature id → PM ticket ids (`/pm/tickets` dataset).
// Each ticket is assigned to one primary feature.

export const FEATURE_TICKET_IDS: Record<string, number[]> = {
  collect_cod: [4800, 4824, 4457, 5539, 5257],
  collect_exw: [5055, 3249],
  skip_exwork: [],
  fiscalization_dp: [5062, 4858, 5091, 5013],
  failed_reasons: [6352, 3393],
  consignee_info: [4772, 4446, 4771],
  signature_dp: [],
  delivery_parcelshop: [6087],
  delivery_locker: [],
  pickup_assignment: [1878, 3349],
  collect_cpp: [],
  pickup_fiscalization: [4344, 5312],
  pickup_at_customer: [4491],
  remote_pickup: [4252],
  red_label: [3886, 4506],
  pickup_failed_non_rdoc: [],
  rdoc_failed_reasons: [],
  auto_reassignment: [4452],
  creation_of_stops: [6099],
  merge_stops_manual: [5683],
  tour_start_approval: [6218, 4571, 4494, 4484, 6157, 5278, 5339, 4776, 5874, 4502],
  app_hc_event_list: [4575, 4405],
  shipment_tracking_screen: [4903, 2970, 5033, 3420],
  ebranch_tracking_link: [],
  d4me_locker_delivery: [4426, 4545, 5944, 5058],
}

export const ALL_MAPPED_TICKET_IDS = Object.values(FEATURE_TICKET_IDS).flat()
