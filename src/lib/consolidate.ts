// src/lib/consolidate.ts
import type { ConsolidatedRow, StockStatus, Thresholds } from "../types";

// ============ EXCLUSION LISTS ============
const EXCLUDED_LABELS = [
  "FREE GOODS",
  "TOMMY BOY RECORDS",
  "PHILLY GROOVE RECORDS",
  "AMHERST RECORDS",
  "RASA MUSIC",
  "RESERVOIR RECORDINGS",
  "RAMBLIN RECORDS",
  "DEF JAM",
  "UNIVERSAL",
  "WARNER",
];
const EXCLUDED_ARTISTS = ["DE LA SOUL", "THE MARSHALL TUCKER BAND", "THE COOL KIDS"];
// =========================================

// ------------------ HELPERS ------------------
const getNumericValue = (v: unknown) => {
  if (typeof v === "number") return v || 0;
  if (!v && v !== 0) return 0;
  const s = String(v).replace(/[^0-9.-]/g, "");
  return parseFloat(s) || 0;
};
const normalizeBarcode = (barcode: unknown) => {
  if (!barcode && barcode !== 0) return "";
  let s = String(barcode).trim();
  s = s.replace(/^'+/, "").replace(/^0+/, "");
  return s || "0";
};
const isExcludedLabel = (label: unknown) => {
  if (!label) return false;
  const s = String(label).toUpperCase();
  return EXCLUDED_LABELS.some((ex) => s.includes(ex));
};
const isExcludedArtist = (artist: unknown) => {
  if (!artist) return false;
  const s = String(artist).toUpperCase();
  return EXCLUDED_ARTISTS.some((ex) => s.includes(ex));
};

// --- Robust key helpers ---
const onlyDigits = (s: string) => s.replace(/\D+/g, "");
const onlyAlnum = (s: string) => s.replace(/[^A-Z0-9]+/gi, "").toUpperCase();

const normalizeTitle = (v: unknown) =>
  String(v || "")
    .toUpperCase()
    .replace(/[’'‘`]/g, "") // quotes
    .replace(/\(.*?\)/g, "") // remove parens content
    .replace(/[^A-Z0-9 ]+/g, " ") // strip punctuation
    .replace(/\s+/g, " ") // collapse spaces
    .trim();

const normalizeArtist = (v: unknown) =>
  String(v || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normCat = (v: unknown) => onlyAlnum(String(v || ""));

// Accept 12/13-digit UPC/EAN and generate common variants (leading 0 added/removed)
const expandBarcodeVariants = (raw: unknown): string[] => {
  const s = String(raw || "").trim();
  if (!s) return [];
  const digits = onlyDigits(s);
  if (!digits) return [];
  const variants = new Set<string>();
  variants.add(digits);
  if (digits.length === 13 && digits.startsWith("0")) variants.add(digits.slice(1));
  if (digits.length === 12) variants.add("0" + digits);
  variants.add(normalizeBarcode(digits));
  return Array.from(variants);
};

// Build a robust AMPED index: by barcode variants, by normalized CatNo, and fallback Artist+Title
const buildAmpedIndex = (rows: any[]) => {
  const byKey = new Map<string, any>();
  for (const r of rows) {
    const upcRaw =
      r.UPC ||
      r.upc ||
      r.Barcode ||
      r.EAN ||
      r["UPC/EAN"] ||
      r["UPC "] ||
      r["Product UPC/EAN"] ||
      r["UPC Full"] ||
      r["UPC Code"] ||
      "";
    const catRaw =
      r["Catalog Num"] || r.CatNo || r["Catalog No"] || r.CatalogNo || r["Item Code"] || r["Item Number"] || "";

    const variants = expandBarcodeVariants(upcRaw);
    for (const v of variants) byKey.set(`UPC:${v}`, r);

    const nCat = normCat(catRaw);
    if (nCat) byKey.set(`CAT:${nCat}`, r);

    const a = normalizeArtist(r.Artist || r["Artist"] || "");
    const t = normalizeTitle(r.Title || r["Title"] || "");
    if (a && t) byKey.set(`AT:${a}::${t}`, r);
  }
  return byKey;
};

// Lookup that tries UPC → CatNo → Artist+Title
const findAmpedForProper = (idx: Map<string, any>, properRow: any) => {
  const pUPC = properRow.barcode_apostrophe || properRow.Barcode || properRow.UPC || "";
  const upcVariants = expandBarcodeVariants(pUPC);
  for (const v of upcVariants) {
    const hit = idx.get(`UPC:${v}`);
    if (hit) return hit;
  }
  const pCat = normCat(properRow.CatNo || properRow["Catalog No"] || "");
  if (pCat) {
    const hit = idx.get(`CAT:${pCat}`);
    if (hit) return hit;
  }
  const a = normalizeArtist(properRow.Artist);
  const t = normalizeTitle(properRow.Title);
  if (a && t) {
    const hit = idx.get(`AT:${a}::${t}`);
    if (hit) return hit;
  }
  return null;
};

/**
 * Classify a title's stock health from its stock and monthly sales velocity.
 *
 * Below `minMonthlyVelocity`, the sales rate is too thin to trust an "urgent"
 * verdict — one extra sale can double a tiny ratio. So a low-cover result is
 * only reported as critical/stockout once the velocity behind it clears that
 * floor; below it, we report "dormant" (no reliable signal) rather than raise
 * a false alarm. Overstocked/healthy aren't gated — a low-velocity title still
 * sitting on a huge pile of stock is a genuine (not noisy) overstock signal.
 */
export function classifyStatus(combinedStock: number, velocity: number, thresholds: Thresholds): StockStatus {
  if (velocity <= 0) return "dormant";
  const trusted = velocity >= thresholds.minMonthlyVelocity;
  if (combinedStock <= 0) return trusted ? "stockout" : "dormant";
  const months = combinedStock / velocity;
  if (months < thresholds.lowMonths) return trusted ? "critical" : "dormant";
  if (months <= thresholds.highMonths) return "healthy";
  return "overstocked";
}

/** Read both source datasets, join them, and compute stock-health metrics for every title. */
export function buildConsolidatedRows(
  properRows: any[],
  ampedRows: any[],
  thresholds: Thresholds
): ConsolidatedRow[] {
  if (!properRows.length || !ampedRows.length) return [];

  const ampedIndex = buildAmpedIndex(ampedRows);
  const out: ConsolidatedRow[] = [];

  for (const row of properRows) {
    if (isExcludedLabel(row.LabelName) || isExcludedLabel(row.SubLabelName)) continue;
    if (isExcludedArtist(row.Artist)) continue;
    if (row.Title && String(row.Title).toUpperCase().includes("DELETED")) continue;

    // Clamped at 0 — a negative source value (returns-in-transit, overselling
    // artifacts) isn't physical stock, and left unclamped it corrupts every
    // downstream figure (cover math, stock value, bar widths).
    const properStock = Math.max(0, getNumericValue(row.StockOnHand));
    const ampedMatch = findAmpedForProper(ampedIndex, row);

    const ampedStock = ampedMatch
      ? Math.max(
          0,
          getNumericValue(
            ampedMatch.QAV ||
              ampedMatch.qav ||
              ampedMatch.Quantity ||
              ampedMatch.Qty ||
              ampedMatch["Total Quantity"] ||
              ampedMatch["On Hand"] ||
              ampedMatch["Available Qty"] ||
              ampedMatch["Inventory Qty Available"] ||
              ampedMatch["Inv Avail"] ||
              0
          )
        )
      : 0;

    const ampedAvgWeek = ampedMatch
      ? getNumericValue(ampedMatch["Avg/Week"] || ampedMatch.AvgWeek || ampedMatch["Weekly Avg"] || 0)
      : 0;

    // Wk1 = most recent complete week ... Wk8 = 8 weeks ago. Reverse to oldest-first for trend display.
    const ampedWeeklySales = ampedMatch
      ? [8, 7, 6, 5, 4, 3, 2, 1].map((n) => getNumericValue(ampedMatch[`Wk${n}`] ?? ampedMatch[`Wk${n} `] ?? 0))
      : [];
    const ampedOnOrder = ampedMatch ? getNumericValue(ampedMatch.QOO) : 0;
    const properOnOrder = getNumericValue(row.OnOrder);

    // Proper: 3-month average monthly sales
    const salesLastMonth = getNumericValue(row.Sales_LastMonth);
    const sales2MonthsAgo = getNumericValue(row.Sales_2MonthsAgo);
    const sales3MonthsAgo = getNumericValue(row.Sales_3MonthsAgo);
    const properAvgMonthly = Math.round(((salesLastMonth + sales2MonthsAgo + sales3MonthsAgo) / 3) * 100) / 100;

    // AMPED: convert Avg/Week → monthly (× 4.333 weeks/month)
    const ampedAvgMonthly = Math.round(ampedAvgWeek * 4.333 * 100) / 100;

    // Hide only if there's truly nothing to report: no stock AND no sales at
    // either distributor. A title with 0 stock everywhere but real velocity is
    // a genuine stockout, not dead catalog — that one must stay visible.
    if (properStock === 0 && ampedStock === 0 && properAvgMonthly === 0 && ampedAvgMonthly === 0) continue;

    const combinedStock = properStock + ampedStock;
    const combinedVelocity = Math.round((properAvgMonthly + ampedAvgMonthly) * 100) / 100;
    const monthsOfCover =
      combinedVelocity > 0 ? Math.max(0, Math.round((combinedStock / combinedVelocity) * 10) / 10) : null;

    const unitPrice = getNumericValue(row.UKDealer);
    const stockValue = Math.round(combinedStock * unitPrice * 100) / 100;

    const status = classifyStatus(combinedStock, combinedVelocity, thresholds);

    let suggestedRepressQty: number | null = null;
    let excessUnits: number | null = null;
    let excessValue: number | null = null;
    let excessHoldingCostPerMonth: number | null = null;

    if ((status === "critical" || status === "stockout") && combinedVelocity > 0) {
      suggestedRepressQty = Math.max(
        0,
        Math.ceil(combinedVelocity * thresholds.restockTargetMonths - combinedStock)
      );
    }
    if (status === "overstocked") {
      excessUnits = Math.max(0, Math.floor(combinedStock - combinedVelocity * thresholds.highMonths));
      excessValue = Math.round(excessUnits * unitPrice * 100) / 100;
      excessHoldingCostPerMonth =
        thresholds.holdingCostPerUnitPerMonth > 0
          ? Math.round(excessUnits * thresholds.holdingCostPerUnitPerMonth * 100) / 100
          : null;
    }

    // Proper (UK & ROW) and AMPED (NA) are separate warehouses — a title can be
    // dying in one region while sitting overstocked in the other. Classify each
    // side independently so that imbalance is visible even when the combined
    // total looks healthy.
    const properStatus = classifyStatus(properStock, properAvgMonthly, thresholds);
    const ampedStatus = classifyStatus(ampedStock, ampedAvgMonthly, thresholds);
    const properMonthsOfCover =
      properAvgMonthly > 0 ? Math.max(0, Math.round((properStock / properAvgMonthly) * 10) / 10) : null;
    const ampedMonthsOfCover =
      ampedAvgMonthly > 0 ? Math.max(0, Math.round((ampedStock / ampedAvgMonthly) * 10) / 10) : null;

    const isNeedy = (s: StockStatus) => s === "critical" || s === "stockout";
    const isSurplus = (s: StockStatus) => s === "overstocked" || s === "dormant";

    let regionFlag: "shift_to_proper" | "shift_to_amped" | null = null;
    let suggestedTransferQty: number | null = null;

    if (isNeedy(ampedStatus) && isSurplus(properStatus) && properStock > 0) {
      const deficit = Math.max(0, ampedAvgMonthly * thresholds.restockTargetMonths - ampedStock);
      const surplus = Math.max(0, properStock - properAvgMonthly * thresholds.highMonths);
      const qty = Math.round(Math.min(deficit, surplus));
      if (qty > 0) {
        regionFlag = "shift_to_amped";
        suggestedTransferQty = qty;
      }
    } else if (isNeedy(properStatus) && isSurplus(ampedStatus) && ampedStock > 0) {
      const deficit = Math.max(0, properAvgMonthly * thresholds.restockTargetMonths - properStock);
      const surplus = Math.max(0, ampedStock - ampedAvgMonthly * thresholds.highMonths);
      const qty = Math.round(Math.min(deficit, surplus));
      if (qty > 0) {
        regionFlag = "shift_to_proper";
        suggestedTransferQty = qty;
      }
    }

    out.push({
      barcode: row.barcode_apostrophe || row.Barcode || row.UPC || "",
      catalogNo: row.CatNo || "",
      artist: row.Artist || "",
      title: row.Title || "",
      releaseDate: row.ReleaseDate || "",
      format: row.FormatCode || "",
      labelName: String(row.LabelName || "").trim(),
      properStock,
      ampedStock,
      combinedStock,
      properAvgMonthly,
      ampedAvgMonthly,
      combinedVelocity,
      monthsOfCover,
      unitPrice,
      stockValue,
      status,
      suggestedRepressQty,
      excessUnits,
      excessValue,
      excessHoldingCostPerMonth,
      properStatus,
      ampedStatus,
      properMonthsOfCover,
      ampedMonthsOfCover,
      regionFlag,
      suggestedTransferQty,
      properMonthlySales: [salesLastMonth, sales2MonthsAgo, sales3MonthsAgo],
      properOnOrder,
      ampedWeeklySales,
      ampedOnOrder,
    });
  }

  return out;
}
