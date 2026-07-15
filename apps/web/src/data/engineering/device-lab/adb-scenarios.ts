// ============================================================================
// Device Lab – ADB Scenarios Data & Helpers
// ============================================================================

import type {
  ScenarioPackage,
  ScenarioCategory,
  ExecutionRecord,
  PreflightCheck,
  CategoryInfo,
} from './device-lab-types'

// ---------------------------------------------------------------------------
// 1. SCENARIO CATEGORIES
// ---------------------------------------------------------------------------

export const SCENARIO_CATEGORIES: CategoryInfo[] = [
  {
    id: 'schedule',
    label: 'Zamanlama',
    description: 'Sipariş zamanlaması ve teslimat planı ile ilgili senaryolar',
    icon: '📅',
    scenarioCount: 3,
  },
  {
    id: 'auth',
    label: 'Kimlik Doğrulama',
    description: 'Oturum yönetimi, token ve login senaryoları',
    icon: '🔐',
    scenarioCount: 2,
  },
  {
    id: 'shared-prefs',
    label: 'SharedPreferences',
    description: 'Uygulama tercih ve ayar dosyası değişiklikleri',
    icon: '⚙️',
    scenarioCount: 3,
  },
  {
    id: 'room-db',
    label: 'Room Database',
    description: 'Yerel veritabanı sorgulama ve manipülasyon',
    icon: '🗄️',
    scenarioCount: 2,
  },
  {
    id: 'offline-sync',
    label: 'Offline & Sync',
    description: 'Çevrimdışı kuyruk ve senkronizasyon test senaryoları',
    icon: '📡',
    scenarioCount: 2,
  },
  {
    id: 'lifecycle',
    label: 'Yaşam Döngüsü',
    description: 'Uygulama başlatma, durdurma ve temizleme senaryoları',
    icon: '🔄',
    scenarioCount: 2,
  },
  {
    id: 'permission',
    label: 'İzinler',
    description: 'Android çalışma zamanı izin yönetimi',
    icon: '🛡️',
    scenarioCount: 2,
  },
  {
    id: 'diagnostic',
    label: 'Tanılama',
    description: 'Cihaz bilgisi, performans ve hata ayıklama senaryoları',
    icon: '🔍',
    scenarioCount: 2,
  },
]

// ---------------------------------------------------------------------------
// 2. PREFLIGHT CHECKS
// ---------------------------------------------------------------------------

export const PREFLIGHT_CHECKS: PreflightCheck[] = [
  {
    id: 'device-connected',
    label: 'Cihaz bağlı ve ADB erişimi mevcut',
    description: 'USB veya WiFi üzerinden ADB bağlantısının doğrulanması',
    required: true,
  },
  {
    id: 'app-installed',
    label: 'NesyMobile uygulaması yüklü',
    description: 'Hedef paket adı cihazda mevcut olmalı',
    required: true,
  },
  {
    id: 'debuggable',
    label: 'Debug build yüklü (debuggable flag aktif)',
    description: 'Run-as komutu için debug build gerekli',
    required: false,
  },
  {
    id: 'battery-ok',
    label: 'Batarya seviyesi yeterli (>%20)',
    description: 'Uzun işlemler için minimum batarya seviyesi',
    required: false,
  },
  {
    id: 'no-active-run',
    label: 'Devam eden başka bir senaryo yok',
    description: 'Çakışma önleme — tek seferlik çalıştırma',
    required: true,
  },
]

// ---------------------------------------------------------------------------
// 3. QUICK VIEW FILTERS
// ---------------------------------------------------------------------------

export const QUICK_VIEW_FILTERS = [
  { key: 'all', label: 'Tümü', icon: '📋' },
  { key: 'frequently-used', label: 'Sık Kullanılan', icon: '🔥' },
  { key: 'safe', label: 'Güvenli', icon: '🛡️' },
  { key: 'data-manipulation', label: 'Veri İşleme', icon: '📊' },
  { key: 'favorites', label: 'Favoriler', icon: '⭐' },
  { key: 'debug-only', label: 'Debug Only', icon: '🐛' },
] as const

// ---------------------------------------------------------------------------
// 4. SCENARIO PACKAGES
// ---------------------------------------------------------------------------

