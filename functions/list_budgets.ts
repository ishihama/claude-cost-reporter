import { DefineFunction, Schema, SlackFunction } from "deno-slack-sdk/mod.ts";
import { WorkspaceBudgetsDatastore } from "../datastores/workspace_budgets.ts";
import { fetchWorkspaces } from "../lib/anthropic_client.ts";

export const ListBudgetsFunction = DefineFunction({
  callback_id: "list_budgets",
  title: "List Budgets",
  description: "List organization and workspace budgets with interactive management",
  source_file: "functions/list_budgets.ts",
  input_parameters: {
    properties: {
      interactivity: {
        type: Schema.slack.types.interactivity,
      },
    },
    required: ["interactivity"],
  },
  output_parameters: {
    properties: {},
    required: [],
  },
});

// Special ID for organization budget
const ORG_BUDGET_ID = "__ORG__";

export default SlackFunction(
  ListBudgetsFunction,
  async ({ inputs, client }) => {
    console.log("[ListBudgets] Function started");

    // Fetch all budgets from datastore
    const result = await client.apps.datastore.query({
      datastore: WorkspaceBudgetsDatastore.name,
    });

    if (!result.ok) {
      console.log("[ListBudgets] Datastore query failed:", result.error);
      return { completed: false };
    }

    // Separate org budget from workspace budgets
    const allItems = result.items;
    const orgBudgetItem = allItems.find((item) => item.workspace_id === ORG_BUDGET_ID);
    const workspaceBudgets = allItems.filter((item) => item.workspace_id !== ORG_BUDGET_ID);

    console.log(`[ListBudgets] Found org budget: ${orgBudgetItem ? "yes" : "no"}, workspace budgets: ${workspaceBudgets.length}`);

    // Build blocks for the message
    // deno-lint-ignore no-explicit-any
    const blocks: any[] = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "💰 予算管理",
          emoji: true,
        },
      },
    ];

    // Organization budget section
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: orgBudgetItem
          ? `*🏢 組織全体の月間予算*\n*$${Number(orgBudgetItem.budget_usd).toLocaleString("en-US", { minimumFractionDigits: 2 })}*`
          : "*🏢 組織全体の月間予算*\n_未設定_",
      },
      accessory: {
        type: "button",
        text: {
          type: "plain_text",
          text: orgBudgetItem ? "✏️ 編集" : "➕ 設定",
          emoji: true,
        },
        action_id: "edit_org_budget",
      },
    });

    blocks.push({ type: "divider" });

    // Workspace budgets section
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*📁 ワークスペース別予算* (${workspaceBudgets.length}件)`,
        },
      ],
    });

    if (workspaceBudgets.length === 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "_ワークスペース予算が登録されていません_",
        },
      });
    } else {
      for (const budget of workspaceBudgets) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*📁 ${budget.workspace_name}*\n予算: *$${Number(budget.budget_usd).toLocaleString("en-US", { minimumFractionDigits: 2 })}*`,
          },
          accessory: {
            type: "overflow",
            action_id: "budget_actions",
            options: [
              {
                text: {
                  type: "plain_text",
                  text: "✏️ 編集",
                  emoji: true,
                },
                value: `edit_${budget.workspace_id}`,
              },
              {
                text: {
                  type: "plain_text",
                  text: "🗑️ 削除",
                  emoji: true,
                },
                value: `delete_${budget.workspace_id}`,
              },
            ],
          },
        });
        blocks.push({ type: "divider" });
      }
    }

    // Add "New" button
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "➕ 新規追加",
            emoji: true,
          },
          style: "primary",
          action_id: "add_budget",
        },
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "🔄 更新",
            emoji: true,
          },
          action_id: "refresh_budgets",
        },
      ],
    });

    // Post the message
    const postResult = await client.chat.postMessage({
      channel: inputs.interactivity.interactor.id,
      blocks: blocks,
      text: "ワークスペース予算管理",
    });

    console.log("[ListBudgets] Message posted:", postResult.ok);

    // Return completed: false to keep the function alive for Block Actions
    return { completed: false };
  },
)
  // Handle button clicks
  .addBlockActionsHandler(
    ["add_budget", "refresh_budgets", "edit_org_budget", "budget_actions"],
    async ({ action, body, client, env }) => {
      console.log("[ListBudgets] Block action received:", action.action_id);
      const userId = body.user.id;
      const channelId = body.container?.channel_id;
      const messageTs = body.container?.message_ts;
      console.log(`[ListBudgets] User: ${userId}, Channel: ${channelId}, MessageTs: ${messageTs}`);

      if (action.action_id === "edit_org_budget") {
        console.log("[ListBudgets] Opening org budget modal");

        // Get current org budget
        const result = await client.apps.datastore.get({
          datastore: WorkspaceBudgetsDatastore.name,
          id: ORG_BUDGET_ID,
        });

        const currentBudget = result.ok && result.item ? result.item.budget_usd : "";

        await client.views.open({
          interactivity_pointer: body.interactivity.interactivity_pointer,
          view: {
            type: "modal",
            callback_id: "org_budget_modal",
            title: {
              type: "plain_text",
              text: "組織予算を設定",
            },
            submit: {
              type: "plain_text",
              text: "保存",
            },
            close: {
              type: "plain_text",
              text: "キャンセル",
            },
            private_metadata: JSON.stringify({ channelId, messageTs }),
            blocks: [
              {
                type: "input",
                block_id: "budget_usd_block",
                element: {
                  type: "number_input",
                  action_id: "budget_usd",
                  is_decimal_allowed: true,
                  initial_value: currentBudget ? String(currentBudget) : undefined,
                  placeholder: {
                    type: "plain_text",
                    text: "5000",
                  },
                },
                label: {
                  type: "plain_text",
                  text: "月間予算 (USD)",
                },
              },
            ],
          },
        });
      } else if (action.action_id === "add_budget") {
        console.log("[ListBudgets] Opening add budget modal");

        // Fetch workspaces from Anthropic API
        const apiKey = env.ANTHROPIC_ADMIN_API_KEY;
        // deno-lint-ignore no-explicit-any
        let workspaceOptions: any[] = [];

        if (apiKey) {
          try {
            const response = await fetchWorkspaces(apiKey);
            workspaceOptions = response.data.map((ws) => ({
              text: {
                type: "plain_text",
                text: ws.name,
              },
              value: JSON.stringify({ id: ws.id, name: ws.name }),
            }));
            console.log(`[ListBudgets] Fetched ${workspaceOptions.length} workspaces`);
          } catch (error) {
            console.log("[ListBudgets] Failed to fetch workspaces:", error);
          }
        }

        // Build modal blocks
        // deno-lint-ignore no-explicit-any
        const modalBlocks: any[] = [];

        if (workspaceOptions.length > 0) {
          // Use dropdown if workspaces available
          modalBlocks.push({
            type: "input",
            block_id: "workspace_block",
            element: {
              type: "static_select",
              action_id: "workspace_select",
              placeholder: {
                type: "plain_text",
                text: "ワークスペースを選択",
              },
              options: workspaceOptions,
            },
            label: {
              type: "plain_text",
              text: "ワークスペース",
            },
          });
        } else {
          // Fallback to manual input
          modalBlocks.push(
            {
              type: "input",
              block_id: "workspace_id_block",
              element: {
                type: "plain_text_input",
                action_id: "workspace_id",
                placeholder: {
                  type: "plain_text",
                  text: "wrkspc_xxxxx",
                },
              },
              label: {
                type: "plain_text",
                text: "ワークスペースID",
              },
            },
            {
              type: "input",
              block_id: "workspace_name_block",
              element: {
                type: "plain_text_input",
                action_id: "workspace_name",
                placeholder: {
                  type: "plain_text",
                  text: "Production",
                },
              },
              label: {
                type: "plain_text",
                text: "ワークスペース名",
              },
            },
          );
        }

        modalBlocks.push({
          type: "input",
          block_id: "budget_usd_block",
          element: {
            type: "number_input",
            action_id: "budget_usd",
            is_decimal_allowed: true,
            placeholder: {
              type: "plain_text",
              text: "2000",
            },
          },
          label: {
            type: "plain_text",
            text: "月間予算 (USD)",
          },
        });

        // Open add form
        const openResult = await client.views.open({
          interactivity_pointer: body.interactivity.interactivity_pointer,
          view: {
            type: "modal",
            callback_id: "add_budget_modal",
            title: {
              type: "plain_text",
              text: "予算を追加",
            },
            submit: {
              type: "plain_text",
              text: "保存",
            },
            close: {
              type: "plain_text",
              text: "キャンセル",
            },
            private_metadata: JSON.stringify({ channelId, messageTs }),
            blocks: modalBlocks,
          },
        });
        console.log("[ListBudgets] Modal open result:", openResult.ok, openResult.error);
      } else if (action.action_id === "refresh_budgets") {
        console.log("[ListBudgets] Refreshing budget list");
        // Refresh the list
        await refreshBudgetList(client, channelId, messageTs);
        console.log("[ListBudgets] Refresh complete");
      } else if (action.action_id === "budget_actions") {
        // Handle overflow menu selection
        const selectedValue = action.selected_option?.value;
        if (selectedValue?.startsWith("edit_")) {
          const workspaceId = selectedValue.replace("edit_", "");

          // Get current budget data
          const result = await client.apps.datastore.get({
            datastore: WorkspaceBudgetsDatastore.name,
            id: workspaceId,
          });

          if (result.ok && result.item) {
            const budget = result.item;

            // Open edit form with current values
            await client.views.open({
              interactivity_pointer: body.interactivity.interactivity_pointer,
              view: {
                type: "modal",
                callback_id: "edit_budget_modal",
                title: {
                  type: "plain_text",
                  text: "予算を編集",
                },
                submit: {
                  type: "plain_text",
                  text: "保存",
                },
                close: {
                  type: "plain_text",
                  text: "キャンセル",
                },
                private_metadata: JSON.stringify({
                  channelId,
                  messageTs,
                  workspaceId: budget.workspace_id,
                  workspaceName: budget.workspace_name,
                }),
                blocks: [
                  {
                    type: "section",
                    text: {
                      type: "mrkdwn",
                      text: `*ワークスペース*\n${budget.workspace_name}\n\`${budget.workspace_id}\``,
                    },
                  },
                  { type: "divider" },
                  {
                    type: "input",
                    block_id: "budget_usd_block",
                    element: {
                      type: "number_input",
                      action_id: "budget_usd",
                      is_decimal_allowed: true,
                      initial_value: String(budget.budget_usd),
                    },
                    label: {
                      type: "plain_text",
                      text: "月間予算 (USD)",
                    },
                  },
                ],
              },
            });
          }
        } else if (selectedValue?.startsWith("delete_")) {
          const workspaceId = selectedValue.replace("delete_", "");

          // Get budget name for confirmation
          const result = await client.apps.datastore.get({
            datastore: WorkspaceBudgetsDatastore.name,
            id: workspaceId,
          });

          const workspaceName = result.item?.workspace_name || workspaceId;

          // Open confirmation modal
          await client.views.open({
            interactivity_pointer: body.interactivity.interactivity_pointer,
            view: {
              type: "modal",
              callback_id: "delete_budget_modal",
              title: {
                type: "plain_text",
                text: "予算を削除",
              },
              submit: {
                type: "plain_text",
                text: "削除する",
              },
              close: {
                type: "plain_text",
                text: "キャンセル",
              },
              private_metadata: JSON.stringify({
                channelId,
                messageTs,
                workspaceId,
              }),
              blocks: [
                {
                  type: "section",
                  text: {
                    type: "mrkdwn",
                    text: `*${workspaceName}* の予算を削除しますか？\n\nこの操作は取り消せません。`,
                  },
                },
              ],
            },
          });
        }
      }
    },
  )
  // Handle modal submissions
  .addViewSubmissionHandler(
    ["add_budget_modal", "edit_budget_modal"],
    async ({ view, body, client }) => {
      console.log("[ListBudgets] View submission received:", view.callback_id);
      const values = view.state.values;
      const metadata = JSON.parse(view.private_metadata || "{}");

      // Handle workspace info based on modal type
      let workspaceId: string;
      let workspaceName: string;

      if (view.callback_id === "edit_budget_modal") {
        // Edit mode: get from metadata
        workspaceId = metadata.workspaceId;
        workspaceName = metadata.workspaceName;
        console.log(`[ListBudgets] Editing workspace: ${workspaceName} (${workspaceId})`);
      } else if (values.workspace_block?.workspace_select?.selected_option) {
        // Add mode with dropdown selection
        const selected = JSON.parse(
          values.workspace_block.workspace_select.selected_option.value,
        );
        workspaceId = selected.id;
        workspaceName = selected.name;
        console.log(`[ListBudgets] Selected workspace: ${workspaceName} (${workspaceId})`);
      } else {
        // Add mode with manual input (fallback)
        workspaceId = values.workspace_id_block?.workspace_id?.value || "";
        workspaceName = values.workspace_name_block?.workspace_name?.value || "";
      }

      const budgetUsd = parseFloat(values.budget_usd_block.budget_usd.value || "0");
      const userId = body.user.id;

      // Save to datastore
      const result = await client.apps.datastore.put({
        datastore: WorkspaceBudgetsDatastore.name,
        item: {
          workspace_id: workspaceId,
          workspace_name: workspaceName,
          budget_usd: budgetUsd,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        },
      });

      if (result.ok) {
        // Refresh the list
        await refreshBudgetList(client, metadata.channelId, metadata.messageTs);
      }

      return { response_action: "clear" };
    },
  )
  .addViewSubmissionHandler(
    ["delete_budget_modal"],
    async ({ view, client }) => {
      console.log("[ListBudgets] Delete modal submission received");
      const metadata = JSON.parse(view.private_metadata || "{}");
      const workspaceId = metadata.workspaceId;

      // Delete from datastore
      const result = await client.apps.datastore.delete({
        datastore: WorkspaceBudgetsDatastore.name,
        id: workspaceId,
      });

      if (result.ok) {
        // Refresh the list
        await refreshBudgetList(client, metadata.channelId, metadata.messageTs);
      }

      return { response_action: "clear" };
    },
  )
  .addViewSubmissionHandler(
    ["org_budget_modal"],
    async ({ view, body, client }) => {
      console.log("[ListBudgets] Org budget modal submission received");
      const values = view.state.values;
      const metadata = JSON.parse(view.private_metadata || "{}");
      const budgetUsd = parseFloat(values.budget_usd_block.budget_usd.value || "0");
      const userId = body.user.id;

      // Save org budget to datastore
      const result = await client.apps.datastore.put({
        datastore: WorkspaceBudgetsDatastore.name,
        item: {
          workspace_id: ORG_BUDGET_ID,
          workspace_name: "組織全体",
          budget_usd: budgetUsd,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        },
      });

      if (result.ok) {
        // Refresh the list
        await refreshBudgetList(client, metadata.channelId, metadata.messageTs);
      }

      return { response_action: "clear" };
    },
  );

