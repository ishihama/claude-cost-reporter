import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";

export const PostReportFunction = DefineFunction({
  callback_id: "post_report",
  title: "Post Report",
  description: "Post cost report to Slack channel",
  source_file: "functions/post_report.ts",
  input_parameters: {
    properties: {
      message: {
        type: Schema.types.string,
        description: "Formatted Slack message (fallback text)",
      },
      blocks_json: {
        type: Schema.types.string,
        description: "Slack Block Kit blocks as JSON string",
      },
      is_error: {
        type: Schema.types.boolean,
        description: "Whether this is an error message",
      },
    },
    required: ["message", "is_error"],
  },
  output_parameters: {
    properties: {
      success: {
        type: Schema.types.boolean,
        description: "Whether the post was successful",
      },
      error: {
        type: Schema.types.string,
        description: "Error message if post failed",
      },
    },
    required: ["success"],
  },
});

export default SlackFunction(
  PostReportFunction,
  async ({ inputs, client, env }) => {
    const channelId = env.SLACK_CHANNEL_ID;

    console.log("[PostReport] Starting with channelId:", channelId);
    console.log("[PostReport] Message length:", inputs.message?.length);
    console.log("[PostReport] Is error:", inputs.is_error);

    if (!channelId) {
      console.log("[PostReport] ERROR: SLACK_CHANNEL_ID is not set");
      return {
        outputs: {
          success: false,
          error: "SLACK_CHANNEL_ID is not set",
        },
      };
    }

    try {
      console.log("[PostReport] Calling chat.postMessage...");

      // Parse blocks if provided
      // deno-lint-ignore no-explicit-any
      let blocks: any[] | undefined;
      if (inputs.blocks_json) {
        try {
          blocks = JSON.parse(inputs.blocks_json);
          console.log("[PostReport] Parsed blocks count:", blocks?.length);
        } catch (parseError) {
          console.log("[PostReport] Failed to parse blocks_json:", parseError);
          // Fall back to text-only message
        }
      }

      const result = await client.chat.postMessage({
        channel: channelId,
        text: inputs.message,
        blocks: blocks,
        mrkdwn: true,
      });

      console.log("[PostReport] Result ok:", result.ok);
      console.log("[PostReport] Result error:", result.error);

      if (!result.ok) {
        return {
          outputs: {
            success: false,
            error: result.error ?? "Unknown error posting message",
          },
        };
      }

      console.log("[PostReport] Message posted successfully!");
      return {
        outputs: {
          success: true,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      console.log("[PostReport] Exception:", errorMessage);
      return {
        outputs: {
          success: false,
          error: errorMessage,
        },
      };
    }
  },
);
