import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import CalculateForecastHandler from "./calculate_forecast.ts";

const { createContext } = SlackFunctionTester("calculate_forecast");

Deno.test("CalculateForecast - builds report from cost data", async () => {
  const costDataJson = JSON.stringify({
    data: [
      {
        starting_at: "2025-01-01",
        ending_at: "2025-01-15",
        results: [
          { amount: "30000", currency: "USD", workspace_id: "ws1" },
          { amount: "20000", currency: "USD", workspace_id: "ws2" },
        ],
      },
    ],
    has_more: false,
  });

  const workspacesJson = JSON.stringify([
    { id: "ws1", name: "Production", created_at: "2024-01-01" },
    { id: "ws2", name: "Development", created_at: "2024-01-01" },
  ]);

  const context = createContext({
    inputs: {
      cost_data_json: costDataJson,
      workspaces_json: workspacesJson,
      budgets_json: '{"ws1": 700, "ws2": 500, "__ORG__": 1500}',
    },
  });

  const result = await CalculateForecastHandler(context);

  assertEquals(result.outputs?.error, undefined);

  const report = JSON.parse(result.outputs?.report_json ?? "{}");
  assertEquals(report.organization.total_amount_usd, 500);
  assertEquals(report.organization.budget_usd, 1500);
  assertEquals(report.workspaces.length, 2);
});

Deno.test("CalculateForecast - handles missing budget", async () => {
  const costDataJson = JSON.stringify({
    data: [
      {
        starting_at: "2025-01-01",
        ending_at: "2025-01-15",
        results: [
          { amount: "10000", currency: "USD", workspace_id: null },
        ],
      },
    ],
    has_more: false,
  });

  const context = createContext({
    inputs: {
      cost_data_json: costDataJson,
      workspaces_json: "[]",
    },
    env: {},
  });

  const result = await CalculateForecastHandler(context);

  assertEquals(result.outputs?.error, undefined);

  const report = JSON.parse(result.outputs?.report_json ?? "{}");
  assertEquals(report.organization.budget_usd, null);
  assertEquals(report.organization.alert_level, "green");
});

Deno.test("CalculateForecast - handles invalid JSON input", async () => {
  const context = createContext({
    inputs: {
      cost_data_json: "invalid json",
      workspaces_json: "[]",
    },
    env: {},
  });

  const result = await CalculateForecastHandler(context);

  assertEquals(result.outputs?.report_json, "{}");
  assertEquals(result.outputs?.error !== undefined, true);
});

Deno.test("CalculateForecast - handles invalid budgets JSON", async () => {
  const costDataJson = JSON.stringify({
    data: [],
    has_more: false,
  });

  const context = createContext({
    inputs: {
      cost_data_json: costDataJson,
      workspaces_json: "[]",
      budgets_json: "invalid json",
    },
    env: {},
  });

  const result = await CalculateForecastHandler(context);

  // Should succeed with empty budgets
  assertEquals(result.outputs?.error, undefined);
});
