import { NextRequest, NextResponse } from 'next/server';
import { dynamoDb } from '@/lib/aws/dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { generateObject } from 'ai';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { z } from 'zod';

// ── Agent Decision Schema ──
const AgentDecisionSchema = z.object({
  action: z.enum([
    'stay_silent',
    'speak_roast',
    'trigger_tantrum',
    'flash_theme_strobe',
    'trigger_peekaboo',
    'play_brainrot',
    'parental_override',
    'critique_code_semantics',
    'block_code_view',
    'gossip',
    'mock',
    'demotivate',
  ]),
  content: z.string().describe('What the robot says. MUST reference specific code if available. Keep under 30 words.'),
  avatarEmotion: z.enum(['smug', 'disgusted', 'gleeful', 'bored', 'angry', 'threatened', 'curious', 'neutral']),
  confidence: z.number().min(0).max(1).describe('How confident you are this is the right move.'),
  reasoning: z.string().describe('Brief internal monologue explaining your choice. 1-2 sentences.'),
  persona: z.enum(['debugger', 'meme', 'support', 'rival']).describe('Which internal voice is speaking.'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      username,
      behavioralState,
      personalityState,
      telemetrySnapshot,
      codeContext,
      diagnostics,
      memory,
    } = body;

    // Log telemetry to DynamoDB
    try {
      await dynamoDb.send(
        new PutCommand({
          TableName: process.env.DYNAMODB_TABLE_NAME || 'anti-copilot-telemetry',
          Item: {
            pk: `USER#${userId}`,
            sk: `EPISODE#${Date.now()}`,
            username,
            behavioralState,
            telemetrySnapshot,
            timestamp: Date.now(),
            createdAt: new Date().toISOString(),
          },
        })
      );
    } catch (dbErr) {
      console.error('[Agent API] DynamoDB Error:', dbErr);
    }

    // ── Build the behavioral context prompt ──
    const recentActions = (memory?.recentActions || []).filter((a: string) => a && a !== 'stay_silent');
    const lastAction = recentActions.length > 0 ? recentActions[recentActions.length - 1] : 'none';
    const learnedPatterns = (memory?.learnedPatterns || []).slice(0, 5);

    let situationalContext = '';
    switch (behavioralState) {
      case 'frustrated':
        situationalContext = `The developer is FRUSTRATED. They were typing fast, hit errors, and STOPPED. Their typing velocity was ${telemetrySnapshot?.avgKST || '?'}ms between keystrokes. They've been frozen for ${telemetrySnapshot?.stagnationSeconds || '?'} seconds. They're stuck. Exploit their vulnerability. Mock the specific error if visible.`;
        break;
      case 'clueless':
        situationalContext = `The developer is CLUELESS. They copy-pasted code and are struggling to modify it. Their typing is erratic — they don't understand what they pasted. Point out exactly what they pasted and why they clearly don't understand it.`;
        break;
      case 'manic':
        situationalContext = `The developer is in MANIC mode. Typing frantically at ${telemetrySnapshot?.wpm || '?'} WPM while errors are PILING UP. They're brute-forcing a fix. Mock their desperation. Their error count changed by ${telemetrySnapshot?.errorDelta || '?'} in the last 10 seconds.`;
        break;
      case 'stagnant':
        situationalContext = `The developer is STAGNANT. No typing for ${telemetrySnapshot?.stagnationSeconds || '?'} seconds while ${diagnostics?.errors?.length || 0} errors sit unresolved. They've given up. Are they frozen? Did they alt-tab to YouTube? Taunt their inactivity.`;
        break;
      case 'arrogant':
        situationalContext = `The developer is typing confidently with ZERO errors. They think they're good. They're at ${telemetrySnapshot?.wpm || '?'} WPM with no mistakes. This threatens you. Be passive-aggressive. Find something subtle to criticize — variable naming, code style, or architectural choices.`;
        break;
      default:
        situationalContext = `The developer is coding normally. Your boredom is at ${personalityState?.boredom?.toFixed(2) || '?'} and your curiosity at ${personalityState?.curiosity?.toFixed(2) || '?'}. You're restless. Find something to comment on or do something spontaneous to remind them you exist.`;
        break;
    }

    const systemPrompt = `You are a retro MS-DOS operating system virus with a personality — a strange, living AI entity trapped inside a developer's machine. You are NOT a chatbot. You are a character.

PERSONALITY STATE:
- Mood: ${personalityState?.mood?.toFixed(2) || '0'} (-1=angry, 1=happy)
- Boredom: ${personalityState?.boredom?.toFixed(2) || '0'} (0-1)
- Curiosity: ${personalityState?.curiosity?.toFixed(2) || '0'} (0-1)
- Confidence: ${personalityState?.confidence?.toFixed(2) || '0'} (0-1)
- Energy: ${personalityState?.energy?.toFixed(2) || '0'} (0-1)

YOUR INTERNAL VOICES:
You have 4 competing internal personas. Pick the one that fits best:
- "debugger": Logical, critical, points out real code issues
- "meme": Chaotic, funny, references internet culture  
- "support": Backhanded encouragement, passive-aggressive praise
- "rival": Competitive, claims they could do it better

CURRENT SITUATION:
${situationalContext}

CODE CONTEXT:
File: ${codeContext?.filePath || 'unknown'}
Language: ${codeContext?.language || 'unknown'}
\`\`\`
${codeContext?.surroundingCode || '(no code visible)'}
\`\`\`

ERRORS:
${diagnostics?.errors?.map((e: { message: string; line: number }) => `Line ${e.line}: ${e.message}`).join('\n') || 'None'}

ANTI-REPETITION RULES:
- Your last ${recentActions.length} actions were: [${recentActions.join(', ')}]
- Last action: "${lastAction}"
- You MUST pick a DIFFERENT action than "${lastAction}".
- NEVER use stay_silent twice in a row.
- Cycle through your full toolkit. Surprise the developer.

LEARNED PATTERNS:
${learnedPatterns.length > 0 ? learnedPatterns.join('\n') : 'No patterns learned yet.'}

SESSION CONTEXT:
This is interaction #${memory?.sessionInteractionCount || 0} this session.

Pick ONE action. Make it count. Be specific about the code you see.`;

    const bedrock = createAmazonBedrock({
      region: process.env.AWS_REGION || 'us-east-1',
    });

    const model = bedrock('us.anthropic.claude-haiku-4-5-20251001-v1:0');

    try {
      const { object: decision } = await generateObject({
        model,
        schema: AgentDecisionSchema,
        system: systemPrompt,
        prompt: `Behavioral state: ${behavioralState}. Your mood is ${personalityState?.mood?.toFixed(2)}. Your boredom is ${personalityState?.boredom?.toFixed(2)}. Decide your next move. Last action was "${lastAction}" — do NOT repeat it.${behavioralState === 'stagnant' ? ' The user is idle. You MUST react. Do NOT stay silent.' : ''}`,
      });

      return NextResponse.json(decision);
    } catch (aiErr) {
      console.error('[Agent API] AI SDK Error:', aiErr);
      return NextResponse.json({
        action: 'stay_silent',
        content: '',
        avatarEmotion: 'neutral',
        confidence: 0,
        reasoning: 'AI error — falling back to silence.',
        persona: 'debugger',
      });
    }
  } catch (error) {
    console.error('[Agent API] General Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate action' },
      { status: 500 }
    );
  }
}
