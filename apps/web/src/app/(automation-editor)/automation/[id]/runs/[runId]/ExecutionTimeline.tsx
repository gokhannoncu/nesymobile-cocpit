"use client";

import { useCallback, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  AlertTriangle,
  X,
  FastForward,
  Check
} from "lucide-react";
import { cn } from "@nesy/metronic/lib/utils";
import type { WorkflowStepResult } from "@/services/automation-api";

export type ExecutionStepStatus = "completed" | "running" | "failed" | "pending" | "warning" | "skipped";

export interface ExecutionTimelineStep {
  id: string;
  order: number;
  title: string;
  status: ExecutionStepStatus;
  duration: string;
  startOffsetSeconds: number;
}

const SCROLL_AMOUNT = 240;

const STEP_THEME: Record<
  ExecutionStepStatus,
  {
    circle: string;
    badge: string;
  }
> = {
  completed: {
    circle: "bg-[#10b981] text-white",
    badge: "bg-slate-100 text-slate-600 border border-slate-200/50",
  },
  running: {
    circle: "bg-blue-500 text-white shadow-sm ring-4 ring-blue-500/20",
    badge: "bg-slate-100 text-slate-600 border border-slate-200/50",
  },
  failed: {
    circle: "bg-rose-500 text-white",
    badge: "bg-slate-100 text-slate-600 border border-slate-200/50",
  },
  pending: {
    circle: "bg-slate-300 text-white",
    badge: "bg-slate-100 text-slate-600 border border-slate-200/50",
  },
  skipped: {
    circle: "bg-slate-200 text-slate-500",
    badge: "bg-slate-100 text-slate-500 border border-slate-200/50",
  },
  warning: {
    circle: "bg-amber-500 text-white",
    badge: "bg-slate-100 text-slate-600 border border-slate-200/50",
  },
};

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "00:00";
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function mapStepStatus(status: string, runStatus?: string): ExecutionStepStatus {
  if (status === "success") return "completed";
  if (status === "warning") return "warning";
  if (status === "failed") return "failed";
  if (status === "running") return "running";
  if (status === "skipped") return "skipped";
  if (status === "pending" && runStatus && runStatus !== "running" && runStatus !== "pending") {
    return "pending";
  }
  return "pending";
}

function computeStepStartOffsets(steps: WorkflowStepResult[]): number[] {
  const firstStartedAtMs = steps.reduce<number | null>((earliest, step) => {
    if (!step.startedAt) return earliest;
    const timestamp = new Date(step.startedAt).getTime();
    if (Number.isNaN(timestamp)) return earliest;
    return earliest === null || timestamp < earliest ? timestamp : earliest;
  }, null);

  return steps.map((step, index) => {
    if (step.startedAt && firstStartedAtMs !== null) {
      const timestamp = new Date(step.startedAt).getTime();
      if (!Number.isNaN(timestamp)) {
        return Math.max(0, (timestamp - firstStartedAtMs) / 1000);
      }
    }

    let elapsedMs = 0;
    for (let i = 0; i < index; i++) {
      elapsedMs += steps[i]?.duration ?? 0;
    }
    return elapsedMs / 1000;
  });
}

export function toExecutionTimelineSteps(
  steps: WorkflowStepResult[],
  runStatus: string
): ExecutionTimelineStep[] {
  const startOffsets = computeStepStartOffsets(steps);

  return steps.map((step, index) => ({
    id: step.id,
    order: step.order,
    title: step.nodeTitle || step.nodeType,
    status: mapStepStatus(step.status, runStatus),
    duration: formatDuration((startOffsets[index] ?? 0) * 1000),
    startOffsetSeconds: startOffsets[index] ?? 0,
  }));
}

function TimelineArrowButton({
  direction,
  onClick,
}: {
  direction: "left" | "right";
  onClick: () => void;
}) {
  const Icon = direction === "left" ? ChevronLeft : ChevronRight;

  return (
    <div className="flex items-center justify-center px-2 shrink-0 select-none">
      <button
        type="button"
        onClick={onClick}
        aria-label={direction === "left" ? "Scroll timeline left" : "Scroll timeline right"}
        className="flex size-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-800 shadow-sm active:scale-95 cursor-pointer"
      >
        <Icon className="size-4 stroke-[2.5]" />
      </button>
    </div>
  );
}

