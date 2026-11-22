import type { ThreadRunSummary, ThreadRuntimeSummary } from "@t3tools/client-runtime/state/models";
import type { OrchestrationV2RunStatus, RunId } from "@t3tools/contracts";

export interface ForkRunSummary {
  readonly runId: RunId;
  readonly status: OrchestrationV2RunStatus;
  readonly ordinal: number;
}

export interface ForkRunSource {
  /** Projection runs carry `id`; shell run summaries use `runId`. */
  readonly runId?: RunId;
  readonly id?: RunId;
  readonly status: OrchestrationV2RunStatus;
  readonly ordinal: number;
}

/** Fork commands only accept runs that ended with a stable checkpoint. */
export function forkableRunId(
  latestRun: Pick<ThreadRunSummary, "runId" | "status"> | null | undefined,
  runtime: Pick<ThreadRuntimeSummary, "activeRunId"> | null | undefined,
): RunId | null {
  if (latestRun === null || latestRun === undefined) return null;
  if (runtime?.activeRunId === latestRun.runId) return null;
  return latestRun.status === "completed" ||
    latestRun.status === "failed" ||
    latestRun.status === "interrupted" ||
    latestRun.status === "cancelled"
    ? latestRun.runId
    : null;
}

/**
 * A request's own run contains the text being amended, so its fork boundary is the latest
 * completed run before it. That run can still be the latest run.
 */
export function forkRunBeforeRequest(
  runs: ReadonlyArray<ForkRunSummary>,
  requestRunId: RunId,
): RunId | null {
  const requestRun = runs.find((run) => run.runId === requestRunId);
  if (requestRun === undefined) return null;
  const candidates = runs
    .filter((run) => run.ordinal < requestRun.ordinal && run.status === "completed")
    .toSorted((left, right) => left.ordinal - right.ordinal);
  const candidate = candidates.at(-1);
  return candidate?.runId ?? null;
}

export function normalizeForkRuns(
  runs: ReadonlyArray<ForkRunSource>,
): ReadonlyArray<ForkRunSummary> {
  return runs.flatMap((run) => {
    const runId = run.runId ?? run.id;
    return runId === undefined ? [] : [{ runId, status: run.status, ordinal: run.ordinal }];
  });
}
