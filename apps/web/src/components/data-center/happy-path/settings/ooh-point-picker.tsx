"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@nesy/metronic/components/ui/button";
import { Input, InputWrapper } from "@nesy/metronic/components/ui/input";
import { Label } from "@nesy/metronic/components/ui/label";
import { useNesyAuth } from "@/contexts/nesy-auth-context";
import { fetchOohByCity, fetchOohByZip } from "@/services/shipment-address";
import type { OohPointSelection } from "@/lib/happy-path/shipment-group-settings";

interface OohPointPickerProps {
  label: string;
  value?: OohPointSelection;
  oohKind: "parcelshop" | "locker";
  onChange: (selection: OohPointSelection) => void;
  error?: string;
}

interface OohItem {
  id: string;
  name: string;
  address?: string;
  city?: string;
  zipCode?: string;
}

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (v == null) return "";
  return String(v);
}

function formatAddressObject(addr: Record<string, unknown>): string {
  const text = addr.addressText ?? addr.AddressText;
  if (typeof text === "string" && text.trim()) return text.trim();

  const parts = [
    addr.street ?? addr.Street,
    addr.houseNumber ?? addr.HouseNumber,
    addr.zipCode ?? addr.ZipCode,
    addr.city ?? addr.City,
  ]
    .map(str)
    .filter(Boolean);

  if (parts.length > 0) return parts.join(", ");
  return str(addr.name ?? addr.Name);
}

function normalizeOohItem(raw: unknown, index: number): OohItem {
  if (!raw || typeof raw !== "object") {
    return { id: String(index), name: "OOH Point" };
  }

  const r = raw as Record<string, unknown>;
  const id = str(
    r.id ??
      r.Id ??
      r.counterLocationId ??
      r.CounterLocationId ??
      r.oohPointId ??
      r.OohPointId ??
      index,
  );

  const rawName = r.name ?? r.Name ?? r.oohName ?? r.OohName;
  let name = "OOH Point";
  if (typeof rawName === "string" && rawName.trim()) {
    name = rawName.trim();
  } else if (rawName && typeof rawName === "object") {
    const nameObj = rawName as Record<string, unknown>;
    name =
      str(nameObj.name ?? nameObj.Name) || formatAddressObject(nameObj) || "OOH Point";
  }

  const rawAddr = r.address ?? r.Address;
  let addressLine = "";
  let city = str(r.city ?? r.City);
  let zipCode = str(r.zipCode ?? r.ZipCode ?? r.zip);

  if (typeof rawAddr === "string") {
    addressLine = rawAddr;
  } else if (rawAddr && typeof rawAddr === "object") {
    const addr = rawAddr as Record<string, unknown>;
    addressLine = formatAddressObject(addr);
    if (!city) city = str(addr.city ?? addr.City);
    if (!zipCode) zipCode = str(addr.zipCode ?? addr.ZipCode);
  }

  return { id, name, address: addressLine || undefined, city, zipCode };
}

function formatSelectedLabel(value?: OohPointSelection): string {
  if (!value?.oohPointId) return "";

  const name = value.oohName;
  if (typeof name === "string" && name.trim()) return name.trim();
  if (name && typeof name === "object") {
    return formatAddressObject(name as Record<string, unknown>);
  }

  const parts = [value.city, value.zipCode].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "Selected OOH point";
}

export function OohPointPicker({
  label,
  value,
  onChange,
  error,
}: OohPointPickerProps) {
  const { token, country, environment, status } = useNesyAuth();
  const isConnected = status === "connected" && !!token;

  const [searchMode, setSearchMode] = useState<"city" | "zip">("city");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<OohItem[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function handleSearch() {
    if (!token || !query.trim()) return;
    setLoading(true);
    setSearchError(null);
    setResults([]);

    try {
      const raw =
        searchMode === "city"
          ? await fetchOohByCity({
              token,
              country,
              environment,
              city: query.trim(),
            })
          : await fetchOohByZip({
              token,
              country,
              environment,
              zipCode: query.trim(),
            });

      const items = raw.map(normalizeOohItem);
      setResults(items);
      if (items.length === 0) {
        setSearchError("No OOH points found.");
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <h4 className="text-sm font-semibold text-foreground">{label}</h4>

      {value?.oohPointId ? (
        <div className="flex items-center justify-between rounded-md border border-nesy/30 bg-nesy-soft/50 px-3 py-2">
          <span className="text-sm text-foreground">{formatSelectedLabel(value)}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ oohPointId: "", oohName: "" })}
          >
            Clear
          </Button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={searchMode === "city" ? "primary" : "outline"}
              onClick={() => setSearchMode("city")}
            >
              By city
            </Button>
            <Button
              type="button"
              size="sm"
              variant={searchMode === "zip" ? "primary" : "outline"}
              onClick={() => setSearchMode("zip")}
            >
              By zip
            </Button>
          </div>
          <div className="flex gap-2">
            <InputWrapper className="flex-1">
              <Search />
              <Input
                placeholder={searchMode === "city" ? "City name" : "Zip code"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={!isConnected}
              />
            </InputWrapper>
            <Button
              type="button"
              variant="outline"
              disabled={!isConnected || loading || !query.trim()}
              onClick={() => void handleSearch()}
            >
              {loading ? <Loader2 className="size-4 animate-spin" /> : "Search"}
            </Button>
          </div>
          {searchError && (
            <p className="text-xs text-muted-foreground">{searchError}</p>
          )}
          {results.length > 0 && (
            <div className="max-h-40 overflow-y-auto rounded-md border border-border">
              {results.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex w-full flex-col border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/30"
                    onClick={() =>
                      onChange({
                        oohPointId: item.id,
                        oohName: item.name,
                        city: item.city,
                        zipCode: item.zipCode,
                      })
                    }
                  >
                    <span className="font-medium">{item.name}</span>
                    {item.address && (
                      <span className="text-xs text-muted-foreground">
                        {item.address}
                      </span>
                    )}
                  </button>
                ))}
            </div>
          )}
        </>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
      <Label className="sr-only">{label}</Label>
    </section>
  );
}
