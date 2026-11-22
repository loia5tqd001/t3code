import type {
  OrchestrationV2ProviderTurn,
  OrchestrationV2Run,
  ProviderInstanceId,
  ServerProvider,
  ServerProviderUsageLimits,
  ServerProviderUsageWindow,
  UsageLimitSourceSnapshots,
} from "@t3tools/contracts";
import {
  type LimitPace,
  type LimitPoolWindow,
  paceOf,
  paceRemainingPercent,
  remainingPercent,
} from "@t3tools/shared/usageLimits";
import {
  formatDuration as formatLimitDuration,
  limitsNotice,
} from "@t3tools/shared/usageLimitsCopy";
import { formatDuration as formatRunDuration } from "@t3tools/shared/orchestrationTimingCopy";
import { formatCount, formatPercent, formatTokens } from "@t3tools/shared/usageFormat";
import { Link } from "@tanstack/react-router";
import { msg, useGT, useLocale, useMessages } from "gt-react";
import type { ReactNode } from "react";

import { usePrimarySettings } from "../../hooks/useSettings";
import { useNowMinute } from "../../hooks/useNowMinute";
import type { ContextWindowSnapshot } from "@t3tools/client-runtime/state/context-window";
import { formatContextWindowTokens } from "../../lib/contextWindow";
import { cn } from "../../lib/utils";
import { formatUpcomingTimestamp } from "../../timestampFormat";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { formatContextWindowCompactionMessage } from "./compaction.logic";
import { tokenTypeSegments } from "../usage/usageBreakdown";
import { ThreadDetailsSection } from "./ThreadDetailsSection";
import { deriveThreadUsageMetrics } from "./threadUsageMetrics";
import { nextPoolReset, poolSources, resolveThreadDetailsLimits } from "./ThreadDetailsUsage.logic";

const PACE_LABEL: Record<LimitPace, string> = {
  ahead: msg("Ahead of pace"),
  on: msg("On pace"),
  under: msg("Under pace"),
};

export interface ThreadDetailsUsageInput {
  readonly providerInstanceId: ProviderInstanceId | null;
  readonly model: string | null;
  readonly providers: readonly ServerProvider[];
  readonly sources: UsageLimitSourceSnapshots;
  readonly contextWindow: ContextWindowSnapshot | null;
  /** The thread's runs and provider turns, for its all-time totals. Null until the thread loads. */
  readonly activity: {
    readonly runs: ReadonlyArray<OrchestrationV2Run>;
    readonly providerTurns: ReadonlyArray<OrchestrationV2ProviderTurn>;
  } | null;
}

type UsageTone = "error" | "warning" | null;

function limitTone(left: number): UsageTone {
  if (left <= 10) return "error";
  if (left <= 20) return "warning";
  return null;
}

/** The selected provider's limit windows. Each row reads as room left and opens the usage page. */
export function ThreadDetailsUsage({
  providerInstanceId,
  model,
  providers,
  sources,
}: Omit<ThreadDetailsUsageInput, "contextWindow" | "activity">) {
  const gt = useGT();
  const nowMinute = useNowMinute();
  const now = Date.parse(`${nowMinute}:00Z`);
  const resolved = resolveThreadDetailsLimits(providerInstanceId, model, providers, sources, now);
  if (!resolved) return null;

  return (
    <ThreadDetailsSection
      headingId="thread-details-usage-heading"
      title={gt("Usage limits")}
      showHeading={false}
    >
      <div className="grid grid-cols-[auto_minmax(3rem,1fr)_auto] gap-x-3 text-xs">
        {resolved.kind === "pool" ? (
          resolved.windows.map((window) => <PoolRow key={window.id} window={window} now={now} />)
        ) : (
          <InstanceRows limits={resolved.limits} now={now} />
        )}
      </div>
    </ThreadDetailsSection>
  );
}

function InstanceRows({
  limits,
  now,
}: {
  readonly limits: ServerProviderUsageLimits;
  readonly now: number;
}) {
  const gt = useGT();
  const m = useMessages();
  const notice = limitsNotice(limits, m);
  if (notice) {
    return (
      <UsageRow
        label={gt("Limits", { $context: "usage limits row label" })}
        fill={null}
        tone={null}
        value={gt("Unavailable")}
        tooltip={<span className="text-foreground">{notice}</span>}
        opensUsage
      />
    );
  }
  return limits.windows.map((window) => <LimitRow key={window.id} window={window} now={now} />);
}

