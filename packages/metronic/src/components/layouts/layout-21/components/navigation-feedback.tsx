'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ComponentProps,
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { flushSync } from 'react-dom'

interface NavigationFeedbackState {
  pendingHref: string | null
  pendingLabel: string | null
  beginNavigation: (href: string, label?: string) => void
}

const NavigationFeedbackContext = createContext<NavigationFeedbackState | null>(null)

export function NavigationFeedbackProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [pending, setPending] = useState<{ href: string; label?: string } | null>(null)
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearPending = useCallback(() => {
    if (fallbackTimer.current) {
      clearTimeout(fallbackTimer.current)
      fallbackTimer.current = null
    }
    setPending(null)
  }, [])

  useEffect(() => {
    clearPending()
  }, [pathname, clearPending])

  useEffect(() => () => {
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current)
  }, [])

  const beginNavigation = useCallback((href: string, label?: string) => {
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current)

    // Commit the feedback before the expensive route render starts. The actual
    // navigation is deliberately scheduled by SidebarNavLink on the next frame.
    flushSync(() => setPending({ href, label }))
    fallbackTimer.current = setTimeout(clearPending, 15_000)
  }, [clearPending])

  return (
    <NavigationFeedbackContext.Provider
      value={{
        pendingHref: pending?.href ?? null,
        pendingLabel: pending?.label ?? null,
        beginNavigation,
      }}
    >
      {children}
    </NavigationFeedbackContext.Provider>
  )
}

function useNavigationFeedback() {
  const value = useContext(NavigationFeedbackContext)
  if (!value) {
    throw new Error('Navigation feedback must be used inside NavigationFeedbackProvider')
  }
  return value
}

type SidebarNavLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string
  navigationLabel?: string
}

export function SidebarNavLink({
  href,
  navigationLabel,
  onClick,
  onMouseEnter,
  onFocus,
  replace,
  scroll,
  target,
  ...props
}: SidebarNavLinkProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { beginNavigation } = useNavigationFeedback()

  const prefetch = () => {
    if (href.startsWith('/')) router.prefetch(href)
  }

  return (
    <Link
      {...props}
      href={href}
      target={target}
      replace={replace}
      scroll={scroll}
      onMouseEnter={(event) => {
        onMouseEnter?.(event)
        if (!event.defaultPrevented) prefetch()
      }}
      onFocus={(event) => {
        onFocus?.(event)
        if (!event.defaultPrevented) prefetch()
      }}
      onClick={(event) => {
        onClick?.(event)
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          target === '_blank' ||
          !href.startsWith('/') ||
          href.startsWith('#') ||
          href === pathname
        ) {
          return
        }

        event.preventDefault()
        beginNavigation(href, navigationLabel)

        requestAnimationFrame(() => {
          if (replace) router.replace(href, { scroll })
          else router.push(href, { scroll })
        })
      }}
    />
  )
}

export function NavigationFeedback() {
  const { pendingHref, pendingLabel } = useNavigationFeedback()

  if (!pendingHref) return null

  return (
    <div
      data-slot="navigation-feedback"
      className="pointer-events-none fixed inset-y-0 end-0 start-0 z-50 flex items-center justify-center bg-background/55 backdrop-blur-[1px] lg:top-[calc(var(--header-height)+var(--page-margin))] lg:start-(--sidebar-width) lg:in-data-[sidebar-open=false]:start-(--sidebar-collapsed-width)"
      role="status"
      aria-live="polite"
      aria-label={pendingLabel ? `Preparing ${pendingLabel} page` : 'Preparing page'}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-primary/10">
        <span className="route-progress-bar block h-full w-2/5 bg-primary" />
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-border bg-background/95 px-4 py-3 text-sm font-medium text-foreground shadow-lg shadow-black/5">
        <span className="size-2 animate-pulse rounded-full bg-primary" />
        <span>{pendingLabel ? `Loading ${pendingLabel}` : 'Loading page'}</span>
      </div>
    </div>
  )
}
