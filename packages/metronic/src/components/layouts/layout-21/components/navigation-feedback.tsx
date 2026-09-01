'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ComponentProps } from 'react'

type SidebarNavLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string
  /** Kept for sidebar call sites; page titles come from route loading shimmers. */
  navigationLabel?: string
}

export function SidebarNavLink({
  href,
  navigationLabel: _navigationLabel,
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

        requestAnimationFrame(() => {
          if (replace) router.replace(href, { scroll })
          else router.push(href, { scroll })
        })
      }}
    />
  )
}
