'use client'

import { useState } from 'react'
import { Button } from '@nesy/metronic/components/ui/button'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { SemanticNode } from './InspectorNodeOverlay'
import { Fingerprint, Target, Link } from 'lucide-react'

interface InspectorTargetPanelProps {
  selectedNode: SemanticNode | null
}

export function InspectorTargetPanel({ selectedNode }: InspectorTargetPanelProps) {
  const [matchCount, setMatchCount] = useState(1)

  if (!selectedNode) {
    return (
      <div className="p-4 border rounded-lg bg-slate-50 flex items-center justify-center text-slate-500 h-64">
        Select a node in the viewport to generate a target fingerprint.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg bg-white">
      <div className="flex justify-between items-center border-b pb-2">
        <h3 className="font-semibold flex items-center gap-2">
          <Target className="w-4 h-4" />
          Target Fingerprint
        </h3>
        <Badge variant={matchCount > 1 ? 'destructive' : 'primary'}>
          {matchCount} Match{matchCount !== 1 ? 'es' : ''}
        </Badge>
      </div>
      
      <div className="text-sm space-y-2">
        <div className="grid grid-cols-3 font-semibold text-slate-500">
          <div>Property</div>
          <div className="col-span-2">Value</div>
        </div>
        <div className="grid grid-cols-3">
          <div>Type</div>
          <div className="col-span-2">{selectedNode.type}</div>
        </div>
        {selectedNode.text && (
          <div className="grid grid-cols-3">
            <div>Text</div>
            <div className="col-span-2 truncate" title={selectedNode.text}>{selectedNode.text}</div>
          </div>
        )}
        {selectedNode.resourceId && (
          <div className="grid grid-cols-3">
            <div>Resource ID</div>
            <div className="col-span-2 truncate" title={selectedNode.resourceId}>{selectedNode.resourceId}</div>
          </div>
        )}
      </div>

      <div className="mt-4">
        <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2 flex items-center gap-1">
          <Link className="w-3 h-3" />
          Provider Chain
        </h4>
        <div className="text-xs font-mono bg-slate-100 p-2 rounded break-all">
          RootView &gt; FrameLayout &gt; {selectedNode.type}
        </div>
      </div>

      {matchCount > 1 && (
        <div className="mt-2 text-sm text-amber-600 bg-amber-50 p-2 rounded">
          <strong>Ambiguity Detected!</strong> Candidates found. Consider adding bounded entity binding evidence.
        </div>
      )}

      <div className="flex justify-end gap-2 mt-2 border-t pt-4">
        <Button size="sm" variant="outline" onClick={() => setMatchCount(prev => prev + 1)}>
          <Fingerprint className="w-4 h-4 mr-2" />
          Refine Fingerprint
        </Button>
      </div>
    </div>
  )
}
