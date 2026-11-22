import type { OrchestrationV2ProviderTurn, OrchestrationV2Run } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

export interface ThreadUsageMetrics {
  readonly tokens: {
    readonly uncachedInputTokens: number;
    readonly cachedInputTokens: number;
    readonly cacheCreationTokens: number;
    readonly outputTokens: number;
    readonly reasoningTokens: number;
    readonly totalTokens: number;
  } | null;
  /** Share of input that came from the prompt cache, from 0 to 1. */
  readonly cacheHitRate: number | null;
  /** Model turns whose provider reported token usage. */
  readonly reportedTurns: number;
  /** Some turns reported no usage, so the token totals are a floor. */
  readonly partial: boolean;
  /** Prompts that reached a provider. */
  readonly prompts: number;
  /** Finished prompts only; a running prompt has no duration yet. */
  readonly runTime: {
    readonly totalMs: number;
    readonly averageMs: number;
    readonly longestMs: number;
  } | null;
}

type TurnUsageSource = Pick<OrchestrationV2ProviderTurn, "status" | "turnTokenUsage">;
type RunSource = Pick<OrchestrationV2Run, "startedAt" | "completedAt">;

/**
 * Thread-wide totals from what providers reported per turn and from run timings. Nothing here is
 * estimated: a turn without a usage report adds to `partial` instead of a guessed count.
 */
export function deriveThreadUsageMetrics(
  providerTurns: ReadonlyArray<TurnUsageSource>,
  runs: ReadonlyArray<RunSource>,
): ThreadUsageMetrics {
  let uncachedInputTokens = 0;
  let cachedInputTokens = 0;
  let cacheCreationTokens = 0;
  let outputTokens = 0;
  let reasoningTokens = 0;
  let reportedTurns = 0;
  let partial = false;
  for (const turn of providerTurns) {
    // A queued turn has nothing to report yet.
    if (turn.status === "pending") continue;
    const usage = turn.turnTokenUsage;
    // A provider-run local command (such as /compact output) is not model work.
    if (usage?.localCommand === true) continue;
    if (usage === undefined || usage.usageStatus === "unavailable") {
      partial = true;
      continue;
    }
    if (usage.usageStatus === "partial") partial = true;
    const input = usage.inputTokens ?? 0;
    const cached = usage.cachedInputTokens ?? 0;
    const created = usage.cacheCreationTokens ?? 0;
    // Input already counts cache reads and writes.
    uncachedInputTokens += Math.max(0, input - cached - created);
    cachedInputTokens += cached;
    cacheCreationTokens += created;
    outputTokens += usage.outputTokens ?? 0;
    reasoningTokens += usage.reasoningTokens ?? 0;
    reportedTurns += 1;
  }

  const totalTokens = uncachedInputTokens + cachedInputTokens + cacheCreationTokens + outputTokens;
  const inputTokens = uncachedInputTokens + cachedInputTokens + cacheCreationTokens;

  let prompts = 0;
  let totalMs = 0;
  let longestMs = 0;
  let finished = 0;
  for (const run of runs) {
    if (run.startedAt === null) continue;
    prompts += 1;
    if (run.completedAt === null) continue;
    const duration = Math.max(
      0,
      DateTime.toEpochMillis(run.completedAt) - DateTime.toEpochMillis(run.startedAt),
    );
    totalMs += duration;
    longestMs = Math.max(longestMs, duration);
    finished += 1;
  }

  return {
    tokens:
      totalTokens > 0
        ? {
            uncachedInputTokens,
            cachedInputTokens,
            cacheCreationTokens,
            outputTokens,
            reasoningTokens,
            totalTokens,
          }
        : null,
    cacheHitRate: inputTokens > 0 ? cachedInputTokens / inputTokens : null,
    reportedTurns,
    partial,
    prompts,
    runTime: finished > 0 ? { totalMs, averageMs: totalMs / finished, longestMs } : null,
  };
}
