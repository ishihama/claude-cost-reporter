import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { fetchCostReport } from "../lib/anthropic_client.ts";

export const FetchCostDataFunction = DefineFunction({
  callback_id: "fetch_cost_data",
  title: "Fetch Cost Data",
  description: "Fetch cost data from Anthropic Admin API",
  source_file: "functions/fetch_cost_data.ts",
  input_parameters: {
    properties: {},
    required: [],
  },
  output_parameters: {
    properties: {
      cost_data_json: {
        type: Schema.types.string,
        description: "JSON string of cost report response",
      },
      error: {
        type: Schema.types.string,
        description: "Error message if fetch failed",
      },
    },
    required: ["cost_data_json"],
  },
});

/**
 * Get the first and last day of the current month in RFC 3339 format
 * Format: YYYY-MM-DDTHH:MM:SSZ
 */
function getMonthDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();

  // If we're on day 1 of the month (in UTC), we can't query current month yet
  // because we need end date > start date (by at least 1 day)
  // So query the previous month instead
  if (day === 1) {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    const firstDay = new Date(Date.UTC(prevYear, prevMonth, 1, 0, 0, 0));
    const endDay = new Date(Date.UTC(year, month, 1, 0, 0, 0)); // Start of current month = end of previous

    return {
      startDate: firstDay.toISOString(),
      endDate: endDay.toISOString(),
    };
  }

  // Day 2 or later: query current month
  // Use today 00:00 UTC as end date (guaranteed to be in the past or exactly now)
  const firstDay = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  const today = new Date(Date.UTC(year, month, day, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0));

  // Use today or end of month, whichever is earlier
  const endDay = today < endOfMonth ? today : endOfMonth;

  return {
    startDate: firstDay.toISOString(),
    endDate: endDay.toISOString(),
  };
}

export default SlackFunction(
  FetchCostDataFunction,
  async ({ env }) => {
    const apiKey = env.ANTHROPIC_ADMIN_API_KEY;

    console.log("[FetchCostData] API Key exists:", !!apiKey);
    console.log("[FetchCostData] API Key prefix:", apiKey?.substring(0, 15));

    if (!apiKey) {
      console.log("[FetchCostData] ERROR: ANTHROPIC_ADMIN_API_KEY is not set");
      return {
        outputs: {
          cost_data_json: "{}",
          error: "ANTHROPIC_ADMIN_API_KEY is not set",
        },
      };
    }

    try {
      const { startDate, endDate } = getMonthDateRange();
      console.log("[FetchCostData] Date range:", startDate, "to", endDate);

      const response = await fetchCostReport(apiKey, startDate, endDate, true);
      console.log("[FetchCostData] Response data count:", response.data?.length);

      // Log all buckets for debugging
      if (response.data && response.data.length > 0) {
        let totalResults = 0;
        for (const bucket of response.data) {
          if (bucket.results && bucket.results.length > 0) {
            totalResults += bucket.results.length;
            console.log("[FetchCostData] Bucket with data:", bucket.starting_at, "results:", bucket.results.length);
            for (const result of bucket.results) {
              console.log("[FetchCostData] Result:", JSON.stringify(result));
            }
          }
        }
        console.log("[FetchCostData] Total results across all buckets:", totalResults);
        if (totalResults === 0) {
          console.log("[FetchCostData] WARNING: No cost data found in any bucket!");
        }
      }

      return {
        outputs: {
          cost_data_json: JSON.stringify(response),
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      console.log("[FetchCostData] ERROR:", errorMessage);
      return {
        outputs: {
          cost_data_json: "{}",
          error: errorMessage,
        },
      };
    }
  },
);

// Export for testing
export { getMonthDateRange };
