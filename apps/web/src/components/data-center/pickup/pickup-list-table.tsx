"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type {
  ColumnDef,
  PaginationState,
  RowSelectionState,
} from "@tanstack/react-table";
import { ExternalLink, Search, Trash2, Truck, X } from "lucide-react";
import { Button } from "@nesy/metronic/components/ui/button";
import { Badge } from "@nesy/metronic/components/ui/badge";
import {
  Card,
  CardFooter,
  CardHeader,
  CardTable,
  CardToolbar,
} from "@nesy/metronic/components/ui/card";
import { DataGrid } from "@nesy/metronic/components/ui/data-grid";
import { DataGridPagination } from "@nesy/metronic/components/ui/data-grid-pagination";
import {
  DataGridTable,
  DataGridTableRowSelect,
  DataGridTableRowSelectAll,
} from "@nesy/metronic/components/ui/data-grid-table";
import { Input, InputWrapper } from "@nesy/metronic/components/ui/input";
import { ScrollArea, ScrollBar } from "@nesy/metronic/components/ui/scroll-area";
import {
  fetchPickups,
  deletePickups,
  getPickupNesyUrl,
  type PickupRecord,
} from "@/services/pickup";
import { Skeleton } from "@nesy/metronic/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@nesy/metronic/components/ui/alert";
import { PickupViewDialog } from "./pickup-view-dialog";
import { AssignPickupDialog } from "./assign-pickup-dialog";
import { useNesyAuth } from "@/contexts/nesy-auth-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nesy/metronic/components/ui/select";
import {
  NESY_DASHBOARD_COUNTRY_ENVIRONMENTS,
  NESY_DASHBOARD_TOOLBAR_COUNTRIES,
  type NesyDashboardToolbarCountry,
  type NesyEnvironment,
} from "@/services/nesy-auth";

interface IData {
  id: string;
  shipmentId: string;
  createdDate: string;
  pickupType: string;
  parcelCount: number;
  assignStatus: string;
  taskId: string;
  record: PickupRecord;
}

const selectSkeleton = <Skeleton className="size-4" />;
const textSkeleton = <Skeleton className="h-4 w-full" />;
const mutedTextSkeleton = <Skeleton className="h-4 w-4/5" />;
const badgeSkeleton = <Skeleton className="h-6 w-20" />;
const actionSkeleton = <Skeleton className="h-8 w-16" />;

