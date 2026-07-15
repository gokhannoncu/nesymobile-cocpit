'use client'

import { useMemo } from 'react'
import {
  KanbanSquare,
  Search,
  ShieldCheck,
  Rocket,
  Tag,
  CalendarDays,
  BarChart3,
  PieChartIcon,
  TrendingUp,
  Map,
  Info,
} from 'lucide-react'
import {
  ProductPage,
  HeroCallout,
  PageSection,
  CardGrid,
  InfoCard,
  StatCard,
  StatGrid,
  Callout,
} from '@/components/product'
import { tickets } from '@/data/pm/tickets'
import { releases } from '@/data/pm/releases'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts'

export default function PmOverviewPage() {
  // ═══ Stats ═══════════════════════════════════════════════════════════════
  const totalTickets = tickets.length
  const openIssues = tickets.filter((t) => t.status === 'open').length
  const criticalBugs = tickets.filter((t) => t.severity === 'Critical').length
  const releasedVersions = releases.filter((r) => r.status === 'released').length

  // ═══ Monthly Trend ═════════════════════════════════════════════════════
  const monthlyTrend = useMemo(() => {
    const monthMap: Record<string, { opened: number; closed: number }> = {}

    tickets.forEach((t) => {
      const month = t.date.slice(0, 7) // YYYY-MM
      if (!monthMap[month]) monthMap[month] = { opened: 0, closed: 0 }
      monthMap[month].opened++
      if (t.status === 'closed') monthMap[month].closed++
    })

    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        opened: data.opened,
        closed: data.closed,
      }))
  }, [])

  // ═══ Severity Distribution ═════════════════════════════════════════════
  const severityData = useMemo(() => {
    const counts: Record<string, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 }
    tickets.forEach((t) => {
      counts[t.severity] = (counts[t.severity] || 0) + 1
    })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [])

  const severityColors: Record<string, string> = {
    Critical: '#ef4444',
    High: '#f97316',
    Medium: '#eab308',
    Low: '#22c55e',
  }

  // ═══ Group Distribution ════════════════════════════════════════════════
  const groupData = useMemo(() => {
    const counts: Record<string, number> = {}
    tickets.forEach((t) => {
      counts[t.group] = (counts[t.group] || 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }))
  }, [])

  return (
    <ProductPage path="/pm/overview">
      {/* ─── Hero ──────────────────────────────────────────────────────── */}
      <HeroCallout
        icon={KanbanSquare}
        eyebrow="Project Management"
        tone="purple"
        title="Nesy Mobile — Project Management Cockpit"
        lead="Ticket management, release tracking, version control, and sprint planning from a single panel."
        chips={['Ticket Board', 'Release History', 'Version Tracking']}
      >
        <StatGrid cols={4}>
          <StatCard label="Total Tickets" value={totalTickets} tone="purple" icon={KanbanSquare} />
          <StatCard label="Open Issues" value={openIssues} tone="blue" icon={BarChart3} />
          <StatCard label="Critical Bugs" value={criticalBugs} tone="red" icon={ShieldCheck} />
          <StatCard label="Released Versions" value={releasedVersions} tone="green" icon={Rocket} />
        </StatGrid>
      </HeroCallout>

      {/* ─── Ticket Trend ──────────────────────────────────────────────── */}
      <PageSection
        eyebrow="Trend"
        title="Ticket Trend"
        icon={TrendingUp}
        tone="purple"
      >
        <div className="rounded-xl border p-6 bg-card">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
              <YAxis tick={{ fontSize: 12 }} stroke="currentColor" opacity={0.5} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="opened"
                name="Opened"
                stroke="#a855f7"
                fill="#a855f7"
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="closed"
                name="Closed"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Legend />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </PageSection>

      {/* ─── Severity Distribution ─────────────────────────────────────── */}
      <PageSection
        eyebrow="Distribution"
        title="Severity Distribution"
        icon={PieChartIcon}
        tone="purple"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border p-6 bg-card">
            <h3 className="text-sm font-semibold text-foreground mb-4">Severity Donut</h3>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  paddingAngle={2}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {severityData.map((entry) => (
                    <Cell key={entry.name} fill={severityColors[entry.name] ?? '#6b7280'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="rounded-xl border p-6 bg-card">
            <h3 className="text-sm font-semibold text-foreground mb-4">Group Distribution</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={groupData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.1} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="currentColor" opacity={0.5} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 11 }}
                  stroke="currentColor"
                  opacity={0.5}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="value" name="Ticket" fill="#a855f7" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </PageSection>

      {/* ─── Workspace Map ──────────────────────────────────────────────── */}
      <PageSection
        eyebrow="Navigation"
        title="Workspace Map"
        icon={Map}
        tone="purple"
      >
        <CardGrid cols={3}>
          <InfoCard
            icon={KanbanSquare}
            tone="purple"
            title="Ticket Board"
            desc="Manage all tickets in kanban, table, and analytics views."
            href="/pm/tickets"
          />
          <InfoCard
            icon={Search}
            tone="indigo"
            title="Root Cause Analysis"
            desc="Root cause analysis — inspection by group and risk matrix."
            href="/pm/root-cause"
          />
          <InfoCard
            icon={ShieldCheck}
            tone="green"
            title="Test Coverage"
            desc="Test coverage status and test case tracking."
            href="/pm/test-coverage"
          />
          <InfoCard
            icon={Rocket}
            tone="orange"
            title="Release History"
            desc="All releases, along with feature and fix lists."
            href="/pm/releases"
          />
          <InfoCard
            icon={Tag}
            tone="teal"
            title="Version Tracker"
            desc="Country-based production and staging version tracking."
            href="/pm/versions"
          />
          <InfoCard
            icon={CalendarDays}
            tone="blue"
            title="Sprint Calendar"
            desc="Sprint planning and calendar events."
            href="/pm/calendar"
          />
        </CardGrid>
      </PageSection>

      {/* ─── Callout ───────────────────────────────────────────────────── */}
      <Callout icon={Info} tone="purple">
        Project status at a glance — all ticket, release, and version information is managed
        from this cockpit.
      </Callout>
    </ProductPage>
  )
}
