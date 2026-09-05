"use client";

import { motion } from "framer-motion";
import { cn } from "@nesy/metronic/lib/utils";
import { ShimmerBlock } from "@/components/automation/automation-list-page-shimmer";

const GRID_SPACING_PX = 20;
const GRID_DOT_RADIUS_PX = 1.2;
const GRID_DOT = "rgba(148, 163, 184, 0.22)";

const NODE_STAGGER = 0.11;

function LoadingDots() {
  return (
    <span className="inline-flex gap-0.5 pl-0.5" aria-hidden>
      {[0, 1, 2].map((index) => (
        <motion.span
          key={index}
          className="inline-block size-1 rounded-full bg-slate-400"
          animate={{ opacity: [0.25, 1, 0.25], scale: [0.85, 1, 0.85] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: index * 0.18 }}
        />
      ))}
    </span>
  );
}

function WorkflowCanvasNodeShimmer({
  widthClass = "w-[228px]",
  index,
}: {
  widthClass?: string;
  index: number;
}) {
  return (
    <motion.div
      className={cn(
        "rounded-xl border border-slate-200/80 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        widthClass,
      )}
      aria-hidden
      custom={index}
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1], delay: index * NODE_STAGGER }}
    >
      <motion.div
        className="flex items-center gap-2.5"
        animate={{ opacity: [0.72, 1, 0.72] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: index * 0.15 }}
      >
        <ShimmerBlock className="size-10 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <ShimmerBlock className="h-3.5 w-[72%]" />
          <ShimmerBlock className="mt-1.5 h-2.5 w-[48%]" />
        </div>
      </motion.div>
    </motion.div>
  );
}

function WorkflowCanvasConnectorShimmer({ delay = 0 }: { delay?: number }) {
  return (
    <div className="relative h-7 w-px overflow-visible" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-b from-slate-200/30 via-slate-300/80 to-slate-200/30" />
      <motion.span
        className="absolute left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-orange-400"
        style={{ boxShadow: "0 0 10px rgba(249,115,22,0.5)" }}
        animate={{ top: ["-10%", "110%"], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut", delay }}
      />
    </div>
  );
}

function WorkflowCanvasBranchShimmer({ delay = 0 }: { delay?: number }) {
  return (
    <div className="relative h-5 w-[17.5rem]" aria-hidden>
      <div className="absolute left-1/2 top-0 h-2.5 w-px -translate-x-1/2 bg-gradient-to-b from-slate-200/30 via-slate-300/80 to-slate-200/30" />
      <div className="absolute left-[calc(25%-0.5px)] right-[calc(25%-0.5px)] top-2.5 h-px bg-slate-200/80" />
      <div className="absolute left-[calc(25%-0.5px)] top-2.5 h-2.5 w-px bg-gradient-to-b from-slate-200/30 via-slate-300/80 to-slate-200/30" />
      <div className="absolute right-[calc(25%-0.5px)] top-2.5 h-2.5 w-px bg-gradient-to-b from-slate-200/30 via-slate-300/80 to-slate-200/30" />
      <motion.span
        className="absolute left-1/2 top-0 size-1.5 -translate-x-1/2 rounded-full bg-orange-400"
        style={{ boxShadow: "0 0 10px rgba(249,115,22,0.5)" }}
        animate={{ top: ["-15%", "115%"], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut", delay }}
      />
      <motion.span
        className="absolute left-[25%] top-2.5 size-1.5 -translate-x-1/2 rounded-full bg-orange-400"
        style={{ boxShadow: "0 0 10px rgba(249,115,22,0.45)" }}
        animate={{ left: ["50%", "25%"], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 0.85, repeat: Infinity, ease: "easeInOut", delay: delay + 0.45 }}
      />
      <motion.span
        className="absolute right-[25%] top-2.5 size-1.5 translate-x-1/2 rounded-full bg-orange-400"
        style={{ boxShadow: "0 0 10px rgba(249,115,22,0.45)" }}
        animate={{ right: ["50%", "25%"], opacity: [0, 1, 1, 0] }}
        transition={{ duration: 0.85, repeat: Infinity, ease: "easeInOut", delay: delay + 0.55 }}
      />
    </div>
  );
}

function WorkflowCanvasDiagramShimmer() {
  return (
    <div className="flex flex-col items-center" aria-hidden>
      <WorkflowCanvasNodeShimmer index={0} />
      <WorkflowCanvasConnectorShimmer delay={0} />
      <WorkflowCanvasNodeShimmer index={1} />
      <WorkflowCanvasConnectorShimmer delay={0.35} />
      <WorkflowCanvasNodeShimmer index={2} />
      <WorkflowCanvasBranchShimmer delay={0.7} />
      <div className="flex gap-14">
        <WorkflowCanvasNodeShimmer widthClass="w-[196px]" index={3} />
        <WorkflowCanvasNodeShimmer widthClass="w-[196px]" index={4} />
      </div>
    </div>
  );
}

export function WorkflowCanvasLoadingShimmer({ title }: { title?: string }) {
  return (
    <div className="relative flex h-full w-full overflow-hidden bg-[#F8FAFC]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.45]"
        style={{
          backgroundImage: `radial-gradient(circle, ${GRID_DOT} ${GRID_DOT_RADIUS_PX}px, transparent ${GRID_DOT_RADIUS_PX}px)`,
          backgroundSize: `${GRID_SPACING_PX}px ${GRID_SPACING_PX}px`,
        }}
      />

      <motion.div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.04)_0%,transparent_55%)]"
        animate={{ opacity: [0.35, 0.7, 0.35] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      <div className="relative flex flex-1 items-center justify-center px-8 py-12">
        <div className="flex max-w-md flex-col items-center gap-6">
          <WorkflowCanvasDiagramShimmer />

          <motion.div
            className="text-center"
            role="status"
            aria-live="polite"
            aria-busy="true"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.55, ease: "easeOut" }}
          >
            <p className="flex items-center justify-center gap-1 text-sm font-medium text-slate-500">
              Loading workflow
              <LoadingDots />
            </p>
            {title ? <p className="mt-1.5 truncate text-xs text-slate-400">{title}</p> : null}
            <p className="sr-only">Please wait while the workflow canvas loads.</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