// Helper function to refresh the budget list message
// deno-lint-ignore no-explicit-any
async function refreshBudgetList(client: any, channelId: string, messageTs: string) {
  if (!channelId || !messageTs) return;

  // Fetch all budgets
  const result = await client.apps.datastore.query({
    datastore: WorkspaceBudgetsDatastore.name,
  });

  const allItems = result.ok ? result.items : [];
  const orgBudgetItem = allItems.find((item: { workspace_id: string }) => item.workspace_id === ORG_BUDGET_ID);
  const workspaceBudgets = allItems.filter((item: { workspace_id: string }) => item.workspace_id !== ORG_BUDGET_ID);

  // Build updated blocks
  // deno-lint-ignore no-explicit-any
  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "💰 予算管理",
        emoji: true,
      },
    },
  ];

  // Organization budget section
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: orgBudgetItem
        ? `*🏢 組織全体の月間予算*\n*$${Number(orgBudgetItem.budget_usd).toLocaleString("en-US", { minimumFractionDigits: 2 })}*`
        : "*🏢 組織全体の月間予算*\n_未設定_",
    },
    accessory: {
      type: "button",
      text: {
        type: "plain_text",
        text: orgBudgetItem ? "✏️ 編集" : "➕ 設定",
        emoji: true,
      },
      action_id: "edit_org_budget",
    },
  });

  blocks.push({ type: "divider" });

  // Workspace budgets section
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `*📁 ワークスペース別予算* (${workspaceBudgets.length}件)`,
      },
    ],
  });

  if (workspaceBudgets.length === 0) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "_ワークスペース予算が登録されていません_",
      },
    });
  } else {
    for (const budget of workspaceBudgets) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📁 ${budget.workspace_name}*\n予算: *$${Number(budget.budget_usd).toLocaleString("en-US", { minimumFractionDigits: 2 })}*`,
        },
        accessory: {
          type: "overflow",
          action_id: "budget_actions",
          options: [
            {
              text: {
                type: "plain_text",
                text: "✏️ 編集",
                emoji: true,
              },
              value: `edit_${budget.workspace_id}`,
            },
            {
              text: {
                type: "plain_text",
                text: "🗑️ 削除",
                emoji: true,
              },
              value: `delete_${budget.workspace_id}`,
            },
          ],
        },
      });
      blocks.push({ type: "divider" });
    }
  }

  blocks.push({
    type: "actions",
    elements: [
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "➕ 新規追加",
          emoji: true,
        },
        style: "primary",
        action_id: "add_budget",
      },
      {
        type: "button",
        text: {
          type: "plain_text",
          text: "🔄 更新",
          emoji: true,
        },
        action_id: "refresh_budgets",
      },
    ],
  });

  // Update the message
  await client.chat.update({
    channel: channelId,
    ts: messageTs,
    blocks: blocks,
    text: "予算管理",
  });
}
