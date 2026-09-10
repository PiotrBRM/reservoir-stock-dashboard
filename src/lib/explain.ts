// src/lib/explain.ts
import type { ConsolidatedRow, Thresholds } from "./../types";
import { formatMoney, formatNumber } from "./format";

export interface Explanation {
  headline: string;
  /** The exact arithmetic behind the cover numbers, one line per region + combined. */
  math: string[];
  /** The recommended action, in plain language with the numbers plugged in. Null if none needed. */
  action: string | null;
}

const coverLine = (label: string, stock: number, velocity: number, months: number | null) =>
  `${label}: ${formatNumber(stock)} units ÷ ${velocity.toFixed(1)}/mo = ${
    months !== null ? `${months.toFixed(1)} months of cover` : "no sales to project from"
  }`;

export function explainRow(r: ConsolidatedRow, t: Thresholds): Explanation {
  const math = [
    coverLine("Proper", r.properStock, r.properAvgMonthly, r.properMonthsOfCover),
    coverLine("AMPED", r.ampedStock, r.ampedAvgMonthly, r.ampedMonthsOfCover),
    coverLine("Combined", r.combinedStock, r.combinedVelocity, r.monthsOfCover),
  ];

  let headline: string;
  switch (r.status) {
    case "stockout":
      headline = `Out of stock, but still selling ${r.combinedVelocity.toFixed(1)} units/month combined.`;
      break;
    case "critical":
      headline = `${(r.monthsOfCover ?? 0).toFixed(1)} months of cover — below your ${t.lowMonths}-month repress threshold.`;
      break;
    case "overstocked":
      headline = `${(r.monthsOfCover ?? 0).toFixed(1)} months of cover — above your ${t.highMonths}-month ceiling.`;
      break;
    case "dormant":
      headline =
        r.combinedVelocity > 0
          ? `Only ${r.combinedVelocity.toFixed(1)} units/month combined — too thin a sales signal to flag urgency (floor: ${t.minMonthlyVelocity}/mo).`
          : `${formatNumber(r.combinedStock)} units in stock with no sales in the lookback window — cover can't be projected.`;
      break;
    default:
      headline = `${(r.monthsOfCover ?? 0).toFixed(1)} months of cover — within your ${t.lowMonths}–${t.highMonths} month target window.`;
  }

  let action: string | null = null;

  if (r.suggestedRepressQty !== null) {
    action = `Repress ${formatNumber(r.suggestedRepressQty)} units to bring combined cover up to your ${t.restockTargetMonths}-month target (${t.restockTargetMonths} × ${r.combinedVelocity.toFixed(1)}/mo − ${formatNumber(r.combinedStock)} in stock).`;
  } else if (r.excessUnits) {
    action = `${formatNumber(r.excessUnits)} units (${formatMoney(r.excessValue || 0)}) sit above your ${t.highMonths}-month ceiling${
      r.excessHoldingCostPerMonth ? ` — an estimated ${formatMoney(r.excessHoldingCostPerMonth)}/month to hold` : ""
    }.`;
  }

  if (r.regionFlag) {
    const [from, to] = r.regionFlag === "shift_to_amped" ? ["Proper", "AMPED"] : ["AMPED", "Proper"];
    const transferNote = `Consider moving ~${formatNumber(r.suggestedTransferQty || 0)} units from ${from} to ${to} — ${from} has surplus cover while ${to} is running low, so this may just need reallocating rather than repressing.`;
    action = action ? `${action} ${transferNote}` : transferNote;
  }

  const onOrderNotes: string[] = [];
  if (r.properOnOrder > 0) onOrderNotes.push(`${formatNumber(r.properOnOrder)} already on order at Proper`);
  if (r.ampedOnOrder > 0) onOrderNotes.push(`${formatNumber(r.ampedOnOrder)} already on order at AMPED`);
  if (onOrderNotes.length) {
    const note = `Note: ${onOrderNotes.join(" and ")} — not counted in the cover figures above.`;
    action = action ? `${action} ${note}` : note;
  }

  return { headline, math, action };
}
