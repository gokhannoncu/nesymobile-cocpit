'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { fetchVerdictInteractions } from '@/lib/verdict-runtime/client'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'

export function LiveUpdateSubscription({ runId }: { runId: string }) {
  const [status, setStatus] = useState<'connected' | 'reconnecting' | 'disconnected'>('disconnected')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let mounted = true
    const poll = async () => {
      if (!mounted) return
      try {
        setStatus('connected')
        const data = await fetchVerdictInteractions(runId, revision)
        if (mounted && data.latestRevision > revision) {
          setRevision(data.latestRevision)
        }
      } catch (err) {
        if (mounted) setStatus('disconnected')
      }
      if (mounted) {
        setTimeout(poll, 5000)
      }
    }
    setStatus('reconnecting')
    poll()
    return () => { mounted = false }
  }, [runId, revision])

  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className={`gap-1.5 ${status === 'connected' ? 'text-green-600 border-green-200 bg-green-50' : status === 'disconnected' ? 'text-red-600 border-red-200 bg-red-50' : 'text-amber-600 border-amber-200 bg-amber-50'}`}>
        {status === 'connected' && <Wifi className="w-3 h-3" />}
        {status === 'disconnected' && <WifiOff className="w-3 h-3" />}
        {status === 'reconnecting' && <Loader2 className="w-3 h-3 animate-spin" />}
        {status === 'connected' ? 'Live' : status === 'reconnecting' ? 'Reconnecting...' : 'Disconnected'}
      </Badge>
      <span className="text-xs text-muted-foreground font-mono">rev:{revision}</span>
    </div>
  )
}
