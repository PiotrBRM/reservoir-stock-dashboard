// src/types.ts

export type StockStatus = "stockout" | "critical" | "healthy" | "overstocked" | "dormant";

export type CatalogueView = "combined" | "frontline" | "catalogue";

/** Proper LabelName values that define the Frontline / Catalogue split. */
export const VIEW_LABEL_NAME: Record<Exclude<CatalogueView, "combined">, string> = {
  frontline: "CHRYSALIS FRONTLINE",
  catalogue: "CHRYSALIS RECORDS",
};

export interface Thresholds {
  /** Below this many months of cover, a title is flagged for repress. */
  lowMonths: number;
  /** Above this many months of cover, a title is flagged as overstocked. */
  highMonths: number;
  /** When suggesting a repress quantity, restock up to this many months of cover. */
  restockTargetMonths: number;
  /** Optional estimated cost (£) to hold one unit in stock for one month. 0 = unknown/disabled. */
  holdingCostPerUnitPerMonth: number;
  /** Below this many combined units/month, a low-cover result is too noisy to flag as urgent. */
  minMonthlyVelocity: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  lowMonths: 3,
  highMonths: 6,
  restockTargetMonths: 6,
  holdingCostPerUnitPerMonth: 0,
  minMonthlyVelocity: 5,
};

export interface ConsolidatedRow {
  barcode: string;
  catalogNo: string;
  artist: string;
  title: string;
  releaseDate: string;
  format: string;
  /** Proper's LabelName field — drives the Frontline/Catalogue view split. */
  labelName: string;
  /** False means no AMPED record was found for this title at all — distinct from a confirmed 0. */
  ampedMatched: boolean;

  properStock: number;
  ampedStock: number;
  combinedStock: number;

  properAvgMonthly: number;
  ampedAvgMonthly: number;
  combinedVelocity: number;

  /** null when there is no sales velocity to project from. */
  monthsOfCover: number | null;

  /** Proper UK dealer (trade) price per unit, in GBP. 0 if unknown. */
  unitPrice: number;
  /** combinedStock * unitPrice */
  stockValue: number;

  status: StockStatus;
  /** Units to reorder to reach the restock target. Only set for stockout/critical rows. */
  suggestedRepressQty: number | null;
  /** Units held beyond the overstock threshold. Only set for overstocked rows. */
  excessUnits: number | null;
  /** excessUnits * unitPrice */
  excessValue: number | null;
  /** excessUnits * holdingCostPerUnitPerMonth, when a holding cost is configured. */
  excessHoldingCostPerMonth: number | null;

  /** Proper's and AMPED's stock health, considered independently (Proper = UK & ROW, AMPED = NA). */
  properStatus: StockStatus;
  ampedStatus: StockStatus;
  properMonthsOfCover: number | null;
  ampedMonthsOfCover: number | null;

  /** Set when one region is running low/out while the other is sitting on a surplus. */
  regionFlag: "shift_to_proper" | "shift_to_amped" | null;
  /** Units worth physically transferring between distributors to fix the imbalance. */
  suggestedTransferQty: number | null;

  /** Raw inputs behind the averages, so the detail view can show its working. */
  properMonthlySales: [number, number, number]; // [last month, 2 months ago, 3 months ago]
  properOnOrder: number;
  /** Last 8 weeks at AMPED, oldest first. */
  ampedWeeklySales: number[];
  ampedOnOrder: number;
}
