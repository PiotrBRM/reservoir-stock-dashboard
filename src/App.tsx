// src/App.tsx
import { useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, Archive, ArrowLeftRight, Boxes, OctagonAlert, PoundSterling } from "lucide-react";

import type { ConsolidatedRow, Thresholds } from "./types";
import { DEFAULT_THRESHOLDS } from "./types";
import { buildConsolidatedRows } from "./lib/consolidate";
import { readCSVFile, readExcelFile } from "./lib/fileReaders";
import { formatMoney, formatNumber } from "./lib/format";

import FileDropzone from "./components/FileDropzone";
import FileChip from "./components/FileChip";
import RegionTag from "./components/RegionTag";
import PortfolioHealthBar from "./components/PortfolioHealthBar";
import KpiCard from "./components/KpiCard";
import SettingsBar from "./components/SettingsBar";
import AlertTable from "./components/AlertTable";
import DetailTable from "./components/DetailTable";
import ReleaseDetailDrawer from "./components/ReleaseDetailDrawer";

export default function StockDashboard() {
  const [source1Data, setSource1Data] = useState<any[]>([]); // Proper CSV — UK & ROW
  const [source2Data, setSource2Data] = useState<any[]>([]); // AMPED XLSX — NA
  const [properFileName, setProperFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [selectedRow, setSelectedRow] = useState<ConsolidatedRow | null>(null);

  const handleFile = async (file: File | undefined, target: 1 | 2) => {
    if (!file) return;
    setError(null);
    try {
      const isExcel = /\.xlsx?$|\.xls$/i.test(file.name);
      const data = isExcel ? await readExcelFile(file) : await readCSVFile(file);
      if (target === 1) {
        setSource1Data(data);
        setProperFileName(file.name);
      } else {
        setSource2Data(data);
      }
    } catch (err) {
      setError(`Error loading ${file?.name || ""}: ${(err as Error).message || String(err)}`);
    }
  };

  // Recomputes automatically the instant both files are loaded or a setting changes.
  const consolidated = useMemo(() => {
    try {
      return buildConsolidatedRows(source1Data, source2Data, thresholds);
    } catch (err) {
      setError(`Error processing data: ${(err as Error).message || String(err)}`);
      return [];
    }
  }, [source1Data, source2Data, thresholds]);

  const hasResult = consolidated.length > 0;

  const kpis = useMemo(() => {
    const totalUnits = consolidated.reduce((sum, r) => sum + r.combinedStock, 0);
    const totalValue = consolidated.reduce((sum, r) => sum + r.stockValue, 0);
    const repressRows = consolidated.filter((r) => r.status === "critical" || r.status === "stockout");
    const overstockRows = consolidated.filter((r) => r.status === "overstocked");
    const rebalanceRows = consolidated.filter((r) => r.regionFlag !== null);
    const excessValue = overstockRows.reduce((sum, r) => sum + (r.excessValue || 0), 0);
    const monthlyHoldingCost = overstockRows.reduce((sum, r) => sum + (r.excessHoldingCostPerMonth || 0), 0);
    return { totalUnits, totalValue, repressRows, overstockRows, rebalanceRows, excessValue, monthlyHoldingCost };
  }, [consolidated]);

  const repressRows = useMemo(
    () => [...kpis.repressRows].sort((a, b) => (a.monthsOfCover ?? -1) - (b.monthsOfCover ?? -1)),
    [kpis.repressRows]
  );

  const overstockRows = useMemo(
    () => [...kpis.overstockRows].sort((a, b) => (b.excessValue || 0) - (a.excessValue || 0)),
    [kpis.overstockRows]
  );

  const rebalanceRows = useMemo(
    () => [...kpis.rebalanceRows].sort((a, b) => (b.suggestedTransferQty || 0) - (a.suggestedTransferQty || 0)),
    [kpis.rebalanceRows]
  );

  const dormantRows = useMemo(
    () => consolidated.filter((r) => r.status === "dormant").sort((a, b) => b.combinedStock - a.combinedStock),
    [consolidated]
  );

  const downloadExcel = async () => {
    if (!consolidated.length) return;
    const XLSX = await import("xlsx");
    const exportRows = consolidated.map((r) => ({
      Barcode: r.barcode,
      "Catalog No": r.catalogNo,
      Artist: r.artist,
      Title: r.title,
      "Release Date": r.releaseDate,
      Format: r.format,
      Status: r.status,
      "Proper Stock (UK/ROW)": r.properStock,
      "Proper Months Cover": r.properMonthsOfCover ?? "N/A",
      "Proper On Order": r.properOnOrder,
      "Proper Sales 3mo ago": r.properMonthlySales[2],
      "Proper Sales 2mo ago": r.properMonthlySales[1],
      "Proper Sales last mo": r.properMonthlySales[0],
      "AMPED Stock (NA)": r.ampedStock,
      "AMPED Months Cover": r.ampedMonthsOfCover ?? "N/A",
      "AMPED On Order": r.ampedOnOrder,
      "AMPED Avg Units/Week": r.ampedAvgMonthly ? Math.round((r.ampedAvgMonthly / 4.333) * 100) / 100 : 0,
      "Combined Stock": r.combinedStock,
      "Combined Units/Mo": r.combinedVelocity,
      "Combined Months of Cover": r.monthsOfCover ?? "N/A",
      "Unit Price (£)": r.unitPrice,
      "Stock Value (£)": r.stockValue,
      "Suggested Repress Qty": r.suggestedRepressQty ?? "",
      "Excess Units": r.excessUnits ?? "",
      "Excess Value (£)": r.excessValue ?? "",
      "Rebalance Suggestion": r.regionFlag ?? "",
      "Suggested Transfer Qty": r.suggestedTransferQty ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws["!cols"] = Object.keys(exportRows[0] || {}).map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Health Report");
    XLSX.writeFile(wb, `Stock_Health_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const properDetail = useMemo(() => {
    if (!source1Data.length || !properFileName) return undefined;
    const isProper = properFileName.includes("Basil-SupplierStockReport");
    const match = properFileName.match(/(\d{8})/);
    const warnings: string[] = [];
    if (!isProper) warnings.push("This file may not be a Proper stock report.");

    let formatted: string | null = null;
    if (match) {
      const rawDate = match[1];
      const year = rawDate.slice(0, 4);
      const month = rawDate.slice(4, 6);
      const day = rawDate.slice(6, 8);
      formatted = `${day}/${month}/${year}`;
      const fileDate = new Date(`${year}-${month}-${day}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (fileDate < today) warnings.push("This stock report is from a date prior to today.");
    }

    return (
      <div className="flex flex-col">
        <span>{formatted ? `${formatted} Proper report` : "Proper report loaded"}</span>
        {warnings.length > 0 && (
          <div className="mt-1 space-y-0.5">
            {warnings.map((msg, i) => (
              <span key={i} className="block text-[11px] text-critical">
                ⚠ {msg}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }, [source1Data.length, properFileName]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Stock Health Dashboard</h1>
            <p className="text-xs text-slate-500 mt-0.5">Reservoir — combined Proper &amp; AMPED sell-through</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-4 pr-4 border-r border-slate-200">
              <RegionTag region="proper" />
              <RegionTag region="amped" />
            </div>
            {hasResult && (
              <div className="flex items-center gap-2">
                <FileChip id="file1-chip" region="proper" accept=".csv" rowCount={source1Data.length} onFile={(f) => handleFile(f, 1)} />
                <FileChip id="file2-chip" region="amped" accept=".xlsx,.xls" rowCount={source2Data.length} onFile={(f) => handleFile(f, 2)} />
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-6 p-4 bg-critical-soft border border-critical/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-critical shrink-0" />
            <div className="text-sm text-critical">{error}</div>
          </div>
        )}

        {!hasResult && (
          <div className="max-w-3xl mx-auto mt-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-slate-900">Get started</h2>
              <p className="text-sm text-slate-500 mt-1">
                Drop in both stock reports — the dashboard builds itself the moment they're both loaded.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <FileDropzone
                id="file1"
                region="proper"
                accept=".csv"
                rowCount={source1Data.length}
                hint="Accepts .csv"
                detail={properDetail}
                onFile={(f) => handleFile(f, 1)}
              />
              <FileDropzone
                id="file2"
                region="amped"
                accept=".xlsx,.xls"
                rowCount={source2Data.length}
                hint="Accepts .xlsx / .xls"
                onFile={(f) => handleFile(f, 2)}
              />
            </div>
            {(source1Data.length > 0) !== (source2Data.length > 0) && (
              <div className="mt-6 p-4 bg-white border border-slate-200 rounded-lg text-sm text-slate-500 text-center">
                Waiting on the second file — one loaded so far.
              </div>
            )}
          </div>
        )}

        {hasResult && (
          <div className="flex flex-col gap-6">
            <PortfolioHealthBar rows={consolidated} />

            <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <KpiCard icon={Boxes} label="Titles tracked" value={formatNumber(consolidated.length)} />
              <KpiCard icon={Archive} label="Combined units in stock" value={formatNumber(kpis.totalUnits)} />
              <KpiCard
                icon={PoundSterling}
                label="Estimated stock value"
                value={formatMoney(kpis.totalValue)}
                sublabel="At Proper UK dealer price"
              />
              <KpiCard
                icon={OctagonAlert}
                label="Needs repress"
                value={formatNumber(kpis.repressRows.length)}
                sublabel={`< ${thresholds.lowMonths}mo cover`}
                accent="critical"
              />
              <KpiCard
                icon={AlertTriangle}
                label="Overstocked"
                value={formatNumber(kpis.overstockRows.length)}
                sublabel={
                  kpis.monthlyHoldingCost > 0
                    ? `${formatMoney(kpis.monthlyHoldingCost)}/mo holding cost`
                    : `${formatMoney(kpis.excessValue)} tied up`
                }
                accent="warning"
              />
            </section>

            <SettingsBar thresholds={thresholds} onChange={setThresholds} />

            <section className="grid gap-4">
              <AlertTable
                title="Needs repress"
                description="Combined cover is below the repress threshold — includes titles already out of stock."
                icon={OctagonAlert}
                accent="critical"
                variant="repress"
                rows={repressRows}
                thresholds={thresholds}
                emptyMessage="Nothing urgent — every title has enough cover."
                onSelect={setSelectedRow}
              />
              <AlertTable
                title="Rebalance opportunities"
                description="One region is low or out while the other is sitting on a surplus — stock may just need moving, not repressing."
                icon={ArrowLeftRight}
                accent="proper"
                variant="rebalance"
                rows={rebalanceRows}
                thresholds={thresholds}
                emptyMessage="No cross-region imbalances detected."
                onSelect={setSelectedRow}
              />
              <AlertTable
                title="Overstocked — review holding"
                description="Combined cover is above the target window — this stock is costing money to hold."
                icon={AlertTriangle}
                accent="warning"
                variant="overstock"
                rows={overstockRows}
                thresholds={thresholds}
                emptyMessage="No titles are holding excess stock right now."
                onSelect={setSelectedRow}
              />
              <AlertTable
                title="Dormant — no recent sales"
                description="Stock is sitting in the warehouse with no sales velocity to project from."
                icon={Archive}
                accent="slate"
                variant="dormant"
                rows={dormantRows}
                thresholds={thresholds}
                emptyMessage="No dormant stock."
                defaultVisible={5}
                onSelect={setSelectedRow}
              />
            </section>

            <DetailTable
              rows={consolidated}
              thresholds={thresholds}
              onDownload={downloadExcel}
              onSelect={setSelectedRow}
            />
          </div>
        )}
      </main>

      <ReleaseDetailDrawer row={selectedRow} thresholds={thresholds} onClose={() => setSelectedRow(null)} />
    </div>
  );
}
