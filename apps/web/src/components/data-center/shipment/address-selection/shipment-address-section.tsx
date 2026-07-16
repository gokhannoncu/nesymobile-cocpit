"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { Input } from "@nesy/metronic/components/ui/input";
import { Label } from "@nesy/metronic/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nesy/metronic/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@nesy/metronic/components/ui/tabs";
import { Checkbox } from "@nesy/metronic/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@nesy/metronic/components/ui/radio-group";
import { cn } from "@nesy/metronic/lib/utils";
import type { NormalizedCustomerDetails } from "@/lib/nesy-customer-details";
import {
  ADDRESS_TYPE_OPTIONS,
  type AddressMode,
  type NesyAddress,
  type ShipmentPartySelection,
} from "@/lib/nesy-shipment-parties";
import { fetchOohByCity, fetchOohByZip } from "@/services/shipment-address";

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function cityZipLabel(addr: NesyAddress): string {
  const city = str(addr.city);
  const zip = str(addr.zipCode);
  if (city && zip) return `${city} (${zip})`;
  return city || zip;
}

function formatAddressLine(addr: NesyAddress): string {
  const text = str(addr.addressText);
  if (text) return text;
  const parts = [
    str(addr.street),
    str(addr.zipCode),
    str(addr.city),
    str(addr.countryCode),
  ].filter(Boolean);
  return parts.join(", ");
}

function mapOohRow(row: Record<string, unknown>) {
  const address = (row.address ?? row.Address ?? {}) as Record<string, unknown>;
  return {
    oohId: row.oohid ?? row.oohId ?? row.OohId ?? row.id,
    oohType: row.oohType ?? row.OohType ?? row.type,
    name: str(row.name ?? row.Name),
    address: {
      name: str(row.name ?? row.Name),
      street: str(address.street ?? address.Street),
      city: str(address.city ?? address.City),
      zipCode: str(address.zipCode ?? address.ZipCode),
      countryCode: str(address.countryPrefix ?? address.countryCode ?? "HR"),
      addressText: str(address.addressText ?? address.AddressText),
      houseNumber: address.houseNumber != null ? str(address.houseNumber) : null,
      latitude: typeof address.lat === "number" ? address.lat : Number(address.lat) || undefined,
      longitude: typeof address.long === "number" ? address.long : Number(address.long) || undefined,
    } satisfies NesyAddress,
  };
}

