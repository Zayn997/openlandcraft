import { createContext, useContext, useState } from 'react';

type Sections = {
  expanded: (id: string, initial: boolean) => boolean;
  toggle: (id: string, open: boolean) => void;
};
const Context = createContext<Sections | null>(null);
export const InspectorSectionsProvider = Context.Provider;

export function useInspectorSection(id: string, initial: boolean) {
  const context = useContext(Context);
  const [local, setLocal] = useState(initial);
  return {
    open: context?.expanded(id, initial) ?? local,
    setOpen: (open: boolean) => context ? context.toggle(id, open) : setLocal(open),
  };
}

/** Scope state survives keyed forms being remounted after a commit or cancel. */
export function useInspectorSections(scope: string) {
  const [sections, setSections] = useState<Record<string, boolean>>({});
  const prefix = scope + ':';
  return {
    value: {
      expanded: (id: string, initial: boolean) => sections[prefix + id] ?? sections[prefix + '*'] ?? initial,
      toggle: (id: string, open: boolean) => setSections(previous => ({ ...previous, [prefix + id]: open })),
    },
    setAll: (open: boolean) => setSections(previous => ({
      ...Object.fromEntries(Object.entries(previous).filter(([key]) => !key.startsWith(prefix))),
      [prefix + '*']: open,
    })),
  };
}
