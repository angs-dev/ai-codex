import type { DataTimeliness, SourceFreshness } from "@swing10/shared";

export interface FreshnessPolicy { freshForMs: number; staleAfterMs: number }
export const DEFAULT_FRESHNESS_POLICIES: Record<DataTimeliness, FreshnessPolicy> = {
  REALTIME: { freshForMs: 5_000, staleAfterMs: 15_000 },
  NEAR_REALTIME: { freshForMs: 60_000, staleAfterMs: 180_000 },
  DELAYED: { freshForMs: 20 * 60_000, staleAfterMs: 30 * 60_000 },
  PERIODIC: { freshForMs: 60 * 60_000, staleAfterMs: 24 * 60 * 60_000 },
  UNKNOWN: { freshForMs: 0, staleAfterMs: 0 }
};
export function assessFreshness(timeliness: DataTimeliness, dataAt: string | null, observedAt: string, policy: FreshnessPolicy = DEFAULT_FRESHNESS_POLICIES[timeliness]!): SourceFreshness {
  if (!dataAt || timeliness === "UNKNOWN") return { timeliness, status: "UNKNOWN", observedAt, ageMs: null, ...policy, reason: "No trustworthy data timestamp is available" };
  const ageMs = Math.max(0, Date.parse(observedAt) - Date.parse(dataAt));
  const status = ageMs <= policy.freshForMs ? "FRESH" : ageMs <= policy.staleAfterMs ? "AGING" : "STALE";
  return { timeliness, status, observedAt, ageMs, ...policy, reason: `${timeliness} data is ${status.toLowerCase()} at ${ageMs}ms old` };
}
export interface SourceGovernorOptions { minIntervalMs: number; maxConcurrent: number }
export class SourceGovernor {
  private active = 0; private lastStartedAt = Number.NEGATIVE_INFINITY;
  constructor(private readonly options: SourceGovernorOptions, private readonly now = () => Date.now(), private readonly sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))) {
    if (options.maxConcurrent < 1 || options.minIntervalMs < 0) throw new Error("Invalid governor options");
  }
  async run<T>(operation: () => Promise<T>): Promise<T> {
    while (this.active >= this.options.maxConcurrent) await this.sleep(1);
    const waitMs = Math.max(0, this.options.minIntervalMs - (this.now() - this.lastStartedAt));
    if (waitMs) await this.sleep(waitMs);
    this.active++; this.lastStartedAt = this.now();
    try { return await operation(); } finally { this.active--; }
  }
}
