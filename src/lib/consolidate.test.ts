import { describe, expect, it } from "vitest";
import { buildConsolidatedRows, classifyStatus } from "./consolidate";
import { DEFAULT_THRESHOLDS } from "../types";
import type { Thresholds } from "../types";

const T: Thresholds = DEFAULT_THRESHOLDS; // lowMonths 3, highMonths 6, restockTarget 6, minMonthlyVelocity 5

function properRow(overrides: Record<string, unknown> = {}) {
  return {
    barcode_apostrophe: "'0123456789012",
    CatNo: "CAT001",
    Artist: "TEST ARTIST",
    Title: "TEST TITLE",
    ReleaseDate: "2020-01-01",
    FormatCode: "LP",
    LabelName: "SOME LABEL",
    SubLabelName: "",
    StockOnHand: 100,
    Sales_LastMonth: 10,
    Sales_2MonthsAgo: 10,
    Sales_3MonthsAgo: 10,
    UKDealer: 10,
    OnOrder: 0,
    ...overrides,
  };
}

function ampedRow(overrides: Record<string, unknown> = {}) {
  return {
    "UPC Full": "0123456789012",
    "Catalog Num": "CAT001",
    Artist: "TEST ARTIST",
    Title: "TEST TITLE",
    QAV: 100,
    "Avg/Week": 2,
    QOO: 0,
    ...overrides,
  };
}

describe("classifyStatus", () => {
  it("is dormant when there's no velocity at all", () => {
    expect(classifyStatus(100, 0, T)).toBe("dormant");
  });

  it("is dormant (not stockout) when velocity is below the trust floor, even with 0 stock", () => {
    expect(classifyStatus(0, T.minMonthlyVelocity - 1, T)).toBe("dormant");
  });

  it("is stockout when velocity clears the floor and stock is 0", () => {
    expect(classifyStatus(0, T.minMonthlyVelocity, T)).toBe("stockout");
  });

  it("is dormant (not critical) when a low-cover ratio comes from below-floor velocity", () => {
    // stock=2, velocity=1 → 2 months (< lowMonths), but velocity is below the floor
    expect(classifyStatus(2, 1, T)).toBe("dormant");
  });

  it("is critical when a low-cover ratio comes from trusted velocity", () => {
    expect(classifyStatus(10, 10, T)).toBe("critical"); // 1 month, velocity 10 >= floor
  });

  it("is healthy inside the target window", () => {
    expect(classifyStatus(40, 10, T)).toBe("healthy"); // 4 months
  });

  it("is overstocked above the ceiling regardless of the velocity floor", () => {
    // Low velocity (below floor) but a huge pile of stock is still a genuine overstock signal.
    expect(classifyStatus(1000, 1, T)).toBe("overstocked");
  });
});

