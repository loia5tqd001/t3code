import type { ThreadRunSummary, ThreadRuntimeSummary } from "@t3tools/client-runtime/state/models";
import { ProviderInstanceId, RunId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { summarizeSideChats } from "./SidebarThreadRow";

const providerInstanceId = ProviderInstanceId.make("codex");

function sideChat(
  overrides: Partial<{
    hasPendingApprovals: boolean;
    hasPendingUserInput: boolean;
    hasActionableProposedPlan: boolean;
    interactionMode: "default";
    pendingSubagentRequest: null;
    runtime: ThreadRuntimeSummary | null;
    latestRun: ThreadRunSummary | null;
    lastVisitedAt: string | null;
  }>,
): Parameters<typeof summarizeSideChats>[0][number] {
  return {
    hasPendingApprovals: false,
    hasPendingUserInput: false,
    hasActionableProposedPlan: false,
    interactionMode: "default",
    pendingSubagentRequest: null,
    runtime: null,
    latestRun: null,
    lastVisitedAt: null,
    ...overrides,
  };
}

describe("summarizeSideChats", () => {
  it("distinguishes running, attention, completed, and failed side chats", () => {
    const running = sideChat({
      runtime: {
        status: "running",
        activeRunId: null,
        providerInstanceId,
        providerName: null,
        lastError: null,
        updatedAt: "2026-03-09T10:00:00.000Z",
      },
    });
    const attention = sideChat({ hasPendingApprovals: true });
    const completed = sideChat({
      runtime: {
        status: "completed",
        activeRunId: null,
        providerInstanceId,
        providerName: null,
        lastError: null,
        updatedAt: "2026-03-09T10:00:00.000Z",
      },
      latestRun: {
        runId: RunId.make("run-1"),
        status: "completed",
        requestedAt: "2026-03-09T10:00:00.000Z",
        startedAt: "2026-03-09T10:00:00.000Z",
        completedAt: "2026-03-09T10:00:01.000Z",
        assistantMessageId: null,
      },
      lastVisitedAt: "2026-03-09T09:59:00.000Z",
    });
    const failed = sideChat({
      runtime: {
        status: "failed",
        activeRunId: null,
        providerInstanceId,
        providerName: null,
        lastError: "failed",
        updatedAt: "2026-03-09T10:00:00.000Z",
      },
    });

    expect(summarizeSideChats([running, attention, completed, failed])).toEqual({
      running: 1,
      attention: 1,
      completed: 1,
      failed: 1,
    });
  });

  it("does not show a badge when there are no side chats", () => {
    expect(summarizeSideChats([])).toBeNull();
  });

  it("does not show a badge when every side chat has already been seen", () => {
    expect(
      summarizeSideChats([
        sideChat({
          latestRun: {
            runId: RunId.make("seen-run"),
            status: "completed",
            requestedAt: "2026-03-09T10:00:00.000Z",
            startedAt: "2026-03-09T10:00:00.000Z",
            completedAt: "2026-03-09T10:00:01.000Z",
            assistantMessageId: null,
          },
          lastVisitedAt: "2026-03-09T10:01:00.000Z",
        }),
      ]),
    ).toBeNull();
  });
});
