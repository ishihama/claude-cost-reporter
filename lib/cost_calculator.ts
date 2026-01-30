import type {
  AlertLevel,
  CostReport,
  CostReportResponse,
  OrganizationSummary,
  Workspace,
  WorkspaceBudgets,
  WorkspaceCost,
} from "./types.ts";

/**
 * Convert amount from cents string to USD number
 * API returns cents as string (e.g., "12345.67" = $123.4567)
 */
export function amountToUSD(amountStr: string): number {
  const cents = parseFloat(amountStr);
  if (isNaN(cents)) {
    return 0;
  }
  return cents / 100;
}

/**
 * Get the number of days in a given month
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Get the day of month (1-indexed)
 */
export function getDayOfMonth(date: Date): number {
  return date.getDate();
}

/**
 * Calculate end-of-month forecast based on current spending
 * Formula: (currentSpend / daysElapsed) * daysInMonth
 */
export function calculateForecast(
  currentSpend: number,
  daysElapsed: number,
  daysInMonth: number,
): number {
  if (daysElapsed <= 0) {
    return currentSpend;
  }
  return (currentSpend / daysElapsed) * daysInMonth;
}

/**
 * Determine alert level based on forecast vs budget
 * 🟢 Green: < 70% of budget
 * 🟡 Yellow: 70-99% of budget
 * 🔴 Red: >= 100% of budget
 */
export function getAlertLevel(
  forecast: number,
  budget: number | null,
): AlertLevel {
  if (budget === null || budget <= 0) {
    return "green";
  }

  const percentage = (forecast / budget) * 100;

  if (percentage >= 100) {
    return "red";
  } else if (percentage >= 70) {
    return "yellow";
  }
  return "green";
}

/**
 * Aggregate costs by workspace from API response
 */
export function aggregateCostsByWorkspace(
  costResponse: CostReportResponse,
): Map<string | null, number> {
  const costs = new Map<string | null, number>();

  for (const bucket of costResponse.data) {
    for (const result of bucket.results) {
      const workspaceId = result.workspace_id;
      const amount = amountToUSD(result.amount);
      const current = costs.get(workspaceId) ?? 0;
      costs.set(workspaceId, current + amount);
    }
  }

  return costs;
}

/**
 * Build a complete cost report
 */
export function buildCostReport(
  costResponse: CostReportResponse,
  workspaces: Workspace[],
  workspaceBudgets: WorkspaceBudgets,
  orgBudget: number | null,
  reportDate: Date,
): CostReport {
  const costs = aggregateCostsByWorkspace(costResponse);

  const workspaceMap = new Map<string, string>();
  for (const ws of workspaces) {
    workspaceMap.set(ws.id, ws.name);
  }

  const daysElapsed = getDayOfMonth(reportDate);
  const daysInMonth = getDaysInMonth(
    reportDate.getFullYear(),
    reportDate.getMonth(),
  );

  let totalAmount = 0;
  const workspaceCosts: WorkspaceCost[] = [];

  for (const [workspaceId, amount] of costs) {
    totalAmount += amount;
    const forecast = calculateForecast(amount, daysElapsed, daysInMonth);
    const budget = workspaceId ? (workspaceBudgets[workspaceId] ?? null) : null;
    const alertLevel = getAlertLevel(forecast, budget);

    workspaceCosts.push({
      workspace_id: workspaceId,
      workspace_name: workspaceId
        ? (workspaceMap.get(workspaceId) ?? workspaceId)
        : "Default",
      amount_usd: amount,
      forecast_usd: forecast,
      budget_usd: budget,
      alert_level: alertLevel,
    });
  }

  // Sort by amount descending
  workspaceCosts.sort((a, b) => b.amount_usd - a.amount_usd);

  const totalForecast = calculateForecast(totalAmount, daysElapsed, daysInMonth);
  const orgAlertLevel = getAlertLevel(totalForecast, orgBudget);

  const organization: OrganizationSummary = {
    total_amount_usd: totalAmount,
    total_forecast_usd: totalForecast,
    budget_usd: orgBudget,
    alert_level: orgAlertLevel,
  };

  return {
    organization,
    workspaces: workspaceCosts,
    report_date: reportDate,
    days_elapsed: daysElapsed,
    days_in_month: daysInMonth,
  };
}
