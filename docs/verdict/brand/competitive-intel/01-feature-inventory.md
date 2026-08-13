# Rekabet — özellik envanteri (kamuya açık yüzey)

**Kesim:** 2026-08-02 · **İndeks:** [`README.md`](./README.md)  
**Kapsam:** Satın alınabilir / kamuya duyurulmuş özellikler. Enterprise gizli veya demo-only yüzey yok.

Her bölüm: konum → özellikler → Verdict karşısındaki açık.

---

## 1. Momentic

**Konum:** Verdict’e ürün deneyimi açısından en yakın AI-native oyunculardan. Web, Android, iOS; doğal dil, AI aksiyonları, otomatik bakım.

**Test oluşturma:** Doğal dil adımlar; YAML repo; modüller / reusable flow; değişkenler; conditional step; JS assertion/branching; AI action / check / extract; görsel assertion + visual diff; MCP/Copilot (Cursor/Claude Code).

**Mobil:** Android emülatör; iOS simülatör (beta geçmişi); yerel/uzak sanal cihaz; APK upload + channel/tag; Native↔WebView geçiş; swipe/drag/orientation; geolocation mock; screen/element check; uninstall; video; Android AI Action; memory + failure recovery. **Android gerçek fiziksel cihaz** kamuya açık docs’ta yok.

**AI bakım:** Multi-modal step cache; locator auto-heal; cache revalidation; failure recovery + recovery step; quarantine; AI failure classification/summary; test memory; app graph; AI explore + child explorers; PR diff’ten test / coverage gap yönü.

**Koşum:** CLI; CI (GHA, CircleCI, Bitrise); video; view hierarchy; AI reasoning; heal/recovery events; network log + mock; feature flag override; run viewer; quarantine; CLI failure classification.

**Verdict açığı:** Güçlü taraf “nasıl yazılıp stabil koşturulur”. First-class görünmeyen: gerçek endüstriyel cihaz; app-internal business evidence; local DB/queue; remote business state; business-state fault injection; recovery correctness lattice; proof-carrying Final Oracle. AI authoring tehdidi yüksek; 4-katman transaction proof’a oturmuyor.

---

## 2. mabl

**Konum:** Web + native mobile + API; low-code → agentic; enterprise.

**Oluşturma:** Trainer; record-playback; agentic authoring; NL hedef; AI taslak; reusable flow; döngü/condition/branch; data-driven; değişken; API step; JS; Appium snippet; Playwright import.

**Mobil:** Android/iOS native; Java/Kotlin, Swift, RN, Flutter, hybrid; cloud emu/sim + yerel; Cloud Trainer; build/version; WebView; temiz state; virtual device/OS; app↔environment bağlama.

**AI:** Agentic generation; AI assertion; failure summary; investigation agent; geçmiş run chat; auto-heal; NL test arama; agentic runtime recovery; visual intelligence; GenAI/LLM çıktı değerlendirme.

**Operasyon:** Aynı suite’te web/mobile/API; plan/schedule/env/target; CI/CD; ad hoc cloud; parallel; screenshots/logs; Trainer replay; Jira; unified dashboard.

**Verdict açığı:** Ağırlık sanal cihaz + low-code operasyon. Occurrence UI/App/Local/Remote authority, local queue↔backend reconciliation, business-state fault injection birleşimi public yüzeyde yok. Unified platform + failure chat + agentic authoring ciddi rakip.

---

## 3. BrowserStack

**Konum:** Mobilde en büyük tehditlerden — gerçek cihaz scale + framework genişliği + AI + a11y + NFR diagnostics.

**Altyapı:** Gerçek Android/iOS; live + automated; native/hybrid; temiz oturum; secure tunnel; app upload/version; REST lifecycle; parallel; device/OS regex; gerçek cihaz özellikleri.

**Framework:** Appium, Espresso, XCUITest, Maestro, Detox, Flutter integration, mobile browser.

**AI:** Self-Healing; Failure Analysis; Smart Test Selection; NL Test Automation; AI authoring/analysis; change-aware orchestration; Low-Code self-heal.

**Koşul:** Bandwidth/latency/packet loss; offline/airplane; network profiles; geolocation; gestures; push; camera/device; enterprise resigning.

