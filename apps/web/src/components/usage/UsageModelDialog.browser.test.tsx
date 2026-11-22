import { describe, expect, it } from "vite-plus/test";
import { page } from "vite-plus/test/browser";

import { render } from "../../../test/render";
import { UsageModelDialog } from "./UsageModelDialog";

const chartWindow = {
  days: [],
  hours: [],
  resolution: "day",
  timeZone: "UTC",
  referenceTime: undefined,
  hour12: false,
} as const;

const model = {
  model: "claude-sonnet-4-5",
  provider: "claude",
  costUsd: 2,
  totalTokens: 1_000_000,
  tokens: {
    uncachedInputTokens: 100_000,
    cachedInputTokens: 800_000,
    cacheCreationTokens: 0,
    outputTokens: 100_000,
    reasoningTokens: 0,
  },
  records: 12,
  unpricedRecords: 0,
  unpricedTokens: 0,
  costShare: 1,
  tokenShare: 1,
} as const;

describe("UsageModelDialog", () => {
  it("exposes each stat as its own label and value to screen readers", async () => {
    await using _screen = await render(
      <UsageModelDialog
        model={model}
        environments={[]}
        metric="cost"
        chartWindow={chartWindow}
        onSetPrice={() => {}}
        onClose={() => {}}
      />,
    );

    const dialog = page.getByRole("dialog");
    for (const [label, value] of [
      ["Total tokens", "1M"],
      ["Estimated API cost", "$2.00"],
      ["Model requests", "12"],
      ["Output tokens", "100K"],
      ["Per 1M tokens", "$2.00"],
      ["Cache hit", "88.9%"],
    ] as const) {
      await expect
        .element(dialog.getByRole("term").getByText(label, { exact: true }))
        .toBeVisible();
      await expect
        .element(dialog.getByRole("definition").getByText(value, { exact: true }).first())
        .toBeVisible();
    }
  });

  it("shows Unpriced instead of a dollar figure when no record has a price", async () => {
    await using _screen = await render(
      <UsageModelDialog
        model={{ ...model, costUsd: 0, unpricedRecords: 12, unpricedTokens: 1_000_000 }}
        environments={[]}
        metric="cost"
        chartWindow={chartWindow}
        onSetPrice={() => {}}
        onClose={() => {}}
      />,
    );

    const dialog = page.getByRole("dialog");
    await expect
      .element(dialog.getByRole("definition").getByText("Unpriced", { exact: true }))
      .toBeVisible();
    await expect.element(dialog.getByText("No known price", { exact: true })).toBeVisible();
    await expect.element(dialog.getByRole("button", { name: "Set price" })).toBeVisible();
  });
});
