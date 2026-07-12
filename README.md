# Nesy Mobile Cockpit

Metronic Layout 21 tabanlı cockpit template'i. `glimo-cockpit` projesinin temel yapısından
(sidebar, header, content alanı, route yapısı) türetilmiştir; içerik barındırmaz.

## Yapı

```
├── apps/
│   ├── web/        # Next.js 15 (App Router) — cockpit arayüzü, port 3001
│   └── api/        # Fastify + Socket.io + Zod — backend, port 4001
├── packages/
│   ├── metronic/   # Layout 21: sidebar, header, toolbar + UI kit (shadcn tabanlı)
│   ├── ui/         # Ortak UI bileşenleri
│   ├── types/      # Paylaşılan TypeScript tipleri
│   ├── eslint-config/
│   └── typescript-config/
```

pnpm workspace + Turborepo monorepo. Paket scope'u: `@nesy/*`.

## Başlangıç

```bash
pnpm install
pnpm dev          # tüm uygulamalar (turbo)
```

- Web: http://localhost:3001
- API: http://localhost:4001 (health: `/health`)

## Navigasyon nasıl çalışır?

Menünün tek gerçek kaynağı: `packages/metronic/src/config/layout-21.config.tsx`

- `WORKSPACES` dizisindeki her kayıt sol ikon rayında bir workspace'tir
  (ikon, renk, kök route, ikincil menü).
- İkincil sidebar menüsü workspace'in `menu` alanından render edilir.
- Path'i olan her menü öğesi, gerçek bir sayfası yoksa otomatik olarak
  `apps/web/src/app/(cockpit)/[...slug]/page.tsx` placeholder'ına düşer.
- Gerçek sayfa eklemek için ilgili path altında `page.tsx` oluşturun
  (örn. `apps/web/src/app/(cockpit)/product/overview/page.tsx`).
- Breadcrumb'lar menü ağacından otomatik türetilir (`menu-utils.ts`).
- `Operations` workspace'i feature-flag arkasındadır:
  `NEXT_PUBLIC_NESY_OPS_ACCESS=true` (geliştirmede varsayılan açık).

## Özelleştirme noktaları

| Ne | Nerede |
| --- | --- |
| Marka logosu | `packages/metronic/src/components/layouts/layout-21/components/sidebar-header.tsx` |
| Menü / workspace'ler | `packages/metronic/src/config/layout-21.config.tsx` |
| Operations menüsü | `packages/metronic/src/config/operations.config.ts` |
| Tema renkleri | `apps/web/src/app/globals.css` |
| Site başlığı / metadata | `apps/web/src/app/layout.tsx` |
| Ana sayfa | `apps/web/src/app/(cockpit)/page.tsx` |

## Komutlar

```bash
pnpm dev          # geliştirme
pnpm build        # production build
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest
```
