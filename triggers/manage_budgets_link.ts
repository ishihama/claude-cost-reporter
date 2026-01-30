import { Trigger } from "deno-slack-api/types.ts";
import { TriggerContextData, TriggerTypes } from "deno-slack-api/mod.ts";
import { ManageBudgetsWorkflow } from "../workflows/manage_budgets_workflow.ts";

const manageBudgetsTrigger: Trigger<typeof ManageBudgetsWorkflow.definition> = {
  type: TriggerTypes.Shortcut,
  name: "Manage Budgets",
  description: "View and manage Anthropic organization and workspace budgets",
  workflow: `#/workflows/${ManageBudgetsWorkflow.definition.callback_id}`,
  inputs: {
    interactivity: {
      value: TriggerContextData.Shortcut.interactivity,
    },
  },
};

export default manageBudgetsTrigger;
