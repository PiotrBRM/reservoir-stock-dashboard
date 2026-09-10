// src/lib/fileReaders.ts
import Papa from "papaparse";

// xlsx is a large library — load it on demand instead of in the initial bundle,
// since most page loads never touch an Excel file until one is uploaded.

export const readCSVFile = (file: File) =>
  new Promise<any[]>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      Papa.parse<any>(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => resolve(results.data || []),
        error: (err: unknown) => reject(err),
      });
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });

// Excel reader with smart header detection (works for both AMPED layouts)
export const readExcelFile = (file: File) =>
  new Promise<any[]>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import("xlsx");
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Peek rows to find header row (Inventory Analysis puts it deeper)
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          raw: false,
          defval: "",
        }) as any[][];
        let headerIndex = 0;

        const headerMustHave = [
          ["UPC", "UPC/EAN", "UPC Full", "UPC Code"],
          ["Catalog Num", "Catalog No", "CatalogNo", "Item Code", "Item Number"],
          ["QAV", "Inv Avail", "Inventory Available", "Inventory Qty Available", "QOH", "Qty", "Quantity"],
        ];

        for (let i = 0; i < Math.min(rows.length, 100); i++) {
          const r = (rows[i] || []).map((x) => String(x).trim());
          const hasAllGroups = headerMustHave.every((alts) => alts.some((alt) => r.includes(alt)));
          const hasSalesWeekHints =
            r.includes("Avg/Week") || r.includes("Weekly Avg") || r.includes("CurWeek") || r.includes("Cur Week");
          if (hasAllGroups || (hasSalesWeekHints && r.includes("Inv Avail"))) {
            headerIndex = i;
            break;
          }
        }

        let jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: "", range: headerIndex });

        // Fallback: if bogus keys, skip first line after headerIndex
        if (jsonData.length > 0) {
          const keys = Object.keys(jsonData[0] || {});
          const hasBad = keys.some((k) => k === "" || k.startsWith("_") || k.startsWith("__EMPTY"));
          if (hasBad) {
            jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: "", range: headerIndex + 1 });
          }
        }

        resolve(jsonData || []);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
