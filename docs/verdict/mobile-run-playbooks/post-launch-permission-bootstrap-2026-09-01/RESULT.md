# Post-Launch Permission Bootstrap — RESULT

```yaml
runId: nesy-rs-post-launch-permission-bootstrap-2026-09-01
resultState: COMPLETED
deviceAcceptance: PASS
unitTests: PASS
typecheck: PASS
workflowVersion: 4
domainPackVersion: 1.36.0
liveRunId: run_4d343f8f-1ef3-4ab3-8f2b-f6d067970771
liveVerdict: PASS_ONLINE
routeAlreadySelectedFixRunId: run_6ae5df13-4627-4985-85ac-c07f1bc5d1c1
loginReady: true
permissionDialogPresent: false
idempotency: PASS
```

## Sonuç

Samsung SM-A346E / Android 16 (API 36) üzerinde gerçek uninstall/install ile
temiz kurulum yapıldı. İlk launch'ta Nesy `Permission Confirmation` dialog'u ve
dokuz startup runtime izninin tamamı eksik olarak ölçüldü.

Post-launch helper dokuz izni tek tek verdi, overlay app-op'u açtı ve bir kez
yeniden başlattı. Son UI hierarchy doğrudan PIN login ekranına ulaştı:

```text
permission_dialog_present=False
pinView_present=True
btn_login_present=True
PASS: izin pencereleri yok; PIN login ekranı hazır
```

Workflow, Cockpit veritabanında v4 olarak şu zincirle kaydedildi:

```text
LAUNCH_APP → GRANT_PERMISSIONS → AUTH_LOGIN → SELECT_ROUTE
```

Temiz uninstall/install sonrasında bu workflow gerçek cihazda çalıştırıldı:

```text
runId=run_4d343f8f-1ef3-4ab3-8f2b-f6d067970771
prepare-startup-permissions action=SUCCEEDED
verdict=PASS_ONLINE
failureClass=NONE
termination=COMPLETED
```

## Tek tek izin sonucu

```text
android.permission.ACCESS_COARSE_LOCATION => granted
android.permission.ACCESS_FINE_LOCATION   => granted
android.permission.CAMERA                 => granted
android.permission.CALL_PHONE             => granted
android.permission.READ_CALL_LOG          => granted
android.permission.WRITE_CALL_LOG         => granted
android.permission.READ_PHONE_STATE       => granted
android.permission.READ_PHONE_NUMBERS     => granted
android.permission.POST_NOTIFICATIONS     => granted
SYSTEM_ALERT_WINDOW                       => allow
```

Helper acceptance çıktısı:

```json
{
  "ok": true,
  "changed": true,
  "restarted": true,
  "grantedNow": [
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.CAMERA",
    "android.permission.CALL_PHONE",
    "android.permission.READ_CALL_LOG",
    "android.permission.WRITE_CALL_LOG",
    "android.permission.READ_PHONE_STATE",
    "android.permission.READ_PHONE_NUMBERS",
    "android.permission.POST_NOTIFICATIONS"
  ],
  "alreadyGranted": [],
  "skippedNotRuntime": [],
  "overlay": "granted-now"
}
```

İkinci çalıştırma:

```text
changed=false
restarted=false
grantedNow=[]
overlay=already-granted
```

## Değişen dosyalar

- `apps/api/src/services/android-startup-permissions.ts`
- `apps/api/src/services/android-startup-permissions.test.ts`
- `apps/api/src/services/bridgeflow-compile-adapter.ts`
- `apps/api/src/services/bridgeflow-execution-queue.ts`
- `apps/api/src/scripts/seed-verdict-catalog.ts`
- `apps/api/src/routes/verdict-phase6-contracts.routes.ts`
- `apps/web/src/app/(automation-editor)/automation/[id]/**`
- `domain-packs/nesy-courier/src/**` ve güncellenen contract fixture'ları
- bu klasördeki `RUN.md`, `PLAY.sh`, `RESULT.md`

Başlangıçta zaten var olan
`apps/web/src/app/(cockpit)/automation/list/page.tsx` değişikliğine dokunulmadı.

## Verification

```text
pnpm --filter @nesy/api test -- android-startup-permissions.test.ts
PASS — 1 file, 4 tests

pnpm --filter @nesy/api test -- \
  android-startup-permissions.test.ts bridgeflow-runtime-wiring.test.ts
PASS — ilgili API testleri

pnpm --filter @nesy/api typecheck
PASS

pnpm --filter @nesy/nesy-courier-domain-pack test
PASS — 17 files, 179 tests

pnpm --filter @nesy/web test -- workflow-rule-engine.test.ts
PASS — 1 file, 4 tests

bash PLAY.sh R6CW400BC8N com.arasdigital.nesymobile.rstest
PASS — clean-install grant/restart/login-ready

bash PLAY.sh R6CW400BC8N com.arasdigital.nesymobile.rstest
PASS — idempotent no-op
```

## Notlar

- İlk tekrar kurma denemesi test-only APK olduğu için normal `adb install` ile
  `INSTALL_FAILED_TEST_ONLY` verdi; gerçek temiz kurulum `adb install -t` ile
  yapıldı.
- Bu Samsung build'inde `cmd package check-permission` komutu yok. Kanıt bu
  nedenle `dumpsys package` runtime permission state ve `appops get` üzerinden
  alındı.
- İlk gerçek workflow denemesi eski immutable Domain Pack `1.34.0` ile
  derlendiği için `UI_NOT_ACTIONABLE` oldu. Pack `1.35.0` olarak version bump
  edilip yayınlandı; aynı temiz-kurulum koşusu `PASS_ONLINE` tamamlandı.
- `full-courier-day` için ek hata bulundu: route zaten seçilmişken `Select Route`
  makrosu dialog beklemesini `CONTINUE` edip boş `offeredRoutes` sonucunu
  `report-not-offered` dalına taşıyordu. Bu dal `ANNOTATE` olduğu için composed
  workflow yeşil kapanabiliyordu.
- Düzeltme `nesy.courier@1.36.0`: `select-route` önce `nesy.routeState` okur;
  istenen rota zaten aktifse doğrudan schedule doğrulamasına geçer. Gerçekten
  route sunulmuyorsa `report-not-offered` artık fail-closed `ASSERT_FACT`.
- Kanıt run `run_6ae5df13-4627-4985-85ac-c07f1bc5d1c1`: route dalı kırılmadı,
  `route-check-already-selected`, `route-assert-selection` ve `load-assert-loaded`
  başarılı geçti. Run daha sonra `permit-verify-request-record` adımında
  `back-office base URL or token is not configured for this run` nedeniyle
  `INCONCLUSIVE` kapandı; bu artık route-step hatası değil.
- Kullanıcı login/PIN bilgisine dokunulmadı.
