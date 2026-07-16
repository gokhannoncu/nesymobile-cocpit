// @ts-nocheck
"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Banknote,
  Boxes,
  Building2,
  Check,
  FileCheck,
  FileText,
  Home,
  Lock,
  Package,
  PackagePlus,
  PenLine,
  Radio,
  RefreshCw,
  Search,
  Sliders,
  Sparkles,
  Star,
  Store,
  Tag,
  Truck,
  User,
  X,
} from "lucide-react";
import { Button } from "@nesy/metronic/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nesy/metronic/components/ui/dialog";
import { Badge } from "@nesy/metronic/components/ui/badge";
import { Input, InputWrapper } from "@nesy/metronic/components/ui/input";
import {
  SelectCustomerAddressDialog,
  type CustomerAssignmentSelection,
} from "./select-customer-address-dialog";
import { GenerationProgressDialog } from "./generation-progress-dialog";
import {
  buildGenerationQueue,
  countExecutableJobs,
  type GenerationJob,
} from "@/lib/happy-path/happy-path-generation";
import {
  filterTypeIdsForCountry,
  isTypeAvailableForCountry,
  PAC_DDEF_TYPE_IDS,
  pacDdefTypesInSync,
  syncPacDdefTypeIds,
} from "@/lib/happy-path/happy-path-types";
import {
  clearCustomerDetailsCache,
  executeGenerationJob,
} from "@/lib/happy-path/execute-generation-job";
import { executeUnloadForRecord } from "@/lib/happy-path/execute-unload";
import {
  formatSettingsSummary,
  type ShipmentSettings,
} from "@/lib/happy-path/shipment-group-settings";
import { useNesyAuth } from "@/contexts/nesy-auth-context";
import { cn } from "@nesy/metronic/lib/utils";

/* ---------------------------------- Data ---------------------------------- */

const SHIPMENT_GROUPS = [
  {
    title: "Delivery",
    icon: Package,
    types: [
      {
        id: "standard-delivery",
        label: "Standard Delivery",
        icon: Package,
        color: "text-nesy",
      },
      {
        id: "cod-delivery",
        label: "COD Delivery",
        icon: Banknote,
        color: "text-emerald-500",
      },
      {
        id: "exw-delivery",
        label: "EXW Delivery",
        icon: Building2,
        color: "text-blue-500",
      },
      {
        id: "deps",
        label: "DEPS",
        icon: Store,
        color: "text-indigo-500",
      },
      {
        id: "mono-multicolli",
        label: "Multicolli Delivery",
        icon: Boxes,
        color: "text-sky-500",
      },
    ],
  },
  {
    title: "Pickup",
    icon: Truck,
    types: [
      {
        id: "remote-pickup",
        label: "Remote Pickup",
        icon: Radio,
        color: "text-violet-500",
      },
      {
        id: "pickup-at-customer",
        label: "Pickup At Customer (PAC)",
        icon: Home,
        color: "text-pink-500",
      },
    ],
  },
  {
    title: "Documents",
    icon: FileText,
    types: [
      {
        id: "rdoc",
        label: "RDOC (Return Document)",
        icon: FileText,
        color: "text-violet-500",
      },
    ],
  },
  {
    title: "Special",
    icon: Star,
    types: [
      {
        id: "delivery-pick",
        label: "Delivery & Pick",
        icon: RefreshCw,
        color: "text-teal-500",
      },
      { id: "red-label", label: "Red Label", icon: Tag, color: "text-red-500" },
      { id: "doco", label: "DOCO", icon: FileCheck, color: "text-amber-500" },
    ],
  },
] as const;

type ShipmentTypeItem = {
  id: string;
  label: string;
  icon: typeof Package;
  color: string;
};

const ALL_SHIPMENT_TYPES: ShipmentTypeItem[] = SHIPMENT_GROUPS.flatMap(
  (group) => group.types as unknown as ShipmentTypeItem[],
);
type ShipmentType = ShipmentTypeItem;

const ALL_SHIPMENT_TYPE_IDS = ALL_SHIPMENT_TYPES.map((type) => type.id);

const PAC_DDEF_UI_TYPES: ShipmentTypeItem[] = PAC_DDEF_TYPE_IDS.map((id, index) => ({
  id,
  label: `DDEF Shipment ${index + 1}`,
  icon: Package,
  color: "text-pink-500",
}));

