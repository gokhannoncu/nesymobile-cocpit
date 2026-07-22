"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Box, CheckCircle2, CircleX, Database, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@nesy/metronic/lib/utils";
import {
  BACKEND_LANE_HEADER_HEIGHT,
  BACKEND_LANE_NODE_WIDTH,
  BACKEND_LANE_STEP_HEIGHT,
  type BackendValidationKind,
} from "./backend-validation-lane";
import { iconRegistry } from "./workflow-registry";
import type { getCanvasNodeExecutionStatus } from "./workflow-run-visualization";

type BackendLaneRenderNode = {
  id: string;
  position: { x: number; y: number };
  data: {
    title?: string;
    subtitle?: string;
    icon?: string;
    config?: Record<string, unknown>;
  };
  visualRole?: "backend_header" | "backend_lane" | "start_trigger";
};

const CHECK_BADGE_STYLES: Record<BackendValidationKind, string> = {
  server_step: "border-sky-200 bg-sky-50 text-sky-700",
  event_tower: "border-violet-200 bg-violet-50 text-violet-700",
  logcat_backend: "border-amber-200 bg-amber-50 text-amber-800",
};

function checkBadgeClass(kind: BackendValidationKind | undefined): string {
  if (!kind) return "border-slate-200 bg-slate-100 text-slate-600";
  return CHECK_BADGE_STYLES[kind];
}

function BackendExecutionIndicator({
  status,
}: {
  status: NonNullable<ReturnType<typeof getCanvasNodeExecutionStatus>>;
}) {
  if (status === "running") return <Loader2 className="size-4 animate-spin text-blue-500" aria-hidden />;
  if (status === "success") return <CheckCircle2 className="size-4 shrink-0 text-emerald-500" aria-label="Completed" />;
  if (status === "failed") return <CircleX className="size-4 shrink-0 text-red-500" aria-label="Failed" />;
  return null;
}

export const BackendLaneNodeView = memo(function BackendLaneNodeView({
  node,
  executionStatus,
}: {
  node: BackendLaneRenderNode;
  executionStatus: ReturnType<typeof getCanvasNodeExecutionStatus>;
}) {
  const isHeader = node.visualRole === "backend_header";
  const config = node.data.config ?? {};
  const checkLabel = typeof config.checkLabel === "string" ? config.checkLabel : null;
  const validationKind = config.validationKind as BackendValidationKind | undefined;
  const description =
    typeof config.description === "string"
      ? config.description
      : node.data.subtitle ?? "";
  const Icon = isHeader
    ? ShieldCheck
    : iconRegistry[node.data.icon ?? "Database"] ?? Box;
  const height = isHeader ? BACKEND_LANE_HEADER_HEIGHT : BACKEND_LANE_STEP_HEIGHT;

  return (
    <motion.div
      initial={{ left: node.position.x, opacity: 0, scale: 0.96, top: node.position.y }}
      animate={{ left: node.position.x, opacity: 1, scale: 1, top: node.position.y }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={cn(
        "pointer-events-none absolute z-10 overflow-hidden rounded-xl border text-left shadow-sm",
        isHeader
          ? "border-slate-300/90 bg-gradient-to-br from-white to-slate-50"
          : "border-slate-200/90 bg-white",
        executionStatus === "running" &&
          "border-blue-300/90 shadow-[0_0_0_3px_rgba(59,130,246,0.12)] ring-2 ring-blue-100/80",
        executionStatus === "success" && "border-emerald-200/90",
        executionStatus === "failed" &&
          "border-red-300/90 shadow-[0_0_0_3px_rgba(239,68,68,0.12)] ring-2 ring-red-100/80",
      )}
      style={{ left: node.position.x, top: node.position.y, width: BACKEND_LANE_NODE_WIDTH, minHeight: height }}
    >
      <div className={cn("flex h-full flex-col px-3 py-2.5", isHeader ? "justify-center gap-1" : "gap-1.5")}>
        <div className="flex items-start gap-2.5">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg border",
              isHeader
                ? "border-slate-200 bg-white text-slate-600"
                : "border-slate-200 bg-slate-50 text-slate-600",
            )}
          >
            <Icon className="size-4.5" />
          </span>
          <span className="min-w-0 flex-1">
            {!isHeader && checkLabel ? (
              <span
                className={cn(
                  "mb-1 inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  checkBadgeClass(validationKind),
                )}
              >
                {checkLabel}
              </span>
            ) : null}
            <span
              className={cn(
                "block leading-snug text-slate-800",
                isHeader ? "text-[13px] font-semibold" : "text-[13px] font-semibold",
              )}
            >
              {node.data.title}
            </span>
            {isHeader ? (
              <span className="mt-0.5 block text-[11px] font-medium leading-snug text-slate-500">
                {node.data.subtitle}
              </span>
            ) : (
              <span className="mt-1 block text-[11px] font-medium leading-snug text-slate-500">
                {description}
              </span>
            )}
          </span>
          {executionStatus ? (
            <span className="shrink-0 pt-0.5">
              <BackendExecutionIndicator status={executionStatus} />
            </span>
          ) : null}
        </div>
      </div>
      {executionStatus === "running" ? (
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-xl bg-blue-100"
          aria-hidden
        >
          <span className="block h-full w-1/3 animate-[workflow-run-progress_1.1s_ease-in-out_infinite] rounded-full bg-blue-500" />
        </span>
      ) : null}
    </motion.div>
  );
});
