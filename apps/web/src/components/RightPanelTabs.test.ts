import type { EnvironmentThreadShell } from "@t3tools/client-runtime/state/models";
import { EnvironmentId, ProjectId, ProviderInstanceId, RunId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { sideChatTabState } from "./RightPanelTabs";

const threadId = ThreadId.make("side-chat-state");
const instanceId = ProviderInstanceId.make("codex");
const shell = {
  environmentId: EnvironmentId.make("environment"),
  id: threadId,
  projectId: ProjectId.make("project"),
  title: "Side chat",
  providerInstanceId: instanceId,
  modelSelection: { instanceId, model: "gpt-5.4" },
  runtimeMode: "full-access",
  interactionMode: "default",
  branch: null,
  worktreePath: null,
  activeProviderThreadId: null,
  latestRun: {
    runId: RunId.make("run"),
    status: "completed",
    requestedAt: "2026-03-17T19:12:28.000Z",
    startedAt: "2026-03-17T19:12:28.000Z",
    completedAt: "2026-03-17T19:12:28.000Z",
    assistantMessageId: null,
  },
  runtime: null,
  lastVisitedAt: null,
} as EnvironmentThreadShell;

describe("sideChatTabState", () => {
  it("keeps a completed side chat visible until it is visited", () => {
    expect(sideChatTabState(shell)).toBe("completed");
  });

  it("clears the completed state once the side chat is visited", () => {
    expect(
      sideChatTabState({
        ...shell,
        lastVisitedAt: "2026-03-17T19:13:00.000Z",
      }),
    ).toBeNull();
  });
});
