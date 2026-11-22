import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import type { ContextWindowSnapshot } from "@t3tools/client-runtime/state/context-window";
import type { ComposerControlSize } from "./ComposerControl";
import { formatContextWindowTokens } from "~/lib/contextWindow";
import { cn } from "~/lib/utils";
import { useGT, useLocale, useMessages } from "gt-react";
import { GaugeIcon } from "lucide-react";
import { ComposerControl, ComposerControlIcon } from "./ComposerControl";
import { formatContextWindowCompactionMessage } from "./compaction.logic";
import { useComposerMenuProps } from "./composerEventScope";

function usedTone(percentage: number | null): "error" | "warning" | null {
  if (percentage === null) return null;
  if (percentage >= 90) return "error";
  if (percentage >= 80) return "warning";
  return null;
}

export function ComposerContextUsage({
  usage,
  size = "sm",
}: {
  readonly usage: ContextWindowSnapshot | null;
  readonly size?: ComposerControlSize;
}) {
  const gt = useGT();
  const m = useMessages();
  const locale = useLocale();
  const composerFloatingLayerProps = useComposerMenuProps();
  if (usage === null) return null;

  const maxTokens = usage.maxTokens != null && usage.maxTokens > 0 ? usage.maxTokens : null;
  const used = usage.usedPercentage === null ? null : Math.round(usage.usedPercentage);
  const remaining =
    usage.remainingPercentage === null ? null : Math.round(usage.remainingPercentage);
  const tone = usedTone(used);
  const usedTokens = formatContextWindowTokens(usage.usedTokens);
  const maxTokensLabel = formatContextWindowTokens(maxTokens);
  const summary =
    maxTokens !== null
      ? gt("{used} of {max} tokens used", { used: usedTokens, max: maxTokensLabel })
      : gt("{used} tokens used", { used: usedTokens });
  const detailRows: ReadonlyArray<{
    readonly key: string;
    readonly label: string;
    readonly value: string;
  }> = [
    { key: "used", label: gt("Used"), value: usage.usedTokens.toLocaleString(locale) },
    ...(maxTokens !== null
      ? [{ key: "total", label: gt("Total"), value: maxTokens.toLocaleString(locale) }]
      : []),
    ...(usage.remainingTokens != null
      ? [
          {
            key: "remaining",
            label: gt("Remaining"),
            value: usage.remainingTokens.toLocaleString(locale),
          },
        ]
      : []),
  ];

  return (
    <Popover>
      <PopoverTrigger
        render={
          <ComposerControl
            size={size}
            aria-label={gt("Context usage: {summary}", { summary })}
            data-chat-composer-context-usage="true"
          />
        }
      >
        <ComposerControlIcon
          icon={GaugeIcon}
          size={size}
          className={cn(
            tone === "error"
              ? "text-error-foreground"
              : tone === "warning"
                ? "text-warning-foreground"
                : undefined,
          )}
        />
        <span data-composer-control-label className="tabular-nums">
          {maxTokens !== null ? `${usedTokens} / ${maxTokensLabel}` : usedTokens}
        </span>
      </PopoverTrigger>
      <PopoverPopup
        side="top"
        align="end"
        width="sm"
        padding="compact"
        {...composerFloatingLayerProps}
      >
        <div className="flex flex-col gap-3 p-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-medium text-foreground">{gt("Context usage")}</div>
              <div className="mt-0.5 text-muted-foreground">{summary}</div>
            </div>
            {used !== null ? (
              <div
                className={cn(
                  "rounded-full px-2 py-0.5 font-medium tabular-nums",
                  tone === "error"
                    ? "bg-error/15 text-error-foreground"
                    : tone === "warning"
                      ? "bg-warning/15 text-warning-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {gt("{used}% used", { used })}
              </div>
            ) : null}
          </div>
          {maxTokens !== null ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>{gt("{used}% used", { used: used ?? 0 })}</span>
                <span>{gt("{remaining}% remaining", { remaining: remaining ?? 0 })}</span>
              </div>
              <div
                role="progressbar"
                aria-label={gt("Context window used")}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={used ?? 0}
                className="relative h-1.5 overflow-hidden rounded-full bg-muted-foreground/20"
              >
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full",
                    tone === "error"
                      ? "bg-error"
                      : tone === "warning"
                        ? "bg-warning"
                        : "bg-foreground/70",
                  )}
                  style={{ width: `${Math.max(0, Math.min(100, used ?? 0))}%` }}
                />
              </div>
            </div>
          ) : null}
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
            {detailRows.map(({ key, label, value }) => (
              <div key={key} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-end font-medium text-foreground tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          {usage.autoCompactThreshold != null && usage.autoCompactThreshold > 0 ? (
            <div className="border-t border-border/60 pt-2 text-muted-foreground">
              {formatContextWindowCompactionMessage(usage.autoCompactThreshold, m, locale)}
            </div>
          ) : null}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
