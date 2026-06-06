"use client";

// App-wide SpacetimeDB connection. Connects once on mount, mounts the
// window.__APP__ test surface, and exposes the live module + a version counter
// (bumped on every cache change) via context so child components re-render.
// All SDK code is dynamically imported so nothing touches it during SSR.
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type StdbModule = typeof import("@/lib/spacetime");

interface StdbValue {
  connected: boolean;
  identity: string | null;
  version: number;
  mod: StdbModule | null;
}

const StdbContext = createContext<StdbValue>({
  connected: false,
  identity: null,
  version: 0,
  mod: null,
});

export function useStdb(): StdbValue {
  return useContext(StdbContext);
}

export default function StdbProvider({ children }: { children: ReactNode }) {
  const [value, setValue] = useState<StdbValue>({
    connected: false,
    identity: null,
    version: 0,
    mod: null,
  });

  useEffect(() => {
    let cancelled = false;
    let off: () => void = () => {};
    (async () => {
      const stdb = await import("@/lib/spacetime");
      const { mountTestHooks } = await import("@/lib/testHooks");
      if (cancelled) return;
      stdb.connect();
      mountTestHooks();
      const sync = () =>
        setValue({
          connected: stdb.isConnected(),
          identity: stdb.getIdentityHex(),
          version: stdb.getVersion(),
          mod: stdb,
        });
      off = stdb.onChange(sync);
      sync();
    })();
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  return (
    <StdbContext.Provider value={value}>{children}</StdbContext.Provider>
  );
}
