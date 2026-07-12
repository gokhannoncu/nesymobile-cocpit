import { MenuConfig, Workspace } from '@nesy/metronic/config/types'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bolt,
  BookOpen,
  Bug,
  Calendar,
  CalendarDays,
  CircleHelp,
  Compass,
  Cpu,
  Database,
  FileText,
  Flag,
  FlaskConical,
  Gauge,
  GitBranch,
  Globe,
  Grid3x3,
  History,
  Home,
  KanbanSquare,
  Layers,
  LayoutDashboard,
  Lightbulb,
  LineChart,
  ListTodo,
  Map,
  MapPin,
  MessageSquare,
  Network,
  Package,
  Radar,
  Rocket,
  Route,
  Scale,
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
  TrendingUp,
  UserRound,
  Users,
  Zap,
} from 'lucide-react'

// Cockpit navigasyonunun tek gerçek kaynağı.
// Sol ikon rayı (SidebarPrimary), ikincil menü (SidebarPrimaryMenu) ve
// (cockpit)/[...slug] placeholder sayfaları buradan türetilir.
// Yeni bir workspace eklemek için bu diziye yeni bir kayıt ekleyin;
// path'i olan her menü öğesi otomatik olarak placeholder sayfası alır.
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
    path: '/product/overview',
    basePaths: ['/product'],
    menu: [
      {
        title: 'Product',
        children: [
          {
            title: 'Overview',
            path: '/product/overview',
            icon: LayoutDashboard,
          },
          {
            title: 'Product Foundation',
            icon: Layers,
            children: [
              {
                title: 'Problem Space',
                path: '/product/problem-space',
                icon: CircleHelp,
              },
              {
                title: 'Solution Overview',
                path: '/product/solution-overview',
                icon: Lightbulb,
              },
              {
                title: 'Product Principles',
                path: '/product/product-principles',
                icon: Compass,
              },
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
                title: 'Who We Serve',
                path: '/product/who-we-serve',
                icon: UserRound,
              },
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
          {
            title: 'Strategy & Scope',
            icon: Target,
            children: [
              {
                title: 'Product Roadmap',
                path: '/product/product-roadmap',
                icon: Map,
              },
              {
                title: 'Product Requirements',
                path: '/product/product-requirements',
                icon: FileText,
              },
              {
                title: 'Product Metrics',
                path: '/product/product-metrics',
                icon: LineChart,
              },
            ],
          },
          {
            title: 'Discovery & Learning',
            icon: Search,
            children: [
              {
                title: 'User Research & Insights',
                path: '/product/user-research-and-insights',
                icon: Search,
              },
              {
                title: 'Experiments',
                path: '/product/experiments',
                icon: FlaskConical,
              },
              {
                title: 'Feedback Repository',
                path: '/product/feedback-repository',
                icon: MessageSquare,
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
            title: 'Mobile Knowledge Hub',
            icon: BookOpen,
            children: [
              {
                title: 'Hub Overview',
                path: '/engineering/mobile-knowledge',
                icon: LayoutDashboard,
              },
              {
                title: 'Backend Handbook',
                path: '/engineering/mobile-knowledge/backend',
                icon: Network,
              },
              {
                title: 'Screen Manual',
                path: '/engineering/mobile-knowledge/screens',
                icon: Smartphone,
              },
            ],
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
    id: 'business',
    label: 'Business & Growth',
    icon: TrendingUp,
    className: 'border-white bg-emerald-500 hover:bg-emerald-600 text-white hover:text-white',
    path: '/business/overview',
    basePaths: ['/business'],
    menu: [
      {
        title: 'Business & Growth',
        children: [
          {
            title: 'Overview',
            path: '/business/overview',
            icon: LayoutDashboard,
          },
          {
            title: 'Strategy',
            icon: Target,
            children: [
              {
                title: 'Business Model',
                path: '/business/business-model',
                icon: BookOpen,
              },
              {
                title: 'Metrics & KPIs',
                path: '/business/metrics-and-kpis',
                icon: BarChart3,
              },
              {
                title: 'Go-To-Market',
                path: '/business/go-to-market',
                icon: Route,
              },
            ],
          },
          {
            title: 'Governance',
            icon: Scale,
            children: [
              {
                title: 'Decision Log',
                path: '/business/decision-log',
                icon: ScrollText,
              },
              {
                title: 'Risk Register',
                path: '/business/risk-register',
                icon: AlertTriangle,
              },
            ],
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
    title: 'Kaynaklar',
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
