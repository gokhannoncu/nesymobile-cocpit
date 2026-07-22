/** Product-level courier app domains for the screen knowledge map. */
export const SCREEN_DOMAINS = [
  'auth',
  'route',
  'tasks',
  'delivery',
  'pickup',
  'scan',
  'ops',
  'settings',
] as const

export type ScreenDomain = (typeof SCREEN_DOMAINS)[number]

export type ScreenNode = {
  id: string
  label: string
  domain: ScreenDomain
  summary: string
  /** Maintainer hint: Android fragment / activity name */
  sourceHint?: string
  x: number
  y: number
}

export type ScreenEdge = {
  id: string
  from: string
  to: string
  label: string
}

export type ScreenMapIntegrity = {
  duplicateNodeIds: string[]
  orphanEdgeEnds: string[]
  duplicateEdgeIds: string[]
  invalidDomains: string[]
}

export const SCREEN_NODE_WIDTH = 176
export const SCREEN_NODE_HEIGHT = 64

export const SCREEN_DOMAIN_META: Record<ScreenDomain, { label: string; tone: string }> = {
  auth: { label: 'Auth', tone: 'teal' },
  route: { label: 'Route', tone: 'blue' },
  tasks: { label: 'Tasks', tone: 'indigo' },
  delivery: { label: 'Delivery', tone: 'green' },
  pickup: { label: 'Pickup', tone: 'amber' },
  scan: { label: 'Scan', tone: 'orange' },
  ops: { label: 'Ops', tone: 'purple' },
  settings: { label: 'Settings', tone: 'gray' },
}

/**
 * Curated product flow map for NESY Courier Mobile.
 * Positions are world coordinates (top-left of each node).
 */
export const SCREEN_MAP_NODES: ScreenNode[] = [
  {
    id: 'login',
    label: 'Login',
    domain: 'auth',
    summary: 'Courier authentication entry. Routes to stop list or hub scan mode after sign-in.',
    sourceHint: 'LoginFragment',
    x: 40,
    y: 280,
  },
  {
    id: 'stop-list',
    label: 'Stop List',
    domain: 'route',
    summary: 'Primary day hub: stops on the active route, drawer entry to most operations.',
    sourceHint: 'StopListFragment',
    x: 280,
    y: 280,
  },
  {
    id: 'manual-routing',
    label: 'Manual Routing',
    domain: 'route',
    summary: 'Manual stop / route adjustments outside the default planned sequence.',
    sourceHint: 'ManuelRoutingFragment',
    x: 540,
    y: 640,
  },
  {
    id: 'map',
    label: 'Map',
    domain: 'route',
    summary: 'Geographic view of stops; returns to the stop list hub.',
    sourceHint: 'MapFragment',
    x: 280,
    y: 420,
  },
  {
    id: 'task-list',
    label: 'Task List',
    domain: 'tasks',
    summary: 'Parcel-level tasks for a stop: chat, gray label, and shipment tracking entry points.',
    sourceHint: 'TaskListFragment',
    x: 540,
    y: 80,
  },
  {
    id: 'delivery',
    label: 'Delivery',
    domain: 'delivery',
    summary: 'Complete a delivery attempt with options, evidence, and payment paths.',
    sourceHint: 'DeliveryFragment',
    x: 540,
    y: 220,
  },
  {
    id: 'delivery-failed',
    label: 'Delivery Failed',
    domain: 'delivery',
    summary: 'Capture failure reason and optional photo evidence for an unsuccessful delivery.',
    sourceHint: 'DeliveryFailedFragment',
    x: 800,
    y: 220,
  },
  {
    id: 'pickup',
    label: 'Pickup',
    domain: 'pickup',
    summary: 'Collect parcels from a shipper stop, including KTF / exception side paths.',
    sourceHint: 'PickUpFragment',
    x: 540,
    y: 360,
  },
  {
    id: 'pickup-failed',
    label: 'Pickup Failed',
    domain: 'pickup',
    summary: 'Record a failed pickup with reason and camera evidence when required.',
    sourceHint: 'PickupFailedFragment',
    x: 800,
    y: 360,
  },
  {
    id: 'scan-parcel',
    label: 'Scan Parcel',
    domain: 'scan',
    summary: 'Hub companion scan entry used after login or from the drawer.',
    sourceHint: 'ScanParcelFragment',
    x: 540,
    y: 500,
  },
  {
    id: 'barcode-routing',
    label: 'Barcode Routing',
    domain: 'scan',
    summary: 'Route a scanned barcode into the correct operational destination.',
    sourceHint: 'BarcodeRoutingFragment',
    x: 1060,
    y: 500,
  },
  {
    id: 'shipment-tracking',
    label: 'Shipment Tracking',
    domain: 'ops',
    summary: 'Look up shipment status; can open invoice and inquiry details.',
    sourceHint: 'ShipmentTrackingFragment',
    x: 800,
    y: 500,
  },
  {
    id: 'other-transactions',
    label: 'Other Transactions',
    domain: 'ops',
    summary: 'Ops menu: hand transaction, KTF, case detection, transfer control.',
    sourceHint: 'OtherTransactionFragment',
    x: 280,
    y: 140,
  },
  {
    id: 'vehicle-ops',
    label: 'Vehicle Ops',
    domain: 'ops',
    summary: 'Vehicle welcome / loading hand-transaction path before returning to stops.',
    sourceHint: 'VehicleWelcomeFragment / VehicleLoadingFragment',
    x: 1060,
    y: 140,
  },
  {
    id: 'end-of-day',
    label: 'End of Day',
    domain: 'ops',
    summary: 'Close the tour day and return to the stop list hub.',
    sourceHint: 'EndOfDayFragment',
    x: 40,
    y: 40,
  },
  {
    id: 'gray-label',
    label: 'Gray Label',
    domain: 'ops',
    summary: 'Gray-label parcel list → calculator → result → signature, then back to tasks.',
    sourceHint: 'GrayLabel*Fragment',
    x: 800,
    y: 40,
  },
  {
    id: 'lean-locker',
    label: 'Lean Locker',
    domain: 'ops',
    summary: 'Locker task list that can open a delivery for a selected barcode.',
    sourceHint: 'LeanLockerTaskListFragment',
    x: 800,
    y: 300,
  },
  {
    id: 'parcel-release',
    label: 'Parcel Release',
    domain: 'ops',
    summary: 'Release parcels (including PUDO locker release variants) from the drawer.',
    sourceHint: 'ParcelReleaseFragment',
    x: 800,
    y: 640,
  },
  {
    id: 'linehaul',
    label: 'Linehaul Load',
    domain: 'ops',
    summary: 'Linehaul loading operation reachable from the navigation drawer.',
    sourceHint: 'LinehaulLoadFragment',
    x: 280,
    y: 560,
  },
  {
    id: 'account-settings',
    label: 'Account Settings',
    domain: 'settings',
    summary: 'Courier account and device settings; returns to the stop list.',
    sourceHint: 'AccountSettingsFragment',
    x: 40,
    y: 480,
  },
  {
    id: 'ask-question',
    label: 'Ask Question',
    domain: 'settings',
    summary: 'Support Q&A flow that returns to the stop list when finished.',
    sourceHint: 'AskQuestionFragment / QuestionFragment',
    x: 40,
    y: 620,
  },
  {
    id: 'chat',
    label: 'Chat',
    domain: 'settings',
    summary: 'Task-related courier chat opened from the task list.',
    sourceHint: 'ChatFragment',
    x: 1060,
    y: 40,
  },
]