export function ExecutionTimeline({
  steps,
  activeStepId,
  onStepClick,
}: {
  steps: ExecutionTimelineStep[];
  activeStepId?: string | null;
  onStepClick?: (step: ExecutionTimelineStep) => void;
}) {
  const timelineRef = useRef<HTMLDivElement>(null);

  const scrollTimeline = useCallback((dir: "left" | "right") => {
    const el = timelineRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -SCROLL_AMOUNT : SCROLL_AMOUNT, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (activeStepId) {
      const activeEl = timelineRef.current?.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }
  }, [activeStepId]);

  if (steps.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs p-1">
      <div className="flex items-center h-[130px]">
        <TimelineArrowButton direction="left" onClick={() => scrollTimeline("left")} />

        <div className="w-px h-14 bg-slate-100 shrink-0" />

        <div
          ref={timelineRef}
          className="timeline-scroll min-w-0 flex-1 overflow-x-auto px-2 h-full flex items-center"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <style>{`.timeline-scroll::-webkit-scrollbar { display: none; }`}</style>

          <div className="flex items-center gap-1.5 py-1" style={{ minWidth: "max-content" }}>
            {steps.map((step, index) => {
              const isSelected = activeStepId === step.id;
              const isActiveHighlight = isSelected && step.status !== "skipped";
              
              const status = isActiveHighlight ? "running" : step.status;
              const theme = STEP_THEME[status];
              const isLast = index === steps.length - 1;
              const StepRoot = onStepClick ? "button" : "div";

              let statusIcon = null;
              if (isActiveHighlight) {
                statusIcon = (
                  <div className="mt-1 flex items-center justify-center size-4 rounded-full bg-blue-50 text-blue-500 ring-1 ring-blue-100">
                    <RotateCw className="size-2.5 animate-spin" />
                  </div>
                );
              } else if (step.status === "completed") {
                statusIcon = (
                  <div className="mt-1 flex items-center justify-center size-4 rounded-full bg-[#ecfdf5] text-[#059669] ring-1 ring-[#d1fae5]">
                    <Check className="size-2.5 stroke-[3]" />
                  </div>
                );
              } else if (step.status === "warning") {
                statusIcon = (
                  <div className="mt-1 flex items-center justify-center size-4 rounded-full bg-[#fffbeb] text-[#d97706] ring-1 ring-[#fef3c7]">
                    <AlertTriangle className="size-2.5 stroke-[2.5]" />
                  </div>
                );
              } else if (step.status === "failed") {
                statusIcon = (
                  <div className="mt-1 flex items-center justify-center size-4 rounded-full bg-[#fdf2f8] text-[#e11d48] ring-1 ring-[#ffe4e6]">
                    <X className="size-2.5 stroke-[3]" />
                  </div>
                );
              } else if (step.status === "skipped") {
                statusIcon = (
                  <div className="mt-1 flex items-center justify-center size-4 rounded-full bg-slate-50 text-slate-400 ring-1 ring-slate-100">
                    <FastForward className="size-2.5 stroke-[2.5]" />
                  </div>
                );
              } else {
                statusIcon = (
                  <div className="mt-1 flex items-center justify-center size-4 rounded-full bg-slate-50 text-slate-400 ring-1 ring-slate-100">
                    <FastForward className="size-2.5 stroke-[2.5]" />
                  </div>
                );
              }

              return (
                <div
                  key={step.id}
                  data-active={isSelected ? "true" : undefined}
                  className="flex shrink-0 items-center"
                >
                  <StepRoot
                    type={onStepClick ? "button" : undefined}
                    onClick={onStepClick ? () => onStepClick(step) : undefined}
                    className={cn(
                      "flex flex-col items-center justify-between p-2.5 outline-none transition-all duration-200 select-none w-[114px] h-[116px] text-center",
                      onStepClick && "cursor-pointer",
                      isActiveHighlight
                        ? "border border-blue-400 bg-blue-50/20 rounded-xl shadow-xs"
                        : "border border-transparent rounded-xl hover:bg-slate-50/50"
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold shadow-xs",
                        theme.circle
                      )}
                    >
                      {index + 1}
                    </div>

                    {statusIcon}

                    <span className="mt-1.5 w-full px-1 text-center text-[11px] font-bold leading-tight text-slate-700 truncate">
                      {step.title}
                    </span>

                    <span
                      className={cn(
                        "mt-1.5 inline-flex h-4.5 items-center rounded px-1.5 text-[9px] font-semibold font-mono tabular-nums shadow-2xs",
                        theme.badge
                      )}
                    >
                      {step.duration}
                    </span>
                  </StepRoot>

                  {!isSelected && !isLast && steps[index + 1]?.id !== activeStepId && (
                    <div className="flex items-center justify-center shrink-0 w-4">
                      <div className="w-px h-14 bg-slate-100" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="w-px h-14 bg-slate-100 shrink-0" />

        <TimelineArrowButton direction="right" onClick={() => scrollTimeline("right")} />
      </div>
    </div>
  );
}