/** The thread's context window. The bar fills as context is used; the tick marks auto-compaction. */
export function ThreadDetailsContext({ usage }: { readonly usage: ContextWindowSnapshot }) {
  const maxTokens = usage.maxTokens != null && usage.maxTokens > 0 ? usage.maxTokens : null;
  const used =
    maxTokens !== null && usage.usedPercentage !== null
      ? Math.round(Math.max(0, Math.min(100, usage.usedPercentage)))
      : null;
  const threshold = usage.autoCompactThreshold ?? null;
  const tick =
    maxTokens !== null && threshold !== null && threshold > 0 && threshold < maxTokens
      ? (threshold / maxTokens) * 100
      : null;
  const gt = useGT();
  const m = useMessages();
  const locale = useLocale();
  const usedTokens = formatContextWindowTokens(usage.usedTokens);
  return (
    <ThreadDetailsSection
      headingId="thread-details-context-heading"
      title={gt("Context window")}
      showHeading={false}
    >
      <div className="grid grid-cols-[auto_minmax(3rem,1fr)_auto] gap-x-3 text-xs">
        <UsageRow
          label={gt("Context", { $context: "context window row label" })}
          fill={used}
          tone={used === null ? null : used >= 90 ? "error" : used >= 80 ? "warning" : null}
          tick={tick}
          muted
          value={
            maxTokens !== null
              ? `${usedTokens} / ${formatContextWindowTokens(maxTokens)}`
              : usedTokens
          }
          ariaValue={
            used !== null
              ? gt("{used}% used", { used })
              : gt("{usedTokens} tokens used", { usedTokens })
          }
          tooltip={
            <>
              <span className="text-foreground">
                {used !== null
                  ? gt("Context: {used}% used", { used })
                  : gt("Context: {usedTokens} tokens used", { usedTokens })}
              </span>
              {maxTokens !== null ? (
                <span className="text-muted-foreground">
                  {gt("{used} of {max} tokens", {
                    used: usage.usedTokens.toLocaleString(locale),
                    max: maxTokens.toLocaleString(locale),
                  })}
                </span>
              ) : null}
              {threshold !== null && threshold > 0 ? (
                <span className="text-muted-foreground">
                  {formatContextWindowCompactionMessage(threshold, m)}
                </span>
              ) : null}
            </>
          }
        />
      </div>
    </ThreadDetailsSection>
  );
}

function LimitRow({
  window,
  now,
}: {
  readonly window: ServerProviderUsageWindow;
  readonly now: number;
}) {
  const gt = useGT();
  const m = useMessages();
  const timestampFormat = usePrimarySettings((settings) => settings.timestampFormat);
  const left = remainingPercent(window);
  const pace = paceOf(window, now);
  const timeLeft = paceRemainingPercent(window, now);
  const resetsAt = window.resetsAt ? Date.parse(window.resetsAt) : Number.NaN;
  return (
    <UsageRow
      label={window.label}
      fill={left}
      tone={limitTone(left)}
      tick={timeLeft}
      value={`${left}%`}
      ariaValue={gt("{left}% left", { left })}
      opensUsage
      tooltip={
        <>
          <span className="text-foreground">
            {gt("{label}: {left}% left", { label: window.label, left })}
          </span>
          {pace && timeLeft !== null ? (
            <span className="text-muted-foreground">
              {m(PACE_LABEL[pace])} · {gt("{timeLeft}% of the window left", { timeLeft })}
            </span>
          ) : null}
          {window.resetsAt && resetsAt > now ? (
            <span className="text-muted-foreground">
              {gt("Resets in {duration} · {time}", {
                duration: formatLimitDuration(resetsAt - now, m),
                time: formatUpcomingTimestamp(window.resetsAt, timestampFormat, now, undefined, m),
              })}
            </span>
          ) : null}
        </>
      }
    />
  );
}

function PoolRow({ window, now }: { readonly window: LimitPoolWindow; readonly now: number }) {
  const gt = useGT();
  const m = useMessages();
  const timestampFormat = usePrimarySettings((settings) => settings.timestampFormat);
  const left = window.remainingPercent;
  const accounts = window.members.length;
  const from = poolSources(window);
  const sourceLabels = [...from.hubs, ...(from.signedIn ? [gt("Signed-in accounts")] : [])];
  const next = nextPoolReset(window, now);
  const resetsAt = next?.member.window.resetsAt;
  const reset =
    next && resetsAt
      ? {
          duration: formatLimitDuration(next.at - now, m),
          time: formatUpcomingTimestamp(resetsAt, timestampFormat, now, undefined, m),
        }
      : null;
  return (
    <UsageRow
      label={window.label}
      fill={left}
      tone={limitTone(left)}
      value={`${left}%`}
      ariaValue={gt("{left}% left", { left })}
      opensUsage
      tooltip={
        <>
          <span className="text-foreground">
            {accounts > 1
              ? gt("{label}: {left}% left across {accounts} accounts", {
                  label: window.label,
                  left,
                  accounts,
                })
              : gt("{label}: {left}% left", { label: window.label, left })}
          </span>
          {window.pace ? (
            <span className="text-muted-foreground">{m(PACE_LABEL[window.pace])}</span>
          ) : null}
          {next && reset ? (
            <span className="text-muted-foreground">
              {accounts > 1
                ? gt("+{percent}% in {duration} · {time}", {
                    percent: next.restoresPercent,
                    ...reset,
                  })
                : gt("Resets in {duration} · {time}", reset)}
            </span>
          ) : null}
          {sourceLabels.length > 0 ? (
            <span className="text-muted-foreground">
              {gt("From {sources}", { sources: sourceLabels.join(", ") })}
            </span>
          ) : null}
        </>
      }
    />
  );
}

