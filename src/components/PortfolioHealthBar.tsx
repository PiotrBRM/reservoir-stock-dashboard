// src/components/PortfolioHealthBar.tsx
import type { ConsolidatedRow, StockStatus } from "../types";
import { STATUS_STYLE } from "../lib/statusStyle";
import { formatNumber } from "../lib/format";

const ORDER: StockStatus[] = ["stockout", "critical", "overstocked", "dormant", "healthy", "deleted"];

export default function PortfolioHealthBar({ rows }: { rows: ConsolidatedRow[] }) {
  const total = rows.length || 1;
  const counts = ORDER.map((status) => ({
    status,
    count: rows.filter((r) => r.status === status).length,
  }));

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700 mb-3">Portfolio health</h2>

      <div className="flex h-8 w-full rounded-lg overflow-hidden gap-0.5">
        {counts.map(({ status, count }) =>
          count > 0 ? (
            <div
              key={status}
              className={`h-full ${STATUS_STYLE[status].fill}`}
              style={{ width: `${(count / total) * 100}%` }}
              title={`${STATUS_STYLE[status].label}: ${count}`}
            />
          ) : null
        )}
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
        {counts.map(({ status, count }) => (
          <div key={status} className="flex items-center gap-1.5 text-xs">
            <span className={`w-2.5 h-2.5 rounded-full ${STATUS_STYLE[status].fill}`} />
            <span className="text-slate-600">{STATUS_STYLE[status].label}</span>
            <span className="text-slate-400 tabular-nums">
              {formatNumber(count)} · {Math.round((count / total) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
