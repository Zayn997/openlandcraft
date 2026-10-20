import { Input, type InputProps } from './Input';

/** String drafts are supported; parsing belongs to the owning editor. */
export function NumericInput(props: Omit<InputProps, 'type'>) {
  return <Input {...props} type="number" />;
}