**Diagnostics:** Video; step screenshot; visual/text/automation log; logcat/syslog; network; CI console; performance benchmark; session dashboard; REST results; payload capture.

**Accessibility:** Gerçek cihazda a11y; workflow scanner; label/touch/contrast/magnification; WCAG; TalkBack/VoiceOver; health score; native/hybrid/cross-platform.

**Verdict açığı:** Altyapı genişliğiyle kısa vadede yarışma. Ayrışma:

```text
BrowserStack:  cihaz + execution + diagnostics
Verdict:       business transaction spec
             + app/local/remote proof
             + state-aware fault
             + deterministic Oracle
             + recovery/reproduction
```

Public yüzeyde DB/queue/backend outcome’u aynı occurrence altında formel hükme bağlayan model görülmedi. Yine de en ciddi platform rakiplerinden.

---

## 4. Sauce Labs

**Konum:** Real/virtual device + AI authoring + quality intelligence + production crash → “release assurance”.

**Execution:** Public/private RDC; emu/sim; Appium, Espresso, XCUITest/XCTest, Robotium; static/dynamic allocation; live; IDE device; Real Device Access API; parallel; app storage.

**Cihaz:** Camera injection; biometric sim; push; location; bg/fg; resigning; screenshot restriction bypass; multi-app preload.

**Network/perf:** Device-wide HTTP(S) capture; HAR; vitals (CPU/mem/UI); crash/error; live+auto diagnostics.

**AI:** Intent authoring; plain-language → executable; Insights; NL quality Q; failure patterns; build trends; device coverage; flaky detection; ranked failure; production RCA.

**Diğer:** Sauce Visual; app distribution/beta; error reporting; crash→Jira; web/mobile/PC/console errors; CI; çoğu Appium kodu değiştirilmeden.

**Verdict açığı:** “AI failure explanation” veya “network log” ile fark yaratılamaz. Savunulabilir alan: fault’u `PAYMENT_COMPLETED` ile `DELIVERY_PERSISTED` arasına uygulamak; UI/App/Local/Remote yükümlülüklerini aynı occurrence için doğrulamak. Domain-aware temporal proof public yüzeyde yok.

---

## 5. Kobiton

**Konum:** Gerçek cihaz + Appium + AI mobile-first.

**Özellikler:** Public/private lab; manual→Appium script; no-code; manuel testi başka cihazlarda replay; self-healing Appium; crash; visual; performance; compatibility; native/hybrid/mobile web; session diagnostics; AI create/prioritize/analyze; Claude içinden gerçek cihaz; AI workflow’lara cihaz; lab yönetimi; script-generation tech açık kaynak yönü.

**Verdict açığı:** “Gerçek cihaz + AI” tek başına benzersiz değil. Public anlatıda Appium/no-code/crash/visual/perf önde; local persistence, offline queue, backend reconciliation, temporal Final Oracle merkezde değil.

---

## 6. Perfecto

**Konum:** Enterprise gerçek cihaz + AI functional + diagnostics + cross-platform.

**Özellikler:** Real + virtual; manual/auto; native/hybrid/web/PWA; cross-browser; scriptless/low-code; Appium + native; reusable cross-platform; packaged/enterprise apps; autonomous AI gen; auto-heal; RCA; failure clustering; AI refactor; visual + semantic validation; console/network; coverage; network conditions; battery; orientation; call/SMS/bg interruptions; Open API; CI; pipeline steps; same-day device/OS service; dashboard.

**Verdict açığı:** “One test for everything” yarışına girme. Dikey avantaj: business transaction consistency, offline recovery, physical peripheral, exact fault boundary.

---

## 7. HeadSpin

**Konum:** Real-world digital experience / performance intelligence — mobil testten daha geniş.

**Özellikler:** Global gerçek cihaz; Android/iOS/web/OTT/automotive; functional/regression/performance; real-world network/location; automation + merkezi execution; AI performance insights; KPI; peer benchmark; synthetic monitoring; CPU/mem/battery/network; page/response/frame/launch; crash; video/audio experience; a11y; image injection; field-like dağılım; shared troubleshooting.

