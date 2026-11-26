import type { EnvironmentThreadShell } from "./models.ts";
import { hasUnseenRunFailure } from "./threadSettled.ts";

export type SidebarThreadStatus =
  | "approval"
  | "input"
  | "request"
  | "preparing"
  | "working"
  | "waiting"
  | "failed"
  | "limited"
  | "ready";

export type SidebarThreadIndicator = "attention" | "failed" | "unread" | "working" | null;

export type ThreadCompletionInput = Pick<EnvironmentThreadShell, "latestRun"> & {
  readonly lastVisitedAt?: string | null | undefined;
};

export type SidebarThreadStatusInput = Pick<
  EnvironmentThreadShell,
  | "hasPendingApprovals"
  | "hasPendingUserInput"
  | "pendingSubagentRequest"
  | "pendingGuestMessageCount"
  | "runtime"
  | "blockedOnThreadWait"
>;

export function hasUnseenCompletion(thread: ThreadCompletionInput): boolean {
  if (!thread.latestRun?.completedAt) return false;
  if (thread.latestRun.status === "interrupted" || thread.latestRun.status === "cancelled") {
    return false;
  }
  const completedAt = Date.parse(thread.latestRun.completedAt);
  if (Number.isNaN(completedAt)) return false;
  if (!thread.lastVisitedAt) return false;

  const lastVisitedAt = Date.parse(thread.lastVisitedAt);
  if (Number.isNaN(lastVisitedAt)) return true;
  return completedAt > lastVisitedAt;
}

export function resolveSidebarThreadStatus(thread: SidebarThreadStatusInput): SidebarThreadStatus {
  if (thread.hasPendingApprovals || thread.pendingSubagentRequest === "approval") {
    return "approval";
  }
  if (thread.hasPendingUserInput || thread.pendingSubagentRequest === "user_input") {
    return "input";
  }
  if ((thread.pendingGuestMessageCount ?? 0) > 0) {
    return "request";
  }
  if (thread.runtime?.status === "running" && thread.blockedOnThreadWait === true) {
    return "waiting";
  }
  if (thread.runtime?.status === "preparing") {
    return "preparing";
  }
  if (
    thread.runtime !== null &&
    ["queued", "starting", "running", "waiting"].includes(thread.runtime.status)
  ) {
    return "working";
  }
  if (thread.runtime?.status === "idle") {
    return "waiting";
  }
  if (thread.runtime?.status === "failed") {
    return thread.runtime.lastErrorClass === "usage_limit" ? "limited" : "failed";
  }
  return "ready";
}

/** A failure the user has already opened settles to ready, like Done. */
export function resolveSidebarRowStatus(
  thread: SidebarThreadStatusInput & ThreadCompletionInput,
): SidebarThreadStatus {
  const status = resolveSidebarThreadStatus(thread);
  if (status !== "failed" || thread.latestRun?.status !== "failed") return status;
  return hasUnseenRunFailure(thread) ? status : "ready";
}

export function resolveSidebarThreadIndicator(
  thread: SidebarThreadStatusInput & ThreadCompletionInput,
): SidebarThreadIndicator {
  const status = resolveSidebarRowStatus(thread);
  if (status === "input" || status === "approval" || status === "request" || status === "limited") {
    return "attention";
  }
  if (status === "failed") return "failed";
  if (status === "ready" && hasUnseenCompletion(thread)) return "unread";
  if (status === "working" || status === "preparing") return "working";
  return null;
}

export function resolveSidebarFolderDot(
  threads: ReadonlyArray<SidebarThreadStatusInput & ThreadCompletionInput>,
): Exclude<SidebarThreadIndicator, null> | null {
  const indicators = new Set(threads.map(resolveSidebarThreadIndicator));
  if (indicators.has("attention")) return "attention";
  if (indicators.has("failed")) return "failed";
  if (indicators.has("unread")) return "unread";
  if (indicators.has("working")) return "working";
  return null;
}

export function sidebarIndicatorFromCounts(input: {
  readonly attention: number;
  readonly failed: number;
  readonly completed: number;
  readonly running: number;
}): Exclude<SidebarThreadIndicator, null> | null {
  if (input.attention > 0) return "attention";
  if (input.failed > 0) return "failed";
  if (input.completed > 0) return "unread";
  if (input.running > 0) return "working";
  return null;
}
