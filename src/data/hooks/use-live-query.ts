import { addDatabaseChangeListener, useSQLiteContext, type SQLiteDatabase } from "expo-sqlite";
import { useEffect, useEffectEvent, useState } from "react";

import type { TableName } from "../database/sql";

export type LiveQuery<T> =
  | { status: "loading"; data: undefined; error: undefined }
  | { status: "ready"; data: T; error: undefined }
  | { status: "error"; data: T | undefined; error: Error };

/**
 * Runs `load` and runs it again whenever one of `tables` changes, so screens
 * always show what is saved without manual refreshes.
 *
 * `key` must change whenever the query's inputs change (e.g. the period key).
 * Requires `<SQLiteProvider options={{ enableChangeListener: true }}>`.
 */
export function useLiveQuery<T>(
  key: string,
  tables: readonly TableName[],
  load: (database: SQLiteDatabase) => Promise<T>,
): LiveQuery<T> {
  const database = useSQLiteContext();
  const [state, setState] = useState<LiveQuery<T>>({ status: "loading", data: undefined, error: undefined });
  const runLoad = useEffectEvent(() => load(database));
  const tableList = tables.join(",");

  useEffect(() => {
    let disposed = false;
    let latestRun = 0;
    let pending: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      const runId = ++latestRun;
      runLoad().then(
        (data) => {
          if (!disposed && runId === latestRun) setState({ status: "ready", data, error: undefined });
        },
        (reason: unknown) => {
          if (disposed || runId !== latestRun) return;
          const error = reason instanceof Error ? reason : new Error(String(reason));
          setState((previous) => ({ status: "error", data: previous.data, error }));
        },
      );
    };

    run();
    const watched = tableList.split(",");
    const subscription = addDatabaseChangeListener((event) => {
      if (!watched.includes(event.tableName)) return;
      // One transaction can change many rows; reload once after the burst.
      clearTimeout(pending);
      pending = setTimeout(run, 16);
    });

    return () => {
      disposed = true;
      clearTimeout(pending);
      subscription.remove();
    };
  }, [database, key, tableList]);

  return state;
}