**Verdict açığı:** Performance/telemetry/lokasyonda öne geçmek zor. Telemetry ana moat değil:

```text
Business occurrence → performance evidence → Oracle/regression impact
```

Local/remote tutarlılığı formal Oracle ile doğrulama HeadSpin’in ana tezi değil.

---

## 8. Tricentis Tosca

**Konum:** Enterprise satışta en geniş rakiplerden (banka, telekom, ERP).

**Model-based:** Codeless; reusable business components; drag-drop; E2E process; web/mobile/API/DB/desktop/SAP/Salesforce/packaged/mainframe.

**AI:** Agentic TA; NL→test; asset analyze/reuse/merge; Vision AI; mockup’tan erken test; custom control training; self-heal; risk-based optimization.

**Mobil:** Native/hybrid/mobile web; Android/iOS; Appium’u codeless yüzeyle; E2E process parçası; Mobile Agent (iOS’u diğer OS’ten); UI+API aynı akış.

**Enterprise:** Service virtualization; Elastic Execution Grid; parallel; CI; a11y; test data; governance; qTest; NeoLoad; Data Integrity; SeaLights; SAP LiveCompare.

**Verdict açığı:** “Rakipler yalnız UI” **yanlış**. Fark: aynı mobil occurrence için canonical 4D evidence; device-local offline queue; business-state fault; recovery lattice; physical action lifecycle; exact repro; hafif Domain Pack ile mobil runtime derinliği. Tosca en geniş; Verdict daha dar ama daha derin.

---

## 9. Tricentis Testim Mobile

**Konum:** Tosca’dan çevik; custom app ekiplerine AI mobile automation.

**Özellikler:** Native Android/iOS; hybrid; RN; Flutter; WebView; mobile web; low-code record→visual editor; AI/ML smart + multi-attribute locator; resilient; visual validation; pre-built components; Appium custom action; JS/data-driven; Enhanced Mode (Appium’dan zengin hierarchy iddiası; RN/Flutter derin görüş); Virtual Mobile Grid; emu/sim; Standard Appium → local/physical/external grid; app library/version; plans; setup/teardown; console/network log; error aggregation; TestOps; CI; Jira/Trello/GitHub/Slack/webhook; Copilot (açıklama→step, kod açıklama, sorun çözme).

**Verdict açığı:** Enhanced Mode, Bridge hedef çözümlemesine doğrudan rakip. “Accessibility kullanıyoruz” yetmez. Fark: hedef bulunduktan sonra business effect’i SDK/local/remote ile doğrulamak.

---

## 10. Katalon

**Konum:** Giriş maliyeti + topluluk + low-code/code hibrit + web/mobile/API — güçlü mid-market.

**Özellikler:** Android/iOS native/hybrid/mobile web; record-playback + script; web/API/desktop; AI-assisted creation; self-heal (mobil locator + priority); autonomous agents; AI RCA; script gen/explain; custom keyword; troubleshooting; refactor; TestCloud real+virtual; live mobile; camera injection; biometric; IP/GPS geo; network throttle; device switch; screenshot/video; cross-browser/device; CI; reporting; Appium uzantı.

**Verdict açığı:** Feature count ile geçilemez. Critical mobile transaction proof + resilience depth ile ayrış.

---

## 11. Testsigma

**Konum:** Agentic AI + plain-English + gerçek cihaz bulutu, no-code.

**Özellikler:** NLP adımlar; Generator Agent; requirement→test; recorder; data-driven; reusable steps; self-heal; RCA yardımcısı; web/native/mobile web/API; cross-browser/device; Android/iOS; binlerce gerçek cihaz; sensor/touch/network/perf; parallel; CI; dashboard; E2E UI+API; manual→otomasyon; AI agent maintenance.

**Verdict açığı:** Genişlik + device önemli. Public set authoring/self-heal/execution ağırlıklı. Domain-specific temporal Oracle + cihaz içi persistence authority fark alanı.

---

## 12. testRigor

**Konum:** Selector yerine kullanıcı niyeti + plain-English generative AI.

