import { useEffect, useState } from "react";

export function NumberField({ label, value, min, max, onChange, unit = 'm' }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(Math.round(value * 100) / 100));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => { setText(String(Math.round(value * 100) / 100)); setInvalid(false); }, [value]);
  return <label className={`number-field ${invalid ? 'invalid' : ''}`}><span>{label}</span><div><input aria-label={label} type="number" required value={text} min={min} max={max} step="any"
    onChange={(event) => {
      const next = event.target.value; setText(next);
      const numeric = Number(next);
      const bad = next.trim() === '' || !Number.isFinite(numeric) || numeric < min || numeric > max;
      setInvalid(bad);
      if (!bad) onChange(numeric);
    }} aria-invalid={invalid} /><small>{unit}</small></div>{invalid && <em>{min}–{max} {unit}</em>}</label>;
}

