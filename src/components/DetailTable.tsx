// src/components/DetailTable.tsx
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Download, Search } from "lucide-react";
import type { ConsolidatedRow, Thresholds } from "../types";
import StatusBadge from "./StatusBadge";
import CoverMeter from "./CoverMeter";
import ReleaseDetailPanel from "./ReleaseDetailPanel";
import { formatMoney, formatNumber } from "../lib/format";

type Group = "release" | "proper" | "amped" | "combined" | "value";

interface Column {
  key: keyof ConsolidatedRow | "status";
  label: string;
  group: Group;
  align?: "left" | "right";
  render: (r: ConsolidatedRow, thresholds: Thresholds) => ReactNode;
  sortValue: (r: ConsolidatedRow) => number | string;
}

const GROUP_META: Record<Group, { label: string; className: string }> = {
  release: { label: "Release", className: "bg-slate-50 text-slate-500" },
  proper: { label: "Proper", className: "bg-proper-soft text-proper" },
  amped: { label: "AMPED", className: "bg-amped-soft text-amped" },
  combined: { label: "Combined", className: "bg-slate-100 text-slate-600" },
  value: { label: "Value", className: "bg-slate-50 text-slate-500" },
};

const BASE_COLUMNS: Column[] = [
  {
    key: "status",
    label: "Status",
    group: "release",
    render: (r) => <StatusBadge status={r.status} />,
    sortValue: (r) => r.status,
  },
  { key: "artist", label: "Artist", group: "release", render: (r) => r.artist, sortValue: (r) => r.artist },
  { key: "title", label: "Title", group: "release", render: (r) => r.title, sortValue: (r) => r.title },
  { key: "format", label: "Format", group: "release", render: (r) => r.format, sortValue: (r) => r.format },
  {
    key: "catalogNo",
    label: "Catalog No",
    group: "release",
    render: (r) => r.catalogNo,
    sortValue: (r) => r.catalogNo,
  },
  {
    key: "properStock",
    label: "Stock",
    group: "proper",
    align: "right",
    render: (r) => formatNumber(r.properStock),
    sortValue: (r) => r.properStock,
  },
  {
    key: "properMonthsOfCover",
    label: "Cover",
    group: "proper",
    render: (r, t) => <CoverMeter months={r.properMonthsOfCover} status={r.properStatus} thresholds={t} />,
    sortValue: (r) => r.properMonthsOfCover ?? -1,
  },
  {
    key: "ampedStock",
    label: "Stock",
    group: "amped",
    align: "right",
    render: (r) => formatNumber(r.ampedStock),
    sortValue: (r) => r.ampedStock,
  },
  {
    key: "ampedMonthsOfCover",
    label: "Cover",
    group: "amped",
    render: (r, t) => <CoverMeter months={r.ampedMonthsOfCover} status={r.ampedStatus} thresholds={t} />,
    sortValue: (r) => r.ampedMonthsOfCover ?? -1,
  },
  {
    key: "combinedStock",
    label: "Stock",
    group: "combined",
    align: "right",
    render: (r) => formatNumber(r.combinedStock),
    sortValue: (r) => r.combinedStock,
  },
  {
    key: "combinedVelocity",
    label: "Units / mo",
    group: "combined",
    align: "right",
    render: (r) => r.combinedVelocity.toFixed(1),
    sortValue: (r) => r.combinedVelocity,
  },
  {
    key: "monthsOfCover",
    label: "Cover",
    group: "combined",
    render: (r, t) => <CoverMeter months={r.monthsOfCover} status={r.status} thresholds={t} />,
    sortValue: (r) => r.monthsOfCover ?? -1,
  },
  {
    key: "unitPrice",
    label: "Unit price",
    group: "value",
    align: "right",
    render: (r) => (r.unitPrice ? formatMoney(r.unitPrice) : "—"),
    sortValue: (r) => r.unitPrice,
  },
  {
    key: "stockValue",
    label: "Stock value",
    group: "value",
    align: "right",
    render: (r) => (r.stockValue ? formatMoney(r.stockValue) : "—"),
    sortValue: (r) => r.stockValue,
  },
];

// Reservoir US only — inserted into the AMPED column group, not part of the
// base set, since Proper doesn't track this and it's meaningless for Chrysalis.
const LAST_PO_COLUMN: Column = {
  key: "ampedLastPODate",
  label: "Last PO",
  group: "amped",
  render: (r) => r.ampedLastPODate || "—",
  sortValue: (r) => r.ampedLastPODate,
};

