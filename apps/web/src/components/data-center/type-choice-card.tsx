"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@nesy/metronic/lib/utils";

export function TypeChoiceCard({
  title,
  description,
  icon: Icon,
  selected,
  disabled,
  onClick,
  className,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group relative flex min-h-[5.25rem] w-full flex-col items-start gap-2 rounded-lg border bg-background p-3 text-left transition-all",
        "hover:border-nesy/60 hover:bg-nesy-soft/25",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nesy/40 focus-visible:ring-offset-2",
        selected && "border-nesy bg-nesy-soft/45 shadow-[inset_0_0_0_1px_var(--nesy-orange)]",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <span
        className={cn(
          "absolute end-2.5 top-2.5 flex size-[18px] items-center justify-center rounded-full border transition-colors",
          selected
            ? "border-nesy bg-nesy text-white"
            : "border-muted-foreground/25 bg-background group-hover:border-nesy/40",
        )}
        aria-hidden
      >
        {selected && <Check className="size-2.5 stroke-[2.5]" />}
      </span>

      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-nesy-soft text-nesy">
        <Icon className="size-4" />
      </span>

      <span className="min-w-0 pe-6">
        <span className="block text-[13px] font-semibold leading-snug text-foreground">
          {title}
        </span>
        {description ? (
          <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function TypeChoiceGrid({
  children,
  columns = 3,
  className,
}: {
  children: ReactNode;
  columns?: 2 | 3;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-2",
        columns === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3",
        className,
      )}
    >
      {children}
    </div>
  );
}
