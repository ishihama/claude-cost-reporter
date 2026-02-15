import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  aggregateCostsByWorkspace,
  amountToUSD,
  buildCostReport,
  calculateForecast,
  getAlertLevel,
  getDayOfMonth,
  getDaysInMonth,
} from "./cost_calculator.ts";
import type { CostReportResponse, Workspace } from "./types.ts";

Deno.test("amountToUSD - converts cents string to USD", () => {
  assertEquals(amountToUSD("10000"), 100);
  assertEquals(amountToUSD("12345.67"), 123.4567);
  assertEquals(amountToUSD("0"), 0);
  assertEquals(amountToUSD("50"), 0.5);
});

Deno.test("amountToUSD - handles invalid input", () => {
  assertEquals(amountToUSD(""), 0);
  assertEquals(amountToUSD("invalid"), 0);
});

Deno.test("getDaysInMonth - returns correct days", () => {
  assertEquals(getDaysInMonth(2025, 0), 31); // January
  assertEquals(getDaysInMonth(2025, 1), 28); // February (non-leap)
  assertEquals(getDaysInMonth(2024, 1), 29); // February (leap)
  assertEquals(getDaysInMonth(2025, 3), 30); // April
  assertEquals(getDaysInMonth(2025, 11), 31); // December
});

Deno.test("getDayOfMonth - returns day number", () => {
  assertEquals(getDayOfMonth(new Date(2025, 0, 15)), 15);
  assertEquals(getDayOfMonth(new Date(2025, 0, 1)), 1);
  assertEquals(getDayOfMonth(new Date(2025, 0, 31)), 31);
});

Deno.test("calculateForecast - basic calculation", () => {
  // $500 spent in 15 days of 31-day month
  const forecast = calculateForecast(500, 15, 31);
  assertEquals(Math.round(forecast * 100) / 100, 1033.33);
});

Deno.test("calculateForecast - handles zero days elapsed", () => {
  assertEquals(calculateForecast(100, 0, 31), 100);
});

Deno.test("calculateForecast - first day of month", () => {
  assertEquals(calculateForecast(100, 1, 31), 3100);
});

Deno.test("getAlertLevel - green when under 70%", () => {
  assertEquals(getAlertLevel(600, 1000), "green");
  assertEquals(getAlertLevel(699, 1000), "green");
});

Deno.test("getAlertLevel - yellow when 70-99%", () => {
  assertEquals(getAlertLevel(700, 1000), "yellow");
  assertEquals(getAlertLevel(999, 1000), "yellow");
});

Deno.test("getAlertLevel - red when >= 100%", () => {
  assertEquals(getAlertLevel(1000, 1000), "red");
  assertEquals(getAlertLevel(1500, 1000), "red");
});

Deno.test("getAlertLevel - green when no budget", () => {
  assertEquals(getAlertLevel(1000, null), "green");
  assertEquals(getAlertLevel(1000, 0), "green");
});

Deno.test("aggregateCostsByWorkspace - aggregates correctly", () => {
  const response: CostReportResponse = {
    data: [
      {
        starting_at: "2025-01-01",
        ending_at: "2025-01-02",
        results: [
          { amount: "10000", currency: "USD", workspace_id: "ws1", description: null, cost_type: null, context_window: null, model: null, service_tier: null, token_type: null },
          { amount: "5000", currency: "USD", workspace_id: "ws2", description: null, cost_type: null, context_window: null, model: null, service_tier: null, token_type: null },
        ],
      },
      {
        starting_at: "2025-01-02",
        ending_at: "2025-01-03",
        results: [
          { amount: "15000", currency: "USD", workspace_id: "ws1", description: null, cost_type: null, context_window: null, model: null, service_tier: null, token_type: null },
          { amount: "3000", currency: "USD", workspace_id: null, description: null, cost_type: null, context_window: null, model: null, service_tier: null, token_type: null },
        ],
      },
    ],
    has_more: false,
  };

  const costs = aggregateCostsByWorkspace(response);

  assertEquals(costs.get("ws1"), 250); // (10000 + 15000) / 100
  assertEquals(costs.get("ws2"), 50); // 5000 / 100
  assertEquals(costs.get(null), 30); // 3000 / 100
});

Deno.test("buildCostReport - builds complete report", () => {
  const costResponse: CostReportResponse = {
    data: [
      {
        starting_at: "2025-01-01",
        ending_at: "2025-01-15",
        results: [
          { amount: "30000", currency: "USD", workspace_id: "ws1", description: null, cost_type: null, context_window: null, model: null, service_tier: null, token_type: null },
          { amount: "20000", currency: "USD", workspace_id: "ws2", description: null, cost_type: null, context_window: null, model: null, service_tier: null, token_type: null },
        ],
      },
    ],
    has_more: false,
  };

  const workspaces: Workspace[] = [
    { id: "ws1", name: "Production", created_at: "2024-01-01" },
    { id: "ws2", name: "Development", created_at: "2024-01-01" },
  ];

  const workspaceBudgets = { ws1: 700, ws2: 500 };
  const orgBudget = 1500;
  const reportDate = new Date(2025, 0, 15); // Jan 15, 2025

  const report = buildCostReport(
    costResponse,
    workspaces,
    workspaceBudgets,
    orgBudget,
    reportDate,
  );

  assertEquals(report.organization.total_amount_usd, 500); // (30000 + 20000) / 100
  assertEquals(report.days_elapsed, 15);
  assertEquals(report.days_in_month, 31);

  // Forecast: 500 / 15 * 31 = 1033.33
  assertEquals(
    Math.round(report.organization.total_forecast_usd * 100) / 100,
    1033.33,
  );

  assertEquals(report.workspaces.length, 2);
  assertEquals(report.workspaces[0].workspace_name, "Production"); // Sorted by amount
  assertEquals(report.workspaces[0].amount_usd, 300);
});
