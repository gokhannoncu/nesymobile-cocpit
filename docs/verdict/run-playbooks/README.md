# Verdict Run Playbook Sistemi

Bu klasör, master plandaki fazları AI agent'larla güvenli, izlenebilir ve restart-safe
şekilde işletmek için kullanılır. Master plan ne yapılacağını tarif eder; run playbook
ise bir fazın nasıl başlatılacağını, nerede kaldığını, hangi dosyalara dokunacağını,
hangi kanıtlarla tamamlanacağını ve başka agent'ların aynı işe nasıl devam edeceğini
tutar.

Her faz için iki ana dosya bulunur:

```text
docs/verdict/run-playbooks/phase-N/
├── RUN_PLAY.md
└── RESULT.md
```

## Borç (debt) playbook'ları

Bir faz kapandığı halde teslim edilmemiş işi kalmışsa, bu iş orijinal faz
dosyaları değiştirilmeden ayrı bir izde yürütülür:

```text
docs/verdict/run-playbooks/phase-N-debt/
├── RUN_PLAY.md
└── RESULT.md
```

Giriş noktası: [`DEBT_INDEX.md`](DEBT_INDEX.md) — hangi fazda ne eksik, bağımlılık
sırası ve harici engeller. Kritik yol `phase-5-debt` → `phase-6-debt`.

Bir borç maddesi ancak çalışan sistem üzerinde kanıt + regresyon testi + orijinal
RESULT satırının düzeltilmesi ile `RESOLVED` yazılır.

- `RUN_PLAY.md`: Faz başlamadan önce yazılır. Scope, recovery state, owned paths,
  yapılacak işler, yasaklar, verification komutları ve agent prompt'unu içerir.
- `RESULT.md`: Faz tamamlanırken veya ara kapanışlarda doldurulur. Ne yapıldı, hangi
  kanıt alındı, hangi dosyalar değişti, hangi testler geçti/kaldı, hangi işler sonraki
  faza kaldı bilgisini taşır.

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

## Agent isolation kuralı

Bir agent herhangi bir faz üzerinde çalışmaya başlamadan önce:

1. Master planı okur.
2. İlgili `RUN_PLAY.md` dosyasını okur.
3. Varsa ilgili `RESULT.md` dosyasını okur.
4. `git status --short` ile çalışma alanını kontrol eder.
5. `RUN_PLAY.md` içindeki `Owned Paths` dışına çıkacaksa önce bunu açıkça gerekçelendirir.

Aynı anda birden fazla agent çalışacaksa:

- Aynı dosya üzerinde paralel edit yapılmaz.
- Her agent kendi bounded work package'ini alır.
- Ortak dosya gerekirse tek agent owner olur, diğerleri sadece read-only kontrol yapar.
- Agent sonucu doğrudan “faz tamamlandı” sayılmaz; result dosyası evidence ile
  doldurulmadan acceptance geçmez.

## Faz oluşturma standardı

Yeni bir faz başlatılırken şu dosyalar oluşturulur:

```text
phase-N/RUN_PLAY.md
phase-N/RESULT.md
```

`RUN_PLAY.md` içinde en az şu alanlar olmalıdır:

- phase id
- status
- recovery state
- start/end timestamps
- last update
- master plan digest
- prerequisites
- owned paths
- read-only context paths
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
- changed files
- verification results
- skipped/deferred work
- blockers
- next phase handoff

## Mobile karşılığı

Mobile SDK / App Adapter / Bridge APK işleri ayrı playbook sisteminde tutulur:

```text
docs/verdict/mobile-run-playbooks/
```

Cockpit agent'ları Mobile repo'ya yazmaz; Mobile agent'ları Cockpit `apps/**` /
`packages/**` kodunu varsayılan olarak değiştirmez. Karşılıklı blocker ve handoff
notları ilgili RESULT dosyalarında taşınır.
