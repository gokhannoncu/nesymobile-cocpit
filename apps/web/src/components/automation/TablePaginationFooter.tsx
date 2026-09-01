'use client'

import type { ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'

export function buildPaginationPages(
  current: number,
  total: number,
): Array<number | 'ellipsis'> {
  if (total <= 0) return []
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)

  const pages = new Set<number>()
  pages.add(1)
  pages.add(total)
  for (let page = current - 1; page <= current + 1; page += 1) {
    if (page >= 1 && page <= total) pages.add(page)
  }
  if (current <= 4) {
    for (let page = 2; page <= 5; page += 1) pages.add(page)
  }
  if (current >= total - 3) {
    for (let page = total - 4; page <= total - 1; page += 1) {
      if (page >= 1) pages.add(page)
    }
  }

  const sorted = [...pages].sort((left, right) => left - right)
  const output: Array<number | 'ellipsis'> = []
  for (let index = 0; index < sorted.length; index += 1) {
    const value = sorted[index]
    if (value === undefined) continue
    const previous = sorted[index - 1]
    if (index > 0 && previous !== undefined && value - previous > 1) output.push('ellipsis')
    output.push(value)
  }
  return output
}

function pluralize(label: string, count: number): string {
  if (count === 1) return label
  if (label.endsWith('y') && !label.endsWith('ay') && !label.endsWith('ey')) {
    return `${label.slice(0, -1)}ies`
  }
  return `${label.endsWith('s') ? label : `${label}s`}`
}

export function TablePaginationFooter({
  totalItems,
  rangeStart,
  rangeEnd,
  currentPage,
  totalPages,
  pageSize,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'item',
  ariaLabel = 'Table pagination',
  idPrefix = 'table-pagination',
}: {
  totalItems: number
  rangeStart: number
  rangeEnd: number
  currentPage: number
  totalPages: number
  pageSize: number
  pageSizeOptions: readonly number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  itemLabel?: string
  ariaLabel?: string
  idPrefix?: string
}) {
  if (totalItems <= 0) return null

  const pages = buildPaginationPages(currentPage, totalPages)
  const label = pluralize(itemLabel, totalItems)

  return (
    <footer className="border-t border-border/70 bg-muted/10 px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm text-muted-foreground">
          Showing{' '}
          <span className="font-semibold tabular-nums text-foreground">
            {rangeStart}–{rangeEnd}
          </span>{' '}
          of{' '}
          <span className="font-semibold tabular-nums text-foreground">{totalItems}</span> {label}
          {totalPages > 1 ? (
            <span className="text-muted-foreground/80">
              {' '}
              · Page {currentPage} of {totalPages}
            </span>
          ) : null}
        </p>

        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
          {totalPages > 1 ? (
            <nav
              className="inline-flex items-center gap-0.5 rounded-lg border border-border/70 bg-background/90 p-1 shadow-xs"
              aria-label={ariaLabel}
            >
              <PaginationIconButton
                label="Previous page"
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
              >
                <ChevronLeft className="size-4" />
              </PaginationIconButton>

              {pages.map((item, index) =>
                item === 'ellipsis' ? (
                  <span
                    key={`ellipsis-${index}`}
                    className="flex size-8 items-center justify-center text-xs font-semibold text-muted-foreground"
                    aria-hidden
                  >
                    …
                  </span>
                ) : (
                  <PaginationPageButton
                    key={item}
                    page={item}
                    active={item === currentPage}
                    onClick={() => onPageChange(item)}
                  />
                ),
              )}

              <PaginationIconButton
                label="Next page"
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
              >
                <ChevronRight className="size-4" />
              </PaginationIconButton>
            </nav>
          ) : null}

          <div className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 bg-background/90 px-2.5 py-1 shadow-xs sm:ml-0">
            <label
              htmlFor={`${idPrefix}-page-size`}
              className="cursor-pointer whitespace-nowrap text-xs font-medium text-muted-foreground"
            >
              Per page
            </label>
            <div className="relative">
              <select
                id={`${idPrefix}-page-size`}
                aria-label="Rows per page"
                value={String(pageSize)}
                onChange={(event) => onPageSizeChange(Number(event.target.value))}
                className="h-8 min-w-[3.25rem] cursor-pointer appearance-none rounded-lg border-0 bg-transparent py-0 pl-1 pr-6 text-sm font-semibold tabular-nums text-foreground outline-none focus:ring-0"
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-0 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

function PaginationIconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-8 items-center justify-center rounded-lg text-foreground transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nesy-soft/50',
        disabled
          ? 'cursor-not-allowed text-muted-foreground/35'
          : 'cursor-pointer hover:bg-muted/70 active:bg-muted',
      )}
    >
      {children}
    </button>
  )
}

function PaginationPageButton({
  page,
  active,
  onClick,
}: {
  page: number
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={`Page ${page}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
      className={cn(
        'flex size-8 cursor-pointer items-center justify-center rounded-lg text-sm font-semibold tabular-nums transition',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nesy-soft/50',
        active
          ? 'bg-nesy-soft text-nesy-ink shadow-[inset_0_0_0_1px_rgba(255,122,26,0.25)]'
          : 'text-foreground hover:bg-muted/70 active:bg-muted',
      )}
    >
      {page}
    </button>
  )
}
