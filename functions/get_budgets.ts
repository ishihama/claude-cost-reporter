import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { WorkspaceBudgetsDatastore } from "../datastores/workspace_budgets.ts";

// Special ID for organization budget (matches list_budgets.ts)
const ORG_BUDGET_ID = "__ORG__";

export const GetBudgetsFunction = DefineFunction({
  callback_id: "get_budgets",
  title: "Get Budgets",
  description: "Get all workspace budgets from datastore",
  source_file: "functions/get_budgets.ts",
  input_parameters: {
    properties: {},
    required: [],
  },
  output_parameters: {
    properties: {
      budgets_json: {
        type: Schema.types.string,
        description: "JSON object of workspace_id to budget_usd mapping (includes __ORG__ for org budget)",
      },
    },
    required: ["budgets_json"],
  },
});

export default SlackFunction(
  GetBudgetsFunction,
  async ({ client }) => {
    try {
      const result = await client.apps.datastore.query({
        datastore: WorkspaceBudgetsDatastore.name,
      });

      if (!result.ok) {
        console.log("[GetBudgets] Datastore query failed:", result.error);
        return {
          outputs: {
            budgets_json: "{}",
          },
        };
      }

      // Convert array to object mapping workspace_id -> budget_usd
      // This includes __ORG__ for organization budget
      const budgets: Record<string, number> = {};
      for (const item of result.items) {
        if (item.workspace_id && item.budget_usd) {
          budgets[item.workspace_id] = item.budget_usd;
        }
      }

      console.log("[GetBudgets] Loaded budgets:", JSON.stringify(budgets));
      if (budgets[ORG_BUDGET_ID]) {
        console.log(`[GetBudgets] Org budget: $${budgets[ORG_BUDGET_ID]}`);
      }

      return {
        outputs: {
          budgets_json: JSON.stringify(budgets),
        },
      };
    } catch (error) {
      console.log("[GetBudgets] Error:", error);
      return {
        outputs: {
          budgets_json: "{}",
        },
      };
    }
  },
);
