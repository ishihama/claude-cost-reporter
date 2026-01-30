import { DefineWorkflow, Schema } from "deno-slack-sdk/mod.ts";
import { ListBudgetsFunction } from "../functions/list_budgets.ts";

export const ManageBudgetsWorkflow = DefineWorkflow({
  callback_id: "manage_budgets_workflow",
  title: "Manage Budgets",
  description: "View and manage organization and workspace budgets",
  input_parameters: {
    properties: {
      interactivity: {
        type: Schema.slack.types.interactivity,
      },
    },
    required: ["interactivity"],
  },
});

// Show budget list with interactive buttons
ManageBudgetsWorkflow.addStep(
  ListBudgetsFunction,
  {
    interactivity: ManageBudgetsWorkflow.inputs.interactivity,
  },
);
