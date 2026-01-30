import { DefineWorkflow } from "deno-slack-sdk/mod.ts";
import { FetchWorkspacesFunction } from "../functions/fetch_workspaces.ts";
import { FetchCostDataFunction } from "../functions/fetch_cost_data.ts";
import { GetBudgetsFunction } from "../functions/get_budgets.ts";
import { CalculateForecastFunction } from "../functions/calculate_forecast.ts";
import { FormatReportFunction } from "../functions/format_report.ts";
import { PostReportFunction } from "../functions/post_report.ts";

export const CostReportWorkflow = DefineWorkflow({
  callback_id: "cost_report_workflow",
  title: "Claude Cost Report",
  description: "Generate and post Claude API cost report to Slack",
  input_parameters: {
    properties: {},
    required: [],
  },
});

// Step 1: Fetch workspaces
const fetchWorkspacesStep = CostReportWorkflow.addStep(
  FetchWorkspacesFunction,
  {},
);

// Step 2: Fetch cost data
const fetchCostDataStep = CostReportWorkflow.addStep(
  FetchCostDataFunction,
  {},
);

// Step 3: Get budgets from datastore
const getBudgetsStep = CostReportWorkflow.addStep(
  GetBudgetsFunction,
  {},
);

// Step 4: Calculate forecast and build report
const calculateForecastStep = CostReportWorkflow.addStep(
  CalculateForecastFunction,
  {
    cost_data_json: fetchCostDataStep.outputs.cost_data_json,
    workspaces_json: fetchWorkspacesStep.outputs.workspaces_json,
    budgets_json: getBudgetsStep.outputs.budgets_json,
  },
);

// Step 5: Format report for Slack
const formatReportStep = CostReportWorkflow.addStep(
  FormatReportFunction,
  {
    report_json: calculateForecastStep.outputs.report_json,
    error: fetchCostDataStep.outputs.error,
  },
);

// Step 6: Post report to Slack
CostReportWorkflow.addStep(
  PostReportFunction,
  {
    message: formatReportStep.outputs.message,
    blocks_json: formatReportStep.outputs.blocks_json,
    is_error: formatReportStep.outputs.is_error,
  },
);
