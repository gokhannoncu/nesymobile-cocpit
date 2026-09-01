import { AlertCircle } from 'lucide-react'
import { fetchVerdictDomainPack, fetchVerdictDomainPacks } from '@/lib/verdict-runtime/client'
import {
  capabilityAutomationOnly,
  capabilityContractDescription,
  capabilityContractKey,
  capabilityContractLayer,
  capabilityContractProvider,
  capabilityContractTitle,
  capabilityDetectionRef,
  capabilityRuntimeDetected,
  selectLatestPublishedPacks,
} from '@/lib/verdict-runtime/domain-pack-detail'
import {
  CapabilityRegistryView,
  type CapabilityRegistryRow,
} from '@/components/automation/capability-registry/CapabilityRegistryView'
import { ProductPage } from '@/components/product'

export default async function CapabilityContractsPage() {
  let capabilities: CapabilityRegistryRow[]
  try {
    capabilities = await loadCapabilityRows()
  } catch (error) {
    return (
      <ProductPage path="/automation/capabilities" hideToolbar>
        <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 px-6 py-12 text-center">
          <AlertCircle className="mb-4 size-10 text-destructive" />
          <h3 className="text-lg font-semibold text-foreground">Failed to load capability registry</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {error instanceof Error ? error.message : String(error)}
          </p>
        </div>
      </ProductPage>
    )
  }

  return (
    <ProductPage path="/automation/capabilities" hideToolbar>
      <CapabilityRegistryView capabilities={capabilities} />
    </ProductPage>
  )
}

async function loadCapabilityRows(): Promise<CapabilityRegistryRow[]> {
  const packs = await fetchVerdictDomainPacks()
  const rows: CapabilityRegistryRow[] = []

  for (const pack of selectLatestPublishedPacks(packs.items)) {
    const detail = await fetchVerdictDomainPack(pack.packKey, pack.version)
    for (const entry of detail.capabilities ?? []) {
      rows.push({
        packKey: pack.packKey,
        version: pack.version,
        key: capabilityContractKey(entry),
        title: capabilityContractTitle(entry),
        description: capabilityContractDescription(entry),
        layer: capabilityContractLayer(entry),
        provider: capabilityContractProvider(entry),
        runtimeDetected: capabilityRuntimeDetected(entry),
        automationOnly: capabilityAutomationOnly(entry),
        detectionRef: capabilityDetectionRef(entry),
      })
    }
  }

  return rows.sort((left, right) => {
    const layerOrder = left.layer.localeCompare(right.layer)
    if (layerOrder !== 0) return layerOrder
    return left.title.localeCompare(right.title)
  })
}
