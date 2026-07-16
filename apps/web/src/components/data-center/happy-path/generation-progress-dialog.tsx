"use client";



import { Check, Loader2, SkipForward, X } from "lucide-react";

import { Button } from "@nesy/metronic/components/ui/button";

import {

  Dialog,

  DialogContent,

  DialogHeader,

  DialogTitle,

} from "@nesy/metronic/components/ui/dialog";

import { cn } from "@nesy/metronic/lib/utils";

import type { GenerationJob } from "@/lib/happy-path/happy-path-generation";



interface GenerationProgressDialogProps {

  open: boolean;

  jobs: GenerationJob[];

  currentIndex: number;

  isRunning: boolean;

  onClose: () => void;

}



function getRunningStatusText(job: GenerationJob): string {

  if (job.unloadPhase === "running") {

    const parcel = job.currentUnloadParcel ?? 1;

    const total = job.parcelsTotal ?? parcel;

    return `Unloading ${job.label} — parcel ${parcel}/${total}…`;

  }

  return `Creating ${job.label}…`;

}



function getUnloadStatusText(job: GenerationJob): string | null {

  if (job.unloadPhase === "none" || job.unloadPhase === "pending") return null;

  if (job.unloadPhase === "success" && job.parcelsTotal != null) {

    return `${job.parcelsUnloaded ?? job.parcelsTotal}/${job.parcelsTotal} unloaded`;

  }

  if (job.unloadPhase === "failed") {

    return job.unloadError ?? "unload failed";

  }

  return null;

}



export function GenerationProgressDialog({

  open,

  jobs,

  currentIndex,

  isRunning,

  onClose,

}: GenerationProgressDialogProps) {

  const executable = jobs.filter((j) => j.route !== "skip");

  const successCount = jobs.filter((j) => j.status === "success").length;

  const failedCount = jobs.filter((j) => j.status === "failed").length;

  const skippedCount = jobs.filter((j) => j.status === "skipped").length;

  const unloadedCount = jobs.filter((j) => j.unloadPhase === "success").length;

  const unloadFailedCount = jobs.filter((j) => j.unloadPhase === "failed").length;

  const progressPct =

    executable.length > 0

      ? Math.round(

          (jobs.filter((j) => j.status !== "pending" && j.status !== "running").length /

            jobs.length) *

            100,

        )

      : 0;



  const currentJob = jobs.find((j) => j.status === "running");



  return (

    <Dialog open={open} onOpenChange={(v) => !v && !isRunning && onClose()}>

      <DialogContent className="max-w-lg">

        <DialogHeader>

          <DialogTitle>

            {isRunning ? "Generating Happy Path Set…" : "Generation complete"}

          </DialogTitle>

        </DialogHeader>



        <div className="space-y-4">

          <div className="h-2 overflow-hidden rounded-full bg-muted">

            <div

              className="h-full bg-nesy-soft0 transition-all duration-300"

              style={{ width: `${progressPct}%` }}

            />

          </div>



          {isRunning && currentJob && (

            <p className="text-sm text-muted-foreground">

              {getRunningStatusText(currentJob)} ({currentIndex + 1} / {executable.length})

            </p>

          )}



          {!isRunning && (

            <p className="text-sm text-foreground">

              {successCount} created

              {unloadedCount > 0 ? `, ${unloadedCount} unloaded` : ""}

              {skippedCount > 0 ? `, ${skippedCount} skipped` : ""}

              {failedCount > 0 ? `, ${failedCount} failed` : ""}

              {unloadFailedCount > 0 ? ` (${unloadFailedCount} unload failed)` : ""}

            </p>

          )}



          <ul className="max-h-64 space-y-1 overflow-y-auto">

            {jobs.map((job) => {

              const unloadText = getUnloadStatusText(job);

              return (

                <li

                  key={job.typeId}

                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"

                >

                  <JobStatusIcon status={job.status} />

                  <div className="flex min-w-0 flex-1 flex-col">

                    <span className="truncate">{job.label}</span>

                    {unloadText && (

                      <span

                        className={cn(

                          "truncate text-xs",

                          job.unloadPhase === "failed"

                            ? "text-destructive"

                            : "text-muted-foreground",

                        )}

                      >

                        {unloadText}

                      </span>

                    )}

                  </div>

                  {job.error && !unloadText && (

                    <span className="max-w-[140px] truncate text-xs text-destructive">

                      {job.error}

                    </span>

                  )}

                </li>

              );

            })}

          </ul>



          {!isRunning && (

            <div className="flex justify-end">

              <Button type="button" onClick={onClose}>

                Close

              </Button>

            </div>

          )}

        </div>

      </DialogContent>

    </Dialog>

  );

}



function JobStatusIcon({ status }: { status: GenerationJob["status"] }) {

  if (status === "running") {

    return <Loader2 className="size-4 shrink-0 animate-spin text-nesy" />;

  }

  if (status === "success") {

    return <Check className="size-4 shrink-0 text-emerald-500" />;

  }

  if (status === "failed") {

    return <X className="size-4 shrink-0 text-destructive" />;

  }

  if (status === "skipped") {

    return <SkipForward className="size-4 shrink-0 text-muted-foreground" />;

  }

  return (

    <span

      className={cn("size-4 shrink-0 rounded-full border border-border")}

      aria-hidden

    />

  );

}

