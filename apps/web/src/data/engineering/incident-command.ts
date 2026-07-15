// Incident Command Center — single source of truth.
// Data layer for the Detect → Declare → Contain → Diagnose → Recover → Learn flow.
// Group playbooks and SEV cards come from incidents.ts; this file defines the command layer.

import type { Tone } from '@/components/product'

// ---------------------------------------------------------------------------
// 0. Live incident top bar — demo incident
// ---------------------------------------------------------------------------

export const INCIDENT_STATUSES = [
  'Assessing',
  'Investigating',
  'Cause identified',
  'Mitigation in progress',
  'Monitoring',
  'Resolved',
] as const

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number]

export const LIVE_INCIDENT = {
  id: 'INC-2026-0712-03',
  title: 'Payment completed but delivery not saved',
  status: 'Investigating' as IncidentStatus,
  sev: 'SEV-1',
  startedAt: '10:07',
  elapsed: '00:28:42',
  scope: 'HR + RS · v8.4.60',
  commander: 'M. Kovac',
  lastUpdate: '10:32',
  nextComms: '10:45',
  objective: 'Stop the double-charge risk and extract the list of affected shipments.',
  impact: [
    { label: 'Country', value: '2' },
    { label: 'Courier', value: '34' },
    { label: 'Shipment', value: '87' },
    { label: 'Payment record', value: '12' },
    { label: 'Version', value: '8.4.60' },
  ],
  team: [
    { role: 'IC', name: 'M. Kovac' },
    { role: 'Ops Lead', name: 'A. Yilmaz' },
    { role: 'Comms', name: 'S. Novak' },
    { role: 'Scribe', name: 'D. Horvat' },
    { role: 'SME', name: 'Backend fiscal · Mobile payment' },
  ],
  lastDecision: '10:32 — Payment retry temporarily disabled.',
  nextCheck: '10:45 — Error rate and queue status will be checked.',
  timeline: [
    { time: '10:04', event: 'First operations report' },
    { time: '10:07', event: 'Incident declared' },
    { time: '10:09', event: 'Classified as SEV-1' },
    { time: '10:13', event: 'Double-charge risk confirmed' },
    { time: '10:18', event: 'Retry flow stopped' },
    { time: '10:26', event: 'Affected shipment list extracted' },
  ],
}

// ---------------------------------------------------------------------------
// 1. Is this an incident? — triage questions
// ---------------------------------------------------------------------------

export interface TriageQuestion {
  id: string
  question: string
  options: { label: string; weight: number }[]
}

// weight: 0 = no incident signal, 1 = weak, 2 = strong, 3 = SEV-1 candidate
export const TRIAGE_QUESTIONS: TriageQuestion[] = [
  {
    id: 'ongoing',
    question: 'Is the impact currently ongoing?',
    options: [
      { label: 'Yes, users are still affected', weight: 2 },
      { label: 'No, the event appears to have ended', weight: 0 },
      { label: 'Not sure', weight: 1 },
    ],
  },
  {
    id: 'blocked',
    question: 'Is the workflow blocked?',
    options: [
      { label: 'Deliveries cannot be made', weight: 3 },
      { label: 'Payment/fiscal operations cannot be completed', weight: 3 },
      { label: 'Shipments cannot be saved', weight: 2 },
      { label: 'Application is unusable', weight: 3 },
      { label: 'Workaround available', weight: 1 },
      { label: 'Cosmetic/UI issue only', weight: 0 },
    ],
  },
  {
    id: 'scope',
    question: 'What is the scope of impact?',
    options: [
      { label: 'Single device/user', weight: 0 },
      { label: 'Multiple couriers', weight: 1 },
      { label: 'Single branch/hub', weight: 1 },
      { label: 'Single country', weight: 2 },
      { label: 'Multiple countries', weight: 3 },
      { label: 'Entire field', weight: 3 },
    ],
  },
  {
    id: 'risk',
    question: 'Is there a risk type?',
    options: [
      { label: 'Financial loss', weight: 3 },
      { label: 'Double charge', weight: 3 },
      { label: 'Fiscal record inconsistency', weight: 3 },
      { label: 'Data loss', weight: 3 },
      { label: 'Operations halted', weight: 3 },
      { label: 'Security risk', weight: 3 },
      { label: 'Legal/compliance risk', weight: 2 },
      { label: 'None/unknown', weight: 0 },
    ],
  },
]

// ---------------------------------------------------------------------------
// 2. Has this happened before? — fingerprint signals and match results
// ---------------------------------------------------------------------------

