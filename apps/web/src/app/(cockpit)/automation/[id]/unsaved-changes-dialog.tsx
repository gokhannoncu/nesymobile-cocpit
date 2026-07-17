"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@nesy/metronic/components/ui/button";

export function UnsavedChangesDialog({
  open,
  isSaving,
  onCancel,
  onCloseWithoutSaving,
  onSaveAndClose,
}: {
  open: boolean;
  isSaving: boolean;
  onCancel: () => void;
  onCloseWithoutSaving: () => void;
  onSaveAndClose: () => void;
}) {
  useEffect(() => {
    if (!open || isSaving) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSaving, onCancel, open]);

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
          aria-label="Unsaved changes"
        >
          <motion.button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 bg-[rgba(15,23,42,0.22)] backdrop-blur-[5px]"
            disabled={isSaving}
            onClick={onCancel}
          />

          <motion.section
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative z-10 w-full max-w-[560px] rounded-[6px] border border-[#E8EDF5] bg-white p-6 shadow-[0_8px_32px_rgba(15,23,42,0.09),0_2px_8px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-500">
                  <AlertTriangle className="size-[22px]" strokeWidth={2} />
                </span>
                <div className="min-w-0 space-y-1">
                  <h2 className="text-[26px] font-semibold leading-snug tracking-tight text-slate-950">Unsaved changes</h2>
                  <p className="line-clamp-2 max-w-[460px] text-[15px] leading-snug text-slate-600">
                    You have unsaved changes. Publish before closing or your changes will be lost.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onCancel}
                disabled={isSaving}
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-50"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2 pt-0.5">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-[6px] px-4 text-sm font-medium text-slate-700"
                disabled={isSaving}
                onClick={onCloseWithoutSaving}
              >
                Close
              </Button>
              <Button
                type="button"
                className="h-10 rounded-[6px] bg-nesy px-4 text-sm font-medium text-white hover:bg-nesy-hover disabled:opacity-70"
                disabled={isSaving}
                onClick={onSaveAndClose}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  "Publish & Close"
                )}
              </Button>
            </div>
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
