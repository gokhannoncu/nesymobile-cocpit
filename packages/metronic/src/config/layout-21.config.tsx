import { MenuConfig, Workspace } from '@nesy/metronic/config/types'
import {
  Activity,
  AlertTriangle,
  Bolt,
  BookOpen,
  Bug,
  Calendar,
  CalendarDays,
  Compass,
  Cpu,
  Database,
  FileText,
  Flag,
  FolderKanban,
  Gauge,
  GitBranch,
  Globe,
  Grid3x3,
  History,
  Home,
  Layers,
  LayoutDashboard,
  PackagePlus,
  Plug,
  Map,
  MapPin,
  MonitorSmartphone,
  MousePointerClick,
  Network,
  Package,
  Play,
  Radar,
  Rocket,
  Route,
  ScrollText,
  ShieldCheck,
  Siren,
  Smartphone,
  Table2,
  Tag,
  Terminal,
  Target,
  Ticket,
  Truck,
  UserRoundCog,
  Users,
  Wifi,
  Workflow,
  Zap,
} from 'lucide-react'

export const DATA_CENTER_CONNECTION_PATH = '/data-center/connection' as const
export const DATA_CENTER_SHIPMENT_PATH = '/data-center/shipment' as const
export const DATA_CENTER_PICKUP_PATH = '/data-center/pickup' as const
export const DATA_CENTER_HAPPY_PATH_PATH = '/data-center/happy-path' as const
export const DATA_CENTER_USERS_PATH = '/data-center/users' as const

export const AUTOMATION_LIST_PATH = '/automation/list' as const
export const AUTOMATION_HISTORY_PATH = '/automation/history' as const
export const AUTOMATION_FIELD_LOGIN_PATH = '/automation/field-login' as const
export const AUTOMATION_LOAD_TOUR_PATH = '/automation/01-load-tour-flow' as const
export const AUTOMATION_DOMAIN_PACKS_PATH = '/automation/domain-packs' as const
export const AUTOMATION_TEST_PROFILES_PATH = '/automation/test-profiles' as const
export const AUTOMATION_TEST_CAMPAIGNS_PATH = '/automation/test-campaigns' as const
export const AUTOMATION_RUN_PLANNER_PATH = '/automation/run-planner' as const
export const AUTOMATION_EXECUTION_QUEUE_PATH = '/automation/execution-queue' as const
export const AUTOMATION_FEATURES_PATH = '/automation/features' as const
export const AUTOMATION_COMPONENTS_PATH = '/automation/components' as const
export const AUTOMATION_CAPABILITIES_PATH = '/automation/capabilities' as const
export const AUTOMATION_COVERAGE_GRAPH_PATH = '/automation/coverage-graph' as const