export const FINGERPRINT_SIGNALS = [
  'Error code',
  'Exception / stack trace',
  'Crash fingerprint',
  'Screen',
  'Incident group',
  'Country',
  'App version',
  'Device / scanner model',
  'Shipment ID behavior',
  'API endpoint',
  'Last deploy',
  'Ticket keywords',
]

export interface MatchResult {
  kind: 'open' | 'known' | 'none'
  title: string
  tone: Tone
  example?: string
  detail: string
  shows?: string[]
  actions: string[]
}

export const MATCH_RESULTS: MatchResult[] = [
  {
    kind: 'open',
    title: 'A · Matches an open incident',
    tone: 'red',
    example: '92% match — INC-2026-0712-01 · same error code, same version, same screen',
    detail:
      'No separate resolution effort is started; the new ticket is linked to the existing incident and impact counts are updated.',
    actions: [
      'Link to this incident',
      'Make the new ticket a child/related issue',
      'Add affected user count to the incident',
    ],
  },
  {
    kind: 'known',
    title: 'B · Previously occurred, resolution is known',
    tone: 'amber',
    detail: 'A known issue record is opened; incident assessment continues while the workaround is applied.',
    shows: [
      'Past incident + root cause',
      'Applied workaround and permanent fix',
      'Related playbook',
      'Recurrence conditions',
    ],
    actions: [
      'Apply known workaround',
      'Re-open the incident',
      'Log as new occurrence',
      'Create a similar but separate incident',
    ],
  },
  {
    kind: 'none',
    title: 'C · No match found',
    tone: 'blue',
    detail:
      'The search does not delay incident response — if there is no match, the system continues with the new incident flow.',
    actions: [
      'Create new incident',
      'Save initial fingerprint',
      'Select related group and screen',
      'Create provisional tag for new playbook entry',
    ],
  },
]

export const ROUTING_TREE = `Is there active impact?
├─ No → Normal ticket triage
└─ Yes
   ├─ Same as an open incident?
   │  └─ Yes → Link to existing incident
   └─ No
      ├─ Known issue/playbook available?
      │  ├─ Yes → Workaround + incident assessment
      │  └─ No → Declare new incident
      └─ Financial/fiscal/data loss risk?
         ├─ Yes → SEV-1 assessment
         └─ No → SEV-2/SEV-3 based on impact scope`

// ---------------------------------------------------------------------------
// 3. Severity calculator
// ---------------------------------------------------------------------------

// checked=true → score towards SEV-1. threshold: >=4 SEV-1, >=2 SEV-2, else SEV-3.
export const SEVERITY_QUESTIONS = [
  { id: 'halted', label: 'Has field or critical workflow completely halted?', points: 3 },
  { id: 'fiscal', label: 'Are financial/fiscal operations affected?', points: 3 },
  { id: 'dataloss', label: 'Is there a possibility of data loss or inconsistency?', points: 3 },
  { id: 'retry', label: 'Would retrying the operation increase the damage?', points: 2 },
  { id: 'multi', label: 'Are multiple countries affected?', points: 2 },
  { id: 'many', label: 'Are 10+ couriers/users affected?', points: 1 },
  { id: 'deploy', label: 'Is there a strong correlation with the last deploy?', points: 1 },
  { id: 'noWorkaround', label: 'Is there NO workaround?', points: 2 },
]

export const SEV1_ACTIONS = [
  'Incident Commander is assigned',
  'Incident room is opened',
  'Operations and backend/mobile are called together',
  'Harmful operation is stopped',
  'Regular status communication is started',
]

// ---------------------------------------------------------------------------
// 4. Roles
// ---------------------------------------------------------------------------

export interface IncidentRole {
  role: string
  tone: Tone
  duties: string[]
  antiPattern?: string
}

export const INCIDENT_ROLES: IncidentRole[] = [
  {
    role: 'Incident Commander',
    tone: 'red',
    duties: [
      'Makes overall decisions, sets priorities',
      'Delegates tasks',
      'Ensures the incident progresses toward resolution',
    ],
    antiPattern: 'Should not code/debug alone — coordination and deep debugging should not be combined in one person.',
  },
  {
    role: 'Operations Lead',
    tone: 'orange',
    duties: [
      'Manages the technical investigation',
      'Coordinates mobile, backend, fiscal, and operations specialists',
      'Manages hypotheses and tests',
    ],
  },
  {
    role: 'Communications Lead',
    tone: 'blue',
    duties: [
      'Informs operations, management, support, and customers if needed',
      'Does not speculate on unknown topics',
      'Ensures messages come from a single source',
    ],
  },
  {
    role: 'Scribe / Timeline Owner',
    tone: 'teal',
    duties: [
      'Records decisions made and actions attempted',
      'Creates the incident timeline',
      'Collects data for postmortem',
    ],
  },
]

