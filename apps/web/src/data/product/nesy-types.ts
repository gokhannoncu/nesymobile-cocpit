// Nesy Mobile product type definitions — separated to avoid circular dependency.

export type CountryId = 'core' | 'hr' | 'si' | 'rs' | 'ba' | 'me' | 'sk'

export interface Country {
  id: CountryId
  name: string
  subtitle: string
  price: string
  status: 'Global' | 'Active' | 'Advanced' | 'Limited'
  isPopular?: boolean
}

/* ═══════════════════════════════════════════════════════
 * Flow Diagram types — for visual flow diagrams
 * ═══════════════════════════════════════════════════════ */

export type DiagramNodeVariant =
  | 'start'    // Start — green/teal, play icon
  | 'process'  // Process step — blue, gear icon
  | 'decision' // Decision point — amber, question icon
  | 'end'      // End — green, check icon
  | 'error'    // Error/failed — red, X icon
  | 'external' // External system — purple, link icon

export type DiagramLayerTick = {
  layer: 'UI' | 'App' | 'Local' | 'Remote'
  state: 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'NOT_MEASURED' | 'REQUIRED_PENDING'
  reason?: string
}

export type DiagramElement =
  | {
      type: 'node'
      id?: string
      label: string
      variant: DiagramNodeVariant
      desc?: string
      durationMs?: number
      layers?: DiagramLayerTick[]
    }
  | { type: 'arrow'; label?: string }
  | {
      type: 'branch'
      yes: { label: string; steps: DiagramElement[] }
      no: { label: string; steps: DiagramElement[] }
    }

/* ═══════════════════════════════════════════════════════ */

export interface FeatureDetail {
  /** Detailed description of the feature — "What is it?" */
  whatIs: string
  /** How it works — step-by-step flow */
  howItWorks: string[]
  /** Which screen it runs on — mobile app screen/fragment info */
  screens: string[]
  /** Which parameters/configs it depends on */
  parameters: { name: string; desc: string; type: string }[]
  /** Visual flow diagram — structured as DiagramElement[] */
  diagram?: DiagramElement[]
  /** Tips, tricks, and important points to be aware of */
  tips: string[]
  /** Tickets filed about this feature */
  tickets: { id: string; title: string; status: 'open' | 'closed' | 'in-progress'; url?: string }[]
  /** People with the most know-how about this feature */
  experts: { name: string; role: string }[]
  /** Feature score — bug proneness, boilerplate, error risk */
  score: {
    bugProneness: 1 | 2 | 3 | 4 | 5
    boilerplate: 1 | 2 | 3 | 4 | 5
    complexity: 1 | 2 | 3 | 4 | 5
    testCoverage: 1 | 2 | 3 | 4 | 5
  }
  /** Which API endpoints it uses */
  apis?: { method: string; endpoint: string; desc: string }[]
}

export type FeatureDomainId =
  | 'payments-fiscal'
  | 'delivery-outcomes'
  | 'pickup-operations'
  | 'tour-stops'
  | 'tracking-self-service'

export interface FeatureDomain {
  id: FeatureDomainId
  title: string
  desc: string
}

export interface Feature {
  id: string
  title: string
  desc: string
  /** Capability domain — Feature Library primary grouping axis. */
  domainId: FeatureDomainId
  /** Country-specific behavior — '—' means not yet available, 'N/A' means out of scope, anything else is a description. */
  values: Record<CountryId, string>
  /** Detailed information — displayed in popup */
  detail?: FeatureDetail
}

export interface Module {
  id: string
  title: string
  desc: string
  features: Feature[]
}
