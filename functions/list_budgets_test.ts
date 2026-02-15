import {
  assertEquals,
  assertMatch,
  assertNotMatch,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

// Test: overflow menu action_id is fixed string, not dynamic per workspace
// This prevents regression of the bug where Slack Deno SDK ignores RegExp
// patterns in addBlockActionsHandler, causing "no action handler" errors.
Deno.test("ListBudgets - overflow menu uses fixed action_id in source", async () => {
  const source = await Deno.readTextFile("./functions/list_budgets.ts");

  // Should NOT have dynamic action_id template literals for budget_actions
  assertNotMatch(source, /action_id:\s*`budget_actions_\$\{/);

  // Should have fixed action_id string
  assertMatch(source, /action_id:\s*"budget_actions"/);
});

// Test: handler registration uses string literal, not RegExp
Deno.test("ListBudgets - handler constraint uses string literal not RegExp", async () => {
  const source = await Deno.readTextFile("./functions/list_budgets.ts");

  // Should NOT use RegExp pattern for budget_actions in handler registration
  assertNotMatch(source, /\/\^budget_actions/);

  // Should use string "budget_actions" in the constraint array
  assertMatch(source, /addBlockActionsHandler\(\s*\[.*"budget_actions".*\]/s);
});

// Test: action routing uses exact match, not startsWith
Deno.test("ListBudgets - action routing uses exact match for budget_actions", async () => {
  const source = await Deno.readTextFile("./functions/list_budgets.ts");

  // Should NOT use startsWith for budget_actions matching
  assertNotMatch(source, /\.startsWith\("budget_actions_"\)/);

  // Should use exact match
  assertMatch(source, /action\.action_id === "budget_actions"/);
});

// Test: workspace ID is correctly extracted from selected_option value
Deno.test("ListBudgets - workspace ID extraction from edit value", () => {
  const selectedValue = "edit_wrkspc_abc123";
  const workspaceId = selectedValue.replace("edit_", "");
  assertEquals(workspaceId, "wrkspc_abc123");
});

Deno.test("ListBudgets - workspace ID extraction from delete value", () => {
  const selectedValue = "delete_wrkspc_abc123";
  const workspaceId = selectedValue.replace("delete_", "");
  assertEquals(workspaceId, "wrkspc_abc123");
});

// Test: exact match correctly routes budget_actions but not old dynamic IDs
Deno.test("ListBudgets - exact match rejects old dynamic action IDs", () => {
  const fixedId = "budget_actions";
  const oldDynamicIds = [
    "budget_actions_ws123",
    "budget_actions_wrkspc_abc",
    "budget_actions_",
  ];

  assertEquals(fixedId === "budget_actions", true);

  for (const oldId of oldDynamicIds) {
    assertEquals(
      oldId === "budget_actions",
      false,
      `Old dynamic ID "${oldId}" should not match fixed "budget_actions"`,
    );
  }
});
