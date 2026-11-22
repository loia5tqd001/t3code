import type { EnvironmentId, OrchestrationV2SavedMessage } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

export interface SavedMessageGroup {
  readonly environmentId: EnvironmentId;
  readonly messages: ReadonlyArray<OrchestrationV2SavedMessage>;
}

export function groupSavedMessagesByEnvironment(
  messages: ReadonlyArray<OrchestrationV2SavedMessage & { readonly environmentId: EnvironmentId }>,
): ReadonlyArray<SavedMessageGroup> {
  const groups = new Map<EnvironmentId, Array<OrchestrationV2SavedMessage>>();
  for (const message of messages) {
    const group = groups.get(message.environmentId);
    if (group) group.push(message);
    else groups.set(message.environmentId, [message]);
  }
  return [...groups].map(([environmentId, grouped]) => ({
    environmentId,
    messages: grouped.toSorted(
      (left, right) =>
        DateTime.toEpochMillis(right.savedAt) - DateTime.toEpochMillis(left.savedAt) ||
        right.messageId.localeCompare(left.messageId),
    ),
  }));
}

export function savedMessagePreview(message: OrchestrationV2SavedMessage): string {
  return message.text.replace(/\s+/g, " ").trim();
}

export function savedMessageHasMoreText(message: OrchestrationV2SavedMessage): boolean {
  return message.textLength > message.text.length;
}
