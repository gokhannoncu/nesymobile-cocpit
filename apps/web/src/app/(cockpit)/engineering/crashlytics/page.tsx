'use client'

import { AlertTriangle, Bug, CheckCircle2, Info, Wrench } from 'lucide-react'
import {
  Callout,
  CardGrid,
  ComparisonTable,
  HeroCallout,
  InfoCard,
  PageSection,
  ProductPage,
  StatCard,
  StatGrid,
} from '@/components/product'

export default function CrashlyticsPage() {
  return (
    <ProductPage path="/engineering/crashlytics">
      <HeroCallout
        icon={Bug}
        eyebrow="Reliability & Operations"
        tone="orange"
        title="Crash visibility: where are we, what can't we see?"
        lead="Firebase Crashlytics is active in all flavors and release mapping upload is enabled — stack traces are readable. However, crash reporting is not centralized: recordException calls are scattered across ~30 files and the wrong Crashlytics constant is used on two screens. This page tracks both current numbers and infrastructure debt."
        chips={['Firebase BOM 32.7.4', 'Mapping upload: enabled', 'CW27 data']}
      />

      <PageSection
        eyebrow="Current Status"
        title="Country-based crash view (CW27)"
        icon={Bug}
        tone="orange"
        description="Crashlytics data was reported in the performance bulletin only for HR and SI; the weekly crash report for BA and RS is not yet included in the bulletin — the first visibility gap to be closed."
      >
        <StatGrid cols={4}>
          <StatCard label="HR · Crash-free" value="95.99%" tone="red" icon={Bug} hint="24 crashes / 23 users (7 days) · −2.6 points · 9 crashes on June 29" />
          <StatCard label="SI · Crash-free" value="100%" tone="green" icon={CheckCircle2} hint="Single crash in 7 days (June 24)" />
          <StatCard label="BA · Crash-free" value="—" tone="gray" icon={Info} hint="Not reported in bulletin" />
          <StatCard label="RS · Crash-free" value="—" tone="gray" icon={Info} hint="Not reported in bulletin" />
        </StatGrid>
      </PageSection>

      <PageSection
        eyebrow="Infrastructure"
        title="Status of crash reporting infrastructure"
        icon={Wrench}
        tone="amber"
      >
        <ComparisonTable
          headers={[{ label: 'Component' }, { label: 'Status' }, { label: 'Note' }]}
          rows={[
            ['Crashlytics SDK', '✅ Active', 'firebase-crashlytics-ktx · in all flavors, google-services.json per flavor (13 files)'],
            ['Mapping upload', '✅ Enabled', 'firebaseCrashlytics.mappingFileUploadEnabled true — release stack traces are deobfuscated'],
            ['Performance Monitoring', '✅ Active', 'firebase-perf — data source of weekly bulletin'],
            ['Central crash wrapper', '❌ None', 'recordException(e) manually called in ~30 files; no standard context key'],
            ['Custom keys', '⚠️ Partial', 'LoginFragment sets username/fullName/unitName — not in other screens'],
            ['Correct screen tag', '❌ 2 errors', 'CreateKTF and LeanLocker use wrong Crashlytics constant → logs written to another screen'],
            ['ANR visibility', '⚠️ Risky', 'allowMainThreadQueries + Gson parse (E4) produces ANR; ANRs are not reflected in crash count, must be tracked separately'],
          ]}
        />
      </PageSection>

      <PageSection eyebrow="Known Sources" title="Known patterns producing crashes" icon={AlertTriangle} tone="red">
        <CardGrid cols={3}>
          <InfoCard
            icon={Bug}
            tone="red"
            title="Missing @AndroidEntryPoint"
            desc="QuestionFragment and AskQuestionFragment use @Inject but have no annotation → runtime crash at startup."
            badges={[{ label: 'Phase 0 target' }]}
          />
          <InfoCard
            icon={Bug}
            tone="orange"
            title="observeForever leaks"
            desc="Camera (L735), Damage (L124/L214), CaseDetection, PudoLocker — memory bloat and crash in long sessions."
            badges={[{ label: 'Phase 0 target' }]}
          />
          <InfoCard
            icon={Bug}
            tone="amber"
            title="Notification + scan race"
            desc="Ticket 4484: crash during barcode scan after notification — related to E15/E31 patterns, repro steps in playbook."
            badges={[{ label: 'Open ticket' }]}
          />
        </CardGrid>
      </PageSection>

      <Callout icon={Wrench} title="Improvement order" tone="orange">
        (1) BA and RS crash-free rates are added to the weekly bulletin — four countries tracked in a single table.
        (2) Central CrashReporter wrapper: screen name + shipment/schedule ID standardized as custom key.
        (3) 2 screens using wrong constant are fixed. (4) ANR tracking (Firebase
        vitals) is included in bulletin scope.
      </Callout>
    </ProductPage>
  )
}
