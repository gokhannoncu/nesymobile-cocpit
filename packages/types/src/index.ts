export type DashboardTab =
  | 'anasayfa'
  | 'dokumanlar'
  | 'mimari'
  | 'kararlar'

export const DASHBOARD_TABS: { id: DashboardTab; label: string }[] = [
  { id: 'anasayfa', label: 'Anasayfa' },
  { id: 'dokumanlar', label: 'Dokümanlar' },
  { id: 'mimari', label: 'Mimari' },
  { id: 'kararlar', label: 'Kararlar' },
]
