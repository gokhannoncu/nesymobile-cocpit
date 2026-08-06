'use client'

import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import { RefreshCw, MonitorPlay, Crosshair, Map } from 'lucide-react'

interface InspectorToolbarProps {
  permissionMode: 'OBSERVE_ONLY' | 'OBSERVE_AND_ACT'
  onRefresh: () => void
  showInsets: boolean
  onToggleInsets: () => void
  onGenerateFingerprint: () => void
}

export function InspectorToolbar({
  permissionMode,
  onRefresh,
  showInsets,
  onToggleInsets,
  onGenerateFingerprint
}: InspectorToolbarProps) {
  return (
    <div className="flex items-center justify-between p-2 border-b bg-slate-50">
      <div className="flex items-center gap-4">
        <Badge variant={permissionMode === 'OBSERVE_AND_ACT' ? 'primary' : 'outline'} className="flex items-center gap-1">
          <MonitorPlay className="w-3 h-3" />
          {permissionMode}
        </Badge>
        <Button variant="ghost" size="sm" onClick={onRefresh} className="h-8">
          <RefreshCw className="w-4 h-4 mr-2" />
          Reconnect
        </Button>
      </div>
      
      <div className="flex items-center gap-2">
        <Button 
          variant={showInsets ? 'secondary' : 'ghost'} 
          size="sm" 
          onClick={onToggleInsets}
          className="h-8"
        >
          <Map className="w-4 h-4 mr-2" />
          Insets Mapped
        </Button>
        <Button variant="primary" size="sm" onClick={onGenerateFingerprint} className="h-8">
          <Crosshair className="w-4 h-4 mr-2" />
          Generate Target
        </Button>
      </div>
    </div>
  )
}
