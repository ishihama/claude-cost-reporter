import { DefineDatastore, Schema } from "deno-slack-sdk/mod.ts";

export const WorkspaceBudgetsDatastore = DefineDatastore({
  name: "workspace_budgets",
  primary_key: "workspace_id",
  attributes: {
    workspace_id: {
      type: Schema.types.string,
      description: "Anthropic workspace ID (e.g., wrkspc_xxx)",
    },
    workspace_name: {
      type: Schema.types.string,
      description: "Human-readable workspace name",
    },
    budget_usd: {
      type: Schema.types.number,
      description: "Monthly budget in USD",
    },
    updated_at: {
      type: Schema.types.string,
      description: "ISO timestamp of last update",
    },
    updated_by: {
      type: Schema.types.string,
      description: "Slack user ID who last updated",
    },
  },
});
