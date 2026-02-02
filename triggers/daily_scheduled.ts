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
    // Start tomorrow at 09:00 JST (= 00:00 UTC)
    start_time: (() => {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0); // 00:00 UTC = 09:00 JST
      return tomorrow.toISOString();
    })(),
    timezone: "Asia/Tokyo",
    frequency: {
      type: "daily",
      repeats_every: 1,
    },
    end_time: undefined,
  },
};

export default DailyScheduledTrigger;
