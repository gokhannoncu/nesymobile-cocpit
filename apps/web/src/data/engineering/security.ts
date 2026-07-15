// Nesy Mobile security posture — single source of truth.
// Source: repo analysis (NetworkModule, AuthInterceptor, build.gradle, CI) + Architecture Health Scan API/security section.

export type SecStatus = 'ok' | 'warn' | 'risk'

export interface SecurityItem {
  area: string
  status: SecStatus
  finding: string
  action?: string
}

export const SECURITY_POSTURE: SecurityItem[] = [
  {
    area: 'TLS / Certificate',
    status: 'risk',
    finding:
      'TrustAllCerts (accept-all) and CertificatePinner are active simultaneously — pinning is ineffective. Additionally, the pin host (www.araskargo.com.tr) does not match the actual API hosts (nesy-mobile-api.*).',
    action: 'Remove TrustAllCerts; move pins to actual API hosts; add networkSecurityConfig.',
  },
  {
    area: 'Token management',
    status: 'risk',
    finding: 'No refresh token flow — when the token expires, 401 + silent logout occurs (mid-shift field crisis, E20). Queued offline requests are left without a token.',
    action: 'Refresh flow + session renewal for the queue; explicit warning to the user.',
  },
  {
    area: 'Host routing',
    status: 'risk',
    finding: 'alternativeURL/Port/Http pref values are used without validation (HostSelectionInterceptor) — no allowlist/format check (E21).',
    action: 'Host allowlist + environment validation.',
  },
  {
    area: 'Release configuration',
    status: 'risk',
    finding: 'Chucker HTTP inspector included as releaseImplementation — network traffic inspection tool is in the production APK. WebView debug is open on 2 screens.',
    action: 'Remove Chucker from release (no-op variant); disable WebView debug.',
  },
  {
    area: 'CI/CD secrets',
    status: 'warn',
    finding: 'Hardcoded upload key (GUID) in workflow; curl --insecure in test pipeline.',
    action: 'Move key to GitHub Secrets; remove --insecure.',
  },
  {
    area: 'Code hardening',
    status: 'ok',
    finding: 'minifyEnabled + shrinkResources + proguard-android-optimize enabled; v1+v2 signing; Crashlytics mapping upload active.',
  },
  {
    area: 'Device security',
    status: 'ok',
    finding: 'Root detection via RootBeer; JWT decode (auth0); signed critical requests (GetMySchedule/DeliverParcels with X-Protected-Request-Key).',
  },
  {
    area: 'Network fundamentals',
    status: 'ok',
    finding: 'usesCleartextTraffic=false; HTTP body log only in DEBUG; keystore outside repo (local.properties + GPG decrypt in CI).',
  },
]

export const SECURITY_COMMITS = [
  { area: 'Auth & Session', count: 3, examples: 'login block, session validator, token expire' },
  { area: 'SSL/TLS', count: 2, examples: 'ssl trustmanager fix, hardcoded dns cleanup' },
  { area: 'Crash/Null Safety', count: 12, examples: 'NPE fixes, top crash, saveinstance' },
  { area: 'Input Validation', count: 3, examples: 'phone, customer barcode, password policy' },
  { area: 'Data Integrity', count: 2, examples: 'forceLoadedBarcodeList cache, merge stop observe cleanup' },
  { area: 'Cert/Key Mgmt', count: 1, examples: 'public key change, Cpp added' },
]

export const STACK_FACTS = [
  { label: 'compileSdk / targetSdk / minSdk', value: '34 / 34 / 23' },
  { label: 'Kotlin / AGP / Hilt', value: '1.9.23 / 8.3.0 / 2.48' },
  { label: 'Retrofit / OkHttp / Room', value: '2.9.0 / 4.12 / 2.6.1' },
  { label: 'Firebase BOM', value: '32.7.4 (Analytics - FCM - Crashlytics - Perf - Config)' },
  { label: 'ABI', value: 'arm64-v8a - armeabi-v7a (+ native CMake module)' },
  { label: 'Permissions', value: '26 uses-permission in Manifest' },
]
