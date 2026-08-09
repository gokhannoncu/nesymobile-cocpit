# Verdict Mobile Run Playbook Sistemi

Bu klasör, master plandaki **Mobile SDK + Nesy App Adapter + Bridge APK** işlerini
AI agent'larla güvenli, izlenebilir ve restart-safe şekilde işletmek için kullanılır.

Cockpit tarafındaki eşdeğer sistem:

```text
docs/verdict/run-playbooks/
```

Master plan ne yapılacağını tarif eder; mobile run playbook ise bir fazın nasıl
başlatılacağını, nerede kaldığını, hangi Mobile/Bridge dosyalarına dokunacağını,
hangi kanıtlarla tamamlanacağını ve başka agent'ların aynı işe nasıl devam
edeceğini tutar.

## İki-repo modeli

Playbook dosyaları **Cockpit** reposunda yaşar; uygulama işi **NesyMobile**
reposunda yapılır.

| Rol | Repo | Tipik path |
|---|---|---|
| Playbook SSOT | `NesyMobileCocpit` | `docs/verdict/mobile-run-playbooks/` |
| Master plan | `NesyMobileCocpit` | `docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md` |
| Mobile SSOT | `NesyMobile` | `verdict-status.json` |
| SDK / App Adapter | `NesyMobile` | `verdict-*`, `app/src/automation/**` |
| Bridge APK | `NesyMobile` | `verdict-bridge/**` |
| Cockpit host (read-only) | `NesyMobileCocpit` | `packages/bridge-*`, `domain-packs/**` |

Mobile agent, Cockpit `apps/**` / `packages/**` kodunu varsayılan olarak **yazmaz**.
Cockpit contract/fixture değişikliği gerekiyorsa bunu RESULT'a yazar ve Cockpit
run-playbook owner'ına handoff eder.

Beklenen Mobile repo kökü (yerel):

```text
/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile
```

## Dosya düzeni

Her faz için iki ana dosya bulunur:

```text
docs/verdict/mobile-run-playbooks/phase-N/
├── RUN_PLAY.md
└── RESULT.md
```

- `RUN_PLAY.md`: Faz başlamadan önce yazılır. Scope, recovery state, owned paths,
  yapılacak işler, yasaklar, verification komutları ve agent prompt'unu içerir.
- `RESULT.md`: Faz tamamlanırken veya ara kapanışlarda doldurulur. Ne yapıldı,
  hangi kanıt alındı, hangi dosyalar değişti, hangi testler geçti/kaldı, hangi
  işler sonraki faza kaldı bilgisini taşır.

## Canlı ilerleme board

```text
docs/verdict/mobile-run-playbooks/PROGRESS.md
```

Faz kapanışında `RESULT.md` ile birlikte `PROGRESS.md` güncellenir.
Master plan `faz-*` YAML status’u Cockpit FAZ içindir; Mobile M\* ile karıştırılmaz.

## Faz haritası (Mobile / Bridge)

Cockpit faz numaralarıyla hizalıdır; içerik Mobile/Bridge teslimine göredir.

