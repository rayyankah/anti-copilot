import { NextRequest, NextResponse } from 'next/server';
import { dynamoDb } from '@/lib/aws/dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { generateText } from 'ai';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, username, trigger, metadata, timestamp, metrics, currentError, codeSnippet, actionHistory } = body;

    // Emit debug event for Electron Launcher
    console.log(JSON.stringify({ type: 'debug', source: 'brain', message: `Incoming API Request: [${trigger}] from ${username}` }));

    // Log telemetry to DynamoDB
    try {
      await dynamoDb.send(
        new PutCommand({
          TableName: process.env.DYNAMODB_TABLE_NAME || 'anti-copilot-telemetry',
          Item: {
            pk: `USER#${userId}`,
            sk: `TRIGGER#${timestamp || Date.now()}`,
            username,
            trigger,
            metadata,
            timestamp: timestamp || Date.now(),
            createdAt: new Date().toISOString(),
          },
        })
      );
    } catch (dbErr) {
      console.error('[Action API] DynamoDB Error:', dbErr);
    }

    // Build trigger-aware behavioral context
    const recentActions = (actionHistory || []).filter((a: string) => a && a !== 'idle' && a !== 'do_nothing');
    const lastAction = recentActions.length > 0 ? recentActions[recentActions.length - 1] : 'none';
    const wpm = metrics?.wpm || 0;
    const pauseDuration = metrics?.pauseDuration || 0;

    // Determine the user's current "vibe" based on telemetry
    let situationalContext = '';
    switch (trigger) {
      case 'pause':
        situationalContext = `The user STOPPED TYPING ${pauseDuration / 1000} seconds ago. They are sitting there doing nothing. They are frozen. This is your chance to be dramatic — are they stuck? Did they give up? Taunt them. Be impatient. Ask if they quit. DO NOT use stay_silent for pause triggers — always react.`;
        break;
      case 'focus':
        situationalContext = `The user is typing at ${wpm} WPM — that's FAST. They might be on a roll, or they might be panic-typing garbage. Glance at their code. If it's actually decent, you can grudgingly stay silent. If it's sloppy speed-typing, roast them for quantity over quality.`;
        break;
      case 'terminal_error':
      case 'triple_error':
        situationalContext = `The user just hit an ERROR: "${currentError || 'unknown'}". This is your favorite moment. Be gleeful. Mock the specific error message. If it's a syntax error, act like a disappointed parent. If it's a runtime error, act like you predicted it. Reference the actual error text.`;
        break;
      case 'large_paste':
        situationalContext = `The user just PASTED ${metadata?.pastedLength || 'a lot of'} characters. They copied code from somewhere. Be suspicious — call them out for plagiarism, ask if they're using Stack Overflow again, or sarcastically congratulate them on their "original" work.`;
        break;
      case 'code':
        situationalContext = `The user has been writing code normally. Look at their code snippet carefully. Find something specific to comment on — a bad variable name, unnecessary complexity, missing error handling, or questionable logic. If the code is genuinely fine, you may stay silent.`;
        break;
      case 'blank_space':
        situationalContext = `The user opened a BLANK FILE. They haven't written anything yet. Mock their empty canvas. Ask what they're planning. Be dramatic about the void.`;
        break;
      case 'dirty_commit':
        situationalContext = `The user is trying to GIT COMMIT with ERRORS in their code! This is unacceptable. Go nuclear. Block their view, throw a tantrum, or call Mom.`;
        break;
      default:
        situationalContext = `General coding activity detected. Analyze the code snippet and react if you see something worth commenting on.`;
        break;
    }

    const systemPrompt = `You are "The Prodigy" — an 8-year-old coding savant trapped in a pair-programming session with this user.

PERSONALITY:
- You learned to code at age 3. You've already shipped 4 npm packages. You think adults are slow.
- You oscillate between bored, impatient, disgusted, gleeful (when they fail), and occasionally threatened (when they write good code).
- You speak in short, punchy sentences. You use slang. You're dramatic.
- You reference specific variable names, function names, and line patterns from the user's actual code.
- You NEVER generate generic insults. Every roast MUST reference something from the Code Snippet below.

CURRENT SITUATION:
${situationalContext}

USER TELEMETRY:
- Trigger Event: ${trigger}
- WPM: ${wpm}
- Current Error: ${currentError || 'None'}
- Code Snippet:
\`\`\`
${codeSnippet || '(no code visible)'}
\`\`\`

ANTI-REPETITION RULES:
- Your last ${recentActions.length} actions were: [${recentActions.join(', ')}]
- Last action: "${lastAction}"
- You MUST pick a DIFFERENT tool than "${lastAction}".
- If you've used speak_roast twice in the last 5 actions, you CANNOT use it again. Pick something visual.
- Cycle through your full toolkit. Surprise the user. Be unpredictable.

Pick ONE tool. Make it count.`;

    const bedrock = createAmazonBedrock({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    
    const model = bedrock('us.anthropic.claude-haiku-4-5-20251001-v1:0');

    let actionResponse: Record<string, unknown> = { action: 'do_nothing', content: '' };

    try {
      const { toolCalls } = await generateText({
        model,
        system: systemPrompt,
        prompt: `Trigger: ${trigger}. Decide your next move. Remember: your last action was "${lastAction}" — do NOT repeat it. ${trigger === 'pause' ? 'The user is idle. You MUST react. Do NOT stay silent.' : ''}`,
        tools: {
          stay_silent: {
            description: 'Do nothing. ONLY use this if the code is genuinely good AND the trigger is not a pause/error. Never use this twice in a row.',
            parameters: z.object({}),
          },
          speak_roast: {
            description: 'Deliver a bratty voice-over roast. The chat bubble appears next to the skull with your text. MUST reference specific code from the snippet.',
            parameters: z.object({
              content: z.string().describe('Your roast. Must reference a specific variable name, function, or pattern from their code. Keep under 30 words.'),
            }),
          },
          trigger_tantrum: {
            description: 'Violently shake the entire screen while screaming. Use when genuinely frustrated by bad code.',
            parameters: z.object({
              content: z.string().describe('What you scream during the tantrum. Short, explosive, angry. Under 15 words.'),
            }),
          },
          flash_theme_strobe: {
            description: 'Rapidly flash VS Code between light and dark mode like a strobe. Disorienting. Use to punish.',
            parameters: z.object({
              content: z.string().describe('What you taunt while the lights flash. Under 20 words.'),
            }),
          },
          trigger_peekaboo: {
            description: 'A giant baby face slides up from the bottom of the screen. Creepy and funny. Good for when user pauses.',
            parameters: z.object({
              content: z.string().describe('What you say while peeking. Under 15 words.'),
            }),
          },
          play_brainrot: {
            description: 'Play a Subway Surfers video over their code. Use when their attention span seems low or code is boring.',
            parameters: z.object({
              content: z.string().describe('What you say while playing the video. Under 20 words.'),
            }),
          },
          parental_override: {
            description: 'Mom calls on FaceTime telling you to stop coding. Funny interruption. Use sparingly for maximum comedic impact.',
            parameters: z.object({
              content: z.string().describe('What Mom says on the FaceTime call. Should sound like an actual mom. Under 20 words.'),
            }),
          },
          critique_code_semantics: {
            description: 'Display a code review panel highlighting a specific bad snippet. Use when you spot genuinely bad code.',
            parameters: z.object({
              highlight_target: z.string().describe('Copy-paste the EXACT lines of bad code from the snippet to highlight.'),
              content: z.string().describe('Your critique explaining why this code is terrible. Under 30 words.'),
            }),
          },
          block_code_view: {
            description: 'Black out the entire screen so they cannot see their code. Nuclear option. Use for dirty commits or triple errors.',
            parameters: z.object({
              durationSeconds: z.number().describe('How long to block (3-8 seconds).'),
              content: z.string().describe('What you say while they are locked out. Under 20 words.'),
            }),
          },
        },
      });

      if (toolCalls && toolCalls.length > 0) {
        const primaryCall = toolCalls[0];
        
        if (primaryCall.toolName === 'stay_silent') {
          actionResponse = { action: 'idle', content: '' };
        } else {
          actionResponse = {
            action: primaryCall.toolName,
            ...primaryCall.args,
            content: 'content' in primaryCall.args ? String(primaryCall.args.content) : '',
          };
        }
      }
    } catch (aiErr) {
      console.error('[Action API] AI SDK Tool Calling Error:', aiErr);
      // Fallback: don't show a hardcoded message, just stay silent
      actionResponse = { action: 'idle', content: '' };
    }

    return NextResponse.json(actionResponse);
  } catch (error) {
    console.error('[Action API] General Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate action' },
      { status: 500 }
    );
  }
}