export const SCENARIO_PACKAGES: ScenarioPackage[] = [
  // ── Schedule ──
  {
    id: 'scn-override-delivery-date',
    name: 'Teslimat Tarihi Override',
    description: 'Seçili siparişin teslimat tarihini belirtilen tarihe günceller. SharedPreferences üzerinden delivery_date alanını değiştirir.',
    category: 'schedule',
    riskLevel: 'caution',
    buildCompatibility: 'debug',
    deviceRequirement: 'any',
    requiresRoot: false,
    supportedPackages: ['com.nesy.mobile', 'com.nesy.mobile.debug'],
    supportedAndroidVersions: '>=10',
    parameters: [
      { key: 'orderId', label: 'Sipariş No', type: 'text', required: true, defaultValue: '', hint: 'Örn: ORD-2026-0001' },
      { key: 'newDate', label: 'Yeni Tarih', type: 'date', required: true, defaultValue: '2026-07-15' },
      { key: 'notifyUser', label: 'Kullanıcıyı Bilgilendir', type: 'boolean', required: false, defaultValue: true },
    ],
    preflightChecks: ['device-connected', 'app-installed', 'debuggable'],
    commands: [
      { step: 1, label: 'Mevcut tarih yedekleme', command: 'adb -s {serial} shell run-as com.nesy.mobile cat shared_prefs/delivery_schedule.xml', description: 'Mevcut teslimat takvimi yedeklenir' },
      { step: 2, label: 'Tarih güncelleme', command: 'adb -s {serial} shell run-as com.nesy.mobile sed -i \'s/delivery_date="[^"]*"/delivery_date="{newDate}"/\' shared_prefs/delivery_schedule.xml', description: 'Teslimat tarihi güncellenir' },
      { step: 3, label: 'Uygulama yeniden başlatma', command: 'adb -s {serial} shell am force-stop com.nesy.mobile && adb -s {serial} shell am start -n com.nesy.mobile/.MainActivity', description: 'Değişikliklerin yansıması için uygulama yeniden başlatılır' },
    ],
    verificationSteps: [
      { step: 1, label: 'Yeni tarih kontrolü', description: 'SharedPreferences dosyasında delivery_date değerinin güncellendiği doğrulanır', query: 'adb -s {serial} shell run-as com.nesy.mobile cat shared_prefs/delivery_schedule.xml | grep delivery_date' },
      { step: 2, label: 'UI doğrulaması', description: 'Sipariş detay ekranında yeni tarihin gösterildiği kontrol edilir' },
    ],
    rollbackSteps: [
      { label: 'Eski tarih geri yükleme', command: 'adb -s {serial} shell run-as com.nesy.mobile sed -i \'s/delivery_date="{newDate}"/delivery_date="{originalDate}"/\' shared_prefs/delivery_schedule.xml', description: 'Yedeklenen orijinal tarih geri yüklenir' },
    ],
    estimatedDuration: 8,
    lastVerifiedVersion: '4.12.1',
    lastVerifiedAt: '2026-07-10',
    owner: 'Gökhan Öncü',
    reviewer: 'Ali Yılmaz',
    version: '1.3.0',
    isFavorite: true,
    executionCount: 47,
    tags: ['schedule', 'shared-prefs', 'delivery'],
  },
  {
    id: 'scn-simulate-route-delay',
    name: 'Rota Gecikme Simülasyonu',
    description: 'Cihazın konum verilerini geçici olarak geciktirir ve rota hesaplama davranışını test eder.',
    category: 'schedule',
    riskLevel: 'safe',
    buildCompatibility: 'debug',
    deviceRequirement: 'any',
    requiresRoot: false,
    supportedPackages: ['com.nesy.mobile', 'com.nesy.mobile.debug'],
    supportedAndroidVersions: '>=10',
    parameters: [
      { key: 'delayMs', label: 'Gecikme (ms)', type: 'number', required: true, defaultValue: 5000, hint: '1000-30000 arası' },
      { key: 'routeId', label: 'Rota ID', type: 'text', required: false, defaultValue: '', hint: 'Boş bırakılırsa aktif rota' },
    ],
    preflightChecks: ['device-connected', 'app-installed', 'debuggable'],
    commands: [
      { step: 1, label: 'Debug flag aktifleştirme', command: 'adb -s {serial} shell run-as com.nesy.mobile am broadcast -a com.nesy.mobile.DEBUG_ROUTE_DELAY --ei delay_ms {delayMs}', description: 'Route delay debug broadcast gönderilir' },
      { step: 2, label: 'Konum sağlayıcı kontrol', command: 'adb -s {serial} shell dumpsys location | grep "com.nesy"', description: 'Konum sağlayıcı durumu kontrol edilir' },
    ],
    verificationSteps: [
      { step: 1, label: 'Logcat kontrol', description: 'RouteCalculator loglarında gecikme değerinin uygulandığı doğrulanır', query: 'adb -s {serial} logcat -d -s RouteCalculator | tail -5' },
    ],
    rollbackSteps: [
      { label: 'Gecikme kaldır', command: 'adb -s {serial} shell run-as com.nesy.mobile am broadcast -a com.nesy.mobile.DEBUG_ROUTE_DELAY --ei delay_ms 0', description: 'Gecikme sıfırlanır' },
    ],
    estimatedDuration: 4,
    lastVerifiedVersion: '4.12.1',
    lastVerifiedAt: '2026-07-09',
    owner: 'Gökhan Öncü',
    reviewer: 'Mehmet Demir',
    version: '1.0.0',
    isFavorite: false,
    executionCount: 12,
    tags: ['schedule', 'location', 'simulation'],
  },
  {
    id: 'scn-force-schedule-sync',
    name: 'Zorla Zamanlama Senkronizasyonu',
    description: 'Cihazın sunucu ile zamanlama verilerini hemen senkronize etmesini tetikler.',
    category: 'schedule',
    riskLevel: 'safe',
    buildCompatibility: 'any',
    deviceRequirement: 'any',
    requiresRoot: false,
    supportedPackages: ['com.nesy.mobile', 'com.nesy.mobile.debug'],
    supportedAndroidVersions: '>=10',
    parameters: [
      { key: 'clearQueue', label: 'Kuyruğu Temizle', type: 'boolean', required: false, defaultValue: false },
    ],
    preflightChecks: ['device-connected', 'app-installed'],
    commands: [
      { step: 1, label: 'Senkronizasyon tetikleme', command: 'adb -s {serial} shell am broadcast -a com.nesy.mobile.FORCE_SCHEDULE_SYNC', description: 'Zamanlama senkronizasyonu broadcast ile tetiklenir' },
    ],
    verificationSteps: [
      { step: 1, label: 'Sync durumu kontrol', description: 'Senkronizasyonun başarıyla tamamlandığı loglardan doğrulanır', query: 'adb -s {serial} logcat -d -s ScheduleSync | tail -3' },
    ],
    rollbackSteps: [
      { label: 'Geri alma gerekli değil', command: '# N/A', description: 'Bu işlem geri alınamaz ancak zararsızdır' },
    ],
    estimatedDuration: 3,
    lastVerifiedVersion: '4.12.0',
    lastVerifiedAt: '2026-07-08',
    owner: 'Ali Yılmaz',
    reviewer: 'Gökhan Öncü',
    version: '1.1.0',
    isFavorite: true,
    executionCount: 89,
    tags: ['schedule', 'sync', 'workmanager'],
  },

  // ── Auth ──
  {
    id: 'scn-invalidate-session',
    name: 'Oturum Geçersiz Kılma',
    description: 'Mevcut kullanıcı oturumunu geçersiz kılar ve yeniden giriş yapılmasını zorunlu kılar.',
    category: 'auth',
    riskLevel: 'caution',
    buildCompatibility: 'debug',
    deviceRequirement: 'any',
    requiresRoot: false,
    supportedPackages: ['com.nesy.mobile', 'com.nesy.mobile.debug'],
    supportedAndroidVersions: '>=10',
    parameters: [
      { key: 'clearTokens', label: "Token'ları Temizle", type: 'boolean', required: false, defaultValue: true },
      { key: 'clearCookies', label: "Cookie'leri Temizle", type: 'boolean', required: false, defaultValue: false },
    ],
    preflightChecks: ['device-connected', 'app-installed', 'debuggable'],
    commands: [
      { step: 1, label: 'Token yedekleme', command: 'adb -s {serial} shell run-as com.nesy.mobile cat shared_prefs/auth_tokens.xml', description: 'Mevcut tokenlar yedeklenir' },
      { step: 2, label: 'Token temizleme', command: 'adb -s {serial} shell run-as com.nesy.mobile rm shared_prefs/auth_tokens.xml', description: 'Auth token dosyası silinir' },
      { step: 3, label: 'Session cache temizleme', command: 'adb -s {serial} shell run-as com.nesy.mobile rm -rf cache/session/', description: 'Session cache dizini temizlenir' },
      { step: 4, label: 'Uygulamayı yeniden başlat', command: 'adb -s {serial} shell am force-stop com.nesy.mobile && adb -s {serial} shell am start -n com.nesy.mobile/.MainActivity', description: 'Uygulama login ekranına düşmesi için yeniden başlatılır' },
    ],
    verificationSteps: [
      { step: 1, label: 'Login ekranı kontrolü', description: 'Uygulama login ekranına yönlendirildiği doğrulanır' },
      { step: 2, label: 'Token dosyası yokluğu', description: 'auth_tokens.xml dosyasının silindiği kontrol edilir', query: 'adb -s {serial} shell run-as com.nesy.mobile ls shared_prefs/ | grep auth' },
    ],
    rollbackSteps: [
      { label: 'Token geri yükleme', command: 'adb -s {serial} shell run-as com.nesy.mobile cp /sdcard/nesy_backup/auth_tokens.xml shared_prefs/', description: 'Yedeklenen tokenlar geri yüklenir' },
    ],
    estimatedDuration: 6,
    lastVerifiedVersion: '4.12.1',
    lastVerifiedAt: '2026-07-11',
    owner: 'Mehmet Demir',
    reviewer: 'Gökhan Öncü',
    version: '2.0.0',
    isFavorite: true,
    executionCount: 63,
    tags: ['auth', 'session', 'token'],
  },
  {
    id: 'scn-inject-test-token',
    name: 'Test Token Enjeksiyonu',
    description: 'Belirli bir kullanıcı rolü ile test tokenı enjekte eder.',
    category: 'auth',
    riskLevel: 'caution',
    buildCompatibility: 'debug',
    deviceRequirement: 'any',
    requiresRoot: false,
    supportedPackages: ['com.nesy.mobile.debug'],
    supportedAndroidVersions: '>=10',
    parameters: [
      { key: 'userRole', label: 'Kullanıcı Rolü', type: 'select', required: true, defaultValue: 'driver', options: [
        { label: 'Sürücü', value: 'driver' },
        { label: 'Depo Görevlisi', value: 'warehouse' },
        { label: 'Süpervizör', value: 'supervisor' },
        { label: 'Admin', value: 'admin' },
      ] },
      { key: 'expiresIn', label: 'Süre (saat)', type: 'number', required: false, defaultValue: 24 },
    ],
    preflightChecks: ['device-connected', 'app-installed', 'debuggable'],
    commands: [
      { step: 1, label: 'Mevcut oturum temizleme', command: 'adb -s {serial} shell run-as com.nesy.mobile.debug am broadcast -a com.nesy.mobile.CLEAR_SESSION', description: 'Mevcut oturum temizlenir' },
      { step: 2, label: 'Test token enjeksiyonu', command: 'adb -s {serial} shell run-as com.nesy.mobile.debug am broadcast -a com.nesy.mobile.INJECT_TEST_TOKEN --es role "{userRole}" --ei expires_hours {expiresIn}', description: 'Test token enjekte edilir' },
    ],
    verificationSteps: [
      { step: 1, label: 'Token doğrulama', description: 'Enjekte edilen tokenın geçerli olduğu doğrulanır', query: 'adb -s {serial} logcat -d -s AuthManager | tail -3' },
    ],
    rollbackSteps: [
      { label: 'Test token kaldır', command: 'adb -s {serial} shell run-as com.nesy.mobile.debug am broadcast -a com.nesy.mobile.CLEAR_SESSION', description: 'Test token temizlenir' },
    ],
    estimatedDuration: 5,
    lastVerifiedVersion: '4.12.1',
    lastVerifiedAt: '2026-07-10',
    owner: 'Ali Yılmaz',
    reviewer: 'Mehmet Demir',
    version: '1.2.0',
    isFavorite: false,
    executionCount: 28,
    tags: ['auth', 'token', 'test', 'role'],
  },

  // ── SharedPreferences ──
  {
    id: 'scn-toggle-feature-flag',
    name: 'Feature Flag Değiştir',
    description: 'Belirli bir feature flag değerini SharedPreferences üzerinden değiştirir.',
    category: 'shared-prefs',
    riskLevel: 'safe',
    buildCompatibility: 'debug',
    deviceRequirement: 'any',
    requiresRoot: false,
    supportedPackages: ['com.nesy.mobile', 'com.nesy.mobile.debug'],
    supportedAndroidVersions: '>=10',
    parameters: [
      { key: 'flagName', label: 'Flag Adı', type: 'select', required: true, defaultValue: 'new_scanner_ui', options: [
        { label: 'Yeni Tarayıcı UI', value: 'new_scanner_ui' },
        { label: 'Offline Mod v2', value: 'offline_mode_v2' },
        { label: 'Rota Optimizasyonu', value: 'route_optimization' },
        { label: 'Anlık Bildirimler', value: 'real_time_notifications' },
        { label: 'Dark Mode', value: 'dark_mode' },
      ] },
      { key: 'enabled', label: 'Aktif', type: 'boolean', required: true, defaultValue: true },
    ],
    preflightChecks: ['device-connected', 'app-installed', 'debuggable'],
    commands: [
      { step: 1, label: 'Mevcut flag değeri yedekleme', command: 'adb -s {serial} shell run-as com.nesy.mobile cat shared_prefs/feature_flags.xml | grep "{flagName}"', description: 'Mevcut flag değeri kaydedilir' },
      { step: 2, label: 'Flag değeri güncelleme', command: 'adb -s {serial} shell run-as com.nesy.mobile am broadcast -a com.nesy.mobile.SET_FEATURE_FLAG --es flag "{flagName}" --ez enabled {enabled}', description: 'Flag değeri güncellenir' },
    ],
    verificationSteps: [
      { step: 1, label: 'Flag doğrulama', description: 'Yeni flag değerinin uygulandığı kontrol edilir', query: 'adb -s {serial} shell run-as com.nesy.mobile cat shared_prefs/feature_flags.xml | grep "{flagName}"' },
    ],
    rollbackSteps: [
      { label: 'Flag eski değerine döndür', command: 'adb -s {serial} shell run-as com.nesy.mobile am broadcast -a com.nesy.mobile.SET_FEATURE_FLAG --es flag "{flagName}" --ez enabled false', description: 'Flag eski değerine döndürülür' },
    ],
    estimatedDuration: 3,
    lastVerifiedVersion: '4.12.1',
    lastVerifiedAt: '2026-07-11',
    owner: 'Gökhan Öncü',
    reviewer: 'Ali Yılmaz',
    version: '1.4.0',
    isFavorite: true,
    executionCount: 104,
    tags: ['shared-prefs', 'feature-flag', 'config'],
  },
  {
    id: 'scn-change-api-endpoint',
    name: 'API Endpoint Değiştir',
    description: 'Uygulamanın bağlandığı backend API endpoint adresini değiştirir.',
    category: 'shared-prefs',
    riskLevel: 'caution',
    buildCompatibility: 'debug',
    deviceRequirement: 'any',
    requiresRoot: false,
    supportedPackages: ['com.nesy.mobile.debug'],
    supportedAndroidVersions: '>=10',
    parameters: [
      { key: 'environment', label: 'Ortam', type: 'select', required: true, defaultValue: 'staging', options: [
        { label: 'Production', value: 'https://api.nesy.com' },
        { label: 'Staging', value: 'https://staging-api.nesy.com' },
        { label: 'Development', value: 'https://dev-api.nesy.com' },
        { label: 'Lokal', value: 'http://10.0.2.2:8080' },
      ] },
    ],
    preflightChecks: ['device-connected', 'app-installed', 'debuggable'],
    commands: [
      { step: 1, label: 'Mevcut endpoint yedekleme', command: 'adb -s {serial} shell run-as com.nesy.mobile.debug cat shared_prefs/network_config.xml | grep "base_url"', description: 'Mevcut API URL yedeklenir' },
      { step: 2, label: 'Endpoint güncelleme', command: 'adb -s {serial} shell run-as com.nesy.mobile.debug am broadcast -a com.nesy.mobile.SET_API_URL --es url "{environment}"', description: 'API endpoint değiştirilir' },
      { step: 3, label: 'Uygulama yeniden başlatma', command: 'adb -s {serial} shell am force-stop com.nesy.mobile.debug && adb -s {serial} shell am start -n com.nesy.mobile.debug/.MainActivity', description: 'Yeni endpoint ile uygulama başlatılır' },
    ],
    verificationSteps: [
      { step: 1, label: 'Endpoint kontrolü', description: 'Yeni URL nin uygulandığı doğrulanır', query: 'adb -s {serial} shell run-as com.nesy.mobile.debug cat shared_prefs/network_config.xml | grep "base_url"' },
      { step: 2, label: 'Bağlantı testi', description: 'Uygulamanın yeni endpoint e bağlanabildiği kontrol edilir' },
    ],
    rollbackSteps: [
      { label: 'Eski endpoint geri yükle', command: 'adb -s {serial} shell run-as com.nesy.mobile.debug am broadcast -a com.nesy.mobile.SET_API_URL --es url "{originalUrl}"', description: 'Orijinal API URL geri yüklenir' },
    ],
    estimatedDuration: 6,
    lastVerifiedVersion: '4.12.1',
    lastVerifiedAt: '2026-07-10',
    owner: 'Mehmet Demir',
    reviewer: 'Gökhan Öncü',
    version: '1.1.0',
    isFavorite: false,
    executionCount: 35,
    tags: ['shared-prefs', 'network', 'endpoint', 'config'],
  },
  {
    id: 'scn-export-shared-prefs',
    name: 'SharedPreferences Dışa Aktar',
    description: 'Uygulamanın tüm SharedPreferences dosyalarını bilgisayara kopyalar.',
    category: 'shared-prefs',
    riskLevel: 'safe',
    buildCompatibility: 'debug',
    deviceRequirement: 'any',
    requiresRoot: false,
    supportedPackages: ['com.nesy.mobile', 'com.nesy.mobile.debug'],
    supportedAndroidVersions: '>=10',
    parameters: [
      { key: 'outputDir', label: 'Çıkış Dizini', type: 'text', required: false, defaultValue: '/tmp/nesy-prefs', hint: 'Yerel bilgisayar dizini' },
    ],
    preflightChecks: ['device-connected', 'app-installed', 'debuggable'],
    commands: [
      { step: 1, label: 'Dosya listesi', command: 'adb -s {serial} shell run-as com.nesy.mobile ls shared_prefs/', description: 'Mevcut SharedPreferences dosyaları listelenir' },
      { step: 2, label: 'Dosyaları kopyala', command: 'adb -s {serial} shell "run-as com.nesy.mobile tar -cf - shared_prefs/" | tar -xf - -C {outputDir}', description: 'Tüm dosyalar bilgisayara kopyalanır' },
    ],
    verificationSteps: [
      { step: 1, label: 'Dosya kontrolü', description: 'Kopyalanan dosyaların hedef dizinde mevcut olduğu doğrulanır' },
    ],
    rollbackSteps: [
      { label: 'Geri alma gerekli değil', command: '# N/A', description: 'Bu işlem cihazda değişiklik yapmaz' },
    ],
    estimatedDuration: 4,
    lastVerifiedVersion: '4.12.0',
    lastVerifiedAt: '2026-07-08',
    owner: 'Ali Yılmaz',
    reviewer: 'Gökhan Öncü',
    version: '1.0.0',
    isFavorite: false,
    executionCount: 22,
    tags: ['shared-prefs', 'export', 'backup'],
  },

  // ── Room DB ──
  {
    id: 'scn-query-room-orders',
    name: 'Room Sipariş Sorgusu',
    description: 'Yerel Room veritabanından sipariş kayıtlarını sorgular.',
    category: 'room-db',
    riskLevel: 'safe',
    buildCompatibility: 'debug',
    deviceRequirement: 'any',
    requiresRoot: false,
    supportedPackages: ['com.nesy.mobile', 'com.nesy.mobile.debug'],
    supportedAndroidVersions: '>=10',
    parameters: [
      { key: 'status', label: 'Sipariş Durumu', type: 'select', required: false, defaultValue: 'all', options: [
        { label: 'Tümü', value: 'all' },
        { label: 'Bekliyor', value: 'pending' },
        { label: 'Teslim Edildi', value: 'delivered' },
        { label: 'İptal', value: 'cancelled' },
        { label: 'Sorunlu', value: 'problematic' },
      ] },
      { key: 'limit', label: 'Limit', type: 'number', required: false, defaultValue: 50 },
    ],
    preflightChecks: ['device-connected', 'app-installed', 'debuggable'],
    commands: [
      { step: 1, label: 'Veritabanı sorgusu', command: 'adb -s {serial} shell run-as com.nesy.mobile sqlite3 databases/nesy_db "SELECT id, order_no, status, delivery_date FROM orders WHERE status LIKE \'%{status}%\' ORDER BY created_at DESC LIMIT {limit}"', description: 'Room DB üzerinden sipariş sorgusu yapılır' },
    ],
    verificationSteps: [
      { step: 1, label: 'Sonuç kontrolü', description: 'Sorgu sonuçlarının döndüğü ve formatın doğru olduğu kontrol edilir' },
    ],
    rollbackSteps: [
      { label: 'Geri alma gerekli değil', command: '# N/A', description: 'Veritabanında değişiklik yapılmaz' },
    ],
    estimatedDuration: 3,
    lastVerifiedVersion: '4.12.1',
    lastVerifiedAt: '2026-07-11',
    owner: 'Gökhan Öncü',
    reviewer: 'Mehmet Demir',
    version: '1.2.0',
    isFavorite: true,
    executionCount: 76,
    tags: ['room-db', 'query', 'orders', 'read-only'],
  },
  {
    id: 'scn-clear-room-cache',
    name: 'Room Cache Temizleme',
    description: 'Yerel veritabanı cache tablolarını temizler. Senkronizasyon sorunları durumunda kullanılır.',
    category: 'room-db',
    riskLevel: 'destructive',
    buildCompatibility: 'debug',
    deviceRequirement: 'any',
    requiresRoot: false,
    supportedPackages: ['com.nesy.mobile', 'com.nesy.mobile.debug'],
    supportedAndroidVersions: '>=10',
    parameters: [
      { key: 'tables', label: 'Temizlenecek Tablolar', type: 'multiselect', required: true, defaultValue: ['sync_cache'], options: [
        { label: 'Sync Cache', value: 'sync_cache' },
        { label: 'Image Cache', value: 'image_cache' },
        { label: 'Route Cache', value: 'route_cache' },
        { label: 'Tümü', value: 'all' },
      ] },
      { key: 'backupFirst', label: 'Önce Yedekle', type: 'boolean', required: false, defaultValue: true },
    ],
    preflightChecks: ['device-connected', 'app-installed', 'debuggable', 'no-active-run'],
    commands: [
      { step: 1, label: 'Veritabanı yedekleme', command: 'adb -s {serial} shell "run-as com.nesy.mobile cp databases/nesy_db databases/nesy_db.backup"', description: 'Veritabanı yedek kopyası alınır' },
      { step: 2, label: 'Cache tabloları temizleme', command: 'adb -s {serial} shell run-as com.nesy.mobile sqlite3 databases/nesy_db "DELETE FROM {tables}"', description: 'Seçili cache tabloları temizlenir' },
      { step: 3, label: 'VACUUM', command: 'adb -s {serial} shell run-as com.nesy.mobile sqlite3 databases/nesy_db "VACUUM"', description: 'Veritabanı boyutu optimize edilir' },
    ],
    verificationSteps: [
      { step: 1, label: 'Tablo boyutu kontrolü', description: 'Temizlenen tabloların boş olduğu doğrulanır', query: 'adb -s {serial} shell run-as com.nesy.mobile sqlite3 databases/nesy_db "SELECT COUNT(*) FROM {tables}"' },
    ],
    rollbackSteps: [
      { label: 'Yedekten geri yükle', command: 'adb -s {serial} shell "run-as com.nesy.mobile cp databases/nesy_db.backup databases/nesy_db"', description: 'Yedek veritabanı geri yüklenir' },
    ],
    estimatedDuration: 10,
    lastVerifiedVersion: '4.12.1',
    lastVerifiedAt: '2026-07-09',
    owner: 'Mehmet Demir',
    reviewer: 'Ali Yılmaz',
    version: '1.1.0',
    isFavorite: false,
    executionCount: 18,
    tags: ['room-db', 'cache', 'cleanup', 'destructive'],
  },

  // ── Offline & Sync ──
  {
    id: 'scn-simulate-offline',
    name: 'Çevrimdışı Mod Simülasyonu',
    description: 'Cihazın ağ bağlantısını geçici olarak keser ve çevrimdışı kuyruk davranışını test eder.',
    category: 'offline-sync',
    riskLevel: 'caution',
    buildCompatibility: 'any',
    deviceRequirement: 'any',
    requiresRoot: false,
    supportedPackages: ['com.nesy.mobile', 'com.nesy.mobile.debug'],
    supportedAndroidVersions: '>=10',
    parameters: [
      { key: 'durationSec', label: 'Süre (saniye)', type: 'number', required: true, defaultValue: 30, hint: '10-300 arası' },
      { key: 'disableWifi', label: 'WiFi Kapat', type: 'boolean', required: false, defaultValue: true },
      { key: 'disableData', label: 'Mobil Veri Kapat', type: 'boolean', required: false, defaultValue: true },
    ],
    preflightChecks: ['device-connected', 'app-installed', 'battery-ok'],
    commands: [
      { step: 1, label: 'Ağ durumu kaydet', command: 'adb -s {serial} shell dumpsys connectivity | head -20', description: 'Mevcut ağ durumu kaydedilir' },
      { step: 2, label: 'Airplane mode aç', command: 'adb -s {serial} shell settings put global airplane_mode_on 1 && adb -s {serial} shell am broadcast -a android.intent.action.AIRPLANE_MODE', description: 'Uçak modu aktifleştirilir' },
      { step: 3, label: 'Bekleme', command: 'sleep {durationSec}', description: 'Çevrimdışı test süresi beklenir' },
      { step: 4, label: 'Airplane mode kapat', command: 'adb -s {serial} shell settings put global airplane_mode_on 0 && adb -s {serial} shell am broadcast -a android.intent.action.AIRPLANE_MODE', description: 'Uçak modu kapatılır' },
    ],
    verificationSteps: [
      { step: 1, label: 'Kuyruk kontrolü', description: 'Çevrimdışı kuyruğunun doğru şekilde doldurulduğu kontrol edilir', query: 'adb -s {serial} logcat -d -s OfflineQueue | tail -10' },
      { step: 2, label: 'Sync kontrolü', description: 'Bağlantı geldiğinde kuyruğun işlendiği doğrulanır' },
    ],
    rollbackSteps: [
      { label: 'Bağlantıyı geri getir', command: 'adb -s {serial} shell settings put global airplane_mode_on 0 && adb -s {serial} shell am broadcast -a android.intent.action.AIRPLANE_MODE', description: 'Uçak modu kapatılır' },
    ],
    estimatedDuration: 45,
    lastVerifiedVersion: '4.12.1',
    lastVerifiedAt: '2026-07-10',
    owner: 'Ali Yılmaz',
    reviewer: 'Gökhan Öncü',
    version: '1.0.0',
    isFavorite: false,
    executionCount: 15,
    tags: ['offline', 'sync', 'network', 'simulation'],
  },
  {
    id: 'scn-flush-offline-queue',
    name: 'Çevrimdışı Kuyruk Zorla Gönder',
    description: 'Bekleyen çevrimdışı istekleri hemen sunucuya gönderir.',
    category: 'offline-sync',
    riskLevel: 'caution',
    buildCompatibility: 'debug',
    deviceRequirement: 'any',
    requiresRoot: false,
    supportedPackages: ['com.nesy.mobile', 'com.nesy.mobile.debug'],
    supportedAndroidVersions: '>=10',
    parameters: [
      { key: 'maxItems', label: 'Maks. İşlem', type: 'number', required: false, defaultValue: 100 },
    ],
    preflightChecks: ['device-connected', 'app-installed', 'debuggable'],
    commands: [
      { step: 1, label: 'Kuyruk durumu kontrol', command: 'adb -s {serial} shell run-as com.nesy.mobile sqlite3 databases/nesy_db "SELECT COUNT(*) FROM offline_queue WHERE status = \'pending\'"', description: 'Bekleyen işlem sayısı sorgulanır' },
      { step: 2, label: 'Kuyruğu gönder', command: 'adb -s {serial} shell run-as com.nesy.mobile am broadcast -a com.nesy.mobile.FLUSH_OFFLINE_QUEUE --ei max_items {maxItems}', description: 'Kuyruk zorla işlenir' },
    ],
    verificationSteps: [
      { step: 1, label: 'İşlem kontrolü', description: 'Kuyruğun başarıyla işlendiği doğrulanır', query: 'adb -s {serial} shell run-as com.nesy.mobile sqlite3 databases/nesy_db "SELECT COUNT(*) FROM offline_queue WHERE status = \'pending\'"' },
    ],
    rollbackSteps: [
      { label: 'Geri alma yapılamaz', command: '# N/A', description: 'Sunucuya gönderilmiş veriler geri alınamaz' },
    ],
    estimatedDuration: 8,
    lastVerifiedVersion: '4.12.1',
    lastVerifiedAt: '2026-07-09',
    owner: 'Gökhan Öncü',
    reviewer: 'Mehmet Demir',
    version: '1.0.0',
    isFavorite: false,
    executionCount: 9,
    tags: ['offline', 'sync', 'queue', 'flush'],
  },

  // ── Lifecycle ──
  {
    id: 'scn-clear-app-data',
    name: 'Uygulama Verilerini Temizle',
    description: 'NesyMobile uygulamasının tüm verilerini temizler. Temiz kurulum testi için kullanılır.',
    category: 'lifecycle',
    riskLevel: 'destructive',
    buildCompatibility: 'any',
    deviceRequirement: 'any',
    requiresRoot: false,
    supportedPackages: ['com.nesy.mobile', 'com.nesy.mobile.debug'],
    supportedAndroidVersions: '>=10',
    parameters: [
      { key: 'backupFirst', label: 'Önce Yedekle', type: 'boolean', required: false, defaultValue: true },
      { key: 'packageName', label: 'Paket Adı', type: 'select', required: true, defaultValue: 'com.nesy.mobile', options: [
        { label: 'NesyMobile (Production)', value: 'com.nesy.mobile' },
        { label: 'NesyMobile (Debug)', value: 'com.nesy.mobile.debug' },
      ] },
    ],
    preflightChecks: ['device-connected', 'app-installed', 'no-active-run'],
    commands: [
      { step: 1, label: 'Veri yedekleme', command: 'adb -s {serial} backup -f /tmp/nesy_backup.ab {packageName}', description: 'Tüm uygulama verileri yedeklenir' },
      { step: 2, label: 'Uygulama durdur', command: 'adb -s {serial} shell am force-stop {packageName}', description: 'Uygulama durdurulur' },
      { step: 3, label: 'Verileri temizle', command: 'adb -s {serial} shell pm clear {packageName}', description: 'Tüm uygulama verileri silinir' },
      { step: 4, label: 'Uygulamayı başlat', command: 'adb -s {serial} shell am start -n {packageName}/.MainActivity', description: 'Uygulama temiz başlatılır' },
    ],
    verificationSteps: [
      { step: 1, label: 'İlk açılış kontrolü', description: 'Uygulamanın onboarding/login ekranına düştüğü doğrulanır' },
      { step: 2, label: 'Veri yokluğu kontrolü', description: 'Yerel veritabanı ve SharedPreferences dosyalarının temizlendiği kontrol edilir' },
    ],
    rollbackSteps: [
      { label: 'Yedekten geri yükle', command: 'adb -s {serial} restore /tmp/nesy_backup.ab', description: 'Yedeklenen veriler geri yüklenir' },
    ],
    estimatedDuration: 15,
    lastVerifiedVersion: '4.12.1',
    lastVerifiedAt: '2026-07-11',
    owner: 'Mehmet Demir',
    reviewer: 'Ali Yılmaz',
    version: '2.1.0',
    isFavorite: false,
    executionCount: 31,
    tags: ['lifecycle', 'clear-data', 'reset', 'destructive'],
  },
  {
    id: 'scn-force-stop-restart',
    name: 'Zorla Durdur ve Yeniden Başlat',
    description: 'Uygulamayı zorla durdurur ve cold-start ile yeniden başlatır.',
    category: 'lifecycle',
    riskLevel: 'safe',
    buildCompatibility: 'any',
    deviceRequirement: 'any',
    requiresRoot: false,
    supportedPackages: ['com.nesy.mobile', 'com.nesy.mobile.debug'],
    supportedAndroidVersions: '>=10',
    parameters: [
      { key: 'waitSec', label: 'Bekleme Süresi (saniye)', type: 'number', required: false, defaultValue: 3 },
    ],
    preflightChecks: ['device-connected', 'app-installed'],
    commands: [
      { step: 1, label: 'Uygulamayı durdur', command: 'adb -s {serial} shell am force-stop com.nesy.mobile', description: 'Uygulama zorla durdurulur' },
      { step: 2, label: 'Bekleme', command: 'sleep {waitSec}', description: 'Belirtilen süre beklenir' },
      { step: 3, label: 'Uygulamayı başlat', command: 'adb -s {serial} shell am start -n com.nesy.mobile/.MainActivity', description: 'Uygulama cold-start ile başlatılır' },
    ],
    verificationSteps: [
      { step: 1, label: 'Başlatma kontrolü', description: 'Uygulamanın başarıyla açıldığı doğrulanır', query: 'adb -s {serial} shell dumpsys activity activities | grep "com.nesy.mobile" | head -3' },
    ],
    rollbackSteps: [
      { label: 'Geri alma gerekli değil', command: '# N/A', description: 'Uygulama zaten yeniden başlatılmış durumda' },
    ],
    estimatedDuration: 5,
    lastVerifiedVersion: '4.12.1',
    lastVerifiedAt: '2026-07-12',
    owner: 'Ali Yılmaz',
    reviewer: 'Gökhan Öncü',
    version: '1.0.0',
    isFavorite: true,
    executionCount: 142,
    tags: ['lifecycle', 'restart', 'force-stop'],
  },

  // ── Permission ──
  {
    id: 'scn-grant-all-permissions',
    name: 'Tüm İzinleri Ver',
    description: 'Uygulamanın tüm çalışma zamanı izinlerini otomatik olarak kabul eder.',
    category: 'permission',
    riskLevel: 'safe',
    buildCompatibility: 'any',
    deviceRequirement: 'any',
    requiresRoot: false,
    supportedPackages: ['com.nesy.mobile', 'com.nesy.mobile.debug'],
    supportedAndroidVersions: '>=10',
    parameters: [],
    preflightChecks: ['device-connected', 'app-installed'],
    commands: [
      { step: 1, label: 'Kamera izni', command: 'adb -s {serial} shell pm grant com.nesy.mobile android.permission.CAMERA', description: 'Kamera izni verilir' },
      { step: 2, label: 'Konum izni', command: 'adb -s {serial} shell pm grant com.nesy.mobile android.permission.ACCESS_FINE_LOCATION', description: 'Hassas konum izni verilir' },
      { step: 3, label: 'Depolama izni', command: 'adb -s {serial} shell pm grant com.nesy.mobile android.permission.READ_EXTERNAL_STORAGE', description: 'Depolama okuma izni verilir' },
      { step: 4, label: 'Telefon izni', command: 'adb -s {serial} shell pm grant com.nesy.mobile android.permission.READ_PHONE_STATE', description: 'Telefon durumu izni verilir' },
    ],
    verificationSteps: [
      { step: 1, label: 'İzin kontrolü', description: 'Tüm izinlerin verildiği doğrulanır', query: 'adb -s {serial} shell dumpsys package com.nesy.mobile | grep "granted=true"' },
    ],
    rollbackSteps: [
      { label: 'İzinleri geri al', command: 'adb -s {serial} shell pm revoke com.nesy.mobile android.permission.CAMERA && adb -s {serial} shell pm revoke com.nesy.mobile android.permission.ACCESS_FINE_LOCATION', description: 'Verilen izinler geri alınır' },
    ],
    estimatedDuration: 4,
    lastVerifiedVersion: '4.12.0',
    lastVerifiedAt: '2026-07-08',
    owner: 'Gökhan Öncü',
    reviewer: 'Ali Yılmaz',
    version: '1.0.0',
    isFavorite: true,
    executionCount: 95,
    tags: ['permission', 'grant', 'runtime'],
  },
  {
    id: 'scn-revoke-specific-permission',
    name: 'Belirli İzni Kaldır',
    description: 'Seçilen izni kaldırarak uygulamanın izin reddedilme durumundaki davranışını test eder.',
    category: 'permission',
    riskLevel: 'safe',
    buildCompatibility: 'any',
    deviceRequirement: 'any',
    requiresRoot: false,
    supportedPackages: ['com.nesy.mobile', 'com.nesy.mobile.debug'],
    supportedAndroidVersions: '>=10',
    parameters: [
      { key: 'permission', label: 'İzin', type: 'select', required: true, defaultValue: 'android.permission.CAMERA', options: [
        { label: 'Kamera', value: 'android.permission.CAMERA' },
        { label: 'Konum (Hassas)', value: 'android.permission.ACCESS_FINE_LOCATION' },
        { label: 'Konum (Kaba)', value: 'android.permission.ACCESS_COARSE_LOCATION' },
        { label: 'Depolama', value: 'android.permission.READ_EXTERNAL_STORAGE' },
        { label: 'Telefon', value: 'android.permission.READ_PHONE_STATE' },
      ] },
    ],
    preflightChecks: ['device-connected', 'app-installed'],
    commands: [
      { step: 1, label: 'Mevcut izin durumu', command: 'adb -s {serial} shell dumpsys package com.nesy.mobile | grep "{permission}"', description: 'İznin mevcut durumu kontrol edilir' },
      { step: 2, label: 'İzni kaldır', command: 'adb -s {serial} shell pm revoke com.nesy.mobile {permission}', description: 'Seçilen izin kaldırılır' },
    ],
    verificationSteps: [
      { step: 1, label: 'İzin kontrolü', description: 'İznin kaldırıldığı doğrulanır', query: 'adb -s {serial} shell dumpsys package com.nesy.mobile | grep "{permission}"' },
    ],
    rollbackSteps: [
      { label: 'İzni geri ver', command: 'adb -s {serial} shell pm grant com.nesy.mobile {permission}', description: 'Kaldırılan izin geri verilir' },
    ],
    estimatedDuration: 3,
    lastVerifiedVersion: '4.12.0',
    lastVerifiedAt: '2026-07-08',
    owner: 'Ali Yılmaz',
    reviewer: 'Mehmet Demir',
    version: '1.0.0',
    isFavorite: false,
    executionCount: 41,
    tags: ['permission', 'revoke', 'runtime', 'test'],
  },

  // ── Diagnostic ──
  {
    id: 'scn-collect-device-info',
    name: 'Cihaz Bilgisi Topla',
    description: 'Cihazın donanım, yazılım ve uygulama bilgilerini tek seferde toplar.',
    category: 'diagnostic',
    riskLevel: 'safe',
    buildCompatibility: 'any',
    deviceRequirement: 'any',
    requiresRoot: false,
    supportedPackages: ['com.nesy.mobile', 'com.nesy.mobile.debug'],
    supportedAndroidVersions: '>=10',
    parameters: [],
    preflightChecks: ['device-connected'],
    commands: [
      { step: 1, label: 'Android sürümü', command: 'adb -s {serial} shell getprop ro.build.version.release', description: 'Android sürüm bilgisi alınır' },
      { step: 2, label: 'Cihaz modeli', command: 'adb -s {serial} shell getprop ro.product.model', description: 'Cihaz model bilgisi alınır' },
      { step: 3, label: 'Batarya durumu', command: 'adb -s {serial} shell dumpsys battery', description: 'Batarya detay bilgisi alınır' },
      { step: 4, label: 'Depolama durumu', command: 'adb -s {serial} shell df -h /data', description: 'Depolama kullanımı sorgulanır' },
      { step: 5, label: 'Uygulama bilgisi', command: 'adb -s {serial} shell dumpsys package com.nesy.mobile | grep -E "versionName|versionCode|firstInstallTime|lastUpdateTime"', description: 'Uygulama versiyon bilgileri alınır' },
    ],
    verificationSteps: [
      { step: 1, label: 'Bilgi kontrolü', description: 'Tüm bilgi bloklarının başarıyla toplandığı doğrulanır' },
    ],
    rollbackSteps: [
      { label: 'Geri alma gerekli değil', command: '# N/A', description: 'Bu işlem cihazda değişiklik yapmaz' },
    ],
    estimatedDuration: 6,
    lastVerifiedVersion: '4.12.1',
    lastVerifiedAt: '2026-07-12',
    owner: 'Gökhan Öncü',
    reviewer: 'Ali Yılmaz',
    version: '1.0.0',
    isFavorite: true,
    executionCount: 156,
    tags: ['diagnostic', 'info', 'report', 'read-only'],
  },
  {
    id: 'scn-capture-bugreport',
    name: 'Bug Report Oluştur',
    description: 'Android bugreport dosyasını oluşturur ve bilgisayara çeker.',
    category: 'diagnostic',
    riskLevel: 'safe',
    buildCompatibility: 'any',
    deviceRequirement: 'physical',
    requiresRoot: false,
    supportedPackages: ['com.nesy.mobile', 'com.nesy.mobile.debug'],
    supportedAndroidVersions: '>=10',
    parameters: [
      { key: 'outputPath', label: 'Çıkış Yolu', type: 'text', required: false, defaultValue: '/tmp/bugreport', hint: 'Yerel dosya yolu' },
    ],
    preflightChecks: ['device-connected', 'battery-ok'],
    commands: [
      { step: 1, label: 'Bugreport oluşturma', command: 'adb -s {serial} bugreport {outputPath}', description: 'Kapsamlı bugreport dosyası oluşturulur (1-3 dk)' },
    ],
    verificationSteps: [
      { step: 1, label: 'Dosya kontrolü', description: 'Bugreport dosyasının oluşturulduğu ve boyutunun makul olduğu doğrulanır' },
    ],
    rollbackSteps: [
      { label: 'Geri alma gerekli değil', command: '# N/A', description: 'Bugreport dosyası sadece bilgi toplar' },
    ],
    estimatedDuration: 120,
    lastVerifiedVersion: '4.12.0',
    lastVerifiedAt: '2026-07-07',
    owner: 'Mehmet Demir',
    reviewer: 'Gökhan Öncü',
    version: '1.0.0',
    isFavorite: false,
    executionCount: 8,
    tags: ['diagnostic', 'bugreport', 'debug', 'dump'],
  },
]

