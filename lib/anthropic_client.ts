import type {
  CostReportResponse,
  WorkspacesResponse,
} from "./types.ts";

const ANTHROPIC_API_BASE = "https://api.anthropic.com/v1/organizations";
const ANTHROPIC_VERSION = "2023-06-01";
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export class AnthropicClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = "AnthropicClientError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry<T>(
  url: string,
  apiKey: string,
  retries: number = MAX_RETRIES,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        return await response.json() as T;
      }

      const isRetryable = response.status >= 500 || response.status === 429;

      if (!isRetryable || attempt === retries) {
        const errorBody = await response.text();
        throw new AnthropicClientError(
          `API request failed: ${response.status} ${response.statusText} - ${errorBody}`,
          response.status,
          isRetryable,
        );
      }

      lastError = new AnthropicClientError(
        `API request failed: ${response.status}`,
        response.status,
        true,
      );
    } catch (error) {
      if (error instanceof AnthropicClientError && !error.retryable) {
        throw error;
      }
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    if (attempt < retries) {
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError ?? new Error("Unknown error during fetch");
}

export async function fetchCostReport(
  apiKey: string,
  startDate: string,
  endDate: string,
  groupByWorkspace: boolean = false,
): Promise<CostReportResponse> {
  const allData: CostReportResponse["data"] = [];
  let nextPage: string | undefined = undefined;

  // Paginate through all results
  do {
    const url = new URL(`${ANTHROPIC_API_BASE}/cost_report`);
    url.searchParams.set("starting_at", startDate);
    url.searchParams.set("ending_at", endDate);
    url.searchParams.set("limit", "31"); // Max allowed
    if (groupByWorkspace) {
      url.searchParams.append("group_by[]", "workspace_id");
    }
    if (nextPage) {
      url.searchParams.set("page", nextPage);
    }

    console.log("[AnthropicClient] Fetching cost report URL:", url.toString());
    const response = await fetchWithRetry<CostReportResponse>(url.toString(), apiKey);

    allData.push(...response.data);
    nextPage = response.has_more ? response.next_page : undefined;

    console.log("[AnthropicClient] Fetched", response.data.length, "buckets, has_more:", response.has_more);
  } while (nextPage);

  return {
    data: allData,
    has_more: false,
    next_page: undefined,
  };
}

export async function fetchWorkspaces(
  apiKey: string,
): Promise<WorkspacesResponse> {
  const url = `${ANTHROPIC_API_BASE}/workspaces`;
  return fetchWithRetry<WorkspacesResponse>(url, apiKey);
}
