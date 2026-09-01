# Post-Launch Permission Bootstrap — RUN

```yaml
runId: nesy-rs-post-launch-permission-bootstrap-2026-09-01
status: COMPLETED
device: R6CW400BC8N
deviceModel: SM-A346E
androidApi: 36
applicationId: com.arasdigital.nesymobile.rstest
mobileVersion: 0.1157
startedAt: "2026-09-01 19:37:00 +03"
completedAt: "2026-09-01 19:44:30 +03"
play: PLAY.sh
result: RESULT.md
```

## Amaç

Canvas üzerinde gerçek bir `Grant Permissions` workflow node'u çalıştırarak,
`Launch App` ile başlayan temiz kurulumda PIN login ekranından önce açılan Nesy
onay penceresini ve Android izin pencerelerini geçmek. Akış:

```text
Launch App → Grant Permissions → Auth / Login → Select Route
```

İzinler zaten verilmişse node hiçbir izin veya process değişikliği yapmaz.

Bu bir ürün-verdict adımı değildir. Yalnızca test precondition kurar.

## Mobile kaynak tespiti

İzin zinciri:

1. `MainActivity.checkOverlayPermission()`
2. `MainActivity.checkAllPermissionAndRequest()`
3. konum (`ACCESS_FINE_LOCATION`; helper Android'in precise-location çifti için
   önce `ACCESS_COARSE_LOCATION`, sonra `ACCESS_FINE_LOCATION` verir)
4. Android 13 altındaysa legacy storage; API 36'da otomatik atlanır
5. kamera (`CAMERA`)
6. telefon arama (`CALL_PHONE`)
7. çağrı kayıtları (`READ_CALL_LOG`, `WRITE_CALL_LOG`)
8. telefon durumu/numarası (`READ_PHONE_STATE`, `READ_PHONE_NUMBERS`)
9. bildirim (`POST_NOTIFICATIONS`)

Overlay normal runtime izni değildir; `SYSTEM_ALERT_WINDOW` app-op olarak
doğrulanır. `ACCESS_BACKGROUND_LOCATION`, Bluetooth ve storage izinleri login
öncesi zincirin parçası değildir ve bu adım tarafından verilmez.

Kaynaklar:

- `NesyMobile/app/src/main/java/com/arasdigital/nesymobile/main/MainActivity.kt`
- `NesyMobile/app/src/main/java/com/arasdigital/nesymobile/util/CameraMethods.kt`
- `NesyMobile/app/src/main/AndroidManifest.xml`
- `NesyMobile/app/src/main/res/layout/fragment_login.xml`

## Çözüm

`GRANT_PERMISSIONS` node'u Domain Pack IR içinde
`prepare-startup-permissions` plan adımına derlenir. API runtime bu plan adımını
cold launch sonrasında ve Bridge acquisition öncesinde
`ensureNesyLoginStartupPermissions` ile çalıştırır:

1. `dumpsys package` ile yalnızca manifestte bulunan runtime izinlerini okur.
2. Eksik startup izinlerini sabit ve ölçülmüş sırayla tek tek `pm grant` eder.
3. Overlay app-op'u kontrol eder; eksikse `allow` yapar.
4. Değişiklik olduysa uygulamayı bir kez force-stop + relaunch eder. Bu yeniden
   açılış Nesy'nin hâlihazırda açılmış custom dialog'unu temizler.
5. İzinleri tekrar okuyup eksik varsa fail-closed davranır.
6. İzinler zaten tam ise restart dahil tamamen no-op olur.

Güvenlik sınırı: helper yalnızca `com.arasdigital.nesymobile*` paketlerini kabul
eder; başka paketlere izin vermez.

Compiler, login workflow canvas'ında `GRANT_PERMISSIONS` node'u yoksa
`MISSING_STARTUP_PERMISSION_STEP` ile çalıştırmayı reddeder. Dolayısıyla izin
hazırlama artık genel launch yan etkisi değil, workflow'un açık bir adımıdır.

## Manuel diagnostic

```bash
bash docs/verdict/mobile-run-playbooks/post-launch-permission-bootstrap-2026-09-01/PLAY.sh \
  R6CW400BC8N \
  com.arasdigital.nesymobile.rstest
```

`PLAY.sh` yalnız tekrar üretim/diagnostic içindir; normal kullanım Cockpit
canvas'ındaki `Run Test` üzerinden yapılır.

## Acceptance

- workflow v4 zinciri `LAUNCH_APP → GRANT_PERMISSIONS → AUTH_LOGIN → SELECT_ROUTE`
- run timeline içinde `prepare-startup-permissions = SUCCEEDED`
- temiz uninstall/install sonrası `changed=true`
- dokuz runtime izin `grantedNow` listesinde
- overlay `granted-now`
- helper kontrollü tek restart yapar
- UI hierarchy içinde `Permission Confirmation` ve permission controller yok
- `pinView` ve `btn_login` var
- ikinci çalıştırma `changed=false`, `restarted=false`
