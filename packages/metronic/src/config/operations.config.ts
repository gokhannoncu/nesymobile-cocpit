import { MenuConfig, Workspace } from '@nesy/metronic/config/types'
import {
  Archive,
  Briefcase,
  Building2,
  FileText,
  HandCoins,
  KeyRound,
  Scale,
  ScrollText,
  Shield,
  ShoppingCart,
  Store,
  Users,
  Wallet,
} from 'lucide-react'

export const OPERATIONS_BASE_PATH = '/operations'

export const OPERATIONS_MENU: MenuConfig = [
  {
    title: 'Legal',
    path: '/operations/legal',
    icon: Scale,
  },
  {
    title: 'Contracts',
    path: '/operations/contracts',
    icon: FileText,
  },
  {
    title: 'Corporate Documents',
    path: '/operations/corporate-documents',
    icon: Building2,
  },
  {
    title: 'Finance',
    path: '/operations/finance',
    icon: Wallet,
  },
  {
    title: 'Grants & Incentives',
    path: '/operations/grants-and-incentives',
    icon: HandCoins,
  },
  {
    title: 'Procurement',
    path: '/operations/procurement',
    icon: ShoppingCart,
  },
  {
    title: 'Vendors',
    path: '/operations/vendors',
    icon: Store,
  },
  {
    title: 'People & Hiring',
    path: '/operations/people-and-hiring',
    icon: Users,
  },
  {
    title: 'Internal Policies',
    path: '/operations/internal-policies',
    icon: ScrollText,
  },
  {
    title: 'Security Policies',
    path: '/operations/security-policies',
    icon: Shield,
  },
  {
    title: 'Access Management',
    path: '/operations/access-management',
    icon: KeyRound,
  },
  {
    title: 'Company Archive',
    path: '/operations/company-archive',
    icon: Archive,
  },
]

export const OPERATIONS_WORKSPACE: Workspace = {
  id: 'operations',
  label: 'Operations',
  icon: Briefcase,
  className: 'border-white bg-zinc-600 hover:bg-zinc-700 text-white hover:text-white',
  path: '/operations/legal',
  basePaths: [OPERATIONS_BASE_PATH],
  menu: [
    {
      title: 'Operations',
      children: [...OPERATIONS_MENU],
    },
  ],
}
