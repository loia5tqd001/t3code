import * as DateTime from "effect/DateTime";
import { describe, expect, it } from "vite-plus/test";

import { deriveThreadUsageMetrics } from "./threadUsageMetrics";

type Turn = Parameters<typeof deriveThreadUsageMetrics>[0][number];
type Run = Parameters<typeof deriveThreadUsageMetrics>[1][number];

const common = { usageScope: "main_agent", hasSubagents: false } as const;

function turn(usage: Turn["turnTokenUsage"], status: Turn["status"] = "completed"): Turn {
  return { status, turnTokenUsage: usage };
}

function run(startedAt: string | null, completedAt: string | null): Run {
  return {
    startedAt: startedAt === null ? null : DateTime.makeUnsafe(startedAt),
    completedAt: completedAt === null ? null : DateTime.makeUnsafe(completedAt),
  };
}

describe("deriveThreadUsageMetrics", () => {
  it("sums reported turns and splits input into uncached, cache read, and cache write", () => {
    const metrics = deriveThreadUsageMetrics(
      [
        turn({
          ...common,
          usageStatus: "complete",
          inputTokens: 1_000,
          cachedInputTokens: 600,
          cacheCreationTokens: 100,
          outputTokens: 50,
          reasoningTokens: 20,
        }),
        turn({ ...common, usageStatus: "complete", inputTokens: 400, outputTokens: 10 }),
      ],
      [],
    );
    expect(metrics.tokens).toEqual({
      uncachedInputTokens: 700,
      cachedInputTokens: 600,
      cacheCreationTokens: 100,
      outputTokens: 60,
      reasoningTokens: 20,
      totalTokens: 1_460,
    });
    expect(metrics.cacheHitRate).toBeCloseTo(600 / 1_400);
    expect(metrics.reportedTurns).toBe(2);
    expect(metrics.partial).toBe(false);
  });

  it("flags turns without a usage report instead of guessing, and skips local commands", () => {
    const metrics = deriveThreadUsageMetrics(
      [
        turn({ ...common, usageStatus: "complete", inputTokens: 100, outputTokens: 10 }),
        turn(undefined),
        turn({ ...common, usageStatus: "unavailable" }),
        turn({
          ...common,
          usageStatus: "complete",
          localCommand: true,
          inputTokens: 9,
          outputTokens: 9,
        }),
        turn(undefined, "pending"),
      ],
      [],
    );
    expect(metrics.tokens?.totalTokens).toBe(110);
    expect(metrics.reportedTurns).toBe(1);
    expect(metrics.partial).toBe(true);
  });

  it("reports no token totals when no turn reported usage", () => {
    const metrics = deriveThreadUsageMetrics([turn(undefined)], []);
    expect(metrics.tokens).toBeNull();
    expect(metrics.cacheHitRate).toBeNull();
  });

  it("times finished prompts and counts every prompt that started", () => {
    const metrics = deriveThreadUsageMetrics(
      [],
      [
        run("2026-11-22T08:00:00.000Z", "2026-11-22T08:00:10.000Z"),
        run("2026-11-22T08:01:00.000Z", "2026-11-22T08:01:50.000Z"),
        run("2026-11-22T08:05:00.000Z", null),
        run(null, null),
      ],
    );
    expect(metrics.prompts).toBe(3);
    expect(metrics.runTime).toEqual({ totalMs: 60_000, averageMs: 30_000, longestMs: 50_000 });
  });
});
