import { describe, expect, it } from "vitest";
import { explainRow } from "./explain";
import { DEFAULT_THRESHOLDS } from "../types";
import type { ConsolidatedRow } from "../types";

const T = DEFAULT_THRESHOLDS;

function row(overrides: Partial<ConsolidatedRow> = {}): ConsolidatedRow {
  return {
    barcode: "123",
    catalogNo: "CAT1",
    artist: "ARTIST",
    title: "TITLE",
    releaseDate: "",
    format: "LP",
    labelName: "",
    ampedMatched: true,
    properStock: 0,
    ampedStock: 0,
    combinedStock: 0,
    properAvgMonthly: 0,
    ampedAvgMonthly: 0,
    combinedVelocity: 0,
    monthsOfCover: null,
    unitPrice: 10,
    stockValue: 0,
    status: "dormant",
    suggestedRepressQty: null,
    excessUnits: null,
    excessValue: null,
    excessHoldingCostPerMonth: null,
    properStatus: "dormant",
    ampedStatus: "dormant",
    properMonthsOfCover: null,
    ampedMonthsOfCover: null,
    regionFlag: null,
    suggestedTransferQty: null,
    properMonthlySales: [0, 0, 0],
    properOnOrder: 0,
    ampedWeeklySales: [],
    ampedOnOrder: 0,
    ...overrides,
  };
}

describe("explainRow", () => {
  it("recommends a repress with the exact suggested quantity for a critical title", () => {
    const r = row({ status: "critical", combinedVelocity: 20, combinedStock: 10, monthsOfCover: 0.5, suggestedRepressQty: 110 });
    const { recommendation } = explainRow(r, T);
    expect(recommendation).toBe("Repress 110 units");
  });

  it("notes on-order stock as already reflected when a repress is recommended", () => {
    const r = row({
      status: "critical",
      combinedVelocity: 20,
      combinedStock: 10,
      monthsOfCover: 0.5,
      suggestedRepressQty: 60,
      properOnOrder: 50,
    });
    const { reasoning } = explainRow(r, T);
    expect(reasoning).toMatch(/already reflected in the repress figure/);
  });

  it("does not subtract a rebalance transfer from the repress recommendation, and says so", () => {
    const r = row({
      status: "critical",
      combinedVelocity: 20,
      combinedStock: 10,
      monthsOfCover: 0.5,
      suggestedRepressQty: 110,
      regionFlag: "shift_to_proper",
      suggestedTransferQty: 40,
    });
    const { recommendation, reasoning } = explainRow(r, T);
    expect(recommendation).toBe("Repress 110 units"); // unchanged by the transfer
    expect(reasoning).toMatch(/repress number above still stands/);
  });

  it("recommends a transfer (not a repress) when only a rebalance applies", () => {
    const r = row({ status: "healthy", combinedVelocity: 10, combinedStock: 50, monthsOfCover: 5, regionFlag: "shift_to_amped", suggestedTransferQty: 30 });
    const { recommendation } = explainRow(r, T);
    expect(recommendation).toMatch(/^Move ~30 units: Proper → AMPED/);
  });

  it("distinguishes low-volume dormant from genuinely no-sales dormant", () => {
    const noSales = explainRow(row({ status: "dormant", combinedVelocity: 0 }), T);
    expect(noSales.recommendation).toMatch(/no recent sales/);

    const tooLow = explainRow(row({ status: "dormant", combinedVelocity: 2 }), T);
    expect(tooLow.recommendation).toMatch(/too low to trust/);
  });
});
