import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  assertSpyCalls,
  returnsNext,
  stub,
} from "https://deno.land/std@0.224.0/testing/mock.ts";
import { AnthropicClientError, fetchWithRetry } from "./anthropic_client.ts";

Deno.test("fetchWithRetry - successful response", async () => {
  const mockResponse = { data: [{ id: "test" }] };
  const fetchStub = stub(
    globalThis,
    "fetch",
    returnsNext([
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      ),
    ]),
  );

  try {
    const result = await fetchWithRetry<typeof mockResponse>(
      "https://api.anthropic.com/test",
      "test-api-key",
    );
    assertEquals(result, mockResponse);
    assertSpyCalls(fetchStub, 1);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("fetchWithRetry - retries on 500 error", async () => {
  const mockResponse = { data: [] };
  const fetchStub = stub(
    globalThis,
    "fetch",
    returnsNext([
      Promise.resolve(new Response("Server Error", { status: 500 })),
      Promise.resolve(new Response("Server Error", { status: 500 })),
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      ),
    ]),
  );

  try {
    const result = await fetchWithRetry<typeof mockResponse>(
      "https://api.anthropic.com/test",
      "test-api-key",
    );
    assertEquals(result, mockResponse);
    assertSpyCalls(fetchStub, 3);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("fetchWithRetry - throws after max retries", async () => {
  const fetchStub = stub(
    globalThis,
    "fetch",
    returnsNext([
      Promise.resolve(new Response("Server Error", { status: 500 })),
      Promise.resolve(new Response("Server Error", { status: 500 })),
      Promise.resolve(new Response("Server Error", { status: 500 })),
    ]),
  );

  try {
    await assertRejects(
      async () => {
        await fetchWithRetry(
          "https://api.anthropic.com/test",
          "test-api-key",
        );
      },
      AnthropicClientError,
      "API request failed: 500",
    );
    assertSpyCalls(fetchStub, 3);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("fetchWithRetry - does not retry on 401", async () => {
  const fetchStub = stub(
    globalThis,
    "fetch",
    returnsNext([
      Promise.resolve(new Response("Unauthorized", { status: 401 })),
    ]),
  );

  try {
    await assertRejects(
      async () => {
        await fetchWithRetry(
          "https://api.anthropic.com/test",
          "test-api-key",
        );
      },
      AnthropicClientError,
      "API request failed: 401",
    );
    assertSpyCalls(fetchStub, 1);
  } finally {
    fetchStub.restore();
  }
});

Deno.test("fetchWithRetry - retries on 429 rate limit", async () => {
  const mockResponse = { data: [] };
  const fetchStub = stub(
    globalThis,
    "fetch",
    returnsNext([
      Promise.resolve(new Response("Rate Limited", { status: 429 })),
      Promise.resolve(
        new Response(JSON.stringify(mockResponse), { status: 200 }),
      ),
    ]),
  );

  try {
    const result = await fetchWithRetry<typeof mockResponse>(
      "https://api.anthropic.com/test",
      "test-api-key",
    );
    assertEquals(result, mockResponse);
    assertSpyCalls(fetchStub, 2);
  } finally {
    fetchStub.restore();
  }
});
