// Nesy Mobile GitHub pulse data — single source of truth.
// Source: Git deep analysis (Jan-Jun 2026 vs Jul-Dec 2025) + 1 year git history (1,043 commits).

export const PULSE_PERIOD = 'January - June 2026 (comparative with prior 6 months)'

export const COMMIT_PURPOSE = [
  { label: 'Bug Fix', current: 140, prev: 141, delta: '−1%' },
  { label: 'Version/Dependency', current: 107, prev: 28, delta: '+282%' },
  { label: 'Build/CI-CD', current: 45, prev: 7, delta: '+543%' },
  { label: 'UI/UX', current: 23, prev: 16, delta: '+44%' },
  { label: 'New Feature', current: 19, prev: 39, delta: '−51%' },
  { label: 'Logging/Analytics', current: 15, prev: 6, delta: '+150%' },
  { label: 'Security', current: 6, prev: 3, delta: '+100%' },
  { label: 'Performance', current: 6, prev: 2, delta: '+200%' },
  { label: 'Refactor', current: 4, prev: 13, delta: '−69%' },
]

export const CODE_HEALTH = [
  { label: 'Lines added', value: '123,706', note: '+14% (previous: 108,200)' },
  { label: 'Lines deleted', value: '14,771', note: '−43% (previous: 26,070)' },
  { label: 'Net growth', value: '+108,935', note: '+33% — codebase growing rapidly, deletions declining' },
  { label: 'PR count', value: '220', note: '−13% (previous: 252)' },
  { label: 'Revert', value: '3 (0.6%)', note: '−67% (previous: 9)' },
  { label: 'Hotfix', value: '0', note: '−100% (previous: 3)' },
]

export const TEAM_DISTRIBUTION = [
  { name: 'Gokhan Oncu', current: 484, prev: 360, share: '93.8%' },
  { name: 'github-actions[bot]', current: 21, prev: 0, share: '4.1%' },
  { name: 'YgtAlpSyhn', current: 8, prev: 29, share: '1.6%' },
  { name: 'fundahacioglu', current: 3, prev: 84, share: '0.6%' },
  { name: 'ubeniz', current: 0, prev: 20, share: '—' },
  { name: 'Dogukan Ozturk', current: 0, prev: 20, share: '—' },
]

export const HOT_FILES = [
  { name: 'StopListFragment', commits: 153, churn: '11,354 / −2,942' },
  { name: 'TaskListFragment', commits: 137, churn: '10,048 / −2,458' },
  { name: 'DeliveryFragment', commits: 119, churn: '4,303 / −2,279' },
  { name: 'MainActivity', commits: 64, churn: '—' },
  { name: 'DeliveryFailedFragment', commits: 47, churn: '—' },
]

export const PULSE_HEADLINES = [
  { text: 'Bus factor critical: 94% of commits from a single developer.', tone: 'red' as const },
  { text: 'Refactor commits −69% (13 to 4) — technical debt paydown has stopped.', tone: 'red' as const },
  { text: 'Test coverage 0% — 0 regression tests against 140 bug-fix commits.', tone: 'red' as const },
  { text: 'CI/CD investment +543% and SonarQube added (positive).', tone: 'green' as const },
  { text: 'Revert rate −67%, hotfix 0 — delivery discipline is improving.', tone: 'green' as const },
  { text: 'New feature −51% — capacity is shifting to maintenance and release tasks.', tone: 'amber' as const },
  { text: 'AZ + BG country support added but branching pattern unchanged.', tone: 'amber' as const },
  { text: 'Balkan applications (HR, RS, BA, ME, SI) consolidated into a single codebase.', tone: 'blue' as const },
]

export const YEAR_STATS = {
  totalCommits: 1043,
  period: '26 Jun 2025 - 26 Jun 2026',
  busiestMonth: 'March 2026 (201 commits)',
  quietestMonth: 'June 2025 (10 commits)',
  weekdays: [
    { day: 'Mon', commits: 154 },
    { day: 'Tue', commits: 246 },
    { day: 'Wed', commits: 239 },
    { day: 'Thu', commits: 176 },
    { day: 'Fri', commits: 157 },
    { day: 'Sat', commits: 12 },
    { day: 'Sun', commits: 59 },
  ],
}

export const CI_PIPELINES = [
  {
    name: 'Android CI Prod (Multi-Country)',
    file: 'android-prod-all.yml',
    trigger: 'workflow_dispatch (manual) - target_country: all/hr/si/rs/ba/me',
    detail:
      'version-prod.json country counter bump -> 5 country matrix build (assemble<Flavor>Release) -> keystore GPG decrypt -> APK upload to versioning service.',
  },
  {
    name: 'Android CI Test (Multi-Country)',
    file: 'android-test-all.yml',
    trigger: 'workflow_dispatch (manual) - suffix + target_country',
    detail:
      'version.json bump -> Tst flavor matrix -> google-services.json suffix substitution -> upload to staging (with curl --insecure).',
  },
  {
    name: 'SonarQube SAST',
    file: 'sonarqube-sast-env-test.yml',
    trigger: 'push -> rel/env-dev',
    detail: 'testTstReleaseUnitTest + assembleTstRelease + sonar-scanner 6.2.1 (app/src/main/java, *.kt/*.java).',
  },
]

export const CI_GAPS = [
  'No automatic build-test gate on PR/main push — all pipelines are manual dispatch.',
  'SAST runs only on push to rel/env-dev branch.',
  'Test pipeline uses curl --insecure (TLS verification disabled).',
  'Workflow file contains a hardcoded upload key (GUID) — should be moved to secrets.',
  'No lint (detekt/ktlint) configuration or step.',
]

export const VERSION_COUNTERS = {
  prod: { hr: 259, si: 173, rs: 67, ba: 28, me: 29 },
  test: { hr: 1183, rs: 191, si: 0, ba: 0, me: 0 },
  note: 'AZ and BG test flavors exist but prod flavors/pipelines are missing.',
}
