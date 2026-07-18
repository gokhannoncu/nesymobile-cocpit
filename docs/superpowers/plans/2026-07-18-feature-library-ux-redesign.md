# Feature Library UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/product/feature-library` as a domain-grouped, Core-first stacked catalog with rich cards, and align detail-page identity chrome.

**Architecture:** Keep `MODULES` as process ownership. Add `Feature.domainId` + `FEATURE_DOMAINS` catalog. List page groups by domain (CORE strip → related). Detail page shows domain breadcrumb/badges; prev/next is domain-ordered CORE-first.

**Tech Stack:** Next.js App Router, React client components, existing `@/components/product` tones/shell, `nesy.ts` product data.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-feature-library-ux-redesign-design.md`
- Do not rewrite Country Matrix / feature detail body content
- Do not add backend/API
- Stay in existing product visual language
- No git commits unless the user explicitly asks

---

## File map

| File | Responsibility |
| --- | --- |
| `apps/web/src/data/product/nesy-types.ts` | `FeatureDomainId`, `FeatureDomain`, `Feature.domainId` |
| `apps/web/src/data/product/feature-domains.ts` | `FEATURE_DOMAINS`, helpers `getFeatureDomain`, `listFeaturesByDomain` |
| `apps/web/src/data/product/nesy.ts` | Add `domainId` on every feature; re-export domain helpers |
| `apps/web/src/components/product/feature-catalog.tsx` | Rich card + domain section UI |
| `apps/web/src/components/product/index.ts` | Export catalog components |
| `apps/web/src/app/(cockpit)/product/feature-library/page.tsx` | Stacked catalog + filters |
| `apps/web/src/app/(cockpit)/product/feature-library/[slugName]/page.tsx` | Domain identity + ordered nav |

---

### Task 1: Domain types + feature `domainId` + helpers

**Files:**
- Modify: `apps/web/src/data/product/nesy-types.ts`
- Create: `apps/web/src/data/product/feature-domains.ts`
- Modify: `apps/web/src/data/product/nesy.ts`

**Interfaces:**
- Produces: `FEATURE_DOMAINS`, `getFeatureDomain(id)`, `listFeatureRecordsByDomain()`, each `Feature.domainId`

- [x] **Step 1:** Add domain types to `nesy-types.ts` per spec
- [x] **Step 2:** Create `feature-domains.ts` with catalog + helpers that flatMap `MODULES`
- [x] **Step 3:** Set `domainId` on every feature in `nesy.ts` using the approved map
- [x] **Step 4:** Verify TypeScript: every feature has `domainId`; helper returns 5 domains covering all features exactly once

### Task 2: Catalog UI primitives

**Files:**
- Create: `apps/web/src/components/product/feature-catalog.tsx`
- Modify: `apps/web/src/components/product/index.ts`

**Interfaces:**
- Consumes: Feature, Module, Country, tones, TagBadge, Link, isSupported
- Produces: `FeatureCatalogCard`, `FeatureDomainSection`

- [x] **Step 1:** Implement rich card (title, CORE, desc, process chip, country dots, risk, tickets, link)
- [x] **Step 2:** Implement domain section (header, Core strip, Related list)
- [x] **Step 3:** Export from `index.ts`

### Task 3: List page redesign

**Files:**
- Modify: `apps/web/src/app/(cockpit)/product/feature-library/page.tsx`

- [x] **Step 1:** Replace module BoardGrid with domain sections
- [x] **Step 2:** Sticky bar: search + domain jump + Core only + result count
- [x] **Step 3:** Retarget HeroCallout copy/chips
- [x] **Step 4:** Manual check against testing checklist items 1–7 in spec

### Task 4: Detail page identity + nav order

**Files:**
- Modify: `apps/web/src/app/(cockpit)/product/feature-library/[slugName]/page.tsx`

- [x] **Step 1:** Build featureRecords via `listFeatureRecordsByDomain()` (domain order, CORE-first)
- [x] **Step 2:** Update hero eyebrow/chips + back link context with domain
- [x] **Step 3:** Verify prev/next follows catalog order; Country Matrix untouched

---

## Spec coverage

| Spec requirement | Task |
| --- | --- |
| Domain taxonomy + map | 1 |
| `domainId` + FEATURE_DOMAINS | 1 |
| Stacked catalog + Core strip | 2, 3 |
| Rich cards | 2, 3 |
| Jump + search + Core only | 3 |
| Detail identity + domain-ordered nav | 4 |
| Preserve MODULES / Country Matrix | 1, 4 (no edits to matrix) |
