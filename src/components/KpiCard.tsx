// src/components/KpiCard.tsx
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  sublabel?: string;
  accent?: "neutral" | "critical" | "warning" | "good";
}

const ACCENTS: Record<NonNullable<KpiCardProps["accent"]>, string> = {
  neutral: "bg-slate-100 text-slate-500",
  critical: "bg-critical-soft text-critical",
  warning: "bg-warning-soft text-warning",
  good: "bg-good-soft text-good",
};

export default function KpiCard({ icon: Icon, label, value, sublabel, accent = "neutral" }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-2">
        <span className={`rounded-md p-1 ${ACCENTS[accent]}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        {label}
      </div>
      <div className="text-[28px] font-semibold text-slate-900 leading-none">{value}</div>
      {sublabel && <div className="text-xs text-slate-400 mt-1.5">{sublabel}</div>}
    </div>
  );
}
