import "~/index.css";

import { expect, it } from "vite-plus/test";

import { render } from "../../../test/render";
import { ComposerContextUsage } from "./ComposerContextUsage";

const usage = {
  usedTokens: 42_000,
  totalProcessedTokens: null,
  maxTokens: 200_000,
  remainingTokens: 158_000,
  usedPercentage: 21,
  remainingPercentage: 79,
  inputTokens: null,
  cachedInputTokens: null,
  outputTokens: null,
  reasoningOutputTokens: null,
  lastUsedTokens: null,
  lastInputTokens: null,
  lastCachedInputTokens: null,
  lastOutputTokens: null,
  lastReasoningOutputTokens: null,
  toolUses: null,
  durationMs: null,
  compactsAutomatically: true,
  autoCompactThreshold: 180_000,
  cost: null,
  updatedAt: "2026-11-22T08:00:00.000Z",
};

it("shows the live context window and remaining room", async () => {
  await using screen = await render(<ComposerContextUsage usage={usage} />);

  const trigger = screen.getByRole("button", {
    name: "Context usage: 42k of 200k tokens used",
  });
  await expect.element(trigger).toBeVisible();
  await trigger.click();

  await expect.element(screen.getByText("42,000", { exact: true })).toBeVisible();
  await expect.element(screen.getByText("200,000", { exact: true })).toBeVisible();
  await expect.element(screen.getByText("158,000", { exact: true })).toBeVisible();
  await expect.element(screen.getByText("21% used", { exact: true }).first()).toBeVisible();
  await expect.element(screen.getByText("79% remaining", { exact: true })).toBeVisible();
  await expect
    .element(screen.getByRole("progressbar", { name: "Context window used" }))
    .toHaveAttribute("aria-valuenow", "21");
  await expect
    .element(screen.getByText("Compacts automatically at about 180,000 tokens."))
    .toBeVisible();
});

it("hides the control until the provider reports context usage", async () => {
  await using screen = await render(<ComposerContextUsage usage={null} />);

  expect(screen.container.querySelector("[data-chat-composer-context-usage]")).toBeNull();
});
