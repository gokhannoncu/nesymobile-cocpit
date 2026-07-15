import re

file_path = "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/apps/web/src/data/engineering/field-tickets.ts"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

replacements = [
    ("// ── Kalıcı aksiyon havuzu ────────────────────────────────────────", "// ── Permanent action pool ────────────────────────────────────────"),
    (
        "    summary:\n      'JSON chunk → ilişkisel yapı. barcode UNIQUE INDEX ile O(log n) sorgu, shipment.sender ve stop.latitude/longitude normalize kolonları.',\n    verification: 'Büyük schedule (500+ stop) scan benchmark + ANR metriği; alan bazlı sorguların JSON parse içermediğinin kod denetimi.',",
        "    summary:\n      'JSON chunk → relational structure. O(log n) query with barcode UNIQUE INDEX, normalized columns for shipment.sender and stop.latitude/longitude.',\n    verification: 'Large schedule (500+ stops) scan benchmark + ANR metrics; code audit to verify field-based queries do not contain JSON parsing.',"
    ),
    (
        "    title: 'NESY-ARCH-001 — Normalize shipment şeması (ShipmentItemEntity + barcode index)',",
        "    title: 'NESY-ARCH-001 — Normalize shipment schema (ShipmentItemEntity + barcode index)',"
    ),
    (
        "    title: 'NESY-ARCH-002 — ScheduleIngestor atomik replace',",
        "    title: 'NESY-ARCH-002 — ScheduleIngestor atomic replace',"
    ),
    (
        "    summary: 'Schedule yazımı tek transaction içinde atomik replace; kısmi yazım ve chunk/SP bayat değer kombinasyonu ortadan kalkar.',\n    verification: 'Rota değişikliği regression testi: eski rotanın hiçbir kaynakta (Room/SP/bellek) kalmadığının doğrulanması.',",
        "    summary: 'Schedule writing with atomic replace in a single transaction; partial writing and chunk/SP stale value combinations are eliminated.',\n    verification: 'Route change regression test: verification that the old route does not remain in any source (Room/SP/memory).',"
    ),
    (
        "    summary:\n      \"UI tek kaynaktan (DAO Flow<List<T>>) reaktif beslenir; bellek state (currentTask vb.) kaldırılır, reason set/config app_config tablosuna taşınır.\",\n    verification: 'DELY sonrası tracking ekranı tutarlılık testi; process-death sonrası state restore testi.',",
        "    summary:\n      \"UI is fed reactively from a single source (DAO Flow<List<T>>); memory state (currentTask etc.) is removed, reason set/config is moved to app_config table.\",\n    verification: 'Tracking screen consistency test after DELY; state restore test after process death.',"
    ),
    (
        "    summary:\n      \"Her event UUID idempotency_key ile OutboxEventEntity'ye yazılır; SyncWorker FIFO gönderir. Telefon kapansa da event kaybolmaz, mükerrer gönderim yapısal olarak engellenir.\",\n    verification: 'App-kill / airplane-mode testleri: event kaybı 0; duplicate FCM/retry testinde backend tarafında tek event.',",
        "    summary:\n      \"Every event is written to OutboxEventEntity with a UUID idempotency_key; SyncWorker sends FIFO. Events are not lost even if the phone turns off, duplicate submissions are structurally prevented.\",\n    verification: 'App-kill / airplane-mode tests: event loss 0; single event on the backend side in duplicate FCM/retry test.',"
    ),
    (
        "    title: 'NESY-ARCH-005 — FCM işleme WorkManager ile serialize',",
        "    title: 'NESY-ARCH-005 — FCM processing serialized with WorkManager',"
    ),
    (
        "    summary: 'FCM refresh işlemleri tek worker kuyruğunda sıralı çalışır; UI mutasyonuyla eş zamanlı yazma çakışması kalkar.',\n    verification: 'Duplicate FCM + eş zamanlı UI aksiyonu race testi; çift TOUR reprodüksiyonunun negatife dönmesi.',",
        "    summary: 'FCM refresh operations run sequentially in a single worker queue; concurrent write collision with UI mutation is eliminated.',\n    verification: 'Duplicate FCM + concurrent UI action race test; negative reproduction of double TOUR.',"
    ),
    (
        "    title: 'ADR-05 — ScanCoordinator: tek scan giriş noktası',",
        "    title: 'ADR-05 — ScanCoordinator: single scan entry point',"
    ),
    (
        "    summary:\n      'Tüm barkod eventleri tek coordinator üzerinden screen-scoped BarcodeHandler\\'lara dağıtılır; coordinator-scoped in-memory dedup set (ADR-09) ile restart = temiz başlangıç.',\n    verification: 'Ekran geçişi anında scan testi (stop list → delivery); scan kaybı/yanlış ekran dispatch oranı 0.',",
        "    summary:\n      'All barcode events are distributed to screen-scoped BarcodeHandlers via a single coordinator; restart = clean start with coordinator-scoped in-memory dedup set (ADR-09).',\n    verification: 'Scan test during screen transition (stop list → delivery); scan loss / wrong screen dispatch rate 0.',"
    ),
    (
        "    title: 'ADR-07 — Outbox FIFO event zinciri (LCR→DDSP sıra garantisi)',",
        "    title: 'ADR-07 — Outbox FIFO event chain (LCR→DDSP sequence guarantee)',"
    ),
    (
        "    summary: 'Bağımlı event çiftleri (LCR→DDSP, CODC→CASH, DELY→fiscal) outbox içinde sıra garantisiyle gönderilir.',\n    verification: 'Paralel event üretim testi: backend\\'e varış sırasının her koşulda korunması.',",
        "    summary: 'Dependent event pairs (LCR→DDSP, CODC→CASH, DELY→fiscal) are sent in the outbox with sequence guarantee.',\n    verification: 'Parallel event generation test: arrival sequence to backend is preserved under all conditions.',"
    ),
    (
        "    summary:\n      'LockerProviderPolicy (Strategy) + LockerCapacityValidator + ayrık GSM validator: RDOC engeli, multicolli boyut kontrolü ve GSM kuralları tek noktada.',\n    verification: 'Servis kombinasyonu matrisi üzerinde parametrik unit testler (RDOC × multicolli × GSM).',",
        "    summary:\n      'LockerProviderPolicy (Strategy) + LockerCapacityValidator + separate GSM validator: RDOC block, multicolli size control, and GSM rules in one place.',\n    verification: 'Parametric unit tests over service combination matrix (RDOC × multicolli × GSM).',"
    ),
    (
        "    title: 'ADR-02 — God Object parçalama: ekran başına ViewModel',",
        "    title: 'ADR-02 — God Object breakdown: ViewModel per screen',"
    ),
    (
        "    summary: 'SharedViewModel/DeliveryFragment sorumlulukları ekran bazlı ViewModel + UseCase katmanına bölünür; UiEffect Channel ile tek seferlik efektler.',\n    verification: 'Bildirim sonrası scan crash reprodüksiyonu negatif; state sızıntısı (stale task) regression suite.',",
        "    summary: 'SharedViewModel/DeliveryFragment responsibilities are divided into screen-based ViewModel + UseCase layers; one-shot effects via UiEffect Channel.',\n    verification: 'Scan crash reproduction after notification is negative; state leak (stale task) regression suite.',"
    ),
    (
        "    title: 'Fiscal FSM — teslim → tahsilat → fiscal sıra makinesi',",
        "    title: 'Fiscal FSM — delivery → collection → fiscal sequence machine',"
    ),
    (
        "    summary:\n      'Fiscal üretimi durum makinesine bağlanır: teslim onaylanmadan fiscal kesilmez, stop bazında gruplanır, her fiş DB kilidi + idempotency ile tek etki üretir. Zaman penceresi kuralları sıralama garantisiyle değiştirilir.',\n    verification: \"Kısmi teslim, iptal (cancel fiscal), çoklu pickup ve reprint senaryolarında event log denetimi: 'VPFR var ama DELY yok' tutarsızlığı 0.\",",
        "    summary:\n      'Fiscal generation is bound to a state machine: fiscal is not generated without delivery confirmation, grouped on a stop basis, each receipt produces a single effect with DB lock + idempotency. Time window rules are replaced with a sequence guarantee.',\n    verification: \"Event log audit in partial delivery, cancellation (cancel fiscal), multi pickup, and reprint scenarios: 'VPFR exists but no DELY' inconsistency 0.\",",
    ),
    (
        "    title: 'Payment FSM — POS öncesi persist + recovery',",
        "    title: 'Payment FSM — pre-POS persist + recovery',"
    ),
    (
        "    summary:\n      \"Ödeme POS'a gönderilmeden önce DB'ye yazılır; uygulama açılışında yarım kalan ödemeler tamamlanır. CODC→CASH ikilisi outbox üzerinden sıralı gider; ödeme tipi normalize kaynaktan okunur.\",\n    verification: 'POS onayı sonrası app-kill testi: ödeme kaybı 0, çift tahsilat 0; gün sonu mutabakat farkı metriği.',",
        "    summary:\n      \"Payment is written to DB before being sent to POS; incomplete payments are finalized at app startup. CODC→CASH pair goes sequentially via outbox; payment type is read from a normalized source.\",\n    verification: 'App-kill test after POS confirmation: payment loss 0, double collection 0; end-of-day reconciliation difference metric.',"
    ),
    (
        "    title: 'Notification içerik UseCase + UiEffect + structured logging',",
        "    title: 'Notification content UseCase + UiEffect + structured logging',"
    ),
    (
        "    summary:\n      'Bildirim içeriği tek UseCase\\'te üretilir, navigasyon tek seferlik UiEffect ile yapılır (stop detayına deep-link), içerik hataları structured log/metrik ile görünür kılınır.',\n    verification: 'İçerik şablonu snapshot testleri + bildirim tıklama → doğru stop detayı E2E testi.',",
        "    summary:\n      'Notification content is generated in a single UseCase, navigation is done with a one-shot UiEffect (deep-link to stop details), content errors are made visible with structured log/metrics.',\n    verification: 'Content template snapshot tests + notification click → correct stop details E2E test.',"
    ),
    (
        "    title: 'ADR-10 — Konum OutlierFilter + koordinat normalize',",
        "    title: 'ADR-10 — Location OutlierFilter + normalize coordinates',"
    ),
    (
        "    summary: 'Speed+distance+accuracy tabanlı outlier filtresi; 0.0/geçersiz koordinat ayıklanır, stop.latitude/longitude normalize kolondan okunur.',\n    verification: 'Navigasyon intent testlerinde geçersiz koordinat oranı 0; saha GPS log örneklemi denetimi.',",
        "    summary: 'Speed+distance+accuracy based outlier filter; 0.0/invalid coordinates are filtered out, stop.latitude/longitude is read from normalized column.',\n    verification: 'Invalid coordinate rate 0 in navigation intent tests; field GPS log sampling audit.',"
    ),
    (
        "    title: 'ADR-13 — PermissionWatcher: runtime izin/servis izleme',",
        "    title: 'ADR-13 — PermissionWatcher: runtime permission/service monitoring',"
    ),
    (
        "    summary: 'Konum servisi/izin durumu runtime izlenir; kapalı/revoke durumunda UI uyarısı + yeniden talep akışı.',\n    verification: 'İzin revoke + servis kapatma senaryolarında uyarının göründüğü UI testi.',",
        "    summary: 'Location service/permission status is monitored at runtime; in case of disabled/revoke, UI warning + re-request flow.',\n    verification: 'UI test showing warning in permission revoke + service disabled scenarios.',"
    ),
    (
        "    summary:\n      'TOUR/PTOU/DELY event üretimi ekran kodundan çıkarılıp tek UseCase noktalarına alınır (outbox.enqueue ile); erteleme gibi akışlar event üretiminden ayrışır.',\n    verification: 'Pickup → PTOU, delivery → DELY event tipi unit testleri; postpone senaryosunda TOUR üretilmediğinin doğrulanması.',",
        "    summary:\n      'TOUR/PTOU/DELY event generation is moved out of screen code to single UseCase points (with outbox.enqueue); flows like postpone are separated from event generation.',\n    verification: 'Pickup → PTOU, delivery → DELY event type unit tests; validation that TOUR is not generated in postpone scenario.',"
    ),
    (
        "// ── Türetilmiş koleksiyonlar ─────────────────────────────────────",
        "// ── Derived collections ─────────────────────────────────────"
    ),
    (
        "// ── KPI'lar ──────────────────────────────────────────────────────",
        "// ── KPIs ──────────────────────────────────────────────────────"
    ),
    (
        "// ── Arama (serbest metin + key:value komutları) ──────────────────",
        "// ── Search (free text + key:value commands) ──────────────────"
    ),
    (
        "  // \"key:value\" ve \"key:\\\"çok kelime\\\"\" token'larını ayıkla",
        "  // Extract \"key:value\" and \"key:\\\"multi word\\\"\" tokens"
    ),
    (
        "// ── Hızlı filtreler & Saved Views ────────────────────────────────",
        "// ── Quick filters & Saved Views ────────────────────────────────"
    ),
    (
        "  { id: 'open', label: 'Açık', match: (t) => t.status === 'open' },\n  { id: 'crit', label: 'Kritik / Yüksek', match: (t) => t.severity !== 'medium' },\n  { id: 'repeat', label: 'Yüksek tekrar riski', match: (t) => t.repeatRisk === 'high' },\n  { id: 'wa', label: 'Workaround ile kapalı', match: (t) => t.status === 'closed' && t.fixType === 'workaround' },\n  { id: 'nofix', label: 'Kalıcı çözüm yok', match: (t) => t.fixType !== 'permanent' },\n  { id: 'lowconf', label: 'Kök nedeni belirsiz', match: (t) => t.confidence < 65 },\n  { id: 'finance', label: 'Finans & Ödeme', match: (t) => t.group === 'Finans & Ödeme' },",
        "  { id: 'open', label: 'Open', match: (t) => t.status === 'open' },\n  { id: 'crit', label: 'Critical / High', match: (t) => t.severity !== 'medium' },\n  { id: 'repeat', label: 'High repeat risk', match: (t) => t.repeatRisk === 'high' },\n  { id: 'wa', label: 'Closed with workaround', match: (t) => t.status === 'closed' && t.fixType === 'workaround' },\n  { id: 'nofix', label: 'No permanent fix', match: (t) => t.fixType !== 'permanent' },\n  { id: 'lowconf', label: 'Unclear root cause', match: (t) => t.confidence < 65 },\n  { id: 'finance', label: 'Finance & Payment', match: (t) => t.group === 'Finance & Payment' },"
    ),
    (
        "    desc: 'Kritik/yüksek + yüksek tekrar riski — kalıcı aksiyonu açık kayıtlar',",
        "    desc: 'Critical/high + high repeat risk — permanent action is open records',"
    ),
    (
        "    desc: 'Kök neden teşhisi düşük güvenli (confidence < 65)',",
        "    desc: 'Root cause diagnosis with low confidence (confidence < 65)',"
    ),
    (
        "    desc: 'Ticket kapalı, workaround var, kalıcı çözüm yok',",
        "    desc: 'Ticket closed, has workaround, no permanent fix',"
    ),
    (
        "    desc: 'Aynı kanonik kök nedene bağlı 3+ ticket',",
        "    desc: '3+ tickets linked to the same canonical root cause',"
    ),
    (
        "    desc: 'Ödeme, fiscal ve mutabakat güvenliğini etkileyen kayıtlar',\n    match: (t) => ['RC-09', 'RC-10', 'RC-11', 'RC-12'].includes(t.rootCause) || t.group === 'Finans & Ödeme',",
        "    desc: 'Records affecting payment, fiscal, and reconciliation safety',\n    match: (t) => ['RC-09', 'RC-10', 'RC-11', 'RC-12'].includes(t.rootCause) || t.group === 'Finance & Payment',"
    ),
    (
        "    desc: 'Müdahale uygulanmış ancak doğrulaması yapılmamış kayıtlar',",
        "    desc: 'Records with intervention applied but verification pending',"
    )
]

# We must ensure we catch every Turkish character string.
# A regex search for non-ascii characters (excluding symbols, standard ascii) can be helpful to verify.

new_content = content
for old_s, new_s in replacements:
    if old_s not in new_content:
        print(f"WARNING: string not found:\n{old_s}")
    new_content = new_content.replace(old_s, new_s)

# Find remaining Turkish characters
turkish_chars = re.compile(r'[ğüşöçıİĞÜŞÖÇ]')
matches = turkish_chars.findall(new_content)
if matches:
    print(f"Turkish characters still remaining: {set(matches)}")
    # Print out lines with remaining turkish characters
    for i, line in enumerate(new_content.split('\n')):
        if turkish_chars.search(line):
            print(f"Line {i+1}: {line}")
else:
    print("No Turkish characters remain!")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

