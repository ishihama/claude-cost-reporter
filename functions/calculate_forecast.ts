import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { buildCostReport } from "../lib/cost_calculator.ts";
import type {
  CostReportResponse,
  Workspace,
  WorkspaceBudgets,
} from "../lib/types.ts";

export const CalculateForecastFunction = DefineFunction({
  callback_id: "calculate_forecast",
  title: "Calculate Forecast",
  description: "Calculate cost forecast and build report",
  source_file: "functions/calculate_forecast.ts",
  input_parameters: {
    properties: {
      cost_data_json: {
        type: Schema.types.string,
        description: "JSON string of cost report response",
      },
      workspaces_json: {
        type: Schema.types.string,
        description: "JSON string of workspaces array",
      },
      budgets_json: {
        type: Schema.types.string,
        description: "JSON string of workspace budgets from datastore",
      },
    },
    required: ["cost_data_json", "workspaces_json"],
  },
  output_parameters: {
    properties: {
      report_json: {
        type: Schema.types.string,
        description: "JSON string of cost report",
      },
      error: {
        type: Schema.types.string,
        description: "Error message if calculation failed",
      },
    },
    required: ["report_json"],
  },
});

// Special ID for organization budget (matches list_budgets.ts and get_budgets.ts)
const ORG_BUDGET_ID = "__ORG__";

export default SlackFunction(
  CalculateForecastFunction,
  async ({ inputs }) => {
    try {
      const costData: CostReportResponse = JSON.parse(inputs.cost_data_json);
      const workspaces: Workspace[] = JSON.parse(inputs.workspaces_json);

      console.log("[CalculateForecast] costData.data length:", costData.data?.length);
      if (costData.data && costData.data.length > 0) {
        console.log("[CalculateForecast] First bucket:", JSON.stringify(costData.data[0], null, 2));
      }

      // Parse budgets from datastore (includes org budget as __ORG__)
      let allBudgets: WorkspaceBudgets = {};
      if (inputs.budgets_json) {
        try {
          allBudgets = JSON.parse(inputs.budgets_json);
          console.log("[CalculateForecast] Loaded budgets:", Object.keys(allBudgets).length);
        } catch {
          // Ignore invalid JSON, use empty budgets
        }
      }

      // Extract org budget from budgets (uses special __ORG__ key)
      const orgBudget = allBudgets[ORG_BUDGET_ID] ?? null;
      if (orgBudget) {
        console.log(`[CalculateForecast] Org budget from datastore: $${orgBudget}`);
      }

      // Remove org budget from workspace budgets
      const workspaceBudgets: WorkspaceBudgets = { ...allBudgets };
      delete workspaceBudgets[ORG_BUDGET_ID];

      const report = buildCostReport(
        costData,
        workspaces,
        workspaceBudgets,
        orgBudget,
        new Date(),
      );

      console.log("[CalculateForecast] Total amount:", report.organization.total_amount_usd);
      console.log("[CalculateForecast] Workspaces count:", report.workspaces.length);

      // Convert Date to ISO string for JSON serialization
      const serializedReport = {
        ...report,
        report_date: report.report_date.toISOString(),
      };

      return {
        outputs: {
          report_json: JSON.stringify(serializedReport),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      return {
        outputs: {
          report_json: "{}",
          error: errorMessage,
        },
      };
    }
  },
);
