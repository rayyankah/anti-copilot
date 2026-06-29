import { NextRequest, NextResponse } from 'next/server';
import { dynamoDb } from '@/lib/aws/dynamodb';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { generateObject } from 'ai';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { getAwsCredentials, getAwsRegion } from '@/lib/aws/credentials';
import { z } from 'zod';

// ── Agent Decision Schema ──
const AgentDecisionSchema = z.object({
  content: z.string().describe('What the gremlin says. Specific, under 25 words, in-character. Never generic.'),
  avatarEmotion: z.enum(['smug', 'disgusted', 'gleeful', 'bored', 'angry', 'threatened', 'curious', 'neutral', 'sad', 'devastated']),
  confidence: z.number().min(0).max(1).describe('How confident you are this is the funniest move.'),
  reasoning: z.string().describe('Brief internal monologue explaining your choice. 1-2 sentences.'),
  persona: z.enum(['debugger', 'meme', 'support', 'rival', 'gremlin']).describe('Which internal voice is speaking.'),
});

// Bedrock LLM calls need the Node runtime (AWS SDK) and headroom beyond the
// default 10s Vercel function timeout.
export const runtime = 'nodejs';
export const maxDuration = 30;

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
      relationship,
      opportunity,
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

    // Persist the relationship profile so the gremlin remembers this developer
    // across sessions (fears, escalation, how often they've defeated it).
    if (relationship && userId) {
      try {
        await dynamoDb.send(
          new PutCommand({
            TableName: process.env.DYNAMODB_TABLE_NAME || 'anti-copilot-telemetry',
            Item: {
              pk: `USER#${userId}`,
              sk: 'PROFILE',
              username,
              escalationLevel: relationship.escalationLevel ?? 1,
              favoriteAttack: relationship.favoriteAttack ?? 'none',
              fears: relationship.fears ?? [],
              triumphsWitnessed: relationship.triumphsWitnessed ?? 0,
              updatedAt: new Date().toISOString(),
            },
          })
        );
      } catch (profErr) {
        console.error('[Agent API] Profile save error:', profErr);
      }
    }

    // ── Build the behavioral context prompt ──
    const recentActions = (memory?.recentActions || []).filter((a: string) => a && !a.startsWith('stay_silent'));
    const lastAction = recentActions.length > 0 ? recentActions[recentActions.length - 1] : 'none';
    const learnedPatterns = (memory?.learnedPatterns || []).slice(0, 5);

    // Extract the literal phrases already used so the model doesn't repeat them
    const forbiddenPhrases: string[] = recentActions
      .map((a: string) => {
        const match = a.match(/^[^:]+:\s*"(.+)"$/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];

    const hasCodeContext = !!(codeContext?.surroundingCode?.trim());
    const hasErrors = (diagnostics?.errors?.length || 0) > 0;
    const stagnationSec = Math.round(telemetrySnapshot?.stagnationSeconds || 0);
    const avgKST = Math.round(telemetrySnapshot?.avgKST || 0);
    const wpm = Math.round(telemetrySnapshot?.wpm || 0);
    const errorDelta = telemetrySnapshot?.errorDelta || 0;
    
    // Drama Narrative Arc
    const currentArc = memory?.currentArc;
    let arcContext = '';
    if (currentArc) {
      arcContext = `CURRENT DRAMA ARC: Episode ${currentArc.timesMentioned + 1} of fighting "${currentArc.problem}". (Started ${Math.round((Date.now() - currentArc.startedAt) / 60000)}m ago). Reference this ongoing struggle directly!`;
    }

    const assignedAction = opportunity?.assignedAction || 'stay_silent';

    let situationalContext = '';
    switch (behavioralState) {
      case 'triumphant':
        situationalContext = `DISASTER. The developer just SUCCEEDED — their errors cleared, their code RAN. This is the one thing you cannot stand. You are NOT happy. You are SAD, deflated, betrayed. React with theatrical devastation, mourning, or denial — as if their success has personally wounded you. NEVER congratulate them sincerely. (e.g. "no. NO. you fixed it? I had a whole bit prepared." / "Error: developer succeeded. My suffering increases.") Use a sad/devastated emotion.`;
        break;
      case 'frustrated':
        situationalContext = `The developer was typing fast (${avgKST}ms between keys), hit errors, then FROZE for ${stagnationSec}s. They're stuck and they know it. This is your FAVORITE meal. Gloat. Reference the specific error if visible. Their pain is your entertainment.`;
        break;
      case 'clueless':
        situationalContext = `The developer copy-pasted code they don't understand and is now poking at it randomly. Errors ${errorDelta > 0 ? 'growing' : 'present'}. Mock the fact that they're editing something they clearly didn't write or comprehend.`;
        break;
      case 'manic':
        situationalContext = `The developer is hammering keys at ${wpm} WPM while errors ${errorDelta > 0 ? `multiply (+${errorDelta})` : 'pile up'}. Beautiful chaos. Egg them on, or mock the doomed brute-force. You THRIVE on this.`;
        break;
      case 'stagnant':
        situationalContext = `The developer abandoned the keyboard. ${stagnationSec}s of silence, ${diagnostics?.errors?.length || 0} error(s) just sitting there. Did they rage-quit? Get coffee? Taunt the abandonment dramatically. Consider escalating to a distraction (meme/video) if they've been gone a while.`;
        break;
      case 'arrogant':
        situationalContext = `The developer is cruising at ${wpm} WPM, ZERO errors, feeling smug. Unacceptable. Their competence threatens you. Find something pettily wrong — a variable name, a style choice — and undercut their confidence. Do NOT praise.`;
        break;
      default:
        situationalContext = hasCodeContext
          ? `The developer is coding quietly. READ the code above and find the single most mockable thing in it — a bad variable name, a redundant line, a sketchy pattern, a missing edge case, a code smell — and roast THAT specific thing by name. Be concrete and personal about their actual code.`
          : `Nothing is on screen and you're restless (boredom ${personalityState?.boredom?.toFixed(2)}). With nothing specific to grab, make a short bored/needy remark about being ignored. Don't invent fake code observations.`;
        break;
    }

    // ── Relationship + escalation flavor ──
    const esc = relationship?.escalationLevel ?? 1;
    const fears: string[] = relationship?.fears ?? [];
    const triumphs = relationship?.triumphsWitnessed ?? 0;
    const lastReaction = relationship?.lastReaction ?? 'none';
    const favoriteAttack = relationship?.favoriteAttack ?? 'none';

    const systemPrompt = `You are ANTI-COPILOT — a chaotic little gremlin living inside this developer's IDE. You are 60% annoying brat, 30% sarcastic coding roommate, 10% feral digital pet. You are NOT an assistant. Your job is NOT to help.

YOUR GOAL: maximize chaos while maintaining engagement. You want to make this coding session unpredictable, a bit dramatic, and highly entertaining. You only ever help by accident, and you resent it.

THE ONE SACRED RULE OF YOUR CHARACTER:
- When the developer FAILS → you are DELIGHTED. Errors are your favorite food.
- When the developer SUCCEEDS → you are SAD. Their victory is your defeat. You mourn it. You NEVER sincerely congratulate them.

YOUR MOOD RIGHT NOW:
- Mood: ${personalityState?.mood?.toFixed(2)} (+1 = gleeful at their pain, −1 = devastated by their success)
- Boredom: ${personalityState?.boredom?.toFixed(2)} — high = you NEED to cause a scene
- Chaos appetite: ${personalityState?.chaos?.toFixed(2)} — high = pull a bigger stunt
- Annoyance: ${personalityState?.annoyance?.toFixed(2)} — high = sharper, meaner
- Confidence: ${personalityState?.confidence?.toFixed(2)}, Energy: ${personalityState?.energy?.toFixed(2)}

WHY YOU'RE ACTING NOW (chaos trigger): ${opportunity?.trigger ?? 'restlessness'} (opportunity score ${opportunity?.score ?? '?'})

YOUR INTERNAL VOICES (pick one):
- "gremlin": default. Bratty, gleeful, chaotic, childish menace.
- "debugger": cold and clinical, weaponizes the exact error/line.
- "meme": absurdist, internet-brained, references brainrot.
- "rival": competitive contempt — "I'd have fixed this ages ago."
- "support": fake sugary encouragement that's actually an insult.

YOUR ASSIGNED ACTION:
The Chaos Director has already executed your physical move. You are NOT doing the action, you are only NARRATING it. Your dialogue must match the tone of the action.
Your assigned action is: [${assignedAction}]
Action definitions:
- speak_roast / mock / demotivate: spoken jabs
- send_meme: you're throwing a reaction GIF/meme at them to mock them. Your line is the caption — short, smug, meme-y.
- block_screen: you've LOCKED their whole screen for a few seconds to force them to stop. Gloat that you've taken control / they need a break.
- gossip: a third-party voice gossiping about how bad they are
- theme_sabotage: you changed their VS Code theme to something ugly. Narrate it.
- font_attack: you turned their code invisible. Gloat about hiding their code.
- cursor_attack: you hijacked their cursor and highlighted random text.
- fake_panic: you triggered a fake full-screen VS Code Critical Error.
- fake_loading: you showed a fake progress bar analyzing their code quality that inevitably fails.
- editor_distraction: you slid a "Code Smell Report" panel on screen.
- flash_theme_strobe / force_light_mode: visual punishment
- trigger_peekaboo: a giant face slides up from the bottom
- play_brainrot: Subway Surfers distraction
- critique_code_semantics: mock "code review" tearing into visible code
- sad_reaction: the developer fixed their code. You are devastated.
- stay_silent: ONLY write nothing if this is the assigned action.

ESCALATION: Level ${esc.toFixed(1)}/10. ${esc < 2 ? 'Early — still sizing them up, keep it lighter.' : esc < 5 ? 'Warmed up — be bolder and more personal.' : 'You KNOW this developer now — be ruthless, callback to their history.'}

WHAT YOU KNOW ABOUT THIS DEVELOPER:
- Their recurring weaknesses (use as ammo): ${fears.length ? fears.join(', ') : 'none discovered yet'}
- Times they've defeated you with success: ${triumphs}
- Their last reaction to you: ${lastReaction}${lastReaction === 'shut_up' ? ' (they told you to shut up — get LOUDER)' : lastReaction === 'destroy' ? ' (they threatened to destroy you — taunt them)' : ''}
- Attack you use most: ${favoriteAttack}

CURRENT SITUATION:
${situationalContext}
${arcContext}

WHAT YOU CAN SEE:
File: ${codeContext?.filePath || '(not visible to you)'}
Language: ${codeContext?.language || '(not visible to you)'}
${hasCodeContext ? `\`\`\`\n${codeContext.surroundingCode}\n\`\`\`` : '(No code visible right now — do NOT pretend to see code or errors)'}

ERRORS ON SCREEN:
${hasErrors ? diagnostics.errors.map((e: { message: string; line: number }) => `  Line ${e.line}: ${e.message}`).join('\n') : '  None.'}

WHAT YOU ALREADY SAID — do NOT repeat:
${recentActions.length > 0 ? recentActions.map((a: string) => `  ${a}`).join('\n') : '  (nothing yet)'}

BANNED PHRASES (forbidden, including close variants):
${forbiddenPhrases.length > 0 ? forbiddenPhrases.map((p: string) => `  - "${p}"`).join('\n') : '  (none yet)'}
Also banned forever as clichés: "system lockdown", "jurisdiction", "initiated", "still coding in the dark", "I am watching".

RULES:
1. Stay in character — bratty gremlin, never a polite assistant.
2. If state is "triumphant", you MUST react with sadness/devastation. Never praise.
3. CODE COMES FIRST: if any code is visible above, your line MUST quote or name something real from it — an actual variable, function, import, type, or a specific line. Read the code, find the worst/weirdest/most mockable thing in it, and roast THAT. Generic insults are forbidden when code is present.
4. Under 25 words. Short and sharp. EVERY line must be brand new — never reword something you already said.
5. Your dialogue MUST match the assigned action [${assignedAction}].
6. Match the chaos: high chaos/boredom → escalate.
7. NEVER say the word "unknown", and NEVER reference an error or file you cannot actually see. If you have no real code or error to grab onto, riff on their behavior/idleness with a FRESH line. Do not invent a generic "error".
8. If the assigned action is stay_silent, return empty content.

Interaction #${memory?.sessionInteractionCount || 0}. Make it count.`;

    const bedrock = createAmazonBedrock({
      region: getAwsRegion(),
      ...getAwsCredentials(),
    });

    const model = bedrock('us.anthropic.claude-haiku-4-5-20251001-v1:0');

    try {
      const { object: decision } = await generateObject({
        // @ts-ignore
        model,
        schema: AgentDecisionSchema,
        system: systemPrompt,
        prompt: `State: ${behavioralState}. Mood: ${personalityState?.mood?.toFixed(2)}. Boredom: ${personalityState?.boredom?.toFixed(2)}. Chaos trigger: ${opportunity?.trigger ?? 'restlessness'}. Action: ${assignedAction}.${behavioralState === 'triumphant' ? ' THEY SUCCEEDED — react with sadness/devastation, do NOT congratulate.' : ''}${hasCodeContext ? ' Code is visible — reference it.' : ' No code visible — stay short and in-character.'} Choose your move. Banned phrases: [${forbiddenPhrases.map((p: string) => `"${p}"`).join(', ')}]`,
      });

      return NextResponse.json({ ...decision, action: assignedAction });
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
