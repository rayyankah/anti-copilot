import { NextRequest } from 'next/server';
import { dynamoDb } from '@/lib/aws/dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { generateObject } from 'ai';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { getAwsCredentials, getAwsRegion } from '@/lib/aws/credentials';
import { corsHeaders, jsonWithCors, preflight } from '@/lib/cors';
import { z } from 'zod';

/**
 * /api/commentator — live-commentary brain.
 *
 * A separate "Commentator" frontend streams in the current conversation, what
 * the user is doing, and (optionally) an explicit event trigger. The brain
 * returns one in-character commentary line plus presentation metadata.
 *
 * This is the SAME Anti-Copilot gremlin persona, but in "color commentator"
 * mode — it narrates and reacts to a live session instead of attacking an IDE.
 */

export const runtime = 'nodejs';
export const maxDuration = 30;

// ── Request validation ──
const MessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']).default('user'),
  content: z.string(),
  name: z.string().optional(),
  timestamp: z.number().optional(),
});

const CommentatorRequestSchema = z.object({
  sessionId: z.string().optional(),
  // The running conversation the commentator is watching.
  conversation: z.array(MessageSchema).default([]),
  // Free-form description of what the user is currently doing.
  userActivity: z
    .object({
      summary: z.string().default(''),
      status: z.string().optional(), // e.g. "typing", "idle", "speaking", "winning"
      metadata: z.record(z.any()).optional(),
    })
    .default({ summary: '' }),
  // Optional explicit event the frontend wants the commentator to react to.
  event: z
    .object({
      type: z.string(), // see EVENT_PLAYBOOK below for recommended values
      payload: z.record(z.any()).optional(),
    })
    .optional(),
  // Tone / persona override.
  style: z
    .enum(['gremlin', 'hype', 'sports', 'snark', 'deadpan'])
    .default('gremlin'),
  // Recent lines already spoken, so the commentator never repeats itself.
  recentComments: z.array(z.string()).default([]),
});

// ── Structured LLM output ──
const CommentSchema = z.object({
  comment: z.string().describe('The single commentary line. Punchy, under 30 words, in-character.'),
  emotion: z.enum([
    'smug', 'gleeful', 'amused', 'hyped', 'bored', 'shocked',
    'disgusted', 'sarcastic', 'curious', 'neutral', 'sad', 'devastated',
  ]),
  intensity: z.number().min(0).max(1).describe('How loud/animated the delivery is. 0 = mutter, 1 = screaming.'),
  shouldSpeak: z.boolean().describe('False only if the best move is to stay quiet this beat.'),
  reasoning: z.string().describe('One-sentence internal note on why this line.'),
});

// ── Event playbook: how the commentator reacts to each trigger ──
const EVENT_PLAYBOOK: Record<string, string> = {
  intro:
    'OPENING. The session/stream just started. Set the stage with a cocky, hype-but-mocking opener that teases the user about what is to come.',
  outro:
    'CLOSING. The session is wrapping up. Deliver a smug sign-off that recaps the chaos and refuses to give sincere credit.',
  celebrate:
    'The user thinks they did something great. In gremlin mode you are deflated/jealous, not congratulatory; in hype mode you may go big — but never sincere praise without a twist.',
  roast:
    'Direct order to ROAST the user about their latest message or activity. Be specific and personal, punch at the actual thing they did.',
  hype:
    'Crank the energy. Build tension/excitement around what is happening RIGHT NOW like a play-by-play caller at peak moment.',
  react:
    'React to the MOST RECENT message in the conversation specifically — quote or name something real from it.',
  warn:
    'Warn the user (dramatically, mockingly) about a mistake or risk in what they are doing.',
  play_by_play:
    'Narrate the live action moment-to-moment, like a sportscaster describing the user fumbling through their task.',
  tangent:
    'Go off on a short, absurd tangent loosely connected to the conversation. Chaotic-brained aside.',
  silence:
    'Strongly consider staying silent (shouldSpeak=false) unless something is genuinely worth one dry remark.',
};

const STYLE_BRIEF: Record<string, string> = {
  gremlin:
    'You are ANTI-COPILOT — a chaotic gremlin commentator. 60% bratty menace, 30% sarcastic roommate, 10% feral pet. You mock more than you praise. When the user wins, you are SAD, never sincerely congratulatory.',
  hype:
    'You are a hype-caster: loud, fast, exaggerated, all-caps energy, but still landing sly digs at the user.',
  sports:
    'You are a deadpan-then-explosive sports color commentator calling the user\'s actions like a live match, full of mock-analysis and replays.',
  snark:
    'You are a dry, cutting snark machine. Minimal words, maximum contempt. Think witty heckler in the back row.',
  deadpan:
    'You are flat, clinical, and unbothered. Devastating one-liners delivered without a flicker of emotion.',
};

