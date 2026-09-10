// src/components/CoverMeter.tsx
import type { StockStatus, Thresholds } from "../types";
import { STATUS_STYLE } from "../lib/statusStyle";

interface CoverMeterProps {
  months: number | null;
  status: StockStatus;
  thresholds: Thresholds;
  className?: string;
}

/**
 * A horizontal meter showing months of stock cover against the ideal window
 * (the shaded band between the repress and overstock thresholds), so cover
 * reads as a shape at a glance instead of a number that needs interpreting.
 */
export default function CoverMeter({ months, status, thresholds, className = "" }: CoverMeterProps) {
  if (months === null) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="h-1.5 flex-1 rounded-full bg-slate-100" />
        <span className="text-xs text-slate-400 shrink-0 w-16 text-right">no sales</span>
      </div>
    );
  }

  const domainMax = thresholds.highMonths * 2;
  const lowPct = Math.min(100, (thresholds.lowMonths / domainMax) * 100);
  const highPct = Math.min(100, (thresholds.highMonths / domainMax) * 100);
  const pct = Math.min(100, (months / domainMax) * 100);
  const overflow = months > domainMax;
  const { fill } = STATUS_STYLE[status];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="absolute inset-y-0 bg-good/15"
          style={{ left: `${lowPct}%`, width: `${Math.max(0, highPct - lowPct)}%` }}
          title="Ideal cover window"
        />
        <div className={`absolute inset-y-0 left-0 rounded-full ${fill}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-600 tabular-nums shrink-0 w-16 text-right">
        {overflow ? `${Math.round(months)}mo+` : `${months.toFixed(1)}mo`}
      </span>
    </div>
  );
}