export const SCREEN_MAP_EDGES: ScreenEdge[] = [
  { id: 'e-login-stops', from: 'login', to: 'stop-list', label: 'Sign in' },
  { id: 'e-login-scan', from: 'login', to: 'scan-parcel', label: 'Hub mode' },
  { id: 'e-stops-tasks', from: 'stop-list', to: 'task-list', label: 'Open tasks' },
  { id: 'e-stops-delivery', from: 'stop-list', to: 'delivery', label: 'Deliver' },
  { id: 'e-stops-delivery-failed', from: 'stop-list', to: 'delivery-failed', label: 'Fail delivery' },
  { id: 'e-stops-pickup', from: 'stop-list', to: 'pickup', label: 'Pick up' },
  { id: 'e-stops-scan', from: 'stop-list', to: 'scan-parcel', label: 'Scan' },
  { id: 'e-stops-manual', from: 'stop-list', to: 'manual-routing', label: 'Manual route' },
  { id: 'e-stops-map', from: 'stop-list', to: 'map', label: 'Map' },
  { id: 'e-stops-other', from: 'stop-list', to: 'other-transactions', label: 'Other ops' },
  { id: 'e-stops-tracking', from: 'stop-list', to: 'shipment-tracking', label: 'Track' },
  { id: 'e-stops-settings', from: 'stop-list', to: 'account-settings', label: 'Settings' },
  { id: 'e-stops-ask', from: 'stop-list', to: 'ask-question', label: 'Ask' },
  { id: 'e-stops-linehaul', from: 'stop-list', to: 'linehaul', label: 'Linehaul' },
  { id: 'e-stops-release', from: 'stop-list', to: 'parcel-release', label: 'Release' },
  { id: 'e-stops-eod', from: 'stop-list', to: 'end-of-day', label: 'End day' },
  { id: 'e-stops-locker', from: 'stop-list', to: 'lean-locker', label: 'Locker' },
  { id: 'e-map-stops', from: 'map', to: 'stop-list', label: 'Back' },
  { id: 'e-eod-stops', from: 'end-of-day', to: 'stop-list', label: 'Done' },
  { id: 'e-settings-stops', from: 'account-settings', to: 'stop-list', label: 'Back' },
  { id: 'e-ask-stops', from: 'ask-question', to: 'stop-list', label: 'Done' },
  { id: 'e-delivery-failed-branch', from: 'delivery', to: 'delivery-failed', label: 'Failed' },
  { id: 'e-pickup-failed-branch', from: 'pickup', to: 'pickup-failed', label: 'Failed' },
  { id: 'e-tasks-gray', from: 'task-list', to: 'gray-label', label: 'Gray label' },
  { id: 'e-tasks-chat', from: 'task-list', to: 'chat', label: 'Chat' },
  { id: 'e-tasks-tracking', from: 'task-list', to: 'shipment-tracking', label: 'Track' },
  { id: 'e-gray-tasks', from: 'gray-label', to: 'task-list', label: 'Signed' },
  { id: 'e-other-vehicle', from: 'other-transactions', to: 'vehicle-ops', label: 'Vehicle' },
  { id: 'e-vehicle-stops', from: 'vehicle-ops', to: 'stop-list', label: 'Loaded' },
  { id: 'e-lean-delivery', from: 'lean-locker', to: 'delivery', label: 'Open delivery' },
  { id: 'e-scan-barcode', from: 'scan-parcel', to: 'barcode-routing', label: 'Route barcode' },
]

