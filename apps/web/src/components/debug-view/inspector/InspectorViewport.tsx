'use client'

import { ReactNode } from 'react'

interface InspectorViewportProps {
  screenshotUrl?: string
  orientation: 'PORTRAIT' | 'LANDSCAPE'
  scale?: number
  currentScreenKey?: string
  activeSurfaceKey?: string
  children?: ReactNode
}

export function InspectorViewport({
  screenshotUrl,
  orientation,
  scale = 1,
  currentScreenKey,
  activeSurfaceKey,
  children
}: InspectorViewportProps) {
  const isPortrait = orientation === 'PORTRAIT'
  
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-4 mb-2 text-sm">
        <div className="bg-slate-100 px-3 py-1 rounded">
          <span className="font-semibold">Current Screen:</span> {currentScreenKey || 'Unknown'}
        </div>
        <div className="bg-slate-100 px-3 py-1 rounded">
          <span className="font-semibold">Active Surface:</span> {activeSurfaceKey || 'Unknown'}
        </div>
      </div>
      
      <div 
        className="relative bg-slate-900 overflow-hidden shadow-inner border border-slate-300 rounded-lg max-w-full"
        style={{
          width: isPortrait ? 360 * scale : 640 * scale,
          height: isPortrait ? 640 * scale : 360 * scale,
        }}
      >
        {screenshotUrl ? (
          <img 
            src={screenshotUrl} 
            alt="Device Screenshot" 
            className="absolute inset-0 w-full h-full object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-500">
            No Screenshot Available
          </div>
        )}
        
        {children}
      </div>
    </div>
  )
}
