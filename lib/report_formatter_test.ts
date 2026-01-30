import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createProgressBar,
  formatDateJP,
  formatErrorBlocks,
  formatErrorMessage,
  formatPercentage,
  formatSlackBlocks,
  formatSlackReport,
  formatUSD,
  getAlertIcon,
} from "./report_formatter.ts";
import type { CostReport } from "./types.ts";

Deno.test("formatUSD - formats currency correctly", () => {
  assertEquals(formatUSD(1000), "$1,000.00");
  assertEquals(formatUSD(1234.56), "$1,234.56");
  assertEquals(formatUSD(0), "$0.00");
  assertEquals(formatUSD(999999.99), "$999,999.99");
});

Deno.test("formatPercentage - formats percentage correctly", () => {
  assertEquals(formatPercentage(50), "50.0%");
  assertEquals(formatPercentage(100.5), "100.5%");
  assertEquals(formatPercentage(0), "0.0%");
  assertEquals(formatPercentage(85.67), "85.7%");
});

Deno.test("formatDateJP - formats date in Japanese", () => {
  assertEquals(formatDateJP(new Date(2025, 0, 15)), "2025年1月15日");
  assertEquals(formatDateJP(new Date(2025, 11, 31)), "2025年12月31日");
});

Deno.test("getAlertIcon - returns correct icons", () => {
  assertEquals(getAlertIcon("green"), "🟢");
  assertEquals(getAlertIcon("yellow"), "🟡");
  assertEquals(getAlertIcon("red"), "🔴");
});

Deno.test("formatSlackReport - formats complete report", () => {
  const report: CostReport = {
    organization: {
      total_amount_usd: 500,
      total_forecast_usd: 1033.33,
      budget_usd: 1500,
      alert_level: "green",
    },
    workspaces: [
      {
        workspace_id: "ws1",
        workspace_name: "Production",
        amount_usd: 300,
        forecast_usd: 620,
        budget_usd: 700,
        alert_level: "yellow",
      },
      {
        workspace_id: "ws2",
        workspace_name: "Development",
        amount_usd: 200,
        forecast_usd: 413.33,
        budget_usd: null,
        alert_level: "green",
      },
    ],
    report_date: new Date(2025, 0, 15),
    days_elapsed: 15,
    days_in_month: 31,
  };

  const formatted = formatSlackReport(report);

  // Check header
  assertEquals(formatted.includes("*📊 Claude API コストレポート*"), true);
  assertEquals(formatted.includes("2025年1月15日"), true);
  assertEquals(formatted.includes("15/31日経過"), true);

  // Check organization section
  assertEquals(formatted.includes("*🏢 組織全体*"), true);
  assertEquals(formatted.includes("$500.00"), true);
  assertEquals(formatted.includes("$1,033.33"), true);
  assertEquals(formatted.includes("$1,500.00"), true);

  // Check workspaces section
  assertEquals(formatted.includes("*📁 ワークスペース別*"), true);
  assertEquals(formatted.includes("🟡 *Production*"), true);
  assertEquals(formatted.includes("🟢 *Development*"), true);
});

Deno.test("formatSlackReport - handles no budget", () => {
  const report: CostReport = {
    organization: {
      total_amount_usd: 500,
      total_forecast_usd: 1033.33,
      budget_usd: null,
      alert_level: "green",
    },
    workspaces: [],
    report_date: new Date(2025, 0, 15),
    days_elapsed: 15,
    days_in_month: 31,
  };

  const formatted = formatSlackReport(report);

  assertEquals(formatted.includes("月間予算: 未設定"), true);
});

Deno.test("formatErrorMessage - formats error correctly", () => {
  const error = "API key is invalid";
  const formatted = formatErrorMessage(error);

  assertEquals(formatted.includes("*⚠️ Claude API コストレポート - エラー*"), true);
  assertEquals(formatted.includes("API key is invalid"), true);
  assertEquals(formatted.includes("```"), true);
});

// Block Kit format tests

Deno.test("createProgressBar - creates correct progress bar", () => {
  assertEquals(createProgressBar(0, 10), "░░░░░░░░░░");
  assertEquals(createProgressBar(50, 10), "█████░░░░░");
  assertEquals(createProgressBar(100, 10), "██████████");
  assertEquals(createProgressBar(25, 20), "█████░░░░░░░░░░░░░░░");
});

Deno.test("createProgressBar - clamps values to 0-100", () => {
  assertEquals(createProgressBar(-10, 10), "░░░░░░░░░░");
  assertEquals(createProgressBar(150, 10), "██████████");
});

Deno.test("formatSlackBlocks - returns blocks with header", () => {
  const report: CostReport = {
    organization: {
      total_amount_usd: 500,
      total_forecast_usd: 1033.33,
      budget_usd: 1500,
      alert_level: "green",
    },
    workspaces: [],
    report_date: new Date(2025, 0, 15),
    days_elapsed: 15,
    days_in_month: 31,
  };

  const result = formatSlackBlocks(report);

  assertEquals(result.blocks.length > 0, true);
  assertEquals(result.blocks[0].type, "header");
  assertEquals(result.blocks[0].text?.text, "📊 Claude API コストレポート");
  assertEquals(result.text.includes("Claude API コストレポート"), true);
});

Deno.test("formatSlackBlocks - includes workspace sections", () => {
  const report: CostReport = {
    organization: {
      total_amount_usd: 500,
      total_forecast_usd: 1033.33,
      budget_usd: null,
      alert_level: "green",
    },
    workspaces: [
      {
        workspace_id: "ws1",
        workspace_name: "Production",
        amount_usd: 300,
        forecast_usd: 620,
        budget_usd: 700,
        alert_level: "yellow",
      },
      {
        workspace_id: "ws2",
        workspace_name: "Development",
        amount_usd: 200,
        forecast_usd: 413.33,
        budget_usd: null,
        alert_level: "green",
      },
    ],
    report_date: new Date(2025, 0, 15),
    days_elapsed: 15,
    days_in_month: 31,
  };

  const result = formatSlackBlocks(report);

  // Check that workspace sections exist
  const hasWorkspaceHeader = result.blocks.some(
    (b) => b.type === "section" && b.text?.text?.includes("ワークスペース別")
  );
  assertEquals(hasWorkspaceHeader, true);

  // Check that workspace names appear
  const blockTexts = result.blocks
    .filter((b) => b.type === "section" && b.text?.text)
    .map((b) => b.text?.text ?? "");

  assertEquals(blockTexts.some((t) => t.includes("Production")), true);
  assertEquals(blockTexts.some((t) => t.includes("Development")), true);
});

Deno.test("formatErrorBlocks - returns error blocks", () => {
  const error = "API key is invalid";
  const result = formatErrorBlocks(error);

  assertEquals(result.blocks.length, 2);
  assertEquals(result.blocks[0].type, "header");
  assertEquals(result.blocks[0].text?.text?.includes("エラー"), true);
  assertEquals(result.text.includes("API key is invalid"), true);
});