describe("buildConsolidatedRows — filtering", () => {
  it("excludes rows with an excluded label", () => {
    const rows = buildConsolidatedRows([properRow({ LabelName: "WARNER MUSIC" })], [ampedRow()], T);
    expect(rows).toHaveLength(0);
  });

  it("excludes rows with an excluded artist", () => {
    const rows = buildConsolidatedRows([properRow({ Artist: "DE LA SOUL" })], [ampedRow({ Artist: "DE LA SOUL" })], T);
    expect(rows).toHaveLength(0);
  });

  it("excludes NEW STATE — genuinely out of scope, not owned by any team", () => {
    const rows = buildConsolidatedRows([properRow({ LabelName: "NEW STATE" })], [ampedRow()], T);
    expect(rows).toHaveLength(0);
  });

  it.each([
    "TOMMY BOY RECORDS",
    "AMHERST RECORDS",
    "RESERVOIR RECORDINGS",
    "RAMBLIN' RECORDS",
    "EASY STREET RECORDS",
    "FOOL'S GOLD",
    "FREE GOODS",
    "NACIONAL",
    "PAINTED DESERT RECORDS",
    "PHILLY GROOVE RECORDS",
    "RASA MUSIC",
  ])("keeps Reservoir US label %s — no longer globally excluded now that a team owns it", (label) => {
    const rows = buildConsolidatedRows([properRow({ LabelName: label })], [ampedRow()], T);
    expect(rows).toHaveLength(1);
    expect(rows[0].labelName).toBe(label);
  });

  it("does not hide a title just because its name contains the word DELETED — only DeletionType decides that", () => {
    const rows = buildConsolidatedRows([properRow({ Title: "DELETED - TEST TITLE" })], [ampedRow()], T);
    expect(rows).toHaveLength(1);
  });

  it("hides a title with truly zero stock and zero sales everywhere", () => {
    const rows = buildConsolidatedRows(
      [properRow({ StockOnHand: 0, Sales_LastMonth: 0, Sales_2MonthsAgo: 0, Sales_3MonthsAgo: 0 })],
      [ampedRow({ QAV: 0, "Avg/Week": 0 })],
      T
    );
    expect(rows).toHaveLength(0);
  });

  it("keeps a title with zero stock everywhere but real velocity (a genuine stockout)", () => {
    const rows = buildConsolidatedRows(
      [properRow({ StockOnHand: 0, Sales_LastMonth: 20, Sales_2MonthsAgo: 20, Sales_3MonthsAgo: 20 })],
      [ampedRow({ QAV: 0, "Avg/Week": 0 })],
      T
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("stockout");
  });
});

describe("buildConsolidatedRows — negative stock", () => {
  it("clamps a negative Proper stock value to 0 instead of propagating it", () => {
    const rows = buildConsolidatedRows(
      [properRow({ StockOnHand: -2, Sales_LastMonth: 20, Sales_2MonthsAgo: 20, Sales_3MonthsAgo: 20 })],
      [ampedRow({ QAV: 0, "Avg/Week": 0 })],
      T
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].properStock).toBe(0);
    expect(rows[0].combinedStock).toBe(0);
    expect(rows[0].stockValue).toBe(0);
  });
});

describe("buildConsolidatedRows — AMPED match tracking", () => {
  it("marks ampedMatched false and skips rebalance when no AMPED record matches", () => {
    // Proper is critical, but there's no AMPED row for it at all — it must not
    // read as "AMPED has surplus, move stock there."
    const rows = buildConsolidatedRows(
      [
        properRow({
          barcode_apostrophe: "'9999999999999",
          CatNo: "NOMATCH",
          Artist: "NOBODY MATCHES THIS",
          Title: "UNMATCHED TITLE",
          StockOnHand: 5,
          Sales_LastMonth: 50,
          Sales_2MonthsAgo: 50,
          Sales_3MonthsAgo: 50,
        }),
      ],
      [ampedRow()], // unrelated AMPED row, won't match by UPC/catalog/artist+title
      T
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].ampedMatched).toBe(false);
    expect(rows[0].regionFlag).toBeNull();
  });

  it("does not fall back to AMPED's Inv Avail (a weeks-of-cover ratio, not a unit count) when QAV is blank", () => {
    const rows = buildConsolidatedRows(
      [properRow()],
      [ampedRow({ QAV: "", "Inv Avail": 284.4 })], // 284.4 is a weeks-of-cover figure in real AMPED exports
      T
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].ampedStock).toBe(0);
  });

  it("carries AMPED's Last PODate through as the repress-in-flight signal", () => {
    const rows = buildConsolidatedRows([properRow()], [ampedRow({ "Last PODate": "08/21/2026" })], T);
    expect(rows[0].ampedLastPODate).toBe("08/21/2026");
  });

  it("leaves ampedLastPODate blank when there's no AMPED match at all", () => {
    const rows = buildConsolidatedRows(
      [properRow({ barcode_apostrophe: "'9999999999999", CatNo: "NOMATCH", Artist: "NOBODY", Title: "NOBODY" })],
      [ampedRow({ "Last PODate": "08/21/2026" })], // unrelated row, won't match
      T
    );
    expect(rows[0].ampedMatched).toBe(false);
    expect(rows[0].ampedLastPODate).toBe("");
  });
});