// Contiguous runs of the same group, used to render the spanning group header row.
function buildGroupRuns(columns: Column[]): { group: Group; span: number }[] {
  const runs: { group: Group; span: number }[] = [];
  for (const col of columns) {
    const last = runs[runs.length - 1];
    if (last && last.group === col.group) last.span += 1;
    else runs.push({ group: col.group, span: 1 });
  }
  return runs;
}

interface DetailTableProps {
  rows: ConsolidatedRow[];
  thresholds: Thresholds;
  onDownload: () => void;
  /** Reservoir US only — adds the "Last PO (AMPED)" column to the AMPED group. */
  showLastPODate?: boolean;
}

const rowKey = (r: ConsolidatedRow) => `${r.barcode}|${r.catalogNo}`;

export default function DetailTable({ rows, thresholds, onDownload, showLastPODate = false }: DetailTableProps) {
  const columns = useMemo(() => {
    if (!showLastPODate) return BASE_COLUMNS;
    const insertAfter = BASE_COLUMNS.findIndex((c) => c.key === "ampedMonthsOfCover");
    return [...BASE_COLUMNS.slice(0, insertAfter + 1), LAST_PO_COLUMN, ...BASE_COLUMNS.slice(insertAfter + 1)];
  }, [showLastPODate]);
  const groupRuns = useMemo(() => buildGroupRuns(columns), [columns]);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<Column["key"]>("combinedStock");
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [openRows, setOpenRows] = useState<Set<string>>(new Set());

  const toggleRow = (key: string) => {
    setOpenRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = !q
      ? rows
      : rows.filter((r) => `${r.artist} ${r.title} ${r.catalogNo} ${r.barcode} ${r.format}`.toLowerCase().includes(q));

    // sortKey can point at a column that no longer exists after switching
    // teams mid-sort (e.g. sorted by Reservoir US's Last PO, then switched to
    // Chrysalis) — fall back to the default rather than crashing.
    const col = columns.find((c) => c.key === sortKey) ?? columns.find((c) => c.key === "combinedStock")!;
    return [...base].sort((a, b) => {
      const av = col.sortValue(a);
      const bv = col.sortValue(b);
      if (typeof av === "string" || typeof bv === "string") {
        return String(av).localeCompare(String(bv)) * sortDir;
      }
      return ((av as number) - (bv as number)) * sortDir;
    });
  }, [rows, query, sortKey, sortDir, columns]);

  const toggleSort = (key: Column["key"]) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(-1);
    }
  };

  return (
    <section className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-5 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-700">All titles ({filtered.length})</h3>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search artist, title, catalog no…"
              className="w-64 py-2 pl-3 pr-9 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-proper/30 focus:border-proper"
            />
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400" />
          </div>
          <button
            onClick={onDownload}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm hover:bg-slate-50"
          >
            <Download className="w-4 h-4" /> Download
          </button>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-auto max-h-[560px]">
        <table className="min-w-full text-sm table-auto border-collapse">
          <thead className="sticky top-0 z-10">
            <tr>
              {groupRuns.map((run, i) => (
                <th
                  key={i}
                  colSpan={run.span}
                  className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-left border-b border-slate-100 ${GROUP_META[run.group].className}`}
                >
                  {GROUP_META[run.group].label}
                </th>
              ))}
              <th className="w-8 border-b border-slate-100 bg-slate-50" />
            </tr>
            <tr className="bg-slate-50">
              {columns.map((col, i) => (
                <th
                  key={i}
                  onClick={() => toggleSort(col.key)}
                  className={`px-3 py-2 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 ${
                    col.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key ? (
                      sortDir === 1 ? (
                        <ArrowUp className="w-3 h-3" />
                      ) : (
                        <ArrowDown className="w-3 h-3" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3 h-3 text-slate-300" />
                    )}
                  </span>
                </th>
              ))}
              <th className="w-8 bg-slate-50" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
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
                    {columns.map((col, ci) => (
                      <td
                        key={ci}
                        className={`px-3 py-2 whitespace-nowrap ${col.align === "right" ? "text-right" : "text-left"}`}
                      >
                        {col.render(r, thresholds)}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-slate-300">
                      <ChevronRight className={`w-4 h-4 transition-transform ${open ? "rotate-90" : ""}`} />
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={columns.length + 1} className="p-0 border-t border-b border-slate-100">
                        <ReleaseDetailPanel row={r} thresholds={thresholds} showLastPODate={showLastPODate} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
