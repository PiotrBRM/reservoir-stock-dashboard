// src/components/SettingsBar.tsx
import { useState } from "react";
import { ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import type { Thresholds } from "../types";

interface SettingsBarProps {
  thresholds: Thresholds;
  onChange: (next: Thresholds) => void;
}

function NumberField({
  label,
  value,
  suffix,
  onChange,
  step = 0.5,
  min = 0,
}: {
  label: string;
  value: number;
  suffix: string;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-500">
      <span className="whitespace-nowrap">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          value={value}
          min={min}
          step={step}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="w-16 rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-proper/30 focus:border-proper"
        />
        <span className="text-slate-400 whitespace-nowrap">{suffix}</span>
      </div>
    </label>
  );
}

export default function SettingsBar({ thresholds, onChange }: SettingsBarProps) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<Thresholds>) => onChange({ ...thresholds, ...patch });

  return (
    <div className="rounded-xl border border-slate-100 bg-white shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-slate-700"
      >
        <span className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-slate-400" />
          Assumptions driving these numbers
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="flex flex-wrap gap-6 px-5 pb-4 border-t border-slate-100 pt-4">
          <NumberField
            label="Flag for repress below"
            value={thresholds.lowMonths}
            suffix="months cover"
            onChange={(v) => set({ lowMonths: v })}
          />
          <NumberField
            label="Flag as overstocked above"
            value={thresholds.highMonths}
            suffix="months cover"
            onChange={(v) => set({ highMonths: v })}
          />
          <NumberField
            label="Repress restocks to"
            value={thresholds.restockTargetMonths}
            suffix="months cover"
            onChange={(v) => set({ restockTargetMonths: v })}
          />
          <NumberField
            label="Storage holding cost"
            value={thresholds.holdingCostPerUnitPerMonth}
            suffix="£ / unit / month"
            step={0.01}
            onChange={(v) => set({ holdingCostPerUnitPerMonth: v })}
          />
          <NumberField
            label="Ignore urgency below"
            value={thresholds.minMonthlyVelocity}
            suffix="units / mo combined"
            step={1}
            onChange={(v) => set({ minMonthlyVelocity: v })}
          />
        </div>
      )}
    </div>
  );
}
