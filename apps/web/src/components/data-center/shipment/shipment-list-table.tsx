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
import { ExternalLink, FileText, Search, Trash2, X } from "lucide-react";
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
  fetchShipments,
  refreshShipmentLastEvents,
  deleteShipments,
  getBulkShipmentDisplayLabel,
  getShipmentDisplayLabel,
  getShipmentNesyUrl,
  type ShipmentRecord,
} from "@/services/shipment";
import { Skeleton } from "@nesy/metronic/components/ui/skeleton";
import { ShipmentViewSheet } from "./shipment-view-sheet";
import { Alert, AlertDescription, AlertTitle } from "@nesy/metronic/components/ui/alert";
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
  customerId: string;
  type: string;
  consigneeNameSurname: string;
  parcelCount: number;
  unloadStatus: string;
  record: ShipmentRecord;
}

const selectSkeleton = <Skeleton className="size-4" />;
const textSkeleton = <Skeleton className="h-4 w-full" />;
const mutedTextSkeleton = <Skeleton className="h-4 w-4/5" />;
const badgeSkeleton = <Skeleton className="h-6 w-20" />;
const actionSkeleton = <Skeleton className="h-8 w-16" />;
const STATUS_ACTIONS_COLUMN_WIDTH = 240;

function mapShipmentToRow(record: ShipmentRecord): IData {
  const d = record.data as Record<string, unknown>;
  const consignee = d.consignee as Record<string, unknown> | undefined;
  const customer = d.customer as Record<string, unknown> | undefined;
  const parcels = d.parcels;
  const services = Array.isArray(d.services) ? (d.services as Record<string, unknown>[]) : [];

  const consigneeName =
    (d.consigneeName as string | undefined) ??
    (consignee?.name as string | undefined) ??
    "";

  const parcelCountCandidates = [
    Array.isArray(parcels) ? parcels.length : 0,
    typeof d.parcelCount === "number" ? d.parcelCount : 0,
    typeof d.parcelNumber === "string" ? Number.parseInt(d.parcelNumber, 10) || 0 : 0,
    typeof d.totalParcel === "string" ? Number.parseInt(d.totalParcel, 10) || 0 : 0,
  ];

  const parcelCount = Math.max(...parcelCountCandidates);

  const hasCodService = services.some(
    (service) =>
      service.serviceType === 20 ||
      service.legacySystemServiceId === "8" ||
      service.serviceName === "Cash on Delivery"
  );
  const hasRdocService = services.some(
    (service) =>
      service.serviceType === 27 ||
      service.legacySystemServiceId === "64" ||
      service.serviceName === "Document Collection"
  );

  return {
    id: record.id,
    shipmentId: (d.shipmentId as string) ?? record.id,
    customerId:
      (d.customerId as string | undefined) ??
      (customer?.customerId as string | undefined) ??
      "",
    type: hasCodService
      ? "COD"
      : hasRdocService
        ? "RDOC"
        : ((d.shipmentType as string | undefined) ?? "Standard"),
    consigneeNameSurname: consigneeName,
    parcelCount,
    unloadStatus: record.unloadStatus ?? "Pending",
    record,
  };
}

function LastStatusBadge({ status }: { status: string }) {
  const variant =
    status === "Completed"
      ? "success"
      : status === "Failed"
        ? "destructive"
        : status === "Pending"
          ? "secondary"
          : "outline";

  return (
    <Badge variant={variant} className="max-w-full truncate" title={status}>
      {status}
    </Badge>
  );
}

function base64ToPdfObjectUrl(base64: string): string {
  const byteCharacters = atob(base64);
  const byteArrays: BlobPart[] = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Uint8Array(slice.length);
    for (let i = 0; i < slice.length; i += 1) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(byteNumbers);
  }
  return URL.createObjectURL(new Blob(byteArrays, { type: "application/pdf" }));
}

