import { useActiveJob } from "@/data/hooks/queries";

/** Currency for totals: the active profile's currency. */
export function usePrimaryCurrency(): string {
  const job = useActiveJob();
  return job.data?.currencyCode ?? "ILS";
}
