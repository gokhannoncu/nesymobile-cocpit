// Nesy Mobile GitHub pulse verisi — tek gerçek kaynak.
// Kaynak: Git deep analysis (Oca–Haz 2026 vs Tem–Ara 2025) + 1 yıllık git history (1.043 commit).

export const PULSE_PERIOD = 'Ocak – Haziran 2026 (önceki 6 ay ile karşılaştırmalı)'

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
  { label: 'Eklenen satır', value: '123.706', note: '+14% (önceki: 108.200)' },
  { label: 'Silinen satır', value: '14.771', note: '−43% (önceki: 26.070)' },
  { label: 'Net büyüme', value: '+108.935', note: '+33% — kod tabanı hızla büyüyor, silme azalıyor' },
  { label: 'PR sayısı', value: '220', note: '−13% (önceki: 252)' },
  { label: 'Revert', value: '3 (%0.6)', note: '−67% (önceki: 9)' },
  { label: 'Hotfix', value: '0', note: '−100% (önceki: 3)' },
]

export const TEAM_DISTRIBUTION = [
  { name: 'Gökhan Öncü', current: 484, prev: 360, share: '%93.8' },
  { name: 'github-actions[bot]', current: 21, prev: 0, share: '%4.1' },
  { name: 'YgtAlpSyhn', current: 8, prev: 29, share: '%1.6' },
  { name: 'fundahacioglu', current: 3, prev: 84, share: '%0.6' },
  { name: 'ubeniz', current: 0, prev: 20, share: '—' },
  { name: 'Doğukan Öztürk', current: 0, prev: 20, share: '—' },
]

export const HOT_FILES = [
  { name: 'StopListFragment', commits: 153, churn: '11.354 / −2.942' },
  { name: 'TaskListFragment', commits: 137, churn: '10.048 / −2.458' },
  { name: 'DeliveryFragment', commits: 119, churn: '4.303 / −2.279' },
  { name: 'MainActivity', commits: 64, churn: '—' },
  { name: 'DeliveryFailedFragment', commits: 47, churn: '—' },
]

export const PULSE_HEADLINES = [
  { text: 'Bus factor kritik: commit’lerin %94’ü tek geliştiricide.', tone: 'red' as const },
  { text: 'Refactor commit’leri −69% (13 → 4) — teknik borç ödemesi durdu.', tone: 'red' as const },
  { text: 'Test coverage %0 — 140 bug-fix commit’ine karşılık 0 regresyon testi.', tone: 'red' as const },
  { text: 'CI/CD yatırımı +543% ve SonarQube eklendi (pozitif).', tone: 'green' as const },
  { text: 'Revert oranı −67%, hotfix 0 — teslimat disiplini iyileşiyor.', tone: 'green' as const },
  { text: 'Yeni feature −51% — kapasite bakım ve sürüm işlerine kayıyor.', tone: 'amber' as const },
  { text: 'AZ + BG ülke desteği eklendi ancak dallanma deseni değişmedi.', tone: 'amber' as const },
  { text: 'Balkan uygulamaları (HR, RS, BA, ME, SI) tek kod tabanında birleştirildi.', tone: 'blue' as const },
]

export const YEAR_STATS = {
  totalCommits: 1043,
  period: '26 Haz 2025 – 26 Haz 2026',
  busiestMonth: 'Mart 2026 (201 commit)',
  quietestMonth: 'Haziran 2025 (10 commit)',
  weekdays: [
    { day: 'Pzt', commits: 154 },
    { day: 'Sal', commits: 246 },
    { day: 'Çar', commits: 239 },
    { day: 'Per', commits: 176 },
    { day: 'Cum', commits: 157 },
    { day: 'Cmt', commits: 12 },
    { day: 'Paz', commits: 59 },
  ],
}

export const CI_PIPELINES = [
  {
    name: 'Android CI Prod (Multi-Country)',
    file: 'android-prod-all.yml',
    trigger: 'workflow_dispatch (manuel) · target_country: all/hr/si/rs/ba/me',
    detail:
      'version-prod.json ülke sayacı bump → 5 ülke matrix build (assemble<Flavor>Release) → keystore GPG decrypt → APK versiyonlama servisine upload.',
  },
  {
    name: 'Android CI Test (Multi-Country)',
    file: 'android-test-all.yml',
    trigger: 'workflow_dispatch (manuel) · suffix + target_country',
    detail:
      'version.json bump → Tst flavor matrix → google-services.json suffix substitüsyonu → staging’e upload (curl --insecure ile).',
  },
  {
    name: 'SonarQube SAST',
    file: 'sonarqube-sast-env-test.yml',
    trigger: 'push → rel/env-dev',
    detail: 'testTstReleaseUnitTest + assembleTstRelease + sonar-scanner 6.2.1 (app/src/main/java, *.kt/*.java).',
  },
]

export const CI_GAPS = [
  'PR/main push’ta hiçbir otomatik build-test kapısı yok — tüm pipeline’lar manuel dispatch.',
  'SAST yalnızca rel/env-dev branch’ine push’ta çalışıyor.',
  'Test pipeline’ında curl --insecure (TLS doğrulaması kapalı) kullanılıyor.',
  'Workflow dosyasında hardcoded upload anahtarı (GUID) var — secret’a taşınmalı.',
  'Lint (detekt/ktlint) konfigürasyonu ve adımı yok.',
]

export const VERSION_COUNTERS = {
  prod: { hr: 259, si: 173, rs: 67, ba: 28, me: 29 },
  test: { hr: 1183, rs: 191, si: 0, ba: 0, me: 0 },
  note: 'AZ ve BG test flavor’ları mevcut ancak prod flavor/pipeline’ları yok.',
}