export const SMALL_INCIDENT_STRUCTURE = `Incident Commander
├─ Operations / Resolver
└─ Scribe + Communications`

// ---------------------------------------------------------------------------
// 5. Impact Snapshot
// ---------------------------------------------------------------------------

export const IMPACT_FIELDS = [
  'First seen time',
  'Last seen time',
  'Affected country',
  'Affected version',
  'Affected device models',
  'Affected scanner type',
  'Affected screen',
  'Number of affected shipments',
  'Number of affected couriers',
  'Failed operation rate',
  'Financial/fiscal impact',
  'Online/offline status',
  'Is there a backend counterpart?',
  'Trend: increasing / stable / decreasing',
]

export const IMPACT_COMPARISONS = [
  'Error rate compared to previous version',
  'Before/after the last deploy',
  'Distribution across countries',
  'Device/scanner distribution',
  'API error rates',
  'Crash-free user change',
  'Offline queue size',
  'Successful and failed event chains',
]

// ---------------------------------------------------------------------------
// 6. First 15-minute protocol — phased checklist
// ---------------------------------------------------------------------------

export interface ProtocolPhase {
  window: string
  title: string
  tone: Tone
  steps: string[]
  warning?: string
}

export const FIRST_15_PROTOCOL: ProtocolPhase[] = [
  {
    window: '0-5 min',
    title: 'Take control',
    tone: 'red',
    steps: [
      'Declare the incident',
      'Determine severity',
      'Assign Incident Commander and resolver',
      'Open incident channel/call',
      'Inform affected operations',
      'Block user actions that could escalate the problem',
    ],
    warning: 'If financial/fiscal risk exists: "Critical warning — do not retry the operation."',
  },
  {
    window: '5-10 min',
    title: 'Contain the impact',
    tone: 'orange',
    steps: [
      'Which countries are affected?',
      'Which versions are affected?',
      'How many couriers and shipments are affected?',
      'Was there a recent deploy or feature flag change?',
      'What is the offline queue status? (Is RequestSenderService locked — E8, is isOfflineMode stuck — E7)',
      'Do backend and mobile records show the same result?',
    ],
  },
  {
    window: '10-15 min',
    title: 'Evidence and mitigation',
    tone: 'amber',
    steps: [
      'Collect device logs',
      'Record Crashlytics event/stack trace',
      'Preserve shipment and transaction IDs',
      'Take a screenshot before clearing state',
      'Decide on rollback / feature flag / workaround',
      'Publish the first incident status update',
    ],
  },
]

export const CHECKLIST_COLUMNS = ['Owner', 'Start', 'End', 'Result', 'Evidence'] as const

// ---------------------------------------------------------------------------
// 8. Evidence Gate
// ---------------------------------------------------------------------------

export const EVIDENCE_ITEMS = [
  'Crashlytics stack trace',
  'Device logcat',
  'Backend request/response logs',
  'Shipment ID · Courier ID',
  'Transaction/fiscal ID',
  'Event ordering',
  'Offline queue records',
  'Room data',
  'SharedPreferences state',
  'App version',
  'Device/scanner model',
  'Network status',
  'Screen recording',
  'Last successful and first failed operation',
]

export const DESTRUCTIVE_ACTIONS = [
  'Restart the application',
  'Clear cache',
  'Log out/log in',
  'Delete data',
  'Reset the queue',
  'Resend the operation',
]

// ---------------------------------------------------------------------------
// 9. Hypothesis and experiment area
// ---------------------------------------------------------------------------

export type HypothesisStatus = 'New' | 'Testing' | 'Strong signal' | 'Confirmed' | 'Eliminated'

export const HYPOTHESIS_STATUS_TONE: Record<HypothesisStatus, Tone> = {
  New: 'gray',
  'Testing': 'blue',
  'Strong signal': 'amber',
  Confirmed: 'green',
  Eliminated: 'gray',
}

export const HYPOTHESES = [
  {
    time: '10:14',
    hypothesis: 'Latest version regression',
    test: 'Try with previous APK',
    owner: 'Mobile',
    result: 'Issue not present in previous version',
    status: 'Strong signal' as HypothesisStatus,
  },
  {
    time: '10:18',
    hypothesis: 'Offline queue locked',
    test: 'Check queue records',
    owner: 'Backend',
    result: '87 records pending',
    status: 'Confirmed' as HypothesisStatus,
  },
  {
    time: '10:24',
    hypothesis: 'Scanner dependent',
    test: 'Compare with camera',
    owner: 'QA',
    result: 'Present in both',
    status: 'Eliminated' as HypothesisStatus,
  },
]