export function ShipmentListTable({ refreshKey }: { refreshKey?: number }) {
  const {
    country: authCountry,
    environment: authEnvironment,
    status: authStatus,
    token,
  } = useNesyAuth();
  const [filterCountry, setFilterCountry] =
    useState<NesyDashboardToolbarCountry>(authCountry);
  const [filterEnvironment, setFilterEnvironment] =
    useState<NesyEnvironment>(authEnvironment);
  const [data, setData] = useState<IData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [openingNesyId, setOpeningNesyId] = useState<string | null>(null);
  const [displayingLabelId, setDisplayingLabelId] = useState<string | null>(null);
  const [bulkDisplayingLabels, setBulkDisplayingLabels] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<ShipmentRecord | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [loadError, setLoadError] = useState<string | null>(null);

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
    setFilterEnvironment((currentEnvironment) => {
      const fallback = nextEnvironments[0] ?? currentEnvironment
      return nextEnvironments.includes(currentEnvironment) ? currentEnvironment : fallback
    })
  }

  const loadShipments = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const records = await fetchShipments({
        country: filterCountry,
        environment: filterEnvironment,
      });
      setData(records.map(mapShipmentToRow));
    } catch (e) {
      setData([]);
      setLoadError(e instanceof Error ? e.message : "Could not load shipments.");
    } finally {
      setLoading(false);
    }
  }, [filterCountry, filterEnvironment]);

  useEffect(() => {
    loadShipments();
  }, [loadShipments]);

  useEffect(() => {
    if (!refreshKey) return;

    let cancelled = false;

    async function syncAndReload() {
      setLoading(true);
      setLoadError(null);
      try {
        if (!token || authStatus !== "connected") {
          throw new Error("Refresh requires an active Nesy connection.");
        }
        await refreshShipmentLastEvents({
          token,
          country: filterCountry,
          environment: filterEnvironment,
        });
        if (cancelled) return;
        const records = await fetchShipments({
          country: filterCountry,
          environment: filterEnvironment,
        });
        if (cancelled) return;
        setData(records.map(mapShipmentToRow));
      } catch (e) {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : "Could not refresh shipments.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void syncAndReload();

    return () => {
      cancelled = true;
    };
  }, [refreshKey, token, authStatus, filterCountry, filterEnvironment]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(
      (item) =>
        item.shipmentId.toLowerCase().includes(query) ||
        item.customerId.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query) ||
        item.consigneeNameSurname.toLowerCase().includes(query) ||
        String(item.parcelCount).includes(query)
    );
  }, [searchQuery, data]);

  const selectedShipmentIds = useMemo(
    () =>
      Object.keys(rowSelection)
        .map(Number)
        .map((idx) => filteredData[idx]?.id)
        .filter(Boolean) as string[],
    [rowSelection, filteredData]
  );
  const selectedRowCount = selectedShipmentIds.length;

  const handleBulkDelete = useCallback(async () => {
    if (selectedShipmentIds.length === 0) return;

    setDeleting(true);
    try {
      await deleteShipments(selectedShipmentIds);
      setRowSelection({});
      await loadShipments();
    } catch {
      // silently handle
    } finally {
      setDeleting(false);
    }
  }, [selectedShipmentIds, loadShipments]);

  const handleBulkDisplayLabel = useCallback(async () => {
    if (selectedShipmentIds.length === 0) return;
    if (authStatus !== "connected" || !token) {
      setLoadError("Connect to Nesy before displaying labels.");
      return;
    }

    setBulkDisplayingLabels(true);
    setLoadError(null);
    const labelWindow = window.open(
      "about:blank",
      "pdfLabel",
      "width=900,height=700,menubar=no,toolbar=no,location=no,scrollbars=yes,resizable=yes"
    );

    try {
      const { content } = await getBulkShipmentDisplayLabel({
        shipmentDbIds: selectedShipmentIds,
        token,
        country: filterCountry,
        environment: filterEnvironment,
      });
      const url = base64ToPdfObjectUrl(content);
      if (labelWindow) {
        labelWindow.opener = null;
        labelWindow.onload = () => labelWindow.print();
        labelWindow.location.href = url;
      } else {
        window.open(url, "pdfLabel", "noopener,noreferrer,width=900,height=700");
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) {
      labelWindow?.close();
      setLoadError(error instanceof Error ? error.message : "Could not display shipment labels.");
    } finally {
      setBulkDisplayingLabels(false);
    }
  }, [authStatus, token, filterCountry, filterEnvironment, selectedShipmentIds]);

  const handleOpenInNesy = useCallback(async (record: ShipmentRecord) => {
    setOpeningNesyId(record.id);
    const nesyWindow = window.open("about:blank", "_blank");
    try {
      const url = await getShipmentNesyUrl(record.id);
      if (nesyWindow) {
        nesyWindow.opener = null;
        nesyWindow.location.href = url;
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      nesyWindow?.close();
      setLoadError(error instanceof Error ? error.message : "Could not open shipment in Nesy.");
    } finally {
      setOpeningNesyId(null);
    }
  }, []);

  const handleDisplayLabel = useCallback(
    async (record: ShipmentRecord) => {
      if (authStatus !== "connected" || !token) {
        setLoadError("Connect to Nesy before displaying a label.");
        return;
      }

      setDisplayingLabelId(record.id);
      setLoadError(null);
      const labelWindow = window.open(
        "about:blank",
        "pdfLabel",
        "width=900,height=700,menubar=no,toolbar=no,location=no,scrollbars=yes,resizable=yes"
      );

      try {
        const { content } = await getShipmentDisplayLabel({
          shipmentDbId: record.id,
          token,
          country: record.country ?? filterCountry,
          environment: record.environment ?? filterEnvironment,
        });
        const url = base64ToPdfObjectUrl(content);
        if (labelWindow) {
          labelWindow.opener = null;
          labelWindow.onload = () => labelWindow.print();
          labelWindow.location.href = url;
        } else {
          window.open(url, "pdfLabel", "noopener,noreferrer,width=900,height=700");
        }
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } catch (error) {
        labelWindow?.close();
        setLoadError(error instanceof Error ? error.message : "Could not display shipment label.");
      } finally {
        setDisplayingLabelId(null);
      }
    },
    [authStatus, token, filterCountry, filterEnvironment]
  );

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
        enableSorting: false,
        size: 120,
        meta: {
          skeleton: textSkeleton,
        },
      },
      {
        accessorKey: "customerId",
        header: () => <span>Customer Id</span>,
        enableSorting: false,
        size: 100,
        meta: {
          skeleton: mutedTextSkeleton,
        },
      },
      {
        accessorKey: "consigneeNameSurname",
        header: () => <span>C. Name Surname</span>,
        enableSorting: false,
        size: 180,
        meta: {
          skeleton: textSkeleton,
        },
      },
      {
        accessorKey: "type",
        header: () => <span>Type</span>,
        enableSorting: false,
        size: 100,
        meta: {
          skeleton: mutedTextSkeleton,
        },
      },
      {
        accessorKey: "parcelCount",
        header: () => <span>Parcel Count</span>,
        enableSorting: false,
        size: 100,
        meta: {
          skeleton: mutedTextSkeleton,
        },
      },
      {
        accessorKey: "unloadStatus",
        header: () => <span>Last Status</span>,
        cell: ({ row }) => (
          <LastStatusBadge status={String(row.getValue("unloadStatus"))} />
        ),
        enableSorting: false,
        size: STATUS_ACTIONS_COLUMN_WIDTH,
        meta: {
          skeleton: badgeSkeleton,
        },
      },
      {
        id: "actions",
        header: () => <span>Actions</span>,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setSelectedShipment(row.original.record);
                setIsViewOpen(true);
              }}
            >
              View
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => void handleOpenInNesy(row.original.record)}
              disabled={openingNesyId === row.original.id}
            >
              <ExternalLink className="size-3.5 me-1" />
              {openingNesyId === row.original.id ? "Opening..." : "Nesy"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => void handleDisplayLabel(row.original.record)}
              disabled={authStatus !== "connected" || !token || displayingLabelId === row.original.id}
            >
              <FileText className="size-3.5 me-1" />
              {displayingLabelId === row.original.id ? "Loading..." : "Display Label"}
            </Button>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
        size: STATUS_ACTIONS_COLUMN_WIDTH,
        meta: {
          skeleton: actionSkeleton,
        },
      },
    ],
    [authStatus, displayingLabelId, handleDisplayLabel, handleOpenInNesy, openingNesyId, token]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { pagination, rowSelection },
    onPaginationChange: setPagination,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <DataGrid
      table={table}
      recordCount={filteredData.length}
      isLoading={loading}
      tableLayout={{
        columnsPinnable: true,
        columnsMovable: true,
        columnsVisibility: true,
        cellBorder: true,
        width: "fixed",
      }}
    >
      <Card>
        {loadError && (
          <div className="px-3.5 pt-3.5">
            <Alert variant="destructive">
              <AlertTitle>Could not load shipments</AlertTitle>
              <AlertDescription className="text-balance break-words whitespace-pre-wrap">
                {loadError}
              </AlertDescription>
            </Alert>
          </div>
        )}
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
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleBulkDisplayLabel()}
                  disabled={authStatus !== "connected" || !token || bulkDisplayingLabels}
                >
                  <FileText className="size-4 me-1" />
                  {bulkDisplayingLabels ? "Loading..." : `Display Label (${selectedRowCount})`}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={deleting}
                >
                  <Trash2 className="size-4 me-1" />
                  {deleting
                    ? "Deleting..."
                    : `Delete (${selectedRowCount})`}
                </Button>
              </>
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
      <ShipmentViewSheet
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
        shipment={selectedShipment}
        token={token}
        country={filterCountry}
        environment={filterEnvironment}
      />
    </DataGrid>
  );
}
