import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { fetchWorkspaces } from "../lib/anthropic_client.ts";

export const FetchWorkspacesFunction = DefineFunction({
  callback_id: "fetch_workspaces",
  title: "Fetch Workspaces",
  description: "Fetch workspace list from Anthropic Admin API",
  source_file: "functions/fetch_workspaces.ts",
  input_parameters: {
    properties: {},
    required: [],
  },
  output_parameters: {
    properties: {
      workspaces_json: {
        type: Schema.types.string,
        description: "JSON string of workspaces array",
      },
      error: {
        type: Schema.types.string,
        description: "Error message if fetch failed",
      },
    },
    required: ["workspaces_json"],
  },
});

export default SlackFunction(
  FetchWorkspacesFunction,
  async ({ env }) => {
    const apiKey = env.ANTHROPIC_ADMIN_API_KEY;

    if (!apiKey) {
      return {
        outputs: {
          workspaces_json: "[]",
          error: "ANTHROPIC_ADMIN_API_KEY is not set",
        },
      };
    }

    try {
      const response = await fetchWorkspaces(apiKey);
      return {
        outputs: {
          workspaces_json: JSON.stringify(response.data),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      return {
        outputs: {
          workspaces_json: "[]",
          error: errorMessage,
        },
      };
    }
  },
);
