// src/components/RegionBars.tsx
import type { StockStatus } from "../types";
import { STATUS_STYLE } from "../lib/statusStyle";
import { formatNumber } from "../lib/format";

interface RegionBarsProps {
  properStock: number;
  ampedStock: number;
  properStatus: StockStatus;
  ampedStatus: StockStatus;
  /** Hide the exact unit counts — used in summary tables where the shape is the point and exact numbers are one click away. */
  showValues?: boolean;
  className?: string;
}

/**
 * Two stacked bars — dot color says which region (blue Proper / orange AMPED),
 * bar color says how healthy that region's stock is, bar length says the split
 * between them. A thin red bar next to a long amber one *is* the rebalance signal.
 */
export default function RegionBars({
  properStock,
  ampedStock,
  properStatus,
  ampedStatus,
  showValues = true,
  className = "",
}: RegionBarsProps) {
  const total = Math.max(1, properStock + ampedStock);
  const pct = (n: number) => Math.min(100, Math.max(n > 0 ? 4 : 0, (n / total) * 100));

  return (
    <div className={`flex flex-col gap-1 w-28 ${className}`}>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-proper shrink-0" />
        <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full ${STATUS_STYLE[properStatus].fill}`}
            style={{ width: `${pct(properStock)}%` }}
          />
        </div>
        {showValues && (
          <span className="text-[11px] text-slate-500 tabular-nums w-10 text-right">{formatNumber(properStock)}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-amped shrink-0" />
        <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full rounded-full ${STATUS_STYLE[ampedStatus].fill}`}
            style={{ width: `${pct(ampedStock)}%` }}
          />
        </div>
        {showValues && (
          <span className="text-[11px] text-slate-500 tabular-nums w-10 text-right">{formatNumber(ampedStock)}</span>
        )}
      </div>
    </div>
  );
}
