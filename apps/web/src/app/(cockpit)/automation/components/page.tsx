import { AlertCircle } from 'lucide-react'
import { fetchVerdictDomainPack, fetchVerdictDomainPacks } from '@/lib/verdict-runtime/client'
import { selectLatestPublishedPacks } from '@/lib/verdict-runtime/domain-pack-detail'
import {
  ComponentRegistryView,
  type ComponentRegistryRow,
} from '@/components/automation/component-registry/ComponentRegistryView'
import { ProductPage } from '@/components/product'

export default async function ComponentRegistryPage() {
  let components: ComponentRegistryRow[]
  try {
    components = await loadComponentRows()
  } catch (error) {
    return (
      <ProductPage path="/automation/components" hideToolbar>
        <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 px-6 py-12 text-center">
          <AlertCircle className="mb-4 size-10 text-destructive" />
          <h3 className="text-lg font-semibold text-foreground">Failed to load component registry</h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {error instanceof Error ? error.message : String(error)}
          </p>
        </div>
      </ProductPage>
    )
  }

  return (
    <ProductPage path="/automation/components" hideToolbar>
      <ComponentRegistryView components={components} />
    </ProductPage>
  )
}

async function loadComponentRows(): Promise<ComponentRegistryRow[]> {
  const packs = await fetchVerdictDomainPacks()
  const rows: ComponentRegistryRow[] = []

  for (const pack of selectLatestPublishedPacks(packs.items)) {
    const detail = await fetchVerdictDomainPack(pack.packKey, pack.version)
    for (const screen of detail.screens ?? []) {
      rows.push({
        packKey: pack.packKey,
        version: pack.version,
        key: String(screen.screenKey),
        title: String(screen.displayName ?? screen.screenKey),
        kind: 'SCREEN',
      })
    }
    for (const surface of detail.surfaces ?? []) {
      rows.push({
        packKey: pack.packKey,
        version: pack.version,
        key: String(surface.surfaceKey),
        title: String(surface.displayName ?? surface.surfaceKey),
        kind: 'SURFACE',
      })
    }
    for (const target of detail.targets ?? []) {
      rows.push({
        packKey: pack.packKey,
        version: pack.version,
        key: String(target.targetKey),
        title: String(target.displayName ?? target.targetKey),
        kind: 'TARGET',
      })
    }
  }

  return rows.sort((left, right) => {
    const kindOrder = left.kind.localeCompare(right.kind)
    if (kindOrder !== 0) return kindOrder
    return left.title.localeCompare(right.title)
  })
}
