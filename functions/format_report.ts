import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import {
  formatErrorBlocks,
  formatErrorMessage,
  formatSlackBlocks,
  formatSlackReport,
} from "../lib/report_formatter.ts";
import type { CostReport } from "../lib/types.ts";

export const FormatReportFunction = DefineFunction({
  callback_id: "format_report",
  title: "Format Report",
  description: "Format cost report for Slack",
  source_file: "functions/format_report.ts",
  input_parameters: {
    properties: {
      report_json: {
        type: Schema.types.string,
        description: "JSON string of cost report",
      },
      error: {
        type: Schema.types.string,
        description: "Error message from previous steps",
      },
    },
    required: ["report_json"],
  },
  output_parameters: {
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
});

export default SlackFunction(
  FormatReportFunction,
  async ({ inputs }) => {
    // Check if there's an error from previous steps
    if (inputs.error) {
      const errorBlocks = formatErrorBlocks(inputs.error);
      return {
        outputs: {
          message: errorBlocks.text,
          blocks_json: JSON.stringify(errorBlocks.blocks),
          is_error: true,
        },
      };
    }

    try {
      const reportData = JSON.parse(inputs.report_json);

      // Reconstruct Date from ISO string
      const report: CostReport = {
        ...reportData,
        report_date: new Date(reportData.report_date),
      };

      // Generate Block Kit format
      const blocksResult = formatSlackBlocks(report);

      return {
        outputs: {
          message: blocksResult.text,
          blocks_json: JSON.stringify(blocksResult.blocks),
          is_error: false,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      const errorBlocks = formatErrorBlocks(errorMessage);
      return {
        outputs: {
          message: errorBlocks.text,
          blocks_json: JSON.stringify(errorBlocks.blocks),
          is_error: true,
        },
      };
    }
  },
);
