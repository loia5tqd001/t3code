import { thrownErrorMessage } from "@t3tools/client-runtime/errors";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import { settlePromise, squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type {
  ModelSelection,
  ProviderInteractionMode,
  RunId,
  RuntimeMode,
  ScopedThreadRef,
  ScopedProjectRef,
} from "@t3tools/contracts";
import { useRouter } from "@tanstack/react-router";
import { msg } from "gt-react";

import { m } from "~/i18n/messages";
import { newThreadId } from "~/lib/utils";
import { buildThreadRouteParams } from "~/threadRoutes";
import {
  readThreadShell,
  waitForThreadShell,
  waitForThreadWorkspaceChange,
} from "~/state/entities";
import { threadEnvironment } from "~/state/threads";
import { useAtomCommand } from "~/state/use-atom-command";
import { useOrchestrationCommand } from "~/state/use-orchestration-command";
import { stackedThreadToast, toastManager } from "~/components/ui/toast";

export function useForkThread(input: { readonly onError?: (message: string) => void }) {
  const { onError } = input;
  const router = useRouter();
  const forkFromRun = useAtomCommand(threadEnvironment.forkFromRun, { reportFailure: false });
  const deleteThread = useOrchestrationCommand(threadEnvironment.delete, { reportFailure: false });
  const prepareWorkspace = useOrchestrationCommand(threadEnvironment.prepareWorkspace, {
    reportFailure: false,
  });
  const reportFailure = (title: string, error: unknown) => {
    const message = thrownErrorMessage(error, m) ?? m(msg("An error occurred."));
    onError?.(message);
    toastManager.add(stackedThreadToast({ type: "error", title, description: message }));
  };
  const forkFromRunId = async (input: {
    readonly threadRef: ScopedThreadRef;
    readonly runId: RunId;
    readonly title: string;
  }) => {
    const targetThreadId = newThreadId();
    const targetRef = scopeThreadRef(input.threadRef.environmentId, targetThreadId);
    const result = await forkFromRun({
      environmentId: input.threadRef.environmentId,
      input: {
        sourceThreadId: input.threadRef.threadId,
        targetThreadId,
        runId: input.runId,
        title: input.title,
      },
    });
    if (result._tag === "Failure") {
      reportFailure(m(msg("Could not fork this chat.")), squashAtomCommandFailure(result));
      return null;
    }
    if (!(await waitForThreadShell(targetRef))) {
      onError?.(m(msg("The fork was created, but it did not reach this client.")));
      return null;
    }
    return targetRef;
  };
  const openThread = async (threadRef: ScopedThreadRef) => {
    const navigation = await settlePromise(() =>
      router.navigate({
        to: "/$environmentId/$threadId",
        params: buildThreadRouteParams(threadRef),
      }),
    );
    if (navigation._tag === "Failure") {
      reportFailure(
        m(msg("The fork was created, but it could not be opened.")),
        navigation._tag === "Failure"
          ? squashAtomCommandFailure(navigation)
          : new Error(m(msg("The fork could not be opened."))),
      );
      return false;
    }
    return true;
  };
  const forkSameWorkspace = async (input: {
    readonly threadRef: ScopedThreadRef;
    readonly runId: RunId | null;
    readonly title: string;
  }) => {
    if (input.runId === null) {
      reportFailure(
        m(msg("Could not fork this chat.")),
        new Error(m(msg("This chat needs a completed response before it can be forked."))),
      );
      return false;
    }
    const targetRef = await forkFromRunId({ ...input, runId: input.runId });
    if (targetRef === null) return false;
    return openThread(targetRef);
  };
  const forkInNewWorktree = async (input: {
    readonly threadRef: ScopedThreadRef;
    readonly runId: RunId | null;
    readonly title: string;
    readonly projectRef: ScopedProjectRef;
    readonly branch: string | null;
    readonly modelSelection: ModelSelection;
    readonly runtimeMode: RuntimeMode;
    readonly interactionMode: ProviderInteractionMode;
  }) => {
    if (input.runId === null) {
      reportFailure(
        m(msg("Could not fork this chat.")),
        new Error(m(msg("This chat needs a completed response before it can be forked."))),
      );
      return false;
    }
    if (input.branch === null) {
      reportFailure(
        m(msg("Could not fork this chat.")),
        new Error(m(msg("This chat needs a branch before it can be forked into a new worktree."))),
      );
      return false;
    }
    const title = input.title;
    const target = await forkFromRunId({
      threadRef: input.threadRef,
      runId: input.runId,
      title,
    });
    if (target === null) return false;
    const inheritedWorktreePath = readThreadShell(target)?.worktreePath ?? null;
    const result = await prepareWorkspace({
      environmentId: target.environmentId,
      input: {
        threadId: target.threadId,
        projectId: input.projectRef.projectId,
        title,
        modelSelection: input.modelSelection,
        runtimeMode: input.runtimeMode,
        interactionMode: input.interactionMode,
        workspaceStrategy: {
          type: "worktree",
          baseRef: input.branch,
        },
      },
    });
    if (result._tag === "Failure") {
      reportFailure(m(msg("Could not fork this chat.")), squashAtomCommandFailure(result));
      void deleteThread({
        environmentId: target.environmentId,
        input: { threadId: target.threadId, onlyIfUnused: true },
      });
      return false;
    }
    if (!(await waitForThreadWorkspaceChange(target, inheritedWorktreePath))) {
      onError?.(m(msg("The fork was created, but its new worktree did not reach this client.")));
      return false;
    }
    return openThread(target);
  };
  return { forkSameWorkspace, forkInNewWorktree };
}