| Faz | Ad | Odak | Başlama koşulu | Board |
|---|---|---|---|---|
| **M0** | Baseline + envanter + gap | Seam envanteri, named-query/evidence matrisi, release isolation | Hemen | `COMPLETED` |
| **M1** | SDK auth / session lifecycle fixture | `hello/auth`, `set_run`/`end_run`, secret rotation | M0 sonrası | `COMPLETED` |
| **M2** | EmitOutcome + WAL/ACK diagnostic | Recursive olmayan EmitOutcome diagnostic query | M1 sonrası | `COMPLETED` |
| **M3** | Bridge B2 protocol | `capabilities`, `wait_any`, `cancel_request` | Host foundation + fake host | `COMPLETED` |
| **M4A** | Core contract thin gate | CP4A tüketim + Bridge leakage tarama | Cockpit CP4A COMPLETED | `COMPLETED` |
| **M4B** | Nesy App Adapter production | Named query, evidence, scanner, launch, manifest | M0 + CP4B + M4A | `COMPLETED` |
| **M4C** | Pack ↔ adapter ↔ Bridge uyumu | Compatibility / fixture | M4B + Cockpit 4C | `COMPLETED` |
| **M5** | Correlation + recovery | monoTs, recovery named-query | M3 + M4B | `COMPLETED` |
| **M6** | Inspector destek | dump/screenshot redaction | M3 + M5 | `COMPLETED` |
| **M7** | Gerçek akış + release isolation | Real Nesy flows | M4B + M5; DUT | `READY_WITH_EXTERNAL_BLOCKERS` |
| **M8** | DUT fault kabulü | Process kill, fencing, IME | M3 + M7; lab DUT | `BLOCKED_EXTERNAL` |
| **M9** | Legacy temizliği | Maestro kalıntısı | Cutover sonrası | `NOT_STARTED` |

## State modeli

Run playbook ve result dosyalarında aynı state dili kullanılır:

| State | Anlam |
|---|---|
| `NOT_STARTED` | Dosya hazır ama faz başlamadı. |
| `READY` | Başlamak için ön koşullar kontrol edildi. |
| `IN_PROGRESS` | Aktif çalışma var. |
| `PAUSED` | Bilinçli ara verildi; devam etmek mümkün. |
| `BLOCKED` | Devam için dış karar, eksik yetki, eksik bilgi veya kırık ön koşul var. |
| `COMPLETED` | Faz acceptance kriterleri kanıtla tamamlandı. |
| `FAILED` | Faz denendi ama acceptance geçmedi. |
| `ABANDONED` | Faz artık uygulanmayacak veya plan değişti. |

Readiness etiketleri:

| Etiket | Anlam |
|---|---|
| `READY` | Sonraki faz başlayabilir. |
| `READY_WITH_BLOCKERS` | Başlanabilir; repo-içi borçlar RESULT'ta. |
| `READY_WITH_EXTERNAL_BLOCKERS` | Başlanabilir; DUT/lab/external borç açık. |
| `NOT_EVALUATED` | Henüz karar verilmedi. |
| `BLOCKED_PRECONDITION` | Önceki faz/gate eksik. |

## Agent isolation kuralı

Bir agent herhangi bir Mobile faz üzerinde çalışmaya başlamadan önce:

1. Master planı okur.
2. İlgili `mobile-run-playbooks/phase-N/RUN_PLAY.md` dosyasını okur.
3. Varsa ilgili `RESULT.md` dosyasını okur.
4. İlgili Cockpit `run-playbooks/phase-N/RESULT.md` handoff/blocker notlarını okur.
5. `NesyMobile` ve gerekirse Cockpit'te `git status --short` kontrol eder.
6. `RUN_PLAY.md` içindeki `Owned Paths` dışına çıkacaksa önce bunu açıkça gerekçelendirir.

Aynı anda birden fazla agent çalışacaksa:

- Aynı dosya üzerinde paralel edit yapılmaz.
- Bridge (M3) ve App Adapter inventory (M0/M4B prep) ayrı work package olabilir.
- Ortak contract yüzeyi gerekirse tek agent owner olur.
- Agent sonucu doğrudan “faz tamamlandı” sayılmaz; RESULT evidence ile
  doldurulmadan acceptance geçmez.
- Cockpit playbook'ta `Mobile repo: DOKUNULMADI` yazısı varsa Mobile fazın
  o işi üstlendiği varsayılır; çift implementasyon yazılmaz.

## Faz oluşturma standardı

Yeni bir faz başlatılırken şu dosyalar oluşturulur:

```text
phase-N/RUN_PLAY.md
phase-N/RESULT.md
```

`RUN_PLAY.md` içinde en az şu alanlar olmalıdır:

