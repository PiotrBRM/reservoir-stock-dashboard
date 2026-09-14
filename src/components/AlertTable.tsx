// src/components/AlertTable.tsx
import { Fragment, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, ChevronDown, ChevronRight, ChevronUp, Download } from "lucide-react";
import type { ConsolidatedRow } from "../types";
import type { Thresholds } from "../types";
import StatusBadge from "./StatusBadge";
import CoverMeter from "./CoverMeter";
import RegionBars from "./RegionBars";
import ReleaseDetailPanel from "./ReleaseDetailPanel";
import { formatMoney, formatNumber } from "../lib/format";
import { DELETION_TYPE_META } from "../lib/deletionType";

type Variant = "repress" | "overstock" | "dormant" | "rebalance" | "deleted";

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
  /** When provided, shows a button in the section header that exports just this section as a spreadsheet. */
  onDownload?: () => void;
}

const ACCENT_HEADER: Record<AlertTableProps["accent"], string> = {
  critical: "text-critical",
  warning: "text-warning",
  slate: "text-slate-600",
  proper: "text-proper",
};

const rowKey = (r: ConsolidatedRow) => `${r.barcode}|${r.catalogNo}`;

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
  onDownload,
}: AlertTableProps) {
  const [showAll, setShowAll] = useState(false);
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());
  const visibleRows = showAll ? rows : rows.slice(0, defaultVisible);
  const hasMore = rows.length > defaultVisible;

  const toggleRow = (key: string) => {
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const colCount =
    4 + // Status, Release, Format, Proper/AMPED bars
    (variant !== "dormant" && variant !== "deleted" ? 1 : 0) + // Combined cover
    (variant === "repress"
      ? 1
      : variant === "overstock"
      ? 2
      : variant === "rebalance"
      ? 2
      : variant === "deleted"
      ? 2
      : 0) +
    1; // chevron

  return (
    <section className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-start justify-between gap-3">
        <div>
          <div className={`flex items-center gap-2 font-semibold text-sm ${ACCENT_HEADER[accent]}`}>
            <Icon className="w-4 h-4" />
            {title}
            <span className="text-slate-400 font-normal">({rows.length})</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 ml-6">{description}</p>
        </div>
        {onDownload && (
          <button
            onClick={onDownload}
            disabled={rows.length === 0}
            title="Download this section as a spreadsheet"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        )}
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
                  <th className="px-4 py-2 text-left font-medium">Proper vs AMPED</th>
                  {variant !== "dormant" && variant !== "deleted" && (
                    <th className="px-4 py-2 text-left font-medium">Combined cover</th>
                  )}
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
                  {variant === "deleted" && (
                    <>
                      <th className="px-4 py-2 text-left font-medium">Deletion type</th>
                      <th className="px-4 py-2 text-right font-medium">Units remaining</th>
                    </>
                  )}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((r, i) => {
                  const key = rowKey(r);
                  const open = openRows.has(key);
                  return (
                    <Fragment key={key}>
                      <tr
                        onClick={() => toggleRow(key)}
                        className={`cursor-pointer hover:bg-slate-100/80 ${
                          open ? "bg-slate-100/80" : i % 2 ? "bg-slate-50/60" : "bg-white"
                        }`}
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
                            showValues={variant === "deleted"}
                          />
                        </td>
                        {variant !== "dormant" && variant !== "deleted" && (
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
                        {variant === "deleted" && (
                          <>
                            <td className="px-4 py-2 text-slate-600">
                              {r.deletionType ? DELETION_TYPE_META[r.deletionType].label : "—"}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-slate-700 tabular-nums">
                              {formatNumber(r.combinedStock)}
                            </td>
                          </>
                        )}
                        <td className="px-2 py-2 text-slate-300">
                          <ChevronRight className={`w-4 h-4 transition-transform ${open ? "rotate-90" : ""}`} />
                        </td>
                      </tr>
                      {open && (
                        <tr key={`${key}-detail`}>
                          <td colSpan={colCount} className="p-0 border-t border-b border-slate-100">
                            <ReleaseDetailPanel row={r} thresholds={thresholds} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="w-full flex items-center justify-center gap-1 py-2 text-xs text-slate-500 hover:bg-slate-50 border-t border-slate-100"
            >
              {showAll ? (
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