// ---------------------------------------------------------------------------
// 5. MOCK EXECUTION HISTORY
// ---------------------------------------------------------------------------

export const MOCK_EXECUTION_HISTORY: ExecutionRecord[] = [
  {
    id: 'RUN-2026-0712-1845',
    scenarioId: 'scn-override-delivery-date',
    scenarioName: 'Teslimat Tarihi Override',
    deviceId: 'dev-urovo-dt50-001',
    deviceName: 'Urovo DT50',
    user: 'Gökhan Öncü',
    startedAt: '2026-07-12T18:45:00Z',
    completedAt: '2026-07-12T18:45:08Z',
    status: 'success',
    steps: [
      { step: 1, label: 'Device validation', status: 'completed' },
      { step: 2, label: 'Mevcut tarih yedekleme', status: 'completed' },
      { step: 3, label: 'Tarih güncelleme', status: 'completed' },
      { step: 4, label: 'Uygulama yeniden başlatma', status: 'completed' },
      { step: 5, label: 'Result verification', status: 'completed' },
    ],
    parameters: { orderId: 'ORD-2026-0712', newDate: '2026-07-20', notifyUser: true },
    previousValues: { delivery_date: '2026-07-15' },
    newValues: { delivery_date: '2026-07-20' },
    terminalOutput: '$ adb -s UROVO-DT50-A1B2C3 shell run-as com.nesy.mobile cat shared_prefs/delivery_schedule.xml\n<map>\n  <string name="delivery_date">2026-07-15</string>\n</map>\n\n$ sed -i ... OK\n\n$ am force-stop com.nesy.mobile\n$ am start -n com.nesy.mobile/.MainActivity\nStarting: Intent { cmp=com.nesy.mobile/.MainActivity }\n\nverification: delivery_date = 2026-07-20',
    linkedSessionId: 'LOG-2026-0712-1844',
    rollbackAvailable: true,
  },
  {
    id: 'RUN-2026-0712-1730',
    scenarioId: 'scn-toggle-feature-flag',
    scenarioName: 'Feature Flag Değiştir',
    deviceId: 'dev-samsung-a13-002',
    deviceName: 'Samsung Galaxy A13',
    user: 'Ali Yılmaz',
    startedAt: '2026-07-12T17:30:00Z',
    completedAt: '2026-07-12T17:30:04Z',
    status: 'success',
    steps: [
      { step: 1, label: 'Device validation', status: 'completed' },
      { step: 2, label: 'Mevcut flag değeri yedekleme', status: 'completed' },
      { step: 3, label: 'Flag değeri güncelleme', status: 'completed' },
      { step: 4, label: 'Result verification', status: 'completed' },
    ],
    parameters: { flagName: 'new_scanner_ui', enabled: true },
    previousValues: { new_scanner_ui: false },
    newValues: { new_scanner_ui: true },
    terminalOutput: '$ cat shared_prefs/feature_flags.xml | grep "new_scanner_ui"\n<boolean name="new_scanner_ui" value="false" />\n\n$ SET_FEATURE_FLAG broadcast\nBroadcast completed: result=0\n\nverification: new_scanner_ui = true',
    linkedSessionId: null,
    rollbackAvailable: true,
  },
  {
    id: 'RUN-2026-0712-1615',
    scenarioId: 'scn-invalidate-session',
    scenarioName: 'Oturum Geçersiz Kılma',
    deviceId: 'dev-urovo-dt50-001',
    deviceName: 'Urovo DT50',
    user: 'Mehmet Demir',
    startedAt: '2026-07-12T16:15:00Z',
    completedAt: '2026-07-12T16:15:07Z',
    status: 'success',
    steps: [
      { step: 1, label: 'Device validation', status: 'completed' },
      { step: 2, label: 'Token yedekleme', status: 'completed' },
      { step: 3, label: 'Token temizleme', status: 'completed' },
      { step: 4, label: 'Session cache temizleme', status: 'completed' },
      { step: 5, label: 'Uygulamayı yeniden başlat', status: 'completed' },
      { step: 6, label: 'Result verification', status: 'completed' },
    ],
    parameters: { clearTokens: true, clearCookies: false },
    previousValues: { hasToken: true, sessionActive: true },
    newValues: { hasToken: false, sessionActive: false },
    terminalOutput: '$ Token yedekleme... OK\n$ Token temizleme... OK\n$ Session cache temizleme... OK\n$ Uygulamayı yeniden başlat... OK\n\nverification: login ekranı gösterildi',
    linkedSessionId: null,
    rollbackAvailable: true,
  },
  {
    id: 'RUN-2026-0712-1500',
    scenarioId: 'scn-clear-room-cache',
    scenarioName: 'Room Cache Temizleme',
    deviceId: 'dev-pixel7-emu-003',
    deviceName: 'Google Pixel 7 Emulator',
    user: 'Gökhan Öncü',
    startedAt: '2026-07-12T15:00:00Z',
    completedAt: '2026-07-12T15:00:12Z',
    status: 'partial',
    steps: [
      { step: 1, label: 'Device validation', status: 'completed' },
      { step: 2, label: 'Veritabanı yedekleme', status: 'completed' },
      { step: 3, label: 'Cache tabloları temizleme', status: 'completed' },
      { step: 4, label: 'VACUUM', status: 'failed' },
      { step: 5, label: 'Result verification', status: 'skipped' },
    ],
    parameters: { tables: ['sync_cache', 'image_cache'], backupFirst: true },
    previousValues: { sync_cache_count: 1247, image_cache_count: 89 },
    newValues: { sync_cache_count: 0, image_cache_count: 0 },
    terminalOutput: '$ Veritabanı yedekleme... OK\n$ Cache tabloları temizleme... OK\n$ VACUUM... FAILED: database is locked\n\nKısmi basari: tablolar temizlendi ancak VACUUM yapilamadi',
    linkedSessionId: 'LOG-2026-0712-1459',
    rollbackAvailable: true,
  },
  {
    id: 'RUN-2026-0712-1400',
    scenarioId: 'scn-simulate-offline',
    scenarioName: 'Çevrimdışı Mod Simülasyonu',
    deviceId: 'dev-urovo-dt50-001',
    deviceName: 'Urovo DT50',
    user: 'Ali Yılmaz',
    startedAt: '2026-07-12T14:00:00Z',
    completedAt: null,
    status: 'failed',
    steps: [
      { step: 1, label: 'Device validation', status: 'completed' },
      { step: 2, label: 'Ağ durumu kaydet', status: 'completed' },
      { step: 3, label: 'Airplane mode aç', status: 'failed' },
      { step: 4, label: 'Bekleme (30 saniye)', status: 'skipped' },
      { step: 5, label: 'Airplane mode kapat', status: 'skipped' },
      { step: 6, label: 'Result verification', status: 'skipped' },
    ],
    parameters: { durationSec: 30, disableWifi: true, disableData: true },
    previousValues: {},
    newValues: {},
    terminalOutput: '$ dumpsys connectivity | head -20\nNetworkAgentInfo... OK\n\n$ settings put global airplane_mode_on 1\nException: java.lang.SecurityException: Permission denial\n\nHata: Airplane mode degistirme izni reddedildi',
    linkedSessionId: null,
    rollbackAvailable: false,
  },
  {
    id: 'RUN-2026-0712-1230',
    scenarioId: 'scn-collect-device-info',
    scenarioName: 'Cihaz Bilgisi Topla',
    deviceId: 'dev-samsung-a13-002',
    deviceName: 'Samsung Galaxy A13',
    user: 'Gökhan Öncü',
    startedAt: '2026-07-12T12:30:00Z',
    completedAt: '2026-07-12T12:30:06Z',
    status: 'success',
    steps: [
      { step: 1, label: 'Device validation', status: 'completed' },
      { step: 2, label: 'Android sürümü', status: 'completed' },
      { step: 3, label: 'Cihaz modeli', status: 'completed' },
      { step: 4, label: 'Batarya durumu', status: 'completed' },
      { step: 5, label: 'Depolama durumu', status: 'completed' },
      { step: 6, label: 'Uygulama bilgisi', status: 'completed' },
      { step: 7, label: 'Result verification', status: 'completed' },
    ],
    parameters: {},
    previousValues: {},
    newValues: { androidVersion: '13', model: 'SM-A135F', batteryLevel: 85 },
    terminalOutput: '$ Android sürümü: 13\n$ Model: SM-A135F\n$ Batarya: 85%\n$ Depolama: 24GB / 64GB kullanımda\n$ App: v4.12.0-internal (code 41200)\n\nTüm bilgiler toplandı',
    linkedSessionId: null,
    rollbackAvailable: false,
  },
  {
    id: 'RUN-2026-0711-1900',
    scenarioId: 'scn-force-stop-restart',
    scenarioName: 'Zorla Durdur ve Yeniden Başlat',
    deviceId: 'dev-urovo-dt50-001',
    deviceName: 'Urovo DT50',
    user: 'Mehmet Demir',
    startedAt: '2026-07-11T19:00:00Z',
    completedAt: '2026-07-11T19:00:08Z',
    status: 'success',
    steps: [
      { step: 1, label: 'Device validation', status: 'completed' },
      { step: 2, label: 'Uygulamayı durdur', status: 'completed' },
      { step: 3, label: 'Bekleme', status: 'completed' },
      { step: 4, label: 'Uygulamayı başlat', status: 'completed' },
      { step: 5, label: 'Result verification', status: 'completed' },
    ],
    parameters: { waitSec: 3 },
    previousValues: {},
    newValues: {},
    terminalOutput: '$ am force-stop com.nesy.mobile\n$ sleep 3\n$ am start -n com.nesy.mobile/.MainActivity\nStarting: Intent { cmp=com.nesy.mobile/.MainActivity }\n\nUygulama yeniden başlatıldı',
    linkedSessionId: null,
    rollbackAvailable: false,
  },
  {
    id: 'RUN-2026-0711-1630',
    scenarioId: 'scn-grant-all-permissions',
    scenarioName: 'Tüm İzinleri Ver',
    deviceId: 'dev-pixel7-emu-003',
    deviceName: 'Google Pixel 7 Emulator',
    user: 'Ali Yılmaz',
    startedAt: '2026-07-11T16:30:00Z',
    completedAt: '2026-07-11T16:30:05Z',
    status: 'success',
    steps: [
      { step: 1, label: 'Device validation', status: 'completed' },
      { step: 2, label: 'Kamera izni', status: 'completed' },
      { step: 3, label: 'Konum izni', status: 'completed' },
      { step: 4, label: 'Depolama izni', status: 'completed' },
      { step: 5, label: 'Telefon izni', status: 'completed' },
      { step: 6, label: 'Result verification', status: 'completed' },
    ],
    parameters: {},
    previousValues: {},
    newValues: { camera: 'granted', location: 'granted', storage: 'granted', phone: 'granted' },
    terminalOutput: '$ pm grant ... CAMERA -> OK\n$ pm grant ... ACCESS_FINE_LOCATION -> OK\n$ pm grant ... READ_EXTERNAL_STORAGE -> OK\n$ pm grant ... READ_PHONE_STATE -> OK\n\n4/4 izin verildi',
    linkedSessionId: null,
    rollbackAvailable: true,
  },
]

