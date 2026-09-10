// src/components/ReleaseDetailDrawer.tsx
import { X } from "lucide-react";
import type { ConsolidatedRow, Thresholds } from "../types";
import StatusBadge from "./StatusBadge";
import CoverMeter from "./CoverMeter";
import RegionTag from "./RegionTag";
import { explainRow } from "../lib/explain";
import { formatMoney, formatNumber } from "../lib/format";

function MonthlyBars({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-3 h-24">
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
          <span className="text-[11px] text-slate-500 tabular-nums">{formatNumber(v)}</span>
          <div className="w-full h-12 bg-slate-100 rounded-t-sm flex items-end overflow-hidden">
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
    return <div className="text-xs text-slate-400 italic h-24 flex items-center">No AMPED sales history available</div>;
  }
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-1 h-24 bg-slate-50 rounded-md p-2">
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

interface ReleaseDetailDrawerProps {
  row: ConsolidatedRow | null;
  thresholds: Thresholds;
  onClose: () => void;
}

export default function ReleaseDetailDrawer({ row, thresholds, onClose }: ReleaseDetailDrawerProps) {
  if (!row) return null;
  const { headline, math, action } = explainRow(row, thresholds);

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/30 z-40" onClick={onClose} />
      <aside className="fixed top-0 right-0 h-full w-full max-w-lg bg-white shadow-2xl z-50 overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-start justify-between gap-4 z-10">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 leading-snug truncate">{row.title}</h2>
            <p className="text-sm text-slate-500 truncate">{row.artist}</p>
            <p className="text-xs text-slate-400 mt-1">
              {row.format} · {row.catalogNo}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div>
            <StatusBadge status={row.status} />
            <p className="text-sm text-slate-700 mt-2 leading-relaxed">{headline}</p>
          </div>

          {action && (
            <div className="rounded-lg border border-proper/20 bg-proper-soft p-4">
              <div className="text-xs font-semibold text-proper mb-1 uppercase tracking-wide">Suggested action</div>
              <p className="text-sm text-slate-700 leading-relaxed">{action}</p>
            </div>
          )}

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">The math</h3>
            <div className="space-y-1.5 text-[13px] text-slate-600 font-mono bg-slate-50 rounded-lg p-3">
              {math.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              Your policy: repress below {thresholds.lowMonths}mo · overstocked above {thresholds.highMonths}mo ·
              restock target {thresholds.restockTargetMonths}mo
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-proper/20 p-4">
              <RegionTag region="proper" compact />
              <div className="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(row.properStock)}</div>
              <div className="text-xs text-slate-400">units in stock</div>
              <CoverMeter
                months={row.properMonthsOfCover}
                status={row.properStatus}
                thresholds={thresholds}
                className="mt-3"
              />
              {row.properOnOrder > 0 && (
                <div className="text-xs text-slate-500 mt-2">+{formatNumber(row.properOnOrder)} on order</div>
              )}
            </div>
            <div className="rounded-lg border border-amped/20 p-4">
              <RegionTag region="amped" compact />
              <div className="mt-2 text-2xl font-semibold text-slate-900">{formatNumber(row.ampedStock)}</div>
              <div className="text-xs text-slate-400">units in stock</div>
              <CoverMeter
                months={row.ampedMonthsOfCover}
                status={row.ampedStatus}
                thresholds={thresholds}
                className="mt-3"
              />
              {row.ampedOnOrder > 0 && (
                <div className="text-xs text-slate-500 mt-2">+{formatNumber(row.ampedOnOrder)} on order</div>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
              How much is this actually selling?
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-500 mb-1.5">Proper — last 3 months</div>
                <MonthlyBars
                  values={[row.properMonthlySales[2], row.properMonthlySales[1], row.properMonthlySales[0]]}
                  labels={["3mo ago", "2mo ago", "Last mo"]}
                />
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1.5">AMPED — last 8 weeks</div>
                <Sparkline values={row.ampedWeeklySales} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm border-t border-slate-100 pt-4">
            <div>
              <div className="text-xs text-slate-400">Unit price (Proper trade)</div>
              <div className="font-medium text-slate-800">{row.unitPrice ? formatMoney(row.unitPrice) : "—"}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Combined stock value</div>
              <div className="font-medium text-slate-800">{row.stockValue ? formatMoney(row.stockValue) : "—"}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
