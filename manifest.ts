import { Manifest } from "deno-slack-sdk/mod.ts";
import { CostReportWorkflow } from "./workflows/cost_report_workflow.ts";
import { ManageBudgetsWorkflow } from "./workflows/manage_budgets_workflow.ts";
import { FetchWorkspacesFunction } from "./functions/fetch_workspaces.ts";
import { FetchCostDataFunction } from "./functions/fetch_cost_data.ts";
import { GetBudgetsFunction } from "./functions/get_budgets.ts";
import { ListBudgetsFunction } from "./functions/list_budgets.ts";
import { CalculateForecastFunction } from "./functions/calculate_forecast.ts";
import { FormatReportFunction } from "./functions/format_report.ts";
import { PostReportFunction } from "./functions/post_report.ts";
import { WorkspaceBudgetsDatastore } from "./datastores/workspace_budgets.ts";

export default Manifest({
  name: "Claude Cost Reporter",
  description:
    "A Slack bot that reports daily Claude API usage costs from Anthropic Admin API",
  icon: "assets/icon.png",
  functions: [
    FetchWorkspacesFunction,
    FetchCostDataFunction,
    GetBudgetsFunction,
    ListBudgetsFunction,
    CalculateForecastFunction,
    FormatReportFunction,
    PostReportFunction,
  ],
  workflows: [CostReportWorkflow, ManageBudgetsWorkflow],
  datastores: [WorkspaceBudgetsDatastore],
  outgoingDomains: ["api.anthropic.com"],
  botScopes: [
    "commands",
    "chat:write",
    "chat:write.public",
    "datastore:read",
    "datastore:write",
  ],
});
