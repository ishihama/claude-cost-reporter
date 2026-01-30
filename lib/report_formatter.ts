import type { AlertLevel, CostReport } from "./types.ts";

const ALERT_ICONS: Record<AlertLevel, string> = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
};

// Block Kit types
export interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: Array<{ type: string; text: string }>;
  fields?: Array<{ type: string; text: string }>;
}

export interface SlackBlocksResult {
  text: string; // Fallback text for notifications
  blocks: SlackBlock[];
}

/**
 * Format a number as USD currency
 */
export function formatUSD(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format a number as percentage
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format date in Japanese format
 */
export function formatDateJP(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
}

/**
 * Get alert icon for level
 */
export function getAlertIcon(level: AlertLevel): string {
  return ALERT_ICONS[level];
}

/**
 * Format a cost report for Slack
 */
export function formatSlackReport(report: CostReport): string {
  const lines: string[] = [];

  // Header
  lines.push("*📊 Claude API コストレポート*");
  lines.push(
    `${formatDateJP(report.report_date)} (${report.days_elapsed}/${report.days_in_month}日経過)`,
  );
  lines.push("");

  // Organization summary
  lines.push("*🏢 組織全体*");
  lines.push(`├ 今月の利用額: ${formatUSD(report.organization.total_amount_usd)}`);

  if (report.organization.budget_usd) {
    const budgetPercent =
      (report.organization.total_forecast_usd / report.organization.budget_usd) *
      100;
    lines.push(
      `├ 月末予測: ${formatUSD(report.organization.total_forecast_usd)} (予算の${formatPercentage(budgetPercent)})`,
    );
    lines.push(`├ 月間予算: ${formatUSD(report.organization.budget_usd)}`);
  } else {
    lines.push(
      `├ 月末予測: ${formatUSD(report.organization.total_forecast_usd)}`,
    );
    lines.push("├ 月間予算: 未設定");
  }

  lines.push(`└ ステータス: ${getAlertIcon(report.organization.alert_level)}`);
  lines.push("");

  // Workspace breakdown
  if (report.workspaces.length > 0) {
    lines.push("*📁 ワークスペース別*");

    for (const ws of report.workspaces) {
      const icon = getAlertIcon(ws.alert_level);
      lines.push(`${icon} *${ws.workspace_name}*`);

      if (ws.budget_usd) {
        const budgetPercent = (ws.forecast_usd / ws.budget_usd) * 100;
        lines.push(
          `   利用額: ${formatUSD(ws.amount_usd)} → 予測: ${formatUSD(ws.forecast_usd)} (予算${formatUSD(ws.budget_usd)}の${formatPercentage(budgetPercent)})`,
        );
      } else {
        lines.push(
          `   利用額: ${formatUSD(ws.amount_usd)} → 予測: ${formatUSD(ws.forecast_usd)}`,
        );
      }
    }
  }

  return lines.join("\n");
}

/**
 * Format an error message for Slack
 */
export function formatErrorMessage(error: string): string {
  return `*⚠️ Claude API コストレポート - エラー*\n\nレポートの生成中にエラーが発生しました:\n\`\`\`\n${error}\n\`\`\``;
}

/**
 * Create a progress bar using Unicode characters
 */
export function createProgressBar(percent: number, width: number = 20): string {
  const clampedPercent = Math.min(100, Math.max(0, percent));
  const filled = Math.round((clampedPercent / 100) * width);
  const empty = width - filled;
  return "█".repeat(filled) + "░".repeat(empty);
}

/**
 * Format a cost report as Slack Block Kit blocks
 */
export function formatSlackBlocks(report: CostReport): SlackBlocksResult {
  const blocks: SlackBlock[] = [];

  // Header
  blocks.push({
    type: "header",
    text: {
      type: "plain_text",
      text: "📊 Claude API コストレポート",
      emoji: true,
    },
  });

  // Date and legend context
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `${formatDateJP(report.report_date)} (${report.days_elapsed}/${report.days_in_month}日経過)  |  🟢 <70%  🟡 70-99%  🔴 ≥100%`,
      },
    ],
  });

  blocks.push({ type: "divider" });

  // Organization summary - same format as workspaces
  const orgIcon = report.organization.budget_usd
    ? getAlertIcon(report.organization.alert_level)
    : "🏢";
  const orgCostText = `${formatUSD(report.organization.total_amount_usd)} → ${formatUSD(report.organization.total_forecast_usd)} (予測)`;

  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `${orgIcon} *組織全体*\n${orgCostText}`,
    },
  });

  // Organization progress bar
  if (report.organization.budget_usd) {
    const budgetPercent = (report.organization.total_forecast_usd / report.organization.budget_usd) * 100;
    const budgetProgressBar = createProgressBar(budgetPercent);
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `${budgetProgressBar} *${formatPercentage(budgetPercent)}* of ${formatUSD(report.organization.budget_usd)}`,
        },
      ],
    });
  } else {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "_予算未設定_",
        },
      ],
    });
  }

  // Workspace breakdown
  if (report.workspaces.length > 0) {
    blocks.push({ type: "divider" });

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*📁 ワークスペース別*",
      },
    });

    for (const ws of report.workspaces) {
      let icon: string;
      let costText: string;
      let progressText: string;

      if (ws.budget_usd) {
        // Show budget usage when budget is set
        icon = getAlertIcon(ws.alert_level);
        const budgetPercent = (ws.forecast_usd / ws.budget_usd) * 100;
        const wsProgressBar = createProgressBar(budgetPercent);
        costText = `${formatUSD(ws.amount_usd)} → ${formatUSD(ws.forecast_usd)} (予測)`;
        progressText = `${wsProgressBar} *${formatPercentage(budgetPercent)}* of ${formatUSD(ws.budget_usd)}`;
      } else {
        // Show share of total org spend when no budget
        icon = "📁";
        const sharePercent = report.organization.total_amount_usd > 0
          ? (ws.amount_usd / report.organization.total_amount_usd) * 100
          : 0;
        const wsProgressBar = createProgressBar(sharePercent);
        costText = `${formatUSD(ws.amount_usd)} → ${formatUSD(ws.forecast_usd)} (予測)`;
        progressText = `${wsProgressBar} *${formatPercentage(sharePercent)}* of total`;
      }

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${icon} *${ws.workspace_name}*\n${costText}`,
        },
      });

      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: progressText,
          },
        ],
      });
    }
  }

  // Fallback text for notifications
  const fallbackText = `📊 Claude API コストレポート - ${formatDateJP(report.report_date)} | 利用額: ${formatUSD(report.organization.total_amount_usd)} → 予測: ${formatUSD(report.organization.total_forecast_usd)}`;

  return {
    text: fallbackText,
    blocks,
  };
}

/**
 * Format an error message as Slack Block Kit blocks
 */
export function formatErrorBlocks(error: string): SlackBlocksResult {
  const blocks: SlackBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "⚠️ Claude API コストレポート - エラー",
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `レポートの生成中にエラーが発生しました:\n\`\`\`\n${error}\n\`\`\``,
      },
    },
  ];

  return {
    text: `⚠️ Claude API コストレポート - エラー: ${error}`,
    blocks,
  };
}
