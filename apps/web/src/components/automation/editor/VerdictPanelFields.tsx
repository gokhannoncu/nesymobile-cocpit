'use client'

import React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@nesy/metronic/components/ui/select'
import { cn } from '@nesy/metronic/lib/utils'

export type VerdictPanelSelectOption = {
  value: string
  label: string
}

const selectTriggerClass =
  'h-9 w-full rounded-lg border-slate-200/90 bg-white text-xs font-medium text-slate-800 shadow-none focus-visible:border-slate-300 focus-visible:ring-2 focus-visible:ring-slate-200/80'

export function VerdictPanelFieldLabel({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn('mb-1.5 block text-[11px] font-semibold text-slate-600', className)}
    >
      {children}
    </label>
  )
}

export function VerdictPanelSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder = 'Select…',
  tone = 'default',
  disabled,
}: {
  id?: string
  value: string
  onValueChange: (value: string) => void
  options: readonly VerdictPanelSelectOption[]
  placeholder?: string
  tone?: 'default' | 'danger'
  disabled?: boolean
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger
        id={id}
        size="sm"
        className={cn(
          selectTriggerClass,
          tone === 'danger' && 'text-rose-700 focus-visible:ring-rose-100',
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="z-[80]">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="text-xs">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function VerdictPanelTextarea({
  id,
  value,
  onChange,
  rows = 3,
  placeholder,
  mono = false,
}: {
  id?: string
  value?: string
  onChange?: (value: string) => void
  rows?: number
  placeholder?: string
  mono?: boolean
}) {
  return (
    <textarea
      id={id}
      rows={rows}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      className={cn(
        'w-full resize-y rounded-lg border border-slate-200/90 bg-white px-2.5 py-2 text-xs text-slate-800 outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80',
        mono && 'font-mono',
      )}
    />
  )
}

export function VerdictPanelInput({
  id,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  id?: string
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  type?: React.HTMLInputTypeAttribute
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      placeholder={placeholder}
      className="w-full rounded-lg border border-slate-200/90 bg-white px-2.5 py-2 text-xs font-medium text-slate-800 outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-200/80"
    />
  )
}

export function VerdictPanelNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-2.5 py-2 text-[10px] leading-snug text-slate-600">
      {children}
    </p>
  )
}

export function VerdictPanelHeader({
  icon: Icon,
  title,
  description,
  iconClassName,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  title: string
  description?: string
  iconClassName?: string
}) {
  return (
    <header className="mb-3">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className={cn('size-4 shrink-0', iconClassName ?? 'text-slate-500')} aria-hidden />
        <h3 className="truncate text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {description ? (
        <p className="mt-1 text-[10px] leading-snug text-slate-500">{description}</p>
      ) : null}
    </header>
  )
}
