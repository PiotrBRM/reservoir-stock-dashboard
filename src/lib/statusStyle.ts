// src/lib/statusStyle.ts
import { AlertTriangle, CheckCircle2, CircleDashed, OctagonAlert, XCircle } from "lucide-react";
import type { StockStatus } from "../types";

/**
 * Central mapping from a StockStatus to how it's drawn everywhere in the app —
 * one source of truth so a status always means the same color, icon, and words.
 */
export const STATUS_STYLE: Record<
  StockStatus,
  { label: string; icon: typeof CheckCircle2; text: string; bg: string; border: string; fill: string }
> = {
  stockout: {
    label: "Out of stock",
    icon: XCircle,
    text: "text-critical",
    bg: "bg-critical-soft",
    border: "border-critical/30",
    fill: "bg-critical",
  },
  critical: {
    label: "Needs repress",
    icon: OctagonAlert,
    text: "text-serious",
    bg: "bg-serious-soft",
    border: "border-serious/30",
    fill: "bg-serious",
  },
  healthy: {
    label: "Healthy",
    icon: CheckCircle2,
    text: "text-good",
    bg: "bg-good-soft",
    border: "border-good/30",
    fill: "bg-good",
  },
  overstocked: {
    label: "Overstocked",
    icon: AlertTriangle,
    text: "text-warning",
    bg: "bg-warning-soft",
    border: "border-warning/30",
    fill: "bg-warning",
  },
  dormant: {
    label: "Dormant",
    icon: CircleDashed,
    text: "text-slate-500",
    bg: "bg-slate-100",
    border: "border-slate-200",
    fill: "bg-slate-300",
  },
};
