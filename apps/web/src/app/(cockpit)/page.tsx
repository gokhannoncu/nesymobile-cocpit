'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { WORKSPACES } from '@nesy/metronic/config/layout-21.config'
import {
  Toolbar,
  ToolbarHeading,
  ToolbarPageTitle,
} from '@nesy/metronic/layout-21/components/toolbar'
import { Card, CardContent, CardHeader, CardTitle } from '@nesy/metronic/components/ui/card'

// Ana sayfa (root /) — cockpit'in giriş ekranı.
// Template başlangıç noktası: workspace'leri listeler; kendi dashboard'unuzla değiştirin.

export default function CockpitHomePage() {
  return (
    <div className="container-fluid min-w-0 max-w-full">
      <Toolbar>
        <ToolbarHeading>
          <ToolbarPageTitle>Overview</ToolbarPageTitle>
        </ToolbarHeading>
      </Toolbar>

      <div className="space-y-8 pb-12">
        <Card>
          <CardHeader>
            <CardTitle>Nesy Mobile Cockpit</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Bu template, Metronic Layout 21 tabanlı cockpit yapısının temelini içerir: sol ikon
            rayı (workspace&apos;ler), ikincil sidebar menüsü, header + breadcrumb ve içerik alanı.
            Menü yapısı <code>packages/metronic/src/config/layout-21.config.tsx</code> dosyasından
            yönetilir; path&apos;i olan her menü öğesi otomatik olarak placeholder sayfası alır.
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {WORKSPACES.filter((w) => w.id !== 'home').map((w) => (
            <Card key={w.id} className="transition-colors hover:border-primary/40">
              <CardHeader className="flex flex-row items-center gap-3">
                <span className={`flex size-9 items-center justify-center rounded-lg ${w.className}`}>
                  <w.icon className="size-4.5" />
                </span>
                <CardTitle className="text-base">{w.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <Link
                  href={w.path}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                >
                  Workspace&apos;e git <ArrowRight className="size-3.5" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