/** One label, hairline, and value row; the whole row opens the details tooltip. With `opensUsage` it links to the usage page. */
function UsageRow({
  label,
  fill,
  tone,
  tick = null,
  value,
  ariaValue = value,
  tooltip,
  muted = false,
  opensUsage = false,
}: {
  readonly label: string;
  /** Bar fill from 0 to 100. Null hides the bar. */
  readonly fill: number | null;
  readonly tone: UsageTone;
  /** A marker on the bar, from 0 to 100. */
  readonly tick?: number | null;
  readonly value: string;
  readonly ariaValue?: string;
  readonly tooltip: ReactNode;
  readonly muted?: boolean;
  readonly opensUsage?: boolean;
}) {
  const gt = useGT();
  const rowProps = {
    "aria-label": gt("{label}: {value}", { label, value: ariaValue }),
    className: cn(
      "col-span-3 grid h-6 grid-cols-subgrid items-center rounded-lg px-2.5 outline-none hover:bg-black/[0.035] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-popup-open:bg-black/[0.035] dark:hover:bg-white/[0.08] dark:data-popup-open:bg-white/[0.08]",
      opensUsage
        ? "group cursor-pointer active:bg-black/[0.06] dark:active:bg-white/[0.12]"
        : "cursor-default",
    ),
  };
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          opensUsage ? <Link to="/usage" {...rowProps} /> : <div tabIndex={0} {...rowProps} />
        }
      >
        <span className="max-w-28 truncate text-muted-foreground group-hover:text-foreground">
          {label}
        </span>
        {fill !== null ? (
          <span className="relative h-[3px] rounded-full bg-muted-foreground/30 dark:bg-muted-foreground/20">
            {fill > 0 ? (
              <span
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  tone === "error"
                    ? "bg-error"
                    : tone === "warning"
                      ? "bg-warning"
                      : muted
                        ? "bg-muted-foreground"
                        : "bg-foreground/80",
                )}
                style={{ width: `max(${fill}%, 6px)` }}
              />
            ) : null}
            {tick !== null ? (
              <span
                aria-hidden
                className="absolute -top-[3px] h-[9px] w-px -translate-x-1/2 bg-foreground/75"
                style={{ left: `clamp(0.5px, ${tick}%, calc(100% - 0.5px))` }}
              />
            ) : null}
          </span>
        ) : null}
        <span
          className={cn(
            // Text-only rows span the bar column so they never widen the shared value column.
            "text-end font-medium tabular-nums",
            fill === null && "col-span-2",
            tone === "error"
              ? "text-error-foreground"
              : tone === "warning"
                ? "text-warning-foreground"
                : fill === null
                  ? "text-muted-foreground"
                  : "text-foreground/80",
          )}
        >
          {value}
        </span>
      </TooltipTrigger>
      {/* Rows sit 8px inside the card; clear its edge instead of overlapping it. */}
      <TooltipPopup side="left" sideOffset={16}>
        <div className="flex flex-col gap-0.5">
          {tooltip}
          {opensUsage ? <span className="text-muted-foreground">{gt("Open usage")}</span> : null}
        </div>
      </TooltipPopup>
    </Tooltip>
  );
}

interface MetricTile {
  readonly label: string;
  readonly value: string;
  readonly detail: string | null;
}

