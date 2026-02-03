# Claude Feedback Agent セットアップガイド

このドキュメントでは、Claude Feedback Agent を動作させるための詳細なセットアップ手順を説明します。

---

## 目次

1. [前提条件](#1-前提条件)
2. [Slack App の作成](#2-slack-app-の作成)
3. [Bot Token の取得](#3-bot-token-の取得)
4. [Interactivity URL の設定](#4-interactivity-url-の設定)
5. [チャンネルへの Bot 招待](#5-チャンネルへの-bot-招待)
6. [ngrok / cloudflared のセットアップ](#6-ngrok--cloudflared-のセットアップ)
7. [環境変数の設定](#7-環境変数の設定)
8. [GitHub Secrets の設定](#8-github-secrets-の設定)
9. [動作確認](#9-動作確認)
10. [トラブルシューティング](#10-トラブルシューティング)

---

## 1. 前提条件

### 必須ソフトウェア

| ソフトウェア | バージョン | 確認コマンド |
|-------------|-----------|-------------|
| Node.js | 18.x 以上 | `node --version` |
| npm | 9.x 以上 | `npm --version` |
| Git | 2.x 以上 | `git --version` |
| GitHub CLI | 2.x 以上 | `gh --version` |

### 必須アカウント・権限

- **GitHub アカウント**: リポジトリの作成・管理権限
- **Slack ワークスペース**: App の作成・インストール権限（ワークスペース管理者または許可された権限が必要）
- **Anthropic API キー**: Claude Code の利用に必要

### インストール方法

#### Node.js

```bash
# Windows (winget)
winget install OpenJS.NodeJS.LTS

# macOS (Homebrew)
brew install node

# インストール確認
node --version
npm --version
```

#### GitHub CLI

```bash
# Windows (winget)
winget install GitHub.cli

# macOS (Homebrew)
brew install gh

# ログイン（初回のみ）
gh auth login

# インストール確認
gh --version
```

---

## 2. Slack App の作成

### Step 2.1: Slack API ページにアクセス

1. ブラウザで https://api.slack.com/apps にアクセス
2. 右上の「Create New App」ボタンをクリック

### Step 2.2: マニフェストから作成

1. 「Create New App」ダイアログで **「From an app manifest」** を選択
   ```
   [Create an app from scratch]  [From an app manifest] <-- こちらを選択
   ```

2. **ワークスペースを選択**
   - ドロップダウンから Bot をインストールするワークスペースを選択
   - 「Next」をクリック

### Step 2.3: マニフェストの入力

1. 形式選択画面で **「YAML」** タブを選択

2. 以下のマニフェストをコピー＆ペースト:

```yaml
display_information:
  name: Feedback Agent
  description: フィードバックを受け取りClaude Codeで自動実装
  background_color: "#4A154B"

features:
  bot_user:
    display_name: Feedback Agent
    always_online: true

oauth_config:
  scopes:
    bot:
      - chat:write
      - channels:read
      - groups:read

settings:
  interactivity:
    is_enabled: true
    request_url: https://your-domain.com/api/v1/webhooks/slack
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false
```

> **注意**: `request_url` は後で変更するため、この時点では仮の URL で構いません。

3. 「Next」をクリック

### Step 2.4: 確認とApp作成

1. 設定内容を確認
   - App Name: Feedback Agent
   - Scopes: `chat:write`, `channels:read`, `groups:read`
   - Interactivity: Enabled

2. 「Create」をクリック

### Step 2.5: ワークスペースへのインストール

1. App 作成後、左サイドバーの **「Install App」** をクリック
   ```
   Settings
   ├── Basic Information
   ├── Collaborators
   └── Install App  <-- ここ
   ```

2. 「Install to Workspace」ボタンをクリック

3. 権限の確認画面で「許可する」をクリック

---

## 3. Bot Token の取得

### Step 3.1: OAuth & Permissions ページ

1. 左サイドバーの **「OAuth & Permissions」** をクリック
   ```
   Features
   ├── App Home
   ├── Incoming Webhooks
   └── OAuth & Permissions  <-- ここ
   ```

### Step 3.2: Bot Token のコピー

1. 「OAuth Tokens for Your Workspace」セクションを探す

2. **「Bot User OAuth Token」** をコピー
   ```
   Bot User OAuth Token
   xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx
   [Copy]  <-- このボタンをクリック
   ```

   > **重要**: `xoxb-` で始まるトークンです。`xoxp-` (User Token) ではありません。

3. このトークンは後で `.env.local` と GitHub Secrets に設定します。

### Step 3.3: Signing Secret の取得

1. 左サイドバーの **「Basic Information」** をクリック

2. 「App Credentials」セクションを探す

3. **「Signing Secret」** の「Show」をクリックしてコピー
   ```
   Signing Secret
   xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   [Show] [Regenerate]
   ```

---

## 4. Interactivity URL の設定

Slack のボタンクリックを受け取るために、公開 URL を設定する必要があります。

### Step 4.1: Interactivity & Shortcuts ページ

1. 左サイドバーの **「Interactivity & Shortcuts」** をクリック
   ```
   Features
   ├── App Home
   ├── Incoming Webhooks
   ├── OAuth & Permissions
   └── Interactivity & Shortcuts  <-- ここ
   ```

### Step 4.2: Interactivity を有効化

1. 「Interactivity」のトグルが **On** になっていることを確認

2. **「Request URL」** フィールドに URL を入力:
   ```
   https://YOUR_DOMAIN/api/v1/webhooks/slack
   ```

   **URL の例**:
   - ローカル開発（ngrok）: `https://abc123.ngrok-free.app/api/v1/webhooks/slack`
   - ローカル開発（cloudflared）: `https://random-words.trycloudflare.com/api/v1/webhooks/slack`
   - 本番環境: `https://your-app.vercel.app/api/v1/webhooks/slack`

3. 「Save Changes」をクリック

> **注意**: Slack は URL を検証するため、サーバーが起動している必要があります。

---

## 5. チャンネルへの Bot 招待

Bot が通知を送信するには、対象チャンネルに招待する必要があります。

### Step 5.1: Slack でチャンネルを開く

1. 通知を送信したいチャンネルを開く

### Step 5.2: Bot を招待

**方法 A: スラッシュコマンド**

チャンネルで以下のコマンドを実行:
```
/invite @Feedback Agent
```

**方法 B: チャンネル設定から**

1. チャンネル名をクリック
2. 「インテグレーション」タブを選択
3. 「アプリを追加する」をクリック
4. 「Feedback Agent」を検索して追加

### Step 5.3: チャンネル ID の取得

チャンネル ID は環境変数に必要です。

**取得方法**:

1. Slack でチャンネルを開く
2. チャンネル名をクリック
3. 「チャンネル詳細」の最下部に ID が表示される
   ```
   チャンネル ID: C0XXXXXXXXX
   ```

または、チャンネルを右クリック → 「リンクをコピー」で得られる URL から:
```
https://your-workspace.slack.com/archives/C0XXXXXXXXX
                                          ^^^^^^^^^^^
                                          これがチャンネル ID
```

---

## 6. ngrok / cloudflared のセットアップ

ローカル開発時に Slack からの Webhook を受け取るには、ローカルサーバーを公開する必要があります。

### オプション A: ngrok（推奨）

#### インストール

```bash
# Windows (winget)
winget install ngrok.ngrok

# macOS (Homebrew)
brew install ngrok

# npm
npm install -g ngrok
```

#### アカウント設定（初回のみ）

1. https://ngrok.com でアカウント作成（無料）
2. ダッシュボードから Auth Token をコピー
3. トークンを設定:
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

#### 使用方法

```bash
# 開発サーバーを起動
npm run dev

# 別のターミナルで ngrok を起動
ngrok http 3000
```

出力例:
```
Session Status                online
Forwarding                    https://abc123.ngrok-free.app -> http://localhost:3000
```

> この `https://abc123.ngrok-free.app` を Slack の Request URL に設定します。

### オプション B: cloudflared（Cloudflare Tunnel）

#### インストール

```bash
# Windows (winget)
winget install Cloudflare.cloudflared

# macOS (Homebrew)
brew install cloudflared
```

#### 使用方法

```bash
# 開発サーバーを起動
npm run dev

# 別のターミナルで cloudflared を起動
cloudflared tunnel --url http://localhost:3000
```

出力例:
```
Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):
https://random-words.trycloudflare.com
```

> この URL を Slack の Request URL に設定します。

### 重要な注意点

- **URL は起動するたびに変わります**（有料プランを除く）
- 開発中は URL が変わるたびに Slack の Request URL を更新する必要があります
- 本番環境では固定の URL（Vercel, Railway など）を使用してください

---

## 7. 環境変数の設定

### Step 7.1: .env.local ファイルの作成

プロジェクトルートに `.env.local` ファイルを作成:

```bash
cp .env.example .env.local
```

### Step 7.2: 値の設定

`.env.local` を編集:

```env
# GitHub API (Issue作成用)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_REPO_OWNER=your-username
GITHUB_REPO_NAME=your-repo

# Slack
SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxx
SLACK_CHANNEL_ID=C0XXXXXXXXX
SLACK_SIGNING_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 各変数の取得方法

| 変数 | 取得場所 |
|------|---------|
| `GITHUB_TOKEN` | GitHub Settings → Developer settings → Personal access tokens → Generate new token（`repo` 権限が必要） |
| `GITHUB_REPO_OWNER` | GitHub リポジトリの所有者名（ユーザー名または組織名） |
| `GITHUB_REPO_NAME` | GitHub リポジトリ名 |
| `SLACK_BOT_TOKEN` | Slack App → OAuth & Permissions → Bot User OAuth Token |
| `SLACK_CHANNEL_ID` | Slack チャンネルの ID（セクション 5.3 参照） |
| `SLACK_SIGNING_SECRET` | Slack App → Basic Information → Signing Secret |

---

## 8. GitHub Secrets の設定

GitHub Actions で使用する Secrets を設定します。

### 方法 A: GitHub CLI を使用（推奨）

```bash
# Anthropic API Key
gh secret set ANTHROPIC_API_KEY --body "sk-ant-..."

# Slack Bot Token
gh secret set SLACK_BOT_TOKEN --body "xoxb-..."

# Slack Channel ID
gh secret set SLACK_CHANNEL_ID --body "C0XXXXXXXXX"
```

### 方法 B: GitHub Web UI を使用

1. GitHub でリポジトリを開く
2. 「Settings」タブをクリック
3. 左サイドバーの「Secrets and variables」→「Actions」をクリック
4. 「New repository secret」をクリック
5. 以下の Secrets を追加:

| Name | Value |
|------|-------|
| `ANTHROPIC_API_KEY` | Anthropic API キー（`sk-ant-...`） |
| `SLACK_BOT_TOKEN` | Slack Bot Token（`xoxb-...`） |
| `SLACK_CHANNEL_ID` | Slack チャンネル ID（`C0XXXXXXXXX`） |

---

## 9. 動作確認

### Step 9.1: 開発サーバーの起動

```bash
# 依存関係のインストール
npm install

# 開発サーバー起動
npm run dev
```

### Step 9.2: トンネルの起動

別のターミナルで:

```bash
ngrok http 3000
# または
cloudflared tunnel --url http://localhost:3000
```

### Step 9.3: Slack Request URL の更新

トンネルの URL を Slack の Interactivity Request URL に設定:
```
https://your-tunnel-url.ngrok-free.app/api/v1/webhooks/slack
```

### Step 9.4: テスト送信

cURL でフィードバックを送信:

```bash
curl -X POST http://localhost:3000/api/v1/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "title": "テストフィードバック",
    "description": "これはテストです",
    "category": "feature"
  }'
```

成功すると:
1. GitHub に Issue が作成される
2. Slack に通知が届く
3. 「計画を立てる」ボタンが表示される

---

## 10. トラブルシューティング

### エラー: "Invalid signature" (401)

**原因**: Slack の署名検証に失敗しています。

**解決策**:
1. `SLACK_SIGNING_SECRET` が正しいか確認
2. Slack App の Basic Information → Signing Secret と一致しているか確認
3. `.env.local` を保存後、開発サーバーを再起動

```bash
# サーバー再起動
npm run dev
```

### エラー: "Channel not found"

**原因**: Bot がチャンネルに招待されていない、またはチャンネル ID が間違っています。

**解決策**:
1. チャンネル ID が正しいか確認（`C` で始まる）
2. チャンネルで `/invite @Feedback Agent` を実行
3. プライベートチャンネルの場合、`groups:read` 権限があるか確認

### エラー: "Missing scope"

**原因**: Bot に必要な権限がありません。

**解決策**:
1. Slack App → OAuth & Permissions → Scopes
2. 以下の Bot Token Scopes があるか確認:
   - `chat:write`
   - `channels:read`
   - `groups:read`
3. 権限を追加した場合、「Reinstall to Workspace」をクリック

### エラー: "Request URL not verified"

**原因**: Slack が Request URL に到達できません。

**解決策**:
1. ngrok / cloudflared が起動しているか確認
2. 開発サーバーが起動しているか確認
3. URL が正しいか確認（末尾の `/api/v1/webhooks/slack` を含む）
4. ngrok の Web Interface（http://127.0.0.1:4040）でリクエストを確認

### エラー: GitHub Issue が作成されない

**原因**: GitHub Token の権限不足または設定ミス。

**解決策**:
1. `GITHUB_TOKEN` に `repo` 権限があるか確認
2. `GITHUB_REPO_OWNER` と `GITHUB_REPO_NAME` が正しいか確認
3. トークンが有効期限切れでないか確認

```bash
# トークンの確認
gh auth status
```

### エラー: GitHub Actions が動かない

**原因**: Secrets の設定漏れ、またはワークフロー権限の問題。

**解決策**:
1. すべての Secrets が設定されているか確認:
   - `ANTHROPIC_API_KEY`
   - `SLACK_BOT_TOKEN`
   - `SLACK_CHANNEL_ID`

2. リポジトリの Settings → Actions → General で:
   - 「Allow all actions and reusable workflows」が選択されている
   - 「Read and write permissions」が有効になっている

### ngrok の無料プランの制限

**問題**: 無料プランでは URL が毎回変わり、リクエスト数にも制限があります。

**解決策**:
1. 開発中は URL 変更のたびに Slack の Request URL を更新
2. 本番環境では Vercel, Railway, Fly.io などのホスティングサービスを使用
3. ngrok の有料プランで固定ドメインを取得

### デバッグのヒント

**Slack Webhook のリクエストを確認**:
```bash
# ngrok の Web Interface を開く
# http://127.0.0.1:4040 でリクエストの詳細が見れる
```

**サーバーログを確認**:
```bash
# 開発サーバーのコンソール出力を確認
npm run dev
```

**Slack App のログ**:
- Slack App → Event Subscriptions → Request URL 横の「Retry」で再送信可能

---

## 関連リンク

- [Slack API ドキュメント](https://api.slack.com/docs)
- [GitHub REST API](https://docs.github.com/en/rest)
- [Anthropic API](https://docs.anthropic.com/)
- [ngrok ドキュメント](https://ngrok.com/docs)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
