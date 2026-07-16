"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Check,
  Loader2,
  Search,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Button } from "@nesy/metronic/components/ui/button";
import { Badge } from "@nesy/metronic/components/ui/badge";
import { Input, InputWrapper } from "@nesy/metronic/components/ui/input";
import {
  Dialog,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@nesy/metronic/components/ui/dialog";
import { useNesyAuth } from "@/contexts/nesy-auth-context";
import {
  buildSearchParams,
  extractSearchRows,
  pickRowCenter,
  pickRowIdString,
  rowDisplayCity,
  rowDisplayName,
} from "@/lib/customer-search-helpers";
import { collectSelectableAddresses, mapNesyCustomerDetails } from "@/lib/nesy-customer-details";
import type { NesyAddress } from "@/lib/nesy-shipment-parties";
import { cn } from "@nesy/metronic/lib/utils";
import { getCustomerDetails, searchCustomers } from "@/services/customer";
import {
  getDefaultSettingsForContext,
  validateSettings,
  type NesyCountryCode,
  type ShipmentSettings,
} from "@/lib/happy-path/shipment-group-settings";
import { ShipmentSettingsPanel } from "./settings/shipment-settings-panel";

export interface CustomerAssignmentSelection {
  customerNo: string;
  company: string;
  location: string;
  addressLine?: string;
  settings?: ShipmentSettings;
}

interface SelectCustomerAddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fills the modal search field when opened (e.g. from Use one customer tab). */
  initialQuery?: string;
  contextId: string;
  includedTypeIds: Set<string>;
  initialSettings?: ShipmentSettings;
  groupTitle: string;
  groupIcon: LucideIcon;
  groupIconBg: string;
  groupIconColor: string;
  onApply?: (selection: CustomerAssignmentSelection) => void;
}

type DialogTab = "customer" | "settings";

const DIALOG_TABS: { id: DialogTab; label: string }[] = [
  { id: "customer", label: "Customer" },
  { id: "settings", label: "Settings" },
];

const MIN_SEARCH_LENGTH = 3;
const DEBOUNCE_MS = 300;

interface AddressOption {
  id: string;
  title: string;
  subtitle: string;
  recommended?: boolean;
}

function formatAddressLine(addr: NesyAddress): string {
  const text = addr.addressText?.trim();
  if (text) return text;
  const parts = [
    addr.street?.trim(),
    addr.zipCode?.trim(),
    addr.city?.trim(),
    addr.countryCode?.trim(),
  ].filter(Boolean);
  return parts.join(", ");
}

function normalizeAddressDisplay(line: string): string {
  return line
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapAddressOption(addr: NesyAddress, index: number): AddressOption {
  const title = addr.name?.trim() || addr.city?.trim() || `Address ${index + 1}`;
  return {
    id: addr.addressId != null ? String(addr.addressId) : `${title}-${index}`,
    title,
    subtitle: normalizeAddressDisplay(formatAddressLine(addr)),
    recommended: (addr.addressType ?? 0) === 0,
  };
}

function SelectionRadio({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
        selected
          ? "border-nesy bg-nesy-soft0"
          : "border-input bg-background",
      )}
      aria-hidden
    >
      {selected ? <span className="size-1.5 rounded-full bg-white" /> : null}
    </span>
  );
}

function SelectionCheckIcon() {
  return (
    <span
      className="flex size-5 shrink-0 items-center justify-center rounded-full bg-nesy-soft0 text-white"
      aria-hidden
    >
      <Check className="size-3 stroke-[2.5]" />
    </span>
  );
}

function SelectionListItem({
  selected,
  onClick,
  disabled,
  children,
  trailing,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors",
        selected ? "bg-nesy-soft/70" : "bg-background hover:bg-muted/30",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <SelectionRadio selected={selected} />
      <div className="min-w-0 flex-1">{children}</div>
      {trailing}
    </button>
  );
}

