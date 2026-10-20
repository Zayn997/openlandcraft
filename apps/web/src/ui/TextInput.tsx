import { Input, type InputProps } from './Input';

export function TextInput(props: Omit<InputProps, 'type'>) {
  return <Input {...props} type="text" />;
}
