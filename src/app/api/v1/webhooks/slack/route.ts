import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';

const SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || '';
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || '';

function verifySlackSignature(
  signature: string,
  timestamp: string,
  body: string
): boolean {
  if (!SLACK_SIGNING_SECRET) return false;

  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp, 10)) > 300) return false;

  const sigBasestring = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac('sha256', SLACK_SIGNING_SECRET);
  hmac.update(sigBasestring);
  const computedSignature = `v0=${hmac.digest('hex')}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(computedSignature)
  );
}

async function triggerGitHubDispatch(
  owner: string,
  repo: string,
  eventType: string,
  issueNumber: number
): Promise<boolean> {
  const url = `https://api.github.com/repos/${owner}/${repo}/dispatches`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: eventType,
      client_payload: { issue_number: issueNumber },
    }),
  });

  return response.ok;
}

async function addIssueComment(
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<void> {
  await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    }
  );
}

async function closeIssue(
  owner: string,
  repo: string,
  issueNumber: number
): Promise<void> {
  await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`,
    {
      method: 'PATCH',
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ state: 'closed' }),
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    const slackSignature = request.headers.get('x-slack-signature') || '';
    const slackTimestamp = request.headers.get('x-slack-request-timestamp') || '';

    if (!verifySlackSignature(slackSignature, slackTimestamp, rawBody)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const params = new URLSearchParams(rawBody);
    const payloadStr = params.get('payload');

    if (!payloadStr) {
      return NextResponse.json({ error: 'Missing payload' }, { status: 400 });
    }

    const payload = JSON.parse(payloadStr);

    if (payload.type === 'url_verification') {
      return NextResponse.json({ challenge: payload.challenge });
    }

    if (payload.type === 'block_actions') {
      const action = payload.actions?.[0];
      if (!action) {
        return NextResponse.json({ error: 'No action found' }, { status: 400 });
      }

      const [repoFullName, issueNumberStr] = action.value.split('|');
      const [owner, repo] = repoFullName.split('/');
      const issueNumber = parseInt(issueNumberStr, 10);

      const targetOwner = owner || GITHUB_REPO_OWNER;
      const targetRepo = repo || GITHUB_REPO_NAME;

      if (!targetOwner || !targetRepo || isNaN(issueNumber)) {
        return NextResponse.json({ error: 'Invalid action value' }, { status: 400 });
      }

      const userName = payload.user?.name || payload.user?.username || 'Unknown';

      // 計画を立てる
      if (action.action_id === 'create_plan') {
        const success = await triggerGitHubDispatch(
          targetOwner,
          targetRepo,
          'claude-plan',
          issueNumber
        );

        if (success) {
          return NextResponse.json({
            response_type: 'in_channel',
            replace_original: true,
            text: `📋 Issue #${issueNumber} の計画を作成中...`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `📋 *Issue #${issueNumber}* の計画作成が *${userName}* により開始されました。\n\n計画が完成したら通知します...`,
                },
              },
            ],
          });
        }
      }

      // 再計画
      if (action.action_id === 'replan') {
        const success = await triggerGitHubDispatch(
          targetOwner,
          targetRepo,
          'claude-plan',
          issueNumber
        );

        if (success) {
          return NextResponse.json({
            response_type: 'in_channel',
            replace_original: true,
            text: `🔄 Issue #${issueNumber} の再計画中...`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `🔄 *Issue #${issueNumber}* の再計画が *${userName}* により開始されました。`,
                },
              },
            ],
          });
        }
      }

      // 実装承認
      if (action.action_id === 'approve_implementation') {
        const success = await triggerGitHubDispatch(
          targetOwner,
          targetRepo,
          'claude-implement',
          issueNumber
        );

        if (success) {
          return NextResponse.json({
            response_type: 'in_channel',
            replace_original: true,
            text: `✅ Issue #${issueNumber} の実装を開始しました`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `✅ *Issue #${issueNumber}* の実装が *${userName}* により承認されました。\n\n実装ワークフローを開始しています...`,
                },
              },
            ],
          });
        }
      }

      // 却下
      if (action.action_id === 'reject_implementation') {
        await addIssueComment(
          targetOwner,
          targetRepo,
          issueNumber,
          `## ❌ 却下\n\n${userName} により Slack で却下されました。`
        );
        await closeIssue(targetOwner, targetRepo, issueNumber);

        return NextResponse.json({
          response_type: 'in_channel',
          replace_original: true,
          text: `❌ Issue #${issueNumber} が却下されました`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `❌ *Issue #${issueNumber}* が *${userName}* により却下されました。\n\nIssue はクローズされました。`,
              },
            },
          ],
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Slack webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
