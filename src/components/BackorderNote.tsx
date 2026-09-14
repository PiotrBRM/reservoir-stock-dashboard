// src/components/BackorderNote.tsx
import { formatNumber } from "../lib/format";

/**
 * A live backorder is confirmed unfulfilled demand — direct evidence that a
 * low trailing sales rate means "nothing to sell", not "nobody wants it".
 * Shown at a glance wherever status is scanned, since it's exactly the
 * context that can make "Overstocked" or "Dormant" misleading.
 */
export default function BackorderNote({ units }: { units: number }) {
  if (!units) return null;
  return (
    <div className="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap" title="Units on backorder at Proper">
      {formatNumber(units)} on backorder
    </div>
  );
}