describe("buildConsolidatedRows — repress quantity nets out inbound supply", () => {
  it("subtracts on-order units from the suggested repress quantity", () => {
    const withoutOnOrder = buildConsolidatedRows(
      [properRow({ StockOnHand: 0, Sales_LastMonth: 20, Sales_2MonthsAgo: 20, Sales_3MonthsAgo: 20, OnOrder: 0 })],
      [ampedRow({ QAV: 0, "Avg/Week": 0 })],
      T
    )[0];
    const withOnOrder = buildConsolidatedRows(
      [properRow({ StockOnHand: 0, Sales_LastMonth: 20, Sales_2MonthsAgo: 20, Sales_3MonthsAgo: 20, OnOrder: 50 })],
      [ampedRow({ QAV: 0, "Avg/Week": 0 })],
      T
    )[0];

    expect(withoutOnOrder.suggestedRepressQty).toBe(120); // 20/mo * 6mo target - 0 stock
    expect(withOnOrder.suggestedRepressQty).toBe(70); // same target, minus 50 already on order
  });

  it("never suggests a negative repress quantity when on-order covers the whole shortfall", () => {
    const row = buildConsolidatedRows(
      [properRow({ StockOnHand: 0, Sales_LastMonth: 20, Sales_2MonthsAgo: 20, Sales_3MonthsAgo: 20, OnOrder: 999 })],
      [ampedRow({ QAV: 0, "Avg/Week": 0 })],
      T
    )[0];
    expect(row.suggestedRepressQty).toBe(0);
  });
});

describe("buildConsolidatedRows — repress quantity splits across Proper/AMPED", () => {
  it("splits proportionally to each region's own deficit when both need stock", () => {
    const row = buildConsolidatedRows(
      [properRow({ StockOnHand: 0, Sales_LastMonth: 10, Sales_2MonthsAgo: 10, Sales_3MonthsAgo: 10 })],
      [ampedRow({ QAV: 0, "Avg/Week": 3 })], // ampedAvgMonthly = 3 * 4.333 ≈ 13/mo
      T
    )[0];
    expect(row.suggestedRepressQty).toBe(138); // (10 + 13) * 6mo target
    expect(row.suggestedRepressProperQty).toBe(60); // 10 * 6mo target, Proper's own deficit
    expect(row.suggestedRepressAmpedQty).toBe(78); // 13 * 6mo target, AMPED's own deficit
    expect((row.suggestedRepressProperQty ?? 0) + (row.suggestedRepressAmpedQty ?? 0)).toBe(row.suggestedRepressQty);
  });

  it("routes the whole repress quantity to Proper when AMPED has no distribution at all", () => {
    const row = buildConsolidatedRows(
      [properRow({ StockOnHand: 0, Sales_LastMonth: 20, Sales_2MonthsAgo: 20, Sales_3MonthsAgo: 20 })],
      [ampedRow({ QAV: 0, "Avg/Week": 0 })],
      T
    )[0];
    expect(row.suggestedRepressQty).toBe(120);
    expect(row.suggestedRepressProperQty).toBe(120);
    expect(row.suggestedRepressAmpedQty).toBe(0);
  });

  it("still routes the repress qty to Proper when AMPED's surplus reduced the combined total, not AMPED", () => {
    // AMPED sits on a 250-unit surplus with no sales — that surplus lowers the
    // combined repress figure, but the surplus itself lives at AMPED, not
    // Proper, so none of the *new* units being pressed should ship there.
    const row = buildConsolidatedRows(
      [properRow({ StockOnHand: 0, Sales_LastMonth: 100, Sales_2MonthsAgo: 100, Sales_3MonthsAgo: 100 })],
      [ampedRow({ QAV: 250, "Avg/Week": 0 })],
      T
    )[0];
    expect(row.status).toBe("critical"); // combined: 250 stock / 100 per month = 2.5mo cover
    expect(row.suggestedRepressQty).toBe(350); // 100*6 - 250 combined stock
    expect(row.suggestedRepressProperQty).toBe(350);
    expect(row.suggestedRepressAmpedQty).toBe(0);
  });
});

