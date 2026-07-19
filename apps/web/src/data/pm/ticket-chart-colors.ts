export interface BarColor {
  from: string
  to: string
}

/** Kurumsal mavi–slate paleti — NesyArchitectureReport Ticket Dashboard */
export const CHART_PALETTE: BarColor[] = [
  { from: '#1e40af', to: '#1e3a8a' },
  { from: '#2563eb', to: '#1d4ed8' },
  { from: '#0369a1', to: '#075985' },
  { from: '#0f766e', to: '#115e59' },
  { from: '#4338ca', to: '#3730a3' },
  { from: '#475569', to: '#334155' },
  { from: '#64748b', to: '#475569' },
  { from: '#0891b2', to: '#0e7490' },
  { from: '#1d4ed8', to: '#1e40af' },
  { from: '#334155', to: '#1e293b' },
]

const SEMANTIC_COLORS: Record<string, BarColor> = {
  Bug: { from: '#dc2626', to: '#b91c1c' },
  Enhancement: { from: '#2563eb', to: '#1d4ed8' },
  Feature: { from: '#0f766e', to: '#047857' },
  'Feature/Enhancement': { from: '#0369a1', to: '#075985' },
  'Finans & Ödeme': { from: '#b45309', to: '#92400e' },
  'Barcode & Scan': { from: '#2563eb', to: '#1d4ed8' },
  'D4Me & Locker': { from: '#0891b2', to: '#0e7490' },
  'State & Race': { from: '#7c3aed', to: '#6d28d9' },
  'Tour & Teslimat': { from: '#1e40af', to: '#1e3a8a' },
  Bildirim: { from: '#db2777', to: '#be185d' },
  'Offline & Sync': { from: '#475569', to: '#334155' },
  'Konum & GPS': { from: '#0f766e', to: '#115e59' },
  'UI & Crash': { from: '#dc2626', to: '#b91c1c' },
  Güvenlik: { from: '#64748b', to: '#475569' },
  'Ülke & Config': { from: '#78716c', to: '#57534e' },
  Genel: { from: '#64748b', to: '#475569' },
  Delivery: { from: '#1e40af', to: '#1e3a8a' },
  'D4Me / Locker': { from: '#0891b2', to: '#0e7490' },
  'Delivery Failed': { from: '#dc2626', to: '#b91c1c' },
  'Pick Up': { from: '#b45309', to: '#92400e' },
  'Route Selection': { from: '#2563eb', to: '#1d4ed8' },
  'End of Day': { from: '#4338ca', to: '#3730a3' },
  'Stop List': { from: '#0f766e', to: '#047857' },
  'Task List': { from: '#475569', to: '#334155' },
  'Map / Navigation': { from: '#0369a1', to: '#075985' },
  'Login / Settings': { from: '#64748b', to: '#475569' },
  'Hub Companion': { from: '#3730a3', to: '#312e81' },
  'Shipment Detail': { from: '#1d4ed8', to: '#1e40af' },
  'Shipment Tracking': { from: '#0284c7', to: '#0369a1' },
}

export function getBarColor(name: string, index: number): BarColor {
  return SEMANTIC_COLORS[name] ?? CHART_PALETTE[index % CHART_PALETTE.length]!
}

export function barGradient(color: BarColor): string {
  return `linear-gradient(180deg, ${color.from}, ${color.to})`
}

export function barTint(color: BarColor, alpha = 0.12): string {
  return `${color.from}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')}`
}

export const sevColorHex = {
  Critical: '#b91c1c',
  High: '#c2410c',
  Medium: '#a16207',
  Low: '#047857',
} as const

export const statusColorHex = {
  open: '#c53030',
  closed: '#059669',
} as const

export const sevEmoji = {
  Critical: '🔥',
  High: '🔴',
  Medium: '🟡',
  Low: '🟢',
} as const
