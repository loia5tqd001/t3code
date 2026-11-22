import { RunId } from "@t3tools/contracts";
import type { OrchestrationV2RunStatus } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { forkRunBeforeRequest } from "./forkThread";

const run = (id: string, ordinal: number, status: OrchestrationV2RunStatus) => ({
  runId: RunId.make(id),
  ordinal,
  status,
});

describe("forkRunBeforeRequest", () => {
  it("uses the completed run immediately before the request", () => {
    expect(
      forkRunBeforeRequest(
        [run("first", 1, "completed"), run("second", 2, "completed"), run("request", 3, "running")],
        RunId.make("request"),
      ),
    ).toBe(RunId.make("second"));
  });

  it("skips failed and interrupted runs", () => {
    expect(
      forkRunBeforeRequest(
        [
          run("completed", 1, "completed"),
          run("failed", 2, "failed"),
          run("interrupted", 3, "interrupted"),
          run("request", 4, "running"),
        ],
        RunId.make("request"),
      ),
    ).toBe(RunId.make("completed"));
  });

  it("returns null for the first request", () => {
    expect(forkRunBeforeRequest([run("request", 1, "running")], RunId.make("request"))).toBeNull();
  });

  it("returns null for an unknown request run", () => {
    expect(forkRunBeforeRequest([run("first", 1, "completed")], RunId.make("missing"))).toBeNull();
  });

  it("uses ordinals rather than projection order", () => {
    expect(
      forkRunBeforeRequest(
        [run("request", 3, "running"), run("second", 2, "completed"), run("first", 1, "completed")],
        RunId.make("request"),
      ),
    ).toBe(RunId.make("second"));
  });

  it("ignores runs without an explicit run id", () => {
    expect(
      forkRunBeforeRequest(
        [run("first", 1, "completed"), run("request", 3, "running")],
        RunId.make("request"),
      ),
    ).toBe(RunId.make("first"));
  });
});
