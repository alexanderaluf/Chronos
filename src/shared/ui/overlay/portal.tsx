import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { StyleSheet, View } from "react-native";

/**
 * A minimal portal: renders overlays (custom sheets, dialogs, pickers) in one
 * layer above the whole app, without React Native's native `Modal`.
 *
 * Content rendered through a portal sees the contexts that wrap the
 * `PortalProvider` (database, theme…), NOT the contexts around the place where
 * `<Portal>` is written. Do not use navigation hooks inside portal content —
 * use the global `router` instead.
 */
type PortalApi = {
  mount: (key: string, node: ReactNode) => void;
  unmount: (key: string) => void;
};

const PortalContext = createContext<PortalApi | null>(null);

export function PortalProvider({ children }: PropsWithChildren) {
  const [entries, setEntries] = useState<ReadonlyMap<string, ReactNode>>(new Map());
  const api = useMemo<PortalApi>(
    () => ({
      mount: (key, node) =>
        setEntries((current) => {
          const next = new Map(current);
          next.set(key, node);
          return next;
        }),
      unmount: (key) =>
        setEntries((current) => {
          if (!current.has(key)) return current;
          const next = new Map(current);
          next.delete(key);
          return next;
        }),
    }),
    [],
  );

  return (
    <PortalContext.Provider value={api}>
      {children}
      {entries.size > 0 ? (
        <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
          {[...entries].map(([key, node]) => (
            <View key={key} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
              {node}
            </View>
          ))}
        </View>
      ) : null}
    </PortalContext.Provider>
  );
}

/** Renders `children` in the app-wide overlay layer. */
export function Portal({ children }: PropsWithChildren) {
  const api = useContext(PortalContext);
  if (!api) throw new Error("Portal must be rendered inside PortalProvider.");
  const key = useId();

  useLayoutEffect(() => {
    api.mount(key, children);
  }, [api, key, children]);

  useEffect(() => () => api.unmount(key), [api, key]);

  return null;
}