**Özellikler:** Plain-English (çok dil); generative gen/exec/heal; düşük XPath/CSS bağımlılığı; user-intent; web/mobile web/native/hybrid/API/desktop/mainframe; visual; a11y; exploratory; AI/LLM app testing; functional/regression; APK/AAB upload; harici device farm; credentials/data; reusable rules; CI; reporting.

**Verdict açığı:** Doğal dilde yazmayı ana fark yapmak yanlış. Niyeti formal obligation’a derleyip cross-layer proof üretmek.

---

## 13. ACCELQ

**Konum:** Enterprise no-code, design-first, cloud-native.

**Özellikler:** Web/mobile/API/desktop/packaged/mainframe/microservices/SSH/MQ-ESB; cloud mobile; no-code/no-setup; complex E2E; design-first modelling; cross-tech; AI reliability/UI adapt; test data; reusable business process; collaboration; reporting; CI/toolchain; Autopilot; risk/change-aware selection; governance.

**Verdict açığı:** “API’ye de bakıyoruz” yetmez. Cihaz içi state + offline consistency + physical recovery aynı proof modelinde.

---

## 14. Autify / Aximo

**Konum:** No-code Autify → NL + görsel algılı otonom Aximo ajanı.

**Aximo:** NL hedef; otonom plan/yürütme; web/mobile/desktop; visual recognition; az selector; UI adapt; E2E gen; scriptless; Android/iOS; gerçek cihaz iddiası.

**Autify Mobile/Nexus:** No-code record; AI maintenance; cross-browser/device; native; real-device cloud; API; geo; multi-lang; env vars; shake; fg/bg; Xcode/iOS build; Playwright Nexus; NL oluşturma.

**Verdict açığı:** “AI app’i görüp test ediyor” yarışına girme → Momentic/Autify çarpışması. Ayrışma: AI fiziksel aksiyonunu deterministic evidence + recovery proof ile kapatmak.

---

## 15. Applitools

**Konum:** Visual AI kategori lideri — execution motorundan çok görsel doğrulama katmanı.

**Özellikler:** Eyes; akıllı (non-pixel-perfect) compare; layout/content/style ayırma; web/mobile/PDF; responsive; iOS/Android boyut; dynamic content; baseline; cross-browser/device; Ultrafast Grid; functional’a visual ekleme; a11y; Selenium/Appium entegrasyon; review/approval; CI; SDK’lar.

**Verdict açığı:** Visual AI yarışını kazanmaya çalışma. Zincir:

```text
UI visual state → app fact → local persistence → remote outcome
```

Visual diff evidence kaynağı; Final Oracle’ın tamamı değil.

---

## 16. QA Wolf

**Konum:** Ürün + hizmet: managed E2E yazma / koşturma / bakım.

**Özellikler:** Fully managed; QA/automation team; production-grade code; Playwright + Appium; web+mobile; Android emu; iOS gerçek cihaz; native; configurable CPU/RAM/screen/location/network; deterministic code; AI Mapping; generation; timing/UI/runtime auto-fix; multi-class self-heal; CI parallel; maintenance as service; bug reporting; launch/perf; widget/3rd-party; GenAI app testing; golden master; structured output; seeding; AI eval; bias/accuracy/relevance; managed coverage hedefleri.

**Verdict açığı:** Avantaj “sen uğraşma”. Domain Pack onboarding zor kalırsa managed tercih edilir. Onboarding süresi + müşteri başına özel kod oranı kritik.

---

## 17. Mobot

**Konum:** Mekanik robotlarla fiziksel kullanıcı davranışı.

**Özellikler:** Robot filosu; gerçek telefon/tablet; robotik dokunma; no-code talep; video upload senaryo; cihaz/OS seçimi; instructions; human CSM; schedule; side-by-side report; mobil web/native; orientation; multi-phone messaging; push; Bluetooth; MFA; kamera/donanım; web→ad→app handoff; gerçek gesture; managed service.

**Verdict açığı:** Accessibility `dispatchGesture` ≠ robotik fiziksel input. Verdict: app/local/backend evidence + hızlı deterministic execution. Peripheral HIL Lab gelişirse bazı alanlarda doğrudan rekabet.

---