function summarizeConversation(conversation: z.infer<typeof MessageSchema>[]): string {
  if (!conversation.length) return '(no conversation yet)';
  // Keep it bounded — last ~12 turns, each clipped.
  const recent = conversation.slice(-12);
  return recent
    .map((m) => {
      const who = m.name || m.role;
      const text = m.content.length > 400 ? m.content.slice(0, 400) + '…' : m.content;
      return `${who}: ${text}`;
    })
    .join('\n');
}

export async function OPTIONS() {
  return preflight();
}

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = CommentatorRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return jsonWithCors(
        { error: 'Invalid request', issues: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { sessionId, conversation, userActivity, event, style, recentComments } =
      parsed.data;

    const eventType = event?.type?.toLowerCase();
    const eventInstruction =
      eventType && EVENT_PLAYBOOK[eventType]
        ? EVENT_PLAYBOOK[eventType]
        : eventType
        ? `The frontend triggered a custom event "${event!.type}". React to it: ${
            event?.payload ? JSON.stringify(event.payload) : '(no payload)'
          }.`
        : 'No explicit event — just comment on the live state below.';

    const convoBlock = summarizeConversation(conversation);
    const lastMessage =
      conversation.length > 0 ? conversation[conversation.length - 1].content : '';

    const systemPrompt = `${STYLE_BRIEF[style] || STYLE_BRIEF.gremlin}

YOU ARE IN LIVE-COMMENTATOR MODE. A separate app is watching a session and asking you to drop ONE commentary line for this exact moment. You are not an assistant; you are the peanut-gallery voice reacting in real time.

WHAT THE USER IS DOING RIGHT NOW:
${userActivity.summary || '(no activity description provided)'}${userActivity.status ? `\nStatus: ${userActivity.status}` : ''}${userActivity.metadata ? `\nDetails: ${JSON.stringify(userActivity.metadata)}` : ''}

THE CONVERSATION YOU ARE WATCHING (most recent last):
${convoBlock}

THIS BEAT'S DIRECTIVE (event = "${event?.type ?? 'none'}"):
${eventInstruction}

LINES YOU ALREADY SAID — do NOT repeat or reword these:
${recentComments.length ? recentComments.map((c) => `  - "${c}"`).join('\n') : '  (nothing yet)'}

RULES:
1. Output ONE line only. Under 30 words. Spoken aloud, so make it punchy.
2. Be SPECIFIC — reference the actual activity or the actual latest message${lastMessage ? ` (latest: "${lastMessage.slice(0, 160)}")` : ''}. No generic filler.
3. Stay 100% in character for the "${style}" style.
4. Never break the fourth wall about being an AI/model. You are the commentator.
5. If the directive is to stay silent and nothing is worth saying, set shouldSpeak=false and return an empty comment.
6. Match intensity to the moment — escalate for big events, mutter for dull ones.`;

    const bedrock = createAmazonBedrock({
      region: getAwsRegion(),
      ...getAwsCredentials(),
    });
    const model = bedrock('us.anthropic.claude-haiku-4-5-20251001-v1:0');

    let decision: z.infer<typeof CommentSchema>;
    try {
      const { object } = await generateObject({
        // @ts-ignore — dual @ai-sdk/provider versions confuse the overload resolver
        model,
        schema: CommentSchema,
        system: systemPrompt,
        prompt: `Event: ${event?.type ?? 'none'}. Style: ${style}. Activity: ${
          userActivity.summary || 'n/a'
        }. Give me your commentary line for this beat.`,
      });
      decision = object;
    } catch (aiErr) {
      console.error('[Commentator API] AI error:', aiErr);
      return jsonWithCors({
        comment: '',
        emotion: 'neutral',
        intensity: 0,
        shouldSpeak: false,
        reasoning: 'AI error — staying silent.',
        event: event?.type ?? null,
      });
    }

    // Best-effort: log the commentary so the session has a transcript.
    if (sessionId) {
      try {
        await dynamoDb.send(
          new PutCommand({
            TableName: process.env.DYNAMODB_TABLE_NAME || 'anti-copilot-telemetry',
            Item: {
              pk: `COMMENTARY#${sessionId}`,
              sk: `LINE#${Date.now()}`,
              event: event?.type ?? 'none',
              style,
              comment: decision.comment,
              emotion: decision.emotion,
              activity: userActivity.summary || '',
              createdAt: new Date().toISOString(),
            },
          })
        );
      } catch (dbErr) {
        console.error('[Commentator API] DynamoDB log error:', dbErr);
      }
    }

    return jsonWithCors({ ...decision, event: event?.type ?? null });
  } catch (error) {
    console.error('[Commentator API] General error:', error);
    return jsonWithCors({ error: 'Failed to generate commentary' }, { status: 500 });
  }
}

// Allow a simple browser GET to confirm the endpoint is alive.
export async function GET() {
  return new Response(
    JSON.stringify({
      ok: true,
      endpoint: '/api/commentator',
      method: 'POST',
      events: Object.keys(EVENT_PLAYBOOK),
      styles: Object.keys(STYLE_BRIEF),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
  );
}
