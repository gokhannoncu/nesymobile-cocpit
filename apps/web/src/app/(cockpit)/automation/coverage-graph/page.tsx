import { AlertCircle } from 'lucide-react'
import { fetchVerdictDomainPack, fetchVerdictDomainPacks } from '@/lib/verdict-runtime/client'
import { countReleaseGateTests } from '@/lib/verdict-runtime/coverage-graph'
import { selectLatestPublishedPacks } from '@/lib/verdict-runtime/domain-pack-detail'
import {
  CoverageGraphView,
  type CoverageGraphRow,
} from '@/components/automation/coverage-graph/CoverageGraphView'
import { ProductPage } from '@/components/product'

export default async function CoverageGraphPage() {
  let rows: CoverageGraphRow[]
  try {
    rows = await loadCoverageRows()
  } catch (error) {
    return (
      <ProductPage path="/automation/coverage-graph" hideToolbar>
        <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 px-6 py-12 text-center">
          <AlertCircle className="mb-4 size-10 text-destructive" />
          <h3 className="text-lg font-semibold text-foreground">Failed to load coverage graph</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {error instanceof Error ? error.message : String(error)}
          </p>
        </div>
      </ProductPage>
    )
  }

  return (
    <ProductPage path="/automation/coverage-graph" hideToolbar>
      <CoverageGraphView rows={rows} />
    </ProductPage>
  )
}

async function loadCoverageRows(): Promise<CoverageGraphRow[]> {
  const packs = await fetchVerdictDomainPacks()
  const rows: CoverageGraphRow[] = []

  for (const pack of selectLatestPublishedPacks(packs.items)) {
    const detail = await fetchVerdictDomainPack(pack.packKey, pack.version)
    const testProfiles = detail.testProfiles ?? []

    rows.push({
      packKey: pack.packKey,
      version: pack.version,
      displayName: detail.displayName?.trim() ? detail.displayName.trim() : null,
      features: detail.features?.length ?? 0,
      screens: detail.screens?.length ?? 0,
      surfaces: detail.surfaces?.length ?? 0,
      targets: detail.targets?.length ?? 0,
      evidence: detail.evidenceSources?.length ?? 0,
      tests: testProfiles.length,
      releaseGateTests: countReleaseGateTests(testProfiles),
    })
  }

  return rows.sort((left, right) => left.packKey.localeCompare(right.packKey))
}
