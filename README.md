# Claude Feedback Agent

ユーザーフィードバックを受け取り、Claude Codeで自動実装するエージェントシステム。

## 機能

- フィードバック送信 → GitHub Issue自動作成
- Slack通知（承認ボタン付き）
- 2段階承認フロー（計画 → 実装）
- Claude Codeによる自動実装
- PR自動作成

## フロー

```
ユーザー → フィードバック送信
    ↓
GitHub Issue作成
    ↓
Slack通知「📋 計画を立てる」
    ↓ [承認]
Claude Code → 計画作成
    ↓
Slack通知「✅ 実装開始」
    ↓ [承認]
Claude Code → 実装
    ↓
PR作成 → Slack通知
```

## セットアップ

### クイックスタート (推奨)

```bash
# 1. テンプレートからリポジトリ作成後
npm install

# 2. セットアップCLIを実行
npm run setup
```

セットアップCLIが以下を自動で行います:
- `.env.local` ファイル作成
- GitHub Secrets設定
- Slack App作成のガイド

### 手動セットアップ

<details>
<summary>クリックして展開</summary>

#### 1. このテンプレートからリポジトリ作成

「Use this template」ボタンをクリック

#### 2. Slack App作成

1. https://api.slack.com/apps にアクセス
2. 「Create New App」→「From an app manifest」
3. `.github/slack-app-manifest.yml` の内容を貼り付け
4. Appをワークスペースにインストール

#### 3. GitHub Secrets設定

リポジトリの Settings → Secrets and variables → Actions で以下を設定:

| Secret | 説明 |
|--------|------|
| `ANTHROPIC_API_KEY` | Anthropic APIキー |
| `SLACK_BOT_TOKEN` | Slack Bot OAuth Token (xoxb-...) |
| `SLACK_CHANNEL_ID` | 通知先チャンネルID |

#### 4. 環境変数設定

`.env.example` を `.env.local` にコピーして値を設定:

```bash
cp .env.example .env.local
```

#### 5. Slack Appの Interactivity 設定

1. Slack App設定 → Interactivity & Shortcuts
2. Request URL: `https://your-domain.com/api/v1/webhooks/slack`

</details>

## 使い方

1. アプリにフィードバックボタンを追加:

```tsx
import { FeedbackButton } from '@/components/feedback/FeedbackButton';

export default function Layout({ children }) {
  return (
    <>
      {children}
      <FeedbackButton />
    </>
  );
}
```

2. ユーザーがフィードバックを送信
3. Slackで承認/却下を選択
4. Claude Codeが自動で実装

## ライセンス

MIT
