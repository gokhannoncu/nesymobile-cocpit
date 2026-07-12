import { ReactNode, Suspense } from 'react'
import { Inter } from 'next/font/google'
import { cn } from '@nesy/metronic/lib/utils'
import { TooltipProvider } from '@nesy/metronic/components/ui/tooltip'
import { ThemeProvider } from 'next-themes'
import type { Metadata } from 'next'
import './globals.css'

const inter = Inter({ subsets: ['latin', 'latin-ext'] })

export const metadata: Metadata = {
  title: {
    template: '%s | Nesy Mobile Cockpit',
    default: 'Nesy Mobile Cockpit',
  },
  description: 'Nesy Mobile platform yönetim arayüzü',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="tr" className="h-full bg-background" suppressHydrationWarning>
      <body
        className={cn(
          'flex min-h-dvh w-full bg-background text-base text-foreground antialiased',
          inter.className,
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          storageKey="nesy-theme"
          enableSystem
          disableTransitionOnChange
          enableColorScheme
        >
          <TooltipProvider delayDuration={0}>
            <Suspense>{children}</Suspense>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
