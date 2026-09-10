// src/components/ReportDocument.tsx
import type { ReactNode } from "react";
import type { CatalogueView, ConsolidatedRow, StockStatus, Thresholds } from "../types";
import StatusBadge from "./StatusBadge";
import { STATUS_STYLE } from "../lib/statusStyle";
import { formatMoney, formatNumber } from "../lib/format";

const VIEW_LABEL: Record<CatalogueView, string> = {
  combined: "Combined",
  frontline: "Frontline",
  catalogue: "Catalogue",
};

const STATUS_ORDER: StockStatus[] = ["stockout", "critical", "overstocked", "dormant", "healthy"];

function ReportKpi({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string;
  value: string;
  sublabel?: string;
  accent?: "critical" | "warning";
}) {
  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div
        className={`text-xl font-semibold mt-0.5 ${
          accent === "critical" ? "text-critical" : accent === "warning" ? "text-warning" : "text-slate-900"
        }`}
      >
        {value}
      </div>
      {sublabel && <div className="text-[10px] text-slate-400 mt-0.5">{sublabel}</div>}
    </div>
  );
}

function ReportSection({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-slate-800 border-b border-slate-300 pb-1 mb-1">{title}</h2>
      {note && <p className="text-[11px] text-slate-400 mb-2">{note}</p>}
      {children}
    </section>
  );
}

type TableVariant = "repress" | "overstock" | "rebalance" | "dormant";

