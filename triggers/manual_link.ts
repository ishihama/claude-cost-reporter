import { Trigger } from "deno-slack-sdk/types.ts";
import { TriggerTypes } from "deno-slack-api/mod.ts";
import { CostReportWorkflow } from "../workflows/cost_report_workflow.ts";

/**
 * Link trigger for manual execution
 * Use this to generate a cost report on demand
 */
const ManualLinkTrigger: Trigger<typeof CostReportWorkflow.definition> = {
  type: TriggerTypes.Shortcut,
  name: "Generate Cost Report Now",
  description: "Manually trigger Claude API cost report generation",
  workflow: `#/workflows/${CostReportWorkflow.definition.callback_id}`,
  inputs: {},
};

export default ManualLinkTrigger;
