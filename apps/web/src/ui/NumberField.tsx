import { useEffect, useState } from 'react';
import { Field, FieldControl, FieldMessage, useFieldIds } from './Field';
import { NumericInput } from './NumericInput';

export function NumberField({ label, value, min, max, onChange, unit = 'm', disabled }: {
  label: string; value: number; min: number; max: number; step?: number; unit?: string; disabled?: boolean; onChange: (value: number) => void;
}) {
  const [text, setText] = useState(String(Math.round(value * 100) / 100));
  const [invalid, setInvalid] = useState(false);
  const ids = useFieldIds();
  useEffect(() => { setText(String(Math.round(value * 100) / 100)); setInvalid(false); }, [value]);
  return <Field variant="number" label={label} htmlFor={ids.control} invalid={invalid}>
    <FieldControl>
      <NumericInput id={ids.control} aria-label={label} required value={text} min={min} max={max} step="any" disabled={disabled}
        aria-invalid={invalid} aria-describedby={invalid ? ids.message : undefined}
        onChange={event => {
          const next = event.target.value, numeric = Number(next);
          setText(next);
          const bad = next.trim() === '' || !Number.isFinite(numeric) || numeric < min || numeric > max;
          setInvalid(bad);
          if (!bad) onChange(numeric);
        }} />
      <small>{unit}</small>
    </FieldControl>
    {invalid && <FieldMessage id={ids.message} tone="error">{min}–{max} {unit}</FieldMessage>}
  </Field>;
}
