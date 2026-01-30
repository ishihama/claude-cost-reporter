import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import FormatReportHandler from "./format_report.ts";

const { createContext } = SlackFunctionTester("format_report");

Deno.test("FormatReport - formats report correctly with blocks", async () => {
  const reportJson = JSON.stringify({
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
    ],
    report_date: new Date(2025, 0, 15).toISOString(),
    days_elapsed: 15,
    days_in_month: 31,
  });

  const context = createContext({
    inputs: {
      report_json: reportJson,
    },
  });

  const result = await FormatReportHandler(context);

  assertEquals(result.outputs?.is_error, false);
  assertEquals(result.outputs?.message?.includes("Claude API コストレポート"), true);

  // Check blocks_json is valid JSON
  const blocksJson = result.outputs?.blocks_json;
  assertEquals(typeof blocksJson, "string");

  const blocks = JSON.parse(blocksJson!);
  assertEquals(Array.isArray(blocks), true);
  assertEquals(blocks.length > 0, true);
  assertEquals(blocks[0].type, "header");
});

Deno.test("FormatReport - returns error message with blocks when error input provided", async () => {
  const context = createContext({
    inputs: {
      report_json: "{}",
      error: "API key is invalid",
    },
  });

  const result = await FormatReportHandler(context);

  assertEquals(result.outputs?.is_error, true);
  assertEquals(result.outputs?.message?.includes("API key is invalid"), true);

  // Check blocks_json contains error blocks
  const blocksJson = result.outputs?.blocks_json;
  assertEquals(typeof blocksJson, "string");

  const blocks = JSON.parse(blocksJson!);
  assertEquals(blocks[0].type, "header");
  assertEquals(blocks[0].text.text.includes("エラー"), true);
});

Deno.test("FormatReport - handles invalid JSON with error blocks", async () => {
  const context = createContext({
    inputs: {
      report_json: "invalid json",
    },
  });

  const result = await FormatReportHandler(context);

  assertEquals(result.outputs?.is_error, true);

  // Check blocks_json is still valid
  const blocksJson = result.outputs?.blocks_json;
  assertEquals(typeof blocksJson, "string");

  const blocks = JSON.parse(blocksJson!);
  assertEquals(blocks[0].type, "header");
});
