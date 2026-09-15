// src/lib/consolidate.ts
import type { ConsolidatedRow, StockStatus, Thresholds } from "../types";

// ============ EXCLUSION LISTS ============
// Genuinely out of scope for every team this tool tracks (not Chrysalis
// Records, not Reservoir US) — mostly major-label licensed imprints. Labels
// that belong to a team live in that team's TEAMS config in types.ts instead;
// don't add a label here just because it doesn't have a tab yet.
const EXCLUDED_LABELS = ["RAMBLIN RECORDS", "DEF JAM", "UNIVERSAL", "WARNER", "NEW STATE"];
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

    // Clamped at 0 — a negative source value (returns-in-transit, overselling
    // artifacts) isn't physical stock, and left unclamped it corrupts every
    // downstream figure (cover math, stock value, bar widths).
    const properStock = Math.max(0, getNumericValue(row.StockOnHand));
    const ampedMatch = findAmpedForProper(ampedIndex, row);

    // Note: deliberately excludes AMPED's "Inv Avail" field from this fallback
    // chain — despite the name, that field is weeks-of-inventory (QAV ÷
    // Avg/Week), not a unit count. Falling back to it here would silently
    // substitute a ratio for a stock quantity if QAV is ever blank.
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
    // Last time AMPED shipped a PO for this title — Reservoir US's own signal
    // for whether a repress is already in flight, not something Proper tracks.
    const ampedLastPODate = ampedMatch ? String(ampedMatch["Last PODate"] || "").trim() : "";
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

    // Proper's DeletionType (1-4) marks a title as pulled from the catalogue.
    // A deleted title with nothing left anywhere isn't worth reporting — but
    // one still holding stock somewhere must stay visible regardless of its
    // sales velocity, since deletion pulls it out of the normal repress/
    // rebalance workflow entirely rather than depending on how it's selling.
    const deletionTypeRaw = getNumericValue(row.DeletionType);
    const deletionType: 1 | 2 | 3 | 4 | null =
      deletionTypeRaw >= 1 && deletionTypeRaw <= 4 ? (deletionTypeRaw as 1 | 2 | 3 | 4) : null;
    const deletedDate = String(row.DeletedDate || "").trim();
    if (deletionType !== null && combinedStock === 0) continue;

    const combinedVelocity = Math.round((properAvgMonthly + ampedAvgMonthly) * 100) / 100;
    const monthsOfCover =
      combinedVelocity > 0 ? Math.max(0, Math.round((combinedStock / combinedVelocity) * 10) / 10) : null;

    const unitPrice = getNumericValue(row.UKDealer);
    const stockValue = Math.round(combinedStock * unitPrice * 100) / 100;

    // A deleted title's status is "deleted" regardless of what the stock/
    // velocity math says — set before the repress/overstock blocks below so
    // their `status === ...` checks naturally skip it, no separate guard needed.
    let status: StockStatus = classifyStatus(combinedStock, combinedVelocity, thresholds);
    if (deletionType !== null) status = "deleted";

    let suggestedRepressQty: number | null = null;
    let suggestedRepressProperQty: number | null = null;
    let suggestedRepressAmpedQty: number | null = null;
    let excessUnits: number | null = null;
    let excessValue: number | null = null;
    let excessHoldingCostPerMonth: number | null = null;

    if ((status === "critical" || status === "stockout") && combinedVelocity > 0) {
      // Net out units already inbound — they'll land in combinedStock once they
      // arrive, so counting them again here would overstate the repress need.
      // (A cross-region transfer does NOT get netted out here: reallocating
      // existing stock between Proper and AMPED doesn't add units to the total
      // pool, so it can't reduce this figure — see the rebalance block below.)
      const alreadyInbound = properOnOrder + ampedOnOrder;
      suggestedRepressQty = Math.max(
        0,
        Math.ceil(combinedVelocity * thresholds.restockTargetMonths - combinedStock - alreadyInbound)
      );

      // A repress is one manufacturing run, but Proper and AMPED are separate
      // warehouses that each need their own shipment — split the total by each
      // region's own deficit against the target, clamped at 0 so a region
      // already sitting on enough stock doesn't get assigned a negative share.
      const properDeficit = Math.max(0, properAvgMonthly * thresholds.restockTargetMonths - properStock - properOnOrder);
      const ampedDeficit = Math.max(0, ampedAvgMonthly * thresholds.restockTargetMonths - ampedStock - ampedOnOrder);
      const totalDeficit = properDeficit + ampedDeficit;
      if (suggestedRepressQty === 0) {
        suggestedRepressProperQty = 0;
        suggestedRepressAmpedQty = 0;
      } else if (totalDeficit > 0) {
        suggestedRepressProperQty = Math.round(suggestedRepressQty * (properDeficit / totalDeficit));
        suggestedRepressAmpedQty = suggestedRepressQty - suggestedRepressProperQty;
      } else {
        // Neither region shows an individual deficit (can happen right at the
        // rounding boundary) — attribute it all to Proper as the safer default
        // rather than leaving the split undefined.
        suggestedRepressProperQty = suggestedRepressQty;
        suggestedRepressAmpedQty = 0;
      }
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

    // Only suggest a cross-region transfer when this title actually has a
    // confirmed AMPED counterpart. Without a match, "0 stock / 0 sales" just
    // means "no AMPED data for this title" (e.g. never distributed in NA) —
    // not a genuine surplus to draw from. Deleted titles don't get rebalance
    // suggestions either — moving stock between warehouses isn't the point
    // once a title has been pulled from the catalogue.
    if (deletionType === null && ampedMatch) {
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
    }

    out.push({
      // Strip the leading apostrophe some exports use to force text formatting
      // (preserve leading zeros — those are part of the real UPC/EAN).
      barcode: String(row.barcode_apostrophe || row.Barcode || row.UPC || "").replace(/^'+/, ""),
      catalogNo: row.CatNo || "",
      artist: row.Artist || "",
      title: row.Title || "",
      releaseDate: row.ReleaseDate || "",
      format: row.FormatCode || "",
      labelName: String(row.LabelName || "").trim(),
      ampedMatched: ampedMatch !== null,
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
      suggestedRepressProperQty,
      suggestedRepressAmpedQty,
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
      ampedLastPODate,
      deletionType,
      deletedDate,
    });
  }

  return out;
}
