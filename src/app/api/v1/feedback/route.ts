import { NextRequest, NextResponse } from 'next/server';
import { Octokit } from '@octokit/rest';

const CATEGORY_LABELS: Record<string, string> = {
  bug: 'バグ報告',
  feature: '機能要望',
  question: '質問',
  other: 'その他',
};

async function sendSlackNotification(params: {
  issueNumber: number;
  issueUrl: string;
  title: string;
  description: string;
  category?: string;
  owner: string;
  repo: string;
}): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channelId = process.env.SLACK_CHANNEL_ID;

  if (!token || !channelId) {
    console.log('Slack notification skipped: missing credentials');
    return;
  }

  const categoryLabel = CATEGORY_LABELS[params.category || 'other'] || 'その他';
  const actionValue = `${params.owner}/${params.repo}|${params.issueNumber}`;

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        channel: channelId,
        text: `新しいフィードバック: ${params.title}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '📝 新しいフィードバック',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*カテゴリ:*\n${categoryLabel}` },
              { type: 'mrkdwn', text: `*Issue:*\n<${params.issueUrl}|#${params.issueNumber}>` },
            ],
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: `*タイトル:*\n${params.title}` },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*内容:*\n${params.description.slice(0, 500)}${params.description.length > 500 ? '...' : ''}`,
            },
          },
          { type: 'divider' },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: '*Claude Code で計画を立てますか？*' },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: { type: 'plain_text', text: '📋 計画を立てる', emoji: true },
                style: 'primary',
                action_id: 'create_plan',
                value: actionValue,
              },
              {
                type: 'button',
                text: { type: 'plain_text', text: '❌ 却下', emoji: true },
                style: 'danger',
                action_id: 'reject_implementation',
                value: actionValue,
              },
              {
                type: 'button',
                text: { type: 'plain_text', text: 'GitHub で確認', emoji: true },
                url: params.issueUrl,
              },
            ],
          },
        ],
      }),
    });

    const result = await response.json();
    if (!result.ok) {
      console.error('Slack notification failed:', result.error);
    }
  } catch (error) {
    console.error('Slack notification error:', error);
  }
}

const VALID_CATEGORIES = ['bug', 'feature', 'question', 'other'] as const;
type FeedbackCategory = (typeof VALID_CATEGORIES)[number];

interface FeedbackRequest {
  title: string;
  description: string;
  category?: FeedbackCategory;
}

function validateRequest(
  body: unknown
): { valid: true; data: FeedbackRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const { title, description, category } = body as Record<string, unknown>;

  if (typeof title !== 'string' || title.trim() === '') {
    return { valid: false, error: 'title is required' };
  }

  if (typeof description !== 'string' || description.trim() === '') {
    return { valid: false, error: 'description is required' };
  }

  if (category !== undefined) {
    if (typeof category !== 'string' || !VALID_CATEGORIES.includes(category as FeedbackCategory)) {
      return { valid: false, error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` };
    }
  }

  return {
    valid: true,
    data: {
      title: title.trim(),
      description: description.trim(),
      category: category as FeedbackCategory | undefined,
    },
  };
}

function getCategoryLabel(category?: FeedbackCategory): string {
  switch (category) {
    case 'bug': return 'bug';
    case 'feature': return 'enhancement';
    case 'question': return 'question';
    default: return 'other';
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON', code: 'INVALID_JSON' },
        { status: 400 }
      );
    }

    const validation = validateRequest(body);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error, code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const { data } = validation;
    const { title, description, category } = data;

    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_REPO_OWNER;
    const repo = process.env.GITHUB_REPO_NAME;

    if (!token || !owner || !repo) {
      return NextResponse.json(
        { success: false, error: 'GitHub not configured', code: 'CONFIG_ERROR' },
        { status: 500 }
      );
    }

    const octokit = new Octokit({ auth: token });
    const labels = ['user-feedback', getCategoryLabel(category)];

    const response = await octokit.issues.create({
      owner,
      repo,
      title,
      body: description,
      labels,
    });

    await sendSlackNotification({
      issueNumber: response.data.number,
      issueUrl: response.data.html_url,
      title,
      description,
      category,
      owner,
      repo,
    });

    return NextResponse.json(
      {
        success: true,
        issueNumber: response.data.number,
        issueUrl: response.data.html_url,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/v1/feedback error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit feedback', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
