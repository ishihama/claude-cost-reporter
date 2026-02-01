import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  returnsNext,
  stub,
} from "https://deno.land/std@0.224.0/testing/mock.ts";
import { FakeTime } from "https://deno.land/std@0.224.0/testing/time.ts";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import FetchCostDataHandler, { getMonthDateRange } from "./fetch_cost_data.ts";

const { createContext } = SlackFunctionTester("fetch_cost_data");

Deno.test("FetchCostData - returns error when API key not set", async () => {
  const context = createContext({
    inputs: {},
    env: {},
  });

  const result = await FetchCostDataHandler(context);

  assertEquals(result.outputs?.cost_data_json, "{}");
  assertEquals(result.outputs?.error, "ANTHROPIC_ADMIN_API_KEY is not set");
});

Deno.test("FetchCostData - returns cost data on success", async () => {
  const mockCostResponse = {
    data: [
      {
        starting_at: "2025-01-01",
        ending_at: "2025-01-02",
        results: [
          { amount: "10000", currency: "USD", workspace_id: "ws1" },
        ],
      },
    ],
    has_more: false,
  };

  const fetchStub = stub(
    globalThis,
    "fetch",
    returnsNext([
      Promise.resolve(
        new Response(JSON.stringify(mockCostResponse), { status: 200 }),
      ),
    ]),
  );

  try {
    const context = createContext({
      inputs: {},
      env: { ANTHROPIC_ADMIN_API_KEY: "test-key" },
    });

    const result = await FetchCostDataHandler(context);

    assertEquals(result.outputs?.error, undefined);
    const costData = JSON.parse(result.outputs?.cost_data_json ?? "{}");
    assertEquals(costData.data?.length, 1);
    assertEquals(costData.data[0].results[0].amount, "10000");
  } finally {
    fetchStub.restore();
  }
});

Deno.test("FetchCostData - handles API error", async () => {
  const fetchStub = stub(
    globalThis,
    "fetch",
    returnsNext([
      Promise.resolve(new Response("Forbidden", { status: 403 })),
    ]),
  );

  try {
    const context = createContext({
      inputs: {},
      env: { ANTHROPIC_ADMIN_API_KEY: "invalid-key" },
    });

    const result = await FetchCostDataHandler(context);

    assertEquals(result.outputs?.cost_data_json, "{}");
    assertEquals(result.outputs?.error?.includes("403"), true);
  } finally {
    fetchStub.restore();
  }
});

// =========================================
// getMonthDateRange() unit tests
// =========================================

Deno.test("getMonthDateRange - end date is after start date", () => {
  const { startDate, endDate } = getMonthDateRange();
  const start = new Date(startDate);
  const end = new Date(endDate);

  assertEquals(end > start, true, "End date must be after start date");
});

Deno.test("getMonthDateRange - returns RFC 3339 format", () => {
  const { startDate, endDate } = getMonthDateRange();

  // RFC 3339 format: YYYY-MM-DDTHH:MM:SS.sssZ
  const rfc3339Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  assertEquals(
    rfc3339Regex.test(startDate),
    true,
    `startDate should be RFC 3339 format: ${startDate}`,
  );
  assertEquals(
    rfc3339Regex.test(endDate),
    true,
    `endDate should be RFC 3339 format: ${endDate}`,
  );
});

Deno.test("getMonthDateRange - December to January year transition", () => {
  // Mock Date to December 15, 2025 UTC
  const time = new FakeTime(new Date("2025-12-15T12:00:00.000Z"));

  try {
    const { startDate, endDate } = getMonthDateRange();

    assertEquals(startDate, "2025-12-01T00:00:00.000Z");
    assertEquals(endDate, "2026-01-01T00:00:00.000Z");
  } finally {
    time.restore();
  }
});

Deno.test("getMonthDateRange - leap year February has 29 days", () => {
  // Mock Date to February 15, 2024 UTC (2024 is a leap year)
  const time = new FakeTime(new Date("2024-02-15T12:00:00.000Z"));

  try {
    const { startDate, endDate } = getMonthDateRange();

    assertEquals(startDate, "2024-02-01T00:00:00.000Z");
    assertEquals(endDate, "2024-03-01T00:00:00.000Z");

    // Verify the range covers 29 days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    assertEquals(daysDiff, 29, "Leap year February should have 29 days");
  } finally {
    time.restore();
  }
});

Deno.test("getMonthDateRange - non-leap year February has 28 days", () => {
  // Mock Date to February 15, 2025 UTC (2025 is not a leap year)
  const time = new FakeTime(new Date("2025-02-15T12:00:00.000Z"));

  try {
    const { startDate, endDate } = getMonthDateRange();

    assertEquals(startDate, "2025-02-01T00:00:00.000Z");
    assertEquals(endDate, "2025-03-01T00:00:00.000Z");

    // Verify the range covers 28 days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    assertEquals(daysDiff, 28, "Non-leap year February should have 28 days");
  } finally {
    time.restore();
  }
});
