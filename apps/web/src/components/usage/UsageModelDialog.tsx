import { T, useGT, useLocale, Var } from "gt-react";
import { formatCount, formatPercent, formatTokens, formatUsd } from "@t3tools/shared/usageFormat";
import {
  isModelCostUnknown,
  type DailyTotals,
  type HourlyTotals,
  type ModelTotals,
} from "@t3tools/shared/usageMerge";

import { mergeAnsweredUsage, type EnvironmentUsageStatus } from "../../state/usage";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "../ui/dialog";
import type { UsageChartMetric } from "./UsageProviderChart";
import { UsageShareBar } from "./UsageShareBar";
import {
  cacheHitRate,
  costPerMillionTokens,
  costTypeSegments,
  speedCostSegments,
  tokenTypeSegments,
} from "./usageBreakdown";
import { PROVIDER_PRESENTATION } from "./usageProviders";

export interface UsageChartWindow {
  readonly days: readonly string[];
  readonly hours: readonly string[];
  readonly resolution: "day" | "hour";
  readonly timeZone: string;
  readonly referenceTime: string | undefined;
  readonly hour12: boolean;
}

const SPARKLINE_WIDTH = 120;
const SPARKLINE_HEIGHT = 32;
const SPARKLINE_PAD = 2;

/** Null when the series is too short or flat zero, so the caller can draw an empty baseline. */
function sparklinePoints(values: readonly number[]): string | null {
  const max = Math.max(0, ...values);
  if (values.length < 2 || max <= 0) return null;
  const plotHeight = SPARKLINE_HEIGHT - SPARKLINE_PAD * 2;
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * SPARKLINE_WIDTH;
      const y = SPARKLINE_PAD + plotHeight * (1 - value / max);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function Sparkline({ values }: { readonly values: readonly number[] }) {
  const points = sparklinePoints(values);
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
      preserveAspectRatio="none"
      className="h-8 w-full shrink-0 text-foreground"
    >
      {points === null ? (
        <line
          x1={0}
          x2={SPARKLINE_WIDTH}
          y1={SPARKLINE_HEIGHT - SPARKLINE_PAD}
          y2={SPARKLINE_HEIGHT - SPARKLINE_PAD}
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeDasharray="3 3"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ) : (
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

function HeadlineMetric({
  label,
  value,
  detail,
  series,
}: {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly series?: readonly number[] | undefined;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border/60 p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="m-0 flex min-w-0 flex-col gap-1.5">
        <span className="truncate text-2xl font-semibold text-foreground tabular-nums">
          {value}
        </span>
        <span className="truncate text-xs text-muted-foreground">{detail}</span>
      </dd>
      {series === undefined ? null : <Sparkline values={series} />}
    </div>
  );
}

function SupportingMetric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="m-0 truncate text-sm font-medium text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

export function UsageModelDialog({
  model,
  environments,
  chartWindow,
  onSetPrice,
  onClose,
}: {
  readonly model: ModelTotals;
  readonly environments: readonly EnvironmentUsageStatus[];
  readonly metric: UsageChartMetric;
  readonly chartWindow: UsageChartWindow;
  readonly onSetPrice: () => void;
  readonly onClose: () => void;
}) {
  const gt = useGT();
  const locale = useLocale();
  const usage = mergeAnsweredUsage(
    environments,
    (bucket) => bucket.provider === model.provider && bucket.model === model.model,
  );
  const presentation = PROVIDER_PRESENTATION[model.provider];
  const costUnknown = isModelCostUnknown(model);
  const hitRate = cacheHitRate(model);
  const perMillion = costPerMillionTokens(model);
  const { tokens } = model;

  const byHour = chartWindow.resolution === "hour";
  const periods = byHour ? chartWindow.hours : chartWindow.days;
  const totals: readonly (DailyTotals | HourlyTotals)[] = byHour ? usage.hourly : usage.daily;
  const byPeriod = new Map(
    totals.map((entry) => ["hourStart" in entry ? entry.hourStart : entry.day, entry]),
  );
  const tokenSeries = periods.map((period) => byPeriod.get(period)?.totalTokens ?? 0);
  const costSeries = periods.map((period) => byPeriod.get(period)?.costUsd ?? 0);
  const peakTokens = Math.max(0, ...tokenSeries);
  const peakCost = Math.max(0, ...costSeries);
  const peakLabel = (formatted: string) =>
    byHour
      ? gt("Peak {value} per hour", { value: formatted })
      : gt("Peak {value} per day", { value: formatted });
  const noActivity = gt("No activity in this period");

  const costDetail = costUnknown
    ? gt("No known price")
    : peakCost > 0
      ? peakLabel(formatUsd(peakCost, locale))
      : noActivity;
  const requestsDetail =
    model.unpricedRecords > 0
      ? gt("{count} without a price", { count: formatCount(model.unpricedRecords, locale) })
      : gt("All priced");
  const outputShare = model.totalTokens > 0 ? tokens.outputTokens / model.totalTokens : 0;

  const supporting = [
    hitRate === null ? null : { label: gt("Cache hit"), value: formatPercent(hitRate) },
    perMillion === null
      ? null
      : { label: gt("Per 1M tokens"), value: formatUsd(perMillion, locale) },
    { label: gt("Cached input"), value: formatTokens(tokens.cachedInputTokens) },
    { label: gt("Cache writes"), value: formatTokens(tokens.cacheCreationTokens) },
    { label: gt("Reasoning"), value: formatTokens(tokens.reasoningTokens) },
    {
      label: gt("Priced requests"),
      value: formatCount(model.records - model.unpricedRecords, locale),
    },
  ].filter((stat) => stat !== null);

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPopup className="max-w-5xl">
        <DialogHeader>
          <div className="flex w-fit min-w-0 max-w-[calc(100%-3rem)] items-center gap-2.5 self-start rounded-full border border-border/60 py-1.5 ps-2.5 pe-3.5">
            <ProviderInstanceIcon
              driverKind={presentation.driverKind}
              displayName={presentation.label}
              iconClassName="size-5"
            />
            <DialogTitle className="sr-only">{model.model}</DialogTitle>
            <DialogDescription className="sr-only">
              {presentation.label}
              {costUnknown
                ? ""
                : ` · ${gt("{share} of cost", { share: formatPercent(model.costShare) })}`}
            </DialogDescription>
            <span
              aria-hidden
              className="truncate text-sm font-medium text-foreground [flex:0_1_auto]"
            >
              {model.model}
            </span>
            <span
              aria-hidden
              className="min-w-0 truncate text-xs text-muted-foreground [flex:1_1_auto]"
            >
              {presentation.label}
              {costUnknown
                ? ""
                : ` · ${gt("{share} of cost", { share: formatPercent(model.costShare) })}`}
            </span>
          </div>
        </DialogHeader>
        <DialogPanel>
          <div className="flex flex-col gap-6">
            <dl className="grid grid-cols-1 gap-3 min-[30rem]:grid-cols-2 lg:grid-cols-4">
              <HeadlineMetric
                label={gt("Total tokens")}
                value={formatTokens(model.totalTokens)}
                detail={peakTokens > 0 ? peakLabel(formatTokens(peakTokens)) : noActivity}
                series={tokenSeries}
              />
              <HeadlineMetric
                label={gt("Estimated API cost")}
                value={costUnknown ? gt("Unpriced") : formatUsd(model.costUsd, locale)}
                detail={costDetail}
                series={costUnknown ? undefined : costSeries}
              />
              <HeadlineMetric
                label={gt("Model requests")}
                value={formatCount(model.records, locale)}
                detail={requestsDetail}
              />
              <HeadlineMetric
                label={gt("Output tokens")}
                value={formatTokens(tokens.outputTokens)}
                detail={gt("{share} of tokens", { share: formatPercent(outputShare) })}
              />
            </dl>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg bg-muted/40 px-4 py-3 min-[30rem]:grid-cols-3 lg:grid-cols-6">
              {supporting.map((stat) => (
                <SupportingMetric key={stat.label} label={stat.label} value={stat.value} />
              ))}
            </dl>

            <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
              {costUnknown ? null : (
                <UsageShareBar
                  label={gt("Cost by type")}
                  segments={costTypeSegments(usage.categoryCost)}
                  format={(value: number) => formatUsd(value, locale)}
                />
              )}
              <UsageShareBar
                label={gt("Tokens by type")}
                segments={tokenTypeSegments(model.tokens)}
                format={formatTokens}
              />
              {usage.speedCost.fast + usage.speedCost.ultrafast > 0 ? (
                <UsageShareBar
                  label={gt("Cost by speed")}
                  segments={speedCostSegments(usage.speedCost)}
                  format={(value: number) => formatUsd(value, locale)}
                  aside={<SpeedPremium premiumUsd={usage.speedCost.premium} />}
                />
              ) : null}
            </div>
          </div>
        </DialogPanel>
        {model.unpricedTokens > 0 ? (
          <DialogFooter variant="bare" className="items-center sm:justify-between">
            <span className="text-xs text-muted-foreground">
              {gt("{tokens} tokens have no known price", {
                tokens: formatTokens(model.unpricedTokens),
              })}
            </span>
            <Button onClick={onSetPrice}>
              <T>Set price</T>
            </Button>
          </DialogFooter>
        ) : null}
      </DialogPopup>
    </Dialog>
  );
}

export function SpeedPremium({ premiumUsd }: { readonly premiumUsd: number }) {
  const locale = useLocale();
  return (
    <span className="text-xs text-muted-foreground">
      <T>
        Premium{" "}
        <span className="text-foreground tabular-nums">
          <Var>{formatUsd(premiumUsd, locale)}</Var>
        </span>
      </T>
    </span>
  );
}
