import { OrchestratorMcpFailure } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { McpSchema, Tool, Toolkit } from "effect/ai";

import {
  FeedbackAwaitingApproval,
  FeedbackInput,
  FeedbackSubmitResult,
} from "../../../feedback/FeedbackReport.ts";
import * as Feedback from "../../../feedback/FeedbackService.ts";
import * as ThreadManagementService from "../../../orchestration-v2/ThreadManagementService.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";

const shared = {
  failure: OrchestratorMcpFailure,
  failureMode: "return" as const,
  dependencies: [
    Feedback.FeedbackService,
    McpInvocationContext.McpInvocationContext,
    ThreadManagementService.ThreadManagementService,
  ],
};

export const FeedbackToolkit = Toolkit.make(
  Tool.make("t3_feedback", {
    ...shared,
    description:
      "Save a T3 Code feedback report on this machine: a T3 tool or `t3` command that misbehaved, a confusing instruction, a missing capability, or anything about T3 Code the user asks you to record. Not the user's own code. Use your own words; never quote the user's messages, code, files, or names. A report the user asks for opens a local card where they choose what to save. Nothing is sent off this machine.",
    parameters: FeedbackInput,
    success: Schema.Union([FeedbackSubmitResult, FeedbackAwaitingApproval]),
  })
    .annotate(Tool.Destructive, false)
    .annotate(McpSchema.EnabledWhen, McpInvocationContext.hiddenWhileFeedbackOff),
);