// ---------------------------------------------------------------------------
// 6. HELPER FUNCTIONS
// ---------------------------------------------------------------------------

/** Kategoriye göre senaryoları grupla */
export function getScenariosByCategory(category: ScenarioCategory): ScenarioPackage[] {
  return SCENARIO_PACKAGES.filter(s => s.category === category)
}

/** Arama ve filtreleme */
export function filterScenarios(
  search: string,
  filter: string,
  category: ScenarioCategory | null,
): ScenarioPackage[] {
  let results = [...SCENARIO_PACKAGES]

  // Kategori filtresi
  if (category) {
    results = results.filter(s => s.category === category)
  }

  // Quick-view filtresi
  switch (filter) {
    case 'frequently-used':
      results = results.filter(s => s.executionCount >= 30)
      break
    case 'safe':
      results = results.filter(s => s.riskLevel === 'safe')
      break
    case 'data-manipulation':
      results = results.filter(s => ['shared-prefs', 'room-db'].includes(s.category))
      break
    case 'favorites':
      results = results.filter(s => s.isFavorite)
      break
    case 'debug-only':
      results = results.filter(s => s.buildCompatibility === 'debug')
      break
  }

  // Arama
  if (search.trim()) {
    const q = search.toLowerCase()
    results = results.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some(t => t.includes(q)),
    )
  }

  return results
}

/** ID ye göre senaryo getir */
export function getScenarioById(id: string): ScenarioPackage | undefined {
  return SCENARIO_PACKAGES.find(s => s.id === id)
}
