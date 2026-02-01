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

Deno.test("getMonthDateRange - day 1 queries previous month", () => {
  // Mock Date to February 1, 2026 15:19 UTC (= Feb 2 00:19 JST)
  // Day 1 in UTC, so query January instead
  const time = new FakeTime(new Date("2026-02-01T15:19:00.000Z"));

  try {
    const { startDate, endDate } = getMonthDateRange();

    // Should query January (previous month)
    assertEquals(startDate, "2026-01-01T00:00:00.000Z");
    assertEquals(endDate, "2026-02-01T00:00:00.000Z");
  } finally {
    time.restore();
  }
});

Deno.test("getMonthDateRange - day 2 queries current month", () => {
  // Mock Date to February 2, 2026 00:00:01 UTC
  // Day 2 in UTC, so query February
  const time = new FakeTime(new Date("2026-02-02T00:00:01.000Z"));

  try {
    const { startDate, endDate } = getMonthDateRange();

    // Should query February (current month)
    assertEquals(startDate, "2026-02-01T00:00:00.000Z");
    // End date is today 00:00 UTC (Feb 2)
    assertEquals(endDate, "2026-02-02T00:00:00.000Z");
  } finally {
    time.restore();
  }
});

Deno.test("getMonthDateRange - mid month queries current month", () => {
  // Mock Date to January 15, 2026 12:00 UTC
  const time = new FakeTime(new Date("2026-01-15T12:00:00.000Z"));

  try {
    const { startDate, endDate } = getMonthDateRange();

    // Day 15, so query current month (January)
    assertEquals(startDate, "2026-01-01T00:00:00.000Z");
    // End date is today 00:00 UTC (Jan 15)
    assertEquals(endDate, "2026-01-15T00:00:00.000Z");
  } finally {
    time.restore();
  }
});

Deno.test("getMonthDateRange - year boundary January 1 queries December", () => {
  // Mock Date to January 1, 2026 12:00 UTC
  // Day 1, so query previous month (December 2025)
  const time = new FakeTime(new Date("2026-01-01T12:00:00.000Z"));

  try {
    const { startDate, endDate } = getMonthDateRange();

    // Should query December 2025 (previous month)
    assertEquals(startDate, "2025-12-01T00:00:00.000Z");
    assertEquals(endDate, "2026-01-01T00:00:00.000Z");
  } finally {
    time.restore();
  }
});