// Single source of truth for the cockpit navigation.
// The left icon rail (SidebarPrimary), secondary menu (SidebarPrimaryMenu), and
// (cockpit)/[...slug] placeholder pages are all derived from this array.
// To add a new workspace, simply add a new entry to this array;
// every menu item with a path automatically receives a placeholder page.
export const WORKSPACES: Workspace[] = [
  {
    id: 'home',
    label: 'Ana Sayfa',
    icon: Home,
    className: 'border-white bg-orange-500 hover:bg-orange-600 text-white hover:text-white',
    path: '/',
    basePaths: ['/', '/home'],
    menu: [
      {
        title: 'Ana Sayfa',
        children: [
          {
            title: 'Command Center',
            icon: Gauge,
            children: [
              {
                title: 'Overview',
                path: '/',
                icon: LayoutDashboard,
              },
              {
                title: 'This Week',
                path: '/home/this-week',
                icon: Calendar,
              },
              {
                title: 'Quick Actions',
                path: '/home/quick-actions',
                icon: Zap,
              },
            ],
          },
          {
            title: 'Planning & Governance',
            icon: Target,
            children: [
              {
                title: 'Strategic Priorities',
                path: '/home/strategic-priorities',
                icon: Target,
              },
              {
                title: 'Upcoming Milestones',
                path: '/home/upcoming-milestones',
                icon: Flag,
              },
              {
                title: 'Open Risks & Blockers',
                path: '/home/open-risks-and-blockers',
                icon: AlertTriangle,
              },
              {
                title: 'Recent Decisions',
                path: '/home/recent-decisions',
                icon: ScrollText,
              },
            ],
          },
          {
            title: 'Activity & Updates',
            icon: History,
            children: [
              {
                title: 'Recent Activity',
                path: '/home/recent-activity',
                icon: History,
              },
              {
                title: 'Recent Documents',
                path: '/home/recent-documents',
                icon: FileText,
              },
              {
                title: 'Upcoming Meetings',
                path: '/home/upcoming-meetings',
                icon: CalendarDays,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'product',
    label: 'Product',
    icon: Package,
    className: 'border-white bg-amber-500 hover:bg-amber-600 text-white hover:text-white',
    path: '/product/domain-glossary',
    basePaths: ['/product'],
    menu: [
      {
        title: 'Product',
        children: [
          {
            title: 'Product Foundation',
            icon: Layers,
            children: [
              {
                title: 'Domain Glossary',
                path: '/product/domain-glossary',
                icon: BookOpen,
              },
              {
                title: 'Domain Model',
                path: '/product/domain-model',
                icon: Network,
              },
              {
                title: 'Screen Map',
                path: '/product/screen-map',
                icon: Map,
              },
            ],
          },
          {
            title: 'Capabilities & Countries',
            icon: Globe,
            children: [
              {
                title: 'Feature Library',
                path: '/product/feature-library',
                icon: Grid3x3,
              },
              {
                title: 'Country Matrix',
                path: '/product/country-matrix',
                icon: Table2,
              },
              {
                title: 'Country Profiles',
                path: '/product/country-profiles',
                icon: MapPin,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'pm',
    label: 'Proje Yönetimi',
    icon: FolderKanban,
    className: 'border-white bg-violet-500 hover:bg-violet-600 text-white hover:text-white',
    path: '/pm/tickets',
    basePaths: ['/pm'],
    menu: [
      {
        title: 'Proje Yönetimi',
        children: [
          {
            title: 'Ticket Management',
            icon: Bug,
            children: [
              {
                title: 'Ticket Board',
                path: '/pm/tickets',
                icon: Ticket,
              },
              {
                title: 'Root Cause Intelligence',
                path: '/pm/root-cause',
                icon: Bug,
              },
            ],
          },
          {
            title: 'Release & Versions',
            icon: GitBranch,
            children: [
              {
                title: 'Release History',
                path: '/pm/releases',
                icon: Rocket,
              },
              {
                title: 'Version Tracker',
                path: '/pm/versions',
                icon: Tag,
              },
            ],
          },
          {
            title: 'Planning',
            icon: Calendar,
            children: [
              {
                title: 'Sprint Calendar',
                path: '/pm/calendar',
                icon: CalendarDays,
              },
              {
                title: 'Roadmap',
                path: '/pm/roadmap',
                icon: Map,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'engineering',
    label: 'Engineering',
    icon: Cpu,
    className: 'border-white bg-blue-500 hover:bg-blue-600 text-white hover:text-white',
    path: '/engineering/incident-playbook',
    basePaths: ['/engineering'],
    menu: [
      {
        title: 'Engineering',
        children: [
          {
            title: 'Güvenilirlik ve Operasyonlar',
            icon: Activity,
            children: [
              {
                title: 'Incident Komuta Merkezi',
                path: '/engineering/incident-playbook',
                icon: Siren,
              },
              {
                title: 'Edge Case Map',
                path: '/engineering/edge-case-map',
                icon: Radar,
              },
              {
                title: 'Field Ticket Intelligence',
                path: '/engineering/field-tickets',
                icon: Ticket,
              },
            ],
          },
          {
            title: 'Architecture & Modernization',
            icon: Network,
            children: [
              {
                title: 'Current Architecture',
                path: '/engineering/current-architecture',
                icon: Layers,
              },
              {
                title: 'Modernization Plan',
                path: '/engineering/modernization-plan',
                icon: Route,
              },
            ],
          },
          {
            title: 'Mobile Knowledge',
            icon: Smartphone,
            children: [
              {
                title: 'Backend Handbook',
                path: '/engineering/backend-handbook',
                icon: BookOpen,
              },
              {
                title: 'Screen Manual',
                path: '/engineering/screen-manual',
                icon: MonitorSmartphone,
              },
              {
                title: 'Mobile Service Atlas',
                path: '/engineering/mobile-service-atlas',
                icon: Globe,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'debug-view',
    label: 'Debug View',
    icon: Bug,
    className: 'border-white bg-teal-500 hover:bg-teal-600 text-white hover:text-white',
    path: '/debug-view/overview',
    basePaths: ['/debug-view', '/engineering/tools'],
    menu: [
      {
        title: 'Debug View',
        children: [
          {
            title: 'Device Overview',
            path: '/debug-view/overview',
            icon: MonitorSmartphone,
          },
          {
            title: 'Operational Readiness',
            path: '/debug-view/operational-health',
            icon: ShieldCheck,
          },
          {
            title: 'Live Inspection',
            icon: Radar,
            children: [
              {
                title: 'Screen State',
                path: '/debug-view/screen-state',
                icon: LayoutDashboard,
              },
              {
                title: 'User Interactions',
                path: '/debug-view/interactions',
                icon: MousePointerClick,
              },
              {
                title: 'Network Inspector',
                path: '/debug-view/network-inspector',
                icon: Wifi,
              },
            ],
          },
          {
            title: 'On-Device Data',
            icon: Database,
            children: [
              {
                title: 'Schedule Explorer',
                path: '/debug-view/schedule',
                icon: Route,
              },
              {
                title: 'Database Access',
                path: '/debug-view/database',
                icon: Table2,
              },
            ],
          },
          {
            title: 'Device Tools',
            icon: MonitorSmartphone,
            children: [
              {
                title: 'ADB Scenario Runner',
                path: '/debug-view/adb-scenarios',
                icon: Play,
              },
              {
                title: 'Device Log Explorer',
                path: '/debug-view/log-explorer',
                icon: ScrollText,
              },
            ],
          },
          {
            title: 'Engineering Tools',
            icon: Bolt,
            children: [
              {
                title: 'Data Locator',
                path: '/engineering/tools/data-locator',
                icon: Compass,
              },
              {
                title: 'MongoDB Query Generator',
                path: '/engineering/tools/mongodb-query-generator',
                icon: Database,
              },
              {
                title: 'Graylog Query Generator',
                path: '/engineering/tools/graylog-query-generator',
                icon: Terminal,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'data-center',
    label: 'Data Center',
    icon: Database,
    className: 'border-white bg-nesy hover:bg-nesy-hover text-white hover:text-white',
    path: DATA_CENTER_CONNECTION_PATH,
    basePaths: ['/data-center'],
    menu: [
      {
        title: 'Data Center',
        children: [
          {
            title: 'Connection',
            path: DATA_CENTER_CONNECTION_PATH,
            icon: Plug,
          },
          {
            title: 'Shipment',
            icon: Truck,
            children: [
              {
                title: 'Shipment Operations',
                path: DATA_CENTER_SHIPMENT_PATH,
                icon: Truck,
                requiresNesyAuth: true,
              },
            ],
          },
          {
            title: 'Pickup',
            icon: Calendar,
            children: [
              {
                title: 'Pickup Operations',
                path: DATA_CENTER_PICKUP_PATH,
                icon: Calendar,
                requiresNesyAuth: true,
              },
            ],
          },
          {
            title: 'Happy Path',
            icon: PackagePlus,
            children: [
              {
                title: 'Happy Path Operations',
                path: DATA_CENTER_HAPPY_PATH_PATH,
                icon: PackagePlus,
                requiresNesyAuth: true,
              },
            ],
          },
          {
            title: 'User Management',
            icon: Users,
            children: [
              {
                title: 'User Operations',
                path: DATA_CENTER_USERS_PATH,
                icon: Users,
                requiresNesyAuth: true,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 'automation',
    label: 'Automation',
    icon: Workflow,
    className: 'border-white bg-emerald-500 hover:bg-emerald-600 text-white hover:text-white',
    path: AUTOMATION_LIST_PATH,
    basePaths: ['/automation'],
    menu: [
      {
        title: 'Automation',
        children: [
          {
            title: 'Workflows',
            icon: Workflow,
            children: [
              {
                title: 'Workflow Library',
                path: AUTOMATION_LIST_PATH,
                icon: Layers,
              },
              {
                title: 'Run History',
                path: AUTOMATION_HISTORY_PATH,
                icon: History,
              },
              {
                title: 'Run Planner',
                path: AUTOMATION_RUN_PLANNER_PATH,
                icon: Route,
              },
              {
                title: 'Execution Queue',
                path: AUTOMATION_EXECUTION_QUEUE_PATH,
                icon: Activity,
              },
              {
                title: 'Field Courier Login',
                path: AUTOMATION_FIELD_LOGIN_PATH,
                icon: UserRoundCog,
              },
              {
                title: 'Load & Tour Flow',
                path: AUTOMATION_LOAD_TOUR_PATH,
                icon: Truck,
              },
            ],
          },
          {
            title: 'Domain Packs',
            icon: Package,
            children: [
              {
                title: 'Domain Pack Catalog',
                path: AUTOMATION_DOMAIN_PACKS_PATH,
                icon: Layers,
              },
              {
                title: 'Feature Registry',
                path: AUTOMATION_FEATURES_PATH,
                icon: Flag,
              },
              {
                title: 'Component Registry',
                path: AUTOMATION_COMPONENTS_PATH,
                icon: Cpu,
              },
              {
                title: 'Capability Contracts',
                path: AUTOMATION_CAPABILITIES_PATH,
                icon: Bolt,
              },
              {
                title: 'Coverage Graph',
                path: AUTOMATION_COVERAGE_GRAPH_PATH,
                icon: Network,
              },
            ],
          },
          {
            title: 'Quality Assurance',
            icon: ShieldCheck,
            children: [
              {
                title: 'Test Profiles',
                path: AUTOMATION_TEST_PROFILES_PATH,
                icon: FileText,
              },
              {
                title: 'Test Campaigns',
                path: AUTOMATION_TEST_CAMPAIGNS_PATH,
                icon: Grid3x3,
              },
            ],
          },
        ],
      },
    ],
  },
]

export const MENU_SIDEBAR_RESOURCES: MenuConfig = [
  {
    title: 'Resources',
    children: [
      {
        title: 'Metronic Layout 21',
        path: 'https://keenthemes.com/metronic/starter-kits/nextjs/layout-21',
        icon: Bolt,
      },
    ],
  },
]

export const MENU_SIDEBAR_WORKSPACES: MenuConfig = [
  {
    title: 'Workspaces',
    children: [
      {
        title: 'Nesy Mobile Cockpit',
        path: '/',
        icon: LayoutDashboard,
      },
    ],
  },
]