describe("buildConsolidatedRows — rebalance suggestion", () => {
  it("flags a transfer when one region is critical and the other has confirmed surplus", () => {
    const rows = buildConsolidatedRows(
      [properRow({ StockOnHand: 0, Sales_LastMonth: 200, Sales_2MonthsAgo: 200, Sales_3MonthsAgo: 200 })],
      [ampedRow({ QAV: 310, "Avg/Week": 0.23 })], // ~1/mo — heavily overstocked at AMPED
      T
    );
    const row = rows[0];
    expect(row.ampedMatched).toBe(true);
    expect(row.regionFlag).toBe("shift_to_proper");
    expect(row.suggestedTransferQty).toBeGreaterThan(0);
    // A transfer doesn't add stock to the system, so it must not reduce the repress figure.
    expect(row.suggestedRepressQty).toBeGreaterThan(0);
  });
});

describe("buildConsolidatedRows — deletion tracking", () => {
  it("excludes a deleted title once nothing remains in stock anywhere", () => {
    const rows = buildConsolidatedRows(
      [properRow({ DeletionType: 4, StockOnHand: 0, Sales_LastMonth: 0, Sales_2MonthsAgo: 0, Sales_3MonthsAgo: 0 })],
      [ampedRow({ QAV: 0, "Avg/Week": 0 })],
      T
    );
    expect(rows).toHaveLength(0);
  });

  it("keeps a deleted title while Proper still holds stock, forcing status to deleted regardless of velocity", () => {
    const rows = buildConsolidatedRows(
      [properRow({ DeletionType: 2, DeletedDate: "2023-12-12", StockOnHand: 5, Sales_LastMonth: 50, Sales_2MonthsAgo: 50, Sales_3MonthsAgo: 50 })],
      [ampedRow({ QAV: 0, "Avg/Week": 0 })],
      T
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("deleted");
    expect(rows[0].deletionType).toBe(2);
    expect(rows[0].deletedDate).toBe("2023-12-12");
    expect(rows[0].suggestedRepressQty).toBeNull();
  });

  it("keeps a deleted title while only AMPED still holds stock", () => {
    const rows = buildConsolidatedRows(
      [properRow({ DeletionType: 1, StockOnHand: 0, Sales_LastMonth: 0, Sales_2MonthsAgo: 0, Sales_3MonthsAgo: 0 })],
      [ampedRow({ QAV: 8, "Avg/Week": 0 })],
      T
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("deleted");
  });

  it("suppresses rebalance suggestions for deleted titles even with a region imbalance", () => {
    const rows = buildConsolidatedRows(
      [properRow({ DeletionType: 3, StockOnHand: 0, Sales_LastMonth: 200, Sales_2MonthsAgo: 200, Sales_3MonthsAgo: 200 })],
      [ampedRow({ QAV: 310, "Avg/Week": 0.23 })],
      T
    );
    expect(rows[0].status).toBe("deleted");
    expect(rows[0].regionFlag).toBeNull();
    expect(rows[0].suggestedTransferQty).toBeNull();
  });

  it("leaves a non-deleted title's status untouched (no DeletionType present)", () => {
    const rows = buildConsolidatedRows([properRow()], [ampedRow()], T);
    expect(rows[0].deletionType).toBeNull();
    expect(rows[0].status).not.toBe("deleted");
  });
});

describe("buildConsolidatedRows — expanded Frontline/Catalogue label sets", () => {
  it.each(["BUZZIN FLY RECORDS LTD", "TWO TONE RECORDS", "CHRYSALIS RECORDS"])(
    "keeps %s under its own labelName, unaffected by the exclusion list",
    (label) => {
      const rows = buildConsolidatedRows([properRow({ LabelName: label })], [ampedRow()], T);
      expect(rows).toHaveLength(1);
      expect(rows[0].labelName).toBe(label);
    }
  );

  it.each(["IDAHO RECORDS", "CHRYSALIS FRONTLINE"])("keeps %s under its own labelName", (label) => {
    const rows = buildConsolidatedRows([properRow({ LabelName: label })], [ampedRow()], T);
    expect(rows).toHaveLength(1);
    expect(rows[0].labelName).toBe(label);
  });
});
