// src/components/FileChip.tsx
import { useRef } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import type { Region } from "./RegionTag";
import { REGION_META } from "./RegionTag";

interface FileChipProps {
  id: string;
  region: Region;
  accept: string;
  rowCount: number;
  onFile: (file: File | undefined) => void;
}

export default function FileChip({ id, region, accept, rowCount, onFile }: FileChipProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const meta = REGION_META[region];

  return (
    <button
      onClick={() => fileRef.current?.click()}
      className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white pl-3 pr-2.5 py-1.5 text-xs hover:border-slate-300 transition-colors"
      title={`Replace ${meta.name} file`}
    >
      <span className={`w-2 h-2 rounded-full ${region === "proper" ? "bg-proper" : "bg-amped"}`} />
      <span className="font-medium text-slate-700">{meta.name}</span>
      <span className="text-slate-400">{rowCount.toLocaleString()} rows</span>
      <CheckCircle2 className="w-3.5 h-3.5 text-good" />
      <RefreshCw className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors" />
      <input
        ref={fileRef}
        id={id}
        type="file"
        accept={accept}
        onChange={(e) => onFile(e.target.files?.[0])}
        className="hidden"
      />
    </button>
  );
}
