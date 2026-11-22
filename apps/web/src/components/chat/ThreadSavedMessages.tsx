import type { MessageId, ScopedThreadRef } from "@t3tools/contracts";
import { T, useGT } from "gt-react";
import { BookmarkIcon, ChevronDownIcon } from "lucide-react";

import { savedMessages } from "../../state/orchestration";
import { useEnvironmentQuery } from "../../state/query";
import { ThreadDetailsSection } from "./ThreadDetailsSection";
import { SavedMessagePreview } from "./SavedMessagePreview";

export function ThreadSavedMessages({
  threadRef,
  onUnsave,
  onOpenSavedMessage,
}: {
  readonly threadRef: ScopedThreadRef;
  readonly onUnsave: (messageId: MessageId) => Promise<unknown>;
  readonly onOpenSavedMessage: (
    message: import("@t3tools/contracts").OrchestrationV2SavedMessage,
  ) => void;
}) {
  const gt = useGT();
  const query = useEnvironmentQuery(
    savedMessages({
      environmentId: threadRef.environmentId,
      input: { threadIds: [threadRef.threadId] },
    }),
  );
  const messages = query.data?.messages ?? [];
  if (messages.length === 0) return null;

  return (
    <ThreadDetailsSection
      headingId="thread-details-saved-messages-heading"
      title={gt("Saved messages")}
      showHeading={false}
    >
      <div className="flex flex-col">
        <details className="group/saved">
          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md px-2.5 text-sm text-foreground hover:bg-sidebar-row-hover focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
            <BookmarkIcon className="size-3.5 shrink-0 fill-current text-primary" aria-hidden />
            <span className="min-w-0 flex-1 truncate">
              <T>Saved messages</T>
            </span>
            <span className="shrink-0 tabular-nums text-2xs text-muted-foreground">
              {messages.length}
            </span>
            <ChevronDownIcon
              className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open/saved:rotate-180 motion-reduce:transition-none"
              aria-hidden
            />
          </summary>
          <div className="max-h-72 overflow-y-auto">
            {messages.map((message) => (
              <SavedMessagePreview
                key={message.messageId}
                message={message}
                onOpen={() => onOpenSavedMessage(message)}
                onUnsave={() => {
                  void onUnsave(message.messageId).then(() => query.refresh());
                }}
              />
            ))}
          </div>
        </details>
      </div>
    </ThreadDetailsSection>
  );
}