/** All-time totals for the thread: what providers reported per turn, plus how long prompts ran. */
export function ThreadDetailsMetrics({
  activity,
}: {
  readonly activity: NonNullable<ThreadDetailsUsageInput["activity"]>;
}) {
  const gt = useGT();
  const m = useMessages();
  const locale = useLocale();
  const metrics = deriveThreadUsageMetrics(activity.providerTurns, activity.runs);
  const { tokens, prompts, reportedTurns, runTime } = metrics;
  if (tokens === null && prompts === 0) return null;

  const tiles: MetricTile[] = [];
  if (prompts > 0) {
    tiles.push({
      label: gt("Prompts"),
      value: formatCount(prompts, locale),
      detail:
        tokens === null
          ? null
          : gt("{count} per prompt", { count: formatTokens(tokens.totalTokens / prompts) }),
    });
  }
  if (tokens !== null && reportedTurns > 0) {
    tiles.push({
      label: gt("Turns"),
      value: formatCount(reportedTurns, locale),
      detail: gt("{count} per turn", { count: formatTokens(tokens.totalTokens / reportedTurns) }),
    });
  }
  if (tokens !== null) {
    tiles.push({
      label: gt("Output", { $context: "output tokens" }),
      value: formatTokens(tokens.outputTokens),
      detail:
        tokens.reasoningTokens > 0
          ? gt("{count} reasoning", { count: formatTokens(tokens.reasoningTokens) })
          : null,
    });
  }
  if (metrics.cacheHitRate !== null && tokens !== null) {
    tiles.push({
      label: gt("Cache hit"),
      value: formatPercent(metrics.cacheHitRate, 0),
      detail: gt("{count} cached", { count: formatTokens(tokens.cachedInputTokens) }),
    });
  }
  if (runTime !== null) {
    tiles.push(
      {
        label: gt("Run time"),
        value: formatRunDuration(runTime.totalMs, m),
        detail: gt("{duration} average", { duration: formatRunDuration(runTime.averageMs, m) }),
      },
      {
        label: gt("Longest run"),
        value: formatRunDuration(runTime.longestMs, m),
        detail: null,
      },
    );
  }

  const segments =
    tokens === null ? [] : tokenTypeSegments(tokens).filter((segment) => segment.value > 0);
  const inputTokens =
    tokens === null
      ? 0
      : tokens.uncachedInputTokens + tokens.cachedInputTokens + tokens.cacheCreationTokens;

  return (
    <ThreadDetailsSection
      headingId="thread-details-metrics-heading"
      title={gt("Thread usage")}
      showHeading={false}
    >
      <div className="flex flex-col gap-3 px-2.5 py-1 text-xs">
        {tokens !== null ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <div
                  tabIndex={0}
                  aria-label={gt("{label}: {value}", {
                    label: gt("Processed tokens"),
                    value: tokens.totalTokens.toLocaleString(locale),
                  })}
                  className="flex cursor-default flex-col gap-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                />
              }
            >
              <span className="flex items-baseline justify-between gap-2 text-2xs text-muted-foreground">
                <span className="truncate">{gt("Processed tokens")}</span>
                {metrics.partial ? <span className="shrink-0">{gt("Partial")}</span> : null}
              </span>
              <span className="text-xl leading-6 font-semibold text-foreground tabular-nums">
                {formatTokens(tokens.totalTokens)}
              </span>
              <span aria-hidden className="flex h-1.5 gap-px overflow-hidden rounded-full">
                {segments.map((segment) => (
                  <span
                    key={segment.label}
                    className="h-full min-w-0.5"
                    style={{ flex: `${segment.value} 1 0`, backgroundColor: segment.color }}
                  />
                ))}
              </span>
              <span className="truncate text-muted-foreground tabular-nums">
                {gt("{input} in · {output} out", {
                  input: formatTokens(inputTokens),
                  output: formatTokens(tokens.outputTokens),
                })}
              </span>
            </TooltipTrigger>
            <TooltipPopup side="left" sideOffset={16}>
              <div className="flex flex-col gap-0.5">
                {segments.map((segment) => (
                  <span key={segment.label} className="text-muted-foreground">
                    <span className="text-foreground">{m(segment.label)}</span>
                    {" · "}
                    {segment.value.toLocaleString(locale)}
                    {" · "}
                    {formatPercent(segment.value / tokens.totalTokens)}
                  </span>
                ))}
                {tokens.reasoningTokens > 0 ? (
                  <span className="text-muted-foreground">
                    {gt("Output includes {count} reasoning tokens", {
                      count: tokens.reasoningTokens.toLocaleString(locale),
                    })}
                  </span>
                ) : null}
                {metrics.partial ? (
                  <span className="text-muted-foreground">
                    {gt("Some turns reported no token usage, so the total is a floor.")}
                  </span>
                ) : null}
              </div>
            </TooltipPopup>
          </Tooltip>
        ) : null}
        <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
          {tiles.map((tile) => (
            <div key={tile.label} className="flex min-w-0 flex-col">
              <dt className="truncate text-2xs text-muted-foreground">{tile.label}</dt>
              <dd className="truncate text-sm font-medium text-foreground tabular-nums">
                {tile.value}
              </dd>
              <dd className="min-h-4 truncate text-2xs text-muted-foreground tabular-nums">
                {tile.detail}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </ThreadDetailsSection>
  );
}
