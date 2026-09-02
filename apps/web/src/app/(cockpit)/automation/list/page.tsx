'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  createWorkflow,
  deleteWorkflow,
  type WorkflowListItem,
} from '@/services/automation-api'
import { fetchVerdictWorkflowCatalog } from '@/lib/verdict-runtime/client'
import { catalogItemToWorkflowListItem } from '@/lib/verdict-runtime/adapters'
import {
  Archive,
  Bell,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cloud,
  Database,
  FileX2,
  IdCard,
  Layers,
  ListChecks,
  Lock,
  Mail,
  MapPin,
  MinusCircle,
  Package,
  PenLine,
  Pencil,
  Play,
  Plus,
  ShieldCheck,
  Tag,
  Trash2,
  Truck,
  WalletCards,
  Workflow,
  X,
  XCircle,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@nesy/metronic/components/ui/alert-dialog'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Button } from '@nesy/metronic/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nesy/metronic/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@nesy/metronic/components/ui/tooltip'
import { cn } from '@nesy/metronic/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AutomationListGridShimmer,
  AutomationListPageShimmer,
} from '@/components/automation/automation-list-page-shimmer'
import { WorkflowLibraryHeader } from '@/components/automation/workflow-library/WorkflowLibraryHeader'
import {
  TablePaginationFooter,
} from '@/components/automation/TablePaginationFooter'
import { ProductPage } from '@/components/product'
import {
  countWorkflowLibraryStatuses,
  isVisibleLibraryWorkflow,
  workflowMatchesStatusFilter,
  type WorkflowLibraryStatusFilter,
} from '@/lib/automation/workflow-library-filters'
import { toast } from 'sonner'
import { useNesyAuth } from '@/contexts/nesy-auth-context'
import {
  coerceNesyMobileEnvironment,
  getNesyMobileEnvironmentsForCountry,
  NESY_MOBILE_COUNTRIES,
  type NesyMobileCountry,
  type NesyMobileEnvironment,
} from '@/services/nesy-mobile-env'

type ModalOption = {
  title: string
  description: string
  icon: LucideIcon
  enabled: boolean
}

const SEARCH_DEBOUNCE_MS = 300

function filterWorkflowsByQuery(
  workflows: WorkflowListItem[],
  query: string,
): WorkflowListItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return workflows
  return workflows.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.slug.toLowerCase().includes(q) ||
      (item.description?.toLowerCase().includes(q) ?? false),
  )
}

const modalOptions: ModalOption[] = [
  {
    title: 'Blank Workflow',
    description: 'Start from scratch with an empty canvas.',
    icon: Workflow,
    enabled: true,
  },
  {
    title: 'From Template',
    description: 'Use a prebuilt workflow template.',
    icon: Layers,
    enabled: false,
  },
  {
    title: 'Happy Path Suite',
    description: 'Build a multi-step test suite with repeated deliveries.',
    icon: ListChecks,
    enabled: false,
  },
]

const iconMap: Record<string, LucideIcon> = {
  Truck,
  Package,
  FileX2,
  WalletCards,
  PenLine,
  MapPin,
  Bell,
  ShieldCheck,
  Workflow,
  Play,
  Pencil,
  Archive,
  Lock,
  Cloud,
  Database,
  Mail,
  IdCard,
  Layers,
  ListChecks,
  Check,
  CheckCircle2,
  MinusCircle,
  XCircle,
}

function resolveIcon(iconName: string): LucideIcon {
  return iconMap[iconName] ?? Workflow
}