const RECOMMENDED_GROUP_TYPE_IDS: Record<string, readonly string[]> = {
  delivery: ["standard-delivery", "exw-delivery", "mono-multicolli", "deps"],
  cod: ["cod-delivery"],
  pickup: ["remote-pickup", "pickup-at-customer"],
  return: ["rdoc", "delivery-pick", "red-label", "doco"],
};

function getIncludedShipmentTypes(includedTypeIds: Set<string>, country: string) {
  return ALL_SHIPMENT_TYPES.filter(
    (type) =>
      includedTypeIds.has(type.id) && isTypeAvailableForCountry(type.id, country),
  );
}

interface ShipmentTypeCustomer {
  badge: "Recommended" | "Required";
  iconBg: string;
}

const SHIPMENT_TYPE_CUSTOMERS: Record<string, ShipmentTypeCustomer> = {
  "standard-delivery": {
    badge: "Recommended",
    iconBg: "bg-nesy-soft",
  },
  "cod-delivery": {
    badge: "Required",
    iconBg: "bg-emerald-50",
  },
  "exw-delivery": {
    badge: "Required",
    iconBg: "bg-blue-50",
  },
  deps: {
    badge: "Recommended",
    iconBg: "bg-indigo-50",
  },
  "mono-multicolli": {
    badge: "Recommended",
    iconBg: "bg-sky-50",
  },
  "remote-pickup": {
    badge: "Recommended",
    iconBg: "bg-cyan-50",
  },
  "pickup-at-customer": {
    badge: "Recommended",
    iconBg: "bg-cyan-50",
  },
  rdoc: {
    badge: "Required",
    iconBg: "bg-violet-50",
  },
  "delivery-pick": {
    badge: "Required",
    iconBg: "bg-teal-50",
  },
  "red-label": {
    badge: "Required",
    iconBg: "bg-red-50",
  },
  doco: {
    badge: "Required",
    iconBg: "bg-amber-50",
  },
};

function createIncludedTypeSet(
  country: string,
  typeIds: readonly string[] = ALL_SHIPMENT_TYPE_IDS,
) {
  return new Set(filterTypeIdsForCountry(typeIds, country));
}

function getIncludedTypesForGroup(
  groupTypeIds: readonly string[],
  includedTypeIds: Set<string>,
) {
  return ALL_SHIPMENT_TYPES.filter(
    (type) => groupTypeIds.includes(type.id) && includedTypeIds.has(type.id),
  );
}

function formatIncludedLabels(types: ShipmentType[]) {
  return types.map((type) => type.label).join(", ");
}

interface RecommendedGroup {
  id: string;
  title: string;
  description: string;
  icon: typeof Package;
  iconBg: string;
  iconColor: string;
  tags: string[];
}

const RECOMMENDED_GROUPS: RecommendedGroup[] = [
  {
    id: "delivery",
    title: "Delivery Group",
    description: "Standard, EXW, Multicolli, DEPS",
    icon: Package,
    iconBg: "bg-nesy-soft",
    iconColor: "text-nesy",
    tags: ["Standard", "EXW", "Multi Parcel"],
  },
  {
    id: "cod",
    title: "COD Group",
    description: "COD Delivery, Cash Prepaid",
    icon: Banknote,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-500",
    tags: ["COD enabled"],
  },
  {
    id: "pickup",
    title: "Pickup Group",
    description: "Remote Pickup, PAC",
    icon: Truck,
    iconBg: "bg-cyan-50",
    iconColor: "text-cyan-500",
    tags: ["Remote", "PAC"],
  },
  {
    id: "return",
    title: "Return / Document Group",
    description: "RDOC, DOCO, Red Label, Delivery & Pick",
    icon: FileText,
    iconBg: "bg-violet-50",
    iconColor: "text-violet-500",
    tags: ["Return", "Document"],
  },
];

type AssignmentMode = "one" | "recommended" | "custom";

function isCustomerAssignmentComplete(
  assignment?: CustomerAssignmentSelection | null,
): boolean {
  if (!assignment) return false;
  return (
    assignment.customerNo.trim().length > 0 &&
    assignment.company.trim().length > 0 &&
    assignment.location.trim().length > 0
  );
}

