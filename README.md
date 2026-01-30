# Claude Cost Reporter

Anthropic Admin APIを使用して、Claude APIの利用コストを毎日Slackにレポートするボットです。

## 機能

- 毎日のコストレポート（Block Kit形式のリッチな表示）
- 組織全体・ワークスペース別の利用額と月末予測
- 予算管理（Slack Datastoreで永続化）
- アラートレベル表示（🟢 <70% | 🟡 70-99% | 🔴 ≥100%）
- インタラクティブな予算設定UI

## レポート例

```
📊 Claude API コストレポート
2026年1月30日 (30/31日経過)  |  🟢 <70%  🟡 70-99%  🔴 ≥100%
─────────────────────────────
🟢 組織全体
$510.84 → $527.86 (予測)
██░░░░░░░░░░░░░░░░░░ 10.6% of $5,000.00
─────────────────────────────
📁 ワークスペース別

🟢 Production
$510.77 → $527.80 (予測)
█████░░░░░░░░░░░░░░░ 26.4% of $2,000.00
```

## セットアップ

### 前提条件

- [Slack CLI](https://api.slack.com/automation/cli/install)
- Slackの有料プラン（Pro以上）
- Anthropic Admin APIキー（`sk-ant-admin-`で始まる形式）

### インストール

```bash
# リポジトリをクローン
git clone <repository-url>
cd claude-cost-reporter

# Slackワークスペースに接続
slack login

# デプロイ
slack deploy
```

### 環境変数の設定

```bash
# Anthropic Admin APIキー（必須）
slack env add ANTHROPIC_ADMIN_API_KEY sk-ant-admin-xxxxx

# レポート投稿先のSlackチャンネルID（必須）
slack env add SLACK_CHANNEL_ID C0123456789
```

### トリガーの作成

```bash
# 毎日9:00 JSTに自動実行
slack trigger create --trigger-def triggers/daily_scheduled.ts

# 手動実行用リンク
slack trigger create --trigger-def triggers/manual_link.ts

# 予算管理UI
slack trigger create --trigger-def triggers/manage_budgets_link.ts
```

## 使い方

### コストレポート

1. 手動実行: Slackで作成したショートカットリンクをクリック
2. 自動実行: 毎日9:00 JSTに指定チャンネルへ投稿

### 予算管理

1. 「Manage Budgets」ショートカットを実行
2. 組織予算: 上部の「設定」ボタンから金額を入力
3. ワークスペース予算: 「新規追加」からワークスペースを選択して金額を入力

## 開発

### テスト実行

```bash
deno task test
```

### ローカル実行

```bash
slack run
```

## ファイル構成

```
claude-cost-reporter/
├── assets/
│   └── icon.png              # ボットアイコン
├── datastores/
│   └── workspace_budgets.ts  # 予算データストア定義
├── functions/
│   ├── calculate_forecast.ts # 予測計算
│   ├── fetch_cost_data.ts    # コストデータ取得
│   ├── fetch_workspaces.ts   # ワークスペース取得
│   ├── format_report.ts      # レポートフォーマット
│   ├── get_budgets.ts        # 予算取得
│   ├── list_budgets.ts       # 予算管理UI
│   └── post_report.ts        # Slack投稿
├── lib/
│   ├── anthropic_client.ts   # Admin APIクライアント
│   ├── cost_calculator.ts    # 計算ロジック
│   ├── report_formatter.ts   # フォーマッタ
│   └── types.ts              # 型定義
├── triggers/
│   ├── daily_scheduled.ts    # 毎日9:00 JST
│   ├── manage_budgets_link.ts # 予算管理
│   └── manual_link.ts        # 手動実行
├── workflows/
│   ├── cost_report_workflow.ts    # レポートワークフロー
│   └── manage_budgets_workflow.ts # 予算管理ワークフロー
└── manifest.ts               # アプリマニフェスト
```

## ライセンス

MIT
