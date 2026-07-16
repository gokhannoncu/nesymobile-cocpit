"use client";

import { useMemo, useState } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Loader2, Package, PackagePlus, PenLine, Plus, Search, Trash2, X } from "lucide-react";
import { Badge } from "@nesy/metronic/components/ui/badge";
import { Button } from "@nesy/metronic/components/ui/button";
import {
  Card,
  CardFooter,
  CardHeader,
  CardTable,
  CardToolbar,
} from "@nesy/metronic/components/ui/card";
import { DataGrid } from "@nesy/metronic/components/ui/data-grid";
import { DataGridPagination } from "@nesy/metronic/components/ui/data-grid-pagination";
import { DataGridTable } from "@nesy/metronic/components/ui/data-grid-table";
import { Input, InputWrapper } from "@nesy/metronic/components/ui/input";
import { ScrollArea, ScrollBar } from "@nesy/metronic/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nesy/metronic/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@nesy/metronic/components/ui/tooltip";
import {
  NESY_DASHBOARD_COUNTRY_ENVIRONMENTS,
  NESY_DASHBOARD_TOOLBAR_COUNTRIES,
  type NesyDashboardToolbarCountry,
  type NesyEnvironment,
} from "@/services/nesy-auth";
interface HappyPathSet {
  id: string;
  name: string;
  country: string;
  environment: string;
  shipmentCount: number;
  status: "Completed" | "Generating" | "Failed" | "Draft";
  createdDate: string;
}

const DEFAULT_FILTER_COUNTRY: NesyDashboardToolbarCountry = "HR";
const DEFAULT_FILTER_ENVIRONMENT = "STAGE";

const HARDCODED_SETS: HappyPathSet[] = [];

const HAPPY_PATH_ENVIRONMENTS = ["STAGE", "TEST", "PROD"] as const;

function getEnvironmentsForCountry(country: NesyDashboardToolbarCountry) {
  const nesyEnvironments = NESY_DASHBOARD_COUNTRY_ENVIRONMENTS[
    country
  ] as readonly NesyEnvironment[];

  return HAPPY_PATH_ENVIRONMENTS.filter((env) =>
    nesyEnvironments.includes(env.toLowerCase() as NesyEnvironment),
  );
}

function resolveEnvironmentForCountry(
  country: NesyDashboardToolbarCountry,
  current: string,
) {
  const environments = getEnvironmentsForCountry(country);

  if (environments.includes(current as (typeof HAPPY_PATH_ENVIRONMENTS)[number])) {
    return current;
  }

  if (
    environments.includes(
      DEFAULT_FILTER_ENVIRONMENT as (typeof HAPPY_PATH_ENVIRONMENTS)[number],
    )
  ) {
    return DEFAULT_FILTER_ENVIRONMENT;
  }

  return environments[0] ?? DEFAULT_FILTER_ENVIRONMENT;
}

function parseCreatedDate(dateStr: string): Date | null {
  const match = dateStr.match(
    /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/,
  );
  if (!match) return null;

  const [, day, month, year, hour, minute, second] = match;
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
}

function formatRelativeDate(dateStr: string): string {
  const date = parseCreatedDate(dateStr);
  if (!date) return dateStr;

  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return dateStr.split(" ")[0] ?? dateStr;
}

function formatShipmentLabel(count: number): string {
  return `${count} ${count === 1 ? "shipment" : "shipments"}`;
}

function EnvironmentBadge({ environment }: { environment: string }) {
  const variant =
    environment === "PROD"
      ? "warning"
      : environment === "STAGE"
        ? "info"
        : "secondary";

  return (
    <Badge variant={variant} appearance="light" size="sm">
      {environment}
    </Badge>
  );
}

function StatusBadge({ status }: { status: HappyPathSet["status"] }) {
  const variant =
    status === "Completed"
      ? "success"
      : status === "Generating"
        ? "info"
        : status === "Failed"
          ? "destructive"
          : "secondary";

  return (
    <Badge variant={variant} appearance="light" size="sm" className="gap-1">
      {status === "Generating" ? (
        <Loader2 className="size-3 animate-spin" aria-hidden />
      ) : null}
      {status}
    </Badge>
  );
}

function HappyPathEmptyView({ onCreateSet }: { onCreateSet?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-nesy-soft text-nesy">
        <PackagePlus className="size-7" />
      </span>
      <h4 className="mt-5 text-base font-semibold text-foreground">
        No happy path sets yet
      </h4>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        Create your first shipment bundle to run end-to-end success scenarios
        across delivery, pickup, and special flows.
      </p>
      {onCreateSet ? (
        <Button
          type="button"
          variant="nesy"
          className="mt-6"
          onClick={onCreateSet}
        >
          <Plus className="size-4" />
          Create Set
        </Button>
      ) : null}
    </div>
  );
}

