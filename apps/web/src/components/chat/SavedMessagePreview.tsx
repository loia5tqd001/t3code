import { T, useGT } from "gt-react";
import { BookmarkIcon, Trash2Icon } from "lucide-react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { savedMessageHasMoreText, savedMessagePreview } from "./SavedMessagesPanel.logic";
import type { OrchestrationV2SavedMessage } from "@t3tools/contracts";
import { assistantCitationHash } from "../../lib/assistantCitationNavigation";

export function SavedMessagePreview({
  message,
  threadTitle,
  threadRef,
  onOpen,
  onUnsave,
}: {
  readonly message: OrchestrationV2SavedMessage;
  readonly threadTitle?: string;
  readonly threadRef?: import("@t3tools/contracts").ScopedThreadRef;
  readonly onOpen: () => void;
  readonly onUnsave: () => void;
}) {
  const gt = useGT();
  const preview = savedMessagePreview(message);
  return (
    <div className="group/saved-message min-w-0 px-2.5 py-2">
      <div className="flex min-w-0 items-start gap-2">
        <BookmarkIcon className="mt-0.5 size-3 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpen}
            onAuxClick={(event) => {
              if (event.button !== 1 || !threadRef) return;
              event.preventDefault();
              window.open(
                `/${threadRef.environmentId}/${threadRef.threadId}#${assistantCitationHash({
                  version: 1,
                  environmentId: threadRef.environmentId,
                  threadId: threadRef.threadId,
                  messageId: message.messageId,
                  text: message.text || " ",
                  start: 0,
                  end: Math.max(1, message.text.length),
                  prefix: "",
                  suffix: "",
                })}`,
                "_blank",
                "noopener",
              );
            }}
            className={cn(
              "block w-full min-w-0 rounded-sm text-left text-xs leading-5 text-foreground/90 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
              "line-clamp-2",
            )}
          >
            {preview || gt("(empty message)")}
          </button>
          {savedMessageHasMoreText(message) ? (
            <p className="mt-1 text-2xs text-muted-foreground">
              <T>Preview shortened</T>
            </p>
          ) : null}
          <div className="mt-1 flex min-w-0 items-center gap-2 text-2xs text-muted-foreground">
            <span className="shrink-0">{message.role === "user" ? gt("You") : gt("T3 Code")}</span>
            {threadTitle ? <span className="truncate">{threadTitle}</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/saved-message:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="icon-micro"
                  variant="ghost-muted"
                  aria-label={gt("Unsave message")}
                  onClick={onUnsave}
                />
              }
            >
              <Trash2Icon />
            </TooltipTrigger>
            <TooltipPopup>
              <T>Unsave</T>
            </TooltipPopup>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
