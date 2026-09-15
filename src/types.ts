// src/types.ts

export type StockStatus = "stockout" | "critical" | "healthy" | "overstocked" | "dormant" | "deleted";

/**
 * One sub-tab within a team's view (e.g. "Frontline") and the Proper
 * LabelName values that belong to it. A team's "Combined" tab isn't listed
 * here — it's always the union of the team's own views, computed at
 * runtime, so it never drifts out of sync with them.
 */
export interface TeamView {
  id: string;
  label: string;
  labelNames: string[];
}

/**
 * A distinct group of people who use this tool, each with their own label
 * taxonomy carved out of the same underlying Proper/AMPED upload — teams
 * don't get separate file uploads, just a different filter on top.
 */
export interface Team {
  id: string;
  label: string;
  views: TeamView[];
}

export const TEAMS: Team[] = [
  {
    id: "chrysalis",
    label: "Chrysalis Records",
    views: [
      { id: "frontline", label: "Frontline", labelNames: ["CHRYSALIS FRONTLINE", "IDAHO RECORDS"] },
      {
        id: "catalogue",
        label: "Catalogue",
        labelNames: ["CHRYSALIS RECORDS", "BUZZIN FLY RECORDS LTD", "TWO TONE RECORDS"],
      },
    ],
  },
  {
    id: "reservoir_us",
    label: "Reservoir US",
    views: [
      { id: "tommy_boy_records", label: "Tommy Boy Records", labelNames: ["TOMMY BOY RECORDS"] },
      { id: "amherst_records", label: "Amherst Records", labelNames: ["AMHERST RECORDS"] },
      { id: "reservoir_recordings", label: "Reservoir Recordings", labelNames: ["RESERVOIR RECORDINGS"] },
      { id: "ramblin_records", label: "Ramblin' Records", labelNames: ["RAMBLIN' RECORDS"] },
      { id: "easy_street_records", label: "Easy Street Records", labelNames: ["EASY STREET RECORDS"] },
      { id: "fools_gold", label: "Fool's Gold", labelNames: ["FOOL'S GOLD"] },
      { id: "free_goods", label: "Free Goods", labelNames: ["FREE GOODS"] },
      { id: "nacional", label: "Nacional", labelNames: ["NACIONAL"] },
      { id: "painted_desert_records", label: "Painted Desert Records", labelNames: ["PAINTED DESERT RECORDS"] },
      { id: "philly_groove_records", label: "Philly Groove Records", labelNames: ["PHILLY GROOVE RECORDS"] },
      { id: "rasa_music", label: "Rasa Music", labelNames: ["RASA MUSIC"] },
    ],
  },
];

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
  /**
   * How suggestedRepressQty splits across the two distributors, based on each
   * region's own deficit against the restock target — a repress run is one
   * manufacturing batch, but Proper and AMPED are separate warehouses that
   * need their own shipment split. Both null exactly when suggestedRepressQty
   * is null; otherwise they always sum to it.
   */
  suggestedRepressProperQty: number | null;
  suggestedRepressAmpedQty: number | null;
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
  /** AMPED's "Last PODate" — the last time a repress actually shipped. Empty string if unknown/no AMPED match. */
  ampedLastPODate: string;

  /**
   * Proper's DeletionType code (1-4), or null if this title isn't deleted.
   * When set, `status` is always "deleted" — repress/rebalance suggestions
   * don't apply regardless of what the stock/velocity math would otherwise say.
   */
  deletionType: 1 | 2 | 3 | 4 | null;
  /** Date Proper marked this deleted, if known. */
  deletedDate: string;
}
