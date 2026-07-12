// ─── Project Management — Central Types ──────────────────────────────────────
// NesyArchitectureReport veri modelinden uyarlanan tip tanımları.

// ═══ Ticket ═══════════════════════════════════════════════════════════════════

export type Severity = 'Critical' | 'High' | 'Medium' | 'Low'
export type Status = 'open' | 'closed'
export type RecurrenceRisk = 'high' | 'medium' | 'low'
export type Level = 'high' | 'medium' | 'low'
export type StoryPhase = 'symptom' | 'cause' | 'fix' | 'why' | 'state' | 'todo'

export interface CustomerRef {
  repo: string
  num: string
  url: string
}

export interface LevelAssessment {
  level: Level
  note: string
}

export interface StoryStep {
  k: StoryPhase
  text: string
  confidence?: number
  screenCase?: string
  detectability?: LevelAssessment
  fixability?: LevelAssessment
}

export interface TicketAnalysis {
  report: string
  recurrenceRisk: RecurrenceRisk
  edgeCases: string[]
  story?: StoryStep[]
  location?: string
  rootCause?: string
  pastAttempts?: string
  verdict?: string
  fix?: string
}

export interface TestCase {
  id: string
  title: string
  status: 'passed' | 'failed' | 'pending' | 'skipped'
  type: 'unit' | 'integration' | 'e2e' | 'manual'
  lastRun?: string
}

export interface Ticket {
  id: number
  title: string
  original_title?: string
  type: string
  severity: Severity
  status: Status
  country: string
  date: string
  labels: string[]
  topics: string[]
  summary: string
  customer_refs: CustomerRef[]
  customer_ticket: string
  gh_url: string
  screen: string
  group: string
  analysis?: TicketAnalysis
  testCases?: TestCase[]
}

// ═══ Release ══════════════════════════════════════════════════════════════════

export type ReleaseStatus = 'released' | 'staging' | 'planned' | 'rolled-back'

export type CountryId = 'core' | 'hr' | 'si' | 'rs' | 'ba' | 'me' | 'sk'

export interface Release {
  id: string
  version: string
  codename?: string
  date: string
  status: ReleaseStatus
  countries: CountryId[]
  ticketIds: number[]
  features: string[]
  fixes: string[]
  breakingChanges?: string[]
  notes?: string
}

// ═══ Version ══════════════════════════════════════════════════════════════════

export interface CountryVersion {
  countryId: CountryId
  countryName: string
  production: string
  staging: string
  lastDeployDate: string
  storeUrl?: string
}

export interface VersionEntry {
  version: string
  releaseDate: string
  endOfLife?: string
  ticketsResolved: number
  highlights: string[]
}

// ═══ Sprint / Calendar ═══════════════════════════════════════════════════════

export type SprintStatus = 'completed' | 'active' | 'planned'

export type CalendarEventType = 'release' | 'critical-bug' | 'sprint-start' | 'sprint-end' | 'review' | 'deploy'

export interface CalendarEvent {
  id: string
  date: string
  type: CalendarEventType
  title: string
  description?: string
  sprintId?: string
}

export interface Sprint {
  id: string
  name: string
  startDate: string
  endDate: string
  status: SprintStatus
  goals: string[]
  ticketIds: number[]
}

// ═══ Roadmap ══════════════════════════════════════════════════════════════════

export type RoadmapRiskLevel = 'critical' | 'high' | 'medium' | 'low'
export type EffortSize = 'XS' | 'S' | 'M' | 'L' | 'XL'
export type Priority = 'P0' | 'P1' | 'P2' | 'P3'
export type DeliverableStatus = 'planned' | 'ready' | 'blocked' | 'done'

export interface RoadmapDeliverable {
  title: string
  description: string
  effort: EffortSize
  priority: Priority
  status: DeliverableStatus
}

export interface RoadmapMetric {
  label: string
  current: string
  target: string
}

export interface RoadmapPhase {
  id: string
  phase: number
  title: string
  subtitle: string
  duration: string
  months: string
  riskLevel: RoadmapRiskLevel
  objectives: string[]
  deliverables: RoadmapDeliverable[]
  dependencies: string[]
  metrics: RoadmapMetric[]
  teams: string[]
}

// ═══ Filters ══════════════════════════════════════════════════════════════════

export type FilterKey = 'severity' | 'status' | 'group' | 'type' | 'screen'

export interface Filters {
  severity: Severity | null
  status: Status | null
  group: string | null
  type: string | null
  screen: string | null
}

export const emptyFilters: Filters = {
  severity: null,
  status: null,
  group: null,
  type: null,
  screen: null,
}

export type SortColumn = 'severity' | 'id' | 'title' | 'status' | 'group' | 'type' | 'date' | 'customer'
