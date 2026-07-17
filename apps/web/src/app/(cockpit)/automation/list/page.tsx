'use client'

import type { ReactNode } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  fetchWorkflows,
  createWorkflow,
  deleteWorkflow,
  type WorkflowListItem,
} from '@/services/automation-api'
import {
  Archive,
  Bell,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Cloud,
  Database,
  FileUp,
  FileX2,
  IdCard,
  Layers,
  ListChecks,
  Lock,
  Mail,
  MapPin,
  Package,
  PenLine,
  Pencil,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Truck,
  WalletCards,
  Workflow,
  X,
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
import { Button } from '@nesy/metronic/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nesy/metronic/components/ui/select'
import { cn } from '@nesy/metronic/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AutomationListGridShimmer,
  AutomationListStatCardsShimmer,
  ShimmerBlock,
} from '@/components/automation/automation-list-page-shimmer'
import { ProductPage } from '@/components/product'
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

function buildPaginationPages(current: number, total: number): Array<number | 'ellipsis'> {
  if (total <= 0) return []
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages = new Set<number>()
  pages.add(1)
  pages.add(total)
  for (let p = current - 1; p <= current + 1; p++) {
    if (p >= 1 && p <= total) pages.add(p)
  }
  if (current <= 4) {
    for (let p = 2; p <= 5; p++) pages.add(p)
  }
  if (current >= total - 3) {
    for (let p = total - 4; p <= total - 1; p++) {
      if (p >= 1) pages.add(p)
    }
  }

  const sorted = [...pages].sort((a, b) => a - b)
  const out: Array<number | 'ellipsis'> = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('ellipsis')
    out.push(sorted[i])
  }
  return out
}

const filterTriggerClass =
  'h-12 max-h-[3rem] rounded-md border-border shadow-xs px-3 [&>svg]:text-muted-foreground'

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
  {
    title: 'Import YAML',
    description: 'Upload an existing Maestro YAML flow.',
    icon: FileUp,
    enabled: false,
  },
]

