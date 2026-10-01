import { useJobs } from "@/data/hooks/queries";

/** Currency for totals: the first job's currency. Multi-currency totals are not supported yet. */
export function usePrimaryCurrency(): string {
  const jobs = useJobs();
  return jobs.data?.[0]?.currencyCode ?? "ILS";
}
