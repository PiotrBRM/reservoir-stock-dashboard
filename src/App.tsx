// src/App.tsx
import { useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, Archive, ArrowLeftRight, Boxes, FileDown, OctagonAlert } from "lucide-react";

import type { CatalogueView, Thresholds } from "./types";
import { DEFAULT_THRESHOLDS, VIEW_LABEL_NAME } from "./types";
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

const VIEW_LABEL: Record<CatalogueView, string> = {
  combined: "Combined",
  frontline: "Frontline",
  catalogue: "Catalogue",
};

export default function StockDashboard() {
  const [source1Data, setSource1Data] = useState<any[]>([]); // Proper CSV — UK & ROW
  const [source2Data, setSource2Data] = useState<any[]>([]); // AMPED XLSX — NA
  const [properFileName, setProperFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [view, setView] = useState<CatalogueView>("combined");
  const [generatingReport, setGeneratingReport] = useState(false);

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

  const viewCounts = useMemo(
    () => ({
      combined: consolidated.length,
      frontline: consolidated.filter((r) => r.labelName === VIEW_LABEL_NAME.frontline).length,
      catalogue: consolidated.filter((r) => r.labelName === VIEW_LABEL_NAME.catalogue).length,
    }),
    [consolidated]
  );

  // The active view scopes everything below it — KPIs, alerts, and the detail table.
  const viewRows = useMemo(() => {
    if (view === "combined") return consolidated;
    return consolidated.filter((r) => r.labelName === VIEW_LABEL_NAME[view]);
  }, [consolidated, view]);

  const kpis = useMemo(() => {
    const totalUnits = viewRows.reduce((sum, r) => sum + r.combinedStock, 0);
    const repressRows = viewRows.filter((r) => r.status === "critical" || r.status === "stockout");
    const overstockRows = viewRows.filter((r) => r.status === "overstocked");
    const rebalanceRows = viewRows.filter((r) => r.regionFlag !== null);
    const excessValue = overstockRows.reduce((sum, r) => sum + (r.excessValue || 0), 0);
    const monthlyHoldingCost = overstockRows.reduce((sum, r) => sum + (r.excessHoldingCostPerMonth || 0), 0);
    return { totalUnits, repressRows, overstockRows, rebalanceRows, excessValue, monthlyHoldingCost };
  }, [viewRows]);

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
    () => viewRows.filter((r) => r.status === "dormant").sort((a, b) => b.combinedStock - a.combinedStock),
    [viewRows]
  );

  const downloadExcel = async () => {
    if (!viewRows.length) return;
    const XLSX = await import("xlsx");
    const exportRows = viewRows.map((r) => ({
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
      "Excess Units": r.excessUnits ?? "",
      "Excess Value (£)": r.excessValue ?? "",
      "Rebalance Suggestion": r.regionFlag ?? "",
      "Suggested Transfer Qty": r.suggestedTransferQty ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws["!cols"] = Object.keys(exportRows[0] || {}).map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock Health Report");
    XLSX.writeFile(wb, `Stock_Health_Report_${VIEW_LABEL[view]}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const downloadReport = async () => {
    if (!viewRows.length || generatingReport) return;
    setGeneratingReport(true);
    setError(null);
    try {
      const [{ pdf }, { ReportPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./lib/reportPdf"),
      ]);
      const blob = await pdf(
        <ReportPdfDocument
          view={view}
          generatedAt={new Date()}
          thresholds={thresholds}
          allRows={viewRows}
          repressRows={repressRows}
          rebalanceRows={rebalanceRows}
          overstockRows={overstockRows}
          dormantRows={dormantRows}
          properFileName={properFileName}
          properRowCount={source1Data.length}
          ampedRowCount={source2Data.length}
        />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Stock_Health_Report_${VIEW_LABEL[view]}_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Error generating report: ${(err as Error).message || String(err)}`);
    } finally {
      setGeneratingReport(false);
    }
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
                <button
                  onClick={downloadReport}
                  disabled={generatingReport}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  title="Download a standalone PDF report — safe to email to anyone"
                >
                  {generatingReport ? (
                    <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                  ) : (
                    <FileDown className="w-3.5 h-3.5" />
                  )}
                  {generatingReport ? "Generating…" : "Download report (PDF)"}
                </button>
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
            <div className="inline-flex items-center gap-1 rounded-lg bg-slate-200/60 p-1 self-start">
              {(Object.keys(VIEW_LABEL) as CatalogueView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    view === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {VIEW_LABEL[v]}
                  <span className="ml-1.5 text-xs text-slate-400 tabular-nums">{viewCounts[v]}</span>
                </button>
              ))}
            </div>

            <PortfolioHealthBar rows={viewRows} />

            <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard icon={Boxes} label="Titles tracked" value={formatNumber(viewRows.length)} />
              <KpiCard icon={Archive} label="Combined units in stock" value={formatNumber(kpis.totalUnits)} />
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
              />
            </section>

            <DetailTable
              rows={viewRows}
              thresholds={thresholds}
              onDownload={downloadExcel}
            />
          </div>
        )}
      </main>
    </div>
  );
}