function NewWorkflowButton({
  onClick,
  variant = 'default',
}: {
  onClick: () => void
  variant?: 'toolbar' | 'default'
}) {
  const isToolbar = variant === 'toolbar'
  const [shortcutLabel, setShortcutLabel] = useState('Ctrl+N')

  useEffect(() => {
    setShortcutLabel(/Mac|iPhone|iPad/i.test(navigator.userAgent) ? '⌘N' : 'Ctrl+N')
  }, [])

  const button = (
    <Button
      type="button"
      size={isToolbar ? 'sm' : 'md'}
      onClick={onClick}
      className={cn(
        'gap-1.5 bg-nesy text-white hover:bg-nesy-hover hover:text-white focus-visible:ring-nesy-soft',
        isToolbar
          ? 'h-8 shrink-0 px-3 shadow-sm'
          : 'h-9 rounded-md px-4 shadow-[0_8px_20px_rgba(255,122,26,0.22)]',
      )}
    >
      <Plus className={cn(isToolbar ? 'size-3.5' : 'size-4')} strokeWidth={2.5} />
      <span>New Workflow</span>
      {isToolbar ? (
        <kbd className="ml-0.5 hidden rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-white/90 lg:inline">
          {shortcutLabel}
        </kbd>
      ) : null}
    </Button>
  )

  if (!isToolbar) return button

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          Create a blank workflow · {shortcutLabel}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default function AutomationListPage() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const [modalOpen, setModalOpen] = useState(false)
  const [allWorkflows, setAllWorkflows] = useState<WorkflowListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<WorkflowLibraryStatusFilter>('all')
  const [createShortcutLabel, setCreateShortcutLabel] = useState('Ctrl+N')
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setCreateShortcutLabel(/Mac|iPhone|iPad/i.test(navigator.userAgent) ? '⌘N' : 'Ctrl+N')
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedSearch(searchQuery.trim()),
      SEARCH_DEBOUNCE_MS,
    )
    return () => window.clearTimeout(timer)
  }, [searchQuery])

  const isSearchPending = searchQuery.trim() !== debouncedSearch

  const loadWorkflows = useCallback(async () => {
    try {
      setLoading(true)
      const catalog = await fetchVerdictWorkflowCatalog(200)
      setAllWorkflows(catalog.items.map(catalogItemToWorkflowListItem))
    } catch (err) {
      console.error('Failed to load workflows:', err)
      toast.error('Workflow library could not be loaded.')
      setAllWorkflows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWorkflows()
  }, [loadWorkflows])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (modalOpen) return
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'n') return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.closest('input, textarea, select, [contenteditable="true"]') ||
          target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      setModalOpen(true)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [modalOpen])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.closest('input, textarea, select, [contenteditable="true"]') ||
          target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      searchInputRef.current?.focus()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const openCreateModal = () => setModalOpen(true)

  const searchedWorkflows = useMemo(
    () => filterWorkflowsByQuery(allWorkflows, debouncedSearch),
    [allWorkflows, debouncedSearch],
  )

  const visibleWorkflows = useMemo(
    () => searchedWorkflows.filter(isVisibleLibraryWorkflow),
    [searchedWorkflows],
  )

  const statusCounts = useMemo(
    () => countWorkflowLibraryStatuses(visibleWorkflows),
    [visibleWorkflows],
  )

  const clearSearch = () => {
    setSearchQuery('')
    setDebouncedSearch('')
    setPage(1)
  }

  const hasFilters = statusFilter !== 'all' || Boolean(debouncedSearch)

  const clearFilters = () => {
    setStatusFilter('all')
    clearSearch()
  }

  const filteredWorkflows = useMemo(
    () =>
      visibleWorkflows.filter((workflow) =>
        workflowMatchesStatusFilter(workflow, statusFilter),
      ),
    [visibleWorkflows, statusFilter],
  )

  const totalPages = Math.max(1, Math.ceil(filteredWorkflows.length / pageSize))

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, debouncedSearch])

  const safePage = Math.min(page, totalPages)
  const pageSlice = useMemo(() => {
    const p = Math.min(page, totalPages)
    const start = (p - 1) * pageSize
    return filteredWorkflows.slice(start, start + pageSize)
  }, [filteredWorkflows, page, pageSize, totalPages])

  const rangeStart = filteredWorkflows.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const rangeEnd = Math.min(safePage * pageSize, filteredWorkflows.length)

  const handleDelete = async (workflowId: string, slug: string) => {
    try {
      await deleteWorkflow(workflowId)
      setAllWorkflows((prev) => prev.filter((w) => w.id !== workflowId))
      try {
        window.localStorage.removeItem(`nesy-workflow-editor:${slug}`)
      } catch {
        /* ignore */
      }
    } catch (err) {
      console.error('Failed to delete workflow:', err)
    }
  }

  const handleCreate = async (data: { name: string; description?: string; category?: string }) => {
    try {
      const newWorkflow = await createWorkflow(data)
      setAllWorkflows((prev) => [newWorkflow, ...prev])
      setModalOpen(false)
      router.push(`/automation/${newWorkflow.slug}`)
      return newWorkflow
    } catch (err) {
      console.error('Failed to create workflow:', err)
      return null
    }
  }

  return (
    <ProductPage path="/automation/list" hideToolbar>
      <div className="space-y-5">
        {loading && allWorkflows.length === 0 ? (
          <AutomationListPageShimmer />
        ) : (
          <>
            <WorkflowLibraryHeader
              totalCount={visibleWorkflows.length}
              filteredCount={filteredWorkflows.length}
              visibleCount={visibleWorkflows.length}
              statusCounts={statusCounts}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onClearSearch={clearSearch}
              onRefresh={() => void loadWorkflows()}
              onClearFilters={clearFilters}
              hasFilters={hasFilters}
              isRefreshing={loading}
              isSearchPending={isSearchPending}
              onCreateClick={openCreateModal}
              createShortcutLabel={createShortcutLabel}
              searchInputRef={searchInputRef}
            />

            <section
              className={cn(
                'space-y-4 transition-opacity duration-150',
                isSearchPending && 'opacity-85',
              )}
              aria-busy={isSearchPending}
              aria-label="Workflow library"
            >
              {loading ? (
                <AutomationListGridShimmer
                  count={Math.min(Math.max(pageSlice.length, 1), pageSize)}
                />
              ) : pageSlice.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
                  {allWorkflows.length === 0 ? (
                    <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                      <p className="text-sm font-medium text-foreground">No workflows yet</p>
                      <p className="text-sm text-muted-foreground">
                        Start with a blank workflow or import a template when that option is enabled.
                      </p>
                      <NewWorkflowButton onClick={openCreateModal} />
                    </div>
                  ) : (
                    <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                      <p className="text-sm font-medium text-foreground">No workflows in this view</p>
                      <p className="text-sm text-muted-foreground">
                        Try another status filter or clear your search query.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setStatusFilter('all')
                          clearSearch()
                        }}
                        className="text-sm font-semibold text-nesy-ink underline-offset-2 hover:underline"
                      >
                        Reset filters
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {pageSlice.map((workflow) => (
                    <WorkflowCard
                      key={workflow.id}
                      workflow={workflow}
                      onDelete={() => handleDelete(workflow.id, workflow.slug)}
                    />
                  ))}
                </div>
              )}
            </section>

            {filteredWorkflows.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
                <TablePaginationFooter
                  totalItems={filteredWorkflows.length}
                  rangeStart={rangeStart}
                  rangeEnd={rangeEnd}
                  currentPage={safePage}
                  totalPages={totalPages}
                  pageSize={pageSize}
                  pageSizeOptions={[4, 8, 12]}
                  onPageChange={setPage}
                  onPageSizeChange={(next) => {
                    setPageSize(next)
                    setPage(1)
                  }}
                  itemLabel="workflow"
                  ariaLabel="Workflow pages"
                  idPrefix="workflow-library"
                />
              </div>
            ) : null}
          </>
        )}

        <AnimatePresence>
          {modalOpen && (
            <CreateWorkflowModal onClose={() => setModalOpen(false)} onCreate={handleCreate} />
          )}
        </AnimatePresence>
      </div>
    </ProductPage>
  )
}

function CreateWorkflowModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (data: { name: string; description?: string; category?: string }) => Promise<unknown>
}) {
  const { country: authCountry, environment: authEnvironment } = useNesyAuth()
  const [country, setCountry] = useState<NesyMobileCountry>('HR')
  const [environment, setEnvironment] = useState<NesyMobileEnvironment>('stage')
  const [name, setName] = useState<string>('')
  const [creating, setCreating] = useState(false)

  const availableEnvironments = useMemo(
    () => getNesyMobileEnvironmentsForCountry(country),
    [country],
  )

  useEffect(() => {
    const nextCountry = authCountry as NesyMobileCountry
    if (!NESY_MOBILE_COUNTRIES.includes(nextCountry)) return
    setCountry(nextCountry)
    setEnvironment(
      coerceNesyMobileEnvironment(nextCountry, authEnvironment as NesyMobileEnvironment),
    )
  }, [authCountry, authEnvironment])

  function handleCountryChange(value: string) {
    const nextCountry = value as NesyMobileCountry
    setCountry(nextCountry)
    setEnvironment((currentEnvironment) =>
      coerceNesyMobileEnvironment(nextCountry, currentEnvironment),
    )
  }

  const handleSubmit = async () => {
    if (!name.trim()) return
    setCreating(true)
    await onCreate({ name: name.trim() })
    setCreating(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-6 backdrop-blur-[6px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.section
        aria-label="Create New Workflow"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="h-auto w-[740px] max-h-[calc(100vh-80px)] max-w-[calc(100vw-64px)] overflow-hidden rounded-[6px] bg-card px-[36px] py-[32px] text-foreground shadow-[0_18px_45px_rgba(0,0,0,0.15),0_4px_14px_rgba(0,0,0,0.08)] max-[680px]:overflow-y-auto"
      >
        <header className="flex items-start justify-between gap-8">
          <div>
            <h2 className="text-[23px] font-bold leading-[1.1] tracking-[-0.02em] text-foreground">
              Create New Workflow
            </h2>
            <p className="mt-2 text-[14px] leading-[1.45] text-muted-foreground">
              Choose how you want to start building your automation.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close modal"
            onClick={onClose}
            className="-mr-2 -mt-1 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
        </header>

        <div className="mt-5 grid grid-cols-2 gap-[15px]">
          {modalOptions.map((option) => (
            <ModalOptionCard key={option.title} option={option} />
          ))}
        </div>

        <div className="mt-5 border-t border-border pt-5">
          <div className="grid grid-cols-3 gap-4">
            <label className="block">
              <span className="text-[12px] font-semibold text-foreground">Workflow Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Standard Delivery Flow"
                className="mt-2 h-[45px] w-full rounded-[6px] border border-border bg-card px-4 text-[14px] text-foreground outline-none transition duration-200 placeholder:text-[13px] placeholder:text-muted-foreground focus:border-[#ff7a1a] focus:shadow-[0_0_0_4px_rgba(255,122,26,0.10)]"
              />
            </label>

            <label className="block">
              <span className="text-[12px] font-semibold text-foreground">Country</span>
              <ModalSelectShell
                placeholder="Select country"
                value={country}
                onValueChange={handleCountryChange}
                options={NESY_MOBILE_COUNTRIES.map((item) => ({
                  value: item,
                  label: item,
                }))}
              />
            </label>

            <label className="block">
              <span className="text-[12px] font-semibold text-foreground">Environment</span>
              <ModalSelectShell
                placeholder="Select environment"
                value={environment}
                onValueChange={(value) => setEnvironment(value as NesyMobileEnvironment)}
                options={availableEnvironments.map((item) => ({
                  value: item,
                  label: item.toUpperCase(),
                }))}
              />
            </label>
          </div>
        </div>

        <footer className="mt-6 flex items-center justify-between">
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-[44px] rounded-[6px] border border-border bg-card px-7 text-[14px] font-semibold text-foreground shadow-xs transition duration-200 hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!name.trim() || creating}
              onClick={handleSubmit}
              className="h-[44px] rounded-[6px] bg-[#ff7a1a] px-7 text-[14px] font-semibold text-white shadow-[0_14px_24px_rgba(255,122,26,0.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#e86b10] hover:shadow-[0_18px_30px_rgba(255,122,26,0.34)] disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {creating ? 'Creating...' : 'Create Workflow'}
            </button>
          </div>
        </footer>
      </motion.section>
    </motion.div>
  )
}

function ModalOptionCard({ option }: { option: ModalOption }) {
  const Icon = option.icon
  const disabled = !option.enabled

  return (
    <button
      type="button"
      disabled={disabled}
      aria-disabled={disabled}
      className={cn(
        'group flex h-[118px] items-center gap-4 rounded-[6px] border bg-card px-5 py-3 text-left shadow-xs transition duration-200',
        disabled
          ? 'cursor-not-allowed border-border opacity-45'
          : 'border-[rgba(255,122,26,0.20)] hover:-translate-y-0.5 hover:border-[rgba(255,122,26,0.45)] hover:shadow-[0_14px_28px_rgba(255,122,26,0.14)]',
      )}
    >
      <span
        className={cn(
          'flex size-[50px] shrink-0 items-center justify-center rounded-[6px] transition duration-200',
          disabled
            ? 'bg-muted text-muted-foreground'
            : 'bg-[#fff1e8] text-[#ff7a1a] group-hover:bg-[#ffe7d6] dark:bg-[#3d2510] dark:group-hover:bg-[#4d2f14]',
        )}
      >
        <Icon className="size-7" strokeWidth={1.9} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[19px] font-bold leading-[1.15] tracking-[-0.02em] text-foreground">
          {option.title}
        </span>
        <span className="mt-1 block max-w-[210px] text-[13px] leading-[1.35] text-muted-foreground">
          {option.description}
        </span>
      </span>

      <ChevronRight
        className={cn(
          'size-5 shrink-0 text-muted-foreground transition duration-200',
          disabled ? '' : 'group-hover:translate-x-0.5 group-hover:text-[#ff7a1a]',
        )}
        strokeWidth={2.2}
      />
    </button>
  )
}

function ModalSelectShell({
  placeholder,
  value,
  onValueChange,
  options,
}: {
  placeholder: string
  value: string
  onValueChange: (next: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="mt-2 h-[45px] w-full rounded-[6px] border border-border bg-card px-4 text-left text-[13px] text-foreground outline-none transition duration-200 data-placeholder:text-muted-foreground focus-visible:border-[#ff7a1a] focus-visible:ring-[#ff7a1a]/10">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function WorkflowDeleteDialog({
  workflowTitle,
  open,
  onOpenChange,
  onConfirm,
}: {
  workflowTitle: string
  open: boolean
  onOpenChange: (next: boolean) => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md rounded-md border border-border shadow-lg sm:rounded-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            You are about to delete &quot;{workflowTitle}&quot;. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel type="button" className="rounded-md mt-2 sm:mt-0">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            type="button"
            variant="destructive"
            className="rounded-md"
            onClick={() => onConfirm()}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function formatWorkflowStatusLabel(status: string): string {
  if (status === 'published') return 'Published'
  if (status === 'active') return 'Active'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function workflowStatusBadgeProps(status: string): {
  variant: 'success' | 'warning' | 'info' | 'secondary'
  appearance: 'light'
} {
  switch (status) {
    case 'published':
      return { variant: 'info', appearance: 'light' }
    case 'active':
      return { variant: 'success', appearance: 'light' }
    case 'draft':
      return { variant: 'warning', appearance: 'light' }
    default:
      return { variant: 'secondary', appearance: 'light' }
  }
}

function WorkflowMetaItem({
  icon: Icon,
  children,
  tone = 'neutral',
  title,
}: {
  icon: LucideIcon
  children: ReactNode
  tone?: 'neutral' | 'success' | 'danger' | 'muted'
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex min-w-0 items-center gap-1 text-[11px] font-medium leading-none',
        tone === 'success' && 'text-emerald-700 dark:text-emerald-400',
        tone === 'danger' && 'text-red-700 dark:text-red-400',
        tone === 'muted' && 'text-muted-foreground/80',
        tone === 'neutral' && 'text-muted-foreground',
      )}
    >
      <Icon className="size-3 shrink-0 opacity-75" strokeWidth={2.2} />
      <span className="truncate">{children}</span>
    </span>
  )
}

function WorkflowCard({
  workflow,
  onDelete,
}: {
  workflow: WorkflowListItem
  onDelete: () => void
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const Icon = resolveIcon(workflow.icon)
  const statusLabel = formatWorkflowStatusLabel(workflow.status)
  const statusBadge = workflowStatusBadgeProps(workflow.status)
  const editorHref = `/automation/${workflow.slug}`

  const timeSince = useMemo(() => {
    const diff = Date.now() - new Date(workflow.updatedAt).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }, [workflow.updatedAt])

  const lastRunTone =
    workflow.lastRun?.status === 'success'
      ? 'success'
      : workflow.lastRun?.status === 'failed'
        ? 'danger'
        : workflow.lastRun
          ? 'neutral'
          : 'muted'

  const LastRunIcon =
    workflow.lastRun?.status === 'success'
      ? CheckCircle2
      : workflow.lastRun?.status === 'failed'
        ? XCircle
        : workflow.lastRun
          ? MinusCircle
          : Clock

  const lastRunLabel = workflow.lastRun
    ? workflow.lastRun.status === 'success'
      ? 'Passed'
      : workflow.lastRun.status === 'failed'
        ? 'Failed'
        : workflow.lastRun.status
    : 'No runs'

  const accentTone =
    workflow.lastRun?.status === 'success'
      ? 'bg-emerald-500'
      : workflow.lastRun?.status === 'failed'
        ? 'bg-red-500'
        : workflow.status === 'draft'
          ? 'bg-amber-400'
          : 'bg-nesy'

  return (
    <article
      className={cn(
        'group/card relative flex min-h-[232px] flex-col overflow-hidden rounded-xl border border-border/90 bg-card shadow-xs transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-nesy-muted/80 hover:shadow-[0_14px_32px_rgba(15,23,42,0.10)]',
        'has-[:focus-visible]:border-nesy-muted/80 has-[:focus-visible]:shadow-[0_14px_32px_rgba(15,23,42,0.10)]',
      )}
    >
      <WorkflowDeleteDialog
        workflowTitle={workflow.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => {
          onDelete()
          setDeleteOpen(false)
        }}
      />

      <span
        aria-hidden
        className={cn(
          'absolute inset-y-0 start-0 w-[3px] origin-center scale-y-0 transition-transform duration-200',
          accentTone,
          'group-hover/card:scale-y-100 group-focus-within/card:scale-y-100',
        )}
      />

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Delete ${workflow.name}`}
            className={cn(
              'absolute right-2 top-2 z-20 inline-flex size-8 items-center justify-center rounded-md',
              'border border-transparent bg-background/80 text-muted-foreground opacity-0 backdrop-blur-sm transition-all duration-150',
              'hover:border-destructive/20 hover:bg-destructive/10 hover:text-destructive',
              'focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/30',
              'group-hover/card:opacity-100 group-focus-within/card:opacity-100',
            )}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              setDeleteOpen(true)
            }}
          >
            <Trash2 className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent variant="light">Delete workflow</TooltipContent>
      </Tooltip>

      <Link
        href={editorHref}
        className="relative flex min-h-[232px] flex-1 flex-col outline-none focus-visible:ring-2 focus-visible:ring-nesy-soft focus-visible:ring-inset"
      >
        <div className="flex flex-1 flex-col p-4 pb-3">
          <div className="flex gap-3 pe-8">
            <div
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-xl border shadow-xs',
                workflow.iconClassName ||
                  'border-nesy-muted/30 bg-nesy-soft text-nesy-ink dark:border-nesy-muted/40 dark:bg-nesy-soft/20',
              )}
            >
              <Icon className="size-[19px]" strokeWidth={2.1} />
            </div>

            <div className="min-w-0 flex-1">
              <h3
                className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.02em] text-foreground"
                title={workflow.name}
              >
                {workflow.name}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge size="sm" appearance={statusBadge.appearance} variant={statusBadge.variant}>
                  {statusLabel}
                </Badge>
                {workflow.category ? (
                  <Badge
                    size="sm"
                    appearance="outline"
                    variant="secondary"
                    className="font-mono text-[10px] uppercase tracking-wide"
                  >
                    {workflow.category}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-3 min-h-[3.75rem] flex-1">
            {workflow.description ? (
              <p
                className="line-clamp-3 text-[13px] leading-[1.55] text-foreground/70"
                title={workflow.description}
              >
                {workflow.description}
              </p>
            ) : (
              <p className="text-[13px] italic leading-[1.55] text-muted-foreground/65">
                Add a short description in the editor
              </p>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/70 pt-3">
            <WorkflowMetaItem icon={Clock} title={`Updated ${timeSince}`}>
              {timeSince}
            </WorkflowMetaItem>
            {workflow.latestVersion ? (
              <>
                <span className="text-border" aria-hidden>
                  ·
                </span>
                <WorkflowMetaItem icon={Tag} title={`Version ${workflow.latestVersion.version}`}>
                  v{workflow.latestVersion.version}
                </WorkflowMetaItem>
              </>
            ) : null}
            <span className="text-border" aria-hidden>
              ·
            </span>
            <WorkflowMetaItem icon={LastRunIcon} tone={lastRunTone} title={lastRunLabel}>
              {lastRunLabel}
            </WorkflowMetaItem>
          </div>
        </div>

        <div
          className={cn(
            'mt-auto flex items-center justify-between gap-2 border-t border-border/80 px-4 py-2.5',
            'bg-muted/15 text-xs font-semibold text-muted-foreground transition-colors duration-200',
            'group-hover/card:bg-nesy-soft/30 group-hover/card:text-nesy-ink',
            'group-focus-within/card:bg-nesy-soft/30 group-focus-within/card:text-nesy-ink',
          )}
        >
          <span>Open workflow</span>
          <ChevronRight
            className="size-4 shrink-0 transition-transform duration-200 group-hover/card:translate-x-0.5 group-hover/card:text-nesy"
            strokeWidth={2.2}
          />
        </div>
      </Link>
    </article>
  )
}