export function HappyPathListTable({
  refreshKey,
  onCreateSet,
}: {
  refreshKey?: number;
  onCreateSet?: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCountry, setFilterCountry] = useState<NesyDashboardToolbarCountry>(
    DEFAULT_FILTER_COUNTRY,
  );
  const [filterEnvironment, setFilterEnvironment] = useState<string>(
    DEFAULT_FILTER_ENVIRONMENT,
  );

  // refreshKey is accepted to mirror the other operations tables; data starts empty.
  void refreshKey;

  const filterEnvironments = useMemo(
    () => getEnvironmentsForCountry(filterCountry),
    [filterCountry],
  );

  const filteredData = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return HARDCODED_SETS.filter((item) => {
      if (item.country !== filterCountry) {
        return false;
      }

      if (item.environment !== filterEnvironment) {
        return false;
      }

      if (!query) return true;

      return (
        item.name.toLowerCase().includes(query) ||
        item.country.toLowerCase().includes(query) ||
        item.environment.toLowerCase().includes(query) ||
        item.status.toLowerCase().includes(query)
      );
    });
  }, [searchQuery, filterCountry, filterEnvironment]);

  const showEmptyView =
    HARDCODED_SETS.length === 0 && !searchQuery.trim();

  function handleFilterCountryChange(value: string) {
    const nextCountry = value as NesyDashboardToolbarCountry;
    setFilterCountry(nextCountry);
    setFilterEnvironment((currentEnvironment) =>
      resolveEnvironmentForCountry(nextCountry, currentEnvironment),
    );
  }

  const columns = useMemo<ColumnDef<HappyPathSet>[]>(
    () => [
      {
        accessorKey: "name",
        header: () => <span>Name</span>,
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">
              {row.original.name}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {row.original.country} · {row.original.environment}
            </p>
          </div>
        ),
        enableSorting: false,
        size: 240,
      },
      {
        accessorKey: "country",
        header: () => <span>Country</span>,
        cell: ({ row }) => (
          <Badge variant="outline" appearance="outline" size="sm" className="font-mono">
            {row.original.country}
          </Badge>
        ),
        enableSorting: false,
        size: 90,
        meta: {
          headerClassName: "hidden lg:table-cell",
          cellClassName: "hidden lg:table-cell",
        },
      },
      {
        accessorKey: "environment",
        header: () => <span>Environment</span>,
        cell: ({ row }) => (
          <EnvironmentBadge environment={row.original.environment} />
        ),
        enableSorting: false,
        size: 120,
        meta: {
          headerClassName: "hidden lg:table-cell",
          cellClassName: "hidden lg:table-cell",
        },
      },
      {
        accessorKey: "shipmentCount",
        header: () => <span>Shipments</span>,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 tabular-nums text-foreground">
            <Package className="size-3.5 text-muted-foreground" aria-hidden />
            <span>{formatShipmentLabel(row.original.shipmentCount)}</span>
          </div>
        ),
        enableSorting: false,
        size: 130,
      },
      {
        accessorKey: "status",
        header: () => <span>Status</span>,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        enableSorting: false,
        size: 130,
      },
      {
        accessorKey: "createdDate",
        header: () => <span>Created</span>,
        cell: ({ row }) => (
          <Tooltip>
            <TooltipTrigger asChild>
              <time
                dateTime={row.original.createdDate}
                className="cursor-default text-muted-foreground underline decoration-dotted underline-offset-4"
              >
                {formatRelativeDate(row.original.createdDate)}
              </time>
            </TooltipTrigger>
            <TooltipContent side="top">{row.original.createdDate}</TooltipContent>
          </Tooltip>
        ),
        enableSorting: false,
        size: 120,
      },
      {
        id: "actions",
        header: () => <span>Actions</span>,
        cell: () => (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <PenLine className="size-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/5 hover:text-destructive"
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
        size: 180,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });

  return (
    <DataGrid
      table={table}
      recordCount={filteredData.length}
      emptyMessage={
        searchQuery.trim()
          ? "No sets match your filters. Try adjusting your search or filters."
          : "No happy path sets yet. Create your first set to get started."
      }
      tableLayout={{
        columnsPinnable: true,
        columnsMovable: true,
        columnsVisibility: true,
        cellBorder: true,
      }}
    >
      <Card>
        <CardHeader className="py-3.5">
          <CardToolbar className="flex flex-wrap items-center gap-3">
            <InputWrapper className="w-full sm:w-[320px]" variant="lg">
              <Search />
              <Input
                placeholder="Search name, country, environment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery ? (
                <Button
                  variant="dim"
                  size="sm"
                  className="-me-3.5"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  <X />
                </Button>
              ) : null}
            </InputWrapper>

            <Select value={filterCountry} onValueChange={handleFilterCountryChange}>
              <SelectTrigger className="h-10 w-[140px] shrink-0" size="lg">
                <SelectValue placeholder="Country" />
              </SelectTrigger>
              <SelectContent>
                {NESY_DASHBOARD_TOOLBAR_COUNTRIES.map((country) => (
                  <SelectItem key={country} value={country}>
                    {country}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterEnvironment} onValueChange={setFilterEnvironment}>
              <SelectTrigger className="h-10 w-[156px] shrink-0" size="lg">
                <SelectValue placeholder="Environment" />
              </SelectTrigger>
              <SelectContent>
                {filterEnvironments.map((env) => (
                  <SelectItem key={env} value={env}>
                    {env}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardToolbar>
        </CardHeader>
        <CardTable>
          {showEmptyView ? (
            <HappyPathEmptyView onCreateSet={onCreateSet} />
          ) : (
            <ScrollArea>
              <DataGridTable />
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          )}
        </CardTable>
        {!showEmptyView ? (
          <CardFooter>
            <DataGridPagination />
          </CardFooter>
        ) : null}
      </Card>
    </DataGrid>
  );
}
