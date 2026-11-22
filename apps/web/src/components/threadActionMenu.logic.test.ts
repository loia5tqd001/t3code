import { describe, expect, it } from "vite-plus/test";

import { buildThreadActionMenuItems, type ThreadActionMenuState } from "./threadActionMenu.logic";

const baseState: ThreadActionMenuState = {
  canOperate: true,
  canFork: true,
  latestStableRunId: "run-1",
  branch: null,
  projectFilter: null,
  isPinned: false,
  isSettled: false,
  autoSettleEnabled: true,
  isSnoozed: false,
  canSnoozeNow: true,
  isRegeneratingTitle: false,
  isRunning: false,
  supports: {
    settlement: true,
    autoSettleOptOut: true,
    snooze: true,
    pinning: true,
    titleRegeneration: true,
  },
  snoozePresets: [
    { id: "hour", label: "In 1 hour", whenLabel: "3:00 PM", snoozedUntil: "2026-08-07T15:00:00Z" },
  ],
};

describe("buildThreadActionMenuItems", () => {
  it.each([false, true])(
    "disables both lifecycle directions without permission (reversed: %s)",
    (reversed) => {
      const items = buildThreadActionMenuItems({
        ...baseState,
        canOperate: false,
        isPinned: reversed,
        isSettled: reversed,
        isSnoozed: reversed,
      });
      const expected = reversed
        ? [
            "unpin",
            "unsettle",
            "unsnooze",
            "rename",
            "regenerate-title",
            "auto-settle",
            "archive",
            "delete",
          ]
        : [
            "pin",
            "settle",
            "snooze",
            "rename",
            "regenerate-title",
            "auto-settle",
            "archive",
            "delete",
          ];
      expect(items.filter((item) => item.disabled).map((item) => item.id)).toEqual(expected);
      expect(
        items.find((item) => item.id === "snooze")?.children?.every((child) => child.disabled) ??
          true,
      ).toBe(true);
    },
  );

  it("disables archive and turning into a project while the thread is running", () => {
    const items = buildThreadActionMenuItems({
      ...baseState,
      isRunning: true,
      canTurnIntoProject: true,
    });
    expect(items.find((item) => item.id === "archive")?.disabled).toBe(true);
    expect(items.find((item) => item.id === "turn-into-project")?.disabled).toBe(true);
  });

  it("disables only rename where no inline title editor exists", () => {
    const items = buildThreadActionMenuItems({ ...baseState, canRename: false });
    expect(items.filter((item) => item.disabled).map((item) => item.id)).toEqual(["rename"]);
  });

  it("offers side chat and forks only when the server supports them", () => {
    const supported = buildThreadActionMenuItems(baseState);
    expect(supported.map((item) => item.id)).toContain("new-side-chat");
    expect(supported.find((item) => item.id === "fork")?.children?.map((item) => item.id)).toEqual([
      "fork-current-workspace",
      "fork-new-worktree",
    ]);

    const unsupported = buildThreadActionMenuItems({ ...baseState, canFork: false });
    expect(unsupported.map((item) => item.id)).not.toContain("new-side-chat");
    expect(unsupported.map((item) => item.id)).not.toContain("fork");
  });

  it("disables a worktree fork without a branch or while the thread runs", () => {
    const noBranch = buildThreadActionMenuItems(baseState);
    expect(
      noBranch
        .find((item) => item.id === "fork")
        ?.children?.find((item) => item.id === "fork-new-worktree")?.disabled,
    ).toBe(true);

    const withBranch = buildThreadActionMenuItems({ ...baseState, branch: "feature" });
    expect(
      withBranch
        .find((item) => item.id === "fork")
        ?.children?.find((item) => item.id === "fork-new-worktree")?.disabled,
    ).toBe(false);

    const running = buildThreadActionMenuItems({
      ...baseState,
      branch: "feature",
      latestStableRunId: null,
    });
    expect(
      running
        .find((item) => item.id === "fork")
        ?.children?.find((item) => item.id === "fork-new-worktree")?.disabled,
    ).toBe(true);
  });
});
