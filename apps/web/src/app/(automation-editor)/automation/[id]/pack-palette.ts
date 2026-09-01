import type { SemanticActionApi, SemanticActionCatalogApi } from '@/lib/verdict-runtime/types'
import { nodeToneByType, paletteItemFromType, type WorkflowPaletteCategory } from './workflow-registry'
import { WorkflowNodeType, type PaletteItem } from './workflow-types'

const CAPABILITY_UNAVAILABLE_REASON =
  'Bridge B2 capability negotiation not available on this device'

/** Known screen keys → short human labels for the left palette. */
const SCREEN_LABEL_OVERRIDES: Record<string, string> = {
  'nesy.auth.login': 'Login',
  'nesy.route.stop-list': 'Route stop list',
  'nesy.stop.task-list': 'Stop tasks',
  'nesy.delivery.flow': 'Delivery flow',
  'nesy.pickup.flow': 'Pickup flow',
  'nesy.vehicle-loading': 'Vehicle loading',
  'nesy.end-of-day': 'End of day',
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatRefSegment(ref: string): string {
  const override = SCREEN_LABEL_OVERRIDES[ref]
  if (override) return override
  const segment = ref.split('.').pop() ?? ref
  return titleCase(segment.replace(/-/g, ' '))
}

export function formatPaletteScreenGroup(screenKey: string): { title: string; detail?: string } {
  if (screenKey === 'All screens') {
    return { title: 'All screens' }
  }
  const refs = screenKey.split(' · ').map((ref) => ref.trim()).filter(Boolean)
  const labels = refs.map(formatRefSegment)
  return {
    title: labels.length === 1 ? labels[0]! : labels.join(' · '),
    detail: screenKey,
  }
}

export function formatPaletteApplicationTitle(appRef: string): { title: string; detail?: string } {
  if (!appRef || appRef === 'unscoped') {
    return { title: 'Unscoped actions' }
  }
  const parts = appRef.split('.')
  const leaf = parts[parts.length - 1] ?? appRef
  const leafLabel = titleCase(leaf.replace(/-/g, ' '))
  if (parts[0] === 'nesy' && parts.length >= 2) {
    return {
      title: `Nesy ${leafLabel}`,
      detail: appRef,
    }
  }
  return { title: leafLabel, detail: appRef }
}

export function paletteItemFromSemanticAction(action: SemanticActionApi): PaletteItem {
  const blocked = !action.capabilityStatus.satisfied
  const reason =
    action.capabilityStatus.reason ??
    (action.capabilityStatus.missing.length > 0
      ? `missing: ${action.capabilityStatus.missing.join(', ')}`
      : CAPABILITY_UNAVAILABLE_REASON)

  return {
    type: WorkflowNodeType.SEMANTIC_ACTION,
    paletteKey: action.actionKey,
    actionKey: action.actionKey,
    title: action.displayName,
    subtitle: action.businessMeaning,
    businessMeaning: action.businessMeaning,
    notResponsibleFor: action.notResponsibleFor,
    icon: 'Zap',
    tone: nodeToneByType.action,
    kind: 'action',
    defaultConfig: {
      actionKey: action.actionKey,
      applicationRef: action.applicationRef,
      targetRefs: [...action.targetRefs],
      requiredCapabilityRefs: [...action.requiredCapabilityRefs],
    },
    paletteDisabled: blocked,
    paletteDisabledReason: blocked ? reason : undefined,
  }
}

/**
 * Build left-palette groups from a published pack catalog.
 * Groups by applicationRef; screenRefs become subsection titles when present.
 */
export function buildPackPaletteGroups(
  catalog: SemanticActionCatalogApi,
): WorkflowPaletteCategory[] {
  const byApp = new Map<string, SemanticActionApi[]>()
  for (const action of catalog.items) {
    const key = action.applicationRef || 'unscoped'
    const list = byApp.get(key)
    if (list) list.push(action)
    else byApp.set(key, [action])
  }

  const groups: WorkflowPaletteCategory[] = []
  for (const [appRef, actions] of byApp) {
    const appHeading = formatPaletteApplicationTitle(appRef)
    const byScreen = new Map<string, SemanticActionApi[]>()
    for (const action of actions) {
      const screenKey =
        action.screenRefs.length > 0 ? action.screenRefs.join(' · ') : 'All screens'
      const list = byScreen.get(screenKey)
      if (list) list.push(action)
      else byScreen.set(screenKey, [action])
    }

    const screenEntries = [...byScreen.entries()]
    if (screenEntries.length === 1 && screenEntries[0]![0] === 'All screens') {
      groups.push({
        title: appHeading.title,
        detail: appHeading.detail,
        items: screenEntries[0]![1].map(paletteItemFromSemanticAction),
      })
    } else {
      groups.push({
        title: appHeading.title,
        detail: appHeading.detail,
        subsections: screenEntries.map(([screenKey, screenActions]) => {
          const screenHeading = formatPaletteScreenGroup(screenKey)
          return {
            title: screenHeading.title,
            detail: screenHeading.detail,
            items: screenActions.map(paletteItemFromSemanticAction),
          }
        }),
      })
    }
  }

  return groups
}

/** Structural editor tools kept beside pack actions. */
export function buildEditorScaffoldingGroups(): WorkflowPaletteCategory[] {
  return [
    {
      title: 'Editor scaffolding',
      items: [paletteItemFromType(WorkflowNodeType.LAUNCH_APP)],
    },
  ]
}
