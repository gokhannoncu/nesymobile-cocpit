import type { SemanticActionApi, SemanticActionCatalogApi } from '@/lib/verdict-runtime/types'
import { nodeToneByType, paletteItemFromType, type WorkflowPaletteCategory } from './workflow-registry'
import { WorkflowNodeType, type PaletteItem } from './workflow-types'

const CAPABILITY_UNAVAILABLE_REASON =
  'Bridge B2 capability negotiation not available on this device'

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
        title: appRef,
        items: screenEntries[0]![1].map(paletteItemFromSemanticAction),
      })
    } else {
      groups.push({
        title: appRef,
        subsections: screenEntries.map(([title, screenActions]) => ({
          title,
          items: screenActions.map(paletteItemFromSemanticAction),
        })),
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
