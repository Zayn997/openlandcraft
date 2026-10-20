export function classes(...values: (string | false | null | undefined)[]) {
  return values.filter(Boolean).join(' ');
}
