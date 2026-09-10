// src/components/StatusBadge.tsx
import type { StockStatus } from "../types";
import { STATUS_STYLE } from "../lib/statusStyle";

export default function StatusBadge({ status }: { status: StockStatus }) {
  const { label, icon: Icon, text, bg, border } = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap border ${bg} ${text} ${border}`}
    >
      <Icon className="w-3 h-3" strokeWidth={2.5} />
      {label}
    </span>
  );
}
