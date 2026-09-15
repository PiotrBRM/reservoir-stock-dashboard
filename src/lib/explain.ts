// src/lib/explain.ts
import type { ConsolidatedRow, Thresholds } from "./../types";
import { DELETION_TYPE_META } from "./deletionType";
import { formatMoney, formatNumber } from "./format";

export interface Explanation {
  /** The headline verdict — what to do (or that nothing's needed), in one short line. */
  recommendation: string;
  /** Plain-language paragraph explaining why, with the real numbers woven in naturally. */
  reasoning: string;
}

/** Where the repress quantity should ship, in words — the headline number alone doesn't say. */
function repressSplitPhrase(r: ConsolidatedRow): string {
  const proper = r.suggestedRepressProperQty ?? 0;
  const amped = r.suggestedRepressAmpedQty ?? 0;
  if (proper > 0 && amped > 0) return `${formatNumber(proper)} to Proper, ${formatNumber(amped)} to AMPED`;
  if (proper > 0) return `all to Proper`;
  if (amped > 0) return `all to AMPED`;
  return "";
}

/** Parses AMPED's "Last PODate" (MM/DD/YYYY). Returns null if blank or unparseable. */
function parseLastPODate(s: string): Date | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  return Number.isNaN(date.getTime()) ? null : date;
}

const AVG_DAYS_PER_MONTH = 30.44;

/**
 * Whether AMPED shipped a repress recently enough that today's numbers might
 * just reflect that landing, not a genuine overstock/dormant read — Reservoir
 * US only has this signal at all, since it comes from AMPED's own PO history.
 */
function shippedWithin(r: ConsolidatedRow, months: number): boolean {
  const date = r.ampedLastPODate ? parseLastPODate(r.ampedLastPODate) : null;
  if (!date) return false;
  const monthsAgo = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * AVG_DAYS_PER_MONTH);
  return monthsAgo >= 0 && monthsAgo <= months;
}

export function explainRow(r: ConsolidatedRow, t: Thresholds): Explanation {
  const velocity = r.combinedVelocity.toFixed(1);
  const cover = (r.monthsOfCover ?? 0).toFixed(1);
  const split = repressSplitPhrase(r);

  let recommendation: string;
  let reasoning: string;

  switch (r.status) {
    case "stockout":
      recommendation = `Repress ${formatNumber(r.suggestedRepressQty ?? 0)} units${split ? ` (${split})` : ""}`;
      reasoning = `This is out of stock everywhere, but demand hasn't stopped — it's still selling about ${velocity} units a month combined. Repressing ${formatNumber(
        r.suggestedRepressQty ?? 0
      )} units${split ? ` (${split})` : ""} would rebuild ${t.restockTargetMonths} months of cover at that rate.`;
      break;
    case "critical":
      recommendation = `Repress ${formatNumber(r.suggestedRepressQty ?? 0)} units${split ? ` (${split})` : ""}`;
      reasoning = `At the current combined pace of ${velocity} units a month, the ${formatNumber(
        r.combinedStock
      )} units left in stock will only last about ${cover} months — under your ${t.lowMonths}-month threshold. Repressing ${formatNumber(
        r.suggestedRepressQty ?? 0
      )} units${split ? ` (${split})` : ""} would bring that back up to your ${t.restockTargetMonths}-month target.`;
      break;
    case "overstocked":
      recommendation = "No repress needed — review holding";
      reasoning = `Selling only about ${velocity} units a month, the ${formatNumber(
        r.combinedStock
      )} units in stock would last roughly ${cover} months — well past your ${t.highMonths}-month ceiling. That's ${formatNumber(
        r.excessUnits ?? 0
      )} units (${formatMoney(r.excessValue || 0)}) more than needed${
        r.excessHoldingCostPerMonth ? `, costing an estimated ${formatMoney(r.excessHoldingCostPerMonth)} a month to hold` : ""
      }.`;
      break;
    case "dormant":
      if (r.combinedVelocity > 0) {
        recommendation = "No action flagged — sales too low to trust";
        reasoning = `This is only selling about ${velocity} units a month combined — below the ${t.minMonthlyVelocity}/month floor needed to trust an urgent reading, so it isn't flagged even though the raw numbers look low.`;
      } else {
        recommendation = "No action flagged — no recent sales";
        reasoning = `${formatNumber(
          r.combinedStock
        )} units are sitting in stock, but neither distributor has recorded a sale in the lookback window, so there's no sales rate to project a repress or rebalance from.`;
      }
      break;
    case "deleted": {
      const meta = r.deletionType ? DELETION_TYPE_META[r.deletionType] : null;
      recommendation = meta && meta.canSell ? "Sell through remaining stock" : "No repress — sell down or scrap";
      reasoning = `This title has been deleted from the catalogue${
        r.deletedDate ? ` (${r.deletedDate})` : ""
      }. ${formatNumber(r.combinedStock)} units remain in stock${
        meta ? ` — ${meta.label.toLowerCase()}` : ""
      }. Repress and rebalance suggestions don't apply to deleted titles.`;
      break;
    }
    default:
      recommendation = "No action needed";
      reasoning = `Selling about ${velocity} units a month combined, the ${formatNumber(
        r.combinedStock
      )} units in stock cover roughly ${cover} months — comfortably inside your ${t.lowMonths}–${t.highMonths} month target window.`;
  }

  if (r.status === "overstocked" && shippedWithin(r, t.restockTargetMonths)) {
    reasoning += ` Worth noting: a repress shipped as recently as ${r.ampedLastPODate} — the high cover here may just reflect that fresh stock landing, not genuine overstock.`;
  } else if (r.status === "dormant" && shippedWithin(r, t.restockTargetMonths)) {
    reasoning += ` Worth noting: a repress shipped as recently as ${r.ampedLastPODate} — there may not have been enough time yet for sales to show up.`;
  }

  const isRepress = recommendation.startsWith("Repress");

  if (r.regionFlag) {
    const [from, to] = r.regionFlag === "shift_to_amped" ? ["Proper", "AMPED"] : ["AMPED", "Proper"];
    const transferNote = ` ${from} is sitting on more cover than ${to} needs — moving ~${formatNumber(
      r.suggestedTransferQty || 0
    )} units from ${from} to ${to} would relieve that faster than waiting on a repress.`;
    reasoning += transferNote;
    if (isRepress) {
      // A transfer reallocates existing stock between warehouses — it doesn't add
      // units to the combined total, so it can't reduce the repress figure above.
      reasoning += ` That's a reallocation of stock you already have though, not new stock — the repress number above still stands regardless.`;
    } else if (recommendation.startsWith("No repress needed") || recommendation.startsWith("No action")) {
      recommendation = `Move ~${formatNumber(r.suggestedTransferQty || 0)} units: ${from} → ${to}`;
    }
  }

  const onOrderNotes: string[] = [];
  if (r.properOnOrder > 0) onOrderNotes.push(`${formatNumber(r.properOnOrder)} at Proper`);
  if (r.ampedOnOrder > 0) onOrderNotes.push(`${formatNumber(r.ampedOnOrder)} at AMPED`);
  if (onOrderNotes.length) {
    reasoning += isRepress
      ? ` (${onOrderNotes.join(" and ")} already on order — already reflected in the repress figure above.)`
      : ` Note: ${onOrderNotes.join(" and ")} already on order — not reflected in the months-of-cover figure above.`;
  }

  return { recommendation, reasoning };
}
