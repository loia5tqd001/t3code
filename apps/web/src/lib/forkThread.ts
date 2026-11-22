import type { ThreadRunSummary } from "@t3tools/client-runtime/state/models";
import type { ThreadRuntimeSummary } from "@t3tools/client-runtime/state/models";
import type { RunId } from "@t3tools/contracts";

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