function ReportTable({ rows, variant }: { rows: ConsolidatedRow[]; variant: TableVariant }) {
  if (!rows.length) {
    return <p className="text-xs text-slate-400 italic py-2">None — nothing to report in this section.</p>;
  }
  return (
    <table className="w-full text-[10.5px] border-collapse">
      <thead>
        <tr className="text-left text-slate-500 border-b border-slate-300">
          <th className="py-1 pr-2 font-medium">Status</th>
          <th className="py-1 pr-2 font-medium">Artist</th>
          <th className="py-1 pr-2 font-medium">Title</th>
          <th className="py-1 pr-2 font-medium">Format</th>
          <th className="py-1 pr-2 font-medium">Cat No</th>
          <th className="py-1 pr-2 font-medium text-right">Proper</th>
          <th className="py-1 pr-2 font-medium text-right">AMPED</th>
          <th className="py-1 pr-2 font-medium text-right">Combined</th>
          {variant !== "dormant" && <th className="py-1 pr-2 font-medium text-right">Units/mo</th>}
          {variant !== "dormant" && <th className="py-1 pr-2 font-medium text-right">Cover</th>}
          {variant === "repress" && <th className="py-1 pr-2 font-medium text-right">Repress qty</th>}
          {variant === "overstock" && (
            <>
              <th className="py-1 pr-2 font-medium text-right">Excess units</th>
              <th className="py-1 pr-2 font-medium text-right">Excess value</th>
            </>
          )}
          {variant === "rebalance" && (
            <>
              <th className="py-1 pr-2 font-medium text-left">Move</th>
              <th className="py-1 pr-2 font-medium text-right">Transfer qty</th>
            </>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.barcode}-${i}`} className="border-b border-slate-100 print:break-inside-avoid">
            <td className="py-1 pr-2">
              <StatusBadge status={r.status} />
            </td>
            <td className="py-1 pr-2">{r.artist}</td>
            <td className="py-1 pr-2">{r.title}</td>
            <td className="py-1 pr-2 text-slate-500">{r.format}</td>
            <td className="py-1 pr-2 text-slate-500">{r.catalogNo}</td>
            <td className="py-1 pr-2 text-right tabular-nums">{formatNumber(r.properStock)}</td>
            <td className="py-1 pr-2 text-right tabular-nums">
              {r.ampedMatched ? formatNumber(r.ampedStock) : "—"}
            </td>
            <td className="py-1 pr-2 text-right tabular-nums font-medium">{formatNumber(r.combinedStock)}</td>
            {variant !== "dormant" && (
              <td className="py-1 pr-2 text-right tabular-nums">{r.combinedVelocity.toFixed(1)}</td>
            )}
            {variant !== "dormant" && (
              <td className="py-1 pr-2 text-right tabular-nums">
                {r.monthsOfCover !== null ? `${r.monthsOfCover.toFixed(1)}mo` : "—"}
              </td>
            )}
            {variant === "repress" && (
              <td className="py-1 pr-2 text-right tabular-nums font-semibold text-serious">
                {r.suggestedRepressQty !== null ? formatNumber(r.suggestedRepressQty) : "—"}
              </td>
            )}
            {variant === "overstock" && (
              <>
                <td className="py-1 pr-2 text-right tabular-nums">
                  {r.excessUnits !== null ? formatNumber(r.excessUnits) : "—"}
                </td>
                <td className="py-1 pr-2 text-right tabular-nums font-semibold text-warning">
                  {r.excessValue ? formatMoney(r.excessValue) : "—"}
                </td>
              </>
            )}
            {variant === "rebalance" && (
              <>
                <td className="py-1 pr-2">
                  {r.regionFlag === "shift_to_amped" ? "Proper → AMPED" : "AMPED → Proper"}
                </td>
                <td className="py-1 pr-2 text-right tabular-nums font-semibold text-proper">
                  {r.suggestedTransferQty !== null ? formatNumber(r.suggestedTransferQty) : "—"}
                </td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface ReportDocumentProps {
  visible: boolean;
  view: CatalogueView;
  generatedAt: Date;
  thresholds: Thresholds;
  allRows: ConsolidatedRow[];
  repressRows: ConsolidatedRow[];
  rebalanceRows: ConsolidatedRow[];
  overstockRows: ConsolidatedRow[];
  dormantRows: ConsolidatedRow[];
  properFileName: string | null;
  properRowCount: number;
  ampedRowCount: number;
}

export default function ReportDocument({
  visible,
  view,
  generatedAt,
  thresholds,
  allRows,
  repressRows,
  rebalanceRows,
  overstockRows,
  dormantRows,
  properFileName,
  properRowCount,
  ampedRowCount,
}: ReportDocumentProps) {
  const totalUnits = allRows.reduce((sum, r) => sum + r.combinedStock, 0);
  const excessValueTotal = overstockRows.reduce((sum, r) => sum + (r.excessValue || 0), 0);
  const holdingCostTotal = overstockRows.reduce((sum, r) => sum + (r.excessHoldingCostPerMonth || 0), 0);
  const total = allRows.length || 1;
  const statusCounts = STATUS_ORDER.map((status) => ({
    status,
    count: allRows.filter((r) => r.status === status).length,
  }));

  return (
    <div className={`print-report ${visible ? "block" : "hidden"} print:block bg-white text-slate-900`}>
      <div className="max-w-4xl mx-auto p-8 print:p-0 print:max-w-none">
        <header className="mb-8 border-b border-slate-200 pb-6">
          <h1 className="text-2xl font-semibold">Stock Health Report</h1>
          <p className="text-sm text-slate-500 mt-1">
            Reservoir — combined Proper (UK &amp; ROW) &amp; AMPED (NA) sell-through
          </p>
          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-xs text-slate-500">
            <div>
              <strong className="text-slate-700">View:</strong> {VIEW_LABEL[view]} ({formatNumber(allRows.length)}{" "}
              titles)
            </div>
            <div>
              <strong className="text-slate-700">Generated:</strong>{" "}
              {generatedAt.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" })}
            </div>
            <div>
              <strong className="text-slate-700">Proper file:</strong> {properFileName || "—"} (
              {formatNumber(properRowCount)} rows)
            </div>
            <div>
              <strong className="text-slate-700">AMPED file:</strong> {formatNumber(ampedRowCount)} rows
            </div>
          </div>
        </header>

        <section className="mb-8 text-[13px] text-slate-600 leading-relaxed bg-slate-50 rounded-lg p-4 border border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800 mb-2">How to read this report</h2>
          <p>
            Every release is tracked at two distributors: <strong className="text-proper">Proper</strong> (UK &amp;
            Rest of World) and <strong className="text-amped">AMPED</strong> (North America). "Months of cover" is
            stock ÷ average monthly sales — how long the current stock would last at the recent sell-through rate.
            Titles below {thresholds.lowMonths} months are flagged to <strong>repress</strong>; above{" "}
            {thresholds.highMonths} months they're flagged as <strong>overstocked</strong> (stock that costs money to
            hold); the target range in between is this business's ideal window. A{" "}
            <strong>rebalance</strong> flag means one region is running low while the other has surplus — moving
            existing stock between them may resolve it faster than a repress, though it doesn't reduce the total
            repress need on its own. Combined sales below {thresholds.minMonthlyVelocity} units/month are treated as
            too thin to trust for an urgent call, and show as dormant instead.
          </p>
        </section>

        <section className="grid grid-cols-4 gap-4 mb-8">
          <ReportKpi label="Titles tracked" value={formatNumber(allRows.length)} />
          <ReportKpi label="Combined units in stock" value={formatNumber(totalUnits)} />
          <ReportKpi label="Needs repress" value={formatNumber(repressRows.length)} accent="critical" />
          <ReportKpi
            label="Overstocked"
            value={formatNumber(overstockRows.length)}
            accent="warning"
            sublabel={
              holdingCostTotal > 0
                ? `${formatMoney(holdingCostTotal)}/mo holding cost`
                : `${formatMoney(excessValueTotal)} tied up`
            }
          />
        </section>

        <section className="mb-10">
          <h2 className="text-sm font-semibold text-slate-800 mb-2">Portfolio health</h2>
          <div className="flex h-6 w-full rounded overflow-hidden gap-0.5">
            {statusCounts.map(({ status, count }) =>
              count > 0 ? (
                <div
                  key={status}
                  className={STATUS_STYLE[status].fill}
                  style={{ width: `${(count / total) * 100}%` }}
                />
              ) : null
            )}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-xs text-slate-600">
            {statusCounts.map(({ status, count }) => (
              <span key={status} className="inline-flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${STATUS_STYLE[status].fill}`} />
                {STATUS_STYLE[status].label}: {formatNumber(count)} ({Math.round((count / total) * 100)}%)
              </span>
            ))}
          </div>
        </section>

        <ReportSection
          title={`Needs repress (${repressRows.length})`}
          note="Combined cover is below the repress threshold, sorted soonest-to-sell-out first — includes titles already out of stock."
        >
          <ReportTable rows={repressRows} variant="repress" />
        </ReportSection>

        <ReportSection
          title={`Rebalance opportunities (${rebalanceRows.length})`}
          note="One region is low or out while the other has confirmed surplus, sorted by transfer quantity."
        >
          <ReportTable rows={rebalanceRows} variant="rebalance" />
        </ReportSection>

        <ReportSection
          title={`Overstocked — review holding (${overstockRows.length})`}
          note="Combined cover is above the target window, sorted by value tied up."
        >
          <ReportTable rows={overstockRows} variant="overstock" />
        </ReportSection>

        <ReportSection
          title={`Dormant — no recent sales (${dormantRows.length})`}
          note="No sales velocity to project a repress or rebalance from, sorted by stock held."
        >
          <ReportTable rows={dormantRows} variant="dormant" />
        </ReportSection>

        <footer className="mt-10 pt-4 border-t border-slate-200 text-[11px] text-slate-400">
          Generated by the Reservoir Stock Health Dashboard. Figures are a snapshot as of the uploaded reports above
          and are not updated automatically.
        </footer>
      </div>
    </div>
  );
}
