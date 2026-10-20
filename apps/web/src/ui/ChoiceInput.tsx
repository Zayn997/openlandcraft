import { Input, type InputProps } from './Input';

type Props = Omit<InputProps, 'type'>;
export function CheckboxInput(props: Props) {
  return <Input {...props} type="checkbox" />;
}
export function ColorInput(props: Props) {
  return <Input {...props} type="color" />;
}
export function RangeInput(props: Props) {
  return <Input {...props} type="range" />;
}
