#!/usr/bin/env node

import { execSync } from 'child_process';
import { createInterface } from 'readline';
import { writeFileSync, existsSync } from 'fs';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (q) => new Promise((resolve) => rl.question(q, resolve));

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  title: (msg) => console.log(`\n${colors.bright}${colors.blue}${msg}${colors.reset}`),
  step: (msg) => console.log(`${colors.cyan}→${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}!${colors.reset} ${msg}`),
};

async function main() {
  console.log(`
${colors.bright}╔══════════════════════════════════════════╗
║   Claude Feedback Agent セットアップ     ║
╚══════════════════════════════════════════╝${colors.reset}
`);

  // Step 1: GitHub設定
  log.title('Step 1: GitHub 設定');

  let repoOwner, repoName;
  try {
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
    const match = remoteUrl.match(/github\.com[:/](.+?)\/(.+?)(\.git)?$/);
    if (match) {
      repoOwner = match[1];
      repoName = match[2];
      log.success(`リポジトリ検出: ${repoOwner}/${repoName}`);
    }
  } catch {
    log.warn('Git リモートが見つかりません');
  }

  if (!repoOwner) {
    repoOwner = await question('GitHub リポジトリオーナー: ');
  }
  if (!repoName) {
    repoName = await question('GitHub リポジトリ名: ');
  }

  const githubToken = await question('GitHub Token (repo権限付き): ');

  // Step 2: Anthropic API
  log.title('Step 2: Anthropic API');
  const anthropicKey = await question('Anthropic API Key (sk-ant-...): ');

  // Step 3: Slack設定
  log.title('Step 3: Slack 設定');

  console.log(`
${colors.yellow}Slack App が必要です。以下の手順で作成してください:${colors.reset}

1. https://api.slack.com/apps にアクセス
2. 「Create New App」→「From an app manifest」を選択
3. ワークスペースを選択
4. 以下のマニフェストを貼り付け:

${colors.cyan}-------------------------------------------${colors.reset}
display_information:
  name: Feedback Agent
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
    request_url: https://YOUR_DOMAIN/api/v1/webhooks/slack
${colors.cyan}-------------------------------------------${colors.reset}

5. 「Install to Workspace」をクリック
`);

  const slackBotToken = await question('Slack Bot Token (xoxb-...): ');
  const slackSigningSecret = await question('Slack Signing Secret: ');
  const slackChannelId = await question('通知先チャンネルID (C...): ');

  // Step 4: ファイル生成
  log.title('Step 4: 設定ファイル生成');

  // .env.local
  const envContent = `# GitHub API
GITHUB_TOKEN=${githubToken}
GITHUB_REPO_OWNER=${repoOwner}
GITHUB_REPO_NAME=${repoName}

# Slack
SLACK_BOT_TOKEN=${slackBotToken}
SLACK_CHANNEL_ID=${slackChannelId}
SLACK_SIGNING_SECRET=${slackSigningSecret}
`;

  writeFileSync('.env.local', envContent);
  log.success('.env.local を作成しました');

  // Step 5: GitHub Secrets設定
  log.title('Step 5: GitHub Secrets 設定');

  const secrets = {
    ANTHROPIC_API_KEY: anthropicKey,
    SLACK_BOT_TOKEN: slackBotToken,
    SLACK_CHANNEL_ID: slackChannelId,
  };

  for (const [name, value] of Object.entries(secrets)) {
    try {
      execSync(`echo "${value}" | gh secret set ${name} --repo ${repoOwner}/${repoName}`, {
        encoding: 'utf8',
        stdio: 'pipe',
      });
      log.success(`Secret ${name} を設定しました`);
    } catch (e) {
      log.warn(`Secret ${name} の設定に失敗しました。手動で設定してください。`);
    }
  }

  // 完了
  log.title('セットアップ完了!');

  console.log(`
${colors.green}次のステップ:${colors.reset}

1. Slack App の Interactivity URL を設定
   URL: https://YOUR_DOMAIN/api/v1/webhooks/slack

2. Slack Bot をチャンネルに招待
   /invite @Feedback Agent

3. 開発サーバーを起動
   npm run dev

4. ngrok でローカルを公開 (テスト用)
   ngrok http 3000

${colors.bright}詳細は README.md を参照してください${colors.reset}
`);

  rl.close();
}

main().catch(console.error);