const summaryCards = [
  {
    title: 'Total Workflows',
    value: '—',
    detail: 'Across all environments',
    icon: Workflow,
    className: 'bg-nesy-soft text-nesy-ink',
  },
  {
    title: 'Active',
    value: '—',
    detail: 'Active workflows',
    icon: Play,
    className: 'bg-emerald-100 text-emerald-700',
  },
  {
    title: 'Draft',
    value: '—',
    detail: 'Draft workflows',
    icon: Pencil,
    className: 'bg-amber-100 text-amber-700',
  },
  {
    title: 'Archived',
    value: '—',
    detail: 'Archived workflows',
    icon: Archive,
    className: 'bg-muted text-muted-foreground',
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
  FileUp,
  CircleDot,
  Check,
  CheckCircle2,
}

function resolveIcon(iconName: string): LucideIcon {
  return iconMap[iconName] ?? Workflow
}

export default function AutomationListPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)
  const [modalOpen, setModalOpen] = useState(false)
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadWorkflows = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchWorkflows(search ? { search } : undefined)
      setWorkflows(data)
    } catch (err) {
      console.error('Failed to load workflows:', err)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    loadWorkflows()
  }, [loadWorkflows])

  const stats = useMemo(() => {
    const total = workflows.length
    const active = workflows.filter((w) => w.status === 'active').length
    const draft = workflows.filter((w) => w.status === 'draft').length
    const archived = workflows.filter((w) => w.status === 'archived').length
    return [
      { ...summaryCards[0], value: String(total), detail: 'Across all environments' },
      {
        ...summaryCards[1],
        value: String(active),
        detail: `${total ? ((active / total) * 100).toFixed(1) : 0}% of total`,
      },
      {
        ...summaryCards[2],
        value: String(draft),
        detail: `${total ? ((draft / total) * 100).toFixed(1) : 0}% of total`,
      },
      {
        ...summaryCards[3],
        value: String(archived),
        detail: `${total ? ((archived / total) * 100).toFixed(1) : 0}% of total`,
      },
    ]
  }, [workflows])

  const totalPages = Math.max(1, Math.ceil(workflows.length / pageSize))

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  const safePage = Math.min(page, totalPages)
  const pageSlice = useMemo(() => {
    const p = Math.min(page, totalPages)
    const start = (p - 1) * pageSize
    return workflows.slice(start, start + pageSize)
  }, [workflows, page, pageSize, totalPages])

  const paginationPages = buildPaginationPages(safePage, totalPages)

  const goPrev = () => setPage((p) => Math.max(1, p - 1))
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1))

  const handleDelete = async (workflowId: string, slug: string) => {
    try {
      await deleteWorkflow(workflowId)
      setWorkflows((prev) => prev.filter((w) => w.id !== workflowId))
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
      setWorkflows((prev) => [newWorkflow, ...prev])
      setModalOpen(false)
      router.push(`/automation/${newWorkflow.slug}`)
      return newWorkflow
    } catch (err) {
      console.error('Failed to create workflow:', err)
      return null
    }
  }

  return (
    <ProductPage path="/automation/list">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">Workflow Library</h1>
        <Button
          onClick={() => setModalOpen(true)}
          className="h-[38px] rounded-md border-transparent bg-nesy px-6 text-white shadow-[0_10px_24px_rgba(255,122,26,0.28)] hover:bg-nesy-hover hover:text-white"
        >
          <Plus className="size-4" strokeWidth={2.75} />
          New Workflow
        </Button>
      </header>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {loading
          ? <AutomationListStatCardsShimmer />
          : stats.map((card) => (
              <div
                key={card.title}
                className="rounded-md border border-border bg-card px-4 py-2.5 shadow-xs"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex size-11 shrink-0 items-center justify-center rounded-md ${card.className}`}
                  >
                    <card.icon className="size-6" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">{card.title}</p>
                    <p className="mt-0.5 text-2xl font-semibold leading-none text-foreground">
                      {card.value}
                    </p>
                    <p className="mt-1 text-[11px] leading-tight text-muted-foreground">
                      {card.detail}
                    </p>
                  </div>
                </div>
              </div>
            ))}
      </section>

      <section className="rounded-md border border-border bg-card p-4 shadow-xs">
        {loading && workflows.length === 0 ? (
          <ShimmerBlock className="h-12 w-full rounded-md" aria-hidden />
        ) : (
          <label className="flex h-12 max-h-[3rem] w-full items-center gap-3 rounded-md border border-border bg-card px-4 text-muted-foreground shadow-xs">
            <Search className="size-5 shrink-0" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="Search workflows..."
              type="search"
            />
          </label>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="flex flex-wrap items-baseline gap-x-1 text-xl font-semibold tracking-[-0.02em] text-foreground">
          All Workflows
          {loading ? (
            <ShimmerBlock className="inline-block h-4 w-10 rounded-sm" />
          ) : (
            <span className="text-sm font-medium text-muted-foreground">({workflows.length})</span>
          )}
        </h2>

        {loading ? (
          <AutomationListGridShimmer count={3} />
        ) : pageSlice.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            No workflows match your filters.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
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

      {totalPages > 1 ? (
        <footer className="flex flex-col gap-4 pb-2 sm:flex-row sm:items-center">
          <div className="hidden sm:block sm:flex-1" aria-hidden />
          <div className="flex flex-wrap items-center justify-center gap-2">
            <PaginationButton aria-label="Previous page" disabled={safePage <= 1} onClick={goPrev}>
              <ChevronLeft className="size-4" />
            </PaginationButton>
            {paginationPages.map((item, idx) =>
              item === 'ellipsis' ? (
                <span
                  key={`e-${idx}`}
                  className="flex size-10 items-center justify-center text-sm font-medium text-muted-foreground"
                  aria-hidden
                >
                  …
                </span>
              ) : (
                <PaginationButton
                  key={item}
                  active={item === safePage}
                  onClick={() => setPage(item)}
                >
                  {item}
                </PaginationButton>
              ),
            )}
            <PaginationButton
              aria-label="Next page"
              disabled={safePage >= totalPages}
              onClick={goNext}
            >
              <ChevronRight className="size-4" />
            </PaginationButton>
          </div>

          <div className="flex justify-center sm:flex-1 sm:justify-end">
            <Select
              value={String(pageSize)}
              onValueChange={(v) => {
                const next = Number(v)
                setPageSize(next)
                setPage(1)
              }}
            >
              <SelectTrigger
                size="lg"
                className={cn(filterTriggerClass, 'w-[170px] justify-between gap-2')}
              >
                <SelectValue placeholder="Per page" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">4 per page</SelectItem>
                <SelectItem value="8">8 per page</SelectItem>
                <SelectItem value="12">12 per page</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </footer>
      ) : null}

      <AnimatePresence>
        {modalOpen && (
          <CreateWorkflowModal onClose={() => setModalOpen(false)} onCreate={handleCreate} />
        )}
      </AnimatePresence>
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

function WorkflowCard({
  workflow,
  onDelete,
}: {
  workflow: WorkflowListItem
  onDelete: () => void
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const Icon = resolveIcon(workflow.icon)
  const statusLabel = workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)

  const statusClasses: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
    draft: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    archived: 'bg-muted text-muted-foreground',
  }

  const timeSince = useMemo(() => {
    const diff = Date.now() - new Date(workflow.updatedAt).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `Updated ${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `Updated ${hours}h ago`
    const days = Math.floor(hours / 24)
    return `Updated ${days}d ago`
  }, [workflow.updatedAt])

  return (
    <article className="rounded-md border border-border bg-card p-4 shadow-xs">
      <WorkflowDeleteDialog
        workflowTitle={workflow.name}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={() => {
          onDelete()
          setDeleteOpen(false)
        }}
      />

      <div className="flex items-center justify-between gap-2">
        <span
          className={`rounded-md px-3 py-1 text-xs font-semibold tabular-nums ${statusClasses[workflow.status] ?? 'bg-muted text-muted-foreground'}`}
        >
          {statusLabel}
        </span>
        {workflow.category && (
          <span className="rounded-md px-3 py-1 text-xs font-semibold bg-nesy-soft text-nesy-ink">
            {workflow.category}
          </span>
        )}
      </div>

      <div className="mt-5 flex items-center gap-4">
        <div
          className={`flex size-16 shrink-0 items-center justify-center rounded-md ${workflow.iconClassName || 'bg-gradient-to-br from-nesy to-nesy-hover text-white'}`}
        >
          <Icon className="size-9" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xl font-semibold tracking-[-0.02em] text-foreground">
            {workflow.name}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted-foreground">
            {workflow.description ?? 'No description'}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3 border-t border-border pt-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{timeSince}</p>
          {workflow.latestVersion && (
            <p className="mt-1 text-xs text-muted-foreground">
              v{workflow.latestVersion.version}
            </p>
          )}
          {workflow.lastRun && (
            <p
              className={`mt-1 text-xs font-semibold ${
                workflow.lastRun.status === 'success'
                  ? 'text-emerald-600'
                  : workflow.lastRun.status === 'failed'
                    ? 'text-red-600'
                    : 'text-muted-foreground'
              }`}
            >
              Last run: {workflow.lastRun.status}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/automation/${workflow.slug}`}
            className="inline-flex h-9 items-center rounded-md border border-nesy-muted px-4 text-sm font-semibold text-nesy-ink shadow-xs hover:bg-nesy-soft"
          >
            Open
          </Link>
          <button
            type="button"
            className="h-9 rounded-md border border-red-200 px-4 text-sm font-semibold text-red-600 shadow-xs hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
            onClick={() => setDeleteOpen(true)}
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  )
}

function PaginationButton({
  active,
  disabled,
  children,
  onClick,
  'aria-label': ariaLabel,
}: {
  active?: boolean
  disabled?: boolean
  children: ReactNode
  onClick?: () => void
  'aria-label'?: string
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex size-10 items-center justify-center rounded-md border text-sm font-medium shadow-xs transition-opacity',
        active
          ? 'border-nesy bg-nesy text-white'
          : 'border-border bg-card text-foreground',
        disabled && 'cursor-not-allowed opacity-40',
      )}
    >
      {children}
    </button>
  )
}
