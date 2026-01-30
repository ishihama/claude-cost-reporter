import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  returnsNext,
  stub,
} from "https://deno.land/std@0.224.0/testing/mock.ts";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import FetchCostDataHandler from "./fetch_cost_data.ts";

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
