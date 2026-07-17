"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Clock3, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@nesy/metronic/components/ui/button";
import { cn } from "@nesy/metronic/lib/utils";
import type { RuleValidationResult } from "./workflow-rule-engine";

export function InvalidWorkflowStepDialog({
  open,
  result,
  onClose,
  onPrimaryAction,
}: {
  open: boolean;
  result: RuleValidationResult | null;
  onClose: () => void;
  /** Used when `suggestedAction === "AUTO_CREATE_REQUIRED_FLOW"`. */
  onPrimaryAction?: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const payload = result?.dialog;
  const title = payload?.title ?? result?.title ?? "Invalid operation";
  const message = payload?.message ?? result?.message ?? "This action is not allowed in current workflow state.";
  const beforeItems = payload?.beforeItems ?? [];
  const afterItems = payload?.afterItems ?? [];
  const showAutoCreate =
    result?.suggestedAction === "AUTO_CREATE_REQUIRED_FLOW" && typeof onPrimaryAction === "function";

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[95] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-[rgba(15,23,42,0.22)] backdrop-blur-[5px]"
            onClick={onClose}
          />

          <motion.section
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative z-10 w-full max-w-[560px] rounded-[20px] border border-[#E8EDF5] bg-white p-6 shadow-[0_8px_32px_rgba(15,23,42,0.09),0_2px_8px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-500">
                  <AlertTriangle className="size-[22px]" strokeWidth={2} />
                </span>
                <div className="min-w-0 space-y-1">
                  <h2 className="text-[26px] font-semibold leading-snug tracking-tight text-slate-950">{title}</h2>
                  <p className="line-clamp-2 max-w-[460px] text-[15px] leading-snug text-slate-600">{message}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {(beforeItems.length > 0 || afterItems.length > 0) && (
              <div className="mt-4 rounded-[14px] border border-slate-200/90 bg-slate-50/80 p-4">
                {beforeItems.length > 0 ? (
                  <section>
                    <div className="mb-2 flex items-center gap-2 text-slate-900">
                      <Clock3 className="size-4 shrink-0 text-orange-500" />
                      <h3 className="text-sm font-semibold leading-tight">{payload?.beforeTitle ?? "Allowed before"}</h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {beforeItems.map((item) => (
                        <Chip key={`before-${item}`} tone="warning" label={item} />
                      ))}
                    </div>
                  </section>
                ) : null}

                {beforeItems.length > 0 && afterItems.length > 0 ? <div className="my-2.5 h-px bg-slate-200/90" /> : null}

                {afterItems.length > 0 ? (
                  <section>
                    <div className="mb-2 flex items-center gap-2 text-slate-900">
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                      <h3 className="text-sm font-semibold leading-tight">{payload?.afterTitle ?? "Allowed after"}</h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {afterItems.map((item) => (
                        <Chip key={`after-${item}`} tone="success" label={item} />
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 pt-0.5">
              {showAutoCreate ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 rounded-[10px] px-4 text-sm font-medium text-slate-700"
                  onClick={onPrimaryAction}
                >
                  {result?.suggestedActionLabel ?? "Auto-create required flow"}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-[10px] px-4 text-sm font-medium text-slate-700"
                onClick={onClose}
              >
                Done
              </Button>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Chip({ tone, label }: { tone: "warning" | "success"; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-lg border px-2.5 text-[13px] font-medium leading-none",
        tone === "warning" && "border-orange-200 bg-orange-50 text-orange-800",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800",
      )}
    >
      {label}
    </span>
  );
}
