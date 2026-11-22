import { T, useGT } from "gt-react";
import { ArrowUpRightIcon, Trash2Icon } from "lucide-react";

import { cn } from "../../lib/utils";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { savedMessageHasMoreText, savedMessagePreview } from "./SavedMessagesPanel.logic";
import type { OrchestrationV2SavedMessage } from "@t3tools/contracts";

export function SavedMessagePreview({
  message,
  threadTitle,
  onOpen,
  onUnsave,
}: {
  readonly message: OrchestrationV2SavedMessage;
  readonly threadTitle?: string;
  readonly onOpen: () => void;
  readonly onUnsave: () => void;
}) {
  const gt = useGT();
  const preview = savedMessagePreview(message);
  return (
    <div className="group/saved-message min-w-0 px-2.5 py-2.5">
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpen}
            className={cn(
              "block w-full min-w-0 rounded-sm text-left text-xs leading-5 text-foreground/90 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
              "line-clamp-2",
            )}
          >
            {preview || gt("(empty message)")}
          </button>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-2xs text-muted-foreground">
            <span className="shrink-0">{message.role === "user" ? gt("You") : gt("T3 Code")}</span>
            {threadTitle ? <span className="truncate">{threadTitle}</span> : null}
            {savedMessageHasMoreText(message) ? (
              <span className="shrink-0">
                <T>Shortened</T>
              </span>
            ) : null}
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
                  aria-label={gt("Open saved message")}
                  onClick={onOpen}
                />
              }
            >
              <ArrowUpRightIcon />
            </TooltipTrigger>
            <TooltipPopup>
              <T>Open message</T>
            </TooltipPopup>
          </Tooltip>
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
