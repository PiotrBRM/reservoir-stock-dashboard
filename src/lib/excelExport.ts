// src/lib/excelExport.ts
//
// Single source of truth for turning ConsolidatedRows into an .xlsx workbook —
// used for the "All titles" export, each section's standalone spreadsheet, and
// the full multi-tab report, so the column schema never drifts between them.
import type { ConsolidatedRow } from "../types";
import { DELETION_TYPE_META } from "./deletionType";

function toExportRow(r: ConsolidatedRow) {
  return {
    Barcode: r.barcode,
    "Catalog No": r.catalogNo,
    Artist: r.artist,
    Title: r.title,
    "Release Date": r.releaseDate,
    Format: r.format,
    Status: r.status,
    "Proper Stock": r.properStock,
    "Proper Months Cover": r.properMonthsOfCover ?? "N/A",
    "Proper On Order": r.properOnOrder,
    "Proper Sales 3mo ago": r.properMonthlySales[2],
    "Proper Sales 2mo ago": r.properMonthlySales[1],
    "Proper Sales last mo": r.properMonthlySales[0],
    "AMPED Stock": r.ampedStock,
    "AMPED Months Cover": r.ampedMonthsOfCover ?? "N/A",
    "AMPED On Order": r.ampedOnOrder,
    "AMPED Avg Units/Week": r.ampedAvgMonthly ? Math.round((r.ampedAvgMonthly / 4.333) * 100) / 100 : 0,
    "Combined Stock": r.combinedStock,
    "Combined Units/Mo": r.combinedVelocity,
    "Combined Months of Cover": r.monthsOfCover ?? "N/A",
    "Unit Price (£)": r.unitPrice,
    "Stock Value (£)": r.stockValue,
    "Suggested Repress Qty": r.suggestedRepressQty ?? "",
    "Suggested Repress — Proper": r.suggestedRepressProperQty ?? "",
    "Suggested Repress — AMPED": r.suggestedRepressAmpedQty ?? "",
    "Excess Units": r.excessUnits ?? "",
    "Excess Value (£)": r.excessValue ?? "",
    "Rebalance Suggestion": r.regionFlag ?? "",
    "Suggested Transfer Qty": r.suggestedTransferQty ?? "",
    "Deletion Type": r.deletionType ? DELETION_TYPE_META[r.deletionType].label : "",
    "Deleted Date": r.deletedDate || "",
  };
}

// Excel sheet names: max 31 chars, and can't contain \ / ? * [ ] :
function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, "").trim();
  return cleaned.slice(0, 31) || "Sheet";
}

export function dateStamp(): string {
  return new Date().toISOString().split("T")[0];
}

export interface ExportSheet {
  name: string;
  rows: ConsolidatedRow[];
}

/** Builds and downloads a workbook with one sheet per entry in `sheets`. */
export async function downloadSpreadsheet(filename: string, sheets: ExportSheet[]) {
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  for (const { name, rows } of sheets) {
    const data = rows.length ? rows.map(toExportRow) : [{ Note: "No titles in this section." }];
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = Object.keys(data[0]).map(() => ({ wch: 20 }));

    let sheetName = sanitizeSheetName(name);
    let suffix = 2;
    while (usedNames.has(sheetName)) {
      sheetName = sanitizeSheetName(`${name} ${suffix}`);
      suffix += 1;
    }
    usedNames.add(sheetName);

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  XLSX.writeFile(wb, filename);
}
