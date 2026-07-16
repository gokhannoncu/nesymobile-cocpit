// @ts-nocheck
import { Router, type Router as RouterType } from "express";
import {
  type NesyCountry,
  type NesyEnvironment,
  resolveBaseUrl,
  nesyHeaders,
} from "../nesy-env.js";

const router: RouterType = Router();

interface SearchBody {
  token?: string;
  country?: NesyCountry;
  environment?: NesyEnvironment;
  /** Dashboard ile ayni: string musteri no (ornek: "10330") */
  customerId?: string | number;
  name?: string;
  oib?: string;
  fullName?: string;
  sorting?: string;
  skipCount?: number;
  maxResultCount?: number;
}

type NesySearchPayload = {
  customerQueryResult?: { totalCount?: number; items?: unknown[] };
};

/** Nesy Customer/SearchCustomerByAll (Dashboard ile ayni govdeler) */
router.post("/search", async (req, res) => {
  try {
    const body = req.body as SearchBody;
    const {
      token,
      country,
      environment,
      customerId,
      name,
      oib,
      fullName,
      sorting: sortingParam,
    } = body;
    const skipCount = body.skipCount;
    const maxResultCount = body.maxResultCount;

    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }

    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }

    // https://.../Customer/SearchCustomerByAll ornek: { "customerId": "10330", "sorting": "undefined desc" }
    const searchPayload: Record<string, unknown> = {
      sorting: sortingParam?.trim() || "undefined desc",
    };
    if (customerId != null && String(customerId).trim() !== "") {
      searchPayload.customerId = String(customerId).trim();
    }
    if (name?.trim()) searchPayload.name = name.trim();
    if (oib?.trim()) searchPayload.oib = oib.trim();
    if (fullName?.trim()) searchPayload.fullName = fullName.trim();
    if (typeof skipCount === "number" && !Number.isNaN(skipCount)) {
      searchPayload.skipCount = skipCount;
    }
    if (typeof maxResultCount === "number" && !Number.isNaN(maxResultCount)) {
      searchPayload.maxResultCount = maxResultCount;
    }

    const response = await fetch(`${baseUrl}/Customer/SearchCustomerByAll`, {
      method: "POST",
      headers: nesyHeaders(token),
      body: JSON.stringify(searchPayload),
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(502).json({
        message: "Nesy SearchCustomerByAll failed.",
        status: response.status,
        detail: text,
      });
      return;
    }

    const json = (await response.json()) as {
      payload?: NesySearchPayload;
    };
    const qr = json.payload?.customerQueryResult;
    const items = Array.isArray(qr?.items) ? qr.items : [];
    const totalCount = typeof qr?.totalCount === "number" ? qr.totalCount : items.length;

    res.json({
      data: {
        items,
        totalCount,
        raw: json.payload ?? null,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error during customer search.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

interface DetailsBody {
  token?: string;
  country?: NesyCountry;
  environment?: NesyEnvironment;
  customerId?: string | number;
  customerCenter?: string;
}

/** Nesy Customer/GetCustomerDetails */
router.post("/details", async (req, res) => {
  try {
    const body = req.body as DetailsBody;
    const { token, country, environment, customerId, customerCenter } = body;

    if (!token || !country || !environment) {
      res.status(400).json({ message: "token, country, environment are required." });
      return;
    }
    const idStr = customerId != null ? String(customerId).trim() : "";
    if (!idStr) {
      res.status(400).json({ message: "customerId is required." });
      return;
    }
    if (!customerCenter?.trim()) {
      res.status(400).json({ message: "customerCenter is required." });
      return;
    }

    const baseUrl = resolveBaseUrl(country, environment);
    if (!baseUrl) {
      res.status(400).json({ message: `Base URL not configured for ${country}/${environment}.` });
      return;
    }

    const response = await fetch(`${baseUrl}/Customer/GetCustomerDetails`, {
      method: "POST",
      headers: nesyHeaders(token),
      body: JSON.stringify({
        customerId: idStr,
        customerCenter: customerCenter.trim(),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(502).json({
        message: "Nesy GetCustomerDetails failed.",
        status: response.status,
        detail: text,
      });
      return;
    }

    const json = (await response.json()) as {
      resultCode?: number;
      resultMessage?: string;
      payload?: {
        customer?: Record<string, unknown>;
        keyAccountCustomerId?: number;
        keyAccountCustomerName?: string;
      };
    };
    const p = json.payload;
    // GetCustomerDetails: { payload: { customer: { customerId, addresses, ... } } } — musteriyi data kokune ac
    if (p?.customer && typeof p.customer === "object" && p.customer !== null) {
      res.json({
        data: {
          ...p.customer,
          keyAccountCustomerId: p.keyAccountCustomerId,
          keyAccountCustomerName: p.keyAccountCustomerName,
        },
      });
      return;
    }

    res.json({ data: p ?? json });
  } catch (error) {
    res.status(500).json({
      message: "Unexpected error while fetching customer details.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