// ---------------------------------------------------------------------------
// 10. Containment / mitigation
// ---------------------------------------------------------------------------

export const MITIGATION_OPTIONS = [
  'Rollback the last deploy',
  'Disable feature flag',
  'Halt the affected country flow',
  'Block specific version',
  'Temporarily restrict the backend endpoint',
  'Stop offline queue consumption',
  'Publish manual operation/workaround',
  'Disable the problematic scanner integration',
  'Send "Do not retry the operation" notification',
  'Redirect to the old stable flow',
]

export const MITIGATION_CARD_FIELDS = [
  'Expected benefit',
  'Risk',
  'Affected users',
  'Rollback method',
  'Implementer / approver',
  'Implementation time · result',
]

// ---------------------------------------------------------------------------
// 11. Communications center
// ---------------------------------------------------------------------------

export const COMMS_AUDIENCES = [
  'Country operations',
  'Mobile team',
  'Backend team',
  'Support',
  'Management',
  'Finance/fiscal owners',
  'Customer / external stakeholder',
]

export const COMMS_TEMPLATE = [
  {
    label: 'What happened?',
    text: 'Some couriers are not getting a delivery record created after payment is completed.',
  },
  {
    label: 'Impact',
    text: 'A portion of users on version 8.4.60 across HR and RS are affected.',
  },
  {
    label: 'What are we doing?',
    text: 'Payment and delivery records are being compared. Retrying operations in the affected flow has been temporarily stopped.',
  },
  {
    label: 'What should the user do?',
    text: 'Do not retry the payment operation for the same shipment.',
  },
  { label: 'Next update', text: 'Next status update: 10:45.' },
]

// ---------------------------------------------------------------------------
// 12. Recovery and validation
// ---------------------------------------------------------------------------

export const EXIT_CRITERIA = [
  'No new errors occurring',
  'Error rate returned to normal levels',
  'Failed queue is decreasing, not completely stuck',
  'Payment and fiscal records are reconciled',
  'Shipment states are validated',
  'Affected country operations gave approval',
  'At least one real/controlled operation completed successfully',
  'No new regression seen after rollback/feature flag change',
  'Designated monitoring period completed',
]

export const STATUS_FLOW = ['Investigating', 'Identified', 'Mitigating', 'Monitoring', 'Resolved']

// ---------------------------------------------------------------------------
// 13. Closing
// ---------------------------------------------------------------------------

export const CLOSING_OPERATIONAL = [
  'Has the impact ended?',
  'Have all affected countries confirmed?',
  'Has the pending queue been processed?',
  'Is financial reconciliation needed?',
  'Was a final notification sent to users?',
  'Is the temporary mitigation still active?',
  'Could the incident recur?',
]

export const CLOSING_TECHNICAL = [
  'Is the root cause known?',
  'If unknown, was a follow-up ticket created?',
  'Was a permanent fix ticket created?',
  'Was test coverage determined?',
  'Was monitoring/alert gap recorded?',
  'Was the related risk map updated?',
]

// ---------------------------------------------------------------------------
// 14. Postmortem
// ---------------------------------------------------------------------------

export const POSTMORTEM_STRUCTURE = [
  'Incident summary',
  'User and business impact',
  'Timeline',
  'Detection method',
  'Root cause',
  'Contributing factors',
  'Why was it not caught earlier?',
  'What worked well?',
  'What did not work well?',
  'Permanent actions',
  'Owner and due dates',
  'Signals to prevent recurrence',
]

export const AUTO_UPDATED_SYSTEMS = [
  'Known Issue library',
  'Reproduce Lab',
  'Risk Map',
  'First check list',
  'Similar ticket matching fingerprint',
  'Monitoring/alert rules',
  'Modernization Plan',
  'Regression test list',
]

// ---------------------------------------------------------------------------
// 7. Screen selector — Diagnosis Workspace
// ---------------------------------------------------------------------------

export const DIAGNOSIS_SCREENS = [
  'Delivery',
  'Delivery Failed',
  'Stop List',
  'Task List',
  'Route Selection',
  'Pick Up',
  'D4Me / Locker',
  'Shipment Tracking',
  'End of Day',
  'Map / Navigation',
  'Login / Settings',
  'Shipment Detail',
]