export function SelectCustomerAddressDialog({
  open,
  onOpenChange,
  initialQuery,
  contextId,
  includedTypeIds,
  initialSettings,
  groupTitle,
  groupIcon: GroupIcon,
  groupIconBg,
  groupIconColor,
  onApply,
}: SelectCustomerAddressDialogProps) {
  const { token, country, environment, status: authStatus } = useNesyAuth();
  const isConnected = authStatus === "connected" && !!token;
  const countryCode = (country ?? "HR") as NesyCountryCode;

  const [tab, setTab] = useState<DialogTab>("customer");
  const [settings, setSettings] = useState<ShipmentSettings>(() =>
    initialSettings ?? getDefaultSettingsForContext(contextId, includedTypeIds, countryCode),
  );
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<Record<string, unknown>>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedCustomerRow, setSelectedCustomerRow] = useState<
    Record<string, unknown> | null
  >(null);
  const [addresses, setAddresses] = useState<AddressOption[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressesError, setAddressesError] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loadingCustomerId, setLoadingCustomerId] = useState<string | null>(null);

  const selectedCustomerId = selectedCustomerRow
    ? pickRowIdString(selectedCustomerRow)
    : null;

  const showSelectionLists =
    isConnected && debouncedQuery.trim().length >= MIN_SEARCH_LENGTH;

  useEffect(() => {
    if (!open) return;
    const trimmed = initialQuery?.trim() ?? "";
    setTab("customer");
    setQuery(trimmed);
    setDebouncedQuery(trimmed);
    setSearchResults([]);
    setSearchLoading(false);
    setSearchError(null);
    setSelectedCustomerRow(null);
    setAddresses([]);
    setAddressesLoading(false);
    setAddressesError(null);
    setSelectedAddressId(null);
    setLoadingCustomerId(null);
    setSettings(
      initialSettings ?? getDefaultSettingsForContext(contextId, includedTypeIds, countryCode),
    );
  }, [open, initialQuery, contextId, initialSettings, includedTypeIds, countryCode]);

  const validation = useMemo(
    () => validateSettings(contextId, settings, countryCode, includedTypeIds),
    [contextId, settings, countryCode, includedTypeIds],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open || !isConnected || !token) return;

    if (debouncedQuery.length < MIN_SEARCH_LENGTH) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);
    setSearchError(null);

    searchCustomers({
      token,
      country,
      environment,
      sorting: "undefined desc",
      ...buildSearchParams(debouncedQuery),
    })
      .then((data) => {
        if (cancelled) return;
        const list = extractSearchRows(data);
        setSearchResults(list);
        if (list.length === 0) {
          setSearchError("No customers found.");
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setSearchResults([]);
        setSearchError(
          error instanceof Error ? error.message : "Customer search failed.",
        );
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, open, isConnected, token, country, environment]);

  const handleSelectCustomer = useCallback(
    async (row: Record<string, unknown>) => {
      if (!token) return;

      const idStr = pickRowIdString(row);
      if (!idStr) {
        setAddressesError("No valid customer number on this row.");
        return;
      }

      setSelectedCustomerRow(row);
      setSelectedAddressId(null);
      setAddresses([]);
      setAddressesError(null);
      setLoadingCustomerId(idStr);
      setAddressesLoading(true);

      try {
        const raw = await getCustomerDetails({
          token,
          country,
          environment,
          customerId: idStr,
          customerCenter: pickRowCenter(row),
        });
        const details = mapNesyCustomerDetails(raw);
        const options = collectSelectableAddresses(details).map(mapAddressOption);
        setAddresses(options);
        if (options.length === 0) {
          setAddressesError("No addresses found for this customer.");
        }
      } catch (error) {
        setAddresses([]);
        setAddressesError(
          error instanceof Error ? error.message : "Could not load addresses.",
        );
      } finally {
        setAddressesLoading(false);
        setLoadingCustomerId(null);
      }
    },
    [token, country, environment],
  );

  const filteredAddresses = useMemo(() => {
    if (addresses.length === 0) return [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return addresses;

    // Customer-number searches (e.g. "10330") must not hide loaded addresses.
    if (selectedCustomerId && normalized === selectedCustomerId.toLowerCase()) {
      return addresses;
    }

    const filtered = addresses.filter(
      (address) =>
        address.title.toLowerCase().includes(normalized) ||
        address.subtitle.toLowerCase().includes(normalized),
    );

    if (filtered.length === 0 && selectedCustomerRow) {
      return addresses;
    }

    return filtered;
  }, [addresses, query, selectedCustomerId, selectedCustomerRow]);

  const selectedAddress = selectedAddressId
    ? addresses.find((address) => address.id === selectedAddressId)
    : undefined;

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
  }

  function handleResetSettings() {
    setSettings(getDefaultSettingsForContext(contextId, includedTypeIds, countryCode));
  }

  function handleApply() {
    if (!selectedCustomerRow || !selectedAddress || !selectedCustomerId) return;
    if (!validation.ok) return;
    onApply?.({
      customerNo: selectedCustomerId,
      company: rowDisplayName(selectedCustomerRow),
      location: selectedAddress.title,
      addressLine: selectedAddress.subtitle,
      settings,
    });
    onOpenChange(false);
  }

  const canApply =
    !!selectedCustomerRow && !!selectedAddress && validation.ok;

  const emptyStateMessage = !isConnected
    ? "Connect to Nesy from the header before searching."
    : query.trim().length > 0 && query.trim().length < MIN_SEARCH_LENGTH
      ? `Enter at least ${MIN_SEARCH_LENGTH} characters to start searching.`
      : "Use the search field above to find a customer and address for this shipment group.";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="z-[100] bg-black/40 [backdrop-filter:blur(4px)]" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-[101] flex max-h-[90vh] w-[min(960px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
            <div className="min-w-0">
              <DialogTitle className="text-lg font-semibold text-foreground">
                Select customer &amp; address
              </DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                This change affects only this shipment group.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-nesy/30 bg-nesy-soft px-3 py-1 text-xs font-medium text-nesy">
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full",
                    groupIconBg,
                  )}
                >
                  <GroupIcon className={cn("size-3", groupIconColor)} />
                </span>
                {groupTitle}
              </span>
              <button
                type="button"
                aria-label="Close"
                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => handleOpenChange(false)}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Tabs + search */}
          <div className="space-y-4 px-6 pt-4">
            <div className="flex gap-6 border-b border-border">
              {DIALOG_TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    if (item.id === "settings") setQuery("");
                  }}
                  className={cn(
                    "-mb-px border-b-2 pb-2.5 text-sm font-medium transition-colors",
                    tab === item.id
                      ? "border-nesy text-nesy"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            {tab === "customer" ? (
              <InputWrapper>
                <Search />
                <Input
                  placeholder="Search customer or address"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  disabled={!isConnected}
                />
              </InputWrapper>
            ) : null}
          </div>

          {/* Lists */}
          {tab === "customer" ? (
            showSelectionLists ? (
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-6 py-4 lg:grid-cols-2">
                <div className="flex min-h-[320px] flex-col overflow-hidden rounded-lg border border-border">
                  <div className="border-b border-border px-4 py-2.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Select customer
                    </span>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <div className="border-t border-border">
                      {searchLoading ? (
                        <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" />
                          Searching…
                        </div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map((row, index) => {
                          const customerId = pickRowIdString(row);
                          const selected = customerId === selectedCustomerId;
                          const busy = loadingCustomerId === customerId;
                          return (
                            <SelectionListItem
                              key={`${customerId}-${index}`}
                              selected={selected}
                              disabled={busy}
                              onClick={() => void handleSelectCustomer(row)}
                              trailing={
                                <>
                                  {busy ? (
                                    <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                                  ) : null}
                                  {selected ? <SelectionCheckIcon /> : null}
                                </>
                              }
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-foreground">
                                  {customerId} · {rowDisplayName(row)}
                                </p>
                              </div>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {rowDisplayCity(row)}
                              </p>
                            </SelectionListItem>
                          );
                        })
                      ) : (
                        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                          {searchError ?? "No customers found."}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex min-h-[320px] flex-col overflow-hidden rounded-lg border border-border">
                  <div className="border-b border-border px-4 py-2.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Select address
                    </span>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <div className="border-t border-border">
                      {!selectedCustomerRow ? (
                        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                          Select a customer to load addresses.
                        </p>
                      ) : addressesLoading ? (
                        <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
                          <Loader2 className="size-4 animate-spin" />
                          Loading addresses…
                        </div>
                      ) : filteredAddresses.length > 0 ? (
                        filteredAddresses.map((address) => {
                          const selected = address.id === selectedAddressId;
                          return (
                            <SelectionListItem
                              key={address.id}
                              selected={selected}
                              onClick={() => setSelectedAddressId(address.id)}
                              trailing={selected ? <SelectionCheckIcon /> : null}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-foreground">
                                  {address.title}
                                </p>
                                {address.recommended ? (
                                  <Badge
                                    variant="success"
                                    appearance="light"
                                    size="sm"
                                  >
                                    Recommended
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                                {address.subtitle}
                              </p>
                            </SelectionListItem>
                          );
                        })
                      ) : (
                        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                          {addressesError ?? "No addresses found."}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[320px] flex-1 flex-col px-6 py-4">
                <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-border px-4 py-10 text-center">
                  <span className="flex size-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                    <User className="size-5" />
                  </span>
                  <p className="mt-3 text-sm font-medium text-foreground">
                    Search to select customer and address
                  </p>
                  <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                    {emptyStateMessage}
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="flex min-h-[320px] flex-1 flex-col overflow-y-auto px-6 py-4">
              <ShipmentSettingsPanel
                contextId={contextId}
                includedTypeIds={includedTypeIds}
                country={countryCode}
                settings={settings}
                errors={validation.errors}
                onChange={setSettings}
              />
              <button
                type="button"
                className="mt-4 self-start text-xs text-muted-foreground underline hover:text-foreground"
                onClick={handleResetSettings}
              >
                Reset to defaults
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border bg-muted/20 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="nesy"
                disabled={!canApply}
                onClick={handleApply}
              >
                Apply selection
              </Button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
