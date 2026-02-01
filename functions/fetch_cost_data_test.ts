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

Deno.test("getMonthDateRange - mid month uses tomorrow as end date", () => {
  // Mock Date to January 15, 2026 UTC
  // End of January (Feb 1) is in the future, so end date should be Jan 16 00:00
  const time = new FakeTime(new Date("2026-01-15T12:00:00.000Z"));

  try {
    const { startDate, endDate } = getMonthDateRange();

    assertEquals(startDate, "2026-01-01T00:00:00.000Z");
    // End date is tomorrow 00:00 UTC since Feb 1 is in the future
    assertEquals(endDate, "2026-01-16T00:00:00.000Z");
  } finally {
    time.restore();
  }
});

Deno.test("getMonthDateRange - first day of month uses tomorrow as end date", () => {
  // Mock Date to February 1, 2026 15:19 UTC (= Feb 2 00:19 JST)
  // This is the exact scenario causing the bug
  const time = new FakeTime(new Date("2026-02-01T15:19:00.000Z"));

  try {
    const { startDate, endDate } = getMonthDateRange();

    assertEquals(startDate, "2026-02-01T00:00:00.000Z");
    // End date should be Feb 2 00:00 UTC (tomorrow), not same day
    assertEquals(endDate, "2026-02-02T00:00:00.000Z");
  } finally {
    time.restore();
  }
});

Deno.test("getMonthDateRange - end of month used when past month boundary", () => {
  // Mock Date to May 1, 2024 00:00:01 UTC - just after April ended
  // Now we're in May, querying for May
  const time = new FakeTime(new Date("2024-05-01T00:00:01.000Z"));

  try {
    const { startDate, endDate } = getMonthDateRange();

    // Now we're in May, so we query for May
    assertEquals(startDate, "2024-05-01T00:00:00.000Z");
    // End of May (June 1) is in the future, so end date is tomorrow (May 2)
    assertEquals(endDate, "2024-05-02T00:00:00.000Z");
  } finally {
    time.restore();
  }
});

Deno.test("getMonthDateRange - last day of month uses next day", () => {
  // Mock Date to last day of December
  // Dec 31, 2025 23:59:59 UTC - end of Dec (Jan 1) is still in the future
  const time = new FakeTime(new Date("2025-12-31T23:59:59.000Z"));

  try {
    const { startDate, endDate } = getMonthDateRange();

    assertEquals(startDate, "2025-12-01T00:00:00.000Z");
    // Tomorrow is Jan 1, which is also end of month - same value
    assertEquals(endDate, "2026-01-01T00:00:00.000Z");
  } finally {
    time.restore();
  }
});