export function ShipmentAddressSection({
  title,
  details,
  value,
  onChange,
  disabled,
  showParcelShop,
  token,
  country,
  environment,
}: {
  title: "Shipper" | "Consignee";
  details: NormalizedCustomerDetails;
  value: ShipmentPartySelection;
  onChange: (next: ShipmentPartySelection) => void;
  disabled?: boolean;
  showParcelShop: boolean;
  token: string;
  country: string;
  environment: string;
}) {
  const [oohQuery, setOohQuery] = useState("");
  const [oohMode, setOohMode] = useState<"city" | "zip">("city");
  const [oohLoading, setOohLoading] = useState(false);
  const [oohResults, setOohResults] = useState<Array<ReturnType<typeof mapOohRow>>>([]);
  const [oohError, setOohError] = useState<string | null>(null);

  const filteredByType = useMemo(() => {
    const type = value.address.addressType ?? 0;
    return details.addresses.filter((a) => (a.addressType ?? 0) === type);
  }, [details.addresses, value.address.addressType]);

  const setMode = (mode: AddressMode) => {
    if (mode === value.mode) return;
    if (mode === "existing") {
      const addr = filteredByType[0] ?? details.payerAddress;
      onChange({
        mode,
        address: { ...addr },
        contact: { ...value.contact, name: details.name },
      });
      return;
    }
    if (mode === "addressbook") {
      const first = details.addressBook[0];
      if (first) {
        selectBookEntry(first, 0);
      } else {
        onChange({ ...value, mode });
      }
      return;
    }
    if (mode === "newaddress") {
      onChange({
        mode,
        address: {
          addressType: 0,
          name: details.name,
          street: "",
          city: "",
          zipCode: "",
          countryCode: "HR",
        },
        contact: {
          ...value.contact,
          name: details.name,
          phone: details.phone,
          gsm: details.gsm,
          email: details.email,
        },
        isInternational: false,
        saveAddress: false,
      });
      return;
    }
    onChange({ ...value, mode, parcelShop: undefined });
  };

  const selectExisting = (addr: NesyAddress) => {
    onChange({
      mode: "existing",
      address: { ...addr },
      contact: { ...value.contact, name: details.name },
    });
  };

  const selectBookEntry = (addr: NesyAddress, index: number) => {
    onChange({
      mode: "addressbook",
      address: { ...addr },
      contact: {
        ...value.contact,
        name: str(addr.name) || details.name,
        phone: str(addr.phone) || details.phone,
        gsm: details.gsm,
        email: details.email,
      },
      addressBookIndex: index,
      saveAddressBook: value.saveAddressBook ?? false,
    });
  };

  const runOohSearch = async () => {
    const q = oohQuery.trim();
    if (q.length < 3) return;
    setOohLoading(true);
    setOohError(null);
    try {
      const rows =
        oohMode === "city"
          ? await fetchOohByCity({ token, country, environment, city: q })
          : await fetchOohByZip({ token, country, environment, zipCode: q });
      setOohResults(
        rows
          .filter((r) => r && typeof r === "object")
          .map((r) => mapOohRow(r as Record<string, unknown>)),
      );
      if (rows.length === 0) setOohError("No parcel shops found.");
    } catch (e) {
      setOohResults([]);
      setOohError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setOohLoading(false);
    }
  };

  const selectOoh = (row: ReturnType<typeof mapOohRow>) => {
    onChange({
      mode: "parcelshop",
      address: row.address,
      contact: {
        ...value.contact,
        name: row.name,
        phone: value.contact.phone || details.phone,
        email: value.contact.email ?? details.email,
      },
      parcelShop: {
        oohId: row.oohId as string | number,
        oohType: row.oohType != null ? String(row.oohType) : undefined,
        name: row.name,
        address: row.address,
      },
    });
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <Tabs
        value={value.mode}
        onValueChange={(v) => setMode(v as AddressMode)}
        className="w-full"
      >
        <TabsList variant="line" size="sm" className="w-full justify-start">
          <TabsTrigger value="existing" disabled={disabled} className="text-xs">
            From Existing Customer
          </TabsTrigger>
          <TabsTrigger value="addressbook" disabled={disabled} className="text-xs">
            Address Book
          </TabsTrigger>
          <TabsTrigger value="newaddress" disabled={disabled} className="text-xs">
            New Address
          </TabsTrigger>
          {showParcelShop && (
            <TabsTrigger value="parcelshop" disabled={disabled} className="text-xs">
              Parcel shop
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="existing" className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Address Type</Label>
              <Select
                value={String(value.address.addressType ?? 0)}
                onValueChange={(v) => {
                  const type = Number(v);
                  const list = details.addresses.filter((a) => (a.addressType ?? 0) === type);
                  const addr =
                    list[0] ??
                    ({
                      addressType: type,
                      street: "",
                      city: "",
                      zipCode: "",
                      countryCode: value.address.countryCode ?? "HR",
                    } satisfies NesyAddress);
                  selectExisting(addr);
                }}
                disabled={disabled}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Standard" />
                </SelectTrigger>
                <SelectContent>
                  {ADDRESS_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Select Address Title</Label>
              <Select
                value={str(value.address.addressId ?? value.address.name)}
                onValueChange={(v) => {
                  const addr = filteredByType.find(
                    (a) => String(a.addressId ?? a.name) === v,
                  );
                  if (addr) selectExisting(addr);
                }}
                disabled={disabled || filteredByType.length === 0}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select address" />
                </SelectTrigger>
                <SelectContent>
                  {filteredByType.map((addr) => (
                    <SelectItem
                      key={String(addr.addressId ?? addr.name)}
                      value={String(addr.addressId ?? addr.name)}
                    >
                      {str(addr.name) || "Address"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <ReadonlyField label="City / Town" value={cityZipLabel(value.address)} />
          <ReadonlyField label="Address" value={formatAddressLine(value.address)} />
        </TabsContent>

        <TabsContent value="addressbook" className="mt-3 space-y-3">
          <AddressBookNameDropdown
            label={`${title} Name-Surname`}
            entries={details.addressBook}
            selectedIndex={
              value.mode === "addressbook" ? value.addressBookIndex : undefined
            }
            onSelect={selectBookEntry}
            disabled={disabled}
          />
          <div className="grid grid-cols-2 gap-3">
            <ReadonlyField label="City / Town" value={cityZipLabel(value.address)} />
            <ReadonlyField label="Street" value={str(value.address.street)} />
            <Field
              label="Phone"
              value={str(value.contact.phone)}
              onChange={(phone) =>
                onChange({ ...value, contact: { ...value.contact, phone } })
              }
              disabled={disabled}
            />
            <Field
              label="E-Mail"
              value={str(value.contact.email ?? "")}
              onChange={(email) =>
                onChange({ ...value, contact: { ...value.contact, email } })
              }
              disabled={disabled}
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={value.saveAddressBook === true}
              onCheckedChange={(checked) =>
                onChange({ ...value, saveAddressBook: checked === true })
              }
              disabled={disabled}
            />
            Save Address
          </label>
        </TabsContent>

        <TabsContent value="newaddress" className="mt-3 space-y-3">
          <RadioGroup
            value={value.isInternational ? "international" : "domestic"}
            onValueChange={(next) =>
              onChange({
                ...value,
                isInternational: next === "international",
                address: {
                  ...value.address,
                  countryCode:
                    next === "international"
                      ? value.address.countryCode && value.address.countryCode !== "HR"
                        ? value.address.countryCode
                        : ""
                      : "HR",
                },
              })
            }
            disabled={disabled}
            className="flex items-center gap-6"
          >
            <label className="flex cursor-pointer items-center gap-2">
              <RadioGroupItem
                value="domestic"
                id={`${title}-domestic`}
                className="border-2 border-input bg-background data-[state=checked]:border-nesy data-[state=checked]:bg-background data-[state=checked]:text-nesy"
              />
              <Label
                htmlFor={`${title}-domestic`}
                className="cursor-pointer text-sm font-normal text-foreground"
              >
                Domestic
              </Label>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <RadioGroupItem
                value="international"
                id={`${title}-international`}
                className="border-2 border-input bg-background data-[state=checked]:border-nesy data-[state=checked]:bg-background data-[state=checked]:text-nesy"
              />
              <Label
                htmlFor={`${title}-international`}
                className="cursor-pointer text-sm font-normal text-foreground"
              >
                International
              </Label>
            </label>
          </RadioGroup>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Name-Surname"
              value={str(value.contact.name)}
              onChange={(name) =>
                onChange({ ...value, contact: { ...value.contact, name } })
              }
              disabled={disabled}
            />
            <Field
              label="City / Town"
              value={str(value.address.city)}
              onChange={(city) =>
                onChange({ ...value, address: { ...value.address, city } })
              }
              disabled={disabled}
            />
            <Field
              label="Street"
              value={str(value.address.street)}
              onChange={(street) =>
                onChange({ ...value, address: { ...value.address, street } })
              }
              disabled={disabled}
            />
            <Field
              label="House Number"
              value={str(value.address.houseNumber ?? "")}
              onChange={(houseNumber) =>
                onChange({
                  ...value,
                  address: { ...value.address, houseNumber: houseNumber || null },
                })
              }
              disabled={disabled}
            />
            <Field
              label="Phone"
              value={str(value.contact.phone)}
              onChange={(phone) =>
                onChange({ ...value, contact: { ...value.contact, phone } })
              }
              disabled={disabled}
            />
            <Field
              label="E-Mail"
              value={str(value.contact.email ?? "")}
              onChange={(email) =>
                onChange({ ...value, contact: { ...value.contact, email } })
              }
              disabled={disabled}
            />
            {value.isInternational && (
              <Field
                label="Country Code"
                value={str(value.address.countryCode)}
                onChange={(countryCode) =>
                  onChange({
                    ...value,
                    address: { ...value.address, countryCode: countryCode.toUpperCase() },
                  })
                }
                disabled={disabled}
              />
            )}
            <Field
              label="Zip Code"
              value={str(value.address.zipCode)}
              onChange={(zipCode) =>
                onChange({ ...value, address: { ...value.address, zipCode } })
              }
              disabled={disabled}
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={value.saveAddress === true}
              onCheckedChange={(checked) =>
                onChange({ ...value, saveAddress: checked === true })
              }
              disabled={disabled}
            />
            Save Address
          </label>
        </TabsContent>

        {showParcelShop && (
          <TabsContent value="parcelshop" className="mt-3 space-y-3">
            <div className="flex gap-2">
              <Select
                value={oohMode}
                onValueChange={(v) => setOohMode(v as "city" | "zip")}
                disabled={disabled}
              >
                <SelectTrigger className="h-9 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="city">City</SelectItem>
                  <SelectItem value="zip">Zip</SelectItem>
                </SelectContent>
              </Select>
              <Input
                className="h-9 flex-1"
                placeholder={oohMode === "city" ? "City name..." : "Zip code..."}
                value={oohQuery}
                onChange={(e) => setOohQuery(e.target.value)}
                disabled={disabled}
              />
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
                onClick={() => void runOohSearch()}
                disabled={disabled || oohLoading || oohQuery.trim().length < 3}
              >
                {oohLoading ? <Loader2 className="size-4 animate-spin" /> : "Search"}
              </button>
            </div>
            {oohError && <p className="text-xs text-destructive">{oohError}</p>}
            {oohResults.length > 0 && (
              <div className="max-h-36 overflow-y-auto rounded-md border">
                {oohResults.map((row, i) => (
                  <button
                    key={`${row.oohId}-${i}`}
                    type="button"
                    className={cn(
                      "flex w-full flex-col gap-0.5 border-b px-3 py-2 text-left last:border-0 hover:bg-muted/50",
                      value.parcelShop?.oohId === row.oohId && "bg-nesy-soft/60",
                    )}
                    onClick={() => selectOoh(row)}
                    disabled={disabled}
                  >
                    <span className="text-xs font-medium">{row.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {str(row.address.city)} · {str(row.address.street)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function AddressBookNameDropdown({
  label,
  entries,
  selectedIndex,
  onSelect,
  disabled,
}: {
  label: string;
  entries: NesyAddress[];
  selectedIndex?: number;
  onSelect: (entry: NesyAddress, index: number) => void;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedName =
    selectedIndex != null && selectedIndex >= 0
      ? str(entries[selectedIndex]?.name)
      : "";

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length > 0 && q.length < 3) return [];
    if (!q) return entries;
    return entries.filter((entry) => str(entry.name).toLowerCase().includes(q));
  }, [entries, query]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const showDropdown = open && !disabled;
  const showMinCharsHint = query.trim().length > 0 && query.trim().length < 3;

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <Label className="text-xs font-medium">{label}</Label>
      <div className="relative">
        <Input
          className={cn(
            "h-9 bg-background pe-9 shadow-xs shadow-black/5",
            showDropdown && "rounded-b-none border-b-0 ring-0",
          )}
          placeholder="Search name (min 3 chars)..."
          value={open ? query : selectedName}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          disabled={disabled}
          autoComplete="off"
        />
        {open ? (
          <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground opacity-60" />
        ) : (
          <Search className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        )}

        {showDropdown && (
          <div
            className={cn(
              "absolute z-50 w-full overflow-hidden rounded-b-md border border-t-0 border-input",
              "bg-popover text-popover-foreground shadow-md shadow-black/5",
            )}
          >
            <div className="max-h-36 overflow-y-auto py-1">
              {entries.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  No address book entries for this customer.
                </p>
              ) : showMinCharsHint ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">
                  Enter at least 3 characters to search.
                </p>
              ) : filteredEntries.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">No results found.</p>
              ) : (
                filteredEntries.map((entry) => {
                  const globalIndex = entries.indexOf(entry);
                  const selected = selectedIndex === globalIndex;
                  return (
                    <button
                      key={`${entry.name}-${globalIndex}`}
                      type="button"
                      className={cn(
                        "relative flex w-full cursor-pointer select-none items-center rounded-sm px-3 py-2 text-left text-sm outline-none",
                        "hover:bg-accent hover:text-accent-foreground",
                        selected && "bg-accent/80 font-medium",
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        onSelect(entry, globalIndex);
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      {str(entry.name)}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input className="h-9 bg-muted/30" value={value} readOnly disabled />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        className="h-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
