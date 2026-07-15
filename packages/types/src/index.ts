export type DashboardTab =
  | 'home'
  | 'documents'
  | 'architecture'
  | 'decisions'

export const DASHBOARD_TABS: { id: DashboardTab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'documents', label: 'Documents' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'decisions', label: 'Decisions' },
]
