// src/lib/explain.ts
import type { ConsolidatedRow, Thresholds } from "./../types";
import { formatMoney, formatNumber } from "./format";

export interface Explanation {
  /** The headline verdict — what to do (or that nothing's needed), in one short line. */
  recommendation: string;
  /** Plain-language paragraph explaining why, with the real numbers woven in naturally. */
  reasoning: string;
}

export function explainRow(r: ConsolidatedRow, t: Thresholds): Explanation {
  const velocity = r.combinedVelocity.toFixed(1);
  const cover = (r.monthsOfCover ?? 0).toFixed(1);

  let recommendation: string;
  let reasoning: string;

  switch (r.status) {
    case "stockout":
      recommendation = `Repress ${formatNumber(r.suggestedRepressQty ?? 0)} units`;
      reasoning = `This is out of stock everywhere, but demand hasn't stopped — it's still selling about ${velocity} units a month combined. Repressing ${formatNumber(
        r.suggestedRepressQty ?? 0
      )} units would rebuild ${t.restockTargetMonths} months of cover at that rate.`;
      break;
    case "critical":
      recommendation = `Repress ${formatNumber(r.suggestedRepressQty ?? 0)} units`;
      reasoning = `At the current combined pace of ${velocity} units a month, the ${formatNumber(
        r.combinedStock
      )} units left in stock will only last about ${cover} months — under your ${t.lowMonths}-month threshold. Repressing ${formatNumber(
        r.suggestedRepressQty ?? 0
      )} units would bring that back up to your ${t.restockTargetMonths}-month target.`;
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
    default:
      recommendation = "No action needed";
      reasoning = `Selling about ${velocity} units a month combined, the ${formatNumber(
        r.combinedStock
      )} units in stock cover roughly ${cover} months — comfortably inside your ${t.lowMonths}–${t.highMonths} month target window.`;
  }

  if (r.regionFlag) {
    const [from, to] = r.regionFlag === "shift_to_amped" ? ["Proper", "AMPED"] : ["AMPED", "Proper"];
    const transferNote = ` ${from} is sitting on more cover than ${to} needs — moving ~${formatNumber(
      r.suggestedTransferQty || 0
    )} units from ${from} to ${to} may cover this without pressing anything new.`;
    reasoning += transferNote;
    if (recommendation.startsWith("No repress needed") || recommendation.startsWith("No action")) {
      recommendation = `Move ~${formatNumber(r.suggestedTransferQty || 0)} units: ${from} → ${to}`;
    }
  }

  const onOrderNotes: string[] = [];
  if (r.properOnOrder > 0) onOrderNotes.push(`${formatNumber(r.properOnOrder)} at Proper`);
  if (r.ampedOnOrder > 0) onOrderNotes.push(`${formatNumber(r.ampedOnOrder)} at AMPED`);
  if (onOrderNotes.length) {
    reasoning += ` Note: ${onOrderNotes.join(" and ")} already on order — not counted above.`;
  }

  return { recommendation, reasoning };
}
