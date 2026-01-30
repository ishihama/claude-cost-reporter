import { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerTypes } from "deno-slack-api/mod.ts";
import { CostReportWorkflow } from "../workflows/cost_report_workflow.ts";

/**
 * Scheduled trigger to run daily at 9:00 AM JST
 */
const DailyScheduledTrigger: Trigger<typeof CostReportWorkflow.definition> = {
  type: TriggerTypes.Scheduled,
  name: "Daily Cost Report",
  description: "Generates Claude API cost report every day at 9:00 AM JST",
  workflow: `#/workflows/${CostReportWorkflow.definition.callback_id}`,
  inputs: {},
  schedule: {
    start_time: new Date(
      new Date().setHours(0, 0, 0, 0) + 24 * 60 * 60 * 1000,
    ).toISOString(),
    timezone: "Asia/Tokyo",
    frequency: {
      type: "daily",
      repeats_every: 1,
    },
    // 9:00 AM JST
    end_time: undefined,
  },
};

export default DailyScheduledTrigger;
