// src/components/AlertTable.tsx
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, ChevronDown, ChevronRight, ChevronUp } from "lucide-react";
import type { ConsolidatedRow } from "../types";
import type { Thresholds } from "../types";
import StatusBadge from "./StatusBadge";
import CoverMeter from "./CoverMeter";
import RegionBars from "./RegionBars";
import { formatMoney, formatNumber } from "../lib/format";

type Variant = "repress" | "overstock" | "dormant" | "rebalance";

interface AlertTableProps {
  title: string;
  description: string;
  icon: LucideIcon;
  accent: "critical" | "warning" | "slate" | "proper";
  rows: ConsolidatedRow[];
  variant: Variant;
  thresholds: Thresholds;
  emptyMessage: string;
  defaultVisible?: number;
  onSelect: (row: ConsolidatedRow) => void;
}

const ACCENT_HEADER: Record<AlertTableProps["accent"], string> = {
  critical: "text-critical",
  warning: "text-warning",
  slate: "text-slate-600",
  proper: "text-proper",
};

export default function AlertTable({
  title,
  description,
  icon: Icon,
  accent,
  rows,
  variant,
  thresholds,
  emptyMessage,
  defaultVisible = 6,
  onSelect,
}: AlertTableProps) {
  const [expanded, setExpanded] = useState(false);
  const visibleRows = expanded ? rows : rows.slice(0, defaultVisible);
  const hasMore = rows.length > defaultVisible;

  return (
    <section className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100">
        <div className={`flex items-center gap-2 font-semibold text-sm ${ACCENT_HEADER[accent]}`}>
          <Icon className="w-4 h-4" />
          {title}
          <span className="text-slate-400 font-normal">({rows.length})</span>
        </div>
        <p className="text-xs text-slate-400 mt-0.5 ml-6">{description}</p>
      </div>

      {rows.length === 0 ? (
        <div className="px-5 py-6 text-sm text-slate-400 italic">{emptyMessage}</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                  <th className="px-4 py-2 text-left font-medium">Release</th>
                  <th className="px-4 py-2 text-left font-medium">Format</th>
                  <th className="px-4 py-2 text-left font-medium">Proper (UK/ROW) vs AMPED (NA)</th>
                  {variant !== "dormant" && <th className="px-4 py-2 text-left font-medium">Combined cover</th>}
                  {variant === "repress" && <th className="px-4 py-2 text-right font-medium">Suggested repress</th>}
                  {variant === "overstock" && (
                    <>
                      <th className="px-4 py-2 text-right font-medium">Excess units</th>
                      <th className="px-4 py-2 text-right font-medium">Excess value</th>
                    </>
                  )}
                  {variant === "rebalance" && (
                    <>
                      <th className="px-4 py-2 text-left font-medium">Move</th>
                      <th className="px-4 py-2 text-right font-medium">Suggested transfer</th>
                    </>
                  )}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r, i) => (
                  <tr
                    key={`${r.barcode}-${i}`}
                    onClick={() => onSelect(r)}
                    className={`cursor-pointer hover:bg-slate-100/80 ${i % 2 ? "bg-slate-50/60" : "bg-white"}`}
                  >
                    <td className="px-4 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium text-slate-800 truncate max-w-[14rem]">{r.title}</div>
                      <div className="text-xs text-slate-400 truncate max-w-[14rem]">{r.artist}</div>
                    </td>
                    <td className="px-4 py-2 text-slate-500">{r.format}</td>
                    <td className="px-4 py-2">
                      <RegionBars
                        properStock={r.properStock}
                        ampedStock={r.ampedStock}
                        properStatus={r.properStatus}
                        ampedStatus={r.ampedStatus}
                        showValues={false}
                      />
                    </td>
                    {variant !== "dormant" && (
                      <td className="px-4 py-2">
                        <CoverMeter
                          months={r.monthsOfCover}
                          status={r.status}
                          thresholds={thresholds}
                          className="w-40"
                        />
                      </td>
                    )}
                    {variant === "repress" && (
                      <td className="px-4 py-2 text-right font-semibold text-serious tabular-nums">
                        {r.suggestedRepressQty !== null ? formatNumber(r.suggestedRepressQty) : "—"}
                      </td>
                    )}
                    {variant === "overstock" && (
                      <>
                        <td className="px-4 py-2 text-right tabular-nums">
                          {r.excessUnits !== null ? formatNumber(r.excessUnits) : "—"}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-warning tabular-nums">
                          {r.excessValue ? formatMoney(r.excessValue) : "—"}
                        </td>
                      </>
                    )}
                    {variant === "rebalance" && (
                      <>
                        <td className="px-4 py-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                            <span className={r.regionFlag === "shift_to_amped" ? "text-proper" : "text-amped"}>
                              {r.regionFlag === "shift_to_amped" ? "Proper" : "AMPED"}
                            </span>
                            <ArrowRight className="w-3 h-3 text-slate-400" />
                            <span className={r.regionFlag === "shift_to_amped" ? "text-amped" : "text-proper"}>
                              {r.regionFlag === "shift_to_amped" ? "AMPED" : "Proper"}
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-proper tabular-nums">
                          {r.suggestedTransferQty !== null ? formatNumber(r.suggestedTransferQty) : "—"}
                        </td>
                      </>
                    )}
                    <td className="px-2 py-2 text-slate-300">
                      <ChevronRight className="w-4 h-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full flex items-center justify-center gap-1 py-2 text-xs text-slate-500 hover:bg-slate-50 border-t border-slate-100"
            >
              {expanded ? (
                <>
                  Show fewer <ChevronUp className="w-3.5 h-3.5" />
                </>
              ) : (
                <>
                  Show all {rows.length} <ChevronDown className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          )}
        </>
      )}
    </section>
  );
}