function mapPickupToRow(record: PickupRecord): IData {
  const d = record.data as Record<string, unknown>;
  const parcels = Array.isArray(d.parcels) ? d.parcels : [];

  const createdAt = record.createdAt
    ? new Date(record.createdAt).toLocaleString("tr-TR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "";

  return {
    id: record.id,
    shipmentId: record.shipmentId,
    createdDate: createdAt,
    pickupType:
      record.pickupType === "remote" ? "Remote Pickup" : "Pickup At Customer",
    parcelCount:
      parcels.length || (typeof d.parcelCount === "number" ? d.parcelCount : 1),
    assignStatus: record.assignStatus,
    taskId: record.taskId ?? "-",
    record,
  };
}

function AssignStatusBadge({ status }: { status: string }) {
  const variant =
    status === "Assigned"
      ? "success"
      : status === "Pending"
        ? "secondary"
        : "destructive";

  const label =
    status === "TaskNotFound"
      ? "Task Not Found"
      : status === "AssignFailed"
        ? "Assign Failed"
        : status === "PickupListFailed"
          ? "List Failed"
          : status === "NoSchedule"
            ? "No Schedule"
            : status;

  return (
    <Badge variant={variant} className="max-w-full truncate" title={label}>
      {label}
    </Badge>
  );
}

export function PickupListTable({ refreshKey }: { refreshKey?: number }) {
  const { country: authCountry, environment: authEnvironment } = useNesyAuth();
  const [filterCountry, setFilterCountry] =
    useState<NesyDashboardToolbarCountry>(authCountry);
  const [filterEnvironment, setFilterEnvironment] =
    useState<NesyEnvironment>(authEnvironment);
  const [data, setData] = useState<IData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errorTitle, setErrorTitle] = useState("Pickup list error");
  const [openingNesyId, setOpeningNesyId] = useState<string | null>(null);
  const [selectedPickup, setSelectedPickup] = useState<PickupRecord | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<PickupRecord | null>(null);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const filterEnvironments = useMemo(
    () => [...NESY_DASHBOARD_COUNTRY_ENVIRONMENTS[filterCountry]],
    [filterCountry]
  );

  useEffect(() => {
    setFilterCountry(authCountry);
    setFilterEnvironment(authEnvironment);
  }, [authCountry, authEnvironment]);

  function handleFilterCountryChange(value: string) {
    const nextCountry = value as NesyDashboardToolbarCountry;
    const nextEnvironments = NESY_DASHBOARD_COUNTRY_ENVIRONMENTS[
      nextCountry
    ] as readonly NesyEnvironment[];
    setFilterCountry(nextCountry);
    setFilterEnvironment((currentEnvironment) =>
      nextEnvironments.includes(currentEnvironment)
        ? currentEnvironment
        : nextEnvironments[0]!
    );
  }

  const loadPickups = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    setErrorTitle("Pickup list error");
    try {
      const records = await fetchPickups({
        country: filterCountry,
        environment: filterEnvironment,
      });
      setData(records.map(mapPickupToRow));
    } catch (e) {
      setData([]);
      setLoadError(e instanceof Error ? e.message : "Failed to load pickups.");
      setErrorTitle("Pickup list error");
    } finally {
      setLoading(false);
    }
  }, [filterCountry, filterEnvironment]);

  useEffect(() => {
    loadPickups();
  }, [loadPickups, refreshKey]);

  const selectedPickupIds = useMemo(() => {
    return Object.keys(rowSelection).filter((rowId) => rowSelection[rowId]);
  }, [rowSelection]);
  const selectedRowCount = selectedPickupIds.length;

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(
      (item) =>
        item.shipmentId.toLowerCase().includes(query) ||
        item.pickupType.toLowerCase().includes(query) ||
        item.assignStatus.toLowerCase().includes(query) ||
        item.taskId.toLowerCase().includes(query)
    );
  }, [searchQuery, data]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedPickupIds.length === 0) return;

    setDeleting(true);
    setLoadError(null);
    setErrorTitle("Could not delete pickups");
    try {
      const deleted = await deletePickups(selectedPickupIds);
      if (deleted === 0) {
        setLoadError(
          "No pickups were deleted. Refresh the list and try again.",
        );
        return;
      }
      setRowSelection({});
      await loadPickups();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }, [selectedPickupIds, loadPickups]);

  function openAssignDialog(record: PickupRecord) {
    setAssignTarget(record);
    setIsAssignOpen(true);
  }

  const handleOpenInNesy = useCallback(async (record: PickupRecord) => {
    setOpeningNesyId(record.id);
    const nesyWindow = window.open("about:blank", "_blank");
    try {
      const url = await getPickupNesyUrl(record.id);
      if (nesyWindow) {
        nesyWindow.opener = null;
        nesyWindow.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch {
      nesyWindow?.close();
    } finally {
      setOpeningNesyId(null);
    }
  }, []);

  const columns = useMemo<ColumnDef<IData>[]>(
    () => [
      {
        accessorKey: "id",
        header: () => <DataGridTableRowSelectAll />,
        cell: ({ row }) => <DataGridTableRowSelect row={row} />,
        enableSorting: false,
        enableHiding: false,
        enableResizing: false,
        size: 23,
        meta: {
          headerClassName: "!border-e-0",
          cellClassName: "!border-e-0",
          skeleton: selectSkeleton,
        },
      },
      {
        accessorKey: "shipmentId",
        header: () => <span>Tracking Number</span>,
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.shipmentId}
          </span>
        ),
        enableSorting: false,
        size: 150,
        meta: { skeleton: textSkeleton },
      },
      {
        accessorKey: "taskId",
        header: () => <span>Task Id</span>,
        cell: ({ row }) => (
          <span className="break-all font-mono text-xs font-medium text-foreground">
            {row.original.taskId}
          </span>
        ),
        enableSorting: false,
        size: 180,
        meta: { skeleton: textSkeleton },
      },
      {
        accessorKey: "parcelCount",
        header: () => <span>Parcel Count</span>,
        enableSorting: false,
        size: 120,
        meta: { skeleton: mutedTextSkeleton },
      },
      {
        accessorKey: "pickupType",
        header: () => <span>Type</span>,
        enableSorting: false,
        size: 160,
        meta: { skeleton: mutedTextSkeleton },
      },
      {
        accessorKey: "assignStatus",
        header: () => <span>Status</span>,
        cell: ({ row }) => (
          <AssignStatusBadge status={row.original.assignStatus} />
        ),
        enableSorting: false,
        size: 130,
        meta: { skeleton: badgeSkeleton },
      },
      {
        accessorKey: "createdDate",
        header: () => <span>Created Date</span>,
        enableSorting: false,
        size: 130,
        meta: { skeleton: mutedTextSkeleton },
      },
      {
        id: "actions",
        header: () => <span>Actions</span>,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedPickup(row.original.record);
                setIsViewOpen(true);
              }}
            >
              View
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleOpenInNesy(row.original.record)}
              disabled={openingNesyId === row.original.id}
            >
              <ExternalLink className="size-4 me-1" />
              {openingNesyId === row.original.id ? "Opening..." : "Nesy"}
            </Button>
            {row.original.assignStatus !== "Assigned" && (
              <Button
                size="sm"
                variant="nesy"
                onClick={() => openAssignDialog(row.original.record)}
              >
                <Truck className="size-4 me-1" />
                Assign
              </Button>
            )}
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
        size: 260,
        meta: { skeleton: actionSkeleton },
      },
    ],
    [handleOpenInNesy, openingNesyId]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { pagination, rowSelection },
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: true,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <>
      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>{errorTitle}</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <DataGrid
        table={table}
        recordCount={filteredData.length}
        isLoading={loading}
        loadingSkeletonRowCount={3}
        tableLayout={{
          columnsPinnable: true,
          columnsMovable: true,
          columnsVisibility: true,
          cellBorder: true,
        }}
      >
        <Card>
          <CardHeader className="py-3.5">
            <CardToolbar className="flex flex-wrap items-center gap-2">
              <InputWrapper className="w-full lg:w-[320px]">
                <Search />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <Button
                    variant="dim"
                    size="sm"
                    className="-me-3.5"
                    onClick={() => setSearchQuery("")}
                  >
                    <X />
                  </Button>
                )}
              </InputWrapper>

              <Select value={filterCountry} onValueChange={handleFilterCountryChange}>
                <SelectTrigger className="w-[92px]" size="sm">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent>
                  {NESY_DASHBOARD_TOOLBAR_COUNTRIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filterEnvironment}
                onValueChange={(value) => setFilterEnvironment(value as NesyEnvironment)}
              >
                <SelectTrigger className="w-[96px]" size="sm">
                  <SelectValue placeholder="Env" />
                </SelectTrigger>
                <SelectContent>
                  {filterEnvironments.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedRowCount > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleBulkDelete()}
                  disabled={deleting}
                >
                  <Trash2 className="size-4 me-1" />
                  {deleting ? "Deleting..." : `Delete (${selectedRowCount})`}
                </Button>
              )}
            </CardToolbar>
          </CardHeader>
          <CardTable>
            <ScrollArea>
              <DataGridTable />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </CardTable>
          <CardFooter>
            <DataGridPagination />
          </CardFooter>
        </Card>
      </DataGrid>

      <PickupViewDialog
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
        pickup={selectedPickup}
      />

      <AssignPickupDialog
        open={isAssignOpen}
        onOpenChange={setIsAssignOpen}
        pickup={assignTarget}
        filterCountry={filterCountry}
        filterEnvironment={filterEnvironment}
        onAssigned={loadPickups}
      />
    </>
  );
}
