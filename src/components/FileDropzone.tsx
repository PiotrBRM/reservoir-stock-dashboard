// src/components/FileDropzone.tsx
import React, { useRef, useState } from "react";
import { CheckCircle2, Upload } from "lucide-react";
import type { Region } from "./RegionTag";
import { REGION_META } from "./RegionTag";

interface FileDropzoneProps {
  id: string;
  region: Region;
  accept: string;
  rowCount: number;
  hint: string;
  detail?: React.ReactNode;
  onFile: (file: File | undefined) => void;
}

const ACCENT: Record<Region, { border: string; ring: string; bg: string; icon: string }> = {
  proper: { border: "border-proper", ring: "ring-proper/20", bg: "bg-proper-soft", icon: "text-proper" },
  amped: { border: "border-amped", ring: "ring-amped/20", bg: "bg-amped-soft", icon: "text-amped" },
};

export default function FileDropzone({ id, region, accept, rowCount, hint, detail, onFile }: FileDropzoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const loaded = rowCount > 0;
  const meta = REGION_META[region];
  const accent = ACCENT[region];

  return (
    <div
      className={`rounded-xl p-5 border-2 border-dashed cursor-pointer transition-colors ${
        loaded ? accent.border : "border-slate-200"
      } ${dragOver ? `ring-4 ${accent.ring}` : ""} hover:border-slate-300`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onFile(e.dataTransfer?.files?.[0]);
      }}
    >
      <label htmlFor={id} className="flex items-center gap-4 cursor-pointer">
        <div className={`relative p-3 rounded-lg ${loaded ? accent.bg : "bg-slate-50"}`}>
          <Upload className={`w-6 h-6 ${loaded ? accent.icon : "text-slate-400"}`} />
          {loaded && (
            <div className="absolute -top-1.5 -right-1.5 bg-white rounded-full p-0.5 shadow">
              <CheckCircle2 className={`w-4 h-4 ${accent.icon}`} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${region === "proper" ? "bg-proper" : "bg-amped"}`} />
            <span className="font-semibold text-slate-800">
              {meta.name} <span className="font-normal text-slate-400">— {meta.territory}</span>
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            Rows: {rowCount} • {hint}
          </div>
          <div className="text-xs text-slate-600 mt-2">{detail ?? <span>Drop file or click to browse</span>}</div>
        </div>

        <input
          ref={fileRef}
          id={id}
          type="file"
          accept={accept}
          onChange={(e) => onFile(e.target.files?.[0])}
          className="hidden"
        />
      </label>
    </div>
  );
}
