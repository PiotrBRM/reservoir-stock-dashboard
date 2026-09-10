// src/components/RegionTag.tsx

export type Region = "proper" | "amped";

export const REGION_META: Record<Region, { name: string; territory: string; dot: string; text: string }> = {
  proper: { name: "Proper", territory: "UK & ROW", dot: "bg-proper", text: "text-proper" },
  amped: { name: "AMPED", territory: "NA", dot: "bg-amped", text: "text-amped" },
};

/** Color dot + name, always with the territory alongside it — identity never rides on color alone. */
export default function RegionTag({ region, compact = false }: { region: Region; compact?: boolean }) {
  const meta = REGION_META[region];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.text}`}>
      <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
      {meta.name}
      {!compact && <span className="text-slate-400 font-normal">· {meta.territory}</span>}
    </span>
  );
}
