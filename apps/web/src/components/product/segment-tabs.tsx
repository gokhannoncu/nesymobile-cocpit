'use client'

import { ReactNode } from 'react'
import { type LucideIcon } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@nesy/metronic/components/ui/tabs'

export interface SegmentTabItem {
  value: string
  label: string
  icon?: LucideIcon
  content: ReactNode
}

/**
 * Tek sayfada çok-segment gezinme — Notion "sekme deseni" karşılığı.
 * Kullanıcı tipleri, journey seçici, tez bölümleri için.
 */
export function SegmentTabs({
  items,
  defaultValue,
  variant = 'button',
}: {
  items: SegmentTabItem[]
  defaultValue?: string
  variant?: 'default' | 'button' | 'line'
}) {
  return (
    <Tabs defaultValue={defaultValue ?? items[0]?.value} className="w-full">
      <TabsList variant={variant} className="mb-5 flex-wrap justify-start">
        {items.map((item) => (
          <TabsTrigger key={item.value} value={item.value}>
            {item.icon && <item.icon className="size-4" />}
            {item.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {items.map((item) => (
        <TabsContent key={item.value} value={item.value} className="space-y-5">
          {item.content}
        </TabsContent>
      ))}
    </Tabs>
  )
}
