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

/** Primary navigation hub — most drawer / stop actions originate here. */
export const SCREEN_MAP_HUB_ID = 'stop-list'

/**
 * Curated product flow map for NESY Courier Mobile.
 * Positions are world coordinates (top-left of each node).
 * Layout: hub-and-spoke — Stop List center, domains in radial columns.
 */
export const SCREEN_MAP_NODES: ScreenNode[] = [
  {
    id: 'login',
    label: 'Login',
    domain: 'auth',
    summary: 'Courier authentication entry. Routes to stop list or hub scan mode after sign-in.',
    sourceHint: 'LoginFragment',
    x: 60,
    y: 300,
  },
  {
    id: 'stop-list',
    label: 'Stop List',
    domain: 'route',
    summary: 'Primary day hub: stops on the active route, drawer entry to most operations.',
    sourceHint: 'StopListFragment',
    x: 420,
    y: 300,
  },
  {
    id: 'manual-routing',
    label: 'Manual Routing',
    domain: 'route',
    summary: 'Manual stop / route adjustments outside the default planned sequence.',
    sourceHint: 'ManuelRoutingFragment',
    x: 420,
    y: 560,
  },
  {
    id: 'map',
    label: 'Map',
    domain: 'route',
    summary: 'Geographic view of stops; returns to the stop list hub.',
    sourceHint: 'MapFragment',
    x: 420,
    y: 430,
  },
  {
    id: 'task-list',
    label: 'Task List',
    domain: 'tasks',
    summary: 'Parcel-level tasks for a stop: chat, gray label, and shipment tracking entry points.',
    sourceHint: 'TaskListFragment',
    x: 720,
    y: 60,
  },
  {
    id: 'delivery',
    label: 'Delivery',
    domain: 'delivery',
    summary: 'Complete a delivery attempt with options, evidence, and payment paths.',
    sourceHint: 'DeliveryFragment',
    x: 980,
    y: 140,
  },
  {
    id: 'delivery-failed',
    label: 'Delivery Failed',
    domain: 'delivery',
    summary: 'Capture failure reason and optional photo evidence for an unsuccessful delivery.',
    sourceHint: 'DeliveryFailedFragment',
    x: 1240,
    y: 140,
  },
  {
    id: 'pickup',
    label: 'Pickup',
    domain: 'pickup',
    summary: 'Collect parcels from a shipper stop, including KTF / exception side paths.',
    sourceHint: 'PickUpFragment',
    x: 980,
    y: 300,
  },
  {
    id: 'pickup-failed',
    label: 'Pickup Failed',
    domain: 'pickup',
    summary: 'Record a failed pickup with reason and camera evidence when required.',
    sourceHint: 'PickupFailedFragment',
    x: 1240,
    y: 300,
  },
  {
    id: 'scan-parcel',
    label: 'Scan Parcel',
    domain: 'scan',
    summary: 'Hub companion scan entry used after login or from the drawer.',
    sourceHint: 'ScanParcelFragment',
    x: 980,
    y: 460,
  },
  {
    id: 'barcode-routing',
    label: 'Barcode Routing',
    domain: 'scan',
    summary: 'Route a scanned barcode into the correct operational destination.',
    sourceHint: 'BarcodeRoutingFragment',
    x: 1240,
    y: 540,
  },
  {
    id: 'shipment-tracking',
    label: 'Shipment Tracking',
    domain: 'ops',
    summary: 'Look up shipment status; can open invoice and inquiry details.',
    sourceHint: 'ShipmentTrackingFragment',
    x: 1240,
    y: 460,
  },
  {
    id: 'other-transactions',
    label: 'Other Transactions',
    domain: 'ops',
    summary: 'Ops menu: hand transaction, KTF, case detection, transfer control.',
    sourceHint: 'OtherTransactionFragment',
    x: 720,
    y: 560,
  },
  {
    id: 'vehicle-ops',
    label: 'Vehicle Ops',
    domain: 'ops',
    summary: 'Vehicle welcome / loading hand-transaction path before returning to stops.',
    sourceHint: 'VehicleWelcomeFragment / VehicleLoadingFragment',
    x: 1240,
    y: 620,
  },
  {
    id: 'end-of-day',
    label: 'End of Day',
    domain: 'ops',
    summary: 'Close the tour day and return to the stop list hub.',
    sourceHint: 'EndOfDayFragment',
    x: 60,
    y: 60,
  },
  {
    id: 'gray-label',
    label: 'Gray Label',
    domain: 'ops',
    summary: 'Gray-label parcel list → calculator → result → signature, then back to tasks.',
    sourceHint: 'GrayLabel*Fragment',
    x: 1240,
    y: 60,
  },
  {
    id: 'lean-locker',
    label: 'Lean Locker',
    domain: 'ops',
    summary: 'Locker task list that can open a delivery for a selected barcode.',
    sourceHint: 'LeanLockerTaskListFragment',
    x: 980,
    y: 620,
  },
  {
    id: 'parcel-release',
    label: 'Parcel Release',
    domain: 'ops',
    summary: 'Release parcels (including PUDO locker release variants) from the drawer.',
    sourceHint: 'ParcelReleaseFragment',
    x: 720,
    y: 430,
  },
  {
    id: 'linehaul',
    label: 'Linehaul Load',
    domain: 'ops',
    summary: 'Linehaul loading operation reachable from the navigation drawer.',
    sourceHint: 'LinehaulLoadFragment',
    x: 720,
    y: 300,
  },
  {
    id: 'account-settings',
    label: 'Account Settings',
    domain: 'settings',
    summary: 'Courier account and device settings; returns to the stop list.',
    sourceHint: 'AccountSettingsFragment',
    x: 60,
    y: 430,
  },
  {
    id: 'ask-question',
    label: 'Ask Question',
    domain: 'settings',
    summary: 'Support Q&A flow that returns to the stop list when finished.',
    sourceHint: 'AskQuestionFragment / QuestionFragment',
    x: 60,
    y: 560,
  },
  {
    id: 'chat',
    label: 'Chat',
    domain: 'settings',
    summary: 'Task-related courier chat opened from the task list.',
    sourceHint: 'ChatFragment',
    x: 1240,
    y: 220,
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
type EdgeSide = 'left' | 'right' | 'top' | 'bottom'

export type EdgePort = { x: number; y: number }

export type ResolvedScreenEdge = {
  edge: ScreenEdge
  fromPort: EdgePort
  toPort: EdgePort
  laneOffset: number
  isReturn: boolean
}

const RETURN_EDGE_LABELS = new Set(['Back', 'Done', 'Signed', 'Loaded'])

export function isReturnEdge(edge: ScreenEdge): boolean {
  return RETURN_EDGE_LABELS.has(edge.label)
}

function nodeBox(node: ScreenNode): NodeBox {
  return { x: node.x, y: node.y, width: SCREEN_NODE_WIDTH, height: SCREEN_NODE_HEIGHT }
}

function pickEdgeSides(from: NodeBox, to: NodeBox): { fromSide: EdgeSide; toSide: EdgeSide } {
  const fromCx = from.x + from.width / 2
  const fromCy = from.y + from.height / 2
  const toCx = to.x + to.width / 2
  const toCy = to.y + to.height / 2
  const dx = toCx - fromCx
  const dy = toCy - fromCy

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { fromSide: 'right', toSide: 'left' }
      : { fromSide: 'left', toSide: 'right' }
  }
  return dy >= 0
    ? { fromSide: 'bottom', toSide: 'top' }
    : { fromSide: 'top', toSide: 'bottom' }
}

function portOnSide(box: NodeBox, side: EdgeSide, t: number): EdgePort {
  switch (side) {
    case 'left':
      return { x: box.x, y: box.y + box.height * t }
    case 'right':
      return { x: box.x + box.width, y: box.y + box.height * t }
    case 'top':
      return { x: box.x + box.width * t, y: box.y }
    case 'bottom':
      return { x: box.x + box.width * t, y: box.y + box.height }
  }
}

function sideSortKey(box: NodeBox, side: EdgeSide, other: NodeBox): number {
  const otherCx = other.x + other.width / 2
  const otherCy = other.y + other.height / 2
  if (side === 'left' || side === 'right') return otherCy
  return otherCx
}

function distributePortT(count: number, index: number): number {
  if (count <= 1) return 0.5
  const margin = 0.14
  const span = 1 - margin * 2
  return margin + (span * index) / (count - 1)
}

/** Assign unique anchor ports so parallel edges from the same node do not stack. */
export function resolveScreenEdges(
  edges: ScreenEdge[],
  nodesById: Map<string, ScreenNode>,
): ResolvedScreenEdge[] {
  type Pending = {
    edge: ScreenEdge
    from: NodeBox
    to: NodeBox
    fromSide: EdgeSide
    toSide: EdgeSide
  }
  const pending: Pending[] = []

  for (const edge of edges) {
    const fromNode = nodesById.get(edge.from)
    const toNode = nodesById.get(edge.to)
    if (!fromNode || !toNode) continue
    const from = nodeBox(fromNode)
    const to = nodeBox(toNode)
    const sides = pickEdgeSides(from, to)
    pending.push({ edge, from, to, ...sides })
  }

  const fromGroups = new Map<string, Pending[]>()
  const toGroups = new Map<string, Pending[]>()
  for (const item of pending) {
    const fromKey = `${item.edge.from}:${item.fromSide}`
    const toKey = `${item.edge.to}:${item.toSide}`
    if (!fromGroups.has(fromKey)) fromGroups.set(fromKey, [])
    if (!toGroups.has(toKey)) toGroups.set(toKey, [])
    fromGroups.get(fromKey)!.push(item)
    toGroups.get(toKey)!.push(item)
  }

  for (const group of fromGroups.values()) {
    group.sort((a, b) => sideSortKey(a.from, a.fromSide, b.to) - sideSortKey(b.from, b.fromSide, a.to))
  }
  for (const group of toGroups.values()) {
    group.sort((a, b) => sideSortKey(a.to, a.toSide, b.from) - sideSortKey(b.to, b.toSide, a.from))
  }

  const fromIndex = new Map<string, number>()
  const toIndex = new Map<string, number>()

  return pending.map((item) => {
    const fromKey = `${item.edge.from}:${item.fromSide}`
    const toKey = `${item.edge.to}:${item.toSide}`
    const fi = fromIndex.get(fromKey) ?? 0
    const ti = toIndex.get(toKey) ?? 0
    fromIndex.set(fromKey, fi + 1)
    toIndex.set(toKey, ti + 1)

    const fromGroup = fromGroups.get(fromKey)!
    const toGroup = toGroups.get(toKey)!
    const fromT = distributePortT(fromGroup.length, fi)
    const toT = distributePortT(toGroup.length, ti)
    const laneOffset = (fi - (fromGroup.length - 1) / 2) * 14

    return {
      edge: item.edge,
      fromPort: portOnSide(item.from, item.fromSide, fromT),
      toPort: portOnSide(item.to, item.toSide, toT),
      laneOffset,
      isReturn: isReturnEdge(item.edge),
    }
  })
}

export function domainZoneBounds(
  nodes: ScreenNode[],
  domain: ScreenDomain,
): { x: number; y: number; width: number; height: number } | null {
  const domainNodes = nodes.filter((n) => n.domain === domain)
  if (domainNodes.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const node of domainNodes) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + SCREEN_NODE_WIDTH)
    maxY = Math.max(maxY, node.y + SCREEN_NODE_HEIGHT)
  }
  const pad = 20
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  }
}

/** Orthogonal elbow path between explicit anchor ports. */
export function orthogonalEdgePath(fromPort: EdgePort, toPort: EdgePort, laneOffset = 0): string {
  const dx = toPort.x - fromPort.x
  const dy = toPort.y - fromPort.y

  if (Math.abs(dx) >= Math.abs(dy)) {
    const midX = Math.round((fromPort.x + toPort.x) / 2 + laneOffset)
    return `M ${fromPort.x} ${fromPort.y} L ${midX} ${fromPort.y} L ${midX} ${toPort.y} L ${toPort.x} ${toPort.y}`
  }

  const midY = Math.round((fromPort.y + toPort.y) / 2 + laneOffset)
  return `M ${fromPort.x} ${fromPort.y} L ${fromPort.x} ${midY} L ${toPort.x} ${midY} L ${toPort.x} ${toPort.y}`
}
