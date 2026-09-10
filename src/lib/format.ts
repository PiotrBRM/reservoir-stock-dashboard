// src/lib/format.ts

export function formatMoney(n: number): string {
  if (!n) return "£0";
  return `£${n.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-GB", { maximumFractionDigits: 0 });
}

export function formatMonths(n: number | null): string {
  if (n === null) return "—";
  return `${n.toFixed(1)}mo`;
}
