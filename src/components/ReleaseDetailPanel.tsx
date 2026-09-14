// src/components/ReleaseDetailPanel.tsx
import type { ConsolidatedRow, Thresholds } from "../types";
import StatusBadge from "./StatusBadge";
import CoverMeter from "./CoverMeter";
import RegionTag from "./RegionTag";
import { explainRow } from "../lib/explain";
import { formatMoney, formatNumber } from "../lib/format";

function MonthlyBars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-2 h-20">
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
          <span className="text-[11px] text-slate-500 tabular-nums">{formatNumber(v)}</span>
          <div className="w-full h-10 bg-slate-100 rounded-t-sm flex items-end overflow-hidden">
            <div className="w-full bg-proper" style={{ height: `${Math.max(v > 0 ? 6 : 0, (v / max) * 100)}%` }} />
          </div>
          <span className="text-[10px] text-slate-400 whitespace-nowrap">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) {
    return <div className="text-xs text-slate-400 italic h-20 flex items-center">No AMPED sales history</div>;
  }
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-1 h-20 bg-slate-100 rounded-md p-1.5">
      {values.map((v, i) => (
        <div
          key={i}
          className="flex-1 bg-amped rounded-t-sm"
          style={{ height: `${Math.max(v > 0 ? 6 : 2, (v / max) * 100)}%` }}
          title={`${v} units`}
        />
      ))}
    </div>
  );
}

/** The recommendation + why behind a title's status. Rendered inline inside an expanded table row. */
export default function ReleaseDetailPanel({ row, thresholds }: { row: ConsolidatedRow; thresholds: Thresholds }) {
  const { recommendation, reasoning } = explainRow(row, thresholds);

  return (
    <div className="bg-slate-50/70 p-5 flex flex-col gap-4">
      <div className="rounded-lg border border-proper/20 bg-proper-soft p-3.5">
        <div className="flex items-center gap-2 mb-1">
          <StatusBadge status={row.status} />
          <span className="text-sm font-semibold text-slate-900">{recommendation}</span>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">{reasoning}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-proper/20 bg-white p-3">
          <RegionTag region="proper" />
          <div className="mt-1.5 text-xl font-semibold text-slate-900">{formatNumber(row.properStock)}</div>
          <div className="text-xs text-slate-400">units in stock</div>
          <CoverMeter months={row.properMonthsOfCover} status={row.properStatus} thresholds={thresholds} className="mt-2" />
          {row.properOnOrder > 0 && (
            <div className="text-xs text-slate-500 mt-1.5">+{formatNumber(row.properOnOrder)} on order</div>
          )}
        </div>
        <div className="rounded-lg border border-amped/20 bg-white p-3">
          <RegionTag region="amped" />
          {row.ampedMatched ? (
            <>
              <div className="mt-1.5 text-xl font-semibold text-slate-900">{formatNumber(row.ampedStock)}</div>
              <div className="text-xs text-slate-400">units in stock</div>
              <CoverMeter
                months={row.ampedMonthsOfCover}
                status={row.ampedStatus}
                thresholds={thresholds}
                className="mt-2"
              />
              {row.ampedOnOrder > 0 && (
                <div className="text-xs text-slate-500 mt-1.5">+{formatNumber(row.ampedOnOrder)} on order</div>
              )}
            </>
          ) : (
            <div className="mt-1.5 text-xs text-slate-400 italic leading-relaxed">
              No matching AMPED record found — likely not distributed via AMPED, rather than confirmed at 0.
            </div>
          )}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500 mb-1">Proper — last 3 months</div>
          <MonthlyBars
            values={[row.properMonthlySales[2], row.properMonthlySales[1], row.properMonthlySales[0]]}
            labels={["3mo ago", "2mo ago", "Last mo"]}
          />
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500 mb-1">AMPED — last 8 weeks</div>
          <Sparkline values={row.ampedWeeklySales} />
        </div>
      </div>

      <div className="flex gap-6 text-sm">
        <div>
          <div className="text-xs text-slate-400">Unit price</div>
          <div className="font-medium text-slate-800">{row.unitPrice ? formatMoney(row.unitPrice) : "—"}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">Stock value</div>
          <div className="font-medium text-slate-800">{row.stockValue ? formatMoney(row.stockValue) : "—"}</div>
        </div>
      </div>
    </div>
  );
}
