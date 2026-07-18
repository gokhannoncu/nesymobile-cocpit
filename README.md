# Nesy Mobile Cockpit

Metronic Layout 21 tabanlı cockpit. pnpm workspace + Turborepo monorepo (`@nesy/*`).

| Uygulama | Port |
| --- | --- |
| Web (`apps/web`) | http://localhost:4002 |
| API (`apps/api`) | http://localhost:4001 (`/health`) |

---

## Setup (Windows)

Kurulum katmanlıdır. İlk katman UI + API’yi ayağa kaldırır; sonrakiler cihaz, veri ve otomasyon özelliklerini açar.

### 1 — Temel (zorunlu)

| Araç | Sürüm / not |
| --- | --- |
| Git | Repo klonlamak için |
| Node.js | **≥ 20** (`package.json` `engines`) |
| pnpm | **≥ 9** (repo: `pnpm@9.15.4`) |

```powershell
# Node.js LTS (yoksa)
winget install OpenJS.NodeJS.LTS

# pnpm (Corepack ile — Node 20+ ile gelir)
corepack enable
corepack prepare pnpm@9.15.4 --activate

# Doğrulama
node -v    # v20+
pnpm -v    # 9.x
```

```powershell
git clone <repo-url>
cd NesyMobileCocpit
pnpm install
pnpm dev
```

`pnpm dev` / `pnpm prod` sessiz NESY Cockpit status paneli açar (DB / API / Web). Ham Turbo logları için: `node scripts/cockpit-runner.mjs --mode dev --verbose`. `predev` / `preprod` dolu portları temizler.

Bu katman yeterliyse: arayüz ve API çalışır. Shipment / Prisma verisi, ADB cihaz araçları ve Maestro koşuları için aşağıdaki katmanlar gerekir.

### 2 — Veri (PostgreSQL)

Uygulama veritabanı **PostgreSQL** (Prisma). Cihaz üzerindeki SQLite dosyalarıyla karıştırmayın (onlar katman 3).

```powershell
# Örnek: PostgreSQL kurulumu
winget install PostgreSQL.PostgreSQL
```

`packages/db` altında `.env` oluşturun (veya mevcut ekip `.env`’ini kullanın):

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/DB_NAME"
```

```powershell
pnpm --filter @nesy/db generate
# şema senkronu (geliştirme):
pnpm --filter @nesy/db db:push
# veya migrate:
pnpm --filter @nesy/db migrate:dev
```

Shipment, happy-path, otomasyon geçmişi gibi özellikler `DATABASE_URL` olmadan hata verir.

### 3 — Cihaz (ADB + sqlite3)

Cihaz listesi, logcat, network stream, cihaz DB okuma vb. için host’ta **`adb`** ve cihaz DB sorguları için **`sqlite3`** CLI gerekir.

#### ADB (Android platform-tools)

```powershell
winget install Google.PlatformTools

# Doğrulama
adb version
adb devices
```

Bulunamazsa ortam değişkeni:

```powershell
# Örnek yollar (kuruluma göre ayarlayın)
setx ADB_PATH "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"
# veya
setx ADB_PATH_WINDOWS "C:\Android\platform-tools\adb.exe"
```

Proje sırayla şunlara bakar: `ADB_PATH` → `ADB_PATH_WINDOWS` / `ADB_PATH_WIN32` → bilinen konumlar → `PATH`.

USB debugging açık bir cihaz veya emülatör bağlayın; `adb devices` listede görünmeli.

#### sqlite3 CLI

Uygulama DB’si değil; ADB ile çekilen Android SQLite dosyalarını okumak için.

```powershell
# Scoop ile (önerilir)
scoop install sqlite

# veya https://sqlite.org/download.html — sqlite-tools zip; sqlite3.exe PATH'e ekleyin

sqlite3 --version
```

İsteğe bağlı sabit yol:

```powershell
setx SQLITE3_PATH "C:\Program Files\SQLite\sqlite3.exe"
# veya
setx SQLITE3_PATH_WINDOWS "C:\path\to\sqlite3.exe"
```

### 4 — Otomasyon (Maestro)

Cockpit’te Maestro YAML / flow editörü kullanılır. Flow’ları CLI ile koşturmak için:

1. **Java 17+** (`JAVA_HOME` ayarlı olsun)
2. **Maestro CLI** — [resmi kurulum](https://docs.maestro.dev/maestro-cli/how-to-install-maestro-cli)

Windows’ta özet:

1. [GitHub Releases](https://github.com/mobile-dev-inc/maestro/releases) üzerinden `maestro.zip` indirin
2. Örn. `C:\maestro` altına çıkarın
3. `C:\maestro\bin` klasörünü `PATH`’e ekleyin
4. Yeni terminalde: `maestro --help`

Maestro cihazla konuştuğu için katman 3 (ADB) de kurulu olmalıdır.

### İsteğe bağlı — Claude Code CLI

MongoDB Query Generator gibi Claude CLI kullanan özellikler için [Claude Code](https://docs.anthropic.com/en/docs/claude-code) kurulu ve `PATH`’te olmalı. İsteğe bağlı:

```env
CLAUDE_CLI_PATH=C:\path\to\claude.exe
```

---

## Çalıştırma

```powershell
pnpm install   # ilk kurulum / bağımlılık güncellemesi
pnpm dev       # web :4002 + api :4001
```

| Komut | Açıklama |
| --- | --- |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest |

---

## Yapı

```
├── apps/
│   ├── web/        # Next.js 15 — cockpit UI (:4002)
│   └── api/        # Fastify + Socket.io + Zod (:4001)
├── packages/
│   ├── metronic/   # Layout 21 + UI kit
│   ├── db/         # Prisma / PostgreSQL
│   ├── platform-paths/  # ADB vb. platform yolu çözümleme
│   ├── ui/
│   ├── types/
│   ├── eslint-config/
│   └── typescript-config/
```

Menü kaynağı: `packages/metronic/src/config/layout-21.config.tsx`.
Operations workspace: `NEXT_PUBLIC_NESY_OPS_ACCESS=true` (geliştirmede varsayılan açık).
