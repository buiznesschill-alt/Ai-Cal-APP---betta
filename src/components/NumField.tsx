"use client";
import { useEffect, useState } from "react";

// Number input, ktorý je možné úplne vymazať počas písania – po blur sa vráti platná hodnota (min)
export function NumField({
  value,
  onChange,
  min = 0,
  className = "",
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  className?: string;
}) {
  const [raw, setRaw] = useState<string | null>(null);

  // sync: keď sa value zmení externé (slider, prepínanie options), zruš stale raw
  useEffect(() => {
    if (raw === "") return; // používateľ aktívne maže
    const n = Number(raw ?? "");
    if (raw === null || Number.isNaN(n) || n !== value) setRaw(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="number"
      value={raw ?? String(value)}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "") {
          setRaw("");
          return;
        }
        setRaw(v);
        const n = Number(v);
        if (Number.isFinite(n) && n >= min) onChange(n);
      }}
      onBlur={() => {
        const n = Number(raw ?? "");
        if (raw === null || raw === "" || !Number.isFinite(n) || n < min) {
          setRaw(null);
          if (value < min) onChange(min);
        }
      }}
      className={className}
    />
  );
}
