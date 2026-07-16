"use client";

import { useState, useCallback } from "react";
import { Button } from "@nesy/metronic/components/ui/button";
import { Input } from "@nesy/metronic/components/ui/input";
import { Label } from "@nesy/metronic/components/ui/label";
import { useNesyAuth } from "@/contexts/nesy-auth-context";
import {
  extractSearchRows,
  pickRowCenter,
  pickRowIdString,
  rowLabel,
} from "@/lib/customer-search-helpers";
import { mapNesyDetailsToBffPayload } from "@/lib/nesy-customer-mapper";
import { cn } from "@nesy/metronic/lib/utils";
import { getCustomerDetails, searchCustomers, type BffCustomerPayload } from "@/services/customer";

const COPY = {
  en: {
    title: "Customer (Nesy)",
    clear: "Clear",
    connectFirst: "Connect to Nesy from the Connection page before searching.",
    customerNo: "Customer no",
    customerNoPh: "e.g. 12345",
    nameOptional: "Name (optional)",
    namePh: "Partial or short name",
    search: "Search",
    searching: "Searching…",
    errNeedInput: "Enter a customer number or partial name.",
    errNeedCustomerNo: "Enter a customer number.",
    errNoResults: "No results. Try different criteria.",
    errSearchFailed: "Search failed",
    errNoId: "No valid customer number on this row.",
    errDetailFailed: "Could not load details",
    selected: "Selected:",
  },
  tr: {
    title: "Musteri (Nesy)",
    clear: "Temizle",
    connectFirst: "Nesy baglantisini actiktan sonra arayin.",
    customerNo: "Musteri no",
    customerNoPh: "ornek: 12345",
    nameOptional: "Isim (opsiyonel)",
    namePh: "Kismi isim / kisa isim",
    search: "Ara",
    searching: "Araniyor...",
    errNeedInput: "Musteri numarasi veya isim (kismi) girin.",
    errNeedCustomerNo: "Musteri numarasi girin.",
    errNoResults: "Sonuc yok. Kriteri degistirin.",
    errSearchFailed: "Arama basarisiz",
    errNoId: "Satirda gecerli musteri numarasi yok.",
    errDetailFailed: "Detay alinamadi",
    selected: "Secili:",
  },
} as const;

type Locale = keyof typeof COPY;

export function CustomerSearch({
  disabled,
  onSelect,
  onClear,
  className,
  locale = "en",
  hideNameField = false,
}: {
  disabled?: boolean;
  onSelect: (customer: BffCustomerPayload) => void;
  onClear?: () => void;
  className?: string;
  locale?: Locale;
  hideNameField?: boolean;
}) {
  const t = COPY[locale];
  const { token, country, environment, status: authStatus } = useNesyAuth();
  const isConnected = authStatus === "connected" && !!token;

  const [customerNo, setCustomerNo] = useState("");
  const [nameHint, setNameHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadDetailId, setLoadDetailId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  const runSearch = useCallback(async () => {
    const c = COPY[locale];
    if (!token) return;
    setError(null);
    setRows([]);
    setSelectedLabel(null);
    setLoading(true);
    try {
      const body: Parameters<typeof searchCustomers>[0] = {
        token,
        country,
        environment,
        sorting: "undefined desc",
      };
      if (customerNo.trim()) {
        body.customerId = customerNo.trim();
      }
      if (!hideNameField && nameHint.trim()) {
        body.name = nameHint.trim();
      }
      if (hideNameField) {
        if (!customerNo.trim()) {
          setError(c.errNeedCustomerNo);
          return;
        }
      } else if (!customerNo.trim() && !nameHint.trim()) {
        setError(c.errNeedInput);
        return;
      }
      const data = await searchCustomers(body);
      const list = extractSearchRows(data);
      setRows(list);
      if (list.length === 0) {
        setError(c.errNoResults);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : c.errSearchFailed);
    } finally {
      setLoading(false);
    }
  }, [token, country, environment, customerNo, nameHint, hideNameField, locale]);

  const selectRow = useCallback(
    async (row: Record<string, unknown>) => {
      const c = COPY[locale];
      if (!token) return;
      const idStr = pickRowIdString(row);
      const center = pickRowCenter(row);
      if (!idStr) {
        setError(c.errNoId);
        return;
      }
      setError(null);
      setLoadDetailId(idStr);
      try {
        const raw = await getCustomerDetails({
          token,
          country,
          environment,
          customerId: idStr,
          customerCenter: center,
        });
        const bff = mapNesyDetailsToBffPayload(raw, row);
        setSelectedLabel(
          `${bff.customerId} \u00b7 ${bff.name} \u00b7 ${bff.addressCity}`
        );
        onSelect(bff);
        setRows([]);
        setCustomerNo(String(bff.customerId));
      } catch (e) {
        setError(e instanceof Error ? e.message : c.errDetailFailed);
      } finally {
        setLoadDetailId(null);
      }
    },
    [token, country, environment, onSelect, locale]
  );

  const clearSelection = useCallback(() => {
    setSelectedLabel(null);
    setCustomerNo("");
    setNameHint("");
    setRows([]);
    setError(null);
    onClear?.();
  }, [onClear]);

  return (
    <div className={cn("space-y-3 rounded-md border p-3 bg-muted/20", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{t.title}</span>
        {selectedLabel && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={clearSelection}
            disabled={disabled}
          >
            {t.clear}
          </Button>
        )}
      </div>

      {!isConnected && (
        <p className="text-xs text-muted-foreground">{t.connectFirst}</p>
      )}

      <div
        className={cn(
          "grid grid-cols-1 gap-2",
          !hideNameField && "sm:grid-cols-2"
        )}
      >
        <div className="space-y-1.5">
          <Label className="text-xs">{t.customerNo}</Label>
          <Input
            inputMode="numeric"
            value={customerNo}
            onChange={(e) => setCustomerNo(e.target.value)}
            placeholder={t.customerNoPh}
            disabled={disabled || !isConnected}
          />
        </div>
        {!hideNameField && (
          <div className="space-y-1.5">
            <Label className="text-xs">{t.nameOptional}</Label>
            <Input
              value={nameHint}
              onChange={(e) => setNameHint(e.target.value)}
              placeholder={t.namePh}
              disabled={disabled || !isConnected}
            />
          </div>
        )}
      </div>

      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="w-full sm:w-auto"
        onClick={runSearch}
        disabled={disabled || !isConnected || loading}
      >
        {loading ? t.searching : t.search}
      </Button>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {rows.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded border bg-background text-xs">
          {rows.map((row, i) => {
            const idStr = pickRowIdString(row);
            const key = `r-${i}-${idStr || i}`;
            const busy = loadDetailId === idStr;
            return (
              <button
                key={key}
                type="button"
                className="flex w-full items-start gap-2 border-b px-2 py-1.5 text-left last:border-0 hover:bg-muted/50 disabled:opacity-50"
                onClick={() => void selectRow(row)}
                disabled={disabled || busy}
              >
                <span className="font-mono text-[11px] text-muted-foreground">
                  {busy ? "..." : idStr || "?"}
                </span>
                <span className="line-clamp-2">{rowLabel(row)}</span>
              </button>
            );
          })}
        </div>
      )}

      {selectedLabel && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{t.selected}</span> {selectedLabel}
        </p>
      )}
    </div>
  );
}
