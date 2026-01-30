import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  returnsNext,
  stub,
} from "https://deno.land/std@0.224.0/testing/mock.ts";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import FetchWorkspacesHandler from "./fetch_workspaces.ts";

const { createContext } = SlackFunctionTester("fetch_workspaces");

Deno.test("FetchWorkspaces - returns error when API key not set", async () => {
  const context = createContext({
    inputs: {},
    env: {},
  });

  const result = await FetchWorkspacesHandler(context);

  assertEquals(result.outputs?.workspaces_json, "[]");
  assertEquals(result.outputs?.error, "ANTHROPIC_ADMIN_API_KEY is not set");
});

Deno.test("FetchWorkspaces - returns workspaces on success", async () => {
  const mockWorkspaces = {
    data: [
      { id: "ws1", name: "Production", created_at: "2024-01-01" },
      { id: "ws2", name: "Development", created_at: "2024-01-01" },
    ],
    has_more: false,
  };

  const fetchStub = stub(
    globalThis,
    "fetch",
    returnsNext([
      Promise.resolve(
        new Response(JSON.stringify(mockWorkspaces), { status: 200 }),
      ),
    ]),
  );

  try {
    const context = createContext({
      inputs: {},
      env: { ANTHROPIC_ADMIN_API_KEY: "test-key" },
    });

    const result = await FetchWorkspacesHandler(context);

    assertEquals(result.outputs?.error, undefined);
    const workspaces = JSON.parse(result.outputs?.workspaces_json ?? "[]");
    assertEquals(workspaces.length, 2);
    assertEquals(workspaces[0].name, "Production");
  } finally {
    fetchStub.restore();
  }
});

Deno.test("FetchWorkspaces - handles API error", async () => {
  const fetchStub = stub(
    globalThis,
    "fetch",
    returnsNext([
      Promise.resolve(new Response("Unauthorized", { status: 401 })),
    ]),
  );

  try {
    const context = createContext({
      inputs: {},
      env: { ANTHROPIC_ADMIN_API_KEY: "invalid-key" },
    });

    const result = await FetchWorkspacesHandler(context);

    assertEquals(result.outputs?.workspaces_json, "[]");
    assertEquals(result.outputs?.error?.includes("401"), true);
  } finally {
    fetchStub.restore();
  }
});
