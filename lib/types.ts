// Anthropic Admin API Response Types

export interface CostReportResponse {
  data: CostBucket[];
  has_more: boolean;
  next_page?: string;
}

export interface CostBucket {
  starting_at: string;
  ending_at: string;
  results: CostResult[];
}

export interface CostResult {
  amount: string; // Cents as string (e.g., "12345.67" = $123.4567)
  currency: string;
  workspace_id: string | null;
  description: string | null;
  cost_type: string | null;
  context_window: string | null;
  model: string | null;
  service_tier: string | null;
  token_type: string | null;
}

export interface WorkspacesResponse {
  data: Workspace[];
  has_more: boolean;
  next_page?: string;
}

export interface Workspace {
  id: string;
  name: string;
  created_at: string;
}

// Application Types

export type AlertLevel = "green" | "yellow" | "red";

export interface WorkspaceCost {
  workspace_id: string | null;
  workspace_name: string;
  amount_usd: number;
  forecast_usd: number;
  budget_usd: number | null;
  alert_level: AlertLevel;
}

export interface OrganizationSummary {
  total_amount_usd: number;
  total_forecast_usd: number;
  budget_usd: number | null;
  alert_level: AlertLevel;
}

export interface CostReport {
  organization: OrganizationSummary;
  workspaces: WorkspaceCost[];
  report_date: Date;
  days_elapsed: number;
  days_in_month: number;
}

// Configuration Types

export interface WorkspaceBudgets {
  [workspace_id: string]: number;
}
