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
  Gauge,
  GitBranch,
  Globe,
  Grid3x3,
  History,
  Home,
  KanbanSquare,
  Layers,
  LayoutDashboard,
  ListTodo,
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
  Search,
  ShieldCheck,
  Siren,
  Smartphone,
  Table2,
  Tag,
  Terminal,
  Target,
  Ticket,
  Truck,
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

export const AUTOMATION_OVERVIEW_PATH = '/automation/overview' as const
export const AUTOMATION_LIST_PATH = '/automation/list' as const
export const AUTOMATION_HISTORY_PATH = '/automation/history' as const

// Single source of truth for the cockpit navigation.
// The left icon rail (SidebarPrimary), secondary menu (SidebarPrimaryMenu), and
// (cockpit)/[...slug] placeholder pages are all derived from this array.
// To add a new workspace, simply add a new entry to this array;
// every menu item with a path automatically receives a placeholder page.
export const WORKSPACES: Workspace[] = [
  {
    id: 'home',
    label: 'Home',
    icon: Home,
    className: 'border-white bg-orange-500 hover:bg-orange-600 text-white hover:text-white',
    path: '/',
    basePaths: ['/', '/home'],
    menu: [
      {
        title: 'Home',
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
            ],
          },
          {
            title: 'Users & Experience',
            icon: Users,
            children: [
              {
                title: 'User Journeys',
                path: '/product/user-journeys',
                icon: Route,
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
    id: 'engineering',
    label: 'Engineering',
    icon: Cpu,
    className: 'border-white bg-blue-500 hover:bg-blue-600 text-white hover:text-white',
    path: '/engineering/overview',
    basePaths: ['/engineering'],
    menu: [
      {
        title: 'Engineering',
        children: [
          {
            title: 'Overview',
            path: '/engineering/overview',
            icon: LayoutDashboard,
          },
          {
            title: 'Reliability & Operations',
            icon: Activity,
            children: [
              {
                title: 'Incident Command Center',
                path: '/engineering/incident-playbook',
                icon: Siren,
              },
              {
                title: 'Edge Case Map',
                path: '/engineering/edge-case-map',
                icon: Radar,
              },
              {
                title: 'Crashlytics',
                path: '/engineering/crashlytics',
                icon: Bug,
              },
              {
                title: 'Performance Intelligence',
                path: '/engineering/performance',
                icon: Gauge,
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
              {
                title: 'Technical Debt',
                path: '/engineering/technical-debt',
                icon: ListTodo,
              },
            ],
          },
          {
            title: 'Delivery & Security',
            icon: GitBranch,
            children: [
              {
                title: 'GitHub Pulse',
                path: '/engineering/github-pulse',
                icon: GitBranch,
              },
              {
                title: 'Security Posture',
                path: '/engineering/security',
                icon: ShieldCheck,
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
    id: 'debug-view',
    label: 'Debug View',
    icon: Bug,
    className: 'border-white bg-teal-500 hover:bg-teal-600 text-white hover:text-white',
    path: '/debug-view/overview',
    basePaths: ['/debug-view'],
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
            title: 'Management',
            icon: Truck,
            children: [
              {
                title: 'Shipment Operations',
                path: DATA_CENTER_SHIPMENT_PATH,
                icon: Truck,
                requiresNesyAuth: true,
              },
              {
                title: 'Pickup Operations',
                path: DATA_CENTER_PICKUP_PATH,
                icon: Calendar,
                requiresNesyAuth: true,
              },
              {
                title: 'Happy Path Operations',
                path: DATA_CENTER_HAPPY_PATH_PATH,
                icon: PackagePlus,
                requiresNesyAuth: true,
              },
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
    path: AUTOMATION_OVERVIEW_PATH,
    basePaths: ['/automation'],
    menu: [
      {
        title: 'Automation',
        children: [
          {
            title: 'Overview',
            path: AUTOMATION_OVERVIEW_PATH,
            icon: LayoutDashboard,
          },
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
        ],
      },
    ],
  },
  {
    id: 'pm',
    label: 'Project Management',
    icon: KanbanSquare,
    className: 'border-white bg-violet-500 hover:bg-violet-600 text-white hover:text-white',
    path: '/pm/overview',
    basePaths: ['/pm'],
    menu: [
      {
        title: 'Project Management',
        children: [
          {
            title: 'Overview',
            path: '/pm/overview',
            icon: LayoutDashboard,
          },
          {
            title: 'Ticket Management',
            icon: Bug,
            children: [
              {
                title: 'Ticket Board',
                path: '/pm/tickets',
                icon: KanbanSquare,
              },
              {
                title: 'Root Cause Analysis',
                path: '/pm/root-cause',
                icon: Search,
              },
              {
                title: 'Test Coverage',
                path: '/pm/test-coverage',
                icon: ShieldCheck,
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
              {
                title: 'Changelog',
                path: '/pm/changelog',
                icon: ScrollText,
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
