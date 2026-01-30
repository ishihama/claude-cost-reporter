import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { SlackFunctionTester } from "deno-slack-sdk/mod.ts";
import PostReportHandler from "./post_report.ts";

const { createContext } = SlackFunctionTester("post_report");

Deno.test("PostReport - returns error when channel not set", async () => {
  const context = createContext({
    inputs: {
      message: "Test message",
      is_error: false,
    },
    env: {},
  });

  const result = await PostReportHandler(context);

  assertEquals(result.outputs?.success, false);
  assertEquals(result.outputs?.error, "SLACK_CHANNEL_ID is not set");
});

// Note: Integration tests with mocked Slack client would require
// the actual Slack runtime environment. These tests verify the
// function logic when channel is not configured.
// Full integration testing should be done with `slack run`.