## 18. Açık kaynak + kurum içi stack

Ticari olarak **en büyük rakip** olabilir: “neden Verdict, kendimiz kurarız.”

| Teknoloji | Özet |
|---|---|
| **Appium** | OSS; W3C; Android/iOS/browser/desktop/TV; UiAutomator2/XCUITest/Espresso/Flutter drivers; multi-lang; plugin/driver; image compare; device farm; gesture |
| **Maestro** | OSS YAML; Android/iOS/RN/Flutter/web beta; a11y UI-layer; built-in wait; UI settling; JS expr; HTTP; Studio; CLI; kolay CI |
| **Espresso** | Android-native; matchers/actions/assertions; auto sync + Idling Resource; WebView; Recycler helpers; a11y; intent stub; multi-process; gray-box |
| **XCTest/XCUITest** | iOS unit/UI/perf; Xcode; interaction/assert; setup/teardown; failure↔stack; perf regression |

Şirketlerin eklediği glue:

```text
Sentry/Datadog/New Relic
+ backend API checks
+ SQL/Mongo
+ CI/CD
+ custom dashboard
+ Appium/Maestro
+ BrowserStack/Sauce
```

Savunma: “bunu kimse yapamaz” değil — **occurrence-level proof + recovery + reproduction sözleşmesini tek üründe kurmanın pahalı ve uzun olması.**

---

## Table stakes — benzersiz diye satma

| Özellik | Durum |
|---|---|
| Doğal dille test oluşturma | Yaygın |
| Record-and-playback | Yaygın |
| Low-code / no-code | Yaygın |
| Self-healing locator | Yaygın |
| AI failure summary / RCA | Yaygınlaşıyor |
| Smart test selection | BrowserStack vb. |
| Gerçek cihaz / emu cloud | Yerleşik pazar |
| Video / screenshot | Standart |
| Network log / HAR | Standart enterprise |
| Device vitals | Birden fazla rakip |
| Visual AI | Applitools + platformlar |
| Accessibility scan | BrowserStack, Tricentis vb. |
| App graph / memory | Momentic + AI-native |
| API + UI test | Enterprise standart |
| Database / backend validation | Tosca / ACCELQ sınıfı |
| PR/diff test seçimi | Artık özgün değil |
| AI explorer / agent | Hızla yaygın |
| MCP / Cursor / Claude | Yaygınlaşmaya başladı |

---

## White-space — birleşik first-class yüzey

Tek tek parçalar farklı rakiplerde var. Araştırmada aşağıdaki zincirin **tamamını** birinci sınıf commercial product contract olarak birleştiren açık ürün yüzeyi görülmedi:

```text
Semantic business intent
→ typed temporal obligation
→ physical mobile action
→ app-internal evidence
→ local persistence/queue evidence
→ remote business evidence
→ exact business-state fault injection
→ recovery correctness verdict
→ proof-carrying run
→ automatic minimal reproducer
```

Bu “hiç kimse kurum içinde yapmıyor” veya “patent yok” demek değildir. Verdict’in en gerçekçi white-space’i burasıdır.

Master plan omurgası (Domain Pack, WorkflowIR v2, Bridge physical action lifecycle, Continue Gate, 4-katman Final Oracle, Evidence Journey, exact repro) bu alana oturur.

---

## Tehdit sırası

İndeks tablosu: [`README.md` §4](./README.md).

---

## Verdict’in sahiplenmesi gereken 8 alan

1. Proof-Carrying Mobile Transaction  
2. UI/App/Local/Remote occurrence correlation  
3. Typed Temporal Business Oracle  
4. Business-state synchronized fault injection  
5. Offline ve eventual-consistency recovery lattice  
6. Peripheral hardware-in-the-loop  
7. Failure Genome ve automatic minimal reproducer  
8. Evidence-generated investigation workspace  

> Rakipler testleri üretir, stabil çalıştırır ve neyin başarısız olduğunu analiz eder. Verdict kritik mobil işlemin cihaz ve backend boyunca gerçekten doğru sonuçlandığını kanıtlar, işlemi tam risk sınırında bozar ve hatayı yeniden üretilebilir bir karşı örneğe dönüştürür.
