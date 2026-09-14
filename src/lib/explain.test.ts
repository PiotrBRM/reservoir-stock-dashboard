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
    suggestedRepressProperQty: null,
    suggestedRepressAmpedQty: null,
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
    deletionType: null,
    deletedDate: "",
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

  it("states which region(s) a repress quantity should ship to", () => {
    const both = explainRow(
      row({
        status: "critical",
        combinedVelocity: 20,
        combinedStock: 10,
        monthsOfCover: 0.5,
        suggestedRepressQty: 110,
        suggestedRepressProperQty: 60,
        suggestedRepressAmpedQty: 50,
      }),
      T
    );
    expect(both.recommendation).toBe("Repress 110 units (60 to Proper, 50 to AMPED)");
    expect(both.reasoning).toMatch(/110 units \(60 to Proper, 50 to AMPED\) would bring/);

    const properOnly = explainRow(
      row({
        status: "stockout",
        combinedVelocity: 20,
        combinedStock: 0,
        suggestedRepressQty: 120,
        suggestedRepressProperQty: 120,
        suggestedRepressAmpedQty: 0,
      }),
      T
    );
    expect(properOnly.recommendation).toBe("Repress 120 units (all to Proper)");
  });

  it("distinguishes low-volume dormant from genuinely no-sales dormant", () => {
    const noSales = explainRow(row({ status: "dormant", combinedVelocity: 0 }), T);
    expect(noSales.recommendation).toMatch(/no recent sales/);

    const tooLow = explainRow(row({ status: "dormant", combinedVelocity: 2 }), T);
    expect(tooLow.recommendation).toMatch(/too low to trust/);
  });

  it("describes a deleted title by its deletion type and remaining stock, not repress math", () => {
    const sellable = explainRow(
      row({ status: "deleted", deletionType: 2, deletedDate: "2023-12-12", combinedStock: 5 }),
      T
    );
    expect(sellable.recommendation).toMatch(/sell through/i);
    expect(sellable.reasoning).toMatch(/2023-12-12/);
    expect(sellable.reasoning).toMatch(/can sell — returning to label/i);

    const unsellable = explainRow(row({ status: "deleted", deletionType: 4, combinedStock: 14 }), T);
    expect(unsellable.recommendation).not.toMatch(/^Repress/i);
    expect(unsellable.reasoning).toMatch(/cannot sell — not returning to label/i);
  });
});