export function assertScreenMapIntegrity(
  nodes: ScreenNode[],
  edges: ScreenEdge[],
): ScreenMapIntegrity {
  const domainSet = new Set<string>(SCREEN_DOMAINS)
  const nodeIds = new Set<string>()
  const duplicateNodeIds: string[] = []
  const invalidDomains: string[] = []

  for (const node of nodes) {
    if (nodeIds.has(node.id)) duplicateNodeIds.push(node.id)
    nodeIds.add(node.id)
    if (!domainSet.has(node.domain)) {
      invalidDomains.push(`${node.id}:${node.domain}`)
    }
  }

  const edgeIds = new Set<string>()
  const duplicateEdgeIds: string[] = []
  const orphanEdgeEnds: string[] = []

  for (const edge of edges) {
    if (edgeIds.has(edge.id)) duplicateEdgeIds.push(edge.id)
    edgeIds.add(edge.id)
    if (!nodeIds.has(edge.from)) orphanEdgeEnds.push(`${edge.id}:from:${edge.from}`)
    if (!nodeIds.has(edge.to)) orphanEdgeEnds.push(`${edge.id}:to:${edge.to}`)
  }

  return { duplicateNodeIds, orphanEdgeEnds, duplicateEdgeIds, invalidDomains }
}

export function getScreenNodeById(
  nodes: ScreenNode[],
  id: string | null | undefined,
): ScreenNode | undefined {
  if (!id) return undefined
  return nodes.find((n) => n.id === id)
}

export function getConnectedEdges(
  edges: ScreenEdge[],
  nodeId: string,
): { incoming: ScreenEdge[]; outgoing: ScreenEdge[] } {
  return {
    incoming: edges.filter((e) => e.to === nodeId),
    outgoing: edges.filter((e) => e.from === nodeId),
  }
}

export function screenMapBounds(nodes: ScreenNode[]): {
  minX: number
  minY: number
  maxX: number
  maxY: number
  width: number
  height: number
} {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of nodes) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + SCREEN_NODE_WIDTH)
    maxY = Math.max(maxY, node.y + SCREEN_NODE_HEIGHT)
  }
  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 }
  }
  const pad = 80
  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  }
}

type NodeBox = { x: number; y: number; width: number; height: number }

/** Orthogonal elbow path from the right/left mid of source to target. */
export function orthogonalEdgePath(from: NodeBox, to: NodeBox): string {
  const fromRight = from.x + from.width
  const fromMidY = from.y + from.height / 2
  const toLeft = to.x
  const toMidY = to.y + to.height / 2
  const toRight = to.x + to.width
  const fromLeft = from.x

  // Prefer left-to-right; fall back to right-to-left when target is to the left.
  if (to.x >= fromRight - 8) {
    const midX = Math.round((fromRight + toLeft) / 2)
    return `M ${fromRight} ${fromMidY} L ${midX} ${fromMidY} L ${midX} ${toMidY} L ${toLeft} ${toMidY}`
  }

  if (toRight <= fromLeft + 8) {
    const midX = Math.round((fromLeft + toRight) / 2)
    return `M ${fromLeft} ${fromMidY} L ${midX} ${fromMidY} L ${midX} ${toMidY} L ${toRight} ${toMidY}`
  }

  // Overlapping X: route below both nodes.
  const fromBottom = from.y + from.height
  const toBottom = to.y + to.height
  const midY = Math.max(fromBottom, toBottom) + 28
  const fromX = from.x + from.width / 2
  const toX = to.x + to.width / 2
  return `M ${fromX} ${fromBottom} L ${fromX} ${midY} L ${toX} ${midY} L ${toX} ${to.y}`
}