interface MappingEditTarget {
  id: string;
  title: string;
  icon: typeof Package;
  iconBg: string;
  iconColor: string;
}

function ShipmentTypeCheckboxCard({
  type,
  checked,
  onCheckedChange,
  wrapContent = false,
}: {
  type: ShipmentType;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  wrapContent?: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 text-left transition-colors shadow-xs shadow-black/[0.03]",
        wrapContent ? "w-fit max-w-full" : "w-full",
        !checked && "hover:bg-muted/30",
      )}
    >
      <type.icon className={cn("size-3.5 shrink-0", type.color)} />
      <span
        className={cn(
          "text-xs font-medium leading-snug text-foreground",
          wrapContent ? "whitespace-nowrap" : "min-w-0 flex-1",
        )}
      >
        {type.label}
      </span>
      {checked ? (
        <span
          className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
          aria-hidden
        >
          <Check className="size-2 stroke-[2.5]" />
        </span>
      ) : (
        <span
          className="size-3.5 shrink-0 rounded-full border border-input bg-background"
          aria-hidden
        />
      )}
    </button>
  );
}

function ShipmentTypeLockedCard({
  type,
  wrapContent = false,
}: {
  type: ShipmentType;
  wrapContent?: boolean;
}) {
  return (
    <div
      aria-pressed="true"
      className={cn(
        "flex cursor-default items-center gap-1.5 rounded-md border border-pink-200/80 bg-pink-50/40 px-2 py-1.5 text-left shadow-xs shadow-black/[0.03]",
        wrapContent ? "w-fit max-w-full" : "w-full",
      )}
    >
      <type.icon className={cn("size-3.5 shrink-0", type.color)} />
      <span
        className={cn(
          "text-xs font-medium leading-snug text-foreground",
          wrapContent ? "whitespace-nowrap" : "min-w-0 flex-1",
        )}
      >
        {type.label}
      </span>
      <Lock className="size-3 shrink-0 text-pink-500/80" aria-hidden />
      <span
        className="flex size-3.5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
        aria-hidden
      >
        <Check className="size-2 stroke-[2.5]" />
      </span>
    </div>
  );
}

/* -------------------------------- Component ------------------------------- */

interface CreateSetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function CreateSetDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateSetDialogProps) {
  const [mode, setMode] = useState<AssignmentMode>("one");
  const { token, country, environment, status: authStatus } = useNesyAuth();
  const isConnected = authStatus === "connected" && !!token;

  const [includedTypeIds, setIncludedTypeIds] = useState<Set<string>>(() =>
    createIncludedTypeSet(country),
  );
  const [customerAssignments, setCustomerAssignments] = useState<
    Record<string, CustomerAssignmentSelection>
  >({});
  const [oneCustomerSearchQuery, setOneCustomerSearchQuery] = useState("");
  const [oneCustomerSelection, setOneCustomerSelection] =
    useState<CustomerAssignmentSelection | null>(null);
  const [oneCustomerSearchOpen, setOneCustomerSearchOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<MappingEditTarget | null>(null);
  const [settingsMap, setSettingsMap] = useState<Record<string, ShipmentSettings>>({});
  const [generationJobs, setGenerationJobs] = useState<GenerationJob[]>([]);
  const [generationOpen, setGenerationOpen] = useState(false);
  const [generationRunning, setGenerationRunning] = useState(false);
  const [generationIndex, setGenerationIndex] = useState(0);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!justOpened) return;

