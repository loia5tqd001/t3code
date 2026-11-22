import { describe, expect, it } from "vite-plus/test";
import * as DateTime from "effect/DateTime";
import { EnvironmentId, MessageId, ProjectId, ThreadId } from "@t3tools/contracts";

import {
  groupSavedMessagesByEnvironment,
  savedMessageHasMoreText,
  savedMessagePreview,
} from "./SavedMessagesPanel.logic";

const saved = (id: string, seconds: number, text = "Message") => ({
  messageId: MessageId.make(id),
  threadId: ThreadId.make("thread"),
  projectId: ProjectId.make("project"),
  threadTitle: "Thread",
  role: "assistant" as const,
  text,
  textLength: text.length,
  savedAt: DateTime.makeUnsafe(`2026-01-01T00:00:${String(seconds).padStart(2, "0")}Z`),
  messageCreatedAt: DateTime.makeUnsafe("2026-01-01T00:00:00Z"),
});

describe("saved messages", () => {
  it("groups by environment and orders newest saves first", () => {
    const first = EnvironmentId.make("first");
    const second = EnvironmentId.make("second");
    const groups = groupSavedMessagesByEnvironment([
      { ...saved("older", 1), environmentId: first },
      { ...saved("newer", 2), environmentId: first },
      { ...saved("other", 3), environmentId: second },
    ]);

    expect(groups.map((group) => group.environmentId)).toEqual([first, second]);
    expect(groups[0]?.messages.map((message) => message.messageId)).toEqual(["newer", "older"]);
  });

  it("uses one-line previews and identifies server-truncated text", () => {
    const message = { ...saved("preview", 1, "  First\nsecond  "), textLength: 100 };
    expect(savedMessagePreview(message)).toBe("First second");
    expect(savedMessageHasMoreText(message)).toBe(true);
  });
});
