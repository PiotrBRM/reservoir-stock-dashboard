// src/components/RegionTag.tsx

export type Region = "proper" | "amped";

export const REGION_META: Record<Region, { name: string; dot: string; text: string }> = {
  proper: { name: "Proper", dot: "bg-proper", text: "text-proper" },
  amped: { name: "AMPED", dot: "bg-amped", text: "text-amped" },
};

/** Color dot + name — identity never rides on color alone. */
export default function RegionTag({ region }: { region: Region }) {
  const meta = REGION_META[region];
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${meta.text}`}>
      <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
      {meta.name}
    </span>
  );
}