    setMode("one");
    setIncludedTypeIds(createIncludedTypeSet(country));
    setCustomerAssignments({});
    setSettingsMap({});
    setOneCustomerSearchQuery("");
    setOneCustomerSelection(null);
    setOneCustomerSearchOpen(false);
    setEditTarget(null);
    setGenerationJobs([]);
    setGenerationOpen(false);
    setGenerationRunning(false);
    setGenerationIndex(0);
  }, [open, country]);

  useEffect(() => {
    if (!open) return;
    setIncludedTypeIds((current) => {
      const filtered = new Set(
        [...current].filter((id) => isTypeAvailableForCountry(id, country)),
      );
      const synced = syncPacDdefTypeIds(filtered);
      if (
        synced.size === current.size &&
        [...synced].every((id) => current.has(id))
      ) {
        return current;
      }
      return synced;
    });
  }, [country, open]);

  const pacSelected = includedTypeIds.has("pickup-at-customer");

  useEffect(() => {
    if (!open) return;
    setIncludedTypeIds((current) => {
      if (pacDdefTypesInSync(current)) return current;
      return syncPacDdefTypeIds(current);
    });
  }, [open, pacSelected]);

  const visibleShipmentGroups = useMemo(
    () =>
      SHIPMENT_GROUPS.map((group) => ({
        ...group,
        types: group.types.filter((type) =>
          isTypeAvailableForCountry(type.id, country),
        ),
      })).filter((group) => group.types.length > 0),
    [country],
  );

  function toggleShipmentType(typeId: string, checked: boolean) {
    if ((PAC_DDEF_TYPE_IDS as readonly string[]).includes(typeId)) return;

    setIncludedTypeIds((current) => {
      const next = new Set(current);
      if (checked) next.add(typeId);
      else next.delete(typeId);
      return syncPacDdefTypeIds(next);
    });
  }

  const visibleRecommendedGroups = useMemo(
    () =>
      RECOMMENDED_GROUPS.filter((group) =>
        getIncludedTypesForGroup(
          RECOMMENDED_GROUP_TYPE_IDS[group.id] ?? [],
          includedTypeIds,
        ).length > 0,
      ),
    [includedTypeIds],
  );

  const visibleCustomShipmentTypes = useMemo(
    () => getIncludedShipmentTypes(includedTypeIds, country),
    [includedTypeIds, country],
  );

  const canGenerate = useMemo(() => {
    if (includedTypeIds.size === 0) return false;

    switch (mode) {
      case "one":
        return isCustomerAssignmentComplete(oneCustomerSelection);
      case "recommended":
        if (visibleRecommendedGroups.length === 0) return false;
        return visibleRecommendedGroups.every((group) =>
          isCustomerAssignmentComplete(customerAssignments[group.id]),
        );
      case "custom":
        if (visibleCustomShipmentTypes.length === 0) return false;
        return visibleCustomShipmentTypes.every((type) =>
          isCustomerAssignmentComplete(customerAssignments[type.id]),
        );
      default:
        return false;
    }
  }, [
    mode,
    includedTypeIds.size,
    oneCustomerSelection,
    visibleRecommendedGroups,
    visibleCustomShipmentTypes,
    customerAssignments,
  ]);

  const executableCount = useMemo(
    () => countExecutableJobs(includedTypeIds),
    [includedTypeIds],
  );

  async function handleGenerate() {
    if (!canGenerate || !token || !country || !environment) return;

    clearCustomerDetailsCache();

    const queue = buildGenerationQueue({
      includedTypeIds,
      mode,
      oneCustomerSelection,
      customerAssignments,
      settingsMap,
    });

    if (queue.length === 0) return;

    setGenerationJobs(queue);
    setGenerationOpen(true);
    setGenerationRunning(true);
    setGenerationIndex(0);

    const updatedJobs = [...queue];
    let execIdx = 0;

    for (let i = 0; i < updatedJobs.length; i++) {
      const job = updatedJobs[i];

      if (job.route === "skip") {
        updatedJobs[i] = { ...job, status: "skipped" };
        setGenerationJobs([...updatedJobs]);
        continue;
      }

      updatedJobs[i] = { ...job, status: "running" };
      setGenerationJobs([...updatedJobs]);
      setGenerationIndex(execIdx);
      execIdx++;

      try {
        const result = await executeGenerationJob(job, {
          token,
          country,
          environment,
        });

        let nextJob: GenerationJob = {
          ...job,
          resultId: result.recordId,
          unloadPhase: job.requiresUnload ? "pending" : "none",
        };

        if (job.requiresUnload) {
          if (!result.record) {
            updatedJobs[i] = {
              ...nextJob,
              status: "failed",
              unloadPhase: "failed",
              error: "No shipment record returned for unload",
            };
          } else {
            nextJob = { ...nextJob, unloadPhase: "running" };
            updatedJobs[i] = { ...nextJob, status: "running" };
            setGenerationJobs([...updatedJobs]);

            const unloadResult = await executeUnloadForRecord({
              record: result.record,
              ctx: { token, country, environment },
              onParcelProgress: (current, total) => {
                updatedJobs[i] = {
                  ...updatedJobs[i],
                  currentUnloadParcel: current,
                  parcelsTotal: total,
                };
                setGenerationJobs([...updatedJobs]);
              },
            });

            nextJob = {
              ...nextJob,
              unloadPhase: unloadResult.ok ? "success" : "failed",
              parcelsUnloaded: unloadResult.parcelsUnloaded,
              parcelsTotal: unloadResult.parcelsTotal,
              unloadError: unloadResult.error,
              currentUnloadParcel: undefined,
            };

            if (unloadResult.ok) {
              updatedJobs[i] = { ...nextJob, status: "success" };
            } else {
              updatedJobs[i] = {
                ...nextJob,
                status: "failed",
                error: unloadResult.error ?? "Unload failed",
              };
            }
          }
        } else {
          updatedJobs[i] = { ...nextJob, status: "success" };
        }
      } catch (error) {
        updatedJobs[i] = {
          ...job,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
      setGenerationJobs([...updatedJobs]);
    }

    setGenerationRunning(false);
    onCreated?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-6xl flex max-h-[90vh] w-[95vw] flex-col gap-0 overflow-hidden p-0">
        {/* Header */}
        <div className="flex shrink-0 items-start gap-3 border-b border-border px-6 py-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-nesy-soft text-nesy">
            <PackagePlus className="size-5" />
          </span>
          <div className="flex flex-col">
            <DialogTitle className="text-lg font-semibold text-foreground">
              Happy Path Shipment Set
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Generate a ready-made shipment bundle for end-to-end success
              scenarios.
            </DialogDescription>
          </div>
        </div>

        {/* Body — 2 columns */}
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,360px)_1fr] lg:overflow-hidden">
          {/* Left: Included Shipment Types */}
          <div className="min-h-0 border-b border-border px-5 py-4 lg:overflow-y-auto lg:border-b-0 lg:border-e">
            <div className="mb-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Included shipment types
                </h3>
                <Badge variant="success" appearance="light" size="sm">
                  {includedTypeIds.size} selected
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Choose the shipment types to include in this set.
              </p>
            </div>

            <div className="divide-y divide-border">
              {visibleShipmentGroups.map((group) => {
                const types = group.types;
                const hasLoneLastItem =
                  types.length > 1 && types.length % 2 === 1;
                const pairedTypes = hasLoneLastItem
                  ? types.slice(0, -1)
                  : types;
                const lastType = hasLoneLastItem
                  ? types[types.length - 1]
                  : null;

                return (
                  <section
                    key={group.title}
                    className="py-3 first:pt-0 last:pb-0"
                  >
                    <div className="mb-2 flex items-center gap-1.5">
                      <group.icon className="size-3.5 text-muted-foreground" />
                      <h4 className="text-xs font-semibold text-foreground">
                        {group.title}
                      </h4>
                    </div>
                    {types.length === 1 ? (
                      <div className="flex flex-wrap gap-1.5">
                        <ShipmentTypeCheckboxCard
                          type={types[0]}
                          checked={includedTypeIds.has(types[0].id)}
                          wrapContent
                          onCheckedChange={(checked) =>
                            toggleShipmentType(types[0].id, checked)
                          }
                        />
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-2 gap-1.5">
                          {pairedTypes.map((type) => (
                            <ShipmentTypeCheckboxCard
                              key={type.id}
                              type={type}
                              checked={includedTypeIds.has(type.id)}
                              onCheckedChange={(checked) =>
                                toggleShipmentType(type.id, checked)
                              }
                            />
                          ))}
                        </div>
                        {lastType ? (
                          <div className="flex flex-wrap">
                            <ShipmentTypeCheckboxCard
                              type={lastType}
                              checked={includedTypeIds.has(lastType.id)}
                              wrapContent
                              onCheckedChange={(checked) =>
                                toggleShipmentType(lastType.id, checked)
                              }
                            />
                          </div>
                        ) : null}
                      </div>
                    )}
                  </section>
                );
              })}

              {pacSelected ? (
                <section className="border-t border-border py-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <Home className="size-3.5 text-pink-500" />
                    <h4 className="text-xs font-semibold text-foreground">
                      PAC — DDEF shipments
                    </h4>
                  </div>
                  <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
                    Three legacy DDEF barcodes (same customer as PAC) are added
                    automatically and cannot be removed.
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {PAC_DDEF_UI_TYPES.map((type) => (
                      <ShipmentTypeLockedCard key={type.id} type={type} />
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>

          {/* Right: Customer Assignment */}
          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="shrink-0 px-6 pt-5">
              <h3 className="text-sm font-semibold tracking-tight text-foreground">
                Customer assignment
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Assign customers automatically by shipment scenario. You can
                review and adjust before generating.
              </p>

              {/* Tab strip */}
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg border border-border bg-muted/40 p-1">
                <TabButton
                  active={mode === "one"}
                  icon={User}
                  label="Use one customer"
                  onClick={() => setMode("one")}
                />
                <TabButton
                  active={mode === "recommended"}
                  icon={Sparkles}
                  label="Recommended mapping"
                  onClick={() => setMode("recommended")}
                />
                <TabButton
                  active={mode === "custom"}
                  icon={Sliders}
                  label="Custom mapping"
                  onClick={() => setMode("custom")}
                />
              </div>
            </div>

            {/* Tab content — scrollable */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-4">
              {mode === "one" && (
                <UseOneCustomerPanel
                  searchQuery={oneCustomerSearchQuery}
                  onSearchQueryChange={setOneCustomerSearchQuery}
                  selection={oneCustomerSelection}
                  onSearchClick={() => setOneCustomerSearchOpen(true)}
                  onRemoveClick={() => setOneCustomerSelection(null)}
                />
              )}
              {mode === "recommended" && (
                <RecommendedPanel
                  includedTypeIds={includedTypeIds}
                  visibleGroups={visibleRecommendedGroups}
                  customerAssignments={customerAssignments}
                  settingsMap={settingsMap}
                  onEditGroup={(group) =>
                    setEditTarget({
                      id: group.id,
                      title: group.title,
                      icon: group.icon,
                      iconBg: group.iconBg,
                      iconColor: group.iconColor,
                    })
                  }
                />
              )}
              {mode === "custom" && (
                <CustomMappingPanel
                  visibleShipmentTypes={visibleCustomShipmentTypes}
                  customerAssignments={customerAssignments}
                  settingsMap={settingsMap}
                  onEditType={(type) => {
                    const customer = SHIPMENT_TYPE_CUSTOMERS[type.id];
                    setEditTarget({
                      id: type.id,
                      title: type.label,
                      icon: type.icon,
                      iconBg: customer.iconBg,
                      iconColor: type.color,
                    });
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border bg-muted/30 px-6 py-4">
          <Button
            type="button"
            variant="nesy"
            disabled={!canGenerate || !isConnected || executableCount === 0}
            onClick={() => void handleGenerate()}
          >
            <PackagePlus className="size-4" />
            Generate Happy Path Set
            {executableCount > 0 ? ` (${executableCount})` : ""}
          </Button>
        </div>
      </DialogContent>

      <SelectCustomerAddressDialog
        open={editTarget !== null || oneCustomerSearchOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setEditTarget(null);
            setOneCustomerSearchOpen(false);
          }
        }}
        initialQuery={oneCustomerSearchOpen ? oneCustomerSearchQuery : undefined}
        contextId={oneCustomerSearchOpen ? "all" : (editTarget?.id ?? "")}
        includedTypeIds={includedTypeIds}
        initialSettings={
          oneCustomerSearchOpen
            ? settingsMap.all
            : editTarget
              ? settingsMap[editTarget.id]
              : undefined
        }
        groupTitle={
          editTarget?.title ??
          (oneCustomerSearchOpen ? "All shipment types" : "")
        }
        groupIcon={editTarget?.icon ?? User}
        groupIconBg={editTarget?.iconBg ?? "bg-nesy-soft"}
        groupIconColor={editTarget?.iconColor ?? "text-nesy"}
        onApply={(selection) => {
          const contextKey = oneCustomerSearchOpen ? "all" : editTarget?.id;
          if (selection.settings && contextKey) {
            setSettingsMap((current) => ({
              ...current,
              [contextKey]: selection.settings!,
            }));
          }
          if (oneCustomerSearchOpen) {
            setOneCustomerSelection(selection);
            setOneCustomerSearchOpen(false);
            return;
          }
          if (!editTarget) return;
          setCustomerAssignments((current) => ({
            ...current,
            [editTarget.id]: selection,
          }));
        }}
      />

      <GenerationProgressDialog
        open={generationOpen}
        jobs={generationJobs}
        currentIndex={generationIndex}
        isRunning={generationRunning}
        onClose={() => {
          setGenerationOpen(false);
          if (!generationRunning) {
            onOpenChange(false);
          }
        }}
      />
    </Dialog>
  );
}

/* ------------------------------ Tab button ------------------------------ */

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof User;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-10 items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-[13px] font-medium leading-snug transition-colors",
        active
          ? "bg-nesy-soft text-nesy border border-nesy/30 shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

/* ------------------------- Tab 1: Use one customer ----------------------- */

function formatDisplayAddress(line?: string) {
  if (!line?.trim()) return "";
  return line.replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ").trim();
}

function UseOneCustomerPanel({
  searchQuery,
  onSearchQueryChange,
  selection,
  onSearchClick,
  onRemoveClick,
}: {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  selection: CustomerAssignmentSelection | null;
  onSearchClick: () => void;
  onRemoveClick: () => void;
}) {
  const canSearch = searchQuery.trim().length > 0;

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Select Customer
        </label>
        <div className="flex gap-2">
          <InputWrapper className="flex-1">
            <Search />
            <Input
              placeholder="Search by customer number, company or location"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && canSearch) {
                  event.preventDefault();
                  onSearchClick();
                }
              }}
            />
          </InputWrapper>
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            disabled={!canSearch}
            onClick={onSearchClick}
          >
            Search
          </Button>
        </div>
      </div>

      {selection ? (
        <div className="rounded-lg border border-nesy/30 bg-nesy-soft/40 p-3.5">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(220px,0.95fr)_auto] items-stretch gap-3">
            <div className="flex min-w-0 flex-col justify-center gap-3 pe-1">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-nesy-ink">
                    Selected customer
                  </span>
                  <Badge variant="success" appearance="light" size="sm">
                    Ready
                  </Badge>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Assigned to all included shipment types.
                </p>
              </div>
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Customer
                </span>
                <p className="mt-0.5 text-xs font-semibold leading-snug text-foreground">
                  {formatMappingCustomerValue(
                    selection.customerNo,
                    selection.company,
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-stretch gap-3">
              <div className="w-px self-stretch bg-border" aria-hidden />
              <div className="flex min-w-0 flex-1 flex-col justify-center py-0.5 pe-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Location
                </span>
                <p className="mt-0.5 text-xs font-semibold leading-snug text-foreground">
                  {formatDisplayAddress(selection.addressLine) ||
                    formatMappingLocationValue(selection.location)}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-center px-1">
              <button
                type="button"
                aria-label="Remove selected customer"
                className="flex size-8 items-center justify-center rounded-full border border-red-200/70 bg-red-500/10 text-red-600 transition-colors hover:bg-red-500/20 hover:text-red-700"
                onClick={onRemoveClick}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
            <User className="size-5" />
          </span>
          <p className="mt-3 text-sm font-medium text-foreground">
            No customer selected
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Search and select a customer to assign to all shipment types.
          </p>
        </div>
      )}
    </div>
  );
}

function formatMappingCustomerValue(customerNo?: string, company?: string) {
  if (!customerNo && !company) return "-";
  if (customerNo && company) return `${customerNo} · ${company}`;
  return customerNo ?? company ?? "-";
}

function formatMappingLocationValue(location?: string) {
  return location?.trim() ? location : "-";
}

function CustomerMappingCard({
  icon: Icon,
  iconBg,
  iconColor,
  title,
  titleAddon,
  description,
  tags,
  customerNo,
  company,
  location,
  settingsSummary,
  editLabel,
  onEdit,
}: {
  icon: typeof Package;
  iconBg: string;
  iconColor: string;
  title: string;
  titleAddon?: ReactNode;
  description: string;
  tags?: readonly string[];
  customerNo?: string;
  company?: string;
  location?: string;
  settingsSummary?: string;
  editLabel: string;
  onEdit?: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3.5">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(220px,0.95fr)_auto] items-stretch gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-md",
              iconBg,
            )}
          >
            <Icon className={cn("size-4", iconColor)} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">{title}</h4>
              {titleAddon}
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
            {tags && tags.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="success"
                    appearance="light"
                    size="sm"
                    className="px-1.5 py-0 text-[11px] leading-snug"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-stretch gap-3">
          <div className="w-px self-stretch bg-border" aria-hidden />
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 py-0.5 pe-1">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Customer
              </span>
              <p className="mt-0.5 text-xs font-semibold leading-snug text-foreground">
                {formatMappingCustomerValue(customerNo, company)}
              </p>
            </div>
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Location
              </span>
              <p className="mt-0.5 text-xs font-semibold leading-snug text-foreground">
                {formatMappingLocationValue(location)}
              </p>
            </div>
            {settingsSummary ? (
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Settings
                </span>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {settingsSummary}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center">
          <button
            type="button"
            aria-label={editLabel}
            className="flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            onClick={onEdit}
          >
            <PenLine className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------- Tab 2: Recommended mapping ------------------------- */

function RecommendedPanel({
  includedTypeIds,
  visibleGroups,
  customerAssignments,
  settingsMap,
  onEditGroup,
}: {
  includedTypeIds: Set<string>;
  visibleGroups: RecommendedGroup[];
  customerAssignments: Record<string, CustomerAssignmentSelection>;
  settingsMap: Record<string, ShipmentSettings>;
  onEditGroup: (group: RecommendedGroup) => void;
}) {
  return (
    <div className="space-y-3">
      {visibleGroups.length > 0 ? (
          visibleGroups.map((group) => {
            const includedTypes = getIncludedTypesForGroup(
              RECOMMENDED_GROUP_TYPE_IDS[group.id] ?? [],
              includedTypeIds,
            );
            const includedDescription = formatIncludedLabels(includedTypes);

            const assignment = customerAssignments[group.id];

            return (
              <CustomerMappingCard
                key={group.id}
                icon={group.icon}
                iconBg={group.iconBg}
                iconColor={group.iconColor}
                title={group.title}
                description={includedDescription}
                tags={group.tags}
                customerNo={assignment?.customerNo}
                company={assignment?.company}
                location={assignment?.location}
                settingsSummary={formatSettingsSummary(
                  group.id,
                  settingsMap[group.id] ?? assignment?.settings,
                )}
                editLabel={`Change customer for ${group.title}`}
                onEdit={() => onEditGroup(group)}
              />
            );
          })
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No recommended groups match the selected shipment types.
          </p>
        )}
    </div>
  );
}

/* -------------------- Tab 3: Custom mapping ----------------------- */

function CustomMappingPanel({
  visibleShipmentTypes,
  customerAssignments,
  settingsMap,
  onEditType,
}: {
  visibleShipmentTypes: ShipmentType[];
  customerAssignments: Record<string, CustomerAssignmentSelection>;
  settingsMap: Record<string, ShipmentSettings>;
  onEditType: (type: ShipmentType) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <span className="mb-2 block text-sm font-semibold text-foreground">
          Shipment group mapping
        </span>
        <div className="space-y-3">
          {visibleShipmentTypes.length > 0 ? (
            visibleShipmentTypes.map((type) => {
              const customer = SHIPMENT_TYPE_CUSTOMERS[type.id];
              const assignment = customerAssignments[type.id];

              return (
                <CustomerMappingCard
                  key={type.id}
                  icon={type.icon}
                  iconBg={customer.iconBg}
                  iconColor={type.color}
                  title={type.label}
                  titleAddon={
                    <Badge variant="success" appearance="light" size="sm">
                      {customer.badge}
                    </Badge>
                  }
                  description={type.label}
                  customerNo={assignment?.customerNo}
                  company={assignment?.company}
                  location={assignment?.location}
                  settingsSummary={formatSettingsSummary(
                    type.id,
                    settingsMap[type.id] ?? assignment?.settings,
                  )}
                  editLabel={`Change customer for ${type.label}`}
                  onEdit={() => onEditType(type)}
                />
              );
            })
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No shipment types selected for custom mapping.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
