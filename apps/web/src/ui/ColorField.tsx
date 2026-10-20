import { ColorInput } from './ChoiceInput';
import { Field } from './Field';

export function ColorField({ label, value, onChange }: {
  label: string; value: string; onChange: (value: string) => void;
}) {
  return <Field variant="color">
    <ColorInput aria-label={label} value={value} onChange={event => onChange(event.target.value)} />
    <span>{label}</span><code>{value.toUpperCase()}</code>
  </Field>;
}
