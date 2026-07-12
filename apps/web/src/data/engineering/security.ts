// Nesy Mobile güvenlik durumu — tek gerçek kaynak.
// Kaynak: repo analizi (NetworkModule, AuthInterceptor, build.gradle, CI) + Mimari Sağlık Taraması API/güvenlik bölümü.

export type SecStatus = 'ok' | 'warn' | 'risk'

export interface SecurityItem {
  area: string
  status: SecStatus
  finding: string
  action?: string
}

export const SECURITY_POSTURE: SecurityItem[] = [
  {
    area: 'TLS / Sertifika',
    status: 'risk',
    finding:
      'TrustAllCerts (her şeyi kabul) ile CertificatePinner aynı anda aktif — pinning etkisiz. Ayrıca pin host’u (www.araskargo.com.tr) gerçek API host’larıyla (nesy-mobile-api.*) eşleşmiyor.',
    action: 'TrustAllCerts kaldırılır; pin gerçek API host’larına taşınır; networkSecurityConfig eklenir.',
  },
  {
    area: 'Token yönetimi',
    status: 'risk',
    finding: 'Refresh token akışı yok — token dolunca 401 + sessiz logout (vardiya ortasında saha krizi, E20). Kuyruktaki offline istekler token’sız kalır.',
    action: 'Refresh akışı + kuyruk için oturum yenileme; kullanıcıya açık uyarı.',
  },
  {
    area: 'Host yönlendirme',
    status: 'risk',
    finding: 'alternativeURL/Port/Http prefs değerleri doğrulanmadan kullanılıyor (HostSelectionInterceptor) — allowlist/format kontrolü yok (E21).',
    action: 'Host allowlist + environment doğrulaması.',
  },
  {
    area: 'Release yapılandırması',
    status: 'risk',
    finding: 'Chucker HTTP inspector releaseImplementation olarak dahil — ağ trafiği inceleme aracı production APK’sında. WebView debug 2 ekranda açık.',
    action: 'Chucker release’ten çıkarılır (no-op varyant); WebView debug kapatılır.',
  },
  {
    area: 'CI/CD sırları',
    status: 'warn',
    finding: 'Workflow’da hardcoded upload anahtarı (GUID); test pipeline’ında curl --insecure.',
    action: 'Anahtar GitHub Secrets’a; --insecure kaldırılır.',
  },
  {
    area: 'Kod sertleştirme',
    status: 'ok',
    finding: 'minifyEnabled + shrinkResources + proguard-android-optimize açık; v1+v2 imza; Crashlytics mapping upload aktif.',
  },
  {
    area: 'Cihaz güvenliği',
    status: 'ok',
    finding: 'RootBeer ile root algılama; JWT decode (auth0); imzalı kritik istekler (X-Protected-Request-Key ile GetMySchedule/DeliverParcels).',
  },
  {
    area: 'Ağ temelleri',
    status: 'ok',
    finding: 'usesCleartextTraffic=false; HTTP body log yalnızca DEBUG’da; keystore repo dışında (local.properties + GPG ile CI’da decrypt).',
  },
]

export const SECURITY_COMMITS = [
  { area: 'Auth & Session', count: 3, examples: 'login block, session validator, token expire' },
  { area: 'SSL/TLS', count: 2, examples: 'ssl trustmanager fix, hardcoded dns temizliği' },
  { area: 'Crash/Null Safety', count: 12, examples: 'NPE düzeltmeleri, top crash, saveinstance' },
  { area: 'Input Validation', count: 3, examples: 'telefon, müşteri barkodu, şifre politikası' },
  { area: 'Data Integrity', count: 2, examples: 'forceLoadedBarcodeList cache, merge stop observe temizliği' },
  { area: 'Cert/Key Mgmt', count: 1, examples: 'public key değişimi, Cpp eklendi' },
]

export const STACK_FACTS = [
  { label: 'compileSdk / targetSdk / minSdk', value: '34 / 34 / 23' },
  { label: 'Kotlin / AGP / Hilt', value: '1.9.23 / 8.3.0 / 2.48' },
  { label: 'Retrofit / OkHttp / Room', value: '2.9.0 / 4.12 / 2.6.1' },
  { label: 'Firebase BOM', value: '32.7.4 (Analytics · FCM · Crashlytics · Perf · Config)' },
  { label: 'ABI', value: 'arm64-v8a · armeabi-v7a (+ native CMake modülü)' },
  { label: 'İzinler', value: 'Manifest’te 26 uses-permission' },
]