- phase id (`verdict-mobile-phase-N-run-play`)
- status / recovery state
- start/end timestamps
- master plan digest
- prerequisites / cockpit phase cross-ref
- owned paths (NesyMobile)
- read-only context paths (Cockpit + Mobile)
- out-of-scope
- step checklist
- expected file changes
- verification commands
- rollback/recovery notes
- semantic AI prompt

`RESULT.md` içinde en az şu alanlar olmalıdır:

- result state
- started/completed timestamps
- executed steps
- changed files (Mobile + playbook)
- verification results
- skipped/deferred work
- blockers (özellikle B-12, B-13, CP3-DUT, CP0)
- next phase handoff
- Cockpit playbook'a bildirilecek external blocker güncellemesi

## Cockpit ↔ Mobile eşlemesi

| Cockpit playbook | Mobile playbook | İlişki |
|---|---|---|
| `run-playbooks/phase-0` | `mobile-run-playbooks/phase-0` | SSOT/baseline karşılıklı |
| `run-playbooks/phase-1` | `mobile-run-playbooks/phase-1` | Auth contract: host vs SDK fixture |
| `run-playbooks/phase-2` | `mobile-run-playbooks/phase-2` | Durable host vs EmitOutcome diagnostic |
| `run-playbooks/phase-3` | `mobile-run-playbooks/phase-3` | Host foundation vs Bridge APK B2 |
| `run-playbooks/phase-4a` | `mobile-run-playbooks/phase-4a` | Core IR; Mobile neredeyse yok |
| `run-playbooks/phase-4b` | `mobile-run-playbooks/phase-4b` | Pack contract vs App Adapter implementation |
| `run-playbooks/phase-4c` | `mobile-run-playbooks/phase-4c` | Compiler vs capability/fixture uyumu |
| `run-playbooks/phase-5` | `mobile-run-playbooks/phase-5` | Executor/Oracle vs device evidence/recovery |
| `run-playbooks/phase-6` | `mobile-run-playbooks/phase-6` | Inspector UI vs Bridge/App mapping |
| `run-playbooks/phase-7` | `mobile-run-playbooks/phase-7` | Real workflow acceptance (ortak DUT) |
| `run-playbooks/phase-8` | `mobile-run-playbooks/phase-8` | Cutover/DUT fault acceptance (ortak) |

## Sert yasaklar (tüm Mobile fazlar)

- Production APK'ya Verdict automation SDK / Bridge automation yüzeyi sızdırma.
- Injected scanner veya `DIRECT_STATE`'i release build'e alma.
- Arbitrary SQL named-query yerine koyma; yalnız allowlisted named query.
- Core/Bridge contract'a `STOP` / `PARCEL` / `OPEN_STOP` business type sokma.
- İkinci paralel App Adapter yazma; mevcut `NesyCommands` / `NesyStateProvider` /
  `roomQueries` / structured event refactor edilir.
- Event yokluğundan SDK failure tahmin etme; EmitOutcome diagnostic gerekir.
- `wait_any` hot path'te full accessibility dump / fixed polling.
- Process-death sonrası otomatik gesture retry; `UNKNOWN_EFFECT` + reconciliation.
- Cockpit `apps/**` / production runtime'ını Mobile fazında sessizce değiştirme.

## Nasıl başlanır?

Önerilen ilk sıra (şimdi yapılabilir):

```text
M0  inventory / gap / isolation baseline
M3  Bridge B2 (fake host ile paralel)
M1  SDK auth fixture uyumu
M2  EmitOutcome diagnostic
M4B App Adapter production (Cockpit 4B contract hazır)
```

Bir agent için tipik komut:

```text
Verdict Mobile Phase N'yi uygula.
Önce docs/verdict/mobile-run-playbooks/phase-N/RUN_PLAY.md dosyasını tamamen oku.
Sonra RESULT.md dosyasını oku ve durumu güncelle.
Owned paths dışına çıkma. Fake-pass yazma.
```
