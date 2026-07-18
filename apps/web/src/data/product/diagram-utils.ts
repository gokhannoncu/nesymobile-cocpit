import type { DiagramElement } from './nesy-types'

export function collectDiagramNodeIds(elements: DiagramElement[]): string[] {
  const ids: string[] = []
  const walk = (els: DiagramElement[]) => {
    for (const el of els) {
      if (el.type === 'node' && el.id) ids.push(el.id)
      if (el.type === 'branch') {
        walk(el.yes.steps)
        walk(el.no.steps)
      }
    }
  }
  walk(elements)
  return ids
}

export function assertJourneyStepsComplete(
  diagram: DiagramElement[],
  steps: Record<string, unknown>,
): { missingInSteps: string[]; orphanSteps: string[] } {
  const nodeIds = new Set(collectDiagramNodeIds(diagram))
  const stepKeys = new Set(Object.keys(steps))
  const missingInSteps = [...nodeIds].filter((id) => !stepKeys.has(id)).sort()
  const orphanSteps = [...stepKeys].filter((id) => !nodeIds.has(id)).sort()
  return { missingInSteps, orphanSteps }
}
